import Link from "next/link";
import { Button } from "@/components/ui/button";
import ListingCard from "@/components/dashboard/listing-card";
import type { UserListing } from "@/dal/listing.dal";

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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
          <div className="mb-4 text-6xl">🔍</div>
          <h3 className="mb-2 text-lg font-semibold">No listings found</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            We couldn&apos;t find any listings matching your search criteria.
            Try adjusting your filters or search terms.
          </p>
          <Button variant="outline" asChild>
            <Link href={basePath}>Clear all filters</Link>
          </Button>
        </div>
      )}
    </>
  );
}
