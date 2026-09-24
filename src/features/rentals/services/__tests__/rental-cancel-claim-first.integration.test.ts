import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

/**
 * CONC-02 against a REAL Postgres: an approved rental's cancel claims its
 * status transition before any money moves, and an owner's concurrent `start`
 * cannot also win. Stripe and notifications are mocked; every database
 * statement is real, and the races run on two pooled connections.
 */

const mockProcessRefund = vi.fn();
vi.mock("@/services/stripe/refund", () => ({
  processRefund: (...a: unknown[]) => mockProcessRefund(...a),
}));

const mockCreateOwnerTransfer = vi.fn();
vi.mock("@/services/stripe/payout", () => ({
  createOwnerTransfer: (...a: unknown[]) => mockCreateOwnerTransfer(...a),
}));

vi.mock("@/services/stripe/deposit-hold", () => ({
  releaseDepositHold: vi.fn(),
}));
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn(),
}));
vi.mock("@/features/rentals/notifications/rental-cancelled", () => ({
  sendRentalCancelledNotification: vi.fn(),
}));
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));
vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { rentalDAL, paymentLifecycleDAL } from "@/dal";
import { ConflictError } from "@/dal/errors";
import { cancelApprovedRental } from "../cancellation-service";
import {
  createUser,
  createListing,
  createRentalRequest,
  daysFromToday,
} from "@/test/integration/factories";
import {
  raceTwo,
  expectExactlyOneFulfilled,
} from "@/test/integration/run-concurrently";
import { createBarrier } from "@/test/integration/stripe-barrier";

const { rentalRequests, rentals, rentalPaymentLifecycle, payments } = schema;

/** An approved, paid rental that starts today, so the owner may start it. */
async function approvedRental(
  overrides: {
    status?: "approved" | "completed";
    paymentStatus?: "succeeded" | "refunded";
    returnConfirmedAt?: Date;
  } = {},
) {
  const owner = await createUser();
  const renter = await createUser();
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id, {
    status: overrides.status ?? "approved",
    paymentStatus: "succeeded",
    startDate: daysFromToday(0),
    endDate: daysFromToday(2),
    totalAmount: "81.00",
    serviceFee: "6.00",
    ownerPayout: "60.00",
  });
  const [rental] = await db
    .insert(rentals)
    .values({
      requestId: request.id,
      listingId: listing.id,
      renterId: renter.id,
      ownerId: owner.id,
      startDate: request.startDate,
      endDate: request.endDate,
      totalAmount: request.totalAmount,
      returnConfirmedAt: overrides.returnConfirmedAt,
    })
    .returning();
  await db.insert(rentalPaymentLifecycle).values({
    rentalId: rental.id,
    rentalChargeId: "ch_integration",
    depositHoldStatus: "not_applicable",
  });
  await db.insert(payments).values({
    rentalId: rental.id,
    payerId: renter.id,
    payeeId: owner.id,
    amount: request.totalAmount,
    stripePaymentIntentId: "pi_integration",
    status: overrides.paymentStatus ?? "succeeded",
  });
  return { owner, renter, request, rental };
}

const reload = async (id: string) =>
  (await db.select().from(rentalRequests).where(eq(rentalRequests.id, id)))[0];

const cancelAsRenter = (requestId: string, renterId: string) =>
  cancelApprovedRental(requestId, renterId, "renter", { reason: "plans" });

describe("rental cancel claims before money moves (CONC-02, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessRefund.mockResolvedValue({ success: true, refundId: "re_1" });
    mockCreateOwnerTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_1",
    });
  });

  // The audited bug, pinned in both interleavings: the cancel has already
  // read the rental as `approved` when the owner's start lands.
  it("start wins after cancel read the rental: nothing is refunded", async () => {
    const { owner, renter, request } = await approvedRental();
    const readContext = rentalDAL.getRentalCancellationContext.bind(rentalDAL);
    vi.spyOn(rentalDAL, "getRentalCancellationContext").mockImplementationOnce(
      async (id) => {
        const ctx = await readContext(id);
        await rentalDAL.startRental(request.id, owner.id);
        return ctx;
      },
    );

    await expect(cancelAsRenter(request.id, renter.id)).rejects.toThrow(
      ConflictError,
    );

    expect(mockProcessRefund).not.toHaveBeenCalled();
    expect(mockCreateOwnerTransfer).not.toHaveBeenCalled();
    expect((await reload(request.id)).status).toBe("active");
  });

  it("cancel claims first: a start during the refund loses", async () => {
    const { owner, renter, request } = await approvedRental();
    const barrier = createBarrier();
    let refundEntered!: () => void;
    const inRefund = new Promise<void>((r) => (refundEntered = r));
    mockProcessRefund.mockImplementationOnce(async () => {
      refundEntered();
      await barrier.wait();
      return { success: true, refundId: "re_1" };
    });

    const cancel = cancelAsRenter(request.id, renter.id);
    await inRefund; // the cancel's claim has committed
    await expect(rentalDAL.startRental(request.id, owner.id)).rejects.toThrow();
    barrier.release();

    await expect(cancel).resolves.toMatchObject({ success: true });
    expect((await reload(request.id)).status).toBe("cancelled");
  });

  it("lets exactly one of cancel and start win a real race", async () => {
    const { owner, renter, request } = await approvedRental();

    const { results } = await raceTwo(
      async () => {
        await cancelAsRenter(request.id, renter.id);
        return "cancelled" as const;
      },
      async () => {
        await rentalDAL.startRental(request.id, owner.id);
        return "active" as const;
      },
    );

    const { fulfilled } = expectExactlyOneFulfilled(results);
    const stored = await reload(request.id);
    expect(stored.status).toBe(fulfilled.value);
    if (fulfilled.value === "active") {
      expect(mockProcessRefund).not.toHaveBeenCalled();
    } else {
      expect(mockProcessRefund).toHaveBeenCalledTimes(1);
    }
  });

  it("two concurrent returns complete the rental once", async () => {
    const { owner, request } = await approvedRental();
    await rentalDAL.startRental(request.id, owner.id);

    const { results } = await raceTwo(
      () => rentalDAL.endRental(request.id, owner.id),
      () => rentalDAL.endRental(request.id, owner.id),
    );

    const { rejected } = expectExactlyOneFulfilled(results);
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    expect((await reload(request.id)).status).toBe("completed");
  });

  it("payout eligibility skips a completed rental whose charge was refunded", async () => {
    const returned = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const paid = await approvedRental({
      status: "completed",
      returnConfirmedAt: returned,
    });
    const refunded = await approvedRental({
      status: "completed",
      paymentStatus: "refunded",
      returnConfirmedAt: returned,
    });

    const eligible = await paymentLifecycleDAL.findEligibleForPayout(20);

    const ids = eligible.map((r) => r.rentalId);
    expect(ids).toContain(paid.rental.id);
    expect(ids).not.toContain(refunded.rental.id);
  });
});
