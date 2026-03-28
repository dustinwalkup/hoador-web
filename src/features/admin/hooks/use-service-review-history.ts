import { useQuery } from "@tanstack/react-query";
import type { ServiceListingReviewWithCategoryAndProvider } from "@/dal/service-listing.dal";

type ServiceReviewHistoryStatusFilter = "all" | "approved" | "rejected";

interface ServiceReviewHistoryResponse {
  data: ServiceListingReviewWithCategoryAndProvider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const ITEMS_PER_PAGE = 10;

export function useServiceReviewHistory(
  statusFilter: ServiceReviewHistoryStatusFilter = "all",
  page: number = 1,
  limit: number = ITEMS_PER_PAGE,
) {
  return useQuery<ServiceReviewHistoryResponse>({
    queryKey: ["admin", "service-review-history", statusFilter, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/services/listings/review/history?status=${statusFilter}&page=${page}&limit=${limit}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch service review history",
        );
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
