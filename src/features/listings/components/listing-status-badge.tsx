"use client";

import { Clock, CheckCircle2, XCircle } from "lucide-react";
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
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    },
    approved: {
      icon: CheckCircle2,
      label: "Approved",
      variant: "default" as const,
      className:
        "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800",
    },
    rejected: {
      icon: XCircle,
      label: "Rejected",
      variant: "destructive" as const,
      className:
        "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800",
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
