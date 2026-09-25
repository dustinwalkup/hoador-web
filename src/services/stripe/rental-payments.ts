import Stripe from "stripe";
import { PAYMENT_SERVER_INSTANCE } from "./server";

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
 * Charge the rental payment (rental amount + delivery + setup + service fee).
 * Creates an immediate charge on the renter's payment method.
 * Platform-hold model: funds stay in the platform account — no transfer_data.
 * Owner payout is handled later via manual stripe.transfers.create().
 */
export async function chargeRentalPayment(
  customerId: string,
  paymentMethodId: string,
  amount: number, // in dollars (charge amount = rental price + service fee)
  metadata: RentalPaymentMetadata,
  idempotencyKey: string,
): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        ...metadata,
        paymentType: "rental_charge",
      },
    };

    const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.create(
      paymentIntentParams,
      { idempotencyKey },
    );

    return paymentIntent;
  } catch (error) {
    console.error("Error charging rental payment:", error);
    throw error;
  }
}

/**
 * Authorize (hold) the security deposit without charging.
 * Creates a hold on the renter's card that can be captured later if needed.
 */
export async function authorizeSecurityDeposit(
  customerId: string,
  paymentMethodId: string,
  amount: number, // in dollars
  metadata: SecurityDepositMetadata,
  idempotencyKey?: string,
): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        capture_method: "manual", // Authorize only, don't capture
        confirm: true,
        metadata: {
          ...metadata,
          paymentType: "security_deposit_hold",
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

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

// Lives in its own module so route-helpers can import it without loading
// ./server, which throws at load when STRIPE_SECRET_KEY is unset (ARCH-05).
export { getPaymentErrorMessage } from "./payment-error-message";

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
