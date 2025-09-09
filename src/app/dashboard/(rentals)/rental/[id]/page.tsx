export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { RentalDetailsClient } from "../../_components/rental-details-client";

interface RentalDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

function RentalDetailsPageSkeleton() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center space-x-4">
          <div className="bg-muted h-20 w-20 animate-pulse rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-6 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
            <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-10 w-24 animate-pulse rounded" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="bg-muted h-8 w-32 animate-pulse rounded" />
          <div className="bg-muted h-40 w-full animate-pulse rounded" />
          <div className="bg-muted h-32 w-full animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}

export default async function RentalDetailPage({
  params,
  searchParams,
}: RentalDetailPageProps) {
  const { id } = await params;
  const { view } = await searchParams;

  return (
    <Suspense fallback={<RentalDetailsPageSkeleton />}>
      <RentalDetailsClient rentalId={id} view={view} />
    </Suspense>
  );
}
