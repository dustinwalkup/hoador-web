"use client";

import Image from "next/image";
import { PendingReviewListing, ReviewedListing } from "@/dal/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ApproveRejectDialog } from "./approve-reject-dialog";
import { formatDistanceToNow } from "date-fns";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";
import { formatActorName } from "@/lib/utils";
import { useState } from "react";
import {
  OwnerInformation,
  type AdminOwnerInformationRating,
} from "./owner-information";
import { ReviewHistoryMetadata } from "./review-history-metadata";

interface ListingReviewCardProps {
  listing: PendingReviewListing | ReviewedListing;
  showReviewMetadata?: boolean;
}

export function ListingReviewCard({
  listing,
  showReviewMetadata = false,
}: ListingReviewCardProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const isReviewed = "approvalStatus" in listing;
  const reviewedListing = isReviewed ? listing : null;

  // Sort images by orderIndex
  const sortedImages = [...listing.images].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  };

  const reviewEvents = listing.reviewEvents ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">
              {sanitizeForDisplay(listing.name)}
            </CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {sanitizeForDisplay(listing.category.name)}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {listing.condition}
              </Badge>
              {isReviewed && (
                <Badge
                  variant={
                    reviewedListing!.approvalStatus === "approved"
                      ? "default"
                      : "secondary"
                  }
                  className={
                    reviewedListing!.approvalStatus === "approved"
                      ? "flex items-center gap-1"
                      : "flex items-center gap-1 border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                  }
                >
                  {reviewedListing!.approvalStatus === "approved" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Approved
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Revisions Requested
                    </>
                  )}
                </Badge>
              )}
            </div>
          </div>
          {!isReviewed && (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setApproveDialogOpen(true)}
                className="bg-primary hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setRejectDialogOpen(true)}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Request Revisions
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="w-full space-y-6">
        {/* Review Metadata */}
        {reviewEvents.length > 0 && (
          <div className="bg-muted/50 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Review history</h3>
              <span className="text-muted-foreground text-xs">
                {reviewEvents.length} entr
                {reviewEvents.length === 1 ? "y" : "ies"}
              </span>
            </div>

            <div className="space-y-3">
              {reviewEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-background rounded-md border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {event.eventType === "provider_resubmitted"
                            ? "Resubmitted"
                            : event.eventType}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>

                      <div className="text-muted-foreground mt-1 text-xs">
                        By {formatActorName(event.actor)}
                      </div>
                    </div>
                  </div>

                  {event.note && event.note.trim().length > 0 && (
                    <div className="mt-2 text-sm whitespace-pre-wrap">
                      <span className="font-medium">Note:</span>{" "}
                      <span>{sanitizeForDisplay(event.note)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {showReviewMetadata && reviewedListing && (
          <div className="bg-muted/50 rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ReviewHistoryMetadata
                submittedAt={reviewedListing.createdAt}
                reviewedBy={reviewedListing.reviewedBy}
                reviewedAt={reviewedListing.reviewedAt}
              />
            </div>
          </div>
        )}

        {/* Listing Images */}
        {sortedImages.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Images ({sortedImages.length})
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sortedImages.map((image, index) => (
                <div
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded-lg border"
                >
                  <Image
                    src={image.imageUrl}
                    alt={`${listing.name} - Image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  {index === 0 && (
                    <Badge
                      className="absolute top-2 left-2 text-xs"
                      variant="secondary"
                    >
                      Main
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Listing Details */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Listing Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="text-sm font-medium">Description:</span>
              <p className="text-muted-foreground mt-1 text-sm">
                {sanitizeForDisplay(listing.description)}
              </p>
            </div>
            {listing.brand && (
              <div>
                <span className="text-sm font-medium">Brand:</span>
                <p className="text-muted-foreground mt-1 text-sm">
                  {sanitizeForDisplay(listing.brand)}
                </p>
              </div>
            )}
            {listing.model && (
              <div>
                <span className="text-sm font-medium">Model:</span>
                <p className="text-muted-foreground mt-1 text-sm">
                  {sanitizeForDisplay(listing.model)}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm font-medium">Daily Rate:</span>
              <p className="mt-1 text-sm font-semibold">
                {formatCurrency(listing.dailyRate)}
              </p>
            </div>
            {listing.weeklyRate && (
              <div>
                <span className="text-sm font-medium">Weekly Rate:</span>
                <p className="mt-1 text-sm font-semibold">
                  {formatCurrency(listing.weeklyRate)}
                </p>
              </div>
            )}
            {listing.monthlyRate && (
              <div>
                <span className="text-sm font-medium">Monthly Rate:</span>
                <p className="mt-1 text-sm font-semibold">
                  {formatCurrency(listing.monthlyRate)}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm font-medium">Security Deposit:</span>
              <p className="mt-1 text-sm font-semibold">
                {formatCurrency(listing.securityDeposit)}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium">Delivery Fee:</span>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatCurrency(listing.deliveryFee)}
              </p>
            </div>
            {listing.setupFee > 0 && (
              <div>
                <span className="text-sm font-medium">Setup Fee:</span>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatCurrency(listing.setupFee)}
                </p>
              </div>
            )}
            <div className="col-span-full">
              <span className="text-sm font-medium">Created:</span>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatDate(listing.createdAt)}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <OwnerInformation
          owner={{
            firstName: listing.owner.firstName,
            lastName: listing.owner.lastName,
            profileImageUrl: listing.owner.profileImageUrl,
            isVerified: listing.owner.isVerified,
            email: listing.owner.email,
            createdAt: listing.owner.createdAt,
            otherListingsCount: listing.owner.otherListingsCount,
          }}
          rating={
            {
              averageRating: listing.owner.rentalHistory.averageRating,
              totalCount: listing.owner.rentalHistory.totalRentals,
              totalCountNoun: "rental",
            } satisfies AdminOwnerInformationRating
          }
        />
      </CardContent>

      {/* Dialogs */}
      {!isReviewed && (
        <>
          <ApproveRejectDialog
            listingId={listing.id}
            listingName={listing.name}
            action="approve"
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
          />
          <ApproveRejectDialog
            listingId={listing.id}
            listingName={listing.name}
            action="reject"
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
          />
        </>
      )}
    </Card>
  );
}
