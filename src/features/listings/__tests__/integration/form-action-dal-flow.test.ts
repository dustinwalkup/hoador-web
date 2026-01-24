import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListing } from "../../actions/create-listing";
import { listingDAL, userDAL } from "../../../../dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { revalidatePath } from "next/cache";
import {
  mockCreateListingFormData,
  mockMinimalCreateListingFormData,
} from "@/test/fixtures/listings";
import { requireCommunityMembership } from "@/features/community/utils/membership";

// Mock all dependencies
vi.mock("../../../../dal", () => ({
  listingDAL: {
    createListing: vi.fn(),
  },
  userDAL: {
    isConnectOnboardingComplete: vi.fn(),
  },
  communityDAL: {
    requireUserCommunityMembership: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/features/community/utils/membership", () => ({
  requireCommunityMembership: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => []),
      })),
    })),
  },
}));

vi.mock("@/db/schemas/listings.schema", () => ({
  listingImages: {},
}));

describe("Form Action → DAL Flow Integration", () => {
  const mockUserId = "user-123";
  const mockListingId = "listing-456";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (getCurrentUserId as any).mockResolvedValue(mockUserId);
    (userDAL.isConnectOnboardingComplete as any).mockResolvedValue(true);
    (requireCommunityMembership as any).mockResolvedValue({
      community: { id: "community-123" },
    });
    (listingDAL.createListing as any).mockResolvedValue({
      id: mockListingId,
      name: "Test Listing",
    });
  });

  describe("Happy Path Flow", () => {
    it("should successfully create listing through complete flow", async () => {
      const result = await createListing(mockCreateListingFormData);

      // Verify the flow completed successfully
      expect(result).toEqual({
        success: true,
        listingId: mockListingId,
      });

      // Verify all steps were called
      expect(getCurrentUserId).toHaveBeenCalled();
      expect(userDAL.isConnectOnboardingComplete).toHaveBeenCalledWith(
        mockUserId,
      );
      // DAL is called with data (images are processed before passing to DAL)
      expect(listingDAL.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockCreateListingFormData.name,
          description: mockCreateListingFormData.description,
          categoryId: mockCreateListingFormData.categoryId,
          condition: mockCreateListingFormData.condition,
          dailyRate: mockCreateListingFormData.dailyRate,
        }),
        mockUserId,
        "community-123",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/listings");
    });

    it("should handle minimal valid form data", async () => {
      const result = await createListing(mockMinimalCreateListingFormData);

      expect(result).toEqual({
        success: true,
        listingId: mockListingId,
      });

      expect(listingDAL.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockMinimalCreateListingFormData.name,
          description: mockMinimalCreateListingFormData.description,
          categoryId: mockMinimalCreateListingFormData.categoryId,
          condition: mockMinimalCreateListingFormData.condition,
          dailyRate: mockMinimalCreateListingFormData.dailyRate,
        }),
        mockUserId,
        "community-123",
      );
    });
  });

  describe("Authentication Flow", () => {
    it("should fail when user is not authenticated", async () => {
      (getCurrentUserId as any).mockResolvedValue(null);

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error: "Unauthorized: User not authenticated",
      });

      // Should not proceed to other steps
      expect(userDAL.isConnectOnboardingComplete).not.toHaveBeenCalled();
      expect(listingDAL.createListing).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("should fail when Stripe Connect onboarding is not complete", async () => {
      (userDAL.isConnectOnboardingComplete as any).mockResolvedValue(false);

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error:
          "Complete Stripe onboarding first. You need to set up payments before creating listings.",
      });

      // Should not proceed to listing creation
      expect(listingDAL.createListing).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("should handle Stripe Connect check error", async () => {
      (userDAL.isConnectOnboardingComplete as any).mockRejectedValue(
        new Error("Stripe API error"),
      );

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error:
          "Complete Stripe onboarding first. You need to set up payments before creating listings.",
      });

      expect(listingDAL.createListing).not.toHaveBeenCalled();
    });
  });

  describe("Validation Flow", () => {
    it("should handle invalid form data", async () => {
      const invalidData = {
        ...mockCreateListingFormData,
        name: "", // Invalid: empty name
        dailyRate: -10, // Invalid: negative price
      };

      const result = await createListing(invalidData);

      expect(result).toEqual(
        expect.objectContaining({
          error: "Validation failed",
          details: expect.any(Object),
        }),
      );

      // Should not proceed to DAL
      expect(listingDAL.createListing).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("should return structured validation errors", async () => {
      const invalidData = {
        ...mockCreateListingFormData,
        name: "",
        description: "",
        categoryId: "",
        dailyRate: -5,
        images: [],
      };

      const result = await createListing(invalidData);

      expect(result).toHaveProperty("error", "Validation failed");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("fieldErrors");
      expect(result.details).toHaveProperty("formErrors");

      expect(listingDAL.createListing).not.toHaveBeenCalled();
    });
  });

  describe("DAL Integration", () => {
    it("should call DAL createListing with correct data", async () => {
      await createListing(mockCreateListingFormData);

      expect(listingDAL.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockCreateListingFormData.name,
          description: mockCreateListingFormData.description,
          categoryId: mockCreateListingFormData.categoryId,
          condition: mockCreateListingFormData.condition,
        }),
        mockUserId,
        "community-123",
      );
      expect(listingDAL.createListing).toHaveBeenCalledTimes(1);
    });

    it("should handle DAL errors gracefully", async () => {
      const dalError = new Error("Database connection failed");
      (listingDAL.createListing as any).mockRejectedValue(dalError);

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error: "Database connection failed",
      });

      // Should not revalidate on error
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("should handle generic DAL errors", async () => {
      (listingDAL.createListing as any).mockRejectedValue("String error");

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error: "An unexpected error occurred while creating the listing",
      });
    });

    it("should handle null listing return from DAL", async () => {
      (listingDAL.createListing as any).mockResolvedValue(null);

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error: "Failed to create listing",
      });

      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("Cache Revalidation", () => {
    it("should revalidate garage and listings paths on success", async () => {
      await createListing(mockCreateListingFormData);

      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/listings");
      expect(revalidatePath).toHaveBeenCalledTimes(2);
    });

    it("should not revalidate paths on failure", async () => {
      (listingDAL.createListing as any).mockRejectedValue(
        new Error("DAL error"),
      );

      await createListing(mockCreateListingFormData);

      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("Error Propagation", () => {
    it("should propagate authentication errors correctly", async () => {
      (getCurrentUserId as any).mockResolvedValue(null);

      const result = await createListing(mockCreateListingFormData);

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Unauthorized");
      expect(typeof result.error).toBe("string");
    });

    it("should propagate validation errors with details", async () => {
      const invalidData = {
        ...mockCreateListingFormData,
        name: "",
      };

      const result = await createListing(invalidData);

      expect(result).toHaveProperty("error", "Validation failed");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("fieldErrors");
    });

    it("should propagate DAL errors as strings", async () => {
      const dalError = new Error("Unique constraint violation");
      (listingDAL.createListing as any).mockRejectedValue(dalError);

      const result = await createListing(mockCreateListingFormData);

      expect(result).toEqual({
        error: "Unique constraint violation",
      });
    });
  });

  describe("Data Flow Integrity", () => {
    it("should not modify input data before passing to DAL", async () => {
      const inputData = { ...mockCreateListingFormData };
      const originalData = { ...inputData };

      await createListing(inputData);

      // Input data should not be modified by the action
      expect(inputData).toEqual(originalData);
      // DAL receives processed data (images transformed, etc.)
      expect(listingDAL.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          name: originalData.name,
          description: originalData.description,
          categoryId: originalData.categoryId,
        }),
        mockUserId,
        "community-123",
      );
    });

    it("should pass userId context correctly through the flow", async () => {
      const customUserId = "custom-user-789";
      (getCurrentUserId as any).mockResolvedValue(customUserId);

      await createListing(mockCreateListingFormData);

      expect(userDAL.isConnectOnboardingComplete).toHaveBeenCalledWith(
        customUserId,
      );
      expect(listingDAL.createListing).toHaveBeenCalledWith(
        expect.any(Object),
        customUserId,
        "community-123",
      );
    });

    it("should maintain data consistency across validation and DAL call", async () => {
      const complexData = {
        ...mockCreateListingFormData,
        specifications: { power: "20V", weight: "3.4 lbs" },
        instructions: "Custom instructions",
      };

      await createListing(complexData);

      expect(listingDAL.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          name: complexData.name,
          description: complexData.description,
          specifications: complexData.specifications,
          instructions: complexData.instructions,
        }),
        mockUserId,
        "community-123",
      );
    });
  });
});
