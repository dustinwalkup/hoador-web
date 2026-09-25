import { describe, it, expect } from "vitest";
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import type { ServicePaymentLifecycleRecord } from "@/db/schemas/service-payment-lifecycle.schema";
import {
  toServiceBookingLifecycleResponse,
  toServiceBookingListItem,
} from "../service-booking-projections";

const at = new Date("2026-09-24T12:00:00Z");

const row: ServiceBookingDashboardRow = {
  id: "book-1",
  listingId: "list-1",
  requesterId: "req-1",
  providerId: "prov-1",
  communityId: "comm-1",
  proposedDate: "2026-10-01",
  proposedTime: "09:00",
  hours: "2.00",
  notes: "Back gate",
  declineReason: null,
  acceptedAt: at,
  declinedAt: null,
  servicePrice: "50.00",
  serviceFee: "5.00",
  totalAmount: "55.00",
  status: "accepted",
  stripePaymentIntentId: "pi_secret",
  stripeChargeId: "ch_secret",
  paymentStatus: "succeeded",
  refundAmount: null,
  stripeRefundId: "re_secret",
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  completedAt: null,
  selectedPaymentMethodId: "pm_secret",
  expiresAt: at,
  createdAt: at,
  updatedAt: at,
  listingTitle: "Lawn mowing",
  counterparty: {
    id: "prov-1",
    firstName: "Ada",
    lastName: "Lovelace",
    profileImageUrl: null,
  },
};

describe("toServiceBookingListItem (SEC-07 / PRIV-04)", () => {
  it("drops every Stripe and payment-method id", () => {
    const out = toServiceBookingListItem(row);

    expect(JSON.stringify(out)).not.toMatch(/pi_|ch_|re_|pm_/);
    for (const key of [
      "stripePaymentIntentId",
      "stripeChargeId",
      "stripeRefundId",
      "selectedPaymentMethodId",
    ]) {
      expect(out).not.toHaveProperty(key);
    }
  });

  it("keeps everything else, including what the web cards read", () => {
    const sensitive = new Set([
      "stripePaymentIntentId",
      "stripeChargeId",
      "stripeRefundId",
      "selectedPaymentMethodId",
    ]);
    const expected = Object.fromEntries(
      Object.entries(row).filter(([key]) => !sensitive.has(key)),
    );

    expect(toServiceBookingListItem(row)).toEqual(expected);
  });

  // The point of an allowlist: a column added later doesn't leak by default.
  it("drops unknown keys, on the row and on the counterparty", () => {
    const out = toServiceBookingListItem({
      ...row,
      newSecretColumn: "x",
      counterparty: { ...row.counterparty, email: "ada@example.com" },
    } as ServiceBookingDashboardRow);

    expect(out).not.toHaveProperty("newSecretColumn");
    expect(out.counterparty).not.toHaveProperty("email");
  });
});

describe("toServiceBookingLifecycleResponse (PRIV-04)", () => {
  const record: ServicePaymentLifecycleRecord = {
    id: "spl-1",
    bookingId: "book-1",
    chargeId: "ch_secret",
    providerPayout: "45.00",
    ownerTransferStatus: "completed",
    payoutStatus: "completed",
    stripeTransferId: "tr_secret",
    ownerTransferredAt: at,
    transferAmount: "45.00",
    createdAt: at,
    updatedAt: at,
  };

  it("drops the Stripe ids and unknown keys, keeps the payout state", () => {
    const out = toServiceBookingLifecycleResponse({
      ...record,
      newSecretColumn: "x",
    } as ServicePaymentLifecycleRecord);

    expect(out).not.toHaveProperty("chargeId");
    expect(out).not.toHaveProperty("stripeTransferId");
    expect(out).not.toHaveProperty("newSecretColumn");
    expect(out).toMatchObject({
      bookingId: "book-1",
      providerPayout: "45.00",
      ownerTransferStatus: "completed",
      payoutStatus: "completed",
      transferAmount: "45.00",
    });
  });
});
