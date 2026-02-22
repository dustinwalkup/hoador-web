"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Package, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AdminMetrics {
  totalUsers: number;
  activeListings: number;
  pendingSupportTickets: number;
}

const cardConfig = [
  {
    key: "total-users",
    label: "Total Users",
    sub: "Registered accounts",
    icon: Users,
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-600 dark:text-sky-400",
    accentBorder: "border-l-sky-500",
  },
  {
    key: "active-listings",
    label: "Active Listings",
    sub: "Available to rent",
    icon: Package,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-l-emerald-500",
  },
  {
    key: "support-tickets",
    label: "Pending Support Tickets",
    sub: "None",
    icon: MessageSquare,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    accentBorder: "border-l-amber-500",
  },
];

/**
 * Admin dashboard metrics cards: total users, active listings, support tickets.
 * Fetches live data from /api/admin/metrics; support tickets are hardcoded to 0.
 */
export function AdminMetricsCards() {
  const { data, isLoading, error } = useQuery<AdminMetrics>({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const response = await fetch("/api/admin/metrics");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch metrics");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-l-muted border-l-4">
            <CardContent className="px-4 py-5">
              <div className="flex items-center gap-4">
                <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-4 w-16 animate-pulse rounded" />
                  <div className="bg-muted h-6 w-12 animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="px-4 py-6">
            <p className="text-muted-foreground text-sm">
              Failed to load metrics.{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const values = [
    String(data.totalUsers),
    String(data.activeListings),
    String(data.pendingSupportTickets),
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cardConfig.map((card, i) => (
        <Card
          key={card.key}
          className={`h-full border-l-4 ${card.accentBorder}`}
        >
          <CardContent className="px-4 py-5">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}
              >
                <card.icon
                  className={`h-5 w-5 ${card.iconColor}`}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {card.label}
                </p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight">
                  {values[i]}
                </p>
                <p className="text-muted-foreground text-xs">{card.sub}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
