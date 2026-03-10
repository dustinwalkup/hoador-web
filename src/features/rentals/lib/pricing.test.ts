import { describe, it, expect } from "vitest";
import {
  calculateRentalPricing,
  getEffectiveDailyRate,
  type RentalPricingListingInput,
} from "./pricing";

const baseListing: RentalPricingListingInput = {
  dailyRate: "25",
  weeklyRate: "150",
  monthlyRate: "500",
  deliveryFee: "15",
  setupFee: "20",
  securityDeposit: "50",
};

describe("getEffectiveDailyRate", () => {
  it("returns daily rate for periods under 7 days", () => {
    expect(getEffectiveDailyRate(baseListing, 1)).toBe(25);
    expect(getEffectiveDailyRate(baseListing, 6)).toBe(25);
  });

  it("returns daily rate for all periods (weekly/monthly discounts disabled)", () => {
    expect(getEffectiveDailyRate(baseListing, 7)).toBe(25);
    expect(getEffectiveDailyRate(baseListing, 14)).toBe(25);
    expect(getEffectiveDailyRate(baseListing, 29)).toBe(25);
  });

  it("returns daily rate for 30+ days (monthly discount disabled)", () => {
    expect(getEffectiveDailyRate(baseListing, 30)).toBe(25);
    expect(getEffectiveDailyRate(baseListing, 45)).toBe(25);
  });

  it("falls back to daily rate when weeklyRate is null", () => {
    const noWeekly = { ...baseListing, weeklyRate: null };
    expect(getEffectiveDailyRate(noWeekly, 7)).toBe(25);
  });

  it("uses daily rate for 30+ days when monthlyRate is null (weekly/monthly disabled)", () => {
    const noMonthly = { ...baseListing, monthlyRate: null };
    expect(getEffectiveDailyRate(noMonthly, 30)).toBe(25);
  });
});

describe("calculateRentalPricing", () => {
  it("computes subtotal as dailyRate * totalDays rounded to 2 decimals", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 3,
      deliveryRequested: false,
      setupRequested: false,
    });
    expect(result.subtotal).toBe(75);
    expect(result.dailyRate).toBe(25);
  });

  it("uses daily rate for 7-day rental (weekly/monthly discounts disabled)", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 7,
      deliveryRequested: false,
      setupRequested: false,
    });
    const expectedDaily = 25;
    expect(result.dailyRate).toBe(expectedDaily);
    expect(result.subtotal).toBe(Math.round(expectedDaily * 7 * 100) / 100);
  });

  it("adds delivery fee when deliveryRequested is true", () => {
    const withDelivery = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: true,
      setupRequested: false,
    });
    const withoutDelivery = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: false,
      setupRequested: false,
    });
    expect(withDelivery.deliveryFee).toBe(15);
    expect(withoutDelivery.deliveryFee).toBe(0);
    expect(withDelivery.totalAmount).toBeGreaterThan(
      withoutDelivery.totalAmount,
    );
  });

  it("adds setup fee when setupRequested is true, using listing.setupFee by default", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: false,
      setupRequested: true,
    });
    expect(result.setupFee).toBe(20);
  });

  it("uses input.setupFee override when provided", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: false,
      setupRequested: true,
      setupFee: 25,
    });
    expect(result.setupFee).toBe(25);
  });

  it("computes service fee on subtotal + delivery + setup", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: true,
      setupRequested: true,
    });
    const rentalPriceBeforeServiceFee = 50 + 15 + 20;
    expect(result.subtotal).toBe(50);
    expect(result.deliveryFee).toBe(15);
    expect(result.setupFee).toBe(20);
    expect(result.serviceFee).toBeGreaterThan(0);
    expect(result.totalAmount).toBe(
      rentalPriceBeforeServiceFee + result.serviceFee,
    );
  });

  it("sets securityDeposit from listing", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 1,
      deliveryRequested: false,
      setupRequested: false,
    });
    expect(result.securityDeposit).toBe(50);
  });

  it("returns applicationFeeAmount, ownerPayout, and platformNetRevenue", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: false,
      setupRequested: false,
    });
    expect(result.applicationFeeAmount).toBeGreaterThan(0);
    expect(result.ownerPayout).toBeGreaterThan(0);
    expect(result.platformNetRevenue).toBeGreaterThanOrEqual(0);
    expect(typeof result.applicationFeeAmount).toBe("number");
    expect(typeof result.ownerPayout).toBe("number");
    expect(typeof result.platformNetRevenue).toBe("number");
  });

  it("all amounts have at most 2 decimal places", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 3,
      deliveryRequested: true,
      setupRequested: true,
    });
    const values = [
      result.subtotal,
      result.deliveryFee,
      result.setupFee,
      result.serviceFee,
      result.totalAmount,
      result.applicationFeeAmount,
      result.ownerPayout,
      result.platformNetRevenue,
    ];
    for (const v of values) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });

  it("handles listing with null setupFee", () => {
    const listingNoSetup: RentalPricingListingInput = {
      ...baseListing,
      setupFee: null,
    };
    const result = calculateRentalPricing({
      listing: listingNoSetup,
      totalDays: 2,
      deliveryRequested: false,
      setupRequested: true,
    });
    expect(result.setupFee).toBe(0);
  });

  it("handles setupRequested true with explicit setupFee 0", () => {
    const result = calculateRentalPricing({
      listing: baseListing,
      totalDays: 2,
      deliveryRequested: false,
      setupRequested: true,
      setupFee: 0,
    });
    expect(result.setupFee).toBe(0);
  });
});
