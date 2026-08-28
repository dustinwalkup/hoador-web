import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError } from "@/dal/errors";

const mockGetRentalRequestById = vi.fn();
const mockEndRental = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("@/dal", () => ({
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditLogCreate(...args),
  },
}));

vi.mock("@/dal/rentals.dal", () => ({
  RentalDAL: class {
    getRentalRequestById = (...args: unknown[]) =>
      mockGetRentalRequestById(...args);
    endRental = (...args: unknown[]) => mockEndRental(...args);
  },
}));

vi.mock("@/features/auth/utils/session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/utils/session")>();
  return {
    ...actual,
    getCurrentUserId: vi.fn(),
    /** Avoid Next request store when handleApiError runs in tests */
    getCurrentUser: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

vi.mock("@/features/rentals/notifications/rental-ended", () => ({
  sendRentalEndedNotification: vi.fn(),
}));

vi.mock("@/lib/api/route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/route-helpers")
  >("@/lib/api/route-helpers");
  return {
    ...actual,
    requireAuthResponse: vi.fn().mockResolvedValue(null),
    captureNonCriticalError: vi.fn(),
  };
});

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (
    handler: (req: NextRequest, ctx: unknown) => Promise<Response>,
  ) => handler,
}));

describe("POST /api/rentals/[id]/end", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    vi.mocked(getCurrentUserId).mockResolvedValue("owner-1");
    mockGetRentalRequestById.mockResolvedValue({
      id: "req-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      listingName: "Tool",
      listingId: "list-1",
    });
  });

  /** UAT-P1-26: duplicate return confirmation → 409; no side effects after DAL rejects. */
  it("returns 409 when return was already confirmed (ConflictError from endRental)", async () => {
    mockEndRental.mockRejectedValue(
      new ConflictError("Return has already been confirmed for this rental."),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/rentals/req-1/end",
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/return has already been confirmed/i);

    const { trackActivity } =
      await import("@/features/activity/lib/track-activity");
    expect(vi.mocked(trackActivity)).not.toHaveBeenCalled();
    const { sendRentalEndedNotification } =
      await import("@/features/rentals/notifications/rental-ended");
    expect(vi.mocked(sendRentalEndedNotification)).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  /** UAT-P1-27: audit log on return confirmation — owner id, action, entity id. */
  it("creates audit log when return is confirmed successfully", async () => {
    mockEndRental.mockResolvedValue({
      rental: {
        id: "req-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        listingId: "list-1",
        status: "completed",
      },
      renterName: "Renter",
      ownerName: "Owner",
      listingName: "Tool",
    });
    mockAuditLogCreate.mockResolvedValue({ id: "audit-1" });

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/rentals/req-1/end",
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      entityType: "rental_request",
      entityId: "req-1",
      action: "rental_request.return_confirmed",
      userId: "owner-1",
      metadata: { listingId: "list-1" },
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
});

/**
 * Requirements: mobile Req 10.2.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-6)
 *
 * The return condition and damage report. These columns have existed since the
 * schema was written and were populated only by the seed — this route accepted
 * no body at all until now.
 */
describe("POST /api/rentals/[id]/end — condition and damage (P-E8A-6)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    vi.mocked(getCurrentUserId).mockResolvedValue("owner-1");
    mockGetRentalRequestById.mockResolvedValue({
      id: "rental-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      listingName: "Tool",
      listingId: "list-1",
    });
    mockEndRental.mockResolvedValue({
      rental: {
        id: "rental-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        listingId: "list-1",
        status: "completed",
      },
      renterName: "Renter",
      ownerName: "Owner",
      listingName: "Tool",
    });
  });

  const withBody = (body: Record<string, unknown>) =>
    new NextRequest("http://localhost/api/rentals/rental-1/end", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("records the return condition and the damage report", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      withBody({
        conditionAtReturn: "Returned clean.",
        damageReported: true,
        damageDescription: "Cracked housing on the left side.",
        damagePhotos: ["https://blob.test/damage/1.jpg"],
      }),
      { params: Promise.resolve({ id: "rental-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockEndRental).toHaveBeenCalledWith(
      "rental-1",
      expect.any(String),
      expect.objectContaining({
        conditionAtReturn: "Returned clean.",
        damageReported: true,
        damageDescription: "Cracked housing on the left side.",
        damagePhotos: ["https://blob.test/damage/1.jpg"],
      }),
    );
  });

  // "Damaged, no further comment" starts a dispute the other party cannot
  // answer.
  it("refuses a damage report with no description", async () => {
    const { POST } = await import("../route");
    const res = await POST(withBody({ damageReported: true }), {
      params: Promise.resolve({ id: "rental-1" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/describe the damage/i);
    expect(mockEndRental).not.toHaveBeenCalled();
  });

  // The web client has always called this route with no body, and must keep
  // working: an empty POST is a valid "returned, nothing to note".
  it("still accepts a bodyless call", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/api/rentals/rental-1/end", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "rental-1" }) },
    );

    expect(res.status).toBe(200);
  });
});
