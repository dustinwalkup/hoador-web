import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import type Stripe from "stripe";
import { getLogger } from "@/lib/logger";
import { handleWebhookEvent } from "@/services/stripe/webhook-handlers";

// Force dynamic rendering for webhook route
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "STRIPE_WEBHOOK_SECRET is not set. Webhook verification will fail.",
  );
}

/**
 * Handle Stripe Connect webhooks
 * POST /api/stripe/webhooks
 */
async function postHandler(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 },
      );
    }

    // Use dynamic import to avoid initialization issues during build
    const { PAYMENT_SERVER_INSTANCE } =
      await import("@/services/stripe/server");

    let event: Stripe.Event;

    try {
      event = PAYMENT_SERVER_INSTANCE.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      getLogger().error(
        { message: "webhook.signature_verification_failed" },
        "Stripe webhook signature verification failed",
      );
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 },
      );
    }

    await handleWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    getLogger().error(
      {
        message: "webhook.route_failed",
        error: error instanceof Error ? error.message : String(error),
      },
      "Stripe webhook processing failed",
    );
    Sentry.captureException(error, {
      tags: { route: "POST /api/stripe/webhooks" },
    });
    // Keep the 500 so Stripe retries the event.
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/webhooks",
);
