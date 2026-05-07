"use client";

import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ApprovalStatusBadgeProps {
  approvalStatus: "pending_review" | "approved" | "rejected";
  className?: string;
}

export function ApprovalStatusBadge({
  approvalStatus,
  className,
}: ApprovalStatusBadgeProps) {
  const config = {
    pending_review: {
      icon: Clock,
      label: "Pending Review",
      variant: "secondary" as const,
      className:
        "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    },
    approved: {
      icon: CheckCircle2,
      label: "Approved",
      variant: "default" as const,
      className:
        "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800",
    },
    rejected: {
      icon: AlertCircle,
      label: "Revisions Requested",
      variant: "secondary" as const,
      className:
        "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    },
  };

  const statusConfig = config[approvalStatus];
  const Icon = statusConfig.icon;

  return (
    <Badge
      variant={statusConfig.variant}
      className={cn(
        "flex items-center gap-1.5 border text-xs",
        statusConfig.className,
        className,
      )}
      aria-label={`Listing status: ${statusConfig.label}`}
    >
      <Icon className="h-3 w-3" />
      <span>{statusConfig.label}</span>
    </Badge>
  );
}
