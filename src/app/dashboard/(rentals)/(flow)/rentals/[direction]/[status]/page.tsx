export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { legalDocumentDAL, rentalDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { RentalsClient } from "@/features/rentals/components/renting-lending/rentals-client";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { getServerQueryClient, HydrateClient } from "@/lib/react-query/server";
import { rentalKeys } from "@/features/rentals/hooks/use-rentals";

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

/**
 * Prefetch the rental data for the active tab into the server query client.
 * Maps URL direction+status to the correct DAL call and React Query key.
 */
async function prefetchActiveTab(
  userId: string,
  type: "renting" | "lending",
  status: string,
) {
  const qc = getServerQueryClient();

  if (type === "renting") {
    switch (status) {
      case "requests": {
        const data = await rentalDAL.getRentalRequestsByStatus(
          "pending",
          userId,
        );
        qc.setQueryData(rentalKeys.rentingByStatus("requests-pending"), data);
        break;
      }
      case "approved": {
        const data = await rentalDAL.getRentalRequestsByStatus(
          "approved",
          userId,
        );
        qc.setQueryData(rentalKeys.rentingByStatus("requests-approved"), data);
        break;
      }
      case "denied": {
        const data = await rentalDAL.getRentalRequestsByStatus(
          "denied",
          userId,
        );
        qc.setQueryData(rentalKeys.rentingByStatus("requests-denied"), data);
        break;
      }
      case "cancelled": {
        const data = await rentalDAL.getRentalRequestsByStatus(
          "cancelled",
          userId,
        );
        qc.setQueryData(rentalKeys.rentingByStatus("requests-cancelled"), data);
        break;
      }
      case "active": {
        const data = await rentalDAL.getRentalsByStatus("active", userId);
        qc.setQueryData(rentalKeys.rentingByStatus("active"), data);
        break;
      }
      case "completed": {
        const data = await rentalDAL.getRentalsByStatus("completed", userId);
        qc.setQueryData(rentalKeys.rentingByStatus("completed"), data);
        break;
      }
    }
  } else {
    // lending
    const internalStatus = status === "incoming" ? "pending" : status;
    if (internalStatus === "active" || internalStatus === "completed") {
      const data = await rentalDAL.getLendingRentalsByStatus(
        internalStatus,
        userId,
      );
      qc.setQueryData(
        rentalKeys.lendingByStatus(`requests-${internalStatus}`),
        data,
      );
    } else {
      const data = await rentalDAL.getLendingRequestsByStatus(
        internalStatus as "pending" | "approved" | "denied" | "cancelled",
        userId,
      );
      qc.setQueryData(
        rentalKeys.lendingByStatus(`requests-${internalStatus}`),
        data,
      );
    }
  }
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

  // Fetch review policy and prefetch rental data in parallel
  const userId = await getCurrentUserId();

  async function fetchReviewPolicyUrl(): Promise<string | undefined> {
    try {
      const currentVersion = await legalDocumentDAL.getCurrentVersion(
        LEGAL_DOCUMENT_IDS.REVIEW_POLICY,
      );
      return currentVersion?.url;
    } catch (error) {
      console.error("Error fetching review policy:", error);
      return undefined;
    }
  }

  const promises: [Promise<string | undefined>, ...Promise<void>[]] = [
    fetchReviewPolicyUrl(),
  ];

  if (userId) {
    promises.push(prefetchActiveTab(userId, initialType, initialStatus));
  }

  const [reviewPolicyUrl] = await Promise.all(promises);

  return (
    <div className="space-y-6">
      <Suspense fallback={<RentalsPageSkeleton />}>
        <HydrateClient>
          <RentalsClient
            initialType={initialType}
            initialStatus={initialStatus}
            reviewPolicyUrl={reviewPolicyUrl}
          />
        </HydrateClient>
      </Suspense>
    </div>
  );
}
