import Link from "next/link";
import { Clock, Handshake, ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  rentalItems: PendingRequestItem[];
  rentalTotalCount: number;
  serviceItems: PendingRequestItem[];
  serviceTotalCount: number;
}

function RequestList({
  items,
  label,
  icon: Icon,
  viewAllHref,
  totalCount,
}: {
  items: PendingRequestItem[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  viewAllHref: string;
  totalCount: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400/80">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        <Badge className="ml-auto bg-amber-100 px-2 py-0 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {totalCount}
        </Badge>
      </div>
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
      {totalCount > items.length && (
        <div className="mt-1 flex justify-end">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs font-medium text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            <Link href={viewAllHref}>
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Pending rental and service requests with amber accent, icon circle, and hover arrows.
 */
export function PendingRequestsWidget({
  rentalItems,
  rentalTotalCount,
  serviceItems,
  serviceTotalCount,
}: PendingRequestsWidgetProps) {
  const totalCount = rentalTotalCount + serviceTotalCount;
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
      <CardContent className="space-y-4">
        {rentalTotalCount > 0 && (
          <RequestList
            items={rentalItems}
            label="Rental requests"
            icon={Clock}
            viewAllHref="/dashboard/rentals/incoming/requests"
            totalCount={rentalTotalCount}
          />
        )}
        {serviceTotalCount > 0 && (
          <RequestList
            items={serviceItems}
            label="Service requests"
            icon={Handshake}
            viewAllHref="/dashboard/services/incoming/pending"
            totalCount={serviceTotalCount}
          />
        )}
      </CardContent>
    </Card>
  );
}
