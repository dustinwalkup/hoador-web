import { NextResponse } from "next/server";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

export async function GET() {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { user } = authResult;

    if (!user.stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [] });
    }

    // Query for all payment methods (not just cards) to see what's available
    const allPaymentMethods = await PAYMENT_SERVER_INSTANCE.paymentMethods.list(
      {
        customer: user.stripeCustomerId,
      },
    );

    // Filter for card payment methods only (link payment methods aren't reusable like cards)
    const cardPaymentMethods = allPaymentMethods.data.filter(
      (pm) => pm.type === "card",
    );

    const formattedMethods = cardPaymentMethods
      .filter((pm) => pm.card)
      .map((pm) => ({
        id: pm.id,
        brand: pm.card!.brand,
        last4: pm.card!.last4,
        exp_month: pm.card!.exp_month,
        exp_year: pm.card!.exp_year,
      }));

    return NextResponse.json({
      paymentMethods: formattedMethods,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
