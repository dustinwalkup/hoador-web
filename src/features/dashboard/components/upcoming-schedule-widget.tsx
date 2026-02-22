import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ScheduleEntry {
  date: Date;
  description: string;
  linkTo?: string;
}

export interface UpcomingScheduleWidgetProps {
  entries: ScheduleEntry[];
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(d));
}

/**
 * Upcoming schedule with teal accent, date badges, and graceful empty state.
 */
export function UpcomingScheduleWidget({
  entries,
}: UpcomingScheduleWidgetProps) {
  return (
    <Card className="border-t-4 border-t-teal-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/10">
            <Calendar
              className="h-4 w-4 text-teal-600 dark:text-teal-400"
              aria-hidden
            />
          </div>
          Upcoming Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10">
              <Calendar className="h-6 w-6 text-teal-400" />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              Nothing scheduled
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Upcoming pickups and returns will show here
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry, i) => {
              const inner = (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-teal-500/10 text-center">
                    <span className="text-[10px] leading-none font-semibold text-teal-600 uppercase dark:text-teal-400">
                      {new Intl.DateTimeFormat("en-US", {
                        weekday: "short",
                      }).format(new Date(entry.date))}
                    </span>
                    <span className="text-sm leading-tight font-bold text-teal-700 dark:text-teal-300">
                      {new Date(entry.date).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{entry.description}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(entry.date)}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={`${new Date(entry.date).getTime()}-${i}`}>
                  {entry.linkTo ? (
                    <Link
                      href={entry.linkTo}
                      className="group flex items-center rounded-lg p-2 transition-colors hover:bg-teal-50 dark:hover:bg-teal-950/20"
                    >
                      <div className="flex-1">{inner}</div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ) : (
                    <div className="rounded-lg p-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
