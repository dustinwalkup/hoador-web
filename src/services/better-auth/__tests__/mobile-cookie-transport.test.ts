import { describe, it, expect, vi, beforeEach } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

/**
 * Covers the mobile auth transport (design D3 / Req 2.1.1–2.1.3, 2.1.6):
 *
 *  1. the session cookie better-auth issues resolves from an explicit `Cookie`
 *     request header — exactly how the app's `apiFetch` sends it
 *     (`Cookie: authClient.getCookie()`), with no browser cookie jar; and
 *  2. `trustedOrigins` admits the mobile scheme and rejects everything else.
 *
 * The cookie transport is the assumption the whole mobile architecture rests on
 * (design D3 chose it over bearer tokens precisely because it needs no route
 * changes), so it is asserted against the REAL configuration: `buildAuthOptions`
 * is the same function `index.ts` feeds to `betterAuth()`. Only the database
 * adapter is swapped for an in-memory one — the transport has nothing to do with
 * Postgres, and this repo has no test database.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-01-backend-auth.md (task 1.2, D-E1-1).
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

const TEST_USER = {
  email: "mobile-user@e2e.test",
  password: "E2ePassw0rd!23",
  name: "Mobile User",
};

const WEB_ORIGIN = "http://localhost:3000";

const freshMemoryDb = () =>
  memoryAdapter({ user: [], session: [], account: [], verification: [] });

/** The real config, against a fresh in-memory database. */
function createTestAuth() {
  return betterAuth(buildAuthOptions({ database: freshMemoryDb() }));
}

/**
 * The real config with origin checking forced on.
 *
 * better-auth defaults `skipOriginCheck` to TRUE whenever `isTest()` (i.e.
 * NODE_ENV=test, which vitest sets), so `trustedOrigins` is inert under vitest
 * unless we opt back in. Production never takes that branch — setting
 * `disableOriginCheck: false` here makes the test environment behave like
 * production, which is the only way to assert the list actually gates anything.
 */
function createOriginCheckingAuth() {
  return betterAuth({
    ...buildAuthOptions({ database: freshMemoryDb() }),
    advanced: { disableOriginCheck: false },
  });
}

/** Extracts the `name=value` pairs a client would echo back in a Cookie header. */
function toCookieHeader(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected a Set-Cookie header");
  return setCookie
    .split(",")
    .map((c) => c.trim().split(";")[0])
    .filter((pair) => pair.includes("="))
    .join("; ");
}

const authRequest = (path: string, body: unknown) =>
  new Request(`${WEB_ORIGIN}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB_ORIGIN },
    body: JSON.stringify(body),
  });

describe("mobile auth transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("session resolution from a Cookie header (Req 2.1.2)", () => {
    it("should resolve the session a sign-up issued when the cookie is replayed as a Cookie header", async () => {
      // Arrange — sign up, capturing the cookie the way SecureStore would.
      const auth = createTestAuth();
      const signUpResponse = await auth.api.signUpEmail({
        body: TEST_USER,
        returnHeaders: true,
      });
      const cookie = toCookieHeader(
        signUpResponse.headers.get("set-cookie") ?? null,
      );

      // Act — replay it exactly as the app's apiFetch will.
      const session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });

      // Assert
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe(TEST_USER.email);
    });

    it("should resolve the session a sign-in issued when the cookie is replayed as a Cookie header", async () => {
      // Arrange
      const auth = createTestAuth();
      await auth.api.signUpEmail({ body: TEST_USER });
      const signInResponse = await auth.api.signInEmail({
        body: { email: TEST_USER.email, password: TEST_USER.password },
        returnHeaders: true,
      });
      const cookie = toCookieHeader(
        signInResponse.headers.get("set-cookie") ?? null,
      );

      // Act
      const session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });

      // Assert
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe(TEST_USER.email);
    });

    it("should return null when no Cookie header is present", async () => {
      // Arrange
      const auth = createTestAuth();
      await auth.api.signUpEmail({ body: TEST_USER });

      // Act
      const session = await auth.api.getSession({ headers: new Headers() });

      // Assert
      expect(session).toBeNull();
    });

    it("should return null for a tampered session cookie", async () => {
      // Arrange — a well-formed cookie whose token no longer matches.
      const auth = createTestAuth();
      const signUpResponse = await auth.api.signUpEmail({
        body: TEST_USER,
        returnHeaders: true,
      });
      const cookie = toCookieHeader(
        signUpResponse.headers.get("set-cookie") ?? null,
      );
      const tampered = cookie.replace(
        /=(.)/,
        (_match, firstChar: string) => `=${firstChar === "a" ? "b" : "a"}`,
      );

      // Act
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: tampered }),
      });

      // Assert
      expect(session).toBeNull();
    });
  });

  describe("trustedOrigins list (Req 2.1.3)", () => {
    it("should trust the mobile app scheme", () => {
      // Arrange & Act
      const { trustedOrigins } = buildAuthOptions({
        database: freshMemoryDb(),
      });

      // Assert
      expect(trustedOrigins).toContain("hoador://");
      expect(trustedOrigins).toContain("hoador://*");
    });

    it("should keep trusting the web app origin", () => {
      // Arrange
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://hoador.com");

      // Act
      const { trustedOrigins } = buildAuthOptions({
        database: freshMemoryDb(),
      });

      // Assert
      expect(trustedOrigins).toContain("https://hoador.com");
    });

    it("should trust Expo dev-client origins in development", () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "development");

      // Act
      const { trustedOrigins } = buildAuthOptions({
        database: freshMemoryDb(),
      });

      // Assert
      expect(trustedOrigins).toContain("exp://");
      expect(trustedOrigins).toContain("exp://192.168.*.*:*/**");
    });

    it.each(["production", "test"])(
      "should NOT trust Expo dev-client origins when NODE_ENV is %s",
      (nodeEnv) => {
        // Arrange — trusting exp:// in a released build would let any machine on
        // the network serve an origin the server accepts.
        vi.stubEnv("NODE_ENV", nodeEnv);

        // Act
        const { trustedOrigins } = buildAuthOptions({
          database: freshMemoryDb(),
        });

        // Assert
        expect(
          trustedOrigins.some((origin) => origin.startsWith("exp://")),
        ).toBe(false);
      },
    );
  });

  describe("trustedOrigins enforcement (Req 2.1.3)", () => {
    it("should accept a callbackURL on the mobile app scheme", async () => {
      // Arrange
      const auth = createOriginCheckingAuth();
      await auth.handler(authRequest("/sign-up/email", TEST_USER));

      // Act — this is what an OAuth callback / reset deep link into the app looks like.
      const response = await auth.handler(
        authRequest("/sign-in/email", {
          email: TEST_USER.email,
          password: TEST_USER.password,
          callbackURL: "hoador://post-sign-in",
        }),
      );

      // Assert
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        url: "hoador://post-sign-in",
      });
    });

    it.each([
      ["an unlisted custom scheme", "evilapp://stolen"],
      ["an unlisted https origin", "https://evil.com/steal"],
      ["an Expo dev origin outside development", "exp://1.2.3.4:8081/x"],
    ])("should reject a callbackURL on %s", async (_label, callbackURL) => {
      // Arrange
      const auth = createOriginCheckingAuth();
      await auth.handler(authRequest("/sign-up/email", TEST_USER));

      // Act
      const response = await auth.handler(
        authRequest("/sign-in/email", {
          email: TEST_USER.email,
          password: TEST_USER.password,
          callbackURL,
        }),
      );

      // Assert
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        code: "INVALID_CALLBACK_URL",
      });
    });
  });

  describe("web session behavior is unchanged (Req 2.1.6)", () => {
    it("should issue the same cookie name and 7 day expiry as before the Expo plugin", async () => {
      // Arrange
      const auth = createTestAuth();

      // Act
      const response = await auth.api.signUpEmail({
        body: TEST_USER,
        returnHeaders: true,
      });
      const setCookie = response.headers.get("set-cookie") ?? "";

      // Assert — baseline captured from better-auth 1.6.16 before this epic;
      // see the epic file's cookie parity table.
      expect(setCookie).toContain("better-auth.session_token=");
      expect(setCookie).toContain("Max-Age=604800"); // exactly 7 days
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
    });
  });
});
