import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";

const JOB_NAME = "cleanup-cron-history";
const RETENTION_DAYS = 90;

async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const deletedCount =
      await CronRunHistoryService.deleteOldRuns(RETENTION_DAYS);

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: deletedCount,
      recordsSucceeded: deletedCount,
      recordsFailed: 0,
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      retentionDays: RETENTION_DAYS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "failure",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    console.error("Cleanup cron history cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/cron/cleanup-cron-history",
);
