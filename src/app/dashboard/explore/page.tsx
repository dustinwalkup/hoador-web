export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/page-header";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { ExplorePageClient } from "@/features/listings/components/explore-page/explore-page-client";
import { listingDAL } from "@/dal";
import { getCurrentUserVisibleCommunityIds } from "@/features/community/utils/membership";
import { getServerQueryClient, HydrateClient } from "@/lib/react-query/server";
import { sanitizeSearchQuery } from "@/lib/utils/sanitize";
import type { ListingSearchFilters } from "@/dal/types";

const PAGE_TITLE = "Browse nearby rentals";
const PAGE_DESCRIPTION = "Find listings available in your neighborhood";

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
};

interface ExplorePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Build the same serialized-filter cache key the client hook uses,
 * so the hydrated data lands in the right React Query slot.
 */
function buildCacheKey(
  filters: ListingSearchFilters,
  userId: string | undefined,
) {
  const serializedFilters = {
    query: filters.query || undefined,
    category: filters.categoryId || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    condition: filters.condition?.join(",") || undefined,
    deliveryMode: filters.deliveryMode || undefined,
    setupAvailable: filters.setupAvailable || false,
    availableNow: filters.availableNow || false,
    sortBy: filters.sortBy || "newest",
    sortOrder: filters.sortOrder || "desc",
    isDistanceSort: filters.sortBy === "distance" ? userId : undefined,
  };
  return ["search-listings", serializedFilters, userId];
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const [auth, visibleCommunityIds, params] = await Promise.all([
    getAuthenticatedUser(),
    getCurrentUserVisibleCommunityIds(),
    searchParams,
  ]);

  const userId = auth?.userId;
  const userIsAdmin = auth?.isAdmin ?? false;

  // Parse URL search params (same logic as useListingFilters + API route)
  const p = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : undefined;
  };

  const rawQuery = p("q");
  const filters: ListingSearchFilters = {
    query: rawQuery ? sanitizeSearchQuery(rawQuery) : undefined,
    categoryId: p("category") || undefined,
    minPrice: p("minPrice") ? parseFloat(p("minPrice")!) : undefined,
    maxPrice: p("maxPrice") ? parseFloat(p("maxPrice")!) : undefined,
    condition: p("condition")
      ? p("condition")!.split(",").filter(Boolean)
      : undefined,
    deliveryMode:
      (p("delivery") as "pickup_only" | "delivery_only" | "both_available") ||
      undefined,
    setupAvailable: p("setup") === "true" ? true : undefined,
    availableNow: p("availableNow") === "true" ? true : undefined,
    sortBy:
      (p("sortBy") as "price" | "rating" | "distance" | "newest") || "newest",
    sortOrder: (p("sortOrder") as "asc" | "desc") || "desc",
  };

  // Prefetch first page if user is authenticated and has visible communities
  if (userId && visibleCommunityIds.length > 0) {
    const qc = getServerQueryClient();
    const firstPage = await listingDAL.searchListings(
      filters,
      { page: 1, limit: 12 },
      userId,
      visibleCommunityIds,
      userIsAdmin,
    );

    const cacheKey = buildCacheKey(filters, userId);
    qc.setQueryData(cacheKey, {
      pages: [firstPage],
      pageParams: [1],
    });
  }

  return (
    <div className="container pb-6">
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <HydrateClient>
        <ExplorePageClient userId={userId} />
      </HydrateClient>
    </div>
  );
}
