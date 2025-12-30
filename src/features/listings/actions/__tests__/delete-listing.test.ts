import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteListing } from "../delete-listing";
import { listingDAL } from "@/dal";
import { revalidatePath } from "next/cache";

// Mock dependencies
vi.mock("@/dal", () => ({
  listingDAL: {
    deleteListing: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("deleteListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete listing successfully", async () => {
    // Arrange
    const listingId = "listing-123";
    vi.mocked(listingDAL.deleteListing).mockResolvedValue(undefined);

    // Act
    const result = await deleteListing(listingId);

    // Assert
    expect(result).toEqual({ success: true });
    expect(listingDAL.deleteListing).toHaveBeenCalledWith(listingId);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/listings");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/explore");
  });

  it("should return error when DAL throws error", async () => {
    // Arrange
    const listingId = "listing-123";
    vi.mocked(listingDAL.deleteListing).mockRejectedValue(
      new Error("Unauthorized: Not the owner"),
    );

    // Act
    const result = await deleteListing(listingId);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Unauthorized: Not the owner");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("should return error when listing not found", async () => {
    // Arrange
    const listingId = "non-existent-listing";
    vi.mocked(listingDAL.deleteListing).mockRejectedValue(
      new Error("Listing not found"),
    );

    // Act
    const result = await deleteListing(listingId);

    // Assert
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Listing not found");
  });
});

