import { useQuery } from "@tanstack/react-query";
import type { PaginatedResult } from "@/dal/types";
import type {
  LifecycleListFilters,
  LifecycleListItem,
  LifecycleDetail,
  FinancialMetrics,
} from "@/dal/payment-lifecycle.dal";

export type PaymentLifecycleListResponse = PaginatedResult<LifecycleListItem>;

const DEFAULT_LIMIT = 20;

/**
 * Fetch paginated payment lifecycle list for admin. Requirements: 1.4, 2.2, 3.2
 */
export function usePaymentLifecycleList({
  depositHoldStatus,
  ownerTransferStatus,
  payoutStatus,
  search,
  page = 1,
  limit = DEFAULT_LIMIT,
  excludeCompleted,
}: LifecycleListFilters = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (search?.trim()) params.set("search", search.trim());
  if (depositHoldStatus?.length)
    params.set("depositHoldStatus", depositHoldStatus.join(","));
  if (ownerTransferStatus?.length)
    params.set("ownerTransferStatus", ownerTransferStatus.join(","));
  if (payoutStatus?.length) params.set("payoutStatus", payoutStatus.join(","));
  if (excludeCompleted !== undefined)
    params.set("excludeCompleted", String(excludeCompleted));

  return useQuery<PaymentLifecycleListResponse>({
    queryKey: [
      "admin",
      "payment-lifecycle",
      depositHoldStatus ?? [],
      ownerTransferStatus ?? [],
      payoutStatus ?? [],
      search ?? "",
      page,
      limit,
      excludeCompleted ?? null,
    ],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/payments/lifecycle?${params.toString()}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch payment lifecycle list",
        );
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch payment lifecycle detail by rentalId. Requirements: 2.2
 */
export function usePaymentLifecycleDetail(rentalId: string | null) {
  return useQuery<LifecycleDetail>({
    queryKey: ["admin", "payment-lifecycle-detail", rentalId],
    queryFn: async () => {
      if (!rentalId) throw new Error("rentalId required");

      const response = await fetch(`/api/admin/payments/lifecycle/${rentalId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch payment lifecycle detail",
        );
      }

      return response.json();
    },
    enabled: !!rentalId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch financial metrics for admin dashboard with time period filtering.
 */
export function useFinancialMetrics(days: number = 30) {
  return useQuery<FinancialMetrics>({
    queryKey: ["admin", "financial-metrics", days],
    queryFn: async () => {
      const response = await fetch(`/api/admin/payments/metrics?days=${days}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch financial metrics");
      }

      return response.json();
    },
    staleTime: 60 * 1000, // 60 seconds
  });
}
