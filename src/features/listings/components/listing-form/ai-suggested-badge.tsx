import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { type AiPrefilledFieldKey } from "@/features/listings/ai-listing-assistant/types";

import { useAiPrefill } from "./ai-prefill-context";

interface AISuggestedBadgeProps {
  fieldKey: AiPrefilledFieldKey;
}

/**
 * Tiny "AI Suggested" chip rendered next to a field label whose value came
 * from AI prefill. Self-gating: returns `null` outside an `AiPrefillProvider`
 * (manual flow) or when the field is not in the prefilled set, so consumers
 * can call this unconditionally without polluting the manual UI (Req 7.4).
 */
export function AISuggestedBadge({ fieldKey }: AISuggestedBadgeProps) {
  const ctx = useAiPrefill();
  if (!ctx) return null;
  if (!ctx.prefilledFields.has(fieldKey)) return null;

  return (
    <Badge
      variant="outline"
      className="border-ai/30 bg-ai-light text-ai"
      data-testid={`ai-suggested-badge-${fieldKey}`}
    >
      <Sparkles />
      AI Suggested
    </Badge>
  );
}
