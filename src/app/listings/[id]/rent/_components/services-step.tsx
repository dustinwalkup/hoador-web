"use client";

import { useFormContext } from "react-hook-form";
import { MapPin, Truck, Wrench } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { US_STATES } from "@/constants/profile";
import { type RentalFormData } from "@/features/rentals/lib/rental-form.schema";

interface ServicesStepProps {
  ownerName: string;
  deliveryMode: "pickup_only" | "delivery_only" | "both_available";
  deliveryFee: number;
  deliveryRadius: number;
  setupAvailable: boolean;
  setupFee: number;
}

export function ServicesStep({
  ownerName,
  deliveryMode,
  deliveryFee,
  deliveryRadius,
  setupAvailable,
  setupFee,
}: ServicesStepProps) {
  const form = useFormContext<RentalFormData>();
  const deliveryMethod = form.watch("deliveryMethod");
  const deliveryInstructions = form.watch("deliveryInstructions") || "";
  const setupRequested = form.watch("setupRequested");

  const handleDeliveryMethodChange = (value: "pickup" | "delivery") => {
    form.setValue("deliveryMethod", value);
    // Reset setup request when switching to pickup
    if (value === "pickup" && setupRequested) {
      form.setValue("setupRequested", false);
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Remove non-digits
    if (value.length <= 5) {
      form.setValue("deliveryZip", value);
    }
  };

  const isSetupEnabled = deliveryMethod === "delivery" && setupAvailable;

  return (
    <div className="space-y-6">
      {/* Delivery Method Selection */}
      <div>
        <Label className="mb-4 block text-base font-medium">
          How would you like to get the tool?
        </Label>
        <FormField
          control={form.control}
          name="deliveryMethod"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value: "pickup" | "delivery") => {
                    field.onChange(value);
                    handleDeliveryMethodChange(value);
                  }}
                >
                  <div className="space-y-4">
                    {/* Pickup */}
                    {(deliveryMode === "pickup_only" ||
                      deliveryMode === "both_available") && (
                      <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <div className="flex-1">
                          <Label
                            htmlFor="pickup"
                            className="flex cursor-pointer items-center gap-2 font-medium"
                          >
                            <MapPin className="h-4 w-4" />
                            Pickup from owner
                          </Label>
                          <p className="mt-1 text-sm text-gray-600">
                            Exact times will be coordinated with {ownerName}{" "}
                            after approval
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Delivery */}
                    {(deliveryMode === "delivery_only" ||
                      deliveryMode === "both_available") && (
                      <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50">
                        <RadioGroupItem value="delivery" id="delivery" />
                        <div className="flex-1">
                          <Label
                            htmlFor="delivery"
                            className="flex cursor-pointer items-center gap-2 font-medium"
                          >
                            <Truck className="h-4 w-4" />
                            Delivery (+${deliveryFee.toFixed(2)})
                          </Label>
                          <p className="mt-1 text-sm text-gray-600">
                            Available within {deliveryRadius} miles. Exact times
                            will be coordinated after approval
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {deliveryMethod === "delivery" && (
          <div className="mt-4 space-y-4">
            <Label className="text-base font-medium">Delivery Address</Label>

            {/* Street Address */}
            <FormField
              control={form.control}
              name="deliveryStreet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-gray-700">
                    Street Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main St"
                      {...field}
                      className="mt-1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City, State, Zip - stacked on mobile, row on desktop */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              {/* City */}
              <div className="md:col-span-3">
                <FormField
                  control={form.control}
                  name="deliveryCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-gray-700">
                        City
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="New York"
                          {...field}
                          className="mt-1"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* State */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="deliveryState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-gray-700">
                        State
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="mt-1 w-full">
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Zip Code */}
              <div className="md:col-span-1">
                <FormField
                  control={form.control}
                  name="deliveryZip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-gray-700">
                        Zip
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="10001"
                          {...field}
                          onChange={handleZipChange}
                          className="mt-1"
                          maxLength={5}
                          pattern="[0-9]{5}"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Delivery Instructions */}
            <FormField
              control={form.control}
              name="deliveryInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-gray-700">
                    Delivery Instructions (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special instructions for delivery, such as gate codes, building access, or preferred delivery times..."
                      {...field}
                      className="mt-1"
                      rows={2}
                      maxLength={500}
                    />
                  </FormControl>
                  <p className="mt-1 text-xs text-gray-500">
                    {deliveryInstructions.length}/500 characters
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>

      {/* Setup Service Option */}
      <div className="rounded-lg border p-4">
        <FormField
          control={form.control}
          name="setupRequested"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start space-x-3">
                <FormControl>
                  <Checkbox
                    id="setup"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                    }}
                    disabled={!isSetupEnabled}
                  />
                </FormControl>
                <div className="flex-1">
                  <Label
                    htmlFor="setup"
                    className={`flex cursor-pointer items-center gap-2 font-medium ${
                      !isSetupEnabled ? "text-gray-400" : ""
                    }`}
                  >
                    <Wrench className="h-4 w-4" />
                    Setup Service
                    {setupAvailable && isSetupEnabled && (
                      <span className="text-sm font-normal">
                        (+${setupFee.toFixed(2)})
                      </span>
                    )}
                  </Label>
                  <p
                    className={`mt-1 text-sm ${
                      !isSetupEnabled ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {!setupAvailable
                      ? "Setup service not available for this listing"
                      : deliveryMethod === "pickup"
                        ? "Setup service requires delivery option"
                        : `Have ${ownerName} set up the item for you at your location`}
                  </p>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
