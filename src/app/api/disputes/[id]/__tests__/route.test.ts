import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthenticatedUserResponse = vi.fn();
vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
  handleApiError: (error: unknown) =>
    NextResponse.json({ error: String(error) }, { status: 500 }),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const mockDisputeGetById = vi.fn();
const mockGetRentalDetailsById = vi.fn();
const mockServiceBookingGetById = vi.fn();
vi.mock("@/dal", () => ({
  disputeDAL: { getById: (...a: unknown[]) => mockDisputeGetById(...a) },
  rentalDAL: {
    getRentalDetailsById: (...a: unknown[]) => mockGetRentalDetailsById(...a),
  },
  serviceBookingDAL: {
    getById: (...a: unknown[]) => mockServiceBookingGetById(...a),
  },
}));

const RENTER = "user-renter";
const OWNER = "user-owner";
const ADMIN = "user-admin";

const dispute = () => ({
  id: "dispute-1",
  referenceNumber: 7,
  rentalId: "rental-1",
  serviceBookingId: null,
  createdBy: RENTER,
  createdByRole: "renter",
  reasonCode: "damage",
  description: "Broken",
  status: "under_review",
  policyVersion: "v1.0",
  evidenceDeadline: new Date("2026-03-01T00:00:00Z"),
  additionalEvidenceDeadline: null,
  resolvedAt: null,
  resolvedBy: null,
  resolutionOutcome: null,
  resolutionReason: null,
  stripeChargebackId: null,
  createdAt: new Date("2026-02-20T00:00:00Z"),
  updatedAt: new Date("2026-02-20T00:00:00Z"),
  rental: {
    id: "rental-1",
    requestId: "request-1",
    listingId: "listing-1",
    renterId: RENTER,
    ownerId: OWNER,
    listing: { name: "Hammer drill" },
  },
  serviceBooking: null,
  createdByUser: {
    id: RENTER,
    firstName: "Rita",
    lastName: "Renter",
    email: "rita@example.com",
  },
  resolvedByUser: null,
  evidence: [],
  auditLogs: [
    {
      id: "log-1",
      disputeId: "dispute-1",
      actionType: "state_change",
      userId: ADMIN,
      previousState: "open",
      newState: "under_review",
      details: null,
      reason: "Internal: escalating, renter looks opportunistic",
      createdAt: new Date("2026-02-23T00:00:00Z"),
    },
  ],
  internalNotes: [
    {
      id: "note-1",
      disputeId: "dispute-1",
      adminId: ADMIN,
      content: "Third claim this quarter — watch this account.",
      createdAt: new Date("2026-02-22T00:00:00Z"),
      updatedAt: new Date("2026-02-22T00:00:00Z"),
    },
  ],
  financialOperations: [
    {
      id: "fin-1",
      disputeId: "dispute-1",
      operationType: "hold_payout",
      amount: "80.00",
      stripeOperationId: "op_secret",
      stripePaymentIntentId: "pi_secret",
      stripeTransferId: "tr_secret",
      status: "succeeded",
      errorMessage: null,
      performedBy: ADMIN,
      performedAt: new Date("2026-02-20T00:00:00Z"),
    },
  ],
});

const req = () => new NextRequest("http://localhost/api/disputes/dispute-1");
const ctx = { params: Promise.resolve({ id: "dispute-1" }) };

describe("GET /api/disputes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisputeGetById.mockResolvedValue(dispute());
    mockGetRentalDetailsById.mockResolvedValue({
      id: "rental-1",
      renterId: RENTER,
      ownerId: OWNER,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../route");
    expect((await GET(req(), ctx)).status).toBe(401);
  });

  it("returns 404 when the dispute does not exist", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: RENTER,
      isAdmin: false,
    });
    mockDisputeGetById.mockResolvedValue(null);
    const { GET } = await import("../route");
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it("returns 403 for a signed-in non-participant", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "user-stranger",
      isAdmin: false,
    });
    mockGetRentalDetailsById.mockResolvedValue({
      id: "rental-1",
      renterId: RENTER,
      ownerId: OWNER,
    });
    const { GET } = await import("../route");
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  // ── P-E13-2 ────────────────────────────────────────────────────────────────
  //
  // This route used to return `disputeDAL.getById()` verbatim to whoever passed
  // the participation check. These assertions are written against the response
  // BODY rather than the projection function, because the projection being
  // correct and the route calling it are two different facts — and it was the
  // second one that was wrong.
  describe("participant payload", () => {
    beforeEach(() => {
      mockGetAuthenticatedUserResponse.mockResolvedValue({
        userId: RENTER,
        isAdmin: false,
      });
    });

    it("does not send internal notes, audit logs, Stripe ids or emails", async () => {
      const { GET } = await import("../route");
      const body = await (await GET(req(), ctx)).text();

      expect(body).not.toContain("Third claim this quarter");
      expect(body).not.toContain("renter looks opportunistic");
      expect(body).not.toContain("op_secret");
      expect(body).not.toContain("pi_secret");
      expect(body).not.toContain("tr_secret");
      expect(body).not.toContain("rita@example.com");

      const json = JSON.parse(body);
      expect(json).not.toHaveProperty("internalNotes");
      expect(json).not.toHaveProperty("auditLogs");
      expect(json).not.toHaveProperty("createdByUser");
    });

    it("still sends what the dispute screen needs", async () => {
      const { GET } = await import("../route");
      const json = await (await GET(req(), ctx)).json();

      expect(json).toMatchObject({
        id: "dispute-1",
        referenceNumber: 7,
        status: "under_review",
        reasonCode: "damage",
        filedByYou: true,
        subject: { type: "rental", id: "rental-1", name: "Hammer drill" },
      });
      expect(json.timeline).toHaveLength(1);
      expect(json.timeline[0]).toMatchObject({
        type: "state_change",
        actor: "support",
        newState: "under_review",
      });
      expect(json.financialOperations[0]).toMatchObject({
        operationType: "hold_payout",
        amount: "80.00",
        status: "succeeded",
      });
    });
  });

  it("gives an admin the full row plus the timeline", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: ADMIN,
      isAdmin: true,
    });
    const { GET } = await import("../route");
    const json = await (await GET(req(), ctx)).json();

    // The admin UI reads internal notes off this response.
    expect(json.internalNotes).toHaveLength(1);
    expect(json.auditLogs).toHaveLength(1);
    expect(json.financialOperations[0].stripeTransferId).toBe("tr_secret");
    expect(json.timeline).toHaveLength(1);
  });

  it("does not run the participation lookups for an admin", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: ADMIN,
      isAdmin: true,
    });
    const { GET } = await import("../route");
    await GET(req(), ctx);
    expect(mockGetRentalDetailsById).not.toHaveBeenCalled();
  });
});
