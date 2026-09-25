import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("@/lib/api/rate-limit", () => ({
  enforceRateLimit: (...a: unknown[]) => mockEnforceRateLimit(...a),
  // The real better-auth config loads through this route's imports.
  betterAuthRateLimitStorage: {},
}));

const mockSignUpWithEmail = vi.fn();
vi.mock("@/features/auth/services/auth-service", () => ({
  AuthService: {
    signUpWithEmail: (...a: unknown[]) => mockSignUpWithEmail(...a),
  },
}));

vi.mock("@/lib/integrations/meta/meta-capi", () => ({
  sendMetaCompleteRegistration: vi.fn(),
}));

import { POST } from "./route";
import { RateLimitedError } from "@/dal/errors";

function formRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({
      email: "new@example.com",
      password: "Str0ng!Passw0rd",
      firstName: "New",
      lastName: "User",
      legalAccepted: "true",
    }).toString(),
  });
}

describe("POST /api/auth/signup — rate limiting (SEC-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockSignUpWithEmail.mockResolvedValue({
      userId: "user-1",
      redirect: "/signup/verify",
    });
  });

  it("limits per IP before creating the account", async () => {
    const res = await POST(formRequest({ "x-forwarded-for": "203.0.113.7" }));

    expect(res.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:signup:ip:203.0.113.7",
      5,
      3600,
    );
  });

  it("returns 429 with Retry-After and creates nothing once limited", async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitedError(900));

    const res = await POST(formRequest({ "x-forwarded-for": "203.0.113.7" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it("does not limit when the IP is unknown (no shared bucket)", async () => {
    await POST(formRequest());

    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
    expect(mockSignUpWithEmail).toHaveBeenCalled();
  });
});
