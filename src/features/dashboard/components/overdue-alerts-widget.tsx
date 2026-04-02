import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface OverdueItem {
  id: string;
  listingName: string;
  statusText: string;
  otherPartyName: string;
  linkTo: string;
}

export interface OverdueAlertsWidgetProps {
  items: OverdueItem[];
}

/**
 * Overdue alerts with a bold red accent and improved list items with hover arrows.
 */
export function OverdueAlertsWidget({ items }: OverdueAlertsWidgetProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-t-4 border-red-200 border-t-red-500 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-red-700 dark:text-red-400">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15">
                <AlertTriangle
                  className="h-4 w-4 text-red-600 dark:text-red-400"
                  aria-hidden
                />
              </div>
              <span>Overdue</span>
            </div>
          </CardTitle>
          <Badge
            variant="destructive"
            className="px-2.5 py-0.5 text-xs font-semibold"
          >
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-hover-reveal max-h-60 overflow-y-auto">
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.linkTo}
                  className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-red-100/70 dark:hover:bg-red-900/20"
                >
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-red-700 dark:text-red-400">
                      {item.listingName}
                    </span>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80">
                      {item.statusText} &middot; {item.otherPartyName}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-red-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
