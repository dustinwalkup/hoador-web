import type { ImageFile } from "@/features/tools/form-schema/tool.schema";
import type { ToolImage } from "@/features/tools/hooks/use-tool-images";

/**
 * Convert ToolImage objects to ImageFile objects for form usage
 */
export function toolImagesToImageFiles(toolImages: ToolImage[]): ImageFile[] {
  return toolImages.map((img) => ({
    id: img.id,
    url: img.imageUrl,
    orderIndex: img.orderIndex,
  }));
}

/**
 * Convert ImageFile objects to URLs for backward compatibility
 */
export function imageFilesToUrls(imageFiles: ImageFile[]): string[] {
  return imageFiles.map((img) => img.url).filter((url): url is string => !!url);
}

/**
 * Create ImageFile objects from File objects
 */
export function filesToImageFiles(files: File[]): ImageFile[] {
  return files.map((file, index) => ({
    file,
    orderIndex: index,
  }));
}

/**
 * Validate if a file is a valid image
 */
export function validateImageFile(file: File): string | null {
  // Check file type
  if (!file.type.startsWith("image/")) {
    return "File must be an image";
  }

  // Check file size (10MB limit - server will handle compression)
  if (file.size > 10 * 1024 * 1024) {
    return "File too large (max 10MB)";
  }

  // Warn about very large files that might be slow to upload
  if (file.size > 8 * 1024 * 1024) {
    return "File is very large. Upload may take longer, but the image will be automatically optimized.";
  }

  return null;
}
