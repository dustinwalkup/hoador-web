import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { toast } from "sonner";
import { createTool } from "@/lib/actions/create-tool";
import { type CreateToolFormData } from "@/lib/schemas/tool.schema";

interface FormNavigationProps {
  currentStep: number;
  isStepValid: (step: number) => boolean;
  onPrevious: () => void;
  onNext: () => void;
  formData: CreateToolFormData;
}

export function FormNavigation({
  currentStep,
  isStepValid,
  onPrevious,
  onNext,
  formData,
}: FormNavigationProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createTool(formData);

      if (result?.error) {
        if (result.details) {
          // Handle validation errors
          const fieldErrors = result.details.fieldErrors;
          Object.entries(fieldErrors).forEach(([field, errors]) => {
            if (errors && errors.length > 0) {
              toast.error(`${field}: ${errors[0]}`);
            }
          });
        } else {
          // Handle general errors
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <div className="flex justify-between pt-6">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={currentStep === 1}
      >
        Previous
      </Button>

      <div className="flex gap-2">
        {currentStep < 4 ? (
          <Button onClick={onNext} disabled={!isStepValid(currentStep)}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isStepValid(currentStep)}
          >
            {isPending ? "Adding Tool..." : "Add Tool"}
          </Button>
        )}
      </div>
    </div>
  );
}
