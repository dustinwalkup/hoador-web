import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListing, uploadListingImage } from "../create-listing";
import { listingDAL, userDAL } from "@/dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { revalidatePath } from "next/cache";
import { mockListing } from "@/test/fixtures/listings";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    createListing: vi.fn(),
  },
  userDAL: {
    isConnectOnboardingComplete: vi.fn(),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("createListing", () => {
  const mockOwnerDocuments = {
    [LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]: {
      id: LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY,
      version: "1.0",
      url: "https://example.com/damage-1.0.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS]: {
      id: LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS,
      version: "1.0",
      url: "https://example.com/condition-1.0.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]: {
      id: LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER,
      version: "1.0",
      url: "https://example.com/safety-1.0.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES]: {
      id: LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES,
      version: "1.0",
      url: "https://example.com/content-1.0.pdf",
      publishedAt: new Date("2024-01-01"),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock headers for IP and user agent
    const { headers } = await import("next/headers");
    const mockHeaders = new Headers();
    mockHeaders.set("x-forwarded-for", "192.168.1.1");
    mockHeaders.set("user-agent", "test-agent");
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);

    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue(
      mockOwnerDocuments as any,
    );
    vi.mocked(legalDocumentDAL.recordAcceptance).mockResolvedValue(undefined);
  });

  it("should create listing with valid form data", async () => {
    // Arrange
    const userId = "user-123";
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);
    vi.mocked(listingDAL.createListing).mockResolvedValue(mockListing as any);

    // Act
    const result = await createListing(formData);

    // Assert
    expect(result).toEqual({ success: true, listingId: mockListing.id });
    expect(getCurrentUserId).toHaveBeenCalled();
    expect(userDAL.isConnectOnboardingComplete).toHaveBeenCalledWith(userId);
    expect(listingDAL.createListing).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/listings");

    // Verify legal document acceptances were recorded
    expect(legalDocumentDAL.getAllCurrentVersions).toHaveBeenCalled();
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledTimes(4);
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledWith(
      userId,
      LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY,
      "1.0",
      "192.168.1.1",
      "test-agent",
      "listing_creation",
      undefined, // rentalRequestId
      mockListing.id, // listingId
    );
  });

  it("should return error when validation fails", async () => {
    // Arrange
    const invalidFormData = {
      name: "", // Invalid: empty name
      description: "Test",
    } as any;

    // Act
    const result = await createListing(invalidFormData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Validation failed");
    expect(listingDAL.createListing).not.toHaveBeenCalled();
  });

  it("should return error when user not authenticated", async () => {
    // Arrange
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    // Act
    const result = await createListing(formData);

    // Assert
    expect(result).toEqual({ error: "Unauthorized: User not authenticated" });
    expect(listingDAL.createListing).not.toHaveBeenCalled();
  });

  it("should return error when Stripe onboarding not complete", async () => {
    // Arrange
    const userId = "user-123";
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(false);

    // Act
    const result = await createListing(formData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Stripe onboarding");
    expect(listingDAL.createListing).not.toHaveBeenCalled();
  });

  it("should return error when DAL throws error", async () => {
    // Arrange
    const userId = "user-123";
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);
    vi.mocked(listingDAL.createListing).mockRejectedValue(
      new Error("Database error"),
    );

    // Act
    const result = await createListing(formData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Database error");
    // Legal document acceptance should not be called if listing creation fails
    expect(legalDocumentDAL.recordAcceptance).not.toHaveBeenCalled();
  });

  it("should record legal document acceptances after successful listing creation", async () => {
    // Arrange
    const userId = "user-123";
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);
    vi.mocked(listingDAL.createListing).mockResolvedValue(mockListing as any);

    // Act
    const result = await createListing(formData);

    // Assert
    expect(result).toEqual({ success: true, listingId: mockListing.id });
    expect(legalDocumentDAL.getAllCurrentVersions).toHaveBeenCalled();
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledTimes(4);

    // Verify all 4 documents are recorded with correct parameters
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledWith(
      userId,
      LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY,
      "1.0",
      "192.168.1.1",
      "test-agent",
      "listing_creation",
      undefined,
      mockListing.id,
    );
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledWith(
      userId,
      LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS,
      "1.0",
      "192.168.1.1",
      "test-agent",
      "listing_creation",
      undefined,
      mockListing.id,
    );
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledWith(
      userId,
      LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER,
      "1.0",
      "192.168.1.1",
      "test-agent",
      "listing_creation",
      undefined,
      mockListing.id,
    );
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledWith(
      userId,
      LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES,
      "1.0",
      "192.168.1.1",
      "test-agent",
      "listing_creation",
      undefined,
      mockListing.id,
    );
  });

  it("should handle legal document acceptance errors gracefully", async () => {
    // Arrange
    const userId = "user-123";
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);
    vi.mocked(listingDAL.createListing).mockResolvedValue(mockListing as any);
    vi.mocked(legalDocumentDAL.recordAcceptance).mockRejectedValue(
      new Error("Failed to record acceptance"),
    );

    // Act
    const result = await createListing(formData);

    // Assert - Listing should still be created even if acceptance recording fails
    expect(result).toEqual({ success: true, listingId: mockListing.id });
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalled();
  });

  it("should handle missing document versions gracefully", async () => {
    // Arrange
    const userId = "user-123";
    const formData = {
      name: "Test Listing",
      description: "Test description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 15.0,
      securityDeposit: 0,
      specifications: {},
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(userDAL.isConnectOnboardingComplete).mockResolvedValue(true);
    vi.mocked(listingDAL.createListing).mockResolvedValue(mockListing as any);
    // Return empty object - no document versions
    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue({});

    // Act
    const result = await createListing(formData);

    // Assert - Listing should still be created
    expect(result).toEqual({ success: true, listingId: mockListing.id });
    // No acceptances should be recorded if documents don't exist
    expect(legalDocumentDAL.recordAcceptance).not.toHaveBeenCalled();
  });
});

describe("uploadListingImage", () => {
  it("should upload image successfully", async () => {
    // Arrange
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const listingId = "listing-123";
    const orderIndex = 0;

    const mockBlob = {
      url: "https://example.com/image.jpg",
      pathname: "listings/123/image.jpg",
    };
    const { uploadToBlob } = await import("@/services/vercel-blob");
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);

    const mockImage = {
      id: "image-123",
      listingId,
      imageUrl: mockBlob.url,
      orderIndex,
    };

    const { db } = await import("@/db/db");

    const mockReturning = vi.fn().mockResolvedValue([mockImage]);
    const mockValues = vi.fn().mockReturnValue({
      returning: mockReturning,
    });

    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as any);

    // Act
    const result = await uploadListingImage(file, listingId, orderIndex);

    // Assert
    expect(result.success).toBe(true);
    expect(result.image).toEqual(mockImage);
  });

  it("should return error when upload fails", async () => {
    // Arrange
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const listingId = "listing-123";
    const orderIndex = 0;

    const { uploadToBlob } = await import("@/services/vercel-blob");
    vi.mocked(uploadToBlob).mockRejectedValue(new Error("Upload failed"));

    // Act
    const result = await uploadListingImage(file, listingId, orderIndex);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to upload image");
  });
});
