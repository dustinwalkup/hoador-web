import { describe, it, expect, vi, beforeEach } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

/**
 * SEC-05 (change half, mobile P-E14-7): a password change must evict every
 * other session, whatever the client sends. A change is usually a response to
 * suspicion; if revocation were the client's choice, the attacker's session
 * would survive the fix meant to evict it.
 *
 * Asserted against the REAL configuration (`buildAuthOptions`, as
 * `password-reset-sessions.test.ts` does), with only the database swapped for
 * an in-memory adapter.
 */

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

vi.mock("@/services/resend/send-verification-email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { buildAuthOptions } from "../build-auth-options";

const TEST_USER = {
  email: "change-user@e2e.test",
  password: "E2ePassw0rd!23",
  name: "Change User",
};
const NEW_PASSWORD = "N3wPassw0rd!45";

function toCookieHeader(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected a Set-Cookie header");
  return setCookie
    .split(",")
    .map((c) => c.trim().split(";")[0])
    .filter((pair) => pair.includes("="))
    .join("; ");
}

async function setUp() {
  const auth = betterAuth(
    buildAuthOptions({
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
      }),
    }),
  );
  await auth.api.signUpEmail({ body: TEST_USER });

  async function signIn() {
    const res = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      returnHeaders: true,
    });
    return toCookieHeader(res.headers.get("set-cookie"));
  }

  async function isSignedIn(cookie: string) {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    return session !== null;
  }

  return { auth, signIn, isSignedIn };
}

describe("password change revokes other sessions (SEC-05, P-E14-7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST", "");
  });

  it.each([
    ["omits the flag", {}],
    ["sends revokeOtherSessions: false", { revokeOtherSessions: false }],
  ])(
    "signs out the other device even when the client %s",
    async (_label, flag) => {
      const { auth, signIn, isSignedIn } = await setUp();
      const attackerCookie = await signIn();
      const ownerCookie = await signIn();
      expect(await isSignedIn(attackerCookie)).toBe(true);

      const res = await auth.api.changePassword({
        body: {
          currentPassword: TEST_USER.password,
          newPassword: NEW_PASSWORD,
          ...flag,
        },
        headers: new Headers({ cookie: ownerCookie }),
        returnHeaders: true,
      });

      expect(await isSignedIn(attackerCookie)).toBe(false);

      // The changing device stays signed in: its session is rotated, and the
      // rotated cookie is what the client must keep (mobile 14.3.1).
      expect(res.response.token).toBeTruthy();
      const rotatedCookie = toCookieHeader(res.headers.get("set-cookie"));
      expect(await isSignedIn(rotatedCookie)).toBe(true);
    },
  );
});
