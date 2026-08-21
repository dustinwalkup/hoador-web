import { describe, it, expect } from "vitest";
import {
  ownerTransferStatusEnum,
  serviceOwnerTransferStatusEnum,
} from "@/db/schemas/_enums";
import {
  CHARGE_PAYMENT_TYPES,
  EARNINGS_PAYMENT_STATUSES,
  TRANSFER_STATUSES,
  toEarningsItem,
  type EarningsRow,
} from "../earnings";

/**
 * Requirements: 13.3.1, 13.3.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md § P-E7-1
 *
 * Every unit test in this repo mocks `@/db/db`, so SQL semantics cannot be
 * asserted here. What can be — and what these cover — is the arithmetic and
 * shape, which is where the money guarantees actually live.
 */

const RENTAL_ROW: EarningsRow = {
  paymentId: "pay-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  rentalTitle: "Cordless Drill",
  serviceTitle: null,
  counterpartyName: "Alex Renter",
  rentalCompletedAt: new Date("2026-08-10T17:00:00Z"),
  serviceCompletedAt: null,
  gross: "100.00",
  platformFee: "20.00",
  net: "80.00",
  rentalTransferStatus: "completed",
  serviceTransferStatus: null,
  rentalTransferredAt: new Date("2026-08-12T09:00:00Z"),
  serviceTransferredAt: null,
  disputeId: null,
};

const SERVICE_ROW: EarningsRow = {
  paymentId: "pay-2",
  rentalId: null,
  serviceBookingId: "booking-1",
  rentalTitle: null,
  serviceTitle: "Lawn Mowing",
  counterpartyName: "Sam Requester",
  rentalCompletedAt: null,
  serviceCompletedAt: new Date("2026-08-11T15:00:00Z"),
  gross: "60.00",
  platformFee: "12.00",
  net: "48.00",
  rentalTransferStatus: null,
  serviceTransferStatus: "pending",
  rentalTransferredAt: null,
  serviceTransferredAt: null,
  disputeId: null,
};

describe("toEarningsItem — kinds", () => {
  it("maps a rental row from its rental-side columns", () => {
    expect(toEarningsItem(RENTAL_ROW)).toMatchObject({
      kind: "rental",
      id: "pay-1",
      bookingId: "rental-1",
      title: "Cordless Drill",
      counterpartyName: "Alex Renter",
      transferStatus: "completed",
      completedAt: new Date("2026-08-10T17:00:00Z"),
    });
  });

  it("maps a service row from its service-side columns", () => {
    expect(toEarningsItem(SERVICE_ROW)).toMatchObject({
      kind: "service",
      id: "pay-2",
      bookingId: "booking-1",
      title: "Lawn Mowing",
      counterpartyName: "Sam Requester",
      transferStatus: "pending",
      completedAt: new Date("2026-08-11T15:00:00Z"),
    });
  });

  it("never crosses the wires between a rental and a service row", () => {
    // A rental row carries nulls in every service column and vice versa; reading
    // the wrong side would silently produce an item with an empty title.
    expect(toEarningsItem(RENTAL_ROW).title).not.toBe("");
    expect(toEarningsItem(SERVICE_ROW).title).not.toBe("");
  });
});

describe("toEarningsItem — money is passed through, never computed", () => {
  it("returns the stored fee even when it is not 20% of gross", () => {
    // The regression guard for the whole design: the 20% figure must be encoded
    // in exactly one place, and this is not it.
    const item = toEarningsItem({
      ...RENTAL_ROW,
      gross: "100.00",
      platformFee: "7.50",
      net: "92.50",
    });

    expect(item.platformFee).toBe("7.50");
    expect(item.net).toBe("92.50");
  });

  it("passes decimal strings through byte-for-byte", () => {
    // Any parse/format round-trip would drop the trailing zero or introduce a
    // float; asserting the exact string is what catches that.
    const item = toEarningsItem({
      ...RENTAL_ROW,
      gross: "1234.50",
      platformFee: "246.90",
      net: "987.60",
    });

    expect(item.gross).toBe("1234.50");
    expect(item.platformFee).toBe("246.90");
    expect(item.net).toBe("987.60");
  });

  it("does not recompute net from gross and fee", () => {
    // Deliberately inconsistent input: if the mapper did the subtraction it
    // would "correct" this to 80.00 and hide a real server-side discrepancy.
    const item = toEarningsItem({
      ...RENTAL_ROW,
      gross: "100.00",
      platformFee: "20.00",
      net: "0.01",
    });

    expect(item.net).toBe("0.01");
  });
});

describe("toEarningsItem — dispute link (D-P5, Req 13.3.2)", () => {
  it("links the dispute while the payout is frozen", () => {
    const item = toEarningsItem({
      ...RENTAL_ROW,
      rentalTransferStatus: "frozen",
      disputeId: "dispute-1",
    });

    expect(item).toMatchObject({
      transferStatus: "frozen",
      disputeId: "dispute-1",
    });
  });

  it("degrades to no link when a frozen payout has no dispute row", () => {
    const item = toEarningsItem({
      ...RENTAL_ROW,
      rentalTransferStatus: "frozen",
      disputeId: null,
    });

    expect(item.disputeId).toBeNull();
  });

  it("does not link a dispute when the payout is not frozen", () => {
    // A booking can have a dispute whose transfer has already been released;
    // surfacing "payout on hold" there would be wrong.
    const item = toEarningsItem({
      ...RENTAL_ROW,
      rentalTransferStatus: "completed",
      disputeId: "dispute-1",
    });

    expect(item.disputeId).toBeNull();
  });
});

describe("toEarningsItem — unknown and missing values", () => {
  it("renders an unrecognized transfer status as null rather than passing it through", () => {
    const item = toEarningsItem({
      ...RENTAL_ROW,
      rentalTransferStatus: "teleported",
    });

    expect(item.transferStatus).toBeNull();
  });

  it("survives a missing lifecycle row", () => {
    // The lifecycle row is created by the payout pipeline, so a very fresh
    // booking can legitimately have a payment and no lifecycle yet.
    const item = toEarningsItem({
      ...RENTAL_ROW,
      rentalTransferStatus: null,
      rentalTransferredAt: null,
    });

    expect(item.transferStatus).toBeNull();
    expect(item.transferredAt).toBeNull();
  });
});

describe("filters", () => {
  it("includes payouts that have not been sent yet (D-P8)", () => {
    // The filter is on payment status, never on transfer status — a `pending`
    // or `frozen` payout is exactly the row an owner wants to see.
    expect(EARNINGS_PAYMENT_STATUSES).toEqual(["succeeded", "completed"]);
    expect(EARNINGS_PAYMENT_STATUSES as readonly string[]).not.toContain(
      "pending",
    );
  });

  it("counts only charges, never a deposit hold (D-P3)", () => {
    expect(CHARGE_PAYMENT_TYPES).toEqual(["rental_charge", "service_charge"]);
    expect(CHARGE_PAYMENT_TYPES as readonly string[]).not.toContain(
      "security_deposit_hold",
    );
  });
});

describe("transfer-status enum drift guard (D-P4)", () => {
  it("matches the rental pg enum exactly", () => {
    expect([...TRANSFER_STATUSES]).toEqual([
      ...ownerTransferStatusEnum.enumValues,
    ]);
  });

  it("matches the service pg enum exactly", () => {
    // Two distinct pg types with identical members today. If either gains or
    // renames a value, this fails in CI — rather than in a released binary that
    // cannot be hot-fixed.
    expect([...TRANSFER_STATUSES]).toEqual([
      ...serviceOwnerTransferStatusEnum.enumValues,
    ]);
  });
});
