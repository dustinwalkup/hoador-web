import { DollarSign, MapPin, Truck } from "lucide-react";
import { Control, useWatch } from "react-hook-form";

import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PickupDeliverySectionProps {
  control: Control<CreateListingFormDataClientType>;
}

export function PickupDeliverySection({ control }: PickupDeliverySectionProps) {
  const deliveryMode = useWatch({
    control,
    name: "deliveryMode",
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="text-primary h-5 w-5" />
          Pickup & Delivery
        </CardTitle>
        <CardDescription>How will renters get your tool?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="deliveryMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Mode</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pickup_only">
                    Pickup Only - Renter must pick up from your location
                  </SelectItem>
                  <SelectItem value="delivery_only">
                    Delivery Only - You deliver to the renter
                  </SelectItem>
                  <SelectItem value="both_available">
                    Both Available - Renter can choose pickup or delivery
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {(deliveryMode === "delivery_only" ||
          deliveryMode === "both_available") && (
          <div className="border-muted ml-4 space-y-4 border-l-2 pl-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={control}
                name="deliveryFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Fee</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="pl-9 text-base"
                          {...field}
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(
                              Number.parseFloat(e.target.value) || 0,
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
                name="deliveryRadius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Radius (miles)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="10"
                          className="pl-9 text-base"
                          {...field}
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
