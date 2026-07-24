import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { SignJWT, exportPKCS8, generateKeyPair, type CryptoKey } from "jose";

/**
 * Sign in with Apple (Req 2.4), exercised through the real config.
 *
 * Apple's ID tokens are signed by Apple, so `verifyIdToken` is overridden to
 * bypass the JWKS fetch (better-auth exposes it as an option for exactly this).
 * Everything downstream of verification — profile mapping, user creation,
 * account linking, and crucially the name-persistence rule — is the real code
 * path, and that is where Req 2.4.3's bug would live.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-01-backend-auth.md (task 1.3).
 */

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));
vi.mock("@/services/resend/send-verification-email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/resend/send-reset-password-email", () => ({
  sendResetPasswordEmail: vi.fn().mockResolvedValue(undefined),
}));

import { buildAuthOptions } from "../build-auth-options";

const APPLE_CLIENT_ID = "com.hoador.services";
const APPLE_SUB = "001234.fedcba9876543210.1234";
const WEB_ORIGIN = "http://localhost:3000";

let signingKey: CryptoKey;
let privateKeyPem: string;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  signingKey = privateKey as CryptoKey;
  privateKeyPem = await exportPKCS8(privateKey);
});

/** An Apple-shaped ID token. Signature is irrelevant — verifyIdToken is stubbed. */
async function makeAppleIdToken(claims: Record<string, unknown>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "test-kid" })
    .setIssuer("https://appleid.apple.com")
    .setAudience(APPLE_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(signingKey);
}

type AppleOptionsFactory = () => Promise<{
  clientId: string;
  clientSecret: string;
  appBundleIdentifier?: string;
}>;

/**
 * The real config, with Apple credentials present and only the remote token
 * verification stubbed out.
 */
function createAppleAuth() {
  const memoryDb: { user: Array<{ email: string; emailVerified: boolean }> } & {
    [table: string]: unknown[];
  } = { user: [], session: [], account: [], verification: [] };

  const options = buildAuthOptions({ database: memoryAdapter(memoryDb) });

  const appleFactory = (
    options.socialProviders as { apple?: AppleOptionsFactory }
  ).apple;
  if (!appleFactory) {
    throw new Error(
      "Apple provider was not registered — check the APPLE_* env stubs",
    );
  }

  const auth = betterAuth({
    ...options,
    socialProviders: {
      ...options.socialProviders,
      apple: async () => ({
        ...(await appleFactory()),
        verifyIdToken: async () => true,
      }),
    },
  });

  return { auth, memoryDb };
}

/**
 * better-auth refuses to link a social account onto a local user whose email is
 * unverified (`requireLocalEmailVerified` defaults to true). Real users clear
 * this by clicking the verification email; tests flip the flag directly.
 */
function markEmailVerified(
  memoryDb: { user: Array<{ email: string; emailVerified: boolean }> },
  email: string,
) {
  const record = memoryDb.user.find((u) => u.email === email);
  if (!record) throw new Error(`no user seeded for ${email}`);
  record.emailVerified = true;
}

const appleSignInRequest = (idToken: Record<string, unknown>) =>
  new Request(`${WEB_ORIGIN}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB_ORIGIN },
    body: JSON.stringify({ provider: "apple", idToken }),
  });

describe("Sign in with Apple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APPLE_CLIENT_ID", APPLE_CLIENT_ID);
    vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
    vi.stubEnv("APPLE_KEY_ID", "KEY7890AB");
    vi.stubEnv("APPLE_PRIVATE_KEY", privateKeyPem);
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", "com.hoador.app");
  });

  describe("provider registration (Req 2.4.1)", () => {
    it("should register Apple when all credentials are present", () => {
      // Arrange & Act
      const { socialProviders } = buildAuthOptions({
        database: memoryAdapter({}),
      });

      // Assert
      expect(socialProviders).toHaveProperty("apple");
    });

    it("should omit Apple when credentials are missing rather than half-configure it", () => {
      // Arrange — a partially configured provider fails at request time with an
      // opaque Apple error; absence is easier to diagnose.
      vi.stubEnv("APPLE_PRIVATE_KEY", "");

      // Act
      const { socialProviders } = buildAuthOptions({
        database: memoryAdapter({}),
      });

      // Assert
      expect(socialProviders).not.toHaveProperty("apple");
      expect(socialProviders).toHaveProperty("google"); // unaffected
    });

    it("should omit Apple when the private key is malformed rather than 500 all auth", () => {
      // Arrange — a key pasted without its PKCS#8 markers (the Vercel footgun)
      // makes the provider factory's importPKCS8 throw, which better-auth turns
      // into a 500 on EVERY auth request. The guard degrades to "Apple off".
      vi.stubEnv(
        "APPLE_PRIVATE_KEY",
        "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkw",
      ); // base64 body, no BEGIN/END
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Act
      const { socialProviders } = buildAuthOptions({
        database: memoryAdapter({}),
      });

      // Assert
      expect(socialProviders).not.toHaveProperty("apple");
      expect(socialProviders).toHaveProperty("google"); // unaffected
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not a PKCS#8 PEM"),
      );
    });

    it("should trust Apple's authorization server", () => {
      // Arrange & Act
      const { trustedOrigins } = buildAuthOptions({
        database: memoryAdapter({}),
      });

      // Assert
      expect(trustedOrigins).toContain("https://appleid.apple.com");
    });

    it("should treat Apple as a trusted provider for account linking, like Google", () => {
      // Arrange & Act
      const { account } = buildAuthOptions({ database: memoryAdapter({}) });

      // Assert
      expect(account.accountLinking.trustedProviders).toEqual([
        "google",
        "apple",
      ]);
    });
  });

  describe("idToken sign-in creates the user (Req 2.4.2)", () => {
    it("should create a user from a first-time Apple authorization", async () => {
      // Arrange
      const { auth } = createAppleAuth();
      const token = await makeAppleIdToken({
        sub: APPLE_SUB,
        email: "jane@icloud.com",
        email_verified: true,
      });

      // Act
      const response = await auth.handler(
        appleSignInRequest({
          token,
          user: { name: { firstName: "Jane", lastName: "Appleseed" } },
        }),
      );

      // Assert
      expect(response.status, await response.clone().text()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        user: { email: "jane@icloud.com", name: "Jane Appleseed" },
      });
    });

    it("should accept a private relay email as an ordinary address", async () => {
      // Arrange — Apple hands out @privaterelay.appleid.com when the user hides
      // their address; nothing downstream may treat it as special (Req 2.4.3).
      const { auth } = createAppleAuth();
      const token = await makeAppleIdToken({
        sub: APPLE_SUB,
        email: "abc123xyz@privaterelay.appleid.com",
        email_verified: true,
        is_private_email: true,
      });

      // Act
      const response = await auth.handler(
        appleSignInRequest({
          token,
          user: { name: { firstName: "Private", lastName: "User" } },
        }),
      );

      // Assert
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        user: { email: "abc123xyz@privaterelay.appleid.com" },
      });
    });
  });

  describe("name is captured on first authorization only (Req 2.4.3)", () => {
    it("should keep the first-authorization name when a later sign-in omits the name payload", async () => {
      // Arrange — Apple sends `user.name` ONLY on the first authorization. On
      // every later sign-in the payload is absent and better-auth's Apple
      // getUserInfo falls back to `profile.name || ""`, so a careless config
      // would overwrite the stored name with an empty string.
      const { auth } = createAppleAuth();
      const claims = {
        sub: APPLE_SUB,
        email: "jane@icloud.com",
        email_verified: true,
      };

      await auth.handler(
        appleSignInRequest({
          token: await makeAppleIdToken(claims),
          user: { name: { firstName: "Jane", lastName: "Appleseed" } },
        }),
      );

      // Act — second sign-in, exactly as Apple sends it: no user payload.
      const response = await auth.handler(
        appleSignInRequest({ token: await makeAppleIdToken(claims) }),
      );

      // Assert
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        user: { name: "Jane Appleseed" },
      });
    });

    it("should link Apple to an existing verified account and keep its name when Apple sends no name payload", async () => {
      // Arrange — an email/password user who already has a name, linking Apple
      // later. Apple only sends `user.name` on the FIRST authorization of this
      // app by this Apple ID, which may long predate this account (e.g. they
      // signed in with Apple before, or deleted and re-registered). So the link
      // can happen with no name available.
      const { auth, memoryDb } = createAppleAuth();
      await auth.api.signUpEmail({
        body: {
          email: "jane@icloud.com",
          password: "E2ePassw0rd!23",
          name: "Jane Appleseed",
        },
      });
      markEmailVerified(memoryDb, "jane@icloud.com");

      // Act
      const response = await auth.handler(
        appleSignInRequest({
          token: await makeAppleIdToken({
            sub: APPLE_SUB,
            email: "jane@icloud.com",
            email_verified: true,
          }),
        }),
      );

      // Assert — the account links, and the existing name survives.
      expect(response.status, await response.clone().text()).toBe(200);
      expect(memoryDb.user).toHaveLength(1);
      expect(
        (memoryDb.user[0] as unknown as { name: string }).name,
        "linking Apple must not blank the user's name",
      ).toBe("Jane Appleseed");
    });
  });
});
