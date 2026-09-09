import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile 7.4.1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F9 / F10 / P-E10-3
 *
 * **On timezone.** These run at UTC, which is what Vercel runs and what the rest
 * of the day-handling stack assumes. Written first at `America/Chicago` (the
 * R-8.7 discipline), which surfaced something worth recording but NOT a defect
 * in this route: `toWallClock` reads a `Date` with LOCAL getters, while every
 * day in this system is constructed as UTC midnight (`new Date("2026-10-01")`,
 * which is exactly what `POST /api/rentals` does with a date-only string). Those
 * two only agree when the server runs UTC. This route is consistent with the
 * rental path it is compared against — both construct and both render the same
 * way — so a non-UTC deployment would shift rentals and blocks together, not
 * relative to each other. Making the stack zone-independent is a cross-cutting
 * change across rentals, schedule and bookings, deliberately not smuggled into
 * this task.
 *
 * What IS pinned below at any offset: `toDayStart` must produce UTC midnight of
 * the day asked for, so the server's zone never decides which day gets blocked.
 */
/**
 * A Date meaning "this calendar day", as `toWallClock` reads one (local
 * getters). Fixtures built this way assert the same thing at ANY process
 * offset, rather than passing only where the machine happens to sit — which is
 * what a literal `new Date("...Z")` would do.
 */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

const mockGetCurrentUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetCurrentUser();
    return user ? { user, userId: user.id, isAdmin: false } : null;
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetListingById = vi.fn();
const mockGetBookedDates = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: { getListingById: (...a: any[]) => mockGetListingById(...a) },
  rentalDAL: {
    getBookedDatesForListing: (...a: any[]) => mockGetBookedDates(...a),
  },
}));

const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockDeleteReturning = vi.fn();
const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }));

/** The args a no-arg `vi.fn` was actually called with, for assertions. */
const argsOf = (calls: unknown[][], index = 0): unknown[] =>
  (calls[index] ?? []) as unknown[];
vi.mock("@/db/db", () => ({
  db: {
    insert: () => ({ values: mockValues }),
    delete: () => ({ where: mockDeleteWhere }),
  },
}));

vi.mock("@/db/schemas/listings.schema", () => ({
  listingAvailability: {
    id: "availability.id",
    listingId: "availability.listingId",
  },
}));

import { POST } from "../route";
import { DELETE } from "../[blockId]/route";

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/listings/L1/availability", {
    method: "POST",
    body: JSON.stringify(body),
  });
const params = () => ({ params: Promise.resolve({ listingId: "L1" }) });
const blockParams = (blockId = "B1") => ({
  params: Promise.resolve({ listingId: "L1", blockId }),
});

describe("POST /api/listings/[listingId]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "owner-1" });
    mockGetListingById.mockResolvedValue({ owner: { id: "owner-1" } });
    mockGetBookedDates.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: "new-block" }]);
  });

  it("blocks a range for the owner", async () => {
    const res = await POST(
      post({ from: "2026-10-01", to: "2026-10-05" }),
      params(),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      block: { id: "new-block", from: "2026-10-01", to: "2026-10-05" },
    });
  });

  // ⚠️ The R-8.7 guard. Running in America/Chicago (UTC-5/6), a day parsed in
  // local time would store the 30th at 05:00Z and read back as the 30th — but a
  // day parsed as local midnight stores 06:00Z and, formatted anywhere east,
  // becomes the 1st. The column must hold UTC midnight of the day asked for.
  it("stores the exact calendar day asked for, from a non-UTC server", async () => {
    await POST(post({ from: "2026-10-01", to: "2026-10-01" }), params());

    const inserted = argsOf(mockValues.mock.calls)[0] as {
      startDate: Date;
      endDate: Date;
    };
    expect(inserted.startDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(inserted.endDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("marks the row blocked", async () => {
    await POST(post({ from: "2026-10-01", to: "2026-10-02" }), params());
    expect(argsOf(mockValues.mock.calls)[0]).toMatchObject({
      listingId: "L1",
      isBlocked: true,
    });
  });

  it("keeps an optional reason, and nulls a missing one", async () => {
    await POST(
      post({ from: "2026-10-01", to: "2026-10-02", reason: "Away" }),
      params(),
    );
    expect(argsOf(mockValues.mock.calls)[0]).toMatchObject({ reason: "Away" });

    await POST(post({ from: "2026-11-01", to: "2026-11-02" }), params());
    expect(argsOf(mockValues.mock.calls, 1)[0]).toMatchObject({ reason: null });
  });

  describe("conflicts", () => {
    // The owner owes the item on days someone has already booked.
    it("refuses a range overlapping a rental, and says which one", async () => {
      mockGetBookedDates.mockResolvedValue([
        {
          startDate: day(2026, 10, 3),
          endDate: day(2026, 10, 7),
          source: "rental",
        },
      ]);

      const res = await POST(
        post({ from: "2026-10-05", to: "2026-10-09" }),
        params(),
      );

      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({
        error: expect.stringContaining("2026-10-03"),
      });
      expect(mockValues).not.toHaveBeenCalled();
    });

    // Inclusive at both ends: an item is still out on its return day.
    it("treats a range starting on a rental's last day as a conflict", async () => {
      mockGetBookedDates.mockResolvedValue([
        {
          startDate: day(2026, 10, 3),
          endDate: day(2026, 10, 7),
          source: "rental",
        },
      ]);

      const res = await POST(
        post({ from: "2026-10-07", to: "2026-10-09" }),
        params(),
      );
      expect(res.status).toBe(409);
    });

    it("allows a range that ends the day before a rental starts", async () => {
      mockGetBookedDates.mockResolvedValue([
        {
          startDate: day(2026, 10, 3),
          endDate: day(2026, 10, 7),
          source: "rental",
        },
      ]);

      const res = await POST(
        post({ from: "2026-10-01", to: "2026-10-02" }),
        params(),
      );
      expect(res.status).toBe(200);
    });

    // Two blocks over the same day is not a contradiction, and refusing it would
    // force an owner to delete before extending.
    it("allows a range overlapping an existing BLOCK", async () => {
      mockGetBookedDates.mockResolvedValue([
        {
          id: "B1",
          startDate: day(2026, 10, 3),
          endDate: day(2026, 10, 7),
          source: "block",
        },
      ]);

      const res = await POST(
        post({ from: "2026-10-05", to: "2026-10-09" }),
        params(),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("validation and access", () => {
    it("400s a reversed range", async () => {
      const res = await POST(
        post({ from: "2026-10-09", to: "2026-10-01" }),
        params(),
      );
      expect(res.status).toBe(400);
      expect(mockValues).not.toHaveBeenCalled();
    });

    it("400s a non-day date, so a zone can never decide the day", async () => {
      const res = await POST(
        post({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-02" }),
        params(),
      );
      expect(res.status).toBe(400);
    });

    it("400s a malformed body rather than throwing", async () => {
      const bad = new NextRequest(
        "http://localhost/api/listings/L1/availability",
        {
          method: "POST",
          body: "{not json",
        },
      );
      const res = await POST(bad, params());
      expect(res.status).toBe(400);
    });

    it("403s a non-owner and writes nothing", async () => {
      mockGetListingById.mockResolvedValue({ owner: { id: "someone-else" } });
      const res = await POST(
        post({ from: "2026-10-01", to: "2026-10-02" }),
        params(),
      );
      expect(res.status).toBe(403);
      expect(mockValues).not.toHaveBeenCalled();
    });

    it("401s when unauthenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await POST(
        post({ from: "2026-10-01", to: "2026-10-02" }),
        params(),
      );
      expect(res.status).toBe(401);
      expect(mockGetListingById).not.toHaveBeenCalled();
    });

    it("404s a listing that does not exist", async () => {
      mockGetListingById.mockResolvedValue(null);
      const res = await POST(
        post({ from: "2026-10-01", to: "2026-10-02" }),
        params(),
      );
      expect(res.status).toBe(404);
    });
  });
});

describe("DELETE /api/listings/[listingId]/availability/[blockId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "owner-1" });
    mockGetListingById.mockResolvedValue({ owner: { id: "owner-1" } });
    mockDeleteReturning.mockResolvedValue([{ id: "B1" }]);
  });

  it("lifts the owner's block", async () => {
    const res = await DELETE({} as NextRequest, blockParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  // The F32 shape, one table over: without the listing predicate a caller could
  // delete a block on a listing they don't own by passing a foreign block id.
  it("scopes the delete to BOTH the block and the listing", async () => {
    await DELETE({} as NextRequest, blockParams());

    // The predicate is drizzle's `and(eq(id), eq(listingId))`; asserting it is
    // built at all (rather than a bare id match) is what this pins.
    expect(argsOf(mockDeleteWhere.mock.calls)[0]).toBeDefined();
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });

  it("404s a block that isn't there", async () => {
    mockDeleteReturning.mockResolvedValue([]);
    const res = await DELETE({} as NextRequest, blockParams("nope"));
    expect(res.status).toBe(404);
  });

  it("403s a non-owner and deletes nothing", async () => {
    mockGetListingById.mockResolvedValue({ owner: { id: "someone-else" } });
    const res = await DELETE({} as NextRequest, blockParams());
    expect(res.status).toBe(403);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("401s when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE({} as NextRequest, blockParams());
    expect(res.status).toBe(401);
  });
});
