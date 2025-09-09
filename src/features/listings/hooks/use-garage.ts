import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { UserListing } from "@/dal/listing.dal";

// Types for garage filters
export interface GarageListingFilters {
  query?: string;
  categoryId?: string;
  sortBy?: "newest" | "name" | "lastRented";
  sortOrder?: "asc" | "desc";
  rentalStatus?: "available" | "rented"; // Only for active listings
}

// Query keys for consistent caching
export const garageKeys = {
  all: ["garage"] as const,
  active: () => [...garageKeys.all, "active"] as const,
  activeWithFilters: (filters: GarageListingFilters) =>
    [...garageKeys.active(), filters] as const,
  inactive: () => [...garageKeys.all, "inactive"] as const,
  inactiveWithFilters: (filters: GarageListingFilters) =>
    [...garageKeys.inactive(), filters] as const,
  archived: () => [...garageKeys.all, "archived"] as const,
  archivedWithFilters: (filters: GarageListingFilters) =>
    [...garageKeys.archived(), filters] as const,
  categories: () => [...garageKeys.all, "categories"] as const,
};

// Active listings hook
export function useActiveListings(filters: GarageListingFilters = {}) {
  return useQuery({
    queryKey: garageKeys.activeWithFilters(filters),
    queryFn: async (): Promise<UserListing[]> => {
      const searchParams = new URLSearchParams();

      if (filters.query) searchParams.set("q", filters.query);
      if (filters.categoryId) searchParams.set("category", filters.categoryId);
      if (filters.sortBy) searchParams.set("sortBy", filters.sortBy);
      if (filters.sortOrder) searchParams.set("sortOrder", filters.sortOrder);
      if (filters.rentalStatus)
        searchParams.set("rentalStatus", filters.rentalStatus);

      const response = await fetch(
        `/api/garage/active?${searchParams.toString()}`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch active listings");
      }
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds - frequently changing (rental status updates)
    refetchOnWindowFocus: false,
  });
}

// Inactive listings hook
export function useInactiveListings(filters: GarageListingFilters = {}) {
  return useQuery({
    queryKey: garageKeys.inactiveWithFilters(filters),
    queryFn: async (): Promise<UserListing[]> => {
      const searchParams = new URLSearchParams();

      if (filters.query) searchParams.set("q", filters.query);
      if (filters.categoryId) searchParams.set("category", filters.categoryId);
      if (filters.sortBy) searchParams.set("sortBy", filters.sortBy);
      if (filters.sortOrder) searchParams.set("sortOrder", filters.sortOrder);

      const response = await fetch(
        `/api/garage/inactive?${searchParams.toString()}`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch inactive listings");
      }
      return await response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - changes less frequently
    refetchOnWindowFocus: false,
  });
}

// Archived listings hook
export function useArchivedListings(filters: GarageListingFilters = {}) {
  return useQuery({
    queryKey: garageKeys.archivedWithFilters(filters),
    queryFn: async (): Promise<UserListing[]> => {
      const searchParams = new URLSearchParams();

      if (filters.query) searchParams.set("q", filters.query);
      if (filters.categoryId) searchParams.set("category", filters.categoryId);
      if (filters.sortBy) searchParams.set("sortBy", filters.sortBy);
      if (filters.sortOrder) searchParams.set("sortOrder", filters.sortOrder);

      const response = await fetch(
        `/api/garage/archived?${searchParams.toString()}`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch archived listings");
      }
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - rarely changes
    refetchOnWindowFocus: false,
  });
}

// Categories hook
export function useGarageCategories() {
  return useQuery({
    queryKey: garageKeys.categories(),
    queryFn: async () => {
      const response = await fetch("/api/garage/categories");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch categories");
      }
      return await response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - static data
    refetchOnWindowFocus: false,
  });
}

// URL state management hook
export function useGarageFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current URL state
  const filters = useMemo((): GarageListingFilters => {
    return {
      query: searchParams.get("q") || undefined,
      categoryId: searchParams.get("category") || undefined,
      sortBy:
        (searchParams.get("sortBy") as "newest" | "name" | "lastRented") ||
        undefined,
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || undefined,
      rentalStatus:
        (searchParams.get("rentalStatus") as "available" | "rented") ||
        undefined,
    };
  }, [searchParams]);

  // Update URL state
  const updateFilters = useCallback(
    (updates: Partial<GarageListingFilters>) => {
      const params = new URLSearchParams(searchParams);

      // Update parameters
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      // Reset pagination when filters change (if we add pagination later)
      if (Object.keys(updates).some((key) => key !== "page")) {
        params.delete("page");
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return { filters, updateFilters };
}

// Prefetching hook
export function usePrefetchGarageListing() {
  const queryClient = useQueryClient();

  return (listingId: string) => {
    // Prefetch individual listing details if we add that endpoint
    queryClient.prefetchQuery({
      queryKey: ["listing", listingId],
      queryFn: async () => {
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch listing details");
        }
        return await response.json();
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}

// Utility hook for getting all garage data at once (for tab switching)
export function useAllGarageData(filters: GarageListingFilters = {}) {
  const active = useActiveListings(filters);
  const inactive = useInactiveListings(filters);
  const archived = useArchivedListings(filters);
  const categories = useGarageCategories();

  return {
    active,
    inactive,
    archived,
    categories,
    isLoading:
      active.isLoading ||
      inactive.isLoading ||
      archived.isLoading ||
      categories.isLoading,
    hasError:
      active.error || inactive.error || archived.error || categories.error,
  };
}

// Cache invalidation utilities
export function useGarageCacheInvalidation() {
  const queryClient = useQueryClient();

  const invalidateActiveListings = useCallback(
    (filters?: GarageListingFilters) => {
      if (filters) {
        queryClient.invalidateQueries({
          queryKey: garageKeys.activeWithFilters(filters),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: garageKeys.active(),
        });
      }
    },
    [queryClient],
  );

  const invalidateInactiveListings = useCallback(
    (filters?: GarageListingFilters) => {
      if (filters) {
        queryClient.invalidateQueries({
          queryKey: garageKeys.inactiveWithFilters(filters),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: garageKeys.inactive(),
        });
      }
    },
    [queryClient],
  );

  const invalidateArchivedListings = useCallback(
    (filters?: GarageListingFilters) => {
      if (filters) {
        queryClient.invalidateQueries({
          queryKey: garageKeys.archivedWithFilters(filters),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: garageKeys.archived(),
        });
      }
    },
    [queryClient],
  );

  const invalidateAllGarage = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: garageKeys.all,
    });
  }, [queryClient]);

  return {
    invalidateActiveListings,
    invalidateInactiveListings,
    invalidateArchivedListings,
    invalidateAllGarage,
  };
}
