"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Activity,
  Calendar,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
  AlertCircle,
  Handshake,
  Shield,
  Package,
  HandHelping,
  CalendarClock,
  Truck,
  List,
  BriefcaseBusiness,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardPulseData } from "@/features/dashboard/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardPulseProps {
  data: DashboardPulseData;
  isLoading?: boolean;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

function sum(obj: Record<string, number | undefined>): number {
  return Object.values(obj).reduce<number>((a, b) => a + (b ?? 0), 0);
}

function formatCompact(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

// ---------------------------------------------------------------------------
// Collapsed metric config
// ---------------------------------------------------------------------------

type ActionState = "critical" | "warning" | "idle";

interface ActionTheme {
  ring: string;
  icon: string;
  pingOuter: string;
  pingInner: string;
  outerBorder: string;
  outerBg: string;
  metricIcon: string;
  metricText: string;
  sectionBorder: string;
  sectionBgTint: string;
  sectionBadgeBg: string;
  sectionBadgeText: string;
  sectionDot: string;
  sectionTitle: string;
}

const ACTION_THEMES: Record<ActionState, ActionTheme> = {
  critical: {
    ring: "bg-red-500/15",
    icon: "text-red-500",
    pingOuter: "bg-red-400",
    pingInner: "bg-red-500",
    outerBorder: "border-red-500/20",
    outerBg: "from-card via-card to-muted/30 bg-gradient-to-br",
    metricIcon: "text-red-500",
    metricText: "text-red-600 dark:text-red-400",
    sectionBorder: "border-red-500/30",
    sectionBgTint: "bg-red-50/50 dark:bg-red-950/20",
    sectionBadgeBg: "bg-red-100 dark:bg-red-900/30",
    sectionBadgeText: "text-red-700 dark:text-red-400",
    sectionDot: "bg-red-500",
    sectionTitle: "text-red-600 dark:text-red-400",
  },
  warning: {
    ring: "bg-amber-500/15",
    icon: "text-amber-600 dark:text-amber-400",
    pingOuter: "bg-amber-400",
    pingInner: "bg-amber-500",
    outerBorder: "border-amber-500/20",
    outerBg: "from-card via-card to-muted/30 bg-gradient-to-br",
    metricIcon: "text-amber-500",
    metricText: "text-amber-700 dark:text-amber-300",
    sectionBorder: "border-amber-500/30",
    sectionBgTint: "bg-amber-50/50 dark:bg-amber-950/20",
    sectionBadgeBg: "bg-amber-100 dark:bg-amber-900/30",
    sectionBadgeText: "text-amber-800 dark:text-amber-300",
    sectionDot: "bg-amber-500",
    sectionTitle: "text-amber-700 dark:text-amber-300",
  },
  idle: {
    ring: "bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
    pingOuter: "",
    pingInner: "",
    outerBorder: "border-sky-500/20",
    outerBg: "bg-white dark:bg-card",
    metricIcon: "text-sky-500",
    metricText: "text-sky-600 dark:text-sky-400",
    sectionBorder: "border-sky-500/30",
    sectionBgTint: "",
    sectionBadgeBg: "bg-sky-100 dark:bg-sky-900/30",
    sectionBadgeText: "text-sky-700 dark:text-sky-400",
    sectionDot: "bg-sky-500",
    sectionTitle: "text-sky-600 dark:text-sky-400",
  },
};

const collapsedMetrics = [
  {
    key: "action" as const,
    label: "Action Needed",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    activeColor: "text-red-600 dark:text-red-400",
  },
  {
    key: "active" as const,
    label: "Active",
    icon: Activity,
    iconColor: "text-emerald-500",
    activeColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "upcoming" as const,
    label: "Upcoming",
    icon: Calendar,
    iconColor: "text-teal-500",
    activeColor: "text-teal-600 dark:text-teal-400",
  },
  {
    key: "listed" as const,
    label: "Listed",
    icon: LayoutGrid,
    iconColor: "text-indigo-500",
    activeColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "needs" as const,
    label: "Needs",
    icon: HandHelping,
    iconColor: "text-teal-500",
    activeColor: "text-teal-600 dark:text-teal-400",
  },
];

// ---------------------------------------------------------------------------
// Expanded sections config
// ---------------------------------------------------------------------------

interface PulseRow {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  getValue: (data: DashboardPulseData) => number | undefined;
  href?: string;
  scrollTo?: string;
  severity?: "critical" | "warning";
}

interface PulseSection {
  key: string;
  title: string;
  color: string;
  borderColor: string;
  bgTint: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  getTotal: (data: DashboardPulseData) => number;
  rows: PulseRow[];
}

const ACTION_ROWS: PulseRow[] = [
  {
    label: "Rental requests",
    icon: Clock,
    getValue: (d) => d.action.pendingRequests,
    href: "/dashboard/rentals/incoming/requests",
    severity: "warning",
  },
  {
    label: "Service requests",
    icon: Handshake,
    getValue: (d) => d.action.unconfirmedServices,
    href: "/dashboard/services/incoming/pending",
    severity: "warning",
  },
  {
    label: "Rental Listing Revisions",
    icon: List,
    getValue: (d) => d.action.rentalListingRevisions,
    href: "/dashboard/listings/rentals?tab=pending_review",
    severity: "warning",
  },
  {
    label: "Service Listing Revisions",
    icon: BriefcaseBusiness,
    getValue: (d) => d.action.serviceListingRevisions,
    href: "/dashboard/listings/services?tab=pending_review",
    severity: "warning",
  },
  {
    label: "Overdue returns",
    icon: AlertCircle,
    getValue: (d) => d.action.overdueReturns,
    scrollTo: "needs-attention",
    severity: "critical",
  },
  {
    label: "Overdue services",
    icon: BriefcaseBusiness,
    getValue: (d) => d.action.overdueServices,
    scrollTo: "needs-attention",
    severity: "critical",
  },
];

function sortActionRows(
  data: DashboardPulseData,
  hasCritical: boolean,
): PulseRow[] {
  const byValueDesc = (a: PulseRow, b: PulseRow) =>
    (b.getValue(data) ?? 0) - (a.getValue(data) ?? 0);
  const requests = ACTION_ROWS.filter((r) => r.severity === "warning").sort(
    byValueDesc,
  );
  const overdues = ACTION_ROWS.filter((r) => r.severity === "critical").sort(
    byValueDesc,
  );
  return hasCritical ? [...overdues, ...requests] : [...requests, ...overdues];
}

const sections: PulseSection[] = [
  {
    key: "active",
    title: "Active",
    color: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgTint: "",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/30",
    badgeText: "text-emerald-700 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
    getTotal: (d) => sum(d.active),
    rows: [
      {
        label: "Borrowing",
        icon: Package,
        getValue: (d) => d.active.borrowing,
        href: "/dashboard/rentals/outgoing/active",
      },
      {
        label: "Lending",
        icon: HandHelping,
        getValue: (d) => d.active.lending,
        href: "/dashboard/rentals/incoming/active",
      },
      {
        label: "Disputes",
        icon: Shield,
        getValue: (d) => d.active.disputes,
        href: "/dashboard/disputes",
      },
    ],
  },
  {
    key: "upcoming",
    title: "Upcoming",
    color: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-500/30",
    bgTint: "",
    badgeBg: "bg-teal-100 dark:bg-teal-900/30",
    badgeText: "text-teal-700 dark:text-teal-400",
    dotColor: "bg-teal-500",
    getTotal: (d) => sum(d.upcoming),
    rows: [
      {
        label: "Upcoming rentals",
        icon: CalendarClock,
        getValue: (d) => d.upcoming.rentals,
        scrollTo: "coming-up",
      },
      {
        label: "Scheduled services",
        icon: Calendar,
        getValue: (d) => d.upcoming.services,
        scrollTo: "coming-up",
      },
      {
        label: "Pickups today",
        icon: Truck,
        getValue: (d) => d.upcoming.pickupsToday,
        scrollTo: "coming-up",
      },
    ],
  },
  {
    key: "listed",
    title: "Listed",
    color: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-500/30",
    bgTint: "",
    badgeBg: "bg-indigo-100 dark:bg-indigo-900/30",
    badgeText: "text-indigo-700 dark:text-indigo-400",
    dotColor: "bg-indigo-500",
    getTotal: (d) => sum(d.listed),
    rows: [
      {
        label: "Active tool listings",
        icon: List,
        getValue: (d) => d.listed.tools,
        href: "/dashboard/listings/rentals",
      },
      {
        label: "Active service listings",
        icon: BriefcaseBusiness,
        getValue: (d) => d.listed.services,
        href: "/dashboard/listings/services",
      },
    ],
  },
  {
    key: "needs",
    title: "Neighborhood Needs",
    color: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-500/30",
    bgTint: "",
    badgeBg: "bg-teal-100 dark:bg-teal-900/30",
    badgeText: "text-teal-700 dark:text-teal-400",
    dotColor: "bg-teal-500",
    getTotal: (d) => d.needs.open,
    rows: [
      {
        label: "Open needs in your network",
        icon: HandHelping,
        getValue: (d) => d.needs.open,
        href: "/dashboard/needs",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardPulse({
  data,
  isLoading,
  error,
}: DashboardPulseProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totals = {
    action: sum(data.action),
    active: sum(data.active),
    upcoming: sum(data.upcoming),
    listed: sum(data.listed),
    needs: data.needs.open,
  };

  const hasCritical =
    data.action.overdueReturns > 0 || data.action.overdueServices > 0;
  const hasWarning =
    !hasCritical &&
    (data.action.pendingRequests > 0 ||
      data.action.unconfirmedServices > 0 ||
      data.action.rentalListingRevisions > 0 ||
      data.action.serviceListingRevisions > 0);
  const actionState: ActionState = hasCritical
    ? "critical"
    : hasWarning
      ? "warning"
      : "idle";
  const actionTheme = ACTION_THEMES[actionState];
  const showPing = actionState !== "idle";
  const actionRows = sortActionRows(data, hasCritical);

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 rounded-xl border px-4 py-3">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border-border/50 bg-card relative overflow-hidden rounded-2xl border">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="bg-muted h-5 w-5 animate-pulse rounded-full" />
                <div className="bg-muted h-4 w-12 animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={cn(
        "border-border/50 relative overflow-hidden rounded-2xl border",
        actionTheme.outerBg,
        "shadow-sm transition-shadow duration-300",
        isExpanded && "shadow-lg",
        actionTheme.outerBorder,
      )}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Collapsed state — top bar                                         */}
      {/* ----------------------------------------------------------------- */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-muted/30 relative flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
        whileTap={{ scale: 0.995 }}
      >
        <div className="flex items-center gap-2">
          {/* Pulse indicator */}
          <motion.div
            className={cn(
              "relative flex h-8 w-8 items-center justify-center rounded-full",
              actionTheme.ring,
            )}
            animate={showPing ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className={cn("h-4 w-4", actionTheme.icon)} />
            {showPing && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 flex h-3 w-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    actionTheme.pingOuter,
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-3 w-3 rounded-full",
                    actionTheme.pingInner,
                  )}
                />
              </motion.span>
            )}
          </motion.div>

          <div className="hidden sm:block">
            <span className="text-foreground text-sm font-medium">
              Your Neighborhood Pulse
            </span>
          </div>
        </div>

        {/* Compact stats */}
        <div className="flex items-center gap-4 sm:gap-6">
          {collapsedMetrics.map((metric, i) => {
            const value = totals[metric.key];
            const isAction = metric.key === "action";

            return (
              <motion.div
                key={metric.key}
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <metric.icon
                  className={cn(
                    "h-4 w-4",
                    isAction ? actionTheme.metricIcon : metric.iconColor,
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isAction ? actionTheme.metricText : "text-foreground",
                  )}
                >
                  {formatCompact(value)}
                </span>
                <span className="text-muted-foreground hidden text-xs lg:inline">
                  {metric.label}
                </span>
              </motion.div>
            );
          })}

          {/* Expand/Collapse */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-muted/50 ml-2 flex h-8 w-8 items-center justify-center rounded-full"
          >
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          </motion.div>
        </div>
      </motion.button>

      {/* ----------------------------------------------------------------- */}
      {/* Expanded state — grouped sections                                 */}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.3, delay: 0.1 },
            }}
            className="overflow-hidden"
          >
            <div className="border-border/50 space-y-4 border-t px-5 pt-4 pb-5">
              {/* Action Needed section — dynamically themed */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.1,
                  duration: 0.35,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className={cn(
                  "rounded-xl border p-4",
                  actionTheme.sectionBorder,
                  actionState !== "idle"
                    ? actionTheme.sectionBgTint
                    : "bg-card/60",
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        actionTheme.sectionDot,
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        actionTheme.sectionTitle,
                      )}
                    >
                      Action Needed
                    </span>
                  </div>
                  <Badge
                    className={cn(
                      "px-2.5 py-0.5 text-xs font-semibold",
                      actionTheme.sectionBadgeBg,
                      actionTheme.sectionBadgeText,
                    )}
                  >
                    {totals.action}
                  </Badge>
                </div>

                <ul className="space-y-1">
                  {actionRows.map((row) => {
                    const value = row.getValue(data) ?? 0;
                    const isCritical = row.severity === "critical" && value > 0;

                    const rowClasses = cn(
                      "group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                      isCritical
                        ? "bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                        : "hover:bg-muted/70 dark:hover:bg-muted/20",
                    );

                    const rowContent = (
                      <>
                        <row.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isCritical
                              ? "text-red-500"
                              : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-sm",
                            isCritical
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "text-foreground",
                          )}
                        >
                          {row.label}
                        </span>
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            isCritical
                              ? "text-red-600 dark:text-red-400"
                              : "text-foreground",
                          )}
                        >
                          {value}
                        </span>
                        <ChevronRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                      </>
                    );

                    return (
                      <li key={row.label}>
                        {row.scrollTo ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              document
                                .getElementById(row.scrollTo!)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                            }}
                            className={rowClasses}
                          >
                            {rowContent}
                          </button>
                        ) : (
                          <Link
                            href={row.href!}
                            onClick={(e) => e.stopPropagation()}
                            className={rowClasses}
                          >
                            {rowContent}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </motion.div>

              {sections.map((section, si) => {
                const sectionTotal = section.getTotal(data);

                return (
                  <motion.div
                    key={section.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.1 + si * 0.06,
                      duration: 0.35,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    className={cn(
                      "rounded-xl border p-4",
                      section.borderColor,
                      section.key === "action" && sectionTotal > 0
                        ? section.bgTint
                        : "bg-card/60",
                    )}
                  >
                    {/* Section header */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            section.dotColor,
                          )}
                        />
                        <span
                          className={cn("text-sm font-semibold", section.color)}
                        >
                          {section.title}
                        </span>
                      </div>
                      <Badge
                        className={cn(
                          "px-2.5 py-0.5 text-xs font-semibold",
                          section.badgeBg,
                          section.badgeText,
                        )}
                      >
                        {sectionTotal}
                      </Badge>
                    </div>

                    {/* Rows */}
                    <ul className="space-y-1">
                      {section.rows.map((row) => {
                        const value = row.getValue(data);
                        // Hide optional pickupsToday when undefined
                        if (value === undefined) return null;

                        const isCritical =
                          row.severity === "critical" && value > 0;

                        const rowClasses = cn(
                          "group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                          isCritical
                            ? "bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                            : "hover:bg-muted/70 dark:hover:bg-muted/20",
                        );

                        const rowContent = (
                          <>
                            <row.icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isCritical
                                  ? "text-red-500"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span
                              className={cn(
                                "min-w-0 flex-1 text-sm",
                                isCritical
                                  ? "font-medium text-red-700 dark:text-red-400"
                                  : "text-foreground",
                              )}
                            >
                              {row.label}
                            </span>
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                isCritical
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-foreground",
                              )}
                            >
                              {value}
                            </span>
                            <ChevronRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                          </>
                        );

                        return (
                          <li key={row.label}>
                            {row.scrollTo ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  document
                                    .getElementById(row.scrollTo!)
                                    ?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "center",
                                    });
                                }}
                                className={rowClasses}
                              >
                                {rowContent}
                              </button>
                            ) : (
                              <Link
                                href={row.href!}
                                onClick={(e) => e.stopPropagation()}
                                className={rowClasses}
                              >
                                {rowContent}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
