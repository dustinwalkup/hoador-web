import { useQuery } from "@tanstack/react-query";
import type { AdminUserDetail } from "@/dal/types";

/**
 * Fetch a single user for admin detail view (profile + counts).
 */
export function useAdminUser(userId: string | null) {
  return useQuery<AdminUserDetail>({
    queryKey: ["admin", "user", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID required");

      const response = await fetch(`/api/admin/users/${userId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch user");
      }

      return response.json();
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
