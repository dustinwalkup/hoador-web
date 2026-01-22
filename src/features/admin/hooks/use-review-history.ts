import { useQuery } from "@tanstack/react-query";
import { ReviewedListing } from "@/dal/types";

interface ReviewHistoryResponse {
  data: ReviewedListing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const ITEMS_PER_PAGE = 20;

export function useReviewHistory(
  statusFilter: "all" | "approved" | "rejected" = "all",
  page: number = 1,
  limit: number = ITEMS_PER_PAGE,
) {
  return useQuery<ReviewHistoryResponse>({
    queryKey: ["admin", "review-history", statusFilter, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/listings/review/history?status=${statusFilter}&page=${page}&limit=${limit}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch review history");
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
