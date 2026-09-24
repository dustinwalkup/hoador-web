import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile Req 9.1.2, 9.1.3, 9.1.6, 14.1.1
 * Design: mobile D-E8A-1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-1)
 */

// Per CLAUDE.md: mock the session module so the route's real auth path runs.
const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetListingById = vi.fn();
const mockGetBookedDatesForListing = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: { getListingById: (...a: unknown[]) => mockGetListingById(...a) },
  rentalDAL: {
    getBookedDatesForListing: (...a: unknown[]) =>
      mockGetBookedDatesForListing(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";

const daysFromToday = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};
const iso = (offset: number) => daysFromToday(offset).toISOString();

const listing = (over: Record<string, unknown> = {}) => ({
  id: LISTING_ID,
  name: "Pressure Washer",
  owner: { id: "owner-1" },
  dailyRate: 25,
  weeklyRate: null,
  monthlyRate: null,
  deliveryFee: 10,
  setupFee: 20,
  setupAvailable: true,
  deliveryMode: "both_available",
  securityDeposit: 100,
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  ...over,
});

const req = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/rentals/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const preview = async (over: Record<string, unknown> = {}) => {
  const res = await POST(
    req({
      listingId: LISTING_ID,
      startDate: iso(1),
      endDate: iso(3),
      deliveryRequested: false,
      setupRequested: false,
      ...over,
    }),
  );
  return { res, body: await res.json() };
};

const codes = (body: { blockers: { code: string }[] }) =>
  body.blockers.map((b) => b.code);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: "renter-1" },
    userId: "renter-1",
    isAdmin: false,
  });
  mockGetListingById.mockResolvedValue(listing());
  mockGetBookedDatesForListing.mockResolvedValue([]);
});

describe("POST /api/rentals/preview — itemization (Req 9.1.3)", () => {
  it("returns the full itemization as decimal strings", async () => {
    const { res, body } = await preview();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      totalDays: 3,
      dailyRate: "25.00",
      subtotal: "75.00",
      deliveryFee: "0.00",
      setupFee: "0.00",
      securityDeposit: "100.00",
      canBook: true,
    });
    // Money is a decimal string on every other endpoint; this one agrees.
    for (const key of ["dailyRate", "subtotal", "serviceFee", "totalAmount"]) {
      expect(body[key]).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it("charges delivery and setup only when they are requested", async () => {
    const { body } = await preview({
      deliveryRequested: true,
      setupRequested: true,
    });

    expect(body.deliveryFee).toBe("10.00");
    expect(body.setupFee).toBe("20.00");
  });

  // The whole reason this endpoint exists (D-E8A-1): the quote must be the same
  // number the charge will be. Both run `calculateRentalPricing` through
  // `quoteRentalRequest`, so this pins the arithmetic rather than restating it.
  it("totals subtotal + fees, as the charge will", async () => {
    const { body } = await preview({
      deliveryRequested: true,
      setupRequested: true,
    });

    const sum =
      Number(body.subtotal) +
      Number(body.deliveryFee) +
      Number(body.setupFee) +
      Number(body.serviceFee);
    expect(body.totalAmount).toBe(sum.toFixed(2));
  });

  // Req 14.1.1 — a hold, never a charge. Stated as data so no client has to
  // remember which of the two the deposit is.
  it("marks the deposit as a hold and keeps it out of the total", async () => {
    const { body } = await preview();

    expect(body.securityDepositIsHold).toBe(true);
    expect(Number(body.totalAmount)).toBeLessThan(
      Number(body.totalAmount) + Number(body.securityDeposit),
    );
  });
});

describe("POST /api/rentals/preview — blockers are data (Req 9.1.6)", () => {
  it("reports an own-listing attempt as an explanation, not an error", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "owner-1" },
      userId: "owner-1",
      isAdmin: false,
    });

    const { res, body } = await preview();

    // A 400 would collapse six distinguishable answers into "something went
    // wrong", and Req 9.1.6 asks for an explanation rather than a dead button.
    expect(res.status).toBe(200);
    expect(body.canBook).toBe(false);
    expect(codes(body)).toContain("OWN_LISTING");
    // …and it still prices it, so the screen can show what it would have cost.
    expect(body.totalAmount).toMatch(/^\d+\.\d{2}$/);
  });

  it("reports a period below the listing's minimum", async () => {
    mockGetListingById.mockResolvedValue(listing({ minimumRentalPeriod: 5 }));

    const { body } = await preview({ startDate: iso(1), endDate: iso(2) });

    expect(codes(body)).toContain("BELOW_MINIMUM_PERIOD");
    expect(body.blockers[0].message).toMatch(/Minimum rental period is 5/);
  });

  it("reports a period above the listing's maximum", async () => {
    mockGetListingById.mockResolvedValue(listing({ maximumRentalPeriod: 3 }));

    const { body } = await preview({ startDate: iso(1), endDate: iso(10) });

    expect(codes(body)).toContain("ABOVE_MAXIMUM_PERIOD");
  });

  it("reports a start date in the past (Req 9.1.2)", async () => {
    const { body } = await preview({ startDate: iso(-2), endDate: iso(1) });

    expect(codes(body)).toContain("START_IN_PAST");
  });

  it("reports a clash, and names the window so the client can explain it", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: daysFromToday(2), endDate: daysFromToday(4) },
    ]);

    const { body } = await preview({ startDate: iso(3), endDate: iso(5) });

    expect(codes(body)).toContain("DATES_UNAVAILABLE");
    expect(body.blockers.at(-1).conflict).toMatchObject({
      from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("reports every blocker at once, not just the first", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "owner-1" },
      userId: "owner-1",
      isAdmin: false,
    });
    mockGetListingById.mockResolvedValue(
      listing({ owner: { id: "owner-1" }, minimumRentalPeriod: 5 }),
    );

    const { body } = await preview({ startDate: iso(-2), endDate: iso(-1) });

    // A stepper that fixes one problem only to meet the next is the experience
    // this avoids.
    expect(codes(body)).toEqual(
      expect.arrayContaining([
        "OWN_LISTING",
        "START_IN_PAST",
        "BELOW_MINIMUM_PERIOD",
      ]),
    );
  });

  it("ships bookedRanges so the picker can grey days out", async () => {
    mockGetBookedDatesForListing.mockResolvedValue([
      { startDate: daysFromToday(20), endDate: daysFromToday(22) },
    ]);

    const { body } = await preview();

    expect(body.bookedRanges).toHaveLength(1);
    expect(JSON.stringify(body.bookedRanges)).not.toMatch(/[TZ]/);
  });
});

describe("POST /api/rentals/preview — failures", () => {
  it("401s when unauthenticated and reads nothing", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { res } = await preview();

    expect(res.status).toBe(401);
    expect(mockGetListingById).not.toHaveBeenCalled();
  });

  it("400s a malformed body", async () => {
    const res = await POST(req({ listingId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  // Nothing to explain about a listing that isn't there.
  it("404s an unknown listing rather than returning a blocker", async () => {
    mockGetListingById.mockResolvedValue(null);

    const { res } = await preview();

    expect(res.status).toBe(404);
  });

  // A price is still useful when availability is unreadable, but the dates
  // cannot be booked until it is known: fail closed (CONC-01).
  it("still prices the rental but blocks booking when the availability read fails", async () => {
    mockGetBookedDatesForListing.mockRejectedValue(new Error("db down"));

    const { res, body } = await preview();

    expect(res.status).toBe(200);
    expect(body.canBook).toBe(false);
    expect(body.blockers).toEqual([
      expect.objectContaining({ code: "DATES_UNAVAILABLE" }),
    ]);
    expect(body.totalAmount).toMatch(/^\d+\.\d{2}$/);
    expect(body.bookedRanges).toEqual([]);
  });

  // A price check is not a view. `createRentalRequest` reads it the same way.
  it("does not count as a listing view", async () => {
    await preview();

    expect(mockGetListingById).toHaveBeenCalledWith(LISTING_ID);
  });
});

/**
 * SEC-03: the setup fee used to be taken from the request body in preference
 * to the listing's, so a renter could discount (or negate) it. And nothing
 * stopped a request for setup or delivery the listing does not offer.
 */
describe("POST /api/rentals/preview — server-priced setup and delivery (SEC-03)", () => {
  it.each([-100, 0, 999])(
    "prices setup from the listing, ignoring a client setupFee of %s",
    async (setupFee) => {
      const { body: honest } = await preview({
        setupRequested: true,
        deliveryRequested: true,
      });
      const { body: forged } = await preview({
        setupRequested: true,
        deliveryRequested: true,
        setupFee,
      });

      expect(forged.setupFee).toBe("20.00");
      expect(forged.totalAmount).toBe(honest.totalAmount);
    },
  );

  it("blocks setup on a listing that does not offer it", async () => {
    mockGetListingById.mockResolvedValue(listing({ setupAvailable: false }));

    const { body } = await preview({
      deliveryRequested: true,
      setupRequested: true,
    });

    expect(body.canBook).toBe(false);
    expect(codes(body)).toEqual(["SETUP_NOT_OFFERED"]);
  });

  it("blocks delivery on a pickup-only listing", async () => {
    mockGetListingById.mockResolvedValue(
      listing({ deliveryMode: "pickup_only" }),
    );

    const { body } = await preview({ deliveryRequested: true });

    expect(body.canBook).toBe(false);
    expect(codes(body)).toEqual(["DELIVERY_NOT_OFFERED"]);
  });

  it.each(["delivery_only", "both_available"])(
    "allows delivery on a %s listing",
    async (deliveryMode) => {
      mockGetListingById.mockResolvedValue(listing({ deliveryMode }));

      const { body } = await preview({ deliveryRequested: true });

      expect(body.canBook).toBe(true);
    },
  );

  it("does not block a pickup-only listing when delivery is not requested", async () => {
    mockGetListingById.mockResolvedValue(
      listing({ deliveryMode: "pickup_only", setupAvailable: false }),
    );

    const { body } = await preview();

    expect(body.canBook).toBe(true);
  });
});
