import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";
import { ServicePaymentLifecycleService } from "@/features/services/services/service-payment-lifecycle-service";

const JOB_NAME = "detect-stale-service-processing";

/**
 * Cron job: alert when service payment lifecycle rows are stuck in payout processing.
 * Schedule: hourly (same cadence as rental stale detection).
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const result =
      await ServicePaymentLifecycleService.detectStaleProcessing(60);

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: 0,
      recordsSucceeded: 0,
      recordsFailed: result.staleCount,
      metadata:
        result.bookingIds.length > 0
          ? JSON.stringify({ bookingIds: result.bookingIds })
          : null,
    });

    return NextResponse.json({
      success: true,
      staleCount: result.staleCount,
      bookingIds: result.bookingIds,
      thresholdMinutes: result.thresholdMinutes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "failure",
      errorMessage: message,
    });

    console.error("Detect stale service processing cron error:", error);

    await sendOpsAlert({
      event: "detect_stale_service_processing_cron_failed",
      message,
      sendEmailAlert: true,
      metadata: { jobName: JOB_NAME },
    }).catch(() => {});

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/cron/detect-stale-service-processing",
);
