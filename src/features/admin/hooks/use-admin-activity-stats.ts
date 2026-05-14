import { useQuery } from "@tanstack/react-query";
import type { ActivityStats } from "@/dal/user-activity.dal";

/**
 * Fetch admin activity stats (active users by bucket, inactive counts).
 * Used by AdminActivityOverviewWidget. 60s stale time.
 */
export function useAdminActivityStats() {
  return useQuery<ActivityStats>({
    queryKey: ["admin", "activity-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/activity/stats");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch activity stats");
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
