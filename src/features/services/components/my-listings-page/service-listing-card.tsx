"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Clock, XCircle } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { ServiceListing } from "@/db/schemas/services.schema";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import {
  useDeactivateServiceListing,
  useReactivateServiceListing,
} from "@/features/services/hooks/use-service-listings";

type ServiceListingStatus = ServiceListing["status"];

function StatusBadge({ status }: { status: ServiceListingStatus }) {
  switch (status) {
    case "active":
      return (
        <Badge
          variant="outline"
          className="border-green-200 bg-green-50 text-xs text-green-700 hover:bg-green-50 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
        >
          Available
        </Badge>
      );
    case "inactive":
      return (
        <Badge
          variant="secondary"
          className="bg-gray-100 text-xs text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400"
        >
          Inactive
        </Badge>
      );
    case "pending_approval":
      return (
        <Badge
          variant="secondary"
          className="flex items-center gap-1 border border-yellow-200 bg-yellow-100 text-xs text-yellow-800 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
        >
          <Clock className="h-3 w-3" />
          Pending Review
        </Badge>
      );
    case "denied":
      return (
        <Badge
          variant="destructive"
          className="flex items-center gap-1 border border-red-200 bg-red-100 text-xs text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <XCircle className="h-3 w-3" />
          Denied
        </Badge>
      );
    default:
      return null;
  }
}

interface ServiceListingCardProps {
  listing: ServiceListing;
}

export function ServiceListingCard({ listing }: ServiceListingCardProps) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  const deactivateMutation = useDeactivateServiceListing(listing.id);
  const reactivateMutation = useReactivateServiceListing(listing.id);

  const imageUrl =
    Array.isArray(listing.photos) && listing.photos.length > 0
      ? listing.photos[0]
      : null;

  const priceLabel =
    listing.pricingType === "hourly"
      ? `${formatServiceUsd(listing.price)}/hr`
      : `${formatServiceUsd(listing.price)} fixed`;

  const handleDeactivate = async () => {
    await deactivateMutation.mutateAsync();
    setDeactivateOpen(false);
  };

  const handleReactivate = async () => {
    await reactivateMutation.mutateAsync();
    setReactivateOpen(false);
  };

  return (
    <Card className="overflow-hidden pt-0 pb-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="bg-muted relative aspect-4/3 overflow-hidden">
        <Image
          src={imageUrl ?? "/images/placeholder.jpg"}
          alt={listing.title}
          width={300}
          height={200}
          className="h-full w-full object-contain"
        />
        <Link
          href={`/dashboard/services/listings/${listing.id}`}
          className="text-muted-foreground/40 hover:text-muted-foreground absolute top-0 right-0 p-2 transition-colors"
        >
          <Tooltip delayDuration={600}>
            <TooltipTrigger className="cursor-pointer">
              <Eye className="size-5" />
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <p className="text-muted-foreground text-xs">Preview</p>
            </TooltipContent>
          </Tooltip>
        </Link>
      </div>

      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate font-medium">{listing.title}</h3>
          <StatusBadge status={listing.status} />
        </div>

        <div className="text-primary mb-3 font-medium">{priceLabel}</div>

        {listing.rejectionReason && (
          <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p className="font-medium">Denial Reason:</p>
            <p>{listing.rejectionReason}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/dashboard/services/listings/${listing.id}/edit`}>
              Edit
            </Link>
          </Button>

          {listing.status === "active" && (
            <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="flex-1">
                  Manage
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate listing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will hide your listing from the marketplace. You can
                    reactivate it at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeactivate}
                    disabled={deactivateMutation.isPending}
                  >
                    {deactivateMutation.isPending
                      ? "Deactivating…"
                      : "Deactivate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {listing.status === "inactive" && (
            <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="flex-1">
                  Reactivate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reactivate listing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your listing will be visible in the marketplace again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReactivate}
                    disabled={reactivateMutation.isPending}
                  >
                    {reactivateMutation.isPending
                      ? "Reactivating…"
                      : "Reactivate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
