import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Per CLAUDE.md: route tests mock the SESSION module, so the route's real auth
// path is exercised rather than stubbed.
const mockGetCurrentUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetCurrentUser();
    return user ? { user, userId: user.id, isAdmin: false } : null;
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockListCategories = vi.fn();
vi.mock("@/dal", () => ({
  serviceListingDAL: {
    listCategories: (...a: any[]) => mockListCategories(...a),
  },
}));

const req = () => new NextRequest("http://localhost/api/services/categories");

describe("GET /api/services/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockListCategories.mockResolvedValue([
      { id: "c1", name: "Lawn care", description: "Mowing and edging" },
      { id: "c2", name: "Handyman", description: null },
    ]);
  });

  it("returns 401 when not authenticated and touches no data", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockListCategories).not.toHaveBeenCalled();
  });

  it("returns the categories for an authenticated user", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([
      { id: "c1", name: "Lawn care", description: "Mowing and edging" },
      { id: "c2", name: "Handyman", description: null },
    ]);
  });

  it("maps a DAL failure through handleApiError rather than throwing", async () => {
    mockListCategories.mockRejectedValue(new Error("db down"));

    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
