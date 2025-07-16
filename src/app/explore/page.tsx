import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { toolDAL } from "@/lib/dal";
import type { ToolSearchFilters } from "@/lib/dal/types";
import { ExplorePageFilters } from "../dashboard/explore/_components/explore-page-filters";
import { ExplorePageContent } from "../dashboard/explore/_components/explore-page-content";
import { PaginationControls } from "../dashboard/explore/_components/pagination-controls";
import { ExplorePageSkeleton } from "../dashboard/explore/_components/explore-page-skeleton";

interface PublicExplorePageProps {
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

async function PublicExploreData({ searchParams }: PublicExplorePageProps) {
  // Allow both authenticated and unauthenticated users
  const user = await getCurrentUser().catch(() => null);
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
        basePath="/explore"
      />
      <div className="space-y-6">
        <ExplorePageContent tools={searchResults.data} basePath="/explore" />
        <PaginationControls
          pagination={searchResults.pagination}
          basePath="/explore"
        />
      </div>
    </>
  );
}

export default async function PublicExplorePage({
  searchParams,
}: PublicExplorePageProps) {
  // Redirect authenticated users to dashboard explore
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    const params = await searchParams;
    const queryString = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    const redirectUrl = queryString
      ? `/dashboard/explore?${queryString}`
      : "/dashboard/explore";
    redirect(redirectUrl);
  }

  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Explore Tools</h1>
          <p className="text-muted-foreground">
            Find tools available in your neighborhood
          </p>
        </div>
      </div>

      <Suspense fallback={<ExplorePageSkeleton />}>
        <PublicExploreData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
