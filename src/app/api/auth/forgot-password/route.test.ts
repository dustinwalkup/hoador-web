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

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
    },
  },
}));

import { auth } from "@/services/better-auth";

function formRequest(body: Record<string, string>) {
  const form = new URLSearchParams(body);
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
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
