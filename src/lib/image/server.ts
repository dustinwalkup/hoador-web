import sharp from "sharp";

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "jpeg" | "webp";
}

/**
 * Process image for upload with consistent settings
 * Based on Airbnb's approach: JPEG format, 85% quality, max 2048px
 */
export async function processImageForUpload(
  buffer: Buffer,
  options: ImageProcessingOptions = {},
): Promise<Buffer> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 85,
    format = "jpeg",
  } = options;

  let sharpInstance = sharp(buffer).rotate().resize(maxWidth, maxHeight, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (format === "jpeg") {
    sharpInstance = sharpInstance.jpeg({
      quality,
      progressive: true,
      mozjpeg: true, // Better compression
    });
  } else if (format === "webp") {
    sharpInstance = sharpInstance.webp({
      quality,
      effort: 6, // Higher compression effort
    });
  }

  return await sharpInstance.toBuffer();
}

/**
 * Get image metadata for validation
 */
export async function getImageMetadata(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
    hasAlpha: metadata.hasAlpha,
  };
}

/**
 * Validate image before processing
 */
export function validateImageForProcessing(
  file: File,
  maxSizeMB: number = 10,
): string | null {
  // Check file type (also accept HEIC/HEIF which may have empty MIME on some platforms)
  const isHeic =
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");
  if (!file.type.startsWith("image/") && !isHeic) {
    return "File must be an image";
  }

  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `File too large (max ${maxSizeMB}MB)`;
  }

  return null;
}

/**
 * Validate image content by checking magic bytes (file signature).
 * Returns true if the buffer matches a known image format.
 * This prevents accepting non-image files with spoofed MIME types.
 */
export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return true;

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return true;

  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
    return true;

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return true;

  // HEIC/HEIF: ftyp box — bytes 4-7 are "ftyp"
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  )
    return true;

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true;

  // TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
  if (
    (buffer[0] === 0x49 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x2a &&
      buffer[3] === 0x00) ||
    (buffer[0] === 0x4d &&
      buffer[1] === 0x4d &&
      buffer[2] === 0x00 &&
      buffer[3] === 0x2a)
  )
    return true;

  return false;
}

/**
 * Process image with fallback to JPEG if WebP fails
 */
export async function processImageWithFallback(
  buffer: Buffer,
  options: ImageProcessingOptions = {},
): Promise<{ buffer: Buffer; format: string }> {
  const { format = "jpeg", ...otherOptions } = options;

  try {
    if (format === "webp") {
      // Try WebP first
      const webpBuffer = await processImageForUpload(buffer, {
        ...otherOptions,
        format: "webp",
      });

      // If WebP is significantly smaller, use it
      if (webpBuffer.length < buffer.length * 0.8) {
        return { buffer: webpBuffer, format: "webp" };
      }
    }

    // Fallback to JPEG
    const jpegBuffer = await processImageForUpload(buffer, {
      ...otherOptions,
      format: "jpeg",
    });
    return { buffer: jpegBuffer, format: "jpeg" };
  } catch (error) {
    // If WebP fails, fallback to JPEG
    if (format === "webp") {
      console.warn("WebP processing failed, falling back to JPEG:", error);
      const jpegBuffer = await processImageForUpload(buffer, {
        ...otherOptions,
        format: "jpeg",
      });
      return { buffer: jpegBuffer, format: "jpeg" };
    }
    throw error;
  }
}
