import { validateImageFile, isHeicFile, convertHeicToJpeg } from "./image.utils";

export interface ProcessedFilesOutput {
  files: File[];
  errors: string[];
  heicConversionCount: number;
}

/**
 * Validate and process selected files for upload.
 * Validates each file and converts HEIC/HEIF to JPEG.
 */
export async function processSelectedFiles(
  files: FileList | File[],
): Promise<ProcessedFilesOutput> {
  const result: ProcessedFilesOutput = {
    files: [],
    errors: [],
    heicConversionCount: 0,
  };

  for (const file of Array.from(files)) {
    const error = validateImageFile(file);
    if (error) {
      result.errors.push(error);
      continue;
    }

    if (isHeicFile(file)) {
      try {
        const converted = await convertHeicToJpeg(file);
        result.files.push(converted);
        result.heicConversionCount++;
      } catch {
        result.errors.push(
          `Failed to convert ${file.name}. Please try a JPEG or PNG instead.`,
        );
      }
    } else {
      result.files.push(file);
    }
  }

  return result;
}
