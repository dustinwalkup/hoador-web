import { useState } from "react";
import { type CreateToolFormData } from "../schemas/tool.schema";
import { getMockToolImage } from "../constants/garage";

const initialFormData: CreateToolFormData = {
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  model: "",
  condition: "good",
  dailyRate: 0,
  weeklyRate: undefined,
  monthlyRate: undefined,
  securityDeposit: 0,
  images: [],
  specifications: {},
  instructions: "",
  safetyNotes: "",
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  requiresPickup: true,
  deliveryAvailable: false,
  deliveryFee: 0,
  deliveryRadius: 0,
};

export function useToolForm() {
  const [formData, setFormData] = useState<CreateToolFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  const updateFormData = (field: keyof CreateToolFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addSpecification = () => {
    if (newSpecKey && newSpecValue) {
      setFormData((prev) => ({
        ...prev,
        specifications: { ...prev.specifications, [newSpecKey]: newSpecValue },
      }));
      setNewSpecKey("");
      setNewSpecValue("");
    }
  };

  const removeSpecification = (key: string) => {
    setFormData((prev) => {
      const newSpecs = { ...prev.specifications };
      delete newSpecs[key];
      return { ...prev, specifications: newSpecs };
    });
  };

  const addImage = () => {
    // Mock image upload - in real app, this would handle file upload
    const mockImageUrl = getMockToolImage();
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, mockImageUrl],
    }));
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return Boolean(
          formData.name && formData.description && formData.categoryId,
        );
      case 2:
        return Boolean(formData.condition && formData.dailyRate > 0);
      case 3:
        return formData.images.length > 0;
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < 4 && isStepValid(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentStep(1);
    setNewSpecKey("");
    setNewSpecValue("");
  };

  return {
    formData,
    currentStep,
    newSpecKey,
    newSpecValue,
    updateFormData,
    addSpecification,
    removeSpecification,
    addImage,
    removeImage,
    isStepValid,
    nextStep,
    previousStep,
    resetForm,
    setNewSpecKey,
    setNewSpecValue,
  };
}
