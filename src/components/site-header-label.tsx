"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { DASHBOARD } from "@/constants/navbar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { usePageHeaderScroll } from "@/hooks/use-page-header-scroll";
import { cn } from "@/lib/utils";

const { mainNav } = DASHBOARD;

/**
 * SiteHeaderLabel component that displays the page title in the site header.
 * Uses scroll-based detection to show PageHeader title when scrolled out of view,
 * or falls back to nav-based label when no PageHeader is registered.
 */
export function SiteHeaderLabel() {
  const pathname = usePathname();
  const { title, shouldShowLabel } = usePageHeaderScroll();

  // Track pathname we've settled for (PageHeader had time to register)
  // This prevents navLabel from flickering before PageHeader registers
  const [settledPathname, setSettledPathname] = useState<string | null>(null);

  // Check for reduced motion preference
  // Use lazy initializer to check media query without calling setState in effect
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check initial preference on mount (safe in client component)
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  // Set settled state after delay, resets automatically when pathname changes
  useEffect(() => {
    const timeout = setTimeout(() => setSettledPathname(pathname), 150);
    return () => clearTimeout(timeout);
  }, [pathname]);

  // Derived state: settled only when settledPathname matches current pathname
  const hasSettled = settledPathname === pathname;

  useEffect(() => {
    // Listen for changes to reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Update state only in event callback (async, safe)
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Fallback to nav-based label when no PageHeader is registered
  const navLabel = mainNav.find((item) => item.url === pathname)?.title;

  // Determine what label to display
  // If PageHeader exists and should show: use PageHeader title
  // If PageHeader exists but shouldn't show: empty
  // If no PageHeader AND settled: use nav-based label
  // If no PageHeader AND not settled: show nothing (wait for potential PageHeader)
  const displayLabel =
    title && shouldShowLabel
      ? title
      : title
        ? null // PageHeader exists but is visible, so label should be empty
        : hasSettled
          ? navLabel // No PageHeader after settling, fall back to nav-based label
          : null; // Still waiting for PageHeader to potentially register

  // Transition duration: 250ms (within 200-300ms requirement)
  // Use instant transition when reduced motion is preferred
  const transitionDuration = prefersReducedMotion ? "0ms" : "250ms";

  return (
    <div className="flex w-full items-center justify-between overflow-visible">
      <h1
        className={cn(
          "text-xl font-medium transition-opacity ease-in-out",
          "truncate", // Handle text overflow with ellipsis for long titles
          displayLabel ? "opacity-100" : "opacity-0",
        )}
        style={{
          transitionDuration,
          willChange: "opacity",
        }}
        title={displayLabel || undefined} // Show full title on hover for truncated text
      >
        {displayLabel || "\u00A0"}
      </h1>
      <NotificationBell />
    </div>
  );
}
