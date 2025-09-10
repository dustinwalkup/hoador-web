"use client";

import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BookingStep = "dates" | "delivery" | "windows" | "payment" | "summary";

interface StepIndicatorProps {
  currentStep: BookingStep;
}

const steps: BookingStep[] = [
  "dates",
  "delivery",
  "windows",
  "payment",
  "summary",
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
              currentStep === step
                ? "bg-green-600 text-white"
                : steps.indexOf(currentStep) > index
                  ? "bg-green-100 text-green-600"
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
            <div className="mx-2 h-0.5 w-8 bg-gray-200" />
          )}
        </div>
      ))}
    </div>
  );
}
