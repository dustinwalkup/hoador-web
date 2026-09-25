import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  captureNonCriticalError,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import { isAppleConfigured } from "@/services/better-auth/build-auth-options";
import {
  exchangeAppleAuthorizationCode,
  verifyAppleIdentityToken,
} from "@/services/better-auth/apple-tokens";

const bodySchema = z.object({
  authorizationCode: z.string().min(1),
  identityToken: z.string().min(1),
});

const refuse = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

/**
 * Stores a refresh token for the caller's native Sign in with Apple, so that
 * deleting the account can revoke it with Apple (Req 2.5.5).
 * POST /api/auth/apple/tokens  `{ authorizationCode, identityToken }`
 *
 * The app calls this right after an Apple sign-in succeeds, fire-and-forget:
 * a failure here never fails the sign-in, and the user just keeps Apple's
 * manual route for removing the app from their Apple ID.
 *
 * The identity token names the client (its `aud`, the app's bundle ID) that
 * the code must be exchanged with, and the Apple user it belongs to. Both
 * tokens must belong to the caller's own linked Apple account: a token stored
 * against the wrong account would revoke someone else's authorization.
 *
 * Responses:
 * - 200 `{ stored: true }`
 * - 400 `VALIDATION_ERROR` | `APPLE_IDENTITY_TOKEN_INVALID`
 * - 401 — unauthenticated.
 * - 403 `APPLE_ACCOUNT_MISMATCH` — not the caller's linked Apple ID.
 * - 404 `APPLE_NOT_CONFIGURED` — Sign in with Apple is off on this server.
 * - 502 `APPLE_TOKEN_EXCHANGE_FAILED` — Apple refused the code (used,
 *   expired) or is down.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-4)
 */
async function postHandler(request: NextRequest) {
  try {
    // Fired straight after sign-in, before the funnel, with a single-use code:
    // a 403 here would lose the token for good. Apple always asserts the email.
    const authResult = await getAuthenticatedUserResponse({
      allowUnverifiedEmail: true,
    });
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    if (!isAppleConfigured()) {
      return refuse(
        404,
        "APPLE_NOT_CONFIGURED",
        "Sign in with Apple is not available",
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return refuse(
        400,
        "VALIDATION_ERROR",
        "authorizationCode and identityToken are required",
      );
    }
    const { authorizationCode, identityToken } = parsed.data;

    const identity = await verifyAppleIdentityToken(identityToken);
    if (!identity) {
      return refuse(
        400,
        "APPLE_IDENTITY_TOKEN_INVALID",
        "The Apple identity token is invalid or expired",
      );
    }

    const appleAccount = await userDAL.getAppleAccount(userId);
    if (!appleAccount || appleAccount.appleUserId !== identity.sub) {
      return refuse(
        403,
        "APPLE_ACCOUNT_MISMATCH",
        "This Apple ID is not linked to your account",
      );
    }

    let exchanged: Awaited<ReturnType<typeof exchangeAppleAuthorizationCode>>;
    try {
      exchanged = await exchangeAppleAuthorizationCode({
        code: authorizationCode,
        clientId: identity.aud,
      });
    } catch (error) {
      captureNonCriticalError(error, {
        route: "POST /api/auth/apple/tokens",
        action: "exchange-authorization-code",
      });
      return refuse(
        502,
        "APPLE_TOKEN_EXCHANGE_FAILED",
        "Apple did not accept the authorization code",
      );
    }
    // The code must come from the same sign-in as the identity token.
    if (exchanged.sub !== identity.sub) {
      return refuse(
        403,
        "APPLE_ACCOUNT_MISMATCH",
        "This Apple ID is not linked to your account",
      );
    }

    await userDAL.setAppleRefreshToken(appleAccount.id, {
      refreshToken: exchanged.refreshToken,
      clientId: identity.aud,
    });

    return NextResponse.json({ stored: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/apple/tokens",
);
