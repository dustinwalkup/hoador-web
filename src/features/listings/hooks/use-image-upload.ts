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

      setUploadProgress({ current: 0, total });
      let completed = 0;
      const uploadedImages: UploadedImage[] = [];
      const failedIndices: number[] = [];

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
            const formData = new FormData();
            formData.append("file", image.file);

            const res = await fetch(`/api/listings/${listingId}`, {
              method: "POST",
              body: formData,
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              const serverError = new Error(
                `Image upload failed (HTTP ${res.status}): ${JSON.stringify(err)}`,
              );
              console.error(`Failed to upload image ${image.file.name}`, err);
              Sentry.captureException(serverError, {
                tags: { error_type: "image_upload_server_error" },
                extra: {
                  fileName: image.file.name,
                  fileSize: image.file.size,
                  fileType: image.file.type,
                  listingId,
                  status: res.status,
                  response: err,
                },
              });
              // Server errors are non-retryable
              lastError = serverError;
              break;
            }

            completed++;
            setUploadProgress({ current: completed, total });
            const json = await res.json();
            uploadedImages.push(json.image);
            uploaded = true;
            break;
          } catch (error) {
            lastError = error;
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
          void lastError; // already logged above
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
