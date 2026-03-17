import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";

/**
 * GET /api/admin/payments/cron-history
 * Recent cron run history, optionally filtered by job name. Requires admin.
 * Query: jobName, limit
 */
async function getHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const searchParams = request.nextUrl.searchParams;
    const jobName = searchParams.get("jobName") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit =
      limitParam !== null && limitParam !== "" ? parseInt(limitParam, 10) : 50;
    const safeLimit =
      Number.isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 100);

    const result = await CronRunHistoryService.getRecentRuns(
      jobName || undefined,
      safeLimit,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/payments/cron-history",
);
