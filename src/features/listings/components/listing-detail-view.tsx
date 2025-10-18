import Link from "next/link";
import {
  Calendar,
  Clock,
  Wrench,
  Truck,
  AlertTriangle,
  Info,
  DollarSign,
} from "lucide-react";

import { StatusIconWithTooltip } from "@/features/listings/components/status-icon-with-tooltip";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserCard } from "@/components/user-card";

import type { ListingDetails } from "@/dal/types";

import { ImageCarousel } from "./image-carousel";
// import { FavoritesButton } from "./favorites-button";

interface ListingDetailViewProps {
  listing: ListingDetails;
  isOwner: boolean;
}

export function ListingDetailView({
  listing,
  isOwner,
}: ListingDetailViewProps) {
  const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

  const getConditionColor = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "excellent":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "good":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "fair":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "poor":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <>
      <BackButton />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-3">
          {/* listing Images */}
          <ImageCarousel images={listing.images} listingName={listing.name} />

          {/* listing Information */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{listing.name}</CardTitle>
                  <div className="mt-2 flex items-center space-x-2">
                    <Badge variant="outline">{listing.category.name}</Badge>
                    <Badge
                      variant="secondary"
                      className={`capitalize ${getConditionColor(listing.condition)}`}
                    >
                      {listing.condition}
                    </Badge>
                    <StatusIconWithTooltip status={listing.status} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">{listing.description}</p>

              <div className="grid grid-cols-2 gap-4">
                {listing.brand && (
                  <div>
                    <h4 className="font-medium text-gray-900">Brand</h4>
                    <p className="text-gray-600">{listing.brand}</p>
                  </div>
                )}
                {listing.model && (
                  <div>
                    <h4 className="font-medium text-gray-900">Model</h4>
                    <p className="text-gray-600">{listing.model}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Specifications - Mobile Only */}
          {Object.keys(listing.specifications).length > 0 && (
            <Card className="lg:hidden">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="mr-2 h-5 w-5" />
                  Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(listing.specifications).map(
                    ([key, value]) => (
                      <div key={key}>
                        <h4 className="font-medium text-gray-900">{key}</h4>
                        <p className="text-gray-600">{String(value)}</p>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Instructions */}
          {listing.instructions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wrench className="mr-2 h-5 w-5" />
                  Usage Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{listing.instructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Safety Notes */}
          {listing.safetyNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-orange-600">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Safety Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{listing.safetyNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Pickup & Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="mr-2 h-5 w-5" />
                Pickup & Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Delivery Options</span>
                <Badge variant="default">
                  {listing.deliveryMode === "pickup_only" && "Pickup Only"}
                  {listing.deliveryMode === "delivery_only" && "Delivery Only"}
                  {listing.deliveryMode === "both_available" &&
                    "Pickup or Delivery"}
                </Badge>
              </div>
              {(listing.deliveryMode === "delivery_only" ||
                listing.deliveryMode === "both_available") && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Delivery Fee</span>
                    <span className="font-medium">
                      {formatPrice(listing.deliveryFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Delivery Radius</span>
                    <span className="font-medium">
                      {listing.deliveryRadius} miles
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Setup Available</span>
                <Badge
                  variant={listing.setupAvailable ? "default" : "secondary"}
                >
                  {listing.setupAvailable ? "Yes" : "No"}
                </Badge>
              </div>
              {listing.setupAvailable && listing.setupFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Setup Fee</span>
                  <span className="font-medium">
                    {formatPrice(listing.setupFee)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Rate</span>
                  <span className="text-lg font-semibold">
                    {formatPrice(listing.dailyRate)}
                  </span>
                </div>
                {listing.weeklyRate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weekly Rate</span>
                    <span className="font-medium">
                      {formatPrice(listing.weeklyRate)}
                    </span>
                  </div>
                )}
                {listing.monthlyRate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Rate</span>
                    <span className="font-medium">
                      {formatPrice(listing.monthlyRate)}
                    </span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-600">Security Deposit</span>
                <span className="font-medium">
                  {formatPrice(listing.securityDeposit)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Rental Period */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Rental Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Minimum</span>
                <span className="font-medium">
                  {listing.minimumRentalPeriod} day(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Maximum</span>
                <span className="font-medium">
                  {listing.maximumRentalPeriod} day(s)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Owner Info */}
          <UserCard
            user={{
              id: listing.owner.id,
              name: `${listing.owner.firstName} ${listing.owner.lastName}`,
              profileImage: listing.owner.profileImageUrl,
              rating: listing.owner.averageRating,
              reviewCount: listing.owner.reviewCount,
              memberSince: listing.owner.memberSince.toISOString(),
            }}
            title="Listing Owner"
            showActions={!isOwner}
            recipientId={listing.owner.id}
            recipientName={`${listing.owner.firstName} ${listing.owner.lastName}`}
            listingId={listing.id}
            listingName={listing.name}
          />

          {/* Action Buttons */}
          <div className="space-y-3">
            {isOwner ? (
              <Button asChild className="w-full" size="lg">
                <Link href={`/dashboard/listings/${listing.id}/edit`}>
                  Edit Listing
                </Link>
              </Button>
            ) : (
              <Button asChild className="w-full" size="lg">
                <Link
                  className="flex items-center justify-center"
                  href={`/listings/${listing.id}/rent`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Rent Tool
                </Link>
              </Button>
            )}
            {/* <FavoritesButton
              listingId={listing.id}
              isFavorite={listing.isFavorited || false}
            /> */}
          </div>

          {/* Specifications - Desktop Only */}
          {Object.keys(listing.specifications).length > 0 && (
            <Card className="hidden lg:block">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="mr-2 h-5 w-5" />
                  Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(listing.specifications).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600">{key}</span>
                        <span className="font-medium text-gray-900">
                          {String(value)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          {/* <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Listed</span>
                <span>{formatDate(listing.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Views</span>
                <span>{listing.viewCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Favorites</span>
                <span>{listing.favoriteCount}</span>
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>
    </>
  );
}
