import { DollarSign, MapPin, Truck } from "lucide-react";
import { Control, UseFormGetValues } from "react-hook-form";

import type { CreateToolFormDataClientType } from "@/features/tools/form-schema/tool.schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface PickupDeliverySectionProps {
  control: Control<CreateToolFormDataClientType>;
  getValues: UseFormGetValues<CreateToolFormDataClientType>;
  handleDeliveryAvailableChange: (checked: boolean) => void;
}

export function PickupDeliverySection({
  control,
  getValues,
  handleDeliveryAvailableChange,
}: PickupDeliverySectionProps) {
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
          name="requiresPickup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Requires Pickup</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="requiresPickup"
                />
              </FormControl>
              <FormMessage />
              <p className="text-muted-foreground text-sm">
                Renter must pick up the tool from your location
              </p>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="deliveryAvailable"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Available</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={handleDeliveryAvailableChange}
                  id="deliveryAvailable"
                />
              </FormControl>
              <FormMessage />
              <p className="text-muted-foreground text-sm">
                You can deliver the tool to the renter
              </p>
            </FormItem>
          )}
        />
        {getValues("deliveryAvailable") && (
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
