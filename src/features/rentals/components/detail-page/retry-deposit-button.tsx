"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export function RetryDepositButton({ rentalId }: { rentalId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rentals/${rentalId}/retry-deposit`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // This button lives on the RSC-rendered rental detail page (no query
        // cache entry), so router.refresh() is the correct tool to show the
        // updated deposit status. Intentional.
        router.refresh();
      } else {
        setError(data.error || "Failed to place deposit hold");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <p className="text-sm font-medium text-green-700">
        Deposit hold placed successfully!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={isLoading}
        className="w-fit border-amber-300 text-amber-800 hover:bg-amber-100"
      >
        {isLoading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        )}
        Retry Deposit Hold
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
