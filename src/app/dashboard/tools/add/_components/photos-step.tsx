import Image from "next/image";
import { Upload, X, Camera } from "lucide-react";
import { type CreateToolFormData } from "@/lib/schemas/tool.schema";
import { getMockToolImage } from "@/lib/constants/garage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PhotosStepProps {
  formData: CreateToolFormData;
  addImage: () => void;
  removeImage: (index: number) => void;
}

export function PhotosStep({
  formData,
  addImage,
  removeImage,
}: PhotosStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="text-primary h-5 w-5" />
        <h3 className="text-lg font-semibold">Tool Photos</h3>
      </div>
      <p className="text-muted-foreground text-sm">
        Add clear photos of your tool. The first photo will be the main image.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {formData.images.map((image, index) => (
          <div key={index} className="relative">
            <Image
              src={image || getMockToolImage()}
              alt={`Tool image ${index + 1}`}
              height={270}
              width={270}
              className="aspect-square w-full rounded-lg border object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-0 right-0 h-6 w-6 cursor-pointer"
              onClick={() => removeImage(index)}
            >
              <X className="h-3 w-3" />
            </Button>
            {index === 0 && (
              <Badge className="absolute bottom-2 left-2" variant="secondary">
                Main
              </Badge>
            )}
          </div>
        ))}

        <Button
          variant="outline"
          className="aspect-square w-full border-dashed"
          onClick={addImage}
        >
          <div className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            <span className="text-sm">Add Photo</span>
          </div>
        </Button>
      </div>

      {formData.images.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Camera className="text-muted-foreground mx-auto h-12 w-12" />
          <h3 className="mt-2 text-sm font-semibold">No photos yet</h3>
          <p className="text-muted-foreground text-sm">
            Add at least one photo to continue
          </p>
        </div>
      )}
    </div>
  );
}
