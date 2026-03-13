"use client";

import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import { capitalize } from "@/lib/utils";
import { useActiveListings } from "@/features/listings/hooks/use-garage";
import type { GarageListingFilters } from "@/features/listings/hooks/use-garage";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";
import { GarageLoadingSkeleton } from "./garage-loading-skeleton";
import { GarageError } from "./garage-error";

function getStatus(status: string): "rented" | "listed" | "" {
  if (status === "available") return "listed";
  if (status === "rented") return "rented";
  return "";
}

interface ActiveListingsProps {
  filters: GarageListingFilters;
}

export function ActiveListings({ filters }: ActiveListingsProps) {
  const {
    data: activeListings,
    isLoading,
    error,
    refetch,
  } = useActiveListings(filters);

  if (isLoading) {
    return <GarageLoadingSkeleton />;
  }

  if (error) {
    return <GarageError error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {activeListings && activeListings.length > 0 ? (
        activeListings.map((listing) => (
          <RentalCard
            key={listing.id}
            id={listing.id}
            name={listing.name}
            imageUrl={listing.firstImageUrl}
            status={getStatus(listing.status)}
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
            {filters.query || filters.categoryId || filters.rentalStatus
              ? "No listings found matching your search criteria"
              : "No active listings"}
          </p>
          <p className="text-muted-foreground text-sm">
            {filters.query || filters.categoryId || filters.rentalStatus
              ? "Try adjusting your search or filters"
              : "Listings you've listed and are currently available for rent will appear here"}
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
