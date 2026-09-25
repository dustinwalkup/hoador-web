import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, ConflictError, ValidationError } from "@/dal/errors";

/**
 * The route delegates every authz/state check to `ServiceBookingService`
 * and maps its throw via `handleApiError`; this file exercises the route's
 * own wiring (auth gate, arg-passing, response shape), not the service's
 * business logic, which is unit-tested next to itself.
 */

const mockGetCurrentUserId = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: (...a: unknown[]) => mockGetCurrentUserId(...a),
  getAuthenticatedUser: async () => {
    const id = await mockGetCurrentUserId();
    return id
      ? {
          user: {
            id,
            status: "active",
            emailVerified: true,
            userType: "standard",
            stripeCustomerId: null,
          },
          userId: id,
          isAdmin: false,
        }
      : null;
  },
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockAcceptBooking = vi.fn();
vi.mock("@/features/services/services/service-booking-service", () => ({
  ServiceBookingService: {
    acceptBooking: (...a: unknown[]) => mockAcceptBooking(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const params = () => ({ params: Promise.resolve({ id: "booking-1" }) });
const req = () =>
  new NextRequest("http://localhost/api/services/bookings/booking-1/accept", {
    method: "POST",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetCurrentUserId.mockResolvedValue("provider-1");
});

describe("POST .../bookings/[id]/accept", () => {
  it("401s when unauthenticated, without calling the service", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await POST(req(), params());

    expect(res.status).toBe(401);
    expect(mockAcceptBooking).not.toHaveBeenCalled();
  });

  it("403s a non-provider caller", async () => {
    mockAcceptBooking.mockRejectedValue(
      new ForbiddenError("You are not the provider for this booking"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
  });

  it("409s a booking already mid-charge", async () => {
    mockAcceptBooking.mockRejectedValue(
      new ConflictError("This booking is already being processed"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(409);
  });

  it("400s an invalid accept (e.g. missing payment method)", async () => {
    mockAcceptBooking.mockRejectedValue(
      new ValidationError("A payment method is required to accept"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(400);
  });

  it("200s and passes the route's own args through to the service", async () => {
    mockAcceptBooking.mockResolvedValue({
      id: "booking-1",
      status: "accepted",
    });

    const res = await POST(req(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "accepted" });
    expect(mockAcceptBooking).toHaveBeenCalledWith(
      "booking-1",
      "provider-1",
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
