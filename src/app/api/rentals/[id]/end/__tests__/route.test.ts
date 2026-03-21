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
