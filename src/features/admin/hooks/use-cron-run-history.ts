import { useQuery } from "@tanstack/react-query";
import type { CronRunHistoryRow } from "@/db/schemas/cron-run-history.schema";

/**
 * Fetch recent cron run history for admin. Optional filter by job name. Requirements: 9.5
 */
export function useCronRunHistory(jobName?: string | null, limit: number = 50) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (jobName?.trim()) params.set("jobName", jobName.trim());

  return useQuery<CronRunHistoryRow[]>({
    queryKey: ["admin", "cron-history", jobName ?? "", limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/payments/cron-history?${params.toString()}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch cron run history");
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
