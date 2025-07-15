import { Suspense } from "react";
import { ExplorePageSkeleton } from "./_components/explore-page-skeleton";
import { ExplorePageData } from "./_components/explore-page-data";

interface ExplorePageProps {
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

export default function ExplorePage({ searchParams }: ExplorePageProps) {
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
        <ExplorePageData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
