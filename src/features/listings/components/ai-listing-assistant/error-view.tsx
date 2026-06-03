import { AlertTriangle, Plus, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type AiFailureReason } from "@/features/listings/ai-listing-assistant/types";

interface ErrorViewProps {
  reason: AiFailureReason;
  onTryAgain: () => void;
  onAddMorePhotos: () => void;
  onContinueManually: () => void;
}

/**
 * User-facing copy keyed by failure reason. We never expose technical detail
 * (no provider names, status codes, "inference" jargon) per Req 6.3 / 9.1.
 */
const COPY: Record<AiFailureReason, { title: string; description: string }> = {
  low_confidence: {
    title: "We couldn't confidently identify this item",
    description:
      "Try adding a clearer photo of any brand or model label, or the whole item from the front.",
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

export function ErrorView({
  reason,
  onTryAgain,
  onAddMorePhotos,
  onContinueManually,
}: ErrorViewProps) {
  const copy = COPY[reason];
  const offerRetry = reason !== "rate_limited";
  const offerAddPhotos = reason === "low_confidence";

  return (
    <div className="flex flex-col gap-4" data-testid="ai-modal-error">
      <div className="flex items-start gap-3">
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
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {offerAddPhotos && (
          <Button
            type="button"
            variant="outline"
            onClick={onAddMorePhotos}
            data-testid="ai-modal-error-add-photos"
          >
            <Plus className="size-4" />
            Add more photos
          </Button>
        )}
        {offerRetry && (
          <Button
            type="button"
            variant="outline"
            onClick={onTryAgain}
            data-testid="ai-modal-error-retry"
          >
            <RotateCw className="size-4" />
            Try again
          </Button>
        )}
        <Button
          type="button"
          onClick={onContinueManually}
          data-testid="ai-modal-error-continue-manually"
        >
          Continue manually
        </Button>
      </div>
    </div>
  );
}
