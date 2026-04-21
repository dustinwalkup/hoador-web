import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTransfersCreate = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    transfers: {
      create: (...args: unknown[]) => mockTransfersCreate(...args),
    },
  },
}));

import { createOwnerTransfer } from "../payout";

describe("PayoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParams = {
    rentalId: "rental-1",
    rentalRequestId: "req-1",
    ownerId: "owner-1",
    ownerConnectedAccountId: "acct_123",
    rentalChargeId: "ch_abc",
    ownerPayoutAmount: 80.0,
  };

  describe("createOwnerTransfer", () => {
    it("calls stripe.transfers.create() with correct params", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer(defaultParams);

      expect(mockTransfersCreate).toHaveBeenCalledWith(
        {
          amount: 8000,
          currency: "usd",
          destination: "acct_123",
          source_transaction: "ch_abc",
          metadata: {
            rentalId: "rental-1",
            rentalRequestId: "req-1",
            ownerId: "owner-1",
          },
        },
        { idempotencyKey: "transfer-owner-rental-1" },
      );
    });

    it("sets source_transaction to Charge ID (not PI ID)", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer({
        ...defaultParams,
        rentalChargeId: "ch_real_charge",
      });

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.source_transaction).toBe("ch_real_charge");
    });

    it("sets destination to owner's Connected Account ID", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer(defaultParams);

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.destination).toBe("acct_123");
    });

    it("calculates transfer amount from ownerPayoutAmount in cents", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $80 owner payout = 8000 cents
      await createOwnerTransfer(defaultParams);

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(8000);
    });

    it("rounds ownerPayoutAmount dollars to transfer cents", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $60.40 owner payout = 6040 cents
      await createOwnerTransfer({
        ...defaultParams,
        ownerPayoutAmount: 60.4,
      });

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(6040);
    });

    it("uses idempotency key transfer-owner-{rentalId}", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer(defaultParams);

      const options = mockTransfersCreate.mock.calls[0][1];
      expect(options).toEqual({ idempotencyKey: "transfer-owner-rental-1" });
    });

    it("uses idempotency key transfer-owner-{rentalId} when retryCount is 0", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer({ ...defaultParams, retryCount: 0 });

      const options = mockTransfersCreate.mock.calls[0][1];
      expect(options).toEqual({ idempotencyKey: "transfer-owner-rental-1" });
    });

    it("appends -retry-{count} to idempotency key when retryCount > 0", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer({ ...defaultParams, retryCount: 2 });

      const options = mockTransfersCreate.mock.calls[0][1];
      expect(options).toEqual({
        idempotencyKey: "transfer-owner-rental-1-retry-2",
      });
    });

    it("includes metadata: rentalId, rentalRequestId, ownerId", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      await createOwnerTransfer(defaultParams);

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.metadata).toEqual({
        rentalId: "rental-1",
        rentalRequestId: "req-1",
        ownerId: "owner-1",
      });
    });

    it("returns { success: true, transferId } on success", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_456" });

      const result = await createOwnerTransfer(defaultParams);

      expect(result).toEqual({ success: true, transferId: "tr_456" });
    });

    it("returns { success: false, error } on Stripe failure", async () => {
      mockTransfersCreate.mockRejectedValue(
        new Error("Insufficient funds in platform account"),
      );

      const result = await createOwnerTransfer(defaultParams);

      expect(result).toEqual({
        success: false,
        error: "Insufficient funds in platform account",
      });
    });

    it("handles edge case: small transfer amounts correctly", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $0.80 owner payout = 80 cents
      await createOwnerTransfer({
        ...defaultParams,
        ownerPayoutAmount: 0.8,
      });

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(80);
    });

    it("handles rounding correctly for fractional cents", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $26.66 owner payout = 2666 cents
      await createOwnerTransfer({
        ...defaultParams,
        ownerPayoutAmount: 26.66,
      });

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(2666);
    });
  });
});
