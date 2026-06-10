import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";

const bodySchema = z.object({
  amount: z.number().int().positive().max(1_000_000), // cents; $10,000 cap
});

async function postHandler(request: NextRequest) {
  try {
    // Admin-only: the sole caller is the admin "how-it-works" demo page.
    // Real rental charges go through chargeRentalPayment server-side.
    const authError = await requireAdminResponse();
    if (authError) return authError;

    const parseResult = bodySchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const { amount } = parseResult.data;

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
export const POST = withRequestLogging(
  postHandler,
  "POST /api/(payments)/create-payment-intent",
);
