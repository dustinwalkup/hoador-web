import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Per CLAUDE.md: mock the SESSION module so the route's real auth path runs.
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
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const mockGetUnreadMessageCount = vi.fn();
vi.mock("@/dal", () => ({
  messagesDAL: {
    getUnreadMessageCount: (...a: unknown[]) => mockGetUnreadMessageCount(...a),
  },
}));

const req = () => new NextRequest("http://localhost/api/messages/unread-count");

describe("GET /api/messages/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockGetUnreadMessageCount.mockResolvedValue(3);
  });

  it("401s an unauthenticated caller and reads nothing", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockGetUnreadMessageCount).not.toHaveBeenCalled();
  });

  // ARCH-05: the DAL error goes through handleApiError, never back verbatim.
  it("500s a DAL failure with the generic message, not the raw one", async () => {
    mockGetUnreadMessageCount.mockRejectedValue(new Error("boom"));

    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("An unexpected error occurred");
    expect(JSON.stringify(body)).not.toContain("boom");
  });

  it("200s with the caller's unread count", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 3 });
    expect(mockGetUnreadMessageCount).toHaveBeenCalledWith("user-1");
  });
});
