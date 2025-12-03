import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { createAccountSession } from "@/services/stripe/connect";

/**
 * Create an account session for embedded onboarding
 * POST /api/stripe/create-account-session
 */
export async function POST() {
  try {
    // Verify user authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Create account session
    const { data: clientSecret, error: sessionError } = await tryCatch(
      createAccountSession(accountId),
    );

    if (sessionError || !clientSecret) {
      return NextResponse.json(
        { error: sessionError?.message || "Failed to create account session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ clientSecret });
  } catch (error) {
    console.error("Error creating account session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
