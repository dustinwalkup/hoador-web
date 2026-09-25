import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("@/lib/api/rate-limit", () => ({
  enforceRateLimit: (...a: unknown[]) => mockEnforceRateLimit(...a),
}));

const mockResetPassword = vi.fn();
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      resetPassword: (...a: unknown[]) => mockResetPassword(...a),
    },
  },
}));

import { POST } from "./route";
import { RateLimitedError } from "@/dal/errors";

function formRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({
      token: "reset-token",
      password: "Str0ng!Passw0rd",
    }).toString(),
  });
}

describe("POST /api/auth/reset-password — rate limiting (SEC-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockResetPassword.mockResolvedValue({ status: true });
  });

  it("limits per IP only — the token, not an email, is the identity", async () => {
    const res = await POST(formRequest({ "x-forwarded-for": "203.0.113.7" }));

    expect(res.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:reset-password:ip:203.0.113.7",
      10,
      900,
    );
  });

  it("returns 429 with Retry-After and resets nothing once limited", async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitedError(30));

    const res = await POST(formRequest({ "x-forwarded-for": "203.0.113.7" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("does not limit when the IP is unknown (no shared bucket)", async () => {
    await POST(formRequest());

    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
    expect(mockResetPassword).toHaveBeenCalled();
  });
});
