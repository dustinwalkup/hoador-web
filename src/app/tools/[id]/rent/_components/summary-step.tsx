"use client";

import type { DateRange } from "react-day-picker";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils/date.utils";

interface TimeWindow {
  id: string;
  label: string;
  available: boolean;
}

interface SummaryStepProps {
  dateRange: DateRange | undefined;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string;
  selectedWindow: string;
  message: string;
  setMessage: (message: string) => void;
  pricing: {
    days: number;
    subtotal: number;
    deliveryFee: number;
    securityDeposit: number;
    total: number;
  };
  timeWindows: {
    pickup: TimeWindow[];
    delivery: TimeWindow[];
  };
}

export function SummaryStep({
  dateRange,
  deliveryMethod,
  deliveryAddress,
  selectedWindow,
  message,
  setMessage,
  pricing,
  timeWindows,
}: SummaryStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Booking Summary</h3>

        <div className="space-y-4">
          <div className="flex justify-between py-2">
            <span>Rental Period:</span>
            <span className="font-medium">
              {dateRange?.from &&
                dateRange?.to &&
                `${formatDate(dateRange.from, "MMM d")} - ${formatDate(dateRange.to, "MMM d")} (${pricing.days} days)`}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span>{deliveryMethod === "pickup" ? "Pickup" : "Delivery"}:</span>
            <span className="font-medium">
              {deliveryMethod === "pickup" ? "Owner location" : deliveryAddress}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span>Time Window:</span>
            <span className="font-medium">
              {
                timeWindows[deliveryMethod].find((w) => w.id === selectedWindow)
                  ?.label
              }
            </span>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Rental cost ({pricing.days} days)</span>
            <span>${pricing.subtotal.toFixed(2)}</span>
          </div>
          {pricing.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Delivery fee</span>
              <span>${pricing.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Security deposit</span>
            <span>${pricing.securityDeposit.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>${pricing.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6">
          <Label htmlFor="message">Message to Owner (Optional)</Label>
          <Textarea
            id="message"
            placeholder="Let the owner know about your project or any special requirements..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );
}
