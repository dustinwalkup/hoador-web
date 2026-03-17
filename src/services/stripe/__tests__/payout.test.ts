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
    totalAmount: 100.0,
    platformFeePercentage: 0.2,
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

    it("calculates transfer amount: totalAmount - platformFee in cents", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $100 total, 20% fee = $20 fee, $80 transfer = 8000 cents
      await createOwnerTransfer(defaultParams);

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(8000);
    });

    it("platform fee = Math.round(totalAmount * 0.2 * 100) cents", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $75.50 total → fee = Math.round(75.50 * 0.2 * 100) = 1510 cents
      // transfer = Math.round(75.50 * 100) - 1510 = 7550 - 1510 = 6040 cents
      await createOwnerTransfer({
        ...defaultParams,
        totalAmount: 75.5,
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

      // $1.00 total, 20% fee = $0.20, transfer = $0.80 = 80 cents
      await createOwnerTransfer({
        ...defaultParams,
        totalAmount: 1.0,
      });

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(80);
    });

    it("handles rounding correctly for fractional cents", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_123" });

      // $33.33 total → fee = Math.round(33.33 * 0.2 * 100) = Math.round(666.6) = 667 cents
      // transfer = Math.round(33.33 * 100) - 667 = 3333 - 667 = 2666 cents
      await createOwnerTransfer({
        ...defaultParams,
        totalAmount: 33.33,
      });

      const createArgs = mockTransfersCreate.mock.calls[0][0];
      expect(createArgs.amount).toBe(2666);
    });
  });
});
