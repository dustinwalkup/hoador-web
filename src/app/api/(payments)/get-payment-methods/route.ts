import { NextResponse } from "next/server";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import { getCurrentUser } from "@/features/authentication/auth.utils";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user.stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const paymentMethods = await PAYMENT_SERVER_INSTANCE.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    return NextResponse.json({
      paymentMethods: paymentMethods.data
        .filter((pm) => pm.card)
        .map((pm) => ({
          id: pm.id,
          brand: pm.card!.brand,
          last4: pm.card!.last4,
          exp_month: pm.card!.exp_month,
          exp_year: pm.card!.exp_year,
        })),
    });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
