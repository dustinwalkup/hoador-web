"use client";

import { useEffect, useRef } from "react";

import { trackViewContent } from "@/lib/analytics/meta";

interface TrackViewContentProps {
  contentId: string;
  contentName: string;
  contentType?: string;
}

/**
 * Fires a Meta ViewContent pixel event once per content id.
 * Embed inside server components to attach analytics without converting
 * the parent page to a client component.
 *
 * Keyed on `contentId` (not once-per-mount) because React reuses the
 * component instance when navigating between two pages on the same route
 * (listing A → listing B) — each listing still gets its own event.
 */
export function TrackViewContent({
  contentId,
  contentName,
  contentType = "product",
}: TrackViewContentProps): null {
  const lastTrackedId = useRef<string | null>(null);

  useEffect(() => {
    if (lastTrackedId.current === contentId) return;
    lastTrackedId.current = contentId;
    trackViewContent({ contentId, contentName, contentType });
  }, [contentId, contentName, contentType]);

  return null;
}
