"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";

import type {
  CreateListingFormDataClientType,
  ImageFile,
} from "@/features/listings/form-schema/listing.schema";
import { useListingForm } from "@/features/listings/hooks/use-listing-form";
import {
  useCreateListing,
  useUpdateListing,
} from "@/features/listings/hooks/use-listing-mutations";
import { useListingImages } from "@/features/listings/hooks/use-listing-images";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { BasicInformationSection } from "./basic-information-section";
import { PricingSection } from "./pricing-section";
import { PhotosSection } from "./photos-section";
import { PickupDeliverySection } from "./pickup-delivery-section";
import { AdditionalDetailsSection } from "./additional-details-section";
import {
  LegalDocumentAcknowledgments,
  type OwnerPolicyDocuments,
} from "./legal-document-acknowledgments";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface AddListingFormProps {
  categories: Category[];
  initialValues?: Partial<CreateListingFormDataClientType>;
  ownerPolicyDocuments?: OwnerPolicyDocuments;
  onSubmit?: (
    data: Omit<
      CreateListingFormDataClientType,
      "images" | "ownerPoliciesAcknowledged"
    >,
  ) => Promise<void | {
    error?: string;
    details?: unknown;
    listingId?: string;
  }>;
  isEdit?: boolean;
  listingId?: string;
}

export function AddListingForm({
  categories,
  initialValues,
  ownerPolicyDocuments,
  onSubmit,
  isEdit,
  listingId,
}: AddListingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createListingMutation = useCreateListing();
  const updateListingMutation = useUpdateListing();

  // Use listing images hook for editing existing listings
  const {
    images: existingImages,
    loadImages,
    deleteImage,
    isLoading: isLoadingImages,
  } = useListingImages(listingId || "");

  const form = useListingForm(initialValues);
  const {
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
    addImage,
    removeImage,
    addSpecification,
    removeSpecification,
    reset,
  } = form;

  // Debug: Log form values when they change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "images") {
        console.log("Form images changed:", value.images);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Debug: Log when existing images are loaded
  useEffect(() => {
    console.log("Existing images loaded:", existingImages);
  }, [existingImages]);

  // Load existing images when editing
  useEffect(() => {
    if (isEdit && listingId) {
      loadImages();
    }
  }, [isEdit, listingId, loadImages]);

  // Update form images when existing images are loaded
  useEffect(() => {
    if (isEdit && existingImages.length > 0) {
      const imageFiles = existingImages.map((img) => ({
        id: img.id,
        url: img.imageUrl,
        orderIndex: img.orderIndex,
      }));
      setValue("images", imageFiles, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [existingImages, isEdit, setValue]);

  // Upload images to blob storage
  const uploadImages = async (images: ImageFile[], targetListingId: string) => {
    const uploadPromises = images
      .filter((img) => img.file)
      .map(async (image) => {
        if (!image.file) return;

        const uploadFormData = new FormData();
        uploadFormData.append("file", image.file);

        const res = await fetch(`/api/listings/${targetListingId}`, {
          method: "POST",
          body: uploadFormData,
        });

        if (!res.ok) {
          const err = await res.json();
          console.error(`Failed to upload image ${image.file.name}`, err);
          throw new Error(`Failed to upload image: ${image.file.name}`);
        }

        return res.json();
      });

    await Promise.all(uploadPromises);
  };

  // Delete removed existing images
  const deleteRemovedImages = async (currentFormImages: ImageFile[]) => {
    if (!isEdit || !listingId) return;

    // Get IDs of existing images that are still in the form
    const remainingImageIds = new Set(
      currentFormImages
        .filter((img) => img.id) // Only existing images have IDs
        .map((img) => img.id),
    );

    // Find images that were removed (exist in existingImages but not in form)
    const removedImages = existingImages.filter(
      (img) => !remainingImageIds.has(img.id),
    );

    // Delete removed images
    const deletePromises = removedImages.map((img) => deleteImage(img.id));
    await Promise.all(deletePromises);
  };

  const defaultOnSubmit = async (formData: CreateListingFormDataClientType) => {
    setIsSubmitting(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { images, ownerPoliciesAcknowledged, ...listingDataWithoutImages } =
      formData;

    try {
      // Handle edit mode
      if (isEdit && listingId) {
        // For edit mode, check if we have any images (existing or new)
        const hasExistingImages = existingImages.length > 0;
        const hasNewImages = images.some((img: ImageFile) => img.file);

        if (!hasExistingImages && !hasNewImages) {
          toast.error("Please add at least one image.");
          setIsSubmitting(false);
          return;
        }

        // Update listing using React Query mutation
        await updateListingMutation.mutateAsync({
          listingId,
          data: listingDataWithoutImages,
        });

        // Delete removed existing images
        await deleteRemovedImages(images);

        // Upload new images if any
        const newImages = images.filter((img: ImageFile) => img.file);
        if (newImages.length > 0) {
          try {
            await uploadImages(newImages, listingId);
            toast.success("Listing and images updated successfully!");
          } catch (uploadError) {
            console.error("Error uploading images", uploadError);
            toast.error("Error uploading one or more images.");
          }
        }

        router.push("/dashboard/garage");
      } else {
        // Create new listing
        if (!images || images.length === 0) {
          toast.error("Please add at least one image.");
          setIsSubmitting(false);
          return;
        }

        // Create listing without images using React Query mutation
        const result = await createListingMutation.mutateAsync(
          listingDataWithoutImages,
        );

        if (!result?.listingId) {
          toast.error("An unexpected error occurred. Please try again.");
          setIsSubmitting(false);
          return;
        }

        const newListingId = result.listingId;

        // Upload images to blob and save to db
        try {
          await uploadImages(images, newListingId);
          toast.success("Listing and images uploaded successfully!");
          reset();
          router.push("/dashboard/garage");
        } catch (uploadError) {
          console.error("Error uploading images", uploadError);
          toast.error("Error uploading one or more images.");
        }
      }
    } catch (error) {
      // Error is already handled by the mutation hook's onError
      console.error(
        isEdit ? "Error updating listing:" : "Error creating listing:",
        error,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: CreateListingFormDataClientType) => {
    console.log("DATA", data);
    console.log("onSubmit", onSubmit);

    // Check for form validation errors
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the form errors before submitting.");
      return;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        const {
          images,
          ownerPoliciesAcknowledged,
          ...listingDataWithoutImages
        } = data;
        void ownerPoliciesAcknowledged; // Explicitly unused - only needed for validation

        // For edit mode, check if we have any images (existing or new)
        if (isEdit) {
          const hasExistingImages = existingImages.length > 0;
          const hasNewImages = images.some((img: ImageFile) => img.file);

          if (!hasExistingImages && !hasNewImages) {
            toast.error("Please add at least one image.");
            setIsSubmitting(false);
            return;
          }
        } else {
          // For add mode, require at least one image
          if (!images || images.length === 0) {
            toast.error("Please add at least one image.");
            setIsSubmitting(false);
            return;
          }
        }

        // Use React Query mutation for edit mode
        if (isEdit && listingId) {
          try {
            await updateListingMutation.mutateAsync({
              listingId,
              data: listingDataWithoutImages,
            });

            // Delete removed existing images
            await deleteRemovedImages(images);

            // Upload new images if any
            const newImages = images.filter((img: ImageFile) => img.file);
            if (newImages.length > 0) {
              try {
                await uploadImages(newImages, listingId);
                toast.success("Listing and images updated successfully!");
              } catch (uploadError) {
                console.error("Error uploading images", uploadError);
                toast.error("Error uploading one or more images.");
              }
            }
            // Success message is handled by the mutation hook

            router.push("/dashboard/garage");
          } catch (error) {
            // Error is already handled by the mutation hook's onError
            console.error("Error updating listing:", error);
          }
        } else {
          // For new listings, use the onSubmit callback if provided
          const result = await onSubmit(listingDataWithoutImages);

          if (result?.error) {
            toast.error(
              result.error || "Failed to save listing. Please try again.",
            );
            setIsSubmitting(false);
            return;
          }

          // For new listings, upload all images
          try {
            await uploadImages(images, result?.listingId || listingId!);
            toast.success("Listing and images uploaded successfully!");
          } catch (uploadError) {
            console.error("Error uploading images", uploadError);
            toast.error("Error uploading one or more images.");
          }

          router.push("/dashboard/garage");
        }
      } catch (error) {
        setIsSubmitting(false);
        toast.error("An unexpected error occurred. Please try again.");
        console.error("Error saving listing:", error);
      }
    } else {
      await defaultOnSubmit(data);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-8" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <BasicInformationSection control={control} categories={categories} />
          <PricingSection control={control} />
        </div>

        <PhotosSection
          control={control}
          getValues={getValues}
          addImage={addImage}
          removeImage={removeImage}
          isLoadingImages={isLoadingImages}
        />

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <PickupDeliverySection control={control} />
          <AdditionalDetailsSection
            control={control}
            getValues={getValues}
            addSpecification={addSpecification}
            removeSpecification={removeSpecification}
          />
        </div>

        <LegalDocumentAcknowledgments
          control={control}
          ownerPolicyDocuments={ownerPolicyDocuments}
        />

        {/* Review Notice */}
        {!isEdit && (
          <Alert className="bg-primary/10">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-primary">
              Your listing will be reviewed by an admin before being published.
              You&apos;ll receive a notification once it&apos;s approved.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              isLoadingImages ||
              createListingMutation.isPending ||
              updateListingMutation.isPending
            }
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting ||
            createListingMutation.isPending ||
            updateListingMutation.isPending
              ? isEdit
                ? "Saving..."
                : "Adding Listing..."
              : isEdit
                ? "Save Changes"
                : "Add Listing"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
