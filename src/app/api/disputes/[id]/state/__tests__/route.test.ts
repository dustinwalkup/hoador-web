import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for PATCH /api/disputes/[id]/state.
 *
 * ⚠️ This route never checks that the caller is an admin, or even a party to
 * the dispute. Its ONLY authorization is `DisputeStateMachine` refusing
 * non-admin transitions — which holds today because every reachable target is
 * in `ADMIN_ONLY_STATES`. The state machine is therefore used for real here
 * (pure logic, no I/O): if a target is ever opened to non-admins, the
 * "non-admin" test below fails and forces the route to grow a party check.
 *
 * Pattern: mock the SESSION layer and the DAL; run the REAL route helpers.
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn(),
  requireAuth: vi.fn(),
}));

const mockDisputeGetById = vi.fn();
const mockUpdateState = vi.fn();
const mockSetAdditionalDeadline = vi.fn();
const mockCreateDisputeAuditLog = vi.fn();
const mockAuditLogCreate = vi.fn();
vi.mock("@/dal", () => ({
  disputeDAL: {
    getById: (...a: unknown[]) => mockDisputeGetById(...a),
    updateState: (...a: unknown[]) => mockUpdateState(...a),
    setAdditionalEvidenceDeadline: (...a: unknown[]) =>
      mockSetAdditionalDeadline(...a),
    createAuditLog: (...a: unknown[]) => mockCreateDisputeAuditLog(...a),
  },
  auditLogDAL: {
    create: (...a: unknown[]) => mockAuditLogCreate(...a),
  },
}));

const mockSendDisputeNotifications = vi.fn();
vi.mock("@/features/disputes/notifications/dispute-notifications", () => ({
  sendDisputeNotifications: (...a: unknown[]) =>
    mockSendDisputeNotifications(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const signedInAs = (userId: string, isAdmin: boolean) => ({
  user: { id: userId },
  userId,
  isAdmin,
});
const ADMIN = signedInAs("user-admin", true);
const PARTY = signedInAs("user-renter", false);

const dispute = (status: string) => ({
  id: "dispute-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  status,
  additionalEvidenceDeadline: null,
});

function patchState(body: unknown) {
  return new NextRequest("http://localhost/api/disputes/dispute-1/state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "dispute-1" }) };

describe("PATCH /api/disputes/[id]/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(ADMIN);
    mockDisputeGetById.mockResolvedValue(dispute("open"));
    mockUpdateState.mockImplementation(
      async (_id: string, newState: string) => ({
        ...dispute(newState),
      }),
    );
    mockSetAdditionalDeadline.mockResolvedValue(undefined);
    mockCreateDisputeAuditLog.mockResolvedValue({});
    mockAuditLogCreate.mockResolvedValue({});
    mockSendDisputeNotifications.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated, without loading the dispute", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { PATCH } = await import("../route");
    const res = await PATCH(patchState({ newState: "under_review" }), ctx);

    expect(res.status).toBe(401);
    expect(mockDisputeGetById).not.toHaveBeenCalled();
  });

  it("returns 400 with details for an unknown state", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(patchState({ newState: "bogus" }), ctx);

    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("details");
    expect(mockUpdateState).not.toHaveBeenCalled();
  });

  it("returns 404 when the dispute does not exist", async () => {
    mockDisputeGetById.mockResolvedValue(null);

    const { PATCH } = await import("../route");
    const res = await PATCH(patchState({ newState: "under_review" }), ctx);

    expect(res.status).toBe(404);
  });

  // The authorization pin (see file header). `resolved` is no longer a target
  // at all (BIZ-05), so it cannot be opened to non-admins by accident here.
  it.each(["evidence_requested", "under_review"])(
    "refuses a non-admin moving an open dispute to %s",
    async (newState) => {
      mockGetAuthenticatedUser.mockResolvedValue(PARTY);

      const { PATCH } = await import("../route");
      const res = await PATCH(patchState({ newState }), ctx);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Admin privileges required/);
      expect(mockUpdateState).not.toHaveBeenCalled();
      expect(mockCreateDisputeAuditLog).not.toHaveBeenCalled();
    },
  );

  it("refuses a non-admin closing a resolved dispute", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(PARTY);
    mockDisputeGetById.mockResolvedValue(dispute("resolved"));

    const { PATCH } = await import("../route");
    const res = await PATCH(patchState({ newState: "closed" }), ctx);

    expect(res.status).toBe(400);
    expect(mockUpdateState).not.toHaveBeenCalled();
  });

  it("refuses an admin leaving a final state", async () => {
    mockDisputeGetById.mockResolvedValue(dispute("closed"));

    const { PATCH } = await import("../route");
    const res = await PATCH(patchState({ newState: "open" }), ctx);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/final state/);
    expect(mockUpdateState).not.toHaveBeenCalled();
  });

  it("escalates to under_review with a 48h evidence deadline and both audit logs", async () => {
    const before = Date.now();

    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchState({ newState: "under_review", reason: "needs review" }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(mockUpdateState).toHaveBeenCalledWith(
      "dispute-1",
      "under_review",
      "user-admin",
      "needs review",
    );
    const [, deadline] = mockSetAdditionalDeadline.mock.calls[0];
    const fortyEightHours = 48 * 60 * 60 * 1000;
    expect((deadline as Date).getTime()).toBeGreaterThanOrEqual(
      before + fortyEightHours,
    );
    expect((deadline as Date).getTime()).toBeLessThanOrEqual(
      Date.now() + fortyEightHours,
    );
    expect(mockCreateDisputeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "state_change",
        previousState: "open",
        newState: "under_review",
      }),
    );
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dispute.escalated" }),
    );
  });

  it("keeps an existing additional-evidence deadline", async () => {
    mockDisputeGetById.mockResolvedValue({
      ...dispute("open"),
      additionalEvidenceDeadline: new Date("2026-03-01T00:00:00Z"),
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(patchState({ newState: "under_review" }), ctx);

    expect(res.status).toBe(200);
    expect(mockSetAdditionalDeadline).not.toHaveBeenCalled();
  });

  it("still succeeds when the evidence-requested notification fails", async () => {
    mockSendDisputeNotifications.mockRejectedValue(new Error("resend down"));

    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchState({ newState: "evidence_requested" }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(mockUpdateState).toHaveBeenCalled();
    expect(mockSendDisputeNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dispute-1" }),
      "evidence_requested",
    );
  });

  // BIZ-05: "resolving" here set the status without capturing or releasing the
  // deposit or unfreezing the owner's transfer, and the payout cron then marked
  // the stranded payout completed. Resolution goes through /resolve only.
  it.each(["open", "evidence_requested", "under_review"])(
    "refuses to resolve a %s dispute, even for an admin",
    async (status) => {
      mockDisputeGetById.mockResolvedValue(dispute(status));

      const { PATCH } = await import("../route");
      const res = await PATCH(patchState({ newState: "resolved" }), ctx);

      expect(res.status).toBe(400);
      expect(await res.json()).toHaveProperty("details");
      expect(mockUpdateState).not.toHaveBeenCalled();
      expect(mockCreateDisputeAuditLog).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    },
  );
});
