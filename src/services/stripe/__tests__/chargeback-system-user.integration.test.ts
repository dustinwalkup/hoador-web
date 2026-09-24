import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";

/**
 * BIZ-06 against a REAL Postgres: a chargeback with no internal dispute
 * auto-creates one with `created_by = 'system'`, which only satisfies the
 * `disputes.created_by` FK once migration 0070 has seeded that user. The
 * setup truncates `user` before every test, so each test applies the
 * migration's own SQL — the file that ships, not a copy of it.
 */

vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn(async () => {}),
}));

import type Stripe from "stripe";
import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { ChargebackService } from "../chargeback-service";
import {
  createUser,
  createListing,
  createRentalRequest,
  createServiceListing,
  createServiceBooking,
  daysFromToday,
} from "@/test/integration/factories";

const {
  user,
  disputes,
  rentals,
  rentalPaymentLifecycle,
  payments,
  servicePaymentLifecycle,
} = schema;

const SEED_SQL = readFileSync(
  join(process.cwd(), "src/db/migrations/0070_seed_system_user.sql"),
  "utf-8",
);
const seedSystemUser = () => db.execute(sql.raw(SEED_SQL));

const chargeback = (charge: string, paymentIntent: string) =>
  ({
    id: `dp_${charge}`,
    charge,
    payment_intent: paymentIntent,
    amount: 8100,
    currency: "usd",
    reason: "fraudulent",
    status: "needs_response",
  }) as unknown as Stripe.Dispute;

async function paidRental() {
  const owner = await createUser();
  const renter = await createUser();
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id, {
    status: "approved",
    paymentStatus: "succeeded",
    startDate: daysFromToday(0),
    endDate: daysFromToday(2),
    totalAmount: "81.00",
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
    })
    .returning();
  await db.insert(rentalPaymentLifecycle).values({
    rentalId: rental.id,
    rentalChargeId: "ch_rental",
    depositHoldStatus: "not_applicable",
  });
  await db.insert(payments).values({
    rentalId: rental.id,
    payerId: renter.id,
    payeeId: owner.id,
    amount: request.totalAmount,
    stripePaymentIntentId: "pi_rental",
    status: "succeeded",
  });
  return rental;
}

async function paidServiceBooking() {
  const provider = await createUser();
  const requester = await createUser();
  const listing = await createServiceListing(provider.id);
  const booking = await createServiceBooking(listing, requester.id, {
    stripeChargeId: "ch_service",
  });
  await db.insert(payments).values({
    serviceBookingId: booking.id,
    payerId: requester.id,
    payeeId: provider.id,
    amount: booking.totalAmount,
    stripePaymentIntentId: "pi_service",
    status: "succeeded",
  });
  return booking;
}

const alertEvents = () =>
  vi.mocked(sendOpsAlert).mock.calls.map(([params]) => params.event);

describe("chargeback auto-dispute system user (BIZ-06, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the seed creates an inactive 'system' user and is safe to re-run", async () => {
    await seedSystemUser();
    await seedSystemUser();

    const rows = await db.select().from(user).where(eq(user.id, "system"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "System",
      status: "inactive",
      emailVerified: false,
    });
  });

  it("a rental chargeback creates the dispute, freezes the payout and alerts", async () => {
    await seedSystemUser();
    const rental = await paidRental();

    await ChargebackService.handleChargebackCreated(
      chargeback("ch_rental", "pi_rental"),
    );

    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.rentalId, rental.id));
    expect(dispute).toMatchObject({
      createdBy: "system",
      createdByRole: "renter",
      stripeChargebackId: "dp_ch_rental",
    });
    const [lifecycle] = await db
      .select()
      .from(rentalPaymentLifecycle)
      .where(eq(rentalPaymentLifecycle.rentalId, rental.id));
    expect(lifecycle.ownerTransferStatus).toBe("frozen");
    expect(alertEvents()).toEqual(["chargeback_created"]);
  });

  it("a service booking chargeback creates the dispute, freezes the payout and alerts", async () => {
    await seedSystemUser();
    const booking = await paidServiceBooking();

    await ChargebackService.handleChargebackCreated(
      chargeback("ch_service", "pi_service"),
    );

    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.serviceBookingId, booking.id));
    expect(dispute).toMatchObject({
      createdBy: "system",
      createdByRole: "requester",
      stripeChargebackId: "dp_ch_service",
    });
    const [lifecycle] = await db
      .select()
      .from(servicePaymentLifecycle)
      .where(eq(servicePaymentLifecycle.bookingId, booking.id));
    expect(lifecycle.ownerTransferStatus).toBe("frozen");
    expect(alertEvents()).toEqual(["chargeback_created"]);
  });

  it("without the seed, the FK still rejects the insert but ops is alerted", async () => {
    const rental = await paidRental();

    await expect(
      ChargebackService.handleChargebackCreated(
        chargeback("ch_rental", "pi_rental"),
      ),
    ).rejects.toThrow();

    expect(alertEvents()).toEqual(["chargeback_auto_dispute_create_failed"]);
    const [lifecycle] = await db
      .select()
      .from(rentalPaymentLifecycle)
      .where(eq(rentalPaymentLifecycle.rentalId, rental.id));
    expect(lifecycle.ownerTransferStatus).not.toBe("frozen");
  });
});
