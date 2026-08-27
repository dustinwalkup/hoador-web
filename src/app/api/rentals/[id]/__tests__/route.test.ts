import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 22.1.2, 22.1.3
 * Design: 2-design.md §4.5
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.5
 *
 * This route had no test file before (F16); these cover the added agreement
 * serialization and re-assert the party-only access it already enforced.
 */

// Mocking the session module (per CLAUDE.md) keeps the real route-helpers,
// including the actual 401/403 mapping, under test.
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

const mockGetRentalDetailsById = vi.fn();
const mockGetRentalAgreementAcceptance = vi.fn();
vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalDetailsById: (...a: unknown[]) => mockGetRentalDetailsById(...a),
  },
  legalDocumentDAL: {
    getRentalAgreementAcceptance: (...a: unknown[]) =>
      mockGetRentalAgreementAcceptance(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

const RENTAL = {
  id: "rental-1",
  renterId: "renter-1",
  ownerId: "owner-1",
  status: "active",
  // Booked DAYS, held in `timestamp without time zone` columns. Built from
  // local components (as the driver hands them back) so the assertions below
  // hold in any server timezone, not just UTC.
  startDate: new Date(2026, 7, 22, 0, 0, 0),
  endDate: new Date(2026, 7, 23, 0, 0, 0),
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest("http://localhost/api/rentals/rental-1");

const asParty = () =>
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: "renter-1" },
    userId: "renter-1",
    isAdmin: false,
  });

describe("GET /api/rentals/[id] — agreement serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    asParty();
    mockGetRentalDetailsById.mockResolvedValue(RENTAL);
    mockGetRentalAgreementAcceptance.mockResolvedValue({
      version: "v2",
      url: "https://blob.hoador.com/agreements/rental-1.pdf",
    });
  });

  it("includes the agreement as {pdfUrl, templateVersion} when one exists", async () => {
    const res = await GET(req(), params("rental-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    // Mapped from the DAL's {version, url} to the client contract's field names.
    expect(body.agreement).toEqual({
      pdfUrl: "https://blob.hoador.com/agreements/rental-1.pdf",
      templateVersion: "v2",
    });
    // Additive only — the rest of the payload is untouched.
    expect(body.id).toBe("rental-1");
    expect(body.status).toBe("active");
  });

  it("returns agreement: null when none is resolvable", async () => {
    mockGetRentalAgreementAcceptance.mockResolvedValue(null);

    const res = await GET(req(), params("rental-1"));

    expect((await res.json()).agreement).toBeNull();
  });

  it("resolves the agreement for a request id as well as a rental id (F17)", async () => {
    // The [id] may be either; the DAL resolves it. Assert the route hands the
    // raw id straight through rather than assuming it is a request id.
    await GET(req(), params("request-9"));

    expect(mockGetRentalAgreementAcceptance).toHaveBeenCalledWith(
      "request-9",
      "renter-1",
    );
  });

  it("degrades to null (does not 500) when the agreement lookup throws", async () => {
    // Req 22.1.3: a failed agreement lookup must not block the detail response.
    mockGetRentalAgreementAcceptance.mockRejectedValue(new Error("blob down"));

    const res = await GET(req(), params("rental-1"));

    expect(res.status).toBe(200);
    expect((await res.json()).agreement).toBeNull();
  });

  it("gives an admin the rental but not the agreement (party-only, Req 22.1.2)", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "admin-1" },
      userId: "admin-1",
      isAdmin: true,
    });
    // The DAL's own party check returns null for a non-party (the admin).
    mockGetRentalAgreementAcceptance.mockResolvedValue(null);

    const res = await GET(req(), params("rental-1"));

    expect(res.status).toBe(200);
    expect((await res.json()).agreement).toBeNull();
  });
});

describe("GET /api/rentals/[id] — access control (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetRentalDetailsById.mockResolvedValue(RENTAL);
    mockGetRentalAgreementAcceptance.mockResolvedValue(null);
  });

  it("401s when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await GET(req(), params("rental-1"));

    expect(res.status).toBe(401);
    expect(mockGetRentalDetailsById).not.toHaveBeenCalled();
  });

  it("403s a non-party and never fetches their agreement", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "stranger-1" },
      userId: "stranger-1",
      isAdmin: false,
    });

    const res = await GET(req(), params("rental-1"));

    expect(res.status).toBe(403);
    expect(mockGetRentalAgreementAcceptance).not.toHaveBeenCalled();
  });

  it("404s when the rental does not exist", async () => {
    asParty();
    mockGetRentalDetailsById.mockResolvedValue(null);

    const res = await GET(req(), params("rental-1"));

    expect(res.status).toBe(404);
  });
});

/**
 * Requirements: mobile Req 9.2.2, 9.2.3, 5.7.6
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md § 8A.2
 *
 * The three additions task 8A.2 found missing when it verified the wire form
 * (the epic's "check the wire form before choosing a parser" step).
 */
describe("GET /api/rentals/[id] — mobile detail payload (8A.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    asParty();
    mockGetRentalDetailsById.mockResolvedValue(RENTAL);
    mockGetRentalAgreementAcceptance.mockResolvedValue(null);
  });

  // R-8.7 all over again: serialized with toISOString() these go out as an
  // instant at UTC midnight, and a client behind UTC parses them back to the
  // PREVIOUS day — Aug 22 rendering "Aug 21" at UTC-5. Correct in UTC, which is
  // why neither CI nor a UTC preview would ever show it.
  it("serializes startDate/endDate as zoneless YYYY-MM-DD, not an instant", async () => {
    const body = await (await GET(req(), params("rental-1"))).json();

    expect(body.startDate).toBe("2026-08-22");
    expect(body.endDate).toBe("2026-08-23");
    expect(body.startDate).not.toMatch(/[TZ]/);
  });

  it("keeps genuine instants as ISO (they are deadlines, not days)", async () => {
    const expiresAt = new Date("2026-08-20T14:30:00.000Z");
    mockGetRentalDetailsById.mockResolvedValue({
      ...RENTAL,
      status: "pending",
      expiresAt,
      createdAt: new Date("2026-08-17T14:30:00.000Z"),
    });

    const body = await (await GET(req(), params("rental-1"))).json();

    // Req 9.2.3's 72-hour countdown has nothing to count without this.
    expect(body.expiresAt).toBe("2026-08-20T14:30:00.000Z");
    expect(body.createdAt).toBe("2026-08-17T14:30:00.000Z");
  });

  it("decides viewerRole server-side for the renter, the owner and an admin", async () => {
    expect(
      (await (await GET(req(), params("rental-1"))).json()).viewerRole,
    ).toBe("renter");

    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "owner-1" },
      userId: "owner-1",
      isAdmin: false,
    });
    expect(
      (await (await GET(req(), params("rental-1"))).json()).viewerRole,
    ).toBe("owner");

    // An admin is a party to nothing — the screen must not render them as one.
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "admin-1" },
      userId: "admin-1",
      isAdmin: true,
    });
    expect(
      (await (await GET(req(), params("rental-1"))).json()).viewerRole,
    ).toBe("admin");
  });
});

/**
 * Requirements: mobile Req 10.1.1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md § 8A.4
 *
 * The owner's earnings preview (P-E8A-5). The figures come from the columns
 * `calculateRentalPricing` wrote at request creation; the route only inverts
 * that function's own algebra so no client has to.
 */
describe("GET /api/rentals/[id] — owner earnings preview (8A.4)", () => {
  // applicationFee = platformFee + serviceFee → platformFee = 20.00
  // ownerPayout = rentalPrice - platformFee   → rentalPrice = 100.00
  const PRICED = {
    ...RENTAL,
    ownerId: "owner-1",
    totalAmount: "107.50",
    serviceFee: "7.50",
    applicationFeeAmount: "27.50",
    ownerPayout: "80.00",
  };

  const asOwner = () =>
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "owner-1" },
      userId: "owner-1",
      isAdmin: false,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    asOwner();
    mockGetRentalDetailsById.mockResolvedValue(PRICED);
    mockGetRentalAgreementAcceptance.mockResolvedValue(null);
  });

  it("itemizes rental price, platform fee and payout for the owner", async () => {
    const body = await (await GET(req(), params("rental-1"))).json();

    expect(body.earnings).toEqual({
      rentalPrice: "100.00",
      platformFee: "20.00",
      ownerPayout: "80.00",
      platformFeePercent: 20,
    });
  });

  it("splits on integer cents, so a half-cent rate cannot drift", async () => {
    mockGetRentalDetailsById.mockResolvedValue({
      ...PRICED,
      serviceFee: "1.13",
      applicationFeeAmount: "4.11",
      ownerPayout: "11.93",
    });

    const body = await (await GET(req(), params("rental-1"))).json();

    expect(body.earnings.platformFee).toBe("2.98");
    expect(body.earnings.rentalPrice).toBe("14.91");
  });

  // The renter's screen has no business showing what the owner takes home.
  it("withholds the preview from the renter and from an admin", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "renter-1" },
      userId: "renter-1",
      isAdmin: false,
    });
    expect(
      (await (await GET(req(), params("rental-1"))).json()).earnings,
    ).toBeNull();

    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "admin-1" },
      userId: "admin-1",
      isAdmin: true,
    });
    expect(
      (await (await GET(req(), params("rental-1"))).json()).earnings,
    ).toBeNull();
  });

  // A row predating these columns carries "0" in both. Promising an owner
  // $0.00 before an irreversible action is worse than saying "confirmed at
  // approval", which is what a null makes the client do.
  it("returns null rather than $0.00 for a row with no stored split", async () => {
    mockGetRentalDetailsById.mockResolvedValue({
      ...PRICED,
      applicationFeeAmount: "0",
      ownerPayout: "0",
    });

    expect(
      (await (await GET(req(), params("rental-1"))).json()).earnings,
    ).toBeNull();
  });

  it("still reports a genuinely free rental as zero", async () => {
    mockGetRentalDetailsById.mockResolvedValue({
      ...PRICED,
      totalAmount: "0.00",
      serviceFee: "0",
      applicationFeeAmount: "0",
      ownerPayout: "0",
    });

    const body = await (await GET(req(), params("rental-1"))).json();
    expect(body.earnings.ownerPayout).toBe("0.00");
  });

  it("returns null rather than a negative fee if the columns disagree", async () => {
    mockGetRentalDetailsById.mockResolvedValue({
      ...PRICED,
      serviceFee: "50.00",
      applicationFeeAmount: "27.50",
    });

    expect(
      (await (await GET(req(), params("rental-1"))).json()).earnings,
    ).toBeNull();
  });
});
