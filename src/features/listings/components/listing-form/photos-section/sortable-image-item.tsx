import type { ImageFile } from "@/features/listings/form-schema/listing.schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, GripVertical, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListingImage } from "./listing-image";

export function SortableImageItem({
  image,
  index,
  onLoad,
  onError,
  onRemove,
}: {
  image: ImageFile;
  index: number;
  onLoad: () => void;
  onError: (index: number, e: React.SyntheticEvent<HTMLImageElement>) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id || `img-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* Processing overlay */}
      {image.status === "processing" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/40">
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-xs text-white">Processing...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {image.status === "error" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-red-500/20">
          <div className="flex flex-col items-center gap-1">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <span className="text-xs text-red-600">
              {image.errorMessage || "Failed"}
            </span>
          </div>
        </div>
      )}

      <ListingImage
        image={image}
        index={index}
        onLoad={onLoad}
        onError={onError}
      />

      {/* Drag handle - always visible on mobile, hover on desktop */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 cursor-grab opacity-80 transition-opacity active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
      >
        <div className="rounded bg-black/30 p-0.5">
          <GripVertical className="h-4 w-4 text-white drop-shadow-md" />
        </div>
      </div>

      {/* Remove button - subtle dark pill, always visible on mobile */}
      <button
        type="button"
        aria-label={`Remove image ${index + 1}`}
        className="absolute top-1.5 right-1.5 z-20 flex h-7 min-h-11 w-7 min-w-11 items-center justify-center rounded-full bg-black/50 text-white opacity-60 transition-opacity hover:bg-black/70 focus:opacity-100 focus:outline-none sm:opacity-0 sm:group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Main image badge */}
      {index === 0 && (
        <Badge className="absolute bottom-2 left-2 text-xs" variant="secondary">
          Main
        </Badge>
      )}
    </div>
  );
}
