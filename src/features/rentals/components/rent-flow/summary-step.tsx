"use client";

import { useFormContext } from "react-hook-form";

import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils/date.utils";
import { type RentalFormData } from "@/features/rentals/lib/rental-form.schema";
import type { CurrentDocumentVersion } from "@/dal/types";
import { LegalDisclosures } from "@/features/rentals/components/rent-flow/legal-disclosures";
import { SecurityDepositLine } from "@/features/rentals/components/security-deposit-line";
import { ServiceFeeLine } from "@/features/rentals/components/service-fee-line";

interface SummaryStepProps {
  pricing: {
    days: number;
    subtotal: number;
    deliveryFee: number;
    setupFee: number;
    serviceFee: number;
    securityDeposit: number;
    total: number;
  };
  legalDocuments: {
    rentalAgreement?: CurrentDocumentVersion;
    cancellationRefund?: CurrentDocumentVersion;
    safetyLiabilityPackage?: CurrentDocumentVersion;
    paymentPayout?: CurrentDocumentVersion;
  };
}

export function SummaryStep({ pricing, legalDocuments }: SummaryStepProps) {
  const form = useFormContext<RentalFormData>();
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const deliveryMethod = form.watch("deliveryMethod");
  const deliveryStreet = form.watch("deliveryStreet");
  const deliveryCity = form.watch("deliveryCity");
  const deliveryState = form.watch("deliveryState");
  const deliveryZip = form.watch("deliveryZip");
  const deliveryInstructions = form.watch("deliveryInstructions");
  const setupRequested = form.watch("setupRequested");

  const deliveryAddress =
    deliveryMethod === "delivery" && deliveryStreet && deliveryCity
      ? `${deliveryStreet}, ${deliveryCity}, ${deliveryState} ${deliveryZip}`
      : "";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Booking Summary</h3>

        <div className="space-y-4">
          <div className="flex justify-between py-2">
            <span>Rental Period:</span>
            <span className="font-medium">
              {startDate && endDate
                ? pricing.days === 1
                  ? `${formatDate(startDate, "MMM d")} (1 day)`
                  : `${formatDate(startDate, "MMM d")} - ${formatDate(endDate, "MMM d")} (${pricing.days} days)`
                : "—"}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span>{deliveryMethod === "pickup" ? "Pickup" : "Delivery"}:</span>
            <span className="font-medium">
              {deliveryMethod === "pickup" ? "Owner location" : deliveryAddress}
            </span>
          </div>

          {deliveryMethod === "delivery" && deliveryInstructions && (
            <div className="py-2">
              <span className="mb-1 block text-sm text-gray-600">
                Delivery Instructions:
              </span>
              <span className="text-sm">{deliveryInstructions}</span>
            </div>
          )}

          {setupRequested && (
            <div className="flex justify-between py-2">
              <span>Setup Service:</span>
              <span className="font-medium">Requested</span>
            </div>
          )}
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
          {pricing.setupFee > 0 && (
            <div className="flex justify-between">
              <span>Setup service</span>
              <span>${pricing.setupFee.toFixed(2)}</span>
            </div>
          )}
          <ServiceFeeLine amount={pricing.serviceFee} />
          <SecurityDepositLine amount={pricing.securityDeposit} />
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total due now</span>
            <span>${pricing.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="message">
                  Message to Owner (Optional but Recommended)
                </FormLabel>
                <FormControl>
                  <Textarea
                    id="message"
                    placeholder="Tell the owner about your project and any special requirements. After approval, you'll coordinate exact pickup/delivery times via messaging..."
                    {...field}
                    className="mt-2"
                    rows={4}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <Separator />

      {/* Legal Disclosures */}
      <LegalDisclosures legalDocuments={legalDocuments} />
    </div>
  );
}
