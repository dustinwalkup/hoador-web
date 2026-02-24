import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { getAccountStatus } from "@/services/stripe/connect";
import { userDAL } from "@/dal";

/**
 * Update onboarding status after completion
 * POST /api/stripe/update-onboarding-status
 */
async function postHandler() {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

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
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/update-onboarding-status",
);
