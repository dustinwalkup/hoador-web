import { useState, useEffect } from "react";
import Image from "next/image";

import { ImageOff } from "lucide-react";

import type { ImageFile } from "@/features/listings/form-schema/listing.schema";

import { Skeleton } from "@/components/ui/skeleton";

export function ListingImage({
  image,
  index,
  onLoad,
  onError,
}: {
  image: ImageFile;
  index: number;
  onLoad: () => void;
  onError: (index: number, e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!image.file) return;

    const url = URL.createObjectURL(image.file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [image.file]);

  const imageSrc =
    image.file && objectUrl
      ? objectUrl
      : typeof image.url === "string"
        ? image.url
        : "";

  if (!imageSrc) {
    return (
      <div className="relative aspect-square w-full rounded-lg border">
        <Skeleton className="absolute inset-0" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-muted relative flex aspect-square w-full items-center justify-center rounded-lg border">
        <div className="text-muted-foreground flex flex-col items-center gap-1">
          <ImageOff className="h-6 w-6" />
          <span className="text-xs">Failed to load</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
      {!isLoaded && <Skeleton className="absolute inset-0 rounded-lg" />}

      <Image
        src={imageSrc}
        alt={`Listing image ${index + 1}`}
        fill
        unoptimized={!!image.file}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={`object-cover transition-all duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => {
          setIsLoaded(true);
          onLoad();
        }}
        onError={(e) => {
          setHasError(true);
          onError(index, e);
        }}
      />
    </div>
  );
}
