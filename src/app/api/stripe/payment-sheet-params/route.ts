import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import {
  PAYMENT_SERVER_INSTANCE,
  STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION,
} from "@/services/stripe/server";

/**
 * Everything the Stripe React Native PaymentSheet needs to save a card.
 * POST /api/stripe/payment-sheet-params
 *
 * Mobile counterpart to the web's `/api/create-setup-intent`, which stays
 * untouched. The difference that forces a separate endpoint is the **ephemeral
 * key**: the web's PaymentElement authenticates with the publishable key alone,
 * while the native PaymentSheet needs a short-lived key to read and manage the
 * Customer's saved payment methods directly from the device.
 *
 * Setup mode, not payment mode — this saves a card for later. Rentals and
 * bookings are charged server-side, off-session, at approve/accept; the app
 * never confirms a booking charge itself (Req 2.3.5).
 *
 * Requirements: 2.3.1
 * Design: 2-design.md §4.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.3
 */
async function postHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Reuses `user.stripeCustomerId` when present, so repeat calls (a retried
    // add-card, a backgrounded app) cannot strand duplicate Stripe customers.
    // Deliberately the DAL helper and not an inline `customers.create`: the web
    // setup-intent route already has its own inline copy, and a third would be
    // a third place for the customer to drift.
    const { data: customerId, error: customerError } = await tryCatch(
      userDAL.getOrCreateStripeCustomerId(userId),
    );

    if (customerError || !customerId) {
      return NextResponse.json(
        {
          error: customerError?.message || "Failed to resolve Stripe customer",
        },
        { status: 500 },
      );
    }

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      // Returned to the app rather than read from its own bundle so the key can
      // never disagree with the secret key that minted these params — a mismatch
      // surfaces as an opaque PaymentSheet failure on the device.
      return NextResponse.json(
        { error: "Stripe publishable key is not configured" },
        { status: 500 },
      );
    }

    const { data: ephemeralKey, error: ephemeralKeyError } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION },
      ),
    );

    if (ephemeralKeyError || !ephemeralKey?.secret) {
      return NextResponse.json(
        {
          error: ephemeralKeyError?.message || "Failed to create ephemeral key",
        },
        { status: 500 },
      );
    }

    const { data: setupIntent, error: setupIntentError } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.setupIntents.create({
        customer: customerId,
        // The card is saved now and charged later with the customer absent, so
        // the mandate has to be established as off-session up front.
        usage: "off_session",
        // No `payment_method_types`: PaymentSheet negotiates the available
        // methods itself, matching the web PaymentElement's behavior.
      }),
    );

    if (setupIntentError || !setupIntent?.client_secret) {
      return NextResponse.json(
        {
          error: setupIntentError?.message || "Failed to create setup intent",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      setupIntentClientSecret: setupIntent.client_secret,
      ephemeralKeySecret: ephemeralKey.secret,
      customerId,
      publishableKey,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/payment-sheet-params",
);
