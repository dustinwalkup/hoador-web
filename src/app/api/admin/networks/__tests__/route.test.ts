import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Second admin route covered by the "mock session, run real helpers" pattern.
 * GET /api/admin/networks gates on the real `requireAdminResponse()` then
 * `getAuthenticatedUserResponse()`, both backed by the session layer mocked
 * below. `requireAdmin()` calls session `requireAuth()`; the success path also
 * calls `getAuthenticatedUser()`, so both are mocked.
 */

const mockListNetworks = vi.fn();
const mockRequireAuth = vi.fn();
const mockGetAuthenticatedUser = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/dal", () => ({
  communityDAL: {
    listNetworks: (...args: unknown[]) => mockListNetworks(...args),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (...a: unknown[]) => unknown) => handler,
}));

// The handler ignores its request arg, but the wrapped GET is typed to take one.
const req = () => new NextRequest("http://localhost/api/admin/networks");

describe("GET /api/admin/networks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated admin.
    mockRequireAuth.mockResolvedValue({ id: "admin-1", userType: "admin" });
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "admin-1", userType: "admin" },
      userId: "admin-1",
      isAdmin: true,
    });
    mockListNetworks.mockResolvedValue([
      { id: "net-1", name: "Network One" },
    ]);
  });

  it("returns 401 (via the real guard) when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Authentication required"));

    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockListNetworks).not.toHaveBeenCalled();
  });

  it("returns 403 (via the real guard) for an authenticated non-admin", async () => {
    mockRequireAuth.mockResolvedValue({ id: "u1", userType: "member" });

    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Admin privileges required" });
    expect(mockListNetworks).not.toHaveBeenCalled();
  });

  it("returns 200 with the network list for an admin", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "net-1", name: "Network One" }]);
    expect(mockListNetworks).toHaveBeenCalledTimes(1);
  });
});
