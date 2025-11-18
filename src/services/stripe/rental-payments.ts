import Stripe from "stripe";
import { PAYMENT_SERVER_INSTANCE } from "./server";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";

/**
 * Rental payment service for processing rental charges and security deposits
 */

interface RentalPaymentMetadata {
  rentalRequestId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  listingName?: string;
}

interface SecurityDepositMetadata {
  type: "security_deposit";
  rentalRequestId: string;
  listingId: string;
  renterId: string;
}

/**
 * Charge the rental payment (rental amount + delivery + setup fees)
 * This creates an immediate charge on the renter's payment method
 * With destination charges, funds transfer immediately to the owner's connected account
 */
export async function chargeRentalPayment(
  customerId: string,
  paymentMethodId: string,
  amount: number, // in dollars
  metadata: RentalPaymentMetadata,
  ownerConnectedAccountId?: string, // Optional: if provided, creates destination charge
): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true, // Renter doesn't need to be online
      confirm: true, // Charge immediately
      metadata: {
        ...metadata,
        paymentType: "rental_charge",
      },
    };

    // Add destination charge parameters if owner connected account is provided
    if (ownerConnectedAccountId) {
      paymentIntentParams.transfer_data = {
        destination: ownerConnectedAccountId,
      };
      paymentIntentParams.application_fee_amount = Math.round(
        amount * PLATFORM_FEE_PERCENTAGE * 100,
      );
    }

    const paymentIntent =
      await PAYMENT_SERVER_INSTANCE.paymentIntents.create(paymentIntentParams);

    return paymentIntent;
  } catch (error) {
    console.error("Error charging rental payment:", error);
    throw error;
  }
}

/**
 * Authorize (hold) the security deposit without charging
 * This creates a hold on the renter's card that can be captured later if needed
 */
export async function authorizeSecurityDeposit(
  customerId: string,
  paymentMethodId: string,
  amount: number, // in dollars
  metadata: SecurityDepositMetadata,
): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      capture_method: "manual", // Authorize only, don't capture
      confirm: true,
      metadata: {
        ...metadata,
        paymentType: "security_deposit_authorization",
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Error authorizing security deposit:", error);
    throw error;
  }
}

/**
 * Capture a previously authorized security deposit
 * Used when damage is reported
 */
export async function captureSecurityDeposit(
  authorizationId: string,
  amount?: number, // in dollars, optional - if not provided, captures full amount
): Promise<Stripe.PaymentIntent> {
  try {
    const captureParams: Stripe.PaymentIntentCaptureParams = {};

    if (amount !== undefined) {
      captureParams.amount_to_capture = Math.round(amount * 100);
    }

    const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.capture(
      authorizationId,
      captureParams,
    );

    return paymentIntent;
  } catch (error) {
    console.error("Error capturing security deposit:", error);
    throw error;
  }
}

/**
 * Release (cancel) a previously authorized security deposit
 * Used when rental completes successfully with no damage
 */
export async function releaseSecurityDeposit(
  authorizationId: string,
): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent =
      await PAYMENT_SERVER_INSTANCE.paymentIntents.cancel(authorizationId);

    return paymentIntent;
  } catch (error) {
    console.error("Error releasing security deposit:", error);
    throw error;
  }
}

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
 * Check if a payment error is retryable
 */
export function isRetryablePaymentError(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return true;
  }

  if (error instanceof Stripe.errors.StripeAPIError) {
    return true;
  }

  if (error instanceof Stripe.errors.StripeConnectionError) {
    return true;
  }

  // Card errors are generally not automatically retryable
  // User needs to update their payment method
  return false;
}
