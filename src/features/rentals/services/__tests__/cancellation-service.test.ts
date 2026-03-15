import { describe, it, expect } from "vitest";
import {
  calculateRenterCancellationRefund,
  calculateOwnerCancellationRefund,
  calculateNoShowRefund,
} from "../refund-calculations";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";

describe("refund calculation helpers", () => {
  describe("calculateRenterCancellationRefund", () => {
    it(">=24h before pickup: full rental price refund, 0 owner transfer", () => {
      const now = new Date("2025-06-01T10:00:00Z");
      const startDate = new Date("2025-06-02T14:00:00Z"); // 28h later
      const result = calculateRenterCancellationRefund(100, startDate, now);
      expect(result.refundAmountCents).toBe(10000);
      expect(result.ownerTransferAmountCents).toBe(0);
      expect(result.refundReason).toBe("renter_cancellation_24h");
    });

    it("<24h before pickup: 50% rental price refund, owner transfer = 50% minus platform fee", () => {
      const now = new Date("2025-06-01T10:00:00Z");
      const startDate = new Date("2025-06-02T08:00:00Z"); // 22h later
      const result = calculateRenterCancellationRefund(100, startDate, now);
      const halfRentalCents = 5000;
      const platformFeeCents = Math.round(100 * PLATFORM_FEE_PERCENTAGE * 100);
      expect(result.refundAmountCents).toBe(halfRentalCents);
      expect(result.ownerTransferAmountCents).toBe(
        halfRentalCents - platformFeeCents,
      );
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });

    it("exactly 24h boundary: full refund (>=24h)", () => {
      const now = new Date("2025-06-01T12:00:00Z");
      const startDate = new Date("2025-06-02T12:00:00Z"); // exactly 24h
      const result = calculateRenterCancellationRefund(50, startDate, now);
      expect(result.refundAmountCents).toBe(5000);
      expect(result.ownerTransferAmountCents).toBe(0);
      expect(result.refundReason).toBe("renter_cancellation_24h");
    });

    it("very small amounts: rounding edge cases", () => {
      const now = new Date("2025-06-01T10:00:00Z");
      const startDate = new Date("2025-06-02T08:00:00Z"); // <24h
      const result = calculateRenterCancellationRefund(0.01, startDate, now);
      expect(result.refundAmountCents).toBeGreaterThanOrEqual(0);
      expect(result.ownerTransferAmountCents).toBeGreaterThanOrEqual(0);
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });

    it("rounding: small rental under 24h produces non-negative owner transfer", () => {
      const now = new Date("2025-06-01T10:00:00Z");
      const startDate = new Date("2025-06-02T09:00:00Z"); // 23h
      const result = calculateRenterCancellationRefund(1.11, startDate, now);
      expect(result.ownerTransferAmountCents).toBeGreaterThanOrEqual(0);
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });

    it("23h59m59s before pickup: 50% refund (<24h applies)", () => {
      const now = new Date("2025-06-01T12:00:00Z");
      const startDate = new Date("2025-06-02T11:59:59Z"); // just under 24h
      const result = calculateRenterCancellationRefund(100, startDate, now);
      expect(result.refundAmountCents).toBe(5000);
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });

    it("after startDate (negative hoursUntilPickup): 50% refund and owner transfer (<24h tier)", () => {
      const startDate = new Date("2025-06-01T10:00:00Z");
      const now = new Date("2025-06-01T14:00:00Z"); // 4h after start
      const result = calculateRenterCancellationRefund(100, startDate, now);
      const halfRentalCents = 5000;
      const platformFeeCents = Math.round(100 * PLATFORM_FEE_PERCENTAGE * 100);
      expect(result.refundAmountCents).toBe(halfRentalCents);
      expect(result.ownerTransferAmountCents).toBe(
        halfRentalCents - platformFeeCents,
      );
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });

    it("odd cents ($99.99): Math.round produces integer cents", () => {
      const now = new Date("2025-06-01T10:00:00Z");
      const startDate = new Date("2025-06-02T08:00:00Z");
      const result = calculateRenterCancellationRefund(99.99, startDate, now);
      expect(Number.isInteger(result.refundAmountCents)).toBe(true);
      expect(Number.isInteger(result.ownerTransferAmountCents)).toBe(true);
      expect(result.refundAmountCents).toBe(Math.round(9999 / 2)); // 5000
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });

    it("large amount ($1000): correct 50% and owner transfer under 24h", () => {
      const now = new Date("2025-06-01T10:00:00Z");
      const startDate = new Date("2025-06-02T08:00:00Z");
      const result = calculateRenterCancellationRefund(1000, startDate, now);
      expect(result.refundAmountCents).toBe(50000);
      const platformFeeCents = Math.round(1000 * PLATFORM_FEE_PERCENTAGE * 100);
      expect(result.ownerTransferAmountCents).toBe(50000 - platformFeeCents);
      expect(result.refundReason).toBe("renter_cancellation_under_24h");
    });
  });

  describe("calculateOwnerCancellationRefund", () => {
    it("full charge refund, 0 owner transfer", () => {
      const result = calculateOwnerCancellationRefund(100.5);
      expect(result.refundAmountCents).toBe(10050);
      expect(result.ownerTransferAmountCents).toBe(0);
      expect(result.refundReason).toBe("owner_cancellation");
    });

    it("rounds total charge to cents", () => {
      const result = calculateOwnerCancellationRefund(10.999);
      expect(result.refundAmountCents).toBe(1100);
      expect(result.ownerTransferAmountCents).toBe(0);
    });
  });

  describe("calculateNoShowRefund", () => {
    it("renter_no_show: 50% rental price refund and owner transfer (50% minus platform fee)", () => {
      const result = calculateNoShowRefund(100, 120, "renter_no_show");
      const halfRentalCents = 5000;
      const platformFeeCents = Math.round(100 * PLATFORM_FEE_PERCENTAGE * 100);
      expect(result.refundAmountCents).toBe(halfRentalCents);
      expect(result.ownerTransferAmountCents).toBe(
        halfRentalCents - platformFeeCents,
      );
      expect(result.refundReason).toBe("renter_no_show");
    });

    it("owner_no_show: full charge refund, 0 owner transfer", () => {
      const result = calculateNoShowRefund(100, 120, "owner_no_show");
      expect(result.refundAmountCents).toBe(12000);
      expect(result.ownerTransferAmountCents).toBe(0);
      expect(result.refundReason).toBe("owner_no_show");
    });

    it("renter_no_show: owner transfer floors at 0 for small amounts", () => {
      const result = calculateNoShowRefund(0.03, 0.05, "renter_no_show");
      expect(result.refundAmountCents).toBeGreaterThanOrEqual(0);
      expect(result.ownerTransferAmountCents).toBeGreaterThanOrEqual(0);
      expect(result.refundReason).toBe("renter_no_show");
    });
  });
});
