import { getCurrentUser } from "@/lib/auth/auth-utils";
import { toolDAL } from "@/lib/dal";
import type { ToolSearchFilters } from "@/lib/dal/types";
import { ExplorePageFilters } from "./explore-page-filters";
import { ExplorePageContent } from "./explore-page-content";
import { PaginationControls } from "./pagination-controls";

interface ExplorePageDataProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    condition?: string;
    delivery?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  }>;
}

export async function ExplorePageData({ searchParams }: ExplorePageDataProps) {
  const user = await getCurrentUser();
  const categories = await toolDAL.getToolCategories();
  const params = await searchParams;

  // Parse search parameters
  const filters: ToolSearchFilters = {
    query: params.q || "",
    categoryId: params.category || undefined,
    minPrice: params.minPrice ? parseFloat(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
    condition: params.condition ? params.condition.split(",") : undefined,
    deliveryAvailable: params.delivery === "true",
    sortBy:
      (params.sortBy as "price" | "rating" | "distance" | "newest") || "newest",
    sortOrder: (params.sortOrder as "asc" | "desc") || "desc",
  };

  const pagination = {
    page: parseInt(params.page || "1"),
    limit: 12,
  };

  // Pass user.id only if user exists, otherwise pass undefined to show all tools
  const searchResults = await toolDAL.searchTools(
    filters,
    pagination,
    user?.id,
  );

  return (
    <>
      <ExplorePageFilters
        categories={categories}
        initialFilters={filters}
        totalResults={searchResults.pagination.total}
      />
      <div className="space-y-6">
        <ExplorePageContent tools={searchResults.data} />
        <PaginationControls pagination={searchResults.pagination} />
      </div>
    </>
  );
}
