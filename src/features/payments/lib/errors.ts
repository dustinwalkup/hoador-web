import type { OnboardingStatus } from "./payout-readiness";

export type PaymentSetupRequiredDetails = {
  onboardingStatus: OnboardingStatus | "unknown";
  missingCapabilities?: ("charges" | "payouts")[];
  reason?: "stripe_unreachable";
};

/**
 * Thrown when an owner/provider attempts to accept a booking but their Stripe
 * Connect account is not ready to receive payouts. API routes translate this
 * to HTTP 403 with body { error: "PAYMENT_SETUP_REQUIRED", onboardingStatus, missingCapabilities }.
 */
export class PaymentSetupRequiredError extends Error {
  public readonly code = "PAYMENT_SETUP_REQUIRED";
  public readonly statusCode = 403;

  constructor(public readonly details: PaymentSetupRequiredDetails) {
    super("Payment setup required");
    this.name = "PaymentSetupRequiredError";
  }
}
