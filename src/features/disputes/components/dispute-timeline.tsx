"use client";

import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DisputeWithRelations } from "@/dal/types";

type DisputeAuditLog = NonNullable<DisputeWithRelations["auditLogs"]>[number];

interface DisputeTimelineProps {
  auditLogs: DisputeAuditLog[];
}

/**
 * Component for displaying dispute timeline
 * Shows state transitions from audit logs in chronological order
 * Filters for state_change actions only
 */
export function DisputeTimeline({ auditLogs }: DisputeTimelineProps) {
  // Filter for state_change actions and sort chronologically
  const stateTransitions = auditLogs
    .filter((log) => log.actionType === "state_change")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatStateLabel = (state: string | null) => {
    if (!state) return "N/A";
    return state
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (stateTransitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline
          </CardTitle>
          <CardDescription>No state transitions recorded</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline
        </CardTitle>
        <CardDescription>
          History of state changes for this dispute
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stateTransitions.map((transition, index) => (
            <div key={transition.id} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className="bg-primary h-3 w-3 rounded-full" />
                {index < stateTransitions.length - 1 && (
                  <div className="bg-border h-full w-0.5" />
                )}
              </div>

              {/* Timeline content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {formatStateLabel(transition.previousState)} →{" "}
                    {formatStateLabel(transition.newState)}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatDateTime(transition.createdAt)}
                </p>
                {transition.reason && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {transition.reason}
                  </p>
                )}
                {transition.userId && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Initiated by user: {transition.userId.slice(0, 8)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
