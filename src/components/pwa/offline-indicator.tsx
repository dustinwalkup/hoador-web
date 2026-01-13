/**
 * Offline Indicator Component
 *
 * Displays a visual indicator when the device is offline. Shows smooth
 * animations when transitioning between online and offline states.
 * Uses shadcn/ui components for consistent styling.
 */

"use client";

import { WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNetworkStatus } from "@/lib/pwa/network-status";
import { cn } from "@/lib/utils";
import { useEffect, useState, startTransition } from "react";

/**
 * Offline Indicator Component Props
 */
export interface OfflineIndicatorProps {
  /** Position of the indicator (top or bottom) */
  position?: "top" | "bottom";
  /** Custom className */
  className?: string;
  /** Whether to show the indicator when offline (default: true) */
  showWhenOffline?: boolean;
  /** Whether to show a brief message when coming back online (default: true) */
  showOnlineMessage?: boolean;
}

/**
 * Offline Indicator Component
 *
 * Displays a visual indicator when the device is offline. Shows smooth
 * animations when transitioning between online and offline states.
 *
 * @param props - Component props
 */
export function OfflineIndicator({
  position = "top",
  className,
  showWhenOffline = true,
  showOnlineMessage = true,
}: OfflineIndicatorProps) {
  const { isOffline, justCameOnline, justWentOffline } = useNetworkStatus();
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  // Show online message briefly when coming back online
  useEffect(() => {
    if (justCameOnline && showOnlineMessage) {
      startTransition(() => {
        setShowOnlineToast(true);
      });

      const timer = setTimeout(() => {
        startTransition(() => {
          setShowOnlineToast(false);
        });
      }, 3000); // Show for 3 seconds

      return () => clearTimeout(timer);
    }
  }, [justCameOnline, showOnlineMessage]);

  // Don't render if online and not showing online message
  if (!isOffline && !showOnlineToast) {
    return null;
  }

  // Render offline indicator
  if (isOffline && showWhenOffline) {
    return (
      <div
        className={cn(
          "fixed right-0 left-0 z-50 mx-auto max-w-7xl px-4 transition-all duration-300",
          position === "top" ? "top-0 pt-4" : "bottom-0 pb-4",
          justWentOffline
            ? "translate-y-0 opacity-100"
            : position === "top"
              ? "-translate-y-full opacity-0"
              : "translate-y-full opacity-0",
          className,
        )}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Alert variant="destructive" className="shadow-lg">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You&apos;re offline. Some features may not be available.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render online message
  if (showOnlineToast && showOnlineMessage) {
    return (
      <div
        className={cn(
          "fixed right-0 left-0 z-50 mx-auto max-w-7xl px-4 transition-all duration-300",
          position === "top" ? "top-0 pt-4" : "bottom-0 pb-4",
          justCameOnline
            ? "translate-y-0 opacity-100"
            : position === "top"
              ? "-translate-y-full opacity-0"
              : "translate-y-full opacity-0",
          className,
        )}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Alert
          variant="default"
          className="border-green-200 bg-green-50 text-green-800 shadow-lg dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          <Wifi className="h-4 w-4" />
          <AlertDescription>You&apos;re back online!</AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}
