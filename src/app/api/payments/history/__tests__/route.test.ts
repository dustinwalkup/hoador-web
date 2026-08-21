import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 12.2.1, 12.2.2, 14.1.4, 14.1.5
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
 *       § P-E7-2 (D-E7-10, D-P2, D-P3, D-P6)
 *
 * Row shaping (deposit absent for services, refunds as their own fields, status
 * round-trips) is covered in `features/payments/lib/__tests__/payment-history.test.ts`.
 * These cover the route: auth, pagination, scoping and serialization.
 */

const mockGetUserPaymentHistory = vi.fn();
vi.mock("@/dal", () => ({
  paymentDAL: {
    getUserPaymentHistory: (...a: unknown[]) => mockGetUserPaymentHistory(...a),
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
  counterpartyName: "Dana Owner",
  date: "2026-08-01T12:00:00.000Z",
  amount: "80.00",
  status: "succeeded",
  refundAmount: null,
  refundedAt: null,
  refundReason: null,
  depositHoldStatus: "held",
};

const SERVICE_ITEM = {
  kind: "service",
  id: "pay-2",
  bookingId: "booking-1",
  title: "Lawn Mowing",
  counterpartyName: "Pat Provider",
  date: "2026-08-02T12:00:00.000Z",
  amount: "60.00",
  status: "succeeded",
  refundAmount: null,
  refundedAt: null,
  refundReason: null,
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
  return new NextRequest(`http://localhost:3000/api/payments/history${query}`);
}

function signedInAs(userId: string) {
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: userId, email: "renter@example.com" },
    userId,
    isAdmin: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/payments/history — auth", () => {
  it("401s when signed out", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockGetUserPaymentHistory).not.toHaveBeenCalled();
  });

  it("scopes the query to the caller and ignores a supplied userId", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(page([]));

    await GET(request("?userId=someone-else"));

    expect(mockGetUserPaymentHistory).toHaveBeenCalledWith(
      "renter-1",
      expect.any(Object),
    );
  });
});

describe("GET /api/payments/history — response", () => {
  it("returns a service-only payer's charges", async () => {
    // The F2 regression guard at the route level: someone who has only ever
    // booked services gets rows, where the web's own history shows nothing.
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(page([SERVICE_ITEM]));

    const body = await (await GET(request())).json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].kind).toBe("service");
  });

  it("returns rentals and services together", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(
      page([RENTAL_ITEM, SERVICE_ITEM]),
    );

    const body = await (await GET(request())).json();

    expect(body.data.map((i: { kind: string }) => i.kind)).toEqual([
      "rental",
      "service",
    ]);
  });

  it("keeps depositHoldStatus off a service row through serialization", async () => {
    // JSON.stringify drops undefined, so absence survives the wire — asserted
    // rather than assumed, because it is what tells the app "no deposit here".
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(
      page([RENTAL_ITEM, SERVICE_ITEM]),
    );

    const body = await (await GET(request())).json();

    expect(body.data[0].depositHoldStatus).toBe("held");
    expect("depositHoldStatus" in body.data[1]).toBe(false);
  });

  it("never leaks a counterparty email", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(
      page([RENTAL_ITEM, SERVICE_ITEM]),
    );

    const raw = await (await GET(request())).text();

    expect(raw).not.toContain("@");
    expect(raw).not.toContain("email");
  });

  it("returns an empty page rather than 404 for a payer with no charges", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(
      page([], { total: 0, totalPages: 0 }),
    );

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });
});

describe("GET /api/payments/history — pagination", () => {
  it("defaults to page 1, limit 20", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(page([]));

    await GET(request());

    expect(mockGetUserPaymentHistory).toHaveBeenCalledWith("renter-1", {
      page: 1,
      limit: 20,
    });
  });

  it("passes through valid page and limit", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockResolvedValue(page([]));

    await GET(request("?page=2&limit=50"));

    expect(mockGetUserPaymentHistory).toHaveBeenCalledWith("renter-1", {
      page: 2,
      limit: 50,
    });
  });

  it.each(["?limit=101", "?page=0", "?limit=abc"])(
    "400s on %s",
    async (query) => {
      signedInAs("renter-1");

      const response = await GET(request(query));

      expect(response.status).toBe(400);
      expect(mockGetUserPaymentHistory).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/payments/history — failures", () => {
  it("does not swallow a DAL failure into an empty list", async () => {
    signedInAs("renter-1");
    mockGetUserPaymentHistory.mockRejectedValue(new Error("db down"));

    const response = await GET(request());

    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});
