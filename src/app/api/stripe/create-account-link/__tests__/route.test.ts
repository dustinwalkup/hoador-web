import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 2.3.2, 2.3.3
 * Design: 2-design.md §4.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4 (D-E2-6)
 */

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
  process.env.NEXT_PUBLIC_APP_URL = "https://hoador.com";
});

const mockCreateAccountLink = vi.fn();
vi.mock("@/services/stripe/connect", () => ({
  createAccountLink: (...a: unknown[]) => mockCreateAccountLink(...a),
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

const req = (body?: unknown) =>
  new NextRequest("http://localhost/api/stripe/create-account-link", {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

describe("POST /api/stripe/create-account-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_APP_URL = "https://hoador.com";
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1", email: "owner@test.com" },
      userId: "user-1",
      isAdmin: false,
    });
    mockGetOrCreateConnectedAccount.mockResolvedValue("acct_123");
    mockCreateAccountLink.mockResolvedValue(
      "https://connect.stripe.com/setup/e/acct_123/abc",
    );
  });

  it("returns the hosted onboarding URL", async () => {
    const res = await POST(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://connect.stripe.com/setup/e/acct_123/abc",
    });
  });

  it("requires authentication", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(mockGetOrCreateConnectedAccount).not.toHaveBeenCalled();
    expect(mockCreateAccountLink).not.toHaveBeenCalled();
  });

  it("sends Stripe https return/refresh URLs, never a custom scheme", async () => {
    await POST(req());

    const [accountId, urls] = mockCreateAccountLink.mock.calls[0];
    expect(accountId).toBe("acct_123");
    // Stripe rejects custom schemes; these must be the https bounce pages.
    expect(urls.return_url).toMatch(/^https:\/\//);
    expect(urls.refresh_url).toMatch(/^https:\/\//);
    expect(urls.return_url).not.toMatch(/^hoador:/);
    expect(urls.refresh_url).not.toMatch(/^hoador:/);
    expect(urls.return_url).toBe("https://hoador.com/mobile/connect-return");
    expect(urls.refresh_url).toBe("https://hoador.com/mobile/connect-refresh");
  });

  it("ignores a client-supplied return URL (open-redirect defense)", async () => {
    // D-E2-6: the URLs are server-constructed. A body trying to inject its own
    // return target must have no effect — there is no parameter to smuggle a
    // redirect through.
    await POST(
      req({
        return_url: "https://evil.example.com/steal",
        refresh_url: "https://evil.example.com/steal",
      }),
    );

    const [, urls] = mockCreateAccountLink.mock.calls[0];
    expect(urls.return_url).toBe("https://hoador.com/mobile/connect-return");
    expect(urls.refresh_url).toBe("https://hoador.com/mobile/connect-refresh");
    expect(JSON.stringify(urls)).not.toContain("evil.example.com");
  });

  it("reuses the existing connected account", async () => {
    await POST(req());
    await POST(req());

    expect(mockGetOrCreateConnectedAccount).toHaveBeenCalledTimes(2);
    expect(mockGetOrCreateConnectedAccount).toHaveBeenCalledWith("user-1");
    expect(
      mockCreateAccountLink.mock.calls.every((c) => c[0] === "acct_123"),
    ).toBe(true);
  });

  it("does not double-slash the path when APP_URL has a trailing slash", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hoador.com/";

    await POST(req());

    const [, urls] = mockCreateAccountLink.mock.calls[0];
    expect(urls.return_url).toBe("https://hoador.com/mobile/connect-return");
  });

  it.each([
    [
      "the connected account cannot be resolved",
      () =>
        mockGetOrCreateConnectedAccount.mockRejectedValue(new Error("db down")),
    ],
    [
      "the account link cannot be created",
      () => mockCreateAccountLink.mockRejectedValue(new Error("stripe down")),
    ],
  ])("returns 500 when %s", async (_label, arrange) => {
    arrange();

    const res = await POST(req());

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
  });
});
