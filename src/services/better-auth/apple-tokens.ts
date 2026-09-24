import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { generateAppleClientSecret } from "./apple-client-secret";

/**
 * Sign in with Apple's REST API, for the one thing better-auth doesn't do:
 * revoking a user's tokens when they delete their account. Apple's
 * account-deletion guidance says an app offering Sign in with Apple "should"
 * revoke them (Req 2.5.5).
 *
 * A revocation needs a refresh token, and the native sign-in only hands the
 * server an identity token. So the app also sends the sign-in's single-use
 * authorization code, which is exchanged here for a refresh token and stored
 * until deletion.
 *
 * @see https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-4, F20)
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

/** Apple answered with an error; `appleError` is its `error` field, if any. */
export class AppleTokenError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly appleError: string | null,
  ) {
    super(message);
    this.name = "AppleTokenError";
  }
}

/**
 * The client IDs a native identity token may be issued to: the same audience
 * better-auth's Apple provider accepts (`appBundleIdentifier`, falling back to
 * the Services ID). A token for any other client never signed anyone in here.
 */
export function appleNativeAudiences(): string[] {
  const audience =
    process.env.APPLE_APP_BUNDLE_IDENTIFIER || process.env.APPLE_CLIENT_ID;
  return audience ? [audience] : [];
}

/** The web flow's client (the Services ID), which issues better-auth's own tokens. */
export function appleWebClientId(): string | null {
  return process.env.APPLE_CLIENT_ID || null;
}

/**
 * Verifies a native identity token and returns who it is for and which client
 * it was issued to. Returns `null` on any failure.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  { jwks = APPLE_JWKS }: { jwks?: JWTVerifyGetKey } = {},
): Promise<{ sub: string; aud: string } | null> {
  const audiences = appleNativeAudiences();
  if (audiences.length === 0) return null;
  try {
    const { payload } = await jwtVerify(identityToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: audiences,
      maxTokenAge: "1h",
    });
    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    if (!payload.sub || !aud) return null;
    return { sub: payload.sub, aud };
  } catch {
    return null;
  }
}

function clientSecretFor(clientId: string): Promise<string> {
  return generateAppleClientSecret({
    clientId,
    teamId: process.env.APPLE_TEAM_ID as string,
    keyId: process.env.APPLE_KEY_ID as string,
    privateKey: process.env.APPLE_PRIVATE_KEY as string,
  });
}

async function postToApple(
  url: string,
  params: Record<string, string>,
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AppleTokenError(
      `Apple ${new URL(url).pathname} failed with ${res.status}`,
      res.status,
      body?.error ?? null,
    );
  }
  return res;
}

/**
 * Exchanges a sign-in's authorization code (single use, valid five minutes)
 * for a refresh token. `sub` comes from the id token in Apple's response,
 * which arrives straight from Apple over TLS, so it is trusted as is.
 */
export async function exchangeAppleAuthorizationCode({
  code,
  clientId,
}: {
  code: string;
  clientId: string;
}): Promise<{ refreshToken: string; sub: string | null }> {
  const res = await postToApple(APPLE_TOKEN_URL, {
    client_id: clientId,
    client_secret: await clientSecretFor(clientId),
    code,
    grant_type: "authorization_code",
  });
  const body = (await res.json()) as {
    refresh_token?: string;
    id_token?: string;
  };
  if (!body.refresh_token) {
    throw new AppleTokenError("Apple returned no refresh token", 200, null);
  }
  let sub: string | null = null;
  try {
    sub = body.id_token ? (decodeJwt(body.id_token).sub ?? null) : null;
  } catch {
    sub = null;
  }
  return { refreshToken: body.refresh_token, sub };
}

/** Revokes a refresh token, and with it the user's authorization of the app. */
export async function revokeAppleRefreshToken({
  refreshToken,
  clientId,
}: {
  refreshToken: string;
  clientId: string;
}): Promise<void> {
  await postToApple(APPLE_REVOKE_URL, {
    client_id: clientId,
    client_secret: await clientSecretFor(clientId),
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
}
