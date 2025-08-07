import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { ToolSearchFilters } from "@/lib/dal/types";

// Infinite scroll hook for tool search
export function useSearchTools(filters: ToolSearchFilters, userId?: string) {
  console.log(
    "useSearchTools called with filters:",
    filters,
    "userId:",
    userId,
  );

  // Create a stable cache key by serializing the filters
  const cacheKey = useMemo(() => {
    const serializedFilters = {
      query: filters.query || "",
      category: filters.categoryId || "", // Use 'category' for consistency with API
      minPrice: filters.minPrice || 0,
      maxPrice: filters.maxPrice || 0,
      condition: filters.condition?.join(",") || "",
      deliveryAvailable: filters.deliveryAvailable || false,
      sortBy: filters.sortBy || "newest",
      sortOrder: filters.sortOrder || "desc",
    };
    console.log("Cache key changed:", serializedFilters);
    return ["search-tools", serializedFilters, userId];
  }, [filters, userId]);

  return useInfiniteQuery({
    queryKey: cacheKey,
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();

      // Serialize filters properly for URLSearchParams
      if (filters.query) searchParams.set("q", filters.query);
      if (filters.categoryId) searchParams.set("category", filters.categoryId);
      if (filters.minPrice)
        searchParams.set("minPrice", filters.minPrice.toString());
      if (filters.maxPrice)
        searchParams.set("maxPrice", filters.maxPrice.toString());
      if (filters.condition && filters.condition.length > 0) {
        searchParams.set("condition", filters.condition.join(","));
      }
      if (filters.deliveryAvailable) searchParams.set("delivery", "true");
      if (filters.sortBy) searchParams.set("sortBy", filters.sortBy);
      if (filters.sortOrder) searchParams.set("sortOrder", filters.sortOrder);

      searchParams.set("page", pageParam.toString());
      searchParams.set("limit", "12");
      if (userId) searchParams.set("userId", userId);

      const url = `/api/tools/search?${searchParams.toString()}`;
      console.log("Fetching tools from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        console.error("API error:", error);
        throw new Error(error.message || "Failed to fetch tools");
      }

      const data = await response.json();
      console.log("API response:", data);
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.pagination.hasNext ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: true, // Always enable the query
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

// Individual tool details hook
export function useToolDetails(toolId: string | null) {
  return useQuery({
    queryKey: ["tool-details", toolId],
    queryFn: async () => {
      if (!toolId) return null;
      const response = await fetch(`/api/tools/${toolId}`);
      if (!response.ok) throw new Error("Failed to fetch tool details");
      const data = await response.json();
      return data;
    },
    enabled: !!toolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Tool categories hook
export function useToolCategories() {
  return useQuery({
    queryKey: ["tool-categories"],
    queryFn: async () => {
      const response = await fetch("/api/tools/categories");
      if (!response.ok) throw new Error("Failed to fetch tool categories");
      const data = await response.json();
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Prefetching hook for tool details
export function usePrefetchTool() {
  const queryClient = useQueryClient();

  return (toolId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["tool-details", toolId],
      queryFn: async () => {
        const response = await fetch(`/api/tools/${toolId}`);
        if (!response.ok) throw new Error("Failed to fetch tool details");
        const data = await response.json();
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
