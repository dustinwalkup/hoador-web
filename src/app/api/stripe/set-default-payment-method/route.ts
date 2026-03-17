import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { setDefaultPaymentMethod } from "@/services/stripe/payment-method";

/**
 * POST /api/stripe/set-default-payment-method
 * Set a payment method as the default for the customer
 */
async function postHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { user } = authResult;

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No customer account found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 },
      );
    }

    const { error } = await tryCatch(
      setDefaultPaymentMethod(user.stripeCustomerId, paymentMethodId, user.id),
    );

    if (error) {
      console.error("Error setting default payment method:", error);
      return NextResponse.json(
        { error: error.message || "Failed to set default payment method" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/set-default-payment-method",
);
