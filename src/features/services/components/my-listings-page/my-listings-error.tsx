"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

interface MyListingsErrorProps {
  error: Error;
  onRetry?: () => void;
}

export function MyListingsError({ error, onRetry }: MyListingsErrorProps) {
  useEffect(() => {
    if (isSentryEnabled) {
      Sentry.captureException(error, {
        tags: {
          error_type: "feature_error",
          route: "dashboard/services",
          component: "MyListingsError",
        },
      });
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="bg-destructive/10 mb-4 rounded-full p-3">
        <AlertCircle className="text-destructive h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        Failed to load listings
      </h3>
      <p className="mb-4 text-center text-sm text-gray-600">
        {error.message || "Something went wrong. Please try again."}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
