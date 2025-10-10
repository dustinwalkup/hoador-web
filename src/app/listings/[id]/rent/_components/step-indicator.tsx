"use client";

import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BookingStep = "dates" | "delivery" | "payment" | "summary";

interface StepIndicatorProps {
  currentStep: BookingStep;
}

const steps: BookingStep[] = ["dates", "delivery", "payment", "summary"];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 px-4">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
              currentStep === step
                ? "bg-primary text-white"
                : steps.indexOf(currentStep) > index
                  ? "text-primary bg-green-100"
                  : "bg-gray-200 text-gray-500",
            )}
          >
            {steps.indexOf(currentStep) > index ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          {index < steps.length - 1 && (
            <div className="mx-2 h-0.5 w-4 bg-gray-200 md:w-8" />
          )}
        </div>
      ))}
    </div>
  );
}
