import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ScheduleEntry,
  ScheduleEntryRole,
} from "@/features/dashboard/types";
import { ScheduleEntryNextStep } from "@/features/dashboard/components/schedule-entry-next-step";

export type { ScheduleEntry };

const ROLE_BADGE: Record<
  ScheduleEntryRole,
  { label: string; className: string }
> = {
  renter: {
    label: "Renter",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  owner: {
    label: "Owner",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  client: {
    label: "Client",
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  provider: {
    label: "Provider",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

export interface UpcomingScheduleWidgetProps {
  entries: ScheduleEntry[];
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Upcoming schedule with teal accent, date badges, role pills, and graceful empty state.
 */
export function UpcomingScheduleWidget({
  entries,
}: UpcomingScheduleWidgetProps) {
  const countLabel =
    entries.length === 1 ? "1 item" : `${entries.length} items`;

  return (
    <Card className="flex h-full min-h-0 flex-1 flex-col border-t-4 border-t-teal-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-medium">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
              <Calendar
                className="h-4 w-4 text-teal-600 dark:text-teal-400"
                aria-hidden
              />
            </div>
            <span>Upcoming Schedule</span>
          </CardTitle>
          <Badge className="shrink-0 border-transparent bg-teal-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-teal-600 dark:bg-teal-600">
            {countLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent
        className={
          entries.length > 0
            ? "flex min-h-10 flex-1 flex-col overflow-hidden pt-0"
            : undefined
        }
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10">
              <Calendar className="h-6 w-6 text-teal-400" />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              Nothing scheduled
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Upcoming rentals and services will show here
            </p>
          </div>
        ) : (
          <div className="scrollbar-hover-reveal max-h-96 min-h-0 overflow-x-hidden overflow-y-auto">
            <ul className="">
              {entries.map((entry) => {
                const badge = ROLE_BADGE[entry.role];
                const inner = (
                  <div className="flex items-center gap-3">
                    <div className="flex min-w-15 flex-col items-center justify-center gap-2">
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-teal-500/10 text-center">
                        <span className="text-xs leading-none font-semibold text-teal-600 uppercase dark:text-teal-400">
                          {new Intl.DateTimeFormat("en-US", {
                            weekday: "short",
                          }).format(entry.date)}
                        </span>
                        <span className="text-md leading-tight font-bold text-teal-700 dark:text-teal-300">
                          {entry.date.getDate()}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{entry.description}</p>
                      {entry.subtitle ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {entry.subtitle}
                        </p>
                      ) : null}
                      {/* Role badge + next-step chip on one row.
                          flex-1 and stopPropagation live inside the client component. */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <ScheduleEntryNextStep entry={entry} />
                      </div>
                    </div>
                  </div>
                );

                return (
                  <li key={entry.id}>
                    <div className="px-1 py-4">{inner}</div>
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
