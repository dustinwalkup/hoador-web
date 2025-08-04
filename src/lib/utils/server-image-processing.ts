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

  let sharpInstance = sharp(buffer).resize(maxWidth, maxHeight, {
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
  // Check file type
  if (!file.type.startsWith("image/")) {
    return "File must be an image";
  }

  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `File too large (max ${maxSizeMB}MB)`;
  }

  return null;
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
