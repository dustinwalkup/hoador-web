import { useQuery } from "@tanstack/react-query";
import type {
  DisputeStatus,
  DisputeRole,
  DisputeReasonCode,
} from "@/dal/types";
import type { DisputeWithRelations } from "@/dal/types";
import type { PaginatedResult } from "@/dal/types";

// Query keys for consistent caching
export const disputeKeys = {
  all: ["disputes"] as const,
  lists: () => [...disputeKeys.all, "list"] as const,
  list: (filters?: {
    status?: DisputeStatus;
    role?: DisputeRole;
    reasonCode?: DisputeReasonCode;
    page?: number;
    limit?: number;
  }) => [...disputeKeys.lists(), filters] as const,
  detail: (id: string) => [...disputeKeys.all, "detail", id] as const,
};

export interface UseDisputesFilters {
  status?: DisputeStatus;
  role?: DisputeRole;
  reasonCode?: DisputeReasonCode;
  page?: number;
  limit?: number;
}

/**
 * Hook for fetching disputes list
 * - Admins: Get all disputes with filters
 * - Users: Get their own disputes (as renter or provider)
 */
export function useDisputes(filters?: UseDisputesFilters) {
  return useQuery({
    queryKey: disputeKeys.list(filters),
    queryFn: async (): Promise<PaginatedResult<DisputeWithRelations>> => {
      // Build query params
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.role) params.set("role", filters.role);
      if (filters?.reasonCode) params.set("reasonCode", filters.reasonCode);
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const response = await fetch(`/api/disputes?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch disputes");
      }

      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute - user's own data
    refetchOnWindowFocus: false,
  });
}
