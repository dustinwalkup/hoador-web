import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        title="Explore Tools"
        description="Find tools available in your neighborhood"
      />

      <Suspense fallback={<ExplorePageSkeleton />}>
        <ExplorePageData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
