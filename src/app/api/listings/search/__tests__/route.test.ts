import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockSearchListings = vi.fn();
const mockGetAuthenticatedUserResponse = vi.fn();
const mockGetVisibleCommunityIds = vi.fn();

vi.mock("@/dal", () => ({
  listingDAL: {
    searchListings: (...args: unknown[]) => mockSearchListings(...args),
  },
}));

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...args: unknown[]) =>
    mockGetAuthenticatedUserResponse(...args),
}));

vi.mock("@/features/community/utils/membership", () => ({
  getCurrentUserVisibleCommunityIds: (...args: unknown[]) =>
    mockGetVisibleCommunityIds(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/utils/sanitize", () => ({
  sanitizeSearchQuery: (q: string) => q,
}));

import { GET } from "../route";

const url = (qs = "") => `http://localhost:3000/api/listings/search${qs}`;

describe("GET /api/listings/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      user: {},
      userId: "user-1",
      isAdmin: false,
    });
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1", "comm-2"]);
    mockSearchListings.mockResolvedValue({
      data: [{ id: "l1" }],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(new NextRequest(url()));

    expect(res.status).toBe(401);
    expect(mockSearchListings).not.toHaveBeenCalled();
  });

  it("passes the viewer's visible community IDs to the DAL", async () => {
    const res = await GET(new NextRequest(url("?q=drill&page=2&limit=6")));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockSearchListings).toHaveBeenCalledWith(
      expect.objectContaining({ query: "drill" }),
      { page: 2, limit: 6 },
      "user-1",
      ["comm-1", "comm-2"],
      false,
    );
  });

  it("short-circuits to an empty page (no DB hit) when the visibility set is empty", async () => {
    mockGetVisibleCommunityIds.mockResolvedValue([]);

    const res = await GET(new NextRequest(url("?page=3")));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      data: [],
      pagination: {
        page: 3,
        limit: 12,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: true,
      },
    });
    expect(mockSearchListings).not.toHaveBeenCalled();
  });
});
