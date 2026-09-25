import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// `services/stripe/server` throws at module load without a secret key.
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
});

const mockSetupIntentsCreate = vi.fn();
const mockCustomersCreate = vi.fn();
vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    setupIntents: { create: (...a: unknown[]) => mockSetupIntentsCreate(...a) },
    customers: { create: (...a: unknown[]) => mockCustomersCreate(...a) },
  },
}));

// Mocking the session module rather than route-helpers (per CLAUDE.md).
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

const mockEnforceRateLimit = vi.fn();
vi.mock("@/lib/api/rate-limit", () => ({
  enforceRateLimit: (...a: unknown[]) => mockEnforceRateLimit(...a),
  betterAuthRateLimitStorage: {},
}));

vi.mock("@/dal", () => ({
  userDAL: { updateUser: vi.fn() },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";
import { RateLimitedError } from "@/dal/errors";

const REQ = new NextRequest("http://localhost/api/create-setup-intent", {
  method: "POST",
});
const post = POST as (r: NextRequest) => Promise<Response>;

describe("POST /api/create-setup-intent — rate limiting (SEC-21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1", stripeCustomerId: "cus_123" },
      userId: "user-1",
      isAdmin: false,
    });
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockSetupIntentsCreate.mockResolvedValue({ client_secret: "seti_secret" });
  });

  // Shares one bucket with payment-sheet-params, so alternating web and
  // mobile cannot double the effective limit.
  it("mints a SetupIntent within the per-user limit", async () => {
    const res = await post(REQ);

    expect(res.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "setup-intent:user:user-1",
      10,
      3600,
    );
    await expect(res.json()).resolves.toEqual({ clientSecret: "seti_secret" });
  });

  it("returns 429 with Retry-After and mints nothing once limited", async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitedError(300));

    const res = await post(REQ);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(mockSetupIntentsCreate).not.toHaveBeenCalled();
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });
});
