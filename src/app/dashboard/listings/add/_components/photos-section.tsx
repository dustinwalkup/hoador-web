import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Camera, GripVertical, Upload, X } from "lucide-react";
import { Control, UseFormGetValues } from "react-hook-form";

import type {
  CreateListingFormDataClientType,
  ImageFile,
} from "@/features/listings/form-schema/listing.schema";
import { validateImageFile } from "@/lib/image/image.utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

interface PhotosSectionProps {
  control: Control<CreateListingFormDataClientType>;
  getValues: UseFormGetValues<CreateListingFormDataClientType>;
  addImage: (file?: File) => void;
  removeImage: (index: number) => void;
  isLoadingImages?: boolean;
}

// Image component with smooth loading
function ListingImage({
  image,
  index,
  objectUrls,
  onLoad,
  onError,
}: {
  image: ImageFile;
  index: number;
  objectUrls: Record<number, string>;
  onLoad: () => void;
  onError: (index: number, e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError(index, e);
  };

  // Determine image source
  let imageSrc = "";
  if (image.file && objectUrls[index]) {
    imageSrc = objectUrls[index];
  } else if (
    image.url &&
    typeof image.url === "string" &&
    image.url.trim() !== ""
  ) {
    imageSrc = image.url;
  }

  // Don't render if no valid image source
  if (!imageSrc || imageSrc.trim() === "") {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
        <Skeleton className="absolute inset-0 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
      {/* Skeleton placeholder */}
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 rounded-lg" />
      )}

      <Image
        src={imageSrc}
        alt={`Listing image ${index + 1}`}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        unoptimized={!!image.file}
        className={`object-cover transition-all duration-500 ease-in-out ${
          isLoaded ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Hover overlay */}
      <div className="bg-opacity-0 group-hover:bg-opacity-20 absolute inset-0 rounded-lg transition-all duration-200" />
    </div>
  );
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
  const [objectUrls, setObjectUrls] = useState<Record<number, string>>({});

  const images = getValues("images");

  // Clean up object URLs when component unmounts or images change
  useEffect(() => {
    const newObjectUrls: Record<number, string> = {};

    images.forEach((image: ImageFile, index: number) => {
      if (image.file) {
        try {
          newObjectUrls[index] = URL.createObjectURL(image.file);
        } catch (error) {
          console.error("Failed to create object URL for image:", error);
        }
      }
    });

    setObjectUrls(newObjectUrls);

    return () => {
      Object.values(newObjectUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Failed to revoke object URL:", error);
        }
      });
    };
  }, [images]);

  const handleImageLoad = () => {
    // Image loaded successfully
  };

  const handleImageError = (
    index: number,
    e: React.SyntheticEvent<HTMLImageElement>,
  ) => {
    console.error("Image failed to load:", e);
    // Don't try to set a fallback src since we're not using mock images anymore
  };

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="text-primary h-5 w-5" />
          Photos
        </CardTitle>
        <CardDescription>
          Add clear photos of your item. The first photo will be the main image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoadingImages && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image: ImageFile, index: number) => (
                <div key={index} className="group relative">
                  <ListingImage
                    image={image}
                    index={index}
                    objectUrls={objectUrls}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />

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
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg">
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
                  Max 10MB - images will be automatically optimized
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

              {images.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <Camera className="text-muted-foreground mx-auto h-12 w-12" />
                  <h3 className="mt-2 text-sm font-semibold">No photos yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Add at least one photo *
                  </p>
                </div>
              )}
            </div>
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
