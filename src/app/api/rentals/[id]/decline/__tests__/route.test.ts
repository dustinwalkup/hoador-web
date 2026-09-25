import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError } from "@/dal/errors";

/**
 * SEC-12: the owner's decline reason is stored and emailed to the renter. It
 * used to be the one free-text field that skipped sanitizing entirely.
 */

vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    user: { id: "owner-1", status: "active" },
    userId: "owner-1",
    isAdmin: false,
  }),
  getCurrentUserId: vi.fn().mockResolvedValue("owner-1"),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

const mockDenied = vi.fn();
vi.mock("@/features/rentals/notifications/rental-denied", () => ({
  sendRentalDeniedNotification: (...a: unknown[]) => mockDenied(...a),
}));

const mockDecline = vi.fn();
vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: vi.fn().mockResolvedValue({
      id: "r-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      listingName: "Drill",
    }),
    declineRentalRequest: (...a: unknown[]) => mockDecline(...a),
  },
  userDAL: {
    getUserById: vi.fn(async (id: string) => ({
      id,
      email: `${id}@x.test`,
      firstName: "A",
      lastName: "B",
      name: "A B",
    })),
  },
  auditLogDAL: { create: vi.fn().mockResolvedValue(undefined) },
}));

const decline = async (denialReason: unknown) => {
  const { POST } = await import("../route");
  return POST(
    new NextRequest("http://localhost/api/rentals/r-1/decline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ denialReason }),
    }),
    { params: Promise.resolve({ id: "r-1" }) },
  );
};

describe("POST /api/rentals/[id]/decline — reason sanitizing (SEC-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecline.mockResolvedValue(undefined);
    mockDenied.mockResolvedValue(undefined);
  });

  it("stores and emails the reason without markup", async () => {
    const res = await decline(
      'Booked that week <a href="https://evil.example">rebook here</a>',
    );

    expect(res.status).toBe(200);
    const stored = mockDecline.mock.calls[0][1] as string;
    expect(stored).not.toMatch(/<a/);
    expect(stored).toContain("Booked that week");
    expect(mockDenied.mock.calls[0][0].denialReason).toBe(stored);
  });

  it("400s a reason that is only markup once sanitized", async () => {
    const res = await decline("<b></b>");

    expect(res.status).toBe(400);
    expect(mockDecline).not.toHaveBeenCalled();
  });

  it("truncates an over-long reason rather than refusing it", async () => {
    const res = await decline("x".repeat(1500));

    expect(res.status).toBe(200);
    expect((mockDecline.mock.calls[0][1] as string).length).toBe(1000);
  });
});

describe("POST /api/rentals/[id]/decline — party and state (R-TEST-09)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getAuthenticatedUser, getCurrentUserId } =
      await import("@/features/auth/utils/session");
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      user: { id: "owner-1", status: "active" },
      userId: "owner-1",
      isAdmin: false,
    } as Awaited<ReturnType<typeof getAuthenticatedUser>>);
    vi.mocked(getCurrentUserId).mockResolvedValue("owner-1");
    const { rentalDAL } = await import("@/dal");
    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue({
      id: "r-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      listingName: "Drill",
    } as Awaited<ReturnType<typeof rentalDAL.getRentalRequestById>>);
    mockDecline.mockResolvedValue(undefined);
    mockDenied.mockResolvedValue(undefined);
  });

  it("401s an unauthenticated caller and never declines", async () => {
    const { getAuthenticatedUser } =
      await import("@/features/auth/utils/session");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);

    const res = await decline("Booked elsewhere");

    expect(res.status).toBe(401);
    expect(mockDecline).not.toHaveBeenCalled();
  });

  it("404s when the rental request doesn't exist", async () => {
    const { rentalDAL } = await import("@/dal");
    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValueOnce(
      null as unknown as Awaited<
        ReturnType<typeof rentalDAL.getRentalRequestById>
      >,
    );

    const res = await decline("Booked elsewhere");

    expect(res.status).toBe(404);
    expect(mockDecline).not.toHaveBeenCalled();
  });

  it("403s a caller who isn't the listing owner", async () => {
    const { getAuthenticatedUser, getCurrentUserId } =
      await import("@/features/auth/utils/session");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: "renter-1", status: "active" },
      userId: "renter-1",
      isAdmin: false,
    } as Awaited<ReturnType<typeof getAuthenticatedUser>>);
    vi.mocked(getCurrentUserId).mockResolvedValueOnce("renter-1");

    const res = await decline("Booked elsewhere");

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(
      /only the listing owner can decline rental requests/i,
    );
    expect(mockDecline).not.toHaveBeenCalled();
  });

  it("409s when the DAL rejects with ConflictError", async () => {
    mockDecline.mockRejectedValue(
      new ConflictError("Rental request is no longer pending."),
    );

    const res = await decline("Booked elsewhere");

    expect(res.status).toBe(409);
  });

  it("200s for the owner", async () => {
    const res = await decline("Booked elsewhere");

    expect(res.status).toBe(200);
    expect(mockDecline).toHaveBeenCalledWith(
      "r-1",
      "Booked elsewhere",
      "owner-1",
    );
  });
});
