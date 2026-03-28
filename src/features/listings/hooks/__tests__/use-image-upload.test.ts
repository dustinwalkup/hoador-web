import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageUpload } from "../use-image-upload";
import type { ImageFile } from "@/features/listings/form-schema/listing.schema";

// ─── XMLHttpRequest mock ──────────────────────────────────────────────────
// The hook uses XHR (not fetch) to get byte-level upload progress.
type XHRQueueEntry = { status: number; responseText: string; error?: boolean };
const xhrQueue: XHRQueueEntry[] = [];
let xhrOpenCount = 0;

class MockXHR {
  upload = {
    onprogress: null as
      | ((e: {
          lengthComputable: boolean;
          loaded: number;
          total: number;
        }) => void)
      | null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 200;
  responseText = "";

  open = vi.fn(() => {
    xhrOpenCount++;
  });

  send = vi.fn(() => {
    const entry = xhrQueue.shift();
    if (!entry) return;
    // Schedule asynchronously (mirrors real XHR behaviour)
    Promise.resolve().then(() => {
      this.status = entry.status;
      this.responseText = entry.responseText;
      if (entry.error) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  });
}

vi.stubGlobal("XMLHttpRequest", MockXHR);
// ─────────────────────────────────────────────────────────────────────────

describe("useImageUpload", () => {
  const listingId = "listing-123";

  const createImageFiles = (count: number): ImageFile[] =>
    Array.from({ length: count }, (_, i) => ({
      file: new File(["content"], `image${i}.jpg`, { type: "image/jpeg" }),
      orderIndex: i,
    }));

  beforeEach(() => {
    vi.clearAllMocks();
    xhrQueue.length = 0;
    xhrOpenCount = 0;
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
    expect(xhrOpenCount).toBe(0);
  });

  it("should upload files sequentially and track progress", async () => {
    xhrQueue.push(
      {
        status: 200,
        responseText: JSON.stringify({
          success: true,
          image: { id: "uploaded-1" },
        }),
      },
      {
        status: 200,
        responseText: JSON.stringify({
          success: true,
          image: { id: "uploaded-2" },
        }),
      },
    );

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
    expect(xhrOpenCount).toBe(2);
    // Progress should be null after completion
    expect(result.current.uploadProgress).toBeNull();
  });

  it("should handle partial upload failures", async () => {
    xhrQueue.push(
      {
        status: 200,
        responseText: JSON.stringify({
          success: true,
          image: { id: "uploaded-1" },
        }),
      },
      {
        status: 500,
        responseText: JSON.stringify({ error: "Upload failed" }),
      },
    );

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
    // Server errors (4xx/5xx) are non-retryable — one XHR call per image
    xhrQueue.push(
      { status: 500, responseText: JSON.stringify({ error: "Server error" }) },
      { status: 500, responseText: JSON.stringify({ error: "Server error" }) },
      { status: 500, responseText: JSON.stringify({ error: "Server error" }) },
    );

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
    expect(xhrOpenCount).toBe(0);
  });

  it("should upload images in sequential order", async () => {
    // Sequential upload is guaranteed by the await-in-loop in the hook.
    // Verify results arrive in input order.
    xhrQueue.push(
      {
        status: 200,
        responseText: JSON.stringify({ success: true, image: { id: "first" } }),
      },
      {
        status: 200,
        responseText: JSON.stringify({
          success: true,
          image: { id: "second" },
        }),
      },
      {
        status: 200,
        responseText: JSON.stringify({ success: true, image: { id: "third" } }),
      },
    );

    const { result } = renderHook(() => useImageUpload());
    const images = createImageFiles(3);

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadImages>>;
    await act(async () => {
      uploadResult = await result.current.uploadImages(images, listingId);
    });

    expect(xhrOpenCount).toBe(3);
    expect(uploadResult!.uploadedImages).toEqual([
      { id: "first" },
      { id: "second" },
      { id: "third" },
    ]);
  });
});
