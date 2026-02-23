"use client";

import Link from "next/link";
import { Activity, Users, AlertTriangle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminActivityStats } from "@/features/admin/hooks/use-admin-activity-stats";

/**
 * Admin dashboard widget: active users by time bucket and inactive user alert
 * with link to filtered users page.
 */
export function AdminActivityOverviewWidget() {
  const { data: stats, isLoading, error } = useAdminActivityStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" aria-hidden />
            User Activity
          </CardTitle>
          <CardDescription>Active and inactive user counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>Loading activity stats…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" aria-hidden />
            User Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {error instanceof Error
              ? error.message
              : "Failed to load activity stats."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const buckets = [
    { label: "Last 24h", value: stats.activeLast24h, key: "24h" },
    { label: "Last 7 days", value: stats.activeLast7d, key: "7d" },
    { label: "Last 30 days", value: stats.activeLast30d, key: "30d" },
    { label: "Last 90 days", value: stats.activeLast90d, key: "90d" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" aria-hidden />
          User Activity
        </CardTitle>
        <CardDescription>Active and inactive user counts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {buckets.map(({ label, value, key }) => (
            <div
              key={key}
              className="bg-muted/30 rounded-lg border px-3 py-2 text-center"
            >
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {stats.inactive30d > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-5 w-5 text-amber-600 dark:text-amber-500"
                aria-hidden
              />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {stats.inactive30d} user{stats.inactive30d === 1 ? "" : "s"}{" "}
                inactive for 30+ days
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link
                href="/admin/dashboard/users?inactiveDays=30"
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" aria-hidden />
                View inactive users
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
