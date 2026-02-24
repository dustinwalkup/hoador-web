import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { tryCatch } from "@walkup/walkup-utils";

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

    const { data, error } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      }),
    );

    if (error || !data) {
      console.error("Error setting default payment method:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to set default payment method" },
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
