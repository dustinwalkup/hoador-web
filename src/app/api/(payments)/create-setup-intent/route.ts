import { NextResponse } from "next/server";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import { getCurrentUser } from "@/lib/auth/auth.utils";
import { userDAL } from "@/dal";

export async function POST() {
  try {
    // Get the current user
    const user = await getCurrentUser();

    let stripeCustomerId = user.stripeCustomerId || null;

    // If the user doesn't have a stripe customer id, create one
    if (!stripeCustomerId) {
      const stripeCustomer = await PAYMENT_SERVER_INSTANCE.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
      console.log("stripeCustomer", stripeCustomer);
      stripeCustomerId = stripeCustomer.id;
      await userDAL.updateUser(user.id, {
        stripeCustomerId: stripeCustomer.id,
      });
    }

    // Create a setup intent
    const paymentIntent = await PAYMENT_SERVER_INSTANCE.setupIntents.create({
      usage: "off_session",
      customer: stripeCustomerId,
    });

    // Return the client secret
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Internal error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
