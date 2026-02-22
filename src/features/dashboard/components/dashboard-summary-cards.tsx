"use client";

import { Package, HandHelping, Clock, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export interface DashboardSummaryCardsProps {
  activeRentalsCount: number;
  toolsLentCount: number;
  pendingRequestsCount: number;
  earningsThisMonth: number;
  isLoading?: boolean;
  error?: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const cards = [
  {
    key: "active-rentals",
    label: "Active Rentals",
    sub: "Currently borrowing",
    icon: Package,
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-600 dark:text-sky-400",
    accentBorder: "border-l-sky-500",
  },
  {
    key: "tools-lent",
    label: "Items Lent",
    sub: "Others borrowing",
    icon: HandHelping,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-l-emerald-500",
  },
  {
    key: "pending-requests",
    label: "Pending Requests",
    sub: "Awaiting your response",
    icon: Clock,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    accentBorder: "border-l-amber-500",
  },
  {
    key: "earnings",
    label: "This Month",
    sub: "From rentals",
    icon: DollarSign,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-l-emerald-500",
  },
];

/**
 * Four summary cards with colored left accents and icon circles.
 */
export function DashboardSummaryCards({
  activeRentalsCount,
  toolsLentCount,
  pendingRequestsCount,
  earningsThisMonth,
  isLoading,
  error,
}: DashboardSummaryCardsProps) {
  if (error) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="px-4 py-6">
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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

  const values = [
    String(activeRentalsCount),
    String(toolsLentCount),
    String(pendingRequestsCount),
    formatCurrency(earningsThisMonth),
  ];

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } },
      }}
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.97 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
            },
          }}
        >
          <Card className={`border-l-4 ${card.accentBorder} h-full`}>
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
        </motion.div>
      ))}
    </motion.div>
  );
}
