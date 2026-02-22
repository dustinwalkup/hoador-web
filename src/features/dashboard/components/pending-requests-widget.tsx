import Link from "next/link";
import { Clock, ArrowRight, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PendingRequestItem {
  id: string;
  listingName: string;
  requesterName: string;
  statusText: string;
  requestDetailUrl: string;
}

export interface PendingRequestsWidgetProps {
  items: PendingRequestItem[];
  totalCount: number;
}

/**
 * Pending lending requests with amber accent, icon circle, and hover arrows.
 */
export function PendingRequestsWidget({
  items,
  totalCount,
}: PendingRequestsWidgetProps) {
  if (totalCount === 0) return null;

  return (
    <Card className="border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                <Clock
                  className="h-4 w-4 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
              </div>
              <span>Pending Requests</span>
            </div>
          </CardTitle>
          <Badge className="bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {totalCount} {totalCount === 1 ? "request" : "requests"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.requestDetailUrl}
                className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-amber-100/70 dark:hover:bg-amber-900/20"
              >
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {item.listingName}
                  </span>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                    {item.requesterName} &middot; {item.statusText}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-amber-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
      {totalCount > items.length && (
        <CardFooter className="pt-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="ml-auto text-xs font-medium text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            <Link href="/dashboard/lending/incoming">
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
