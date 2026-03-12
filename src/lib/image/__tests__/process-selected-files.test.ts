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

  it("should collect structured validation errors", async () => {
    mockValidateImageFile
      .mockReturnValueOnce(null) // first file valid
      .mockReturnValueOnce("File too large (max 10MB)"); // second invalid

    const files = [
      new File(["a"], "good.jpg", { type: "image/jpeg" }),
      new File(["b"], "huge.jpg", { type: "image/jpeg" }),
    ];

    const result = await processSelectedFiles(files);

    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      fileName: "huge.jpg",
      reason: expect.stringMatching(/too-large|invalid-type/),
      message: expect.any(String),
    });
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
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      fileName: "photo.heic",
      reason: "conversion-failed",
      message:
        "Failed to convert photo.heic. Please try a JPEG or PNG instead.",
    });
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
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fileName).toBe("big.jpg");
    expect(result.heicConversionCount).toBe(1);
  });

  it("should handle empty file list", async () => {
    const result = await processSelectedFiles([]);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.heicConversionCount).toBe(0);
  });

  it("should call onFileProcessing callback for each file", async () => {
    const onFileProcessing = vi.fn();
    const files = [new File(["a"], "photo.jpg", { type: "image/jpeg" })];

    await processSelectedFiles(files, { onFileProcessing });

    expect(onFileProcessing).toHaveBeenCalledWith("photo.jpg", "validating");
    expect(onFileProcessing).toHaveBeenCalledWith("photo.jpg", "done");
  });

  it("should call onFileProcessing with converting stage for HEIC files", async () => {
    const onFileProcessing = vi.fn();
    const heicFile = new File(["heic"], "photo.heic", { type: "image/heic" });
    const convertedFile = new File(["jpeg"], "photo.jpg", {
      type: "image/jpeg",
    });

    mockIsHeicFile.mockReturnValue(true);
    mockConvertHeicToJpeg.mockResolvedValue(convertedFile);

    await processSelectedFiles([heicFile], { onFileProcessing });

    expect(onFileProcessing).toHaveBeenCalledWith("photo.heic", "validating");
    expect(onFileProcessing).toHaveBeenCalledWith("photo.heic", "converting");
    expect(onFileProcessing).toHaveBeenCalledWith("photo.heic", "done");
  });

  it("should call onFileProcessing with error stage on failure", async () => {
    const onFileProcessing = vi.fn();
    mockValidateImageFile.mockReturnValue("File too large");

    const files = [new File(["a"], "big.jpg", { type: "image/jpeg" })];

    await processSelectedFiles(files, { onFileProcessing });

    expect(onFileProcessing).toHaveBeenCalledWith("big.jpg", "validating");
    expect(onFileProcessing).toHaveBeenCalledWith("big.jpg", "error");
  });

  it("should include file size in too-large errors", async () => {
    // Create a file that appears > 10MB by mocking validateImageFile
    const bigContent = new Uint8Array(11 * 1024 * 1024); // 11MB
    const bigFile = new File([bigContent], "huge.jpg", { type: "image/jpeg" });
    mockValidateImageFile.mockReturnValue("File too large (max 10MB)");

    const result = await processSelectedFiles([bigFile]);

    expect(result.errors[0]).toMatchObject({
      fileName: "huge.jpg",
      reason: "too-large",
      fileSize: bigFile.size,
    });
    expect(result.errors[0].message).toContain("huge.jpg");
    expect(result.errors[0].message).toContain("Maximum is 10MB");
  });
});
