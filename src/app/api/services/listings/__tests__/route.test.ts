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

const mockRequireAuthResponse = vi.fn();
const mockGetCurrentUserId = vi.fn();
const mockParseFormData = vi.fn();

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
  requireAuthResponse: (...args: unknown[]) => mockRequireAuthResponse(...args),
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
  getClientIP: vi.fn().mockReturnValue(null),
  getUserAgent: vi.fn().mockReturnValue(null),
  parseFormData: (...args: unknown[]) => mockParseFormData(...args),
}));

const mockServiceListingCreate = vi.fn();
vi.mock("@/features/services/services/service-listing-service", () => ({
  ServiceListingService: {
    createListing: (...args: unknown[]) => mockServiceListingCreate(...args),
  },
}));

import { GET, POST } from "../route";

const VALID_SERVICE_BODY = {
  communityId: "00000000-0000-4000-a000-000000000001",
  categoryId: "00000000-0000-4000-a000-000000000002",
  title: "Dog walking",
  description: "I walk dogs",
  pricingType: "hourly",
  price: 10,
  ownerPoliciesAcknowledged: true,
};

const MOCK_SERVICE_LISTING = {
  id: "listing-svc-1",
  status: "pending_approval",
};

describe("GET /api/services/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockGetVisibleCommunityIds.mockResolvedValue(["comm-1", "comm-2"]);
  });

  it("returns 401 when requireAuthResponse rejects", async () => {
    mockRequireAuthResponse.mockResolvedValue(
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

// =============================================================================
// POST /api/services/listings
// =============================================================================

describe("POST /api/services/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockParseFormData.mockResolvedValue(VALID_SERVICE_BODY);
    mockGetMembership.mockResolvedValue({
      community: { id: VALID_SERVICE_BODY.communityId },
    });
    mockServiceListingCreate.mockResolvedValue({
      listing: MOCK_SERVICE_LISTING,
    });
  });

  function postReq(body: unknown = VALID_SERVICE_BODY) {
    return new NextRequest("http://localhost:3000/api/services/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(postReq());

    expect(res.status).toBe(401);
    expect(mockServiceListingCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    mockParseFormData.mockResolvedValue({});

    const res = await POST(postReq({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(mockServiceListingCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when communityId does not match membership", async () => {
    mockGetMembership.mockResolvedValue({
      community: { id: "different-community" },
    });

    const res = await POST(postReq());

    expect(res.status).toBe(400);
    expect(mockServiceListingCreate).not.toHaveBeenCalled();
  });

  it("returns 200 with listingId and status on success", async () => {
    const res = await POST(postReq());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.listingId).toBe("listing-svc-1");
    expect(json.status).toBe("pending_approval");
    expect(mockServiceListingCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Dog walking" }),
      "user-1",
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });

  it("passes neighborhoodNeedId through to ServiceListingService when provided", async () => {
    const bodyWithNeedId = {
      ...VALID_SERVICE_BODY,
      neighborhoodNeedId: "00000000-0000-4000-a000-000000000099",
    };
    mockParseFormData.mockResolvedValue(bodyWithNeedId);

    const res = await POST(postReq(bodyWithNeedId));

    expect(res.status).toBe(200);
    expect(mockServiceListingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        neighborhoodNeedId: "00000000-0000-4000-a000-000000000099",
      }),
      "user-1",
      expect.any(Object),
    );
  });

  it("omits neighborhoodNeedId from parsed data when not provided", async () => {
    await POST(postReq());

    const calledWith = mockServiceListingCreate.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(calledWith.neighborhoodNeedId).toBeUndefined();
  });
});
