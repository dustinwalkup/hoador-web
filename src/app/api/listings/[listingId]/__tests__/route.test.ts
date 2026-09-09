import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/dal/errors";
import { ListingDeletionBlockedError } from "@/features/listings/lib/listing-deletion-errors";

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
const mockGetBookedDatesForListing = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: { getListingById: (...a: any[]) => mockGetListingById(...a) },
  communityDAL: {
    isVisibleInCommunity: (...a: any[]) => mockIsVisibleInCommunity(...a),
  },
  rentalDAL: {
    getBookedDatesForListing: (...a: any[]) =>
      mockGetBookedDatesForListing(...a),
  },
}));

const mockServiceDeleteListing = vi.fn();
vi.mock("@/features/listings/services/listing-service", () => ({
  ListingService: {
    deleteListing: (...a: any[]) => mockServiceDeleteListing(...a),
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
    mockGetBookedDatesForListing.mockResolvedValue([]);
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

/**
 * Requirements: mobile Req 9.1.2
 * Design: mobile D-E8A-2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-2)
 *
 * The date step's availability data, shipped with the listing rather than as a
 * second round trip on a screen the user is waiting on.
 */
describe("GET /api/listings/[listingId] — bookedRanges (P-E8A-2)", () => {
  const localDay = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "viewer-1", userType: "user" });
    mockGetListingById.mockResolvedValue(listing());
    mockIsVisibleInCommunity.mockResolvedValue(true);
    mockGetBookedDatesForListing.mockResolvedValue([]);
  });

  it("returns booked rentals and manual blocks as zoneless day ranges", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: localDay("2026-09-10"), endDate: localDay("2026-09-14") },
      {
        startDate: localDay("2026-09-01"),
        endDate: localDay("2026-09-02"),
        reason: "Maintenance",
      },
    ]);

    const { GET } = await import("../route");
    const body = await (await GET(req(), params())).json();

    expect(body.bookedRanges).toEqual([
      { from: "2026-09-01", to: "2026-09-02", reason: "Maintenance" },
      { from: "2026-09-10", to: "2026-09-14" },
    ]);
  });

  // R-8.7 for the third time. An instant at UTC midnight greys out the previous
  // day on every device behind UTC — a picker that silently blocks the wrong day.
  it("never emits an instant", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: localDay("2026-09-10"), endDate: localDay("2026-09-14") },
    ]);

    const { GET } = await import("../route");
    const body = await (await GET(req(), params())).json();

    expect(JSON.stringify(body.bookedRanges)).not.toMatch(/[TZ]/);
  });

  it("returns an empty array when nothing is booked", async () => {
    const { GET } = await import("../route");
    const body = await (await GET(req(), params())).json();
    expect(body.bookedRanges).toEqual([]);
  });

  it("ships it to the owner too, who books around their own blocks", async () => {
    mockGetListingById.mockResolvedValue(
      listing({ owner: { id: "viewer-1" }, status: "inactive" }),
    );
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: localDay("2026-09-10"), endDate: localDay("2026-09-14") },
    ]);

    const { GET } = await import("../route");
    const body = await (await GET(req(), params())).json();

    expect(body.isOwner).toBe(true);
    expect(body.bookedRanges).toHaveLength(1);
  });

  // The listing is the point of the screen; availability is supplementary.
  it("degrades to [] rather than failing the whole listing", async () => {
    mockGetBookedDatesForListing.mockRejectedValue(new Error("db down"));

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    expect((await res.json()).bookedRanges).toEqual([]);
  });
});

// P-E10-1. The service owns the decision (tested in listing-service.test.ts);
// what this block pins is the WIRE — that a blocked delete reaches the client as
// a 409 with a stable machine-readable code and a renderable blocker list,
// rather than as prose the app would have to string-match (mobile rule #8).
describe("DELETE /api/listings/[listingId] — deletion blockers (P-E10-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "owner-1", userType: "user" });
    mockServiceDeleteListing.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated and never reaches the service", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const res = await DELETE(req(), params());

    expect(res.status).toBe(401);
    expect(mockServiceDeleteListing).not.toHaveBeenCalled();
  });

  it("deletes when nothing is in flight", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(mockServiceDeleteListing).toHaveBeenCalledWith("l-1", "owner-1");
  });

  it("maps a blocked deletion to 409 with a stable code and the blockers", async () => {
    mockServiceDeleteListing.mockRejectedValue(
      new ListingDeletionBlockedError({
        blockers: [
          {
            type: "active_rentals",
            count: 2,
            message: "This listing has 2 rentals in progress.",
          },
          {
            type: "pending_requests",
            count: 1,
            message: "This listing has 1 request awaiting your decision.",
          },
        ],
      }),
    );

    const { DELETE } = await import("../route");
    const res = await DELETE(req(), params());

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      // SCREAMING_SNAKE_CASE in `error` is what the mobile client derives
      // `ApiError.code` from — a human message never is.
      error: "LISTING_DELETION_BLOCKED",
      blockers: [
        {
          type: "active_rentals",
          count: 2,
          message: "This listing has 2 rentals in progress.",
        },
        {
          type: "pending_requests",
          count: 1,
          message: "This listing has 1 request awaiting your decision.",
        },
      ],
    });
  });

  it("still maps ownership failures to 403, not 409", async () => {
    mockServiceDeleteListing.mockRejectedValue(
      new ForbiddenError("You do not have permission to modify this listing"),
    );

    const { DELETE } = await import("../route");
    const res = await DELETE(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.not.toHaveProperty("blockers");
  });

  it("returns 400 when the listing id is missing", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(req(), {
      params: Promise.resolve({ listingId: "" }),
    });

    expect(res.status).toBe(400);
    expect(mockServiceDeleteListing).not.toHaveBeenCalled();
  });
});
