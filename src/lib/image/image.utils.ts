import type { ImageFile } from "@/features/listings/form-schema/listing.schema";
import type { ListingImage } from "@/features/listings/hooks/use-listing-images";

/**
 * Convert listingImage objects to ImageFile objects for form usage
 */
export function listingImagesToImageFiles(
  listingImages: ListingImage[],
): ImageFile[] {
  return listingImages.map((img) => ({
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
 * Check if a file is HEIC/HEIF format (common on iPhones).
 * Checks both MIME type and file extension since MIME detection is unreliable for HEIC.
 */
export function isHeicFile(file: File): boolean {
  const heicTypes = ["image/heic", "image/heif"];
  if (heicTypes.includes(file.type.toLowerCase())) return true;
  const ext = file.name.toLowerCase().split(".").pop();
  return ext === "heic" || ext === "heif";
}

/**
 * Convert a HEIC/HEIF file to JPEG for browser compatibility.
 * Uses dynamic import to keep heic2any out of the main bundle.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const blob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name
    .replace(/\.heic$/i, ".jpg")
    .replace(/\.heif$/i, ".jpg");
  return new File([resultBlob], newName, { type: "image/jpeg" });
}

/**
 * Validate if a file is a valid image
 */
export function validateImageFile(file: File): string | null {
  // Check file type (also accept HEIC/HEIF which may have empty MIME on some platforms)
  if (!file.type.startsWith("image/") && !isHeicFile(file)) {
    return "File must be an image";
  }

  // Check file size (10MB limit - server will handle compression)
  if (file.size > 10 * 1024 * 1024) {
    return "File too large (max 10MB)";
  }

  return null;
}
