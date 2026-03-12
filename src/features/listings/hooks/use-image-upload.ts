import { useState, useCallback } from "react";
import type { ImageFile } from "@/features/listings/form-schema/listing.schema";

export interface UploadResult {
  succeeded: number;
  failed: number;
  total: number;
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
      if (total === 0) return { succeeded: 0, failed: 0, total: 0 };

      setUploadProgress({ current: 0, total });
      let completed = 0;

      const uploadPromises = filesToUpload.map(async (image) => {
        if (!image.file) return;

        const formData = new FormData();
        formData.append("file", image.file);

        const res = await fetch(`/api/listings/${listingId}`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          console.error(`Failed to upload image ${image.file.name}`, err);
          throw new Error(`Failed to upload image: ${image.file.name}`);
        }

        completed++;
        setUploadProgress({ current: completed, total });
        return res.json();
      });

      const results = await Promise.allSettled(uploadPromises);
      setUploadProgress(null);

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return { succeeded, failed, total };
    },
    [],
  );

  return { uploadImages, uploadProgress };
}
