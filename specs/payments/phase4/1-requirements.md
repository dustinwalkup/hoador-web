# Stripe Connect Payment Lifecycle (Phase 4) - Operational Tooling - Requirements Document

## Introduction

This document defines the Phase 4 requirements for Hoador's payment operational tooling. Phase 1 established the platform-hold payment model with deposit auth holds, payout processing, and return confirmation; Phase 2 added automated cancellation paths and no-show handling; Phase 3 added dispute resolution, payout freeze on dispute, and chargeback handling. The payment lifecycle is tracked in `rental_payment_lifecycle`, and cron endpoints (triggered by GitHub Actions) run deposit scheduling, payout processing, and deposit expiry monitoring. Ops alerting via `sendOpsAlert` exists for critical failures.

Phase 4 adds operational tooling so that admins can view payment states, detect and be alerted when records are stuck in processing, and perform manual overrides when needed. Today there is no admin UI or API exposing payment lifecycle data, no detection of stale processing (records stuck in `payoutStatus: 'processing'` after a cron crash), no manual reset or retry tools, and no cron run history.

### Scope

**In scope:** Admin dashboard section for payment lifecycle — list and filter lifecycle records by status (depositHoldStatus, ownerTransferStatus, payoutStatus), search by rental or user, and drill-down to per-rental detail with full timeline and Stripe IDs; payment metrics and aggregates (pending payouts, failed transfers, frozen, held/expired deposits) on the admin dashboard; stale processing detection (records in `payoutStatus: 'processing'` or equivalent for longer than a configurable threshold, e.g. 1 hour) with ops alert; manual override APIs — reset payout status to allow cron retry, reset owner transfer status to retry transfer, force-release deposit hold — all admin-only and audit-logged; cron run history — persist execution results (start, end, counts, errors) and admin UI to view recent runs; notifications to renter/owner when an admin performs a manual override that affects them.

**Out of scope:** Renter-facing payment timeline or status UI; multi-currency; automated dispute resolution; per-listing payout policies; payout scheduling preferences (e.g. weekly batch, manual request); changing how cron is scheduled (GitHub Actions remains the trigger).

### Key Architectural Decisions

1. **Cron trigger:** Cron endpoints are invoked by GitHub Actions (or equivalent external scheduler), not Vercel Cron. Phase 4 does not change scheduling; it adds visibility and recovery for payment operations that those crons perform.
2. **Stale threshold:** A record is considered stale when `payoutStatus` is `'processing'` (or `ownerTransferStatus` is `'processing'` where applicable) for longer than a configurable threshold (e.g. 1 hour). Stale detection MAY be a dedicated cron endpoint or run as part of an existing cron; the system SHALL alert ops when stale records are found.
3. **Manual overrides are audit-only by default:** Manual reset of payout status or owner transfer status does not immediately call Stripe; it sets status back to `'pending'` so the next payout cron run will retry. Manual deposit release does call Stripe (`paymentIntents.cancel`) and update lifecycle state. All override actions SHALL be recorded in an audit log with admin user ID, action, before/after state, and optional reason.
4. **Cron run history in-app:** Execution results (start time, end time, job name, records processed, successes, failures, error details) SHALL be persisted (e.g. in a new table) so admins can view recent runs in the admin UI. This complements any external run history (e.g. GitHub Actions logs).
5. **Admin-only access:** All new admin APIs and UI for payment lifecycle, metrics, manual overrides, and cron history SHALL require admin authorization (e.g. existing `requireAdmin()` or equivalent). No new public or renter/owner-facing payment state APIs are required for Phase 4.

## Requirements

### Requirement 1: Payment Lifecycle Dashboard

**User Story:** As an admin, I want to view and filter all payment lifecycle records so that I can monitor payment states and find rentals that need attention.

#### Acceptance Criteria

1. The system SHALL provide an admin API (e.g. `GET /api/admin/payments/lifecycle`) that returns paginated `rental_payment_lifecycle` records with associated rental and user context (e.g. rental id, renter id, owner id, listing id, statuses, timestamps)
2. The API SHALL support filtering by `depositHoldStatus`, `ownerTransferStatus`, and `payoutStatus` (single or multiple values per dimension)
3. The API SHALL support search by rental id, rental request id, renter id, or owner id (exact or partial as defined in design)
4. The system SHALL provide an admin UI (e.g. under the existing admin dashboard) that displays the lifecycle list with filters and search, and links to a per-rental detail view
5. Only users with admin privileges SHALL be permitted to access the lifecycle list API and UI
6. The list SHALL display at least: rental id, renter, owner, depositHoldStatus, ownerTransferStatus, payoutStatus, relevant timestamps (e.g. depositHoldPlacedAt, ownerTransferredAt, updatedAt)

### Requirement 2: Payment Lifecycle Detail View

**User Story:** As an admin, I want to see the full payment timeline and Stripe identifiers for a single rental so that I can troubleshoot issues and verify state.

#### Acceptance Criteria

1. The system SHALL provide an admin API (e.g. `GET /api/admin/payments/lifecycle/[rentalId]` or equivalent) that returns the full payment lifecycle record for a rental plus related data: rental details, returnConfirmedAt, Stripe charge id, deposit PaymentIntent id (if applicable), transfer id (if completed), and linked dispute summary (open dispute, resolved, etc.)
2. The admin UI SHALL provide a detail page (or panel) for a single rental showing: charge captured, deposit hold status and timestamps, return confirmation time, dispute window, payout status, owner transfer status, and all relevant Stripe IDs (charge, payment intent, transfer)
3. WHERE a dispute exists for the rental THEN the detail view SHALL indicate dispute status and link to the dispute review UI
4. Only users with admin privileges SHALL be permitted to access the lifecycle detail API and UI

### Requirement 3: Payment Metrics and Aggregates

**User Story:** As an admin, I want to see summary counts of payment states (pending payouts, failed transfers, frozen, held/expired deposits) so that I can gauge workload and spot problems quickly.

#### Acceptance Criteria

1. The system SHALL provide an admin API (e.g. `GET /api/admin/payments/metrics` or equivalent) that returns aggregate counts for: payouts pending (payoutStatus = 'pending', eligible for cron), owner transfer failed, owner transfer frozen (dispute), deposit hold scheduled, deposit hold held, deposit hold expired, deposit hold failed, and any other statuses defined in the lifecycle schema
2. The admin dashboard SHALL display these metrics as summary cards or a small dashboard section (e.g. on the existing admin dashboard or a dedicated payments subsection)
3. Metrics SHALL be computed from the `rental_payment_lifecycle` table (and related rental/dispute data as needed) and SHALL reflect current state; the API MAY be cached for a short period (e.g. 1–5 minutes) as defined in design
4. Only users with admin privileges SHALL be permitted to access the metrics API and view the metrics UI

### Requirement 4: Stale Processing Detection

**User Story:** As the platform, I want to detect when a payment lifecycle record is stuck in a processing state beyond a threshold so that ops can be alerted and recovery can be triggered.

#### Acceptance Criteria

1. The system SHALL consider a record stale when `payoutStatus` is `'processing'` for longer than a configurable threshold (e.g. 1 hour). The threshold MAY be defined by environment variable or config and SHALL be documented
2. The system SHALL run stale detection either via a dedicated cron endpoint (e.g. invoked by GitHub Actions on a schedule) or as a step within an existing payment cron; the exact placement MAY be defined in the design phase
3. WHEN stale records are found THEN the system SHALL invoke the stale processing alert (Requirement 5) and SHALL NOT automatically reset status — manual override (Requirement 6) or ops procedure is required to unstick the record
4. The system SHALL log the count of stale records and their rental ids when detection runs
5. Stale detection SHALL only consider `payoutStatus: 'processing'` (and optionally `ownerTransferStatus: 'processing'` if used as a separate lock); the design MAY define whether both are checked

### Requirement 5: Stale Processing Alerts

**User Story:** As the operations team, I want to be alerted when payment records are stuck in processing so that I can investigate and use manual override if needed.

#### Acceptance Criteria

1. WHEN stale processing detection finds one or more stale records THEN the system SHALL send an ops alert via the existing `sendOpsAlert` (or equivalent) mechanism with `sendEmailAlert: true` when configured
2. The alert SHALL include: event type (e.g. `stale_processing_detected`), count of stale records, and at least the rental ids (and optionally how long each has been stuck)
3. The system SHALL log the alert with structured fields (alertType: "ops", event, rentalIds, count) for searchability
4. The system SHALL send at most one email per detection run to avoid flooding; repeated detection runs that find the same stale records MAY send repeated alerts (e.g. hourly) until the records are resolved — the exact throttling MAY be defined in design

### Requirement 6: Manual Payout Status Reset

**User Story:** As an admin, I want to reset a rental's payout status from 'processing' or 'failed' back to 'pending' so that the payout cron can retry the rental on the next run.

#### Acceptance Criteria

1. The system SHALL provide an admin API (e.g. `POST /api/admin/payments/lifecycle/[rentalId]/reset-payout-status` or equivalent) that sets `payoutStatus` to `'pending'` when the current value is `'processing'` or `'failed'`
2. WHEN the reset is performed THEN the system SHALL record an audit log entry with: admin user id, rental id, action (e.g. `payout_status_reset`), previous status, new status (`'pending'`), and optional reason text
3. The API SHALL require admin authorization and SHALL reject requests when the current `payoutStatus` is not `'processing'` or `'failed'` (e.g. HTTP 400 with a clear message)
4. After a successful reset, the payout cron SHALL treat the rental as eligible on its next run (subject to other criteria: completed, returnConfirmedAt > 24h ago, no open disputes)
5. The system SHALL NOT call Stripe in this action — it only updates DB state so the cron can retry

### Requirement 7: Manual Owner Transfer Retry

**User Story:** As an admin, I want to reset a rental's owner transfer status from 'failed' back to 'pending' so that the payout cron can retry the transfer.

#### Acceptance Criteria

1. The system SHALL provide an admin API (e.g. `POST /api/admin/payments/lifecycle/[rentalId]/reset-transfer-status` or equivalent) that sets `ownerTransferStatus` to `'pending'` when the current value is `'failed'`
2. WHEN the reset is performed THEN the system SHALL record an audit log entry with: admin user id, rental id, action (e.g. `owner_transfer_status_reset`), previous status, new status (`'pending'`), and optional reason text
3. The API SHALL require admin authorization and SHALL reject requests when the current `ownerTransferStatus` is not `'failed'`
4. After a successful reset, the payout cron SHALL treat the rental as eligible for owner transfer on its next run (subject to other criteria). The system MAY also set `payoutStatus` to `'pending'` if it was `'failed'` so the cron picks it up — the exact behavior MAY be defined in design
5. The system SHALL NOT call Stripe in this action — it only updates DB state so the cron can retry

### Requirement 8: Manual Deposit Hold Release

**User Story:** As an admin, I want to force-release a deposit hold when ops determines it is safe to do so (e.g. dispute resolved manually, edge case).

#### Acceptance Criteria

1. The system SHALL provide an admin API (e.g. `POST /api/admin/payments/lifecycle/[rentalId]/release-deposit` or equivalent) that, when `depositHoldStatus` is `'held'`, calls `stripe.paymentIntents.cancel()` on the deposit PaymentIntent (identified via the rental's deposit PaymentIntent id) and then sets `depositHoldStatus` to `'released'` and `depositReleasedAt` to the current timestamp on the lifecycle record
2. WHEN the release is performed THEN the system SHALL record an audit log entry with: admin user id, rental id, action (e.g. `manual_deposit_release`), optional reason text, and outcome (success or failure)
3. The API SHALL require admin authorization and SHALL reject requests when `depositHoldStatus` is not `'held'` (e.g. already released, expired, not_applicable, etc.) with an appropriate error
4. IF the Stripe cancel call fails THEN the system SHALL NOT update the lifecycle record to `'released'`, SHALL record the failure in the audit log, and SHALL alert ops
5. The system SHALL use idempotency where possible (e.g. if the PaymentIntent is already canceled, treat as success and update local state if still `'held'`)

### Requirement 9: Cron Run History

**User Story:** As an admin, I want to see recent cron execution results (start, end, counts, errors) so that I can verify crons ran and troubleshoot failures.

#### Acceptance Criteria

1. The system SHALL persist cron execution results for the payment-related cron jobs (e.g. schedule-deposit-holds, process-payouts, monitor-deposit-expiry). Each record SHALL include at least: job name or identifier, start time, end time, count of records processed (or eligible), count succeeded, count failed, and optional error message or details for failures
2. Persistence MAY be implemented by a new table (e.g. `cron_run_history`) or by appending to an existing audit/log table; the design SHALL define the schema and retention
3. The system SHALL write a record at the end of each cron run (success or failure) so that missed runs (e.g. GitHub Action did not trigger) can be inferred from gaps in history
4. The system SHALL provide an admin API (e.g. `GET /api/admin/payments/cron-history`) that returns recent cron run records (paginated or limited to last N runs per job)
5. The admin UI SHALL provide a view (e.g. under the payment or cron section) that lists recent runs by job with start/end times and outcome counts
6. Only users with admin privileges SHALL be permitted to access the cron history API and UI

### Requirement 10: Admin Audit Logging

**User Story:** As the platform, I want all manual override actions on payment lifecycle to be recorded in an audit log so that changes are traceable and compliant.

#### Acceptance Criteria

1. The system SHALL record an audit log entry for every manual override action: payout status reset (Requirement 6), owner transfer status reset (Requirement 7), and manual deposit release (Requirement 8)
2. Each entry SHALL include: admin user id, rental id, action type, timestamp, before state (relevant status values), after state, and optional reason or comment
3. Audit log entries SHALL be stored in a persistent store (e.g. dedicated `payment_lifecycle_audit_log` table or existing admin audit table) and SHALL be readable by admins (e.g. per-rental or global list)
4. The admin lifecycle detail view MAY display recent audit entries for that rental
5. The system SHALL NOT allow deletion or alteration of audit log entries by end users

### Requirement 11: Notifications for Manual Actions

**User Story:** As a renter or owner, I want to be notified when an admin performs a manual override that affects my rental (e.g. deposit released, payout retry) so that I am informed of the outcome.

#### Acceptance Criteria

1. WHEN an admin successfully resets payout status or owner transfer status (Requirements 6, 7) THEN the system MAY notify the owner that their payout will be retried (e.g. "Your payout for rental X will be processed on the next run")
2. WHEN an admin successfully force-releases a deposit hold (Requirement 8) THEN the system SHALL notify the renter that their deposit hold has been released
3. Notifications SHALL use the existing notification infrastructure and SHALL be in-app and/or email as per existing patterns; the exact notification types and copy MAY be defined in the design phase
4. The system SHALL NOT notify the other party (e.g. renter when only transfer retry was done) unless the override directly affects them

## Non-Functional Requirements

### Performance

1. The admin lifecycle list API SHALL return paginated results within 3 seconds for typical page sizes (e.g. 20–50 records)
2. The admin lifecycle detail API SHALL return within 2 seconds
3. The payment metrics API SHALL return within 2 seconds (or within the cache TTL if cached)
4. Manual override APIs (reset status, release deposit) SHALL complete within 10 seconds
5. Stale detection SHALL complete within 60 seconds for expected volume (e.g. scanning lifecycle table with index on payoutStatus)

### Reliability

1. Stale detection SHALL NOT modify lifecycle records; it SHALL only read and alert
2. Manual override APIs SHALL validate current state before applying changes and SHALL return a clear error when state is not as expected
3. Cron run history writes SHALL be best-effort; if the write fails, the cron SHALL still complete its payment operations and SHALL log the history write failure

### Security

1. All admin payment APIs and UI SHALL require admin authorization (e.g. `requireAdmin()` or equivalent). The system SHALL reject unauthenticated or non-admin requests with HTTP 403 or 401
2. Audit log entries SHALL include the admin user id so that actions are attributable
3. No PII beyond what is already visible to admins (e.g. rental, user ids) need be added to audit logs; the design MAY restrict what is stored in reason text

### Usability

1. Admin UI error responses SHALL indicate clearly when an override is not allowed (e.g. "Payout status is already completed and cannot be reset")
2. The lifecycle list SHALL support at least filter by status and search by rental/user so that admins can quickly find stuck or failed records

## Assumptions

1. Phases 1, 2, and 3 are complete: platform-hold capture, deposit holds, payout cron, return confirmation, cancellation paths, dispute resolution, and payout freeze/unfreeze are in place.
2. The admin dashboard and admin authorization (e.g. `requireAdmin()`) exist and are used to gate new payment admin features.
3. Cron endpoints are triggered by GitHub Actions (or similar); Phase 4 does not change the scheduler. Cron run history is for visibility into what each run did, not for triggering runs.
4. Ops alerting (`sendOpsAlert`, `OPS_ALERT_EMAIL`) is configured and working; Phase 4 adds new alert types for stale processing.
5. The `rental_payment_lifecycle` schema and DAL exist and are used by the payout and deposit crons; Phase 4 adds admin read and conditional update (via manual override) only.
6. Stripe idempotency keys for transfer and refund remain as defined in prior phases; manual reset does not reuse idempotency keys (the next cron run uses the same key as before).

## Constraints

1. Stripe idempotency keys expire after 24 hours; manual reset to `'pending'` allows the cron to retry with the same key if within window, or with a new request after expiry. DB state is the source of truth for whether a transfer has already been created.
2. Admin role gating is required for all new payment admin APIs and UI; no new public or renter/owner-facing payment lifecycle APIs are required.
3. Cron execution is external (GitHub Actions); the application does not schedule crons. Cron run history is stored by the application when each cron endpoint completes.

## Edge Cases

1. **Double reset:** An admin resets payout status to `'pending'`; before the next cron run, another admin (or the same) resets again. The second reset is a no-op or idempotent (status already `'pending'`). The API SHALL reject or no-op when current status is already `'pending'` for reset-payout-status.
2. **Stale detection false positive:** A cron run is legitimately still in progress (e.g. slow Stripe call). Stale threshold (e.g. 1 hour) should be set high enough to avoid alerting on normal runs. If needed, the design MAY add a "claimed at" timestamp so that only records claimed longer than the threshold are considered stale.
3. **Manual release after expiry:** If an admin tries to force-release a deposit that Stripe has already expired (`depositHoldStatus` still `'held'` but PaymentIntent is canceled), the Stripe cancel call may fail. The API SHALL handle this (e.g. treat as already canceled and update local state to `'released'` or `'expired'`) and SHALL not leave the record in an inconsistent state.
4. **Cron run history write failure:** If persisting cron run history fails (e.g. DB timeout), the cron SHALL still complete its payment operations and SHALL log the failure; the next run is not blocked.

## Out of Scope (Future Enhancements)

1. Renter-facing payment timeline or status page showing deposit/payout state to the renter.
2. Multi-currency or non-USD payout preferences.
3. Automated dispute resolution or chargeback handling beyond what Phase 3 provides.
4. Payout scheduling preferences (e.g. immediate vs. weekly batch vs. manual request).
5. Per-listing payout policies (e.g. different preference per listing).
6. Changing how cron is triggered (GitHub Actions remains the trigger).
7. Automatic retry of failed transfers without admin intervention (manual reset only).
8. Bulk manual overrides (e.g. reset all failed transfers in one action); single-rental actions only for Phase 4.

## Success Criteria

1. Admins can open the payment lifecycle dashboard, filter by depositHoldStatus, ownerTransferStatus, and payoutStatus, and search by rental or user, and see paginated results.
2. Admins can open a detail view for a rental and see the full payment timeline, Stripe IDs, and linked dispute if any.
3. The admin dashboard shows payment metrics (pending payouts, failed transfers, frozen, held/expired deposits, etc.).
4. Stale processing detection runs (via cron or step) and identifies records in `payoutStatus: 'processing'` longer than the configured threshold.
5. When stale records are found, ops receives an alert (email and log) with rental ids and count.
6. Admins can call the payout status reset API for a rental in `'processing'` or `'failed'` and the next payout cron run picks it up; the action is audit-logged.
7. Admins can call the owner transfer status reset API for a rental with `ownerTransferStatus: 'failed'` and the next payout cron run retries the transfer; the action is audit-logged.
8. Admins can force-release a deposit hold via the admin API when `depositHoldStatus` is `'held'`; Stripe is called to cancel the PaymentIntent and lifecycle is updated; the action is audit-logged.
9. Cron run history is persisted for payment crons and admins can view recent runs (job, start, end, counts, errors) in the admin UI.
10. All manual overrides are recorded in the audit log with admin id, action, before/after state, and optional reason.
11. When an admin force-releases a deposit, the renter is notified; when an admin resets for retry, the owner may be notified per design.

---

_Last updated: March 15, 2026 | Internal use only_
