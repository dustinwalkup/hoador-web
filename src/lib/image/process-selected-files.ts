import {
  validateImageFile,
  isHeicFile,
  convertHeicToJpeg,
} from "./image.utils";

export interface FileError {
  fileName: string;
  reason: "too-large" | "invalid-type" | "conversion-failed";
  message: string;
  fileSize?: number;
}

export interface ProcessSelectedFilesOptions {
  onFileProcessing?: (
    fileName: string,
    stage: "validating" | "converting" | "done" | "error",
  ) => void;
}

export interface ProcessedFilesOutput {
  files: File[];
  errors: FileError[];
  heicConversionCount: number;
}

/**
 * Validate and process selected files for upload.
 * Validates each file and converts HEIC/HEIF to JPEG.
 */
export async function processSelectedFiles(
  files: FileList | File[],
  options?: ProcessSelectedFilesOptions,
): Promise<ProcessedFilesOutput> {
  const result: ProcessedFilesOutput = {
    files: [],
    errors: [],
    heicConversionCount: 0,
  };

  for (const file of Array.from(files)) {
    options?.onFileProcessing?.(file.name, "validating");

    const error = validateImageFile(file);
    if (error) {
      const isTooLarge = file.size > 10 * 1024 * 1024;
      result.errors.push({
        fileName: file.name,
        reason: isTooLarge ? "too-large" : "invalid-type",
        message: isTooLarge
          ? `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`
          : `${file.name}: ${error}`,
        fileSize: file.size,
      });
      options?.onFileProcessing?.(file.name, "error");
      continue;
    }

    if (isHeicFile(file)) {
      try {
        options?.onFileProcessing?.(file.name, "converting");
        const converted = await convertHeicToJpeg(file);
        result.files.push(converted);
        result.heicConversionCount++;
        options?.onFileProcessing?.(file.name, "done");
      } catch {
        result.errors.push({
          fileName: file.name,
          reason: "conversion-failed",
          message: `Failed to convert ${file.name}. Please try a JPEG or PNG instead.`,
        });
        options?.onFileProcessing?.(file.name, "error");
      }
    } else {
      result.files.push(file);
      options?.onFileProcessing?.(file.name, "done");
    }
  }

  return result;
}
