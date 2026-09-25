import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, ConflictError, ValidationError } from "@/dal/errors";

/**
 * The route parses `declineServiceBookingSchema` (reason required) before
 * delegating to `ServiceBookingService.declineBooking`, which owns every
 * authz/state check; this file exercises the route's own wiring.
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

const mockDeclineBooking = vi.fn();
vi.mock("@/features/services/services/service-booking-service", () => ({
  ServiceBookingService: {
    declineBooking: (...a: unknown[]) => mockDeclineBooking(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const params = () => ({ params: Promise.resolve({ id: "booking-1" }) });
const req = (body: unknown = { reason: "Double-booked" }) =>
  new NextRequest("http://localhost/api/services/bookings/booking-1/decline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetCurrentUserId.mockResolvedValue("provider-1");
});

describe("POST .../bookings/[id]/decline", () => {
  it("401s when unauthenticated, without parsing the body or calling the service", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await POST(req(), params());

    expect(res.status).toBe(401);
    expect(mockDeclineBooking).not.toHaveBeenCalled();
  });

  it("400s a missing reason, without calling the service", async () => {
    const res = await POST(req({}), params());

    expect(res.status).toBe(400);
    expect(mockDeclineBooking).not.toHaveBeenCalled();
  });

  it("403s a non-provider caller", async () => {
    mockDeclineBooking.mockRejectedValue(
      new ForbiddenError("You are not the provider for this booking"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
  });

  it("409s a booking whose state changed underneath the caller", async () => {
    mockDeclineBooking.mockRejectedValue(
      new ConflictError("This booking is no longer pending"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(409);
  });

  it("400s a booking that was never pending", async () => {
    mockDeclineBooking.mockRejectedValue(
      new ValidationError("Only pending bookings can be declined"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(400);
  });

  it("200s and passes the route's own args through to the service", async () => {
    mockDeclineBooking.mockResolvedValue({
      id: "booking-1",
      status: "declined",
    });

    const res = await POST(req({ reason: "Double-booked" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "declined" });
    expect(mockDeclineBooking).toHaveBeenCalledWith(
      "booking-1",
      "provider-1",
      "Double-booked",
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
