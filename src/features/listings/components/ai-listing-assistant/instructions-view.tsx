"use client";

import { useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Loader2, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { containerVariants, fieldVariants } from "@/lib/animations/variants";
import {
  MAX_AI_PHOTOS,
  type StagedPhoto,
} from "@/features/listings/ai-listing-assistant/types";

interface InstructionsViewProps {
  staged: StagedPhoto[];
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  /**
   * Number of files currently being validated/converted/compressed. > 0 means
   * processing is in flight; the banner uses the count for an explicit
   * "Processing N photo(s)…" message.
   */
  processingFileCount?: number;
}

// Note: this view does NOT revoke object URLs. The modal composer owns the
// `StagedPhoto.previewUrl` lifecycle so URLs survive being handed off to the
// form on `closed_cancel` / `closed_success`. Revoking here would invalidate
// previews the form is about to render.

const buttonInteraction = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

const photoTileVariants = {
  hidden: { opacity: 0, scale: 0.85, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

/**
 * Plain-language guidance for the four most useful shots. Each entry includes
 * the "why" framing per Req 3.2 so users understand what AI gets out of it.
 */
const PHOTO_GUIDANCE: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "Full photo of the item",
    description:
      "Show the whole item from the side — helps us recognize what it is.",
  },
  {
    title: "Brand/model label close-up",
    description:
      "A clear shot of any brand or model label helps us identify the exact item.",
  },
  {
    title: "Accessories included",
    description:
      "Batteries, chargers, attachments, parts — anything that comes with it.",
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
  processingFileCount = 0,
}: InstructionsViewProps) {
  const isProcessingFiles = processingFileCount > 0;
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (filelist: FileList | null) => {
    if (!filelist || filelist.length === 0) return;
    onAddFiles(Array.from(filelist));
  };

  const canGenerate = staged.length > 0 && !isProcessingFiles;
  const isAtLimit = staged.length >= MAX_AI_PHOTOS;

  return (
    <motion.div
      className="flex flex-col gap-4"
      data-testid="ai-modal-instructions"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fieldVariants}>
        <p className="text-sm font-medium">Add 3–5 photos of your item</p>
        <p className="text-muted-foreground text-xs">
          Different angles help us draft a more accurate listing.
        </p>
      </motion.div>

      <motion.ul
        className="bg-muted/40 grid gap-2 rounded-md p-3 text-xs"
        variants={fieldVariants}
      >
        {PHOTO_GUIDANCE.map((g) => (
          <li key={g.title} className="flex flex-col">
            <span className="font-medium">{g.title}</span>
            <span className="text-muted-foreground">{g.description}</span>
          </li>
        ))}
      </motion.ul>

      {staged.length > 0 && (
        <motion.ul
          className="grid grid-cols-3 gap-2"
          data-testid="ai-modal-staged-photos"
          variants={fieldVariants}
        >
          <AnimatePresence initial={false}>
            {staged.map((photo) => (
              <motion.li
                key={photo.id}
                layout
                variants={photoTileVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
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
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      {isProcessingFiles && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className="bg-ai-light border-ai/30 text-ai flex items-center gap-3 rounded-md border px-3 py-2.5"
          data-testid="ai-modal-processing-files"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {processingFileCount === 1
                ? "Processing 1 photo…"
                : `Processing ${processingFileCount} photos…`}
            </span>
            <span className="text-ai/70 text-xs">
              HEIC photos can take a few seconds to convert.
            </span>
          </div>
        </motion.div>
      )}

      <motion.div
        className="flex flex-col gap-2 sm:flex-row"
        variants={fieldVariants}
      >
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
        <motion.div className="flex-1" {...buttonInteraction}>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFiles || isAtLimit}
            data-testid="ai-modal-add-photos"
          >
            <Plus className="size-4" />
            {staged.length === 0 ? "Add photos" : "Add more"}
          </Button>
        </motion.div>
        <motion.div className="flex-1 sm:flex-none" {...buttonInteraction}>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessingFiles || isAtLimit}
            data-testid="ai-modal-take-photo"
          >
            <Camera className="size-4" />
            <span className="sm:hidden">Camera</span>
            <span className="hidden sm:inline">Take photo</span>
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"
        variants={fieldVariants}
      >
        <motion.div {...buttonInteraction}>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            data-testid="ai-modal-cancel"
          >
            Cancel
          </Button>
        </motion.div>
        <motion.div className="w-full sm:w-auto" {...buttonInteraction}>
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="bg-ai-light text-ai border-ai/30 hover:bg-ai-light hover:text-ai w-full hover:brightness-95 sm:w-auto"
            data-testid="ai-modal-generate"
          >
            <Sparkles className="size-4" />
            Generate Listing Draft
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
