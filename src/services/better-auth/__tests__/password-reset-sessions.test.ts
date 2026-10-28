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

const mockDeactivateAllForUser = vi.fn();
vi.mock("@/dal", () => ({
  pushSubscriptionDAL: {
    deactivateAllForUser: (...a: unknown[]) => mockDeactivateAllForUser(...a),
  },
}));

const mockCaptureNonCriticalError = vi.fn();
vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: (...a: unknown[]) =>
    mockCaptureNonCriticalError(...a),
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
  const { user } = await auth.api.signUpEmail({ body: TEST_USER });
  return { auth, userId: user.id };
}

/** Request a reset by email and complete it with the emailed token. */
async function resetPassword(auth: Awaited<ReturnType<typeof setUp>>["auth"]) {
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
}

describe("password reset revokes existing sessions (SEC-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST", "");
    mockSendResetPasswordEmail.mockResolvedValue(undefined);
    mockDeactivateAllForUser.mockResolvedValue(undefined);
  });

  it("sets revokeSessionsOnPasswordReset in the real config", () => {
    const options = buildAuthOptions({
      database: memoryAdapter({}),
    });

    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
  });

  it("signs out a session opened before the reset", async () => {
    const { auth } = await setUp();

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
    await resetPassword(auth);

    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: attackerCookie }),
      }),
    ).toBeNull();
  });
});

/**
 * UAT E2E-015: a reset signs out every device (above), and a device signed out
 * that way can't unsubscribe itself, so the reset deactivates every push
 * subscription of the account. No device is spared: the one completing the
 * reset is signed out, and its next sign-in registers it again.
 */
describe("password reset deactivates every push subscription (E2E-015)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST", "");
    mockSendResetPasswordEmail.mockResolvedValue(undefined);
    mockDeactivateAllForUser.mockResolvedValue(undefined);
  });

  it("deactivates all of the user's subscriptions", async () => {
    const { auth, userId } = await setUp();

    await resetPassword(auth);

    expect(mockDeactivateAllForUser).toHaveBeenCalledTimes(1);
    expect(mockDeactivateAllForUser).toHaveBeenCalledWith(userId, {
      exceptToken: undefined,
    });
  });

  it("still revokes the sessions when the deactivation fails", async () => {
    const { auth } = await setUp();
    const signIn = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      returnHeaders: true,
    });
    const cookie = toCookieHeader(signIn.headers.get("set-cookie"));
    const failure = new Error("db down");
    mockDeactivateAllForUser.mockRejectedValue(failure);

    await resetPassword(auth);

    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeNull();
    expect(mockCaptureNonCriticalError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ route: "/reset-password" }),
    );
  });
});
