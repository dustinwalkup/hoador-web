import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { ListingSearchFilters } from "@/dal/types";

// Infinite scroll hook for listing search
export function useSearchListings(
  filters: ListingSearchFilters,
  userId?: string,
) {
  // Create a stable cache key by serializing the filters
  const cacheKey = useMemo(() => {
    const serializedFilters = {
      query: filters.query || undefined,
      category: filters.categoryId || undefined,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      condition: filters.condition?.join(",") || undefined,
      deliveryAvailable: filters.deliveryAvailable || false,
      sortBy: filters.sortBy || "newest",
      sortOrder: filters.sortOrder || "desc",
    };
    return ["search-listings", serializedFilters, userId];
  }, [filters, userId]);

  return useInfiniteQuery({
    queryKey: cacheKey,
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();

      // Serialize filters properly for URLSearchParams
      if (filters.query && filters.query.trim())
        searchParams.set("q", filters.query);
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

      const url = `/api/listings/search?${searchParams.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch listings");
      }

      const data = await response.json();
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

// Individual listing details hook
export function useListingDetails(listingId: string | null) {
  return useQuery({
    queryKey: ["listing-details", listingId],
    queryFn: async () => {
      if (!listingId) return null;
      const response = await fetch(`/api/listings/${listingId}`);
      if (!response.ok) throw new Error("Failed to fetch listing details");
      const data = await response.json();
      return data;
    },
    enabled: !!listingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Listing categories hook
export function useListingCategories() {
  return useQuery({
    queryKey: ["listing-categories"],
    queryFn: async () => {
      const response = await fetch("/api/listings/categories");
      if (!response.ok) throw new Error("Failed to fetch listing categories");
      const data = await response.json();
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Prefetching hook for listing details
export function usePrefetchListing() {
  const queryClient = useQueryClient();

  return (listingId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["listing-details", listingId],
      queryFn: async () => {
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) throw new Error("Failed to fetch listing details");
        const data = await response.json();
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
