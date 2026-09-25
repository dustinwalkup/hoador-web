import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

vi.mock("@/lib/api/route-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/route-helpers")>();
  return {
    ...actual,
    parseFormData: vi.fn().mockResolvedValue({ email: "user@example.com" }),
  };
});

const mockEnforceRateLimit = vi.fn();
vi.mock("@/lib/api/rate-limit", () => ({
  enforceRateLimit: (...a: unknown[]) => mockEnforceRateLimit(...a),
}));

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
    },
  },
}));

import { auth } from "@/services/better-auth";
import { RateLimitedError } from "@/dal/errors";

function formRequest(
  body: Record<string, string>,
  headers: Record<string, string> = {},
) {
  const form = new URLSearchParams(body);
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: form.toString(),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  // SEC-04: `auth.api.*` never reaches better-auth's own limiter, so the
  // route limits per IP and per (lowercased) email before any email is sent.
  it("limits per IP and per email before requesting the reset", async () => {
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof auth.api.requestPasswordReset>>,
    );

    await POST(
      formRequest(
        { email: "user@example.com" },
        { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
      ),
    );

    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:forgot-password:ip:203.0.113.7",
      10,
      900,
    );
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:forgot-password:email:user@example.com",
      3,
      900,
    );
  });

  it("returns 429 with Retry-After and sends nothing once limited", async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitedError(120));

    const res = await POST(formRequest({ email: "user@example.com" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    await expect(res.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });
    expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
  });

  // Never a shared "unknown" bucket: one would lock out every caller at once.
  it("skips the IP limit when the IP is unknown, keeping the email limit", async () => {
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValue(
      {} as Awaited<ReturnType<typeof auth.api.requestPasswordReset>>,
    );

    await POST(formRequest({ email: "user@example.com" }));

    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      "auth:forgot-password:email:user@example.com",
      3,
      900,
    );
  });

  it("returns 429 and user message when Better Auth returns rate limit error", async () => {
    vi.mocked(auth.api.requestPasswordReset).mockRejectedValue(
      new Error("Rate limit exceeded. Please wait."),
    );

    const res = await POST(formRequest({ email: "user@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/wait before requesting another/i);
  });
});
