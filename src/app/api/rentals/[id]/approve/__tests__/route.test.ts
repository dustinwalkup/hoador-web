import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Auth + result-mapping tests for POST /api/rentals/[id]/approve.
 *
 * Pattern: mock the SESSION layer (`@/features/auth/utils/session`) and the
 * service, but run the REAL `@/lib/api/route-helpers`. This way a regression
 * that removes `requireAuthResponse()` — or breaks it — fails here, which is the
 * whole point. The sibling `../route.test.ts` covers Stripe-Connect gating with
 * the real `RentalService`; this file isolates auth and result mapping.
 */

const mockGetCurrentUserId = vi.fn();
const mockApprove = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
  getCurrentUser: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/features/rentals/services/rental-service", () => ({
  RentalService: {
    approveRentalRequest: (...args: unknown[]) => mockApprove(...args),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (...a: unknown[]) => unknown) => handler,
}));

function postApprove(id: string, body: unknown = {}) {
  return new NextRequest(`http://localhost/api/rentals/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/rentals/[id]/approve (auth + result mapping)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue("user-1");
  });

  it("returns 401 from the real helper when unauthenticated, without calling the service", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(postApprove("req-1"), ctx("req-1"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("calls the service with the authenticated user id and returns 200 on success", async () => {
    mockApprove.mockResolvedValue({
      success: true,
      paymentIntentId: "pi_123",
      securityDepositAuthId: "auth_1",
      depositHoldStatus: "held",
    });

    const { POST } = await import("../route");
    const res = await POST(postApprove("req-1"), ctx("req-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      paymentIntentId: "pi_123",
      securityDepositAuthId: "auth_1",
      depositHoldStatus: "held",
    });

    expect(mockApprove).toHaveBeenCalledTimes(1);
    const [rentalId, userId, data, meta] = mockApprove.mock.calls[0];
    expect(rentalId).toBe("req-1");
    expect(userId).toBe("user-1");
    expect(data).toEqual({});
    expect(meta).toHaveProperty("ipAddress");
    expect(meta).toHaveProperty("userAgent");
  });

  it("maps a paymentFailed service result to 400 with paymentFailed=true", async () => {
    mockApprove.mockResolvedValue({
      success: false,
      paymentFailed: true,
      error: "card declined",
    });

    const { POST } = await import("../route");
    const res = await POST(postApprove("req-1"), ctx("req-1"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.paymentFailed).toBe(true);
    expect(body.error).toContain("card declined");
  });
});
