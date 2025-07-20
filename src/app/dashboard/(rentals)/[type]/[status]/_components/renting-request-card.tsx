"use client";

import { useState } from "react";
import { toast } from "sonner";
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
  Loader2,
} from "lucide-react";

import type { RentalRequestItem } from "@/lib/dal/rentals.dal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelRentalRequestAction } from "@/lib/actions/cancel-rental-request";

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

interface RentingRequestCardProps {
  request: RentalRequestItem;
}

export function RentingRequestCard({ request }: RentingRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCancelRequest = async () => {
    try {
      setIsLoading(true);
      const result = await cancelRentalRequestAction(request.id);

      if (!result.success) {
        toast.error(result.error || "Failed to cancel request");
      } else {
        toast.success("Rental request cancelled successfully");
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error("Failed to cancel request");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Card>
      <CardContent className="p-6">
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
                <h3 className="text-lg font-semibold">{request.toolName}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>
                      {request.ownerName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span>{request.ownerName}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-1 flex items-center gap-2">
                  {getStatusIcon(request.status)}
                  <Badge className={getStatusColor(request.status)}>
                    {request.status}
                  </Badge>
                </div>
                <div className="text-lg font-semibold text-green-600">
                  ${parseFloat(request.totalAmount).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(request.startDate).toLocaleDateString()} to{" "}
                  {new Date(request.endDate).toLocaleDateString()} (
                  {request.totalDays} days)
                </span>
              </div>
              {request.deliveryRequested && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>Delivery requested</span>
                </div>
              )}
            </div>

            {request.status === "rejected" && request.rejectionReason && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  <strong>Rejection reason:</strong> {request.rejectionReason}
                </p>
              </div>
            )}

            {request.message && (
              <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Your message:</strong> {request.message}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/tools/${request.toolId}`}>
                <Button variant="outline" size="sm">
                  View Tool
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <MessageCircle className="mr-1 h-4 w-4" />
                Message Owner
              </Button>
              {request.status === "pending" && (
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Cancel Request
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Rental Request</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your request for &ldquo;
                        {request.toolName}&rdquo;? This action cannot be undone
                        and you&apos;ll need to submit a new request if you
                        change your mind.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isLoading}>
                        Keep Request
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelRequest}
                        disabled={isLoading}
                        className="bg-destructive hover:bg-destructive/90 text-white"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          "Yes, Cancel Request"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
