import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

/**
 * CONC-10 against a REAL Postgres: placing a security-deposit hold claims the
 * row first (`scheduled|failed → placing`), so overlapping placements and a
 * renter's cancel can never leave a live hold on a cancelled rental. Stripe
 * and notifications are mocked; every database statement is real, and the
 * interleavings are forced with a barrier inside the mocked Stripe call.
 */

const mockPlaceDepositHold = vi.fn();
const mockReleaseDepositHold = vi.fn();
vi.mock("@/services/stripe/deposit-hold", () => ({
  placeDepositHold: (...a: unknown[]) => mockPlaceDepositHold(...a),
  releaseDepositHold: (...a: unknown[]) => mockReleaseDepositHold(...a),
}));

vi.mock("@/services/stripe/refund", () => ({
  processRefund: vi.fn().mockResolvedValue({ success: true, refundId: "re_1" }),
}));
vi.mock("@/services/stripe/payout", () => ({
  createOwnerTransfer: vi
    .fn()
    .mockResolvedValue({ success: true, transferId: "tr_1" }),
}));
vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

const mockSendOpsAlert = vi.fn();
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...a: unknown[]) => mockSendOpsAlert(...a),
}));
vi.mock("@/features/rentals/notifications/rental-cancelled", () => ({
  sendRentalCancelledNotification: vi.fn(),
}));
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { paymentLifecycleDAL, rentalDAL } from "@/dal";
import { PaymentLifecycleService } from "../payment-lifecycle-service";
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

const { rentals, rentalPaymentLifecycle, payments } = schema;

/** An approved, paid rental starting tomorrow, its deposit hold `scheduled`. */
async function rentalAwaitingHold() {
  const owner = await createUser();
  const renter = await createUser({ stripeCustomerId: "cus_renter" });
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id, {
    status: "approved",
    paymentStatus: "succeeded",
    paymentMethodId: "pm_renter",
    startDate: daysFromToday(1),
    endDate: daysFromToday(3),
    totalAmount: "81.00",
    serviceFee: "6.00",
    ownerPayout: "60.00",
    securityDeposit: "50.00",
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
      securityDeposit: "50.00",
    })
    .returning();
  await db.insert(rentalPaymentLifecycle).values({
    rentalId: rental.id,
    rentalChargeId: "ch_integration",
    depositHoldStatus: "scheduled",
  });
  await db.insert(payments).values({
    rentalId: rental.id,
    payerId: renter.id,
    payeeId: owner.id,
    amount: request.totalAmount,
    stripePaymentIntentId: "pi_integration",
    status: "succeeded",
  });
  return { renter, request, rental };
}

const holdStatus = async (rentalId: string) =>
  (
    await db
      .select({ status: rentalPaymentLifecycle.depositHoldStatus })
      .from(rentalPaymentLifecycle)
      .where(eq(rentalPaymentLifecycle.rentalId, rentalId))
  )[0].status;

/** Resolves once `check` holds, polling the real DB. */
async function until(check: () => Promise<boolean>) {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("condition never became true");
}

describe("deposit hold placement claims first (CONC-10, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReleaseDepositHold.mockResolvedValue(undefined);
  });

  it("lets exactly one of two concurrent claims win", async () => {
    const { rental } = await rentalAwaitingHold();

    const { results } = await raceTwo(
      async () => {
        if (!(await paymentLifecycleDAL.claimForDepositHold(rental.id))) {
          throw new Error("claim lost");
        }
        return "a";
      },
      async () => {
        if (!(await paymentLifecycleDAL.claimForDepositHold(rental.id))) {
          throw new Error("claim lost");
        }
        return "b";
      },
    );

    expectExactlyOneFulfilled(results);
    expect(await holdStatus(rental.id)).toBe("placing");
  });

  it("releases a hold whose rental was cancelled while Stripe placed it", async () => {
    const { renter, request, rental } = await rentalAwaitingHold();
    const barrier = createBarrier();
    mockPlaceDepositHold.mockImplementation(async () => {
      await barrier.wait();
      return { success: true, paymentIntentId: "pi_hold" };
    });

    // The cron claims the row and parks inside the Stripe call…
    const cron = PaymentLifecycleService.scheduleDepositHolds(20);
    await until(async () => (await holdStatus(rental.id)) === "placing");

    // …the renter cancels meanwhile…
    await cancelApprovedRental(request.id, renter.id, "renter", {
      reason: "plans",
    });
    expect(await holdStatus(rental.id)).toBe("released");

    // …and the hold Stripe then returns is released, not left live.
    barrier.release();
    await cron;

    expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_hold");
    expect(await holdStatus(rental.id)).toBe("released");
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({ event: "deposit_hold_released_after_race" }),
    );
  });

  it("releases a hold placed after the cancel read its context", async () => {
    const { renter, request, rental } = await rentalAwaitingHold();
    mockPlaceDepositHold.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_hold",
    });

    // Park the cancel after it has read `scheduled` and claimed the rental,
    // before it settles the deposit.
    const barrier = createBarrier();
    const realCancelClaim = rentalDAL.cancelApprovedRental.bind(rentalDAL);
    let claimed = false;
    const spy = vi
      .spyOn(rentalDAL, "cancelApprovedRental")
      .mockImplementation(async (...args) => {
        const result = await realCancelClaim(...args);
        claimed = true;
        await barrier.wait();
        return result;
      });
    const cancel = cancelApprovedRental(request.id, renter.id, "renter", {
      reason: "plans",
    });
    await until(async () => claimed);

    // The cron places and records the hold in that window.
    await PaymentLifecycleService.scheduleDepositHolds(20);
    expect(await holdStatus(rental.id)).toBe("held");

    barrier.release();
    await cancel;

    spy.mockRestore();

    expect(mockReleaseDepositHold).toHaveBeenCalledWith("pi_hold");
    expect(await holdStatus(rental.id)).toBe("released");
  });
});
