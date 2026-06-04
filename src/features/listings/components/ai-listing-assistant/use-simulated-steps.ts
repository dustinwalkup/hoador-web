import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drives the perceived-progress step ticker for the AI processing modal.
 *
 * Advances `currentStepIndex` on a timer respecting each step's `minMs`.
 * When `finalize()` is called (the network promise resolved):
 *   - jumps to the last step,
 *   - waits a 400 ms grace before flipping `isFinalized` to true so the user
 *     visibly sees the final step rather than a jarring instant complete.
 *
 * When the underlying promise outlives the script, the hook holds on the
 * last step indefinitely (no auto-finalize), so progress stays honest.
 *
 * Reference: `2-design.md` §Components/§4.
 */
export interface SimulatedStep {
  id: string;
  label: string;
  minMs: number;
}

export interface UseSimulatedStepsResult<S extends SimulatedStep> {
  currentStepIndex: number;
  completedSteps: readonly S[];
  isFinalized: boolean;
  finalize: () => void;
}

const FINALIZE_GRACE_MS = 400;

export function useSimulatedSteps<S extends SimulatedStep>(
  active: boolean,
  steps: readonly S[],
): UseSimulatedStepsResult<S> {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const tickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset visible state during render when `active` flips off — React handles
  // this efficiently (no extra commit) and avoids the cascading-render anti-
  // pattern of setState-in-effect.
  // https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active) {
      setCurrentStepIndex(0);
      setIsFinalized(false);
    }
  }

  // Tick advancement: each render where active is true and we're not on the
  // last step schedules the next advance after the current step's minMs.
  useEffect(() => {
    if (!active) return;
    if (steps.length === 0) return;
    if (currentStepIndex >= steps.length - 1) return;

    const ms = steps[currentStepIndex].minMs;
    const handle = setTimeout(() => {
      setCurrentStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, ms);
    tickTimeoutRef.current = handle;

    return () => {
      clearTimeout(handle);
      if (tickTimeoutRef.current === handle) {
        tickTimeoutRef.current = null;
      }
    };
  }, [active, currentStepIndex, steps]);

  // When active flips off, also cancel any pending finalize timeout so it
  // can't fire after the consumer has moved on.
  useEffect(() => {
    if (active) return;
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  }, [active]);

  // Clear remaining timeouts on unmount.
  useEffect(() => {
    return () => {
      if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current);
      if (finalizeTimeoutRef.current) clearTimeout(finalizeTimeoutRef.current);
    };
  }, []);

  const finalize = useCallback(() => {
    if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current);
    tickTimeoutRef.current = null;

    if (steps.length === 0) {
      setIsFinalized(true);
      return;
    }

    setCurrentStepIndex(steps.length - 1);

    if (finalizeTimeoutRef.current) clearTimeout(finalizeTimeoutRef.current);
    finalizeTimeoutRef.current = setTimeout(() => {
      setIsFinalized(true);
    }, FINALIZE_GRACE_MS);
  }, [steps.length]);

  return {
    currentStepIndex,
    completedSteps: steps.slice(0, currentStepIndex),
    isFinalized,
    finalize,
  };
}
