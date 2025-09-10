export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { getCurrentUser } from "@/features/auth/auth.utils";
import { PageHeader } from "@/components/page-header";
import { ExplorePageSkeleton } from "./_components/explore-page-skeleton";
import { ExplorePageClient } from "./_components/explore-page-client";

export default async function ExplorePage() {
  const user = await getCurrentUser();

  return (
    <div className="container py-6">
      <PageHeader
        title="Explore Listings"
        description="Find listings available in your neighborhood"
      />

      <Suspense fallback={<ExplorePageSkeleton />}>
        <ExplorePageClient userId={user?.id} />
      </Suspense>
    </div>
  );
}
