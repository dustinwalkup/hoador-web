import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * PRIV-04: the lifecycle is the provider's payout record. The requester used
 * to get it too, with the platform's Stripe charge and transfer ids.
 */

const mockGetCurrentUserId = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: async () => {
    const userId = await mockGetCurrentUserId();
    return userId
      ? { user: { id: userId, status: "active" }, userId, isAdmin: false }
      : null;
  },
  getCurrentUserId: () => mockGetCurrentUserId(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const mockGetById = vi.fn();
const mockGetLifecycle = vi.fn();
vi.mock("@/dal", () => ({
  serviceBookingDAL: { getById: (...a: unknown[]) => mockGetById(...a) },
  servicePaymentLifecycleDAL: {
    getByBookingId: (...a: unknown[]) => mockGetLifecycle(...a),
  },
}));

const get = () =>
  new NextRequest(
    "http://localhost/api/services/bookings/book-1/payment-lifecycle",
  );
const params = () => ({ params: Promise.resolve({ id: "book-1" }) });

describe("GET /api/services/bookings/[id]/payment-lifecycle (PRIV-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetById.mockResolvedValue({
      id: "book-1",
      requesterId: "req-1",
      providerId: "prov-1",
    });
    mockGetLifecycle.mockResolvedValue({
      id: "spl-1",
      bookingId: "book-1",
      chargeId: "ch_secret",
      providerPayout: "45.00",
      ownerTransferStatus: "completed",
      payoutStatus: "completed",
      stripeTransferId: "tr_secret",
      ownerTransferredAt: null,
      transferAmount: "45.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("403s the requester and never reads the lifecycle", async () => {
    mockGetCurrentUserId.mockResolvedValue("req-1");

    const { GET } = await import("../route");
    const res = await GET(get(), params());

    expect(res.status).toBe(403);
    expect(mockGetLifecycle).not.toHaveBeenCalled();
  });

  it("gives the provider the payout state without Stripe ids", async () => {
    mockGetCurrentUserId.mockResolvedValue("prov-1");

    const { GET } = await import("../route");
    const res = await GET(get(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).not.toHaveProperty("chargeId");
    expect(body).not.toHaveProperty("stripeTransferId");
    expect(body).toMatchObject({
      providerPayout: "45.00",
      payoutStatus: "completed",
    });
  });

  it("403s a stranger", async () => {
    mockGetCurrentUserId.mockResolvedValue("someone-else");

    const { GET } = await import("../route");
    const res = await GET(get(), params());

    expect(res.status).toBe(403);
  });

  it("401s an unauthenticated caller and never reads the booking", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(get(), params());

    expect(res.status).toBe(401);
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it("404s when the booking doesn't exist and never reads the lifecycle", async () => {
    mockGetCurrentUserId.mockResolvedValue("prov-1");
    mockGetById.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(get(), params());

    expect(res.status).toBe(404);
    expect(mockGetLifecycle).not.toHaveBeenCalled();
  });

  it("404s when the provider's booking has no lifecycle row", async () => {
    mockGetCurrentUserId.mockResolvedValue("prov-1");
    mockGetLifecycle.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(get(), params());

    expect(res.status).toBe(404);
  });
});
