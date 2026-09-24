import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-5)
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetDeletionBlockers = vi.fn();
vi.mock("@/features/users/services/account-deletion-service", () => ({
  getDeletionBlockers: (...a: unknown[]) => mockGetDeletionBlockers(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const REQ = new NextRequest("http://localhost/api/users/me/deletion-blockers");

import { GET } from "../route";

describe("GET /api/users/me/deletion-blockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
      isAdmin: false,
    });
    mockGetDeletionBlockers.mockResolvedValue([]);
  });

  it("returns the caller's blockers in the DELETE 409's shape", async () => {
    const blockers = [
      { type: "open_disputes" as const, count: 1, message: "1 open dispute." },
      { type: "active_rentals" as const, count: 2, message: "2 rentals." },
    ];
    mockGetDeletionBlockers.mockResolvedValue(blockers);

    const res = await GET(REQ);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blockers });
    expect(mockGetDeletionBlockers).toHaveBeenCalledWith("user-1");
  });

  it("returns an empty list when deletion is clear", async () => {
    const res = await GET(REQ);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blockers: [] });
  });

  it("is never cached by a shared cache", async () => {
    const res = await GET(REQ);

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await GET(REQ);

    expect(res.status).toBe(401);
    expect(mockGetDeletionBlockers).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected failure", async () => {
    mockGetDeletionBlockers.mockRejectedValue(new Error("db exploded"));

    const res = await GET(REQ);

    expect(res.status).toBe(500);
  });
});
