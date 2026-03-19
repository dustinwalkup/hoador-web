import { useReducer, useEffect, useRef } from "react";
import { usePageHeaderContext } from "@/contexts/page-header-context";

type ObserverState = {
  isPageHeaderVisible: boolean;
  hasObserverFired: boolean;
};
type ObserverAction =
  | { type: "FIRED"; isIntersecting: boolean }
  | { type: "RESET" };

function observerReducer(
  state: ObserverState,
  action: ObserverAction,
): ObserverState {
  switch (action.type) {
    case "FIRED":
      return {
        isPageHeaderVisible: action.isIntersecting,
        hasObserverFired: true,
      };
    case "RESET":
      return { isPageHeaderVisible: true, hasObserverFired: false };
    default:
      return state;
  }
}

const INITIAL_OBSERVER_STATE: ObserverState = {
  isPageHeaderVisible: true,
  hasObserverFired: false,
};

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

  const [{ isPageHeaderVisible, hasObserverFired }, dispatch] = useReducer(
    observerReducer,
    INITIAL_OBSERVER_STATE,
  );

  // Debounce ref to coalesce rapid observer firings (iOS address bar, rubber-band scroll)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            // Debounce rapid firings caused by iOS address bar show/hide and
            // rubber-band scrolling near the threshold. Each new firing cancels
            // the previous pending dispatch so only the final stable state fires.
            if (debounceRef.current !== null) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              debounceRef.current = null;
              dispatch({ type: "FIRED", isIntersecting: entry.isIntersecting });
            }, 50);
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

    // Cleanup: cancel RAFs, cancel pending debounce, disconnect observer, reset state
    return () => {
      cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      observer?.disconnect();
      dispatch({ type: "RESET" });
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
