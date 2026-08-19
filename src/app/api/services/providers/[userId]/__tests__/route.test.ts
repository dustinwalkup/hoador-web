import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetVisibleCommunityIds = vi.fn();
const mockFindByProvider = vi.fn();
const mockGetUserById = vi.fn();
const mockGetAggregate = vi.fn();
const mockFindReleasedByReviewee = vi.fn();

vi.mock("@/dal", () => ({
  communityDAL: {
    getVisibleCommunityIds: (...args: unknown[]) =>
      mockGetVisibleCommunityIds(...args),
  },
  serviceListingDAL: {
    findByProvider: (...args: unknown[]) => mockFindByProvider(...args),
  },
  userDAL: {
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
  },
  blindReviewDAL: {
    getAggregate: (...args: unknown[]) => mockGetAggregate(...args),
    findReleasedByReviewee: (...args: unknown[]) =>
      mockFindReleasedByReviewee(...args),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: async <T>(promise: Promise<T>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
  requireAuthResponse: vi.fn(),
  getCurrentUserId: vi.fn(),
  parseFormData: vi.fn(),
}));

import { GET } from "../route";

const reqFor = (userId = "provider-1") =>
  new NextRequest(`http://localhost:3000/api/services/providers/${userId}`);
const paramsFor = (userId = "provider-1") => ({
  params: Promise.resolve({ userId }),
});

const profileUser = {
  id: "provider-1",
  firstName: "Pat",
  lastName: "Provider",
  profileImageUrl: null,
  createdAt: new Date("2024-01-01"),
  bio: "hi",
};

const listingIn = (id: string, communityId: string) => ({
  id,
  providerId: "provider-1",
  communityId,
  title: id,
  status: "active" as const,
});

describe("GET /api/services/providers/[userId]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuthResponse, getCurrentUserId } =
      await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(null);
    vi.mocked(getCurrentUserId).mockResolvedValue("viewer-1");
    mockGetUserById.mockResolvedValue(profileUser);
    mockGetAggregate.mockResolvedValue({ averageRating: 0, totalReviews: 0 });
    mockFindReleasedByReviewee.mockResolvedValue({ data: [] });
    mockFindByProvider.mockResolvedValue([
      listingIn("l-shared", "comm-shared"),
      listingIn("l-private", "comm-provider-only"),
      { ...listingIn("l-inactive", "comm-shared"), status: "inactive" },
    ]);
    // viewer is visible in comm-shared + comm-viewer-only; provider in comm-shared + comm-provider-only
    mockGetVisibleCommunityIds.mockImplementation(async (userId: string) =>
      userId === "viewer-1"
        ? ["comm-shared", "comm-viewer-only"]
        : ["comm-shared", "comm-provider-only"],
    );
  });

  it("returns 401 when requireAuthResponse blocks", async () => {
    const { requireAuthResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(reqFor(), paramsFor());
    expect(res.status).toBe(401);
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("returns 403 when the viewer and provider share no community where both are visible", async () => {
    mockGetVisibleCommunityIds.mockImplementation(async (userId: string) =>
      userId === "viewer-1" ? ["comm-viewer-only"] : ["comm-provider-only"],
    );

    const res = await GET(reqFor(), paramsFor());
    expect(res.status).toBe(403);
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user does not exist", async () => {
    mockGetUserById.mockResolvedValue(null);

    const res = await GET(reqFor(), paramsFor());
    expect(res.status).toBe(404);
  });

  it("returns the profile with active listings scoped to the shared visible communities", async () => {
    const res = await GET(reqFor(), paramsFor());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("provider-1");
    expect(body.activeListings.map((l: { id: string }) => l.id)).toEqual([
      "l-shared",
    ]);
  });

  // Mobile Req 6.2.3 requires the provider profile to show a bio. `profile` was
  // hard-coded `null` here, so the bio this route's own PATCH writes could not
  // be read back by anyone.
  it("returns the provider's bio", async () => {
    const res = await GET(reqFor(), paramsFor());
    const body = await res.json();

    expect(body.profile).toEqual({ bio: "hi" });
  });

  it("returns bio: null (not a dropped field) when the provider has no bio", async () => {
    mockGetUserById.mockResolvedValue({ ...profileUser, bio: null });

    const res = await GET(reqFor(), paramsFor());
    const body = await res.json();

    expect(body.profile).toEqual({ bio: null });
  });

  it("returns all active listings (no community filter) when the viewer is the provider", async () => {
    const { getCurrentUserId } = await import("@/lib/api/route-helpers");
    vi.mocked(getCurrentUserId).mockResolvedValue("provider-1");

    const res = await GET(reqFor(), paramsFor());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeListings.map((l: { id: string }) => l.id)).toEqual([
      "l-shared",
      "l-private",
    ]);
    expect(mockGetVisibleCommunityIds).not.toHaveBeenCalled();
  });
});
