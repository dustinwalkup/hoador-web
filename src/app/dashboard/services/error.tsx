"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";
import { Button } from "@/components/ui/button";

export default function ServicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (isSentryEnabled) {
      Sentry.captureException(error, {
        tags: {
          error_type: "react_error_boundary",
          route: "dashboard/services",
          ...(pathname && { path: pathname }),
          ...(error.digest && { digest: error.digest }),
        },
      });
    }
  }, [error, pathname]);

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h2 className="mb-4 text-xl font-semibold">Something went wrong</h2>
      <p className="mb-6 text-sm text-gray-600">
        There was an error loading this service page. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
