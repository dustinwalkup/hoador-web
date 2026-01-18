export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentalsClient } from "@/features/rentals/components/renting-lending/rentals-client";

export const metadata = {
  title: "Rentals",
  description: "View and manage your rental requests and active rentals",
};

interface RentalsPageProps {
  params: Promise<{
    type: "renting" | "lending";
    status: "requests" | "active" | "completed" | "denied" | "incoming";
  }>;
}

// Valid routes configuration
const validRoutes: Record<string, string[]> = {
  renting: ["requests", "approved", "active", "completed", "denied"],
  lending: ["incoming", "approved", "active", "completed", "denied"],
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

  // Fetch the review policy document
  let reviewPolicyUrl: string | undefined;
  try {
    const currentVersion = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.REVIEW_POLICY,
    );
    if (currentVersion) {
      reviewPolicyUrl = currentVersion.url;
    }
  } catch (error) {
    // If there's an error fetching, continue without the URL
    console.error("Error fetching review policy:", error);
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<RentalsPageSkeleton />}>
        <RentalsClient
          initialType={type as "renting" | "lending"}
          initialStatus={status}
          reviewPolicyUrl={reviewPolicyUrl}
        />
      </Suspense>
    </div>
  );
}
