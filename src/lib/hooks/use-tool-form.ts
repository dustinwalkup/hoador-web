import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getMockToolImage } from "../constants/garage";
import {
  createToolSchema,
  type CreateToolFormData,
} from "../schemas/tool.schema";

export function useToolForm(initialValues?: Partial<CreateToolFormData>) {
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
    images: [],
    specifications: {},
    instructions: undefined,
    safetyNotes: undefined,
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    requiresPickup: true,
    deliveryAvailable: false,
    deliveryFee: 0,
    deliveryRadius: 0,
    ...initialValues,
  } as unknown as CreateToolFormData;

  const form = useForm<CreateToolFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createToolSchema) as any,
    defaultValues,
    mode: "onTouched",
  });

  // Helpers for dynamic fields
  const addImage = () => {
    const images = form.getValues("images");
    const newImage = getMockToolImage();
    console.log("newImage", newImage);
    form.setValue("images", [...images, newImage], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const removeImage = (index: number) => {
    const images = form.getValues("images");
    form.setValue(
      "images",
      images.filter((_, i) => i !== index),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  // For specifications
  const addSpecification = (key: string, value: string) => {
    if (!key || !value) return;
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

  // Custom handler for deliveryAvailable toggle
  const handleDeliveryAvailableChange = (checked: boolean) => {
    form.setValue("deliveryAvailable", checked, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (checked) {
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
    addSpecification,
    removeSpecification,
    handleDeliveryAvailableChange,
  };
}
