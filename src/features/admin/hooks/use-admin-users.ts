import { useQuery } from "@tanstack/react-query";
import type {
  AdminUserListItem,
  PaginatedResult,
  UserStatus,
  UserType,
} from "@/dal/types";

export type AdminUsersResponse = PaginatedResult<AdminUserListItem>;

const DEFAULT_LIMIT = 20;

export interface UseAdminUsersParams {
  search?: string;
  status?: UserStatus;
  userType?: UserType;
  page?: number;
  limit?: number;
}

/**
 * Fetch paginated admin user list. When no search/filters applied, shows recently signed up.
 */
export function useAdminUsers({
  search,
  status,
  userType,
  page = 1,
  limit = DEFAULT_LIMIT,
}: UseAdminUsersParams = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (search?.trim()) params.set("search", search.trim());
  if (status) params.set("status", status);
  if (userType) params.set("userType", userType);

  return useQuery<AdminUsersResponse>({
    queryKey: [
      "admin",
      "users",
      search ?? "",
      status ?? "",
      userType ?? "",
      page,
      limit,
    ],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch users");
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
