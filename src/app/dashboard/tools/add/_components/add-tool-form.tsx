"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToolForm } from "@/lib/hooks/use-tool-form";
import { ProgressSteps } from "./progress-steps";
import { BasicInfoStep } from "./basic-info-step";
import { PricingStep } from "./pricing-step";
import { PhotosStep } from "./photos-step";
import { DetailsStep } from "./details-step";
import { FormNavigation } from "./form-navigation";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface AddToolFormProps {
  categories: Category[];
}

const steps = [
  {
    number: 1,
    title: "Basic Info",
    description: "Tool details and category",
  },
  { number: 2, title: "Pricing", description: "Rates and deposit" },
  { number: 3, title: "Photos", description: "Upload tool images" },
  { number: 4, title: "Details", description: "Specifications and delivery" },
];

export function AddToolForm({ categories }: AddToolFormProps) {
  const router = useRouter();

  const {
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
    setNewSpecKey,
    setNewSpecValue,
  } = useToolForm();

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BasicInfoStep
            formData={formData}
            updateFormData={updateFormData}
            categories={categories}
          />
        );
      case 2:
        return (
          <PricingStep formData={formData} updateFormData={updateFormData} />
        );
      case 3:
        return (
          <PhotosStep
            formData={formData}
            addImage={addImage}
            removeImage={removeImage}
          />
        );
      case 4:
        return (
          <DetailsStep
            formData={formData}
            updateFormData={updateFormData}
            newSpecKey={newSpecKey}
            newSpecValue={newSpecValue}
            setNewSpecKey={setNewSpecKey}
            setNewSpecValue={setNewSpecValue}
            addSpecification={addSpecification}
            removeSpecification={removeSpecification}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Add New Tool</h1>
            <p className="text-muted-foreground">
              List your tool to start earning money from your garage
            </p>
          </div>
        </div>
      </div>

      <ProgressSteps steps={steps} currentStep={currentStep} />

      <Card>
        <CardHeader>
          <CardTitle>
            Step {currentStep}: {steps[currentStep - 1].title}
          </CardTitle>
          <CardDescription>
            {steps[currentStep - 1].description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderCurrentStep()}

          <FormNavigation
            currentStep={currentStep}
            isStepValid={isStepValid}
            onPrevious={previousStep}
            onNext={nextStep}
            formData={formData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
