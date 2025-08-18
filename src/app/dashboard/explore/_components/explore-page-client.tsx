"use client";

import { useMemo } from "react";
import { useToolFilters } from "@/hooks/use-url-state";
import { useSearchTools } from "@/hooks/use-tools";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ExplorePageFilters } from "./explore-page-filters";
import { ExplorePageContent } from "./explore-page-content";
import { ToolCardSkeleton } from "@/components/dashboard/tool-card-skeleton";

interface ExplorePageClientProps {
  userId?: string;
}

export function ExplorePageClient({ userId }: ExplorePageClientProps) {
  // URL state management
  const { state: filters } = useToolFilters();

  // React Query with URL-based filters
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
  } = useSearchTools(filters, userId);

  // Infinite scroll trigger
  const loadMoreRef = useInfiniteScroll({
    onLoadMore: fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    threshold: 500, // Increase threshold for better detection
  });

  // Flatten data from all pages
  const allTools = useMemo(() => {
    return data?.pages?.flatMap((page) => page.data) || [];
  }, [data]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="mb-4 text-6xl">⚠️</div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          Failed to load tools
        </h3>
        <p className="mb-4 text-sm text-gray-600">{error.message}</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ExplorePageFilters />
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ToolCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExplorePageFilters />
      <ExplorePageContent tools={allTools} />

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
