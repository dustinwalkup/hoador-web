"use client";

import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { usePendingListingsCount } from "@/features/listings/hooks/use-garage";
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

export function PendingReviewWidget() {
  const { data: count = 0, isLoading } = usePendingListingsCount();

  // Only show widget if there are pending listings
  if (isLoading || count === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span>Listings Pending Review</span>
            </div>
          </CardTitle>
          <Badge
            variant="secondary"
            className="bg-amber-100 px-2 py-0 text-xs font-normal text-amber-700"
          >
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
          variant="outline"
          size="sm"
          className="ml-auto text-xs text-amber-700 hover:text-amber-800"
        >
          <Link href="/dashboard/garage?tab=pending_review">
            View Listings
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
