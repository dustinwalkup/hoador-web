"use client";

import Link from "next/link";
import { Plus, Clock } from "lucide-react";

import { usePendingReviewListings } from "@/features/listings/hooks/use-garage";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";
import { GarageLoadingSkeleton } from "./garage-loading-skeleton";
import { GarageError } from "./garage-error";

function getStatus(): "rented" | "listed" | "" {
  // For pending review listings, we don't show the standard status
  return "";
}

interface PendingReviewListing {
  id: string;
  name: string;
  firstImageUrl: string | null;
  dailyRate: number;
  status: string;
  isActive: boolean;
  approvalStatus: "pending_review" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: Date;
}

export function PendingReviewListings() {
  const {
    data: pendingListings,
    isLoading,
    error,
    refetch,
  } = usePendingReviewListings();

  if (isLoading) {
    return <GarageLoadingSkeleton />;
  }

  if (error) {
    return <GarageError error={error} onRetry={() => refetch()} />;
  }

  // API now returns UserListing[] with approvalStatus and rejectionReason added
  const listings = (pendingListings || []) as unknown as PendingReviewListing[];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings && listings.length > 0 ? (
        listings.map((listing) => (
          <RentalCard
            key={listing.id}
            id={listing.id}
            name={listing.name}
            imageUrl={listing.firstImageUrl}
            status={getStatus()}
            price={`$${listing.dailyRate}/day`}
            availability={undefined}
            cardType="listings"
            approvalStatus={listing.approvalStatus}
            rejectionReason={listing.rejectionReason}
            listingData={{
              id: listing.id,
              name: listing.name,
              status: listing.status as
                | "available"
                | "rented"
                | "maintenance"
                | "inactive",
              isActive: listing.isActive,
            }}
          />
        ))
      ) : (
        <div className="col-span-full py-8 text-center">
          <div className="bg-muted mb-4 inline-flex rounded-full p-3">
            <Clock className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground mb-2">
            No listings pending review
          </p>
          <p className="text-muted-foreground text-sm">
            Listings awaiting admin approval or that have been rejected will
            appear here
          </p>
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
