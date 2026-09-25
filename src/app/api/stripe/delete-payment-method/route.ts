import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { detachPaymentMethod } from "@/services/stripe/payment-method";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";

/**
 * DELETE /api/stripe/delete-payment-method
 * Detach one of the caller's own cards.
 *
 * The id must belong to the caller's Stripe customer (SEC-07). Detaching uses
 * the platform key, so without the check any `pm_` id would do, and a
 * detached card can never be reused. Someone else's card, an unknown id, and
 * a caller with no customer all get the same 404, so the route can't be used
 * to probe which ids exist.
 */
async function deleteHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("id");

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 },
      );
    }

    const { data: pm } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.paymentMethods.retrieve(paymentMethodId),
    );
    const ownerCustomerId =
      typeof pm?.customer === "string"
        ? pm.customer
        : (pm?.customer?.id ?? null);
    if (!user.stripeCustomerId || ownerCustomerId !== user.stripeCustomerId) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 },
      );
    }

    const { error } = await tryCatch(detachPaymentMethod(paymentMethodId));

    if (error) {
      // Generic: Stripe's message isn't for clients (SEC-16).
      return NextResponse.json(
        { error: "Failed to delete payment method" },
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
