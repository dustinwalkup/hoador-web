export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle,
  Calendar,
  MessageCircle,
  Home,
  MapPin,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date.utils";
import { getCurrentUser } from "@/features/auth/utils/session";
import { rentalDAL } from "@/dal";
import { ServiceFeeLine } from "@/features/rentals/components/service-fee-line";
import { SecurityDepositLine } from "@/features/rentals/components/security-deposit-line";

export const metadata = {
  title: "Rental Confirmation",
  description: "Your rental request confirmation details",
};

interface RentalConfirmationPageProps {
  searchParams: Promise<{ requestId?: string }>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          Pending Approval
        </Badge>
      );
    case "approved":
      return <Badge className="bg-primary/10 text-primary">Approved</Badge>;
    case "denied":
      return <Badge className="bg-red-100 text-red-800">Denied</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
    default:
      return (
        <Badge variant="secondary">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
  }
}

export default async function RentalConfirmationPage({
  searchParams,
}: RentalConfirmationPageProps) {
  // Authentication required
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    notFound();
  }

  const { requestId } = await searchParams;
  if (!requestId) {
    notFound();
  }

  // Fetch rental request details
  const rentalRequest = await rentalDAL
    .getRentalRequestById(requestId)
    .catch(() => null);
  if (!rentalRequest) {
    notFound();
  }

  const deliveryTotal = Number(rentalRequest.deliveryFee);
  const setupTotal = Number(rentalRequest.setupFee ?? 0);
  const securityDeposit = Number(rentalRequest.securityDeposit);
  const totalAmount = Number(rentalRequest.totalAmount);
  const serviceFee = Number(rentalRequest.serviceFee ?? 0);
  const rentalSubtotal = totalAmount - serviceFee - deliveryTotal - setupTotal;
  const grandTotal = totalAmount + securityDeposit;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <CheckCircle className="text-primary mx-auto mb-4 h-16 w-16" />
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Request Sent!
          </h1>
          <p className="text-gray-600">
            Your rental request has been sent to {rentalRequest.ownerName} for
            approval.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Request ID:</span>
              <Badge variant="secondary">{rentalRequest.id}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Status:</span>
              {getStatusBadge(rentalRequest.status)}
            </div>
            <div className="flex items-start justify-between">
              <span>Listing:</span>
              <div className="flex items-center gap-2 text-right">
                {rentalRequest.listingImageUrl && (
                  <Image
                    src={rentalRequest.listingImageUrl}
                    alt={rentalRequest.listingName}
                    width={40}
                    height={40}
                    className="rounded object-cover"
                  />
                )}
                <span className="font-medium">{rentalRequest.listingName}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Owner:</span>
              <span className="font-medium">{rentalRequest.ownerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Rental Period:</span>
              <span>
                {rentalRequest.totalDays} day
                {rentalRequest.totalDays !== 1 ? "s" : ""} (
                {formatDate(rentalRequest.startDate, "MMM d")} -{" "}
                {formatDate(rentalRequest.endDate, "MMM d")})
              </span>
            </div>
            {rentalRequest.deliveryRequested && (
              <div className="flex items-start justify-between">
                <span>Delivery:</span>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>Delivery requested</span>
                  </div>
                  {rentalRequest.deliveryAddress && (
                    <p className="text-sm text-gray-600">
                      {rentalRequest.deliveryAddress}
                    </p>
                  )}
                </div>
              </div>
            )}
            {rentalRequest.message && (
              <div className="flex items-start justify-between">
                <span>Message:</span>
                <div className="max-w-xs text-right">
                  <p className="text-sm text-gray-600">
                    {rentalRequest.message}
                  </p>
                </div>
              </div>
            )}
            <div className="border-t pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Rental cost ({rentalRequest.totalDays} days)</span>
                  <span>${rentalSubtotal.toFixed(2)}</span>
                </div>
                {deliveryTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery fee</span>
                    <span>${deliveryTotal.toFixed(2)}</span>
                  </div>
                )}
                {setupTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Setup service</span>
                    <span>${setupTotal.toFixed(2)}</span>
                  </div>
                )}
                <ServiceFeeLine amount={serviceFee} className="text-sm" />
                <SecurityDepositLine
                  amount={securityDeposit}
                  className="text-sm"
                />
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Amount:</span>
                  <span className="text-primary">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What happens next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                1
              </div>
              <div>
                <p className="font-medium">Owner Review</p>
                <p className="text-sm text-gray-600">
                  {rentalRequest.ownerName} will review your request and respond
                  within 24 hours.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                2
              </div>
              <div>
                <p className="font-medium">Payment Processing</p>
                <p className="text-sm text-gray-600">
                  If approved, we&apos;ll process your payment and send{" "}
                  {rentalRequest.deliveryRequested ? "delivery" : "pickup"}{" "}
                  instructions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                3
              </div>
              <div>
                <p className="font-medium">
                  Listing{" "}
                  {rentalRequest.deliveryRequested ? "Delivery" : "Pickup"}
                </p>
                <p className="text-sm text-gray-600">
                  {rentalRequest.deliveryRequested
                    ? "We'll coordinate delivery to your specified address."
                    : "Coordinate with the owner for tool pickup."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/dashboard/listings/rentals">
            <Button variant="outline" className="w-full bg-transparent">
              <Calendar className="mr-2 h-4 w-4" />
              My Rentals
            </Button>
          </Link>
          <Link href="/dashboard/mailbox">
            <Button variant="outline" className="w-full bg-transparent">
              <MessageCircle className="mr-2 h-4 w-4" />
              Messages
            </Button>
          </Link>
          <Link href="/dashboard/explore">
            <Button variant="outline" className="w-full bg-transparent">
              <Home className="mr-2 h-4 w-4" />
              Browse Listings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
