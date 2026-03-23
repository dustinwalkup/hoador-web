import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicePayoutService } from "../services/service-payout-service";

const mockFindEligible = vi.fn();
const mockClaim = vi.fn();
const mockUpdate = vi.fn();
const mockCreateTransfer = vi.fn();
const mockSendOpsAlert = vi.fn();
const mockSendPayoutNotif = vi.fn();

vi.mock("@/dal", () => ({
  serviceBookingDAL: {
    findEligibleForPayout: (...a: unknown[]) => mockFindEligible(...a),
    claimForPayoutProcessing: (...a: unknown[]) => mockClaim(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
  },
}));

vi.mock("@/services/stripe/service-payments", () => ({
  createServiceTransfer: (...a: unknown[]) => mockCreateTransfer(...a),
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...a: unknown[]) => mockSendOpsAlert(...a),
}));

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendServicePayoutNotification: (...a: unknown[]) => mockSendPayoutNotif(...a),
}));

const baseRow = {
  id: "b1",
  providerId: "prov-1",
  servicePrice: "80.00",
  stripeChargeId: "ch_1",
  providerConnectedAccountId: "acct_1",
  completedAt: new Date("2025-01-01T00:00:00Z"),
  payoutStatus: "pending" as const,
};

describe("ServicePayoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero summary when no eligible bookings", async () => {
    mockFindEligible.mockResolvedValue([]);

    const summary = await ServicePayoutService.processPayouts(20);

    expect(summary).toEqual({
      eligible: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  it("queries eligible rows with 24h cutoff and batch size", async () => {
    mockFindEligible.mockResolvedValue([]);
    await ServicePayoutService.processPayouts(5);

    expect(mockFindEligible).toHaveBeenCalledWith(expect.any(Date), 5);
    const cutoff = mockFindEligible.mock.calls[0][0] as Date;
    const delta = Date.now() - cutoff.getTime();
    expect(delta).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(delta).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it("skips booking when claim returns false", async () => {
    mockFindEligible.mockResolvedValue([{ ...baseRow, id: "skip-me" }]);
    mockClaim.mockResolvedValue(false);

    const summary = await ServicePayoutService.processPayouts(10);

    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it("marks failed and alerts when connect or charge missing", async () => {
    mockFindEligible.mockResolvedValue([
      {
        ...baseRow,
        providerConnectedAccountId: null,
        stripeChargeId: "ch_1",
      },
    ]);
    mockClaim.mockResolvedValue(true);

    const summary = await ServicePayoutService.processPayouts(10);

    expect(mockUpdate).toHaveBeenCalledWith("b1", { payoutStatus: "failed" });
    expect(mockSendOpsAlert).toHaveBeenCalled();
    expect(summary.failed).toBe(1);
  });

  it("on successful transfer updates booking and notifies provider", async () => {
    mockFindEligible.mockResolvedValue([baseRow]);
    mockClaim.mockResolvedValue(true);
    mockCreateTransfer.mockResolvedValue({ success: true, transferId: "tr_1" });
    const updated = { ...baseRow, payoutStatus: "completed" as const };
    mockUpdate.mockResolvedValue(updated);

    const summary = await ServicePayoutService.processPayouts(10);

    expect(mockCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "service-transfer-b1",
        chargeId: "ch_1",
      }),
    );
    expect(mockSendPayoutNotif).toHaveBeenCalledWith("prov-1", updated);
    expect(summary.succeeded).toBe(1);
  });

  it("counts transfer failure without throwing; continues batch", async () => {
    mockFindEligible.mockResolvedValue([
      { ...baseRow, id: "b1" },
      { ...baseRow, id: "b2" },
    ]);
    mockClaim.mockResolvedValue(true);
    mockCreateTransfer
      .mockResolvedValueOnce({ success: false, error: "bad" })
      .mockResolvedValueOnce({ success: true, transferId: "tr_2" });
    mockUpdate.mockImplementation(
      async (id: string, data: { payoutStatus: string }) => ({
        ...baseRow,
        id,
        ...data,
      }),
    );

    const summary = await ServicePayoutService.processPayouts(10);

    expect(summary.processed).toBe(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(mockSendOpsAlert).toHaveBeenCalled();
  });
});
