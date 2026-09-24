import { describe, it, expect, vi, beforeEach } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

/**
 * SEC-05: a password reset must evict every existing session. A reset is how a
 * user recovers a compromised account; if the attacker's session survives it,
 * recovery recovers nothing.
 *
 * Asserted against the REAL configuration (`buildAuthOptions`, as
 * `mobile-cookie-transport.test.ts` does), with only the database swapped for
 * an in-memory adapter.
 */

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

vi.mock("@/services/resend/send-verification-email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockSendResetPasswordEmail = vi.fn();
vi.mock("@/services/resend/send-reset-password-email", () => ({
  sendResetPasswordEmail: (...a: unknown[]) => mockSendResetPasswordEmail(...a),
}));

import { buildAuthOptions } from "../build-auth-options";

const TEST_USER = {
  email: "reset-user@e2e.test",
  password: "E2ePassw0rd!23",
  name: "Reset User",
};

function toCookieHeader(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected a Set-Cookie header");
  return setCookie
    .split(",")
    .map((c) => c.trim().split(";")[0])
    .filter((pair) => pair.includes("="))
    .join("; ");
}

describe("password reset revokes existing sessions (SEC-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST", "");
    mockSendResetPasswordEmail.mockResolvedValue(undefined);
  });

  it("sets revokeSessionsOnPasswordReset in the real config", () => {
    const options = buildAuthOptions({
      database: memoryAdapter({}),
    });

    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
  });

  it("signs out a session opened before the reset", async () => {
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

    // The attacker's session: a separate sign-in on another device.
    const signIn = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      returnHeaders: true,
    });
    const attackerCookie = toCookieHeader(signIn.headers.get("set-cookie"));
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: attackerCookie }),
      }),
    ).not.toBeNull();

    // The victim recovers the account by email.
    await auth.api.requestPasswordReset({
      body: { email: TEST_USER.email, redirectTo: "/reset-password" },
    });
    const { callbackUrl } = mockSendResetPasswordEmail.mock.calls[0][0] as {
      callbackUrl: string;
    };
    const token = new URL(callbackUrl).pathname.split("/").pop();
    expect(token).toBeTruthy();

    await auth.api.resetPassword({
      body: { newPassword: "N3wPassw0rd!45", token: token! },
    });

    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: attackerCookie }),
      }),
    ).toBeNull();
  });
});
