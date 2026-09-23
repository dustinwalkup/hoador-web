/**
 * Typed, machine-readable dispute failures (P-E13-3).
 *
 * ## Why
 *
 * Every way filing a dispute can fail used to be a `ValidationError` or a
 * `ConflictError` carrying prose:
 *
 *   - `"An active dispute already exists for this rental"` — **with no dispute
 *     id**, so Req 19.1.3's *"IF a dispute already exists THEN the app SHALL
 *     route to it"* was unimplementable; the best a client could do was open the
 *     list and hope.
 *   - `"Rate limit exceeded (3/3 monthly, 10/10 yearly)"` — the same class, the
 *     same 400 and the same body shape as *"Description must be at least 10
 *     characters"*. Req 19.1.4 asks for the limit to be surfaced clearly, and
 *     the mobile client's rule #8 forbids branching on message strings (a
 *     released binary cannot be hot-fixed when the copy changes).
 *   - The filing-window and evidence-deadline refusals, likewise.
 *
 * ## Body shape
 *
 * `{ error: <human message>, code: <STABLE_CODE>, ...details }` — the
 * `ConversationArchivedError` / `ServiceBookingPaymentFailedError` shape, not
 * the `LISTING_DELETION_BLOCKED` one that puts the code in `error`. Both are
 * read correctly by the mobile client, but this one keeps a renderable message
 * for the web hooks, which throw `new Error(body.error)` and would otherwise
 * toast a SCREAMING_SNAKE code at the user (the trap `use-garage.ts` documents).
 *
 * Structurally these mirror `ListingDeletionBlockedError`: standalone `Error`s
 * with a typed `details` payload, a dedicated `handleApiError` branch, and a
 * place on that function's Sentry-capture exclusion list — a refused filing is
 * an expected user outcome, not an incident.
 *
 * Requirements: mobile Req 19.1.3, 19.1.4, 19.1.2 (as amended), 19.2.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-13-reviews-disputes-needs.md
 *       § F14 / F15 / F17 / P-E13-3
 */

/** Base for the dispute failures that carry a stable code and a typed payload. */
abstract class DisputeError<TDetails> extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details: TDetails,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * One dispute per transaction — and, per the unique index on
 * `disputes.rental_id` / `disputes.service_booking_id` plus the creation
 * service's prior-dispute check, **one ever**, not one at a time. `resolved`
 * distinguishes "go look at the open one" from "this transaction is finished
 * and cannot be disputed again", which the client has to say out loud before
 * someone tries.
 */
export class DisputeAlreadyExistsError extends DisputeError<{
  disputeId: string;
  resolved: boolean;
}> {
  readonly code = "DISPUTE_ALREADY_EXISTS";
  readonly statusCode = 409;
}

/**
 * Filing limits are 3 per calendar month and 10 per year. The counts ship as
 * fields so the client can render "3 of 3 this month" without parsing them back
 * out of a sentence.
 */
export class DisputeRateLimitedError extends DisputeError<{
  monthlyCount: number;
  monthlyLimit: number;
  yearlyCount: number;
  yearlyLimit: number;
}> {
  readonly code = "DISPUTE_RATE_LIMITED";
  // 429, not the 400 this used to be: it is a rate limit, and the distinction
  // is the whole point of giving it a code.
  readonly statusCode = 429;
}

/**
 * The filing window is closed — or not open yet.
 *
 * ⚠️ The window is the **unified 24-hour** one, not the per-reason-code table in
 * Req 19.1.2 and Appendix C: rentals open at `startDate` and close 24h after
 * `returnConfirmedAt`; service bookings open on the scheduled calendar day and
 * close 24h after `completedAt` (or 24h after the scheduled time when the
 * booking was never completed). `TimeWindowValidation.calculateDeadline`, which
 * implements the per-reason table, is reached by no production path. See the
 * epic plan's F12 — an EARS amendment is proposed.
 *
 * `deadline` is null on the not-open-yet branch, where there isn't one.
 */
export class DisputeWindowClosedError extends DisputeError<{
  deadline: string | null;
  reason: "not_open_yet" | "closed";
}> {
  readonly code = "DISPUTE_WINDOW_CLOSED";
  readonly statusCode = 400;
}

/** The evidence deadline on an `evidence_requested` dispute has passed. */
export class EvidenceDeadlinePassedError extends DisputeError<{
  deadline: string | null;
}> {
  readonly code = "EVIDENCE_DEADLINE_PASSED";
  readonly statusCode = 400;
}

/**
 * Ten evidence items per participant. A client that knows the limit and the
 * current count can stop someone *before* they pick and upload an 8MB photo,
 * which is the difference between a rule and an ambush.
 */
export class EvidenceLimitReachedError extends DisputeError<{
  limit: number;
  count: number;
}> {
  readonly code = "EVIDENCE_LIMIT_REACHED";
  readonly statusCode = 422;
}

/** Every typed dispute error, for `handleApiError`'s branch and its Sentry skip list. */
export const DISPUTE_ERRORS = [
  DisputeAlreadyExistsError,
  DisputeRateLimitedError,
  DisputeWindowClosedError,
  EvidenceDeadlinePassedError,
  EvidenceLimitReachedError,
] as const;

export type AnyDisputeError = InstanceType<(typeof DISPUTE_ERRORS)[number]>;

export function isDisputeError(error: unknown): error is AnyDisputeError {
  return DISPUTE_ERRORS.some((cls) => error instanceof cls);
}
