import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { StaleProcessingDetectionService } from "@/features/admin/services/stale-processing-detection-service";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";

const JOB_NAME = "detect-stale-processing";

/**
 * Cron job to detect lifecycle records stuck in payoutStatus 'processing'.
 * Schedule: hourly (same cadence as other payment crons).
 * Requirements: 4.2, 5.1, 9.3
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const result =
      await StaleProcessingDetectionService.detectStaleProcessing();

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: 0,
      recordsSucceeded: 0,
      recordsFailed: result.staleCount,
      metadata:
        result.rentalIds.length > 0
          ? JSON.stringify({ rentalIds: result.rentalIds })
          : null,
    });

    return NextResponse.json({
      success: true,
      staleCount: result.staleCount,
      rentalIds: result.rentalIds,
      thresholdMinutes: result.thresholdMinutes,
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

    console.error("Detect stale processing cron error:", error);
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
  "GET /api/cron/detect-stale-processing",
);
