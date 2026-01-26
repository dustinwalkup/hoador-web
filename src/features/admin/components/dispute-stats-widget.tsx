"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { DisputeStatus, DisputeReasonCode } from "@/dal/types";

interface DisputeStats {
  total: number;
  pending: number;
  resolvedThisMonth: number;
  byStatus: Record<DisputeStatus, number>;
  byReasonCode: Record<DisputeReasonCode, number>;
  averageResolutionTime: number | null;
}

/**
 * Get status label for display
 */
function getStatusLabel(status: DisputeStatus): string {
  const labels: Record<DisputeStatus, string> = {
    open: "Open",
    evidence_requested: "Evidence Requested",
    under_review: "Under Review",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status] || status;
}

/**
 * Get reason code label for display
 */
function getReasonCodeLabel(code: DisputeReasonCode): string {
  const labels: Record<DisputeReasonCode, string> = {
    damage: "Damage",
    non_delivery: "Non-Delivery",
    quality_issue: "Quality Issue",
    cancellation: "Cancellation",
    payment_issue: "Payment Issue",
    other: "Other",
  };
  return labels[code] || code;
}

export function DisputeStatsWidget() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DisputeStats>({
    queryKey: ["admin", "dispute-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/disputes/stats");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch dispute statistics");
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Dispute Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Dispute Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive py-12 text-center">
            <p>Failed to load dispute statistics</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate top reason codes
  const topReasonCodes = Object.entries(stats.byReasonCode)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([code, count]) => ({
      code: code as DisputeReasonCode,
      count,
    }));

  // Calculate status percentages for visual bars
  const maxStatusCount = Math.max(...Object.values(stats.byStatus));
  const statusEntries = Object.entries(stats.byStatus).filter(
    ([, count]) => count > 0,
  );

  return (
    <Card className="border-orange-200 bg-linear-to-br from-orange-50/50 to-red-50/30 dark:from-orange-950/10 dark:to-red-950/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <Scale className="h-5 w-5" />
              Dispute Statistics
            </CardTitle>
            <CardDescription className="text-orange-600/80 dark:text-orange-400/80">
              Real-time dispute metrics and insights
            </CardDescription>
          </div>
          {stats.pending > 0 && (
            <Badge
              variant="destructive"
              className="h-6 min-w-6 px-2 text-xs font-semibold"
            >
              {stats.pending} Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Total Disputes
                </p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Scale className="text-muted-foreground h-8 w-8" />
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  Pending Review
                </p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                  {stats.pending}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Resolved This Month
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {stats.resolvedThisMonth}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        {statusEntries.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Status Breakdown</h4>
            <div className="space-y-3">
              {statusEntries.map(([status, count]) => {
                const percentage =
                  maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
                const isPending =
                  status === "open" ||
                  status === "evidence_requested" ||
                  status === "under_review";

                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {getStatusLabel(status as DisputeStatus)}
                      </span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <Progress
                      value={percentage}
                      className={`h-2 ${
                        isPending
                          ? "bg-orange-100 dark:bg-orange-900/20"
                          : "bg-muted"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Reason Codes */}
        {topReasonCodes.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Top Reason Codes</h4>
            <div className="space-y-2">
              {topReasonCodes.map(({ code, count }) => (
                <div
                  key={code}
                  className="bg-card flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span className="font-medium">
                    {getReasonCodeLabel(code)}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Average Resolution Time */}
        {stats.averageResolutionTime !== null && (
          <div className="bg-card flex items-center gap-2 rounded-lg border p-3">
            <TrendingUp className="text-muted-foreground h-4 w-4" />
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">
                Avg Resolution Time
              </p>
              <p className="font-semibold">
                {stats.averageResolutionTime} days
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href="/admin/dashboard/disputes/review">
            View All Disputes
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
