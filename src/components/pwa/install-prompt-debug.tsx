/**
 * Install Prompt Debug Component
 *
 * Floating debug panel that displays all state values that affect
 * whether the install prompt is shown. Only visible in development.
 */

"use client";

import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getInstallPromptState,
  isAppInstalled,
  isInstallPromptDismissed,
  isInstallPromptSupported,
  clearDismissedStatus,
} from "@/lib/pwa/install-prompt";
import { cn } from "@/lib/utils";

/**
 * Install Prompt Debug Component
 *
 * Shows debug information about install prompt state
 */
export function InstallPromptDebug() {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [, setRefreshKey] = useState(0);

  const hookState = useInstallPrompt();
  const isMobile = useIsMobile();

  // Force refresh to get latest state
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get all debug values
  const state = getInstallPromptState();
  const isSupported = isInstallPromptSupported();
  const isInstalled = isAppInstalled();
  const isDismissed = isInstallPromptDismissed();

  // Check localStorage values
  const dismissedStorage =
    typeof window !== "undefined"
      ? localStorage.getItem("pwa-install-prompt-dismissed")
      : null;
  const installStatusStorage =
    typeof window !== "undefined"
      ? localStorage.getItem("pwa-install-status")
      : null;

  // Check global variables
  const globalPrompt =
    typeof window !== "undefined" ? window.__pwaDeferredPrompt : null;
  const globalCaptured =
    typeof window !== "undefined" ? window.__pwaPromptCaptured : false;

  // Check display mode
  const displayMode =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;

  // User agent info
  const userAgent = typeof window !== "undefined" ? navigator.userAgent : "N/A";
  const platform = typeof window !== "undefined" ? navigator.platform : "N/A";

  // Calculate visibility
  const shouldShow =
    isMobile &&
    isSupported &&
    !isInstalled &&
    !isDismissed &&
    state.isInstallable;

  const handleClearDismissed = () => {
    clearDismissedStatus();
    setRefreshKey((k) => k + 1);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-4 z-[9999] h-20 w-60 rounded-full bg-blue-600 p-0 text-white shadow-lg hover:bg-blue-700"
        aria-label="Show PWA Debug Panel"
      >
        Debug
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-[9997] flex max-h-[80vh] max-w-md flex-col overflow-scroll rounded-xl border bg-white shadow-2xl",
        isMinimized && "max-h-none",
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b bg-white px-4 py-3">
        <CardTitle className="text-lg font-bold">PWA Install Debug</CardTitle>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRefreshKey((k) => k + 1)}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {!isMinimized && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          {/* Visibility Status */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">Should Show Prompt:</div>
            <Badge
              variant={shouldShow ? "default" : "secondary"}
              className="mb-2"
            >
              {shouldShow ? "YES" : "NO"}
            </Badge>
            {!shouldShow && (
              <div className="mt-2 text-xs text-gray-600">
                Reasons it&apos;s not showing:
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  {!isMobile && <li>Not on mobile device</li>}
                  {!isSupported && <li>Install prompt not supported</li>}
                  {isInstalled && <li>App is already installed</li>}
                  {isDismissed && <li>Prompt was dismissed</li>}
                  {!state.isInstallable && <li>App is not installable</li>}
                </ul>
              </div>
            )}
          </div>

          {/* Hook State */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">Hook State:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>isSupported:</span>
                <Badge
                  variant={hookState.isSupported ? "default" : "destructive"}
                >
                  {String(hookState.isSupported)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>isInstallable:</span>
                <Badge
                  variant={hookState.isInstallable ? "default" : "secondary"}
                >
                  {String(hookState.isInstallable)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>isInstalled:</span>
                <Badge
                  variant={hookState.isInstalled ? "default" : "secondary"}
                >
                  {String(hookState.isInstalled)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>isDismissed:</span>
                <Badge
                  variant={hookState.isDismissed ? "destructive" : "default"}
                >
                  {String(hookState.isDismissed)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>isInstalling:</span>
                <Badge
                  variant={hookState.isInstalling ? "default" : "secondary"}
                >
                  {String(hookState.isInstalling)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Device Detection */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">Device Detection:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>isMobile:</span>
                <Badge variant={isMobile ? "default" : "secondary"}>
                  {String(isMobile)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Platform:</span>
                <span className="font-mono">{platform}</span>
              </div>
              <div className="flex justify-between">
                <span>Display Mode:</span>
                <Badge variant={displayMode ? "default" : "secondary"}>
                  {displayMode ? "standalone" : "browser"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Global State */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">Global State:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>window.__pwaDeferredPrompt:</span>
                <Badge variant={globalPrompt ? "default" : "secondary"}>
                  {globalPrompt ? "Set" : "null"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>window.__pwaPromptCaptured:</span>
                <Badge variant={globalCaptured ? "default" : "secondary"}>
                  {String(globalCaptured)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>state.deferredPrompt:</span>
                <Badge variant={state.deferredPrompt ? "default" : "secondary"}>
                  {state.deferredPrompt ? "Set" : "null"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>state.isInstallable:</span>
                <Badge variant={state.isInstallable ? "default" : "secondary"}>
                  {String(state.isInstallable)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>state.userChoice:</span>
                <Badge variant={state.userChoice ? "default" : "secondary"}>
                  {state.userChoice || "null"}
                </Badge>
              </div>
            </div>
          </div>

          {/* localStorage */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">localStorage:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>pwa-install-prompt-dismissed:</span>
                <span className="font-mono text-xs">
                  {dismissedStorage || "null"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>pwa-install-status:</span>
                <span className="font-mono text-xs">
                  {installStatusStorage || "null"}
                </span>
              </div>
            </div>
          </div>

          {/* Browser Support */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">Browser Support:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>isInstallPromptSupported:</span>
                <Badge variant={isSupported ? "default" : "destructive"}>
                  {String(isSupported)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>beforeinstallprompt in window:</span>
                <Badge
                  variant={
                    typeof window !== "undefined" &&
                    "onbeforeinstallprompt" in window
                      ? "default"
                      : "destructive"
                  }
                >
                  {typeof window !== "undefined" &&
                  "onbeforeinstallprompt" in window
                    ? "true"
                    : "false"}
                </Badge>
              </div>
            </div>
          </div>

          {/* User Agent */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">User Agent:</div>
            <div className="font-mono text-xs break-all">{userAgent}</div>
          </div>

          {/* Actions */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 font-semibold">Actions:</div>
            <Button
              onClick={handleClearDismissed}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Clear Dismissed Status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
