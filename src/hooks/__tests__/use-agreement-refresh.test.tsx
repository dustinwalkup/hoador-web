import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import {
  AGREEMENT_REFRESH_INTERVAL_MS,
  useAgreementRefresh,
} from "../use-agreement-refresh";

/**
 * Flow 6: the agreement PDF is generated after the accept returns and lands a
 * few seconds later. The detail pages are server-rendered, so nothing picked
 * it up until a reload. For a short window after acceptance the page refreshes
 * itself until the agreement is there.
 */
describe("useAgreementRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T20:29:00Z"));
    mockRefresh.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const acceptedAt = "2026-10-24T20:28:54Z";

  it("is preparing, and refreshes, just after acceptance", () => {
    const { result } = renderHook(() =>
      useAgreementRefresh({ acceptedAt, ready: false }),
    );

    expect(result.current.preparing).toBe(true);
    vi.advanceTimersByTime(AGREEMENT_REFRESH_INTERVAL_MS * 2);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("stops once the window has passed", () => {
    renderHook(() => useAgreementRefresh({ acceptedAt, ready: false }));

    vi.advanceTimersByTime(120_000);
    const calls = mockRefresh.mock.calls.length;
    vi.advanceTimersByTime(30_000);

    expect(mockRefresh.mock.calls.length).toBe(calls);
    expect(calls).toBeLessThanOrEqual(30);
  });

  it("does nothing once the agreement is ready, or before acceptance", () => {
    const ready = renderHook(() =>
      useAgreementRefresh({ acceptedAt, ready: true }),
    );
    const never = renderHook(() =>
      useAgreementRefresh({ acceptedAt: null, ready: false }),
    );

    vi.advanceTimersByTime(10_000);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(ready.result.current.preparing).toBe(false);
    expect(never.result.current.preparing).toBe(false);
  });
});
