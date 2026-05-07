"use client";

import Link from "next/link";
import { Plus, Clock } from "lucide-react";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useMyServiceListings } from "@/features/services/hooks/use-service-listings";

import type { ServiceListingFilters } from "./active-service-listings";
import { ServiceListingCardWithManage } from "./service-listing-card-with-manage";
import { MyListingsLoadingSkeleton } from "./my-listings-loading-skeleton";
import { MyListingsError } from "./my-listings-error";
import type { ServiceListing } from "@/db/schemas/services.schema";

function applyFilters(
  listings: ServiceListing[],
  filters: ServiceListingFilters,
): ServiceListing[] {
  let result = [...listings];
  if (filters.query) {
    const q = filters.query.toLowerCase();
    result = result.filter((l) => l.title.toLowerCase().includes(q));
  }
  if (filters.categoryId) {
    result = result.filter((l) => l.categoryId === filters.categoryId);
  }
  if (filters.sortBy === "name-asc") {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else if (filters.sortBy === "name-desc") {
    result.sort((a, b) => b.title.localeCompare(a.title));
  } else {
    result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return result;
}

interface PendingServiceListingsProps {
  filters: ServiceListingFilters;
}

export function PendingServiceListings({
  filters,
}: PendingServiceListingsProps) {
  const {
    data: pendingApproval,
    isLoading: loadingPending,
    error: errorPending,
    refetch: refetchPending,
  } = useMyServiceListings("pending_approval");

  const {
    data: denied,
    isLoading: loadingDenied,
    error: errorDenied,
    refetch: refetchDenied,
  } = useMyServiceListings("denied");

  if (loadingPending || loadingDenied) return <MyListingsLoadingSkeleton />;

  if (errorPending)
    return (
      <MyListingsError error={errorPending} onRetry={() => refetchPending()} />
    );
  if (errorDenied)
    return (
      <MyListingsError error={errorDenied} onRetry={() => refetchDenied()} />
    );

  const combined = [...(pendingApproval ?? []), ...(denied ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const listings = applyFilters(combined, filters);
  const hasFilters = filters.query || filters.categoryId;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.length > 0 ? (
        listings.map((listing) => (
          <ServiceListingCardWithManage key={listing.id} listing={listing} />
        ))
      ) : (
        <div className="col-span-full py-8 text-center">
          <div className="bg-muted mb-4 inline-flex rounded-full p-3">
            <Clock className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground mb-2">
            {hasFilters
              ? "No listings found matching your search criteria"
              : "No listings pending review"}
          </p>
          <p className="text-muted-foreground text-sm">
            {hasFilters
              ? "Try adjusting your search or filters"
              : "Listings awaiting admin approval or with revisions requested will appear here"}
          </p>
        </div>
      )}
      <Card className="items-center justify-center overflow-hidden border-dashed py-0">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <Plus className="text-primary h-6 w-6" />
          </div>
          <CardTitle className="mb-2 text-lg">List another service</CardTitle>
          <p className="text-muted-foreground mb-4 text-center text-sm">
            Offer your skills to your community
          </p>
          <Button asChild>
            <Link href="/dashboard/services/listings/create">
              List a service
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
