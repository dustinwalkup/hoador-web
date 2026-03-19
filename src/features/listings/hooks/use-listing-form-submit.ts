import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
  CreateListingFormDataClientType,
  ImageFile,
} from "@/features/listings/form-schema/listing.schema";
import type { ListingImage } from "./use-listing-images";
import { useCreateListing, useUpdateListing } from "./use-listing-mutations";
import { useImageUpload } from "./use-image-upload";

interface UseListingFormSubmitOptions {
  isEdit: boolean;
  listingId?: string;
  existingImages: ListingImage[];
  deleteImage: (
    imageId: string,
    options?: { silent?: boolean },
  ) => Promise<void>;
  reorderImages: (
    imageIds: string[],
    options?: { silent?: boolean },
  ) => Promise<void>;
  onSuccess?: () => void;
}

export function useListingFormSubmit({
  isEdit,
  listingId,
  existingImages,
  deleteImage,
  reorderImages,
  onSuccess,
}: UseListingFormSubmitOptions) {
  const router = useRouter();
  const createMutation = useCreateListing();
  const updateMutation = useUpdateListing();
  const { uploadImages, uploadProgress } = useImageUpload();

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadProgress !== null;

  const deleteRemovedImages = useCallback(
    async (currentFormImages: ImageFile[]) => {
      if (!isEdit || !listingId) return;

      const remainingImageIds = new Set(
        currentFormImages.filter((img) => img.id).map((img) => img.id),
      );

      const removedImages = existingImages.filter(
        (img) => !remainingImageIds.has(img.id),
      );

      await Promise.all(
        removedImages.map((img) => deleteImage(img.id, { silent: true })),
      );
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
          let uploadResult = null;
          if (newImages.length > 0) {
            uploadResult = await uploadImages(newImages, listingId);
          }

          // Persist the user's image order (including main photo selection)
          let uploadIdx = 0;
          const finalImageIds: string[] = [];
          for (const img of images) {
            if (img.id && !img.file) {
              // Existing image retained by user
              finalImageIds.push(img.id);
            } else if (img.file && uploadResult) {
              // Newly uploaded image — match by sequential index
              const uploaded = uploadResult.uploadedImages[uploadIdx];
              if (uploaded) {
                finalImageIds.push(uploaded.id);
                uploadIdx++;
              }
            }
          }

          if (finalImageIds.length > 0) {
            await reorderImages(finalImageIds, { silent: true });
          }

          // Single consolidated toast
          if (uploadResult && uploadResult.failed > 0) {
            toast.error(
              `${uploadResult.succeeded} of ${uploadResult.total} images uploaded. Failed images can be re-uploaded from the edit page.`,
            );
          } else {
            toast.success("Listing updated successfully!");
          }

          router.push("/dashboard/listings/rentals");
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
            router.push(`/dashboard/listings/${newListingId}/edit`);
          } else if (uploadResult.failed > 0) {
            toast.warning(
              `${uploadResult.succeeded} of ${uploadResult.total} images uploaded. You can add more from the edit page.`,
            );
            onSuccess?.();
            router.push("/dashboard/listings/rentals");
          } else {
            toast.success("Listing and images uploaded successfully!");
            onSuccess?.();
            router.push("/dashboard/listings/rentals");
          }
        }
      } catch (error) {
        console.error(
          isEdit ? "Error updating listing:" : "Error creating listing:",
          error,
        );
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        toast.error(
          isEdit
            ? `Failed to update listing: ${message}`
            : `Failed to create listing: ${message}`,
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
      reorderImages,
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
