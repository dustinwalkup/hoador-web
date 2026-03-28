import { useState, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";
import type { ImageFile } from "@/features/listings/form-schema/listing.schema";

export interface UploadedImage {
  id: string;
  [key: string]: unknown;
}

export interface UploadResult {
  succeeded: number;
  failed: number;
  total: number;
  failedIndices: number[];
  uploadedImages: UploadedImage[];
}

export function useImageUpload() {
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);

  const uploadImages = useCallback(
    async (images: ImageFile[], listingId: string): Promise<UploadResult> => {
      const filesToUpload = images.filter((img) => img.file);
      const total = filesToUpload.length;
      if (total === 0)
        return {
          succeeded: 0,
          failed: 0,
          total: 0,
          failedIndices: [],
          uploadedImages: [],
        };

      setUploadProgress({ current: 0, total, percent: 0 });
      let completed = 0;
      const uploadedImages: UploadedImage[] = [];
      const failedIndices: number[] = [];

      // Upload a single file via XHR (for byte-level progress) with retry on network errors
      const uploadFileWithXhr = (
        file: File,
        onProgress: (percent: number) => void,
      ): Promise<UploadedImage> => {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("file", file);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            let body: Record<string, unknown> = {};
            try {
              body = JSON.parse(xhr.responseText) as Record<string, unknown>;
            } catch {
              // non-JSON response
            }
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve((body as { image: UploadedImage }).image);
            } else {
              // Server error — non-retryable
              reject(
                Object.assign(
                  new Error(
                    `Image upload failed (HTTP ${xhr.status}): ${JSON.stringify(body)}`,
                  ),
                  { isServerError: true, status: xhr.status, body },
                ),
              );
            }
          };

          xhr.onerror = () =>
            reject(new Error("Network error during image upload"));
          xhr.ontimeout = () => reject(new Error("Image upload timed out"));

          xhr.open("POST", `/api/listings/${listingId}`);
          xhr.send(formData);
        });
      };

      for (let i = 0; i < filesToUpload.length; i++) {
        const image = filesToUpload[i];
        if (!image.file) {
          failedIndices.push(i);
          continue;
        }

        const MAX_RETRIES = 2;
        let lastError: unknown = null;
        let uploaded = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const uploadedImage = await uploadFileWithXhr(
              image.file,
              (percent) => {
                setUploadProgress({ current: completed, total, percent });
              },
            );

            completed++;
            setUploadProgress({ current: completed, total, percent: 100 });
            uploadedImages.push(uploadedImage);
            uploaded = true;
            break;
          } catch (error) {
            lastError = error;
            const isServerError =
              error instanceof Error &&
              "isServerError" in error &&
              error.isServerError;

            if (isServerError) {
              // Non-retryable — log and break immediately
              const e = error as unknown as Error & {
                status: number;
                body: Record<string, unknown>;
              };
              console.error(`Failed to upload image ${image.file.name}`, e);
              Sentry.captureException(e, {
                tags: { error_type: "image_upload_server_error" },
                extra: {
                  fileName: image.file.name,
                  fileSize: image.file.size,
                  fileType: image.file.type,
                  listingId,
                  status: e.status,
                  response: e.body,
                },
              });
              break;
            }

            const isLastAttempt = attempt === MAX_RETRIES;
            if (isLastAttempt) {
              console.error(
                `Failed to upload image ${image.file?.name} after ${MAX_RETRIES + 1} attempts`,
                error,
              );
              Sentry.captureException(error, {
                tags: { error_type: "image_upload_network_error" },
                extra: {
                  fileName: image.file?.name,
                  fileSize: image.file?.size,
                  fileType: image.file?.type,
                  listingId,
                  attempts: attempt + 1,
                },
              });
            } else {
              // Brief delay before retry (500ms, 1000ms)
              await new Promise((resolve) =>
                setTimeout(resolve, 500 * (attempt + 1)),
              );
            }
          }
        }

        if (!uploaded) {
          failedIndices.push(i);
          void lastError;
        }
      }

      setUploadProgress(null);

      return {
        succeeded: completed,
        failed: failedIndices.length,
        total,
        failedIndices,
        uploadedImages,
      };
    },
    [],
  );

  return { uploadImages, uploadProgress };
}
