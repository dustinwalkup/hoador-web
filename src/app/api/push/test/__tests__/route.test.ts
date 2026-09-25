import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocking the session module rather than route-helpers (per CLAUDE.md) keeps
// the real `handleApiError` — and its 429 + Retry-After mapping — under test.
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

const mockEnforceRateLimit = vi.fn();
vi.mock("@/lib/api/rate-limit", () => ({
  enforceRateLimit: (...a: unknown[]) => mockEnforceRateLimit(...a),
  betterAuthRateLimitStorage: {},
}));

const mockGetActiveByUserId = vi.fn();
vi.mock("@/dal", () => ({
  pushSubscriptionDAL: {
    getActiveByUserId: (...a: unknown[]) => mockGetActiveByUserId(...a),
  },
}));

const mockSendPush = vi.fn();
vi.mock("@/features/notifications/lib/push-service", () => ({
  isPushVapidConfigured: () => true,
  sendPush: (...a: unknown[]) => mockSendPush(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";
import { RateLimitedError } from "@/dal/errors";

// The handler ignores its request; `withRequestLogging` types it as taking one.
const REQ = new NextRequest("http://localhost/api/push/test", {
  method: "POST",
});

describe("POST /api/push/test — rate limiting (SEC-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
      isAdmin: false,
    });
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockGetActiveByUserId.mockResolvedValue([{ id: "sub-1" }]);
  });

  it("sends once within the per-user limit", async () => {
    const res = await (POST as (r: NextRequest) => Promise<Response>)(REQ);

    expect(res.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "push:test:user:user-1",
      5,
      3600,
    );
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  // Every call fans out to all of the user's endpoints — the reflector.
  it("returns 429 with Retry-After and sends nothing once limited", async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitedError(600));

    const res = await (POST as (r: NextRequest) => Promise<Response>)(REQ);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("600");
    expect(mockGetActiveByUserId).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});
