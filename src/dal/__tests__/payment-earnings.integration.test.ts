import { describe, it, expect } from "vitest";

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { paymentDAL } from "@/dal";
import {
  createServiceBooking,
  createServiceListing,
  createUser,
} from "@/test/integration/factories";

/**
 * The earnings feed against a real Postgres (2026-09-24, mobile Epic 13
 * follow-up to R-BIZ-03). Which REFUNDED charges count as earnings is a WHERE
 * clause over two lifecycles and the dispute join, and a mocked `db` would
 * pass any WHERE at all.
 *
 * Service bookings only: the rental half of the rule is the same OR over
 * `rental_payment_lifecycle`, and there is no rental-row factory yet.
 */

type Lifecycle = Partial<typeof schema.servicePaymentLifecycle.$inferInsert>;
type Payment = Partial<typeof schema.payments.$inferInsert>;

async function booking(
  providerId: string,
  label: string,
  {
    payment = {},
    lifecycle = {},
    dispute = false,
  }: { payment?: Payment; lifecycle?: Lifecycle; dispute?: boolean } = {},
) {
  const requester = await createUser();
  const listing = await createServiceListing(providerId, { title: label });
  const row = await createServiceBooking(listing, requester.id);
  await db.insert(schema.payments).values({
    serviceBookingId: row.id,
    payerId: requester.id,
    payeeId: providerId,
    amount: "60.00",
    platformFee: "12.00",
    status: "succeeded",
    paymentType: "service_charge",
    paidAt: new Date(),
    ...payment,
  });
  await db.insert(schema.servicePaymentLifecycle).values({
    bookingId: row.id,
    providerPayout: "48.00",
    ...lifecycle,
  });
  let disputeId: string | null = null;
  if (dispute) {
    const [d] = await db
      .insert(schema.disputes)
      .values({
        serviceBookingId: row.id,
        createdBy: requester.id,
        createdByRole: "requester",
        reasonCode: "quality_issue",
        description: "Integration-test dispute",
        policyVersion: "v1",
        status: "resolved",
        resolutionOutcome: "favor_renter",
      })
      .returning();
    disputeId = d.id;
  }
  return { bookingId: row.id, disputeId };
}

describe("paymentDAL.getUserEarnings — refunded charges", () => {
  it("keeps what the payee was paid or is owed, marks a refund as refunded, and drops what was never earned", async () => {
    const provider = await createUser();

    const paid = await booking(provider.id, "Paid normally", {
      lifecycle: { ownerTransferStatus: "completed", stripeTransferId: "tr_1" },
    });
    // Partial outcome or cancellation share: refunded charge, real transfer.
    const partlyRefunded = await booking(provider.id, "Partly refunded", {
      payment: { status: "refunded", refundAmount: "30.00" },
      lifecycle: { ownerTransferStatus: "completed", stripeTransferId: "tr_2" },
    });
    // Full dispute refund, after Stripe's charge.refunded webhook.
    const disputeRefund = await booking(provider.id, "Dispute refund", {
      payment: { status: "refunded", refundAmount: "60.00" },
      lifecycle: {
        ownerTransferStatus: "completed",
        payoutStatus: "completed",
      },
      dispute: true,
    });
    // The same, BEFORE the webhook: the charge still reads succeeded.
    const beforeWebhook = await booking(provider.id, "Before webhook", {
      lifecycle: {
        ownerTransferStatus: "completed",
        payoutStatus: "completed",
      },
      dispute: true,
    });
    // A cancellation share whose transfer failed: owed, so shown.
    const failedShare = await booking(provider.id, "Failed share", {
      payment: { status: "refunded", refundAmount: "30.00" },
      lifecycle: { ownerTransferStatus: "failed" },
    });
    // Full-refund cancellation, nothing paid or owed, no dispute: never earnings.
    await booking(provider.id, "Cancelled, full refund", {
      payment: { status: "refunded", refundAmount: "60.00" },
    });

    const result = await paymentDAL.getUserEarnings(provider.id);
    const byBooking = new Map(
      result.data.map((item) => [item.bookingId, item]),
    );

    // The count joins what the WHERE reads, so it agrees with the rows.
    expect(result.pagination.total).toBe(5);
    expect(result.data).toHaveLength(5);

    expect(byBooking.get(paid.bookingId)).toMatchObject({
      transferStatus: "completed",
      refundAmount: null,
      disputeId: null,
    });
    expect(byBooking.get(partlyRefunded.bookingId)).toMatchObject({
      transferStatus: "completed",
      refundAmount: "30.00",
    });
    expect(byBooking.get(disputeRefund.bookingId)).toMatchObject({
      transferStatus: "refunded",
      refundAmount: "60.00",
      disputeId: disputeRefund.disputeId,
    });
    expect(byBooking.get(beforeWebhook.bookingId)).toMatchObject({
      transferStatus: "refunded",
      refundAmount: null,
      disputeId: beforeWebhook.disputeId,
    });
    expect(byBooking.get(failedShare.bookingId)).toMatchObject({
      transferStatus: "failed",
      refundAmount: "30.00",
    });
  });

  it("pages by the same rule it filters by", async () => {
    const provider = await createUser();
    for (const label of ["a", "b", "c"]) {
      await booking(provider.id, label, {
        lifecycle: { ownerTransferStatus: "pending" },
      });
    }
    for (const label of ["d", "e"]) {
      await booking(provider.id, label, {
        payment: { status: "refunded", refundAmount: "60.00" },
      });
    }

    const first = await paymentDAL.getUserEarnings(provider.id, {
      page: 1,
      limit: 2,
    });
    const second = await paymentDAL.getUserEarnings(provider.id, {
      page: 2,
      limit: 2,
    });

    expect(first.pagination.total).toBe(3);
    expect([...first.data, ...second.data]).toHaveLength(3);
  });
});
