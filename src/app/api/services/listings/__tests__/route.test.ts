import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetMembership = vi.fn();
const mockFindBrowse = vi.fn();
const mockGetVisibleCommunityIds = vi.fn();

vi.mock("@/dal", () => ({
  communityDAL: {
    getMembershipForUser: (...args: unknown[]) => mockGetMembership(...args),
  },
  serviceListingDAL: {
    findByCommunityForBrowse: (...args: unknown[]) => mockFindBrowse(...args),
  },
}));

vi.mock("@/features/community/utils/membership", () => ({
  getCurrentUserVisibleCommunityIds: (...args: unknown[]) =>
    mockGetVisibleCommunityIds(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
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
  getClientIP: vi.fn().mockReturnValue(null),
  getUserAgent: vi.fn().mockReturnValue(null),
  parseFormData: vi.fn(),
}));

import { GET } from "../route";

describe("GET /api/services/listings", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuthResponse, getCurrentUserId } =
      await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(null);
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1", "comm-2"]);
  });

  it("returns 401 when requireAuthResponse rejects", async () => {
    const { requireAuthResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(
      new NextRequest("http://localhost:3000/api/services/listings"),
    );

    expect(res.status).toBe(401);
    expect(mockFindBrowse).not.toHaveBeenCalled();
  });

  it("returns active listings visible to the viewer", async () => {
    mockFindBrowse.mockResolvedValue([
      { id: "l1", title: "Plumbing", status: "active" },
    ]);

    const res = await GET(
      new NextRequest("http://localhost:3000/api/services/listings"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listings).toHaveLength(1);
    expect(mockFindBrowse).toHaveBeenCalledWith(
      ["comm-1", "comm-2"],
      expect.objectContaining({ excludeProviderId: "user-1" }),
    );
  });

  it("passes categoryId filter from query string", async () => {
    mockFindBrowse.mockResolvedValue([]);

    await GET(
      new NextRequest(
        "http://localhost:3000/api/services/listings?categoryId=123e4567-e89b-12d3-a456-426614174000",
      ),
    );

    expect(mockFindBrowse).toHaveBeenCalledWith(["comm-1", "comm-2"], {
      categoryId: "123e4567-e89b-12d3-a456-426614174000",
      excludeProviderId: "user-1",
    });
  });

  it("passes an empty visibility set straight through (fail-closed)", async () => {
    mockGetVisibleCommunityIds.mockResolvedValue([]);
    mockFindBrowse.mockResolvedValue([]);

    const res = await GET(
      new NextRequest("http://localhost:3000/api/services/listings"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listings).toEqual([]);
    expect(mockFindBrowse).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ excludeProviderId: "user-1" }),
    );
  });
});
