/**
 * Install Prompt Component
 *
 * Displays a banner-style install prompt when the PWA is installable.
 * Shows an install button and a dismiss button. Only displays when:
 * - The app is installable (beforeinstallprompt event captured)
 * - The app is not already installed
 * - The prompt has not been dismissed by the user
 */

"use client";

import { useState, useMemo } from "react";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Install Prompt Component Props
 */
export interface InstallPromptProps {
  /** Variant of the install prompt */
  variant?: "banner" | "card";
  /** Position for banner variant */
  position?: "top" | "bottom";
  /** Custom className */
  className?: string;
  /** Whether to show the component even if dismissed (for testing) */
  forceShow?: boolean;
}

/**
 * Install Prompt Component
 *
 * Displays an install prompt banner when the app is installable.
 * Automatically hides when the app is installed or the prompt is dismissed.
 *
 * @param props - Component props
 */
export function InstallPrompt({
  variant = "banner",
  position = "bottom",
  className,
  forceShow = false,
}: InstallPromptProps) {
  const {
    isSupported,
    isInstallable,
    isInstalled,
    isDismissed,
    showPrompt,
    dismiss,
    remindLater,
    isInstalling,
  } = useInstallPrompt();

  const isMobile = useIsMobile();
  const [isAnimating, setIsAnimating] = useState(false);

  // Derive visibility directly from props/hook values (avoid cascading renders)
  const isVisible = useMemo(() => {
    // Only show on mobile devices
    if (!isMobile) {
      return false;
    }

    if (!isSupported) {
      return false;
    }

    if (isInstalled) {
      return false;
    }

    if (isDismissed && !forceShow) {
      return false;
    }

    return isInstallable;
  }, [
    isMobile,
    isSupported,
    isInstallable,
    isInstalled,
    isDismissed,
    forceShow,
  ]);

  // Handle install button click
  const handleInstall = async () => {
    try {
      const result = await showPrompt();

      if (result.outcome === "accepted") {
        toast.success("Installing...", {
          description: "The app is being installed on your device.",
        });
      } else {
        toast.info("Installation cancelled", {
          description: "You can install the app later from your browser menu.",
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to show install prompt";
      toast.error("Installation failed", {
        description: errorMessage,
      });
    }
  };

  // Handle "Remind me later" button click
  const handleRemindLater = () => {
    setIsAnimating(true);
    setTimeout(() => {
      remindLater();
      setIsAnimating(false);
    }, 300); // Match animation duration
  };

  // Handle "Never" button click (permanent dismissal)
  const handleNever = () => {
    setIsAnimating(true);
    setTimeout(() => {
      dismiss();
      setIsAnimating(false);
    }, 300); // Match animation duration
  };

  // Don't render if not visible
  if (!isVisible && !isAnimating) {
    return null;
  }

  // Render banner variant
  if (variant === "banner") {
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
      >
        <Alert className="shadow-lg">
          <Smartphone className="h-5 w-5" />
          <AlertTitle>Install Hoador</AlertTitle>
          <AlertDescription className="flex flex-col items-center justify-between gap-4">
            <p>
              Install our app for a faster, more convenient experience. Get
              quick access to your tools and rentals.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                size="sm"
                className="shrink-0"
              >
                <Download className="mr-2 h-4 w-4" />
                {isInstalling ? "Installing..." : "Install"}
              </Button>
              <Button
                onClick={handleRemindLater}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                Remind me later
              </Button>
              <Button
                onClick={handleNever}
                variant="ghost"
                size="sm"
                className="shrink-0"
                aria-label="Never show install prompt"
              >
                Never
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render card variant
  return (
    <div
      className={cn(
        "transition-all duration-300",
        isVisible && !isAnimating
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0",
        className,
      )}
    >
      <Alert>
        <Smartphone className="h-5 w-5" />
        <AlertTitle>Install Hoador</AlertTitle>
        <AlertDescription className="flex flex-col gap-2 space-y-3">
          <p>
            Install our app for a faster, more convenient experience. Get quick
            access to your tools and rentals.
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleInstall}
              disabled={isInstalling}
              size="sm"
              className="shrink-0"
            >
              <Download className="mr-2 h-4 w-4" />
              {isInstalling ? "Installing..." : "Install"}
            </Button>
            <Button
              onClick={handleRemindLater}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              Remind me later
            </Button>
            <Button
              onClick={handleNever}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              Never
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
