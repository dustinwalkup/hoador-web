import { useState, useEffect } from "react";
import { usePageHeaderContext } from "@/contexts/page-header-context";

/**
 * Return value interface for usePageHeaderScroll hook.
 */
export interface UsePageHeaderScrollReturn {
  /**
   * Current title from the PageHeader component.
   * null if no PageHeader is set.
   */
  title: string | null;

  /**
   * Whether the PageHeader is currently visible in the viewport.
   * true when PageHeader intersects with or is above the site header position.
   */
  isPageHeaderVisible: boolean;

  /**
   * Whether the site header label should be displayed.
   * Inverse of isPageHeaderVisible - true when PageHeader is scrolled out of view.
   */
  shouldShowLabel: boolean;
}

/**
 * Custom hook that uses Intersection Observer to detect when PageHeader
 * scrolls out of view. Returns title and visibility state for use in
 * SiteHeaderLabel component.
 *
 * Uses rootMargin to account for site header height (48px / 3rem) so that
 * the label appears when PageHeader's top edge reaches or passes the site
 * header's bottom edge.
 *
 * @returns Object containing title, visibility state, and label display flag
 */
export function usePageHeaderScroll(): UsePageHeaderScrollReturn {
  const context = usePageHeaderContext();

  // Get PageHeader ref and title directly from context
  const pageHeaderRef = context?.ref || null;
  const title = context?.title || null;

  // Initialize state to true (assuming visible until observer updates)
  // Observer callback will update this asynchronously when intersection changes
  const [isPageHeaderVisible, setIsPageHeaderVisible] = useState(true);

  // Track whether observer has fired at least once with stable layout data
  const [hasObserverFired, setHasObserverFired] = useState(false);

  useEffect(() => {
    // If no context or no PageHeader, no observer needed
    if (!context || !pageHeaderRef) {
      return;
    }

    const element = pageHeaderRef.current;
    if (!element) {
      return;
    }

    let observer: IntersectionObserver | null = null;
    let rafId2: number | null = null;

    // Double RAF to ensure layout is truly stable before observing
    // First RAF waits for current frame, second RAF waits for next paint
    // This prevents flicker caused by incorrect intersection calculations
    // during hydration or initial layout
    const rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        // Intersection Observer configuration
        // rootMargin: '-96px 0px 0px 0px' accounts for site header height
        // threshold: 0 triggers when any part of the element crosses the threshold
        observer = new IntersectionObserver(
          ([entry]) => {
            // entry.isIntersecting is true when PageHeader is visible above the site header
            // false when it has scrolled past the site header
            setIsPageHeaderVisible(entry.isIntersecting);
            setHasObserverFired(true);
          },
          {
            root: null, // viewport
            rootMargin: "-96px 0px 0px 0px", // Account for site header height
            threshold: 0, // Trigger when any part crosses threshold
          },
        );

        observer.observe(element);
      });
    });

    // Cleanup: cancel RAFs, disconnect observer, and reset state on unmount/ref change
    return () => {
      cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
      observer?.disconnect();
      // Reset hasObserverFired so new PageHeader doesn't inherit old state
      setHasObserverFired(false);
    };
  }, [context, pageHeaderRef]);

  // Only show label if observer has confirmed visibility state AND element is not visible
  // This prevents flicker on initial load before observer has stable data
  const shouldShowLabel = hasObserverFired && !isPageHeaderVisible;

  return {
    title,
    isPageHeaderVisible,
    shouldShowLabel,
  };
}
