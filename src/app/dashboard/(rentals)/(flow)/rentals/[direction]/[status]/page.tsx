export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { legalDocumentDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentalsClient } from "@/features/rentals/components/renting-lending/rentals-client";

export const metadata = {
  title: "Rentals",
  description: "View and manage your rental requests and active rentals",
};

interface RentalsPageProps {
  params: Promise<{
    direction: "incoming" | "outgoing";
    status:
      | "requests"
      | "approved"
      | "active"
      | "completed"
      | "denied"
      | "cancelled";
  }>;
}

// Valid routes: incoming = lending (owner), outgoing = renting (renter)
// For incoming (lending): status "requests" maps to internal "incoming"
const validStatusByDirection: Record<string, string[]> = {
  incoming: [
    "requests",
    "approved",
    "active",
    "completed",
    "denied",
    "cancelled",
  ],
  outgoing: [
    "requests",
    "approved",
    "active",
    "completed",
    "denied",
    "cancelled",
  ],
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

/** Map URL direction+status to internal type and status for RentalsClient */
function mapToInternalType(
  direction: string,
  status: string,
): { type: "renting" | "lending"; status: string } {
  if (direction === "incoming") {
    // Lending = owner view; "requests" in URL = "incoming" internally
    return {
      type: "lending",
      status: status === "requests" ? "incoming" : status,
    };
  }
  // Outgoing = renting = renter view
  return { type: "renting", status };
}

export default async function RentalsStatusPage({ params }: RentalsPageProps) {
  const { direction, status } = await params;

  // Validate route parameters
  if (
    !validStatusByDirection[direction] ||
    !validStatusByDirection[direction].includes(status)
  ) {
    notFound();
  }

  const { type: initialType, status: initialStatus } = mapToInternalType(
    direction,
    status,
  );

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
          initialType={initialType}
          initialStatus={initialStatus}
          reviewPolicyUrl={reviewPolicyUrl}
        />
      </Suspense>
    </div>
  );
}
