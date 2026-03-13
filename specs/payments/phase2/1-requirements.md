# Stripe Connect Payment Lifecycle (Phase 2) - Cancellation Policies - Requirements Document

## Introduction

This document defines the Phase 2 requirements for Hoador's payment cancellation policies. Phase 1 established the platform-hold payment model: rental payments are captured into the platform account at approval, security deposit auth holds are placed 48 hours before pickup, and owner payouts occur only after the 24-hour dispute window following return confirmation. Cancellation is currently limited to the renter cancelling **pending** requests only (no payment involved); post-approval cancellations and no-shows are handled manually by ops via the Stripe Dashboard.

Phase 2 introduces automated cancellation paths for approved rentals: tiered refund rules when the renter cancels before pickup, full refund when the owner cancels, deposit hold release on cancellation, and no-show handling (renter no-show: 50% refund to renter with owner compensated; owner no-show: full refund including service fee with ops alert). Active rentals cannot be cancelled; early termination has no effect on payment.

### Scope

**In scope:** Renter cancellation before approval (formalize existing behavior), renter cancellation after approval and before pickup (tiered refund: 100% rental price refund if ≥24h before pickup, 50% if &lt;24h; service fee never refunded), owner cancellation after approval (full refund including service fee; platform absorbs Stripe fee), deposit hold release or cancellation on cancellation, refund processing via Stripe with idempotency, cancellation and no-show data model extensions, notifications (renter, owner, OPS_ALERT where specified), and webhook handling for refunds. No-show reporting is manual (either party reports via support; ops handles); financial outcomes (renter no-show: 50% refund of rental price, owner paid remainder minus platform fee; owner no-show: full refund including service fee, OPS_ALERT) are implemented when ops applies the no-show outcome.

**Out of scope:** Cancellation or refund for **active** rentals (cancellation not allowed; early termination has no payment effect), automated no-show detection by time window, dispute resolution workflows (Phase 3), chargeback evidence, per-listing cancellation policies, and operational tooling (Phase 4).

### Key Architectural Decisions

1. **Renter cancellation tiers (post-approval, pre-pickup):** Full refund of **rental price** (not service fee) if cancelled ≥24 hours before pickup; 50% refund of rental price if cancelled &lt;24 hours before pickup. The service fee is never refunded when the renter cancels.
2. **Owner cancellation:** Full refund of the entire charge (rental price + service fee) to the renter. The platform absorbs the Stripe processing fee; the owner does not.
3. **Active rental:** Cancellation is not allowed for rentals in `active` status. Early termination has no effect on payment (no partial refund, no proration).
4. **No-show:** Renter no-show results in 50% refund of rental price to renter (service fee not refunded); owner receives remaining compensation minus platform fee. Owner no-show results in full refund including service fee to renter; OPS_ALERT is sent. No-show is reported by either party via support; ops handles and triggers the financial flow (no automated time-based no-show).
5. **Stripe fee on refunds:** For both renter-initiated and owner-initiated cancellation refunds, Stripe retains the original processing fee (2.9% + $0.30). The platform absorbs this cost.
6. **Deposit on cancellation:** When a rental is cancelled after approval, any deposit hold is released (if `held`) or scheduling is cancelled (if `scheduled`); no deposit is captured.

### Fee and Refund Summary

| Scenario                             | Rental price refund | Service fee refund | Stripe fee absorbed by |
| ------------------------------------ | ------------------- | ------------------ | ---------------------- |
| Renter cancels ≥24h before pickup    | 100%                | No                 | Platform               |
| Renter cancels &lt;24h before pickup | 50%                 | No                 | Platform               |
| Owner cancels                        | 100%                | Yes (full refund)  | Platform               |
| Renter no-show                       | 50%                 | No                 | N/A (partial refund)   |
| Owner no-show                        | 100%                | Yes                | Platform (full refund) |

## Requirements

### Requirement 1: Renter Cancellation Before Approval

**User Story:** As a renter, I want to cancel my rental request before the owner approves it, so that I am not charged and the request is removed without any payment operations.

#### Acceptance Criteria

1. WHEN the renter requests cancellation AND the rental request status is `'pending'` THEN the system SHALL update the rental request status to `'cancelled'` and set `deniedAt` and `denialReason` (e.g. "Cancelled by renter") in the database only
2. The system SHALL NOT create or modify any Stripe payment, refund, or deposit hold for this cancellation path
3. Only the renter (the user who created the rental request) SHALL be permitted to cancel a pending request
4. WHEN the rental request is cancelled THEN the system SHALL send a notification to the owner (e.g. existing `rental_cancelled` type)
5. IF the rental request status is NOT `'pending'` (e.g. already approved, denied, or cancelled) THEN the system SHALL reject the cancellation request with an appropriate error

### Requirement 2: Renter Cancellation After Approval (Pre-Pickup)

**User Story:** As a renter, I want to cancel an approved rental before pickup and receive a refund according to the cancellation policy, so that I am treated fairly based on how much notice I give.

#### Acceptance Criteria

1. WHEN the renter requests cancellation AND the rental request status is `'approved'` AND the rental has not started (current time is before `startDate`) THEN the system SHALL allow cancellation and apply the tiered refund policy
2. The refund amount SHALL be calculated on the **rental price only** (excluding the service fee). The service fee SHALL NOT be refunded in any case for renter-initiated cancellation
3. IF the cancellation occurs 24 hours or more before the rental `startDate` THEN the system SHALL refund 100% of the rental price (full refund of rental portion only)
4. IF the cancellation occurs less than 24 hours before the rental `startDate` THEN the system SHALL refund 50% of the rental price
5. WHEN processing the refund THEN the system SHALL call `stripe.refunds.create()` on the charge associated with the rental PaymentIntent, with the calculated refund amount in cents
6. The system SHALL use a deterministic idempotency key of format `refund-rental-{rentalId}` when creating the refund
7. WHEN the refund is initiated THEN the system SHALL release the deposit hold if `depositHoldStatus` is `'held'` (via `stripe.paymentIntents.cancel()`), or SHALL ensure no deposit hold is placed if `depositHoldStatus` is `'scheduled'` (e.g. set status so the deposit scheduling cron skips this rental)
8. WHEN the rental is cancelled THEN the system SHALL set the rental request status to `'cancelled'` and record cancellation metadata (e.g. `cancelledAt`, `cancelledBy`, `cancellationReason`) as defined in Requirement 8
9. The system SHALL update the payment record with `status: 'refunded'`, `refundedAt`, `refundAmount`, and `refundReason` when the refund is processed
10. The platform SHALL absorb the Stripe processing fee (2.9% + $0.30) retained on the refunded amount — no portion of this fee is charged to the renter or owner
11. Only the renter SHALL be permitted to cancel an approved rental (pre-pickup) via this path
12. The system SHALL notify the owner that the rental was cancelled and notify the renter of the refund amount (e.g. `rental_cancelled`, `payment_refunded`)

### Requirement 3: Owner Cancellation After Approval

**User Story:** As a renter, I want to receive a full refund when the owner cancels after approving my rental, so that I am made whole through no fault of my own.

#### Acceptance Criteria

1. WHEN the owner requests cancellation of an approved rental (before or after pickup window, but subject to active-rental policy in Requirement 4) THEN the system SHALL process a full refund of the rental charge (rental price + service fee) to the renter
2. The system SHALL create a full refund via `stripe.refunds.create()` for the entire captured amount (rental price + service fee)
3. The platform SHALL absorb the Stripe processing fee on the refund — the owner does not absorb this fee
4. WHEN the owner cancels THEN the system SHALL release the deposit hold if `depositHoldStatus` is `'held'`, or ensure the deposit is not placed if `depositHoldStatus` is `'scheduled'`
5. The system SHALL set the rental request status to `'cancelled'` and record cancellation metadata (e.g. `cancelledAt`, `cancelledBy`, `cancellationReason`)
6. The system SHALL update the payment record with `status: 'refunded'`, `refundedAt`, `refundAmount`, and `refundReason`
7. The system SHALL notify the renter that the rental was cancelled and that a full refund has been issued
8. The system SHALL send an operations alert via the existing OPS_ALERT channel (e.g. `sendOpsAlert()` or equivalent) so that admin is aware of owner-initiated cancellations
9. Only the owner (listing owner for the rental) SHALL be permitted to initiate owner cancellation for that rental
10. The system SHALL use a deterministic idempotency key of format `refund-rental-{rentalId}` when creating the refund

### Requirement 4: Active Rental Cancellation Policy

**User Story:** As the platform, I want to disallow cancellation of active rentals and not change payment for early termination, so that payment terms are clear and disputes are minimized.

#### Acceptance Criteria

1. WHEN the rental request status is `'active'` THEN the system SHALL NOT allow cancellation via the renter or owner cancellation flows — cancellation requests for active rentals SHALL be rejected with an appropriate error
2. Early termination of a rental (e.g. tool returned before `endDate`) SHALL have no effect on payment: no partial refund, no proration, and no additional charge
3. The system SHALL NOT create refunds or modify existing charges when a rental is ended early (e.g. early return); the existing payment and payout flow (return confirmation, 24-hour window, then payout cron) applies unchanged

### Requirement 5: Deposit Hold Handling on Cancellation

**User Story:** As the platform, I want to release or cancel deposit holds when a rental is cancelled after approval, so that the renter's funds are not held unnecessarily and no deposit is captured.

#### Acceptance Criteria

1. WHEN a rental is cancelled after approval AND `depositHoldStatus` is `'held'` THEN the system SHALL release the deposit hold by calling `stripe.paymentIntents.cancel()` on the deposit PaymentIntent
2. WHEN the deposit hold is successfully released on cancellation THEN the system SHALL set `depositHoldStatus` to `'released'` and set `depositReleasedAt` on the payment lifecycle record
3. WHEN a rental is cancelled after approval AND `depositHoldStatus` is `'scheduled'` THEN the system SHALL update the payment lifecycle so that the deposit scheduling cron will not place a hold for this rental (e.g. set `depositHoldStatus` to a terminal state such as `'released'` or a cancellation-specific value so the cron skips it)
4. IF `depositHoldStatus` is `'failed'`, `'expired'`, `'not_applicable'`, or already `'released'` THEN the system SHALL skip deposit release and proceed with the rest of the cancellation flow (refund, status update)
5. WHEN deposit hold release fails during cancellation THEN the system SHALL set `depositHoldStatus` to `'release_failed'`, log the error, and alert the operations team; the refund and rental status update SHALL still proceed

### Requirement 6: Refund Processing

**User Story:** As the platform, I want to process refunds through Stripe with idempotency and correct fee accounting, so that refunds are applied once and financial records are accurate.

#### Acceptance Criteria

1. All refunds of the rental charge SHALL be created via `stripe.refunds.create()` with the appropriate charge ID (from the rental PaymentIntent's charge)
2. The system SHALL use the deterministic idempotency key `refund-rental-{rentalId}` for refund creation to prevent duplicate refunds
3. BEFORE creating a refund THEN the system SHALL check that the payment is not already refunded (e.g. payment status is not already `'refunded'`) — IF already refunded THEN the system SHALL skip the Stripe refund call and return success (idempotent)
4. WHEN a refund is created THEN the system SHALL update the payment record with `refundedAt` (timestamp), `refundAmount` (amount refunded in dollars or cents as per schema), and `refundReason` (e.g. "renter_cancellation_24h", "renter_cancellation_under_24h", "owner_cancellation", "renter_no_show", "owner_no_show")
5. WHEN the payment record is updated for a refund THEN the system SHALL set the payment `status` to `'refunded'`
6. The system SHALL calculate partial refund amounts (e.g. 50% of rental price) in cents using consistent rounding (e.g. `Math.round`) so that Stripe receives an integer amount in cents
7. Stripe retains the original processing fee on refunded amounts; the platform absorbs this cost for cancellation refunds (no pass-through to renter or owner for Phase 2 cancellation paths)

### Requirement 7: No-Show Handling

**User Story:** As the platform, I want to support no-show outcomes (renter no-show: 50% refund to renter, owner compensated; owner no-show: full refund to renter and ops alert) when ops applies them, so that financial outcomes are consistent and auditable.

#### Acceptance Criteria

1. **Renter no-show:** WHEN ops records a renter no-show outcome THEN the system SHALL process a refund of 50% of the **rental price only** (not the service fee) to the renter. The owner SHALL receive the remaining compensation (the portion not refunded) minus the platform fee (20% of rental price). The system SHALL NOT refund the service fee to the renter.
2. **Owner no-show:** WHEN ops records an owner no-show outcome THEN the system SHALL process a full refund of the rental charge (rental price + service fee) to the renter. The system SHALL send an OPS_ALERT so that admin is notified.
3. No-show reporting is manual: either party may report via support or dispute; the system SHALL provide an API or admin path by which ops can trigger the no-show financial flow (refund + optional owner transfer for renter no-show). There is no automated time-based no-show detection in Phase 2.
4. WHEN processing renter no-show THEN the system SHALL release any deposit hold if present, and SHALL create an owner transfer for the non-refunded portion (minus platform fee) so the owner is compensated
5. WHEN processing owner no-show THEN the system SHALL release any deposit hold if present; no owner transfer SHALL be created
6. Refunds for no-show SHALL use the same idempotency key format and payment record update rules as other refunds (Requirement 6), with `refundReason` indicating renter_no_show or owner_no_show

### Requirement 8: Cancellation Data Model

**User Story:** As the platform, I want to record who cancelled, when, and why, so that cancellations and refunds are auditable and the correct financial flows can be applied.

#### Acceptance Criteria

1. The system SHALL record cancellation on the rental request and/or rental: at least `cancelledAt` (timestamp), `cancelledBy` (user id of renter or owner), and `cancellationReason` or equivalent (e.g. enum or string: `renter_cancellation`, `owner_cancellation`, `renter_no_show`, `owner_no_show`, or free text for ops). Exact column names and table (rental_requests vs rentals) may be defined in the design phase.
2. WHERE a refund is processed THEN the payment record SHALL store `refundedAt`, `refundAmount`, and `refundReason` (existing columns in Phase 1)
3. The system SHALL ensure that cancelled rentals are excluded from payout processing: rentals with status `'cancelled'` SHALL NOT be eligible for the payout cron (Phase 1 already excludes non-completed rentals; cancelled status SHALL not be treated as completed)
4. Any new enum values for cancellation reason or refund reason SHALL be added to the schema (e.g. in `src/db/schemas/_enums.ts`) and used consistently in APIs and cron logic

### Requirement 9: Notifications

**User Story:** As a renter or owner, I want to be notified when a rental is cancelled and when a refund is issued, so that I am informed of the outcome.

#### Acceptance Criteria

1. WHEN the renter cancels (before or after approval) THEN the system SHALL notify the owner (e.g. existing `rental_cancelled` notification type)
2. WHEN the renter cancels after approval and a refund is processed THEN the system SHALL notify the renter of the refund (e.g. `payment_refunded` or equivalent with refund amount)
3. WHEN the owner cancels THEN the system SHALL notify the renter that the rental was cancelled and that a full refund has been or will be issued
4. WHEN the owner cancels THEN the system SHALL send an OPS_ALERT (existing ops alerting channel) so that admin is notified
5. No-show outcomes (when applied by ops) MAY trigger in-app or email notifications to renter/owner as defined by product; the system SHALL at minimum support OPS_ALERT for owner no-show
6. Notifications SHALL use existing notification infrastructure and types where possible (`rental_cancelled`, `payment_refunded`)

### Requirement 10: Webhook Handling for Refunds

**User Story:** As the platform, I want to keep payment status in sync with Stripe when refunds complete or fail, so that the database reflects Stripe's state.

#### Acceptance Criteria

1. WHEN a `charge.refunded` (or equivalent refund-related) webhook is received from Stripe THEN the system SHALL look up the payment record by the charge ID or payment intent ID and update `status` to `'refunded'`, `refundedAt`, and `refundAmount` if not already set
2. The webhook handler SHALL be idempotent: IF the payment is already marked as refunded THEN the handler SHALL return HTTP 200 without making duplicate changes
3. The system SHALL add the refund-related webhook event type(s) to the existing webhook handler in `src/app/api/stripe/webhooks/route.ts`
4. WHEN refund webhook processing fails (e.g. payment not found) THEN the system SHALL log the error and return an appropriate HTTP status so Stripe may retry; the system SHALL NOT leave unprocessed refund events unacknowledged in a way that breaks Stripe retries

## Non-Functional Requirements

### Performance

1. Cancellation (including refund and deposit release) SHALL complete within 15 seconds for a single rental
2. Refund webhook processing SHALL return HTTP 200 within 5 seconds

### Reliability

1. All refund creation calls SHALL use the deterministic idempotency key `refund-rental-{rentalId}`
2. DB status checks (e.g. payment not already refunded) SHALL be performed before creating a refund to avoid duplicate refunds if idempotency key has expired
3. WHERE a refund creation fails THEN the system SHALL set or retain appropriate status and SHALL NOT leave the rental in an inconsistent state (e.g. status cancelled but refund not requested)

### Security

1. Cancellation endpoints SHALL enforce authorization: only the renter may cancel their request (pending or approved pre-pickup); only the owner may cancel as owner for their listing
2. Stripe webhook signature verification SHALL be used for refund webhooks (existing pattern)
3. All cancellation and refund actions SHALL be recorded in the audit log where applicable

### Usability

1. Error responses for cancellation SHALL indicate clearly when cancellation is not allowed (e.g. active rental, or not the authorized user)
2. The renter SHALL receive a clear notification of the refund amount when a partial or full refund is processed

## Assumptions

1. Phase 1 payment lifecycle (platform-hold capture, deposit holds, payout cron, return confirmation) is in place and unchanged except where Phase 2 explicitly extends it.
2. The existing `rentalStatusEnum` includes `'cancelled'` and is used for both pre- and post-approval cancellations.
3. Ops has a path (API or admin UI) to trigger no-show financial flows; the exact UX is implementation-defined.
4. The legal document `CANCELLATION_REFUND` (referenced at checkout) will be updated to reflect the Phase 2 policy (24h full refund of rental price, &lt;24h 50% of rental price, service fee not refunded for renter cancellation; full refund for owner cancellation and owner no-show).
5. Stripe allows partial refunds of a charge; the system will use `stripe.refunds.create({ charge, amount })` for partial refunds.

## Constraints

1. Stripe does not refund the processing fee when a charge is refunded; the platform absorbs this cost for Phase 2 cancellation refunds.
2. Refund idempotency keys expire after 24 hours; DB checks (payment status, cancellation status) are the primary guard against duplicate refunds after that.
3. No-show is not time-based in Phase 2; ops manually applies the outcome.

## Edge Cases

1. **Renter cancels twice:** Second request is rejected or idempotent (status already cancelled).
2. **Refund fails after status set to cancelled:** Rental remains cancelled; payment may still show succeeded. Retry or ops intervention to complete refund; design may allow retry of refund step.
3. **Deposit hold already expired when cancelling:** Skip release; proceed with refund and status update.
4. **Deposit hold release fails during cancellation:** Set `depositHoldStatus` to `'release_failed'`, alert ops; still complete refund and cancellation status.
5. **Owner cancels after return confirmed:** Phase 2 may define whether owner can cancel after return; if not allowed, reject with clear error. If allowed, full refund and no owner transfer (payout cron would not have run yet or would be skipped).
6. **No-show applied to already cancelled rental:** Ops path should prevent or reject; system should not double-refund.
7. **Partial refund amount rounds to zero:** Policy should ensure 50% of rental price is at least 1 cent where applicable; otherwise handle edge case in design.

## Out of Scope (Future Enhancements)

1. **Phase 3 — Dispute Resolution & Chargebacks:** Damage claims, deposit capture for damage, mediation, chargeback evidence.
2. **Phase 4 — Operational Tooling:** Admin dashboard for payment states, manual overrides, payout preferences.
3. **Per-listing cancellation policies:** All listings use the same platform policy (24h / &lt;24h tiers) in Phase 2.
4. **Automated no-show by time:** No automatic no-show after X hours; ops-driven only.
5. **Cancellation of active rentals:** Not allowed; early return has no payment effect.
6. **Refund to original payment method only:** Stripe default behavior; alternate disbursement is out of scope.

## Success Criteria

1. Renter can cancel a pending request with no charge and owner is notified.
2. Renter can cancel an approved rental before pickup: ≥24h before pickup results in 100% rental price refund (no service fee refund); &lt;24h results in 50% rental price refund. Service fee is never refunded for renter cancellation.
3. Owner can cancel an approved rental; renter receives full refund (rental + service fee); platform absorbs Stripe fee; renter and ops are notified.
4. Active rentals cannot be cancelled; early termination does not change payment.
5. Deposit hold is released or not placed when a rental is cancelled after approval.
6. All refunds use idempotency key `refund-rental-{rentalId}` and payment record is updated with refund amount and reason.
7. No-show (renter): 50% of rental price refunded to renter, owner paid remainder minus platform fee; no-show (owner): full refund to renter, OPS_ALERT sent.
8. Cancellation and refund events are recorded for audit (cancelledBy, cancelledAt, refundReason, etc.).
9. Refund-related webhooks update payment status correctly and idempotently.
10. No duplicate refunds for the same rental.

---

_Last updated: March 12, 2026 | Internal use only_
