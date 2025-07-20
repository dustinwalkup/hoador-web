import Image from "next/image";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  Truck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LendingRequestItem } from "@/lib/dal/rentals.dal";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "approved":
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    case "rejected":
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
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface LendingRequestCardProps {
  request: LendingRequestItem;
}

export function LendingRequestCard({ request }: LendingRequestCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-start gap-4">
              <Image
                src={request.toolImageUrl || "/images/placeholder.jpg"}
                alt={request.toolName}
                width={100}
                height={100}
                className="rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {request.toolName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(request.startDate).toLocaleDateString()} to{" "}
                        {new Date(request.endDate).toLocaleDateString()} (
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
                    <AvatarImage
                      src={request.renterProfileImage || undefined}
                    />
                    <AvatarFallback>
                      {request.renterName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{request.renterName}</h4>
                      {request.renterVerified && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-xs text-blue-800"
                        >
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {request.renterRating && request.renterReviewCount && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>
                            {request.renterRating} ({request.renterReviewCount}{" "}
                            reviews)
                          </span>
                        </div>
                      )}
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
                  {request.deliveryAddress && (
                    <div className="ml-6 text-sm text-gray-600">
                      <span>{request.deliveryAddress}</span>
                    </div>
                  )}
                </div>

                {request.message && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Message:</strong> {request.message}
                    </p>
                  </div>
                )}

                {request.status === "rejected" && request.rejectionReason && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-800">
                      <strong>Rejection reason:</strong>{" "}
                      {request.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-lg font-semibold text-green-600">
              ${parseFloat(request.totalAmount).toFixed(2)}
            </div>

            <div className="space-y-2">
              {request.status === "pending" && (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Request
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="sm"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Decline Request
                  </Button>
                </>
              )}
              {(request.status === "approved" ||
                request.status === "active" ||
                request.status === "completed") && (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  size="sm"
                >
                  View Details
                </Button>
              )}
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
