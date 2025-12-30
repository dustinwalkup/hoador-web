import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRentalRequest } from "../create-rental-request";
import { rentalDAL, userDAL, notificationsDAL } from "@/dal";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { mockRentalRequest } from "@/test/fixtures/rentals";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import type { DocumentVersionsMap } from "@/dal/legal-document.dal";
import type { UserProfile } from "@/dal/types";
import type { CreateRentalRequestFormData } from "../../lib/form-schema";

// Mock dependencies
vi.mock("@/dal", () => ({
  rentalDAL: {
    createRentalRequest: vi.fn(),
    getRentalRequestById: vi.fn(),
  },
  userDAL: {
    getUserById: vi.fn(),
  },
  notificationsDAL: {
    create: vi.fn(),
  },
}));

vi.mock("@/dal/legal-document.dal", () => ({
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn(),
    recordAcceptance: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("../notifications/rental-request-created", () => ({
  sendRentalRequestCreatedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../notifications/rental-approved", () => ({
  sendRentalApprovedNotification: vi.fn().mockResolvedValue(undefined),
  sendPaymentSucceededNotificationToRenter: vi
    .fn()
    .mockResolvedValue(undefined),
  sendPaymentSucceededNotificationToOwner: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailureNotificationToRenter: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailureNotificationToOwner: vi.fn().mockResolvedValue(undefined),
}));

describe("createRentalRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock notificationsDAL.create to return a successful notification
    vi.mocked(notificationsDAL.create).mockResolvedValue({
      id: "notification-123",
      userId: "user-123",
      type: "rental_request_created",
      title: "Test Notification",
      message: "Test message",
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  it("should create rental request with valid data", async () => {
    // Arrange
    const userId = "user-456";
    // Use future dates to ensure it passes validation
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Tomorrow
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 5); // 5 days from now

    const formData = {
      listingId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // Valid UUID
      startDate,
      endDate,
      deliveryRequested: false,
      setupRequested: false,
      setupFee: 0,
      rentalAgreementAccepted: true,
      safetyDisclaimerAccepted: true,
      damageLossLiabilityAccepted: true,
      paymentPayoutAccepted: true,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as any);
    // DAL method returns { id: string }, not the full object
    vi.mocked(rentalDAL.createRentalRequest).mockResolvedValue({
      id: mockRentalRequest.id,
    });

    // Mock legal document versions - need to return objects with version property
    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue({
      [LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT]: { version: 1 },
      [LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]: { version: 1 },
      [LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]: { version: 1 },
      [LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]: { version: 1 },
    } as any);

    // Mock recordAcceptance to not throw
    vi.mocked(legalDocumentDAL.recordAcceptance).mockResolvedValue(undefined);
    const ownerId = "user-123";
    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue({
      ...mockRentalRequest,
      ownerId,
      renterId: userId,
      listingName: "Test Listing",
      totalAmount: "100.00",
    } as any);
    // Mock getUserById for owner (first call) and renter (second call) in notification handler
    vi.mocked(userDAL.getUserById)
      .mockResolvedValueOnce({
        id: ownerId,
        email: "owner@example.com",
        firstName: "John",
        lastName: "Doe",
      } as any)
      .mockResolvedValueOnce({
        id: userId,
        email: "renter@example.com",
        firstName: "Jane",
        lastName: "Smith",
      } as any);

    // Act
    const result = await createRentalRequest(formData);

    // Assert
    expect(result.success).toBe(true);
    expect(result.requestId).toBe(mockRentalRequest.id);
    expect(rentalDAL.createRentalRequest).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("should return error when validation fails", async () => {
    // Arrange
    const invalidFormData = {
      listingId: "", // Invalid: empty
      startDate: "2024-02-01",
      endDate: "2024-02-05",
    } as any;

    // Act
    const result = await createRentalRequest(invalidFormData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Validation failed");
    expect(rentalDAL.createRentalRequest).not.toHaveBeenCalled();
  });

  it("should return error when user not authenticated", async () => {
    // Arrange - form data must pass Zod validation first, then auth check happens
    // Use a future date to ensure it passes "end date after start date" validation
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Tomorrow
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 5); // 5 days from now

    const formData = {
      listingId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // Valid UUID
      startDate,
      endDate,
      deliveryRequested: false,
      setupRequested: false,
      setupFee: 0,
    };

    // Mock getCurrentUserId to return null - auth check happens after validation
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    // Act
    const result = await createRentalRequest(formData);

    // Assert
    expect(result).toHaveProperty("error");
    // Action returns "You must be logged in to create a rental request" when userId is null
    expect(result.error).toBe(
      "You must be logged in to create a rental request",
    );
    expect(rentalDAL.createRentalRequest).not.toHaveBeenCalled();
  });

  it("should return error when DAL throws error", async () => {
    // Arrange
    const userId = "user-456";
    // Use future dates to ensure it passes validation
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Tomorrow
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 5); // 5 days from now

    const formData = {
      listingId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // Valid UUID
      startDate,
      endDate,
      deliveryRequested: false,
      setupRequested: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as any);
    const error = new Error("Date conflict");
    // Mock DAL to throw error
    vi.mocked(rentalDAL.createRentalRequest).mockRejectedValue(error);

    // Act
    const result = await createRentalRequest(formData);

    // Assert
    expect(result).toHaveProperty("error");
    // The action wraps the error message directly
    expect(result.error).toBe("Date conflict");
  });
});
