"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
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
  GripVertical,
} from "lucide-react";

import type {
  CreateToolFormDataClientType,
  ImageFile,
} from "@/lib/form-schemas/tool.schema";
import { useToolForm } from "@/lib/hooks/use-tool-form";
import { createTool } from "@/lib/actions/create-tool";
import { validateImageFile } from "@/lib/utils/image-utils";
import { useToolImages } from "@/hooks/use-tool-images";

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
import { emojiMap, getMockToolImage } from "@/lib/constants/garage";
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
import { tryCatch } from "@walkup/walkup-utils";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface AddToolFormProps {
  categories: Category[];
  initialValues?: Partial<CreateToolFormDataClientType>;
  onSubmit?: (
    data: Omit<CreateToolFormDataClientType, "images">,
  ) => Promise<void | { error?: string; details?: unknown; toolId?: string }>;
  isEdit?: boolean;
  toolId?: string;
}

export function AddToolForm({
  categories,
  initialValues,
  onSubmit,
  isEdit,
  toolId,
}: AddToolFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Use tool images hook for editing existing tools
  const {
    images: existingImages,
    loadImages,
    isLoading: isLoadingImages,
  } = useToolImages(toolId || "");

  const form = useToolForm(initialValues);
  const {
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
    addImage,
    removeImage,
    addSpecification,
    removeSpecification,
    reset,
    handleDeliveryAvailableChange,
  } = form;

  // Load existing images when editing
  useEffect(() => {
    if (isEdit && toolId) {
      loadImages();
    }
  }, [isEdit, toolId, loadImages]);

  // Update form images when existing images are loaded
  useEffect(() => {
    if (isEdit && existingImages.length > 0) {
      const imageFiles = existingImages.map((img) => ({
        id: img.id,
        url: img.imageUrl,
        orderIndex: img.orderIndex,
      }));
      setValue("images", imageFiles);
    }
  }, [existingImages, isEdit, setValue]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      Array.from(files).forEach((file) => {
        const error = validateImageFile(file);
        if (error) {
          toast.error(error);
          return;
        }

        addImage(file);
      });
    },
    [addImage],
  );

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect],
  );

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload images to blob storage
  const uploadImages = async (images: ImageFile[], targetToolId: string) => {
    const uploadPromises = images
      .filter((img) => img.file)
      .map(async (image) => {
        if (!image.file) return;

        const uploadFormData = new FormData();
        uploadFormData.append("file", image.file);

        const res = await fetch(`/api/tools/${targetToolId}`, {
          method: "POST",
          body: uploadFormData,
        });

        if (!res.ok) {
          const err = await res.json();
          console.error(`Failed to upload image ${image.file.name}`, err);
          throw new Error(`Failed to upload image: ${image.file.name}`);
        }

        return res.json();
      });

    await Promise.all(uploadPromises);
  };

  const defaultOnSubmit = async (formData: CreateToolFormDataClientType) => {
    setIsSubmitting(true);

    const { images, ...toolDataWithoutImages } = formData;

    if (!images || images.length === 0) {
      toast.error("Please add at least one image.");
      setIsSubmitting(false);
      return;
    }

    // Create tool without images
    const { data, error } = await tryCatch(createTool(toolDataWithoutImages));

    if (error || !data?.toolId) {
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const newToolId = data.toolId;

    // Upload images to blob and save to db
    try {
      await uploadImages(images, newToolId);
      toast.success("Tool and images uploaded successfully!");
      reset();
      router.push("/dashboard/garage");
    } catch (uploadError) {
      console.error("Error uploading images", uploadError);
      toast.error("Error uploading one or more images.");
    }
    setIsSubmitting(false);
  };

  const handleFormSubmit = async (data: CreateToolFormDataClientType) => {
    console.log("DATA", data);
    console.log("onSubmit", onSubmit);

    // Check for form validation errors
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the form errors before submitting.");
      return;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        const { images, ...toolDataWithoutImages } = data;

        // For edit mode, check if we have any images (existing or new)
        if (isEdit) {
          const hasExistingImages = existingImages.length > 0;
          const hasNewImages = images.some((img: ImageFile) => img.file);

          if (!hasExistingImages && !hasNewImages) {
            toast.error("Please add at least one image.");
            setIsSubmitting(false);
            return;
          }
        } else {
          // For add mode, require at least one image
          if (!images || images.length === 0) {
            toast.error("Please add at least one image.");
            setIsSubmitting(false);
            return;
          }
        }

        const result = await onSubmit(toolDataWithoutImages);

        if (result?.error) {
          toast.error(result.error || "Failed to save tool. Please try again.");
          setIsSubmitting(false);
          return;
        }

        // Upload new images if any (for edit mode, use the existing toolId)
        const newImages = images.filter((img: ImageFile) => img.file);
        if (newImages.length > 0) {
          try {
            await uploadImages(newImages, result?.toolId || toolId!);
            toast.success("Tool and images uploaded successfully!");
          } catch (uploadError) {
            console.error("Error uploading images", uploadError);
            toast.error("Error uploading one or more images.");
          }
        } else {
          toast.success(
            isEdit
              ? "Tool updated successfully!"
              : "Tool created successfully!",
          );
        }

        router.push("/dashboard/garage");
      } catch (error) {
        setIsSubmitting(false);
        toast.error("An unexpected error occurred. Please try again.");
        console.error("Error saving tool:", error);
      }
    } else {
      await defaultOnSubmit(data);
    }
  };

  const images = getValues("images");
  console.log("IMAGES", images);

  return (
    <Form {...form}>
      <form className="space-y-8" onSubmit={handleSubmit(handleFormSubmit)}>
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
                                {category.icon && (
                                  <span>{emojiMap[category.icon]}</span>
                                )}
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
            {isLoadingImages && (
              <div className="py-8 text-center">
                <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
                <p className="text-muted-foreground mt-2">Loading images...</p>
              </div>
            )}

            {!isLoadingImages && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {images.map((image: ImageFile, index: number) => (
                    <div key={index} className="group relative">
                      <div className="relative">
                        <Image
                          src={
                            image.file
                              ? URL.createObjectURL(image.file)
                              : image.url || getMockToolImage()
                          }
                          alt={`Tool image ${index + 1}`}
                          height={270}
                          width={270}
                          unoptimized={!!image.file}
                          className="aspect-square w-full rounded-lg border object-cover"
                        />
                        <div className="bg-opacity-0 group-hover:bg-opacity-20 absolute inset-0 rounded-lg bg-black transition-all duration-200" />
                      </div>

                      {/* Drag handle */}
                      <div className="absolute top-2 left-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <GripVertical className="h-4 w-4 cursor-move text-white drop-shadow-md" />
                      </div>

                      {/* Remove button */}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>

                      {/* Main image badge */}
                      {index === 0 && (
                        <Badge
                          className="absolute bottom-2 left-2 text-xs"
                          variant={"secondary"}
                        >
                          Main
                        </Badge>
                      )}

                      {/* Upload progress indicator */}
                      {image.file && (
                        <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center rounded-lg bg-black">
                          <div className="text-xs text-white">
                            Ready to upload
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Upload button */}
                  <div
                    className={`flex aspect-square min-h-[120px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload
                      className={`mb-2 h-6 w-6 ${dragActive ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`text-center text-xs sm:text-sm ${dragActive ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {dragActive
                        ? "Drop images here"
                        : "Click or drag to upload"}
                    </span>
                    <span className="text-muted-foreground mt-1 text-xs">
                      Max 5MB per image
                    </span>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                {images.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <Camera className="text-muted-foreground mx-auto h-12 w-12" />
                    <h3 className="mt-2 text-sm font-semibold">
                      No photos yet
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Add at least one photo *
                    </p>
                  </div>
                )}
              </>
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
                          <span className="font-medium">{key}:</span>{" "}
                          {String(value)}
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
            disabled={isSubmitting || isLoadingImages}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting
              ? isEdit
                ? "Saving..."
                : "Adding Tool..."
              : isEdit
                ? "Save Changes"
                : "Add Tool"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
