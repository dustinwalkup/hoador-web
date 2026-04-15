import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { UserListing } from "@/dal/listing.dal";
import { garageKeys, type GarageListingFilters } from "./garage-keys";

export { garageKeys, type GarageListingFilters };

export function useActiveListings() {
  return useQuery({
    queryKey: garageKeys.active(),
    queryFn: async (): Promise<UserListing[]> => {
      const response = await fetch("/api/garage/active");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch active listings");
      }
      return await response.json();
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useInactiveListings() {
  return useQuery({
    queryKey: garageKeys.inactive(),
    queryFn: async (): Promise<UserListing[]> => {
      const response = await fetch("/api/garage/inactive");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch inactive listings");
      }
      return await response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useArchivedListings() {
  return useQuery({
    queryKey: garageKeys.archived(),
    queryFn: async (): Promise<UserListing[]> => {
      const response = await fetch("/api/garage/archived");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch archived listings");
      }
      return await response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePendingReviewListings() {
  return useQuery({
    queryKey: garageKeys.pendingReview(),
    queryFn: async (): Promise<UserListing[]> => {
      const response = await fetch("/api/garage/pending-review");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch pending review listings",
        );
      }
      return await response.json();
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePendingListingsCount() {
  return useQuery({
    queryKey: garageKeys.pendingCount(),
    queryFn: async (): Promise<number> => {
      const response = await fetch("/api/garage/pending-count");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fetch pending listings count",
        );
      }
      const data = await response.json();
      return data.count || 0;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

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
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useGarageFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const updateFilters = useCallback(
    (updates: Partial<GarageListingFilters>) => {
      const params = new URLSearchParams(searchParams);

      const urlParamMap: Record<keyof GarageListingFilters, string> = {
        query: "q",
        categoryId: "category",
        sortBy: "sortBy",
        sortOrder: "sortOrder",
        rentalStatus: "rentalStatus",
      };

      Object.entries(updates).forEach(([key, value]) => {
        const urlParam = urlParamMap[key as keyof GarageListingFilters];
        if (value === undefined || value === "") {
          params.delete(urlParam);
        } else {
          params.set(urlParam, String(value));
        }
      });

      if (Object.keys(updates).some((key) => key !== "page")) {
        params.delete("page");
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { filters, updateFilters };
}

export function usePrefetchGarageListing() {
  const queryClient = useQueryClient();

  return (listingId: string) => {
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

export function useAllGarageData() {
  const active = useActiveListings();
  const inactive = useInactiveListings();
  const archived = useArchivedListings();
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

export function useGarageCacheInvalidation() {
  const queryClient = useQueryClient();

  const invalidateActiveListings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: garageKeys.active() });
  }, [queryClient]);

  const invalidateInactiveListings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: garageKeys.inactive() });
  }, [queryClient]);

  const invalidateArchivedListings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: garageKeys.archived() });
  }, [queryClient]);

  const invalidateAllGarage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: garageKeys.all });
  }, [queryClient]);

  return {
    invalidateActiveListings,
    invalidateInactiveListings,
    invalidateArchivedListings,
    invalidateAllGarage,
  };
}

export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete listing");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: garageKeys.all });
    },
  });
}
