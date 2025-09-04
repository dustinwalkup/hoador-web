import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ListingSearchFilters } from "@/dal/types";

export function useURLState<T extends Record<string, unknown>>(
  parser: (searchParams: URLSearchParams) => T,
  serializer: (state: Partial<T>) => Record<string, string>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current URL state
  const state = useMemo(() => {
    return parser(searchParams);
  }, [searchParams, parser]);

  // Update URL state
  const updateState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams);
      const serialized = serializer(updates);

      Object.entries(serialized).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      // Clean up any old parameter names
      params.delete("categoryId");
      params.delete("query");

      // If categoryId is explicitly undefined in updates, remove the category parameter
      if (updates.categoryId === undefined) {
        params.delete("category");
      }

      // If query is explicitly undefined in updates, remove the q parameter
      if (
        "query" in updates &&
        (updates as { query?: unknown }).query === undefined
      ) {
        params.delete("q");
      }

      // Reset pagination when filters change
      if (Object.keys(updates).some((key) => key !== "page")) {
        params.delete("page");
      }

      const newUrl = `${pathname}?${params.toString()}`;
      router.push(newUrl);
    },
    [router, pathname, searchParams, serializer],
  );

  return { state, updateState };
}

// Listing filters URL state hook
export function useListingFilters() {
  const parser = useCallback(
    (searchParams: URLSearchParams) => ({
      query: searchParams.get("q") || undefined,
      categoryId: searchParams.get("category") || undefined,
      minPrice: searchParams.get("minPrice")
        ? parseFloat(searchParams.get("minPrice")!)
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? parseFloat(searchParams.get("maxPrice")!)
        : undefined,
      condition: searchParams.get("condition")
        ? searchParams.get("condition")!.split(",").filter(Boolean)
        : undefined,
      deliveryAvailable: searchParams.get("delivery") === "true",
      sortBy:
        (searchParams.get("sortBy") as
          | "price"
          | "rating"
          | "distance"
          | "newest") || "newest",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
      page: parseInt(searchParams.get("page") || "1"),
    }),
    [],
  );

  const serializer = useCallback((filters: Partial<ListingSearchFilters>) => {
    const result: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        if (Array.isArray(value)) {
          result[key] = value.join(",");
        } else {
          result[key] = String(value);
        }
      }
    });

    // Map field names for URL compatibility
    if (result.categoryId) {
      result.category = result.categoryId;
      delete result.categoryId;
    }

    // Map query to q for URL compatibility
    if (result.query) {
      result.q = result.query;
      delete result.query;
    }

    return result;
  }, []);

  return useURLState(parser, serializer);
}
