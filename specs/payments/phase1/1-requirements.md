# Stripe Connect Payment Lifecycle (Phase 1) - Requirements Document

## Introduction

This document defines the Phase 1 requirements for restructuring Hoador's Stripe Connect payment lifecycle. The current implementation uses destination charges with `transfer_data`, which pays tool owners instantly when a rental is approved. This creates financial risk: the platform cannot hold funds during the rental period, cannot protect against damage disputes, and cannot process refunds without clawing back from the owner's connected account.

Phase 1 introduces a platform-hold payment model where rental payments are captured into the platform's Stripe account at booking confirmation and held until the rental completes cleanly. Owner payouts are issued via manual `stripe.transfers.create()` only after a 24-hour dispute window closes. Security deposits use authorization holds (standard 7-day window) placed 48 hours before pickup, with extended authorizations (up to 30 days) planned as a future enhancement once configured with Stripe.

### Scope

**In scope:** Rental payment capture, security deposit auth hold scheduling, deposit hold release, owner payout, cron infrastructure (Vercel Cron setup, deposit scheduling, payout processing, deposit expiry monitoring), Phase 1 webhook handlers, idempotency protection, payment lifecycle data model, return confirmation trigger, and operations alerting channel.

**Out of scope:** Cancellation policies and refund tiers, dispute resolution workflows, chargeback evidence collection, booking fees, partial refund policies, admin dashboard, multi-currency support, payout scheduling preferences, and extended Stripe authorization holds. These are deferred to future phases.

### Key Architectural Decisions

1. **Manual transfers** replace destination charges — funds stay in the platform account until explicitly transferred to the owner after the dispute window closes.
2. **Deposit auth holds** (standard 7-day) placed 48 hours before pickup — not real charges. On clean return, the hold is released (cancelled) at no cost. For rentals exceeding 7 days where the hold expires, the platform handles case by case for now.
3. **24-hour dispute window** starts when the owner confirms return — the owner has 24 hours to file a damage claim before payout proceeds.
4. **Existing service fee unchanged** — the renter-facing service fee (covers Stripe processing costs on the rental charge via `calculateServiceFee()`) continues to be charged. No additional booking fee is introduced. The service fee does NOT cover the deposit auth hold (auth holds incur no processing fee).
5. **Idempotency baked in from day 1** — deterministic idempotency keys and DB status gates prevent duplicate Stripe operations.
6. **Vercel Cron must be enabled** — the project does not currently have Vercel Cron active. This implementation requires enabling Vercel Cron and configuring `CRON_SECRET`.

### Fee Structure (Unchanged)

- **Service fee** (renter pays): breakeven fee covering Stripe's 2.9% + $0.30 on the rental charge amount — calculated via `calculateServiceFee()` in `src/constants/payments.ts`. The deposit is an auth hold and incurs no processing fee.
- **Platform fee** (20% of rental price): deducted from owner payout at transfer time via `PLATFORM_FEE_PERCENTAGE` in `src/constants/payments.ts`
- **Stripe fee on cancellation refunds**: Stripe retains the original processing fee (2.9% + $0.30) on all refunds of the rental charge. The platform absorbs this cost. Cancellation refund handling is deferred to Phase 2.

## Requirements

### Requirement 1: Rental Payment Capture (Platform-Hold Model)

**User Story:** As the platform, I want to capture rental payments into the platform account without immediately transferring to the owner, so that funds are held until the rental completes and the dispute window closes.

#### Acceptance Criteria

1. WHEN the owner approves a rental request THEN the system SHALL create a Stripe PaymentIntent for the rental amount with `capture_method: 'automatic'` and NO `transfer_data` parameter
2. The system SHALL NOT include `application_fee_amount` on the rental PaymentIntent — the platform fee is deducted at transfer time instead
3. WHEN creating the rental PaymentIntent THEN the system SHALL set `off_session: true`, `confirm: true`, `currency: 'usd'`, and attach the renter's `customer` and `payment_method`
4. The charge amount SHALL equal the rental price plus the service fee (calculated via the existing `calculateServiceFee()` function), consistent with the current charge calculation. The security deposit is NOT included in this charge.
5. WHEN creating the rental PaymentIntent THEN the system SHALL include metadata: `paymentType: 'rental_charge'`, `rentalRequestId`, `listingId`, `ownerId`, `renterId`, and `listingName`
6. WHEN the rental PaymentIntent succeeds THEN the system SHALL store the PaymentIntent ID in `rentalPaymentIntentId` on the rentals table AND create a corresponding record in the payments table with `status: 'succeeded'` and `paymentType: 'rental_charge'`
7. WHEN the rental PaymentIntent fails THEN the system SHALL set `paymentStatus: 'failed'` on the rental request, store the failure reason in `paymentFailureReason`, notify both the renter and owner via existing notification channels, and NOT approve the rental
8. IF the rental PaymentIntent fails with a retryable error (`StripeRateLimitError`, `StripeAPIError`, `StripeConnectionError`) THEN the system SHALL retry once after a 1-second delay before marking the payment as failed
9. The system SHALL generate a deterministic idempotency key of format `rental-charge-{rentalRequestId}` when creating the rental PaymentIntent

### Requirement 2: Security Deposit Authorization Hold

**User Story:** As the platform, I want to place an authorization hold on the renter's payment method for the security deposit amount 48 hours before pickup, so that deposit funds are reserved without charging the renter unless a damage claim is filed.

#### Acceptance Criteria

1. WHEN a rental is approved AND the listing has a security deposit greater than zero AND the rental start date is more than 48 hours away THEN the system SHALL schedule the deposit auth hold to be placed 48 hours before the `startDate`
2. WHEN a rental is approved AND the listing has a security deposit greater than zero AND the rental start date is 48 hours or less away THEN the system SHALL place the deposit auth hold immediately
3. WHEN placing the deposit auth hold THEN the system SHALL create a Stripe PaymentIntent with `capture_method: 'manual'`, `off_session: true`, `confirm: true`, `currency: 'usd'`, and attach the renter's `customer` and `payment_method`
4. WHEN placing the deposit auth hold THEN the system SHALL include metadata: `paymentType: 'security_deposit_hold'`, `rentalRequestId`, `rentalId`, `listingId`, and `renterId`
5. WHEN the deposit auth hold succeeds THEN the system SHALL store the PaymentIntent ID in `securityDepositAuthId` on the rentals table and set `depositHoldStatus: 'held'` on the payment lifecycle record
6. WHEN the deposit auth hold fails THEN the system SHALL set `depositHoldStatus: 'failed'`, notify both the renter and the owner that the deposit hold could not be placed, and provide the renter a path to update their payment method. The system SHALL send this notification only once — the cron SHALL NOT re-attempt or re-notify while `depositHoldStatus` remains `'failed'`.
7. IF the deposit auth hold fails THEN the rental SHALL NOT be cancelled — the rental proceeds but the platform and owner are informed that no deposit protection is in place
8. The system SHALL generate a deterministic idempotency key of format `deposit-hold-{rentalId}` when placing the deposit auth hold
9. The standard Stripe authorization hold window is 7 days — for rentals longer than 7 days, the hold may expire before the rental ends. This is an accepted limitation for Phase 1 (see Requirement 5 for expiry monitoring).

### Requirement 3: Security Deposit Release

**User Story:** As a renter, I want my security deposit hold released automatically after the tool is returned cleanly, so that the funds are no longer reserved on my payment method.

#### Acceptance Criteria

1. WHEN the payout processing cron job identifies a rental where `returnConfirmedAt` is more than 24 hours ago AND no open disputes exist AND `depositHoldStatus` is `'held'` THEN the system SHALL release the deposit hold by calling `stripe.paymentIntents.cancel()` on the deposit PaymentIntent
2. WHEN the deposit hold is successfully released THEN the system SHALL set `depositHoldStatus: 'released'` and `depositReleasedAt` to the current timestamp on the payment lifecycle record
3. WHEN the deposit hold release fails THEN the system SHALL set `depositHoldStatus: 'release_failed'`, log the error, and alert the operations team
4. IF `depositHoldStatus` is NOT `'held'` (e.g., already released, expired, or not applicable) THEN the system SHALL skip the release operation
5. WHERE an open dispute exists for the rental THEN the system SHALL NOT release the deposit hold — it remains held pending dispute resolution
6. WHERE `depositHoldStatus` is `'expired'` THEN the system SHALL skip the release (nothing to release) and proceed directly to owner transfer

### Requirement 4: Owner Payout via Manual Transfer

**User Story:** As a tool owner, I want to receive my payout after the rental completes and the dispute window closes, so that I am paid reliably while the platform retains control during the rental period.

#### Acceptance Criteria

1. The system SHALL NOT transfer funds to the owner at booking approval time — owner payout is deferred until after the dispute window closes
2. WHEN the payout processing cron job identifies a rental where `returnConfirmedAt` is more than 24 hours ago AND no open disputes exist AND `ownerTransferStatus` is `'pending'` THEN the system SHALL create a Stripe Transfer via `stripe.transfers.create()`
3. WHEN creating the owner transfer THEN the system SHALL set: `amount` equal to the rental charge minus the platform fee (in cents), `currency: 'usd'`, `destination` equal to the owner's Stripe Connected Account ID, and `source_transaction` referencing the Charge ID from the rental PaymentIntent
4. The platform fee SHALL be calculated as `totalAmount * PLATFORM_FEE_PERCENTAGE` (currently 20%), consistent with the existing constant in `src/constants/payments.ts`
5. WHEN creating the owner transfer THEN the system SHALL use a deterministic idempotency key of format `transfer-owner-{rentalId}`
6. WHEN creating the owner transfer THEN the system SHALL include metadata: `rentalId`, `rentalRequestId`, `ownerId`
7. WHEN the transfer succeeds THEN the system SHALL set `ownerTransferStatus: 'completed'`, store the Stripe Transfer ID in `stripeTransferId`, and set `ownerTransferredAt` to the current timestamp on the payment lifecycle record
8. WHEN the transfer fails THEN the system SHALL set `ownerTransferStatus: 'failed'`, log the error, and alert the operations team — the system SHALL NOT automatically retry (manual intervention required)
9. IF `ownerTransferStatus` is NOT `'pending'` THEN the system SHALL skip the transfer operation (prevents duplicate transfers)
10. WHERE an open dispute exists for the rental THEN the system SHALL NOT create the owner transfer and SHALL set `ownerTransferStatus: 'frozen'` until the dispute is resolved

### Requirement 5: Cron Infrastructure

**User Story:** As the platform, I want automated scheduled processes to handle deposit hold placement, payout processing, and deposit expiry monitoring, so that financial operations happen reliably without manual intervention.

#### Acceptance Criteria

##### 5a: Vercel Cron Setup

1. The system SHALL enable Vercel Cron for the project by adding a `crons` configuration to `vercel.json`
2. The system SHALL configure a `CRON_SECRET` environment variable in all Vercel environments (development, preview, production)
3. All cron endpoints SHALL verify requests using the `Authorization: Bearer {CRON_SECRET}` header

##### 5b: Deposit Hold Scheduling Cron

1. The system SHALL expose a Vercel Cron endpoint at `GET /api/cron/schedule-deposit-holds` that runs every hour (cron schedule: `0 * * * *`)
2. WHEN the cron job executes THEN the system SHALL query for all rentals WHERE: the rental is approved (has a rentals record), `startDate` is within the next 48 hours, a security deposit is required (securityDeposit > 0), AND `depositHoldStatus` is `'scheduled'`
3. The cron SHALL NOT query for or attempt to process rentals where `depositHoldStatus` is `'failed'` — failed holds are only retried after the renter updates their payment method (which resets the status to `'scheduled'`, see Requirement 11)
4. FOR EACH eligible rental THEN the system SHALL place the deposit auth hold as defined in Requirement 2
5. The cron job SHALL process rentals in batches (limit 20 per run)
6. The system SHALL log the count of eligible rentals found, holds placed, and failures for each execution

##### 5c: Payout Processing Cron

1. The system SHALL expose a Vercel Cron endpoint at `GET /api/cron/process-payouts` that runs every hour (cron schedule: `0 * * * *`)
2. WHEN the cron job executes THEN the system SHALL query for all rentals WHERE: `rental_requests.status` is `'completed'`, `rentals.returnConfirmedAt` is more than 24 hours ago, `rental_payment_lifecycle.payoutStatus` is `'pending'`, AND no open disputes exist for the rental
3. FOR EACH eligible rental THEN the system SHALL set `payoutStatus: 'processing'` BEFORE initiating any Stripe operations (concurrency lock)
4. The system SHALL use an atomic `UPDATE ... WHERE payoutStatus = 'pending'` query to set `payoutStatus: 'processing'`, ensuring only one cron execution can claim a rental
5. FOR EACH eligible rental THEN the system SHALL execute in order: (a) release the deposit hold if `depositHoldStatus` is `'held'`, then (b) create the owner transfer if `ownerTransferStatus` is `'pending'`
6. WHEN both operations complete successfully THEN the system SHALL set `payoutStatus: 'completed'`
7. WHEN either operation fails THEN the system SHALL set `payoutStatus: 'failed'` and log the error with the rental ID for manual investigation
8. The system SHALL log the count of eligible rentals found, processed, succeeded, and failed for each execution
9. The cron job SHALL process rentals in batches (limit 20 per run)
10. WHERE no eligible rentals are found THEN the cron job SHALL return a success response with `processedCount: 0`

##### 5d: Deposit Expiry Monitoring Cron

1. The system SHALL expose a Vercel Cron endpoint at `GET /api/cron/monitor-deposit-expiry` that runs every hour (cron schedule: `0 * * * *`)
2. WHEN the cron job executes THEN the system SHALL query for all rentals WHERE: `depositHoldStatus` is `'held'` AND the hold was placed more than 6 days ago (approaching 7-day expiry)
3. FOR EACH rental with an expiring or expired hold THEN the system SHALL check the hold status via `stripe.paymentIntents.retrieve()` — IF the PaymentIntent status is `'canceled'` (expired by Stripe) THEN set `depositHoldStatus: 'expired'`
4. WHEN a deposit hold is detected as expired THEN the system SHALL alert the operations team via the internal alerting channel — the system SHALL NOT notify the renter or owner, and SHALL NOT change the rental status
5. The system SHALL log all detected expirations for operational visibility

### Requirement 6: Webhook Infrastructure (Phase 1 Events)

**User Story:** As the platform, I want to handle Stripe webhook events for payment lifecycle changes, so that the system stays in sync with Stripe's state and can react to failures.

#### Acceptance Criteria

1. WHEN a `payment_intent.succeeded` webhook is received THEN the system SHALL look up the payment record by `stripePaymentIntentId` and update its `status` to `'succeeded'` and set `paidAt` to the current timestamp if not already set
2. WHEN a `payment_intent.payment_failed` webhook is received THEN the system SHALL look up the payment record by `stripePaymentIntentId`, update its `status` to `'failed'`, and send a notification to the renter informing them of the payment failure
3. WHEN a `payment_intent.canceled` webhook is received AND the PaymentIntent metadata contains `paymentType: 'security_deposit_hold'` THEN the system SHALL check if this was an intentional release (depositHoldStatus is `'released'`) or an expiration — IF the hold was not intentionally released THEN set `depositHoldStatus: 'expired'` and alert the operations team
4. WHEN a `transfer.reversed` webhook is received THEN the system SHALL look up the payment lifecycle record by the Transfer ID, set `ownerTransferStatus` to `'failed'`, and send an alert to the operations team — the system SHALL NOT automatically retry
5. The system SHALL add the new event types (`payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `transfer.reversed`) to the existing webhook handler in `src/app/api/stripe/webhooks/route.ts` alongside the current `account.updated` and `account.closed` handlers
6. The system SHALL return HTTP 200 for all successfully processed webhooks, and HTTP 500 only for unrecoverable processing errors
7. WHERE a webhook event has already been processed (detected via DB status checks) THEN the system SHALL return HTTP 200 without making duplicate changes (idempotent handling)

### Requirement 7: Idempotency Protection

**User Story:** As the platform, I want all Stripe API calls to be idempotent, so that network retries, cron overlaps, and webhook replays do not create duplicate charges, refunds, or transfers.

#### Acceptance Criteria

1. The system SHALL include an `idempotencyKey` parameter on every Stripe PaymentIntent creation and transfer creation call
2. The system SHALL use the following deterministic idempotency key formats:
   - Rental charge: `rental-charge-{rentalRequestId}`
   - Deposit hold: `deposit-hold-{rentalId}`
   - Owner transfer: `transfer-owner-{rentalId}`
3. BEFORE every Stripe API call in the cron jobs THEN the system SHALL check the corresponding DB status field (`depositHoldStatus`, `ownerTransferStatus`, `payoutStatus`) — IF the status is not in the expected pre-operation state THEN the system SHALL skip the Stripe call
4. The payout processing cron SHALL use `payoutStatus: 'processing'` as a concurrency lock — WHEN a rental already has `payoutStatus: 'processing'` THEN the cron job SHALL skip it
5. The system SHALL use an atomic `UPDATE ... WHERE payoutStatus = 'pending'` query to set `payoutStatus: 'processing'`, ensuring only one cron execution can claim a rental for processing

### Requirement 8: Payment Lifecycle Data Model

**User Story:** As the platform, I want a data model that tracks the full payment lifecycle (capture, deposit hold, release, transfer, payout status), so that every financial operation is auditable and the system can gate operations on status.

#### Acceptance Criteria

1. The system SHALL create a new `rental_payment_lifecycle` table with a 1:1 relationship to the `rentals` table, containing:
   - `id` (uuid, primary key)
   - `rentalId` (uuid, foreign key to rentals, unique)
   - `rentalChargeId` (varchar, nullable) — the Stripe Charge ID from the rental PaymentIntent, needed for `source_transaction` on transfers
   - `depositHoldStatus` (enum: `'scheduled'`, `'held'`, `'released'`, `'expired'`, `'release_failed'`, `'failed'`, `'captured'`, `'not_applicable'`) — tracks the deposit auth hold lifecycle
   - `depositHoldPlacedAt` (timestamp, nullable) — when the auth hold was placed
   - `depositReleasedAt` (timestamp, nullable) — when the hold was released on clean return
   - `ownerTransferStatus` (enum: `'pending'`, `'processing'`, `'completed'`, `'failed'`, `'frozen'`)
   - `payoutStatus` (enum: `'pending'`, `'processing'`, `'completed'`, `'failed'`)
   - `stripeTransferId` (varchar, nullable) — the Stripe Transfer ID after successful owner payout
   - `ownerTransferredAt` (timestamp, nullable)
   - `createdAt` (timestamp)
   - `updatedAt` (timestamp)
2. WHEN a rental is approved with a security deposit AND startDate > 48hrs away THEN the system SHALL create a lifecycle record with `depositHoldStatus: 'scheduled'`, `ownerTransferStatus: 'pending'`, `payoutStatus: 'pending'`
3. WHEN a rental is approved with a security deposit AND startDate ≤ 48hrs away THEN the system SHALL place the hold immediately and create a lifecycle record with `depositHoldStatus: 'held'` (or `'failed'` if hold fails), `ownerTransferStatus: 'pending'`, `payoutStatus: 'pending'`
4. WHEN a rental is approved with no security deposit THEN the system SHALL create a lifecycle record with `depositHoldStatus: 'not_applicable'`, `ownerTransferStatus: 'pending'`, `payoutStatus: 'pending'`
5. The system SHALL store the Stripe Charge ID (from `paymentIntent.latest_charge`) in `rentalChargeId` at rental payment capture time, for use as `source_transaction` on later transfers
6. The system SHALL add a `paymentType` column to the existing `payments` table with enum values: `'rental_charge'`, `'security_deposit_hold'` — this distinguishes payment records by type
7. The system SHALL add `returnConfirmedAt` (timestamp, nullable) to the `rentals` table — this records when the owner confirmed the tool was returned and starts the 24-hour dispute window
8. The system SHALL add database indexes on `rental_payment_lifecycle.payoutStatus`, `rental_payment_lifecycle.depositHoldStatus`, and `rentals.returnConfirmedAt` for efficient cron job queries
9. The system SHALL add `depositHoldStatusEnum`, `ownerTransferStatusEnum`, `payoutStatusEnum`, and `paymentTypeEnum` to `src/db/schemas/_enums.ts`
10. Existing payment records SHALL be migrated: all current payments receive `paymentType: 'rental_charge'`

### Requirement 9: Return Confirmation Trigger

**User Story:** As an owner, I want to confirm that the renter has returned the tool, so that the 24-hour dispute window starts and the payout process is initiated.

#### Acceptance Criteria

1. WHEN the owner confirms the tool has been returned THEN the system SHALL set `returnConfirmedAt` to the current timestamp on the rental record
2. WHEN `returnConfirmedAt` is set THEN the system SHALL update `rental_requests.status` to `'completed'` (using the existing `rentalStatusEnum`)
3. The system SHALL NOT initiate any payout or deposit release operations at return confirmation time — these are handled by the payout processing cron after the 24-hour dispute window
4. IF `returnConfirmedAt` is already set on the rental THEN the system SHALL reject the duplicate confirmation attempt
5. The system SHALL create an audit log entry when return is confirmed, including the owner's user ID and timestamp
6. WHEN the return is confirmed THEN the system SHALL send a notification to the renter that the return has been acknowledged

### Requirement 10: Operations Alerting Channel

**User Story:** As the operations team, I want to receive alerts for payment failures, deposit expirations, and transfer issues, so that I can investigate and resolve problems that require manual intervention.

#### Acceptance Criteria

1. The system SHALL establish an internal alerting channel for operations notifications — the implementation may use email, Slack webhook, or an internal admin notifications table
2. The system SHALL send operations alerts for the following events:
   - Deposit auth hold placement fails (Requirement 2)
   - Deposit hold detected as expired (Requirement 5d)
   - Deposit hold release fails (Requirement 3)
   - Owner transfer fails (Requirement 4)
   - Payout processing cron encounters an error (Requirement 5c)
3. Each alert SHALL include: rental ID, event type, error message (if applicable), and timestamp
4. Operations alerts SHALL NOT be sent to renters or owners — these are internal-only notifications
5. The specific alerting mechanism (email, Slack, admin table) is implementation-defined but must be functional before the cron jobs are deployed to production

### Requirement 11: Deposit Hold Failure Recovery

**User Story:** As a renter, I want to be able to update my payment method if the deposit hold fails, so that I can resolve the issue without cancelling my rental.

#### Acceptance Criteria

1. WHEN a deposit auth hold fails THEN the system SHALL notify the renter once with a message explaining the hold failed and prompting them to verify or update their payment method
2. WHEN a deposit auth hold fails THEN the system SHALL notify the owner once that the deposit hold could not be placed and the rental is proceeding without deposit protection
3. The system SHALL provide the renter a path to update their payment method via the existing payment methods management UI (`/dashboard/profile/payments`)
4. WHEN the renter updates their payment method AND the rental has `depositHoldStatus: 'failed'` AND the rental `startDate` has not passed THEN the system SHALL reset `depositHoldStatus` to `'scheduled'` — this allows the deposit scheduling cron to pick it up on the next hourly run and retry the hold with the new payment method
5. WHILE `depositHoldStatus` is `'failed'` the deposit scheduling cron SHALL NOT attempt to place the hold and SHALL NOT send additional notifications — the status acts as a gate preventing repeated retries and alerts
6. IF the deposit hold fails a second time (after renter updated payment method and status was reset to `'scheduled'`) THEN the system SHALL set `depositHoldStatus: 'failed'` again, notify the renter once more, and alert the operations team

## Non-Functional Requirements

### Performance

1. The payout processing cron job SHALL complete processing of up to 20 eligible rentals within 60 seconds
2. The deposit scheduling cron job SHALL complete processing of up to 20 eligible rentals within 60 seconds
3. Rental approval (payment capture) SHALL complete within 10 seconds
4. Webhook processing SHALL return HTTP 200 within 5 seconds for each event
5. Database queries for cron jobs SHALL use indexes on `payoutStatus`, `depositHoldStatus`, and `returnConfirmedAt` to avoid full table scans

### Reliability

1. All Stripe API calls SHALL include idempotency keys to ensure safe retries
2. The payout processing cron SHALL use atomic status transitions (`UPDATE ... WHERE status = 'pending'`) to prevent concurrent processing of the same rental
3. WHERE a Stripe API call fails THEN the system SHALL set the corresponding status to `'failed'` and log the error — the system SHALL NOT leave records in a `'processing'` state indefinitely
4. Webhook signature verification SHALL reject events with invalid or missing signatures (maintaining the existing pattern)

### Security

1. All cron endpoints SHALL verify requests using the `CRON_SECRET` bearer token
2. The webhook endpoint SHALL verify Stripe signatures using `STRIPE_WEBHOOK_SECRET` (maintaining the existing pattern)
3. Stripe secret keys and webhook secrets SHALL NOT be logged or exposed in error messages
4. All financial operations SHALL be recorded in the audit log

### Usability

1. WHERE a payment fails during rental approval THEN the system SHALL return a user-friendly error message to the owner (reusing the existing `getPaymentErrorMessage()` utility)
2. WHERE a deposit hold fails THEN the system SHALL notify the renter with clear instructions on how to update their payment method
3. The owner SHALL receive a notification when their payout is transferred

### Scalability

1. All cron jobs SHALL process rentals in batches (limit 20 per run) to stay within serverless function timeouts
2. The data model SHALL support multiple payment types per rental (rental charge + deposit hold) via the `paymentType` discriminator

## Assumptions

1. Stripe Connect accounts for owners are already set up and onboarded (existing flow handles this)
2. The Stripe webhook endpoint in the Stripe Dashboard will be updated to include the new event types (`payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `transfer.reversed`)
3. The existing `rentalStatusEnum` value `'completed'` is appropriate for the return-confirmed state — no new rental status is needed
4. The owner has a UI action (or API endpoint) to confirm tool return — the exact UI is not defined in this spec, only the backend trigger (`returnConfirmedAt`) is required
5. The `source_transaction` on `stripe.transfers.create()` requires the Charge ID (not PaymentIntent ID) — the system must store the Charge ID (from `paymentIntent.latest_charge`) at capture time
6. The Vercel project plan supports cron jobs — Vercel Cron is available on Hobby (1 cron per day) and Pro (unlimited) plans. The hourly schedule requires Pro or equivalent.
7. Standard Stripe auth holds expire after 7 days — this is an accepted limitation for Phase 1

## Constraints

1. Vercel serverless functions have a 10-second timeout on hobby and 60-second timeout on pro — batch sizes must respect this limit
2. Stripe idempotency keys expire after 24 hours — the DB status gates are the primary protection against duplicate operations
3. Standard Stripe authorization holds expire after 7 days for online payments — rentals longer than 7 days will have their deposit hold expire. This is handled operationally (case by case) in Phase 1, with extended authorizations (up to 30 days) planned for a future phase
4. Database migrations must be backward-compatible with existing data
5. Vercel Cron on the Hobby plan only supports 1 cron job per day. If on Hobby, the three cron endpoints may need to be consolidated into a single endpoint that runs all checks. The Pro plan supports up to 40 cron jobs.

## Edge Cases

1. **Deposit auth hold fails at placement**: Rental proceeds without deposit protection. Both parties are notified. Owner accepts the risk. Renter can update payment method and the next cron run will retry.
2. **Owner never confirms return**: The payout cron will not find the rental eligible (no `returnConfirmedAt`). A future phase may add auto-completion after the end date plus a grace period.
3. **Dispute filed during 24-hour window**: `ownerTransferStatus` is set to `'frozen'`. The payout cron skips the rental. Deposit hold remains in place if not expired. Dispute resolution (Phase 3) will determine the financial outcome.
4. **Cron job crashes after releasing deposit but before transferring to owner**: `depositHoldStatus` is `'released'`, `ownerTransferStatus` is still `'pending'`, `payoutStatus` is `'processing'`. The next cron run skips because `payoutStatus` is not `'pending'`. Manual intervention is required.
5. **Renter's payment method declined at approval**: Approval fails. The rental request stays in `pending` status with `paymentStatus: 'failed'`. Renter is notified to update payment method.
6. **Owner's connected account deactivated before payout**: `stripe.transfers.create()` will fail. The system sets `ownerTransferStatus: 'failed'` and alerts ops. The owner must resolve their Stripe account status.
7. **Double webhook delivery**: Webhook handlers check current DB status before making changes. If status is already updated, the handler is a no-op.
8. **Rental with zero deposit**: `depositHoldStatus` is set to `'not_applicable'`. Cron skips deposit operations and proceeds directly to owner transfer.
9. **Deposit hold expires during rental (>7 days)**: The expiry monitoring cron detects the expiration, sets `depositHoldStatus: 'expired'`, and alerts ops only. No user notification. No rental status change. Ops handles case by case.
10. **Approval happens <48hrs before pickup**: Deposit hold is placed immediately at approval time rather than being scheduled for later.
11. **Multiple rentals eligible simultaneously**: Cron processes them in batch (up to 20). Each rental is independently locked via `payoutStatus: 'processing'`.
12. **`source_transaction` charge ID not stored**: The system must store the Charge ID from `paymentIntent.latest_charge` at capture time. If the charge ID cannot be resolved, the transfer fails and alerts ops.
13. **Deposit hold placed but rental is cancelled before pickup**: Cancellation handling (releasing the hold + refunding the rental charge) is deferred to Phase 2. For now, ops handles manually.

## Out of Scope (Future Enhancements)

1. **Phase 2 — Cancellation Policies**: Renter/owner cancellation paths, tiered refund rules, deposit hold release on cancellation, Stripe fee accounting on refunds, no-show handling
2. **Phase 3 — Dispute Resolution & Chargebacks**: Damage claims, deposit capture for damage, mediation outcomes, chargeback evidence collection
3. **Phase 4 — Operational Tooling**: Admin dashboard for payment states, stale processing alerts, manual override tools, payout scheduling preferences
4. **Extended Stripe Authorization Holds**: Up to 30 days with `request_extended_authorization: 'if_available'` — requires Interchange Plus pricing and Stripe configuration
5. **Automatic retry for failed transfers**: Exponential backoff retry for transient Stripe errors
6. **Stale processing detector**: Finds records stuck in `'processing'` for more than N hours
7. **Multi-currency support**: All amounts are in USD for v1
8. **Renter-facing payment timeline**: Showing the renter the status of their deposit or payout in the UI

## Success Criteria

1. Rental payments are captured into the platform account with no `transfer_data` — verified by checking PaymentIntent objects in Stripe Dashboard show the platform as the settlement account
2. Security deposits are placed as auth holds (`capture_method: 'manual'`) 48 hours before pickup — verified by checking PaymentIntent status is `requires_capture`
3. Owners receive no payout at booking time — verified by confirming no Stripe Transfer is created when a rental is approved
4. The deposit scheduling cron correctly identifies rentals approaching pickup and places holds
5. The payout processing cron successfully releases deposit holds and creates owner transfers after the 24-hour dispute window
6. The deposit expiry monitoring cron detects expired holds and alerts ops without affecting the rental or notifying users
7. Idempotency keys prevent duplicate charges, holds, and transfers when the same operation is triggered multiple times
8. All Phase 1 webhook events are handled correctly and update DB state accordingly
9. Failed Stripe operations are recorded with `'failed'` status and do not leave the system in an inconsistent state
10. The `payoutStatus` concurrency lock prevents two cron executions from processing the same rental simultaneously
11. Existing rental approval flow continues to work with the new payment model (no regressions in the approval UX)
12. Vercel Cron is enabled and all three cron endpoints are running on schedule
13. All financial operations are recorded in the audit log for traceability

---

_Last updated: March 12, 2026 | Internal use only_
