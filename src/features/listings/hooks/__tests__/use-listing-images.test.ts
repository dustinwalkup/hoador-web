import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useListingImages, type ListingImage } from "../use-listing-images";

// Mock toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useListingImages", () => {
  const mockListingId = "listing-123";
  const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });

  const mockImages: ListingImage[] = [
    {
      id: "img1",
      listingId: mockListingId,
      imageUrl: "https://example.com/img1.jpg",
      blobPathname: "img1.jpg",
      orderIndex: 0,
      createdAt: new Date("2024-01-01"),
    },
    {
      id: "img2",
      listingId: mockListingId,
      imageUrl: "https://example.com/img2.jpg",
      blobPathname: "img2.jpg",
      orderIndex: 1,
      createdAt: new Date("2024-01-02"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Initial State", () => {
    it("should initialize with empty images array", () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      expect(result.current.images).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("loadImages", () => {
    it("should load images successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, images: mockImages }),
      });

      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.loadImages();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.images).toEqual(mockImages);
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/listings/${mockListingId}/images`,
      );
    });

    it("should handle load images error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: "Load failed" }),
      });

      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.loadImages();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith("Load failed");
    });

    it("should handle network error during load", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.loadImages();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to load images");
    });

    it("should not load images when listingId is empty", async () => {
      const { result } = renderHook(() => useListingImages(""));

      act(() => {
        result.current.loadImages();
      });

      // Should not change loading state or make API call
      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("uploadImage", () => {
    const mockUploadedImage: ListingImage = {
      id: "img3",
      listingId: mockListingId,
      imageUrl: "https://example.com/img3.jpg",
      blobPathname: "img3.jpg",
      orderIndex: 2,
      createdAt: new Date(),
    };

    it("should upload image successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, image: mockUploadedImage }),
      });

      const { result } = renderHook(() => useListingImages(mockListingId));

      let uploadPromise: Promise<ListingImage | null>;
      act(() => {
        uploadPromise = result.current.uploadImage(mockFile);
      });

      expect(result.current.isUploading).toBe(true);

      const resultImage = await uploadPromise!;

      expect(resultImage).toEqual(mockUploadedImage);

      await waitFor(() => {
        expect(result.current.images).toEqual([mockUploadedImage]);
      });

      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });

      expect(toast.success).toHaveBeenCalledWith("Image uploaded successfully");

      // Verify FormData was created correctly
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/listings/${mockListingId}/images`,
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });

    it("should handle upload error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: "Upload failed" }),
      });

      const { result } = renderHook(() => useListingImages(mockListingId));

      const uploadPromise = result.current.uploadImage(mockFile);

      const resultImage = await uploadPromise;

      expect(resultImage).toBeNull();
      expect(result.current.isUploading).toBe(false);
      expect(toast.error).toHaveBeenCalledWith("Upload failed");
    });

    it("should handle network error during upload", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useListingImages(mockListingId));

      const uploadPromise = result.current.uploadImage(mockFile);

      const resultImage = await uploadPromise;

      expect(resultImage).toBeNull();
      expect(result.current.isUploading).toBe(false);
      expect(toast.error).toHaveBeenCalledWith("Upload failed");
    });

    it("should append image to existing images", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, image: mockImages[0] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, image: mockImages[1] }),
        });

      const { result } = renderHook(() => useListingImages(mockListingId));

      // Upload first image
      await act(async () => {
        await result.current.uploadImage(mockFile);
      });
      expect(result.current.images).toEqual([mockImages[0]]);

      // Upload second image
      await act(async () => {
        await result.current.uploadImage(mockFile);
      });
      expect(result.current.images).toEqual(mockImages);
    });
  });

  describe("deleteImage", () => {
    it("should delete image successfully", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      // Set up initial state with images
      act(() => {
        result.current.setImages(mockImages);
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.deleteImage("img1");
      });

      expect(result.current.images).toEqual([mockImages[1]]);
      expect(toast.success).toHaveBeenCalledWith("Image deleted successfully");

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/listings/${mockListingId}/images/img1`,
        { method: "DELETE" },
      );
    });

    it("should handle delete error", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.setImages(mockImages);
      });

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: "Delete failed" }),
      });

      await act(async () => {
        await result.current.deleteImage("img1");
      });

      // Images should not be removed on error
      expect(result.current.images).toEqual(mockImages);
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });

    it("should handle network error during delete", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.setImages(mockImages);
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await result.current.deleteImage("img1");
      });

      // Images should not be removed on error
      expect(result.current.images).toEqual(mockImages);
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  describe("reorderImages", () => {
    it("should reorder images successfully", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.setImages(mockImages);
      });

      const newOrder = ["img2", "img1"];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.reorderImages(newOrder);
      });

      // Verify images are reordered with correct orderIndex
      expect(result.current.images).toEqual([
        { ...mockImages[1], orderIndex: 0 },
        { ...mockImages[0], orderIndex: 1 },
      ]);

      expect(toast.success).toHaveBeenCalledWith(
        "Images reordered successfully",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/listings/${mockListingId}/images/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageIds: newOrder }),
        },
      );
    });

    it("should handle reorder error", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      const originalImages = [...mockImages];
      act(() => {
        result.current.setImages(originalImages);
      });

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: "Reorder failed" }),
      });

      await act(async () => {
        await result.current.reorderImages(["img2", "img1"]);
      });

      // Images should remain unchanged on error
      expect(result.current.images).toEqual(originalImages);
      expect(toast.error).toHaveBeenCalledWith("Reorder failed");
    });

    it("should handle network error during reorder", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      const originalImages = [...mockImages];
      act(() => {
        result.current.setImages(originalImages);
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await result.current.reorderImages(["img2", "img1"]);
      });

      // Images should remain unchanged on error
      expect(result.current.images).toEqual(originalImages);
      expect(toast.error).toHaveBeenCalledWith("Reorder failed");
    });
  });

  describe("State Management", () => {
    it("should allow manual image state updates", () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.setImages(mockImages);
      });

      expect(result.current.images).toEqual(mockImages);
    });

    it("should maintain loading state correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, images: mockImages }),
      });

      const { result } = renderHook(() => useListingImages(mockListingId));

      expect(result.current.isLoading).toBe(false);

      let loadPromise: Promise<void>;
      act(() => {
        loadPromise = result.current.loadImages();
      });

      expect(result.current.isLoading).toBe(true);

      await loadPromise!;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should maintain uploading state correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, image: mockImages[0] }),
      });

      const { result } = renderHook(() => useListingImages(mockListingId));

      expect(result.current.isUploading).toBe(false);

      let uploadPromise: Promise<ListingImage | null>;
      act(() => {
        uploadPromise = result.current.uploadImage(mockFile);
      });

      expect(result.current.isUploading).toBe(true);

      await uploadPromise!;

      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });
    });
  });

  describe("Return Values", () => {
    it("should return all expected properties", () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      expect(result.current).toHaveProperty("images");
      expect(result.current).toHaveProperty("setImages");
      expect(result.current).toHaveProperty("loadImages");
      expect(result.current).toHaveProperty("uploadImage");
      expect(result.current).toHaveProperty("deleteImage");
      expect(result.current).toHaveProperty("reorderImages");
      expect(result.current).toHaveProperty("isUploading");
      expect(result.current).toHaveProperty("isLoading");
    });

    it("should have correct function signatures", () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      expect(typeof result.current.loadImages).toBe("function");
      expect(typeof result.current.uploadImage).toBe("function");
      expect(typeof result.current.deleteImage).toBe("function");
      expect(typeof result.current.reorderImages).toBe("function");
      expect(typeof result.current.setImages).toBe("function");
      expect(typeof result.current.images).toBe("object");
      expect(typeof result.current.isUploading).toBe("boolean");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty listingId", () => {
      const { result } = renderHook(() => useListingImages(""));

      expect(result.current.images).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle delete of non-existent image", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.setImages(mockImages);
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.deleteImage("non-existent-id");
      });

      // Should not change the images array
      expect(result.current.images).toEqual(mockImages);
    });

    it("should handle reorder with missing images", async () => {
      const { result } = renderHook(() => useListingImages(mockListingId));

      act(() => {
        result.current.setImages(mockImages);
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Try to reorder with an ID that doesn't exist
      await act(async () => {
        await result.current.reorderImages(["non-existent", "img1"]);
      });

      // Should still attempt the reorder (API should handle validation)
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
