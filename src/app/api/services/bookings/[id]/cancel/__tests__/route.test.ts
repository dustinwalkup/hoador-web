import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, ConflictError, ValidationError } from "@/dal/errors";

/**
 * The route parses `cancelServiceBookingSchema` (reason optional) before
 * delegating to `ServiceBookingService.cancelBooking`, which owns every
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

const mockCancelBooking = vi.fn();
vi.mock("@/features/services/services/service-booking-service", () => ({
  ServiceBookingService: {
    cancelBooking: (...a: unknown[]) => mockCancelBooking(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const params = () => ({ params: Promise.resolve({ id: "booking-1" }) });
const req = (body: unknown = {}) =>
  new NextRequest("http://localhost/api/services/bookings/booking-1/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetCurrentUserId.mockResolvedValue("requester-1");
});

describe("POST .../bookings/[id]/cancel", () => {
  it("401s when unauthenticated, without parsing the body or calling the service", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await POST(req(), params());

    expect(res.status).toBe(401);
    expect(mockCancelBooking).not.toHaveBeenCalled();
  });

  it("400s a reason of the wrong type, without calling the service", async () => {
    // `reason` is optional, so an omitted one is valid; a wrong-typed one is
    // the schema failure available to exercise here.
    const res = await POST(req({ reason: 12345 }), params());

    expect(res.status).toBe(400);
    expect(mockCancelBooking).not.toHaveBeenCalled();
  });

  it("403s a stranger to the booking", async () => {
    mockCancelBooking.mockRejectedValue(
      new ForbiddenError("You are not a party to this booking"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
  });

  it("409s a booking with an active dispute", async () => {
    mockCancelBooking.mockRejectedValue(
      new ConflictError("Cannot cancel a booking with an active dispute"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(409);
  });

  it("400s a booking that is no longer cancellable", async () => {
    mockCancelBooking.mockRejectedValue(
      new ValidationError("This booking can no longer be cancelled"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(400);
  });

  it("200s and passes the route's own args through to the service", async () => {
    mockCancelBooking.mockResolvedValue({
      id: "booking-1",
      status: "cancelled",
      refundAmount: "50.00",
    });

    const res = await POST(req({ reason: "Change of plans" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "cancelled", refundAmount: "50.00" });
    expect(mockCancelBooking).toHaveBeenCalledWith(
      "booking-1",
      "requester-1",
      "Change of plans",
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });

  it("omits the reason arg (undefined) when none was given", async () => {
    mockCancelBooking.mockResolvedValue({
      id: "booking-1",
      status: "cancelled",
      refundAmount: "0.00",
    });

    await POST(req({}), params());

    expect(mockCancelBooking).toHaveBeenCalledWith(
      "booking-1",
      "requester-1",
      undefined,
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
