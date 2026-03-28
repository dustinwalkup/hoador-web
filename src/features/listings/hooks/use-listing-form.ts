import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getMockToolImage } from "../../../constants/garage";
import {
  createListingSchemaClient,
  type CreateListingFormClientValues,
  type CreateListingFormDataClientType,
  type ImageFile,
} from "../form-schema/listing.schema";

export function useListingForm(
  initialValues?: Partial<CreateListingFormClientValues>,
) {
  const defaultValues = {
    name: "",
    description: "",
    categoryId: "",
    brand: undefined,
    model: undefined,
    condition: "good",
    dailyRate: 0,
    weeklyRate: undefined,
    monthlyRate: undefined,
    securityDeposit: 0,
    images: [] as ImageFile[],
    specifications: {},
    instructions: undefined,
    safetyNotes: undefined,
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only",
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
    ownerPoliciesAcknowledged: false,
    ...initialValues,
  } as CreateListingFormClientValues;

  const form = useForm<
    CreateListingFormClientValues,
    unknown,
    CreateListingFormDataClientType
  >({
    resolver: zodResolver(createListingSchemaClient),
    defaultValues,
    mode: "onTouched",
  });

  // Helpers for dynamic fields
  const addImage = (file?: File) => {
    const images = form.getValues("images");
    const newImage: ImageFile = file
      ? { file, orderIndex: images.length, id: crypto.randomUUID() }
      : {
          url: getMockToolImage(),
          orderIndex: images.length,
          id: crypto.randomUUID(),
        };

    form.setValue("images", [...images, newImage], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const setImages = (images: ImageFile[]) => {
    form.setValue("images", images, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const removeImage = (index: number) => {
    const images = form.getValues("images");
    form.setValue(
      "images",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      images.filter((_: any, i: number) => i !== index),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const updateImageOrder = (fromIndex: number, toIndex: number) => {
    const images = form.getValues("images");
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);

    // Update orderIndex for all images
    const updatedImages = newImages.map((image, index) => ({
      ...image,
      orderIndex: index,
    }));

    form.setValue("images", updatedImages, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // For specifications
  const addSpecification = (
    key: string,
    value: string | number | boolean | string[],
  ) => {
    if (!key || value === undefined || value === null) return;
    const specs = form.getValues("specifications") || {};
    form.setValue(
      "specifications",
      { ...specs, [key]: value },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const removeSpecification = (key: string) => {
    const specs = { ...form.getValues("specifications") };
    delete specs[key];
    form.setValue("specifications", specs, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // Custom handler for deliveryMode change
  const handleDeliveryModeChange = (
    mode: "pickup_only" | "delivery_only" | "both_available",
  ) => {
    form.setValue("deliveryMode", mode, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (mode !== "pickup_only") {
      // Optionally set defaults for dependent fields if not already set
      if (!form.getValues("deliveryFee")) {
        form.setValue("deliveryFee", 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (!form.getValues("deliveryRadius")) {
        form.setValue("deliveryRadius", 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  };

  return {
    ...form,
    addImage,
    removeImage,
    setImages,
    updateImageOrder,
    addSpecification,
    removeSpecification,
    handleDeliveryModeChange,
  };
}
