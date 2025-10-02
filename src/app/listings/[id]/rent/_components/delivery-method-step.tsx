"use client";

import { MapPin, Truck } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface DeliveryMethodStepProps {
  deliveryMethod: "pickup" | "delivery";
  setDeliveryMethod: (method: "pickup" | "delivery") => void;
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  ownerName: string;
  deliveryMode: "pickup_only" | "delivery_only" | "both_available";
  deliveryFee: number;
  deliveryRadius: number;
}

export function DeliveryMethodStep({
  deliveryMethod,
  setDeliveryMethod,
  deliveryAddress,
  setDeliveryAddress,
  ownerName,
  deliveryMode,
  deliveryFee,
  deliveryRadius,
}: DeliveryMethodStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-4 block text-base font-medium">
          How would you like to get the tool?
        </Label>
        <RadioGroup
          value={deliveryMethod}
          onValueChange={(value: "pickup" | "delivery") =>
            setDeliveryMethod(value)
          }
        >
          <div className="space-y-4">
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
                  Coordinate pickup time and location with {ownerName}
                </p>
              </div>
            </div>

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
                    Delivery (+${deliveryFee})
                  </Label>
                  <p className="mt-1 text-sm text-gray-600">
                    Available within {deliveryRadius} miles
                  </p>
                </div>
              </div>
            )}
          </div>
        </RadioGroup>

        {deliveryMethod === "delivery" && (
          <div className="mt-4">
            <Label htmlFor="address">Delivery Address</Label>
            <Textarea
              id="address"
              placeholder="Enter your delivery address..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="mt-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
