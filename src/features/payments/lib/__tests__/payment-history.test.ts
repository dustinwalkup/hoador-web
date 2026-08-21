import { describe, it, expect } from "vitest";
import { paymentStatusEnum, depositHoldStatusEnum } from "@/db/schemas/_enums";
import {
  toPaymentHistoryItem,
  type PaymentHistoryRow,
} from "../payment-history";

/**
 * Requirements: 12.2.1, 12.2.2, 14.1.4, 14.1.5
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md § P-E7-2
 */

const RENTAL_ROW: PaymentHistoryRow = {
  paymentId: "pay-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  rentalTitle: "Cordless Drill",
  serviceTitle: null,
  counterpartyName: "Dana Owner",
  date: new Date("2026-08-01T12:00:00Z"),
  amount: "80.00",
  status: "succeeded",
  refundAmount: null,
  refundedAt: null,
  refundReason: null,
  depositHoldStatus: "held",
};

const SERVICE_ROW: PaymentHistoryRow = {
  paymentId: "pay-2",
  rentalId: null,
  serviceBookingId: "booking-1",
  rentalTitle: null,
  serviceTitle: "Lawn Mowing",
  counterpartyName: "Pat Provider",
  date: new Date("2026-08-02T12:00:00Z"),
  amount: "60.00",
  status: "succeeded",
  refundAmount: null,
  refundedAt: null,
  refundReason: null,
  depositHoldStatus: null,
};

describe("toPaymentHistoryItem — both kinds (F2 regression guard)", () => {
  it("maps a rental charge", () => {
    expect(toPaymentHistoryItem(RENTAL_ROW)).toMatchObject({
      kind: "rental",
      bookingId: "rental-1",
      title: "Cordless Drill",
      counterpartyName: "Dana Owner",
      amount: "80.00",
      status: "succeeded",
    });
  });

  it("maps a service-booking charge", () => {
    // The case the web silently drops — a requester who has only ever booked
    // services sees an empty history there. First-class here.
    expect(toPaymentHistoryItem(SERVICE_ROW)).toMatchObject({
      kind: "service",
      bookingId: "booking-1",
      title: "Lawn Mowing",
      counterpartyName: "Pat Provider",
      amount: "60.00",
    });
  });
});

describe("toPaymentHistoryItem — deposit state (D-P6, Req 14.1.4)", () => {
  it("carries the deposit state on a rental row", () => {
    expect(toPaymentHistoryItem(RENTAL_ROW).depositHoldStatus).toBe("held");
  });

  it("omits the key entirely on a service row", () => {
    // Absent, not `not_applicable`: services have no deposit lifecycle at all,
    // and the server does not invent a value for a question the row can't be
    // asked.
    const item = toPaymentHistoryItem(SERVICE_ROW);

    expect("depositHoldStatus" in item).toBe(false);
    expect(item.depositHoldStatus).toBeUndefined();
  });

  it("omits the key on a service row even if the join leaked a value", () => {
    // Defence in depth: the join is on `payments.rentalId` so this cannot
    // happen today, but a future join change must not put a rental's deposit on
    // a service row.
    const item = toPaymentHistoryItem({
      ...SERVICE_ROW,
      depositHoldStatus: "held",
    });

    expect("depositHoldStatus" in item).toBe(false);
  });

  it("passes not_applicable through untouched", () => {
    // The server does not suppress it; the app decides to render no deposit UI
    // (Req 14.1.4). Swallowing it here would hide that decision from the client.
    const item = toPaymentHistoryItem({
      ...RENTAL_ROW,
      depositHoldStatus: "not_applicable",
    });

    expect(item.depositHoldStatus).toBe("not_applicable");
  });

  it("carries captured — the one state that means money actually moved", () => {
    // Req 14.1.5: the app may only say "charged" for a captured deposit, so the
    // distinction has to survive the wire.
    const item = toPaymentHistoryItem({
      ...RENTAL_ROW,
      depositHoldStatus: "captured",
    });

    expect(item.depositHoldStatus).toBe("captured");
  });

  it.each(depositHoldStatusEnum.enumValues)("round-trips %s", (status) => {
    const item = toPaymentHistoryItem({
      ...RENTAL_ROW,
      depositHoldStatus: status,
    });

    expect(item.depositHoldStatus).toBe(status);
  });

  it("drops an unrecognized deposit state rather than passing it through", () => {
    const item = toPaymentHistoryItem({
      ...RENTAL_ROW,
      depositHoldStatus: "teleported",
    });

    expect("depositHoldStatus" in item).toBe(false);
  });
});

describe("toPaymentHistoryItem — refunds", () => {
  it("returns a refund as its own fields, never netted off the amount", () => {
    // A renter needs to see "charged 80, refunded 30" — not "charged 50".
    const item = toPaymentHistoryItem({
      ...RENTAL_ROW,
      status: "refunded",
      amount: "80.00",
      refundAmount: "30.00",
      refundedAt: new Date("2026-08-05T12:00:00Z"),
      refundReason: "Returned early",
    });

    expect(item).toMatchObject({
      amount: "80.00",
      refundAmount: "30.00",
      refundReason: "Returned early",
      status: "refunded",
    });
  });

  it("returns nulls, not zeros, when there was no refund", () => {
    // "$0.00 refunded" reads as a refund that happened; null renders nothing.
    const item = toPaymentHistoryItem(RENTAL_ROW);

    expect(item.refundAmount).toBeNull();
    expect(item.refundedAt).toBeNull();
    expect(item.refundReason).toBeNull();
  });
});

describe("toPaymentHistoryItem — statuses", () => {
  it.each(paymentStatusEnum.enumValues)("round-trips %s", (status) => {
    // Includes `completed`, the back-compat member existing rows still use.
    expect(toPaymentHistoryItem({ ...RENTAL_ROW, status }).status).toBe(status);
  });

  it("keeps failed charges in the list", () => {
    // Filtering to successful charges would hide exactly the rows a renter
    // opens this screen to investigate.
    expect(
      toPaymentHistoryItem({ ...RENTAL_ROW, status: "failed" }).status,
    ).toBe("failed");
  });

  it("renders an unrecognized status as null rather than passing it through", () => {
    expect(
      toPaymentHistoryItem({ ...RENTAL_ROW, status: "teleported" }).status,
    ).toBeNull();
  });
});

describe("toPaymentHistoryItem — money is passed through", () => {
  it("passes decimal strings through byte-for-byte", () => {
    const item = toPaymentHistoryItem({
      ...RENTAL_ROW,
      amount: "1234.50",
      refundAmount: "0.10",
    });

    expect(item.amount).toBe("1234.50");
    expect(item.refundAmount).toBe("0.10");
  });
});
