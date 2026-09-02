import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile Req 11.1.5 · decision D-E9-3 · prerequisite P-E9-2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-09-service-bookings.md
 *
 * The preview must answer with the same numbers `cancelBooking` will act on.
 * Those three functions are unit-tested next to themselves; what is asserted
 * here is the wiring, the access rules, and the shape the app parses.
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
const mockGetActiveDispute = vi.fn();
vi.mock("@/dal", () => ({
  serviceBookingDAL: { getById: (...a: unknown[]) => mockGetById(...a) },
  disputeDAL: {
    getActiveByServiceBookingId: (...a: unknown[]) =>
      mockGetActiveDispute(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

// 14:00 on Dec 20 in Chicago = 20:00Z (CST, UTC-6).
const ACCEPTED = {
  id: "booking-1",
  requesterId: "requester-1",
  providerId: "provider-1",
  status: "accepted",
  stripeChargeId: "ch_1",
  servicePrice: "120.00",
  serviceFee: "4.02",
  totalAmount: "124.02",
  proposedDate: "2025-12-20",
  proposedTime: "14:00",
};

const params = () => ({ params: Promise.resolve({ id: "booking-1" }) });
const req = () =>
  new NextRequest(
    "http://localhost/api/services/bookings/booking-1/cancellation-preview",
  );

const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetCurrentUserId.mockResolvedValue("requester-1");
  mockGetById.mockResolvedValue(ACCEPTED);
  mockGetActiveDispute.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET .../cancellation-preview — access", () => {
  it("401s when unauthenticated", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    expect((await GET(req(), params())).status).toBe(401);
  });

  it("404s a booking that does not exist", async () => {
    mockGetById.mockResolvedValue(null);

    expect((await GET(req(), params())).status).toBe(404);
  });

  it("403s a stranger, and never becomes a state oracle", async () => {
    mockGetCurrentUserId.mockResolvedValue("stranger-1");

    const res = await GET(req(), params());
    const body = await res.json();

    expect(res.status).toBe(403);
    // Not even the tier leaks — a 200 with `canCancel: false` would tell a
    // stranger the booking exists and what state it is in.
    expect(body.tier).toBeUndefined();
    expect(body.status).toBeUndefined();
  });

  it("does not probe a stranger’s booking for disputes", async () => {
    mockGetCurrentUserId.mockResolvedValue("stranger-1");

    await GET(req(), params());

    expect(mockGetActiveDispute).not.toHaveBeenCalled();
  });
});

describe("GET .../cancellation-preview — the refund tiers (Req 11.1.5)", () => {
  it("quotes a FULL refund more than 24 hours out, service fee included", async () => {
    at("2025-12-19T17:00:00Z"); // 27 real hours before the job

    const body = await (await GET(req(), params())).json();

    expect(body).toMatchObject({
      canCancel: true,
      cancelledBy: "requester",
      tier: "full_refund_24h",
      refundAmount: "124.02",
      nonRefundable: "0.00",
      providerTransfer: "0.00",
    });
  });

  it("is the market zone that decides that, not the server’s (F4)", async () => {
    // The job is 20:00Z. At 17:00Z on the 19th the client is 27 hours out and
    // owed everything. Reading the wall clock as server-local — UTC here —
    // makes the job 14:00Z, puts them 21 hours out, and charges the 50% tier.
    at("2025-12-19T17:00:00Z");

    const body = await (await GET(req(), params())).json();

    expect(body.tier).toBe("full_refund_24h");
    expect(body.hoursUntilService).toBe(27);
  });

  it("quotes HALF the service price inside 24 hours — not half the total", async () => {
    at("2025-12-20T13:00:00Z"); // 7 hours before the job

    const body = await (await GET(req(), params())).json();

    expect(body).toMatchObject({
      tier: "half_refund_under_24h",
      refundAmount: "60.00",
      nonRefundable: "64.02",
    });
    // The finding that makes rental copy untransferable: half of the TOTAL
    // would be $62.01, and the service fee is retained on this tier.
    expect(body.refundAmount).not.toBe("62.01");
  });

  it("discloses the provider’s share of a late cancellation", async () => {
    at("2025-12-20T13:00:00Z");

    // 50% retained less the platform's 20% = 30% of $120.00. Real money
    // moving, which until now nobody was told about.
    expect((await (await GET(req(), params())).json()).providerTransfer).toBe(
      "36.00",
    );
  });

  it("makes the client whole whenever the PROVIDER cancels", async () => {
    at("2025-12-20T13:00:00Z"); // inside 24h, and it makes no difference
    mockGetCurrentUserId.mockResolvedValue("provider-1");

    const body = await (await GET(req(), params())).json();

    expect(body).toMatchObject({
      cancelledBy: "provider",
      tier: "provider_cancellation",
      refundAmount: "124.02",
      providerTransfer: "0.00",
    });
  });

  it("charges nothing on a pending booking", async () => {
    mockGetById.mockResolvedValue({
      ...ACCEPTED,
      status: "pending",
      stripeChargeId: null,
    });

    const body = await (await GET(req(), params())).json();

    expect(body).toMatchObject({
      tier: "pending_no_charge",
      refundAmount: "0.00",
      nonRefundable: "0.00",
    });
  });
});

describe("GET .../cancellation-preview — tierExpiresAt", () => {
  it("names the moment the quoted tier stops being true", async () => {
    at("2025-12-19T17:00:00Z");

    // 24 hours before the job (20:00Z on the 20th).
    expect((await (await GET(req(), params())).json()).tierExpiresAt).toBe(
      "2025-12-19T20:00:00.000Z",
    );
  });

  it("is null once the boundary has passed — there is no lower tier to fall to", async () => {
    at("2025-12-20T13:00:00Z");

    expect(
      (await (await GET(req(), params())).json()).tierExpiresAt,
    ).toBeNull();
  });
});

describe("GET .../cancellation-preview — refusals are the answer, not an error", () => {
  it("200s with the reason for a booking that cannot be cancelled", async () => {
    mockGetById.mockResolvedValue({ ...ACCEPTED, status: "completed" });

    const res = await GET(req(), params());
    const body = await res.json();

    // The client asked "what would cancelling cost"; "you cannot" is that
    // answer, and the reason is the useful part of it.
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      canCancel: false,
      code: "NOT_CANCELLABLE",
      tier: "unavailable",
    });
    expect(body.refundAmount).toBeUndefined();
  });

  it("200s with the dispute reason, in the action’s own words", async () => {
    mockGetActiveDispute.mockResolvedValue({ id: "dispute-1" });

    const body = await (await GET(req(), params())).json();

    expect(body).toMatchObject({ canCancel: false, code: "ACTIVE_DISPUTE" });
    expect(body.reason).toBe(
      "Cannot cancel a booking with an active dispute. Resolve the dispute first.",
    );
  });
});
