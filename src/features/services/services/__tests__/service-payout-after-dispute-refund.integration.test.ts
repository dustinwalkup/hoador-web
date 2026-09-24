import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * BIZ-03 against a REAL Postgres: once a favor_renter dispute has refunded the
 * requester in full, nothing — not even the provider completing the job —
 * puts the booking back in front of the payout cron. Notifications and Stripe
 * are mocked; every database statement is real.
 */

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendNewBookingRequestNotification: vi.fn(),
  sendBookingAcceptedNotification: vi.fn(),
  sendBookingDeclinedNotification: vi.fn(),
  sendJobCompletedNotification: vi.fn(),
}));
vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { servicePaymentLifecycleDAL } from "@/dal";
import { ServiceBookingService } from "../service-booking-service";
import {
  createUser,
  createServiceListing,
  createServiceBooking,
  daysFromToday,
} from "@/test/integration/factories";

const { servicePaymentLifecycle } = schema;

const DAY = 24 * 60 * 60 * 1000;
/** A cutoff every completed booking in these tests is already past. */
const farFuture = () => new Date(Date.now() + 365 * DAY);

/** A charged booking in `status`, with the lifecycle acceptBooking creates. */
async function chargedBooking(status: "accepted" | "completed") {
  const provider = await createUser();
  const requester = await createUser();
  const listing = await createServiceListing(provider.id);
  const booking = await createServiceBooking(listing, requester.id, {
    status,
    stripeChargeId: "ch_svc_integration",
    // In the past, so completing it is allowed (BIZ-02).
    proposedDate: daysFromToday(-3).toLocaleDateString("en-CA"),
    ...(status === "completed" && {
      completedAt: new Date(Date.now() - 2 * DAY),
    }),
  });
  await db.insert(servicePaymentLifecycle).values({
    bookingId: booking.id,
    chargeId: "ch_svc_integration",
    providerPayout: "40.00",
    ownerTransferStatus: "pending",
    payoutStatus: "pending",
  });
  return { provider, booking };
}

const eligibleIds = async () =>
  (await servicePaymentLifecycleDAL.findEligibleForPayout(farFuture(), 50)).map(
    (r) => r.bookingId,
  );

const lifecycleOf = async (bookingId: string) =>
  (
    await db
      .select()
      .from(servicePaymentLifecycle)
      .where(eq(servicePaymentLifecycle.bookingId, bookingId))
  )[0];

describe("no service payout after a favor_renter refund (BIZ-03, real DB)", () => {
  it("pays out an ordinary completed booking (control)", async () => {
    const { booking } = await chargedBooking("completed");

    expect(await eligibleIds()).toContain(booking.id);
  });

  // The audited sequence: refund while accepted, then the provider taps
  // "Mark Complete", which used to reset payoutStatus to "pending".
  it("does not re-arm the payout when the provider completes afterwards", async () => {
    const { provider, booking } = await chargedBooking("accepted");
    await servicePaymentLifecycleDAL.markRefundedAfterDispute(booking.id);

    await ServiceBookingService.completeBooking(booking.id, provider.id, {
      ipAddress: null,
      userAgent: null,
    });

    const lifecycle = await lifecycleOf(booking.id);
    expect(lifecycle.payoutStatus).toBe("completed");
    expect(await eligibleIds()).not.toContain(booking.id);
  });

  // Even if some other path re-arms payoutStatus, the transfer guard holds.
  it("excludes a refunded booking whose payoutStatus was re-armed anyway", async () => {
    const { booking } = await chargedBooking("completed");
    await servicePaymentLifecycleDAL.markRefundedAfterDispute(booking.id);
    await servicePaymentLifecycleDAL.updatePayoutStatus(booking.id, "pending");

    expect(await eligibleIds()).not.toContain(booking.id);
  });
});
