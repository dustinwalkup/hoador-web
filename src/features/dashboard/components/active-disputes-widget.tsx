import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface DisputeWithRelations {
  id: string;
  status: string;
  rental?: {
    listing?: {
      name?: string;
    };
  } | null;
  serviceBooking?: {
    listing?: {
      title?: string;
    };
  } | null;
}

export interface ActiveDisputesWidgetProps {
  disputes: DisputeWithRelations[];
  totalCount: number;
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function statusColor(status: string): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "in_progress":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "resolved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Active disputes with colored status badges, orange left border, and graceful empty state.
 */
export function ActiveDisputesWidget({
  disputes,
  totalCount,
}: ActiveDisputesWidgetProps) {
  return (
    <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-t-0 border-l-4 border-l-orange-500">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10">
            <AlertCircle
              className="h-4 w-4 text-orange-600 dark:text-orange-400"
              aria-hidden
            />
          </div>
          Active Disputes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 pt-0">
        <div className="scrollbar-hover-reveal min-h-0 flex-1 space-y-3 overflow-y-auto">
          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
                <ShieldAlert className="h-6 w-6 text-orange-400" />
              </div>
              <p className="text-muted-foreground mt-3 text-sm">
                No active disputes
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Everything looks good!
              </p>
            </div>
          ) : (
            <>
              <Badge className="bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {totalCount} {totalCount === 1 ? "dispute" : "disputes"}
              </Badge>
              <ul className="space-y-1">
                {disputes.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/disputes/${d.id}`}
                      className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/20"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">
                          {d.rental?.listing?.name ??
                            d.serviceBooking?.listing?.title ??
                            "Dispute"}
                        </span>
                        <div className="mt-1">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(d.status)}`}
                          >
                            {formatStatus(d.status)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {totalCount > 0 && totalCount > disputes.length && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mt-2 shrink-0 text-xs font-medium text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20"
          >
            <Link href="/dashboard/disputes">
              View All Disputes
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
