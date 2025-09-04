"use client";

import { Clock } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils/utils";

interface TimeWindow {
  id: string;
  label: string;
  available: boolean;
}

interface TimeWindowStepProps {
  deliveryMethod: "pickup" | "delivery";
  selectedWindow: string;
  setSelectedWindow: (window: string) => void;
  timeWindows: {
    pickup: TimeWindow[];
    delivery: TimeWindow[];
  };
}

export function TimeWindowStep({
  deliveryMethod,
  selectedWindow,
  setSelectedWindow,
  timeWindows,
}: TimeWindowStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-4 block text-base font-medium">
          Select {deliveryMethod === "pickup" ? "pickup" : "delivery"} window
        </Label>
        <RadioGroup value={selectedWindow} onValueChange={setSelectedWindow}>
          <div className="space-y-3">
            {timeWindows[deliveryMethod].map((window) => (
              <div
                key={window.id}
                className={cn(
                  "flex items-center space-x-3 rounded-lg border p-4",
                  window.available
                    ? "hover:bg-gray-50"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                <RadioGroupItem
                  value={window.id}
                  id={window.id}
                  disabled={!window.available}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={window.id}
                    className={cn(
                      "flex items-center gap-2 font-medium",
                      window.available
                        ? "cursor-pointer"
                        : "cursor-not-allowed",
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    {window.label}
                  </Label>
                  {!window.available && (
                    <p className="mt-1 text-sm text-red-600">Not available</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
