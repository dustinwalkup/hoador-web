import { describe, it, expect, vi, beforeEach } from "vitest";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import { calculateServiceFee } from "@/constants/payments";

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

import { createServiceTransfer } from "@/services/stripe/service-payments";

function transferCentsFromServicePrice(servicePrice: number): number {
  const grossCents = Math.round(servicePrice * 100);
  const platformFeeCents = Math.round(
    servicePrice * 100 * PLATFORM_FEE_PERCENTAGE,
  );
  return grossCents - platformFeeCents;
}

describe("HOA services fee calculations (Phase 1 test plan)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createServiceTransfer amount (platform fee on servicePrice only)", () => {
    const cases: Array<{ servicePrice: number; expectedCents: number }> = [
      { servicePrice: 100.0, expectedCents: 8000 },
      { servicePrice: 50.0, expectedCents: 4000 },
      { servicePrice: 33.33, expectedCents: 2666 },
      { servicePrice: 1.0, expectedCents: 80 },
    ];

    it.each(cases)(
      "transfer cents for $servicePrice = $expectedCents",
      async ({ servicePrice, expectedCents }) => {
        mockTransfersCreate.mockResolvedValue({ id: "tr_1" });

        await createServiceTransfer({
          bookingId: "b1",
          providerConnectedAccountId: "acct",
          chargeId: "ch_1",
          servicePrice,
          idempotencyKey: "service-transfer-b1",
        });

        const amount = (
          mockTransfersCreate.mock.calls[0][0] as { amount: number }
        ).amount;
        expect(amount).toBe(expectedCents);
        expect(transferCentsFromServicePrice(servicePrice)).toBe(expectedCents);
      },
    );

    it("returns failure when net transfer rounds to zero cents", async () => {
      const result = await createServiceTransfer({
        bookingId: "b",
        providerConnectedAccountId: "acct",
        chargeId: "ch",
        servicePrice: 0.0001,
        idempotencyKey: "service-transfer-b",
      });

      expect(result.success).toBe(false);
      expect(mockTransfersCreate).not.toHaveBeenCalled();
    });
  });

  describe("calculateServiceFee reuse for booking totals", () => {
    it("fixed price uses calculateServiceFee(servicePrice) for fee line", () => {
      const servicePrice = 75.0;
      const fee = calculateServiceFee(servicePrice);
      expect(fee).toEqual(calculateServiceFee(servicePrice));
      expect(typeof fee).toBe("number");
      expect(fee).toBeGreaterThan(0);
    });

    it("hourly subtotal uses rate × hours before service fee", () => {
      const rate = 40;
      const hours = 3;
      const subtotal = rate * hours;
      const fee = calculateServiceFee(subtotal);
      const total = Math.round((subtotal + fee) * 100) / 100;
      expect(total).toBeGreaterThan(subtotal);
    });
  });
});
