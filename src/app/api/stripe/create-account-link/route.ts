import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { createAccountLink } from "@/services/stripe/connect";
import {
  MOBILE_CONNECT_RETURN_PATH,
  MOBILE_CONNECT_REFRESH_PATH,
} from "@/constants/mobile";

/**
 * Create a hosted Stripe Connect onboarding Account Link for the mobile app.
 * POST /api/stripe/create-account-link
 *
 * The app opens the returned URL in an in-app browser sheet; on completion
 * Stripe redirects to the web bounce pages, which forward into the app, and the
 * app then calls the existing `update-onboarding-status` to re-sync readiness.
 *
 * **The return/refresh URLs are constructed here, never taken from the request
 * body.** Accepting a client-supplied return URL would add an open-redirect
 * parameter whose only legitimate values are the two we build anyway — the
 * client has no environment information the server lacks. Constructing them
 * server-side removes the attack surface rather than guarding it.
 *
 * Requirements: 2.3.2, 2.3.3
 * Design: 2-design.md §4.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4 (D-E2-6)
 */
async function postHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    const { data: accountId, error: accountError } = await tryCatch(
      userDAL.getOrCreateConnectedAccount(userId),
    );

    if (accountError || !accountId) {
      return NextResponse.json(
        {
          error: accountError?.message || "Failed to resolve connected account",
        },
        { status: 500 },
      );
    }

    const { data: url, error: linkError } = await tryCatch(
      createAccountLink(accountId, {
        return_url: `${baseUrl}${MOBILE_CONNECT_RETURN_PATH}`,
        refresh_url: `${baseUrl}${MOBILE_CONNECT_REFRESH_PATH}`,
      }),
    );

    if (linkError || !url) {
      return NextResponse.json(
        { error: linkError?.message || "Failed to create account link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/create-account-link",
);
