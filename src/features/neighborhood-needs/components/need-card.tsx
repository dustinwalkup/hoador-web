"use client";

import Link from "next/link";
import { Calendar, Home, Link2, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMMMd, formatDistanceToNow } from "@/lib/utils/date.utils";
import { formatDistanceMiles } from "@/lib/utils/geo.utils";
import type { NeedFeedRow } from "@/dal/neighborhood-needs.dal";

interface NeedCardProps {
  need: NeedFeedRow;
}

export function NeedCard({ need }: NeedCardProps) {
  const typeLabel = need.type === "rental" ? "Rental" : "Service";
  const typeVariant =
    need.type === "rental"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800"
      : "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800";

  const dateRange =
    need.neededStartDate && need.neededEndDate
      ? `${formatMMMd(need.neededStartDate)} – ${formatMMMd(need.neededEndDate)}`
      : need.neededStartDate
        ? `From ${formatMMMd(need.neededStartDate)}`
        : need.neededEndDate
          ? `Until ${formatMMMd(need.neededEndDate)}`
          : null;

  const distanceLabel = formatDistanceMiles(need.distanceMiles);
  const hasRating =
    need.requesterReviewCount > 0 && need.requesterRating != null;

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <Badge
          variant="secondary"
          className={`border text-xs ${typeVariant} shrink-0`}
        >
          {typeLabel}
        </Badge>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {formatDistanceToNow(need.createdAt, { addSuffix: true })}
        </span>
      </div>

      <h3 className="line-clamp-2 leading-snug font-semibold">{need.title}</h3>

      <p className="text-muted-foreground line-clamp-2 text-sm">
        {need.description}
      </p>

      <CardContent className="mt-auto flex flex-col gap-2 px-0 pt-2 pb-0">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex min-w-0 items-center gap-1">
            <Home className="h-3 w-3 shrink-0" />
            <span className="truncate">{need.communityName}</span>
          </span>
          {distanceLabel && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {distanceLabel} away
            </span>
          )}
          {hasRating ? (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />
              {Number(need.requesterRating).toFixed(1)} (
              {need.requesterReviewCount})
            </span>
          ) : (
            <span>New requester</span>
          )}
        </div>

        {dateRange && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Needed {dateRange}</span>
          </div>
        )}

        {need.linkedListingCount > 0 && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Link2 className="h-3 w-3 shrink-0" />
            <span>
              {need.linkedListingCount} listing
              {need.linkedListingCount !== 1 ? "s" : ""} linked
            </span>
          </div>
        )}

        <Button asChild size="sm" variant="outline" className="mt-1 w-full">
          <Link href={`/dashboard/needs/${need.id}`}>View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
