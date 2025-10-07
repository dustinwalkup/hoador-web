"use client";

import type { DateRange } from "react-day-picker";

import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { AlertCircle, CheckCircle } from "lucide-react";
import { formatDate, differenceInDays } from "@/lib/utils/date.utils";

interface DateSelectionStepProps {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  minimumRentalPeriod: number;
  maximumRentalPeriod: number;
  days: number;
}

export function DateSelectionStep({
  dateRange,
  setDateRange,
  minimumRentalPeriod,
  maximumRentalPeriod,
  days,
}: DateSelectionStepProps) {
  // Validation logic
  const getValidationStatus = () => {
    if (!dateRange?.from || !dateRange?.to) {
      return { isValid: false, message: null };
    }

    const selectedDays = differenceInDays(dateRange.to, dateRange.from) + 1;

    if (selectedDays < minimumRentalPeriod) {
      return {
        isValid: false,
        message: `Minimum rental period is ${minimumRentalPeriod} day${minimumRentalPeriod !== 1 ? "s" : ""}. Please select a longer period.`,
      };
    }

    if (selectedDays > maximumRentalPeriod) {
      return {
        isValid: false,
        message: `Maximum rental period is ${maximumRentalPeriod} days. Please select a shorter period.`,
      };
    }

    return { isValid: true, message: null };
  };

  const validation = getValidationStatus();

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium">
          Select your rental period
        </Label>
        <p className="mb-4 text-sm text-gray-600">
          Minimum: {minimumRentalPeriod} day(s) • Maximum: {maximumRentalPeriod}{" "}
          days
        </p>
        <div className="flex justify-center">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            disabled={(date) => {
              // Disable past dates
              if (date < new Date()) return true;

              // If we have a start date selected, validate the range
              if (dateRange?.from) {
                const daysFromStart =
                  differenceInDays(date, dateRange.from) + 1;
                // Disable if it would exceed maximum rental period
                if (daysFromStart > maximumRentalPeriod) return true;
              }

              return false;
            }}
            numberOfMonths={2}
            className="w-full rounded-md border"
          />
        </div>

        {/* Date selection feedback */}
        {dateRange?.from && dateRange?.to && (
          <div className="mt-4 space-y-3">
            <div
              className={`rounded-lg p-4 ${
                validation.isValid
                  ? "border border-green-200 bg-green-50"
                  : "border border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start gap-2">
                {validation.isValid ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      validation.isValid ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    <strong>Selected:</strong>{" "}
                    {formatDate(dateRange.from, "PPP")} to{" "}
                    {formatDate(dateRange.to, "PPP")} ({days} day
                    {days !== 1 ? "s" : ""})
                  </p>
                  {validation.message && (
                    <p className="mt-1 text-sm text-red-700">
                      {validation.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
