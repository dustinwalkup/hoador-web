import { useId, useRef } from "react";
import { Camera, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type StagedPhoto } from "@/features/listings/ai-listing-assistant/types";

interface InstructionsViewProps {
  staged: StagedPhoto[];
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
}

// Note: this view does NOT revoke object URLs. The modal composer owns the
// `StagedPhoto.previewUrl` lifecycle so URLs survive being handed off to the
// form on `closed_cancel` / `closed_success`. Revoking here would invalidate
// previews the form is about to render.

/**
 * Plain-language guidance for the four most useful shots. Each entry includes
 * the "why" framing per Req 3.2 so users understand what AI gets out of it.
 */
const PHOTO_GUIDANCE: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "Full tool photo",
    description:
      "Show the whole tool from the side — helps us recognize what it is.",
  },
  {
    title: "Brand/model label close-up",
    description:
      "A clear shot of the model sticker helps us identify the exact tool.",
  },
  {
    title: "Accessories included",
    description:
      "Batteries, chargers, bits, attachments — anything that comes with it.",
  },
  {
    title: "Condition close-up",
    description:
      "Any visible wear, scuffs, or damage — so renters know what to expect.",
  },
];

export function InstructionsView({
  staged,
  onAddFiles,
  onRemovePhoto,
  onGenerate,
  onCancel,
}: InstructionsViewProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (filelist: FileList | null) => {
    if (!filelist || filelist.length === 0) return;
    onAddFiles(Array.from(filelist));
  };

  const canGenerate = staged.length > 0;

  return (
    <div className="flex flex-col gap-4" data-testid="ai-modal-instructions">
      <div>
        <p className="text-sm font-medium">Add 3–5 photos of your tool</p>
        <p className="text-muted-foreground text-xs">
          Different angles help us draft a more accurate listing.
        </p>
      </div>

      <ul className="bg-muted/40 grid gap-2 rounded-md p-3 text-xs">
        {PHOTO_GUIDANCE.map((g) => (
          <li key={g.title} className="flex flex-col">
            <span className="font-medium">{g.title}</span>
            <span className="text-muted-foreground">{g.description}</span>
          </li>
        ))}
      </ul>

      {staged.length > 0 && (
        <ul
          className="grid grid-cols-3 gap-2"
          data-testid="ai-modal-staged-photos"
        >
          {staged.map((photo) => (
            <li
              key={photo.id}
              className="bg-muted relative aspect-square overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={photo.file.name}
                className="size-full object-cover"
              />
              <button
                type="button"
                className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-full p-1 shadow"
                onClick={() => onRemovePhoto(photo.id)}
                aria-label={`Remove ${photo.file.name}`}
                data-testid={`ai-modal-remove-photo-${photo.id}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          data-testid="ai-modal-file-input"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          data-testid="ai-modal-camera-input"
        />
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
          data-testid="ai-modal-add-photos"
        >
          <Plus className="size-4" />
          {staged.length === 0 ? "Add photos" : "Add more"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={() => cameraInputRef.current?.click()}
          data-testid="ai-modal-take-photo"
        >
          <Camera className="size-4" />
          <span className="sm:hidden">Camera</span>
          <span className="hidden sm:inline">Take photo</span>
        </Button>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          data-testid="ai-modal-cancel"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="bg-ai text-ai-foreground hover:bg-ai/90"
          data-testid="ai-modal-generate"
        >
          <Sparkles className="size-4" />
          Generate Listing Draft
        </Button>
      </div>
    </div>
  );
}
