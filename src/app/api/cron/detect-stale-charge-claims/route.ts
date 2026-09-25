import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";
import { StaleProcessingDetectionService } from "@/features/admin/services/stale-processing-detection-service";

// Explicit budget rather than the platform default (PERF-06).
export const maxDuration = 60;

const JOB_NAME = "detect-stale-charge-claims";

/**
 * Cron job: alert when a rental approval or service accept left its charge
 * claim (`paymentStatus = 'processing'`) in place — the customer may have been
 * charged while the request never moved on.
 * Schedule: hourly, so a charged renter isn't left waiting for the daily run.
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const result =
      await StaleProcessingDetectionService.detectStaleChargeClaims();

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: 0,
      recordsSucceeded: 0,
      recordsFailed: result.staleCount,
      metadata:
        result.staleCount > 0
          ? JSON.stringify({
              rentalRequestIds: result.rentalRequestIds,
              serviceBookingIds: result.serviceBookingIds,
            })
          : null,
    });

    return NextResponse.json({
      success: true,
      staleCount: result.staleCount,
      rentalRequestIds: result.rentalRequestIds,
      serviceBookingIds: result.serviceBookingIds,
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

    console.error("Detect stale charge claims cron error:", error);

    await sendOpsAlert({
      event: "detect_stale_charge_claims_cron_failed",
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
  "GET /api/cron/detect-stale-charge-claims",
);
