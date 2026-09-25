import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEC-07 / PRIV-04: the booking list used to spread the full DAL row, handing
 * a provider the requester's `pm_` id (enough to detach their card) plus every
 * Stripe id and the counterparty's email.
 */

// Mock the session module, not route-helpers, so the real auth path runs.
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    user: { id: "prov-1", status: "active" },
    userId: "prov-1",
    isAdmin: false,
  }),
  getCurrentUserId: vi.fn().mockResolvedValue("prov-1"),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

vi.mock("@/features/services/services/service-booking-service", () => ({
  ServiceBookingService: {},
}));

const mockFindByProvider = vi.fn();
const mockFindByRequester = vi.fn();
vi.mock("@/dal", () => ({
  serviceBookingDAL: {
    findByProviderForDashboard: (...a: unknown[]) => mockFindByProvider(...a),
    findByRequesterForDashboard: (...a: unknown[]) => mockFindByRequester(...a),
  },
}));

const dalRow = {
  id: "book-1",
  listingId: "list-1",
  requesterId: "req-1",
  providerId: "prov-1",
  status: "accepted",
  proposedDate: "2026-10-01",
  proposedTime: "09:00",
  totalAmount: "55.00",
  stripePaymentIntentId: "pi_secret",
  stripeChargeId: "ch_secret",
  stripeRefundId: "re_secret",
  selectedPaymentMethodId: "pm_secret",
  listingTitle: "Lawn mowing",
  // What an older DAL (or a future regression) would still send.
  counterparty: {
    id: "req-1",
    firstName: "Sam",
    lastName: "Client",
    profileImageUrl: null,
    email: "sam@example.com",
  },
};

const list = (role: string) =>
  new NextRequest(`http://localhost/api/services/bookings?role=${role}`);

describe("GET /api/services/bookings (SEC-07 / PRIV-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByProvider.mockResolvedValue([dalRow]);
    mockFindByRequester.mockResolvedValue([dalRow]);
  });

  it.each(["provider", "requester"])(
    "sends no email or Stripe id as the %s",
    async (role) => {
      const { GET } = await import("../route");
      const res = await GET(list(role));
      const raw = await res.text();

      expect(res.status).toBe(200);
      expect(raw).not.toMatch(
        /@|pi_|ch_|re_|pm_|stripePaymentIntentId|stripeChargeId|stripeRefundId|selectedPaymentMethodId/,
      );
    },
  );

  it("keeps what the web cards read", async () => {
    const { GET } = await import("../route");
    const body = await (await GET(list("provider"))).json();

    expect(body.bookings[0]).toMatchObject({
      id: "book-1",
      status: "accepted",
      listingTitle: "Lawn mowing",
      totalAmount: "55.00",
      counterparty: { firstName: "Sam", lastName: "Client" },
    });
  });
});
