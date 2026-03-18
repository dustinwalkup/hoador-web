# Stripe Connect Payment Lifecycle (Phase 1) - Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/payments/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Rental Payment Capture (Platform-Hold Model)

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 1

**Test Coverage**:

- Unit tests: `chargeRentalPayment()` creates PaymentIntent with NO `transfer_data`
- Unit tests: `chargeRentalPayment()` creates PaymentIntent with NO `application_fee_amount`
- Unit tests: `chargeRentalPayment()` passes idempotency key to Stripe
- Unit tests: `chargeRentalPayment()` sets correct metadata (`paymentType: 'rental_charge'`)
- Unit tests: Charge amount equals rental price + service fee (deposit excluded)
- Unit tests: Retry logic retries once on retryable Stripe errors
- Unit tests: Retry logic does not retry on non-retryable errors (StripeCardError)
- Integration tests: Approval flow creates PaymentIntent without destination charges
- Integration tests: Successful charge stores PaymentIntent ID on rental
- Integration tests: Successful charge creates payment record with `paymentType: 'rental_charge'`
- Integration tests: Failed charge sets `paymentStatus: 'failed'` on rental request
- Integration tests: Failed charge does NOT approve rental
- Integration tests: Failed charge notifies renter and owner
- Integration tests: Idempotency key format is `rental-charge-{rentalRequestId}`

### Requirement 2: Security Deposit Authorization Hold

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 2

**Test Coverage**:

- Unit tests: `placeDepositHold()` creates PaymentIntent with `capture_method: 'manual'`
- Unit tests: `placeDepositHold()` sets `off_session: true`, `confirm: true`
- Unit tests: `placeDepositHold()` includes correct metadata (`paymentType: 'security_deposit_hold'`)
- Unit tests: `placeDepositHold()` uses idempotency key `deposit-hold-{rentalId}`
- Unit tests: `placeDepositHold()` returns `{ success: true, paymentIntentId }` on success
- Unit tests: `placeDepositHold()` returns `{ success: false, error }` on failure
- Integration tests: Rental approved with start > 48hrs → `depositHoldStatus: 'scheduled'`
- Integration tests: Rental approved with start ≤ 48hrs → hold placed immediately
- Integration tests: Immediate hold success → `depositHoldStatus: 'held'`, authId stored
- Integration tests: Immediate hold failure → `depositHoldStatus: 'failed'`, rental still approved
- Integration tests: Hold failure notifies renter and owner once
- Integration tests: Rental with zero deposit → `depositHoldStatus: 'not_applicable'`

### Requirement 3: Security Deposit Release

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 3

**Test Coverage**:

- Unit tests: `releaseDepositHold()` calls `stripe.paymentIntents.cancel()`
- Integration tests: Payout cron releases hold when `depositHoldStatus: 'held'`
- Integration tests: Successful release sets `depositHoldStatus: 'released'`, `depositReleasedAt`
- Integration tests: Failed release sets `depositHoldStatus: 'release_failed'`, alerts ops
- Integration tests: Release skipped when `depositHoldStatus` is NOT `'held'` (expired, not_applicable, etc.)
- Integration tests: Release skipped when open dispute exists
- Integration tests: Expired deposit (`depositHoldStatus: 'expired'`) → skip release, proceed to transfer

### Requirement 4: Owner Payout via Manual Transfer

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: `createOwnerTransfer()` calls `stripe.transfers.create()` with correct params
- Unit tests: Transfer amount = rental charge - platform fee (in cents)
- Unit tests: Platform fee = `totalAmount * PLATFORM_FEE_PERCENTAGE` (20%)
- Unit tests: Transfer uses `source_transaction` (Charge ID, not PaymentIntent ID)
- Unit tests: Transfer uses idempotency key `transfer-owner-{rentalId}`
- Unit tests: Transfer includes metadata: `rentalId`, `rentalRequestId`, `ownerId`
- Unit tests: Returns `{ success: true, transferId }` on success
- Unit tests: Returns `{ success: false, error }` on failure
- Integration tests: Payout cron creates transfer when eligible (completed, >24hrs, pending)
- Integration tests: Successful transfer sets `ownerTransferStatus: 'completed'`, stores `stripeTransferId`
- Integration tests: Failed transfer sets `ownerTransferStatus: 'failed'`, alerts ops, NO retry
- Integration tests: Transfer skipped when `ownerTransferStatus` is NOT `'pending'`
- Integration tests: Transfer skipped when open dispute exists → `ownerTransferStatus: 'frozen'`
- Integration tests: No transfer at approval time (funds held in platform)

### Requirement 5: Cron Infrastructure

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 5

**Test Coverage**:

#### 5a: Vercel Cron Setup

- Integration tests: All cron endpoints reject requests without valid `CRON_SECRET`
- Integration tests: All cron endpoints accept requests with valid `CRON_SECRET`
- Configuration tests: `vercel.json` contains all 4 cron entries with correct schedules

#### 5b: Deposit Hold Scheduling Cron

- Integration tests: Cron queries rentals with `depositHoldStatus: 'scheduled'` and `startDate` within 48hrs
- Integration tests: Cron does NOT query `depositHoldStatus: 'failed'` rentals
- Integration tests: Cron places deposit hold for each eligible rental
- Integration tests: Cron updates status to `'held'` on success, `'failed'` on failure
- Integration tests: Cron notifies renter + owner on failure (once)
- Integration tests: Cron processes max 20 rentals per run
- Integration tests: Cron logs counts (eligible, succeeded, failed)
- Integration tests: Cron returns success with `processedCount: 0` when no eligible rentals

#### 5c: Payout Processing Cron

- Integration tests: Cron queries eligible rentals (completed, >24hrs, pending, no disputes)
- Integration tests: Cron claims rental with atomic `UPDATE WHERE payoutStatus = 'pending'`
- Integration tests: Cron releases deposit then creates transfer (in order)
- Integration tests: Cron sets `payoutStatus: 'completed'` when all operations succeed
- Integration tests: Cron sets `payoutStatus: 'failed'` on any operation failure
- Integration tests: Failed rental does not block other rentals
- Integration tests: Cron processes max 20 rentals per run
- Integration tests: Cron logs counts (eligible, processed, succeeded, failed)
- Integration tests: Cron returns success with `processedCount: 0` when no eligible rentals

#### 5d: Deposit Expiry Monitoring Cron

- Integration tests: Cron queries deposits held > 6 days
- Integration tests: Cron retrieves PaymentIntent from Stripe to check actual status
- Integration tests: Expired PI (status `'canceled'`) → sets `depositHoldStatus: 'expired'`
- Integration tests: Non-expired PI → no status change
- Integration tests: Expiration alerts ops (internal only, NO user notification)
- Integration tests: Cron logs all detected expirations

### Requirement 6: Webhook Infrastructure (Phase 1 Events)

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 6

**Test Coverage**:

- Integration tests: `payment_intent.succeeded` updates payment `status: 'succeeded'`, sets `paidAt`
- Integration tests: `payment_intent.succeeded` is idempotent (already succeeded → no-op)
- Integration tests: `payment_intent.payment_failed` updates payment `status: 'failed'`
- Integration tests: `payment_intent.payment_failed` notifies renter
- Integration tests: `payment_intent.canceled` for deposit hold detects unintentional expiry
- Integration tests: `payment_intent.canceled` for intentional release → no-op
- Integration tests: `payment_intent.canceled` sets `depositHoldStatus: 'expired'`, alerts ops
- Integration tests: `transfer.reversed` sets `ownerTransferStatus: 'failed'`, alerts ops
- Integration tests: `transfer.reversed` does NOT auto-retry
- Integration tests: All webhook handlers return HTTP 200 on success
- Integration tests: Duplicate webhook events are handled idempotently (no duplicate state changes)
- Integration tests: Invalid Stripe signatures are rejected
- Integration tests: New event types coexist with existing `account.updated` / `account.closed` handlers

### Requirement 7: Idempotency Protection

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 7

**Test Coverage**:

- Unit tests: Idempotency key format for rental charge: `rental-charge-{rentalRequestId}`
- Unit tests: Idempotency key format for deposit hold: `deposit-hold-{rentalId}`
- Unit tests: Idempotency key format for owner transfer: `transfer-owner-{rentalId}`
- Integration tests: DB status gates prevent duplicate Stripe calls (status not in expected pre-op state → skip)
- Integration tests: Atomic `claimForProcessing` prevents concurrent processing of same rental
- Integration tests: Two concurrent cron runs do not process the same rental twice
- Integration tests: Webhook replay does not create duplicate state changes

### Requirement 8: Payment Lifecycle Data Model

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: `PaymentLifecycleDAL.create()` with all deposit status variants
- Unit tests: `PaymentLifecycleDAL.getByRentalId()` returns record or null
- Unit tests: All status update methods update `updatedAt`
- Integration tests: Lifecycle record created at approval with correct initial state
- Integration tests: `rentalChargeId` stored from `paymentIntent.latest_charge`
- Integration tests: `returnConfirmedAt` set on rental at return confirmation
- Integration tests: `paymentType` column defaults to `'rental_charge'` for existing records
- Integration tests: New payment records store correct `paymentType`
- Schema tests: `rental_payment_lifecycle` table has unique index on `rentalId`
- Schema tests: Indexes exist on `payoutStatus`, `depositHoldStatus`, `returnConfirmedAt`
- Migration tests: Migration is additive and backward-compatible (no destructive changes)

### Requirement 9: Return Confirmation Trigger

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 9

**Test Coverage**:

- Integration tests: Owner confirms return → `returnConfirmedAt` set on rental
- Integration tests: Owner confirms return → `rental_requests.status` set to `'completed'`
- Integration tests: Return confirmation does NOT trigger payout or deposit operations
- Integration tests: Duplicate return confirmation is rejected (idempotent)
- Integration tests: Non-owner cannot confirm return (403)
- Integration tests: Audit log created with owner user ID and timestamp
- Integration tests: Renter notified that return is acknowledged

### Requirement 10: Operations Alerting Channel

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 10

**Test Coverage**:

- Unit tests: `sendOpsAlert()` logs with `alertType: 'ops'` structured format
- Unit tests: `sendOpsAlert()` sends email when `OPS_ALERT_EMAIL` is configured
- Unit tests: `sendOpsAlert()` does NOT send email when `OPS_ALERT_EMAIL` is not set
- Unit tests: Alert includes rental ID, event type, error message, timestamp
- Integration tests: Deposit hold failure triggers ops alert
- Integration tests: Deposit expiry triggers ops alert
- Integration tests: Deposit release failure triggers ops alert
- Integration tests: Owner transfer failure triggers ops alert
- Integration tests: Cron processing error triggers ops alert
- Integration tests: Ops alerts are NOT sent to renters or owners

### Requirement 11: Deposit Hold Failure Recovery

**Requirement Reference**: `specs/payments/1-requirements.md` - Requirement 11

**Test Coverage**:

- Integration tests: Failed hold notifies renter once with instructions to update payment method
- Integration tests: Failed hold notifies owner once that deposit protection is not in place
- Integration tests: Cron does NOT process `depositHoldStatus: 'failed'` (status gate)
- Integration tests: Cron does NOT re-notify while `depositHoldStatus` is `'failed'`
- Integration tests: `POST /api/rentals/[id]/retry-deposit` places hold immediately using renter's current payment method
- Integration tests: Retry rejected if `depositHoldStatus` is not `'failed'`
- Integration tests: Retry rejected if rental `startDate` has already passed
- Integration tests: Successful retry sets `depositHoldStatus: 'held'` and `depositHoldPlacedAt`
- Integration tests: Failed retry returns error to caller; `depositHoldStatus` remains `'failed'`; no additional notifications sent
- E2E tests: Complete failure recovery flow (fail → update payment method → click retry → success)

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and services in isolation.

**Framework**: Vitest

**Coverage Goals**: 85%+ for business logic (DAL, services), 100% for fee calculations

**Areas to Test**:

- **PaymentLifecycleDAL**: Mock database, test all CRUD operations and queries
- **DepositHoldService**: Mock Stripe, test hold placement and release
- **PayoutService**: Mock Stripe, test transfer creation and fee calculation
- **chargeRentalPayment()**: Mock Stripe, test parameter correctness (no transfer_data)
- **sendOpsAlert()**: Mock logger and email, test dual-channel alerting
- **Fee calculations**: Test platform fee deduction matches `PLATFORM_FEE_PERCENTAGE`
- **Idempotency keys**: Test deterministic key generation for all operations

**Test Structure** (AAA Pattern):

```typescript
describe("PayoutService", () => {
  describe("createOwnerTransfer", () => {
    it("should create transfer with correct amount after platform fee deduction", async () => {
      // Arrange
      const mockStripe = vi.mocked(stripe.transfers.create);
      mockStripe.mockResolvedValue({ id: "tr_123" } as Stripe.Transfer);

      // Act
      const result = await createOwnerTransfer({
        rentalId: "rental-1",
        rentalRequestId: "req-1",
        ownerId: "owner-1",
        ownerConnectedAccountId: "acct_123",
        rentalChargeId: "ch_abc",
        totalAmount: 100.0,
        platformFeePercentage: 0.2,
      });

      // Assert
      expect(result).toEqual({ success: true, transferId: "tr_123" });
      expect(mockStripe).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8000, // $100 - 20% = $80 = 8000 cents
          destination: "acct_123",
          source_transaction: "ch_abc",
        }),
        { idempotencyKey: "transfer-owner-rental-1" },
      );
    });
  });
});
```

### Integration Tests

**Purpose**: Test component interactions and data flow between layers.

**Framework**: Vitest with mocked DAL and Stripe

**Coverage Goals**: All critical financial flows, 80%+ for integration points

**Areas to Test**:

- **Approval Flow → Charge → Lifecycle Record → Deposit Scheduling**: Full approval pipeline
- **Cron → DAL Query → Stripe Call → Status Update**: Each cron endpoint end-to-end
- **Webhook → DB Lookup → Status Update**: Each webhook event type
- **Return Confirmation → Status Update → Cron Eligibility**: Return-to-payout pipeline
- **PM Update → Status Reset → Cron Retry → Hold**: Deposit failure recovery pipeline
- **Concurrency**: Atomic claim prevents double-processing
- **Error Propagation**: Failures set correct statuses and trigger alerts

**Test Structure**:

```typescript
describe("POST /api/cron/process-payouts", () => {
  it("should release deposit and create transfer for eligible rental", async () => {
    // Arrange
    const mockAuth = mockCronSecret();
    const mockEligible = [
      {
        rentalId: "rental-1",
        depositHoldStatus: "held",
        ownerTransferStatus: "pending",
        securityDepositAuthId: "pi_dep_123",
        rentalChargeId: "ch_abc",
        ownerConnectedAccountId: "acct_123",
        totalAmount: 100.0,
      },
    ];
    vi.spyOn(
      PaymentLifecycleDAL.prototype,
      "findEligibleForPayout",
    ).mockResolvedValue(mockEligible);
    vi.spyOn(
      PaymentLifecycleDAL.prototype,
      "claimForProcessing",
    ).mockResolvedValue(true);

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.successCount).toBe(1);
    expect(releaseDepositHold).toHaveBeenCalledWith("pi_dep_123");
    expect(createOwnerTransfer).toHaveBeenCalled();
  });
});
```

### End-to-End (E2E) Tests

**Purpose**: Test complete user workflows from UI to database.

**Framework**: Playwright (to be configured) or Vitest with full stack

**Coverage Goals**: All critical financial paths, happy paths + major failure paths

## Test Scenarios by Component

### PaymentLifecycleDAL Tests

**File**: `src/dal/__tests__/payment-lifecycle.dal.test.ts`

**Test Cases**:

1. `create()` - Creates lifecycle record with `depositHoldStatus: 'scheduled'`
2. `create()` - Creates lifecycle record with `depositHoldStatus: 'held'`
3. `create()` - Creates lifecycle record with `depositHoldStatus: 'not_applicable'`
4. `create()` - Stores `rentalChargeId` correctly
5. `getByRentalId()` - Returns lifecycle record for existing rental
6. `getByRentalId()` - Returns null for non-existent rental
7. `claimForProcessing()` - Returns true when status is `'pending'`
8. `claimForProcessing()` - Returns false when status is NOT `'pending'` (already claimed)
9. `claimForProcessing()` - Sets `payoutStatus: 'processing'` atomically
10. `updateDepositHoldStatus()` - Updates status and timestamps
11. `updateOwnerTransferStatus()` - Updates status and stores transfer ID
12. `updatePayoutStatus()` - Updates payout status
13. `findEligibleForPayout()` - Returns rentals: completed, >24hrs, pending, no disputes
14. `findEligibleForPayout()` - Excludes rentals with open disputes
15. `findEligibleForPayout()` - Excludes rentals without `returnConfirmedAt`
16. `findEligibleForPayout()` - Excludes rentals where `returnConfirmedAt` < 24hrs ago
17. `findEligibleForPayout()` - Excludes rentals with `payoutStatus` != `'pending'`
18. `findEligibleForPayout()` - Respects batch limit
19. `findEligibleForPayout()` - Orders by `returnConfirmedAt` ASC
20. `findScheduledDepositsNearPickup()` - Returns rentals with `'scheduled'` status within 48hrs
21. `findScheduledDepositsNearPickup()` - Excludes `'failed'` deposits
22. `findScheduledDepositsNearPickup()` - Excludes past-start-date rentals
23. `findScheduledDepositsNearPickup()` - Respects batch limit
24. `findExpiringDeposits()` - Returns deposits held > N days
25. `findExpiringDeposits()` - Only returns `'held'` status deposits
26. `findFailedDepositsForRenter()` - Returns failed deposits for renter
27. `findFailedDepositsForRenter()` - Excludes deposits where `startDate` has passed

### DepositHoldService Tests

**File**: `src/services/stripe/__tests__/deposit-hold.test.ts`

**Test Cases**:

1. `placeDepositHold()` - Creates PaymentIntent with `capture_method: 'manual'`
2. `placeDepositHold()` - Sets `off_session: true`, `confirm: true`, `currency: 'usd'`
3. `placeDepositHold()` - Attaches customer and payment method
4. `placeDepositHold()` - Includes metadata: `paymentType`, `rentalId`, `listingId`, `renterId`
5. `placeDepositHold()` - Uses idempotency key: `deposit-hold-{rentalId}`
6. `placeDepositHold()` - Returns `{ success: true, paymentIntentId }` on success
7. `placeDepositHold()` - Returns `{ success: false, error }` on StripeCardError
8. `placeDepositHold()` - Returns `{ success: false, error }` on other Stripe errors
9. `releaseDepositHold()` - Calls `stripe.paymentIntents.cancel()` with correct PI ID
10. `releaseDepositHold()` - Succeeds when PI is `'requires_capture'`
11. `releaseDepositHold()` - Throws on Stripe API failure

### PayoutService Tests

**File**: `src/services/stripe/__tests__/payout.test.ts`

**Test Cases**:

1. `createOwnerTransfer()` - Calls `stripe.transfers.create()` with correct params
2. `createOwnerTransfer()` - Sets `source_transaction` to Charge ID (not PI ID)
3. `createOwnerTransfer()` - Sets `destination` to owner's Connected Account ID
4. `createOwnerTransfer()` - Calculates transfer amount: `totalAmount - platformFee` in cents
5. `createOwnerTransfer()` - Platform fee = `Math.round(totalAmount * 0.2 * 100)` cents
6. `createOwnerTransfer()` - Transfer amount = `Math.round(totalAmount * 100) - platformFeeCents`
7. `createOwnerTransfer()` - Uses idempotency key: `transfer-owner-{rentalId}`
8. `createOwnerTransfer()` - Includes metadata: `rentalId`, `rentalRequestId`, `ownerId`
9. `createOwnerTransfer()` - Returns `{ success: true, transferId }` on success
10. `createOwnerTransfer()` - Returns `{ success: false, error }` on Stripe failure
11. `createOwnerTransfer()` - Handles edge case: `$0.01` transfer (minimum)
12. `createOwnerTransfer()` - Handles rounding correctly for fractional cents

### Modified chargeRentalPayment() Tests

**File**: `src/services/stripe/__tests__/rental-payments.test.ts`

**Test Cases**:

1. Creates PaymentIntent with NO `transfer_data` property
2. Creates PaymentIntent with NO `application_fee_amount` property
3. Creates PaymentIntent with `off_session: true`, `confirm: true`, `currency: 'usd'`
4. Passes `idempotencyKey` to Stripe API options
5. Sets `paymentType: 'rental_charge'` in metadata
6. Sets `rentalRequestId`, `listingId`, `ownerId`, `renterId`, `listingName` in metadata
7. Calculates amount correctly (rental price + service fee, no deposit)
8. Returns PaymentIntent on success
9. Throws on Stripe API failure
10. Retries once on `StripeRateLimitError` after 1s delay
11. Retries once on `StripeAPIError` after 1s delay
12. Does NOT retry on `StripeCardError`
13. Fails after one retry attempt (does not retry infinitely)

### Ops Alerting Tests

**File**: `src/features/notifications/lib/__tests__/ops-alerts.test.ts`

**Test Cases**:

1. `sendOpsAlert()` - Logs with `getLogger().error()` with `alertType: 'ops'`
2. `sendOpsAlert()` - Includes `event`, `rentalId`, `metadata` in structured log
3. `sendOpsAlert()` - Sends email when `OPS_ALERT_EMAIL` is configured
4. `sendOpsAlert()` - Email subject includes event type and rental ID
5. `sendOpsAlert()` - Does NOT send email when `OPS_ALERT_EMAIL` is undefined
6. `sendOpsAlert()` - Does NOT throw if email sending fails (graceful degradation)

### Cron Endpoint Tests

#### Deposit Hold Scheduling Cron

**File**: `src/app/api/cron/schedule-deposit-holds/__tests__/route.test.ts`

**Test Cases**:

1. Rejects request without `CRON_SECRET` (401)
2. Returns success with `processedCount: 0` when no eligible rentals
3. Places deposit hold for eligible rental within 48hrs of pickup
4. Updates `depositHoldStatus: 'held'` on success
5. Stores `securityDepositAuthId` on rental on success
6. Updates `depositHoldStatus: 'failed'` on hold failure
7. Notifies renter and owner on hold failure
8. Does NOT process `depositHoldStatus: 'failed'` rentals (status gate)
9. Processes max 20 rentals per batch
10. Returns JSON with `{ processedCount, successCount, failureCount }`
11. Continues processing other rentals when one fails
12. Logs counts for each execution

#### Payout Processing Cron

**File**: `src/app/api/cron/process-payouts/__tests__/route.test.ts`

**Test Cases**:

1. Rejects request without `CRON_SECRET` (401)
2. Returns success with `processedCount: 0` when no eligible rentals
3. Claims rental with atomic lock before processing
4. Skips rental when claim fails (already processing)
5. Releases deposit hold when `depositHoldStatus: 'held'`
6. Skips deposit release when `depositHoldStatus` is NOT `'held'`
7. Creates owner transfer when `ownerTransferStatus: 'pending'`
8. Skips transfer when `ownerTransferStatus` is NOT `'pending'`
9. Sets `payoutStatus: 'completed'` when all operations succeed
10. Sets `payoutStatus: 'failed'` when deposit release fails
11. Sets `payoutStatus: 'failed'` when transfer fails
12. Alerts ops on any failure
13. Processes each rental independently (one failure doesn't block others)
14. Processes max 20 rentals per batch
15. Returns JSON with `{ processedCount, successCount, failureCount }`
16. Handles rental with no deposit (not_applicable) — skips release, creates transfer

#### Deposit Expiry Monitoring Cron

**File**: `src/app/api/cron/monitor-deposit-expiry/__tests__/route.test.ts`

**Test Cases**:

1. Rejects request without `CRON_SECRET` (401)
2. Returns success with `checkedCount: 0` when no at-risk deposits
3. Retrieves PaymentIntent from Stripe to check actual status
4. Sets `depositHoldStatus: 'expired'` when PI status is `'canceled'`
5. Does NOT change status when PI is still active (`'requires_capture'`)
6. Alerts ops for each detected expiration
7. Does NOT notify renter or owner on expiration
8. Does NOT change rental status on expiration
9. Returns JSON with `{ checkedCount, expiredCount }`

### Webhook Handler Tests

**File**: `src/app/api/stripe/webhooks/__tests__/route.test.ts`

**Test Cases**:

1. `payment_intent.succeeded` - Updates payment status to `'succeeded'`
2. `payment_intent.succeeded` - Sets `paidAt` timestamp
3. `payment_intent.succeeded` - No-op if already `'succeeded'` (idempotent)
4. `payment_intent.succeeded` - Returns 200 for unknown PI (no matching record)
5. `payment_intent.payment_failed` - Updates payment status to `'failed'`
6. `payment_intent.payment_failed` - Sends notification to renter
7. `payment_intent.canceled` - Detects deposit hold expiry (metadata: `security_deposit_hold`)
8. `payment_intent.canceled` - Sets `depositHoldStatus: 'expired'` for unintentional cancel
9. `payment_intent.canceled` - No-op for intentional release (`depositHoldStatus: 'released'`)
10. `payment_intent.canceled` - Alerts ops for unintentional expiry
11. `transfer.reversed` - Sets `ownerTransferStatus: 'failed'`
12. `transfer.reversed` - Alerts ops
13. `transfer.reversed` - Does NOT auto-retry
14. All handlers - Return HTTP 200 on success
15. All handlers - Return HTTP 500 only on unrecoverable errors
16. Signature verification - Rejects invalid signatures
17. Existing handlers - `account.updated` and `account.closed` still work

### Return Confirmation Tests

**File**: `src/app/api/rentals/[id]/confirm-return/__tests__/route.test.ts`

**Test Cases**:

1. Owner confirms return → `returnConfirmedAt` set on rental
2. Owner confirms return → `rental_requests.status` set to `'completed'`
3. Non-owner cannot confirm return (403)
4. Unauthenticated user cannot confirm return (401)
5. Duplicate confirmation rejected (already confirmed, 400)
6. No payout or deposit operations triggered at confirmation time
7. Audit log created with owner ID and timestamp
8. Renter notified that return is acknowledged

### Deposit Failure Recovery Tests

**File**: `src/features/payments/__tests__/deposit-recovery.test.ts`

**Test Cases**:

1. Renter updates PM → failed deposits reset to `'scheduled'`
2. PM update only resets deposits where `startDate > now`
3. PM update does NOT reset deposits where rental already started
4. After reset, cron picks up and retries hold with new PM
5. Second failure sets `'failed'` again and notifies renter
6. Second failure escalates to ops via `sendOpsAlert()`
7. Cron does NOT process `'failed'` deposits (skips them)
8. Cron does NOT re-notify while status is `'failed'`

### Rental Approval Flow Integration Tests

**File**: `src/features/rentals/services/__tests__/rental-service.test.ts`

**Test Cases**:

1. Full approval: charge succeeds → lifecycle record created → rental approved
2. Approval with deposit (start > 48hrs): `depositHoldStatus: 'scheduled'`
3. Approval with deposit (start ≤ 48hrs): deposit held immediately
4. Approval with immediate deposit failure: rental still approved, status `'failed'`
5. Approval with zero deposit: `depositHoldStatus: 'not_applicable'`
6. Approval with charge failure: rental NOT approved, renter/owner notified
7. Approval stores `rentalChargeId` from `paymentIntent.latest_charge`
8. Approval creates payment record with `paymentType: 'rental_charge'`
9. No `trackActivity(ownerId, "payout_received")` at approval time
10. Idempotency key `rental-charge-{rentalRequestId}` passed to Stripe

## BDD Scenarios

### Feature: Rental Payment Capture

```gherkin
Feature: Rental Payment Capture (Platform-Hold)
  As the platform
  I want to capture rental payments without transferring to the owner
  So that funds are held until the rental completes cleanly

  Scenario: Successful rental payment capture
    Given a renter has a pending rental request for a listing at $100/day
    And the owner approves the rental request
    When the system charges the renter's payment method
    Then a Stripe PaymentIntent should be created for the rental amount + service fee
    And the PaymentIntent should NOT include transfer_data
    And the PaymentIntent should NOT include application_fee_amount
    And a payment record should be created with paymentType "rental_charge"
    And a lifecycle record should be created with payoutStatus "pending"
    And the rental should be approved

  Scenario: Payment capture failure — card declined
    Given a renter has a pending rental request
    And the renter's card will be declined
    When the owner approves the rental request
    Then the payment should fail with a card error
    And the rental should NOT be approved
    And the renter should receive a notification about the failure
    And the owner should receive a notification about the failure

  Scenario: Payment capture with retryable error
    Given a renter has a pending rental request
    And the Stripe API will return a rate limit error on the first attempt
    And the Stripe API will succeed on the second attempt
    When the owner approves the rental request
    Then the system should retry after 1 second
    And the payment should succeed on the second attempt
    And the rental should be approved
```

### Feature: Security Deposit Authorization Hold

```gherkin
Feature: Security Deposit Auth Hold
  As the platform
  I want to place authorization holds on security deposits
  So that deposit funds are reserved without charging the renter

  Scenario: Scheduled deposit hold (start > 48hrs)
    Given a rental is approved for a listing with $200 security deposit
    And the rental starts in 5 days
    Then the deposit hold should NOT be placed immediately
    And the lifecycle record should have depositHoldStatus "scheduled"
    And the cron should place the hold 48 hours before pickup

  Scenario: Immediate deposit hold (start ≤ 48hrs)
    Given a rental is approved for a listing with $200 security deposit
    And the rental starts in 24 hours
    Then the deposit hold should be placed immediately
    And the lifecycle record should have depositHoldStatus "held"
    And the securityDepositAuthId should be stored on the rental

  Scenario: Deposit hold failure — payment method declined
    Given a rental is approved for a listing with $200 security deposit
    And the rental starts in 24 hours
    And the renter's card will decline the auth hold
    When the system attempts to place the deposit hold
    Then the lifecycle record should have depositHoldStatus "failed"
    And the rental should still be approved (proceeds without protection)
    And the renter should receive one notification to update their payment method
    And the owner should receive one notification about missing deposit protection

  Scenario: No deposit required
    Given a rental is approved for a listing with $0 security deposit
    Then no deposit hold should be placed
    And the lifecycle record should have depositHoldStatus "not_applicable"
```

### Feature: Payout Processing

```gherkin
Feature: Owner Payout via Manual Transfer
  As a tool owner
  I want to receive my payout after the rental completes
  So that I am paid reliably after the dispute window closes

  Scenario: Successful payout after clean return
    Given a rental has returnConfirmedAt set to 25 hours ago
    And the rental has no open disputes
    And the lifecycle has payoutStatus "pending" and depositHoldStatus "held"
    When the payout cron runs
    Then the deposit hold should be released
    And an owner transfer should be created for the rental amount minus 20% platform fee
    And the payoutStatus should be "completed"
    And the ownerTransferStatus should be "completed"

  Scenario: Payout blocked by open dispute
    Given a rental has returnConfirmedAt set to 25 hours ago
    And the rental has an open dispute
    When the payout cron runs
    Then the rental should NOT be eligible for payout
    And the ownerTransferStatus should remain "pending"

  Scenario: Payout within 24-hour dispute window
    Given a rental has returnConfirmedAt set to 12 hours ago
    When the payout cron runs
    Then the rental should NOT be eligible for payout
    And no Stripe operations should be performed
```

### Feature: Deposit Hold Failure Recovery

```gherkin
Feature: Deposit Hold Failure Recovery
  As a renter
  I want to update my payment method to fix a failed deposit hold
  So that my rental has deposit protection

  Scenario: Successful recovery after payment method update
    Given a rental has depositHoldStatus "failed"
    And the rental starts in 3 days
    When the renter updates their payment method
    Then the depositHoldStatus should be reset to "scheduled"
    And the next cron run should attempt to place the hold
    And the hold should succeed with the new payment method

  Scenario: Cron does not re-process failed deposits
    Given a rental has depositHoldStatus "failed"
    When the deposit scheduling cron runs
    Then the rental should NOT be queried or processed
    And no notification should be sent to the renter

  Scenario: Second hold failure escalates to ops
    Given a rental had depositHoldStatus "failed"
    And the renter updated their payment method (status reset to "scheduled")
    And the new payment method will also be declined
    When the deposit scheduling cron places the hold
    Then the hold should fail
    And the depositHoldStatus should be "failed"
    And the renter should receive a notification
    And the operations team should receive an alert
```

## Performance Tests

### Performance Test Cases

1. **Rental Approval Performance**
   - Test: Payment capture completes within 10 seconds
   - Method: Measure API response time including Stripe call
   - Target: < 10 seconds (95th percentile)

2. **Cron Batch Performance**
   - Test: Payout cron processes 20 rentals within 60 seconds
   - Method: Measure cron execution time with 20 eligible rentals
   - Target: < 60 seconds (Vercel Pro function timeout)

3. **Deposit Scheduling Performance**
   - Test: Deposit scheduling cron processes 20 holds within 60 seconds
   - Method: Measure cron execution time with 20 eligible rentals
   - Target: < 60 seconds

4. **Webhook Processing Performance**
   - Test: Each webhook event processed and returns HTTP 200 within 5 seconds
   - Method: Measure webhook handler response time
   - Target: < 5 seconds (95th percentile)

5. **DAL Query Performance**
   - Test: `findEligibleForPayout()` query returns within 500ms
   - Method: Measure query execution time with indexed columns
   - Target: < 500ms (95th percentile)

6. **Atomic Claim Performance**
   - Test: `claimForProcessing()` completes within 100ms
   - Method: Measure UPDATE ... WHERE execution time
   - Target: < 100ms (95th percentile)

## Security Tests

### Security Test Cases

1. **Authentication Tests**
   - Cron endpoints reject requests without valid `CRON_SECRET` (401)
   - Return confirmation requires authenticated owner
   - Webhook endpoint verifies Stripe signatures

2. **Authorization Tests**
   - Only the rental owner can confirm return (403)
   - Cron endpoints only accessible via Vercel Cron (bearer token)
   - Webhook endpoint only processes events with valid Stripe signatures

3. **Data Protection Tests**
   - Stripe secret keys never logged or exposed in error messages
   - Idempotency keys do not leak sensitive information
   - `OPS_ALERT_EMAIL` not exposed to clients
   - Financial amounts logged without PII

4. **Financial Safety Tests**
   - No duplicate charges (idempotency keys + status gates)
   - No duplicate transfers (idempotency keys + status gates)
   - No duplicate deposit holds (idempotency keys)
   - Atomic claim prevents double-processing in concurrent cron runs
   - Failed operations leave clear audit trail (status = `'failed'`)

## Error Handling Tests

### Error Handling Test Cases

1. **Stripe API Errors**
   - `StripeCardError` → fail immediately, notify renter
   - `StripeRateLimitError` → retry once after 1s
   - `StripeAPIError` → retry once after 1s
   - `StripeConnectionError` → retry once after 1s
   - `StripeInvalidRequestError` → fail, alert ops
   - `StripeAuthenticationError` → fail, alert ops (config issue)

2. **Cron Error Handling**
   - Individual rental failure does not block batch processing
   - Failed rentals get `payoutStatus: 'failed'`, excluded from future runs
   - Each rental wrapped in try/catch
   - Summary logged at end: `{ eligible, processed, succeeded, failed }`

3. **Webhook Error Handling**
   - Unknown event types return 200 (don't block Stripe retries)
   - Processing errors return 500 (Stripe will retry)
   - Idempotent handling prevents duplicate state changes on retry

4. **Database Errors**
   - Atomic claim handles concurrent writes gracefully
   - Constraint violations (unique `rentalId`) return clear errors
   - Connection failures propagate to caller with status `'failed'`

5. **Partial Failure in Payout Cron**
   - Deposit released but transfer fails → `depositHoldStatus: 'released'`, `ownerTransferStatus: 'failed'`, `payoutStatus: 'failed'`
   - Requires manual intervention (ops alerted)
   - Next cron run skips because `payoutStatus` is NOT `'pending'`

## Test Data Requirements

### Test Fixtures

1. **Users**
   - Renter user with Stripe customer ID and payment method
   - Owner user with Stripe Connected Account
   - Admin user

2. **Rentals**
   - Approved rental with start > 48hrs (deposit scheduled)
   - Approved rental with start ≤ 48hrs (deposit immediate)
   - Approved rental with zero deposit
   - Completed rental with `returnConfirmedAt` > 24hrs ago (eligible for payout)
   - Completed rental with `returnConfirmedAt` < 24hrs ago (in dispute window)
   - Rental with open dispute

3. **Lifecycle Records**
   - `depositHoldStatus: 'scheduled'` — awaiting cron
   - `depositHoldStatus: 'held'` — hold placed, awaiting return
   - `depositHoldStatus: 'failed'` — hold failed, awaiting PM update
   - `depositHoldStatus: 'expired'` — hold expired on long rental
   - `depositHoldStatus: 'not_applicable'` — no deposit
   - `payoutStatus: 'pending'` — awaiting payout
   - `payoutStatus: 'processing'` — cron has claimed
   - `payoutStatus: 'completed'` — payout done
   - `payoutStatus: 'failed'` — payout failed

4. **Payments**
   - Payment with `paymentType: 'rental_charge'` and `stripePaymentIntentId`
   - Payment with `paymentType: 'security_deposit_hold'`

### Mocking Strategy

- **Stripe API**: Mock all Stripe API calls (`paymentIntents.create`, `paymentIntents.cancel`, `paymentIntents.retrieve`, `transfers.create`)
- **Database**: Use test database or mocks for unit tests, test DB for integration
- **Notifications**: Mock notification sending (verify called, don't actually send)
- **Email**: Mock email sending for ops alerts
- **Logger**: Mock `getLogger()` to verify structured log output

### Test Execution

- Run unit tests: `bun run test:unit`
- Run integration tests: `bun run test:integration`
- Run E2E tests: `bun run test:e2e`
- Run all tests: `bun run test`
- Run tests with coverage: `bun run test:coverage`

## Coverage Goals

- **Overall Coverage**: 85%+
- **PaymentLifecycleDAL**: 90%+
- **DepositHoldService**: 90%+
- **PayoutService**: 90%+
- **chargeRentalPayment()**: 90%+
- **Cron Endpoints**: 85%+
- **Webhook Handlers**: 85%+
- **Ops Alerting**: 80%+
- **Fee Calculations**: 100%

## Test Maintenance

- Update tests when requirements change (Phase 2 cancellations, Phase 3 disputes)
- Add tests for bug fixes discovered in production
- Review test coverage after each phase implementation
- Remove tests for deprecated payment flows (destination charges)
- Keep Stripe mock data aligned with actual Stripe API responses

---

_Last updated: March 12, 2026 | Internal use only_
