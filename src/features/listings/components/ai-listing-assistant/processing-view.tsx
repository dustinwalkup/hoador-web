"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { containerVariants, fieldVariants } from "@/lib/animations/variants";
import { type AiDraft } from "@/features/listings/ai-listing-assistant/types";

import { type SimulatedStep } from "./use-simulated-steps";

interface ProcessingStep extends SimulatedStep {
  /** Short label shown on the chip that floats up when this step completes. */
  chip: string;
}

/**
 * Perceived-progress script. Real generation is a single gpt-4o call —
 * these steps are a timed animation that maps to plausible work
 * happening server-side (Req 6.2). Copy avoids AI/inference jargon
 * per Req 6.3.
 */
export const PROCESSING_STEPS: ReadonlyArray<ProcessingStep> = [
  {
    id: "analyze",
    label: "Analyzing photos",
    minMs: 1100,
    chip: "Reading photos",
  },
  {
    id: "identify",
    label: "Identifying brand and model",
    minMs: 1600,
    chip: "Spotting the brand",
  },
  {
    id: "specs",
    label: "Reviewing visible specifications",
    minMs: 1600,
    chip: "Checking specs",
  },
  {
    id: "draft",
    label: "Drafting title and description",
    minMs: 1500,
    chip: "Writing the title",
  },
  {
    id: "prepare",
    label: "Preparing your listing draft",
    minMs: 800,
    chip: "Assembling draft",
  },
];

const RING_DIAMETER = 128;
const RING_STROKE = 3;
const RING_RADIUS = (RING_DIAMETER - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const CHIP_LIFETIME_MS = 2400;

interface ProcessingViewProps {
  /** Driven by `useSimulatedSteps` in the modal composer. */
  currentStepIndex: number;
  /** When non-null, render evidence callouts about what AI confidently produced. */
  evidenceDraft: AiDraft | null;
}

interface FloatingChip {
  uid: number;
  stepId: string;
  label: string;
}

export function ProcessingView({
  currentStepIndex,
  evidenceDraft,
}: ProcessingViewProps) {
  const totalSteps = PROCESSING_STEPS.length;
  const safeIndex = Math.min(Math.max(currentStepIndex, 0), totalSteps - 1);
  const currentStep = PROCESSING_STEPS[safeIndex];
  const progress = Math.min(currentStepIndex, totalSteps) / totalSteps;
  const dashoffset = RING_CIRCUMFERENCE * (1 - progress);

  // Spawn a chip each time a step completes. We adjust state during render
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than in an effect, so the chip is added in the same commit that
  // reflects the new step index. Each chip's lifetime is managed by a
  // ref-tracked timeout so we don't double-arm on re-renders.
  const [chips, setChips] = useState<FloatingChip[]>([]);
  const [prevStepIndex, setPrevStepIndex] = useState(currentStepIndex);
  if (currentStepIndex !== prevStepIndex) {
    setPrevStepIndex(currentStepIndex);
    if (currentStepIndex > 0) {
      const completed = PROCESSING_STEPS[currentStepIndex - 1];
      if (completed) {
        // uid keys the chip in AnimatePresence and identifies it for removal.
        // currentStepIndex is monotonic within one run, so it's stably unique.
        setChips((prev) => [
          ...prev,
          {
            uid: currentStepIndex,
            stepId: completed.id,
            label: completed.chip,
          },
        ]);
      }
    }
  }

  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  useEffect(() => {
    for (const chip of chips) {
      if (timersRef.current.has(chip.uid)) continue;
      const { uid } = chip;
      const timer = setTimeout(() => {
        timersRef.current.delete(uid);
        setChips((prev) => prev.filter((c) => c.uid !== uid));
      }, CHIP_LIFETIME_MS);
      timersRef.current.set(uid, timer);
    }
  }, [chips]);
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center gap-8"
      data-testid="ai-modal-processing"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.p
        className="text-muted-foreground text-center text-xs"
        data-testid="ai-modal-processing-expectation"
        variants={fieldVariants}
      >
        This usually takes less than 10 seconds.
      </motion.p>

      <motion.div
        className="relative flex h-44 w-full items-center justify-center"
        variants={fieldVariants}
        aria-hidden="true"
      >
        {/* Chip launch zone — chips float briefly in the space above the orb,
            constrained so they never reach the subtitle above the container. */}
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <AnimatePresence>
            {chips.map((chip) => (
              <motion.span
                key={chip.uid}
                data-testid={`ai-modal-chip-${chip.stepId}`}
                initial={{ opacity: 0, y: 16, scale: 0.85 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [16, -8, -36, -56],
                  scale: 1,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: CHIP_LIFETIME_MS / 1000,
                  ease: "easeOut",
                  times: [0, 0.15, 0.65, 1],
                }}
                className="bg-ai-light text-ai border-ai/30 absolute rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap shadow-sm"
              >
                {chip.label}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        <svg
          width={RING_DIAMETER}
          height={RING_DIAMETER}
          viewBox={`0 0 ${RING_DIAMETER} ${RING_DIAMETER}`}
          className="absolute -rotate-90"
        >
          <circle
            cx={RING_DIAMETER / 2}
            cy={RING_DIAMETER / 2}
            r={RING_RADIUS}
            className="stroke-ai/15 fill-none"
            strokeWidth={RING_STROKE}
          />
          <motion.circle
            cx={RING_DIAMETER / 2}
            cy={RING_DIAMETER / 2}
            r={RING_RADIUS}
            className="stroke-ai fill-none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            animate={{ strokeDashoffset: dashoffset }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>

        <motion.div
          className="bg-ai-light text-ai border-ai/40 relative flex size-20 items-center justify-center rounded-full border"
          animate={{
            scale: [1, 1.06, 1],
            boxShadow: [
              "0 0 22px -6px rgba(109,40,217,0.35)",
              "0 0 38px -2px rgba(109,40,217,0.6)",
              "0 0 22px -6px rgba(109,40,217,0.35)",
            ],
          }}
          transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
        >
          <motion.div
            animate={{ rotate: [0, 12, -8, 0] }}
            transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          >
            <Sparkles className="size-8" />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        className="flex h-5 items-center justify-center"
        variants={fieldVariants}
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-sm"
          >
            {currentStep.label}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      {/*
        Screen-reader-only semantic step list. The visible UI is the orb /
        ring / chips above; this list gives assistive tech a stable, ordered
        progress signal and gives integration tests a place to assert against
        the abstract done/active/pending state.
      */}
      <ol className="sr-only" aria-label="Processing steps" aria-live="polite">
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
            >
              {step.label}
            </li>
          );
        })}
      </ol>

      <AnimatePresence>
        {evidenceDraft && (
          <EvidenceCallouts key="evidence" draft={evidenceDraft} />
        )}
      </AnimatePresence>
    </motion.div>
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
    <motion.ul
      className="border-ai/30 bg-ai-light text-ai flex w-full flex-col gap-1 rounded-md border p-3 text-xs"
      data-testid="ai-modal-evidence-callouts"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
    >
      {callouts.map((c) => (
        <motion.li
          key={c.id}
          className="flex items-center gap-2"
          data-testid={`ai-modal-evidence-${c.id}`}
          variants={fieldVariants}
        >
          <Sparkles className="size-3" />
          {c.text}
        </motion.li>
      ))}
    </motion.ul>
  );
}
