"use client";

import { toast } from "sonner";
import { Calendar, Eye, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { updateListingStatus } from "@/features/listings/actions/update-listing-status";

import ListingManagementModal from "./listing-management-modal";
import { capitalize } from "@/lib/utils";

interface RentalCardProps {
  cardType: "listings" | "borrowing";
  name: string;
  id: string;
  imageUrl: string | null;
  price: string;
  status: "rented" | "" | "listed" | "renting";
  dueDate?: string;
  owner?: string;
  borrower?: string;
  availability?: string;
  listingData?: {
    id: string;
    name: string;
    status: "available" | "rented" | "maintenance" | "inactive";
    isActive: boolean;
  };
}

function getStatusBadgeVariant(
  status: string,
  isActive: boolean,
): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  if (!isActive) {
    return {
      variant: "secondary",
      className:
        "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300",
    };
  }

  switch (status.toLowerCase()) {
    case "available":
      return {
        variant: "outline",
        className:
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-50 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
      };
    case "rented":
      return {
        variant: "default",
        className:
          "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300",
      };
    case "maintenance":
      return {
        variant: "secondary",
        className:
          "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300",
      };
    case "inactive":
      return {
        variant: "secondary",
        className:
          "bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
      };
    case "archived":
      return {
        variant: "secondary",
        className:
          "bg-gray-100 text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-500",
      };
    default:
      return {
        variant: "outline",
        className: "",
      };
  }
}

export default function RentalCard({
  cardType,
  name,
  id,
  imageUrl,
  price,
  status,
  dueDate,
  owner,
  borrower,
  availability,
  listingData,
}: RentalCardProps) {
  const handleListingUpdate = async (data: {
    status: "available" | "maintenance" | "inactive";
  }) => {
    const result = await updateListingStatus(id, data);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Listing status updated successfully");
    }
  };

  // Get the appropriate badge styling
  const badgeConfig = getStatusBadgeVariant(
    availability || status || "unknown",
    listingData?.isActive ?? true,
  );

  return (
    <Card className="overflow-hidden pt-0 pb-2">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        <Image
          src={imageUrl || "/images/placeholder.jpg"}
          alt={name}
          width={300}
          height={200}
          className="h-full w-full object-cover"
        />
        <Link
          href={
            cardType === "listings"
              ? `/dashboard/listings/${id}`
              : `/listings/${id}`
          }
          className="text-muted-foreground/40 hover:text-muted-foreground absolute top-0 right-0 p-2 text-xs underline decoration-dotted transition-colors"
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
        <div className="mb-2 flex items-center justify-between">
          <h3 className="truncate font-medium">{name}</h3>
          {(status || availability) && (
            <Badge
              variant={badgeConfig.variant}
              className={`block text-xs ${badgeConfig.className}`}
            >
              {capitalize(availability || status)}
            </Badge>
          )}
        </div>

        {(owner || borrower) && (
          <div className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
            <User className="h-3.5 w-3.5" />
            <span>{owner ? `From ${owner}` : `To ${borrower}`}</span>
          </div>
        )}

        {dueDate && (
          <div className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
            <Calendar className="h-3.5 w-3.5" />
            <span>Due {dueDate}</span>
          </div>
        )}

        <div className="text-primary mb-3 font-medium">{price}</div>

        <div className="flex items-center gap-2">
          {cardType === "borrowing" && (
            <>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="#">Extend</Link>
              </Button>
              <Button size="sm" className="flex-1">
                Return
              </Button>
            </>
          )}

          {cardType === "listings" && (
            <>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/dashboard/listings/${id}/edit`}>Edit</Link>
              </Button>
              {listingData ? (
                <ListingManagementModal
                  listing={listingData}
                  onSave={handleListingUpdate}
                  trigger={
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={listingData.status === "rented"}
                    >
                      Manage
                    </Button>
                  }
                />
              ) : (
                <Button size="sm" className="flex-1">
                  Manage
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
