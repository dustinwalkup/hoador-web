"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { usePaymentLifecycleList } from "@/features/admin/hooks/use-payment-lifecycle";
import type { LifecycleListFilters } from "@/dal/payment-lifecycle.dal";

const DEBOUNCE_MS = 300;

const DEPOSIT_STATUS_OPTIONS = [
  "scheduled",
  "held",
  "released",
  "expired",
  "failed",
  "captured",
  "not_applicable",
  "release_failed",
] as const;

/** Combined payout filter options that map to underlying ownerTransferStatus + payoutStatus. */
const COMBINED_PAYOUT_OPTIONS = [
  "pending",
  "processing",
  "completed",
  "failed",
  "frozen",
] as const;

type CombinedPayoutStatus = (typeof COMBINED_PAYOUT_OPTIONS)[number];

/**
 * Derive a single user-friendly payout status from the two underlying fields.
 * Priority: frozen > failed > processing > completed > pending
 */
function getCombinedPayoutStatus(
  ownerTransferStatus: string,
  payoutStatus: string,
): CombinedPayoutStatus {
  if (ownerTransferStatus === "frozen") return "frozen";
  if (ownerTransferStatus === "failed" || payoutStatus === "failed")
    return "failed";
  if (payoutStatus === "processing") return "processing";
  if (ownerTransferStatus === "completed") return "completed";
  return "pending";
}

/**
 * Map a combined payout filter value to the underlying API filter params.
 */
function combinedPayoutToFilters(value: CombinedPayoutStatus): {
  ownerTransferStatus?: string;
  payoutStatus?: string;
} {
  switch (value) {
    case "frozen":
      return { ownerTransferStatus: "frozen" };
    case "failed":
      return { ownerTransferStatus: "failed", payoutStatus: "failed" };
    case "processing":
      return { payoutStatus: "processing" };
    case "completed":
      return { ownerTransferStatus: "completed" };
    case "pending":
      return { payoutStatus: "pending" };
  }
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (["failed", "expired", "release_failed"].includes(status))
    return "destructive";
  if (["processing", "frozen", "scheduled", "held"].includes(status))
    return "secondary";
  if (["completed", "released", "captured"].includes(status)) return "default";
  return "outline";
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Admin payment lifecycle list with URL-synced filters and pagination.
 */
export function PaymentLifecycleListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1");
  const searchParam = searchParams.get("search") ?? "";
  const depositParam = searchParams.get("depositHoldStatus") ?? "";
  const transferParam = searchParams.get("ownerTransferStatus") ?? "";
  const payoutParam = searchParams.get("payoutStatus") ?? "";
  const showCompleted = searchParams.get("showCompleted") === "true";

  // Derive combined payout filter from URL params
  const combinedPayoutParam =
    transferParam || payoutParam
      ? transferParam === "frozen"
        ? "frozen"
        : transferParam === "failed" || payoutParam === "failed"
          ? "failed"
          : payoutParam === "processing"
            ? "processing"
            : transferParam === "completed"
              ? "completed"
              : payoutParam === "pending"
                ? "pending"
                : ""
      : "";

  const [searchInput, setSearchInput] = useState(searchParam);

  const filters: LifecycleListFilters = {
    page,
    limit: 20,
    search: searchParam || undefined,
    depositHoldStatus: depositParam
      ? (depositParam
          .split(",")
          .filter(Boolean) as LifecycleListFilters["depositHoldStatus"])
      : undefined,
    ownerTransferStatus: transferParam
      ? (transferParam
          .split(",")
          .filter(Boolean) as LifecycleListFilters["ownerTransferStatus"])
      : undefined,
    payoutStatus: payoutParam
      ? (payoutParam
          .split(",")
          .filter(Boolean) as LifecycleListFilters["payoutStatus"])
      : undefined,
    excludeCompleted: !showCompleted,
  };

  const { data, isLoading, error } = usePaymentLifecycleList(filters);

  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  const updateUrl = useCallback(
    (updates: {
      search?: string;
      depositHoldStatus?: string;
      ownerTransferStatus?: string;
      payoutStatus?: string;
      showCompleted?: boolean;
      page?: number;
    }) => {
      const params = new URLSearchParams(searchParams);
      if (updates.search !== undefined) {
        if (updates.search === "") params.delete("search");
        else params.set("search", updates.search);
      }
      if (updates.depositHoldStatus !== undefined) {
        if (updates.depositHoldStatus === "")
          params.delete("depositHoldStatus");
        else params.set("depositHoldStatus", updates.depositHoldStatus);
      }
      if (updates.ownerTransferStatus !== undefined) {
        if (updates.ownerTransferStatus === "")
          params.delete("ownerTransferStatus");
        else params.set("ownerTransferStatus", updates.ownerTransferStatus);
      }
      if (updates.payoutStatus !== undefined) {
        if (updates.payoutStatus === "") params.delete("payoutStatus");
        else params.set("payoutStatus", updates.payoutStatus);
      }
      if (updates.showCompleted !== undefined) {
        if (!updates.showCompleted) params.delete("showCompleted");
        else params.set("showCompleted", "true");
      }
      if (updates.page !== undefined) {
        if (updates.page <= 1) params.delete("page");
        else params.set("page", String(updates.page));
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== searchParam) {
        updateUrl({ search: searchInput || "", page: 1 });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, searchParam, updateUrl]);

  const handleCombinedPayoutChange = useCallback(
    (value: string) => {
      if (value === "all") {
        updateUrl({ ownerTransferStatus: "", payoutStatus: "", page: 1 });
      } else {
        const mapped = combinedPayoutToFilters(value as CombinedPayoutStatus);
        updateUrl({
          ownerTransferStatus: mapped.ownerTransferStatus ?? "",
          payoutStatus: mapped.payoutStatus ?? "",
          page: 1,
        });
      }
    },
    [updateUrl],
  );

  const pagination = data?.pagination;

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search rental, request, renter, owner..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={depositParam || "all"}
            onValueChange={(v) =>
              updateUrl({
                depositHoldStatus: v === "all" ? "" : v,
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Deposit status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All deposit</SelectItem>
              {DEPOSIT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={combinedPayoutParam || "all"}
            onValueChange={handleCombinedPayoutChange}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Payout status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payout</SelectItem>
              {COMBINED_PAYOUT_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-completed"
              checked={showCompleted}
              onCheckedChange={(checked) =>
                updateUrl({ showCompleted: !!checked, page: 1 })
              }
            />
            <Label
              htmlFor="show-completed"
              className="text-muted-foreground text-sm font-normal"
            >
              Show completed
            </Label>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-destructive py-12 text-center">
            <p>Failed to load payment lifecycle list</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {data.data.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center">
                No records match your filters.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b text-left text-xs font-medium">
                        <th className="px-4 py-2 font-medium">Rental</th>
                        <th className="px-4 py-2 font-medium">Renter</th>
                        <th className="px-4 py-2 font-medium">Owner</th>
                        <th className="px-4 py-2 font-medium">Listing</th>
                        <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                          Amount
                        </th>
                        <th className="px-4 py-2 font-medium whitespace-nowrap">
                          Deposit
                        </th>
                        <th className="px-4 py-2 font-medium whitespace-nowrap">
                          Payout
                        </th>
                        <th className="px-4 py-2 font-medium whitespace-nowrap">
                          Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((row) => {
                        const combinedStatus = getCombinedPayoutStatus(
                          row.ownerTransferStatus,
                          row.payoutStatus,
                        );
                        return (
                          <tr
                            key={row.rentalId}
                            className="border-b text-sm last:border-b-0"
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={`/admin/dashboard/payments/${row.rentalId}`}
                                className="text-primary font-medium hover:underline"
                              >
                                {row.rentalId.slice(0, 8)}…
                              </Link>
                            </td>
                            <td
                              className="max-w-[200px] truncate px-4 py-3"
                              title={row.renterName}
                            >
                              {row.renterName}
                            </td>
                            <td
                              className="max-w-[200px] truncate px-4 py-3"
                              title={row.ownerName}
                            >
                              {row.ownerName}
                            </td>
                            <td
                              className="max-w-[250px] truncate px-4 py-3"
                              title={row.listingName}
                            >
                              {row.listingName}
                            </td>
                            <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                              {formatCurrency(row.totalAmount)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge
                                variant={statusBadgeVariant(
                                  row.depositHoldStatus,
                                )}
                              >
                                {row.depositHoldStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge
                                variant={statusBadgeVariant(combinedStatus)}
                              >
                                {combinedStatus}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                              {formatDate(row.updatedAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-muted-foreground text-sm">
                      Page {pagination.page} of {pagination.totalPages} (
                      {pagination.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasPrev}
                        onClick={() => updateUrl({ page: pagination.page - 1 })}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasNext}
                        onClick={() => updateUrl({ page: pagination.page + 1 })}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
