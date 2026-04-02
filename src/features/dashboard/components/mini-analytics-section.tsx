import { BarChart3, TrendingUp, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RentalMonth {
  year: number;
  month: number;
  monthLabel: string;
  renterCount: number;
  ownerCount: number;
}

export interface EarningMonth {
  year: number;
  month: number;
  monthLabel: string;
  amount: number;
}

export interface InventoryUsage {
  activeCount: number;
  totalCount: number;
  usagePercent: number;
}

export interface DashboardAnalytics {
  rentalsPerMonth: RentalMonth[];
  earningsByMonth: EarningMonth[];
  inventoryUsage: InventoryUsage;
}

export interface MiniAnalyticsSectionProps {
  analytics: DashboardAnalytics;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Mini analytics with colored left borders, bar indicators, and progress rings.
 */
export function MiniAnalyticsSection({ analytics }: MiniAnalyticsSectionProps) {
  const { rentalsPerMonth, earningsByMonth, inventoryUsage } = analytics;

  const hasRentalsData = rentalsPerMonth.some(
    (m) => m.renterCount > 0 || m.ownerCount > 0,
  );
  const hasEarningsData = earningsByMonth.some((m) => m.amount > 0);
  const hasInventoryData = inventoryUsage.totalCount > 0;

  const maxRental = Math.max(
    ...rentalsPerMonth.slice(-3).map((m) => m.renterCount + m.ownerCount),
    1,
  );
  const maxEarning = Math.max(
    ...earningsByMonth.slice(-3).map((m) => m.amount),
    1,
  );

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10">
          <BarChart3
            className="h-4 w-4 text-sky-600 dark:text-sky-400"
            aria-hidden
          />
        </div>
        Analytics
      </h2>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
        {/* Rentals */}
        <Card className="flex h-80 min-h-0 min-w-0 flex-col overflow-hidden border-t-0 border-l-4 border-l-sky-500">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-sky-500" aria-hidden />
              Rentals per month
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
            <div className="scrollbar-hover-reveal min-h-0 flex-1 overflow-y-auto">
              {hasRentalsData ? (
                <div className="space-y-3">
                  {rentalsPerMonth.slice(-3).map((m) => {
                    const total = m.renterCount + m.ownerCount;
                    const pct = (total / maxRental) * 100;
                    return (
                      <div key={`${m.year}-${m.month}`} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground text-xs">
                            {m.monthLabel}
                          </span>
                          <span className="text-xs font-semibold">
                            {total} total
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900/30">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-muted-foreground text-[10px]">
                          {m.renterCount} borrowed, {m.ownerCount} lent
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <TrendingUp className="h-8 w-8 text-sky-300 dark:text-sky-700" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    Not enough data yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Earnings */}
        <Card className="flex h-80 min-h-0 min-w-0 flex-col overflow-hidden border-t-0 border-l-4 border-l-emerald-500">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-emerald-500" aria-hidden />
              Earnings trend
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
            <div className="scrollbar-hover-reveal min-h-0 flex-1 overflow-y-auto">
              {hasEarningsData ? (
                <div className="space-y-3">
                  {earningsByMonth.slice(-3).map((m) => {
                    const pct = (m.amount / maxEarning) * 100;
                    return (
                      <div key={`${m.year}-${m.month}`} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground text-xs">
                            {m.monthLabel}
                          </span>
                          <span className="text-xs font-semibold">
                            {formatCurrency(m.amount)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <BarChart3 className="h-8 w-8 text-emerald-300 dark:text-emerald-700" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    Not enough data yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card className="flex h-80 min-h-0 min-w-0 flex-col overflow-hidden border-t-0 border-l-4 border-l-amber-500">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-amber-500" aria-hidden />
              Inventory usage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
            <div className="scrollbar-hover-reveal min-h-0 flex-1 overflow-y-auto">
              {hasInventoryData ? (
                <div className="flex flex-col items-center py-2">
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-amber-100 dark:text-amber-900/30"
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="text-amber-500"
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${inventoryUsage.usagePercent}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">
                        {inventoryUsage.usagePercent}%
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-3 text-xs">
                    {inventoryUsage.activeCount} of {inventoryUsage.totalCount}{" "}
                    listings active
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Package className="h-8 w-8 text-amber-300 dark:text-amber-700" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    No listings yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
