import Stripe from "stripe";

// Imports nothing but the SDK's error classes: this module is on
// route-helpers.ts's import graph, which every route and route test loads.
// Never import ./server (or anything that does) here.

/**
 * Get user-friendly error message from Stripe error
 */
export function getPaymentErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeCardError) {
    // Card was declined
    switch (error.code) {
      case "insufficient_funds":
        return "Insufficient funds on the payment method.";
      case "card_declined":
        return "The payment method was declined.";
      case "expired_card":
        return "The payment method has expired.";
      case "incorrect_cvc":
        return "The security code is incorrect.";
      case "processing_error":
        return "An error occurred while processing the payment.";
      default:
        return error.message || "The payment method was declined.";
    }
  }

  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return "Too many requests. Please try again later.";
  }

  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return "Invalid payment request. Please contact support.";
  }

  if (error instanceof Stripe.errors.StripeAPIError) {
    return "Payment service error. Please try again.";
  }

  if (error instanceof Stripe.errors.StripeConnectionError) {
    return "Network error. Please check your connection and try again.";
  }

  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return "Payment authentication failed. Please contact support.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * For HTTP responses: getPaymentErrorMessage, minus its raw-message
 * fallback. A Stripe subclass it doesn't map (permission, idempotency,
 * signature, OAuth) gets a fixed string instead of the SDK's own text.
 */
export function stripeErrorResponseMessage(
  error: InstanceType<typeof Stripe.errors.StripeError>,
): string {
  const message = getPaymentErrorMessage(error);
  if (
    message === error.message &&
    !(error instanceof Stripe.errors.StripeCardError)
  ) {
    return "Payment service error. Please try again.";
  }
  return message;
}
