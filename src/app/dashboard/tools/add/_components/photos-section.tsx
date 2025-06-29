import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Camera, GripVertical, Upload, X } from "lucide-react";
import { Control, UseFormGetValues } from "react-hook-form";

import type {
  CreateToolFormDataClientType,
  ImageFile,
} from "@/lib/form-schemas/tool.schema";
import { getMockToolImage } from "@/lib/constants/garage";
import { validateImageFile } from "@/lib/utils/image-utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface PhotosSectionProps {
  control: Control<CreateToolFormDataClientType>;
  getValues: UseFormGetValues<CreateToolFormDataClientType>;
  addImage: (file?: File) => void;
  removeImage: (index: number) => void;
  isLoadingImages?: boolean;
}

export function PhotosSection({
  control,
  getValues,
  addImage,
  removeImage,
  isLoadingImages = false,
}: PhotosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const images = getValues("images");

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      Array.from(files).forEach((file) => {
        const error = validateImageFile(file);
        if (error) {
          // You might want to add toast here
          console.error(error);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="text-primary h-5 w-5" />
          Photos
        </CardTitle>
        <CardDescription>
          Add clear photos of your tool. The first photo will be the main image.
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
                      <div className="text-xs text-white">Ready to upload</div>
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
                  {dragActive ? "Drop images here" : "Click or drag to upload"}
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
                <h3 className="mt-2 text-sm font-semibold">No photos yet</h3>
                <p className="text-muted-foreground text-sm">
                  Add at least one photo *
                </p>
              </div>
            )}
          </>
        )}

        <FormField
          control={control}
          name="images"
          render={() => (
            <FormItem>
              <FormControl>
                <div />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
