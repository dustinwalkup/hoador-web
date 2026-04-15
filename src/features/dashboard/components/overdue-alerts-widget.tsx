import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ActionableAlert } from "@/dal/rentals.dal";
import { formatAlertText } from "@/features/rentals/lib/format-alert-text";
import { cn } from "@/lib/utils";

export interface OverdueAlertsWidgetProps {
  alerts: ActionableAlert[];
}

/**
 * Actionable alerts (overdue returns, start/end nudges, stale service bookings)
 * with severity-aware styling.
 */
export function OverdueAlertsWidget({ alerts }: OverdueAlertsWidgetProps) {
  if (alerts.length === 0) return null;

  const hasError = alerts.some((a) => a.severity === "error");

  return (
    <Card
      className={cn(
        "border-t-4 bg-red-50/50 dark:bg-red-950/20",
        hasError
          ? "border-red-200 border-t-red-500 dark:border-red-800"
          : "border-amber-200 border-t-amber-500 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              "text-base font-medium",
              hasError
                ? "text-red-700 dark:text-red-400"
                : "text-amber-800 dark:text-amber-200",
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  hasError ? "bg-red-500/15" : "bg-amber-500/15",
                )}
              >
                {hasError ? (
                  <AlertTriangle
                    className="h-4 w-4 text-red-600 dark:text-red-400"
                    aria-hidden
                  />
                ) : (
                  <Clock
                    className="h-4 w-4 text-amber-700 dark:text-amber-300"
                    aria-hidden
                  />
                )}
              </div>
              <span>Needs attention</span>
            </div>
          </CardTitle>
          <Badge
            variant={hasError ? "destructive" : "secondary"}
            className={cn(
              "px-2.5 py-0.5 text-xs font-semibold",
              !hasError &&
                "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100",
            )}
          >
            {alerts.length} {alerts.length === 1 ? "item" : "items"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-hover-reveal max-h-60 overflow-y-auto">
          <ul className="space-y-2 text-sm">
            {alerts.map((alert) => {
              const isError = alert.severity === "error";
              const body = formatAlertText(
                alert.alertType,
                alert.userRole,
                alert.deliveryRequested,
                alert.daysLate,
              );
              return (
                <li key={`${alert.alertType}-${alert.id}`}>
                  <Link
                    href={alert.linkTo}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg p-2.5 transition-colors",
                      isError
                        ? "hover:bg-red-100/70 dark:hover:bg-red-900/20"
                        : "hover:bg-amber-100/70 dark:hover:bg-amber-900/20",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "font-medium",
                          isError
                            ? "text-red-700 dark:text-red-400"
                            : "text-amber-900 dark:text-amber-200",
                        )}
                      >
                        {alert.listingName}
                      </span>
                      <p
                        className={cn(
                          "text-xs",
                          isError
                            ? "text-red-600/80 dark:text-red-400/80"
                            : "text-amber-800/90 dark:text-amber-300/90",
                        )}
                      >
                        {body} &middot; {alert.otherPartyName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {isError ? (
                        <AlertTriangle
                          className="h-4 w-4 text-red-500"
                          aria-hidden
                        />
                      ) : (
                        <Clock
                          className="h-4 w-4 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                      )}
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100",
                          isError ? "text-red-400" : "text-amber-500",
                        )}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
