import {
  PLATFORM_FEE_PERCENTAGE,
  calculateServiceFee,
  calculateStripeFee,
} from "@/constants/payments";

/**
 * Minimal listing fields required for rental pricing calculation.
 * Values match DB schema (strings for decimal amounts).
 */
export interface RentalPricingListingInput {
  dailyRate: string;
  weeklyRate: string | null;
  monthlyRate: string | null;
  deliveryFee: string;
  setupFee: string | null;
  securityDeposit: string;
}

/**
 * Input for calculating rental request pricing.
 */
export interface RentalPricingInput {
  listing: RentalPricingListingInput;
  totalDays: number;
  deliveryRequested: boolean;
  setupRequested: boolean;
  /** Optional override; when not provided, listing.setupFee is used when setupRequested is true */
  setupFee?: number | null;
}

/**
 * Result of rental pricing calculation. All monetary values in dollars.
 */
export interface RentalPricing {
  dailyRate: number;
  subtotal: number;
  deliveryFee: number;
  setupFee: number;
  serviceFee: number;
  securityDeposit: number;
  totalAmount: number;
  applicationFeeAmount: number;
  ownerPayout: number;
  platformNetRevenue: number;
}

/**
 * Calculate the effective daily rate based on rental period (weekly/monthly discounts).
 *
 * @param listing - Listing with daily, weekly, monthly rates
 * @param totalDays - Number of rental days
 * @returns Effective daily rate in dollars
 */
export function getEffectiveDailyRate(
  listing: RentalPricingListingInput,
  totalDays: number, // kept for API consistency when re-enabling weekly/monthly
): number {
  const dailyRate = Number(listing.dailyRate);
  // Weekly/monthly discounts temporarily disabled (daily rate only)
  void totalDays;
  // if (totalDays >= 30 && listing.monthlyRate) {
  //   dailyRate = Number(listing.monthlyRate) / 30;
  // } else if (totalDays >= 7 && listing.weeklyRate) {
  //   dailyRate = Number(listing.weeklyRate) / 7;
  // }
  return dailyRate;
}

/**
 * Calculate full rental pricing: subtotal, fees, platform split, and net revenue.
 * Pure function with no side effects; uses constants from @/constants/payments.
 *
 * @param input - Listing fields and request options (days, delivery, setup)
 * @returns All computed pricing amounts for persisting a rental request
 */
export function calculateRentalPricing(
  input: RentalPricingInput,
): RentalPricing {
  const { listing, totalDays, deliveryRequested, setupRequested } = input;

  const dailyRate = getEffectiveDailyRate(listing, totalDays);
  const subtotal = Math.round(dailyRate * totalDays * 100) / 100;
  const deliveryFee = deliveryRequested ? Number(listing.deliveryFee) : 0;
  const setupFeeAmount = setupRequested
    ? Number(input.setupFee ?? listing.setupFee ?? 0)
    : 0;
  const rentalPriceBeforeServiceFee = subtotal + deliveryFee + setupFeeAmount;
  const serviceFee = calculateServiceFee(rentalPriceBeforeServiceFee);
  const securityDeposit = Number(listing.securityDeposit);
  const totalAmount = subtotal + deliveryFee + setupFeeAmount + serviceFee;

  const platformFeeAmount =
    Math.round(rentalPriceBeforeServiceFee * PLATFORM_FEE_PERCENTAGE * 100) /
    100;
  const appFeeAmount = Math.round((platformFeeAmount + serviceFee) * 100) / 100;
  const ownerPayoutAmount =
    Math.round((rentalPriceBeforeServiceFee - platformFeeAmount) * 100) / 100;
  const actualStripeFee = calculateStripeFee(totalAmount);
  const netRevenue = Math.round((appFeeAmount - actualStripeFee) * 100) / 100;

  return {
    dailyRate,
    subtotal,
    deliveryFee,
    setupFee: setupFeeAmount,
    serviceFee,
    securityDeposit,
    totalAmount,
    applicationFeeAmount: appFeeAmount,
    ownerPayout: ownerPayoutAmount,
    platformNetRevenue: netRevenue,
  };
}
