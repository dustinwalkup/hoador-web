import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 22.1.2, 22.1.3 (agreement) · mobile Req 11.2, 5.7.6
 * Design: 2-design.md §4.5
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.5 (D-E2-7)
 *       hoador-mobile/specs/mobile-app/tasks/epic-09-service-bookings.md § P-E9-3/4/5
 *
 * The agreement and access-control blocks predate this epic. The rest covers
 * the 2026-08-31 rewrite: the response is now an allow-list rather than a
 * spread of the row, it decides `viewerRole` and `cancelledByRole` server-side,
 * it serializes every instant explicitly, and it composes a provider-only
 * earnings preview from two different sources depending on whether the money
 * has already moved.
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
const mockGetLifecycle = vi.fn();
vi.mock("@/dal", () => ({
  serviceBookingDAL: { getById: (...a: unknown[]) => mockGetById(...a) },
  serviceAgreementDocumentDAL: {
    getByServiceBookingId: (...a: unknown[]) => mockGetByServiceBookingId(...a),
  },
  servicePaymentLifecycleDAL: {
    getByBookingId: (...a: unknown[]) => mockGetLifecycle(...a),
  },
  legalDocumentDAL: {
    getCurrentVersion: (...a: unknown[]) => mockGetCurrentVersion(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

/**
 * A realistic row. The sensitive fields are present *on purpose*: this fixture
 * is what the DAL hands the route, and the point of most tests below is that
 * they do not survive the trip to the wire.
 */
const BOOKING = {
  id: "booking-1",
  listingId: "listing-1",
  requesterId: "requester-1",
  providerId: "provider-1",
  communityId: "community-1",
  proposedDate: "2026-09-02",
  proposedTime: "14:30",
  hours: "3.00",
  notes: "Gate code is 1234",
  declineReason: null,
  servicePrice: "120.00",
  serviceFee: "4.02",
  totalAmount: "124.02",
  status: "pending",
  stripePaymentIntentId: "pi_secret_1",
  stripeChargeId: "ch_secret_1",
  paymentStatus: null,
  refundAmount: null,
  stripeRefundId: "re_secret_1",
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  completedAt: null,
  acceptedAt: null,
  declinedAt: null,
  selectedPaymentMethodId: "pm_secret_1",
  expiresAt: new Date("2026-09-01T10:00:00.000Z"),
  createdAt: new Date("2026-08-29T10:00:00.000Z"),
  updatedAt: new Date("2026-08-29T10:00:00.000Z"),
  listing: {
    id: "listing-1",
    title: "Lawn mowing",
    pricingType: "hourly",
    price: "40.00",
    photos: ["https://blob.hoador.com/services/1.jpg"],
    providerId: "provider-1",
    description: "…",
  },
  requester: {
    id: "requester-1",
    firstName: "Ada",
    lastName: "Lovelace",
    profileImageUrl: null,
    email: "ada@example.com",
  },
  provider: {
    id: "provider-1",
    firstName: "Grace",
    lastName: "Hopper",
    profileImageUrl: null,
    email: "grace@example.com",
  },
  conversationId: "conversation-1",
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () =>
  new NextRequest("http://localhost/api/services/bookings/booking-1");

function setup(overrides: Record<string, unknown> = {}) {
  mockGetById.mockResolvedValue({ ...BOOKING, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetCurrentUserId.mockResolvedValue("requester-1");
  mockGetByServiceBookingId.mockResolvedValue(null);
  mockGetCurrentVersion.mockResolvedValue(null);
  mockGetLifecycle.mockResolvedValue(null);
  setup();
});

describe("GET /api/services/bookings/[id] — agreement serialization", () => {
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

describe("GET /api/services/bookings/[id] — the payload is an allow-list (P-E9-3)", () => {
  it("never ships Stripe identifiers to either party", async () => {
    for (const viewer of ["requester-1", "provider-1"]) {
      mockGetCurrentUserId.mockResolvedValue(viewer);

      const body = await (await GET(req(), params("booking-1"))).json();

      // Asserted over the serialized text, not key-by-key: a nested copy of a
      // charge id is exactly the kind of leak a shape assertion walks past.
      const wire = JSON.stringify(body);
      expect(wire).not.toContain("pi_secret_1");
      expect(wire).not.toContain("ch_secret_1");
      expect(wire).not.toContain("re_secret_1");
      expect(wire).not.toContain("pm_secret_1");
    }
  });

  it("never ships either party's email address", async () => {
    const body = await (await GET(req(), params("booking-1"))).json();

    const wire = JSON.stringify(body);
    expect(wire).not.toContain("ada@example.com");
    expect(wire).not.toContain("grace@example.com");
    expect(body.requester).toEqual({
      id: "requester-1",
      firstName: "Ada",
      lastName: "Lovelace",
      profileImageUrl: null,
    });
  });

  it("does not leak a column added to the table later", async () => {
    // The regression the allow-list exists to prevent: a spread would carry
    // this through untouched, and nobody would notice until it was in a binary.
    setup({ stripeSubscriptionId: "sub_secret_9", internalRiskScore: 0.97 });

    const wire = JSON.stringify(
      await (await GET(req(), params("booking-1"))).json(),
    );

    expect(wire).not.toContain("sub_secret_9");
    expect(wire).not.toContain("0.97");
  });

  it("keeps what the detail screen actually needs", async () => {
    const body = await (await GET(req(), params("booking-1"))).json();

    expect(body).toMatchObject({
      id: "booking-1",
      listingId: "listing-1",
      proposedTime: "14:30",
      hours: "3.00",
      notes: "Gate code is 1234",
      servicePrice: "120.00",
      serviceFee: "4.02",
      totalAmount: "124.02",
      status: "pending",
      conversationId: "conversation-1",
      listing: { id: "listing-1", title: "Lawn mowing", price: "40.00" },
    });
  });
});

describe("GET /api/services/bookings/[id] — viewerRole and cancelledByRole", () => {
  it("names the side the viewer is on, server-side", async () => {
    mockGetCurrentUserId.mockResolvedValue("requester-1");
    expect(
      (await (await GET(req(), params("booking-1"))).json()).viewerRole,
    ).toBe("requester");

    mockGetCurrentUserId.mockResolvedValue("provider-1");
    expect(
      (await (await GET(req(), params("booking-1"))).json()).viewerRole,
    ).toBe("provider");
  });

  it("reports who cancelled as a role, never as a raw id", async () => {
    setup({
      status: "cancelled",
      cancelledBy: "provider-1",
      cancelledAt: new Date("2026-08-30T09:00:00.000Z"),
    });

    const body = await (await GET(req(), params("booking-1"))).json();

    // Req 11.2.6: a provider cancellation is a full refund, so the client must
    // be told which one this was without comparing ids itself.
    expect(body.cancelledByRole).toBe("provider");
    expect(body.cancelledAt).toBe("2026-08-30T09:00:00.000Z");
  });

  it("is null for a booking nobody cancelled", async () => {
    expect(
      (await (await GET(req(), params("booking-1"))).json()).cancelledByRole,
    ).toBeNull();
  });
});

describe("GET /api/services/bookings/[id] — the wire form of every date", () => {
  it("passes the proposed day through as a wall clock, unshifted", async () => {
    const body = await (await GET(req(), params("booking-1"))).json();

    // The R-8.7 / P-E8A-4 bug in its third possible home. A `date` column is a
    // day; serializing it as an instant renders the PREVIOUS day for every
    // client behind UTC, and is correct in UTC — so CI would never show it.
    expect(body.proposedDate).toBe("2026-09-02");
    expect(body.proposedTime).toBe("14:30");
  });

  it("still emits a day if the driver ever hands the route a Date", async () => {
    // Two call sites in this repo hedge about this type. If they turn out to be
    // right, the day must not silently become UTC midnight.
    setup({ proposedDate: new Date(2026, 8, 2, 0, 0, 0) });

    const body = await (await GET(req(), params("booking-1"))).json();

    expect(body.proposedDate).toBe("2026-09-02");
  });

  it("emits genuine instants as ISO, and absent ones as null", async () => {
    setup({
      status: "accepted",
      acceptedAt: new Date("2026-08-30T15:00:00.000Z"),
    });

    const body = await (await GET(req(), params("booking-1"))).json();

    expect(body.createdAt).toBe("2026-08-29T10:00:00.000Z");
    expect(body.expiresAt).toBe("2026-09-01T10:00:00.000Z");
    expect(body.acceptedAt).toBe("2026-08-30T15:00:00.000Z");
    expect(body.declinedAt).toBeNull();
    expect(body.completedAt).toBeNull();
  });
});

describe("GET /api/services/bookings/[id] — provider earnings (P-E9-5)", () => {
  it("quotes the payout forward before the booking is charged", async () => {
    mockGetCurrentUserId.mockResolvedValue("provider-1");

    const body = await (await GET(req(), params("booking-1"))).json();

    // 20% of the $120 service price. The client is charged $124.02 — the
    // service fee is on top and is not part of what the provider is paid on.
    expect(body.earnings).toEqual({
      servicePrice: "120.00",
      platformFee: "24.00",
      providerPayout: "96.00",
      platformFeePercent: 20,
    });
  });

  it("uses the STORED payout once the money has moved", async () => {
    mockGetCurrentUserId.mockResolvedValue("provider-1");
    setup({ status: "accepted" });
    // Deliberately not 20% of $120: a booking charged under an older platform
    // rate. Re-deriving would quote today's rules for yesterday's booking.
    mockGetLifecycle.mockResolvedValue({ providerPayout: "102.00" });

    const body = await (await GET(req(), params("booking-1"))).json();

    expect(body.earnings).toEqual({
      servicePrice: "120.00",
      platformFee: "18.00",
      providerPayout: "102.00",
      platformFeePercent: 20,
    });
  });

  it("returns null — not $0.00 — for a charged booking with no lifecycle row", async () => {
    mockGetCurrentUserId.mockResolvedValue("provider-1");
    setup({ status: "completed" });
    mockGetLifecycle.mockResolvedValue(null);

    expect(
      (await (await GET(req(), params("booking-1"))).json()).earnings,
    ).toBeNull();
  });

  it("shows the requester nothing, and does not even look it up", async () => {
    mockGetCurrentUserId.mockResolvedValue("requester-1");

    const body = await (await GET(req(), params("booking-1"))).json();

    expect(body.earnings).toBeNull();
    expect(mockGetLifecycle).not.toHaveBeenCalled();
  });

  it("degrades to the forward quote when the lifecycle lookup throws", async () => {
    mockGetCurrentUserId.mockResolvedValue("provider-1");
    mockGetLifecycle.mockRejectedValue(new Error("db down"));

    const res = await GET(req(), params("booking-1"));

    expect(res.status).toBe(200);
    expect((await res.json()).earnings?.providerPayout).toBe("96.00");
  });

  it("keeps the split off floats", async () => {
    mockGetCurrentUserId.mockResolvedValue("provider-1");
    setup({ servicePrice: "33.33" });

    const body = await (await GET(req(), params("booking-1"))).json();

    // 33.33 × 0.8 = 26.664 in float arithmetic; the answer must be the same
    // one `acceptBooking` will store, to the cent.
    expect(body.earnings).toEqual({
      servicePrice: "33.33",
      platformFee: "6.67",
      providerPayout: "26.66",
      platformFeePercent: 20,
    });
  });
});
