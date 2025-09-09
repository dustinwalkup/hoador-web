"use client";

import Link from "next/link";
import { Plus, Archive } from "lucide-react";

import { useArchivedListings } from "@/features/listings/hooks/use-garage";
import type { GarageListingFilters } from "@/features/listings/hooks/use-garage";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";
import { GarageLoadingSkeleton } from "./garage-loading-skeleton";
import { GarageError } from "./garage-error";

function getStatus(): "rented" | "listed" | "" {
  // For archived listings, we don't show the standard status
  return "";
}

interface ArchivedListingsProps {
  filters: GarageListingFilters;
}

export function ArchivedListings({ filters }: ArchivedListingsProps) {
  const {
    data: archivedListings,
    isLoading,
    error,
    refetch,
  } = useArchivedListings(filters);

  if (isLoading) {
    return <GarageLoadingSkeleton />;
  }

  if (error) {
    return <GarageError error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {archivedListings && archivedListings.length > 0 ? (
        archivedListings.map((listing) => (
          <RentalCard
            key={listing.id}
            id={listing.id}
            name={listing.name}
            imageUrl={listing.firstImageUrl}
            status={getStatus()}
            price={`$${listing.dailyRate}/day`}
            availability="Archived"
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
            <Archive className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground mb-2">
            {filters.query || filters.categoryId
              ? "No archived listings found matching your search criteria"
              : "No archived listings"}
          </p>
          <p className="text-muted-foreground text-sm">
            {filters.query || filters.categoryId
              ? "Try adjusting your search or filters"
              : "Listings you&apos;ve archived will appear here"}
          </p>
        </div>
      )}
      <Card className="items-center justify-center overflow-hidden border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <Plus className="text-primary h-6 w-6" />
          </div>
          <CardTitle className="mb-2 text-lg">List a New Listing</CardTitle>
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
