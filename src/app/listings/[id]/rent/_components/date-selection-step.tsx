"use client";

import type { DateRange } from "react-day-picker";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { formatDate, differenceInDays } from "@/lib/utils/date.utils";
import { type RentalFormData } from "@/features/rentals/lib/rental-form.schema";
import { validateDateRange } from "@/features/rentals/lib/rental-form.schema";

interface DateSelectionStepProps {
  minimumRentalPeriod: number;
  maximumRentalPeriod: number;
  days: number;
  bookedDates: Array<{ startDate: Date; endDate: Date; reason?: string }>;
}

export function DateSelectionStep({
  minimumRentalPeriod,
  maximumRentalPeriod,
  days,
  bookedDates,
}: DateSelectionStepProps) {
  const form = useFormContext<RentalFormData>();
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  // Convert to DateRange format for Calendar component
  const dateRange: DateRange | undefined =
    startDate && endDate
      ? { from: startDate, to: endDate }
      : startDate
        ? { from: startDate, to: undefined }
        : undefined;

  // Helper to check if a date falls within any booked range
  const isDateBooked = (date: Date) => {
    return bookedDates.some((range) => {
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      const start = new Date(range.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range.endDate);
      end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  };

  // Validation logic
  const getValidationStatus = () => {
    return validateDateRange(
      startDate,
      endDate,
      minimumRentalPeriod,
      maximumRentalPeriod,
    );
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
        <FormField
          control={form.control}
          name="startDate"
          render={() => (
            <FormItem>
              <FormControl>
                <div className="flex justify-center">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range?.from) {
                        form.setValue("startDate", range.from, {
                          shouldValidate: true,
                        });
                      }
                      if (range?.to) {
                        form.setValue("endDate", range.to, {
                          shouldValidate: true,
                        });
                      }
                      if (!range) {
                        form.setValue("startDate", undefined, {
                          shouldValidate: true,
                        });
                        form.setValue("endDate", undefined, {
                          shouldValidate: true,
                        });
                      }
                    }}
                    disabled={(date) => {
                      // Disable past dates
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date < today) return true;

                      // Disable booked dates
                      if (isDateBooked(date)) return true;

                      // If we have a start date selected, validate the range
                      if (startDate) {
                        const daysFromStart =
                          differenceInDays(date, startDate) + 1;

                        // Disable if it would exceed maximum rental period
                        if (daysFromStart > maximumRentalPeriod) return true;

                        // Check if any date in the range is booked
                        const startDateObj = new Date(startDate);
                        const endDateObj = new Date(date);
                        const currentDate = new Date(startDateObj);

                        while (currentDate <= endDateObj) {
                          if (isDateBooked(currentDate)) return true;
                          currentDate.setDate(currentDate.getDate() + 1);
                        }
                      }

                      return false;
                    }}
                    modifiers={{
                      booked: (date) => isDateBooked(date),
                    }}
                    modifiersClassNames={{
                      booked: "bg-red-50 text-red-400 line-through opacity-50",
                    }}
                    numberOfMonths={2}
                    showOutsideDays={false}
                    className="w-full rounded-md border"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="endDate"
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date selection feedback */}
        {startDate && endDate && (
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
                    <strong>Selected:</strong> {formatDate(startDate, "PPP")} to{" "}
                    {formatDate(endDate, "PPP")} ({days} day
                    {days !== 1 ? "s" : ""})
                  </p>
                  {validation.error && (
                    <p className="mt-1 text-sm text-red-700">
                      {validation.error}
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
