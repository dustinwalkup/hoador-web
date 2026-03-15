# Stripe Connect Payment Lifecycle (Phase 1) - Implementation Tasks

## Overview

This document breaks down the Phase 1 payment lifecycle implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Add new enums to schema definitions
  - Add `depositHoldStatusEnum` to `src/db/schemas/_enums.ts`
  - Define enum with values: `scheduled`, `held`, `released`, `expired`, `release_failed`, `failed`, `captured`, `not_applicable`
  - Add `ownerTransferStatusEnum` with values: `pending`, `processing`, `completed`, `failed`, `frozen`
  - Add `payoutStatusEnum` with values: `pending`, `processing`, `completed`, `failed`
  - Add `paymentTypeEnum` with values: `rental_charge`, `security_deposit_hold`
  - Export all enums for use in schemas
  - _Requirements: 8.9_

- [ ] 2. Create rental_payment_lifecycle table schema
  - Create `src/db/schemas/rental-payment-lifecycle.schema.ts`
  - Define `rental_payment_lifecycle` table with fields:
    - `id` (uuid, primary key)
    - `rentalId` (uuid, foreign key to rentals, unique, onDelete: cascade)
    - `rentalChargeId` (varchar(255), nullable) — Stripe Charge ID for `source_transaction`
    - `depositHoldStatus` (depositHoldStatusEnum, default: `'scheduled'`)
    - `depositHoldPlacedAt` (timestamp, nullable)
    - `depositReleasedAt` (timestamp, nullable)
    - `ownerTransferStatus` (ownerTransferStatusEnum, default: `'pending'`)
    - `payoutStatus` (payoutStatusEnum, default: `'pending'`)
    - `stripeTransferId` (varchar(255), nullable)
    - `ownerTransferredAt` (timestamp, nullable)
    - `createdAt` (timestamp, defaultNow)
    - `updatedAt` (timestamp, defaultNow)
  - Add indexes: unique on `rentalId`, index on `payoutStatus`, index on `depositHoldStatus`
  - Define relations to rentals table
  - Export table and relations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8_

- [ ] 3. Add `returnConfirmedAt` to rentals table
  - Add `returnConfirmedAt` (timestamp, nullable) to the existing `rentals` table in `src/db/schemas/rentals.schema.ts`
  - Add index on `returnConfirmedAt` for efficient cron queries
  - _Requirements: 8.7, 9.1_

- [ ] 4. Add `paymentType` to payments table
  - Add `paymentType` (paymentTypeEnum, default: `'rental_charge'`, notNull) to `src/db/schemas/payments.schema.ts`
  - Existing records will auto-populate with `'rental_charge'` via the default
  - _Requirements: 8.6, 8.10_

- [ ] 5. Export new schema from index
  - Add rental-payment-lifecycle schema exports to `src/db/schemas/index.ts`
  - Verify all new enums and tables are accessible
  - _Requirements: Schema integration_

- [ ] 6. Generate database migration
  - Run Drizzle migration generation: `bun run db:generate`
  - Review generated migration SQL in `src/db/migrations/`
  - Verify migration creates all 4 enum types correctly
  - Verify migration creates `rental_payment_lifecycle` table with correct constraints
  - Verify migration adds `return_confirmed_at` to rentals
  - Verify migration adds `payment_type` to payments with default value
  - Verify all indexes are created
  - Verify foreign key constraints are correct
  - Confirm migration is additive and backward-compatible
  - _Requirements: All schema requirements_

### Phase 2: Data Access Layer

- [ ] 7. Create PaymentLifecycleDAL class structure
  - Create `src/dal/payment-lifecycle.dal.ts`
  - Extend `BaseDAL` class
  - Import necessary types, schemas, and enums
  - Set up error handling using `handleError()` from BaseDAL
  - _Requirements: DAL structure_

- [ ] 8. Implement lifecycle record creation method
  - Add `create()` method to PaymentLifecycleDAL
  - Accept data: `rentalId`, `rentalChargeId`, `depositHoldStatus`, `ownerTransferStatus`, `payoutStatus`
  - Insert record into `rental_payment_lifecycle`
  - Return created lifecycle record
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 9. Implement `getByRentalId` method
  - Add `getByRentalId()` method to PaymentLifecycleDAL
  - Query lifecycle record by `rentalId`
  - Return record or null
  - _Requirements: General DAL access_

- [ ] 10. Implement `claimForProcessing` method (atomic lock)
  - Add `claimForProcessing()` method to PaymentLifecycleDAL
  - Execute atomic `UPDATE rental_payment_lifecycle SET payout_status = 'processing', updated_at = NOW() WHERE rental_id = $1 AND payout_status = 'pending' RETURNING *`
  - Return `true` if row was updated (claim succeeded), `false` otherwise
  - _Requirements: 5c.3, 5c.4, 7.4, 7.5_

- [ ] 11. Implement status update methods
  - Add `updateDepositHoldStatus()` — accepts `rentalId`, `status`, optional `depositHoldPlacedAt` and `depositReleasedAt`
  - Add `updateOwnerTransferStatus()` — accepts `rentalId`, `status`, optional `stripeTransferId` and `ownerTransferredAt`
  - Add `updatePayoutStatus()` — accepts `rentalId`, `status`
  - All methods update `updatedAt` timestamp
  - _Requirements: 2.5, 2.6, 3.2, 3.3, 4.7, 4.8_

- [ ] 12. Implement `findEligibleForPayout` query
  - Add `findEligibleForPayout()` method to PaymentLifecycleDAL
  - Accept `limit` parameter (default 20)
  - Join `rental_payment_lifecycle` → `rentals` → `rental_requests`
  - Left join `disputes` to exclude open disputes
  - Where: `rental_requests.status = 'completed'`, `returnConfirmedAt < NOW() - 24hrs`, `payoutStatus = 'pending'`, no open disputes
  - Order by `returnConfirmedAt` ASC
  - Return array with lifecycle + rental + owner info needed for transfer
  - _Requirements: 5c.2_

- [ ] 13. Implement `findScheduledDepositsNearPickup` query
  - Add `findScheduledDepositsNearPickup()` method to PaymentLifecycleDAL
  - Accept `limit` parameter (default 20)
  - Join `rental_payment_lifecycle` → `rentals` → `rental_requests`
  - Where: `depositHoldStatus = 'scheduled'`, `startDate <= NOW() + 48hrs`, `startDate > NOW()`
  - Order by `startDate` ASC
  - Return array with lifecycle + rental + renter payment info needed for hold
  - _Requirements: 5b.2, 5b.3_

- [ ] 14. Implement `findExpiringDeposits` query
  - Add `findExpiringDeposits()` method to PaymentLifecycleDAL
  - Accept `daysHeld` parameter (default 6)
  - Where: `depositHoldStatus = 'held'`, `depositHoldPlacedAt < NOW() - N days`
  - Return array with lifecycle + rental info + `securityDepositAuthId`
  - _Requirements: 5d.2_

- [ ] 15. Implement `findFailedDepositsForRenter` query
  - Add `findFailedDepositsForRenter()` method to PaymentLifecycleDAL
  - Accept `renterId` parameter
  - Join `rental_payment_lifecycle` → `rentals` → `rental_requests`
  - Where: `depositHoldStatus = 'failed'`, `startDate > NOW()` (not yet started)
  - Return array of lifecycle records with rental ID and start date
  - _Requirements: 11.4_

- [ ] 16. Modify PaymentDAL for `paymentType`
  - Update `createPayment()` in `src/dal/payment.dal.ts` to accept `paymentType` parameter
  - Pass `paymentType` through to insert values
  - _Requirements: 8.6_

- [ ] 17. Export PaymentLifecycleDAL from DAL index
  - Add PaymentLifecycleDAL export to `src/dal/index.ts`
  - Follow existing singleton or instantiation pattern
  - _Requirements: DAL integration_

### Phase 3: Operations Alerting

- [ ] 18. Create ops alerting utility
  - Create `src/features/notifications/lib/ops-alerts.ts`
  - Import `getLogger()` from existing logger
  - Define `OpsAlertParams` interface: `event`, `rentalId`, `message`, optional `metadata`
  - Read `OPS_ALERT_EMAIL` from environment
  - Implement `sendOpsAlert()` function:
    - Always log with `getLogger().error({ alertType: "ops", event, rentalId, ...metadata }, message)`
    - If `OPS_ALERT_EMAIL` is configured, send email via existing email infrastructure
  - Implement `sendOpsAlertEmail()` helper for email formatting
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 19. Add `OPS_ALERT_EMAIL` to environment configuration
  - Add `OPS_ALERT_EMAIL` to `.env.example`
  - Add to environment validation if applicable (zod schema, etc.)
  - _Requirements: 10.5_

### Phase 4: Stripe Service Layer

- [ ] 20. Modify `chargeRentalPayment()` to remove destination charges
  - In `src/services/stripe/rental-payments.ts`:
  - Remove `ownerConnectedAccountId` parameter
  - Remove `applicationFeeAmount` parameter
  - Remove `transfer_data` from PaymentIntent creation params
  - Remove `application_fee_amount` from PaymentIntent creation params
  - Add `idempotencyKey` parameter (required string)
  - Pass `idempotencyKey` to `stripe.paymentIntents.create()` options
  - Add `paymentType: 'rental_charge'` to metadata
  - Update function signature and JSDoc
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.9_

- [ ] 21. Add idempotency key to `authorizeSecurityDeposit()`
  - In `src/services/stripe/rental-payments.ts`:
  - Add `idempotencyKey` parameter to `authorizeSecurityDeposit()`
  - Pass `idempotencyKey` to `stripe.paymentIntents.create()` options
  - Add `paymentType: 'security_deposit_hold'` to metadata
  - _Requirements: 2.3, 2.4, 2.8_

- [ ] 22. Create DepositHoldService
  - Create `src/services/stripe/deposit-hold.ts`
  - Define `PlaceDepositHoldParams` and `DepositHoldResult` interfaces
  - Implement `placeDepositHold()`:
    - Calls existing `authorizeSecurityDeposit()` with `capture_method: 'manual'`, `off_session: true`, `confirm: true`
    - Uses idempotency key: `deposit-hold-{rentalId}`
    - Includes metadata: `paymentType`, `rentalRequestId`, `rentalId`, `listingId`, `renterId`
    - Returns `{ success: true, paymentIntentId }` or `{ success: false, error }`
  - Implement `releaseDepositHold()`:
    - Reuses existing `releaseSecurityDeposit()` from `rental-payments.ts`
    - Returns void on success, throws on failure
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 3.1_

- [ ] 23. Create PayoutService
  - Create `src/services/stripe/payout.ts`
  - Define `CreateOwnerTransferParams` and `TransferResult` interfaces
  - Implement `createOwnerTransfer()`:
    - Calls `stripe.transfers.create()` with:
      - `amount`: rental charge minus platform fee (in cents)
      - `currency: 'usd'`
      - `destination`: owner's Connected Account ID
      - `source_transaction`: `rentalChargeId` (Stripe Charge ID)
      - `metadata`: `rentalId`, `rentalRequestId`, `ownerId`
    - Idempotency key: `transfer-owner-{rentalId}`
    - Platform fee: `Math.round(totalAmount * platformFeePercentage * 100)` cents
    - Transfer amount: `Math.round(totalAmount * 100) - platformFeeCents`
    - Returns `{ success: true, transferId }` or `{ success: false, error }`
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9_

### Phase 5: Modify Rental Approval Flow

- [ ] 24. Update `approveRentalRequest()` in RentalService
  - In `src/features/rentals/services/rental-service.ts`:
  - Remove `ownerAccountId` and `applicationFeeAmount` from `chargeRentalPayment()` call
  - Add idempotency key `rental-charge-{rentalRequestId}` to charge call
  - After successful charge, extract Charge ID from `paymentIntent.latest_charge`
  - Create `rental_payment_lifecycle` record via `PaymentLifecycleDAL.create()`:
    - `rentalChargeId`: the Stripe Charge ID
    - `depositHoldStatus`: determined by deposit amount and timing (see next task)
    - `ownerTransferStatus: 'pending'`
    - `payoutStatus: 'pending'`
  - Create payment record with `paymentType: 'rental_charge'`
  - Remove `trackActivity(rentalRequest.ownerId, "payout_received")` — payout happens later via cron
  - _Requirements: 1.1, 1.2, 1.6, 1.9, 8.2, 8.5_

- [ ] 25. Add deposit hold scheduling logic to approval flow
  - In `approveRentalRequest()`, after creating lifecycle record:
  - IF listing has no security deposit (`securityDeposit === 0`):
    - Set `depositHoldStatus: 'not_applicable'` on lifecycle record
  - ELSE IF `startDate <= 48hrs` away:
    - Call `placeDepositHold()` immediately
    - On success: set `depositHoldStatus: 'held'`, store authId on rentals table
    - On failure: set `depositHoldStatus: 'failed'`, notify renter + owner once
  - ELSE (`startDate > 48hrs` away):
    - Set `depositHoldStatus: 'scheduled'` on lifecycle record (cron handles later)
  - Handle deposit failure non-critically (rental still proceeds)
  - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 8.2, 8.3, 8.4_

- [ ] 26. Update callers of `chargeRentalPayment()`
  - Search codebase for all callers of `chargeRentalPayment()`
  - Update each call site to match the new function signature (removed `ownerAccountId`, `applicationFeeAmount`; added `idempotencyKey`)
  - Verify no other code references `transfer_data` or `application_fee_amount` for rental charges
  - _Requirements: 1.1, 1.2_

### Phase 6: Cron Endpoints

- [ ] 27. Create deposit hold scheduling cron
  - Create `src/app/api/cron/schedule-deposit-holds/route.ts`
  - Follow existing pattern from `cleanup-notifications/route.ts`:
    - Verify `CRON_SECRET` bearer token
    - Use `withRequestLogging` wrapper
    - Use `tryCatch` for error handling
  - Query eligible rentals via `PaymentLifecycleDAL.findScheduledDepositsNearPickup()`
  - For each: resolve renter's payment method, call `placeDepositHold()`
  - On success: update `depositHoldStatus: 'held'`, store authId
  - On failure: update `depositHoldStatus: 'failed'`, notify renter + owner once
  - Log counts: `{ eligible, processed, succeeded, failed }`
  - Return JSON response with counts
  - Batch limit: 20 per run
  - _Requirements: 5b.1, 5b.2, 5b.3, 5b.4, 5b.5, 5b.6_

- [ ] 28. Create payout processing cron
  - Create `src/app/api/cron/process-payouts/route.ts`
  - Follow same cron pattern (CRON_SECRET, withRequestLogging, tryCatch)
  - Query eligible rentals via `PaymentLifecycleDAL.findEligibleForPayout()`
  - For each eligible rental:
    1. Call `claimForProcessing()` — skip if claim fails
    2. If `depositHoldStatus === 'held'`: call `releaseDepositHold()`, update status
    3. If `ownerTransferStatus === 'pending'`: call `createOwnerTransfer()`, update status
    4. On all success: set `payoutStatus: 'completed'`
    5. On any failure: set `payoutStatus: 'failed'`, call `sendOpsAlert()`
  - Each rental processed independently (one failure doesn't block others)
  - Log counts: `{ eligible, processed, succeeded, failed }`
  - Return JSON response with counts
  - Batch limit: 20 per run
  - _Requirements: 5c.1, 5c.2, 5c.3, 5c.4, 5c.5, 5c.6, 5c.7, 5c.8, 5c.9, 5c.10_

- [ ] 29. Create deposit expiry monitoring cron
  - Create `src/app/api/cron/monitor-deposit-expiry/route.ts`
  - Follow same cron pattern (CRON_SECRET, withRequestLogging, tryCatch)
  - Query at-risk deposits via `PaymentLifecycleDAL.findExpiringDeposits(6)` (held > 6 days)
  - For each: call `stripe.paymentIntents.retrieve()` to check actual status
  - If PI status is `'canceled'`: set `depositHoldStatus: 'expired'`
  - Alert ops for each expiration via `sendOpsAlert()` — NO user notification
  - Log counts: `{ checked, expired }`
  - Return JSON response with counts
  - _Requirements: 5d.1, 5d.2, 5d.3, 5d.4, 5d.5_

- [ ] 30. Update Vercel Cron configuration
  - Update `vercel.json` to add 3 new cron entries:
    - `/api/cron/schedule-deposit-holds` at `0 * * * *`
    - `/api/cron/process-payouts` at `0 * * * *`
    - `/api/cron/monitor-deposit-expiry` at `0 * * * *`
  - Keep existing `cleanup-notifications` cron
  - _Requirements: 5a.1_

- [ ] 31. Configure `CRON_SECRET` environment variable
  - Ensure `CRON_SECRET` is documented in `.env.example`
  - Verify all cron endpoints use the same `CRON_SECRET` verification pattern
  - Document that `CRON_SECRET` must be configured in all Vercel environments
  - _Requirements: 5a.2, 5a.3_

### Phase 7: Webhook Handler Extensions

- [ ] 32. Add `payment_intent.succeeded` handler
  - In `src/app/api/stripe/webhooks/route.ts`:
  - Add case for `payment_intent.succeeded`
  - Look up payment record by `stripePaymentIntentId`
  - If found and status is not already `'succeeded'`: update `status: 'succeeded'`, set `paidAt`
  - If already `'succeeded'`: no-op (idempotent)
  - Create audit log entry
  - _Requirements: 6.1, 6.7_

- [ ] 33. Add `payment_intent.payment_failed` handler
  - In `src/app/api/stripe/webhooks/route.ts`:
  - Add case for `payment_intent.payment_failed`
  - Look up payment record by `stripePaymentIntentId`
  - If found: update `status: 'failed'`
  - Send notification to renter about payment failure
  - Create audit log entry
  - _Requirements: 6.2_

- [ ] 34. Add `payment_intent.canceled` handler
  - In `src/app/api/stripe/webhooks/route.ts`:
  - Add case for `payment_intent.canceled`
  - Check PI metadata for `paymentType: 'security_deposit_hold'`
  - If deposit hold: look up lifecycle by rental, check if `depositHoldStatus !== 'released'`
    - If not intentionally released: set `depositHoldStatus: 'expired'`, call `sendOpsAlert()`
    - If already released: no-op
  - _Requirements: 6.3_

- [ ] 35. Add `transfer.reversed` handler
  - In `src/app/api/stripe/webhooks/route.ts`:
  - Add case for `transfer.reversed`
  - Look up lifecycle record by Stripe Transfer ID
  - Set `ownerTransferStatus: 'failed'`
  - Call `sendOpsAlert()` with transfer details
  - Do NOT automatically retry
  - _Requirements: 6.4_

- [ ] 36. Update Stripe webhook endpoint configuration
  - Document that the Stripe Dashboard webhook endpoint must be updated to include new event types:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `payment_intent.canceled`
    - `transfer.reversed`
  - Add this to deployment notes / implementation notes
  - _Requirements: 6.5_

### Phase 8: Return Confirmation

- [ ] 37. Create return confirmation API endpoint (or server action)
  - Create `src/app/api/rentals/[id]/confirm-return/route.ts` (or server action per existing pattern)
  - Authenticate owner
  - Verify the authenticated user is the rental's owner
  - Check `returnConfirmedAt` is not already set (idempotent — reject duplicates)
  - Set `returnConfirmedAt = now` on the rental record
  - Set `rental_requests.status = 'completed'`
  - Create audit log entry with owner's user ID and timestamp
  - Send notification to renter: return acknowledged
  - Note: NO payout or deposit operations triggered here — cron handles those
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

### Phase 9: Deposit Hold Failure Recovery

- [ ] 38. Add deposit status reset on payment method update
  - Locate the existing attach-payment-method or set-default-payment-method API route
  - After successfully updating the payment method:
    - Call `PaymentLifecycleDAL.findFailedDepositsForRenter(renterId)`
    - For each failed deposit where `startDate > now`: reset `depositHoldStatus` to `'scheduled'`
  - This allows the next cron run to retry the hold with the new payment method
  - _Requirements: 11.3, 11.4, 11.5_

- [ ] 39. Handle second deposit hold failure
  - In the deposit scheduling cron (task 27), when a hold fails:
  - Check if this is a re-attempt (renter previously notified — can check if there's a prior failure notification or metadata)
  - If second failure: additionally call `sendOpsAlert()` to escalate
  - Renter and owner still receive one notification per failure
  - _Requirements: 11.6_

### Phase 10: Retry Logic for Transient Stripe Errors

- [ ] 40. Add retry logic for retryable Stripe errors
  - In the rental charge flow and deposit hold flow:
  - Wrap Stripe calls with retry logic:
    - Check `isRetryablePaymentError()` (existing utility)
    - If retryable: wait 1 second, retry once
    - If second attempt fails: proceed to failure handling
  - Apply to: `chargeRentalPayment()`, `placeDepositHold()`
  - Do NOT apply retry to owner transfer or deposit release (failures are ops-escalated)
  - _Requirements: 1.8_

### Phase 11: Environment and Configuration

- [ ] 41. Update environment variables
  - Add to `.env.example`:
    - `OPS_ALERT_EMAIL` — email address for ops alerts
    - `CRON_SECRET` — secret for cron endpoint authentication (if not already present)
  - Verify `STRIPE_WEBHOOK_SECRET` is already documented
  - _Requirements: 5a.2, 10.5_

### Phase 12: Testing

- [ ] 42. Write unit tests for PaymentLifecycleDAL
  - Create `src/dal/__tests__/payment-lifecycle.dal.test.ts`
  - Test lifecycle record creation with all deposit status variants
  - Test `claimForProcessing()` atomic lock behavior
  - Test `findEligibleForPayout()` query filters (completed, >24hrs, pending, no disputes)
  - Test `findScheduledDepositsNearPickup()` query (scheduled, within 48hrs)
  - Test `findExpiringDeposits()` query (held > N days)
  - Test `findFailedDepositsForRenter()` query
  - Test all status update methods
  - Mock database calls appropriately
  - _Requirements: All DAL requirements_

- [ ] 43. Write unit tests for DepositHoldService
  - Create `src/services/stripe/__tests__/deposit-hold.test.ts`
  - Mock Stripe API calls
  - Test `placeDepositHold()` success path — verify correct PaymentIntent params
  - Test `placeDepositHold()` failure path — verify error returned
  - Test idempotency key format: `deposit-hold-{rentalId}`
  - Test `releaseDepositHold()` calls `paymentIntents.cancel()`
  - Test metadata includes `paymentType: 'security_deposit_hold'`
  - _Requirements: 2.3, 2.4, 2.8, 3.1_

- [ ] 44. Write unit tests for PayoutService
  - Create `src/services/stripe/__tests__/payout.test.ts`
  - Mock Stripe API calls
  - Test `createOwnerTransfer()` success path — verify transfer params
  - Test fee calculation: `totalAmount * platformFeePercentage` deducted correctly
  - Test transfer amount is in cents
  - Test idempotency key format: `transfer-owner-{rentalId}`
  - Test `source_transaction` is the Charge ID (not PaymentIntent ID)
  - Test failure path returns error
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 45. Write unit tests for modified `chargeRentalPayment()`
  - Update existing tests in `src/services/stripe/__tests__/rental-payments.test.ts` (or create if missing)
  - Verify NO `transfer_data` in PaymentIntent params
  - Verify NO `application_fee_amount` in PaymentIntent params
  - Verify `idempotencyKey` is passed to Stripe
  - Verify `paymentType: 'rental_charge'` in metadata
  - _Requirements: 1.1, 1.2, 1.9_

- [ ] 46. Write unit tests for ops alerting
  - Create `src/features/notifications/lib/__tests__/ops-alerts.test.ts`
  - Test `sendOpsAlert()` logs with structured format (`alertType: "ops"`)
  - Test email is sent when `OPS_ALERT_EMAIL` is configured
  - Test email is NOT sent when `OPS_ALERT_EMAIL` is not configured
  - Test alert params (event, rentalId, message, metadata) are included
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 47. Write integration tests for rental approval flow
  - Test full approval: charge → lifecycle record → scheduled deposit (start > 48hrs)
  - Test approval with immediate deposit (start <= 48hrs)
  - Test approval with zero deposit (not_applicable)
  - Test approval with payment failure → rental not approved
  - Test retryable error → retry once → succeed
  - Test retryable error → retry once → fail
  - Verify no `transfer_data` on Stripe calls
  - Verify lifecycle record created with correct initial state
  - _Requirements: 1.1–1.9, 2.1, 2.2, 8.2, 8.3, 8.4_

- [ ] 48. Write integration tests for cron endpoints
  - Test deposit scheduling cron: picks up scheduled deposits, places holds, handles failures
  - Test payout cron: releases deposits, creates transfers, handles partial failures
  - Test deposit expiry cron: detects expired holds, alerts ops
  - Test CRON_SECRET verification (reject unauthorized requests)
  - Test atomic claim prevents double-processing
  - Test batch limits (max 20 per run)
  - _Requirements: 5b, 5c, 5d, 7.4, 7.5_

- [ ] 49. Write integration tests for webhook handlers
  - Test `payment_intent.succeeded` updates payment status
  - Test `payment_intent.payment_failed` updates status and notifies
  - Test `payment_intent.canceled` for deposit hold expiry detection
  - Test `transfer.reversed` updates transfer status and alerts ops
  - Test idempotent handling (duplicate webhook is no-op)
  - Test signature verification rejects invalid signatures
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

- [ ] 50. Write integration tests for deposit failure recovery
  - Test: deposit fails → `depositHoldStatus: 'failed'`
  - Test: renter updates PM → status reset to `'scheduled'`
  - Test: cron picks up reset deposit and retries
  - Test: second failure → ops alert escalation
  - Test: cron does NOT process deposits with `'failed'` status
  - Test: PM update does NOT reset deposit if rental already started
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

### Phase 13: Final Verification

- [ ] 51. Run linting and type checking
  - Run `bun run lint` and fix any issues
  - Run `bun run type-check` and fix any type errors
  - Ensure all new files follow existing code style
  - _Requirements: Code quality_

- [ ] 52. Verify all imports and exports
  - Check all new files have correct imports
  - Verify all exports are used and accessible
  - Remove unused imports
  - Ensure no circular dependencies
  - _Requirements: Code quality_

- [ ] 53. Verify Stripe Dashboard configuration
  - Document that the Stripe webhook endpoint must include new event types
  - Document that `CRON_SECRET` must be set in Vercel
  - Document that `OPS_ALERT_EMAIL` must be set in Vercel
  - Verify Vercel plan supports hourly cron (Pro required)
  - _Requirements: Deployment readiness_

---

_Last updated: March 12, 2026 | Internal use only_
