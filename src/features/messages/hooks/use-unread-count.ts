import { useQuery } from "@tanstack/react-query";

/**
 * @deprecated Use `useDashboardBadges` from `@/features/dashboard/hooks/use-dashboard-badges`
 * and read `.unreadMessages`. This hook polls a legacy endpoint that is kept
 * only for backwards compatibility; it will be removed in a follow-up PR once
 * no consumers remain.
 */
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/messages/unread-count");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch unread message count");
      }

      const data = await response.json();
      return data.count as number;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}
