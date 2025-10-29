"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GarageErrorProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function GarageError({
  error,
  onRetry,
  title = "Failed to load listings",
  description,
}: GarageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="bg-destructive/10 mb-4 rounded-full p-3">
        <AlertCircle className="text-destructive h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">{title}</h3>
      <p className="mb-4 text-center text-sm text-gray-600">
        {description ||
          error.message ||
          "Something went wrong. Please try again."}
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

export function GarageFiltersError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center py-8">
      <div className="bg-destructive/10 mb-3 rounded-full p-2">
        <AlertCircle className="text-destructive h-4 w-4" />
      </div>
      <p className="mb-3 text-sm text-gray-600">
        Failed to load filters. {error.message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}
