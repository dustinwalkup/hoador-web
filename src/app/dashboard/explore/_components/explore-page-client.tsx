"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useListingFilters } from "@/features/listings/hooks/use-url-state";
import { useSearchListings } from "@/features/listings/hooks/use-listings";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ListingCardSkeleton } from "@/components/dashboard/listing-card-skeleton";
import { Button } from "@/components/ui/button";
import { ExplorePageFilters } from "./explore-page-filters";
import { ExplorePageContent } from "./explore-page-content";

interface ExplorePageClientProps {
  userId?: string;
}

export function ExplorePageClient({ userId }: ExplorePageClientProps) {
  // URL state management
  const { state: filters } = useListingFilters();

  // React Query with URL-based filters
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    isPending,
    error,
  } = useSearchListings(filters, userId);

  // Infinite scroll trigger
  const loadMoreRef = useInfiniteScroll({
    onLoadMore: fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    threshold: 500, // Increase threshold for better detection
  });

  // Flatten data from all pages with deduplication
  const allListings = useMemo(() => {
    if (!data?.pages || data.pages.length === 0) return [];

    const flattened = data.pages.flatMap((page) => page.data || []);

    // Deduplicate by listing ID to prevent duplicate key errors
    // Keep the first occurrence of each listing (most recent data)
    const seen = new Set<string>();
    const deduplicated = flattened.filter((listing) => {
      if (!listing?.id || seen.has(listing.id)) {
        return false;
      }
      seen.add(listing.id);
      return true;
    });

    return deduplicated;
  }, [data]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="mb-4 text-6xl">⚠️</div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          Failed to load listings
        </h3>
        <p className="mb-4 text-sm text-gray-600">{error.message}</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  // Show loading skeleton for initial load or when no cached data exists
  if (isLoading || (isPending && !data)) {
    return (
      <div className="space-y-6">
        <ExplorePageFilters />
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExplorePageFilters />

      {/* Show subtle loading indicator during filter changes */}
      <div className="relative">
        {isRefetching && (
          <div className="absolute -top-2 right-0 left-0 z-10 flex justify-center">
            <div className="bg-background/80 rounded-full border px-3 py-1 shadow-sm backdrop-blur-sm">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating results...
              </div>
            </div>
          </div>
        )}

        <ExplorePageContent listings={allListings} />
      </div>

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="flex h-32 justify-center py-8">
          {isFetchingNextPage ? (
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
          ) : (
            <div className="text-primary text-sm">Scroll to load more...</div>
          )}
        </div>
      )}
    </div>
  );
}
