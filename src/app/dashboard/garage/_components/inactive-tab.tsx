import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import { getCurrentUser } from "@/features/authentication/auth.utils";
import { capitalize } from "@/lib/utils/utils";
import { listingDAL } from "@/dal";
import type { GarageListingFilters } from "@/dal/listing.dal";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";

function getStatus(): "rented" | "listed" | "" {
  // For inactive listings, we don't show the standard status
  return "";
}

interface InactiveTabProps {
  filters: GarageListingFilters;
}

export async function InactiveTab({ filters }: InactiveTabProps) {
  const user = await getCurrentUser();
  const inactiveListings = await listingDAL.getUserInactiveListingsWithFilters(
    user.id,
    filters,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {inactiveListings && inactiveListings.length > 0 ? (
        inactiveListings.map((listing) => (
          <RentalCard
            key={listing.id}
            id={listing.id}
            name={listing.name}
            imageUrl={listing.firstImageUrl}
            status={getStatus()}
            price={`$${listing.dailyRate}/day`}
            availability={capitalize(listing.status)}
            cardType="listings"
            listingData={{
              id: listing.id,
              name: listing.name,
              status: listing.status,
              isActive: listing.isActive,
            }}
          />
        ))
      ) : (
        <div className="col-span-full py-8 text-center">
          <div className="bg-muted mb-4 inline-flex rounded-full p-3">
            <Settings className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground mb-2">
            {filters.query || filters.categoryId
              ? "No inactive listings found matching your search criteria"
              : "No inactive listings"}
          </p>
          <p className="text-muted-foreground text-sm">
            {filters.query || filters.categoryId
              ? "Try adjusting your search or filters"
              : "Listings in maintenance or marked as inactive will appear here"}
          </p>
        </div>
      )}
      <Card className="items-center justify-center overflow-hidden border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <Plus className="text-primary h-6 w-6" />
          </div>
          <CardTitle className="mb-2 text-lg">List a New listing</CardTitle>
          <p className="text-muted-foreground mb-4 text-center text-sm">
            Share your tools with neighbors and earn extra income
          </p>
          <Button asChild>
            <Link href="/dashboard/listings/add">Add New Listing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
