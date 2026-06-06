/**
 * Install Directions Banner Component
 *
 * Displays a banner-style install directions panel with device-specific
 * installation instructions. Shows "Remind me later" and "Never" buttons.
 * Does not include an install action button.
 */

"use client";

import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import {
  Smartphone,
  Share2,
  Plus,
  Check,
  Home,
  Download,
  MoreVertical,
  Menu,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInstallDirections } from "@/lib/pwa/use-install-directions";
import {
  getVisitCount,
  recordVisit,
  subscribeToVisitCount,
} from "@/lib/pwa/install-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/services/better-auth/client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Get icon component from icon name
 */
function getIconComponent(iconName: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    Share2,
    Plus,
    Check,
    Home,
    Download,
    MoreVertical,
    Menu,
    Smartphone,
  };

  return iconMap[iconName] || Smartphone;
}

/**
 * Install Directions Banner Component Props
 */
export interface InstallDirectionsBannerProps {
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
 * Install Directions Banner Component
 *
 * Displays install directions banner when appropriate.
 * Automatically hides when the app is installed or the prompt is dismissed.
 *
 * @param props - Component props
 */
export function InstallDirectionsBanner({
  variant = "banner",
  position = "bottom",
  className,
  forceShow = false,
}: InstallDirectionsBannerProps) {
  const { isInstalled, isDismissed, dismiss, remindLater, instructions } =
    useInstallDirections();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const [isAnimating, setIsAnimating] = useState(false);

  // Subscribe to the visit count so the gating logic re-evaluates after
  // `recordVisit()` updates localStorage. Server snapshot is 0 — the banner is
  // already gated on `isMobile` (false during SSR), so there's no hydration
  // mismatch in the rendered DOM.
  const visitCount = useSyncExternalStore(
    subscribeToVisitCount,
    getVisitCount,
    () => 0,
  );

  // Record this browser session as a visit. recordVisit() notifies
  // subscribeToVisitCount listeners, which triggers a re-read of the snapshot
  // above — no setState in this effect.
  useEffect(() => {
    recordVisit();
  }, []);

  // Derive visibility
  const isVisible = useMemo(() => {
    // Don't show on homepage
    if (pathname === "/") {
      return false;
    }

    // Only show on mobile devices
    if (!isMobile) {
      return false;
    }

    // Don't show if already installed
    if (isInstalled) {
      return false;
    }

    // Don't show if dismissed (unless forceShow)
    if (isDismissed && !forceShow) {
      return false;
    }

    // Only prompt authenticated users, and only on their 2nd+ session in this
    // browser — avoids overwhelming first-time visitors and anonymous browsers.
    if (!forceShow && (!isAuthenticated || visitCount < 2)) {
      return false;
    }

    return true;
  }, [
    isMobile,
    isInstalled,
    isDismissed,
    forceShow,
    pathname,
    isAuthenticated,
    visitCount,
  ]);

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
      <>
        {/* Backdrop overlay */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
            isVisible && !isAnimating
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
          aria-hidden="true"
        />
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
          <Alert className="border-primary/30 from-primary/10 via-primary/5 to-background ring-primary/10 bg-linear-to-br shadow-2xl ring-2 backdrop-blur-sm">
            <AlertTitle className="mb-3 flex items-center gap-2 font-semibold">
              {" "}
              <Smartphone className="text-primary! h-5 w-5" />
              Install Hoador
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-4">
              <div>
                <p className="text-accent-foreground mb-3">
                  Install our app for a faster, more convenient experience. Get
                  quick access to your tools and rentals.
                </p>
                <div className="border-primary/10 bg-background/80 rounded-lg border p-4 shadow-sm">
                  <h4 className="mb-3 text-sm font-semibold">
                    {instructions.title}
                  </h4>
                  <div className="space-y-3">
                    {instructions.steps.map((step, index) => {
                      const IconComponent = getIconComponent(step.icon);
                      return (
                        <div key={index} className="flex items-start gap-3">
                          <div className="bg-primary/10 text-primary mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 text-sm leading-relaxed">
                            <span className="font-medium">{index + 1}.</span>{" "}
                            {step.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRemindLater}
                  variant="default"
                  size="sm"
                  className="shrink-0"
                >
                  Remind me later
                </Button>
                <Button
                  onClick={handleNever}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-label="Never show install directions"
                >
                  Never
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </>
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
      <Alert className="border-primary/30 from-primary/10 via-primary/5 to-background ring-primary/10 bg-linear-to-br shadow-xl ring-2">
        <Smartphone className="text-primary h-5 w-5" />
        <AlertTitle className="font-semibold">Install Hoador</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            Install our app for a faster, more convenient experience. Get quick
            access to your tools and rentals.
          </p>
          <div className="border-primary/10 bg-background/80 rounded-lg border p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold">{instructions.title}</h4>
            <div className="space-y-3">
              {instructions.steps.map((step, index) => {
                const IconComponent = getIconComponent(step.icon);
                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 text-sm leading-relaxed">
                      <span className="font-medium">{index + 1}.</span>{" "}
                      {step.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
