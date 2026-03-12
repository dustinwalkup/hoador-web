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

    expect(uploadResult!).toEqual({
      succeeded: 0,
      failed: 0,
      total: 0,
      failedIndices: [],
      uploadedImages: [],
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should upload files sequentially and track progress", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            image: { id: "uploaded-1" },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            image: { id: "uploaded-2" },
          }),
      });

    const { result } = renderHook(() => useImageUpload());
    const images = createImageFiles(2);

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(images, listingId);
    });

    expect(uploadResult!).toEqual({
      succeeded: 2,
      failed: 0,
      total: 2,
      failedIndices: [],
      uploadedImages: [{ id: "uploaded-1" }, { id: "uploaded-2" }],
    });
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
        json: () =>
          Promise.resolve({ success: true, image: { id: "uploaded-1" } }),
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

    expect(uploadResult!).toEqual({
      succeeded: 1,
      failed: 1,
      total: 2,
      failedIndices: [1],
      uploadedImages: [{ id: "uploaded-1" }],
    });
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

    expect(uploadResult!).toEqual({
      succeeded: 0,
      failed: 3,
      total: 3,
      failedIndices: [0, 1, 2],
      uploadedImages: [],
    });
  });

  it("should return empty result for empty images array", async () => {
    const { result } = renderHook(() => useImageUpload());

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages([], listingId);
    });

    expect(uploadResult!).toEqual({
      succeeded: 0,
      failed: 0,
      total: 0,
      failedIndices: [],
      uploadedImages: [],
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should upload images in sequential order", async () => {
    const callOrder: number[] = [];
    mockFetch
      .mockImplementationOnce(() => {
        callOrder.push(1);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, image: { id: "first" } }),
        });
      })
      .mockImplementationOnce(() => {
        callOrder.push(2);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, image: { id: "second" } }),
        });
      })
      .mockImplementationOnce(() => {
        callOrder.push(3);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, image: { id: "third" } }),
        });
      });

    const { result } = renderHook(() => useImageUpload());
    const images = createImageFiles(3);

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(images, listingId);
    });

    // Verify sequential order
    expect(callOrder).toEqual([1, 2, 3]);
    expect(uploadResult!.uploadedImages).toEqual([
      { id: "first" },
      { id: "second" },
      { id: "third" },
    ]);
  });
});
