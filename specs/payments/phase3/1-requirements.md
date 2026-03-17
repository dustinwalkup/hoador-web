# Stripe Connect Payment Lifecycle (Phase 3) - Dispute Resolution & Chargebacks - Requirements Document

## Introduction

This document defines the Phase 3 requirements for Hoador's dispute resolution and chargeback handling. Phase 1 established the platform-hold payment model with a 24-hour dispute window after return confirmation; Phase 2 added automated cancellation paths and no-show handling. The payout cron already excludes rentals with open disputes via a LEFT JOIN on the disputes table, but the payment lifecycle record is not updated when a dispute is filed, and dispute resolution does not trigger Stripe financial operations (deposit capture, owner transfer unfreeze).

Phase 3 formalizes and extends the dispute flow: (1) **Dispute filing UX** — correct filing window (strict 24 hours after completion for all dispute types; filing allowed from rental start date for no-show scenarios), correct button visibility, and new reason codes (`renter_no_show`, `owner_no_show`); (2) **Payment lifecycle integration** — set `ownerTransferStatus` to `'frozen'` when a dispute is created and back to `'pending'` when resolved; (3) **Evidence and mediation** — formalize evidence collection and deadline enforcement; (4) **Financial outcomes** — deposit capture for damage, resolution outcome mapping to Stripe operations; (5) **Stripe chargebacks** — webhook handling and chargeback evidence submission.

Significant dispute infrastructure already exists: `disputes`, `dispute_evidence`, `dispute_audit_logs`, `dispute_internal_notes`, `dispute_financial_operations` tables; state machine, time window validation, evidence deadline enforcement; DAL, API routes, and UI for creating disputes, uploading evidence, and admin resolution. Phase 3 builds on this and corrects the filing window, button visibility, reason codes, and wires resolution to Stripe.

### Scope

**In scope:** Dispute filing window (strict 24h after `returnConfirmedAt` for all types; filing from `startDate` for no-show); dispute button visibility (from start date through 24h after completion); new reason codes `renter_no_show` and `owner_no_show`; payout freeze on dispute creation (`ownerTransferStatus: 'frozen'`); unfreeze on resolution; evidence collection and deadline enforcement (formalize existing); admin mediation and resolution with outcome-driven financial operations; deposit capture for damage (full or partial) via `stripe.paymentIntents.capture()`; resolution outcome mapping (favor_renter, favor_provider, partial_renter, partial_provider, dismissed) to deposit release/capture and owner transfer; Stripe chargeback webhooks (`charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`) and linking via `stripeChargebackId`; chargeback evidence submission to Stripe; dispute notifications (created, evidence requested, deadline approaching, deadline expired, resolved); data model extensions (new enum values).

**Out of scope:** Phase 4 operational tooling (admin dashboard for payment states, manual overrides, stale processing alerts); per-listing dispute policies; automated no-show detection by time; extended Stripe authorization holds for deposits beyond 7 days.

### Key Architectural Decisions

1. **Strict 24-hour filing window:** For all dispute types, filing is allowed only within 24 hours after `returnConfirmedAt`. This replaces the existing per-reason-code windows (7 days for damage, 30 days for payment issue, etc.). Filing is also allowed from `startDate` onward for no-show scenarios (even before the rental is completed or return is confirmed).
2. **Dispute button visibility:** The "File Dispute" button is shown when the user is renter or owner, no active dispute exists, and: rental status is `approved` with `now >= startDate` (no-show window), OR status is `active`, OR status is `completed` with `now <= returnConfirmedAt + 24h`. The button is hidden 24 hours or more after completion.
3. **No-show reason codes:** Add `renter_no_show` and `owner_no_show` to `disputeReasonCodeEnum`. The create-dispute form shows these options contextually (e.g., when status is `approved` and `now >= startDate`).
4. **Payout freeze on dispute:** When a dispute is created, `ownerTransferStatus` is set to `'frozen'` on `rental_payment_lifecycle`. When the dispute is resolved and financial operations complete, it is set back to `'pending'` so the payout cron can process the owner transfer.
5. **Deposit capture:** When resolution favors the provider (full or partial), the system captures the deposit auth hold via `stripe.paymentIntents.capture()` with optional `amount_to_capture` for partial capture. The deposit PaymentIntent is the one stored in `securityDepositAuthId` on the rental (placed in Phase 1).
6. **Chargeback linking:** Stripe `charge.dispute` events are linked to internal disputes via `stripeChargebackId`. If no internal dispute exists for the rental, the system may create one automatically when a chargeback is received (implementation may defer auto-creation to Phase 3 design).

### Dispute Resolution Outcome Summary

| Resolution Outcome | Deposit Hold                  | Owner Transfer                              |
| ------------------ | ----------------------------- | ------------------------------------------- |
| favor_provider     | Capture full                  | Proceeds (rental amount + captured deposit) |
| favor_renter       | Release                       | Proceeds (rental amount only)               |
| partial_provider   | Capture partial, release rest | Proceeds (rental amount + partial deposit)  |
| partial_renter     | Release partial, capture rest | Proceeds (rental amount + partial capture)  |
| dismissed          | Release                       | Proceeds (rental amount only)               |

## Requirements

### Requirement 1: Dispute Filing Window

**User Story:** As the platform, I want a single, strict filing window for all dispute types (24 hours after return confirmation) with an exception for no-show filing from the rental start date, so that deadlines are clear and no-show disputes can be filed when the rental was supposed to start.

#### Acceptance Criteria

1. WHEN a dispute is filed AND the rental has `returnConfirmedAt` set THEN the system SHALL allow filing only if the current time is within 24 hours after `returnConfirmedAt` (i.e. `now <= returnConfirmedAt + 24 hours`)
2. WHEN a dispute is filed AND the rental does NOT yet have `returnConfirmedAt` set (e.g. approved but not started, or active) THEN the system SHALL allow filing only if the current time is on or after the rental `startDate` (i.e. `now >= startDate`) — this enables no-show disputes from the day the rental was supposed to start
3. The system SHALL apply the same 24-hour rule for ALL dispute reason codes (damage, non_delivery, quality_issue, cancellation, payment_issue, renter_no_show, owner_no_show, other); there SHALL be no per-reason-code extension (e.g. no 7-day damage window or 30-day payment window)
4. The server SHALL validate the filing window in the dispute creation API and in any DAL method used for validation; the client SHALL use the same logic to show or hide the File Dispute button and to display a clear message when the window has expired
5. IF the filing window has expired THEN the system SHALL reject the dispute creation request with an HTTP 400 (or equivalent) and a message indicating the filing window has closed

### Requirement 2: Dispute Button Visibility

**User Story:** As a renter or owner, I want to see the "File Dispute" button only when I am allowed to file (from the rental start date through 24 hours after completion), so that I am not shown an option I cannot use.

#### Acceptance Criteria

1. The "File Dispute" button SHALL be visible when ALL of the following hold: (a) the user is the renter or the owner of the rental, (b) there is no active dispute for the rental, (c) the rental is in a status that allows filing
2. The rental SHALL be considered to allow filing when: (a) status is `approved` AND current time is on or after `startDate` (no-show window), OR (b) status is `active`, OR (c) status is `completed` AND current time is within 24 hours after `returnConfirmedAt` (i.e. `now <= returnConfirmedAt + 24h`)
3. The "File Dispute" button SHALL be hidden when: the user is not renter or owner, OR an active dispute exists, OR the rental status is `pending`, `cancelled`, or `denied`, OR the rental status is `completed` and more than 24 hours have passed since `returnConfirmedAt`, OR the rental status is `approved` and current time is before `startDate`
4. The client SHALL compute visibility using the same 24-hour and start-date rules as the server (Requirement 1) so that the button state matches server validation
5. WHERE the button is hidden due to the 24-hour window having passed THEN the UI MAY display a short message that the dispute filing window has closed (e.g. on the rental detail page)

### Requirement 3: Dispute Reason Codes

**User Story:** As a renter or owner, I want to select a reason for my dispute that includes explicit no-show options, so that I can accurately report renter or owner no-show.

#### Acceptance Criteria

1. The system SHALL add two new values to the dispute reason code enum: `renter_no_show` and `owner_no_show`
2. The create-dispute form SHALL present reason codes appropriate to the context: when the rental status is `approved` and `now >= startDate`, the form SHALL include `renter_no_show` and `owner_no_show` as selectable options (in addition to other applicable codes such as non_delivery, cancellation, etc.)
3. The API SHALL accept `renter_no_show` and `owner_no_show` as valid `reasonCode` values when creating a dispute, subject to the same filing window and authorization checks as other reason codes
4. The system SHALL store the selected reason code on the dispute record and SHALL use it for reporting, notifications, and resolution workflows
5. Existing reason codes (damage, non_delivery, quality_issue, cancellation, payment_issue, other) SHALL remain available where contextually appropriate, subject to the unified 24-hour filing window for completed rentals

### Requirement 4: Payout Freeze on Dispute Creation

**User Story:** As the platform, I want to freeze the owner transfer when a dispute is filed, so that funds are not paid out until the dispute is resolved and the payment lifecycle record reflects the freeze.

#### Acceptance Criteria

1. WHEN a dispute is successfully created (after all validation and insert) THEN the system SHALL set `ownerTransferStatus` to `'frozen'` on the corresponding `rental_payment_lifecycle` record for that rental
2. The update SHALL be performed in the same transaction or immediately after dispute creation so that the lifecycle record is never left with `ownerTransferStatus: 'pending'` while an open dispute exists
3. IF the rental has no `rental_payment_lifecycle` record (edge case) THEN the system SHALL create one with `ownerTransferStatus: 'frozen'` and other fields as required, or SHALL log an error and alert ops — the exact behavior MAY be defined in the design phase
4. The payout cron already excludes rentals with open disputes via a LEFT JOIN; this requirement ensures the lifecycle record itself is consistent and can be used for reporting and unfreeze on resolution
5. WHEN `ownerTransferStatus` is `'frozen'` THEN the payout cron SHALL NOT process the rental for owner transfer until the dispute is resolved and the status is set back to `'pending'` (Requirement 5)

### Requirement 5: Owner Transfer Unfreeze on Resolution

**User Story:** As the platform, I want to unfreeze the owner transfer when a dispute is resolved and financial operations have completed, so that the payout cron can process the owner payout.

#### Acceptance Criteria

1. WHEN a dispute is resolved (status set to `resolved` with a resolution outcome) AND the corresponding financial operations (deposit release or capture, as applicable) have been completed THEN the system SHALL set `ownerTransferStatus` from `'frozen'` back to `'pending'` on the `rental_payment_lifecycle` record
2. The unfreeze SHALL occur only after financial operations succeed (e.g. deposit captured or released); IF a financial operation fails THEN the system SHALL NOT set `ownerTransferStatus` to `'pending'` until the failure is resolved or ops intervenes
3. Once `ownerTransferStatus` is `'pending'`, the existing payout cron SHALL treat the rental as eligible (assuming other criteria: completed, returnConfirmedAt > 24h ago, no open disputes) and SHALL create the owner transfer in the same way as Phase 1
4. The system SHALL ensure idempotency: if unfreeze is invoked multiple times for the same resolved dispute, it SHALL not create duplicate transfers (the cron uses `ownerTransferStatus = 'pending'` and atomic claim)

### Requirement 6: Evidence Collection

**User Story:** As a renter or owner, I want to submit evidence (images, text) for my dispute within the deadline, so that the platform can make a fair resolution decision.

#### Acceptance Criteria

1. Both the renter and the owner (provider) SHALL be able to submit evidence to an open dispute via the existing evidence upload API (`POST /api/disputes/[id]/evidence`) and UI
2. Evidence SHALL support at least image and text types (existing `evidenceTypeEnum`: `image`, `text`); each submission SHALL be stored in `dispute_evidence` with `disputeId`, `uploadedBy`, `uploadedByRole`, `evidenceType`, `content`, `uploadedAt`
3. WHEN the dispute status is `evidence_requested` or `under_review` THEN the system SHALL allow evidence submission until the relevant deadline (`evidenceDeadline` or `additionalEvidenceDeadline`) has passed
4. An admin SHALL be able to request additional evidence by transitioning the dispute to `evidence_requested` and setting or extending `additionalEvidenceDeadline`; the system SHALL notify the relevant party of the evidence request
5. The system SHALL enforce that only the renter or the owner (and admins) can submit evidence for their role; the DAL and API SHALL validate `uploadedByRole` and authorization
6. Evidence submissions SHALL be recorded in the dispute audit log for traceability

### Requirement 7: Evidence Deadline Enforcement

**User Story:** As the platform, I want to enforce evidence deadlines and notify parties when deadlines approach or expire, so that disputes move to resolution in a predictable way.

#### Acceptance Criteria

1. Each dispute SHALL have an `evidenceDeadline` (and optionally `additionalEvidenceDeadline`) set at creation or when additional evidence is requested
2. WHEN the current time passes `evidenceDeadline` or `additionalEvidenceDeadline` without the dispute being resolved THEN the system SHALL auto-transition the dispute as defined by the state machine (e.g. from `evidence_requested` to `under_review`) — the exact transition MAY be defined in the design phase
3. The system SHALL send a notification to the disputing parties when the evidence deadline is approaching (e.g. 24 hours before) using the existing notification type `dispute_evidence_deadline_approaching`
4. The system SHALL send a notification when the evidence deadline has expired using the existing notification type `dispute_evidence_deadline_expired`
5. Deadline enforcement MAY be implemented via a cron job or on-demand check when the dispute is viewed; the system SHALL ensure that once a deadline has passed, the dispute state reflects the enforced transition
6. Existing infrastructure (e.g. `DeadlineEnforcement` service, `checkEvidenceDeadline`) SHALL be used or extended to meet this requirement

### Requirement 8: Admin Mediation and Resolution

**User Story:** As an admin, I want to review dispute evidence, select a resolution outcome, and have the system execute the corresponding financial operations, so that disputes are resolved fairly and payouts align with the outcome.

#### Acceptance Criteria

1. An admin SHALL be able to transition the dispute through the allowed states (open → evidence_requested → under_review → resolved → closed) using the existing state machine and API (`POST /api/disputes/[id]/state`, `POST /api/disputes/[id]/resolve`)
2. WHEN resolving a dispute THEN the admin SHALL select a resolution outcome: `favor_renter`, `favor_provider`, `partial_renter`, `partial_provider`, or `dismissed`, and SHALL provide a resolution reason (e.g. `resolutionReason` text)
3. WHEN the admin submits resolution THEN the system SHALL execute the financial operations corresponding to the outcome (Requirement 9 and 10): deposit release or capture (full or partial), and SHALL then set `ownerTransferStatus` to `'pending'` (Requirement 5)
4. The system SHALL record the resolution on the dispute (`resolvedAt`, `resolvedBy`, `resolutionOutcome`, `resolutionReason`) and SHALL create a record in `dispute_financial_operations` for each Stripe operation (deposit capture, etc.)
5. Only users with admin privileges SHALL be permitted to resolve disputes or transition to `evidence_requested`, `under_review`, or `closed`
6. The system SHALL send a notification to both parties when the dispute is resolved (`dispute_resolved`)

### Requirement 9: Deposit Capture for Damage

**User Story:** As the platform, I want to capture the security deposit (full or partial) when a dispute is resolved in favor of the provider, so that the owner can be compensated for damage.

#### Acceptance Criteria

1. WHEN a dispute is resolved with outcome `favor_provider` AND the rental has a deposit auth hold (`depositHoldStatus` is `'held'`) THEN the system SHALL capture the full deposit by calling `stripe.paymentIntents.capture()` on the PaymentIntent identified by `securityDepositAuthId` on the rental
2. WHEN a dispute is resolved with outcome `partial_provider` AND the rental has a deposit auth hold THEN the system SHALL capture a partial amount by calling `stripe.paymentIntents.capture()` with `amount_to_capture` set to the agreed partial amount in cents
3. The system SHALL use a deterministic idempotency key of format `deposit-capture-{disputeId}` when calling capture to prevent duplicate captures
4. WHEN the capture succeeds THEN the system SHALL set `depositHoldStatus` to `'captured'` on the `rental_payment_lifecycle` record and SHALL set `depositReleasedAt` or a dedicated `depositCapturedAt` timestamp as defined in the design
5. The system SHALL create a record in `dispute_financial_operations` with `operationType: 'capture_deposit'`, amount, `stripePaymentIntentId` (or equivalent), `status: 'succeeded'`, and link to the dispute
6. IF the deposit hold has already expired (`depositHoldStatus: 'expired'`) or was released THEN the system SHALL NOT attempt capture; the resolution SHALL still be recorded and the owner transfer unfrozen, but the financial operation for deposit capture SHALL be recorded as failed or skipped with an appropriate reason (e.g. "deposit hold expired")
7. IF the capture fails (e.g. Stripe returns an error) THEN the system SHALL set the financial operation status to `'failed'`, log the error, alert ops, and SHALL NOT set `ownerTransferStatus` to `'pending'` until ops has resolved the failure or the design defines a retry path

### Requirement 10: Resolution Financial Outcomes

**User Story:** As the platform, I want each resolution outcome to map to a defined set of financial actions (deposit release or capture, owner transfer amount), so that payouts are consistent and auditable.

#### Acceptance Criteria

1. **favor_provider:** The system SHALL capture the full deposit (Requirement 9). The owner transfer SHALL include the rental amount (minus platform fee) plus the captured deposit amount when the payout cron runs. The system SHALL unfreeze `ownerTransferStatus` to `'pending'` after capture succeeds.
2. **favor_renter:** The system SHALL release the deposit hold if `depositHoldStatus` is `'held'` (via `stripe.paymentIntents.cancel()`), set `depositHoldStatus` to `'released'`, and set `depositReleasedAt`. The owner transfer SHALL be for the rental amount only (minus platform fee). The system SHALL unfreeze `ownerTransferStatus` to `'pending'` after release succeeds.
3. **partial_provider:** The system SHALL capture the partial deposit amount as specified in the resolution and release the remainder. The owner transfer SHALL include the rental amount plus the captured partial deposit. The system SHALL unfreeze after the partial capture and release complete.
4. **partial_renter:** The system SHALL release the portion of the deposit that is not being captured and capture the agreed portion (if any). The owner transfer SHALL reflect the rental amount plus any captured portion. The system SHALL unfreeze after operations complete.
5. **dismissed:** The system SHALL treat this the same as `favor_renter`: release deposit, owner transfer for rental amount only, unfreeze to `'pending'`
6. All financial operations SHALL be recorded in `dispute_financial_operations` with the appropriate `operationType` (`capture_deposit`, etc.), amount, Stripe IDs, and status

### Requirement 11: Stripe Chargeback Handling

**User Story:** As the platform, I want to receive Stripe chargeback (dispute) events and link them to internal disputes, so that we can track bank-level disputes and submit evidence.

#### Acceptance Criteria

1. The system SHALL handle Stripe webhook events: `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
2. WHEN a `charge.dispute.created` (or equivalent) webhook is received THEN the system SHALL identify the charge and the associated rental (via payment metadata or charge ID lookup); IF an internal dispute already exists for that rental THEN the system SHALL set `stripeChargebackId` on that dispute to the Stripe dispute ID
3. IF no internal dispute exists for the rental THEN the system MAY create an internal dispute record linked to the chargeback and set `stripeChargebackId`; the design MAY define this auto-creation or require ops to create the dispute
4. WHEN `charge.dispute.updated` or `charge.dispute.closed` is received THEN the system SHALL update the internal dispute or financial state as needed (e.g. record that the chargeback was won or lost)
5. The webhook handler SHALL be idempotent and SHALL return HTTP 200 after processing; failures SHALL be logged and SHALL not leave the system in an inconsistent state
6. The Stripe webhook endpoint configuration SHALL include the charge dispute event types in addition to existing Phase 1 and Phase 2 events

### Requirement 12: Chargeback Evidence Submission

**User Story:** As the platform, I want to submit evidence to Stripe for bank-level chargebacks so that we can contest invalid chargebacks.

#### Acceptance Criteria

1. WHEN an internal dispute has a `stripeChargebackId` AND the admin or system prepares evidence for the chargeback THEN the system SHALL call `stripe.disputes.update()` with the Stripe dispute ID and an evidence object
2. The evidence object SHALL include relevant fields supported by Stripe (e.g. product_description, customer_communication, receipt, service_documentation) — the exact mapping from internal evidence (rental agreement, photos, messages) to Stripe's evidence format MAY be defined in the design phase
3. The system SHALL use a deterministic idempotency key of format `chargeback-evidence-{disputeId}` (or per-submission variant) when updating the dispute to avoid duplicate submissions
4. Submission SHALL occur before Stripe's evidence deadline; the system SHALL track or display the deadline so that ops can submit in time
5. Successful submission and any failures SHALL be recorded (e.g. in dispute audit log or financial operations) for traceability

### Requirement 13: Dispute Notifications

**User Story:** As a renter or owner, I want to be notified when a dispute is created, when evidence is requested, when deadlines approach or expire, and when the dispute is resolved, so that I can take action and stay informed.

#### Acceptance Criteria

1. WHEN a dispute is created THEN the system SHALL send a notification to the other party (the party who did not file) using the existing type `dispute_created`
2. WHEN an admin requests evidence (e.g. transitions to `evidence_requested`) THEN the system SHALL send a notification to the party from whom evidence is requested using the existing type `dispute_evidence_requested`
3. WHEN the evidence deadline is approaching (e.g. 24 hours before) THEN the system SHALL send `dispute_evidence_deadline_approaching` to the relevant party or parties
4. WHEN the evidence deadline has expired THEN the system SHALL send `dispute_evidence_deadline_expired` as defined in Requirement 7
5. WHEN the dispute is resolved THEN the system SHALL send `dispute_resolved` to both the renter and the owner with the resolution outcome and reason (or a summary)
6. The system MAY send operations alerts for dispute creation, resolution, or evidence deadline expiry so that ops can monitor high-risk cases; the exact OPS_ALERT usage MAY be defined in the design phase
7. All notifications SHALL use the existing notification infrastructure and SHALL not be sent to users who are not a party to the dispute

### Requirement 14: Data Model Extensions

**User Story:** As the platform, I want the schema and enums to support the new reason codes and any fields needed for resolution and chargeback linking, so that data is consistent and queryable.

#### Acceptance Criteria

1. The system SHALL add `renter_no_show` and `owner_no_show` to the `disputeReasonCodeEnum` in `src/db/schemas/_enums.ts` and SHALL apply a database migration to add these values to the enum type
2. The `disputes` table already has `stripeChargebackId`; the system SHALL ensure it is populated when a chargeback is linked (Requirement 11)
3. The system SHALL ensure that `dispute_financial_operations` can store references to Stripe capture and other operations (existing columns such as `stripePaymentIntentId`, `stripeOperationId` SHALL be used or extended as needed)
4. Any new columns or tables required for Phase 3 (e.g. `depositCapturedAt` on lifecycle, if not using `depositReleasedAt` for capture) SHALL be added via a migration and documented in the design document
5. All new enum values and columns SHALL be used consistently in the DAL, API, and UI

## Non-Functional Requirements

### Performance

1. Dispute creation (including payout freeze update) SHALL complete within 5 seconds
2. Resolution submission (including financial operations and unfreeze) SHALL complete within 15 seconds for a single dispute
3. Chargeback webhook processing SHALL return HTTP 200 within 5 seconds
4. The client SHALL compute dispute button visibility and filing window without noticeable delay (use existing rental detail data)

### Reliability

1. All Stripe API calls for deposit capture and chargeback evidence SHALL use the specified idempotency keys (`deposit-capture-{disputeId}`, `chargeback-evidence-{disputeId}`)
2. The payout freeze update on dispute creation SHALL be part of a transaction or immediate follow-up so that dispute and lifecycle are consistent
3. IF deposit capture fails THEN the system SHALL NOT set `ownerTransferStatus` to `'pending'` and SHALL record the failure and alert ops

### Security

1. Only the renter or owner of a rental SHALL be permitted to create a dispute for that rental; the API SHALL enforce this authorization
2. Only admins SHALL be permitted to resolve disputes, request evidence, and transition to `under_review` or `closed`
3. Stripe webhook signature verification SHALL be used for chargeback webhooks (existing pattern)
4. All dispute creation, resolution, and financial operations SHALL be recorded in the audit log where applicable

### Usability

1. WHEN the dispute filing window has expired THEN the system SHALL return a clear error message (e.g. "The dispute filing window closed 24 hours after the return was confirmed")
2. WHEN the user is not allowed to file (e.g. not renter/owner, or active dispute exists) THEN the system SHALL return a clear error message
3. The create-dispute form SHALL show reason codes in a logical order and SHALL indicate which codes apply to no-show (e.g. when `now >= startDate` and status is `approved`)

## Assumptions

1. Phase 1 and Phase 2 payment and cancellation flows are in place; `rental_payment_lifecycle` exists for approved rentals and `returnConfirmedAt` is set when the owner confirms return.
2. The existing dispute tables, state machine, evidence upload, and admin resolution UI are in place and will be extended rather than replaced.
3. Deposit auth holds may have expired for rentals longer than 7 days; resolution when the hold is expired will not capture the deposit but will still unfreeze the owner transfer for the rental amount.
4. Stripe's chargeback evidence deadline is outside platform control; ops will need to submit evidence before that deadline.
5. The 24-hour filing window applies to all environments; no per-environment override is required for Phase 3.

## Constraints

1. Stripe authorization holds expire after 7 days; deposit capture is only possible while the hold is still valid. For rentals longer than 7 days, deposit capture may not be available and resolution will proceed with release (or no-op) and owner transfer for rental amount only.
2. Idempotency keys for Stripe expire after 24 hours; DB state (e.g. `depositHoldStatus: 'captured'`) is the source of truth for duplicate prevention after that.
3. The dispute button visibility and filing window logic must be consistent between client and server to avoid user confusion.

## Edge Cases

1. **Deposit hold expired before resolution:** Resolution favors provider but `depositHoldStatus` is `'expired'`. Do not attempt capture; record financial operation as failed/skipped; unfreeze owner transfer so payout cron can pay rental amount only; alert ops.
2. **Dispute filed after deposit already released:** If the payout cron already released the deposit before the dispute was filed (e.g. race), the lifecycle may show `depositHoldStatus: 'released'`. On resolution in favor of provider, no capture is possible; record and unfreeze for rental amount only.
3. **Chargeback on already-refunded charge:** If the rental was refunded (e.g. cancellation) and a chargeback is later received, link to internal dispute if one exists or create one; evidence submission may still be needed to contest the chargeback.
4. **Dispute on cancelled rental:** If the rental is cancelled, the filing window (from startDate or 24h after return) may still allow filing. The system SHALL allow dispute creation for cancelled rentals when within the window; resolution may involve no deposit capture (e.g. deposit already released on cancellation).
5. **Both parties file simultaneously:** Only one active dispute per rental is allowed; the second creation request SHALL fail with a clear message that a dispute already exists.
6. **No-show dispute filed but rental was actually active:** Resolution may be in favor of the other party (e.g. favor_renter if owner claimed renter no-show but renter has evidence of pickup). Normal resolution flow applies.
7. **Rental has no lifecycle record:** Edge case where the rental was approved before lifecycle was created. On dispute creation, create the lifecycle record with `ownerTransferStatus: 'frozen'` or log and alert ops.

## Out of Scope (Future Enhancements)

1. **Phase 4 — Operational tooling:** Admin dashboard for payment states, stale processing alerts, manual override tools, payout scheduling preferences.
2. **Per-listing dispute policies:** All rentals use the same 24-hour filing window and resolution outcomes in Phase 3.
3. **Automated no-show detection:** No automatic no-show based on time; disputes are filed by users.
4. **Extended authorization holds:** Deposits beyond 7-day hold expiry are out of scope for Phase 3.
5. **Richer chargeback evidence automation:** Automatic mapping of all internal evidence to Stripe evidence fields may be deferred; minimal evidence submission is in scope.

## Success Criteria

1. A renter or owner can file a dispute from the rental start date (for no-show) through 24 hours after return confirmation; the filing window is enforced on both client and server.
2. The "File Dispute" button is visible only when the user is renter or owner, there is no active dispute, and the rental is in an allowed status within the filing window; the button is hidden 24+ hours after completion.
3. Dispute reason codes include `renter_no_show` and `owner_no_show` and are shown contextually in the create-dispute form.
4. When a dispute is created, `ownerTransferStatus` is set to `'frozen'` on the payment lifecycle record; when the dispute is resolved and financial operations complete, it is set back to `'pending'`.
5. Evidence can be submitted by both parties within deadlines; deadlines are enforced and notifications are sent for approaching and expired deadlines.
6. Admin can resolve disputes with outcomes favor_renter, favor_provider, partial_renter, partial_provider, dismissed; the system executes the corresponding deposit release or capture and unfreezes the owner transfer.
7. Deposit capture for damage uses `stripe.paymentIntents.capture()` with idempotency key `deposit-capture-{disputeId}`; capture is recorded in `dispute_financial_operations` and `depositHoldStatus` is set to `'captured'`.
8. Stripe chargeback webhooks are handled and linked to internal disputes via `stripeChargebackId`; chargeback evidence can be submitted to Stripe.
9. Dispute notifications (created, evidence requested, deadline approaching, deadline expired, resolved) are sent to the correct parties.
10. Schema and enums include the new reason codes and support resolution and chargeback linking.

---

_Last updated: March 15, 2026 | Internal use only_
