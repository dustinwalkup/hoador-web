import { useQuery } from "@tanstack/react-query";
import { PendingReviewListing } from "@/dal/types";

interface PendingReviewsResponse {
  data: PendingReviewListing[];
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

export function usePendingReviews(
  page: number = 1,
  limit: number = ITEMS_PER_PAGE,
) {
  return useQuery<PendingReviewsResponse>({
    queryKey: ["admin", "pending-reviews", page],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/listings/review/pending?page=${page}&limit=${limit}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch pending reviews");
      }

      return response.json();
    },
    staleTime: 10 * 1000, // 10 seconds
  });
}
