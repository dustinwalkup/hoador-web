"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  Camera,
  DollarSign,
  MapPin,
  Package,
  Plus,
  Settings,
  Shield,
  Truck,
  Upload,
  X,
} from "lucide-react";

import type { CreateToolFormData } from "@/lib/schemas/tool.schema";
import { useToolForm } from "@/lib/hooks/use-tool-form";
import { createTool } from "@/lib/actions/create-tool";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMockToolImage } from "@/lib/constants/garage";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface AddToolFormProps {
  categories: Category[];
}

export function AddToolForm({ categories }: AddToolFormProps) {
  const router = useRouter();
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    handleSubmit,
    control,
    getValues,
    formState: { errors },
    addImage,
    removeImage,
    addSpecification,
    removeSpecification,
    reset,
    setError,
    handleDeliveryAvailableChange,
  } = useToolForm();

  const onSubmit = async (data: CreateToolFormData) => {
    setIsSubmitting(true);
    const result = await createTool(data);
    setIsSubmitting(false);
    if (result?.error) {
      if (result.details) {
        // Set field errors from zod
        Object.entries(result.details.fieldErrors).forEach(
          ([field, messages]) => {
            setError(field as keyof CreateToolFormData, {
              message: (messages as string[])[0],
            });
          },
        );
      }
      // Optionally show a toast or error message
      return;
    }
    reset();
    router.push("/dashboard/garage");
  };

  return (
    <Form {...useToolForm()}>
      <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="text-primary h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Tell us about your tool</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tool Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., DeWalt Circular Saw"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="text-base">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center gap-2">
                                <span>{category.icon}</span>
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your tool, its condition, and any special features..."
                        rows={4}
                        {...field}
                        className="resize-none text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., DeWalt, Makita, Bosch"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DWE575SB" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">
                            Excellent - Like new
                          </SelectItem>
                          <SelectItem value="good">
                            Good - Minor wear
                          </SelectItem>
                          <SelectItem value="fair">
                            Fair - Some wear but functional
                          </SelectItem>
                          <SelectItem value="poor">
                            Poor - Heavy wear but works
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pricing & Rental Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="text-primary h-5 w-5" />
                Pricing & Rental Terms
              </CardTitle>
              <CardDescription>
                Set your rates and rental conditions
              </CardDescription>
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
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="pl-9 text-base"
                          {...field}
                          value={field.value || ""}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </div>
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
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="pl-9 text-base"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(
                              Number.parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-muted-foreground text-sm">
                      Refundable deposit to protect against damage or loss
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
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          className="text-base"
                          {...field}
                          value={field.value || 1}
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value) || 1)
                          }
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
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          className="text-base"
                          {...field}
                          value={field.value || 30}
                          onChange={(e) =>
                            field.onChange(
                              Number.parseInt(e.target.value) || 30,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="text-primary h-5 w-5" />
              Photos
            </CardTitle>
            <CardDescription>
              Add clear photos of your tool. The first photo will be the main
              image.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {getValues("images").map((image, index) => (
                <div key={index} className="relative">
                  <Image
                    src={image || getMockToolImage()}
                    alt={`Tool image ${index + 1}`}
                    height={270}
                    width={270}
                    className="aspect-square w-full rounded-lg border object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => {
                      removeImage(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  {index === 0 && (
                    <Badge
                      className="absolute bottom-2 left-2 text-xs"
                      variant={"secondary"}
                    >
                      Main
                    </Badge>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="aspect-square min-h-[120px] w-full border-dashed"
                onClick={addImage}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6" />
                  <span className="text-xs sm:text-sm">Add Photo</span>
                </div>
              </Button>
            </div>
            {getValues("images").length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Camera className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-2 text-sm font-semibold">No photos yet</h3>
                <p className="text-muted-foreground text-sm">
                  Add at least one photo *
                </p>
              </div>
            )}
            {errors.images && (
              <FormMessage>{errors.images.message as string}</FormMessage>
            )}
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Pickup & Delivery */}
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
                                  field.onChange(
                                    Number.parseInt(e.target.value) || 0,
                                  )
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
          {/* Additional Details (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="text-primary h-5 w-5" />
                Additional Details
              </CardTitle>
              <CardDescription>
                Optional specifications and instructions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Specifications */}
              <h4 className="font-medium">Specifications</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Input
                    placeholder="Specification name (e.g., Power)"
                    value={newSpecKey}
                    onChange={(e) => setNewSpecKey(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Value (e.g., 1200W)"
                    value={newSpecValue}
                    onChange={(e) => setNewSpecValue(e.target.value)}
                    className="flex-1 text-base"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      addSpecification(newSpecKey, newSpecValue);
                      setNewSpecKey("");
                      setNewSpecValue("");
                    }}
                    disabled={!newSpecKey || !newSpecValue}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {Object.entries(getValues("specifications")).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(getValues("specifications")).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{key}:</span> {value}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSpecification(key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              )}
              <Separator />
              <FormField
                control={control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="How to use this tool safely and effectively..."
                        rows={3}
                        {...field}
                        className="resize-none text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="safetyNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Safety Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Important safety information and warnings..."
                        rows={3}
                        {...field}
                        className="resize-none text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Adding Tool..." : "Add Tool"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
