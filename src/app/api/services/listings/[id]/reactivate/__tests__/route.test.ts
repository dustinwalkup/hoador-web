import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, ValidationError } from "@/dal/errors";

/**
 * The route delegates every authz/state check to `ServiceListingService`
 * and maps its throw via `handleApiError`. `reactivateListing` carries the
 * same SEC-10-shaped status guard as `deactivateListing` (only an
 * "inactive" listing can be reactivated, throwing ValidationError
 * otherwise); this file only exercises the route's own wiring.
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

const mockReactivateListing = vi.fn();
vi.mock("@/features/services/services/service-listing-service", () => ({
  ServiceListingService: {
    reactivateListing: (...a: unknown[]) => mockReactivateListing(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const params = () => ({ params: Promise.resolve({ id: "listing-1" }) });
const req = () =>
  new NextRequest(
    "http://localhost/api/services/listings/listing-1/reactivate",
    { method: "POST" },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetCurrentUserId.mockResolvedValue("provider-1");
});

describe("POST .../listings/[id]/reactivate", () => {
  it("401s when unauthenticated, without calling the service", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await POST(req(), params());

    expect(res.status).toBe(401);
    expect(mockReactivateListing).not.toHaveBeenCalled();
  });

  it("403s a caller who does not own the listing (also covers not-found)", async () => {
    mockReactivateListing.mockRejectedValue(
      new ForbiddenError("You do not own this listing"),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
  });

  it("400s a listing that is not inactive", async () => {
    mockReactivateListing.mockRejectedValue(
      new ValidationError(
        "Only inactive listings can be reactivated",
        "status",
      ),
    );

    const res = await POST(req(), params());

    expect(res.status).toBe(400);
  });

  it("200s an inactive listing, passing the route's own args through", async () => {
    mockReactivateListing.mockResolvedValue(undefined);

    const res = await POST(req(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "active" });
    expect(mockReactivateListing).toHaveBeenCalledWith(
      "listing-1",
      "provider-1",
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
