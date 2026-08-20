import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 2.3.2, 13.2.1, 13.3.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-payments-payouts.md § P-E7-6 (D-E7-11)
 *
 * The route had no tests before this change; these cover all three modes so the
 * additive `mobile` branch is provably isolated from the two web callers.
 */

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
});

const mockCreateAccountSession = vi.fn();
vi.mock("@/services/stripe/connect", () => ({
  createAccountSession: (...a: unknown[]) => mockCreateAccountSession(...a),
}));

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetOrCreateConnectedAccount = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    getOrCreateConnectedAccount: (...a: unknown[]) =>
      mockGetOrCreateConnectedAccount(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const req = (mode?: string) =>
  new NextRequest(
    `http://localhost/api/stripe/create-account-session${mode ? `?mode=${mode}` : ""}`,
    { method: "POST" },
  );

/** The `components` object handed to createAccountSession for a given mode. */
async function componentsFor(mode?: string) {
  await POST(req(mode));
  return mockCreateAccountSession.mock.calls[0]?.[1]?.components;
}

describe("POST /api/stripe/create-account-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1", email: "owner@test.com" },
      userId: "user-1",
      isAdmin: false,
    });
    mockGetOrCreateConnectedAccount.mockResolvedValue("acct_123");
    mockCreateAccountSession.mockResolvedValue("cs_test_secret");
  });

  it("requires authentication", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await POST(req("mobile"));

    expect(res.status).toBe(401);
    expect(mockCreateAccountSession).not.toHaveBeenCalled();
  });

  describe("mode=mobile (P-E7-6)", () => {
    it("returns a client secret", async () => {
      const res = await POST(req("mobile"));

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        clientSecret: "cs_test_secret",
      });
      expect(mockCreateAccountSession).toHaveBeenCalledWith(
        "acct_123",
        expect.anything(),
      );
    });

    it("enables onboarding AND payouts in the same session", async () => {
      // The whole reason this mode exists: the app runs one Connect instance for
      // the entire authenticated shell, so a single session has to cover every
      // component it may mount. Neither existing mode can do this.
      const components = await componentsFor("mobile");

      expect(components.account_onboarding.enabled).toBe(true);
      expect(components.payouts.enabled).toBe(true);
      expect(components.payments.enabled).toBe(true);
    });

    it("collects the external account during onboarding", async () => {
      // Without this the owner completes onboarding with no bank account
      // attached and still can't be paid.
      const components = await componentsFor("mobile");

      expect(
        components.account_onboarding.features.external_account_collection,
      ).toBe(true);
    });

    it("surfaces a session-creation failure as a 500", async () => {
      mockCreateAccountSession.mockRejectedValue(new Error("stripe is down"));

      const res = await POST(req("mobile"));

      expect(res.status).toBe(500);
    });
  });

  describe("existing web modes are untouched", () => {
    it("mode=payments keeps its component set and leaves onboarding disabled", async () => {
      const components = await componentsFor("payments");

      expect(components).toEqual({
        balances: { enabled: true },
        payouts: { enabled: true },
        payouts_list: { enabled: true },
        payments: { enabled: true },
        documents: { enabled: true },
        notification_banner: { enabled: true },
      });
      // `payments` never asked for onboarding; the service defaults it off.
      expect(components.account_onboarding).toBeUndefined();
    });

    it("no mode falls through to the onboarding-only default", async () => {
      await POST(req());

      // Backward compatibility: the original callers pass no options at all, so
      // the service applies its own onboarding default.
      expect(mockCreateAccountSession).toHaveBeenCalledWith("acct_123");
    });

    it("an unrecognized mode behaves like the default, not like mobile", async () => {
      await POST(req("nonsense"));

      expect(mockCreateAccountSession).toHaveBeenCalledWith("acct_123");
    });
  });
});
