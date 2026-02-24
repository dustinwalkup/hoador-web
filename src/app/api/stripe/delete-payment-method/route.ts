import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { tryCatch } from "@walkup/walkup-utils";

/**
 * DELETE /api/stripe/delete-payment-method
 * Detach a payment method from the customer
 */
async function deleteHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }

    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("id");

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 },
      );
    }

    const { data, error } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.paymentMethods.detach(paymentMethodId),
    );

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to delete payment method" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/stripe/delete-payment-method",
);
