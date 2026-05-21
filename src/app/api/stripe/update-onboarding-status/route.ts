import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { getAccountStatus } from "@/services/stripe/connect";
import { userDAL } from "@/dal";
import { logGatingEvent } from "@/features/payments/lib/log-events";
import { getPayoutReadiness } from "@/features/payments/lib/payout-readiness";

/**
 * Update onboarding status after completion
 * POST /api/stripe/update-onboarding-status
 *
 * Optional body: { fromJitAccept?: boolean } — when true, emits a
 * `connect_onboarding_completed_from_accept` log event so we can measure JIT
 * funnel conversion.
 */
async function postHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const body = await request.json().catch(() => ({}));
    const fromJitAccept = body?.fromJitAccept === true;

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

    if (fromJitAccept) {
      const readiness = getPayoutReadiness({
        stripeConnectedAccountId: accountId,
        connectChargesEnabled: status.chargesEnabled,
        connectPayoutsEnabled: status.payoutsEnabled,
        connectOnboardingComplete:
          status.chargesEnabled && status.payoutsEnabled,
      });
      logGatingEvent("connect_onboarding_completed_from_accept", {
        userId,
        onboardingStatus: readiness.onboardingStatus,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/update-onboarding-status",
);
