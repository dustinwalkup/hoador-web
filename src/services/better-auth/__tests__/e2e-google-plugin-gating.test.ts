import { describe, it, expect, vi, afterEach } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

/**
 * SEC-17: GET /api/auth/e2e-callback signs in as ANY email. It used to be gated
 * on E2E_TEST alone, so one stray env var in a real deployment would have been
 * a sign-in-as-anyone endpoint. Now production never serves it, twice over:
 * the plugin isn't registered, and the endpoint refuses on its own.
 *
 * Asserted against the REAL configuration, database swapped for memory.
 */

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

// The stub reads the user's status straight from the app DB for its redirect.
vi.mock("@/db/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ status: "active" }] }),
      }),
    }),
  },
}));

vi.mock("@/services/resend/send-verification-email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { buildAuthOptions } from "../build-auth-options";

const build = () =>
  betterAuth(
    buildAuthOptions({
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
      }),
    }),
  );

const callback = () =>
  new Request(
    "http://localhost:3001/api/auth/e2e-callback?e2e_user=x@e2e.test",
  );

describe("e2e sign-in stub gating (SEC-17)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("404s in production even with E2E_TEST=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST", "1");

    const response = await build().handler(callback());

    expect(response.status).toBe(404);
  });

  // Belt and braces: if the plugin were registered anyway (built outside
  // production, then served in it), the endpoint still refuses.
  it("the endpoint itself refuses when NODE_ENV is production", async () => {
    vi.stubEnv("E2E_TEST", "1");
    const auth = build();
    vi.stubEnv("NODE_ENV", "production");

    const response = await auth.handler(callback());

    expect(response.status).toBe(404);
  });

  it("404s outside production without E2E_TEST", async () => {
    vi.stubEnv("E2E_TEST", "");

    const response = await build().handler(callback());

    expect(response.status).toBe(404);
  });

  it("still signs in for the e2e suite (non-production, E2E_TEST=1)", async () => {
    vi.stubEnv("E2E_TEST", "1");

    const response = await build().handler(callback());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/dashboard",
    );
    expect(response.headers.get("set-cookie")).toMatch(
      /better-auth\.session_token=/,
    );
  });
});
