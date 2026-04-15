/**
 * Platform fee to charge the renter.
 */
export const PLATFORM_FEE_PERCENTAGE = 0.2;

/**
 * Stripe's processing rate (2.9% + $0.30). Used for both the renter-facing service fee
 * and for platform net revenue calculation.
 */
export const STRIPE_FEE_PERCENTAGE = 0.029;
export const STRIPE_FEE_FIXED = 0.3;

/**
 * Calculate Stripe's fee (2.9% + $0.30) on the given amount.
 * Used for: actual Stripe cost on charge amount (platform net revenue calculation).
 */
export function calculateStripeFee(amount: number): number {
  return (
    Math.round((amount * STRIPE_FEE_PERCENTAGE + STRIPE_FEE_FIXED) * 100) / 100
  );
}

/**
 * Breakeven service fee to charge the renter.
 * Solves for the fee that fully covers Stripe's cost on the total charge.
 * Formula: (rentalPrice × rate + fixed) / (1 − rate)
 */
export function calculateServiceFee(rentalPrice: number): number {
  return (
    Math.round(
      ((rentalPrice * STRIPE_FEE_PERCENTAGE + STRIPE_FEE_FIXED) /
        (1 - STRIPE_FEE_PERCENTAGE)) *
        100,
    ) / 100
  );
}

export const PAYMENTS_TABS = {
  title: "Payments",
  description: "Manage your payment methods and earnings",
  tabValues: [
    { value: "payments", label: "Payment methods" },
    { value: "earnings-and-payouts", label: "Earnings & payouts" },
  ],
} as const;

export const PAYMENTS_PAGE_HEADERS = {
  payments: {
    title: "Payments",
    description: "Manage your payment methods and view payment history",
  },
  "earnings-and-payouts": {
    title: "Earnings & payouts",
    description: "Manage your earnings, payouts, and Stripe Connect account",
  },
} as const;
