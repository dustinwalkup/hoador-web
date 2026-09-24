import { auditLogDAL, disputeDAL } from "@/dal";
import { DeadlineEnforcementService } from "@/features/disputes/lib/deadline-enforcement";
import { sendEvidenceDeadlineApproaching } from "@/features/disputes/notifications/deadline-notifications";
import { captureNonCriticalError } from "@/lib/api/route-helpers";

/**
 * The hourly evidence-deadline job (P-E13-9, mobile Req 19.2.3; audit BIZ-17),
 * run by `GET /api/cron/evidence-deadlines`. Before it existed, nothing
 * enforced a deadline or sent either deadline notification.
 *
 * Two passes, each bounded by `BATCH`:
 * 1. **Remind** both parties once, when the active deadline is within
 *    `REMINDER_LEAD_MS`.
 * 2. **Enforce**: move `evidence_requested` disputes past their deadline to
 *    `under_review` (`DeadlineEnforcementService.checkAndEnforce`), which
 *    notifies both parties.
 *
 * Reminding runs first, so a dispute whose whole last day fell between two
 * runs is at least never reminded AFTER it has been moved on.
 */

export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;

/**
 * The once-only marker for a reminder, in the append-only `audit_logs`. Keyed
 * by the deadline itself, not only the dispute: a new evidence request sets a
 * fresh deadline (`disputeDAL.updateState`), and that deadline earns its own
 * reminder.
 *
 * Why a marker rather than a time window ("remind if the deadline is 23–24h
 * out"): GitHub's scheduled workflows start late and sometimes skip a run, so
 * a one-hour window both misses reminders and, on a double run, repeats them.
 */
export const REMINDER_ACTION = "dispute.evidence_deadline_reminder_sent";

export interface SweepResult {
  remindersEligible: number;
  remindersSent: number;
  remindersFailed: number;
  expiredEligible: number;
  expiredEnforced: number;
  expiredFailed: number;
}

export async function sendDeadlineReminders(now: Date): Promise<{
  eligible: number;
  sent: number;
  failed: number;
}> {
  const due = await disputeDAL.listActiveEvidenceDeadlinesBetween(
    now,
    new Date(now.getTime() + REMINDER_LEAD_MS),
    BATCH,
  );

  let sent = 0;
  let failed = 0;
  for (const candidate of due) {
    const deadline = candidate.deadline.toISOString();
    try {
      const already = await auditLogDAL.exists({
        entityType: "dispute",
        entityId: candidate.id,
        action: REMINDER_ACTION,
        metadata: { deadline },
      });
      if (already) continue;

      const dispute = await disputeDAL.getById(candidate.id);
      if (!dispute) continue;

      const outcome = await sendEvidenceDeadlineApproaching(
        dispute,
        candidate.deadline,
      );
      if (!outcome) continue;

      // Nobody got it: leave no marker, so the next run tries again.
      if (outcome.sent === 0) {
        failed += 1;
        continue;
      }

      // Recorded when at least one party got it, even if the other's send
      // failed: re-running would repeat it to the party who DID get it. The
      // partial failure is counted and reported.
      await auditLogDAL.create({
        entityType: "dispute",
        entityId: candidate.id,
        action: REMINDER_ACTION,
        metadata: {
          deadline,
          status: candidate.status,
          sent: outcome.sent,
          failed: outcome.failed,
        },
      });

      if (outcome.failed > 0) failed += 1;
      else sent += 1;
    } catch (error) {
      failed += 1;
      captureNonCriticalError(error, {
        route: "GET /api/cron/evidence-deadlines",
        action: "send_deadline_reminder",
      });
    }
  }

  return { eligible: due.length, sent, failed };
}

export async function enforceExpiredDeadlines(now: Date): Promise<{
  eligible: number;
  enforced: number;
  failed: number;
}> {
  const expired = await disputeDAL.listExpiredEvidenceRequests(now, BATCH);

  let enforced = 0;
  let failed = 0;
  for (const id of expired) {
    // `checkAndEnforce` never throws: it re-reads the dispute and reports an
    // `error` instead. Not enforced and no error means it had already moved.
    const result = await DeadlineEnforcementService.checkAndEnforce(id);
    if (result.enforced) enforced += 1;
    else if (result.error) failed += 1;
  }

  return { eligible: expired.length, enforced, failed };
}

export async function runEvidenceDeadlineSweep(
  now: Date = new Date(),
): Promise<SweepResult> {
  const reminders = await sendDeadlineReminders(now);
  const expired = await enforceExpiredDeadlines(now);
  return {
    remindersEligible: reminders.eligible,
    remindersSent: reminders.sent,
    remindersFailed: reminders.failed,
    expiredEligible: expired.eligible,
    expiredEnforced: expired.enforced,
    expiredFailed: expired.failed,
  };
}
