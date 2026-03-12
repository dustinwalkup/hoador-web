import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processImageForUpload,
  getImageMetadata,
  validateImageForProcessing,
  validateImageMagicBytes,
  processImageWithFallback,
} from "../server";

const mockToBuffer = vi.fn();
const mockJpeg = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockWebp = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockResize = vi.fn().mockReturnValue({ jpeg: mockJpeg, webp: mockWebp });
const mockRotate = vi.fn().mockReturnValue({ resize: mockResize });
const mockMetadata = vi.fn();

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    rotate: mockRotate,
    metadata: mockMetadata,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the chain so each test starts fresh
  mockRotate.mockReturnValue({ resize: mockResize });
  mockResize.mockReturnValue({ jpeg: mockJpeg, webp: mockWebp });
  mockJpeg.mockReturnValue({ toBuffer: mockToBuffer });
  mockWebp.mockReturnValue({ toBuffer: mockToBuffer });
});

describe("processImageForUpload", () => {
  it("processes image with default JPEG settings", async () => {
    const inputBuffer = Buffer.from("test-image");
    const outputBuffer = Buffer.from("processed");
    mockToBuffer.mockResolvedValue(outputBuffer);

    const result = await processImageForUpload(inputBuffer);

    expect(result).toBe(outputBuffer);
    expect(mockRotate).toHaveBeenCalled();
    expect(mockResize).toHaveBeenCalledWith(2048, 2048, {
      fit: "inside",
      withoutEnlargement: true,
    });
    expect(mockJpeg).toHaveBeenCalledWith({
      quality: 85,
      progressive: true,
      mozjpeg: true,
    });
  });

  it("processes image with custom options", async () => {
    const inputBuffer = Buffer.from("test-image");
    mockToBuffer.mockResolvedValue(Buffer.from("processed"));

    await processImageForUpload(inputBuffer, {
      maxWidth: 1024,
      maxHeight: 768,
      quality: 90,
      format: "jpeg",
    });

    expect(mockResize).toHaveBeenCalledWith(1024, 768, {
      fit: "inside",
      withoutEnlargement: true,
    });
    expect(mockJpeg).toHaveBeenCalledWith({
      quality: 90,
      progressive: true,
      mozjpeg: true,
    });
  });

  it("processes image as WebP when specified", async () => {
    const inputBuffer = Buffer.from("test-image");
    mockToBuffer.mockResolvedValue(Buffer.from("processed"));

    await processImageForUpload(inputBuffer, { format: "webp" });

    expect(mockWebp).toHaveBeenCalledWith({
      quality: 85,
      effort: 6,
    });
  });
});

describe("getImageMetadata", () => {
  it("returns metadata from sharp", async () => {
    mockMetadata.mockResolvedValue({
      width: 1920,
      height: 1080,
      format: "jpeg",
      hasAlpha: false,
    });

    const buffer = Buffer.from("test-image");
    const result = await getImageMetadata(buffer);

    expect(result).toEqual({
      width: 1920,
      height: 1080,
      format: "jpeg",
      size: buffer.length,
      hasAlpha: false,
    });
  });
});

describe("validateImageForProcessing", () => {
  it("accepts valid image files", () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageForProcessing(file)).toBeNull();
  });

  it("accepts HEIC files by extension", () => {
    const file = new File(["data"], "photo.heic", { type: "" });
    expect(validateImageForProcessing(file)).toBeNull();
  });

  it("accepts HEIF files by extension", () => {
    const file = new File(["data"], "photo.HEIF", { type: "" });
    expect(validateImageForProcessing(file)).toBeNull();
  });

  it("rejects non-image files", () => {
    const file = new File(["data"], "doc.txt", { type: "text/plain" });
    expect(validateImageForProcessing(file)).toBe("File must be an image");
  });

  it("rejects files over default 10MB limit", () => {
    const bigData = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigData], "big.jpg", { type: "image/jpeg" });
    expect(validateImageForProcessing(file)).toBe("File too large (max 10MB)");
  });

  it("uses custom max size", () => {
    const data = new Uint8Array(6 * 1024 * 1024);
    const file = new File([data], "medium.jpg", { type: "image/jpeg" });
    expect(validateImageForProcessing(file, 5)).toBe(
      "File too large (max 5MB)",
    );
  });
});

describe("validateImageMagicBytes", () => {
  it("detects JPEG", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects PNG", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x89;
    buf[1] = 0x50;
    buf[2] = 0x4e;
    buf[3] = 0x47;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects GIF", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x47;
    buf[1] = 0x49;
    buf[2] = 0x46;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects WebP", () => {
    const buf = Buffer.alloc(12);
    // RIFF
    buf[0] = 0x52;
    buf[1] = 0x49;
    buf[2] = 0x46;
    buf[3] = 0x46;
    // WEBP
    buf[8] = 0x57;
    buf[9] = 0x45;
    buf[10] = 0x42;
    buf[11] = 0x50;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects HEIC/HEIF (ftyp box)", () => {
    const buf = Buffer.alloc(12);
    buf[4] = 0x66; // f
    buf[5] = 0x74; // t
    buf[6] = 0x79; // y
    buf[7] = 0x70; // p
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects BMP", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x42;
    buf[1] = 0x4d;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects TIFF (little-endian)", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x49;
    buf[1] = 0x49;
    buf[2] = 0x2a;
    buf[3] = 0x00;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("detects TIFF (big-endian)", () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x4d;
    buf[1] = 0x4d;
    buf[2] = 0x00;
    buf[3] = 0x2a;
    expect(validateImageMagicBytes(buf)).toBe(true);
  });

  it("rejects invalid magic bytes", () => {
    const buf = Buffer.alloc(12, 0x00);
    expect(validateImageMagicBytes(buf)).toBe(false);
  });

  it("rejects buffer shorter than 12 bytes", () => {
    const buf = Buffer.alloc(8);
    expect(validateImageMagicBytes(buf)).toBe(false);
  });
});

describe("processImageWithFallback", () => {
  it("uses JPEG by default", async () => {
    const inputBuffer = Buffer.from("test-image");
    const jpegBuffer = Buffer.from("jpeg-output");
    mockToBuffer.mockResolvedValue(jpegBuffer);

    const result = await processImageWithFallback(inputBuffer);

    expect(result).toEqual({ buffer: jpegBuffer, format: "jpeg" });
  });

  it("uses WebP when significantly smaller", async () => {
    const inputBuffer = Buffer.alloc(1000, 0x01);
    const webpBuffer = Buffer.alloc(500); // < 80% of input
    mockToBuffer.mockResolvedValue(webpBuffer);

    const result = await processImageWithFallback(inputBuffer, {
      format: "webp",
    });

    expect(result).toEqual({ buffer: webpBuffer, format: "webp" });
  });

  it("falls back to JPEG when WebP is not significantly smaller", async () => {
    const inputBuffer = Buffer.alloc(1000, 0x01);
    const webpBuffer = Buffer.alloc(900); // > 80% of input
    const jpegBuffer = Buffer.from("jpeg-fallback");

    mockToBuffer
      .mockResolvedValueOnce(webpBuffer) // WebP attempt
      .mockResolvedValueOnce(jpegBuffer); // JPEG fallback

    const result = await processImageWithFallback(inputBuffer, {
      format: "webp",
    });

    expect(result).toEqual({ buffer: jpegBuffer, format: "jpeg" });
  });

  it("falls back to JPEG when WebP processing throws", async () => {
    const inputBuffer = Buffer.from("test-image");
    const jpegBuffer = Buffer.from("jpeg-fallback");

    mockToBuffer
      .mockRejectedValueOnce(new Error("WebP failed")) // WebP throws
      .mockResolvedValueOnce(jpegBuffer); // JPEG fallback

    const result = await processImageWithFallback(inputBuffer, {
      format: "webp",
    });

    expect(result).toEqual({ buffer: jpegBuffer, format: "jpeg" });
  });

  it("throws when JPEG processing fails", async () => {
    const inputBuffer = Buffer.from("test-image");
    mockToBuffer.mockRejectedValue(new Error("Processing failed"));

    await expect(processImageWithFallback(inputBuffer)).rejects.toThrow(
      "Processing failed",
    );
  });
});
