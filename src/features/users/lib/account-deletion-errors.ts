/**
 * A single reason an account cannot be deleted yet, shaped for the client to
 * render directly (Req 2.5.2 — "the app SHALL display those blockers").
 *
 * `type` is a stable code the app branches on; `message` is a human-readable
 * fallback; `count` lets the app say "3 active rentals".
 */
export type AccountDeletionBlocker = {
  type:
    | "active_rentals"
    | "active_bookings"
    | "pending_requests"
    | "deposit_holds"
    | "incomplete_payouts"
    | "open_disputes";
  count: number;
  message: string;
};

/**
 * Thrown when a self-service account deletion is refused because the user still
 * has obligations that must conclude first. Routes translate this to HTTP 409
 * with body `{ error: "ACCOUNT_DELETION_BLOCKED", blockers: [...] }`.
 *
 * Mirrors `PaymentSetupRequiredError` deliberately: a standalone `Error` (not a
 * `DALError`) carrying a typed `details` payload, with a dedicated
 * `handleApiError` branch and a spot on that function's Sentry-capture exclusion
 * list — a blocked deletion is an expected user outcome, not an incident.
 *
 * Requirements: 2.5.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.1 (D-E2-10)
 */
export class AccountDeletionBlockedError extends Error {
  public readonly code = "ACCOUNT_DELETION_BLOCKED";
  public readonly statusCode = 409;

  constructor(public readonly details: { blockers: AccountDeletionBlocker[] }) {
    super("Account deletion is blocked by unresolved obligations");
    this.name = "AccountDeletionBlockedError";
  }
}
