import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockVerifiedUser } from "@/test/fixtures/auth";
import type { UserProfile } from "@/dal/types";

// Mock session utilities used by the proxy.
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/features/auth/utils/admin-session", () => ({
  getAdminUser: vi.fn(),
}));

import { proxy } from "../proxy";
import { getCurrentUser } from "@/features/auth/utils/session";

const makeRequest = (pathname: string) =>
  new NextRequest(new URL(pathname, "https://app.hoador.com"));

const isNextResponse = (res: Response) =>
  res.headers.get("x-middleware-next") === "1";

const redirectLocation = (res: Response) => {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
};

const emailVerifiedUser: UserProfile = {
  ...mockVerifiedUser,
  status: "email_verified",
};

describe("proxy.ts — community-select routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("email_verified users", () => {
    it("redirects to /community-select from an unrelated page", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(emailVerifiedUser);

      const res = await proxy(makeRequest("/listings"));

      expect(redirectLocation(res)).toBe("/community-select");
    });

    it("allows /community-select (canonical destination)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(emailVerifiedUser);

      const res = await proxy(makeRequest("/community-select"));

      expect(isNextResponse(res)).toBe(true);
    });

    it("allows /join-code (legacy invite-code flow stays live — R1.5)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(emailVerifiedUser);

      const res = await proxy(makeRequest("/join-code"));

      expect(isNextResponse(res)).toBe(true);
    });

    it("allows /dashboard through so the dashboard layout can redirect", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(emailVerifiedUser);

      const res = await proxy(makeRequest("/dashboard"));

      expect(isNextResponse(res)).toBe(true);
    });

    it("does not redirect API calls — /api/communities passes through", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(emailVerifiedUser);

      const res = await proxy(
        makeRequest("/api/communities?networkSlug=kansas-city-metro"),
      );

      expect(isNextResponse(res)).toBe(true);
    });
  });

  describe("/community-select route protection", () => {
    it("redirects unauthenticated users to /login", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const res = await proxy(makeRequest("/community-select"));

      expect(redirectLocation(res)).toBe("/login");
    });

    it("redirects fully-active users away to /dashboard (auth route)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockVerifiedUser);

      const res = await proxy(makeRequest("/community-select"));

      expect(redirectLocation(res)).toBe("/dashboard");
    });
  });
});

/**
 * Refusing an unauthenticated request: PAGES redirect to /login, APIs 401.
 *
 * Redirecting an `/api/*` request to the login page hands the caller HTML with
 * status 200 — `res.ok` is true and `res.json()` throws — so neither the web
 * query layer nor the mobile client can tell an expired session from a parse
 * bug. These tests pin the distinction so it can't silently regress.
 */
describe("proxy.ts — unauthenticated refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(null);
  });

  it.each([
    "/api/listings/abc-123",
    "/api/listings/search",
    "/api/rentals/r-1",
    "/api/messages/conversations",
    "/api/garage/active",
  ])("401s (not redirects) for %s", async (pathname) => {
    const res = await proxy(makeRequest(pathname));

    expect(res.status).toBe(401);
    expect(redirectLocation(res)).toBeNull();
    await expect(res.json()).resolves.toHaveProperty("error");
  });

  it("still redirects protected PAGES to /login with a callback", async () => {
    const res = await proxy(makeRequest("/dashboard"));

    expect(redirectLocation(res)).toBe("/login");
    expect(res.headers.get("location")).toContain("callbackUrl");
  });

  it("leaves unprotected API routes alone (they 401 at the route level)", async () => {
    const res = await proxy(makeRequest("/api/communities"));

    expect(isNextResponse(res)).toBe(true);
  });

  it("401s an API route when the auth check itself throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockRejectedValue(
      new Error("session store down"),
    );

    const res = await proxy(makeRequest("/api/listings/abc-123"));

    expect(res.status).toBe(401);
    consoleError.mockRestore();
  });

  it("still redirects a protected PAGE when the auth check throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockRejectedValue(
      new Error("session store down"),
    );

    const res = await proxy(makeRequest("/dashboard"));

    expect(redirectLocation(res)).toBe("/login");
    consoleError.mockRestore();
  });
});
