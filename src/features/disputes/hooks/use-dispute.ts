import { useQuery } from "@tanstack/react-query";
import type { DisputeWithRelations } from "@/dal/types";
import { disputeKeys } from "./use-disputes";

/**
 * Hook for fetching a single dispute by ID
 * Accessible by renter, provider, or admin
 */
export function useDispute(disputeId: string | null) {
  return useQuery({
    queryKey: disputeKeys.detail(disputeId || ""),
    queryFn: async (): Promise<DisputeWithRelations> => {
      if (!disputeId) {
        throw new Error("Dispute ID is required");
      }

      const response = await fetch(`/api/disputes/${disputeId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch dispute");
      }

      return response.json();
    },
    enabled: !!disputeId,
    staleTime: 5 * 60 * 1000, // 5 minutes - dispute details change less frequently
    refetchOnWindowFocus: false,
  });
}
