"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isSentryEnabled) {
      Sentry.captureException(error, {
        tags: {
          error_type: "react_error_boundary",
          route: "root",
          ...(error.digest && { digest: error.digest }),
        },
      });
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold">Something went wrong!</h1>
        <p className="mb-6 text-gray-600">
          We&apos;re sorry, but something unexpected happened. Please try again.
        </p>
        <div className="flex gap-4">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
