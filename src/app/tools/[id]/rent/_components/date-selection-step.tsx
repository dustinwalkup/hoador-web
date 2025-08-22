"use client";

import type { DateRange } from "react-day-picker";

import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
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
            disabled={(date) =>
              date < new Date() ||
              (dateRange?.from &&
                differenceInDays(date, dateRange.from) >=
                  maximumRentalPeriod) ||
              false
            }
            numberOfMonths={2}
            className="rounded-md border"
          />
        </div>
        {dateRange?.from && dateRange?.to && (
          <div className="mt-4 rounded-lg bg-green-50 p-4">
            <p className="text-sm text-green-800">
              <strong>Selected:</strong> {formatDate(dateRange.from, "PPP")} to{" "}
              {formatDate(dateRange.to, "PPP")} ({days} day
              {days !== 1 ? "s" : ""})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
