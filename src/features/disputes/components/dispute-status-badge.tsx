"use client";

import { AlertCircle, Clock, CheckCircle2, FileX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DisputeStatus } from "@/dal/types";

interface DisputeStatusBadgeProps {
  status: DisputeStatus;
  className?: string;
}

/**
 * Dispute status badge component
 * Displays a colored badge with icon and status text
 * Reusable for rental UI integration
 */
export function DisputeStatusBadge({
  status,
  className,
}: DisputeStatusBadgeProps) {
  const config = {
    open: {
      icon: AlertCircle,
      label: "Open",
      variant: "secondary" as const,
      className:
        "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    },
    evidence_requested: {
      icon: Clock,
      label: "Evidence Requested",
      variant: "secondary" as const,
      className:
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    },
    under_review: {
      icon: Clock,
      label: "Under Review",
      variant: "secondary" as const,
      className:
        "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    },
    resolved: {
      icon: CheckCircle2,
      label: "Resolved",
      variant: "default" as const,
      className:
        "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800",
    },
    closed: {
      icon: FileX,
      label: "Closed",
      variant: "secondary" as const,
      className:
        "bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800",
    },
  };

  const statusConfig = config[status];
  const Icon = statusConfig.icon;

  return (
    <Badge
      variant={statusConfig.variant}
      className={cn(
        "flex items-center gap-1.5 border text-xs",
        statusConfig.className,
        className,
      )}
      aria-label={`Dispute status: ${statusConfig.label}`}
    >
      <Icon className="h-3 w-3" />
      <span>{statusConfig.label}</span>
    </Badge>
  );
}
