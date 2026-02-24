import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { createLoginLink } from "@/services/stripe/connect";

/**
 * Create a login link for Express Dashboard access
 * POST /api/stripe/create-login-link
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
        {
          error:
            "No connected account found. Please complete onboarding first.",
        },
        { status: 404 },
      );
    }

    // Create login link
    const { data: loginUrl, error: linkError } = await tryCatch(
      createLoginLink(accountId),
    );

    if (linkError || !loginUrl) {
      return NextResponse.json(
        { error: linkError?.message || "Failed to create login link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: loginUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/create-login-link",
);
