import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeader } from "@/components/page-header";
import { ExplorePageSkeleton } from "../dashboard/explore/_components/explore-page-skeleton";
import { ExplorePageClient } from "./_components/explore-page-client";

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

export default async function PublicExplorePage({
  searchParams,
}: PublicExplorePageProps) {
  // Redirect authenticated users to dashboard explore
  const user = await getCurrentUser().catch(() => null);
  if (user?.id) {
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
      <PageHeader
        title="Explore Tools"
        description="Find tools available in your neighborhood"
      />

      <Suspense fallback={<ExplorePageSkeleton />}>
        <ExplorePageClient userId={user?.id} />
      </Suspense>
    </div>
  );
}
