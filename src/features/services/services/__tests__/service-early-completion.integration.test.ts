import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * BIZ-02 against a REAL Postgres: a provider cannot complete a booking before
 * its scheduled instant, and a booking completed early before that rule
 * existed is not paid out (nor stranded mid-claim) until the job's time.
 * Stripe and notifications are mocked; every database statement is real.
 */

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendNewBookingRequestNotification: vi.fn(),
  sendBookingAcceptedNotification: vi.fn(),
  sendBookingDeclinedNotification: vi.fn(),
  sendJobCompletedNotification: vi.fn(),
  sendServicePayoutNotification: vi.fn().mockResolvedValue(undefined),
}));
const mockCreateServiceTransfer = vi.fn();
vi.mock("@/services/stripe/service-payments", () => ({
  createServiceTransfer: (...a: unknown[]) => mockCreateServiceTransfer(...a),
}));
vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { ServiceNotYetDueError } from "@/dal/errors";
import { ServiceBookingService } from "../service-booking-service";
import { ServicePaymentLifecycleService } from "../service-payment-lifecycle-service";
import {
  createUser,
  createServiceListing,
  createServiceBooking,
  daysFromToday,
} from "@/test/integration/factories";

const { serviceBookings, servicePaymentLifecycle } = schema;

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (days: number) =>
  daysFromToday(days).toLocaleDateString("en-CA"); // YYYY-MM-DD, local

async function chargedBooking(
  overrides: Partial<typeof serviceBookings.$inferInsert>,
) {
  const provider = await createUser({ stripeConnectedAccountId: "acct_int" });
  const requester = await createUser();
  const listing = await createServiceListing(provider.id);
  const booking = await createServiceBooking(listing, requester.id, {
    stripeChargeId: "ch_svc_integration",
    ...overrides,
  });
  await db.insert(servicePaymentLifecycle).values({
    bookingId: booking.id,
    chargeId: "ch_svc_integration",
    providerPayout: "40.00",
  });
  return { provider, booking };
}

const bookingRow = async (id: string) =>
  (
    await db.select().from(serviceBookings).where(eq(serviceBookings.id, id))
  )[0];
const lifecycleRow = async (bookingId: string) =>
  (
    await db
      .select()
      .from(servicePaymentLifecycle)
      .where(eq(servicePaymentLifecycle.bookingId, bookingId))
  )[0];

describe("no service completion or payout before the job (BIZ-02, real DB)", () => {
  it("refuses to complete a booking scheduled in three days", async () => {
    const { provider, booking } = await chargedBooking({
      status: "accepted",
      proposedDate: isoDay(3),
    });

    await expect(
      ServiceBookingService.completeBooking(booking.id, provider.id, {}),
    ).rejects.toThrow(ServiceNotYetDueError);

    const stored = await bookingRow(booking.id);
    expect(stored.status).toBe("accepted");
    expect(stored.completedAt).toBeNull();
  });

  it("completes a booking whose time has passed", async () => {
    const { provider, booking } = await chargedBooking({
      status: "accepted",
      proposedDate: isoDay(-1),
    });

    await ServiceBookingService.completeBooking(booking.id, provider.id, {});

    expect((await bookingRow(booking.id)).status).toBe("completed");
  });

  // A row completed early before the rule shipped: past the 24h cooldown,
  // job still in the future. The cron must skip it WITHOUT claiming it.
  it("skips — and does not claim — a legacy early completion until its time", async () => {
    const { booking: early } = await chargedBooking({
      status: "completed",
      completedAt: new Date(Date.now() - 2 * DAY),
      proposedDate: isoDay(3),
    });
    const { booking: due } = await chargedBooking({
      status: "completed",
      completedAt: new Date(Date.now() - 2 * DAY),
      proposedDate: isoDay(-3),
    });
    mockCreateServiceTransfer.mockResolvedValue({
      success: true,
      transferId: "tr_integration",
    });

    const summary = await ServicePaymentLifecycleService.processPayouts(20);

    expect(summary.succeeded).toBe(1);
    expect(mockCreateServiceTransfer).toHaveBeenCalledTimes(1);
    expect(mockCreateServiceTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: due.id }),
    );
    expect((await lifecycleRow(early.id)).payoutStatus).toBe("pending");
    expect((await lifecycleRow(due.id)).payoutStatus).toBe("completed");
  });
});
