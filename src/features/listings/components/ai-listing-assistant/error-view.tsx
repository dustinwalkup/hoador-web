"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Plus, RotateCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { containerVariants, fieldVariants } from "@/lib/animations/variants";
import {
  type AiFailureReason,
  type StagedPhoto,
} from "@/features/listings/ai-listing-assistant/types";

interface ErrorViewProps {
  reason: AiFailureReason;
  staged: StagedPhoto[];
  onRemovePhoto: (id: string) => void;
  onTryAgain: () => void;
  onAddMorePhotos: () => void;
  onContinueManually: () => void;
}

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
 * User-facing copy keyed by failure reason. We never expose technical detail
 * (no provider names, status codes, "inference" jargon) per Req 6.3 / 9.1.
 *
 * `unsuitable_content` is distinct from `low_confidence`: the model
 * affirmatively refused (e.g. the photo was a map, screenshot, or unsafe
 * image), so the copy steers the user toward changing the input rather
 * than retrying the same set.
 */
const COPY: Record<AiFailureReason, { title: string; description: string }> = {
  low_confidence: {
    title: "We couldn't confidently identify this item",
    description:
      "Try adding a clearer photo of any brand or model label, or the whole item from the front.",
  },
  unsuitable_content: {
    title: "These photos don't look like a listable item",
    description:
      "Remove any photos that aren't of the item you want to list, then generate again.",
  },
  network: {
    title: "We couldn't reach the drafting service",
    description:
      "Check your connection and try again. Your photos are still here.",
  },
  rate_limited: {
    title: "You've hit today's drafting limit",
    description:
      "You can still create your listing manually — your photos will carry over.",
  },
  server: {
    title: "Something went wrong drafting your listing",
    description:
      "Try again, or continue manually — your photos will carry over.",
  },
};

/**
 * Failure reasons where the *photos* are likely the cause, so we show them
 * inline with remove affordances. Network/server/rate-limit aren't about
 * the photos — showing them there would just add noise.
 */
const PHOTO_RELATED_REASONS: ReadonlySet<AiFailureReason> = new Set([
  "low_confidence",
  "unsuitable_content",
]);

export function ErrorView({
  reason,
  staged,
  onRemovePhoto,
  onTryAgain,
  onAddMorePhotos,
  onContinueManually,
}: ErrorViewProps) {
  const copy = COPY[reason];
  const offerRetry = reason !== "rate_limited";
  // "Add more photos" is only meaningful when the photos themselves are the
  // likely cause — a rate-limited or network failure isn't fixed by changing
  // photos, so we'd just be misleading the user.
  const offerAddPhotos = PHOTO_RELATED_REASONS.has(reason);
  const showPhotos = PHOTO_RELATED_REASONS.has(reason) && staged.length > 0;
  // "Generate again" only makes sense when there's something to analyze.
  // If the user removes the last staged photo, they should use "Add more
  // photos" to go back to instructions and re-upload.
  const canRetry = staged.length > 0;
  const retryLabel = showPhotos ? "Generate again" : "Try again";

  return (
    <motion.div
      className="flex flex-col gap-4"
      data-testid="ai-modal-error"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="flex items-start gap-3" variants={fieldVariants}>
        <span className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-full">
          <AlertTriangle className="size-4" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium" data-testid="ai-modal-error-title">
            {copy.title}
          </p>
          <p
            className="text-muted-foreground text-xs"
            data-testid="ai-modal-error-description"
          >
            {copy.description}
          </p>
        </div>
      </motion.div>

      {showPhotos && (
        <motion.ul
          className="grid grid-cols-3 gap-2"
          data-testid="ai-modal-error-photos"
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
                  data-testid={`ai-modal-error-remove-photo-${photo.id}`}
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <motion.div
        className="flex flex-col gap-2 sm:flex-row sm:justify-end"
        variants={fieldVariants}
      >
        {offerAddPhotos && (
          <motion.div {...buttonInteraction}>
            <Button
              type="button"
              variant="outline"
              onClick={onAddMorePhotos}
              data-testid="ai-modal-error-add-photos"
            >
              <Plus className="size-4" />
              Add more photos
            </Button>
          </motion.div>
        )}
        {offerRetry && (
          <motion.div {...buttonInteraction}>
            <Button
              type="button"
              variant="outline"
              onClick={onTryAgain}
              disabled={!canRetry}
              data-testid="ai-modal-error-retry"
            >
              <RotateCw className="size-4" />
              {retryLabel}
            </Button>
          </motion.div>
        )}
        <motion.div {...buttonInteraction}>
          <Button
            type="button"
            onClick={onContinueManually}
            data-testid="ai-modal-error-continue-manually"
          >
            Continue manually
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
