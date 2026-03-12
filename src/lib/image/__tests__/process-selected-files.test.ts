import { describe, it, expect, vi, beforeEach } from "vitest";
import { processSelectedFiles } from "../process-selected-files";

// Mock image.utils
vi.mock("../image.utils", () => ({
  validateImageFile: vi.fn(),
  isHeicFile: vi.fn(),
  convertHeicToJpeg: vi.fn(),
}));

import {
  validateImageFile,
  isHeicFile,
  convertHeicToJpeg,
} from "../image.utils";

const mockValidateImageFile = vi.mocked(validateImageFile);
const mockIsHeicFile = vi.mocked(isHeicFile);
const mockConvertHeicToJpeg = vi.mocked(convertHeicToJpeg);

describe("processSelectedFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateImageFile.mockReturnValue(null); // valid by default
    mockIsHeicFile.mockReturnValue(false);
  });

  it("should process valid image files", async () => {
    const files = [
      new File(["a"], "photo.jpg", { type: "image/jpeg" }),
      new File(["b"], "photo.png", { type: "image/png" }),
    ];

    const result = await processSelectedFiles(files);

    expect(result.files).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.heicConversionCount).toBe(0);
  });

  it("should collect validation errors", async () => {
    mockValidateImageFile
      .mockReturnValueOnce(null) // first file valid
      .mockReturnValueOnce("File too large (max 10MB)"); // second invalid

    const files = [
      new File(["a"], "good.jpg", { type: "image/jpeg" }),
      new File(["b"], "huge.jpg", { type: "image/jpeg" }),
    ];

    const result = await processSelectedFiles(files);

    expect(result.files).toHaveLength(1);
    expect(result.errors).toEqual(["File too large (max 10MB)"]);
  });

  it("should convert HEIC files to JPEG", async () => {
    const heicFile = new File(["heic"], "photo.heic", { type: "image/heic" });
    const convertedFile = new File(["jpeg"], "photo.jpg", {
      type: "image/jpeg",
    });

    mockIsHeicFile.mockReturnValue(true);
    mockConvertHeicToJpeg.mockResolvedValue(convertedFile);

    const result = await processSelectedFiles([heicFile]);

    expect(result.files).toEqual([convertedFile]);
    expect(result.heicConversionCount).toBe(1);
    expect(mockConvertHeicToJpeg).toHaveBeenCalledWith(heicFile);
  });

  it("should handle HEIC conversion failure", async () => {
    const heicFile = new File(["heic"], "photo.heic", { type: "image/heic" });

    mockIsHeicFile.mockReturnValue(true);
    mockConvertHeicToJpeg.mockRejectedValue(new Error("Conversion failed"));

    const result = await processSelectedFiles([heicFile]);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toEqual([
      "Failed to convert photo.heic. Please try a JPEG or PNG instead.",
    ]);
    expect(result.heicConversionCount).toBe(0);
  });

  it("should handle mixed valid, invalid, and HEIC files", async () => {
    const jpegFile = new File(["a"], "valid.jpg", { type: "image/jpeg" });
    const bigFile = new File(["b"], "big.jpg", { type: "image/jpeg" });
    const heicFile = new File(["c"], "photo.heic", { type: "image/heic" });
    const convertedFile = new File(["d"], "photo.jpg", {
      type: "image/jpeg",
    });

    mockValidateImageFile
      .mockReturnValueOnce(null) // jpegFile valid
      .mockReturnValueOnce("File too large (max 10MB)") // bigFile invalid
      .mockReturnValueOnce(null); // heicFile valid

    mockIsHeicFile
      .mockReturnValueOnce(false) // jpegFile
      .mockReturnValueOnce(true); // heicFile

    mockConvertHeicToJpeg.mockResolvedValue(convertedFile);

    const result = await processSelectedFiles([jpegFile, bigFile, heicFile]);

    expect(result.files).toEqual([jpegFile, convertedFile]);
    expect(result.errors).toEqual(["File too large (max 10MB)"]);
    expect(result.heicConversionCount).toBe(1);
  });

  it("should handle empty file list", async () => {
    const result = await processSelectedFiles([]);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.heicConversionCount).toBe(0);
  });
});
