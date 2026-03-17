"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useCronRunHistory } from "@/features/admin/hooks/use-cron-run-history";

const JOB_OPTIONS = [
  { value: "", label: "All jobs" },
  { value: "process-payouts", label: "Process payouts" },
  { value: "schedule-deposit-holds", label: "Schedule deposit holds" },
  { value: "monitor-deposit-expiry", label: "Monitor deposit expiry" },
  { value: "detect-stale-processing", label: "Detect stale processing" },
];

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function durationMs(start: Date | string, end: Date | string | null): string {
  if (!end) return "—";
  const s =
    typeof start === "string" ? new Date(start).getTime() : start.getTime();
  const e = typeof end === "string" ? new Date(end).getTime() : end.getTime();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Admin cron run history: filter by job, table with status and counts. Requirements: 9.5
 */
export function CronRunHistoryClient() {
  const [jobName, setJobName] = useState<string>("");
  const [limit] = useState(50);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useCronRunHistory(
    jobName || undefined,
    limit,
  );

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            value={jobName || "all"}
            onValueChange={(v) => setJobName(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Job" />
            </SelectTrigger>
            <SelectContent>
              {JOB_OPTIONS.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-destructive py-12 text-center">
            <p>Failed to load cron history</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="overflow-x-auto rounded-lg border">
            {data.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No runs found.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b text-left text-xs font-medium">
                    <th className="px-4 py-2 font-medium">Job</th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Started
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Completed
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Duration
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Eligible
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Succeeded
                    </th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">
                      Failed
                    </th>
                    <th className="w-7 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((run) => (
                    <>
                      <tr
                        key={run.id}
                        className="cursor-pointer border-b text-sm last:border-b-0"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setExpandedId(expandedId === run.id ? null : run.id)
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          setExpandedId(expandedId === run.id ? null : run.id)
                        }
                      >
                        <td className="px-4 py-3 font-medium">{run.jobName}</td>
                        <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                          {formatDate(run.startedAt)}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                          {run.completedAt ? formatDate(run.completedAt) : "—"}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                          {durationMs(run.startedAt, run.completedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            variant={
                              run.status === "failure"
                                ? "destructive"
                                : run.status === "success"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {run.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {run.recordsEligible ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {run.recordsSucceeded ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {run.recordsFailed ?? "—"}
                        </td>
                        <td className="px-1 py-3 text-right">
                          {run.errorMessage || run.metadata ? (
                            expandedId === run.id ? (
                              <ChevronUp className="inline h-4 w-4" />
                            ) : (
                              <ChevronDown className="inline h-4 w-4" />
                            )
                          ) : null}
                        </td>
                      </tr>
                      {expandedId === run.id &&
                        (run.errorMessage || run.metadata) && (
                          <tr
                            key={`${run.id}-detail`}
                            className="border-b last:border-b-0"
                          >
                            <td
                              colSpan={9}
                              className="bg-muted/30 px-4 py-2 text-xs"
                            >
                              {run.errorMessage && (
                                <p className="text-destructive font-medium">
                                  Error: {run.errorMessage}
                                </p>
                              )}
                              {run.metadata && (
                                <pre className="text-muted-foreground mt-1 overflow-auto break-words whitespace-pre-wrap">
                                  {run.metadata}
                                </pre>
                              )}
                            </td>
                          </tr>
                        )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
