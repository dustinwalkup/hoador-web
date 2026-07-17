import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MobileConnectBounce } from "../mobile-connect-bounce";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4
 */

describe("MobileConnectBounce", () => {
  let assignedHref: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    assignedHref = undefined;
    // happy-dom's window.location.href is not writable; intercept the assignment.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(v: string) {
          assignedHref = v;
        },
        get href() {
          return assignedHref ?? "";
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("forwards to the deep link immediately on mount", () => {
    render(
      <MobileConnectBounce
        deepLink="hoador://connect/return"
        heading="Returning…"
        description="desc"
      />,
    );

    // The app hand-off must not wait on the fallback timer.
    expect(assignedHref).toBe("hoador://connect/return");
  });

  it("reveals a tap-through link only after the automatic open fails to take", () => {
    render(
      <MobileConnectBounce
        deepLink="hoador://connect/return"
        heading="Returning…"
        description="desc"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "hoador://connect/return");
  });
});
