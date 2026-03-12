import { describe, it, expect, vi } from "vitest";
import type { ListingImage } from "@/features/listings/hooks/use-listing-images";
import type { ImageFile } from "@/features/listings/form-schema/listing.schema";
import {
  listingImagesToImageFiles,
  imageFilesToUrls,
  filesToImageFiles,
  isHeicFile,
  convertHeicToJpeg,
  validateImageFile,
} from "../image.utils";

vi.mock("heic2any", () => ({
  default: vi.fn(),
}));

describe("listingImagesToImageFiles", () => {
  it("maps ListingImage array to ImageFile array", () => {
    const listingImages: ListingImage[] = [
      {
        id: "img-1",
        listingId: "listing-1",
        imageUrl: "https://example.com/1.jpg",
        blobPathname: "images/1.jpg",
        orderIndex: 0,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "img-2",
        listingId: "listing-1",
        imageUrl: "https://example.com/2.jpg",
        blobPathname: "images/2.jpg",
        orderIndex: 1,
        createdAt: new Date("2024-01-02"),
      },
    ];

    const result = listingImagesToImageFiles(listingImages);

    expect(result).toEqual([
      { id: "img-1", url: "https://example.com/1.jpg", orderIndex: 0 },
      { id: "img-2", url: "https://example.com/2.jpg", orderIndex: 1 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(listingImagesToImageFiles([])).toEqual([]);
  });
});

describe("imageFilesToUrls", () => {
  it("extracts URLs from ImageFile array", () => {
    const imageFiles: ImageFile[] = [
      { url: "https://example.com/1.jpg", orderIndex: 0 },
      { url: "https://example.com/2.jpg", orderIndex: 1 },
    ];

    expect(imageFilesToUrls(imageFiles)).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
  });

  it("filters out undefined URLs", () => {
    const imageFiles: ImageFile[] = [
      { url: "https://example.com/1.jpg", orderIndex: 0 },
      { orderIndex: 1 },
      { url: "", orderIndex: 2 },
    ];

    expect(imageFilesToUrls(imageFiles)).toEqual([
      "https://example.com/1.jpg",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(imageFilesToUrls([])).toEqual([]);
  });
});

describe("filesToImageFiles", () => {
  it("wraps File objects with orderIndex", () => {
    const file1 = new File(["a"], "photo1.jpg", { type: "image/jpeg" });
    const file2 = new File(["b"], "photo2.png", { type: "image/png" });

    const result = filesToImageFiles([file1, file2]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ file: file1, orderIndex: 0 });
    expect(result[1]).toEqual({ file: file2, orderIndex: 1 });
  });

  it("returns empty array for empty input", () => {
    expect(filesToImageFiles([])).toEqual([]);
  });
});

describe("isHeicFile", () => {
  it("detects HEIC by MIME type", () => {
    const file = new File([""], "photo.jpg", { type: "image/heic" });
    expect(isHeicFile(file)).toBe(true);
  });

  it("detects HEIF by MIME type", () => {
    const file = new File([""], "photo.jpg", { type: "image/heif" });
    expect(isHeicFile(file)).toBe(true);
  });

  it("detects HEIC by file extension", () => {
    const file = new File([""], "photo.HEIC", { type: "" });
    expect(isHeicFile(file)).toBe(true);
  });

  it("detects HEIF by file extension", () => {
    const file = new File([""], "photo.heif", { type: "" });
    expect(isHeicFile(file)).toBe(true);
  });

  it("returns false for non-HEIC files", () => {
    const file = new File([""], "photo.jpg", { type: "image/jpeg" });
    expect(isHeicFile(file)).toBe(false);
  });
});

describe("convertHeicToJpeg", () => {
  it("converts HEIC file to JPEG", async () => {
    const heic2any = (await import("heic2any")).default as ReturnType<
      typeof vi.fn
    >;
    const mockBlob = new Blob(["jpeg-data"], { type: "image/jpeg" });
    heic2any.mockResolvedValue(mockBlob);

    const heicFile = new File(["heic-data"], "photo.heic", {
      type: "image/heic",
    });
    const result = await convertHeicToJpeg(heicFile);

    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(heic2any).toHaveBeenCalledWith({
      blob: heicFile,
      toType: "image/jpeg",
      quality: 0.92,
    });
  });

  it("handles array response from heic2any", async () => {
    const heic2any = (await import("heic2any")).default as ReturnType<
      typeof vi.fn
    >;
    const mockBlob = new Blob(["jpeg-data"], { type: "image/jpeg" });
    heic2any.mockResolvedValue([mockBlob]);

    const heicFile = new File(["heic-data"], "photo.HEIF", {
      type: "image/heif",
    });
    const result = await convertHeicToJpeg(heicFile);

    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
  });
});

describe("validateImageFile", () => {
  it("accepts valid image files", () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts HEIC files even with empty MIME type", () => {
    const file = new File(["data"], "photo.heic", { type: "" });
    expect(validateImageFile(file)).toBeNull();
  });

  it("rejects non-image files", () => {
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    expect(validateImageFile(file)).toBe("File must be an image");
  });

  it("rejects files over 10MB", () => {
    const bigData = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigData], "big.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBe("File too large (max 10MB)");
  });

  it("accepts files exactly 10MB", () => {
    const data = new Uint8Array(10 * 1024 * 1024);
    const file = new File([data], "exact.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });
});
