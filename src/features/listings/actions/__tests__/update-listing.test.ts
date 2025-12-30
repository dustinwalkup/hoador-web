import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateListing } from "../update-listing";
import { listingDAL } from "@/dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { revalidatePath } from "next/cache";
import { mockListing } from "@/test/fixtures/listings";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    updateListing: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("updateListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update listing with valid form data", async () => {
    // Arrange
    const listingId = "listing-123";
    const userId = "user-123";
    const formData = {
      name: "Updated Listing",
      description: "Updated description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 20.0,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
      securityDeposit: 0,
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      specifications: {},
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(listingDAL.updateListing).mockResolvedValue({
      ...mockListing,
      ...formData,
    } as any);

    // Act
    const result = await updateListing(listingId, formData);

    // Assert
    expect(result).toEqual({ success: true, listingId });
    expect(getCurrentUserId).toHaveBeenCalled();
    expect(listingDAL.updateListing).toHaveBeenCalledWith(listingId, formData);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/listings");
  });

  it("should return error when validation fails", async () => {
    // Arrange
    const listingId = "listing-123";
    const invalidFormData = {
      name: "", // Invalid: empty name
      description: "Test",
    } as any;

    // Act
    const result = await updateListing(listingId, invalidFormData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Validation failed");
    expect(listingDAL.updateListing).not.toHaveBeenCalled();
  });

  it("should return error when user not authenticated", async () => {
    // Arrange
    const listingId = "listing-123";
    const formData = {
      name: "Updated Listing",
      description: "Updated description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 20.0,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
      securityDeposit: 0,
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      specifications: {},
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    // Act
    const result = await updateListing(listingId, formData);

    // Assert
    expect(result).toEqual({ error: "Unauthorized: User not authenticated" });
    expect(listingDAL.updateListing).not.toHaveBeenCalled();
  });

  it("should return error when DAL throws error", async () => {
    // Arrange
    const listingId = "listing-123";
    const userId = "user-123";
    const formData = {
      name: "Updated Listing",
      description: "Updated description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 20.0,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
      securityDeposit: 0,
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      specifications: {},
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(listingDAL.updateListing).mockRejectedValue(
      new Error("Unauthorized: Not the owner"),
    );

    // Act
    const result = await updateListing(listingId, formData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Unauthorized: Not the owner");
  });

  it("should return error when listing not found", async () => {
    // Arrange
    const listingId = "non-existent-listing";
    const userId = "user-123";
    const formData = {
      name: "Updated Listing",
      description: "Updated description",
      categoryId: "category-123",
      condition: "good" as const,
      dailyRate: 20.0,
      deliveryMode: "pickup_only" as const,
      deliveryFee: 0,
      deliveryRadius: 0,
      setupAvailable: false,
      setupFee: 0,
      securityDeposit: 0,
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      specifications: {},
    };

    vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    vi.mocked(listingDAL.updateListing).mockRejectedValue(
      new Error("Listing not found"),
    );

    // Act
    const result = await updateListing(listingId, formData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Listing not found");
  });
});
