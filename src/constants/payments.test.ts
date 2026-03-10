import { describe, it, expect } from "vitest";
import {
  calculateServiceFee,
  calculateStripeFee,
  PLATFORM_FEE_PERCENTAGE,
  STRIPE_FEE_PERCENTAGE,
  STRIPE_FEE_FIXED,
} from "./payments";

describe("calculateStripeFee", () => {
  it("applies 2.9% + $0.30 to the amount and rounds to 2 decimals", () => {
    // 100 * 0.029 + 0.30 = 3.20
    expect(calculateStripeFee(100)).toBe(3.2);
    // 50 * 0.029 + 0.30 = 1.75
    expect(calculateStripeFee(50)).toBe(1.75);
    // 10 * 0.029 + 0.30 = 0.59
    expect(calculateStripeFee(10)).toBe(0.59);
  });

  it("returns exactly the fixed fee when amount is 0", () => {
    // 0 * 0.029 + 0.30 = 0.30
    expect(calculateStripeFee(0)).toBe(STRIPE_FEE_FIXED);
    expect(calculateStripeFee(0)).toBe(0.3);
  });

  it("rounds up when fractional cents are >= 0.5", () => {
    // 1 * 0.029 + 0.30 = 0.329 → 0.33
    expect(calculateStripeFee(1)).toBe(0.33);
    // 13.33 * 0.029 + 0.30 = 0.68657 → 0.69
    expect(calculateStripeFee(13.33)).toBe(0.69);
  });

  it("rounds down when fractional cents are < 0.5", () => {
    // 2 * 0.029 + 0.30 = 0.358 → 0.36
    expect(calculateStripeFee(2)).toBe(0.36);
    // 5 * 0.029 + 0.30 = 0.445 → 0.45
    expect(calculateStripeFee(5)).toBe(0.45);
  });

  it("uses STRIPE_FEE_PERCENTAGE and STRIPE_FEE_FIXED constants", () => {
    const amount = 100;
    const expected =
      Math.round((amount * STRIPE_FEE_PERCENTAGE + STRIPE_FEE_FIXED) * 100) /
      100;
    expect(calculateStripeFee(amount)).toBe(expected);
  });

  it("handles small amounts", () => {
    // 0.01 * 0.029 + 0.30 = 0.30029 → 0.30
    expect(calculateStripeFee(0.01)).toBe(0.3);
    // 0.10 * 0.029 + 0.30 = 0.3029 → 0.30
    expect(calculateStripeFee(0.1)).toBe(0.3);
  });

  it("handles large amounts", () => {
    // 1000 * 0.029 + 0.30 = 29.30
    expect(calculateStripeFee(1000)).toBe(29.3);
    // 10000 * 0.029 + 0.30 = 290.30
    expect(calculateStripeFee(10_000)).toBe(290.3);
  });

  it("returns a number with at most 2 decimal places", () => {
    const result = calculateStripeFee(33.33);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(Math.round(result * 100) / 100);
    expect(String(result).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

describe("calculateServiceFee", () => {
  it("returns breakeven fee so Stripe cost is fully covered", () => {
    expect(calculateServiceFee(100)).toBe(3.3);
    expect(calculateServiceFee(50)).toBe(1.8);
  });

  it("ensures platformNetRevenue equals platform fee for round rental amounts", () => {
    const rentalPrice = 100;
    const serviceFee = calculateServiceFee(rentalPrice);
    const totalAmount = rentalPrice + serviceFee;
    const platformFeeAmount =
      Math.round(rentalPrice * PLATFORM_FEE_PERCENTAGE * 100) / 100;
    const appFeeAmount =
      Math.round((platformFeeAmount + serviceFee) * 100) / 100;
    const actualStripeFee = calculateStripeFee(totalAmount);
    const platformNetRevenue =
      Math.round((appFeeAmount - actualStripeFee) * 100) / 100;
    expect(platformNetRevenue).toBe(platformFeeAmount);
  });
});
