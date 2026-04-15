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
  if (listings.length === 0) return null;

  return (
    <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-t-0 border-l-4 border-l-emerald-500">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
            <Trophy
              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </div>
          Your top listings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 pt-0">
        <div className="scrollbar-hover-reveal min-h-0 flex-1 space-y-3 overflow-y-auto">
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
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-2 shrink-0 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
        >
          <Link href="/dashboard/listings/rentals">
            View Garage
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
