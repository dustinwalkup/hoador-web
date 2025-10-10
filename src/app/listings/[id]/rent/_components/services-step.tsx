"use client";

import { MapPin, Truck, Wrench } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/constants/profile";

interface ServicesStepProps {
  deliveryMethod: "pickup" | "delivery";
  setDeliveryMethod: (method: "pickup" | "delivery") => void;
  deliveryStreet: string;
  setDeliveryStreet: (street: string) => void;
  deliveryCity: string;
  setDeliveryCity: (city: string) => void;
  deliveryState: string;
  setDeliveryState: (state: string) => void;
  deliveryZip: string;
  setDeliveryZip: (zip: string) => void;
  ownerName: string;
  deliveryMode: "pickup_only" | "delivery_only" | "both_available";
  deliveryFee: number;
  deliveryRadius: number;
  setupAvailable: boolean;
  setupFee: number;
  setupRequested: boolean;
  setSetupRequested: (requested: boolean) => void;
}

export function ServicesStep({
  deliveryMethod,
  setDeliveryMethod,
  deliveryStreet,
  setDeliveryStreet,
  deliveryCity,
  setDeliveryCity,
  deliveryState,
  setDeliveryState,
  deliveryZip,
  setDeliveryZip,
  ownerName,
  deliveryMode,
  deliveryFee,
  deliveryRadius,
  setupAvailable,
  setupFee,
  setupRequested,
  setSetupRequested,
}: ServicesStepProps) {
  const handleDeliveryMethodChange = (value: "pickup" | "delivery") => {
    setDeliveryMethod(value);
    // Reset setup request when switching to pickup
    if (value === "pickup" && setupRequested) {
      setSetupRequested(false);
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Remove non-digits
    if (value.length <= 5) {
      setDeliveryZip(value);
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
        <RadioGroup
          value={deliveryMethod}
          onValueChange={(value: "pickup" | "delivery") =>
            handleDeliveryMethodChange(value)
          }
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
                    Exact times will be coordinated with {ownerName} after
                    approval
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
                    Available within {deliveryRadius} miles. Exact times will be
                    coordinated after approval
                  </p>
                </div>
              </div>
            )}
          </div>
        </RadioGroup>

        {deliveryMethod === "delivery" && (
          <div className="mt-4 space-y-4">
            <Label className="text-base font-medium">Delivery Address</Label>

            {/* Street Address */}
            <div>
              <Label htmlFor="street" className="text-sm text-gray-700">
                Street Address
              </Label>
              <Input
                id="street"
                placeholder="123 Main St"
                value={deliveryStreet}
                onChange={(e) => setDeliveryStreet(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            {/* City, State, Zip - stacked on mobile, row on desktop */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              {/* City */}
              <div className="md:col-span-3">
                <Label htmlFor="city" className="text-sm text-gray-700">
                  City
                </Label>
                <Input
                  id="city"
                  placeholder="New York"
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* State */}
              <div className="md:col-span-2">
                <Label htmlFor="state" className="text-sm text-gray-700">
                  State
                </Label>
                <Select value={deliveryState} onValueChange={setDeliveryState}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zip Code */}
              <div className="md:col-span-1">
                <Label htmlFor="zip" className="text-sm text-gray-700">
                  Zip
                </Label>
                <Input
                  id="zip"
                  placeholder="10001"
                  value={deliveryZip}
                  onChange={handleZipChange}
                  className="mt-1"
                  maxLength={5}
                  pattern="[0-9]{5}"
                  required
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Setup Service Option */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="setup"
            checked={setupRequested}
            onCheckedChange={(checked) => setSetupRequested(checked === true)}
            disabled={!isSetupEnabled}
          />
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
                  : `Have ${ownerName} set up the tool for you at your location`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
