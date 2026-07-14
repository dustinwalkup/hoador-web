import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockGetAuthenticatedUserResponse = vi.fn();
const mockHandleApiError = vi.fn();
const mockParseFormData = vi.fn();
const mockGetClientIP = vi.fn().mockReturnValue(null);
const mockGetUserAgent = vi.fn().mockReturnValue(null);

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
  handleApiError: (...a: unknown[]) => mockHandleApiError(...a),
  parseFormData: (...a: unknown[]) => mockParseFormData(...a),
  getClientIP: (...a: unknown[]) => mockGetClientIP(...a),
  getUserAgent: (...a: unknown[]) => mockGetUserAgent(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const mockCreateListing = vi.fn();
vi.mock("@/features/listings/services/listing-service", () => ({
  ListingService: {
    createListing: (...a: unknown[]) => mockCreateListing(...a),
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER = { userId: "user-1", isAdmin: false, user: {} };

const VALID_BODY = {
  name: "Power Drill",
  description: "A sturdy power drill",
  categoryId: "cat-1",
  condition: "good",
  dailyRate: 10,
  securityDeposit: 0,
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "pickup_only",
  deliveryFee: 0,
  deliveryRadius: 0,
  setupAvailable: false,
  setupFee: 0,
  specifications: {},
};

function makeReq(body: unknown = VALID_BODY) {
  return new NextRequest("http://localhost/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockHandleApiError.mockImplementation((err: unknown) => {
    const e = err as { statusCode?: number; message?: string };
    return NextResponse.json(
      { error: e.message ?? "Internal error" },
      { status: e.statusCode ?? 500 },
    );
  });
  mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_USER);
  mockParseFormData.mockResolvedValue(VALID_BODY);
  mockCreateListing.mockResolvedValue({ listingId: "listing-new" });
});

// =============================================================================
// POST /api/listings
// =============================================================================

describe("POST /api/listings", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("../route");
    const res = await POST(makeReq());

    expect(res.status).toBe(401);
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    mockParseFormData.mockResolvedValue({});

    const { POST } = await import("../route");
    const res = await POST(makeReq({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

  it("returns 400 when condition is invalid", async () => {
    mockParseFormData.mockResolvedValue({ ...VALID_BODY, condition: "broken" });

    const { POST } = await import("../route");
    const res = await POST(makeReq());

    expect(res.status).toBe(400);
    expect(mockCreateListing).not.toHaveBeenCalled();
  });

  it("returns 200 with listingId on success", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.listingId).toBe("listing-new");
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Power Drill" }),
      "user-1",
      expect.any(Object),
    );
  });

  it("passes neighborhoodNeedId through to ListingService when provided", async () => {
    const bodyWithNeedId = {
      ...VALID_BODY,
      neighborhoodNeedId: "00000000-0000-4000-a000-000000000099",
    };
    mockParseFormData.mockResolvedValue(bodyWithNeedId);

    const { POST } = await import("../route");
    const res = await POST(makeReq(bodyWithNeedId));

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        neighborhoodNeedId: "00000000-0000-4000-a000-000000000099",
      }),
      "user-1",
      expect.any(Object),
    );
  });

  it("omits neighborhoodNeedId from parsed data when not provided", async () => {
    const { POST } = await import("../route");
    await POST(makeReq());

    const calledWith = mockCreateListing.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(calledWith.neighborhoodNeedId).toBeUndefined();
  });
});
