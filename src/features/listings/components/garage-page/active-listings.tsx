"use client";

import Link from "next/link";
import { Plus, Settings, Package } from "lucide-react";

import { useMemo } from "react";
import { capitalize } from "@/lib/utils";
import { useActiveListings } from "@/features/listings/hooks/use-garage";
import type { GarageListingFilters } from "@/features/listings/hooks/use-garage";
import { applyGarageFilters } from "@/features/listings/utils/apply-garage-filters";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";
import { GarageLoadingSkeleton } from "./garage-loading-skeleton";
import { GarageError } from "./garage-error";
import { EmptyStateCoach } from "@/components/empty-state-coach";

function getStatus(status: string): "rented" | "listed" | "" {
  if (status === "available") return "listed";
  if (status === "rented") return "rented";
  return "";
}

interface ActiveListingsProps {
  filters: GarageListingFilters;
}

export function ActiveListings({ filters }: ActiveListingsProps) {
  const { data, isLoading, error, refetch } = useActiveListings();

  const activeListings = useMemo(
    () => applyGarageFilters(data ?? [], filters),
    [data, filters],
  );

  if (isLoading) {
    return <GarageLoadingSkeleton />;
  }

  if (error) {
    return <GarageError error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {activeListings.length > 0 ? (
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
        <div className="col-span-full">
          {filters.query || filters.categoryId || filters.rentalStatus ? (
            <div className="py-8 text-center">
              <div className="bg-muted mb-4 inline-flex rounded-full p-3">
                <Settings className="text-muted-foreground h-6 w-6" />
              </div>
              <p className="text-muted-foreground mb-2">
                No listings found matching your search criteria
              </p>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <EmptyStateCoach
              icon={Package}
              iconColor="text-primary/60"
              iconBg="bg-primary/10"
              headline="Start earning from things you already own"
              description="Most listings take under 2 minutes to set up"
              cta={{ label: "List an item", href: "/dashboard/listings/add" }}
            />
          )}
        </div>
      )}
      <Card className="items-center justify-center overflow-hidden border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <Plus className="text-primary h-6 w-6" />
          </div>
          <CardTitle className="mb-2 text-lg">List another item</CardTitle>
          <p className="text-muted-foreground mb-4 text-center text-sm">
            Share your tools with neighbors and earn extra income
          </p>
          <Button asChild>
            <Link href="/dashboard/listings/add">List an item</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
