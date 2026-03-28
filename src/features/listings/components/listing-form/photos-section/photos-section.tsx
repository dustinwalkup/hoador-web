import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Camera, Upload, Loader2 } from "lucide-react";
import { Control, UseFormGetValues, useWatch } from "react-hook-form";

import type {
  CreateListingFormClientValues,
  ImageFile,
} from "@/features/listings/form-schema/listing.schema";
import { processSelectedFiles } from "@/lib/image/process-selected-files";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { MAX_IMAGES, PhotoTips } from "./photo-tips";
import { SortableImageItem } from "./sortable-image-item";

interface PhotosSectionProps {
  control: Control<CreateListingFormClientValues>;
  getValues: UseFormGetValues<CreateListingFormClientValues>;
  addImage: (file?: File) => void;
  removeImage: (index: number) => void;
  setImages: (images: ImageFile[]) => void;
  isLoadingImages?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
}

export function PhotosSection({
  control,
  getValues,
  addImage,
  removeImage,
  setImages,
  isLoadingImages = false,
  onProcessingChange,
}: PhotosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const [currentStage, setCurrentStage] = useState<
    "converting" | "compressing" | null
  >(null);
  // Map original source file key → converted file key to catch HEIC re-selection
  // (converted files have different name/size/lastModified than the source)
  const sourceToConvertedRef = useRef(new Map<string, string>());

  const images = useWatch({ control, name: "images" }) ?? [];

  useEffect(() => {
    onProcessingChange?.(processingCount > 0);
  }, [processingCount, onProcessingChange]);
  const imageCount = images.length;
  const remainingSlots = MAX_IMAGES - imageCount;
  const isAtLimit = remainingSlots <= 0;

  const handleImageLoad = () => {
    // Image loaded successfully
  };

  const handleImageError = (
    index: number,
    e: React.SyntheticEvent<HTMLImageElement>,
  ) => {
    console.error("Image failed to load:", e);
  };

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const currentImages = getValues("images");
      const currentRemaining = MAX_IMAGES - currentImages.length;

      const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

      // Prune source→converted mappings for images that have been removed
      const currentConvertedKeys = new Set(
        currentImages
          .filter((img) => img.file)
          .map((img) => fileKey(img.file as File)),
      );
      for (const [sourceKey, convertedKey] of sourceToConvertedRef.current) {
        if (!currentConvertedKeys.has(convertedKey)) {
          sourceToConvertedRef.current.delete(sourceKey);
        }
      }

      if (currentRemaining <= 0) {
        toast.error(
          `Maximum ${MAX_IMAGES} photos. Remove a photo to add more.`,
        );
        return;
      }

      let filesToProcess = Array.from(files);
      if (filesToProcess.length > currentRemaining) {
        toast.warning(
          `Only ${currentRemaining} more photo${currentRemaining === 1 ? "" : "s"} can be added. Extra files were skipped.`,
        );
        filesToProcess = filesToProcess.slice(0, currentRemaining);
      }

      // Deduplicate against:
      // 1. existing converted files in the form
      // 2. previously added source files (catches HEIC re-selection)
      // 3. within the current batch
      const seenKeys = new Set<string>();
      const beforeCount = filesToProcess.length;
      filesToProcess = filesToProcess.filter((f) => {
        const key = fileKey(f);
        if (
          currentConvertedKeys.has(key) ||
          sourceToConvertedRef.current.has(key) ||
          seenKeys.has(key)
        )
          return false;
        seenKeys.add(key);
        return true;
      });

      const skippedCount = beforeCount - filesToProcess.length;
      if (filesToProcess.length === 0) {
        toast.info(
          skippedCount === 1
            ? "This photo has already been added."
            : "These photos have already been added.",
        );
        return;
      }
      if (skippedCount > 0) {
        toast.info(
          skippedCount === 1
            ? "1 duplicate photo was skipped."
            : `${skippedCount} duplicate photos were skipped.`,
        );
      }

      // Remember original source file keys before conversion
      const sourceKeys = new Map(
        filesToProcess.map((f) => [f.name, fileKey(f)]),
      );

      setProcessingCount((c) => c + filesToProcess.length);

      const result = await processSelectedFiles(filesToProcess, {
        onFileProcessing: (_fileName, stage) => {
          if (stage === "converting" || stage === "compressing") {
            setCurrentStage(stage);
          } else if (stage === "done" || stage === "error") {
            setProcessingCount((c) => {
              const next = Math.max(0, c - 1);
              if (next === 0) setCurrentStage(null);
              return next;
            });
          }
        },
      });

      // Re-check for duplicates after async processing
      const latestImages = getValues("images");
      const latestKeys = new Set(
        latestImages
          .filter((img) => img.file)
          .map((img) => fileKey(img.file as File)),
      );

      result.errors.forEach((err) => toast.error(err.message));
      result.files.forEach((file) => {
        const convertedKey = fileKey(file);
        if (!latestKeys.has(convertedKey)) {
          latestKeys.add(convertedKey);
          addImage(file);

          // Map source key → converted key (for HEIC: photo.heic key → photo.jpg key)
          // For non-HEIC files the source and converted keys are identical
          const baseName = file.name.replace(/\.jpg$/, "");
          for (const [origName, origKey] of sourceKeys) {
            if (
              origName === file.name ||
              origName.replace(/\.heic$/i, "").replace(/\.heif$/i, "") ===
                baseName
            ) {
              sourceToConvertedRef.current.set(origKey, convertedKey);
              break;
            }
          }
        }
      });
    },
    [addImage, getValues],
  );

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

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await handleFileSelect(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex(
      (img) => (img.id || `img-${images.indexOf(img)}`) === active.id,
    );
    const newIndex = images.findIndex(
      (img) => (img.id || `img-${images.indexOf(img)}`) === over.id,
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(images, oldIndex, newIndex).map((img, i) => ({
      ...img,
      orderIndex: i,
    }));
    setImages(newOrder);
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
        <PhotoTips imageCount={imageCount} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Photo count indicator */}
        {imageCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              {imageCount} of {MAX_IMAGES} photos
            </span>
            <Progress
              value={(imageCount / MAX_IMAGES) * 100}
              className="h-1.5 flex-1"
            />
          </div>
        )}

        {/* Processing banner */}
        <AnimatePresence>
          {processingCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="bg-primary/5 text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                <Loader2 className="text-primary h-4 w-4 animate-spin" />
                {currentStage === "converting"
                  ? "Converting..."
                  : currentStage === "compressing"
                    ? "Optimizing..."
                    : `Processing ${processingCount} photo${processingCount !== 1 ? "s" : ""}...`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isLoadingImages && (
          <>
            {/* Empty state */}
            {imageCount === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all ${
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
                <div className="bg-primary/10 mb-4 rounded-full p-4">
                  <Camera className="text-primary h-8 w-8" />
                </div>
                <h3 className="mb-1 text-base font-semibold">
                  Add photos of your item
                </h3>
                <p className="text-muted-foreground mb-4 max-w-xs text-center text-sm">
                  Upload up to {MAX_IMAGES} photos. The first photo will be your
                  main listing image.
                </p>
                <Button type="button" variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" /> Choose Photos
                </Button>
                <p className="text-muted-foreground mt-3 text-xs">
                  JPEG, PNG, HEIC &middot; Max 10MB each
                </p>
              </motion.div>
            )}

            {/* Image grid with reorder */}
            {imageCount > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={images.map((img, i) => img.id || `img-${i}`)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map((image: ImageFile, index: number) => (
                      <SortableImageItem
                        key={image.id || `img-${index}`}
                        image={image}
                        index={index}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        onRemove={removeImage}
                      />
                    ))}

                    {/* Upload button in grid */}
                    {!isAtLimit && (
                      <div
                        className={`flex aspect-square h-full min-h-30 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ${
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
                          className={`px-2 text-center text-xs ${dragActive ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {dragActive ? "Drop here" : "Add more"}
                        </span>
                        <span className="text-muted-foreground mt-1 px-2 text-center text-xs">
                          {remainingSlots} remaining
                        </span>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.heic,.heif"
              onChange={handleFileInputChange}
              className="hidden"
            />
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
