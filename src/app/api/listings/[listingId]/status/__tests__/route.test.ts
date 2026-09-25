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
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetListingById = vi.fn();
const mockUpdateListingStatus = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: (...a: any[]) => mockGetListingById(...a),
    updateListingStatus: (...a: any[]) => mockUpdateListingStatus(...a),
  },
}));

const req = (status: string) =>
  new NextRequest("http://localhost/api/listings/l-1/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
const params = () => ({ params: Promise.resolve({ listingId: "l-1" }) });

const listing = (over: Record<string, unknown> = {}) => ({
  id: "l-1",
  status: "maintenance",
  approvalStatus: "approved",
  owner: { id: "owner-1" },
  ...over,
});

describe("PATCH /api/listings/[listingId]/status — moderation (SEC-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "owner-1", userType: "user" });
    mockGetListingById.mockResolvedValue(listing());
    mockUpdateListingStatus.mockImplementation(async (id, status) => ({
      ...listing(),
      id,
      status,
    }));
  });

  it.each(["pending_review", "rejected"])(
    "refuses available on a %s listing and never writes",
    async (approvalStatus) => {
      mockGetListingById.mockResolvedValue(listing({ approvalStatus }));

      const { PATCH } = await import("../route");
      const res = await PATCH(req("available"), params());

      expect(res.status).toBe(400);
      expect(mockUpdateListingStatus).not.toHaveBeenCalled();
    },
  );

  it("allows available once approved", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(req("available"), params());

    expect(res.status).toBe(200);
    expect(mockUpdateListingStatus).toHaveBeenCalledWith("l-1", "available");
  });

  it("still lets an unapproved listing's owner take it offline", async () => {
    mockGetListingById.mockResolvedValue(
      listing({ approvalStatus: "pending_review" }),
    );

    const { PATCH } = await import("../route");
    const res = await PATCH(req("inactive"), params());

    expect(res.status).toBe(200);
    expect(mockUpdateListingStatus).toHaveBeenCalledWith("l-1", "inactive");
  });

  it("403s a non-owner before the approval check", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "other", userType: "user" });

    const { PATCH } = await import("../route");
    const res = await PATCH(req("available"), params());

    expect(res.status).toBe(403);
    expect(mockUpdateListingStatus).not.toHaveBeenCalled();
  });
});
