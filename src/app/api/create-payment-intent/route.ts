import { NextRequest, NextResponse } from "next/server";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json();

    const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.create({
      amount: amount,
      currency: "usd",
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Internal error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
