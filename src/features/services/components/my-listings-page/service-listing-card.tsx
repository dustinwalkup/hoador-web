"use client";

import Link from "next/link";
import {
  Eye,
  Clock,
  Pencil,
  MoreHorizontal,
  AlertCircle,
  Calendar,
} from "lucide-react";

import type { ServiceListing as ServiceListingRow } from "@/db/schemas/services.schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ServiceListingStatus = ServiceListingRow["status"];

/** Fields used by this card; `price` matches DB `numeric` (string or number at runtime). */
export type ServiceListingCardListing = Pick<
  ServiceListingRow,
  "id" | "title" | "status" | "price" | "pricingType" | "rejectionReason"
> & {
  bookingsCount?: number;
  createdAt?: Date | string;
};

interface ProviderListingCardProps {
  listing: ServiceListingCardListing;
  formatPrice?: (price: number) => string;
  onManage?: (listing: ServiceListingCardListing) => void;
}

/** Formats listing price in USD (dollars), consistent with browse listing cards. */
function defaultFormatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function StatusIndicator({ status }: { status: ServiceListingStatus }) {
  switch (status) {
    case "active":
      return (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
          </span>
          <span className="text-primary text-xs font-medium dark:text-emerald-400">
            Active
          </span>
        </div>
      );
    case "inactive":
      return (
        <div className="flex items-center gap-1.5">
          <span className="bg-muted-foreground/40 h-2 w-2 rounded-full" />
          <span className="text-muted-foreground text-xs font-medium">
            Inactive
          </span>
        </div>
      );
    case "pending_approval":
      return (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-blue-500" />
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Pending Review
          </span>
        </div>
      );
    case "denied":
      return (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="flex cursor-help items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Revisions Requested
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p>
              An admin has requested changes. Click <strong>Edit</strong> to
              review the feedback and resubmit.
            </p>
          </TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}

export function ServiceListingCard({
  listing,
  formatPrice = defaultFormatPrice,
  onManage,
}: ProviderListingCardProps) {
  const priceDollars = Number(listing.price);

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="flex h-full flex-col justify-between px-4 py-2">
        <div>
          {/* Header Row */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <StatusIndicator status={listing.status} />
              </div>
              <h3 className="text-foreground truncate text-base font-semibold">
                {listing.title}
              </h3>
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/services/listings/${listing.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/services/listings/${listing.id}/edit`}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onManage?.(listing)}
                  className="text-primary focus:text-primary"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Manage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Price & Type */}
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-primary/10 flex items-baseline gap-1.5 rounded-md px-2.5 py-1">
              <span className="text-primary text-sm font-semibold">
                {formatPrice(priceDollars)}
                {listing.pricingType === "hourly" ? (
                  <span className="font-normal">/hr</span>
                ) : (
                  <>
                    {" "}
                    <span className="font-normal">·</span>{" "}
                    <span className="text-sm font-normal">flat rate</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/dashboard/services/listings/${listing.id}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onManage?.(listing)}
          >
            Manage
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Empty state card for adding new listing
export function AddListingCard({
  href = "/dashboard/services/listings/new",
}: {
  href?: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="border-muted-foreground/20 bg-muted/30 hover:border-primary/40 hover:bg-muted/50 flex h-full min-h-[180px] flex-col items-center justify-center border-2 border-dashed p-6 transition-all duration-200">
        <div className="bg-primary/10 mb-3 flex h-10 w-10 items-center justify-center rounded-full">
          <span className="text-primary text-xl font-light">+</span>
        </div>
        <h3 className="text-foreground mb-1 text-sm font-semibold">
          List another service
        </h3>
        <p className="text-muted-foreground text-center text-xs">
          Offer your skills to your community
        </p>
      </Card>
    </Link>
  );
}
