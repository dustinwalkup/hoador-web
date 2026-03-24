import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export type ServiceSortKey =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating_desc";

export interface ServiceBrowseFilterState {
  query: string | undefined;
  categoryId: string | undefined;
  minPrice: string;
  maxPrice: string;
  pricingTypes: Array<"hourly" | "fixed">;
  sortBy: ServiceSortKey;
}

export function useServiceBrowseFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<ServiceBrowseFilterState>(
    () => ({
      query: searchParams.get("q") || undefined,
      categoryId: searchParams.get("category") || undefined,
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      pricingTypes: searchParams.get("pricingType")
        ? (searchParams.get("pricingType")!.split(",").filter(Boolean) as Array<
            "hourly" | "fixed"
          >)
        : [],
      sortBy: (searchParams.get("sort") as ServiceSortKey) || "newest",
    }),
    [searchParams],
  );

  const updateState = useCallback(
    (updates: Partial<ServiceBrowseFilterState>) => {
      const params = new URLSearchParams(searchParams);

      if ("query" in updates) {
        if (updates.query) params.set("q", updates.query);
        else params.delete("q");
      }
      if ("categoryId" in updates) {
        if (updates.categoryId) params.set("category", updates.categoryId);
        else params.delete("category");
      }
      if ("minPrice" in updates) {
        if (updates.minPrice) params.set("minPrice", updates.minPrice);
        else params.delete("minPrice");
      }
      if ("maxPrice" in updates) {
        if (updates.maxPrice) params.set("maxPrice", updates.maxPrice);
        else params.delete("maxPrice");
      }
      if ("pricingTypes" in updates) {
        if (updates.pricingTypes && updates.pricingTypes.length > 0)
          params.set("pricingType", updates.pricingTypes.join(","));
        else params.delete("pricingType");
      }
      if ("sortBy" in updates) {
        if (updates.sortBy && updates.sortBy !== "newest")
          params.set("sort", updates.sortBy);
        else params.delete("sort");
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return { state, updateState };
}
