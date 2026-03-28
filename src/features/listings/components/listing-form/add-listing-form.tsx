"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import type { CreateListingFormClientValues } from "@/features/listings/form-schema/listing.schema";
import { useListingForm } from "@/features/listings/hooks/use-listing-form";
import { useListingImages } from "@/features/listings/hooks/use-listing-images";
import { useListingFormSubmit } from "@/features/listings/hooks/use-listing-form-submit";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { BasicInformationSection } from "./basic-information-section";
import { PricingSection } from "./pricing-section";
import { PhotosSection } from "./photos-section/photos-section";
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
  initialValues?: Partial<CreateListingFormClientValues>;
  ownerPolicyDocuments?: OwnerPolicyDocuments;
  isEdit?: boolean;
  listingId?: string;
}

export function AddListingForm({
  categories,
  initialValues,
  ownerPolicyDocuments,
  isEdit,
  listingId,
}: AddListingFormProps) {
  const {
    images: existingImages,
    loadImages,
    deleteImage,
    reorderImages,
    isLoading: isLoadingImages,
  } = useListingImages(listingId || "");

  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const form = useListingForm(initialValues);
  const {
    handleSubmit,
    control,
    getValues,
    setValue,
    addImage,
    removeImage,
    setImages,
    addSpecification,
    removeSpecification,
    reset,
  } = form;

  const {
    handleSubmit: handleFormSubmit,
    isSubmitting,
    uploadProgress,
  } = useListingFormSubmit({
    isEdit: !!isEdit,
    listingId,
    existingImages,
    deleteImage,
    reorderImages,
    onSuccess: isEdit ? undefined : reset,
  });

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

  return (
    <Form {...form}>
      <form
        className="relative space-y-8"
        onSubmit={handleSubmit(handleFormSubmit)}
      >
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <BasicInformationSection control={control} categories={categories} />
          <PricingSection control={control} />
        </div>

        <PhotosSection
          control={control}
          getValues={getValues}
          addImage={addImage}
          removeImage={removeImage}
          setImages={setImages}
          isLoadingImages={isLoadingImages}
          onProcessingChange={setIsProcessingImages}
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
            disabled={isSubmitting || isLoadingImages || isProcessingImages}
            size="lg"
            className="w-full sm:w-auto"
          >
            {uploadProgress
              ? `Uploading ${uploadProgress.current + 1} of ${uploadProgress.total}...`
              : isProcessingImages
                ? "Processing Photos..."
                : isSubmitting
                  ? isEdit
                    ? "Saving..."
                    : "Adding Listing..."
                  : isEdit
                    ? "Save Changes"
                    : "Add Listing"}
          </Button>
        </div>
        {/* Submit overlay */}
        <AnimatePresence>
          {isSubmitting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-background/80 fixed inset-0 z-50 flex items-end justify-center pb-8 backdrop-blur-sm"
            >
              <div className="bg-background flex w-64 flex-col items-center gap-4 rounded-xl border p-6 shadow-xl">
                {uploadProgress ? (
                  <>
                    <p className="text-sm font-medium">
                      Uploading photo {uploadProgress.current + 1} of{" "}
                      {uploadProgress.total}
                    </p>
                    <Progress
                      value={Math.round(
                        ((uploadProgress.current +
                          uploadProgress.percent / 100) /
                          uploadProgress.total) *
                          100,
                      )}
                      className="w-full"
                    />
                  </>
                ) : (
                  <p className="animate-pulse text-sm font-medium">
                    {isEdit ? "Saving changes..." : "Creating listing..."}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Form>
  );
}
