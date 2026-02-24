import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { createCustomerPortalSession } from "@/services/stripe/connect";

/**
 * Create a customer portal session for managing payment methods and billing
 * POST /api/stripe/create-customer-portal-session
 */
async function postHandler() {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Get user data to retrieve Stripe customer ID
    const { data: user, error: userError } = await tryCatch(
      userDAL.getUserById(userId),
    );

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has a Stripe customer ID
    if (!user.stripeCustomerId) {
      return NextResponse.json(
        {
          error: "No customer account found. Make a payment first.",
        },
        { status: 404 },
      );
    }

    // Create customer portal session
    const { data: portalUrl, error: portalError } = await tryCatch(
      createCustomerPortalSession(user.stripeCustomerId, {
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/payments`,
      }),
    );

    if (portalError || !portalUrl) {
      return NextResponse.json(
        {
          error:
            portalError?.message || "Failed to create customer portal session",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/create-customer-portal-session",
);
