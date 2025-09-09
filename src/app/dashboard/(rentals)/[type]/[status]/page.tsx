export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RentalsClient } from "../../_components/rentals-client";

interface RentalsPageProps {
  params: Promise<{
    type: "renting" | "lending";
    status: "requests" | "active" | "completed" | "rejected" | "incoming";
  }>;
}

// Valid routes configuration
const validRoutes: Record<string, string[]> = {
  renting: ["requests", "active", "completed", "rejected"],
  lending: ["incoming", "active", "completed", "rejected"],
};

function RentalsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="bg-muted h-10 w-full max-w-2xl animate-pulse rounded-lg" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center space-x-4">
              <div className="bg-muted h-16 w-16 animate-pulse rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
                <div className="bg-muted h-3 w-1/4 animate-pulse rounded" />
              </div>
              <div className="space-y-2">
                <div className="bg-muted h-8 w-20 animate-pulse rounded" />
                <div className="bg-muted h-6 w-16 animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function RentalsStatusPage({ params }: RentalsPageProps) {
  const { type, status } = await params;

  // Validate route parameters
  if (!validRoutes[type] || !validRoutes[type].includes(status)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<RentalsPageSkeleton />}>
        <RentalsClient
          initialType={type as "renting" | "lending"}
          initialStatus={status}
        />
      </Suspense>
    </div>
  );
}
