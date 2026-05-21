import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { expirePendingBookings } from "@/features/payments/lib/expire-pending-bookings";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";

const JOB_NAME = "expire-pending-bookings";

/**
 * Cron job to auto-cancel pending rental requests and service bookings whose
 * expiresAt has passed.
 * Schedule: 0 * * * * (hourly)
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const result = await expirePendingBookings();

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: result.rentalsChecked + result.servicesChecked,
      recordsSucceeded: result.expiredCount,
      recordsFailed: result.failedCount,
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

    console.error("Expire pending bookings cron error:", error);
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
  "GET /api/cron/expire-pending-bookings",
);
