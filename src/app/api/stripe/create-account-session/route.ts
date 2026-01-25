import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { createAccountSession } from "@/services/stripe/connect";

/**
 * Create an account session for embedded Stripe Connect components
 * Supports both onboarding (backward compatible) and payments page components
 * POST /api/stripe/create-account-session
 * Optional query parameter: ?mode=payments (defaults to onboarding for backward compatibility)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Get or create connected account
    const { data: accountId, error: accountError } = await tryCatch(
      userDAL.getOrCreateConnectedAccount(userId),
    );

    if (accountError || !accountId) {
      return NextResponse.json(
        {
          error: accountError?.message || "Failed to create connected account",
        },
        { status: 500 },
      );
    }

    // Check if payments mode is requested (for payments page)
    // Default to onboarding mode for backward compatibility
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    let clientSecret: string;

    if (mode === "payments") {
      // Create account session with all required components for payments page
      // This includes: balances, payouts, payouts_list, payments, documents, notification_banner
      const { data, error: sessionError } = await tryCatch(
        createAccountSession(accountId, {
          components: {
            balances: { enabled: true },
            payouts: { enabled: true },
            payouts_list: { enabled: true },
            payments: { enabled: true },
            documents: { enabled: true },
            notification_banner: { enabled: true },
          },
        }),
      );

      if (sessionError || !data) {
        return NextResponse.json(
          {
            error: sessionError?.message || "Failed to create account session",
          },
          { status: 500 },
        );
      }

      clientSecret = data;
    } else {
      // Default to onboarding mode (backward compatible)
      const { data, error: sessionError } = await tryCatch(
        createAccountSession(accountId),
      );

      if (sessionError || !data) {
        return NextResponse.json(
          {
            error: sessionError?.message || "Failed to create account session",
          },
          { status: 500 },
        );
      }

      clientSecret = data;
    }

    return NextResponse.json({ clientSecret });
  } catch (error) {
    return handleApiError(error);
  }
}
