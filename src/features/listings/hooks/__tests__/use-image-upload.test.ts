import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageUpload } from "../use-image-upload";
import type { ImageFile } from "@/features/listings/form-schema/listing.schema";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useImageUpload", () => {
  const listingId = "listing-123";

  const createImageFiles = (count: number): ImageFile[] =>
    Array.from({ length: count }, (_, i) => ({
      file: new File(["content"], `image${i}.jpg`, { type: "image/jpeg" }),
      orderIndex: i,
    }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with null upload progress", () => {
    const { result } = renderHook(() => useImageUpload());
    expect(result.current.uploadProgress).toBeNull();
  });

  it("should return early for images without files", async () => {
    const { result } = renderHook(() => useImageUpload());

    const imagesWithoutFiles: ImageFile[] = [
      { url: "https://example.com/existing.jpg", id: "img-1", orderIndex: 0 },
    ];

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(
        imagesWithoutFiles,
        listingId,
      );
    });

    expect(uploadResult!).toEqual({ succeeded: 0, failed: 0, total: 0 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should upload files and track progress", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useImageUpload());
    const images = createImageFiles(2);

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(images, listingId);
    });

    expect(uploadResult!).toEqual({ succeeded: 2, failed: 0, total: 2 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/listings/${listingId}`,
      expect.objectContaining({ method: "POST" }),
    );
    // Progress should be null after completion
    expect(result.current.uploadProgress).toBeNull();
  });

  it("should handle partial upload failures", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Upload failed" }),
      });

    const { result } = renderHook(() => useImageUpload());
    const images = createImageFiles(2);

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(images, listingId);
    });

    expect(uploadResult!).toEqual({ succeeded: 1, failed: 1, total: 2 });
  });

  it("should handle total upload failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const { result } = renderHook(() => useImageUpload());
    const images = createImageFiles(3);

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(images, listingId);
    });

    expect(uploadResult!).toEqual({ succeeded: 0, failed: 3, total: 3 });
  });

  it("should return empty result for empty images array", async () => {
    const { result } = renderHook(() => useImageUpload());

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages([], listingId);
    });

    expect(uploadResult!).toEqual({ succeeded: 0, failed: 0, total: 0 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
