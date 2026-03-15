# Stripe Connect Payment Lifecycle (Phase 2) - Cancellation Policies - Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/payments/phase2/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Renter Cancellation Before Approval

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 1

**Test Coverage**:

- Unit tests: `CancellationService.cancelPendingRequest()` updates rental request status to `'cancelled'`
- Unit tests: `cancelPendingRequest()` makes zero Stripe API calls (no refund, no deposit, no transfer)
- Unit tests: `cancelPendingRequest()` rejects non-renter callers with `ForbiddenError`
- Unit tests: `cancelPendingRequest()` rejects non-pending statuses (approved, denied, cancelled)
- Unit tests: `cancelPendingRequest()` sends `rental_cancelled` notification to owner
- Unit tests: `cancelPendingRequest()` creates audit log entry
- Integration tests: POST cancel on pending request → 200, no Stripe calls, owner notified
- Integration tests: POST cancel on pending request by non-renter → 403
- Integration tests: POST cancel on already-cancelled request → 400

### Requirement 2: Renter Cancellation After Approval (Pre-Pickup)

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 2

**Test Coverage**:

#### Refund Calculation

- Unit tests: ≥24h before pickup → refund = 100% of rental price in cents
- Unit tests: <24h before pickup → refund = 50% of rental price in cents
- Unit tests: Exactly 24h boundary → full refund (≥24h applies)
- Unit tests: Service fee is never included in refund amount
- Unit tests: `Math.round` used for cent conversion (no fractional cents)
- Unit tests: Very small rental price ($0.01) does not produce negative owner transfer

#### Owner Transfer

- Unit tests: ≥24h cancel → `ownerTransferAmountCents` is 0 (no transfer)
- Unit tests: <24h cancel → `ownerTransferAmountCents` = (50% rental price − platform fee) in cents
- Unit tests: Platform fee = `Math.round(rentalPriceDollars * 0.20 * 100)` cents
- Unit tests: Owner transfer floor is 0 (never negative, via `Math.max`)

#### Stripe Refund

- Unit tests: `RefundService.processRefund()` called with correct charge ID and amount
- Unit tests: Idempotency key is `refund-rental-{rentalId}`
- Unit tests: Payment record updated: `status='refunded'`, `refundedAt`, `refundAmount`, `refundReason`
- Unit tests: `refundReason` is `'renter_cancellation_24h'` or `'renter_cancellation_under_24h'`

#### Owner Transfer Execution

- Unit tests: <24h cancel calls `createOwnerTransfer()` with correct amount, destination, source_transaction
- Unit tests: Transfer idempotency key reuses `transfer-owner-{rentalId}` pattern
- Unit tests: ≥24h cancel does NOT call `createOwnerTransfer()`
- Unit tests: Transfer failure sets `ownerTransferStatus='failed'`, triggers OPS_ALERT

#### Authorization and Status

- Unit tests: Only renter can cancel via this path
- Unit tests: `cancelApprovedRental()` rejects if status is not `'approved'`
- Unit tests: `cancelApprovedRental()` allows cancellation when approved and `startDate` has passed (applies &lt;24h refund tier)
- Unit tests: Rental request set to `'cancelled'` with `cancelledAt`, `cancelledBy`, `cancellationReason='renter_cancellation'`

#### Notifications

- Unit tests: Owner receives `rental_cancelled` notification
- Unit tests: Renter receives `payment_refunded` notification with refund amount
- Unit tests: OPS_ALERT sent with `sendEmailAlert: true`

#### Integration

- Integration tests: Full renter cancel (≥24h) → refund + deposit release + no transfer + notifications + OPS_ALERT
- Integration tests: Full renter cancel (<24h) → partial refund + owner transfer + deposit release + notifications + OPS_ALERT
- Integration tests: Renter cancel when payment already refunded → idempotent skip
- Integration tests: Renter cancel → lifecycle set to terminal state (payout cron skips)

### Requirement 3: Owner Cancellation After Approval

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 3

**Test Coverage**:

- Unit tests: Refund amount = full charge (rental price + service fee) in cents
- Unit tests: No owner transfer created on owner cancellation
- Unit tests: `refundReason` is `'owner_cancellation'`
- Unit tests: `cancellationReason` is `'owner_cancellation'`
- Unit tests: Deposit released if `'held'`, marked released if `'scheduled'`
- Unit tests: Only the listing owner can cancel via this path
- Unit tests: Renter receives `rental_cancelled` + `payment_refunded` notification
- Unit tests: OPS_ALERT sent with `sendEmailAlert: true`
- Unit tests: Platform absorbs Stripe fee (no deduction from renter refund)
- Integration tests: Full owner cancel → full refund + deposit release + renter notified + OPS_ALERT
- Integration tests: Owner cancel when deposit is `'scheduled'` → deposit marked released, not placed
- Integration tests: Owner cancel sets lifecycle to terminal (payout cron skips)
- Integration tests: Non-owner attempt → 403

### Requirement 4: Active Rental Cancellation Policy

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: `cancelRental()` with `'active'` status → `BadRequestError("Cancellation not allowed for active rentals")`
- Unit tests: No Stripe calls made for active rental cancellation attempt
- Unit tests: No status changes made for active rental cancellation attempt
- Integration tests: POST cancel on active rental (renter) → 400
- Integration tests: POST cancel on active rental (owner) → 400

### Requirement 5: Deposit Hold Handling on Cancellation

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: `depositHoldStatus='held'` → `releaseDepositHold()` called, status set to `'released'`, `depositReleasedAt` set
- Unit tests: `depositHoldStatus='scheduled'` → status set to `'released'`, no Stripe call
- Unit tests: `depositHoldStatus='failed'` → skip release, proceed with cancellation
- Unit tests: `depositHoldStatus='expired'` → skip release, proceed with cancellation
- Unit tests: `depositHoldStatus='not_applicable'` → skip release, proceed with cancellation
- Unit tests: `depositHoldStatus='released'` (already) → skip, proceed
- Unit tests: Deposit release fails → status set to `'release_failed'`, OPS_ALERT sent, cancellation continues
- Integration tests: Cancel with held deposit → Stripe `paymentIntents.cancel()` called, lifecycle updated
- Integration tests: Cancel with scheduled deposit → no Stripe call, lifecycle updated
- Integration tests: Cancel with release failure → OPS_ALERT sent, refund and status update still proceed

### Requirement 6: Refund Processing

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 6

**Test Coverage**:

- Unit tests: `processRefund()` calls `stripe.refunds.create()` with correct charge ID
- Unit tests: `processRefund()` passes amount in cents (integer)
- Unit tests: Idempotency key format is `refund-rental-{rentalId}`
- Unit tests: `processRefund()` includes `rentalId` and `reason` in refund metadata
- Unit tests: `processRefund()` returns `{ success: true, refundId }` on success
- Unit tests: `processRefund()` returns `{ success: false, error }` on Stripe error
- Unit tests: Status gate: payment already `'refunded'` → Stripe call skipped
- Unit tests: 50% of odd-cent amounts rounded correctly via `Math.round`
- Integration tests: Refund flows update payment record (`status`, `refundedAt`, `refundAmount`, `refundReason`)
- Integration tests: Duplicate refund attempt → skipped (idempotent)

### Requirement 7: No-Show Handling

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 7

**Test Coverage**:

#### Renter No-Show

- Unit tests: Refund amount = 50% of rental price (not service fee)
- Unit tests: Owner transfer = (50% rental price − platform fee) in cents
- Unit tests: `refundReason` is `'renter_no_show'`
- Unit tests: `cancellationReason` is `'renter_no_show'`
- Unit tests: Deposit released if present
- Unit tests: OPS_ALERT sent with `sendEmailAlert: true`

#### Owner No-Show

- Unit tests: Refund amount = full charge (rental price + service fee) in cents
- Unit tests: No owner transfer created
- Unit tests: `refundReason` is `'owner_no_show'`
- Unit tests: `cancellationReason` is `'owner_no_show'`
- Unit tests: Deposit released if present
- Unit tests: OPS_ALERT sent with `sendEmailAlert: true`

#### Integration

- Integration tests: POST renter_no_show → 200, refund + owner transfer + OPS_ALERT
- Integration tests: POST owner_no_show → 200, full refund + no transfer + OPS_ALERT
- Integration tests: No-show on already-cancelled rental → rejected (no double refund)
- Integration tests: Invalid no-show type → 400

### Requirement 8: Cancellation Data Model

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 8

**Test Coverage**:

- Schema tests: `cancelledAt` column exists on `rental_requests` (nullable timestamp)
- Schema tests: `cancelledBy` column exists on `rental_requests` (nullable uuid, FK to user)
- Schema tests: `cancellationReason` column exists on `rental_requests` (nullable, cancellationReasonEnum)
- Schema tests: `cancellationReasonEnum` has values: `renter_cancellation`, `owner_cancellation`, `renter_no_show`, `owner_no_show`
- Migration tests: Migration is additive (no destructive changes)
- Migration tests: Migration backward-compatible (existing rows unaffected)
- Unit tests: `cancelApprovedRental` DAL sets all three cancellation columns
- Unit tests: Cancelled rentals excluded from payout cron (`findEligibleForPayout` excludes non-completed)
- Integration tests: Cancellation metadata stored and queryable

### Requirement 9: Notifications

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 9

**Test Coverage**:

- Unit tests: Renter cancels pending → owner notified (`rental_cancelled`)
- Unit tests: Renter cancels approved → owner notified (`rental_cancelled`) + renter notified (`payment_refunded` with amount)
- Unit tests: Renter cancels approved → OPS_ALERT sent
- Unit tests: Owner cancels → renter notified (`rental_cancelled` + `payment_refunded`)
- Unit tests: Owner cancels → OPS_ALERT sent
- Unit tests: No-show (renter or owner) → OPS_ALERT sent
- Unit tests: Notification payloads include refund amount where applicable
- Integration tests: All notification sends verified end-to-end per scenario

### Requirement 10: Webhook Handling for Refunds

**Requirement Reference**: `specs/payments/phase2/1-requirements.md` - Requirement 10

**Test Coverage**:

- Integration tests: `charge.refunded` event → payment status updated to `'refunded'`
- Integration tests: `charge.refunded` event → `refundedAt` and `refundAmount` set from charge data
- Integration tests: `charge.refunded` for already-refunded payment → no-op, 200
- Integration tests: `charge.refunded` for unknown payment → logged, 200 (no Stripe retry block)
- Integration tests: Existing webhook handlers (`account.updated`, `payment_intent.succeeded`, etc.) still work
- Integration tests: Invalid Stripe signature → rejected

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and services in isolation.

**Framework**: Vitest

**Coverage Goals**: 90%+ for business logic (services, DAL), 100% for fee/refund calculations

**Areas to Test**:

- **CancellationService**: Mock DALs and Stripe services, test all cancellation paths and edge cases
- **RefundService**: Mock Stripe, test idempotency key, error handling, metadata
- **Refund calculation helpers**: Test boundary conditions, rounding, zero amounts, platform fee deduction
- **DAL extensions**: Mock database, test `cancelApprovedRental`, `recordRefund`, `markCancelled`, `getRentalCancellationContext`
- **CancelRental router method**: Test delegation to correct sub-method based on status and caller role

**Test Structure** (AAA Pattern):

```typescript
describe("CancellationService", () => {
  describe("cancelApprovedRental - renter, >=24h", () => {
    it("should refund 100% of rental price and not create owner transfer", async () => {
      // Arrange
      const mockContext = createMockCancellationContext({
        status: "approved",
        rentalPriceDollars: 100,
        totalChargeDollars: 112, // 100 + 12 service fee
        startDate: addHours(new Date(), 48), // 48h from now
        depositHoldStatus: "held",
      });
      vi.spyOn(rentalDAL, "getRentalCancellationContext").mockResolvedValue(
        mockContext,
      );
      vi.spyOn(refundService, "processRefund").mockResolvedValue({
        success: true,
        refundId: "re_123",
      });

      // Act
      const result = await CancellationService.cancelApprovedRental(
        "rental-1",
        mockContext.renterId,
        "renter",
        { ipAddress: "127.0.0.1" },
      );

      // Assert
      expect(result).toEqual({
        success: true,
        refundAmount: 100, // full rental price, no service fee
      });
      expect(refundService.processRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmountCents: 10000,
          reason: "renter_cancellation_24h",
        }),
      );
      expect(payoutService.createOwnerTransfer).not.toHaveBeenCalled();
      expect(sendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "renter_cancellation_post_approval",
        }),
      );
    });
  });
});
```

### Integration Tests

**Purpose**: Test component interactions and data flow between layers (route → service → DAL → Stripe).

**Framework**: Vitest with mocked Stripe and mocked/test DAL

**Coverage Goals**: All critical financial flows, 85%+ for integration points

**Areas to Test**:

- **Cancel route → CancellationService → DALs → Stripe**: Full cancel pipeline for each actor and tier
- **No-show route → CancellationService → DALs → Stripe**: Both no-show outcomes
- **Webhook → PaymentDAL**: `charge.refunded` event handling
- **Error propagation**: Stripe failures, DAL failures mapped to correct HTTP responses
- **Idempotency**: Double-cancel, double-refund, double-no-show

**Test Structure**:

```typescript
describe("POST /api/rentals/[id]/cancel", () => {
  it("should return 200 with refund details for approved renter cancel (<24h)", async () => {
    // Arrange
    mockAuth(renterId);
    setupMockRental({
      status: "approved",
      startDate: addHours(new Date(), 12),
    });
    mockStripeRefund({ id: "re_123" });
    mockStripeTransfer({ id: "tr_456" });

    // Act
    const response = await POST(request, {
      params: Promise.resolve({ id: rentalId }),
    });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.refundAmount).toBeCloseTo(50); // 50% of $100
    expect(body.ownerTransferAmount).toBeCloseTo(30); // 50% - 20% platform fee
    expect(stripeRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 }),
      { idempotencyKey: `refund-rental-${rentalId}` },
    );
    expect(stripeTransfersCreate).toHaveBeenCalled();
    expect(sendOpsAlert).toHaveBeenCalled();
  });
});
```

## Test Scenarios by Component

### RefundService Tests

**File**: `src/services/stripe/__tests__/refund.test.ts`

**Test Cases**:

1. `processRefund()` - Calls `stripe.refunds.create()` with charge ID and amount in cents
2. `processRefund()` - Uses idempotency key `refund-rental-{rentalId}`
3. `processRefund()` - Includes `rentalId` and `reason` in refund metadata
4. `processRefund()` - Returns `{ success: true, refundId }` on success
5. `processRefund()` - Returns `{ success: false, error }` on Stripe error
6. `processRefund()` - Passes optional `metadata` through to Stripe
7. `processRefund()` - Handles Stripe `StripeInvalidRequestError` gracefully

### Refund Calculation Tests

**File**: `src/features/rentals/services/__tests__/cancellation-service.test.ts`

**Test Cases**:

1. `calculateRenterCancellationRefund()` - ≥24h: refund = 100% rental price cents, transfer = 0
2. `calculateRenterCancellationRefund()` - <24h: refund = 50% rental price cents, transfer = (50% − platform fee)
3. `calculateRenterCancellationRefund()` - Exactly 24h: boundary, should be full refund
4. `calculateRenterCancellationRefund()` - 23h59m59s: boundary, should be 50% refund
5. `calculateRenterCancellationRefund()` - $1.00 rental price: correct rounding for small amounts
6. `calculateRenterCancellationRefund()` - $0.01 rental price: owner transfer floors at 0
7. `calculateRenterCancellationRefund()` - $1000 rental price: large amounts handled correctly
8. `calculateRenterCancellationRefund()` - Odd cents ($99.99): `Math.round` produces integer cents
9. `calculateRenterCancellationRefund()` - Platform fee exceeds retained amount → transfer = 0
10. `calculateOwnerCancellationRefund()` - Returns full charge cents, 0 transfer, reason `owner_cancellation`
11. `calculateNoShowRefund()` - Renter no-show: 50% rental price refund, owner transfer = (50% − platform fee)
12. `calculateNoShowRefund()` - Owner no-show: full charge refund, 0 transfer
13. `calculateNoShowRefund()` - Renter no-show with small amount: owner transfer floors at 0

### CancellationService Tests

**File**: `src/features/rentals/services/__tests__/cancellation-service.test.ts`

#### cancelPendingRequest

1. Renter cancels pending → status `'cancelled'`, owner notified, audit logged
2. Non-renter → `ForbiddenError`
3. Non-pending status → error rejected
4. No Stripe calls made (refund, deposit, transfer)

#### cancelRental (router method)

5. Pending + renter → delegates to `cancelPendingRequest`
6. Approved + renter → delegates to `cancelApprovedRental` with `"renter"`
7. Approved + owner → delegates to `cancelApprovedRental` with `"owner"`
8. Active → `BadRequestError`
9. Already cancelled → error
10. Already completed → error
11. Neither renter nor owner → `ForbiddenError`

#### cancelApprovedRental — renter ≥24h

12. Refund = 100% rental price, no service fee included
13. No owner transfer created
14. Deposit hold released (if `'held'`)
15. Deposit marked released (if `'scheduled'`)
16. Status set to `'cancelled'` with `cancellationReason='renter_cancellation'`
17. Lifecycle set to terminal (`payoutStatus='completed'`)
18. Owner notified (`rental_cancelled`)
19. Renter notified (`payment_refunded` with amount)
20. OPS_ALERT sent

#### cancelApprovedRental — renter <24h

21. Refund = 50% of rental price
22. Owner transfer = (50% rental price − platform fee) via `createOwnerTransfer()`
23. Transfer uses `source_transaction` (charge ID)
24. Transfer uses idempotency key `transfer-owner-{rentalId}`
25. `ownerTransferStatus='completed'`, `stripeTransferId` stored
26. Both notifications + OPS_ALERT

#### cancelApprovedRental — owner

27. Refund = full charge (rental price + service fee)
28. No owner transfer
29. Deposit released
30. `cancellationReason='owner_cancellation'`
31. Renter notified of cancellation + full refund
32. OPS_ALERT sent

#### cancelApprovedRental — edge cases

33. Refund fails → error returned, rental NOT cancelled, no status change
34. Deposit release fails → `release_failed`, OPS_ALERT, rest of flow continues
35. Owner transfer fails → `ownerTransferStatus='failed'`, OPS_ALERT, rental still cancelled
36. Already cancelled → rejected
37. After `startDate` (renter) → rejected
38. Payment already refunded → Stripe call skipped, proceed with status update

#### applyNoShow — renter

39. 50% rental price refund
40. Owner transfer for remainder minus platform fee
41. Deposit released if present
42. `cancellationReason='renter_no_show'`
43. OPS_ALERT sent

#### applyNoShow — owner

44. Full charge refund (rental + service fee)
45. No owner transfer
46. Deposit released if present
47. `cancellationReason='owner_no_show'`
48. OPS_ALERT sent

#### applyNoShow — edge cases

49. Already cancelled rental → rejected (no double refund)
50. Already refunded payment → Stripe skip, proceed

### DAL Extension Tests

**File**: `src/dal/__tests__/rentals.dal.test.ts` (and related)

#### RentalDAL

1. `getRentalCancellationContext()` - Returns full context with all joined fields
2. `getRentalCancellationContext()` - Returns null for non-existent rental
3. `cancelApprovedRental()` - Sets `status='cancelled'`, `cancelledAt`, `cancelledBy`, `cancellationReason`
4. `cancelApprovedRental()` - Only affects rows with `status='approved'` (status guard)
5. `cancelApprovedRental()` - Throws when no rows affected

#### PaymentDAL

6. `recordRefund()` - Updates `status='refunded'`, `refundedAt`, `refundAmount`, `refundReason`
7. `recordRefund()` - Accepts decimal amount as string

#### PaymentLifecycleDAL

8. `markCancelled()` - Sets `payoutStatus='completed'`
9. `markCancelled()` - Applies deposit and transfer overrides
10. `markCancelled()` - Sets `updatedAt`

### Cancel Route Tests

**File**: `src/app/api/rentals/[id]/cancel/__tests__/route.test.ts`

**Test Cases**:

1. POST pending cancel (renter) → 200, no Stripe calls
2. POST approved cancel (renter, ≥24h) → 200, `refundAmount` in response
3. POST approved cancel (renter, <24h) → 200, `refundAmount` + `ownerTransferAmount` in response
4. POST approved cancel (owner) → 200, full refund in response
5. POST active rental → 400 with error message
6. POST by unauthorized user (not renter or owner) → 403
7. POST not found rental → 404
8. POST already cancelled → 400
9. POST unauthenticated → 401

### No-Show Route Tests

**File**: `src/app/api/admin/rentals/[id]/no-show/__tests__/route.test.ts`

**Test Cases**:

1. POST `{ type: "renter_no_show" }` → 200, partial refund + owner transfer
2. POST `{ type: "owner_no_show" }` → 200, full refund
3. POST invalid type `{ type: "foo" }` → 400
4. POST missing body → 400
5. POST on already cancelled rental → error
6. POST unauthenticated → 401
7. Response includes `refundAmount` and optional `ownerTransferAmount`

### Webhook Tests (charge.refunded)

**File**: `src/app/api/stripe/webhooks/__tests__/route.test.ts`

**Test Cases**:

1. `charge.refunded` event → payment record updated (`status='refunded'`, `refundedAt`, `refundAmount`)
2. `charge.refunded` with `payment_intent` ID lookup → correct payment found
3. `charge.refunded` for already-refunded payment → no-op, 200
4. `charge.refunded` for unknown payment → logged warning, 200
5. `charge.refunded` coexists with existing handlers (no regressions)
6. Invalid Stripe signature → rejected
7. `refundAmount` calculated from `charge.amount_refunded` / 100

## BDD Scenarios

### Feature: Renter Cancellation After Approval

```gherkin
Feature: Renter Cancellation After Approval
  As a renter
  I want to cancel an approved rental before pickup
  So that I receive a fair refund based on how much notice I give

  Scenario: Full refund — cancel 48 hours before pickup
    Given a renter has an approved rental for a $100/day listing
    And the rental starts in 48 hours
    And the renter paid $112 total ($100 rental + $12 service fee)
    When the renter cancels the rental
    Then a Stripe refund should be created for $100.00 (rental price only)
    And the service fee of $12 should NOT be refunded
    And no owner transfer should be created
    And the deposit hold should be released
    And the rental request status should be "cancelled"
    And the owner should receive a cancellation notification
    And the renter should receive a refund notification for $100.00
    And an OPS_ALERT should be sent

  Scenario: Partial refund — cancel 12 hours before pickup
    Given a renter has an approved rental for a $100/day listing
    And the rental starts in 12 hours
    And the renter paid $112 total ($100 rental + $12 service fee)
    When the renter cancels the rental
    Then a Stripe refund should be created for $50.00 (50% of rental price)
    And the service fee of $12 should NOT be refunded
    And an owner transfer should be created for $30.00 ($50 retained - $20 platform fee)
    And the deposit hold should be released
    And the rental request status should be "cancelled"
    And both parties should be notified
    And an OPS_ALERT should be sent

  Scenario: Cancel at exactly 24-hour boundary
    Given a renter has an approved rental
    And the rental starts in exactly 24 hours
    When the renter cancels the rental
    Then the renter should receive a full rental price refund (≥24h tier applies)

  Scenario: Cancel blocked for active rental
    Given a renter has a rental with status "active"
    When the renter attempts to cancel
    Then the system should return a 400 error
    And no Stripe operations should be performed
    And the rental status should remain "active"
```

### Feature: Owner Cancellation

```gherkin
Feature: Owner Cancellation After Approval
  As a renter
  I want a full refund when the owner cancels
  So that I am made whole through no fault of my own

  Scenario: Owner cancels approved rental
    Given a renter has an approved rental for a $100/day listing
    And the renter paid $112 total ($100 rental + $12 service fee)
    And a deposit hold is placed
    When the owner cancels the rental
    Then a Stripe refund should be created for $112.00 (full charge)
    And no owner transfer should be created
    And the deposit hold should be released
    And the renter should receive a cancellation + full refund notification
    And an OPS_ALERT should be sent

  Scenario: Owner cancels before deposit is placed
    Given a renter has an approved rental
    And the deposit hold status is "scheduled"
    When the owner cancels
    Then the deposit hold status should be set to "released" (cron skips)
    And the renter should receive a full refund
```

### Feature: No-Show Handling

```gherkin
Feature: No-Show Handling
  As the platform
  I want to process no-show outcomes when ops triggers them
  So that financial outcomes are consistent and fair

  Scenario: Renter no-show — owner compensated
    Given a rental for a $100/day listing is in progress
    And the renter paid $112 total
    When ops applies a renter no-show outcome
    Then a Stripe refund should be created for $50.00 (50% of rental price)
    And an owner transfer should be created for $30.00 ($50 retained - $20 platform fee)
    And the deposit should be released if present
    And an OPS_ALERT should be sent

  Scenario: Owner no-show — renter fully refunded
    Given a rental for a $100/day listing is in progress
    And the renter paid $112 total
    When ops applies an owner no-show outcome
    Then a Stripe refund should be created for $112.00 (full charge)
    And no owner transfer should be created
    And the deposit should be released if present
    And an OPS_ALERT should be sent

  Scenario: No-show on already cancelled rental
    Given a rental that has already been cancelled
    When ops attempts to apply a no-show outcome
    Then the request should be rejected
    And no refund should be created
```

### Feature: Deposit Handling on Cancellation

```gherkin
Feature: Deposit Hold Handling on Cancellation
  As the platform
  I want to release deposit holds when a rental is cancelled
  So that the renter's funds are not held unnecessarily

  Scenario: Release held deposit on cancellation
    Given a rental with depositHoldStatus "held"
    When the rental is cancelled
    Then stripe.paymentIntents.cancel() should be called on the deposit PI
    And depositHoldStatus should be set to "released"
    And depositReleasedAt should be set

  Scenario: Cancel scheduled deposit on cancellation
    Given a rental with depositHoldStatus "scheduled"
    When the rental is cancelled
    Then no Stripe call should be made for the deposit
    And depositHoldStatus should be set to "released"
    And the deposit scheduling cron should skip this rental

  Scenario: Deposit release failure during cancellation
    Given a rental with depositHoldStatus "held"
    And the Stripe API will fail when cancelling the deposit PI
    When the rental is cancelled
    Then depositHoldStatus should be set to "release_failed"
    And an OPS_ALERT should be sent
    And the refund and cancellation should still proceed
```

### Feature: Refund Idempotency

```gherkin
Feature: Refund Idempotency
  As the platform
  I want to prevent duplicate refunds
  So that financial operations are safe under retries

  Scenario: Duplicate cancel request
    Given a rental that has already been cancelled
    When the renter attempts to cancel again
    Then the system should return an error (already cancelled)
    And no new Stripe refund should be created

  Scenario: Stripe idempotency key prevents duplicate
    Given a cancellation is in progress
    And the idempotency key refund-rental-{rentalId} was already used
    When the refund call reaches Stripe
    Then Stripe should return the original refund (not create a new one)

  Scenario: DB status gate prevents duplicate after key expiry
    Given the idempotency key has expired (>24h)
    And the payment status is already "refunded"
    When the system attempts to process a refund
    Then the Stripe call should be skipped
    And the system should proceed with the rest of the flow
```

## Performance Tests

### Performance Test Cases

1. **Cancellation Performance**
   - Test: Renter cancellation (refund + deposit release + status update) completes within 15 seconds
   - Method: Measure API response time including Stripe calls
   - Target: < 15 seconds (95th percentile)

2. **Owner Transfer on Cancel Performance**
   - Test: <24h cancellation (refund + deposit release + owner transfer + status update) completes within 15 seconds
   - Method: Measure API response time including multiple Stripe calls
   - Target: < 15 seconds (95th percentile)

3. **No-Show Processing Performance**
   - Test: No-show outcome (refund + optional transfer + deposit release) completes within 15 seconds
   - Method: Measure API response time
   - Target: < 15 seconds (95th percentile)

4. **Webhook Processing Performance**
   - Test: `charge.refunded` webhook processed and returns HTTP 200 within 5 seconds
   - Method: Measure webhook handler response time
   - Target: < 5 seconds (95th percentile)

5. **DAL Query Performance**
   - Test: `getRentalCancellationContext()` query returns within 500ms
   - Method: Measure query execution time with indexed columns
   - Target: < 500ms (95th percentile)

## Security Tests

### Security Test Cases

1. **Authentication Tests**
   - Cancel endpoint requires authenticated user (401)
   - No-show endpoint requires authenticated user (401)
   - Webhook endpoint verifies Stripe signatures

2. **Authorization Tests**
   - Only renter can cancel their pending request (403 for others)
   - Only renter or owner can cancel approved rental (403 for others)
   - Only renter can trigger renter cancellation, only owner can trigger owner cancellation
   - No-show endpoint requires admin/ops role (future: Phase 4 admin middleware)

3. **Data Protection Tests**
   - Stripe secret keys never logged or exposed in error messages
   - Idempotency keys do not leak sensitive information
   - Financial amounts logged without PII
   - Refund reasons do not expose internal system details in API responses

4. **Financial Safety Tests**
   - No duplicate refunds (idempotency key + DB status gate)
   - No duplicate owner transfers (idempotency key + status gate)
   - Refund amount never exceeds original charge amount
   - Owner transfer amount never exceeds non-refunded balance
   - Platform fee calculation is consistent (always 20%)
   - Cancelled rental excluded from payout cron processing

## Error Handling Tests

### Error Handling Test Cases

1. **Stripe Refund Errors**
   - `StripeInvalidRequestError` (e.g. charge already fully refunded) → error returned, logged
   - `StripeAPIError` → error returned, logged
   - Generic Stripe error → error returned, OPS_ALERT

2. **Stripe Transfer Errors (on <24h cancel)**
   - Transfer fails → `ownerTransferStatus='failed'`, OPS_ALERT, rental still marked cancelled
   - Transfer amount validation (not negative, not zero when transfer expected)

3. **Deposit Release Errors**
   - Release fails → `depositHoldStatus='release_failed'`, OPS_ALERT, cancellation continues
   - PI already cancelled in Stripe → no-op or graceful handling

4. **Partial Failure Scenarios**
   - Refund succeeds but deposit release fails → cancelled, `release_failed`, OPS_ALERT
   - Refund succeeds but owner transfer fails → cancelled, `ownerTransferStatus='failed'`, OPS_ALERT
   - Refund fails → NOT cancelled, error returned to caller, ops can retry

5. **Database Errors**
   - `cancelApprovedRental` status guard fails (already cancelled) → clear error
   - Connection failure during status update → error propagated
   - `getRentalCancellationContext` returns null → 404

6. **Concurrent Cancellation**
   - Two simultaneous cancel requests for same rental → one succeeds, one fails (status guard)

## Test Data Requirements

### Test Fixtures

1. **Users**
   - Renter user with Stripe customer ID and payment method
   - Owner user with Stripe Connected Account
   - Admin/ops user
   - Unrelated user (for authorization tests)

2. **Rental Requests**
   - Pending request (renter can cancel, no payment)
   - Approved request with `startDate` 48h away (≥24h tier)
   - Approved request with `startDate` 12h away (<24h tier)
   - Approved request with `startDate` exactly 24h away (boundary)
   - Active rental (cancellation rejected)
   - Already cancelled rental (duplicate cancel rejected)
   - Completed rental (cancellation rejected)

3. **Payments**
   - Payment with `status='succeeded'` and known charge ID
   - Payment with `status='refunded'` (for idempotency tests)

4. **Lifecycle Records**
   - `depositHoldStatus='held'` + known PI ID
   - `depositHoldStatus='scheduled'`
   - `depositHoldStatus='failed'`
   - `depositHoldStatus='expired'`
   - `depositHoldStatus='not_applicable'`

5. **Price Scenarios**
   - $100 rental / $12 service fee / $112 total (standard)
   - $1 rental (small amount edge case)
   - $999.99 rental (large amount)
   - $0 security deposit (not_applicable)

### Mocking Strategy

- **Stripe API**: Mock `refunds.create`, `paymentIntents.cancel`, `transfers.create`
- **DALs**: Mock `rentalDAL`, `paymentDAL`, `paymentLifecycleDAL` for unit tests
- **Notifications**: Mock notification sending (verify called with correct params)
- **OPS Alerts**: Mock `sendOpsAlert` (verify called with correct event and metadata)
- **Auth**: Mock `getCurrentUserId` and `requireAuthResponse`

### Test Execution

- Run unit tests: `bun run test:unit`
- Run integration tests: `bun run test:integration`
- Run all tests: `bun run test`
- Run tests with coverage: `bun run test:coverage`
- Run specific Phase 2 tests: `bun run test -- --grep "cancellation|refund|no-show"`

## Coverage Goals

- **Overall Phase 2 Coverage**: 90%+
- **CancellationService**: 95%+
- **RefundService**: 95%+
- **Refund Calculation Helpers**: 100%
- **DAL Extensions**: 90%+
- **Cancel Route Handler**: 85%+
- **No-Show Route Handler**: 85%+
- **Webhook Handler (charge.refunded)**: 90%+
- **Fee/Amount Calculations**: 100%

## Test Maintenance

- Update tests when Phase 3 (disputes) adds refund-related flows
- Add regression tests for any bugs found in production
- Keep Stripe mock data aligned with actual Stripe API responses
- Review boundary conditions if cancellation policy changes (e.g. tier thresholds)
- Add E2E tests for complete cancel flows once Playwright is configured

---

_Last updated: March 12, 2026 | Internal use only_
