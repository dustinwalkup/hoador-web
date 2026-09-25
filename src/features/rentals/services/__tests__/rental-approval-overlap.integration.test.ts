import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";

/**
 * CONC-01 against a REAL Postgres: approve re-checks the request's days under
 * a per-listing advisory lock, after the payment claim and before the charge,
 * so two overlapping requests for one listing can never both be charged.
 * Stripe is mocked; every database statement is real, and the race runs on
 * two pooled connections.
 *
 * `db:push:e2e` cannot create the `rental_requests_no_overlap` exclusion
 * constraint (it is not in the Drizzle schema), so the constraint tests apply
 * migration 0072's own SQL when the database lacks it.
 */

const mockChargeRentalPayment = vi.fn();
vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: (...a: unknown[]) => mockChargeRentalPayment(...a),
  getPaymentErrorMessage: (e: unknown) => (e as Error)?.message,
  isRetryablePaymentError: () => false,
}));

vi.mock("@/services/stripe/deposit-hold", () => ({
  placeDepositHold: vi.fn(),
  releaseDepositHold: vi.fn(),
}));

vi.mock("@/features/payments/lib/assert-connect-ready", () => ({
  assertConnectReady: vi.fn(),
}));

vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

// Notifications, Meta CAPI and PDF generation all run in `after()`.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { rentalDAL, userDAL } from "@/dal";
import { RentalDatesUnavailableError } from "@/dal/errors";
import { RentalService } from "../rental-service";
import {
  createUser,
  createListing,
  createRentalRequest,
  createVisibility,
  daysFromToday,
} from "@/test/integration/factories";
import {
  raceTwo,
  expectExactlyOneFulfilled,
} from "@/test/integration/run-concurrently";

const { rentalRequests, rentals } = schema;

const context = { ipAddress: null, userAgent: null };

const NO_OVERLAP_SQL = readFileSync(
  join(process.cwd(), "src/db/migrations/0072_rental_requests_no_overlap.sql"),
  "utf-8",
);
async function ensureNoOverlapConstraint() {
  const { rows } = await db.execute(
    sql`SELECT 1 FROM pg_constraint WHERE conname = 'rental_requests_no_overlap'`,
  );
  if (rows.length === 0) await db.execute(sql.raw(NO_OVERLAP_SQL));
}

const reload = async (id: string) =>
  (await db.select().from(rentalRequests).where(eq(rentalRequests.id, id)))[0];

/** Two requests from different renters for one listing. */
async function twoRequests(
  first: { startDate: Date; endDate: Date },
  second: { startDate: Date; endDate: Date },
) {
  const owner = await createUser();
  const listing = await createListing(owner.id);
  const [renterA, renterB] = [await createUser(), await createUser()];
  // Approve re-checks that both parties are visible in the listing's community.
  await createVisibility(listing.communityId, owner.id, renterA.id, renterB.id);
  const a = await createRentalRequest(listing.id, renterA.id, owner.id, {
    ...first,
    paymentMethodId: "pm_a",
  });
  const b = await createRentalRequest(listing.id, renterB.id, owner.id, {
    ...second,
    paymentMethodId: "pm_b",
  });
  return { owner, a, b };
}

const at = (days: number, hour: number) => {
  const d = daysFromToday(days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

describe("rental approval overlap (CONC-01, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(userDAL, "getOrCreateStripeCustomerId").mockResolvedValue(
      "cus_integration",
    );
    mockChargeRentalPayment.mockImplementation(async () => ({
      id: `pi_${Math.random().toString(36).slice(2)}`,
      status: "succeeded",
      latest_charge: "ch_integration",
    }));
  });

  it("refuses the second of two overlapping approvals before charging it", async () => {
    const { owner, a, b } = await twoRequests(
      { startDate: daysFromToday(3), endDate: daysFromToday(5) },
      { startDate: daysFromToday(4), endDate: daysFromToday(6) },
    );

    const approved = await RentalService.approveRentalRequest(
      a.id,
      owner.id,
      {},
      context,
    );
    expect(approved.success).toBe(true);

    await expect(
      RentalService.approveRentalRequest(b.id, owner.id, {}, context),
    ).rejects.toThrow(RentalDatesUnavailableError);

    expect(mockChargeRentalPayment).toHaveBeenCalledTimes(1);
    const refused = await reload(b.id);
    expect(refused.status).toBe("pending");
    // The claim was released, so the owner could still decline it.
    expect(refused.paymentStatus).toBe("pending");
    expect(await db.select().from(rentals)).toHaveLength(1);
  });

  it("charges exactly one of two overlapping approvals racing each other", async () => {
    const { owner, a, b } = await twoRequests(
      { startDate: daysFromToday(3), endDate: daysFromToday(5) },
      { startDate: daysFromToday(3), endDate: daysFromToday(5) },
    );

    const { results } = await raceTwo(
      () => RentalService.approveRentalRequest(a.id, owner.id, {}, context),
      () => RentalService.approveRentalRequest(b.id, owner.id, {}, context),
    );

    const { fulfilled, rejected } = expectExactlyOneFulfilled(results);
    expect(fulfilled.value.success).toBe(true);
    expect(rejected.reason).toBeInstanceOf(RentalDatesUnavailableError);
    expect(mockChargeRentalPayment).toHaveBeenCalledTimes(1);
    const statuses = [(await reload(a.id)).status, (await reload(b.id)).status];
    expect(statuses.sort()).toEqual(["approved", "pending"]);
  });

  // Whole days, inclusive at both ends, like `findConflict`: the item is out
  // on its return day, whatever time of day the timestamps carry.
  it("treats starting on another booking's last day as a clash", async () => {
    const { owner, a, b } = await twoRequests(
      { startDate: at(3, 5), endDate: at(5, 5) },
      { startDate: at(5, 22), endDate: at(7, 22) },
    );
    await RentalService.approveRentalRequest(a.id, owner.id, {}, context);

    await expect(
      RentalService.approveRentalRequest(b.id, owner.id, {}, context),
    ).rejects.toThrow(RentalDatesUnavailableError);
  });

  it("allows a booking starting the day after another ends, whatever the times", async () => {
    const { owner, a, b } = await twoRequests(
      { startDate: at(3, 5), endDate: at(5, 23) },
      { startDate: at(6, 1), endDate: at(8, 1) },
    );
    await RentalService.approveRentalRequest(a.id, owner.id, {}, context);

    const second = await RentalService.approveRentalRequest(
      b.id,
      owner.id,
      {},
      context,
    );
    expect(second.success).toBe(true);
  });

  it("does not let a request on another listing block these dates", async () => {
    const { owner, a } = await twoRequests(
      { startDate: daysFromToday(3), endDate: daysFromToday(5) },
      { startDate: daysFromToday(10), endDate: daysFromToday(11) },
    );
    const otherListing = await createListing(owner.id);
    const renter = await createUser();
    await createRentalRequest(otherListing.id, renter.id, owner.id, {
      status: "approved",
      paymentStatus: "succeeded",
      startDate: daysFromToday(3),
      endDate: daysFromToday(5),
    });

    expect(await rentalDAL.claimRentalRequestPaymentProcessing(a.id)).toBe(
      true,
    );
    await expect(
      rentalDAL.reserveDatesForApproval(a.id, "pending"),
    ).resolves.toEqual({ ok: true });
  });

  describe("rental_requests_no_overlap constraint (migration 0072)", () => {
    beforeAll(ensureNoOverlapConstraint);

    async function approvedOn(
      listingId: string,
      ownerId: string,
      startDate: Date,
      endDate: Date,
    ) {
      const renter = await createUser();
      return createRentalRequest(listingId, renter.id, ownerId, {
        status: "approved",
        paymentStatus: "succeeded",
        startDate,
        endDate,
      });
    }

    const pgCode = (error: unknown) =>
      ((error as { cause?: { code?: string } }).cause ?? error) as {
        code?: string;
      };

    it("rejects a second approved request on overlapping days", async () => {
      const owner = await createUser();
      const listing = await createListing(owner.id);
      await approvedOn(listing.id, owner.id, at(3, 5), at(5, 5));

      const error = await approvedOn(
        listing.id,
        owner.id,
        at(5, 22),
        at(7, 22),
      ).catch((e: unknown) => e);

      expect(pgCode(error).code).toBe("23P01");
    });

    it("allows the next day whatever the times, and pending overlaps", async () => {
      const owner = await createUser();
      const listing = await createListing(owner.id);
      const renter = await createUser();
      await approvedOn(listing.id, owner.id, at(3, 5), at(5, 23));

      await expect(
        approvedOn(listing.id, owner.id, at(6, 1), at(8, 1)),
      ).resolves.toBeDefined();
      await expect(
        createRentalRequest(listing.id, renter.id, owner.id, {
          startDate: at(4, 12),
          endDate: at(7, 12),
        }),
      ).resolves.toBeDefined();
    });

    // What the backstop exists for: something got past the re-check, so the
    // approve transaction itself hits the constraint.
    it("surfaces a violation in the approve transaction as DATES_UNAVAILABLE", async () => {
      const { owner, a, b } = await twoRequests(
        { startDate: daysFromToday(3), endDate: daysFromToday(5) },
        { startDate: daysFromToday(4), endDate: daysFromToday(6) },
      );
      await db
        .update(rentalRequests)
        .set({ status: "approved", paymentStatus: "succeeded" })
        .where(eq(rentalRequests.id, a.id));
      expect(await rentalDAL.claimRentalRequestPaymentProcessing(b.id)).toBe(
        true,
      );

      await expect(
        rentalDAL.approveRentalRequest(b.id, owner.id, {
          rentalPaymentIntentId: "pi_backstop",
        }),
      ).rejects.toThrow(RentalDatesUnavailableError);

      const stored = await reload(b.id);
      expect(stored.status).toBe("pending");
      expect(stored.paymentStatus).toBe("processing");
      expect(
        await db.select().from(rentals).where(eq(rentals.requestId, b.id)),
      ).toHaveLength(0);
    });
  });
});
