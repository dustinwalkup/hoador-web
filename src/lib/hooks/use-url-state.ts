import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ToolSearchFilters } from "@/lib/dal/types";

export function useURLState<T extends Record<string, unknown>>(
  parser: (searchParams: URLSearchParams) => T,
  serializer: (state: Partial<T>) => Record<string, string>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current URL state
  const state = useMemo(() => {
    const parsed = parser(searchParams);
    console.log("URL state parsed:", parsed);
    return parsed;
  }, [searchParams, parser]);

  // Update URL state
  const updateState = useCallback(
    (updates: Partial<T>) => {
      console.log("URL state updating with:", updates);
      const params = new URLSearchParams(searchParams);
      const serialized = serializer(updates);

      Object.entries(serialized).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      // Clean up any old categoryId parameter
      params.delete("categoryId");

      // If categoryId is explicitly undefined in updates, remove the category parameter
      if (updates.categoryId === undefined) {
        params.delete("category");
      }

      // Reset pagination when filters change
      if (Object.keys(updates).some((key) => key !== "page")) {
        params.delete("page");
      }

      const newUrl = `${pathname}?${params.toString()}`;
      console.log("Navigating to:", newUrl);
      router.push(newUrl);
    },
    [router, pathname, searchParams, serializer],
  );

  return { state, updateState };
}

// Tool filters URL state hook
export function useToolFilters() {
  const parser = useCallback(
    (searchParams: URLSearchParams) => ({
      query: searchParams.get("q") || "",
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

  const serializer = useCallback((filters: Partial<ToolSearchFilters>) => {
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

    // Map categoryId to category for URL compatibility
    if (result.categoryId) {
      result.category = result.categoryId;
      delete result.categoryId;
    }

    console.log("Serializer input:", filters, "output:", result);
    return result;
  }, []);

  return useURLState(parser, serializer);
}
