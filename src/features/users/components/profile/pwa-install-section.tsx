/**
 * PWA Install Section Component
 *
 * Client component that displays install options and manual install
 * instructions for Safari/iOS users. This is used in the preferences page.
 */

"use client";

import { useState, useMemo } from "react";
import {
  Download,
  Smartphone,
  Share2,
  Plus,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { toast } from "sonner";

/**
 * Detect if user is on iOS Safari
 */
function isIOSSafari(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isSafari =
    /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

  return isIOS && isSafari;
}

/**
 * Detect if user is on Safari (macOS)
 */
function isMacSafari(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMac = /macintosh|mac os x/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);

  return isMac && isSafari;
}

/**
 * PWA Install Section Component
 */
export function PWAInstallSection() {
  const { isSupported, isInstallable, isInstalled, showPrompt, isInstalling } =
    useInstallPrompt();

  // Derive browser detection values directly (they never change after mount)
  const isIOSSaf = useMemo(() => isIOSSafari(), []);
  const isMacSaf = useMemo(() => isMacSafari(), []);
  const [isOpen, setIsOpen] = useState(false);

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

  // Don't show if already installed
  if (isInstalled) {
    return (
      <Alert>
        <Check className="h-5 w-5 text-green-600" />
        <AlertTitle>App Installed</AlertTitle>
        <AlertDescription>
          Hoador is installed on your device. You can access it from your home
          screen or app launcher.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Install button for browsers that support beforeinstallprompt */}
      {isSupported && isInstallable && !isIOSSaf && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="text-primary h-5 w-5" />
            <div>
              <h3 className="font-medium">Install Hoador</h3>
              <p className="text-muted-foreground text-sm">
                Install our app for a faster, more convenient experience
              </p>
            </div>
          </div>
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            size="sm"
            className="shrink-0"
          >
            <Download className="mr-2 h-4 w-4" />
            {isInstalling ? "Installing..." : "Install"}
          </Button>
        </div>
      )}

      {/* Manual install instructions for Safari/iOS */}
      {(isIOSSaf || isMacSaf || (!isSupported && !isInstalled)) && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <h3 className="mb-1 font-medium">
                    {isIOSSaf
                      ? "Install on iOS"
                      : isMacSaf
                        ? "Install on Mac"
                        : "Manual Installation"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {isIOSSaf
                      ? "Follow these steps to install Hoador on your iPhone or iPad"
                      : isMacSaf
                        ? "Follow these steps to install Hoador on your Mac"
                        : "Install Hoador using your browser's menu"}
                  </p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  {isOpen ? "Hide" : "Show"} Instructions
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="mt-4 space-y-3">
              {isIOSSaf ? (
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      1
                    </span>
                    <div>
                      <strong>Tap the Share button</strong>{" "}
                      <Share2 className="inline h-4 w-4" /> at the bottom of
                      your Safari browser
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      2
                    </span>
                    <div>
                      <strong>
                        Scroll down and tap &quot;Add to Home Screen&quot;
                      </strong>{" "}
                      <Plus className="inline h-4 w-4" />
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      3
                    </span>
                    <div>
                      <strong>Customize the name</strong> (optional) and tap{" "}
                      <strong>&quot;Add&quot;</strong>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      4
                    </span>
                    <div>
                      <strong>Open Hoador</strong> from your home screen to get
                      started
                    </div>
                  </li>
                </ol>
              ) : isMacSaf ? (
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      1
                    </span>
                    <div>
                      Click the <strong>Share button</strong>{" "}
                      <Share2 className="inline h-4 w-4" /> in the Safari
                      toolbar
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      2
                    </span>
                    <div>
                      Select <strong>&quot;Add to Dock&quot;</strong> or{" "}
                      <strong>&quot;Add to Home Screen&quot;</strong>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      3
                    </span>
                    <div>
                      <strong>Open Hoador</strong> from your Dock or Launchpad
                    </div>
                  </li>
                </ol>
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    To install Hoador on your device, use your browser&apos;s
                    install option:
                  </p>
                  <ul className="text-muted-foreground ml-2 list-inside list-disc space-y-1">
                    <li>
                      <strong>Chrome/Edge:</strong> Look for the install icon in
                      the address bar or use the menu (⋮) → Install app
                    </li>
                    <li>
                      <strong>Firefox:</strong> Menu (☰) → Install Site as App
                    </li>
                    <li>
                      <strong>Samsung Internet:</strong> Menu (☰) → Add page to
                      → Home screen
                    </li>
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Not supported message */}
      {!isSupported && !isIOSSaf && !isMacSaf && (
        <Alert>
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Installation Not Available</AlertTitle>
          <AlertDescription>
            Your browser doesn&apos;t support automatic installation. Please use
            your browser&apos;s menu to install the app manually.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
