import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPaymentMethodsAttach = vi.fn();
const mockPaymentMethodsDetach = vi.fn();
const mockCustomersUpdate = vi.fn();
const mockFindFailedDepositsForRenter = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentMethods: {
      attach: (...args: unknown[]) => mockPaymentMethodsAttach(...args),
      detach: (...args: unknown[]) => mockPaymentMethodsDetach(...args),
    },
    customers: {
      update: (...args: unknown[]) => mockCustomersUpdate(...args),
    },
  },
}));

vi.mock("@/dal", () => ({
  paymentLifecycleDAL: {
    findFailedDepositsForRenter: (...args: unknown[]) =>
      mockFindFailedDepositsForRenter(...args),
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
  },
}));

import {
  attachPaymentMethod,
  setDefaultPaymentMethod,
  detachPaymentMethod,
  recoverFailedDeposits,
} from "../payment-method";

describe("PaymentMethodService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFailedDepositsForRenter.mockResolvedValue([]);
  });

  describe("attachPaymentMethod", () => {
    it("calls Stripe paymentMethods.attach with correct params", async () => {
      mockPaymentMethodsAttach.mockResolvedValue({ id: "pm_123" });

      await attachPaymentMethod("cus_123", "pm_456", "renter-1");

      expect(mockPaymentMethodsAttach).toHaveBeenCalledWith("pm_456", {
        customer: "cus_123",
      });
    });

    it("returns the attached payment method", async () => {
      const mockPM = { id: "pm_123", type: "card" };
      mockPaymentMethodsAttach.mockResolvedValue(mockPM);

      const result = await attachPaymentMethod("cus_123", "pm_456", "renter-1");

      expect(result).toEqual(mockPM);
    });

    it("calls recoverFailedDeposits after successful attach", async () => {
      mockPaymentMethodsAttach.mockResolvedValue({ id: "pm_123" });
      const failedDeposits = [
        { rentalId: "rental-1" },
        { rentalId: "rental-2" },
      ];
      mockFindFailedDepositsForRenter.mockResolvedValue(failedDeposits);

      await attachPaymentMethod("cus_123", "pm_456", "renter-1");

      expect(mockFindFailedDepositsForRenter).toHaveBeenCalledWith("renter-1");
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-1",
        "scheduled",
      );
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-2",
        "scheduled",
      );
    });

    it("throws on Stripe API failure", async () => {
      mockPaymentMethodsAttach.mockRejectedValue(new Error("Card declined"));

      await expect(
        attachPaymentMethod("cus_123", "pm_456", "renter-1"),
      ).rejects.toThrow("Card declined");
    });
  });

  describe("setDefaultPaymentMethod", () => {
    it("calls Stripe customers.update with invoice_settings", async () => {
      mockCustomersUpdate.mockResolvedValue({});

      await setDefaultPaymentMethod("cus_123", "pm_456", "renter-1");

      expect(mockCustomersUpdate).toHaveBeenCalledWith("cus_123", {
        invoice_settings: {
          default_payment_method: "pm_456",
        },
      });
    });

    it("calls recoverFailedDeposits after success", async () => {
      mockCustomersUpdate.mockResolvedValue({});
      const failedDeposits = [{ rentalId: "rental-1" }];
      mockFindFailedDepositsForRenter.mockResolvedValue(failedDeposits);

      await setDefaultPaymentMethod("cus_123", "pm_456", "renter-1");

      expect(mockFindFailedDepositsForRenter).toHaveBeenCalledWith("renter-1");
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-1",
        "scheduled",
      );
    });

    it("throws on Stripe API failure", async () => {
      mockCustomersUpdate.mockRejectedValue(new Error("Stripe error"));

      await expect(
        setDefaultPaymentMethod("cus_123", "pm_456", "renter-1"),
      ).rejects.toThrow("Stripe error");
    });
  });

  describe("detachPaymentMethod", () => {
    it("calls Stripe paymentMethods.detach with correct ID", async () => {
      mockPaymentMethodsDetach.mockResolvedValue({});

      await detachPaymentMethod("pm_456");

      expect(mockPaymentMethodsDetach).toHaveBeenCalledWith("pm_456");
    });

    it("throws on Stripe API failure", async () => {
      mockPaymentMethodsDetach.mockRejectedValue(new Error("Not found"));

      await expect(detachPaymentMethod("pm_456")).rejects.toThrow("Not found");
    });
  });

  describe("recoverFailedDeposits", () => {
    it("resets each failed deposit to 'scheduled'", async () => {
      const failedDeposits = [
        { rentalId: "rental-1" },
        { rentalId: "rental-2" },
        { rentalId: "rental-3" },
      ];
      mockFindFailedDepositsForRenter.mockResolvedValue(failedDeposits);

      await recoverFailedDeposits("renter-1");

      expect(mockFindFailedDepositsForRenter).toHaveBeenCalledWith("renter-1");
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledTimes(3);
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-1",
        "scheduled",
      );
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-2",
        "scheduled",
      );
      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-3",
        "scheduled",
      );
    });

    it("does nothing when no failed deposits exist", async () => {
      mockFindFailedDepositsForRenter.mockResolvedValue([]);

      await recoverFailedDeposits("renter-1");

      expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalled();
    });

    it("swallows errors and does not throw", async () => {
      mockFindFailedDepositsForRenter.mockRejectedValue(
        new Error("DB connection error"),
      );

      await expect(recoverFailedDeposits("renter-1")).resolves.toBeUndefined();
    });

    it("swallows errors from updateDepositHoldStatus", async () => {
      mockFindFailedDepositsForRenter.mockResolvedValue([
        { rentalId: "rental-1" },
      ]);
      mockUpdateDepositHoldStatus.mockRejectedValue(new Error("Update failed"));

      await expect(recoverFailedDeposits("renter-1")).resolves.toBeUndefined();
    });
  });
});
