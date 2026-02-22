"use client";

import Image from "next/image";
import { PendingReviewListing, ReviewedListing } from "@/dal/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  Star,
  Package,
} from "lucide-react";
import { ApproveRejectDialog } from "./approve-reject-dialog";
import { formatDistanceToNow } from "date-fns";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";
import { useState } from "react";

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
                      : "destructive"
                  }
                  className="flex items-center gap-1"
                >
                  {reviewedListing!.approvalStatus === "approved" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Approved
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Rejected
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
                variant="destructive"
                size="sm"
                onClick={() => setRejectDialogOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Review Metadata */}
        {showReviewMetadata && reviewedListing && (
          <div className="bg-muted/50 rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {reviewedListing.reviewedBy && (
                <div>
                  <span className="text-sm font-medium">Reviewed by:</span>
                  <div className="text-muted-foreground text-sm">
                    {reviewedListing.reviewedBy.firstName}{" "}
                    {reviewedListing.reviewedBy.lastName}
                  </div>
                </div>
              )}
              {reviewedListing.reviewedAt && (
                <div>
                  <span className="text-sm font-medium">Reviewed at:</span>
                  <div className="text-muted-foreground text-sm">
                    {formatDate(reviewedListing.reviewedAt)}
                  </div>
                </div>
              )}
              {reviewedListing.rejectionReason && (
                <div className="col-span-full">
                  <span className="text-sm font-medium">Rejection reason:</span>
                  <div className="border-destructive/20 bg-destructive/5 mt-1 rounded-md border p-3 text-sm">
                    {sanitizeForDisplay(reviewedListing.rejectionReason)}
                  </div>
                </div>
              )}
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

        {/* Owner Information */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Owner Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              {listing.owner.profileImageUrl ? (
                <Image
                  src={listing.owner.profileImageUrl}
                  alt={`${listing.owner.firstName} ${listing.owner.lastName}`}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-sm font-semibold">
                    {listing.owner.firstName.charAt(0)}
                    {listing.owner.lastName.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {listing.owner.firstName} {listing.owner.lastName}
                  </span>
                  {listing.owner.isVerified && (
                    <Badge variant="default" className="text-xs">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                  <Mail className="h-3 w-3" />
                  {listing.owner.email}
                </div>
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3" />
                  Joined {formatDate(listing.owner.createdAt)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">
                  <span className="font-medium">
                    {listing.owner.otherListingsCount}
                  </span>{" "}
                  other listing
                  {listing.owner.otherListingsCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">
                  <span className="font-medium">
                    {listing.owner.rentalHistory.averageRating.toFixed(1)}
                  </span>{" "}
                  average rating (
                  <span className="font-medium">
                    {listing.owner.rentalHistory.totalRentals}
                  </span>{" "}
                  rental
                  {listing.owner.rentalHistory.totalRentals !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
          </div>
        </div>
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
