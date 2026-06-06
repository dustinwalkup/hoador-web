import { DollarSign, MapPin, Truck } from "lucide-react";
import { Control, useWatch } from "react-hook-form";

import type { CreateListingFormClientValues } from "@/features/listings/form-schema/listing.schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PickupDeliverySectionProps {
  control: Control<CreateListingFormClientValues>;
}

export function PickupDeliverySection({ control }: PickupDeliverySectionProps) {
  const deliveryMode = useWatch({
    control,
    name: "deliveryMode",
  });

  const setupAvailable = useWatch({
    control,
    name: "setupAvailable",
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="text-primary h-5 w-5" />
          Pickup & Delivery
        </CardTitle>
        <CardDescription>How will renters get your item?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="deliveryMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Options</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full md:w-fit">
                    <SelectValue placeholder="Select delivery option" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pickup_only">
                    Pickup Only{" "}
                    <span className="text-muted-foreground hidden text-xs md:block">
                      Renter must pick up from your location
                    </span>
                  </SelectItem>
                  <SelectItem value="delivery_only">
                    Delivery Only{" "}
                    <span className="text-muted-foreground hidden text-xs md:block">
                      You deliver to the renter
                    </span>
                  </SelectItem>
                  <SelectItem value="both_available">
                    Both Available{" "}
                    <span className="text-muted-foreground hidden text-xs md:block">
                      Renter can choose pickup or delivery
                    </span>
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
                          step="0.01"
                          className="pl-9 text-base"
                          name={field.name}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(Number.parseFloat(e.target.value));
                          }}
                          onBlur={() => {
                            if (
                              field.value === undefined ||
                              field.value === null
                            ) {
                              field.onChange(0);
                            }
                            field.onBlur();
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Enter $0 for free delivery
                    </FormDescription>
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
                          step="1"
                          className="pl-9 text-base"
                          name={field.name}
                          ref={field.ref}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(Number.parseInt(e.target.value));
                          }}
                          onBlur={() => {
                            if (
                              field.value === undefined ||
                              field.value === null
                            ) {
                              field.onChange(0);
                            }
                            field.onBlur();
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Setup Service Section */}
            <div className="space-y-4">
              <FormField
                control={control}
                name="setupAvailable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                    <FormControl>
                      <Checkbox
                        id="setupAvailable"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="setupAvailable">
                        Offer Setup Service
                      </FormLabel>
                      <FormDescription>
                        Provide setup and installation at delivery location
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {setupAvailable && (
                <FormField
                  control={control}
                  name="setupFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Setup Fee</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            step="0.01"
                            className="pl-9 text-base"
                            name={field.name}
                            ref={field.ref}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              field.onChange(Number.parseFloat(e.target.value));
                            }}
                            onBlur={() => {
                              if (
                                field.value === undefined ||
                                field.value === null
                              ) {
                                field.onChange(0);
                              }
                              field.onBlur();
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Enter $0 for free setup included with delivery
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
