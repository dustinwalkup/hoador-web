"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { tryCatch } from "@walkup/walkup-utils";

import type {
  CreateToolFormDataClientType,
  ImageFile,
} from "@/lib/form-schemas/tool.schema";
import { useToolForm } from "@/lib/hooks/use-tool-form";
import { createTool } from "@/lib/actions/create-tool";
import { useToolImages } from "@/hooks/use-tool-images";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

import { BasicInformationSection } from "./basic-information-section";
import { PricingSection } from "./pricing-section";
import { PhotosSection } from "./photos-section";
import { PickupDeliverySection } from "./pickup-delivery-section";
import { AdditionalDetailsSection } from "./additional-details-section";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface AddToolFormProps {
  categories: Category[];
  initialValues?: Partial<CreateToolFormDataClientType>;
  onSubmit?: (
    data: Omit<CreateToolFormDataClientType, "images">,
  ) => Promise<void | { error?: string; details?: unknown; toolId?: string }>;
  isEdit?: boolean;
  toolId?: string;
}

export function AddToolForm({
  categories,
  initialValues,
  onSubmit,
  isEdit,
  toolId,
}: AddToolFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use tool images hook for editing existing tools
  const {
    images: existingImages,
    loadImages,
    deleteImage,
    isLoading: isLoadingImages,
  } = useToolImages(toolId || "");

  const form = useToolForm(initialValues);
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
    handleDeliveryAvailableChange,
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
    if (isEdit && toolId) {
      loadImages();
    }
  }, [isEdit, toolId, loadImages]);

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
  const uploadImages = async (images: ImageFile[], targetToolId: string) => {
    const uploadPromises = images
      .filter((img) => img.file)
      .map(async (image) => {
        if (!image.file) return;

        const uploadFormData = new FormData();
        uploadFormData.append("file", image.file);

        const res = await fetch(`/api/tools/${targetToolId}`, {
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
    if (!isEdit || !toolId) return;

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

  const defaultOnSubmit = async (formData: CreateToolFormDataClientType) => {
    setIsSubmitting(true);

    const { images, ...toolDataWithoutImages } = formData;

    if (!images || images.length === 0) {
      toast.error("Please add at least one image.");
      setIsSubmitting(false);
      return;
    }

    // Create tool without images
    const { data, error } = await tryCatch(createTool(toolDataWithoutImages));

    if (error || !data?.toolId) {
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const newToolId = data.toolId;

    // Upload images to blob and save to db
    try {
      await uploadImages(images, newToolId);
      toast.success("Tool and images uploaded successfully!");
      reset();
      router.push("/dashboard/garage");
    } catch (uploadError) {
      console.error("Error uploading images", uploadError);
      toast.error("Error uploading one or more images.");
    }
    setIsSubmitting(false);
  };

  const handleFormSubmit = async (data: CreateToolFormDataClientType) => {
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
        const { images, ...toolDataWithoutImages } = data;

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

        const result = await onSubmit(toolDataWithoutImages);

        if (result?.error) {
          toast.error(result.error || "Failed to save tool. Please try again.");
          setIsSubmitting(false);
          return;
        }

        // Handle image operations for edit mode
        if (isEdit && toolId) {
          // Delete removed existing images
          await deleteRemovedImages(images);

          // Upload new images if any
          const newImages = images.filter((img: ImageFile) => img.file);
          if (newImages.length > 0) {
            try {
              await uploadImages(newImages, toolId);
              toast.success("Tool and images updated successfully!");
            } catch (uploadError) {
              console.error("Error uploading images", uploadError);
              toast.error("Error uploading one or more images.");
            }
          } else {
            toast.success("Tool updated successfully!");
          }
        } else {
          // For new tools, upload all images
          try {
            await uploadImages(images, result?.toolId || toolId!);
            toast.success("Tool and images uploaded successfully!");
          } catch (uploadError) {
            console.error("Error uploading images", uploadError);
            toast.error("Error uploading one or more images.");
          }
        }

        router.push("/dashboard/garage");
      } catch (error) {
        setIsSubmitting(false);
        toast.error("An unexpected error occurred. Please try again.");
        console.error("Error saving tool:", error);
      }
    } else {
      await defaultOnSubmit(data);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-8" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PickupDeliverySection
            control={control}
            getValues={getValues}
            handleDeliveryAvailableChange={handleDeliveryAvailableChange}
          />
          <AdditionalDetailsSection
            control={control}
            getValues={getValues}
            addSpecification={addSpecification}
            removeSpecification={removeSpecification}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingImages}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting
              ? isEdit
                ? "Saving..."
                : "Adding Tool..."
              : isEdit
                ? "Save Changes"
                : "Add Tool"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
