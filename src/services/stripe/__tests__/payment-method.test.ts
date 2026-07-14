import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPaymentMethodsAttach = vi.fn();
const mockPaymentMethodsDetach = vi.fn();
const mockPaymentMethodsList = vi.fn();
const mockCustomersUpdate = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockFindFailedDepositsForRenter = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();
const mockGetStripeCustomerId = vi.fn();
const mockFindPaymentFailedByRequester = vi.fn();
const mockSendPaymentMethodUpdatedProviderNotification = vi.fn();
const mockSendPaymentMethodUpdatedRequesterConfirmationNotification = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentMethods: {
      attach: (...args: unknown[]) => mockPaymentMethodsAttach(...args),
      detach: (...args: unknown[]) => mockPaymentMethodsDetach(...args),
      list: (...args: unknown[]) => mockPaymentMethodsList(...args),
    },
    customers: {
      update: (...args: unknown[]) => mockCustomersUpdate(...args),
      retrieve: (...args: unknown[]) => mockCustomersRetrieve(...args),
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
  serviceBookingDAL: {
    findPaymentFailedByRequester: (...args: unknown[]) =>
      mockFindPaymentFailedByRequester(...args),
  },
  userDAL: {
    getStripeCustomerId: (...args: unknown[]) =>
      mockGetStripeCustomerId(...args),
  },
}));

vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendPaymentMethodUpdatedProviderNotification: (...args: unknown[]) =>
    mockSendPaymentMethodUpdatedProviderNotification(...args),
  sendPaymentMethodUpdatedRequesterConfirmationNotification: (
    ...args: unknown[]
  ) => mockSendPaymentMethodUpdatedRequesterConfirmationNotification(...args),
}));

import {
  attachPaymentMethod,
  setDefaultPaymentMethod,
  detachPaymentMethod,
  recoverFailedDeposits,
  recoverFailedServiceBookings,
  getStripeCustomerContext,
  listStripeCardPaymentMethodsForUser,
} from "../payment-method";

describe("PaymentMethodService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFailedDepositsForRenter.mockResolvedValue([]);
    mockFindPaymentFailedByRequester.mockResolvedValue([]);
    mockSendPaymentMethodUpdatedProviderNotification.mockResolvedValue(
      undefined,
    );
    mockSendPaymentMethodUpdatedRequesterConfirmationNotification.mockResolvedValue(
      undefined,
    );
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

  describe("recoverFailedServiceBookings", () => {
    it("sends provider and requester notifications for each unmatched failed booking", async () => {
      const failedBookings = [
        {
          providerId: "prov-1",
          selectedPaymentMethodId: "pm_old",
          bookingId: "book-1",
        },
        {
          providerId: "prov-2",
          selectedPaymentMethodId: null,
          bookingId: "book-2",
        },
      ];
      mockFindPaymentFailedByRequester.mockResolvedValue(failedBookings);

      await recoverFailedServiceBookings("user-1", "pm_new");

      expect(mockFindPaymentFailedByRequester).toHaveBeenCalledWith("user-1");
      expect(
        mockSendPaymentMethodUpdatedProviderNotification,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockSendPaymentMethodUpdatedRequesterConfirmationNotification,
      ).toHaveBeenCalledTimes(2);
    });

    it("skips bookings whose selectedPaymentMethodId already matches the new one", async () => {
      const failedBookings = [
        {
          providerId: "prov-1",
          selectedPaymentMethodId: "pm_new",
          bookingId: "book-1",
        },
        {
          providerId: "prov-2",
          selectedPaymentMethodId: "pm_old",
          bookingId: "book-2",
        },
      ];
      mockFindPaymentFailedByRequester.mockResolvedValue(failedBookings);

      await recoverFailedServiceBookings("user-1", "pm_new");

      expect(
        mockSendPaymentMethodUpdatedProviderNotification,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockSendPaymentMethodUpdatedProviderNotification,
      ).toHaveBeenCalledWith("prov-2", failedBookings[1]);
    });

    it("does nothing when there are no failed bookings", async () => {
      mockFindPaymentFailedByRequester.mockResolvedValue([]);

      await recoverFailedServiceBookings("user-1", "pm_new");

      expect(
        mockSendPaymentMethodUpdatedProviderNotification,
      ).not.toHaveBeenCalled();
    });

    it("swallows errors and does not throw", async () => {
      mockFindPaymentFailedByRequester.mockRejectedValue(
        new Error("DB connection error"),
      );

      await expect(
        recoverFailedServiceBookings("user-1", "pm_new"),
      ).resolves.toBeUndefined();
    });
  });

  describe("getStripeCustomerContext", () => {
    const mockCustomer = {
      id: "cus_123",
      deleted: false,
      invoice_settings: { default_payment_method: "pm_default" },
    };

    beforeEach(() => {
      mockGetStripeCustomerId.mockResolvedValue("cus_123");
      mockCustomersRetrieve.mockResolvedValue(mockCustomer);
      mockPaymentMethodsList.mockResolvedValue({ data: [] });
    });

    it("returns null when user has no stripeCustomerId", async () => {
      mockGetStripeCustomerId.mockResolvedValue(null);

      const result = await getStripeCustomerContext("user-1");

      expect(result).toBeNull();
      expect(mockCustomersRetrieve).not.toHaveBeenCalled();
    });

    it("returns null when Stripe customer is deleted", async () => {
      mockCustomersRetrieve.mockResolvedValue({ id: "cus_123", deleted: true });

      const result = await getStripeCustomerContext("user-1");

      expect(result).toBeNull();
    });

    it("returns customerId and default paymentMethodId when default is set", async () => {
      const result = await getStripeCustomerContext("user-1");

      expect(result).toEqual({
        customerId: "cus_123",
        paymentMethodId: "pm_default",
      });
      expect(mockPaymentMethodsList).not.toHaveBeenCalled();
    });

    it("falls back to first card when no default payment method is set", async () => {
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_123",
        deleted: false,
        invoice_settings: { default_payment_method: null },
      });
      mockPaymentMethodsList.mockResolvedValue({
        data: [{ id: "pm_fallback" }],
      });

      const result = await getStripeCustomerContext("user-1");

      expect(result).toEqual({
        customerId: "cus_123",
        paymentMethodId: "pm_fallback",
      });
      expect(mockPaymentMethodsList).toHaveBeenCalledWith({
        customer: "cus_123",
        type: "card",
        limit: 1,
      });
    });

    it("returns null when no default and no cards on file", async () => {
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_123",
        deleted: false,
        invoice_settings: { default_payment_method: null },
      });
      mockPaymentMethodsList.mockResolvedValue({ data: [] });

      const result = await getStripeCustomerContext("user-1");

      expect(result).toBeNull();
    });
  });

  describe("listStripeCardPaymentMethodsForUser", () => {
    it("returns empty array when user has no stripeCustomerId", async () => {
      mockGetStripeCustomerId.mockResolvedValue(null);

      const result = await listStripeCardPaymentMethodsForUser("user-1");

      expect(result).toEqual([]);
      expect(mockCustomersRetrieve).not.toHaveBeenCalled();
    });

    it("returns empty array when customer is deleted", async () => {
      mockGetStripeCustomerId.mockResolvedValue("cus_123");
      mockCustomersRetrieve.mockResolvedValue({ id: "cus_123", deleted: true });

      const result = await listStripeCardPaymentMethodsForUser("user-1");

      expect(result).toEqual([]);
    });

    it("maps cards and marks default from invoice_settings", async () => {
      mockGetStripeCustomerId.mockResolvedValue("cus_123");
      mockCustomersRetrieve.mockResolvedValue({
        id: "cus_123",
        deleted: false,
        invoice_settings: { default_payment_method: "pm_a" },
      });
      mockPaymentMethodsList.mockResolvedValue({
        data: [
          {
            id: "pm_a",
            type: "card",
            card: {
              brand: "visa",
              last4: "4242",
              exp_month: 12,
              exp_year: 2030,
            },
          },
          {
            id: "pm_b",
            type: "card",
            card: {
              brand: "mastercard",
              last4: "4444",
              exp_month: 6,
              exp_year: 2028,
            },
          },
        ],
      });

      const result = await listStripeCardPaymentMethodsForUser("user-1");

      expect(result).toEqual([
        {
          id: "pm_a",
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2030,
          isDefault: true,
        },
        {
          id: "pm_b",
          brand: "mastercard",
          last4: "4444",
          expMonth: 6,
          expYear: 2028,
          isDefault: false,
        },
      ]);
      expect(mockPaymentMethodsList).toHaveBeenCalledWith({
        customer: "cus_123",
        type: "card",
      });
    });
  });
});
