import { Calendar, DollarSign, Shield } from "lucide-react";
import { Control } from "react-hook-form";

import {
  MINIMUM_LISTING_PRICE_USD,
  STRIPE_MINIMUM_CHARGE_USD,
} from "@/constants/payments";
import type { CreateListingFormClientValues } from "@/features/listings/form-schema/listing.schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NumericInput,
  toNumericInputValue,
} from "@/components/ui/numeric-input";
import { Separator } from "@/components/ui/separator";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface PricingSectionProps {
  control: Control<CreateListingFormClientValues>;
}

export function PricingSection({ control }: PricingSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="text-primary h-5 w-5" />
          Pricing & Rental Terms
        </CardTitle>
        <CardDescription>Set your rates and rental conditions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <h4 className="font-medium">Rental Rates</h4>
        <FormField
          control={control}
          name="dailyRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Daily Rate *</FormLabel>
              <FormControl>
                <div className="relative">
                  <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                  <NumericInput
                    variant="decimal"
                    maxFractionDigits={2}
                    placeholder="0.00"
                    className="pl-9 text-base"
                    name={field.name}
                    ref={field.ref}
                    value={toNumericInputValue(field.value)}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </div>
              </FormControl>
              <FormMessage />
              <p className="text-muted-foreground text-sm">
                Minimum ${MINIMUM_LISTING_PRICE_USD.toFixed(2)} per day
              </p>
            </FormItem>
          )}
        />
        {/* Weekly/monthly rates temporarily disabled — daily rate only */}
        {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="weeklyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weekly Rate (Optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-9 text-base"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? Number.parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="monthlyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly Rate (Optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-9 text-base"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? Number.parseFloat(e.target.value)
                            : undefined,
                        )
                      }
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div> */}
        <Separator />
        <FormField
          control={control}
          name="securityDeposit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Security Deposit</FormLabel>
              <FormControl>
                <div className="relative">
                  <Shield className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                  <NumericInput
                    variant="decimal"
                    maxFractionDigits={2}
                    placeholder="0.00"
                    className="pl-9 text-base"
                    name={field.name}
                    ref={field.ref}
                    value={toNumericInputValue(field.value)}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </div>
              </FormControl>
              <FormMessage />
              <p className="text-muted-foreground text-sm">
                Refundable deposit to protect against damage or loss. Enter $0
                or at least ${STRIPE_MINIMUM_CHARGE_USD.toFixed(2)}.
              </p>
            </FormItem>
          )}
        />
        <Separator />
        <div className="flex items-center gap-2">
          <Calendar className="text-primary h-5 w-5" />
          <h4 className="font-medium">Rental Period</h4>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="minimumRentalPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Rental (days)</FormLabel>
                <FormControl>
                  <NumericInput
                    variant="integer"
                    className="text-base"
                    name={field.name}
                    ref={field.ref}
                    value={toNumericInputValue(field.value)}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="maximumRentalPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Rental (days)</FormLabel>
                <FormControl>
                  <NumericInput
                    variant="integer"
                    className="text-base"
                    name={field.name}
                    ref={field.ref}
                    value={toNumericInputValue(field.value)}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
