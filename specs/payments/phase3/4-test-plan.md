# Stripe Connect Payment Lifecycle (Phase 3) - Dispute Resolution & Chargebacks - Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/payments/phase3/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Dispute Filing Window

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 1

**Test Coverage**:

#### Server-Side Filing Window Validation

- Unit tests: `returnConfirmedAt` set + within 24h → filing allowed (valid)
- Unit tests: `returnConfirmedAt` set + exactly 24h → boundary (valid)
- Unit tests: `returnConfirmedAt` set + 24h01m past → filing rejected (invalid)
- Unit tests: `returnConfirmedAt` NOT set + `now >= startDate` → filing allowed (no-show window)
- Unit tests: `returnConfirmedAt` NOT set + `now < startDate` → filing rejected
- Unit tests: Same 24h rule applied for ALL reason codes (damage, non_delivery, quality_issue, cancellation, payment_issue, renter_no_show, owner_no_show, other)
- Integration tests: POST create dispute within window → 201
- Integration tests: POST create dispute after window → 400 with clear message "The dispute filing window closed 24 hours after the return was confirmed"
- Integration tests: POST create dispute on startDate (no-show) → 201

### Requirement 2: Dispute Button Visibility

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 2

**Test Coverage**:

- Client tests: `approved` + `now >= startDate` → button visible
- Client tests: `approved` + `now < startDate` → button hidden
- Client tests: `active` → button visible
- Client tests: `completed` + within 24h of `returnConfirmedAt` → button visible
- Client tests: `completed` + 25h after `returnConfirmedAt` → button hidden
- Client tests: `pending` → button hidden
- Client tests: `cancelled` → button hidden
- Client tests: `denied` → button hidden
- Client tests: Active dispute exists → button hidden regardless of status/timing
- Client tests: User is neither renter nor owner → button hidden

### Requirement 3: Dispute Reason Codes

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 3

**Test Coverage**:

- Schema tests: `disputeReasonCodeEnum` includes `renter_no_show` and `owner_no_show`
- Migration tests: Migration adds two enum values without data loss
- Client tests: Form shows `renter_no_show` and `owner_no_show` when `status=approved` and `now >= startDate`
- Client tests: Form does NOT show no-show codes when `status=completed`
- Client tests: Existing reason codes (damage, non_delivery, etc.) remain available
- Integration tests: POST dispute with `reasonCode=renter_no_show` accepted when within window
- Integration tests: POST dispute with `reasonCode=owner_no_show` accepted when within window

### Requirement 4: Payout Freeze on Dispute Creation

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: `DisputeCreationService.createDispute()` calls `freezeForDispute(rentalId)` after dispute insert
- Unit tests: `freezeForDispute()` sets `ownerTransferStatus='frozen'` on existing lifecycle record
- Unit tests: `freezeForDispute()` creates lifecycle record if none exists (edge case)
- Unit tests: Payout cron `findEligibleForPayout()` excludes rentals with `ownerTransferStatus='frozen'`
- Integration tests: POST create dispute → lifecycle record shows `ownerTransferStatus='frozen'`
- Integration tests: Dispute created → payout cron skips the rental

### Requirement 5: Owner Transfer Unfreeze on Resolution

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: `unfreezeAfterResolution()` sets `ownerTransferStatus` from `'frozen'` to `'pending'`
- Unit tests: `unfreezeAfterResolution()` is no-op if status is not `'frozen'` (idempotent)
- Unit tests: Unfreeze occurs only after financial operations succeed (not before)
- Unit tests: If financial operation fails → unfreeze NOT called, status remains `'frozen'`
- Unit tests: Once unfrozen to `'pending'`, payout cron can pick up the rental
- Integration tests: Resolve dispute (favor_renter) → lifecycle shows `ownerTransferStatus='pending'`
- Integration tests: Resolve dispute with capture failure → lifecycle stays `'frozen'`

### Requirement 6: Evidence Collection

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 6

**Test Coverage**:

- Integration tests: Renter uploads image evidence → stored in `dispute_evidence`
- Integration tests: Owner uploads text evidence → stored in `dispute_evidence`
- Integration tests: Evidence accepted when status is `evidence_requested` or `under_review`
- Integration tests: Evidence rejected after deadline has passed
- Integration tests: Admin requests additional evidence → notification sent to relevant party
- Integration tests: Evidence upload creates audit log entry
- Integration tests: Non-party user cannot upload evidence → 403

### Requirement 7: Evidence Deadline Enforcement

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 7

**Test Coverage**:

- Unit tests: `DeadlineEnforcementService` auto-transitions dispute when `evidenceDeadline` passes
- Unit tests: `isDeadlineExpired()` returns true when past deadline, false when before
- Unit tests: Notification `dispute_evidence_deadline_approaching` sent 24h before deadline
- Unit tests: Notification `dispute_evidence_deadline_expired` sent when deadline passes
- Integration tests: Dispute with expired deadline auto-transitions to next state
- Integration tests: Additional evidence deadline enforced separately from initial deadline

### Requirement 8: Admin Mediation and Resolution

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 8

**Test Coverage**:

#### State Transitions

- Unit tests: Admin can transition open → evidence_requested
- Unit tests: Admin can transition evidence_requested → under_review
- Unit tests: Admin can transition under_review → resolved
- Unit tests: Admin can transition resolved → closed
- Unit tests: Non-admin cannot transition to admin-only states → error

#### Resolution

- Unit tests: `resolveDispute()` accepts all five outcomes (favor_renter, favor_provider, partial_renter, partial_provider, dismissed)
- Unit tests: Resolution records `resolvedAt`, `resolvedBy`, `resolutionOutcome`, `resolutionReason`
- Unit tests: Resolution creates `dispute_financial_operations` record for each Stripe operation
- Unit tests: Already-resolved dispute → `ValidationError`
- Unit tests: Notifications sent to both parties on resolution (`dispute_resolved`)
- Integration tests: POST resolve with favor_provider → deposit captured, unfrozen, resolved, notified
- Integration tests: POST resolve by non-admin → 403

### Requirement 9: Deposit Capture for Damage

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 9

**Test Coverage**:

#### Full Capture (favor_provider)

- Unit tests: `captureDeposit()` calls `stripe.paymentIntents.capture()` on `securityDepositAuthId`
- Unit tests: Idempotency key is `deposit-capture-{disputeId}`
- Unit tests: `depositHoldStatus` set to `'captured'` after success
- Unit tests: `depositCapturedAt` timestamp set after success
- Unit tests: `dispute_financial_operations` record created with `operationType='capture_deposit'`, `status='succeeded'`

#### Partial Capture (partial_provider)

- Unit tests: `captureDeposit()` passes `amount_to_capture` in cents to Stripe for partial capture
- Unit tests: Correct partial amount recorded in `dispute_financial_operations`

#### Deposit Not Available

- Unit tests: `depositHoldStatus='expired'` → capture skipped, financial op recorded as skipped
- Unit tests: `depositHoldStatus='released'` → capture skipped
- Unit tests: `depositHoldStatus='not_applicable'` → capture skipped
- Unit tests: Skipped capture still allows resolution and unfreeze (rental amount only)

#### Capture Failure

- Unit tests: Stripe returns error → financial op status `'failed'`, error logged, OPS_ALERT sent
- Unit tests: Capture failure → `ownerTransferStatus` NOT unfrozen to `'pending'`
- Unit tests: Capture failure → dispute NOT marked as resolved
- Integration tests: Resolve favor_provider with held deposit → capture succeeds, lifecycle updated
- Integration tests: Resolve favor_provider with expired deposit → skip capture, still resolve and unfreeze

### Requirement 10: Resolution Financial Outcomes

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 10

**Test Coverage**:

#### Outcome Mapping

- Unit tests: `getFinancialOperationsForOutcome('favor_provider', 'held')` → `[capture_deposit]`
- Unit tests: `getFinancialOperationsForOutcome('favor_renter', 'held')` → `[release_deposit]`
- Unit tests: `getFinancialOperationsForOutcome('dismissed', 'held')` → `[release_deposit]`
- Unit tests: `getFinancialOperationsForOutcome('partial_provider', 'held', amount)` → `[capture_deposit(partial)]`
- Unit tests: `getFinancialOperationsForOutcome('partial_renter', 'held', amount)` → `[capture_deposit(partial)]`
- Unit tests: Any outcome with `depositHoldStatus != 'held'` → empty operations (no Stripe call)

#### favor_provider

- Unit tests: Full deposit captured → unfreeze → payout cron pays rental + deposit
- Integration tests: Full resolution flow with deposit capture

#### favor_renter

- Unit tests: Deposit released via `stripe.paymentIntents.cancel()` → `'released'`, `depositReleasedAt` set
- Unit tests: No deposit amount added to owner transfer (rental amount only)
- Integration tests: Full resolution flow with deposit release

#### partial_provider / partial_renter

- Unit tests: Partial amount captured, correct cents sent to Stripe
- Integration tests: Partial capture flow end-to-end

#### dismissed

- Unit tests: Same behavior as favor_renter (release deposit, unfreeze)

#### All Outcomes

- Unit tests: Financial operation records created in `dispute_financial_operations` for every outcome
- Unit tests: OPS_ALERT sent for every resolution

### Requirement 11: Stripe Chargeback Handling

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 11

**Test Coverage**:

#### charge.dispute.created

- Unit tests: `handleChargebackCreated()` identifies rental via payment charge ID lookup
- Unit tests: Existing internal dispute → `stripeChargebackId` set on the dispute
- Unit tests: No internal dispute → auto-creates dispute with `reasonCode='payment_issue'` and `stripeChargebackId`
- Unit tests: Payout frozen via `freezeForDispute()` on chargeback creation
- Unit tests: OPS_ALERT sent with `sendEmailAlert: true`
- Unit tests: Unknown charge ID → logged, no action

#### charge.dispute.updated

- Unit tests: Handler logs update and records in audit log
- Unit tests: Idempotent: duplicate event → no duplicate state changes

#### charge.dispute.closed

- Unit tests: Won → audit log entry, ops alerted
- Unit tests: Lost → audit log entry, ops alerted, financial state adjusted if needed

#### Integration

- Integration tests: `charge.dispute.created` webhook → dispute linked, payout frozen, ops alerted
- Integration tests: `charge.dispute.closed` webhook → outcome recorded
- Integration tests: Duplicate webhook → idempotent (no duplicate disputes)
- Integration tests: Existing webhook handlers (payment_intent, transfer, charge.refunded) unaffected

### Requirement 12: Chargeback Evidence Submission

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 12

**Test Coverage**:

- Unit tests: `submitEvidence()` calls `stripe.disputes.update()` with Stripe dispute ID
- Unit tests: Evidence mapped to Stripe fields (product_description, service_date, etc.)
- Unit tests: Idempotency key `chargeback-evidence-{disputeId}` used
- Unit tests: Submission recorded in dispute audit log
- Unit tests: Dispute without `stripeChargebackId` → `ValidationError`
- Unit tests: Stripe API failure → error logged, ops alerted
- Integration tests: POST admin chargeback evidence → Stripe called, audit logged
- Integration tests: POST by non-admin → 403

### Requirement 13: Dispute Notifications

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 13

**Test Coverage**:

- Unit tests: Dispute created → `dispute_created` notification sent to other party
- Unit tests: Admin requests evidence → `dispute_evidence_requested` notification sent
- Unit tests: Deadline approaching → `dispute_evidence_deadline_approaching` notification sent
- Unit tests: Deadline expired → `dispute_evidence_deadline_expired` notification sent
- Unit tests: Dispute resolved → `dispute_resolved` notification sent to both parties
- Unit tests: Notifications not sent to non-party users
- Unit tests: OPS_ALERT sent for resolutions and chargeback events
- Unit tests: Notification failure is non-critical (captured via `captureNonCriticalError`)
- Integration tests: Full notification flow verified for creation, evidence request, and resolution

### Requirement 14: Data Model Extensions

**Requirement Reference**: `specs/payments/phase3/1-requirements.md` - Requirement 14

**Test Coverage**:

- Schema tests: `disputeReasonCodeEnum` includes all 8 values including `renter_no_show`, `owner_no_show`
- Schema tests: `rental_payment_lifecycle` has `depositCapturedAt` column (nullable timestamp)
- Schema tests: `disputes.stripeChargebackId` exists and can be set
- Schema tests: `dispute_financial_operations` can store `stripePaymentIntentId` and `stripeOperationId`
- Migration tests: Migration is additive, backward-compatible
- Migration tests: Existing data unaffected by migration

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and services in isolation.

**Framework**: Vitest

**Coverage Goals**: 90%+ for business logic (services, DAL), 100% for filing window logic

**Areas to Test**:

- **DisputeCreationService**: Mock DALs and notifications; test filing window, authorization, rate limits, payout freeze
- **DisputeResolutionService**: Mock DALs and StripeDisputeService; test all five outcomes, deposit edge cases, unfreeze
- **StripeDisputeService**: Mock Stripe; test capture with idempotency, partial capture, release, lifecycle updates
- **ChargebackService**: Mock DALs and Stripe; test chargeback created/updated/closed handlers, evidence submission
- **Filing window helper**: Test all boundary conditions
- **Outcome mapping helper**: Test all outcome/deposit-status combinations
- **DAL extensions**: Mock database; test freeze/unfreeze, markDepositCaptured, filing window validation

**Test Structure** (AAA Pattern):

```typescript
describe("DisputeCreationService", () => {
  describe("createDispute - filing window", () => {
    it("should allow filing within 24h of returnConfirmedAt", async () => {
      // Arrange
      const rentalContext = createMockRentalContext({
        status: "completed",
        returnConfirmedAt: subHours(new Date(), 12), // 12h ago
        startDate: subDays(new Date(), 7),
      });
      vi.spyOn(rentalDAL, "getRentalDetailsById").mockResolvedValue(
        rentalContext,
      );
      vi.spyOn(disputeDAL, "getActiveByRentalId").mockResolvedValue(null);
      vi.spyOn(disputeDAL, "create").mockResolvedValue(mockDispute);

      // Act
      const result = await DisputeCreationService.createDispute({
        rentalId: "rental-1",
        reasonCode: "damage",
        description: "Tool was returned damaged",
        userId: rentalContext.renterId,
      });

      // Assert
      expect(result.dispute).toBeDefined();
      expect(paymentLifecycleDAL.freezeForDispute).toHaveBeenCalledWith(
        "rental-1",
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

- **Dispute creation route → DisputeCreationService → DALs**: Full creation flow with freeze
- **Resolve route → DisputeResolutionService → StripeDisputeService → DALs → Stripe**: All five outcomes
- **Webhook handler → ChargebackService → DALs**: All three chargeback event types
- **Admin evidence route → ChargebackService → Stripe**: Evidence submission
- **Error propagation**: Stripe failures, DAL failures mapped to correct HTTP responses
- **Idempotency**: Double dispute creation, duplicate chargeback webhooks

**Test Structure**:

```typescript
describe("POST /api/disputes/[id]/resolve", () => {
  it("should capture deposit and unfreeze for favor_provider", async () => {
    // Arrange
    mockAuth(adminId, { isAdmin: true });
    setupMockDispute({ rentalId, depositHoldStatus: "held" });
    mockStripeCapture({ id: "pi_captured" });

    // Act
    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    // Assert
    expect(response.status).toBe(200);
    expect(stripePaymentIntentsCapture).toHaveBeenCalledWith(
      securityDepositAuthId,
      expect.objectContaining({
        idempotencyKey: `deposit-capture-${disputeId}`,
      }),
    );
    expect(lifecycleDAL.markDepositCaptured).toHaveBeenCalled();
    expect(lifecycleDAL.unfreezeAfterResolution).toHaveBeenCalled();
  });
});
```

## Test Scenarios by Component

### DisputeCreationService Tests

**File**: `src/features/disputes/services/__tests__/dispute-creation-service.test.ts`

#### Filing Window Validation

1. `returnConfirmedAt` set, 12h ago → valid
2. `returnConfirmedAt` set, exactly 24h ago → valid (boundary)
3. `returnConfirmedAt` set, 24h01m ago → invalid
4. `returnConfirmedAt` not set, `now >= startDate` → valid (no-show window)
5. `returnConfirmedAt` not set, `now < startDate` → invalid
6. Same rule for all 8 reason codes (no per-code extension)

#### Authorization

7. User is renter → allowed
8. User is owner → allowed
9. User is neither renter nor owner → `ForbiddenError`

#### Active Dispute Check

10. No active dispute → proceed
11. Active dispute exists → `ValidationError("An active dispute already exists")`

#### Rate Limits

12. Under limit → proceed
13. Exceeds 3/month → `ValidationError`
14. Exceeds 10/year → `ValidationError`

#### Payout Freeze

15. Dispute created → `freezeForDispute()` called with rental ID
16. Lifecycle exists → `ownerTransferStatus` set to `'frozen'`
17. No lifecycle record → creates one with `'frozen'` status

#### Notifications

18. Dispute created → `dispute_created` notification to other party
19. Notification failure → non-critical, dispute still created

### DisputeResolutionService Tests

**File**: `src/features/disputes/services/__tests__/dispute-resolution-service.test.ts`

#### favor_provider

1. Deposit held → full capture → `depositHoldStatus='captured'`, `depositCapturedAt` set → unfreeze → resolved
2. Deposit expired → skip capture, record skipped → unfreeze → resolved, OPS_ALERT
3. Deposit released → skip capture → unfreeze → resolved

#### favor_renter

4. Deposit held → release deposit → `depositHoldStatus='released'`, `depositReleasedAt` set → unfreeze → resolved
5. Deposit expired → skip release → unfreeze → resolved

#### partial_provider

6. Deposit held + partial amount → partial capture → `depositHoldStatus='captured'` → unfreeze → resolved
7. No partial amount provided → error

#### partial_renter

8. Same as partial_provider but from renter's perspective

#### dismissed

9. Same behavior as favor_renter: release deposit, unfreeze

#### Financial Operation Recording

10. Every outcome creates record in `dispute_financial_operations`
11. Skipped operations recorded with reason

#### Error Handling

12. Capture fails → NOT resolved, NOT unfrozen, error returned
13. Release fails → set `release_failed`, still unfreeze and resolve
14. Already resolved → `ValidationError`

#### Notifications and Alerts

15. `dispute_resolved` sent to both parties
16. OPS_ALERT sent for all resolutions

### StripeDisputeService Tests

**File**: `src/services/stripe/__tests__/dispute-financial.test.ts`

#### captureDeposit (Enhanced)

1. Full capture uses idempotency key `deposit-capture-{disputeId}`
2. Partial capture passes `amount_to_capture` to Stripe
3. `depositHoldStatus != 'held'` → skip capture, no Stripe call
4. Capture success → lifecycle updated via `markDepositCaptured()`
5. Capture failure → financial op recorded as `'failed'`, error thrown

#### releaseDeposit (New)

6. Release calls `stripe.paymentIntents.cancel()` on deposit PaymentIntent
7. Release success → lifecycle updated to `'released'`, `depositReleasedAt` set
8. `depositHoldStatus != 'held'` → skip release
9. Release failure → financial op recorded, `release_failed` status

### ChargebackService Tests

**File**: `src/services/stripe/__tests__/chargeback-service.test.ts`

#### handleChargebackCreated

1. Known charge, existing internal dispute → `stripeChargebackId` set
2. Known charge, no internal dispute → auto-creates dispute with `stripeChargebackId`
3. Unknown charge → logged error, returns without action
4. Payout frozen after linking
5. OPS_ALERT sent

#### handleChargebackUpdated

6. Logs update, records in audit log
7. Idempotent: duplicate event → no duplicate actions

#### handleChargebackClosed

8. Won → audit logged, ops alerted
9. Lost → audit logged, ops alerted

#### submitEvidence

10. Calls `stripe.disputes.update()` with correct dispute ID and evidence
11. Uses idempotency key `chargeback-evidence-{disputeId}`
12. No `stripeChargebackId` → `ValidationError`
13. Stripe API failure → error logged, ops alerted
14. Submission recorded in audit log

### DAL Extension Tests

**File**: Tests co-located with respective DAL files

#### PaymentLifecycleDAL

1. `freezeForDispute()` sets `ownerTransferStatus='frozen'`
2. `freezeForDispute()` with no existing record → creates one
3. `unfreezeAfterResolution()` sets `ownerTransferStatus='pending'` when currently `'frozen'`
4. `unfreezeAfterResolution()` is no-op when not `'frozen'`
5. `markDepositCaptured()` sets `depositHoldStatus='captured'` and `depositCapturedAt`

#### DisputeDAL

6. `updateStripeChargebackId()` sets `stripeChargebackId` on dispute
7. `validateFilingWindowUnified()` returns valid when within 24h of return
8. `validateFilingWindowUnified()` returns valid when `now >= startDate` and no return
9. `validateFilingWindowUnified()` returns invalid when window expired

#### PaymentDAL

10. `getByChargeId()` returns payment for known charge ID
11. `getByChargeId()` returns null for unknown charge ID

### Dispute Creation Route Tests

**File**: `src/app/api/disputes/__tests__/route.test.ts`

1. POST with valid data → 201, dispute created, payout frozen
2. POST with expired filing window → 400 with message
3. POST by unauthorized user → 403
4. POST with active dispute existing → 400
5. POST with `renter_no_show` reason code → 201 (when applicable)
6. POST unauthenticated → 401
7. POST with invalid data → 400

### Dispute Resolution Route Tests

**File**: `src/app/api/disputes/[id]/resolve/__tests__/route.test.ts`

1. POST favor_provider → 200, deposit captured, unfrozen
2. POST favor_renter → 200, deposit released, unfrozen
3. POST partial_provider with amount → 200, partial capture
4. POST dismissed → 200, same as favor_renter
5. POST by non-admin → 403
6. POST on already-resolved → 400
7. POST on non-existent dispute → 404
8. POST unauthenticated → 401

### Chargeback Evidence Route Tests

**File**: `src/app/api/admin/disputes/[id]/chargeback-evidence/__tests__/route.test.ts`

1. POST by admin → 200, Stripe called, audit logged
2. POST by non-admin → 403
3. POST on dispute without `stripeChargebackId` → 400
4. POST on non-existent dispute → 404

### Webhook Tests (charge.dispute.\*)

**File**: `src/services/stripe/__tests__/webhook-handlers.test.ts`

1. `charge.dispute.created` → internal dispute linked or created, payout frozen
2. `charge.dispute.created` for unknown charge → logged, 200
3. `charge.dispute.updated` → logged, audit trail updated
4. `charge.dispute.closed` (won) → audit logged, ops alerted
5. `charge.dispute.closed` (lost) → audit logged, ops alerted
6. Duplicate `charge.dispute.created` → idempotent, no duplicate dispute
7. Existing webhook handlers unaffected (regression test)

### Client-Side Tests

**File**: `src/features/rentals/components/detail-page/__tests__/rental-actions.test.tsx`

#### canFileDispute

1. Approved + past startDate → visible
2. Approved + before startDate → hidden
3. Active → visible
4. Completed + within 24h of returnConfirmedAt → visible
5. Completed + 25h after returnConfirmedAt → hidden
6. Completed + no returnConfirmedAt → hidden
7. Pending → hidden
8. Cancelled → hidden
9. Denied → hidden
10. Active dispute exists → hidden regardless of timing
11. User is neither renter nor owner → hidden

#### Create Dispute Form

12. Form shows no-show codes when status=approved and past startDate
13. Form hides no-show codes when status=completed
14. All existing reason codes remain available

## BDD Scenarios

### Feature: Dispute Filing Window

```gherkin
Feature: Dispute Filing Window
  As a renter or owner
  I want to file disputes within a clear window
  So that deadlines are predictable and no-shows can be reported

  Scenario: File dispute within 24 hours of return confirmation
    Given a rental with returnConfirmedAt 12 hours ago
    When the renter files a dispute for "damage"
    Then the dispute should be created successfully
    And the payout should be frozen

  Scenario: File dispute after 24-hour window closes
    Given a rental with returnConfirmedAt 25 hours ago
    When the renter attempts to file a dispute
    Then the request should be rejected with a 400 error
    And the message should indicate the filing window closed

  Scenario: File no-show dispute on start date
    Given an approved rental with startDate today
    And returnConfirmedAt is not set
    When the owner files a dispute for "renter_no_show"
    Then the dispute should be created successfully
    And the payout should be frozen

  Scenario: Attempt dispute before rental starts
    Given an approved rental with startDate tomorrow
    When the renter attempts to file a dispute
    Then the request should be rejected
    And the message should indicate disputes can be filed from the start date

  Scenario: Exactly 24-hour boundary
    Given a rental with returnConfirmedAt exactly 24 hours ago
    When the renter files a dispute
    Then the dispute should be created (boundary: ≤24h)
```

### Feature: Dispute Resolution with Financial Operations

```gherkin
Feature: Dispute Resolution with Financial Operations
  As an admin
  I want to resolve disputes and have the correct financial operations executed
  So that payouts align with the resolution outcome

  Scenario: Resolve in favor of provider — deposit captured
    Given an open dispute for a rental with a held deposit
    When the admin resolves with outcome "favor_provider"
    Then the deposit should be captured via Stripe
    And depositHoldStatus should be "captured"
    And depositCapturedAt should be set
    And ownerTransferStatus should be set to "pending"
    And both parties should be notified of the resolution

  Scenario: Resolve in favor of renter — deposit released
    Given an open dispute for a rental with a held deposit
    When the admin resolves with outcome "favor_renter"
    Then the deposit should be released via Stripe
    And depositHoldStatus should be "released"
    And ownerTransferStatus should be set to "pending"
    And the owner transfer should be for rental amount only

  Scenario: Resolve favor_provider with expired deposit
    Given an open dispute for a rental with depositHoldStatus "expired"
    When the admin resolves with outcome "favor_provider"
    Then capture should be skipped
    And the financial operation should be recorded as skipped
    And the dispute should still be resolved
    And ownerTransferStatus should be "pending" (rental amount only)
    And an OPS_ALERT should be sent

  Scenario: Deposit capture fails during resolution
    Given an open dispute with a held deposit
    And Stripe will fail on the capture call
    When the admin resolves with outcome "favor_provider"
    Then the financial operation should be recorded as "failed"
    And the dispute should NOT be marked as resolved
    And ownerTransferStatus should remain "frozen"
    And an OPS_ALERT should be sent

  Scenario: Partial capture for partial_provider
    Given an open dispute with a held deposit of $200
    When the admin resolves with outcome "partial_provider" and amount $100
    Then Stripe should capture $100 of the $200 hold
    And depositHoldStatus should be "captured"
    And the owner transfer should include rental amount + $100
```

### Feature: Stripe Chargeback Handling

```gherkin
Feature: Stripe Chargeback Handling
  As the platform
  I want to track Stripe chargebacks and submit evidence
  So that invalid chargebacks can be contested

  Scenario: Chargeback on rental with existing dispute
    Given a rental with an open internal dispute
    When a charge.dispute.created webhook arrives for that rental's charge
    Then the stripeChargebackId should be set on the internal dispute
    And the payout should be frozen
    And an OPS_ALERT should be sent

  Scenario: Chargeback on rental without existing dispute
    Given a rental with no internal dispute
    When a charge.dispute.created webhook arrives
    Then an internal dispute should be auto-created
    And the stripeChargebackId should be set
    And the payout should be frozen
    And an OPS_ALERT should be sent

  Scenario: Submit evidence for chargeback
    Given an internal dispute linked to a Stripe chargeback
    When the admin submits evidence
    Then stripe.disputes.update() should be called
    And the idempotency key should be "chargeback-evidence-{disputeId}"
    And the submission should be audit-logged

  Scenario: Chargeback for unknown charge
    Given a chargeback webhook for a charge not in our system
    When the webhook is processed
    Then the error should be logged
    And the webhook should return 200 (no retry blocking)
```

### Feature: Payout Freeze and Unfreeze

```gherkin
Feature: Payout Freeze and Unfreeze
  As the platform
  I want payouts frozen when a dispute is filed and unfrozen when resolved
  So that funds are held during dispute resolution

  Scenario: Payout frozen on dispute creation
    Given a completed rental with ownerTransferStatus "pending"
    When a dispute is filed
    Then ownerTransferStatus should be "frozen"
    And the payout cron should skip this rental

  Scenario: Payout unfrozen after resolution
    Given a rental with ownerTransferStatus "frozen"
    And an open dispute
    When the dispute is resolved (any outcome)
    Then ownerTransferStatus should be "pending"
    And the payout cron should be able to process the rental

  Scenario: Unfreeze is idempotent
    Given a rental with ownerTransferStatus "pending" (already unfrozen)
    When unfreeze is called again
    Then no change should occur (no-op)
```

## Performance Tests

### Performance Test Cases

1. **Dispute Creation Performance**
   - Test: Dispute creation (validation + insert + freeze + notification) completes within 5 seconds
   - Method: Measure API response time
   - Target: < 5 seconds (95th percentile)

2. **Resolution Performance**
   - Test: Resolution (financial ops + resolve + unfreeze + notification) completes within 15 seconds
   - Method: Measure API response time including Stripe calls
   - Target: < 15 seconds (95th percentile)

3. **Chargeback Webhook Performance**
   - Test: `charge.dispute.created` webhook processed and returns HTTP 200 within 5 seconds
   - Method: Measure webhook handler response time
   - Target: < 5 seconds (95th percentile)

4. **Client Button Visibility Performance**
   - Test: `canFileDispute` computation does not introduce noticeable delay
   - Method: Measure render time with and without computation
   - Target: < 16ms (one frame)

5. **Filing Window Validation Performance**
   - Test: Server-side filing window validation completes within 500ms
   - Method: Measure DAL query + validation time
   - Target: < 500ms (95th percentile)

## Security Tests

### Security Test Cases

1. **Authentication Tests**
   - Dispute creation requires authenticated user (401)
   - Resolve endpoint requires authenticated admin (401/403)
   - Evidence upload requires authenticated party to the dispute (401/403)
   - Chargeback evidence requires authenticated admin (401/403)
   - Webhook endpoint verifies Stripe signatures

2. **Authorization Tests**
   - Only renter or owner can create dispute for their rental (403 for others)
   - Only admins can resolve disputes (403 for non-admins)
   - Only admins can submit chargeback evidence (403)
   - Evidence upload limited to renter/owner/admin roles

3. **Data Protection Tests**
   - Stripe secret keys never logged or exposed in error messages
   - Idempotency keys do not leak sensitive information
   - Financial amounts logged without PII
   - Chargeback evidence mapped without exposing internal system structure

4. **Financial Safety Tests**
   - No duplicate deposit captures (idempotency key + DB status gate)
   - Deposit capture amount never exceeds auth hold amount
   - Payout stays frozen until financial operations succeed
   - Cancelled rental's lifecycle correctly frozen on dispute
   - Partial capture amount validated (> 0, <= hold amount)

## Error Handling Tests

### Error Handling Test Cases

1. **Stripe Capture Errors**
   - `StripeInvalidRequestError` (e.g. hold expired, already captured) → financial op failed, ops alerted
   - `StripeAPIError` → financial op failed, ops alerted
   - Capture failure does NOT resolve dispute or unfreeze payout

2. **Stripe Release Errors**
   - Release fails → `release_failed`, ops alerted, resolution still proceeds

3. **Stripe Chargeback Evidence Errors**
   - `stripe.disputes.update()` fails → logged, ops alerted, audit recorded
   - Dispute without `stripeChargebackId` → `ValidationError`

4. **Partial Failure Scenarios**
   - Financial op succeeds but resolve DB update fails → financial op recorded, error returned, ops can retry
   - Financial op succeeds, resolve succeeds, but unfreeze fails → dispute resolved, lifecycle stuck frozen, ops alerted
   - All success but notifications fail → non-critical, dispute resolved

5. **Database Errors**
   - `freezeForDispute` fails → dispute still created, logged, ops alerted
   - `unfreezeAfterResolution` fails → dispute resolved, lifecycle stuck frozen, logged

6. **Concurrent Operations**
   - Two dispute creation requests for same rental → one succeeds, one fails (unique constraint)
   - Two resolution requests for same dispute → one succeeds, one fails (status check)

## Test Data Requirements

### Test Fixtures

1. **Users**
   - Renter user with Stripe customer ID and payment method
   - Owner user with Stripe Connected Account
   - Admin user
   - Unrelated user (for authorization tests)

2. **Rentals**
   - Approved rental with `startDate` in the past (no-show window open)
   - Approved rental with `startDate` in the future (no-show window closed)
   - Active rental
   - Completed rental with `returnConfirmedAt` 12h ago (within window)
   - Completed rental with `returnConfirmedAt` 25h ago (expired window)
   - Completed rental with `returnConfirmedAt` exactly 24h ago (boundary)
   - Cancelled rental

3. **Disputes**
   - Open dispute (for resolution tests)
   - Dispute with `stripeChargebackId` (for evidence tests)
   - Resolved dispute (for idempotency tests)
   - Dispute in `evidence_requested` state (for evidence upload tests)

4. **Lifecycle Records**
   - `depositHoldStatus='held'` with known deposit PI ID
   - `depositHoldStatus='expired'` (capture skip tests)
   - `depositHoldStatus='released'` (capture skip tests)
   - `depositHoldStatus='not_applicable'`
   - `ownerTransferStatus='pending'` (for freeze tests)
   - `ownerTransferStatus='frozen'` (for unfreeze tests)

5. **Payments**
   - Payment with known charge ID (for chargeback lookup)
   - Payment with `status='succeeded'`

### Mocking Strategy

- **Stripe API**: Mock `paymentIntents.capture`, `paymentIntents.cancel`, `disputes.update`
- **DALs**: Mock `disputeDAL`, `paymentDAL`, `paymentLifecycleDAL`, `rentalDAL` for unit tests
- **Notifications**: Mock notification sending (verify called with correct params)
- **OPS Alerts**: Mock `sendOpsAlert` (verify called with correct event and metadata)
- **Auth**: Mock `getCurrentUserId`, `getAuthenticatedUserResponse`, admin role checks

### Test Execution

- Run unit tests: `bun run test:unit`
- Run integration tests: `bun run test:integration`
- Run all tests: `bun run test`
- Run tests with coverage: `bun run test:coverage`
- Run specific Phase 3 tests: `bun run test -- --grep "dispute|chargeback|filing-window|resolution"`

## Coverage Goals

- **Overall Phase 3 Coverage**: 90%+
- **DisputeCreationService**: 95%+
- **DisputeResolutionService**: 95%+
- **StripeDisputeService (enhanced)**: 95%+
- **ChargebackService**: 90%+
- **Filing Window Validation**: 100%
- **Outcome Mapping Helper**: 100%
- **DAL Extensions**: 90%+
- **Dispute Creation Route**: 85%+
- **Resolve Route**: 85%+
- **Chargeback Webhook Handlers**: 90%+
- **Client canFileDispute Logic**: 100%

## Test Maintenance

- Update tests when Phase 4 (operational tooling) adds admin dashboard features
- Add regression tests for any bugs found in production
- Keep Stripe mock data aligned with actual Stripe API responses (especially dispute objects)
- Review filing window tests if the 24-hour policy changes
- Add E2E tests for full dispute lifecycle once Playwright is configured
- Monitor chargeback evidence mapping as Stripe updates evidence requirements

---

_Last updated: March 15, 2026 | Internal use only_
