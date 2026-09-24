import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

/**
 * BIZ-01 against a REAL Postgres: approve charges only a request that is still
 * pending, and approve / cancel cannot both win. Stripe is mocked; every
 * database statement is real, and the race runs on two pooled connections.
 */

const mockChargeRentalPayment = vi.fn();
vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: (...a: unknown[]) => mockChargeRentalPayment(...a),
  getPaymentErrorMessage: (e: unknown) => (e as Error)?.message,
  isRetryablePaymentError: () => false,
}));

const mockPlaceDepositHold = vi.fn();
vi.mock("@/services/stripe/deposit-hold", () => ({
  placeDepositHold: (...a: unknown[]) => mockPlaceDepositHold(...a),
  releaseDepositHold: vi.fn(),
}));

const mockAssertConnectReady = vi.fn();
vi.mock("@/features/payments/lib/assert-connect-ready", () => ({
  assertConnectReady: (...a: unknown[]) => mockAssertConnectReady(...a),
}));

vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { rentalDAL, userDAL } from "@/dal";
import { ConflictError, RentalRequestNotPendingError } from "@/dal/errors";
import { RentalService } from "../rental-service";
import {
  createUser,
  createListing,
  createRentalRequest,
} from "@/test/integration/factories";
import {
  raceTwo,
  expectExactlyOneFulfilled,
} from "@/test/integration/run-concurrently";

const { rentalRequests, rentals } = schema;

async function pendingRequest() {
  const owner = await createUser();
  const renter = await createUser();
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id);
  return { owner, renter, request };
}

const reload = async (id: string) =>
  (await db.select().from(rentalRequests).where(eq(rentalRequests.id, id)))[0];

describe("rental approval pending gate (BIZ-01, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to approve a cancelled request and charges nothing", async () => {
    const { owner, request } = await pendingRequest();
    const stripeCustomer = vi.spyOn(userDAL, "getOrCreateStripeCustomerId");
    await rentalDAL.cancelRentalRequest(request.id, request.renterId);

    await expect(
      RentalService.approveRentalRequest(
        request.id,
        owner.id,
        {},
        {
          ipAddress: null,
          userAgent: null,
        },
      ),
    ).rejects.toThrow(RentalRequestNotPendingError);

    expect(stripeCustomer).not.toHaveBeenCalled();
    expect(mockChargeRentalPayment).not.toHaveBeenCalled();
    const stored = await reload(request.id);
    expect(stored.status).toBe("cancelled");
    expect(stored.paymentStatus).toBe("pending");
    expect(await db.select().from(rentals)).toHaveLength(0);
  });

  it("will not claim a request that was declined", async () => {
    const { owner, request } = await pendingRequest();
    await rentalDAL.declineRentalRequest(request.id, "Not available", owner.id);

    expect(
      await rentalDAL.claimRentalRequestPaymentProcessing(request.id),
    ).toBe(false);
    expect((await reload(request.id)).paymentStatus).toBe("pending");
  });

  it("will not cancel or decline a request whose charge is claimed", async () => {
    const { owner, request } = await pendingRequest();
    expect(
      await rentalDAL.claimRentalRequestPaymentProcessing(request.id),
    ).toBe(true);

    await expect(
      rentalDAL.cancelRentalRequest(request.id, request.renterId),
    ).rejects.toThrow(ConflictError);
    await expect(
      rentalDAL.declineRentalRequest(request.id, "Too late", owner.id),
    ).rejects.toThrow(ConflictError);
    expect((await reload(request.id)).status).toBe("pending");
  });

  it("approves a claimed request and creates its rental in one step", async () => {
    const { owner, request } = await pendingRequest();
    await rentalDAL.claimRentalRequestPaymentProcessing(request.id);

    await rentalDAL.approveRentalRequest(request.id, owner.id, {
      rentalPaymentIntentId: "pi_integration",
    });

    const stored = await reload(request.id);
    expect(stored.status).toBe("approved");
    expect(stored.paymentStatus).toBe("succeeded");
    const created = await db
      .select()
      .from(rentals)
      .where(eq(rentals.requestId, request.id));
    expect(created).toHaveLength(1);
    expect(created[0].rentalPaymentIntentId).toBe("pi_integration");
  });

  it("refuses to approve without the payment claim, and creates no rental", async () => {
    const { owner, request } = await pendingRequest();

    await expect(
      rentalDAL.approveRentalRequest(request.id, owner.id),
    ).rejects.toThrow(ConflictError);

    expect((await reload(request.id)).status).toBe("pending");
    expect(await db.select().from(rentals)).toHaveLength(0);
  });

  // The race the claim exists for, run for real: a renter's cancel and an
  // owner's approval claim hit the same pending request at once.
  it("lets exactly one of cancel and claim win a real race", async () => {
    const { request } = await pendingRequest();

    const { results } = await raceTwo(
      async () => {
        await rentalDAL.cancelRentalRequest(request.id, request.renterId);
        return "cancelled" as const;
      },
      async () => {
        if (!(await rentalDAL.claimRentalRequestPaymentProcessing(request.id)))
          throw new Error("claim lost");
        return "claimed" as const;
      },
    );

    const { fulfilled } = expectExactlyOneFulfilled(results);
    const stored = await reload(request.id);
    if (fulfilled.value === "cancelled") {
      expect(stored.status).toBe("cancelled");
      expect(stored.paymentStatus).toBe("pending");
    } else {
      expect(stored.status).toBe("pending");
      expect(stored.paymentStatus).toBe("processing");
    }
  });
});
