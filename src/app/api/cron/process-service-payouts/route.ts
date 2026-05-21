import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";
import { ServicePaymentLifecycleService } from "@/features/services/services/service-payment-lifecycle-service";

const JOB_NAME = "process-service-payouts";

/**
 * Cron job: transfer net service fees to provider Connect accounts (24h+ after completion).
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const summary = await ServicePaymentLifecycleService.processPayouts(20);

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: summary.eligible,
      recordsSucceeded: summary.succeeded,
      recordsFailed: summary.failed,
    });

    return NextResponse.json({
      processedCount: summary.processed,
      successCount: summary.succeeded,
      failureCount: summary.failed,
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

    console.error("Service payout processing cron error:", error);

    await sendOpsAlert({
      event: "process_service_payouts_cron_failed",
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
  "GET /api/cron/process-service-payouts",
);
