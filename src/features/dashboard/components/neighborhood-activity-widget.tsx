import Link from "next/link";
import { MapPin, ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface NeighborhoodListing {
  id: string;
  name: string;
  linkTo: string;
}

export interface NeighborhoodActivityWidgetProps {
  listings: NeighborhoodListing[];
}

/**
 * Neighborhood widget with rose accent, location pins, and graceful empty state.
 */
export function NeighborhoodActivityWidget({
  listings,
}: NeighborhoodActivityWidgetProps) {
  return (
    <Card className="flex h-80 min-h-0 flex-col overflow-hidden border-t-0 border-l-4 border-l-rose-500">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10">
            <MapPin
              className="h-4 w-4 text-rose-600 dark:text-rose-400"
              aria-hidden
            />
          </div>
          Near you
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 pt-0">
        <div className="scrollbar-hover-reveal min-h-0 flex-1 space-y-3 overflow-y-auto">
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
                <MapPin className="h-6 w-6 text-rose-400" />
              </div>
              <p className="text-muted-foreground mt-3 text-sm">
                No neighborhood activity yet
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Nearby listings and activity will show here
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={listing.linkTo}
                    className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    </div>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {listing.name}
                    </span>
                    <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-2 shrink-0 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/20"
        >
          <Link href="/dashboard/explore">
            Browse More
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
