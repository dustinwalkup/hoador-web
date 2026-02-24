import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { tryCatch } from "@walkup/walkup-utils";

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

    // Attach the payment method to the customer
    const { data, error } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.paymentMethods.attach(paymentMethodId, {
        customer: user.stripeCustomerId,
      }),
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
