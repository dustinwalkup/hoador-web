"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExpressDashboardButtonProps {
  className?: string;
}

export function ExpressDashboardButton({
  className,
}: ExpressDashboardButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenDashboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/stripe/create-login-link", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create login link");
      }

      const data = await response.json();
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening dashboard:", error);
      toast.error("Failed to open dashboard", {
        description:
          error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleOpenDashboard}
      disabled={isLoading}
      variant="outline"
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <ExternalLink className="mr-2 h-4 w-4" />
          View Earnings Dashboard
        </>
      )}
    </Button>
  );
}
