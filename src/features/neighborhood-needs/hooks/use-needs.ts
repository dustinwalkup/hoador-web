import { useQuery } from "@tanstack/react-query";
import type { NeedFeedRow, NeedDetail } from "@/dal/neighborhood-needs.dal";
import type { PaginatedResult } from "@/dal/types";

export interface NeedsFeedFilters {
  type?: "rental" | "service";
  categoryId?: string;
  openOnly?: boolean;
  page?: number;
  limit?: number;
}

export const needsKeys = {
  all: ["needs"] as const,
  feed: () => [...needsKeys.all, "feed"] as const,
  feedWithFilters: (filters: NeedsFeedFilters) =>
    [...needsKeys.feed(), filters] as const,
  detail: (id: string) => [...needsKeys.all, "detail", id] as const,
};

export function useNeedsFeed(
  filters: NeedsFeedFilters = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: needsKeys.feedWithFilters(filters),
    queryFn: async (): Promise<PaginatedResult<NeedFeedRow>> => {
      const params = new URLSearchParams();
      if (filters.type) params.set("type", filters.type);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.openOnly !== undefined)
        params.set("openOnly", String(filters.openOnly));
      if (filters.page !== undefined) params.set("page", String(filters.page));
      if (filters.limit !== undefined)
        params.set("limit", String(filters.limit));

      const qs = params.toString();
      const response = await fetch(`/api/needs${qs ? `?${qs}` : ""}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { error?: string }).error ?? "Failed to fetch needs feed",
        );
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

export function useNeed(id: string | null) {
  return useQuery({
    queryKey: needsKeys.detail(id ?? ""),
    queryFn: async (): Promise<NeedDetail> => {
      if (!id) throw new Error("Need ID is required");
      const response = await fetch(`/api/needs/${id}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { error?: string }).error ?? "Failed to fetch need",
        );
      }
      return response.json();
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
