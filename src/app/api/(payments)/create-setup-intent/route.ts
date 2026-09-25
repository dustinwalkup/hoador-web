import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { RATE_LIMITS } from "@/constants/rate-limits";

async function postHandler() {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { user } = authResult;

    // SEC-21: shares one bucket with payment-sheet-params, so alternating web
    // and mobile can't double the effective limit.
    await enforceRateLimit(
      `setup-intent:user:${user.id}`,
      RATE_LIMITS.SETUP_INTENT_PER_USER.limit,
      RATE_LIMITS.SETUP_INTENT_PER_USER.windowSeconds,
    );

    let stripeCustomerId = user.stripeCustomerId || null;

    // If the user doesn't have a stripe customer id, create one
    if (!stripeCustomerId) {
      const stripeCustomer = await PAYMENT_SERVER_INSTANCE.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
      stripeCustomerId = stripeCustomer.id;
      await userDAL.updateUser(user.id, {
        stripeCustomerId: stripeCustomer.id,
      });
    }

    // Create a setup intent
    // Note: Don't specify payment_method_types when using PaymentElement
    // PaymentElement will handle payment method type selection
    const setupIntent = await PAYMENT_SERVER_INSTANCE.setupIntents.create({
      usage: "off_session",
      customer: stripeCustomerId,
      // Don't specify payment_method_types - let PaymentElement handle it
    });

    // Return the client secret
    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/(payments)/create-setup-intent",
);
