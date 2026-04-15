import ListingCard from "@/components/dashboard/listing-card";
import type { UserListing } from "@/dal/listing.dal";
import { ExplorePageEmptyWithGuide } from "@/features/listings/components/explore-page/explore-page-empty-with-guide";

interface ExplorePageContentProps {
  listings: UserListing[];
  basePath?: string; // Default to /dashboard/explore for backward compatibility
}

// 7 days in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Compute "one week ago" threshold at module load time (stable across renders)
// This is acceptable because "new" status doesn't need real-time precision
const oneWeekAgoTimestamp = Date.now() - SEVEN_DAYS_MS;

export function ExplorePageContent({
  listings,
  basePath = "/dashboard/explore",
}: ExplorePageContentProps) {
  return (
    <>
      {listings.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              id={listing.id}
              name={listing.name}
              price={`$${listing.dailyRate}/day`}
              distance={listing.distanceMiles}
              rating={listing.averageRating}
              reviews={listing.reviewCount}
              imageUrl={listing.firstImageUrl || "/images/placeholder.jpg"}
              isNew={
                new Date(listing.createdAt).getTime() > oneWeekAgoTimestamp
              }
              status={listing.status}
            />
          ))}
        </div>
      ) : (
        <ExplorePageEmptyWithGuide basePath={basePath} />
      )}
    </>
  );
}
