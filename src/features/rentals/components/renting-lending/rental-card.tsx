"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import type { RentalRequestItem, BorrowedListing } from "@/dal/rentals.dal";
import { CancelRequestDialog } from "./cancel-request-dialog";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "approved":
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    case "denied":
    case "cancelled":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
    case "active":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "denied":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface RentalCardProps {
  rental: RentalRequestItem | BorrowedListing;
  variant: "request" | "active";
}

// Type guard to check if rental is a request
function isRentalRequest(
  rental: RentalRequestItem | BorrowedListing,
): rental is RentalRequestItem {
  return "message" in rental || "denialReason" in rental;
}

export function RentalCard({ rental, variant }: RentalCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const isRequest = isRentalRequest(rental);

  // Calculate total days for active rentals (requests already have it)
  const totalDays = isRequest
    ? rental.totalDays
    : Math.ceil(
        (new Date(rental.endDate).getTime() -
          new Date(rental.startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

  return (
    <Card>
      <CardContent className="p-6">
        {/* Mobile Layout (Vertical) */}
        <div className="md:hidden">
          {/* Image Section */}
          <div className="relative mb-4 w-full">
            <Image
              src={rental.listingImageUrl || "/images/placeholder.jpg"}
              alt={rental.listingName}
              width={400}
              height={300}
              className="h-48 w-full rounded-lg object-cover"
            />
          </div>

          {/* Content Section */}
          <div>
            {/* Listing Information */}
            <div className="mb-4">
              <h3 className="mb-1 text-xl font-bold text-gray-900">
                {rental.listingName}
              </h3>
              <p className="mb-3 text-sm text-gray-600">
                {variant === "active" ? "by " : ""}
                {rental.ownerName}
              </p>

              {/* Status and Price Row */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(rental.status)}
                  <Badge className={getStatusColor(rental.status)}>
                    {rental.status}
                  </Badge>
                </div>
                <div className="text-xl font-bold text-green-600">
                  ${parseFloat(rental.totalAmount).toFixed(2)}
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(rental.startDate).toLocaleDateString()} to{" "}
                  {new Date(rental.endDate).toLocaleDateString()}
                  {variant === "request" && ` (${totalDays} days)`}
                </span>
              </div>

              {/* Daily Rate for active rentals */}
              {variant === "active" && "dailyRate" in rental && (
                <div className="mb-4 text-sm text-gray-700">
                  ${parseFloat(rental.dailyRate).toFixed(2)}/day
                </div>
              )}

              {/* Delivery Info for requests */}
              {isRequest && rental.deliveryRequested && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
                  <MapPin className="h-4 w-4" />
                  <span>Delivery requested</span>
                </div>
              )}
            </div>

            {/* Denial Reason */}
            {isRequest && rental.status === "denied" && rental.denialReason && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  <strong>Denial reason:</strong> {rental.denialReason}
                </p>
              </div>
            )}

            {/* Message Section for requests */}
            {isRequest && rental.message && (
              <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-sm font-semibold text-blue-800">
                  Your message:
                </p>
                <p className="text-sm text-blue-700">{rental.message}</p>
              </div>
            )}

            {/* Action Buttons - Vertical Stack */}
            <div className="space-y-3">
              <Link
                href={`/dashboard/rental/${rental.id}?view=renting`}
                className="block"
              >
                <Button variant="outline" className="w-full justify-center">
                  View Details
                </Button>
              </Link>

              <Link href={`/listings/${rental.listingId}`} className="block">
                <Button variant="outline" className="w-full justify-center">
                  View Listing
                </Button>
              </Link>

              <Button variant="outline" className="w-full justify-center">
                <MessageCircle className="mr-2 h-4 w-4" />
                Message Owner
              </Button>

              {/* Request-specific actions */}
              {variant === "request" && rental.status === "pending" && (
                <Button
                  variant="destructive"
                  className="w-full justify-center"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel Request
                </Button>
              )}

              {/* Active rental actions */}
              {variant === "active" && rental.status === "active" && (
                <>
                  <Button className="w-full justify-center">
                    Report Issue
                  </Button>
                  <Button variant="outline" className="w-full justify-center">
                    Request Extension
                  </Button>
                </>
              )}

              {/* Completed rental actions */}
              {variant === "active" && rental.status === "completed" && (
                <>
                  <Button className="w-full justify-center">
                    <Star className="mr-2 h-4 w-4" />
                    Leave Review
                  </Button>
                  <Link
                    href={`/listings/${rental.listingId}/rent`}
                    className="block"
                  >
                    <Button variant="outline" className="w-full justify-center">
                      Rent Again
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Layout (Horizontal) */}
        <div className="hidden items-start gap-4 md:flex">
          <Image
            src={rental.listingImageUrl || "/images/placeholder.jpg"}
            alt={rental.listingName}
            width={100}
            height={100}
            className="rounded-lg object-cover"
          />
          <div className="flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{rental.listingName}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>
                      {rental.ownerName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {variant === "active" ? "by " : ""}
                    {rental.ownerName}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-1 flex items-center gap-2">
                  {getStatusIcon(rental.status)}
                  <Badge className={getStatusColor(rental.status)}>
                    {rental.status}
                  </Badge>
                </div>
                <div className="text-lg font-semibold text-green-600">
                  ${parseFloat(rental.totalAmount).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(rental.startDate).toLocaleDateString()} to{" "}
                  {new Date(rental.endDate).toLocaleDateString()}
                  {variant === "request" && ` (${totalDays} days)`}
                </span>
              </div>
              {variant === "active" && "dailyRate" in rental && (
                <div className="flex items-center gap-1">
                  <span>${parseFloat(rental.dailyRate).toFixed(2)}/day</span>
                </div>
              )}
              {isRequest && rental.deliveryRequested && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>Delivery requested</span>
                </div>
              )}
            </div>

            {isRequest && rental.status === "denied" && rental.denialReason && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  <strong>Denial reason:</strong> {rental.denialReason}
                </p>
              </div>
            )}

            {isRequest && rental.message && (
              <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Your message:</strong> {rental.message}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/dashboard/rental/${rental.id}?view=renting`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
              <Link href={`/listings/${rental.listingId}`}>
                <Button variant="outline" size="sm">
                  View Listing
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <MessageCircle className="mr-1 h-4 w-4" />
                Message Owner
              </Button>

              {/* Request-specific actions */}
              {variant === "request" && rental.status === "pending" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel Request
                </Button>
              )}

              {/* Active rental actions */}
              {variant === "active" && rental.status === "active" && (
                <>
                  <Button size="sm">Report Issue</Button>
                  <Button variant="outline" size="sm">
                    Request Extension
                  </Button>
                </>
              )}

              {/* Completed rental actions */}
              {variant === "active" && rental.status === "completed" && (
                <>
                  <Button size="sm">
                    <Star className="mr-1 h-4 w-4" />
                    Leave Review
                  </Button>
                  <Link href={`/listings/${rental.listingId}/rent`}>
                    <Button variant="outline" size="sm">
                      Rent Again
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Cancel Request Dialog - only for requests */}
      {variant === "request" && (
        <CancelRequestDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          requestId={rental.id}
          listingName={rental.listingName}
        />
      )}
    </Card>
  );
}
