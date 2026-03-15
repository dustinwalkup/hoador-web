import { describe, it, expect, vi } from "vitest";

vi.mock("@/constants/payments", () => ({
  PLATFORM_FEE_PERCENTAGE: 0.6,
}));

const { calculateRenterCancellationRefund } =
  await import("../refund-calculations");

/**
 * When platform fee exceeds the retained amount (50% of rental), owner transfer
 * must be floored at 0. With PLATFORM_FEE_PERCENTAGE = 0.6, for a $10 rental
 * under 24h: retained = $5, fee = $6 → owner transfer would be -$1 → 0.
 */
describe("calculateRenterCancellationRefund (platform fee exceeds retained)", () => {
  it("ownerTransferAmountCents is 0 when platform fee exceeds retained amount", () => {
    const now = new Date("2025-06-01T10:00:00Z");
    const startDate = new Date("2025-06-02T08:00:00Z"); // 22h later
    const result = calculateRenterCancellationRefund(10, startDate, now);
    expect(result.refundAmountCents).toBe(500); // 50% of $10
    expect(result.ownerTransferAmountCents).toBe(0);
    expect(result.refundReason).toBe("renter_cancellation_under_24h");
  });
});
