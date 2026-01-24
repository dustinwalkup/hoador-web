import { describe, it, expect, vi, beforeEach } from "vitest";
import { approveRentalRequest } from "../approve-rental-request";
import { rentalDAL, userDAL } from "@/dal";
import { revalidatePath } from "next/cache";
import { mockRentalRequest } from "@/test/fixtures/rentals";
import { getCurrentUserId } from "@/features/auth/utils/session";

// Mock dependencies
vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: vi.fn(),
    updateRentalRequestPaymentStatus: vi.fn(),
    approveRentalRequest: vi.fn(),
  },
  userDAL: {
    getOrCreateStripeCustomerId: vi.fn(),
    getConnectedAccountId: vi.fn(),
    isConnectOnboardingComplete: vi.fn(),
    getUserById: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: vi.fn(),
  authorizeSecurityDeposit: vi.fn(),
  getPaymentErrorMessage: vi.fn(),
  isRetryablePaymentError: vi.fn(),
}));

vi.mock("../notifications/payment-failure", () => ({
  sendPaymentFailureNotificationToRenter: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailureNotificationToOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../notifications/payment-succeeded", () => ({
  sendPaymentSucceededNotificationToRenter: vi
    .fn()
    .mockResolvedValue(undefined),
  sendPaymentSucceededNotificationToOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../notifications/rental-approved", () => ({
  sendRentalApprovedNotification: vi.fn().mockResolvedValue(undefined),
}));

describe("approveRentalRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve rental request with valid data", async () => {
    // Arrange
    const requestId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const userId = "user-123";
    const formData = {
      requestId,
      pickupInstructions: "Pick up at front door",
      returnInstructions: "Return to same location",
    };

    // Mock authentication
    vi.mocked(getCurrentUserId).mockResolvedValue(userId);

    // Mock rental must have all required properties used by the action
    const mockRental = {
      ...mockRentalRequest,
      id: requestId,
      paymentMethodId: "pm_123",
      renterId: "user-456",
      ownerId: userId, // Must match userId for authorization
      listingId: "listing-123",
      listingName: "Test Power Drill",
      totalAmount: "60.00",
      securityDeposit: "50.00",
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-02-05"),
    };

    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue(
      mockRental as any,
    );
    vi.mocked(userDAL.getOrCreateStripeCustomerId).mockResolvedValue("cus_123");
    vi.mocked(userDAL.getConnectedAccountId).mockResolvedValue("acct_123");
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);

    const { chargeRentalPayment } =
      await import("@/services/stripe/rental-payments");
    vi.mocked(chargeRentalPayment).mockResolvedValue({
      id: "pi_123",
      status: "succeeded",
    } as any);

    const { authorizeSecurityDeposit } =
      await import("@/services/stripe/rental-payments");
    vi.mocked(authorizeSecurityDeposit).mockResolvedValue({
      id: "auth_123",
      status: "requires_capture",
    } as any);

    vi.mocked(rentalDAL.updateRentalRequestPaymentStatus).mockResolvedValue(
      undefined,
    );
    // approveRentalRequest returns void, so mockResolvedValue(undefined) is correct
    vi.mocked(rentalDAL.approveRentalRequest).mockResolvedValue(undefined);

    // Mock getUserById for both renter and owner (called in success notification handler)
    vi.mocked(userDAL.getUserById)
      .mockResolvedValueOnce({
        id: "user-456",
        email: "renter@example.com",
        firstName: "Jane",
        lastName: "Smith",
      } as any)
      .mockResolvedValueOnce({
        id: "user-123",
        email: "owner@example.com",
        firstName: "John",
        lastName: "Doe",
      } as any);

    // Act
    const result = await approveRentalRequest(formData);

    // Assert
    expect(result.success).toBe(true);
    expect(rentalDAL.approveRentalRequest).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("should return error when validation fails", async () => {
    // Arrange
    const invalidFormData = {
      requestId: "invalid-uuid", // Invalid UUID
    } as any;

    // Act
    const result = await approveRentalRequest(invalidFormData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid data provided");
  });

  it("should return error when rental request not found", async () => {
    // Arrange
    const requestId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    const userId = "user-123";
    const formData = {
      requestId,
    };

    // Mock authentication
    vi.mocked(getCurrentUserId).mockResolvedValue(userId);

    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue(
      undefined as any,
    );

    // Act
    const result = await approveRentalRequest(formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("should return error when payment method not available", async () => {
    // Arrange
    const requestId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
    const userId = "user-123";
    const formData = {
      requestId,
    };

    // Mock authentication
    vi.mocked(getCurrentUserId).mockResolvedValue(userId);

    const mockRental = {
      ...mockRentalRequest,
      id: requestId,
      paymentMethodId: null, // No payment method
      ownerId: userId, // Must match userId for authorization
    };

    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue(
      mockRental as any,
    );

    // Act
    const result = await approveRentalRequest(formData);

    // Assert
    expect(result.success).toBe(false);
    // Action returns "No payment method on file for renter"
    expect(result.error).toBe("No payment method on file for renter");
  });

  it("should return error when payment fails", async () => {
    // Arrange
    const requestId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
    const userId = "user-123";
    const formData = {
      requestId,
    };

    // Mock authentication
    vi.mocked(getCurrentUserId).mockResolvedValue(userId);

    // Mock rental must have all required properties used by the action
    const mockRental = {
      ...mockRentalRequest,
      id: requestId,
      paymentMethodId: "pm_123",
      renterId: "user-456",
      ownerId: userId, // Must match userId for authorization
      listingId: "listing-123",
      listingName: "Test Power Drill",
      totalAmount: "60.00",
      securityDeposit: "50.00",
    };

    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue(
      mockRental as any,
    );
    vi.mocked(rentalDAL.updateRentalRequestPaymentStatus).mockResolvedValue(
      undefined,
    );
    vi.mocked(userDAL.getOrCreateStripeCustomerId).mockResolvedValue("cus_123");
    vi.mocked(userDAL.getConnectedAccountId).mockResolvedValue("acct_123");
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);

    const {
      chargeRentalPayment,
      getPaymentErrorMessage,
      isRetryablePaymentError,
    } = await import("@/services/stripe/rental-payments");
    const paymentError = new Error("Card declined");
    vi.mocked(chargeRentalPayment).mockRejectedValue(paymentError);
    vi.mocked(getPaymentErrorMessage).mockReturnValue("Card declined");
    vi.mocked(isRetryablePaymentError).mockReturnValue(false);

    // Mock getUserById for both renter and owner (called in payment failure handler)
    vi.mocked(userDAL.getUserById)
      .mockResolvedValueOnce({
        id: "user-456",
        email: "renter@example.com",
        firstName: "Jane",
        lastName: "Smith",
      } as any)
      .mockResolvedValueOnce({
        id: "user-123",
        email: "owner@example.com",
        firstName: "John",
        lastName: "Doe",
      } as any);

    // Act
    const result = await approveRentalRequest(formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.paymentFailed).toBe(true);
    expect(result.error).toContain("Payment failed");
  });
});
