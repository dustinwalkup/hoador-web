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
  const { user } = await auth.api.signUpEmail({ body: TEST_USER });

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

  return { auth, userId: user.id, signIn, isSignedIn };
}

describe("password change revokes other sessions (SEC-05, P-E14-7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST", "");
    mockDeactivateAllForUser.mockResolvedValue(undefined);
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

/**
 * UAT E2E-015: the devices a revocation signs out must stop receiving the
 * account's pushes. Their own sign-out can't unsubscribe them (the cookie it
 * would send is already dead), so the server does it in the same request.
 * The mobile app sends its own Expo token as `pushToken`; that device keeps
 * its session, so it keeps its subscription.
 */
describe("session revocation deactivates the signed-out devices' push (E2E-015)", () => {
  const DEVICE_TOKEN = "ExponentPushToken[device-1]";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST", "");
    mockDeactivateAllForUser.mockResolvedValue(undefined);
  });

  it("a password change deactivates every subscription but the caller's", async () => {
    const { auth, userId, signIn } = await setUp();
    const cookie = await signIn();

    await auth.api.changePassword({
      body: {
        currentPassword: TEST_USER.password,
        newPassword: NEW_PASSWORD,
        pushToken: DEVICE_TOKEN,
      } as { currentPassword: string; newPassword: string },
      headers: new Headers({ cookie }),
    });

    expect(mockDeactivateAllForUser).toHaveBeenCalledTimes(1);
    expect(mockDeactivateAllForUser).toHaveBeenCalledWith(userId, {
      exceptToken: DEVICE_TOKEN,
    });
  });

  it("reads pushToken from the app's HTTP request, not only auth.api", async () => {
    const { auth, userId, signIn } = await setUp();
    const cookie = await signIn();

    // What the mobile app's `authClient.changePassword` sends. happy-dom's
    // Request drops a `cookie` header as browser-forbidden, which the app's
    // native fetch does not, so the headers are put back after construction.
    const request = new Request(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: TEST_USER.password,
          newPassword: NEW_PASSWORD,
          revokeOtherSessions: true,
          pushToken: DEVICE_TOKEN,
        }),
      },
    );
    Object.defineProperty(request, "headers", {
      value: new Headers({
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie,
      }),
    });
    const response = await auth.handler(request);

    expect(response.status).toBe(200);
    expect(mockDeactivateAllForUser).toHaveBeenCalledWith(userId, {
      exceptToken: DEVICE_TOKEN,
    });
  });

  it("a password change from an unregistered device deactivates them all", async () => {
    const { auth, userId, signIn } = await setUp();
    const cookie = await signIn();

    await auth.api.changePassword({
      body: { currentPassword: TEST_USER.password, newPassword: NEW_PASSWORD },
      headers: new Headers({ cookie }),
    });

    expect(mockDeactivateAllForUser).toHaveBeenCalledWith(userId, {
      exceptToken: undefined,
    });
  });

  it("a refused password change deactivates nothing", async () => {
    const { auth, signIn } = await setUp();
    const cookie = await signIn();

    await expect(
      auth.api.changePassword({
        body: {
          currentPassword: "not-the-password",
          newPassword: NEW_PASSWORD,
          pushToken: DEVICE_TOKEN,
        } as { currentPassword: string; newPassword: string },
        headers: new Headers({ cookie }),
      }),
    ).rejects.toThrow();

    expect(mockDeactivateAllForUser).not.toHaveBeenCalled();
  });

  it("a deactivation failure never fails the password change", async () => {
    const { auth, signIn, isSignedIn } = await setUp();
    const cookie = await signIn();
    const failure = new Error("db down");
    mockDeactivateAllForUser.mockRejectedValue(failure);

    const res = await auth.api.changePassword({
      body: { currentPassword: TEST_USER.password, newPassword: NEW_PASSWORD },
      headers: new Headers({ cookie }),
      returnHeaders: true,
    });

    // The rotated cookie still reaches the caller: failing here would sign
    // the changing device out too, its old session already deleted.
    const rotatedCookie = toCookieHeader(res.headers.get("set-cookie"));
    expect(await isSignedIn(rotatedCookie)).toBe(true);
    expect(mockCaptureNonCriticalError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ route: "/change-password" }),
    );
  });

  it("revoke-other-sessions spares the caller's token", async () => {
    const { auth, userId, signIn } = await setUp();
    const cookie = await signIn();

    await auth.api.revokeOtherSessions({
      body: { pushToken: DEVICE_TOKEN },
      headers: new Headers({ cookie }),
    } as unknown as Parameters<typeof auth.api.revokeOtherSessions>[0]);

    expect(mockDeactivateAllForUser).toHaveBeenCalledWith(userId, {
      exceptToken: DEVICE_TOKEN,
    });
  });

  it("revoke-sessions signs out every device, so it spares none", async () => {
    const { auth, userId, signIn } = await setUp();
    const cookie = await signIn();

    await auth.api.revokeSessions({
      body: { pushToken: DEVICE_TOKEN },
      headers: new Headers({ cookie }),
    } as unknown as Parameters<typeof auth.api.revokeSessions>[0]);

    expect(mockDeactivateAllForUser).toHaveBeenCalledWith(userId, {
      exceptToken: undefined,
    });
  });

  it("a plain sign-in deactivates nothing", async () => {
    const { signIn } = await setUp();
    await signIn();

    expect(mockDeactivateAllForUser).not.toHaveBeenCalled();
  });
});
