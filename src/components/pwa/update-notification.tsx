/**
 * Update Notification Component
 *
 * Displays a banner-style notification when a service worker update is
 * available. Shows an "Update" button to trigger the update and a dismiss
 * button. The update will reload the page after installation.
 */

"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import { RefreshCw, X, Download } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useServiceWorkerUpdate } from "@/lib/pwa/update-manager";
import { isAppInstalled, isMobileDevice } from "@/lib/pwa/install-prompt";
import { cn } from "@/lib/utils";

/**
 * Update Notification Component Props
 */
export interface UpdateNotificationProps {
  /** Position of the notification (top or bottom) */
  position?: "top" | "bottom";
  /** Custom className */
  className?: string;
  /** Whether to automatically check for updates (default: true) */
  autoCheck?: boolean;
  /** Whether to show the component even if dismissed (for testing) */
  forceShow?: boolean;
}

/**
 * Storage key for tracking dismissed update notifications
 */
const DISMISSED_UPDATE_KEY = "pwa-update-notification-dismissed";

/**
 * Check if the update notification was dismissed
 */
function isUpdateDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const dismissed = localStorage.getItem(DISMISSED_UPDATE_KEY);
    return dismissed === "true";
  } catch (error) {
    console.warn("[PWA] Failed to check dismissed status:", error);
    return false;
  }
}

/**
 * Mark the update notification as dismissed
 */
function dismissUpdate(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(DISMISSED_UPDATE_KEY, "true");
  } catch (error) {
    console.warn("[PWA] Failed to save dismissed status:", error);
  }
}

/**
 * Clear the dismissed status (useful when update is installed)
 */
function clearDismissedStatus(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(DISMISSED_UPDATE_KEY);
  } catch (error) {
    console.warn("[PWA] Failed to clear dismissed status:", error);
  }
}

/**
 * Update Notification Component
 *
 * Displays a notification banner when a service worker update is available.
 * Allows users to install the update or dismiss the notification temporarily.
 *
 * @param props - Component props
 */
export function UpdateNotification({
  position = "bottom",
  className,
  autoCheck = true,
  forceShow = false,
}: UpdateNotificationProps) {
  const { updateAvailable, isInstalling, installUpdate } =
    useServiceWorkerUpdate({
      autoCheck,
    });

  const [isDismissed, setIsDismissed] = useState(() => isUpdateDismissed());
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize mobile and installed state directly
  const [isMobile] = useState(() => isMobileDevice());
  const [isInstalled] = useState(() => isAppInstalled());

  // Clear dismissed status when update becomes available
  useEffect(() => {
    if (updateAvailable && isDismissed) {
      clearDismissedStatus();
      startTransition(() => {
        setIsDismissed(false);
      });
    }
  }, [updateAvailable, isDismissed]);

  // Derive visibility
  const isVisible = useMemo(() => {
    // Never show on desktop
    if (!isMobile) {
      return false;
    }

    // Only show if PWA is installed
    if (!isInstalled) {
      return false;
    }

    if (!updateAvailable) {
      return false;
    }

    if (isDismissed && !forceShow) {
      return false;
    }

    return true;
  }, [updateAvailable, isDismissed, forceShow, isMobile, isInstalled]);

  /**
   * Handle update button click
   */
  const handleUpdate = async () => {
    try {
      await installUpdate();
      toast.success("Update installed", {
        description: "The page will reload to apply the update.",
      });
      // Page will reload automatically via reloadClients()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to install update";
      toast.error("Update failed", {
        description: errorMessage,
      });
    }
  };

  /**
   * Handle dismiss button click
   */
  const handleDismiss = () => {
    setIsAnimating(true);
    setTimeout(() => {
      dismissUpdate();
      setIsDismissed(true);
      setIsAnimating(false);
    }, 300); // Match animation duration
  };

  // Don't render if not visible
  if (!isVisible && !isAnimating) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed right-0 left-0 z-50 mx-auto max-w-7xl px-4 transition-all duration-300",
        position === "top" ? "top-0 pt-4" : "bottom-0 pb-4",
        isVisible && !isAnimating
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
      <Alert className="border-blue-200 bg-blue-50 shadow-lg dark:border-blue-800 dark:bg-blue-950">
        <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          Update Available
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span className="flex-1 text-blue-800 dark:text-blue-200">
            A new version of Hoador is available. Update now to get the latest
            features and improvements.
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpdate}
              disabled={isInstalling}
              size="sm"
              className="shrink-0 bg-blue-600 text-white hover:bg-blue-700"
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", isInstalling && "animate-spin")}
              />
              {isInstalling ? "Updating..." : "Update"}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900"
              aria-label="Dismiss update notification"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
