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
  Truck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { LendingRequestItem } from "@/dal/rentals.dal";
import {
  ApproveRequestDialog,
  DeclineRequestDialog,
} from "@/features/rentals/components/renting-lending";
import { MessageUserModal } from "@/features/messages/components/message-user-modal";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "approved":
    case "active":
      return <CheckCircle className="text-primary h-4 w-4" />;
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
      return "bg-primary/10 text-primary";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "denied":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface LendingCardProps {
  request: LendingRequestItem;
}

export function LendingCard({ request }: LendingCardProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  return (
    <Card>
      <CardContent className="p-6">
        {/* Mobile Layout (Vertical) */}
        <div className="md:hidden">
          {/* Image Section */}
          <div className="relative mb-4 w-full">
            <Image
              src={request.listingImageUrl || "/images/placeholder.jpg"}
              alt={request.listingName}
              width={400}
              height={300}
              className="h-48 w-full rounded-lg object-cover"
            />
          </div>

          {/* Content Section */}
          <div>
            {/* listing Information */}
            <div className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {request.listingName}
                </h3>
                <div className="flex items-center gap-2">
                  {getStatusIcon(request.status)}
                  <Badge className={getStatusColor(request.status)}>
                    {request.status}
                  </Badge>
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(request.startDate).toLocaleDateString()} to{" "}
                  {new Date(request.endDate).toLocaleDateString()} (
                  {request.totalDays} days)
                </span>
              </div>

              {/* Renter Information */}
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                <Avatar className="h-10 w-10">
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
                  {request.renterRating && request.renterReviewCount && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>
                        {request.renterRating} ({request.renterReviewCount}{" "}
                        reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Information */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {request.deliveryRequested ? (
                    <>
                      <Truck className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">Delivery Requested</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="text-primary h-4 w-4" />
                      <span className="font-medium">Pickup</span>
                    </>
                  )}
                </div>
                {request.setupRequested && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">Setup Requested</span>
                  </div>
                )}
                {request.deliveryAddress && (
                  <div className="ml-6 text-sm text-gray-600">
                    <span>{request.deliveryAddress}</span>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="text-primary mb-4 text-xl font-bold">
                ${parseFloat(request.totalAmount).toFixed(2)}
              </div>
            </div>

            {/* Message Section */}
            {request.message && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-sm font-semibold text-blue-800">
                  Message:
                </p>
                <p className="text-sm text-blue-700">{request.message}</p>
              </div>
            )}

            {/* Denial Reason */}
            {request.status === "denied" && request.denialReason && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  <strong>Denial reason:</strong> {request.denialReason}
                </p>
              </div>
            )}

            {/* Action Buttons - Vertical Stack */}
            <div className="space-y-3">
              {request.status === "pending" && (
                <>
                  <Button
                    className="bg-primary hover:bg-primary/80 w-full justify-center"
                    onClick={() => setShowApproveDialog(true)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Request
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => setShowDeclineDialog(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Decline Request
                  </Button>
                </>
              )}

              <Link
                href={`/dashboard/rental/${request.id}?view=lending`}
                className="block"
              >
                <Button variant="outline" className="w-full justify-center">
                  View Details
                </Button>
              </Link>

              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setShowMessageModal(true)}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Message Renter
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Layout (Original Grid) */}
        <div className="hidden md:block">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-start gap-4">
                <Image
                  src={request.listingImageUrl || "/images/placeholder.jpg"}
                  alt={request.listingName}
                  width={100}
                  height={100}
                  className="rounded-lg object-cover"
                />
                <div className="flex-1">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {request.listingName}
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
                              {request.renterRating} (
                              {request.renterReviewCount} reviews)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        {request.deliveryRequested ? (
                          <>
                            <Truck className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">
                              Delivery Requested
                            </span>
                          </>
                        ) : (
                          <>
                            <MapPin className="text-primary h-4 w-4" />
                            <span className="font-medium">Pickup</span>
                          </>
                        )}
                      </div>
                      {request.setupRequested && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">Setup Requested</span>
                        </div>
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

                  {request.status === "denied" && request.denialReason && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-800">
                        <strong>Denial reason:</strong> {request.denialReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-primary text-lg font-semibold">
                ${parseFloat(request.totalAmount).toFixed(2)}
              </div>

              <div className="space-y-2">
                {request.status === "pending" && (
                  <>
                    <Button
                      className="bg-primary hover:bg-primary/80 w-full justify-center"
                      size="sm"
                      onClick={() => setShowApproveDialog(true)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve Request
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      size="sm"
                      onClick={() => setShowDeclineDialog(true)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline Request
                    </Button>
                  </>
                )}

                <div className="flex flex-col gap-2">
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
                    onClick={() => setShowMessageModal(true)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Message Renter
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Message Renter Modal */}
      <MessageUserModal
        open={showMessageModal}
        onOpenChange={setShowMessageModal}
        recipientId={request.renterId}
        recipientName={request.renterName}
        listingId={request.listingId}
        listingName={request.listingName}
        existingConversationId={request.conversationId}
      />

      <ApproveRequestDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        requestId={request.id}
        listingName={request.listingName}
        renterName={request.renterName}
        deliveryRequested={request.deliveryRequested}
      />

      <DeclineRequestDialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
        requestId={request.id}
        listingName={request.listingName}
        renterName={request.renterName}
      />
    </Card>
  );
}
