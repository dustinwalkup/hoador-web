"use client";

import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinancialMetrics } from "@/features/admin/hooks/use-payment-lifecycle";
import type { FinancialMetrics } from "@/dal/payment-lifecycle.dal";

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function AttentionItem({ label, count }: { label: string; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
      <span className="text-sm text-red-700 dark:text-red-400">{label}</span>
      <Badge variant="destructive">{count}</Badge>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  borderColor,
  iconColor,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  borderColor: string;
  iconColor: string;
}) {
  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <CardTitle className="text-muted-foreground text-sm font-medium">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function NeedsAttentionCard({
  attention,
}: {
  attention: FinancialMetrics["needsAttention"];
}) {
  const totalIssues =
    attention.failedTransfers +
    attention.frozenTransfers +
    attention.failedDeposits +
    attention.failedReleases +
    attention.expiredDeposits +
    attention.staleProcessing;

  const allClear = totalIssues === 0;

  return (
    <Card
      className={`border-l-4 ${allClear ? "border-l-green-500" : "border-l-red-500"}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {allClear ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Needs Attention
          </CardTitle>
          {!allClear && (
            <Badge variant="destructive" className="ml-auto">
              {totalIssues}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {allClear ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            All clear — no issues detected.
          </p>
        ) : (
          <>
            <AttentionItem
              label="Failed Transfers"
              count={attention.failedTransfers}
            />
            <AttentionItem
              label="Frozen Transfers"
              count={attention.frozenTransfers}
            />
            <AttentionItem
              label="Failed Deposits"
              count={attention.failedDeposits}
            />
            <AttentionItem
              label="Failed Releases"
              count={attention.failedReleases}
            />
            <AttentionItem
              label="Expired Deposits"
              count={attention.expiredDeposits}
            />
            <AttentionItem
              label="Stale Processing"
              count={attention.staleProcessing}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Admin financial KPI cards with time period tabs and attention alerts.
 */
export function PaymentMetricsCards() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useFinancialMetrics(days);

  return (
    <div className="mb-6 space-y-4">
      <Tabs
        value={String(days)}
        onValueChange={(v) => setDays(parseInt(v))}
        className="w-auto"
      >
        <TabsList className="inline-flex w-auto">
          <TabsTrigger value="7" className="flex-none">
            7 days
          </TabsTrigger>
          <TabsTrigger value="30" className="flex-none">
            30 days
          </TabsTrigger>
          <TabsTrigger value="90" className="flex-none">
            90 days
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-l-muted border-l-4">
              <CardContent className="px-4 py-5">
                <div className="space-y-3">
                  <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                  <div className="bg-muted h-8 w-32 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && !data && (
        <Card>
          <CardContent className="px-4 py-6">
            <p className="text-muted-foreground text-sm">
              Failed to load metrics.{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            title="Gross Volume"
            value={formatCurrency(data.grossVolume)}
            icon={DollarSign}
            borderColor="border-l-blue-500"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            title="Platform Revenue"
            value={formatCurrency(data.platformRevenue)}
            icon={TrendingUp}
            borderColor="border-l-emerald-500"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            title="Owner Payouts"
            value={formatCurrency(data.ownerPayouts)}
            icon={Wallet}
            borderColor="border-l-purple-500"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <NeedsAttentionCard attention={data.needsAttention} />
        </div>
      )}
    </div>
  );
}
