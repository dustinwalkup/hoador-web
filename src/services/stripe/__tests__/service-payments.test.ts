import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";

const mockPaymentIntentsCreate = vi.fn();
const mockTransfersCreate = vi.fn();
const mockIsRetryable = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentIntents: {
      create: (...args: unknown[]) => mockPaymentIntentsCreate(...args),
    },
    transfers: {
      create: (...args: unknown[]) => mockTransfersCreate(...args),
    },
  },
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  isRetryablePaymentError: (e: unknown) => mockIsRetryable(e),
}));

import {
  chargeServicePayment,
  createServiceTransfer,
} from "../service-payments";

describe("service-payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRetryable.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("chargeServicePayment", () => {
    it("creates PaymentIntent with confirm, off_session, no transfer_data", async () => {
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_123",
        status: "succeeded",
        latest_charge: "ch_latest",
      });

      await chargeServicePayment({
        customerId: "cus_1",
        paymentMethodId: "pm_1",
        amount: 110.5,
        metadata: {
          paymentType: "service_charge",
          bookingId: "book-1",
          serviceId: "list-1",
          providerId: "prov-1",
          requesterId: "req-1",
        },
        idempotencyKey: "service-charge-book-1",
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 11050,
          currency: "usd",
          customer: "cus_1",
          payment_method: "pm_1",
          confirm: true,
          off_session: true,
          capture_method: "automatic",
          metadata: expect.objectContaining({
            paymentType: "service_charge",
            bookingId: "book-1",
          }),
        }),
        { idempotencyKey: "service-charge-book-1" },
      );

      const firstArg = mockPaymentIntentsCreate.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(firstArg.transfer_data).toBeUndefined();
      expect(firstArg).not.toHaveProperty("transfer_data");
    });

    it("uses idempotency key format service-charge-{bookingId}", async () => {
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_1",
        latest_charge: "ch_1",
      });

      await chargeServicePayment({
        customerId: "cus",
        paymentMethodId: "pm",
        amount: 10,
        metadata: {
          paymentType: "service_charge",
          bookingId: "uuid-here",
          serviceId: "s",
          providerId: "p",
          requesterId: "r",
        },
        idempotencyKey: "service-charge-uuid-here",
      });

      expect(mockPaymentIntentsCreate.mock.calls[0][1]).toEqual({
        idempotencyKey: "service-charge-uuid-here",
      });
    });

    it("returns chargeId from latest_charge string", async () => {
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_1",
        latest_charge: "ch_from_pi",
      });

      const result = await chargeServicePayment({
        customerId: "cus",
        paymentMethodId: "pm",
        amount: 1,
        metadata: {
          paymentType: "service_charge",
          bookingId: "b",
          serviceId: "s",
          providerId: "p",
          requesterId: "r",
        },
        idempotencyKey: "service-charge-b",
      });

      expect(result.chargeId).toBe("ch_from_pi");
    });

    it("retries once on retryable error", async () => {
      vi.useFakeTimers();
      mockIsRetryable.mockReturnValue(true);
      const rateErr = new Error("rate limit");
      mockPaymentIntentsCreate
        .mockRejectedValueOnce(rateErr)
        .mockResolvedValueOnce({
          id: "pi_ok",
          latest_charge: "ch_ok",
        });

      const p = chargeServicePayment({
        customerId: "cus",
        paymentMethodId: "pm",
        amount: 10,
        metadata: {
          paymentType: "service_charge",
          bookingId: "b",
          serviceId: "s",
          providerId: "p",
          requesterId: "r",
        },
        idempotencyKey: "service-charge-b",
      });

      await vi.advanceTimersByTimeAsync(1000);
      const result = await p;

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(2);
      expect(result.chargeId).toBe("ch_ok");
    });

    it("does not retry when isRetryablePaymentError returns false", async () => {
      mockIsRetryable.mockReturnValue(false);
      mockPaymentIntentsCreate.mockRejectedValue(new Error("card declined"));

      await expect(
        chargeServicePayment({
          customerId: "cus",
          paymentMethodId: "pm",
          amount: 10,
          metadata: {
            paymentType: "service_charge",
            bookingId: "b",
            serviceId: "s",
            providerId: "p",
            requesterId: "r",
          },
          idempotencyKey: "service-charge-b",
        }),
      ).rejects.toThrow("card declined");

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("createServiceTransfer", () => {
    it("uses source_transaction as charge id", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_1" });

      await createServiceTransfer({
        bookingId: "book-1",
        providerConnectedAccountId: "acct_1",
        chargeId: "ch_abc",
        servicePrice: 100,
        idempotencyKey: "service-transfer-book-1",
      });

      expect(mockTransfersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source_transaction: "ch_abc",
          destination: "acct_1",
        }),
        { idempotencyKey: "service-transfer-book-1" },
      );
    });

    it("computes transfer cents as gross minus platform fee on service price", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_1" });

      const servicePrice = 100;
      const grossCents = Math.round(servicePrice * 100);
      const platformFeeCents = Math.round(
        servicePrice * 100 * PLATFORM_FEE_PERCENTAGE,
      );
      const expected = grossCents - platformFeeCents;

      await createServiceTransfer({
        bookingId: "b",
        providerConnectedAccountId: "acct",
        chargeId: "ch",
        servicePrice,
        idempotencyKey: "service-transfer-b",
      });

      const amount = (
        mockTransfersCreate.mock.calls[0][0] as { amount: number }
      ).amount;
      expect(amount).toBe(expected);
    });

    it("returns success with transferId", async () => {
      mockTransfersCreate.mockResolvedValue({ id: "tr_xyz" });

      const result = await createServiceTransfer({
        bookingId: "b",
        providerConnectedAccountId: "acct",
        chargeId: "ch",
        servicePrice: 50,
        idempotencyKey: "service-transfer-b",
      });

      expect(result).toEqual({ success: true, transferId: "tr_xyz" });
    });

    it("returns failure object when transfer throws", async () => {
      mockTransfersCreate.mockRejectedValue(new Error("Stripe down"));

      const result = await createServiceTransfer({
        bookingId: "b",
        providerConnectedAccountId: "acct",
        chargeId: "ch",
        servicePrice: 50,
        idempotencyKey: "service-transfer-b",
      });

      expect(result).toEqual({ success: false, error: "Stripe down" });
    });

    it("returns failure when transfer amount is not positive", async () => {
      const result = await createServiceTransfer({
        bookingId: "b",
        providerConnectedAccountId: "acct",
        chargeId: "ch",
        servicePrice: 0,
        idempotencyKey: "service-transfer-b",
      });

      expect(result.success).toBe(false);
      expect(mockTransfersCreate).not.toHaveBeenCalled();
    });
  });
});
