import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile Req 11.1.2, 11.1.6 · decision D-E9-1 · prerequisite P-E9-1
 *
 * The preview must quote the numbers `createBooking` will actually store. Those
 * live in `quoteServiceBooking`, which both call; what is asserted here is the
 * wiring, the blocker-as-data contract, and the shape the app parses.
 */

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

const mockListingGetById = vi.fn();
vi.mock("@/dal", () => ({
  serviceListingDAL: { getById: (...a: unknown[]) => mockListingGetById(...a) },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const LISTING = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Lawn mowing",
  providerId: "provider-1",
  communityId: "community-1",
  status: "active",
  pricingType: "hourly",
  price: "40.00",
};

const futureDay = (daysAhead = 30) =>
  new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const req = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/services/bookings/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const base = (over: Record<string, unknown> = {}) => ({
  listingId: LISTING.id,
  proposedDate: futureDay(),
  hours: 3,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: "requester-1", role: "user" },
    userId: "requester-1",
    isAdmin: false,
  });
  mockListingGetById.mockResolvedValue(LISTING);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/services/bookings/preview — the itemization (Req 11.1.2)", () => {
  it("quotes rate × hours, the fee, and the total as decimal strings", async () => {
    const body = await (await POST(req(base()))).json();

    expect(body).toMatchObject({
      pricingType: "hourly",
      rate: "40.00",
      hours: 3,
      servicePrice: "120.00",
      canBook: true,
      blockers: [],
    });
    // The fee is `calculateServiceFee`'s output for $120 — Stripe's 2.9% + 30c
    // grossed up — not a percentage this route or the app knows. Asserting the
    // real figure is what stops the route quietly growing its own formula.
    expect(body.serviceFee).toBe("3.89");
    expect(body.totalAmount).toBe("123.89");
  });

  it("quotes a fixed-price listing without hours", async () => {
    mockListingGetById.mockResolvedValue({
      ...LISTING,
      pricingType: "fixed",
      price: "120.00",
    });

    const body = await (await POST(req(base({ hours: null })))).json();

    expect(body).toMatchObject({
      pricingType: "fixed",
      hours: null,
      servicePrice: "120.00",
      canBook: true,
    });
  });

  it("says the charge happens on acceptance, not at submit", async () => {
    // Req 11.1.2's load-bearing fact, shipped as a flag so no client has to
    // remember which way round this lifecycle works.
    expect((await (await POST(req(base()))).json()).chargedOnAcceptance).toBe(
      true,
    );
  });

  it("never leaks the provider's id to a prospective client", async () => {
    const wire = JSON.stringify(await (await POST(req(base()))).json());

    expect(wire).not.toContain("provider-1");
    expect(wire).not.toContain("community-1");
  });
});

describe("POST /api/services/bookings/preview — blockers are data, not errors", () => {
  it("explains an own-listing rather than refusing the request", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "provider-1", role: "user" },
      userId: "provider-1",
      isAdmin: false,
    });

    const res = await POST(req(base()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.canBook).toBe(false);
    expect(body.blockers).toEqual([
      { code: "OWN_LISTING", message: "cannot_book_own_listing" },
    ]);
  });

  it("still prices an unbookable input, so the screen can show what it would cost", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "provider-1", role: "user" },
      userId: "provider-1",
      isAdmin: false,
    });

    expect((await (await POST(req(base()))).json()).totalAmount).toBe("123.89");
  });

  it("reports missing hours on an hourly listing", async () => {
    const body = await (await POST(req(base({ hours: null })))).json();

    expect(body.blockers).toContainEqual({
      code: "HOURS_REQUIRED",
      message: "Hours are required for hourly listings",
    });
  });

  it("reports a day that has already gone (P-E9-1b)", async () => {
    const body = await (
      await POST(req(base({ proposedDate: "2020-01-01" })))
    ).json();

    expect(body.blockers).toContainEqual({
      code: "PROPOSED_DATE_IN_PAST",
      message: "Proposed date cannot be in the past",
    });
  });

  it("reports EVERY blocker at once, not the first one", async () => {
    // A stepper that fixes one problem only to be told the next is the
    // experience this avoids.
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "provider-1", role: "user" },
      userId: "provider-1",
      isAdmin: false,
    });

    const body = await (
      await POST(req(base({ hours: null, proposedDate: "2020-01-01" })))
    ).json();

    expect(body.blockers.map((b: { code: string }) => b.code).sort()).toEqual([
      "HOURS_REQUIRED",
      "OWN_LISTING",
      "PROPOSED_DATE_IN_PAST",
    ]);
  });
});

describe("POST /api/services/bookings/preview — refusals", () => {
  it("401s when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    expect((await POST(req(base()))).status).toBe(401);
  });

  it("404s a listing that does not exist", async () => {
    mockListingGetById.mockResolvedValue(null);

    expect((await POST(req(base()))).status).toBe(404);
  });

  it("404s an INACTIVE listing, exactly as createBooking does", async () => {
    // Not a blocker: there is nothing for a client to explain away about a
    // listing that is not on sale, and this preserves the answer the write
    // path has always given.
    mockListingGetById.mockResolvedValue({ ...LISTING, status: "paused" });

    expect((await POST(req(base()))).status).toBe(404);
  });

  it("400s a malformed body without reaching the listing", async () => {
    const res = await POST(
      req({ listingId: "not-a-uuid", proposedDate: "nope" }),
    );

    expect(res.status).toBe(400);
    expect(mockListingGetById).not.toHaveBeenCalled();
  });
});
