import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError } from "@/dal/errors";

const mockGetRentalRequestById = vi.fn();
const mockUpdateRentalInstructions = vi.fn();

vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: (...a: unknown[]) => mockGetRentalRequestById(...a),
    updateRentalInstructions: (...a: unknown[]) =>
      mockUpdateRentalInstructions(...a),
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

vi.mock("@/features/rentals/notifications/instructions-updated", () => ({
  sendInstructionsUpdatedNotification: vi.fn().mockResolvedValue(undefined),
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

const patch = (body: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/rentals/req-1/instructions", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const params = () => ({ params: Promise.resolve({ id: "req-1" }) });

describe("PATCH /api/rentals/[id]/instructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserId.mockResolvedValue("owner-1");
    mockGetRentalRequestById.mockResolvedValue(FIXTURE);
    mockUpdateRentalInstructions.mockResolvedValue({
      rental: {
        id: "req-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        listingId: "list-1",
      },
      renterName: "Renter",
      ownerName: "Owner",
      listingName: "Tool",
    });
  });

  it("401s an unauthenticated caller and never updates instructions", async () => {
    mockCurrentUserId.mockResolvedValue(null);

    const { PATCH } = await import("../route");
    const res = await PATCH(patch(), params());

    expect(res.status).toBe(401);
    expect(mockUpdateRentalInstructions).not.toHaveBeenCalled();
  });

  it("404s when the rental request doesn't exist", async () => {
    mockGetRentalRequestById.mockResolvedValue(null);

    const { PATCH } = await import("../route");
    const res = await PATCH(patch(), params());

    expect(res.status).toBe(404);
    expect(mockUpdateRentalInstructions).not.toHaveBeenCalled();
  });

  it("403s a caller who isn't the listing owner", async () => {
    mockCurrentUserId.mockResolvedValue("renter-1");

    const { PATCH } = await import("../route");
    const res = await PATCH(patch(), params());

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(
      /only the listing owner can update rental instructions/i,
    );
    expect(mockUpdateRentalInstructions).not.toHaveBeenCalled();
  });

  // Unlike start/decline, this route does not pass the mutation's error
  // through handleApiError — it returns a flat 400 for any updateError,
  // so a ConflictError from the DAL surfaces as 400 here, not 409. Pinning
  // today's live behaviour per R-TEST-09 executor instructions (route
  // drifted from the plan's assumption of uniform handleApiError use).
  it("400s when the DAL mutation rejects with ConflictError", async () => {
    mockUpdateRentalInstructions.mockRejectedValue(
      new ConflictError("Instructions cannot be updated for this rental."),
    );

    const { PATCH } = await import("../route");
    const res = await PATCH(patch(), params());

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/instructions cannot be updated/i);
  });

  it("200s for the owner and updates instructions", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patch({
        pickupInstructions: "Ring the bell",
        returnInstructions: "Leave at door",
      }),
      params(),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateRentalInstructions).toHaveBeenCalledWith(
      "req-1",
      "owner-1",
      "Ring the bell",
      "Leave at door",
    );
  });
});
