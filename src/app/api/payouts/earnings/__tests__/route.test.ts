import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 13.3.1, 13.3.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
 *       § P-E7-1 (D-E7-9, D-P1…D-P8)
 *
 * Row-shaping guarantees (money passed through, dispute link only while frozen,
 * enum drift) are covered in `features/payments/lib/__tests__/earnings.test.ts`,
 * where they are pure and provable. These cover the route: auth, pagination
 * parsing, scoping to the caller, and serialization.
 */

const mockGetUserEarnings = vi.fn();
vi.mock("@/dal", () => ({
  paymentDAL: {
    getUserEarnings: (...a: unknown[]) => mockGetUserEarnings(...a),
  },
}));

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

import { GET } from "../route";

const RENTAL_ITEM = {
  kind: "rental",
  id: "pay-1",
  bookingId: "rental-1",
  title: "Cordless Drill",
  counterpartyName: "Alex Renter",
  completedAt: "2026-08-10T17:00:00.000Z",
  gross: "100.00",
  platformFee: "20.00",
  net: "80.00",
  transferStatus: "completed",
  transferredAt: "2026-08-12T09:00:00.000Z",
  disputeId: null,
};

const SERVICE_ITEM = {
  kind: "service",
  id: "pay-2",
  bookingId: "booking-1",
  title: "Lawn Mowing",
  counterpartyName: "Sam Requester",
  completedAt: "2026-08-11T15:00:00.000Z",
  gross: "60.00",
  platformFee: "12.00",
  net: "48.00",
  transferStatus: "pending",
  transferredAt: null,
  disputeId: null,
};

function page(data: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    data,
    pagination: {
      page: 1,
      limit: 20,
      total: data.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      ...overrides,
    },
  };
}

function request(query = "") {
  return new NextRequest(`http://localhost:3000/api/payouts/earnings${query}`);
}

/**
 * `getAuthenticatedUserResponse` returns `getAuthenticatedUser()`'s result
 * verbatim, so the mock has to be the `{user, userId, isAdmin}` envelope — a
 * bare user object leaves `userId` undefined and the route silently queries for
 * nobody.
 */
function signedInAs(userId: string) {
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: userId, email: "owner@example.com" },
    userId,
    isAdmin: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/payouts/earnings — auth", () => {
  it("401s when signed out", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockGetUserEarnings).not.toHaveBeenCalled();
  });

  it("scopes the query to the caller", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([RENTAL_ITEM]));

    await GET(request());

    // The user id comes from the session, never from the query string — the
    // route offers no way to ask for someone else's earnings.
    expect(mockGetUserEarnings).toHaveBeenCalledWith(
      "owner-1",
      expect.any(Object),
    );
  });

  it("ignores a userId supplied in the query string", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([]));

    await GET(request("?userId=someone-else"));

    expect(mockGetUserEarnings).toHaveBeenCalledWith(
      "owner-1",
      expect.any(Object),
    );
  });
});

describe("GET /api/payouts/earnings — response", () => {
  it("returns rentals and services from one request", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([RENTAL_ITEM, SERVICE_ITEM]));

    const body = await (await GET(request())).json();

    expect(body.data).toHaveLength(2);
    expect(body.data.map((i: { kind: string }) => i.kind)).toEqual([
      "rental",
      "service",
    ]);
  });

  it("serializes every field the app contract pins", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([RENTAL_ITEM]));

    const body = await (await GET(request())).json();

    expect(Object.keys(body.data[0]).sort()).toEqual(
      [
        "bookingId",
        "completedAt",
        "counterpartyName",
        "disputeId",
        "gross",
        "id",
        "kind",
        "net",
        "platformFee",
        "title",
        "transferStatus",
        "transferredAt",
      ].sort(),
    );
  });

  it("never leaks a counterparty email", async () => {
    // This endpoint family has over-serialized before (dispute rows, provider
    // profiles, service detail all leaked emails). Name only, asserted.
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([RENTAL_ITEM, SERVICE_ITEM]));

    const raw = await (await GET(request())).text();

    expect(raw).not.toContain("@");
    expect(raw).not.toContain("email");
  });

  it("returns the pagination envelope the app models", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(
      page([RENTAL_ITEM], { total: 45, totalPages: 3, hasNext: true }),
    );

    const body = await (await GET(request())).json();

    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
  });

  it("returns an empty page rather than 404 for an owner with no earnings", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(
      page([], { total: 0, totalPages: 0 }),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

describe("GET /api/payouts/earnings — pagination parsing", () => {
  it("defaults to page 1, limit 20", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([]));

    await GET(request());

    expect(mockGetUserEarnings).toHaveBeenCalledWith("owner-1", {
      page: 1,
      limit: 20,
    });
  });

  it("passes through valid page and limit", async () => {
    signedInAs("owner-1");
    mockGetUserEarnings.mockResolvedValue(page([]));

    await GET(request("?page=3&limit=50"));

    expect(mockGetUserEarnings).toHaveBeenCalledWith("owner-1", {
      page: 3,
      limit: 50,
    });
  });

  it.each([
    ["?limit=101", "over the cap"],
    ["?page=0", "page below 1"],
    ["?page=-2", "negative page"],
    ["?limit=abc", "non-numeric limit"],
  ])("400s on %s (%s)", async (query) => {
    signedInAs("owner-1");

    const response = await GET(request(query));

    // A readable 400 rather than a DAL ValidationError surfacing as a 500.
    expect(response.status).toBe(400);
    expect(mockGetUserEarnings).not.toHaveBeenCalled();
  });
});

describe("GET /api/payouts/earnings — failures", () => {
  it("does not swallow a DAL failure into an empty list", async () => {
    // Deliberately no `safe()` wrapper: rendering "no earnings" to an owner who
    // has been paid is worse than an error state.
    signedInAs("owner-1");
    mockGetUserEarnings.mockRejectedValue(new Error("db down"));

    const response = await GET(request());

    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});
