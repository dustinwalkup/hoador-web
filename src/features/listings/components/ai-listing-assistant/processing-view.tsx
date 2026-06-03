import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { type AiDraft } from "@/features/listings/ai-listing-assistant/types";

import { type SimulatedStep } from "./use-simulated-steps";

/**
 * Perceived-progress script. Real generation is a single gpt-4o call —
 * these steps are a timed animation that maps to plausible work
 * happening server-side (Req 6.2). Copy avoids AI/inference jargon
 * per Req 6.3.
 */
export const PROCESSING_STEPS: ReadonlyArray<SimulatedStep> = [
  { id: "analyze", label: "Analyzing photos", minMs: 600 },
  { id: "identify", label: "Identifying brand and model", minMs: 1200 },
  { id: "specs", label: "Reviewing visible specifications", minMs: 1200 },
  { id: "draft", label: "Drafting title and description", minMs: 1500 },
  { id: "prepare", label: "Preparing your listing draft", minMs: 800 },
];

interface ProcessingViewProps {
  /** Driven by `useSimulatedSteps` in the modal composer. */
  currentStepIndex: number;
  /** When non-null, render evidence callouts about what AI confidently produced. */
  evidenceDraft: AiDraft | null;
}

export function ProcessingView({
  currentStepIndex,
  evidenceDraft,
}: ProcessingViewProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="ai-modal-processing">
      <div>
        <p className="text-sm font-medium">Drafting your listing</p>
        <p
          className="text-muted-foreground text-xs"
          data-testid="ai-modal-processing-expectation"
        >
          This usually takes less than 10 seconds.
        </p>
      </div>

      <ol className="flex flex-col gap-2">
        {PROCESSING_STEPS.map((step, idx) => {
          const status: "done" | "active" | "pending" =
            idx < currentStepIndex
              ? "done"
              : idx === currentStepIndex
                ? "active"
                : "pending";
          return (
            <li
              key={step.id}
              data-testid={`ai-modal-step-${step.id}`}
              data-status={status}
              className="flex items-center gap-2 text-sm"
            >
              <span className="size-4 shrink-0">
                {status === "done" && (
                  <CheckCircle2 className="text-primary size-4" />
                )}
                {status === "active" && (
                  <Loader2 className="text-primary size-4 animate-spin" />
                )}
                {status === "pending" && (
                  <span className="border-muted-foreground/40 block size-3 rounded-full border" />
                )}
              </span>
              <span
                className={cn(
                  status === "pending" && "text-muted-foreground",
                  status === "done" && "text-muted-foreground line-through",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {evidenceDraft && <EvidenceCallouts draft={evidenceDraft} />}
    </div>
  );
}

/**
 * Evidence callouts shown briefly between generation success and modal close
 * (Req 6.5). Each callout corresponds to a field the AI confidently produced;
 * if AI couldn't extract a given field the callout is omitted entirely —
 * we never imply we know something we don't.
 */
function EvidenceCallouts({ draft }: { draft: AiDraft }) {
  const callouts: { id: string; text: string }[] = [];
  if (draft.categoryId) {
    callouts.push({
      id: "category",
      text: "We identified a likely category",
    });
  }
  if (draft.brand) {
    callouts.push({
      id: "brand",
      text: "We picked up the brand from your photos",
    });
  }
  if (draft.model) {
    callouts.push({
      id: "model",
      text: "We found a visible model number",
    });
  }
  if (Object.keys(draft.specifications).length > 0) {
    callouts.push({
      id: "specs",
      text: "We pulled specifications from the label",
    });
  }

  if (callouts.length === 0) return null;

  return (
    <ul
      className="border-primary/40 bg-primary/5 flex flex-col gap-1 rounded-md border p-3 text-xs"
      data-testid="ai-modal-evidence-callouts"
    >
      {callouts.map((c) => (
        <li
          key={c.id}
          className="flex items-center gap-2"
          data-testid={`ai-modal-evidence-${c.id}`}
        >
          <Sparkles className="text-primary size-3" />
          {c.text}
        </li>
      ))}
    </ul>
  );
}
