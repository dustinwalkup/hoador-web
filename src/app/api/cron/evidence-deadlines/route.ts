import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { runEvidenceDeadlineSweep } from "@/features/disputes/services/evidence-deadline-sweep";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

// Explicit budget rather than the platform default (PERF-06).
export const maxDuration = 60;

const JOB_NAME = "evidence-deadlines";

/**
 * Cron job for dispute evidence deadlines (P-E13-9): reminds both parties a
 * day before the active deadline, and moves `evidence_requested` disputes
 * past it to `under_review`. See `runEvidenceDeadlineSweep`.
 * Schedule: 0 * * * * (hourly)
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();

  try {
    const result = await runEvidenceDeadlineSweep(startedAt);

    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: result.remindersEligible + result.expiredEligible,
      recordsSucceeded: result.remindersSent + result.expiredEnforced,
      recordsFailed: result.remindersFailed + result.expiredFailed,
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
      event: "evidence-deadlines-cron-failure",
      message: error instanceof Error ? error.message : String(error),
      sendEmailAlert: true,
    }).catch(() => {
      // sendOpsAlert already logs internally on failure
    });

    console.error("Evidence deadlines cron error:", error);
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
  "GET /api/cron/evidence-deadlines",
);
