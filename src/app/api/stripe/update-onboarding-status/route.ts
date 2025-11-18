import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { getAccountStatus } from "@/services/stripe/connect";
import { userDAL } from "@/dal";

/**
 * Update onboarding status after completion
 * POST /api/stripe/update-onboarding-status
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get connected account ID
    const { data: accountId, error: accountError } = await tryCatch(
      userDAL.getConnectedAccountId(userId),
    );

    if (accountError || !accountId) {
      return NextResponse.json(
        { error: "No connected account found" },
        { status: 404 },
      );
    }

    // Get account status from Stripe
    const { data: status, error: statusError } = await tryCatch(
      getAccountStatus(accountId),
    );

    if (statusError || !status) {
      return NextResponse.json(
        { error: "Failed to get account status" },
        { status: 500 },
      );
    }

    // Update user status in database
    await userDAL.updateConnectOnboardingStatus(userId, status);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating onboarding status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
