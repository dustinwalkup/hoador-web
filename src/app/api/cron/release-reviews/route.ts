import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { BlindReviewService } from "@/features/reviews/services/blind-review-service";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

const JOB_NAME = "release-reviews";

/**
 * Cron job to release expired blind reviews.
 * Schedule: 0 * * * * (hourly)
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const result = await BlindReviewService.releaseExpiredReviews();

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: result.eligible,
      recordsSucceeded: result.released,
      recordsFailed: result.failed,
    });

    return NextResponse.json({
      success: true,
      ...result,
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

    await sendOpsAlert({
      event: "release-reviews-cron-failure",
      message: error instanceof Error ? error.message : String(error),
      sendEmailAlert: true,
    }).catch(() => {
      // sendOpsAlert already logs internally on failure
    });

    console.error("Release reviews cron error:", error);
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
  "GET /api/cron/release-reviews",
);
