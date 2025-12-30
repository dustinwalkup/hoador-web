import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListing, uploadListingImage } from "../create-listing";
import { listingDAL, userDAL } from "@/dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { revalidatePath } from "next/cache";
import { createListingFormData } from "@/test/utils/mock-form-data";
import { mockListing } from "@/test/fixtures/listings";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    createListing: vi.fn(),
  },
  userDAL: {
    isConnectOnboardingComplete: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});

describe("uploadListingImage", () => {
  it("should upload image successfully", async () => {
    // Arrange
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const listingId = "listing-123";
    const orderIndex = 0;

    const mockBlob = { url: "https://example.com/image.jpg", pathname: "listings/123/image.jpg" };
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

