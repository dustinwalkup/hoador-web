"use client";

import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Minimal listing shape when server injects listings. */
export interface PendingReviewWidgetListing {
  id: string;
}

export interface PendingReviewWidgetProps {
  count?: number;
  listings?: ReadonlyArray<PendingReviewWidgetListing>;
}

function PendingReviewWidgetContent({ count }: { count: number }) {
  return (
    <Card className="border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span>Listings Pending Review</span>
            </div>
          </CardTitle>
          <Badge className="bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {count} {count === 1 ? "listing" : "listings"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
          {count === 1
            ? "You have 1 listing awaiting admin approval"
            : `You have ${count} listings awaiting admin approval`}
        </CardDescription>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="ml-auto text-xs font-medium text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30"
        >
          <Link href="/dashboard/listings/rentals?tab=pending_review">
            View Listings
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Widget showing count of listings pending review with amber accent.
 */
export function PendingReviewWidget({
  count: countProp,
  listings: listingsProp,
}: PendingReviewWidgetProps = {}) {
  const hasServerData = countProp !== undefined || listingsProp !== undefined;
  const serverCount =
    countProp ?? (listingsProp !== undefined ? listingsProp.length : undefined);

  if (hasServerData) {
    if (serverCount === undefined || serverCount === 0) return null;
    return <PendingReviewWidgetContent count={serverCount} />;
  }

  return null;
}
