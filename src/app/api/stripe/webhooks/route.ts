import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { UserDAL } from "@/dal/user.dal";
import { tryCatch } from "@walkup/walkup-utils";

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
export async function POST(request: NextRequest) {
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
    const { PAYMENT_SERVER_INSTANCE } = await import(
      "@/services/stripe/server"
    );

    let event: Stripe.Event;

    try {
      event = PAYMENT_SERVER_INSTANCE.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 },
      );
    }

    const userDAL = new UserDAL();

    // Handle different event types
    // Note: Stripe v2 API events use the same event type names
    // The "v2.core." prefix is just how they're displayed in the dashboard
    const eventType = event.type as string;

    if (eventType === "account.updated") {
      const account = event.data.object as Stripe.Account;

      // Find user by connected account ID
      const { data: user, error: userError } = await tryCatch(
        userDAL.getUserByConnectedAccountId(account.id),
      );

      if (!userError && user) {
        // Update onboarding status based on account capabilities
        // This handles both onboarding completion and account status changes
        await userDAL.updateConnectOnboardingStatus(user.id, {
          chargesEnabled: account.charges_enabled || false,
          payoutsEnabled: account.payouts_enabled || false,
        });
      }
    } else if (eventType === "account.closed") {
      // Handle account closure - account.closed may not be in TypeScript types yet
      const account = (event as unknown as { data: { object: Stripe.Account } })
        .data.object;

      // Find user by connected account ID
      const { data: user, error: userError } = await tryCatch(
        userDAL.getUserByConnectedAccountId(account.id),
      );

      if (!userError && user) {
        // When account is closed, disable all payment capabilities
        // This prevents new rentals from being approved for this user
        await userDAL.updateConnectOnboardingStatus(user.id, {
          chargesEnabled: false,
          payoutsEnabled: false,
        });

        // Note: Existing active rentals should be handled separately
        // The rental approval flow already checks isConnectOnboardingComplete()
        // which will prevent new rentals for closed accounts
      }
    } else {
      console.log(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
