import { useState, useCallback } from "react";
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

        try {
          const formData = new FormData();
          formData.append("file", image.file);

          const res = await fetch(`/api/listings/${listingId}`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            console.error(`Failed to upload image ${image.file.name}`, err);
            failedIndices.push(i);
            continue;
          }

          completed++;
          setUploadProgress({ current: completed, total });
          const json = await res.json();
          uploadedImages.push(json.image);
        } catch (error) {
          console.error(`Failed to upload image ${image.file?.name}`, error);
          failedIndices.push(i);
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
