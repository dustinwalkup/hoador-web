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

      // Handle explicit deletions for undefined values in updates
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          // Map internal field names to URL parameter names for deletion
          if (key === "categoryId") {
            params.delete("category");
          } else if (key === "query") {
            params.delete("q");
          } else if (key === "deliveryMode") {
            params.delete("delivery");
            params.delete("deliveryMode"); // Also delete the full name if it exists
          } else if (key === "setupAvailable") {
            params.delete("setup");
            params.delete("setupAvailable"); // Also delete the full name if it exists
          } else {
            params.delete(key);
          }
        }
      });

      // Set values from serialized data
      Object.entries(serialized).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          params.set(key, value);
        }
      });

      // Clean up any old parameter names
      params.delete("categoryId");
      params.delete("query");

      // Additional cleanup for delivery parameters if they were set to undefined
      if ("deliveryMode" in updates && updates.deliveryMode === undefined) {
        params.delete("delivery");
        params.delete("deliveryMode");
      }

      // Additional cleanup for setup parameters if they were set to undefined
      if ("setupAvailable" in updates && updates.setupAvailable === undefined) {
        params.delete("setup");
        params.delete("setupAvailable");
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
      deliveryMode:
        ((searchParams.get("delivery") || searchParams.get("deliveryMode")) as
          | "pickup_only"
          | "delivery_only"
          | "both_available") || undefined,
      setupAvailable:
        searchParams.get("setup") === "true" ||
        searchParams.get("setupAvailable") === "true"
          ? true
          : undefined,
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
        // Special handling for boolean values - only include if true
        if (typeof value === "boolean") {
          if (value === true) {
            result[key] = String(value);
          }
        } else if (Array.isArray(value)) {
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

    // Map deliveryMode to delivery for URL compatibility
    if ("deliveryMode" in result) {
      result.delivery = result.deliveryMode;
      delete result.deliveryMode;
    }

    // Map setupAvailable to setup for URL compatibility
    if ("setupAvailable" in result) {
      result.setup = result.setupAvailable;
      delete result.setupAvailable;
    }

    return result;
  }, []);

  return useURLState(parser, serializer);
}
