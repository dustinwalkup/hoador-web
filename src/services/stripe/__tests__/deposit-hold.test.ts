import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthorizeSecurityDeposit = vi.fn();
const mockReleaseSecurityDeposit = vi.fn();

vi.mock("@/services/stripe/rental-payments", () => ({
  authorizeSecurityDeposit: (...args: unknown[]) =>
    mockAuthorizeSecurityDeposit(...args),
  releaseSecurityDeposit: (...args: unknown[]) =>
    mockReleaseSecurityDeposit(...args),
}));

import { placeDepositHold, releaseDepositHold } from "../deposit-hold";

describe("DepositHoldService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParams = {
    rentalId: "rental-1",
    customerId: "cus_123",
    paymentMethodId: "pm_456",
    amount: 200,
    metadata: {
      rentalRequestId: "req-1",
      rentalId: "rental-1",
      listingId: "listing-1",
      renterId: "renter-1",
    },
  };

  describe("placeDepositHold", () => {
    it("creates PaymentIntent via authorizeSecurityDeposit with correct params", async () => {
      mockAuthorizeSecurityDeposit.mockResolvedValue({ id: "pi_dep_123" });

      await placeDepositHold(defaultParams);

      expect(mockAuthorizeSecurityDeposit).toHaveBeenCalledWith(
        "cus_123",
        "pm_456",
        200,
        {
          type: "security_deposit",
          rentalRequestId: "req-1",
          listingId: "listing-1",
          renterId: "renter-1",
        },
        "deposit-hold-rental-1",
      );
    });

    it("uses idempotency key deposit-hold-{rentalId}", async () => {
      mockAuthorizeSecurityDeposit.mockResolvedValue({ id: "pi_dep_123" });

      await placeDepositHold(defaultParams);

      const idempotencyKey = mockAuthorizeSecurityDeposit.mock.calls[0][4];
      expect(idempotencyKey).toBe("deposit-hold-rental-1");
    });

    it("returns { success: true, paymentIntentId } on success", async () => {
      mockAuthorizeSecurityDeposit.mockResolvedValue({ id: "pi_dep_789" });

      const result = await placeDepositHold(defaultParams);

      expect(result).toEqual({ success: true, paymentIntentId: "pi_dep_789" });
    });

    it("returns { success: false, error } on Stripe error", async () => {
      mockAuthorizeSecurityDeposit.mockRejectedValue(
        new Error("Your card was declined."),
      );

      const result = await placeDepositHold(defaultParams);

      expect(result).toEqual({
        success: false,
        error: "Your card was declined.",
      });
    });

    it("returns { success: false, error } on non-Error throw", async () => {
      mockAuthorizeSecurityDeposit.mockRejectedValue("string error");

      const result = await placeDepositHold(defaultParams);

      expect(result).toEqual({
        success: false,
        error: "Unknown deposit hold error",
      });
    });

    it("passes amount in dollars (not cents) to authorizeSecurityDeposit", async () => {
      mockAuthorizeSecurityDeposit.mockResolvedValue({ id: "pi_dep_123" });

      await placeDepositHold({ ...defaultParams, amount: 150.5 });

      expect(mockAuthorizeSecurityDeposit).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        150.5,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("releaseDepositHold", () => {
    it("calls releaseSecurityDeposit with correct PI ID", async () => {
      mockReleaseSecurityDeposit.mockResolvedValue({ id: "pi_dep_123" });

      await releaseDepositHold("pi_dep_123");

      expect(mockReleaseSecurityDeposit).toHaveBeenCalledWith("pi_dep_123");
    });

    it("throws on Stripe API failure", async () => {
      mockReleaseSecurityDeposit.mockRejectedValue(
        new Error("Stripe API error"),
      );

      await expect(releaseDepositHold("pi_dep_123")).rejects.toThrow(
        "Stripe API error",
      );
    });
  });
});
