"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface AdminActivityItem {
  id: string;
  title: string;
  description?: string;
  relativeTime: string;
  linkTo?: string;
}

/**
 * Admin dashboard recent activity widget: new user signups and dispute activity.
 * Fetches live data from /api/admin/activity.
 */
export function AdminRecentActivityWidget() {
  const {
    data: items,
    isLoading,
    error,
  } = useQuery<AdminActivityItem[]>({
    queryKey: ["admin", "activity"],
    queryFn: async () => {
      const response = await fetch("/api/admin/activity");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch activity");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-t-4 border-t-violet-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
              <Activity
                className="h-4 w-4 text-violet-600 dark:text-violet-400"
                aria-hidden
              />
            </div>
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest platform events and administrative actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-t-4 border-t-violet-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
              <Activity
                className="h-4 w-4 text-violet-600 dark:text-violet-400"
                aria-hidden
              />
            </div>
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest platform events and administrative actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive py-8 text-center">
            <p className="text-sm">
              Failed to load activity.{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-t-4 border-t-violet-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
            <Activity
              className="h-4 w-4 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
          </div>
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest platform events and administrative actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
              <Activity className="h-6 w-6 text-violet-400" />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              No recent activity
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              New signups and disputes will appear here
            </p>
          </div>
        ) : (
          <ul className="relative space-y-1">
            {items.map((item, index) => {
              const content = (
                <div className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className="z-10 h-2.5 w-2.5 rounded-full bg-violet-500" />
                    {index < items.length - 1 && (
                      <div className="absolute top-3 h-full w-px bg-violet-200 dark:bg-violet-800" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    {item.description && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {item.description}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.relativeTime}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {item.linkTo ? (
                    <Link
                      href={item.linkTo}
                      className="group flex items-center rounded-lg p-2 transition-colors hover:bg-violet-50 dark:hover:bg-violet-950/20"
                    >
                      <div className="flex-1">{content}</div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ) : (
                    <div className="rounded-lg p-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
