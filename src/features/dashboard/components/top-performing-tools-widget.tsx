import Link from "next/link";
import { ArrowRight, ChevronRight, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface TopPerformingListing {
  listingId: string;
  name: string;
  metricText: string;
}

export interface TopPerformingToolsWidgetProps {
  listings: TopPerformingListing[];
}

/**
 * Top tools with emerald accent, rank numbers, and trophy icon.
 */
export function TopPerformingToolsWidget({
  listings,
}: TopPerformingToolsWidgetProps) {
  return (
    <Card className="border-t-4 border-t-emerald-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
            <Trophy
              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </div>
          Top Performing Listings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Trophy className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              No top performers yet
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Your best-rented items will show here
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {listings.map((listing, index) => (
              <li key={listing.listingId}>
                <Link
                  href={`/dashboard/listings/${listing.listingId}`}
                  className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {index + 1}
                  </div>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {listing.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {listing.metricText}
                  </span>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
        >
          <Link href="/dashboard/garage">
            View Garage
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
