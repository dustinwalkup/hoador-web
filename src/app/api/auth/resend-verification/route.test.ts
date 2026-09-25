import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("@/lib/api/rate-limit", () => ({
  enforceRateLimit: (...a: unknown[]) => mockEnforceRateLimit(...a),
}));

const mockSendVerificationEmail = vi.fn();
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      sendVerificationEmail: (...a: unknown[]) =>
        mockSendVerificationEmail(...a),
    },
  },
}));

import { POST } from "./route";
import { RateLimitedError } from "@/dal/errors";

function formRequest(email: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/resend-verification", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({ email }).toString(),
  });
}

describe("POST /api/auth/resend-verification — rate limiting (SEC-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockSendVerificationEmail.mockResolvedValue({ status: true });
  });

  it("limits per IP and per lowercased email before sending", async () => {
    const res = await POST(
      formRequest("User@Example.com", { "x-forwarded-for": "203.0.113.7" }),
    );

    expect(res.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:resend-verification:ip:203.0.113.7",
      10,
      900,
    );
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:resend-verification:email:user@example.com",
      3,
      900,
    );
  });

  it("returns 429 with Retry-After and sends nothing once limited", async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitedError(60));

    const res = await POST(formRequest("user@example.com"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it("skips the IP limit when the IP is unknown", async () => {
    await POST(formRequest("user@example.com"));

    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
    expect(mockEnforceRateLimit.mock.calls[0][0]).toBe(
      "auth:resend-verification:email:user@example.com",
    );
  });
});
