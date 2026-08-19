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
const mockIsVisibleInCommunity = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: { getListingById: (...a: any[]) => mockGetListingById(...a) },
  communityDAL: {
    isVisibleInCommunity: (...a: any[]) => mockIsVisibleInCommunity(...a),
  },
}));

const req = () => new NextRequest("http://localhost/api/listings/l-1");
const params = () => ({ params: Promise.resolve({ listingId: "l-1" }) });

const listing = (over: Record<string, unknown> = {}) => ({
  id: "l-1",
  name: "Pressure washer",
  communityId: "comm-1",
  status: "available",
  dailyRate: 25,
  approvalStatus: "approved",
  rejectionReason: null,
  owner: { id: "owner-1", firstName: "Pat", lastName: "Owner" },
  images: [{ id: "i1", imageUrl: "https://cdn/1.jpg", orderIndex: 0 }],
  ...over,
});

describe("GET /api/listings/[listingId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "viewer-1", userType: "user" });
    mockGetListingById.mockResolvedValue(listing());
    mockIsVisibleInCommunity.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated and reads nothing", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(401);
    expect(mockGetListingById).not.toHaveBeenCalled();
  });

  it("returns a browseable listing to a visible viewer", async () => {
    const { GET } = await import("../route");
    const res = await GET(req(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("l-1");
    expect(body.isOwner).toBe(false);
    expect(mockGetListingById).toHaveBeenCalledWith("l-1", "viewer-1");
  });

  // Mobile Req 6.1.3: the app must never display another owner's approval state.
  it("strips approvalStatus/rejectionReason for a non-owner", async () => {
    mockGetListingById.mockResolvedValue(
      listing({
        approvalStatus: "pending_review",
        rejectionReason: "Blurry photos",
      }),
    );

    const { GET } = await import("../route");
    const res = await GET(req(), params());
    const raw = await res.text();

    expect(raw).not.toContain("pending_review");
    expect(raw).not.toContain("Blurry photos");
    const body = JSON.parse(raw);
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("rejectionReason");
  });

  it("keeps moderation fields for the owner, who needs them", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "owner-1", userType: "user" });
    mockGetListingById.mockResolvedValue(
      listing({ approvalStatus: "rejected", rejectionReason: "Blurry photos" }),
    );

    const { GET } = await import("../route");
    const body = await (await GET(req(), params())).json();

    expect(body.isOwner).toBe(true);
    expect(body.approvalStatus).toBe("rejected");
    expect(body.rejectionReason).toBe("Blurry photos");
  });

  it("lets the owner view a non-browseable listing of their own", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "owner-1", userType: "user" });
    mockGetListingById.mockResolvedValue(listing({ status: "inactive" }));

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    // Owner short-circuits before any visibility lookup.
    expect(mockIsVisibleInCommunity).not.toHaveBeenCalled();
  });

  it("404s a non-browseable listing for a non-owner", async () => {
    mockGetListingById.mockResolvedValue(listing({ status: "inactive" }));

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(404);
  });

  // 404 rather than 403 throughout: a 403 would confirm a listing exists at an
  // id the caller isn't allowed to see. Mirrors the web page's notFound().
  it("404s when the VIEWER is not visible in the listing's community", async () => {
    mockIsVisibleInCommunity.mockImplementation(
      async (userId: string) => userId !== "viewer-1",
    );

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(404);
  });

  it("404s when the OWNER is not visible in the listing's community", async () => {
    mockIsVisibleInCommunity.mockImplementation(
      async (userId: string) => userId !== "owner-1",
    );

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(404);
  });

  it("404s when the listing does not exist", async () => {
    const { NotFoundError } = await import("@/dal/errors");
    mockGetListingById.mockRejectedValue(new NotFoundError("listing", "l-1"));

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(404);
  });
});
