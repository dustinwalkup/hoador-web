import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronSecret } from "../verify-cron-secret";

function createRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return new NextRequest("http://localhost:3000/api/cron/test", {
    method: "GET",
    headers,
  });
}

describe("verifyCronSecret", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns unauthorized (401) when no auth header is provided", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const result = verifyCronSecret(createRequest());

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns unauthorized (401) when wrong secret is provided", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const result = verifyCronSecret(createRequest("Bearer wrong-secret"));

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns server error (500) when CRON_SECRET env is not configured", () => {
    delete process.env.CRON_SECRET;
    const result = verifyCronSecret(createRequest("Bearer anything"));

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(500);
    }
  });

  it("returns authorized when secret matches", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const result = verifyCronSecret(createRequest("Bearer test-secret"));

    expect(result.authorized).toBe(true);
  });
});
