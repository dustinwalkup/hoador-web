import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 22.1.2, 22.1.3
 * Design: 2-design.md §4.5
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.5 (D-E2-7)
 *
 * This route had no test file before (F16). The service side has no built-in
 * fallback DAL (F19), so the fallback to `per_service_agreement` is composed in
 * the route and covered here.
 */

const mockGetCurrentUserId = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: (...a: unknown[]) => mockGetCurrentUserId(...a),
  getAuthenticatedUser: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetById = vi.fn();
const mockGetByServiceBookingId = vi.fn();
const mockGetCurrentVersion = vi.fn();
vi.mock("@/dal", () => ({
  serviceBookingDAL: { getById: (...a: unknown[]) => mockGetById(...a) },
  serviceAgreementDocumentDAL: {
    getByServiceBookingId: (...a: unknown[]) => mockGetByServiceBookingId(...a),
  },
  legalDocumentDAL: {
    getCurrentVersion: (...a: unknown[]) => mockGetCurrentVersion(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

const BOOKING = {
  id: "booking-1",
  requesterId: "requester-1",
  providerId: "provider-1",
  status: "accepted",
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () =>
  new NextRequest("http://localhost/api/services/bookings/booking-1");

describe("GET /api/services/bookings/[id] — agreement serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUserId.mockResolvedValue("requester-1");
    mockGetById.mockResolvedValue(BOOKING);
    mockGetByServiceBookingId.mockResolvedValue(null);
    mockGetCurrentVersion.mockResolvedValue(null);
  });

  it("includes the generated PDF when one exists", async () => {
    mockGetByServiceBookingId.mockResolvedValue({
      pdfUrl: "https://blob.hoador.com/agreements/booking-1.pdf",
      templateVersion: "v3",
      generatedAt: new Date(),
    });

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agreement).toEqual({
      pdfUrl: "https://blob.hoador.com/agreements/booking-1.pdf",
      templateVersion: "v3",
    });
    expect(body.id).toBe("booking-1");
    // The generic fallback must not be consulted when a real PDF exists.
    expect(mockGetCurrentVersion).not.toHaveBeenCalled();
  });

  it("falls back to the generic per_service_agreement document (D-E2-7)", async () => {
    mockGetByServiceBookingId.mockResolvedValue(null);
    mockGetCurrentVersion.mockResolvedValue({
      version: "1.0",
      url: "https://blob.hoador.com/legal/per-service-agreement-1.0.pdf",
    });

    const res = await GET(req(), params("booking-1"));

    const body = await res.json();
    expect(body.agreement).toEqual({
      pdfUrl: "https://blob.hoador.com/legal/per-service-agreement-1.0.pdf",
      templateVersion: "1.0",
    });
    // The generic doc must be the *service* agreement, never the rental one.
    expect(mockGetCurrentVersion).toHaveBeenCalledWith("per_service_agreement");
  });

  it("returns agreement: null when neither the PDF nor the generic doc exists", async () => {
    const res = await GET(req(), params("booking-1"));

    expect((await res.json()).agreement).toBeNull();
  });

  it("degrades to null (does not 500) when the agreement lookup throws", async () => {
    mockGetByServiceBookingId.mockRejectedValue(new Error("blob down"));
    mockGetCurrentVersion.mockRejectedValue(new Error("blob down"));

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(200);
    expect((await res.json()).agreement).toBeNull();
  });
});

describe("GET /api/services/bookings/[id] — access control (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetById.mockResolvedValue(BOOKING);
    mockGetByServiceBookingId.mockResolvedValue(null);
    mockGetCurrentVersion.mockResolvedValue(null);
  });

  it("401s when unauthenticated", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(401);
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it("403s a non-party and never fetches their agreement", async () => {
    mockGetCurrentUserId.mockResolvedValue("stranger-1");

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(403);
    expect(mockGetByServiceBookingId).not.toHaveBeenCalled();
    expect(mockGetCurrentVersion).not.toHaveBeenCalled();
  });

  it("allows the provider (the other party) to view it", async () => {
    mockGetCurrentUserId.mockResolvedValue("provider-1");

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(200);
  });

  it("404s when the booking does not exist", async () => {
    mockGetById.mockResolvedValue(null);

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(404);
  });
});
