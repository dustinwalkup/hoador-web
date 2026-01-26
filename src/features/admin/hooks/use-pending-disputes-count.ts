import { useQuery } from "@tanstack/react-query";

/**
 * Fetch pending disputes count for admin dashboard
 * Returns the total number of disputes needing review (open, evidence_requested, under_review)
 */
export function usePendingDisputesCount() {
  return useQuery({
    queryKey: ["admin", "pending-disputes-count"],
    queryFn: async () => {
      const response = await fetch("/api/admin/disputes/review/count");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch pending disputes count",
        );
      }

      const data = await response.json();
      return data.count as number;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}
