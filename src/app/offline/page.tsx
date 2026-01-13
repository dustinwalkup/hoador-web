"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WifiOff, Home, RefreshCw, ArrowLeft, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNetworkStatus } from "@/lib/pwa/network-status";
import { startTransition } from "react";

/**
 * Offline Fallback Page
 *
 * This page is displayed when the user navigates to a route that
 * hasn't been cached while offline. It provides a user-friendly
 * offline experience with options to retry, navigate to cached content,
 * and information about offline functionality.
 */
export default function OfflinePage() {
  const { isOnline, justCameOnline } = useNetworkStatus();
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-reload when connection is restored
  useEffect(() => {
    if (justCameOnline && isOnline) {
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        window.location.reload();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [justCameOnline, isOnline]);

  const handleRetry = () => {
    if (typeof window === "undefined") {
      return;
    }

    setIsRetrying(true);

    // Check if back online
    if (navigator.onLine) {
      // Reload the page
      window.location.reload();
    } else {
      // If still offline, try to navigate to home which should be cached
      startTransition(() => {
        window.location.href = "/";
      });

      // Reset retry state after a delay
      setTimeout(() => {
        setIsRetrying(false);
      }, 1000);
    }
  };

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to home if no history
      window.location.href = "/";
    }
  };

  // Show connection restored message briefly before reload
  if (justCameOnline && isOnline) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Wifi className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Connection Restored</CardTitle>
            <CardDescription className="text-base">
              Reloading the page...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <WifiOff className="text-muted-foreground h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">You&apos;re Offline</CardTitle>
          <CardDescription className="text-base">
            It looks like you&apos;re not connected to the internet. Some
            features may not be available while offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-muted-foreground text-sm">
              Don&apos;t worry! You can still browse previously visited pages
              that have been cached. Try one of the options below to continue.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">What you can do:</h3>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>Browse previously visited pages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>View cached content and data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>Wait for connection to be restored</span>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="default"
            className="w-full sm:w-auto"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")}
            />
            {isRetrying ? "Retrying..." : "Retry Connection"}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleGoBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
