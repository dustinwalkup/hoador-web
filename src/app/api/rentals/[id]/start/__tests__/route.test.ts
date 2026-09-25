import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError } from "@/dal/errors";

const mockGetRentalRequestById = vi.fn();
const mockStartRental = vi.fn();

vi.mock("@/dal/rentals.dal", () => ({
  RentalDAL: class {
    getRentalRequestById = (...args: unknown[]) =>
      mockGetRentalRequestById(...args);
    startRental = (...args: unknown[]) => mockStartRental(...args);
  },
}));

const mockCurrentUserId = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: async () => {
    const id = await mockCurrentUserId();
    return id
      ? {
          user: {
            id,
            status: "active",
            emailVerified: true,
            userType: "standard",
          },
          userId: id,
          isAdmin: false,
        }
      : null;
  },
  getCurrentUserId: (...a: unknown[]) => mockCurrentUserId(...a),
  /** Avoid Next request store when handleApiError runs in tests */
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/features/rentals/notifications/rental-started", () => ({
  sendRentalStartedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const FIXTURE = {
  id: "req-1",
  ownerId: "owner-1",
  renterId: "renter-1",
  listingName: "Tool",
  listingId: "list-1",
};

const post = (body?: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/rentals/req-1/start", {
    method: "POST",
    ...(body
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
const params = () => ({ params: Promise.resolve({ id: "req-1" }) });

describe("POST /api/rentals/[id]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserId.mockResolvedValue("owner-1");
    mockGetRentalRequestById.mockResolvedValue(FIXTURE);
    mockStartRental.mockResolvedValue({
      rental: {
        id: "req-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        listingId: "list-1",
        status: "active",
      },
      renterName: "Renter",
      ownerName: "Owner",
      listingName: "Tool",
    });
  });

  it("401s an unauthenticated caller and never starts the rental", async () => {
    mockCurrentUserId.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(post(), params());

    expect(res.status).toBe(401);
    expect(mockStartRental).not.toHaveBeenCalled();
  });

  it("404s when the rental request doesn't exist", async () => {
    mockGetRentalRequestById.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(post(), params());

    expect(res.status).toBe(404);
    expect(mockStartRental).not.toHaveBeenCalled();
  });

  it("403s a caller who isn't the listing owner", async () => {
    mockCurrentUserId.mockResolvedValue("renter-1");

    const { POST } = await import("../route");
    const res = await POST(post(), params());

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(
      /only the listing owner can start rentals/i,
    );
    expect(mockStartRental).not.toHaveBeenCalled();
  });

  it("409s when the DAL rejects with ConflictError", async () => {
    mockStartRental.mockRejectedValue(
      new ConflictError("Rental cannot be started yet."),
    );

    const { POST } = await import("../route");
    const res = await POST(post(), params());

    expect(res.status).toBe(409);
  });

  it("200s for the owner and starts the rental", async () => {
    const { POST } = await import("../route");
    const res = await POST(post({ conditionAtPickup: "Looks good" }), params());

    expect(res.status).toBe(200);
    expect(mockStartRental).toHaveBeenCalledWith("req-1", "owner-1", {
      conditionAtPickup: "Looks good",
    });
  });
});
