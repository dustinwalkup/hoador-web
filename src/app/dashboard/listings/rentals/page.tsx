import { Suspense } from "react";
import { getCurrentUser } from "@/features/auth/utils/session";
import { GarageClient } from "@/features/listings/components/garage-page/garage-client";
import { InitiateStripeOnboarding } from "@/features/payments/components/initiate-stripe-onboarding";
import { PageHeader } from "@/components/page-header";
import { listingDAL } from "@/dal";
import { db } from "@/db/db";
import { listings } from "@/db/schemas/listings.schema";
import { eq } from "drizzle-orm";
import { getServerQueryClient, HydrateClient } from "@/lib/react-query/server";
import { garageKeys } from "@/features/listings/hooks/garage-keys";

export const metadata = {
  title: "Listings – Rentals | Hoador",
  description: "Manage your rental listings, availability, and inventory.",
};

export default async function ListingsRentalsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <div>Loading...</div>;
  }

  const isOnboarded =
    user.connectChargesEnabled &&
    user.connectPayoutsEnabled &&
    user.connectOnboardingComplete;

  if (!isOnboarded) {
    return (
      <div className="container pb-6">
        <>
          <div className="container pb-6">
            <PageHeader
              title="Your rental listings"
              description="Manage your rental listings in one place"
            />
            <InitiateStripeOnboarding />{" "}
          </div>{" "}
        </>
      </div>
    );
  }

  const qc = getServerQueryClient();

  const [activeListings, inactiveListings, pendingListings, rejectedListings] =
    await Promise.all([
      listingDAL.getUserActiveListingsWithFilters(user.id, {}),
      listingDAL.getUserInactiveListingsWithFilters(user.id, {}),
      listingDAL.getUserListingsByApprovalStatus("pending_review", user.id),
      listingDAL.getUserListingsByApprovalStatus("rejected", user.id),
    ]);

  // Build pending-review data with the same transformation as the API route
  const rejectedListingIds = rejectedListings.map((l) => l.id);
  const rejectionReasonsMap = new Map<string, string | null>();
  if (rejectedListingIds.length > 0) {
    const rejectionData = await db
      .select({
        id: listings.id,
        rejectionReason: listings.rejectionReason,
      })
      .from(listings)
      .where(eq(listings.ownerId, user.id));

    rejectionData.forEach((item) => {
      if (rejectedListingIds.includes(item.id)) {
        rejectionReasonsMap.set(item.id, item.rejectionReason);
      }
    });
  }

  const pendingReviewListings = [
    ...pendingListings.map((listing) => ({
      ...listing,
      approvalStatus: "pending_review" as const,
      rejectionReason: undefined as string | undefined,
    })),
    ...rejectedListings.map((listing) => ({
      ...listing,
      approvalStatus: "rejected" as const,
      rejectionReason: rejectionReasonsMap.get(listing.id) || undefined,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const pendingCount = pendingListings.length + rejectedListings.length;

  qc.setQueryData(garageKeys.active(), activeListings);
  qc.setQueryData(garageKeys.inactive(), inactiveListings);
  qc.setQueryData(garageKeys.pendingReview(), pendingReviewListings);
  qc.setQueryData(garageKeys.pendingCount(), pendingCount);

  return (
    <div className="container pb-6">
      <Suspense fallback={null}>
        <HydrateClient>
          <GarageClient />
        </HydrateClient>
      </Suspense>
    </div>
  );
}
