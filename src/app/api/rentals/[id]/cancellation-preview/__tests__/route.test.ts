import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile Req 9.3.1, 9.3.3, 14.1
 * Design: mobile D-E8A-3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-3)
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

const mockGetRentalRequestById = vi.fn();
const mockGetRentalCancellationContext = vi.fn();
vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: (...a: unknown[]) => mockGetRentalRequestById(...a),
    getRentalCancellationContext: (...a: unknown[]) =>
      mockGetRentalCancellationContext(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

const req = () =>
  new NextRequest("http://localhost/api/rentals/req-1/cancellation-preview");
const params = () => ({ params: Promise.resolve({ id: "req-1" }) });

const request = (over: Record<string, unknown> = {}) => ({
  id: "req-1",
  renterId: "renter-1",
  ownerId: "owner-1",
  status: "approved",
  startDate: hoursFromNow(72),
  ...over,
});

/** rentalPrice 100.00 + serviceFee 7.50 = 107.50 charged. */
const context = (over: Record<string, unknown> = {}) => ({
  rentalRequestId: "req-1",
  rentalId: "rental-1",
  renterId: "renter-1",
  ownerId: "owner-1",
  status: "approved",
  startDate: hoursFromNow(72),
  rentalPrice: "100.00",
  serviceFee: "7.50",
  totalChargeAmount: "107.50",
  depositHoldStatus: "held",
  ...over,
});

const asRenter = () =>
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: "renter-1" },
    userId: "renter-1",
    isAdmin: false,
  });

const preview = async () => {
  const res = await GET(req(), params());
  return { res, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  asRenter();
  mockGetRentalRequestById.mockResolvedValue(request());
  mockGetRentalCancellationContext.mockResolvedValue(context());
});

describe("GET cancellation-preview — refund tiers (Req 9.3.1)", () => {
  it("quotes a full rental-price refund ≥24h before pickup", async () => {
    const { res, body } = await preview();

    expect(res.status).toBe(200);
    expect(body.canCancel).toBe(true);
    expect(body.tier).toBe("full_refund_24h");
    expect(body.refundAmount).toBe("100.00");
    // The service fee is what does NOT come back — stated, not implied.
    expect(body.nonRefundable).toBe("7.50");
  });

  it("quotes half the rental price under 24h", async () => {
    const startDate = hoursFromNow(6);
    mockGetRentalRequestById.mockResolvedValue(request({ startDate }));
    mockGetRentalCancellationContext.mockResolvedValue(context({ startDate }));

    const { body } = await preview();

    expect(body.tier).toBe("half_refund_under_24h");
    expect(body.refundAmount).toBe("50.00");
    expect(body.nonRefundable).toBe("57.50");
  });

  // Req 9.3.1: pending is pre-approval, so nothing was ever charged. Reading the
  // money context here would find nothing anyway — it inner-joins `rentals`.
  it("reports no charge at all on a pending request", async () => {
    mockGetRentalRequestById.mockResolvedValue(request({ status: "pending" }));

    const { body } = await preview();

    expect(body.canCancel).toBe(true);
    expect(body.tier).toBe("pending_no_charge");
    expect(body.refundAmount).toBe("0.00");
    expect(body.totalCharged).toBe("0.00");
    expect(mockGetRentalCancellationContext).not.toHaveBeenCalled();
  });

  // Req 9.3.3 — when the owner cancels, the renter is made whole, service fee
  // included.
  it("refunds the renter in full when the OWNER is cancelling", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "owner-1" },
      userId: "owner-1",
      isAdmin: false,
    });

    const { body } = await preview();

    expect(body.cancelledBy).toBe("owner");
    expect(body.tier).toBe("owner_cancellation");
    expect(body.refundAmount).toBe("107.50");
    expect(body.nonRefundable).toBe("0.00");
  });

  // The renter reads this before an irreversible action; it must never be a
  // device-clock derivation (rule #1 names deadlines explicitly).
  it("reports hours-until-pickup as a server number", async () => {
    const { body } = await preview();

    expect(body.hoursUntilPickup).toBeGreaterThan(71);
    expect(body.hoursUntilPickup).toBeLessThanOrEqual(72);
  });

  // The answer is a snapshot. Without this a renter can sit on the screen while
  // the boundary passes and confirm against a tier that expired as they read it.
  it("says when the quoted tier stops being true", async () => {
    const { body } = await preview();

    const expiresAt = new Date(body.tierExpiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
    // 72h out, the 100% tier survives another ~48 hours.
    expect(expiresAt - Date.now()).toBeLessThan(49 * 60 * 60 * 1000);
  });

  it("has no tier expiry once the last tier is already in force", async () => {
    const startDate = hoursFromNow(6);
    mockGetRentalRequestById.mockResolvedValue(request({ startDate }));
    mockGetRentalCancellationContext.mockResolvedValue(context({ startDate }));

    expect((await preview()).body.tierExpiresAt).toBeNull();
  });
});

describe("GET cancellation-preview — deposit (rule #4)", () => {
  it("reports the hold as released, never refunded", async () => {
    const { body } = await preview();

    expect(body.depositHoldStatus).toBe("held");
    expect(body.depositWillBeReleased).toBe(true);
    // Rule #4 is about the DEPOSIT specifically — `totalCharged` is accurate,
    // because the rental total genuinely was charged. What must never appear is
    // a deposit expressed as money taken rather than a hold released.
    const depositKeys = Object.keys(body).filter((k) => /deposit/i.test(k));
    expect(depositKeys).toEqual(["depositHoldStatus", "depositWillBeReleased"]);
    expect(depositKeys.join(" ")).not.toMatch(/charge|refund/i);
  });

  it("promises no release when there is no hold to release", async () => {
    mockGetRentalCancellationContext.mockResolvedValue(
      context({ depositHoldStatus: "not_applicable" }),
    );

    expect((await preview()).body.depositWillBeReleased).toBe(false);
  });
});

describe("GET cancellation-preview — ineligibility", () => {
  // Req 9.3.1: an active rental cannot be cancelled — early return is not a
  // proration, and there is no tier for it to fall into.
  it("explains an active rental at 200 rather than erroring", async () => {
    mockGetRentalRequestById.mockResolvedValue(request({ status: "active" }));

    const { res, body } = await preview();

    expect(res.status).toBe(200);
    expect(body.canCancel).toBe(false);
    expect(body.code).toBe("ACTIVE_RENTAL");
    expect(body.tier).toBe("unavailable");
    expect(body.reason).toMatch(/not allowed for active rentals/i);
  });

  it.each(["completed", "cancelled", "denied"])(
    "explains a %s rental the same way",
    async (status) => {
      mockGetRentalRequestById.mockResolvedValue(request({ status }));

      const { body } = await preview();

      expect(body.canCancel).toBe(false);
      expect(body.code).toBe("NOT_CANCELLABLE");
    },
  );

  // The owner's route out of a pending request is decline, which carries a
  // reason the renter is told.
  it("sends the owner of a pending request to decline instead", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "owner-1" },
      userId: "owner-1",
      isAdmin: false,
    });
    mockGetRentalRequestById.mockResolvedValue(request({ status: "pending" }));

    const { body } = await preview();

    expect(body.canCancel).toBe(false);
    expect(body.code).toBe("OWNER_MUST_DECLINE");
  });
});

describe("GET cancellation-preview — access", () => {
  it("401s when unauthenticated and reads nothing", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { res } = await preview();

    expect(res.status).toBe(401);
    expect(mockGetRentalRequestById).not.toHaveBeenCalled();
  });

  // A stranger learns nothing about this rental — not even that it exists in a
  // state that cannot be cancelled. The preview must not become a state oracle.
  it("403s a non-party without describing the rental", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "stranger-1" },
      userId: "stranger-1",
      isAdmin: false,
    });

    const { res, body } = await preview();

    expect(res.status).toBe(403);
    expect(body.tier).toBeUndefined();
    expect(body.refundAmount).toBeUndefined();
  });

  it("404s a rental that does not exist", async () => {
    mockGetRentalRequestById.mockResolvedValue(null);

    expect((await preview()).res.status).toBe(404);
  });

  // Approved with no rental row should not happen. Saying so beats quoting a
  // refund from figures we could not read.
  it("409s rather than quoting a refund it could not compute", async () => {
    mockGetRentalCancellationContext.mockResolvedValue(null);

    const { res, body } = await preview();

    expect(res.status).toBe(409);
    expect(body.refundAmount).toBeUndefined();
  });
});
