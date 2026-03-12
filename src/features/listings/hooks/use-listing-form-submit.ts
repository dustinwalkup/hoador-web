import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
  CreateListingFormDataClientType,
  ImageFile,
} from "@/features/listings/form-schema/listing.schema";
import type { ListingImage } from "./use-listing-images";
import {
  useCreateListing,
  useUpdateListing,
} from "./use-listing-mutations";
import { useImageUpload } from "./use-image-upload";

interface UseListingFormSubmitOptions {
  isEdit: boolean;
  listingId?: string;
  existingImages: ListingImage[];
  deleteImage: (imageId: string) => Promise<void>;
  onSuccess?: () => void;
}

export function useListingFormSubmit({
  isEdit,
  listingId,
  existingImages,
  deleteImage,
  onSuccess,
}: UseListingFormSubmitOptions) {
  const router = useRouter();
  const createMutation = useCreateListing();
  const updateMutation = useUpdateListing();
  const { uploadImages, uploadProgress } = useImageUpload();

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || uploadProgress !== null;

  const deleteRemovedImages = useCallback(
    async (currentFormImages: ImageFile[]) => {
      if (!isEdit || !listingId) return;

      const remainingImageIds = new Set(
        currentFormImages
          .filter((img) => img.id)
          .map((img) => img.id),
      );

      const removedImages = existingImages.filter(
        (img) => !remainingImageIds.has(img.id),
      );

      await Promise.all(removedImages.map((img) => deleteImage(img.id)));
    },
    [isEdit, listingId, existingImages, deleteImage],
  );

  const handleSubmit = useCallback(
    async (formData: CreateListingFormDataClientType) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { images, ownerPoliciesAcknowledged, ...listingData } = formData;

      // Validate images
      if (isEdit) {
        const hasExistingImages = existingImages.length > 0;
        const hasNewImages = images.some((img: ImageFile) => img.file);
        if (!hasExistingImages && !hasNewImages) {
          toast.error("Please add at least one image.");
          return;
        }
      } else {
        if (!images || images.length === 0) {
          toast.error("Please add at least one image.");
          return;
        }
      }

      try {
        if (isEdit && listingId) {
          // Update existing listing
          await updateMutation.mutateAsync({ listingId, data: listingData });
          await deleteRemovedImages(images);

          const newImages = images.filter((img: ImageFile) => img.file);
          if (newImages.length > 0) {
            const uploadResult = await uploadImages(newImages, listingId);
            if (uploadResult.failed > 0) {
              toast.error(
                `${uploadResult.succeeded} of ${uploadResult.total} images uploaded. Failed images can be re-uploaded from the edit page.`,
              );
            } else {
              toast.success("Listing and images updated successfully!");
            }
          }

          router.push("/dashboard/garage");
        } else {
          // Create new listing
          const result = await createMutation.mutateAsync(listingData);

          if (!result?.listingId) {
            toast.error("An unexpected error occurred. Please try again.");
            return;
          }

          const newListingId = result.listingId;
          const uploadResult = await uploadImages(images, newListingId);

          if (uploadResult.failed === uploadResult.total) {
            toast.error(
              "Images failed to upload. Redirecting to edit your listing...",
            );
            router.push(`/dashboard/garage/edit/${newListingId}`);
          } else if (uploadResult.failed > 0) {
            toast.warning(
              `${uploadResult.succeeded} of ${uploadResult.total} images uploaded. You can add more from the edit page.`,
            );
            onSuccess?.();
            router.push("/dashboard/garage");
          } else {
            toast.success("Listing and images uploaded successfully!");
            onSuccess?.();
            router.push("/dashboard/garage");
          }
        }
      } catch (error) {
        console.error(
          isEdit ? "Error updating listing:" : "Error creating listing:",
          error,
        );
      }
    },
    [
      isEdit,
      listingId,
      existingImages,
      createMutation,
      updateMutation,
      uploadImages,
      deleteRemovedImages,
      onSuccess,
      router,
    ],
  );

  return {
    handleSubmit,
    isSubmitting,
    uploadProgress,
    isCreatePending: createMutation.isPending,
    isUpdatePending: updateMutation.isPending,
  };
}
