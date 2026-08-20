import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { createAccountSession } from "@/services/stripe/connect";

/**
 * Create an account session for embedded Stripe Connect components
 * POST /api/stripe/create-account-session
 *
 * Optional query parameter `mode`:
 *   - (omitted)  onboarding only — the original web behaviour, unchanged
 *   - `payments` the web payments page's component set
 *   - `mobile`   onboarding + payouts + payments in ONE session (P-E7-6)
 *
 * Why `mobile` exists: the React Native app runs a **single**
 * `loadConnectAndInitialize` instance for the whole authenticated shell, and its
 * `fetchClientSecret` must return a session covering every component the app may
 * mount — `ConnectAccountOnboarding` (7.2.2) and `ConnectPayouts` (7.4.3). The
 * two existing modes are mutually exclusive: `payments` explicitly disables
 * onboarding, and the default enables only onboarding, so neither can serve the
 * app. Additive — both web callers keep their exact component sets.
 *
 * Requirements: 2.3.2, 13.2.1, 13.3.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-payments-payouts.md § P-E7-6 (D-E7-11)
 */
async function postHandler(request: NextRequest) {
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

    if (mode === "mobile") {
      // `account_onboarding` is listed explicitly: createAccountSession()
      // defaults it to `{enabled: false}` whenever any components are passed,
      // and only a caller-supplied value overrides that (it spreads last).
      const { data, error: sessionError } = await tryCatch(
        createAccountSession(accountId, {
          components: {
            account_onboarding: {
              enabled: true,
              features: { external_account_collection: true },
            },
            payouts: { enabled: true },
            payments: { enabled: true },
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
    } else if (mode === "payments") {
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
export const POST = withRequestLogging(
  postHandler,
  "POST /api/stripe/create-account-session",
);
