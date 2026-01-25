import { NextRequest, NextResponse } from "next/server";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }

    const { amount } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 },
      );
    }

    const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.create({
      amount,
      currency: "usd",
      capture_method: "manual", // This prevents automatic capture
      metadata: {
        type: "rental_request",
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    return handleApiError(error);
  }
}
