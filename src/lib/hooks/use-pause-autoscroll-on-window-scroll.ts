"use client";

import * as React from "react";

import type { CarouselApi } from "@/components/ui/carousel";

type AutoScrollPluginApi = {
  stop: () => void;
  play: (delay?: number) => void;
};

function getAutoScrollPlugin(
  api: CarouselApi | undefined,
): AutoScrollPluginApi | undefined {
  if (!api) return undefined;
  const plugins = api.plugins() as { autoScroll?: AutoScrollPluginApi };
  return plugins.autoScroll;
}

const RESUME_DELAY_MS = 220;

/**
 * Pauses Embla `auto-scroll` while the window is scrolling so horizontal motion
 * does not fight vertical page scroll (reduces visible jitter on trackpad/touch).
 *
 * @param api - Embla carousel API from `setApi`; no-op if missing or no auto-scroll plugin
 */
export function usePauseAutoscrollOnWindowScroll(
  api: CarouselApi | undefined,
): void {
  React.useEffect(() => {
    const autoScroll = getAutoScrollPlugin(api);
    if (!autoScroll) return;

    let resumeTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let pausedForGesture = false;

    const onWindowScroll = () => {
      if (!pausedForGesture) {
        pausedForGesture = true;
        autoScroll.stop();
      }
      if (resumeTimeoutId) clearTimeout(resumeTimeoutId);
      resumeTimeoutId = setTimeout(() => {
        pausedForGesture = false;
        autoScroll.play(0);
      }, RESUME_DELAY_MS);
    };

    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
      if (resumeTimeoutId) clearTimeout(resumeTimeoutId);
    };
  }, [api]);
}
