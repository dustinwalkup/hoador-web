import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateListingStatus } from "../update-listing-status";
import { listingDAL } from "@/dal";
import { revalidatePath } from "next/cache";
import { mockListing } from "@/test/fixtures/listings";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    updateListingStatus: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("updateListingStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update listing status with valid data", async () => {
    // Arrange
    const listingId = "listing-123";
    const formData = { status: "maintenance" as const };
    const updatedListing = { ...mockListing, status: "maintenance" };

    vi.mocked(listingDAL.updateListingStatus).mockResolvedValue(
      updatedListing as any,
    );

    // Act
    const result = await updateListingStatus(listingId, formData);

    // Assert
    expect(result).toEqual({ success: true, listing: updatedListing });
    expect(listingDAL.updateListingStatus).toHaveBeenCalledWith(
      listingId,
      "maintenance",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/listings");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/explore");
  });

  it("should return error when validation fails", async () => {
    // Arrange
    const listingId = "listing-123";
    const invalidFormData = { status: "invalid-status" as any };

    // Act
    const result = await updateListingStatus(listingId, invalidFormData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Validation failed");
    expect(listingDAL.updateListingStatus).not.toHaveBeenCalled();
  });

  it("should return error when DAL throws error", async () => {
    // Arrange
    const listingId = "listing-123";
    const formData = { status: "maintenance" as const };
    vi.mocked(listingDAL.updateListingStatus).mockRejectedValue(
      new Error("Unauthorized: Not the owner"),
    );

    // Act
    const result = await updateListingStatus(listingId, formData);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Unauthorized: Not the owner");
  });

  it("should handle all valid status values", async () => {
    // Arrange
    const listingId = "listing-123";
    const validStatuses = ["available", "maintenance", "inactive"] as const;

    for (const status of validStatuses) {
      vi.clearAllMocks();
      const updatedListing = { ...mockListing, status };
      vi.mocked(listingDAL.updateListingStatus).mockResolvedValue(
        updatedListing as any,
      );

      // Act
      const result = await updateListingStatus(listingId, { status });

      // Assert
      expect(result.success).toBe(true);
      expect(listingDAL.updateListingStatus).toHaveBeenCalledWith(
        listingId,
        status,
      );
    }
  });
});
