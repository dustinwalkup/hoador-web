import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { attachPaymentMethod } from "@/services/stripe/payment-method";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * POST /api/stripe/attach-payment-method
 * Explicitly attach a payment method to the customer
 * This ensures the payment method is available for future use
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

    const { data, error } = await tryCatch(
      attachPaymentMethod(user.stripeCustomerId, paymentMethodId, user.id),
    );

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to attach payment method" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, paymentMethod: data });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/attach-payment-method",
);
