"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface PaymentsPageErrorProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Error component for the payments page
 * Displays user-friendly error message with retry option
 */
export function PaymentsPageError({ error, onRetry }: PaymentsPageErrorProps) {
  useEffect(() => {
    if (isSentryEnabled) {
      Sentry.captureException(new Error(error), {
        tags: {
          error_type: "feature_error",
          route: "dashboard/payments",
          component: "PaymentsPageError",
        },
      });
    }
  }, [error]);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="text-destructive h-5 w-5" />
          <CardTitle>Error Loading Payments</CardTitle>
        </div>
        <CardDescription>
          {error || "An unexpected error occurred while loading your payments."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleRetry}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
