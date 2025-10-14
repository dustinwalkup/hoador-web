import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  RentingRental,
  LendingRental,
  RentalStatus,
} from "@/features/rentals/lib/types";

const getStatusIcon = (status: RentalStatus) => {
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

const getStatusColor = (status: RentalStatus) => {
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

interface RentingCardProps {
  rental: RentingRental;
  currentTab: string;
}

export function RentingCard({ rental, currentTab }: RentingCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Image
            src={rental.listing.imageUrl}
            alt={rental.listing.name}
            width={100}
            height={100}
            className="rounded-lg object-cover"
          />
          <div className="flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{rental.listing.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={rental.owner.profileImage} />
                    <AvatarFallback>
                      {rental.owner.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span>{rental.owner.name}</span>
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
                  ${rental.totalAmount.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {rental.startDate} to {rental.endDate}
                </span>
              </div>
              {rental.deliveryRequested && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>Delivery requested</span>
                </div>
              )}
            </div>

            {rental.status === "denied" && rental.denialReason && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  <strong>Denial reason:</strong> {rental.denialReason}
                </p>
              </div>
            )}

            {rental.pickupInstructions && (
              <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Pickup Instructions:</strong>{" "}
                  {rental.pickupInstructions}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/dashboard/rental/${rental.id}?view=renting`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
              <Link href={`/listings/${rental.listing.id}`}>
                <Button variant="outline" size="sm">
                  View Listing
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <MessageCircle className="mr-1 h-4 w-4" />
                Message Owner
              </Button>
              {currentTab === "requests" && rental.status === "pending" && (
                <Button variant="destructive" size="sm">
                  Cancel Request
                </Button>
              )}
              {currentTab === "active" && (
                <>
                  <Button size="sm">Report Issue</Button>
                  <Button variant="outline" size="sm">
                    Request Extension
                  </Button>
                </>
              )}
              {currentTab === "completed" && !rental.reviewGiven && (
                <Button size="sm">
                  <Star className="mr-1 h-4 w-4" />
                  Leave Review
                </Button>
              )}
              {currentTab === "completed" && (
                <Link href={`/listings/${rental.listing.id}/rent`}>
                  <Button variant="outline" size="sm">
                    Rent Again
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface LendingCardProps {
  request: LendingRental;
  currentTab: string;
}

export function LendingCard({ request, currentTab }: LendingCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-start gap-4">
              <Image
                src={request.listing.imageUrl}
                alt={request.listing.name}
                width={100}
                height={100}
                className="rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {request.listing.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {request.startDate} to {request.endDate} (
                        {request.totalDays} days)
                      </span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(request.status)}>
                    {getStatusIcon(request.status)}
                    <span className="ml-1 capitalize">{request.status}</span>
                  </Badge>
                </div>

                <div className="mb-3 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.renter.profileImage} />
                    <AvatarFallback>
                      {request.renter.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{request.renter.name}</h4>
                      {request.renter.verified && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-xs text-blue-800"
                        >
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>
                          {request.renter.rating || 0} (
                          {request.renter.reviewCount || 0} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {request.deliveryRequested ? (
                      <>
                        <Truck className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Delivery Requested</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Pickup</span>
                      </>
                    )}
                  </div>
                  {request.selectedWindow && (
                    <div className="ml-6 flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-3 w-3" />
                      <span>{request.selectedWindow}</span>
                    </div>
                  )}
                </div>

                {request.status === "denied" && request.denialReason && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-800">
                      <strong>Denial reason:</strong>{" "}
                      {request.denialReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-lg font-semibold text-green-600">
              ${request.totalAmount.toFixed(2)}
            </div>

            <div className="space-y-2">
              {currentTab === "incoming" && (
                <>
                  <Link href={`/owner/requests/${request.id}`}>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Review & Approve
                    </Button>
                  </Link>
                  <Link href={`/owner/requests/${request.id}/reject`}>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      size="sm"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </Link>
                </>
              )}
              <Link href={`/dashboard/rental/${request.id}?view=lending`}>
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  size="sm"
                >
                  View Details
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                size="sm"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Message Renter
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
