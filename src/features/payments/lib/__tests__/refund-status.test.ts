import { describe, it, expect } from "vitest";

import { refundStatusFor } from "../refund-status";

/**
 * UAT E2E-007: a rental cancelled after acceptance kept `payment_status =
 * succeeded`, so both detail screens said "Paid" over a refund that payment
 * history showed correctly. The refund is recorded beside the charge
 * (`payments.refund_amount`, `service_bookings.refund_amount`); this reads it.
 */
describe("refundStatusFor", () => {
  it("is null when nothing has been refunded", () => {
    expect(refundStatusFor("26.06", null)).toBeNull();
    expect(refundStatusFor("26.06", undefined)).toBeNull();
    expect(refundStatusFor("26.06", "0.00")).toBeNull();
  });

  // The staging rental: $26.06 charged, the $25.00 rental price refunded, the
  // $1.06 service fee kept.
  it("is partial when some of the charge came back", () => {
    expect(refundStatusFor("26.06", "25.00")).toBe("partial");
  });

  it("is full when all of it came back", () => {
    expect(refundStatusFor("26.06", "26.06")).toBe("full");
  });

  // Compared in cents, so float noise in a decimal string cannot turn a full
  // refund into a partial one.
  it("compares in cents, not floats", () => {
    expect(refundStatusFor("0.30", "0.3")).toBe("full");
    expect(refundStatusFor("100.10", "100.1")).toBe("full");
  });

  it("does not claim a full refund it cannot see the charge for", () => {
    expect(refundStatusFor(null, "25.00")).toBe("partial");
  });
});
