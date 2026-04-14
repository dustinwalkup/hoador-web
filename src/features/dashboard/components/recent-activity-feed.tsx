import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStateCoach } from "@/components/empty-state-coach";

export interface ActivityFeedItem {
  id: string;
  title: string;
  description?: string;
  relativeTime: string;
  linkTo?: string;
}

export interface RecentActivityFeedProps {
  items: ActivityFeedItem[];
}

/**
 * Activity feed with indigo accent, timeline dots, and hover state.
 */
export function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  return (
    <Card className="border-t-4 border-t-indigo-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10">
            <Activity
              className="h-4 w-4 text-indigo-600 dark:text-indigo-400"
              aria-hidden
            />
          </div>
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyStateCoach
            icon={Activity}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10"
            headline="No recent activity"
            description="Actions like booking requests, approvals, and completions will appear here"
          />
        ) : (
          <div className="scrollbar-hover-reveal max-h-80 overflow-y-auto">
            <ul className="relative space-y-1">
              {items.map((item, index) => {
                const content = (
                  <div className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className="z-10 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      {index < items.length - 1 && (
                        <div className="absolute top-3 h-full w-px bg-indigo-200 dark:bg-indigo-800" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-4">
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      {item.description && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {item.description}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {item.relativeTime}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.linkTo ? (
                      <Link
                        href={item.linkTo}
                        className="group flex items-center rounded-lg p-2 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                      >
                        <div className="flex-1">{content}</div>
                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    ) : (
                      <div className="rounded-lg p-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
