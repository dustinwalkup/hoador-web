"use client";

import { useEffect, useRef } from "react";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function usePwaAutoRefresh(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const lastActiveRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Only run in standalone PWA mode (installed to home screen)
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    if (!isStandalone) return;

    // Initialize timestamp on mount (inside effect, not render)
    if (lastActiveRef.current === undefined) {
      lastActiveRef.current = Date.now();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - (lastActiveRef.current ?? Date.now());
        if (elapsed > timeoutMs) {
          window.location.reload();
        }
      } else {
        lastActiveRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [timeoutMs]);
}
