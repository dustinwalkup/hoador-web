import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type SimulatedStep, useSimulatedSteps } from "../use-simulated-steps";

// React 19 + vitest fake timers don't process multiple timer-driven setState
// rounds in a single sweep — the effect that schedules the next timer runs
// AFTER advanceTimersByTimeAsync returns. Walk through one step per call.
async function tickThroughTo(
  targetIndex: number,
  result: { current: { currentStepIndex: number } },
) {
  while (result.current.currentStepIndex < targetIndex) {
    const currentMs = STEPS[result.current.currentStepIndex].minMs;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(currentMs);
    });
  }
}

const STEPS: SimulatedStep[] = [
  { id: "s1", label: "Analyzing photos…", minMs: 600 },
  { id: "s2", label: "Identifying brand and model", minMs: 1200 },
  { id: "s3", label: "Reviewing visible specifications", minMs: 1200 },
  { id: "s4", label: "Drafting title and description", minMs: 1500 },
  { id: "s5", label: "Preparing your listing draft", minMs: 800 },
];

describe("useSimulatedSteps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at step 0 with no completed steps", () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.isFinalized).toBe(false);
  });

  it("advances linearly, waiting each step's minMs", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));

    expect(result.current.currentStepIndex).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[0].minMs);
    });
    expect(result.current.currentStepIndex).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[1].minMs);
    });
    expect(result.current.currentStepIndex).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[2].minMs);
    });
    expect(result.current.currentStepIndex).toBe(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[3].minMs);
    });
    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.completedSteps).toEqual(STEPS.slice(0, 4));
  });

  it("does not auto-advance past the last step (holds when promise outlives script)", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));

    await tickThroughTo(4, result);
    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.isFinalized).toBe(false);

    // Even after a long wait, no auto-finalize.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.isFinalized).toBe(false);
  });

  it("does not advance when active is false", async () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useSimulatedSteps(active, STEPS),
      { initialProps: { active: false } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.currentStepIndex).toBe(0);

    rerender({ active: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[0].minMs);
    });
    expect(result.current.currentStepIndex).toBe(1);
  });

  it("resets state when active flips back to false", async () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useSimulatedSteps(active, STEPS),
      { initialProps: { active: true } },
    );

    await tickThroughTo(2, result);
    expect(result.current.currentStepIndex).toBe(2);

    rerender({ active: false });
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.isFinalized).toBe(false);
  });

  it("finalize() fast-forwards to the last step and flips isFinalized after the 400ms grace", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));

    await tickThroughTo(3, result);
    expect(result.current.currentStepIndex).toBe(3);
    expect(result.current.isFinalized).toBe(false);

    // Finalize from step 3 → jumps to step 4 (last).
    act(() => {
      result.current.finalize();
    });
    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.isFinalized).toBe(false);

    // 399ms in — still not finalized.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(result.current.isFinalized).toBe(false);

    // 400ms exactly → grace elapsed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.isFinalized).toBe(true);
    expect(result.current.currentStepIndex).toBe(4);
  });

  it("finalize() called when already on the last step still waits the 400ms grace", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));

    await tickThroughTo(4, result);
    expect(result.current.currentStepIndex).toBe(4);

    act(() => {
      result.current.finalize();
    });
    expect(result.current.isFinalized).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.isFinalized).toBe(true);
  });

  it("clears the pending tick when finalize is called early so the script doesn't re-advance", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));

    // Mid-step 0 (300ms < 600ms minMs).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.currentStepIndex).toBe(0);

    act(() => {
      result.current.finalize();
    });
    expect(result.current.currentStepIndex).toBe(4);

    // The cancelled tick must not fire and pull us back from step 4.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.isFinalized).toBe(true);
  });

  it("completedSteps is exclusive of the current step", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, STEPS));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[0].minMs);
    });
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.completedSteps).toEqual([STEPS[0]]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEPS[1].minMs);
    });
    expect(result.current.completedSteps).toEqual([STEPS[0], STEPS[1]]);
  });

  it("handles an empty steps array without throwing", async () => {
    const { result } = renderHook(() => useSimulatedSteps(true, []));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.completedSteps).toEqual([]);

    act(() => {
      result.current.finalize();
    });
    expect(result.current.isFinalized).toBe(true);
  });
});
