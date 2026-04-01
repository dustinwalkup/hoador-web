import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicePaymentLifecycleService } from "../services/service-payment-lifecycle-service";

const mockFindEligible = vi.fn();
const mockClaim = vi.fn();
const mockUpdatePayout = vi.fn();
const mockUpdateOwnerTransfer = vi.fn();
const mockGetById = vi.fn();
const mockCreateTransfer = vi.fn();
const mockSendOpsAlert = vi.fn();
const mockSendPayoutNotif = vi.fn();

vi.mock("@/dal", () => ({
  servicePaymentLifecycleDAL: {
    findEligibleForPayout: (...a: unknown[]) => mockFindEligible(...a),
    claimForProcessing: (...a: unknown[]) => mockClaim(...a),
    updatePayoutStatus: (...a: unknown[]) => mockUpdatePayout(...a),
    updateOwnerTransferStatus: (...a: unknown[]) =>
      mockUpdateOwnerTransfer(...a),
  },
  serviceBookingDAL: {
    getById: (...a: unknown[]) => mockGetById(...a),
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

const baseLifecycle = {
  id: "spl-1",
  bookingId: "b1",
  chargeId: "ch_1",
  providerPayout: "80.00",
  ownerTransferStatus: "pending" as const,
  payoutStatus: "pending" as const,
  stripeTransferId: null as string | null,
  ownerTransferredAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseRow = {
  lifecycle: baseLifecycle,
  bookingId: "b1",
  providerId: "prov-1",
  providerPayout: "80.00",
  providerConnectedAccountId: "acct_1",
};

describe("ServicePaymentLifecycleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero summary when no eligible bookings", async () => {
    mockFindEligible.mockResolvedValue([]);

    const summary = await ServicePaymentLifecycleService.processPayouts(20);

    expect(summary).toEqual({
      eligible: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  it("queries eligible rows with 24h cutoff and batch size", async () => {
    mockFindEligible.mockResolvedValue([]);
    await ServicePaymentLifecycleService.processPayouts(5);

    expect(mockFindEligible).toHaveBeenCalledWith(expect.any(Date), 5);
    const cutoff = mockFindEligible.mock.calls[0][0] as Date;
    const delta = Date.now() - cutoff.getTime();
    expect(delta).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(delta).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it("skips booking when claim returns false", async () => {
    mockFindEligible.mockResolvedValue([{ ...baseRow, bookingId: "skip-me" }]);
    mockClaim.mockResolvedValue(false);

    const summary = await ServicePaymentLifecycleService.processPayouts(10);

    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it("marks failed and alerts when connect or charge missing", async () => {
    mockFindEligible.mockResolvedValue([
      {
        ...baseRow,
        providerConnectedAccountId: null,
        lifecycle: { ...baseLifecycle, chargeId: "ch_1" },
      },
    ]);
    mockClaim.mockResolvedValue(true);

    const summary = await ServicePaymentLifecycleService.processPayouts(10);

    expect(mockUpdatePayout).toHaveBeenCalledWith("b1", "failed");
    expect(mockSendOpsAlert).toHaveBeenCalled();
    expect(summary.failed).toBe(1);
  });

  it("on successful transfer updates lifecycle and notifies provider", async () => {
    mockFindEligible.mockResolvedValue([baseRow]);
    mockClaim.mockResolvedValue(true);
    mockCreateTransfer.mockResolvedValue({ success: true, transferId: "tr_1" });
    const bookingDetail = {
      id: "b1",
      listingId: "l1",
      providerId: "prov-1",
      totalAmount: "80.00",
      servicePrice: "80.00",
    };
    mockGetById.mockResolvedValue(bookingDetail);

    const summary = await ServicePaymentLifecycleService.processPayouts(10);

    expect(mockCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "service-transfer-b1",
        chargeId: "ch_1",
        providerPayoutAmount: 80,
      }),
    );
    expect(mockUpdateOwnerTransfer).toHaveBeenCalledWith(
      "b1",
      "completed",
      expect.objectContaining({
        stripeTransferId: "tr_1",
      }),
    );
    expect(mockUpdatePayout).toHaveBeenCalledWith("b1", "completed");
    expect(mockSendPayoutNotif).toHaveBeenCalledWith("prov-1", bookingDetail);
    expect(summary.succeeded).toBe(1);
  });

  it("counts transfer failure without throwing; continues batch", async () => {
    mockFindEligible.mockResolvedValue([
      { ...baseRow, bookingId: "b1" },
      {
        ...baseRow,
        bookingId: "b2",
        lifecycle: { ...baseLifecycle, bookingId: "b2" },
      },
    ]);
    mockClaim.mockResolvedValue(true);
    mockCreateTransfer
      .mockResolvedValueOnce({ success: false, error: "bad" })
      .mockResolvedValueOnce({ success: true, transferId: "tr_2" });
    mockGetById.mockResolvedValue({ id: "b2" });

    const summary = await ServicePaymentLifecycleService.processPayouts(10);

    expect(summary.processed).toBe(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(mockSendOpsAlert).toHaveBeenCalled();
  });
});
