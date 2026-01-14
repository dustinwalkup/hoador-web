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

  useEffect(() => {
    // If no context or no PageHeader, no observer needed
    if (!context || !pageHeaderRef) {
      return;
    }

    const element = pageHeaderRef.current;
    if (!element) {
      return;
    }

    // Intersection Observer configuration
    // rootMargin: '-48px 0px 0px 0px' accounts for site header height (h-12 = 3rem = 48px)
    // threshold: 0 triggers when any part of the element crosses the threshold
    const observer = new IntersectionObserver(
      ([entry]) => {
        // entry.isIntersecting is true when PageHeader is visible above the site header
        // false when it has scrolled past the site header
        // This callback is async, so it's safe to call setState here
        setIsPageHeaderVisible(entry.isIntersecting);
      },
      {
        root: null, // viewport
        rootMargin: "-96px 0px 0px 0px", // Account for site header height
        threshold: 0, // Trigger when any part crosses threshold
      },
    );

    observer.observe(element);

    // Cleanup: disconnect observer on unmount
    return () => {
      observer.disconnect();
    };
  }, [context, pageHeaderRef]);

  // Calculate shouldShowLabel (inverse of isPageHeaderVisible)
  // When PageHeader is visible, label should be hidden (empty)
  // When PageHeader is scrolled out of view, label should be shown
  const shouldShowLabel = !isPageHeaderVisible;

  return {
    title,
    isPageHeaderVisible,
    shouldShowLabel,
  };
}
