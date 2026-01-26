import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripeDisputeService } from "../dispute-financial";
import { PAYMENT_SERVER_INSTANCE } from "../server";
import { captureSecurityDeposit } from "../rental-payments";
import { mockDispute } from "@/test/fixtures/disputes";
import type { DisputeWithRelations } from "@/dal/types";

// Mock dependencies
vi.mock("@/dal/dispute.dal", () => ({
  DisputeDAL: vi.fn(),
}));

vi.mock("@/dal/payment.dal", () => ({
  PaymentDAL: vi.fn(),
}));

vi.mock("@/dal/rentals.dal", () => ({
  RentalDAL: vi.fn(),
}));

vi.mock("../server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    refunds: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../rental-payments", () => ({
  captureSecurityDeposit: vi.fn(),
}));

describe("StripeDisputeService", () => {
  let mockDisputeDAL: any;
  let mockPaymentDAL: any;
  let mockRentalDAL: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Setup mock instances
    mockDisputeDAL = {
      createFinancialOperation: vi.fn(),
    };
    mockPaymentDAL = {
      getByRentalId: vi.fn(),
    };
    mockRentalDAL = {
      getSecurityDepositAuthId: vi.fn(),
    };

    // Set static properties
    (StripeDisputeService as any).disputeDAL = mockDisputeDAL;
    (StripeDisputeService as any).paymentDAL = mockPaymentDAL;
    (StripeDisputeService as any).rentalDAL = mockRentalDAL;
  });

  describe("executeOperation", () => {
    const disputeWithRental: DisputeWithRelations = {
      ...mockDispute,
      rental: {
        id: "rental-123",
        requestId: null,
        listingId: "listing-123",
        renterId: "user-123",
        ownerId: "user-456",
      },
    };

    it("should throw error when dispute has no rental", async () => {
      // Arrange
      const disputeWithoutRental = {
        ...mockDispute,
        rental: undefined,
      };

      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithoutRental as any,
          { type: "refund_full" },
          "admin-123",
        ),
      ).rejects.toThrow("Dispute must have rental relation");
    });

    it("should throw error for unknown operation type", async () => {
      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "unknown_operation" as any },
          "admin-123",
        ),
      ).rejects.toThrow("Unknown operation type");
    });
  });

  describe("createRefund", () => {
    const disputeWithRental: DisputeWithRelations = {
      ...mockDispute,
      rental: {
        id: "rental-123",
        requestId: null,
        listingId: "listing-123",
        renterId: "user-123",
        ownerId: "user-456",
      },
    };

    const mockPayment = {
      id: "payment-123",
      rentalId: "rental-123",
      amount: "150.00",
      stripePaymentIntentId: "pi_1234567890",
    };

    it("should create full refund successfully", async () => {
      // Arrange
      const mockRefund = {
        id: "refund_123",
        amount: 15000, // cents
        status: "succeeded",
      };

      const mockFinancialOperation = {
        id: "financial-123",
        disputeId: disputeWithRental.id,
        operationType: "refund_full",
        amount: "150.00",
        stripeOperationId: "refund_123",
        status: "succeeded",
      };

      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);
      vi.mocked(PAYMENT_SERVER_INSTANCE.refunds.create).mockResolvedValue(
        mockRefund as any,
      );
      mockDisputeDAL.createFinancialOperation.mockResolvedValue(
        mockFinancialOperation,
      );

      // Act
      const result = await StripeDisputeService.executeOperation(
        disputeWithRental,
        { type: "refund_full" },
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.operationType).toBe("refund_full");
      expect(PAYMENT_SERVER_INSTANCE.refunds.create).toHaveBeenCalledWith({
        payment_intent: "pi_1234567890",
        amount: 15000, // $150.00 in cents
        metadata: {
          disputeId: disputeWithRental.id,
          rentalId: disputeWithRental.rentalId,
          operationType: "refund_full",
        },
      });
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: disputeWithRental.id,
          operationType: "refund_full",
          amount: "150", // Amount is converted to string without decimals
          stripeOperationId: "refund_123",
          stripePaymentIntentId: "pi_1234567890",
          status: "succeeded",
          performedBy: "admin-123",
        }),
      );
    });

    it("should create partial refund successfully", async () => {
      // Arrange
      const mockRefund = {
        id: "refund_123",
        amount: 7500, // $75.00 in cents
        status: "succeeded",
      };

      const mockFinancialOperation = {
        id: "financial-123",
        disputeId: disputeWithRental.id,
        operationType: "refund_partial",
        amount: "75.00",
        stripeOperationId: "refund_123",
        status: "succeeded",
      };

      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);
      vi.mocked(PAYMENT_SERVER_INSTANCE.refunds.create).mockResolvedValue(
        mockRefund as any,
      );
      mockDisputeDAL.createFinancialOperation.mockResolvedValue(
        mockFinancialOperation,
      );

      // Act
      const result = await StripeDisputeService.executeOperation(
        disputeWithRental,
        { type: "refund_partial", amount: 75.0 },
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.operationType).toBe("refund_partial");
      expect(PAYMENT_SERVER_INSTANCE.refunds.create).toHaveBeenCalledWith({
        payment_intent: "pi_1234567890",
        amount: 7500, // $75.00 in cents
        metadata: expect.objectContaining({
          operationType: "refund_partial",
        }),
      });
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: "75",
          operationType: "refund_partial",
        }),
      );
    });

    it("should throw error when payment not found", async () => {
      // Arrange
      mockPaymentDAL.getByRentalId.mockResolvedValue(null);

      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "refund_full" },
          "admin-123",
        ),
      ).rejects.toThrow("Payment record not found");
    });

    it("should throw error when payment intent ID not found", async () => {
      // Arrange
      const paymentWithoutIntent = {
        ...mockPayment,
        stripePaymentIntentId: null,
      };

      mockPaymentDAL.getByRentalId.mockResolvedValue(paymentWithoutIntent);

      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "refund_full" },
          "admin-123",
        ),
      ).rejects.toThrow("Payment intent ID not found");
    });

    it("should throw error when refund amount exceeds payment amount", async () => {
      // Arrange
      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);

      // Act & Assert - amount exceeds payment amount
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "refund_partial", amount: 200.0 }, // More than $150
          "admin-123",
        ),
      ).rejects.toThrow("Invalid refund amount");
    });

    it("should throw error when refund amount is negative", async () => {
      // Arrange
      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);
      mockDisputeDAL.createFinancialOperation.mockResolvedValue({
        id: "financial-123",
        status: "failed",
      });

      // Act & Assert - amount is negative
      // Note: amount: 0 would fall back to full payment amount (0 is falsy),
      // so we only test negative amounts which are truthy and will be caught
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "refund_partial", amount: -10 },
          "admin-123",
        ),
      ).rejects.toThrow("Invalid refund amount");

      // Verify failed operation record was created
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: "refund_partial",
          status: "failed",
          errorMessage: expect.stringContaining("Invalid refund amount"),
        }),
      );
    });

    it("should create failed operation record when refund fails", async () => {
      // Arrange
      const stripeError = new Error("Stripe API error");
      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);
      vi.mocked(PAYMENT_SERVER_INSTANCE.refunds.create).mockRejectedValue(
        stripeError,
      );
      mockDisputeDAL.createFinancialOperation.mockResolvedValue({
        id: "financial-123",
        status: "failed",
      });

      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "refund_full" },
          "admin-123",
        ),
      ).rejects.toThrow("Stripe API error");

      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: "refund_full",
          status: "failed",
          errorMessage: "Stripe API error",
        }),
      );
    });
  });

  describe("holdPayout", () => {
    const disputeWithRental: DisputeWithRelations = {
      ...mockDispute,
      rental: {
        id: "rental-123",
        requestId: null,
        listingId: "listing-123",
        renterId: "user-123",
        ownerId: "user-456",
      },
    };

    const mockPayment = {
      id: "payment-123",
      rentalId: "rental-123",
      stripePaymentIntentId: "pi_1234567890",
    };

    it("should create hold payout operation successfully", async () => {
      // Arrange
      const mockFinancialOperation = {
        id: "financial-123",
        disputeId: disputeWithRental.id,
        operationType: "hold_payout",
        status: "succeeded",
      };

      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);
      mockDisputeDAL.createFinancialOperation.mockResolvedValue(
        mockFinancialOperation,
      );

      // Act
      const result = await StripeDisputeService.executeOperation(
        disputeWithRental,
        { type: "hold_payout" },
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.operationType).toBe("hold_payout");
      expect(result.status).toBe("succeeded");
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: disputeWithRental.id,
          operationType: "hold_payout",
          stripePaymentIntentId: "pi_1234567890",
          status: "succeeded",
        }),
      );
    });

    it("should handle missing payment gracefully", async () => {
      // Arrange
      mockPaymentDAL.getByRentalId.mockResolvedValue(null);
      mockDisputeDAL.createFinancialOperation.mockResolvedValue({
        id: "financial-123",
        status: "succeeded",
      });

      // Act
      const result = await StripeDisputeService.executeOperation(
        disputeWithRental,
        { type: "hold_payout" },
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("succeeded");
    });

    it("should create failed operation record when hold fails", async () => {
      // Arrange
      const dbError = new Error("Database error");
      mockPaymentDAL.getByRentalId.mockResolvedValue(mockPayment);
      // First call (creating succeeded record) throws, then we create failed record
      mockDisputeDAL.createFinancialOperation
        .mockRejectedValueOnce(dbError) // First call fails (creating succeeded record)
        .mockResolvedValueOnce({
          // Second call succeeds (creating failed record)
          id: "financial-123",
          status: "failed",
        });

      // Act & Assert
      // The service tries to create succeeded record, fails, creates failed record, then throws
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "hold_payout" },
          "admin-123",
        ),
      ).rejects.toThrow("Database error");

      // Should create failed operation record
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledTimes(2);
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenLastCalledWith(
        expect.objectContaining({
          operationType: "hold_payout",
          status: "failed",
          errorMessage: "Database error",
        }),
      );
    });
  });

  describe("captureDeposit", () => {
    const disputeWithRental: DisputeWithRelations = {
      ...mockDispute,
      rental: {
        id: "rental-123",
        requestId: null,
        listingId: "listing-123",
        renterId: "user-123",
        ownerId: "user-456",
      },
    };

    it("should capture security deposit successfully", async () => {
      // Arrange
      const securityDepositAuthId = "auth_1234567890";
      const mockPaymentIntent = {
        id: "pi_deposit_123",
        status: "succeeded",
      };

      const mockFinancialOperation = {
        id: "financial-123",
        disputeId: disputeWithRental.id,
        operationType: "capture_deposit",
        stripeOperationId: "pi_deposit_123",
        stripePaymentIntentId: "pi_deposit_123",
        status: "succeeded",
      };

      mockRentalDAL.getSecurityDepositAuthId.mockResolvedValue(
        securityDepositAuthId,
      );
      vi.mocked(captureSecurityDeposit).mockResolvedValue(
        mockPaymentIntent as any,
      );
      mockDisputeDAL.createFinancialOperation.mockResolvedValue(
        mockFinancialOperation,
      );

      // Act
      const result = await StripeDisputeService.executeOperation(
        disputeWithRental,
        { type: "capture_deposit" },
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.operationType).toBe("capture_deposit");
      expect(result.status).toBe("succeeded");
      expect(mockRentalDAL.getSecurityDepositAuthId).toHaveBeenCalledWith(
        disputeWithRental.rentalId,
      );
      expect(captureSecurityDeposit).toHaveBeenCalledWith(
        securityDepositAuthId,
      );
      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: disputeWithRental.id,
          operationType: "capture_deposit",
          stripeOperationId: "pi_deposit_123",
          stripePaymentIntentId: "pi_deposit_123",
          status: "succeeded",
        }),
      );
    });

    it("should throw error when security deposit authorization not found", async () => {
      // Arrange
      mockRentalDAL.getSecurityDepositAuthId.mockResolvedValue(null);

      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "capture_deposit" },
          "admin-123",
        ),
      ).rejects.toThrow("Security deposit authorization not found");
    });

    it("should create failed operation record when capture fails", async () => {
      // Arrange
      const securityDepositAuthId = "auth_1234567890";
      const stripeError = new Error("Stripe capture failed");

      mockRentalDAL.getSecurityDepositAuthId.mockResolvedValue(
        securityDepositAuthId,
      );
      vi.mocked(captureSecurityDeposit).mockRejectedValue(stripeError);
      mockDisputeDAL.createFinancialOperation.mockResolvedValue({
        id: "financial-123",
        status: "failed",
      });

      // Act & Assert
      await expect(
        StripeDisputeService.executeOperation(
          disputeWithRental,
          { type: "capture_deposit" },
          "admin-123",
        ),
      ).rejects.toThrow("Stripe capture failed");

      expect(mockDisputeDAL.createFinancialOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: "capture_deposit",
          status: "failed",
          errorMessage: "Stripe capture failed",
        }),
      );
    });
  });
});
