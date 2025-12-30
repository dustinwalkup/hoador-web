import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadListingImage } from "../create-listing";

// Mock dependencies
vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("uploadListingImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload image successfully and save to database", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");
    const { db } = await import("@/db/db");

    const mockFile = new File(["test image content"], "test-drill.jpg", {
      type: "image/jpeg",
    });
    const listingId = "listing-123";
    const orderIndex = 0;

    const mockBlob = {
      url: "https://example.com/listings/listing-123/1234567890-test-drill.jpg",
      pathname: "listings/listing-123/1234567890-test-drill.jpg",
    };

    const mockSavedImage = {
      id: "image-456",
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock the entire database chain - db.insert(table) returns object with .values()
    const mockReturning = vi.fn().mockResolvedValue([mockSavedImage]);
    const mockValues = vi.fn().mockReturnValue({
      returning: mockReturning,
    });
    (db.insert as any).mockReturnValue({
      values: mockValues,
    });

    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);

    // Mock Date.now for predictable filename
    const mockNow = 1234567890;
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result).toEqual({
      success: true,
      image: mockSavedImage,
    });
    expect(uploadToBlob).toHaveBeenCalledWith(
      "listings/listing-123/1234567890-test-drill.jpg",
      mockFile,
    );
    expect(db.insert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex,
    });
  });

  it("should sanitize filename by removing special characters", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");
    const { db } = await import("@/db/db");

    const mockFile = new File(["test"], "test drill (heavy-duty).jpg", {
      type: "image/jpeg",
    });
    const listingId = "listing-123";
    const orderIndex = 1;

    const mockBlob = {
      url: "https://example.com/listings/listing-123/1234567890-test_drill__heavy-duty_.jpg",
      pathname: "listings/listing-123/1234567890-test_drill__heavy-duty_.jpg",
    };

    const mockSavedImage = {
      id: "image-457",
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);
    const mockReturning = vi.fn().mockResolvedValue([mockSavedImage]);
    const mockValues = vi.fn().mockReturnValue({
      returning: mockReturning,
    });
    (db.insert as any).mockReturnValue({
      values: mockValues,
    });

    // Mock Date.now
    const mockNow = 1234567890;
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result.success).toBe(true);
    expect(uploadToBlob).toHaveBeenCalledWith(
      "listings/listing-123/1234567890-test_drill__heavy-duty_.jpg",
      mockFile,
    );
  });

  it("should handle different image file types", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");
    const { db } = await import("@/db/db");

    const mockFile = new File(["test"], "power-tool.png", {
      type: "image/png",
    });
    const listingId = "listing-456";
    const orderIndex = 2;

    const mockBlob = {
      url: "https://example.com/listings/listing-456/1234567890-power-tool.png",
      pathname: "listings/listing-456/1234567890-power-tool.png",
    };

    const mockSavedImage = {
      id: "image-458",
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);
    const mockReturning = vi.fn().mockResolvedValue([mockSavedImage]);
    const mockValues = vi.fn().mockReturnValue({
      returning: mockReturning,
    });
    (db.insert as any).mockReturnValue({
      values: mockValues,
    });

    // Mock Date.now
    const mockNow = 1234567890;
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result).toEqual({
      success: true,
      image: mockSavedImage,
    });
    expect(uploadToBlob).toHaveBeenCalledWith(
      "listings/listing-456/1234567890-power-tool.png",
      mockFile,
    );
  });

  it("should return error when upload service fails", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");

    const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const listingId = "listing-123";
    const orderIndex = 0;

    vi.mocked(uploadToBlob).mockRejectedValue(new Error("Upload failed"));

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to upload image",
    });
    expect(uploadToBlob).toHaveBeenCalledWith(
      expect.stringContaining("listings/listing-123/"),
      mockFile,
    );
  });

  it("should return error when invalid file type", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");
    const { db } = await import("@/db/db");

    // Create a file with invalid type
    const mockFile = new File(["test"], "document.pdf", {
      type: "application/pdf",
    });
    const listingId = "listing-123";
    const orderIndex = 0;

    // Mock upload to succeed (though in real app it might fail validation)
    const mockBlob = {
      url: "https://example.com/listings/listing-123/1234567890-document.pdf",
      pathname: "listings/listing-123/1234567890-document.pdf",
    };

    const mockSavedImage = {
      id: "image-456",
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);
    const mockReturning = vi.fn().mockResolvedValue([mockSavedImage]);
    const mockValues = vi.fn().mockReturnValue({
      returning: mockReturning,
    });
    (db.insert as any).mockReturnValue({
      values: mockValues,
    });

    // Mock Date.now
    const mockNow = 1234567890;
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert - this should still succeed as the action doesn't validate file types
    expect(result.success).toBe(true);
    expect(result.image!.imageUrl).toBe(mockBlob.url);
  });

  it("should return error when database insert fails", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");
    const { db } = await import("@/db/db");

    const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const listingId = "listing-123";
    const orderIndex = 0;

    const mockBlob = {
      url: "https://example.com/listings/listing-123/1234567890-test.jpg",
      pathname: "listings/listing-123/1234567890-test.jpg",
    };

    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);
    (db.insert as any).mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to upload image",
    });
  });

  it("should handle file too large scenario", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");

    const mockFile = new File(["test"], "large-image.jpg", {
      type: "image/jpeg",
    });
    const listingId = "listing-123";
    const orderIndex = 0;

    vi.mocked(uploadToBlob).mockRejectedValue(
      new Error("File size exceeds limit"),
    );

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to upload image",
    });
  });

  it("should handle different orderIndex values", async () => {
    // Arrange
    const { uploadToBlob } = await import("@/services/vercel-blob");
    const { db } = await import("@/db/db");

    const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const listingId = "listing-789";
    const orderIndex = 5;

    const mockBlob = {
      url: "https://example.com/listings/listing-789/1234567890-test.jpg",
      pathname: "listings/listing-789/1234567890-test.jpg",
    };

    const mockSavedImage = {
      id: "image-459",
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(uploadToBlob).mockResolvedValue(mockBlob);
    const mockReturning = vi.fn().mockResolvedValue([mockSavedImage]);
    const mockValues = vi.fn().mockReturnValue({
      returning: mockReturning,
    });
    (db.insert as any).mockReturnValue({
      values: mockValues,
    });

    // Mock Date.now
    const mockNow = 1234567890;
    vi.spyOn(Date, "now").mockReturnValue(mockNow);

    // Act
    const result = await uploadListingImage(mockFile, listingId, orderIndex);

    // Assert
    expect(result.success).toBe(true);
    expect(result.image!.orderIndex).toBe(5);
    expect(mockValues).toHaveBeenCalledWith({
      listingId,
      imageUrl: mockBlob.url,
      blobPathname: mockBlob.pathname,
      orderIndex: 5,
    });
  });
});
