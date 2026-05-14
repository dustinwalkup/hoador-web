import { useQuery } from "@tanstack/react-query";
import type { AdminBadges } from "@/app/api/admin/badges/route";

export const ADMIN_BADGES_QUERY_KEY = ["admin", "badges"] as const;

/**
 * Single poll that feeds the admin sidebar's pending count badges:
 * listing reviews, service listing reviews, and disputes. Replaces three
 * independent 30s pollers. Refreshes on window focus and via mutation
 * invalidation (see use-admin-mutations); no interval polling.
 */
export function useAdminBadges() {
  return useQuery<AdminBadges>({
    queryKey: ADMIN_BADGES_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/admin/badges");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch admin badges");
      }
      return response.json() as Promise<AdminBadges>;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
