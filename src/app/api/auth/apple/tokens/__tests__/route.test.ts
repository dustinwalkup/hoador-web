import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-4)
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetAppleAccount = vi.fn();
const mockSetAppleRefreshToken = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    getAppleAccount: (...a: unknown[]) => mockGetAppleAccount(...a),
    setAppleRefreshToken: (...a: unknown[]) => mockSetAppleRefreshToken(...a),
  },
}));

const mockIsAppleConfigured = vi.fn();
vi.mock("@/services/better-auth/build-auth-options", () => ({
  isAppleConfigured: () => mockIsAppleConfigured(),
}));

const mockVerify = vi.fn();
const mockExchange = vi.fn();
vi.mock("@/services/better-auth/apple-tokens", () => ({
  verifyAppleIdentityToken: (...a: unknown[]) => mockVerify(...a),
  exchangeAppleAuthorizationCode: (...a: unknown[]) => mockExchange(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/auth/apple/tokens", {
    method: "POST",
    body: JSON.stringify(body),
  });
const BODY = { authorizationCode: "code-1", identityToken: "id-token-1" };

describe("POST /api/auth/apple/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
      isAdmin: false,
    });
    mockIsAppleConfigured.mockReturnValue(true);
    mockVerify.mockResolvedValue({ sub: "apple-sub-1", aud: "com.hoador.app" });
    mockGetAppleAccount.mockResolvedValue({
      id: "acct-row-1",
      appleUserId: "apple-sub-1",
    });
    mockExchange.mockResolvedValue({
      refreshToken: "refresh-1",
      sub: "apple-sub-1",
    });
    mockSetAppleRefreshToken.mockResolvedValue(undefined);
  });

  it("exchanges the code with the identity token's client and stores the pair", async () => {
    const res = await POST(post(BODY));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stored: true });
    expect(mockVerify).toHaveBeenCalledWith("id-token-1");
    expect(mockGetAppleAccount).toHaveBeenCalledWith("user-1");
    expect(mockExchange).toHaveBeenCalledWith({
      code: "code-1",
      clientId: "com.hoador.app",
    });
    expect(mockSetAppleRefreshToken).toHaveBeenCalledWith("acct-row-1", {
      refreshToken: "refresh-1",
      clientId: "com.hoador.app",
    });
  });

  it("never echoes the refresh token", async () => {
    const res = await POST(post(BODY));

    expect(await res.text()).not.toContain("refresh-1");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await POST(post(BODY));

    expect(res.status).toBe(401);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("returns 404 APPLE_NOT_CONFIGURED when Apple is off on this server", async () => {
    mockIsAppleConfigured.mockReturnValue(false);

    const res = await POST(post(BODY));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("APPLE_NOT_CONFIGURED");
  });

  it.each([
    ["no body", null],
    ["a missing code", { identityToken: "t" }],
    ["an empty identity token", { authorizationCode: "c", identityToken: "" }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const res = await POST(post(body));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 APPLE_IDENTITY_TOKEN_INVALID when the identity token fails verification", async () => {
    mockVerify.mockResolvedValue(null);

    const res = await POST(post(BODY));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("APPLE_IDENTITY_TOKEN_INVALID");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  // Storing a token against the wrong account would make this user's deletion
  // revoke someone else's authorization.
  it("returns 403 APPLE_ACCOUNT_MISMATCH for another Apple ID's identity token", async () => {
    mockVerify.mockResolvedValue({
      sub: "someone-else",
      aud: "com.hoador.app",
    });

    const res = await POST(post(BODY));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("APPLE_ACCOUNT_MISMATCH");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("returns 403 APPLE_ACCOUNT_MISMATCH when the caller has no Apple account", async () => {
    mockGetAppleAccount.mockResolvedValue(null);

    const res = await POST(post(BODY));

    expect(res.status).toBe(403);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("returns 403 APPLE_ACCOUNT_MISMATCH and stores nothing when the code is another Apple ID's", async () => {
    mockExchange.mockResolvedValue({ refreshToken: "r", sub: "someone-else" });

    const res = await POST(post(BODY));

    expect(res.status).toBe(403);
    expect(mockSetAppleRefreshToken).not.toHaveBeenCalled();
  });

  it("returns 502 APPLE_TOKEN_EXCHANGE_FAILED and stores nothing when Apple refuses the code", async () => {
    mockExchange.mockRejectedValue(new Error("invalid_grant"));

    const res = await POST(post(BODY));

    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("APPLE_TOKEN_EXCHANGE_FAILED");
    expect(mockSetAppleRefreshToken).not.toHaveBeenCalled();
  });
});
