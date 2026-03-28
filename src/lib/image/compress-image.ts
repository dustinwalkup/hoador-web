const SKIP_BELOW_BYTES = 200 * 1024; // 200 KB — not worth compressing
const LARGE_FILE_BYTES = 15 * 1024 * 1024; // 15 MB — use aggressive downscale

function getAdaptiveQuality(fileSize: number): number {
  if (fileSize > 4 * 1024 * 1024) return 0.7;
  if (fileSize > 2 * 1024 * 1024) return 0.8;
  return 0.85;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Compress an image client-side using the Canvas API.
 *
 * - Resizes to fit within maxWidth × maxHeight (default 1920×1920), never enlarges
 * - Uses adaptive JPEG quality based on original file size (0.70–0.85)
 * - Skips compression for files ≤ 200KB
 * - Uses more aggressive downscaling (1280px) for files > 15MB to avoid Safari memory crash
 * - Releases the canvas pixel buffer immediately after toBlob
 * - Falls back to the original file if anything fails (never throws)
 */
export async function compressImage(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number },
): Promise<File> {
  // Skip tiny files — no benefit
  if (file.size <= SKIP_BELOW_BYTES) return file;

  const maxDim =
    file.size > LARGE_FILE_BYTES
      ? 1280 // aggressive for very large images to avoid Safari crash
      : (options?.maxWidth ?? 1920);
  const maxWidth = maxDim;
  const maxHeight = options?.maxHeight ?? maxDim;
  const quality = getAdaptiveQuality(file.size);

  let objectUrl: string | null = null;
  const canvas = document.createElement("canvas");

  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImageElement(objectUrl);

    let { naturalWidth: w, naturalHeight: h } = img;

    // Only shrink, never enlarge
    if (w > maxWidth || h > maxHeight) {
      const ratio = Math.min(maxWidth / w, maxHeight / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file; // canvas unavailable — return original

    ctx.drawImage(img, 0, 0, w, h);

    const compressed = await new Promise<File | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    });

    // Release canvas pixel buffer immediately
    canvas.width = 0;
    canvas.height = 0;

    if (!compressed) return file;

    // Only use compressed version if it's actually smaller
    return compressed.size < file.size ? compressed : file;
  } catch {
    // Release canvas on error too
    canvas.width = 0;
    canvas.height = 0;
    return file; // fallback to original — never throw
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
