import { importPKCS8, SignJWT } from "jose";

/**
 * Apple does not issue a static client secret. It expects a short-lived ES256
 * JWT signed with the Sign in with Apple private key (.p8), which we mint at
 * runtime rather than pre-generating into an env var — a pre-generated secret
 * would expire silently in production up to six months after anyone last
 * thought about it, taking Sign in with Apple (and App Store compliance) down
 * with it.
 *
 * @see https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-01-backend-auth.md (task 1.3, D-E1-2).
 */

/** Apple rejects any secret whose lifetime exceeds six months. */
export const APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS = 15_777_000;

/** 180 days — comfortably inside Apple's ceiling. */
const APPLE_CLIENT_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60;

const APPLE_AUDIENCE = "https://appleid.apple.com";

export type AppleClientSecretParams = {
  /** Services ID for web OAuth (the App ID is passed separately as appBundleIdentifier). */
  clientId: string;
  /** Apple Developer Team ID. */
  teamId: string;
  /** Key ID of the Sign in with Apple private key. */
  keyId: string;
  /** Contents of the .p8 private key, PKCS#8 PEM. */
  privateKey: string;
};

/**
 * Normalizes a PEM read from an environment variable. Vercel (and .env files)
 * store multi-line values with literal "\n" sequences, which `importPKCS8`
 * rejects.
 */
function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n").trim();
}

export async function generateAppleClientSecret({
  clientId,
  teamId,
  keyId,
  privateKey,
}: AppleClientSecretParams): Promise<string> {
  const key = await importPKCS8(normalizePrivateKey(privateKey), "ES256");
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + APPLE_CLIENT_SECRET_LIFETIME_SECONDS)
    .sign(key);
}
