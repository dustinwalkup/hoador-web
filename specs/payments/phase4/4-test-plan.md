# Stripe Connect Payment Lifecycle (Phase 4) - Operational Tooling - Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/payments/phase4/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Payment Lifecycle Dashboard

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 1

**Test Coverage**:

#### Admin List API

- Integration tests: GET `/api/admin/payments/lifecycle` returns paginated results with rental/user context
- Integration tests: Filter by `depositHoldStatus=failed` returns only matching records
- Integration tests: Filter by `ownerTransferStatus=frozen` returns only matching records
- Integration tests: Filter by `payoutStatus=processing` returns only matching records
- Integration tests: Multiple status filters (e.g. `payoutStatus=failed,processing`) returns union
- Integration tests: Search by rental id returns matching records
- Integration tests: Search by owner id returns matching records
- Integration tests: Pagination: page=1 returns first page, page=2 returns second page
- Integration tests: Non-admin user → 403
- Integration tests: Unauthenticated → 401

#### Admin List UI

- Client tests: URL search params sync — changing filter updates URL
- Client tests: URL search params sync — navigating to URL with params pre-fills filters
- Client tests: Debounced search — typing triggers fetch after 300ms debounce
- Client tests: Clicking a row navigates to detail page (`/admin/dashboard/payments/[rentalId]`)
- Client tests: Status badges render with correct colors (green/red/yellow/blue)
- Client tests: Pagination controls update URL page param
- Client tests: Loading skeleton shown while fetching

### Requirement 2: Payment Lifecycle Detail View

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 2

**Test Coverage**:

#### Detail API

- Integration tests: GET `/api/admin/payments/lifecycle/[rentalId]` returns full lifecycle with rental details, Stripe IDs, timestamps
- Integration tests: Detail includes `rentalChargeId`, `stripeTransferId`, `securityDepositAuthId`
- Integration tests: Detail includes linked dispute summary when dispute exists
- Integration tests: Detail includes `null` dispute when no dispute exists
- Integration tests: Detail includes recent audit log entries for the rental
- Integration tests: Non-existent rental id → 404
- Integration tests: Non-admin user → 403

#### Detail UI

- Client tests: Status summary bar shows all three statuses with correct badges
- Client tests: Payment timeline renders events in chronological order
- Client tests: Stripe IDs displayed and copyable
- Client tests: Dispute link navigates to dispute review page when dispute exists
- Client tests: Override action buttons visible based on current status (see Req 6, 7, 8 tests)
- Client tests: Audit log section displays entries with admin name, action, timestamps, reason

### Requirement 3: Payment Metrics and Aggregates

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 3

**Test Coverage**:

#### Metrics API

- Integration tests: GET `/api/admin/payments/metrics` returns all aggregate counts
- Integration tests: Counts match actual data — create lifecycle records with known statuses, verify counts
- Integration tests: All status values represented: payoutPending, payoutProcessing, payoutCompleted, payoutFailed, transferPending, transferCompleted, transferFailed, transferFrozen, depositScheduled, depositHeld, depositReleased, depositExpired, depositFailed, depositCaptured, depositNotApplicable
- Integration tests: Empty table returns all zeros
- Integration tests: Non-admin user → 403

#### Metrics UI

- Client tests: Metric cards render for all three groups (Payouts, Transfers, Deposits)
- Client tests: Cards with non-zero failed/frozen/expired counts are highlighted
- Client tests: Loading skeleton shown while fetching
- Client tests: Zero counts display correctly (no missing cards)

### Requirement 4: Stale Processing Detection

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 4

**Test Coverage**:

#### Detection Logic

- Unit tests: `findStaleProcessingRecords(60)` returns records with `payoutStatus='processing'` and `updatedAt` older than 60 minutes
- Unit tests: `findStaleProcessingRecords(60)` does NOT return records with `payoutStatus='processing'` and `updatedAt` within 60 minutes (legitimate in-progress)
- Unit tests: `findStaleProcessingRecords(60)` does NOT return records with `payoutStatus='pending'` or `'completed'` or `'failed'`
- Unit tests: Configurable threshold from `STALE_PROCESSING_THRESHOLD_MINUTES` env var
- Unit tests: Default threshold is 60 minutes when env var not set

#### Detection Service

- Unit tests: `detectStaleProcessing()` calls `findStaleProcessingRecords()` with correct threshold
- Unit tests: Stale records found → `sendOpsAlert()` called with `event: 'stale_processing_detected'`, rental ids, count
- Unit tests: No stale records → `sendOpsAlert()` NOT called, returns `{ staleCount: 0 }`
- Unit tests: Detection does NOT modify any lifecycle records (read-only)

#### Cron Route

- Integration tests: GET `/api/cron/detect-stale-processing` with valid cron secret → 200, returns staleCount
- Integration tests: Cron run recorded in `cron_run_history` after detection completes
- Integration tests: Missing cron secret → 401
- Integration tests: Detection error → 500, cron run recorded as failure

### Requirement 5: Stale Processing Alerts

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: Alert includes `event: 'stale_processing_detected'`
- Unit tests: Alert includes count of stale records and array of rental ids
- Unit tests: Alert sent with `sendEmailAlert: true`
- Unit tests: Alert logged with structured fields (`alertType: 'ops'`, `event`, `rentalIds`, `count`)
- Unit tests: One email per detection run (not per stale record)
- Integration tests: Stale detection cron with stale records → ops alert email triggered (mock)

### Requirement 6: Manual Payout Status Reset

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 6

**Test Coverage**:

#### Service

- Unit tests: `resetPayoutStatus()` with `payoutStatus='processing'` → resets to `'pending'`, returns `{ success: true, previousStatus: 'processing', newStatus: 'pending' }`
- Unit tests: `resetPayoutStatus()` with `payoutStatus='failed'` → resets to `'pending'`
- Unit tests: `resetPayoutStatus()` with `payoutStatus='completed'` → throws `ValidationError`
- Unit tests: `resetPayoutStatus()` with `payoutStatus='pending'` → throws `ValidationError`
- Unit tests: `resetPayoutStatus()` with non-existent rental → throws `NotFoundError`
- Unit tests: Audit log created with `entityType: 'payment_lifecycle'`, `action: 'payout_status_reset'`, `metadata` containing previous/new status and reason
- Unit tests: No Stripe API calls made during reset

#### Route

- Integration tests: POST `/api/admin/payments/lifecycle/[rentalId]/reset-payout-status` with valid state → 200
- Integration tests: POST with reason in body → reason stored in audit log
- Integration tests: POST with invalid state → 400 with clear message
- Integration tests: POST with non-existent rental → 404
- Integration tests: POST by non-admin → 403
- Integration tests: POST unauthenticated → 401

#### UI

- Client tests: "Reset Payout Status" button visible when `payoutStatus` is `'processing'` or `'failed'`
- Client tests: "Reset Payout Status" button hidden when `payoutStatus` is `'pending'` or `'completed'`
- Client tests: Clicking button opens confirmation dialog with optional reason input
- Client tests: Confirming dialog calls mutation, shows success toast, refreshes data
- Client tests: Error from API shown as error toast

### Requirement 7: Manual Owner Transfer Retry

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 7

**Test Coverage**:

#### Service

- Unit tests: `resetTransferStatus()` with `ownerTransferStatus='failed'` → resets to `'pending'`
- Unit tests: `resetTransferStatus()` with `ownerTransferStatus='failed'` AND `payoutStatus='failed'` → both reset to `'pending'`
- Unit tests: `resetTransferStatus()` with `ownerTransferStatus='failed'` AND `payoutStatus='processing'` → only transfer reset, payout unchanged
- Unit tests: `resetTransferStatus()` with `ownerTransferStatus='pending'` → throws `ValidationError`
- Unit tests: `resetTransferStatus()` with `ownerTransferStatus='frozen'` → throws `ValidationError`
- Unit tests: `resetTransferStatus()` with `ownerTransferStatus='completed'` → throws `ValidationError`
- Unit tests: Audit log created with metadata containing both previous statuses
- Unit tests: No Stripe API calls made during reset

#### Route

- Integration tests: POST `/api/admin/payments/lifecycle/[rentalId]/reset-transfer-status` with valid state → 200
- Integration tests: POST with invalid state → 400
- Integration tests: POST by non-admin → 403

#### UI

- Client tests: "Reset Transfer Status" button visible only when `ownerTransferStatus` is `'failed'`
- Client tests: Button hidden for `'pending'`, `'processing'`, `'completed'`, `'frozen'`
- Client tests: Confirmation dialog with reason input

### Requirement 8: Manual Deposit Hold Release

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 8

**Test Coverage**:

#### Service — Success Path

- Unit tests: `releaseDeposit()` with `depositHoldStatus='held'` → calls `stripe.paymentIntents.cancel()` on the correct PaymentIntent ID
- Unit tests: Stripe cancel succeeds → `depositHoldStatus` set to `'released'`, `depositReleasedAt` set
- Unit tests: Audit log created with `action: 'manual_deposit_release'`, `status: 'succeeded'`
- Unit tests: Renter notification sent after successful release

#### Service — Stripe Already Canceled

- Unit tests: Stripe returns `payment_intent_unexpected_state` with "canceled" → treated as success
- Unit tests: Local state still updated to `'released'` and `depositReleasedAt` set
- Unit tests: Audit log records success with note `'already_canceled'`

#### Service — Stripe Failure

- Unit tests: Stripe returns other error → local state NOT updated (remains `'held'`)
- Unit tests: Audit log created with `status: 'failed'` and error message
- Unit tests: `sendOpsAlert()` called with `event: 'manual_deposit_release_failed'`
- Unit tests: Returns `{ success: false, error: message }`

#### Service — Validation

- Unit tests: `depositHoldStatus='released'` → throws `ValidationError`
- Unit tests: `depositHoldStatus='expired'` → throws `ValidationError`
- Unit tests: `depositHoldStatus='not_applicable'` → throws `ValidationError`
- Unit tests: `depositHoldStatus='scheduled'` → throws `ValidationError`
- Unit tests: Missing `securityDepositAuthId` on rental → throws `NotFoundError`
- Unit tests: Non-existent lifecycle record → throws `NotFoundError`

#### Route

- Integration tests: POST `/api/admin/payments/lifecycle/[rentalId]/release-deposit` with held deposit → 200 (mock Stripe)
- Integration tests: POST with invalid state → 400
- Integration tests: Stripe failure → returns error (500 or error in response)
- Integration tests: POST by non-admin → 403

#### UI

- Client tests: "Release Deposit" button visible only when `depositHoldStatus` is `'held'`
- Client tests: Button hidden for all other deposit statuses
- Client tests: Confirmation dialog with reason input

### Requirement 9: Cron Run History

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 9

**Test Coverage**:

#### Schema

- Schema tests: `cron_run_history` table created with correct columns (jobName, startedAt, completedAt, status, recordsEligible, recordsSucceeded, recordsFailed, errorMessage, metadata)
- Schema tests: Indexes on `jobName` and `startedAt`
- Migration tests: Migration is additive, backward-compatible

#### DAL

- Unit tests: `CronRunHistoryDAL.create()` inserts a record
- Unit tests: `CronRunHistoryDAL.getRecent()` returns records ordered by `startedAt` desc
- Unit tests: `CronRunHistoryDAL.getRecent('process-payouts')` filters by job name
- Unit tests: `CronRunHistoryDAL.getRecent(undefined, 10)` limits to 10 records

#### Service

- Unit tests: `CronRunHistoryService.recordRun()` calls `cronRunHistoryDAL.create()` with correct params
- Unit tests: `CronRunHistoryService.recordRun()` — DAL throws → error logged via `getLogger().error()`, does NOT propagate
- Unit tests: `CronRunHistoryService.getRecentRuns()` delegates to DAL

#### Recording in Existing Crons

- Integration tests: `process-payouts` cron writes history record on success with `status: 'success'`
- Integration tests: `process-payouts` cron writes history record on failure with `status: 'failure'` and errorMessage
- Integration tests: `process-payouts` cron with partial failures writes `status: 'partial'`
- Integration tests: `schedule-deposit-holds` cron writes history record
- Integration tests: `monitor-deposit-expiry` cron writes history record
- Integration tests: `detect-stale-processing` cron writes history record
- Integration tests: History write failure does NOT prevent cron from completing its payment operations

#### Admin API

- Integration tests: GET `/api/admin/payments/cron-history` returns recent runs
- Integration tests: GET with `jobName=process-payouts` filters by job
- Integration tests: GET with `limit=10` limits results
- Integration tests: Non-admin user → 403

#### Admin UI

- Client tests: Cron history table renders with correct columns (Job, Started, Completed, Duration, Status, Eligible, Succeeded, Failed)
- Client tests: Job name filter dropdown works
- Client tests: Status badges color-coded (green=success, yellow=partial, red=failure)
- Client tests: Failed rows expandable to show error message

### Requirement 10: Admin Audit Logging

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 10

**Test Coverage**:

- Unit tests: `resetPayoutStatus()` creates audit log with `entityType: 'payment_lifecycle'`, `entityId: rentalId`, `action: 'payout_status_reset'`, `userId: adminId`
- Unit tests: `resetTransferStatus()` creates audit log with `action: 'owner_transfer_status_reset'`
- Unit tests: `releaseDeposit()` creates audit log with `action: 'manual_deposit_release'` on success
- Unit tests: `releaseDeposit()` creates audit log with `status: 'failed'` on Stripe failure
- Unit tests: All audit entries include `metadata` with `previousStatus`, `newStatus`, `reason`
- Unit tests: Audit entries include admin user id
- Integration tests: After override, audit log entry visible in lifecycle detail API response
- Integration tests: Audit log entries not deletable via any API

### Requirement 11: Notifications for Manual Actions

**Requirement Reference**: `specs/payments/phase4/1-requirements.md` - Requirement 11

**Test Coverage**:

- Unit tests: `releaseDeposit()` success → notification sent to renter
- Unit tests: `releaseDeposit()` failure → no notification sent to renter
- Unit tests: `resetPayoutStatus()` → optional owner notification (if implemented)
- Unit tests: `resetTransferStatus()` → optional owner notification (if implemented)
- Unit tests: Notification failure is non-critical — override still succeeds
- Unit tests: Notifications use existing infrastructure (`sendNotification` or equivalent)
- Unit tests: Notification NOT sent to the other party (e.g. renter not notified on transfer reset)

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and services in isolation.

**Framework**: Vitest

**Coverage Goals**: 90%+ for business logic (services, DAL), 100% for override state validation logic

**Areas to Test**:

- **PaymentLifecycleAdminService**: Mock DALs, Stripe, notifications; test all three override methods (valid/invalid states, error handling, audit logging)
- **StaleProcessingDetectionService**: Mock DAL and ops alert; test threshold config, stale vs. non-stale, alert triggering
- **CronRunHistoryService**: Mock DAL; test record write success/failure isolation
- **PaymentLifecycleDAL extensions**: Mock database; test admin list query, detail query, metrics aggregation, stale query
- **CronRunHistoryDAL**: Mock database; test create, getRecent with/without filter

**Test Structure** (AAA Pattern):

```typescript
describe("PaymentLifecycleAdminService", () => {
  describe("resetPayoutStatus", () => {
    it("should reset payoutStatus from processing to pending", async () => {
      // Arrange
      const lifecycle = createMockLifecycle({
        rentalId: "rental-1",
        payoutStatus: "processing",
      });
      vi.spyOn(paymentLifecycleDAL, "getByRentalId").mockResolvedValue(
        lifecycle,
      );
      vi.spyOn(paymentLifecycleDAL, "updatePayoutStatus").mockResolvedValue(
        undefined,
      );
      vi.spyOn(auditLogDAL, "create").mockResolvedValue(undefined);

      // Act
      const result = await PaymentLifecycleAdminService.resetPayoutStatus(
        "rental-1",
        "admin-1",
        "Cron crashed, retrying",
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe("processing");
      expect(result.newStatus).toBe("pending");
      expect(paymentLifecycleDAL.updatePayoutStatus).toHaveBeenCalledWith(
        "rental-1",
        "pending",
      );
      expect(auditLogDAL.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "payment_lifecycle",
          action: "payout_status_reset",
          userId: "admin-1",
        }),
      );
    });

    it("should throw ValidationError for completed status", async () => {
      // Arrange
      const lifecycle = createMockLifecycle({
        payoutStatus: "completed",
      });
      vi.spyOn(paymentLifecycleDAL, "getByRentalId").mockResolvedValue(
        lifecycle,
      );

      // Act & Assert
      await expect(
        PaymentLifecycleAdminService.resetPayoutStatus("rental-1", "admin-1"),
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Tests

**Purpose**: Test component interactions and data flow between layers (route → service → DAL → Stripe).

**Framework**: Vitest with mocked Stripe and mocked/test DAL

**Coverage Goals**: All critical override flows, 85%+ for integration points

**Areas to Test**:

- **Admin list/detail/metrics routes**: Auth checks, filter parsing, pagination, 404 for missing records
- **Override routes → service → DAL**: Full flow from HTTP request to DB update and audit log
- **Deposit release route → service → Stripe → DAL**: Stripe mock success/failure, lifecycle update
- **Stale detection cron route → service → DAL → ops alert**: Full detection flow with history recording
- **Cron history recording**: Existing crons write history on success/failure/partial
- **Error propagation**: Service errors mapped to correct HTTP responses (400, 403, 404, 500)

**Test Structure**:

```typescript
describe("POST /api/admin/payments/lifecycle/[rentalId]/reset-payout-status", () => {
  it("should reset processing status and create audit log", async () => {
    // Arrange
    mockAuth(adminId, { isAdmin: true });
    setupMockLifecycle({ rentalId, payoutStatus: "processing" });

    // Act
    const response = await POST(request, {
      params: Promise.resolve({ rentalId }),
    });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.previousStatus).toBe("processing");
    expect(body.newStatus).toBe("pending");
    expect(paymentLifecycleDAL.updatePayoutStatus).toHaveBeenCalledWith(
      rentalId,
      "pending",
    );
    expect(auditLogDAL.create).toHaveBeenCalled();
  });

  it("should return 403 for non-admin", async () => {
    // Arrange
    mockAuth(userId, { isAdmin: false });

    // Act
    const response = await POST(request, {
      params: Promise.resolve({ rentalId }),
    });

    // Assert
    expect(response.status).toBe(403);
  });
});
```

## Test Scenarios by Component

### PaymentLifecycleAdminService Tests

**File**: `src/features/admin/services/__tests__/payment-lifecycle-admin-service.test.ts`

#### resetPayoutStatus

1. `payoutStatus='processing'` → reset to `'pending'`, audit logged
2. `payoutStatus='failed'` → reset to `'pending'`, audit logged
3. `payoutStatus='completed'` → `ValidationError`
4. `payoutStatus='pending'` → `ValidationError`
5. Lifecycle not found → `NotFoundError`
6. Audit log contains admin id, previous status, new status, reason

#### resetTransferStatus

7. `ownerTransferStatus='failed'` → reset to `'pending'`, audit logged
8. `ownerTransferStatus='failed'` + `payoutStatus='failed'` → both reset to `'pending'`
9. `ownerTransferStatus='failed'` + `payoutStatus='processing'` → only transfer reset
10. `ownerTransferStatus='pending'` → `ValidationError`
11. `ownerTransferStatus='frozen'` → `ValidationError`
12. `ownerTransferStatus='completed'` → `ValidationError`

#### releaseDeposit

13. `depositHoldStatus='held'` → Stripe cancel succeeds → `'released'`, `depositReleasedAt` set, audit logged
14. `depositHoldStatus='held'` → Stripe says "already canceled" → `'released'`, audit logged with note
15. `depositHoldStatus='held'` → Stripe real error → `'held'` unchanged, audit logged as failed, ops alert, `{ success: false }`
16. `depositHoldStatus='released'` → `ValidationError`
17. `depositHoldStatus='expired'` → `ValidationError`
18. `depositHoldStatus='not_applicable'` → `ValidationError`
19. Missing `securityDepositAuthId` → `NotFoundError`
20. Renter notified on successful release
21. Renter NOT notified on failure

#### getLifecycleList

22. Returns paginated results from DAL
23. Passes filters correctly to DAL

#### getLifecycleDetail

24. Returns detail from DAL
25. Throws `NotFoundError` when DAL returns null

#### getPaymentMetrics

26. Returns metrics from DAL

### StaleProcessingDetectionService Tests

**File**: `src/features/admin/services/__tests__/stale-processing-detection-service.test.ts`

1. Stale records found → `sendOpsAlert()` called with `event: 'stale_processing_detected'`, `sendEmailAlert: true`
2. Alert includes rental ids and count in metadata
3. No stale records → no alert sent, returns `{ staleCount: 0 }`
4. Threshold from `STALE_PROCESSING_THRESHOLD_MINUTES` env var used when set
5. Default threshold of 60 minutes when env var not set
6. Detection does not modify any records

### CronRunHistoryService Tests

**File**: `src/features/admin/services/__tests__/cron-run-history-service.test.ts`

1. `recordRun()` success → `cronRunHistoryDAL.create()` called with correct data
2. `recordRun()` DAL throws → error logged, does NOT propagate (no exception thrown)
3. `recordRun()` serializes metadata to JSON string
4. `getRecentRuns()` delegates to `cronRunHistoryDAL.getRecent()`
5. `getRecentRuns('process-payouts', 10)` passes params correctly

### PaymentLifecycleDAL Extension Tests

**File**: `src/dal/__tests__/payment-lifecycle.dal.test.ts` (extend existing)

1. `getLifecycleListForAdmin()` — returns records with joins (renter name, owner name, listing name)
2. `getLifecycleListForAdmin()` — filters by single `depositHoldStatus` value
3. `getLifecycleListForAdmin()` — filters by multiple `payoutStatus` values (IN clause)
4. `getLifecycleListForAdmin()` — search by partial rental id (ILIKE)
5. `getLifecycleListForAdmin()` — pagination returns correct offset and total count
6. `getLifecycleListForAdmin()` — no filters returns all records ordered by `updatedAt` desc
7. `getLifecycleDetailForAdmin()` — returns full detail with dispute and audit logs
8. `getLifecycleDetailForAdmin()` — returns null for non-existent rental
9. `getPaymentMetrics()` — returns correct counts for each status
10. `getPaymentMetrics()` — returns zeros for empty table
11. `findStaleProcessingRecords(60)` — returns records with `payoutStatus='processing'` older than threshold
12. `findStaleProcessingRecords(60)` — excludes records within threshold
13. `findStaleProcessingRecords(60)` — excludes non-processing records

### CronRunHistoryDAL Tests

**File**: `src/dal/__tests__/cron-run-history.dal.test.ts`

1. `create()` inserts record with all fields
2. `getRecent()` returns records ordered by `startedAt` desc
3. `getRecent('process-payouts')` filters by job name
4. `getRecent(undefined, 5)` limits results to 5
5. `getRecent()` with no records returns empty array

### Admin Read Route Tests

**File**: `src/app/api/admin/payments/__tests__/lifecycle.test.ts`

#### Lifecycle List

1. GET lifecycle list → 200, paginated results
2. GET with filter params → correct filter applied
3. GET with search param → search applied
4. GET non-admin → 403
5. GET unauthenticated → 401

#### Lifecycle Detail

6. GET detail for existing rental → 200, full detail
7. GET detail for non-existent rental → 404
8. GET detail non-admin → 403

#### Metrics

9. GET metrics → 200, all counts present
10. GET metrics non-admin → 403

#### Cron History

11. GET cron history → 200, list of runs
12. GET with jobName filter → filtered results
13. GET non-admin → 403

### Admin Override Route Tests

**File**: `src/app/api/admin/payments/__tests__/overrides.test.ts`

#### Reset Payout Status

1. POST valid (processing) → 200, reset succeeds
2. POST valid (failed) → 200, reset succeeds
3. POST invalid state (completed) → 400
4. POST not found → 404
5. POST non-admin → 403
6. POST with reason → reason in audit log

#### Reset Transfer Status

7. POST valid (failed) → 200, reset succeeds
8. POST invalid state → 400
9. POST non-admin → 403

#### Release Deposit

10. POST valid (held) → 200, Stripe called, lifecycle updated (mock Stripe)
11. POST Stripe already canceled → 200, local state updated
12. POST Stripe error → error response, lifecycle unchanged
13. POST invalid state (released) → 400
14. POST non-admin → 403

### Stale Detection Cron Tests

**File**: `src/app/api/cron/__tests__/detect-stale-processing.test.ts`

1. GET with valid cron secret + stale records → 200, staleCount > 0, ops alert sent
2. GET with valid cron secret + no stale records → 200, staleCount: 0, no alert
3. GET with valid cron secret → cron run recorded in history
4. GET without cron secret → 401
5. Detection error → 500, cron run recorded as failure

### Cron History Recording Tests

**File**: `src/app/api/cron/__tests__/cron-history-recording.test.ts`

1. `process-payouts` success → history record with `status: 'success'`, correct counts
2. `process-payouts` failure → history record with `status: 'failure'`, errorMessage
3. `process-payouts` partial → history record with `status: 'partial'`
4. `schedule-deposit-holds` → history record written
5. `monitor-deposit-expiry` → history record written
6. History write failure → cron still completes, error logged

## BDD Scenarios

### Feature: Payment Lifecycle Dashboard

```gherkin
Feature: Payment Lifecycle Dashboard
  As an admin
  I want to view and filter payment lifecycle records
  So that I can monitor payment states and find rentals that need attention

  Scenario: View all lifecycle records
    Given I am logged in as an admin
    When I navigate to the Payments section
    Then I should see a paginated list of payment lifecycle records
    And each row should show rental id, renter, owner, deposit status, transfer status, payout status

  Scenario: Filter by failed payout status
    Given I am on the payment lifecycle dashboard
    When I select "failed" in the payout status filter
    Then only records with payoutStatus "failed" should be shown

  Scenario: Search by rental id
    Given I am on the payment lifecycle dashboard
    When I type a rental id in the search box
    Then only matching records should be shown after debounce

  Scenario: Non-admin cannot access
    Given I am logged in as a regular user
    When I attempt to access the payment lifecycle API
    Then I should receive a 403 Forbidden response
```

### Feature: Manual Payout Status Reset

```gherkin
Feature: Manual Payout Status Reset
  As an admin
  I want to reset a stuck payout status
  So that the payout cron can retry the rental

  Scenario: Reset from processing to pending
    Given a rental with payoutStatus "processing"
    When an admin resets the payout status with reason "Cron crashed"
    Then payoutStatus should be "pending"
    And an audit log entry should be created with the admin id and reason
    And the payout cron should pick up the rental on next run

  Scenario: Reset from failed to pending
    Given a rental with payoutStatus "failed"
    When an admin resets the payout status
    Then payoutStatus should be "pending"
    And an audit log entry should be created

  Scenario: Cannot reset completed status
    Given a rental with payoutStatus "completed"
    When an admin attempts to reset the payout status
    Then the request should be rejected with a 400 error
    And the message should indicate completed status cannot be reset

  Scenario: Double reset is rejected
    Given a rental with payoutStatus "pending" (already reset)
    When an admin attempts to reset the payout status again
    Then the request should be rejected with a 400 error
```

### Feature: Manual Deposit Release

```gherkin
Feature: Manual Deposit Release
  As an admin
  I want to force-release a deposit hold
  So that a renter's funds are not held unnecessarily

  Scenario: Release a held deposit
    Given a rental with depositHoldStatus "held"
    When an admin releases the deposit with reason "Dispute resolved manually"
    Then Stripe should cancel the deposit PaymentIntent
    And depositHoldStatus should be "released"
    And depositReleasedAt should be set
    And an audit log entry should be created
    And the renter should be notified

  Scenario: Release when Stripe already canceled the hold
    Given a rental with depositHoldStatus "held" in our DB
    And the PaymentIntent is already canceled in Stripe (expired)
    When an admin releases the deposit
    Then the system should treat it as success
    And depositHoldStatus should be "released"

  Scenario: Release fails due to Stripe error
    Given a rental with depositHoldStatus "held"
    And Stripe will return an error on the cancel call
    When an admin attempts to release the deposit
    Then depositHoldStatus should remain "held"
    And an audit log with status "failed" should be created
    And an OPS_ALERT should be sent
    And the response should indicate failure

  Scenario: Cannot release non-held deposit
    Given a rental with depositHoldStatus "released"
    When an admin attempts to release the deposit
    Then the request should be rejected with a 400 error
```

### Feature: Stale Processing Detection

```gherkin
Feature: Stale Processing Detection
  As the platform
  I want to detect stuck processing records
  So that ops can be alerted and take action

  Scenario: Stale records detected
    Given a rental with payoutStatus "processing" and updatedAt 2 hours ago
    And the stale threshold is 60 minutes
    When the stale detection cron runs
    Then an OPS_ALERT should be sent with the rental id
    And the cron run should be recorded in history

  Scenario: No stale records
    Given all processing records were updated within the last 30 minutes
    And the stale threshold is 60 minutes
    When the stale detection cron runs
    Then no OPS_ALERT should be sent
    And the cron run should be recorded with staleCount 0

  Scenario: Legitimate in-progress record not flagged
    Given a rental with payoutStatus "processing" and updatedAt 10 minutes ago
    And the stale threshold is 60 minutes
    When the stale detection cron runs
    Then the record should NOT be flagged as stale
```

### Feature: Cron Run History

```gherkin
Feature: Cron Run History
  As an admin
  I want to see cron execution history
  So that I can verify crons ran and troubleshoot failures

  Scenario: View recent cron runs
    Given several payment crons have run recently
    When I navigate to the cron history page
    Then I should see a list of recent runs with job name, times, and outcome

  Scenario: Filter by job name
    Given cron history for multiple job types
    When I select "process-payouts" from the job filter
    Then only process-payouts runs should be shown

  Scenario: History write failure does not block cron
    Given the cron_run_history table is temporarily unavailable
    When the process-payouts cron runs
    Then the cron should still complete its payment operations
    And the history write failure should be logged
```

## Performance Tests

### Performance Test Cases

1. **Lifecycle List Performance**
   - Test: Admin lifecycle list API returns paginated results within 3 seconds
   - Method: Measure API response time with various filter combinations
   - Target: < 3 seconds (95th percentile) for 20-50 record pages

2. **Lifecycle Detail Performance**
   - Test: Admin lifecycle detail API returns within 2 seconds
   - Method: Measure API response time including joins
   - Target: < 2 seconds (95th percentile)

3. **Payment Metrics Performance**
   - Test: Metrics API returns within 2 seconds
   - Method: Measure aggregate query time
   - Target: < 2 seconds (95th percentile)

4. **Override API Performance**
   - Test: Override APIs complete within 10 seconds
   - Method: Measure response time for reset and release operations
   - Target: < 10 seconds (95th percentile); deposit release depends on Stripe latency

5. **Stale Detection Performance**
   - Test: Stale detection cron completes within 60 seconds
   - Method: Measure full detection cycle
   - Target: < 60 seconds for expected volume

6. **Cron History Write Performance**
   - Test: History recording does not add more than 500ms to cron execution
   - Method: Measure time added by `recordRun()` call
   - Target: < 500ms additional latency

## Security Tests

### Security Test Cases

1. **Authentication Tests**
   - All admin payment APIs require authenticated user (401 for unauthenticated)
   - Cron endpoints require `CRON_SECRET` bearer token (401 for missing/invalid)

2. **Authorization Tests**
   - All admin payment APIs require admin role (403 for non-admin)
   - Override APIs require admin role (403 for non-admin)
   - Cron history API requires admin role (403 for non-admin)
   - Non-admin users cannot view lifecycle data, metrics, or cron history

3. **Data Protection Tests**
   - Stripe PaymentIntent IDs displayed but not secret keys
   - Audit log reason text does not leak sensitive information
   - Override operations logged with admin attribution

4. **Financial Safety Tests**
   - Payout status reset only from `'processing'` or `'failed'` (not `'completed'`)
   - Transfer status reset only from `'failed'` (not `'completed'` or `'frozen'`)
   - Deposit release only from `'held'` (not `'released'`, `'captured'`, etc.)
   - Stale detection is read-only (does not modify records)

## Error Handling Tests

### Error Handling Test Cases

1. **Override Validation Errors**
   - Reset payout status from invalid state → 400 with message
   - Reset transfer status from invalid state → 400 with message
   - Release deposit from invalid state → 400 with message
   - Non-existent rental → 404

2. **Stripe Errors for Deposit Release**
   - `payment_intent_unexpected_state` (already canceled) → treated as success
   - Other Stripe errors → failure recorded, ops alert, `{ success: false }`
   - Stripe timeout → same as other errors

3. **Cron History Failures**
   - `CronRunHistoryService.recordRun()` failure → logged, cron continues
   - Database connection error during history write → same behavior

4. **Stale Detection Errors**
   - DAL query fails → cron returns 500, failure recorded in history
   - Ops alert send failure → logged, does not block cron response

5. **Concurrent Override Operations**
   - Two admins reset same rental simultaneously → both succeed (idempotent, status ends as `'pending'`)
   - Admin resets while cron is processing → cron's atomic claim prevents double processing

## Test Data Requirements

### Test Fixtures

1. **Users**
   - Admin user (for override and view tests)
   - Non-admin user (for authorization tests)
   - Renter user (for notification tests)
   - Owner user with Stripe Connected Account (for notification tests)

2. **Lifecycle Records**
   - `payoutStatus='processing'` with `updatedAt` 2 hours ago (stale)
   - `payoutStatus='processing'` with `updatedAt` 10 minutes ago (not stale)
   - `payoutStatus='failed'` (for reset tests)
   - `payoutStatus='completed'` (for validation tests)
   - `payoutStatus='pending'` (for validation tests)
   - `ownerTransferStatus='failed'` (for transfer reset)
   - `ownerTransferStatus='frozen'` (for validation tests)
   - `depositHoldStatus='held'` with known deposit PI ID (for release tests)
   - `depositHoldStatus='released'` (for validation tests)
   - `depositHoldStatus='expired'` (for validation tests)
   - `depositHoldStatus='not_applicable'` (for validation tests)

3. **Rentals**
   - Rental with `securityDepositAuthId` set (for deposit release)
   - Rental without `securityDepositAuthId` (for error case)
   - Rental with linked dispute (for detail view)
   - Rental without dispute (for detail view)

4. **Cron Run History**
   - Multiple records for different job names (for filter tests)
   - Records with `status='success'`, `'failure'`, `'partial'` (for UI badge tests)

5. **Audit Logs**
   - Existing audit entries for a rental (for detail view audit section)

### Mocking Strategy

- **Stripe API**: Mock `paymentIntents.cancel` for deposit release
- **DALs**: Mock `paymentLifecycleDAL`, `cronRunHistoryDAL`, `auditLogDAL`, `rentalDAL` for unit tests
- **OPS Alerts**: Mock `sendOpsAlert` (verify called with correct event and metadata)
- **Notifications**: Mock notification sending (verify called with correct params)
- **Auth**: Mock `requireAdminResponse`, `getAuthenticatedUserResponse`, `verifyCronSecret`
- **Environment Variables**: Mock `STALE_PROCESSING_THRESHOLD_MINUTES` for threshold tests

### Test Execution

- Run unit tests: `bun run test:unit`
- Run integration tests: `bun run test:integration`
- Run all tests: `bun run test`
- Run tests with coverage: `bun run test:coverage`
- Run specific Phase 4 tests: `bun run test -- --grep "payment-lifecycle-admin|stale-processing|cron-history|override"`

## Coverage Goals

- **Overall Phase 4 Coverage**: 90%+
- **PaymentLifecycleAdminService**: 95%+
- **StaleProcessingDetectionService**: 95%+
- **CronRunHistoryService**: 90%+
- **Override State Validation Logic**: 100%
- **PaymentLifecycleDAL Extensions**: 90%+
- **CronRunHistoryDAL**: 90%+
- **Admin Read Routes**: 85%+
- **Override Routes**: 90%+
- **Stale Detection Cron Route**: 90%+
- **Cron History Recording**: 85%+

## Test Maintenance

- Update tests when future phases add new lifecycle statuses or override types
- Add regression tests for any bugs found in production
- Keep Stripe mock data aligned with actual Stripe API responses (especially `payment_intent_unexpected_state` errors)
- Review stale threshold tests if the default changes
- Add E2E tests for full admin payment dashboard once Playwright is configured
- Monitor cron history growth and add retention tests if cleanup is implemented

---

_Last updated: March 15, 2026 | Internal use only_
