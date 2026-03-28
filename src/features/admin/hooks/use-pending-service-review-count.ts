import { useQuery } from "@tanstack/react-query";

/**
 * Fetch pending review count for admin dashboard (service listings).
 * Returns the total number of service listings pending review.
 */
export function usePendingServiceReviewCount() {
  return useQuery({
    queryKey: ["admin", "pending-service-review-count"],
    queryFn: async () => {
      const response = await fetch("/api/admin/services/listings/review/count");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch pending service review count",
        );
      }

      const data = await response.json();
      return data.count as number;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}
