# Stripe Connect Payment Lifecycle (Phase 4) - Operational Tooling - Implementation Tasks

## Overview

This document breaks down the Phase 4 operational tooling implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

Phases 1–3 infrastructure is in place: payment lifecycle table and DAL, deposit hold service, payout service, cancellation service, dispute resolution, ops alerts, webhook handlers, and the admin dashboard with dispute review, listing review, and metrics. Phase 4 builds on this to add: `cron_run_history` schema, PaymentLifecycleDAL admin query extensions, CronRunHistoryDAL, three new services (PaymentLifecycleAdminService, StaleProcessingDetectionService, CronRunHistoryService), admin route handlers, React Query hooks, URL-synced admin UI for lifecycle list/detail/metrics/cron history, stale detection cron endpoint, manual override actions, audit logging for all overrides, and sidebar navigation.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Create `cron_run_history` table schema
  - Create `src/db/schemas/cron-run-history.schema.ts`
  - Define table with columns: `id` (uuid PK), `jobName` (varchar 100), `startedAt` (timestamp), `completedAt` (timestamp), `status` (varchar 20), `recordsEligible` (integer), `recordsSucceeded` (integer), `recordsFailed` (integer), `errorMessage` (text), `metadata` (text), `createdAt` (timestamp)
  - Add indexes: `crh_job_name_idx` on `jobName`, `crh_started_at_idx` on `startedAt`
  - _Requirements: 9.1, 9.2_

- [ ] 2. Generate and verify database migration
  - Run `bun run db:generate`
  - Review generated migration SQL — should create `cron_run_history` table with indexes
  - Confirm migration is additive, backward-compatible, no data migration needed
  - _Requirements: 9.2_

### Phase 2: Data Access Layer

- [ ] 3. Create CronRunHistoryDAL
  - Create `src/dal/cron-run-history.dal.ts` extending `BaseDAL`
  - Implement `create(data)` — insert a cron run record
  - Implement `getRecent(jobName?, limit)` — get recent runs ordered by `startedAt` desc, optionally filtered by `jobName`
  - _Requirements: 9.1, 9.4_

- [ ] 4. Export CronRunHistoryDAL from DAL index
  - Add `CronRunHistoryDAL` import and `cronRunHistoryDAL` singleton export to `src/dal/index.ts`
  - _Requirements: 9.1_

- [ ] 5. Add `getLifecycleListForAdmin` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept filters (`depositHoldStatus[]`, `ownerTransferStatus[]`, `payoutStatus[]`, `search`) and pagination (`page`, `limit`)
  - JOIN with `rentals`, `rental_requests`, and `users` (renter + owner) to return list items with names and listing context
  - Support `IN` filter for each status dimension, `ILIKE` search across rentalId, rentalRequestId, renterId, ownerId
  - Return `PaginatedResult<LifecycleListItem>` (data array + pagination metadata with totalCount)
  - Order by `updatedAt` DESC
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [ ] 6. Add `getLifecycleDetailForAdmin` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept `rentalId`; return full lifecycle record with: rental details (startDate, endDate, returnConfirmedAt, securityDepositAuthId, totalAmount, securityDeposit), payment Stripe IDs (rentalChargeId), linked dispute summary (LEFT JOIN disputes where status not 'closed'), and recent audit log entries for this rental
  - Return `LifecycleDetail | null`
  - _Requirements: 2.1, 2.3_

- [ ] 7. Add `getPaymentMetrics` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Single query using `COUNT(*) FILTER (WHERE ...)` for each status value across `payoutStatus`, `ownerTransferStatus`, and `depositHoldStatus`
  - Return `PaymentMetrics` object with all counts
  - _Requirements: 3.1_

- [ ] 8. Add `findStaleProcessingRecords` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept `thresholdMinutes`; compute cutoff timestamp (`now - threshold`)
  - Query for records where `payoutStatus = 'processing'` AND `updatedAt <= cutoff`
  - Return array of `{ rentalId, payoutStatus, updatedAt }`
  - _Requirements: 4.1, 4.5_

### Phase 3: Service Layer — CronRunHistoryService

- [ ] 9. Create CronRunHistoryService
  - Create `src/features/admin/services/cron-run-history-service.ts`
  - Implement `recordRun(params)` — best-effort write to `cronRunHistoryDAL.create()`; catch errors and log via `getLogger().error()` without propagating
  - Implement `getRecentRuns(jobName?, limit)` — delegate to `cronRunHistoryDAL.getRecent()`
  - _Requirements: 9.1, 9.3, 9.4_

### Phase 4: Service Layer — StaleProcessingDetectionService

- [ ] 10. Create StaleProcessingDetectionService
  - Create `src/features/admin/services/stale-processing-detection-service.ts`
  - Implement `detectStaleProcessing(thresholdMinutes?)` — read threshold from `STALE_PROCESSING_THRESHOLD_MINUTES` env var (default 60), call `paymentLifecycleDAL.findStaleProcessingRecords()`, send ops alert via `sendOpsAlert()` if stale records found
  - Return `{ staleCount, rentalIds, thresholdMinutes }`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

### Phase 5: Service Layer — PaymentLifecycleAdminService

- [ ] 11. Create PaymentLifecycleAdminService class structure
  - Create `src/features/admin/services/payment-lifecycle-admin-service.ts`
  - Define interfaces: `LifecycleListFilters`, `LifecycleListItem`, `LifecycleDetail`, `PaymentMetrics`, `OverrideResult`
  - Import DALs (`paymentLifecycleDAL`, `auditLogDAL`, `rentalDAL`), Stripe instance, `sendOpsAlert`, notifications
  - Stub out all static methods
  - _Requirements: Service structure per design_

- [ ] 12. Implement read methods (list, detail, metrics)
  - [ ] 12.1 Implement `getLifecycleList` — delegate to `paymentLifecycleDAL.getLifecycleListForAdmin()`
    - _Requirements: 1.1, 1.2, 1.3, 1.6_
  - [ ] 12.2 Implement `getLifecycleDetail` — delegate to `paymentLifecycleDAL.getLifecycleDetailForAdmin()`, throw `NotFoundError` if not found
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 12.3 Implement `getPaymentMetrics` — delegate to `paymentLifecycleDAL.getPaymentMetrics()`
    - _Requirements: 3.1_

- [ ] 13. Implement `resetPayoutStatus`
  - Load lifecycle via `paymentLifecycleDAL.getByRentalId()`, throw `NotFoundError` if missing
  - Validate `payoutStatus` is `'processing'` or `'failed'`, throw `ValidationError` otherwise
  - Call `paymentLifecycleDAL.updatePayoutStatus(rentalId, 'pending')`
  - Create audit log via `auditLogDAL.create()` with `entityType: 'payment_lifecycle'`, `action: 'payout_status_reset'`, metadata with previous/new status and reason
  - Return `OverrideResult`
  - _Requirements: 6.1, 6.2, 6.3, 6.5, 10.1, 10.2_

- [ ] 14. Implement `resetTransferStatus`
  - Load lifecycle, validate `ownerTransferStatus` is `'failed'`
  - Call `paymentLifecycleDAL.updateOwnerTransferStatus(rentalId, 'pending')`
  - If `payoutStatus` is also `'failed'`, reset it to `'pending'` as well
  - Create audit log with `action: 'owner_transfer_status_reset'`, metadata with both previous statuses
  - Return `OverrideResult`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.1, 10.2_

- [ ] 15. Implement `releaseDeposit`
  - [ ] 15.1 Load and validate
    - Load lifecycle, validate `depositHoldStatus` is `'held'`
    - Load rental via DAL to get `securityDepositAuthId`, throw `NotFoundError` if missing
    - _Requirements: 8.3_
  - [ ] 15.2 Call Stripe and handle errors
    - Call `stripe.paymentIntents.cancel(securityDepositAuthId)`
    - If Stripe returns `payment_intent_unexpected_state` with "canceled" in message, treat as success (already canceled by Stripe)
    - If Stripe returns other error: create audit log with `status: 'failed'`, send ops alert via `sendOpsAlert()`, return `{ success: false, error }`
    - _Requirements: 8.1, 8.4, 8.5_
  - [ ] 15.3 Update lifecycle and audit
    - Call `paymentLifecycleDAL.updateDepositHoldStatus(rentalId, 'released', { depositReleasedAt })`
    - Create audit log with `action: 'manual_deposit_release'`, `status: 'succeeded'`
    - Notify renter that deposit hold has been released (use existing notification infrastructure)
    - Return `{ success: true }`
    - _Requirements: 8.1, 8.2, 10.1, 11.2_

### Phase 6: Route Handlers — Admin Read APIs

- [ ] 16. Create payment lifecycle list route
  - Create `src/app/api/admin/payments/lifecycle/route.ts`
  - Thin GET handler: `requireAdminResponse()` → parse search params (depositHoldStatus, ownerTransferStatus, payoutStatus as comma-separated, search, page, limit) → call `PaymentLifecycleAdminService.getLifecycleList()` → return JSON
  - Wrap with `withRequestLogging`
  - _Requirements: 1.1, 1.5_

- [ ] 17. Create payment lifecycle detail route
  - Create `src/app/api/admin/payments/lifecycle/[rentalId]/route.ts`
  - Thin GET handler: `requireAdminResponse()` → extract `rentalId` from params → call `PaymentLifecycleAdminService.getLifecycleDetail()` → map `NotFoundError` to 404 → return JSON
  - Wrap with `withRequestLogging`
  - _Requirements: 2.1, 2.4_

- [ ] 18. Create payment metrics route
  - Create `src/app/api/admin/payments/metrics/route.ts`
  - Thin GET handler: `requireAdminResponse()` → call `PaymentLifecycleAdminService.getPaymentMetrics()` → return JSON
  - Wrap with `withRequestLogging`
  - _Requirements: 3.1, 3.4_

- [ ] 19. Create cron run history route
  - Create `src/app/api/admin/payments/cron-history/route.ts`
  - Thin GET handler: `requireAdminResponse()` → parse `jobName` and `limit` from search params → call `CronRunHistoryService.getRecentRuns()` → return JSON
  - Wrap with `withRequestLogging`
  - _Requirements: 9.4, 9.6_

### Phase 7: Route Handlers — Admin Override APIs

- [ ] 20. Create reset payout status route
  - Create `src/app/api/admin/payments/lifecycle/[rentalId]/reset-payout-status/route.ts`
  - Thin POST handler: `requireAdminResponse()` → `getAuthenticatedUserResponse()` for adminId → parse `reason` from body → call `PaymentLifecycleAdminService.resetPayoutStatus()` → map errors (`NotFoundError` → 404, `ValidationError` → 400) → return JSON
  - Wrap with `withRequestLogging`
  - _Requirements: 6.1, 6.3_

- [ ] 21. Create reset transfer status route
  - Create `src/app/api/admin/payments/lifecycle/[rentalId]/reset-transfer-status/route.ts`
  - Same pattern as Task 20, calling `resetTransferStatus()`
  - _Requirements: 7.1, 7.3_

- [ ] 22. Create release deposit route
  - Create `src/app/api/admin/payments/lifecycle/[rentalId]/release-deposit/route.ts`
  - Same pattern as Task 20, calling `releaseDeposit()`
  - _Requirements: 8.1, 8.3_

### Phase 8: Stale Detection Cron

- [ ] 23. Create stale processing detection cron route
  - Create `src/app/api/cron/detect-stale-processing/route.ts`
  - Thin GET handler: `verifyCronSecret()` → capture start time → call `StaleProcessingDetectionService.detectStaleProcessing()` → record cron run via `CronRunHistoryService.recordRun()` → return JSON with success, staleCount, rentalIds, timestamp
  - On error: record failed cron run, return 500
  - Wrap with `withRequestLogging`
  - _Requirements: 4.2, 5.1, 9.3_

- [ ] 24. Add `STALE_PROCESSING_THRESHOLD_MINUTES` to environment documentation
  - Document the new env var in `.env.example` or equivalent
  - Default: 60 (minutes)
  - _Requirements: 4.1_

### Phase 9: Modify Existing Cron Routes for History Recording

- [ ] 25. Add cron run history recording to `process-payouts` route
  - Modify `src/app/api/cron/process-payouts/route.ts`
  - Capture `startedAt` before service call
  - After service returns: call `CronRunHistoryService.recordRun()` with job name `'process-payouts'`, timestamps, and result counts (eligible, succeeded, failed)
  - On catch: record failed cron run before returning 500
  - _Requirements: 9.1, 9.3_

- [ ] 26. Add cron run history recording to `schedule-deposit-holds` route
  - Modify `src/app/api/cron/schedule-deposit-holds/route.ts`
  - Same pattern as Task 25 with job name `'schedule-deposit-holds'`
  - _Requirements: 9.1, 9.3_

- [ ] 27. Add cron run history recording to `monitor-deposit-expiry` route
  - Modify `src/app/api/cron/monitor-deposit-expiry/route.ts`
  - Same pattern as Task 25 with job name `'monitor-deposit-expiry'`
  - _Requirements: 9.1, 9.3_

### Phase 10: React Query Hooks

- [ ] 28. Create payment lifecycle list and detail hooks
  - Create `src/features/admin/hooks/use-payment-lifecycle.ts`
  - Implement `usePaymentLifecycleList(params)` — `useQuery` with query key `['admin', 'payment-lifecycle', ...filters]`, fetch from `/api/admin/payments/lifecycle`, staleTime 30s
  - Implement `usePaymentLifecycleDetail(rentalId)` — `useQuery` with query key `['admin', 'payment-lifecycle-detail', rentalId]`, fetch from `/api/admin/payments/lifecycle/{rentalId}`, enabled when rentalId is truthy
  - Implement `usePaymentMetrics()` — `useQuery` with query key `['admin', 'payment-metrics']`, fetch from `/api/admin/payments/metrics`, staleTime 60s
  - Follow the `useAdminUsers` hook pattern
  - _Requirements: 1.4, 2.2, 3.2_

- [ ] 29. Create payment lifecycle mutation hooks
  - Create `src/features/admin/hooks/use-payment-lifecycle-mutations.ts`
  - Implement `useResetPayoutStatus()` — `useCreateMutation` with POST to `/api/admin/payments/lifecycle/{rentalId}/reset-payout-status`, invalidate `['admin', 'payment-lifecycle']`, `['admin', 'payment-lifecycle-detail']`, `['admin', 'payment-metrics']`
  - Implement `useResetTransferStatus()` — same pattern for reset-transfer-status
  - Implement `useReleaseDeposit()` — same pattern for release-deposit
  - Follow the `useApproveListing` / `useRejectListing` mutation pattern
  - _Requirements: 6.1, 7.1, 8.1_

- [ ] 30. Create cron run history hook
  - Create `src/features/admin/hooks/use-cron-run-history.ts`
  - Implement `useCronRunHistory(jobName?, limit)` — `useQuery` with query key `['admin', 'cron-history', jobName, limit]`, fetch from `/api/admin/payments/cron-history`, staleTime 30s
  - _Requirements: 9.5_

### Phase 11: Admin UI — Payments Pages

- [ ] 31. Create admin payments landing page
  - Create `src/app/admin/dashboard/payments/page.tsx`
  - Server component with `PageHeader` ("Payment Lifecycle") and client widgets: `PaymentMetricsCards` and `PaymentLifecycleListClient`
  - Set `export const dynamic = 'force-dynamic'`
  - _Requirements: 1.4, 3.2_

- [ ] 32. Create payment lifecycle detail page
  - Create `src/app/admin/dashboard/payments/[rentalId]/page.tsx`
  - Server component that extracts `rentalId` from params and renders `PaymentLifecycleDetailClient`
  - Set `export const dynamic = 'force-dynamic'`
  - _Requirements: 2.2_

- [ ] 33. Create cron history page
  - Create `src/app/admin/dashboard/payments/cron-history/page.tsx`
  - Server component with `PageHeader` ("Cron Run History") and `CronRunHistoryClient` widget
  - Set `export const dynamic = 'force-dynamic'`
  - _Requirements: 9.5_

### Phase 12: Admin UI — Components

- [x] 34. Create PaymentMetricsCards component
  - Create `src/features/admin/components/payments/payment-metrics-cards.tsx`
  - Client component using `usePaymentMetrics()` hook
  - Render grid of metric cards: Payouts (pending, processing, completed, failed), Transfers (pending, completed, failed, frozen), Deposits (scheduled, held, released, expired, failed, captured)
  - Highlight cards with non-zero failed/frozen/expired counts (e.g. red/orange badge)
  - Loading skeleton while fetching
  - _Requirements: 3.2_

- [x] 35. Create PaymentLifecycleListClient component
  - Create `src/features/admin/components/payments/payment-lifecycle-list-client.tsx`
  - Client component with URL state sync for filters (depositHoldStatus, ownerTransferStatus, payoutStatus, search, page)
  - Read filter state from `useSearchParams()`, update URL via `router.push()` (follow admin users pattern)
  - Debounced search input (300ms) with local state for instant feedback
  - Multi-select dropdowns for each status dimension (use existing Select/multi-select components)
  - Data table with columns: rental id (link to detail), renter, owner, listing, deposit status, transfer status, payout status, last updated
  - Status badges with color coding (green for completed/released, red for failed, yellow for processing/frozen, blue for pending/scheduled)
  - Pagination controls synced to URL
  - Use `usePaymentLifecycleList()` hook for data fetching
  - _Requirements: 1.4, 1.6_

- [x] 36. Create PaymentLifecycleDetailClient component
  - Create `src/features/admin/components/payments/payment-lifecycle-detail-client.tsx`
  - Client component using `usePaymentLifecycleDetail(rentalId)` hook
  - [x] 36.1 Status summary bar
    - Display depositHoldStatus, ownerTransferStatus, payoutStatus as color-coded badges
  - [x] 36.2 Payment timeline
    - Vertical timeline of events: rental charge captured, deposit hold placed/scheduled/failed, return confirmed, dispute filed (if any, link to dispute review), deposit released/captured/expired, owner transfer completed/failed
    - Show amounts, Stripe IDs, and timestamps
  - [x] 36.3 Override actions panel
    - "Reset Payout Status" button — visible when payoutStatus is `'processing'` or `'failed'`; opens confirmation dialog with optional reason input; calls `useResetPayoutStatus()` mutation
    - "Reset Transfer Status" button — visible when ownerTransferStatus is `'failed'`; same confirmation pattern; calls `useResetTransferStatus()` mutation
    - "Release Deposit" button — visible when depositHoldStatus is `'held'`; same confirmation pattern; calls `useReleaseDeposit()` mutation
    - Show toast on success/failure via the mutation hook
  - [x] 36.4 Audit log section
    - Display recent audit log entries for this rental (from the detail API response)
    - Show: timestamp, admin, action, previous/new state, reason
  - _Requirements: 2.2, 6.1, 7.1, 8.1, 10.4_

- [x] 37. Create CronRunHistoryClient component
  - Create `src/features/admin/components/payments/cron-run-history-client.tsx`
  - Client component using `useCronRunHistory()` hook
  - Job name filter dropdown (all, process-payouts, schedule-deposit-holds, monitor-deposit-expiry, detect-stale-processing)
  - Table with columns: Job, Started, Completed, Duration, Status, Eligible, Succeeded, Failed
  - Status badge: success (green), partial (yellow), failure (red)
  - Expandable rows for error message/metadata on failure
  - _Requirements: 9.5_

### Phase 13: Admin Sidebar Update

- [x] 38. Add "Payments" section to admin sidebar
  - Modify the admin sidebar component (e.g. `src/features/admin/components/admin-sidebar.tsx` or equivalent)
  - Add new top-level nav item "Payments" with `CreditCard` icon from lucide-react
  - Sub-items: "Lifecycle" → `/admin/dashboard/payments`, "Cron History" → `/admin/dashboard/payments/cron-history`
  - Position below "Dispute Review" in the sidebar
  - _Requirements: 1.4, 9.5_

### Phase 14: GitHub Actions Configuration

- [x] 39. Add stale detection cron to GitHub Actions
  - Add a new scheduled workflow (or add a step to existing cron workflow) that hits `GET /api/cron/detect-stale-processing` with the `CRON_SECRET` bearer token
  - Schedule: hourly (same cadence as other payment crons)
  - _Requirements: 4.2_

### Phase 15: Testing

- [x] 40. Write unit tests for PaymentLifecycleAdminService overrides
  - Create `src/features/admin/services/__tests__/payment-lifecycle-admin-service.test.ts`
  - [x] 40.1 Test `resetPayoutStatus`
    - Valid: payoutStatus 'processing' → reset to 'pending', audit log created
    - Valid: payoutStatus 'failed' → reset to 'pending'
    - Invalid: payoutStatus 'completed' → ValidationError
    - Invalid: payoutStatus 'pending' → ValidationError
    - Not found: lifecycle not found → NotFoundError
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 40.2 Test `resetTransferStatus`
    - Valid: ownerTransferStatus 'failed' → reset to 'pending', audit log created
    - Valid: ownerTransferStatus 'failed' + payoutStatus 'failed' → both reset to 'pending'
    - Invalid: ownerTransferStatus 'pending' → ValidationError
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 40.3 Test `releaseDeposit`
    - Valid: depositHoldStatus 'held' → Stripe cancel succeeds → 'released', audit log, renter notified
    - Valid: depositHoldStatus 'held' but Stripe says "already canceled" → still set 'released'
    - Stripe error: real failure → audit log with 'failed', ops alert, return { success: false }
    - Invalid: depositHoldStatus 'released' → ValidationError
    - Missing PaymentIntent ID → NotFoundError
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 41. Write unit tests for StaleProcessingDetectionService
  - Create `src/features/admin/services/__tests__/stale-processing-detection-service.test.ts`
  - Test: stale records found → ops alert sent with rental ids and count
  - Test: no stale records → no alert, return staleCount 0
  - Test: threshold from env var vs default
  - _Requirements: 4.1, 4.3, 4.4, 5.1, 5.2, 5.3_

- [x] 42. Write unit tests for CronRunHistoryService
  - Create `src/features/admin/services/__tests__/cron-run-history-service.test.ts`
  - Test: `recordRun` succeeds → DAL create called
  - Test: `recordRun` DAL throws → error logged, does not propagate
  - Test: `getRecentRuns` delegates to DAL
  - _Requirements: 9.1, 9.3_

- [x] 43. Write integration tests for admin payment lifecycle routes
  - Create `src/app/api/admin/payments/__tests__/lifecycle.test.ts`
  - Test GET lifecycle list: returns paginated results, filters work, non-admin gets 403
  - Test GET lifecycle detail: returns full detail, not-found returns 404, non-admin gets 403
  - Test GET metrics: returns aggregate counts, non-admin gets 403
  - _Requirements: 1, 2, 3_

- [x] 44. Write integration tests for admin override routes
  - Create `src/app/api/admin/payments/__tests__/overrides.test.ts`
  - Test POST reset-payout-status: valid state → 200, invalid state → 400, non-admin → 403, not found → 404
  - Test POST reset-transfer-status: valid → 200, invalid → 400
  - Test POST release-deposit: valid → 200 (mock Stripe), Stripe fail → 500, invalid state → 400
  - _Requirements: 6, 7, 8_

- [x] 45. Write integration tests for stale detection cron
  - Test GET with valid cron secret: returns stale count, records cron history
  - Test with stale records: ops alert sent
  - Test without cron secret: 401
  - _Requirements: 4, 5_

- [x] 46. Write integration tests for cron history route and recording
  - Test GET cron history: returns recent runs, filterable by job name
  - Test cron history recording: run a payment cron, verify history record created
  - _Requirements: 9_

### Phase 16: Final Verification

- [x] 47. Run linting and type checking
  - Run `bun run lint` and fix any issues
  - Run `bun run type-check` and fix any type errors
  - Ensure all new files follow existing code style
  - _Requirements: Code quality_

- [x] 48. Verify all imports, exports, and navigation
  - Check all new files have correct imports
  - Verify services are importable from route handlers
  - Verify DAL exports from `src/dal/index.ts`
  - Verify admin sidebar links navigate to correct pages
  - Ensure no circular dependencies
  - _Requirements: Code quality_

- [x] 49. Verify environment configuration
  - Document `STALE_PROCESSING_THRESHOLD_MINUTES` env var (default 60)
  - Verify existing env vars (`OPS_ALERT_EMAIL`, `CRON_SECRET`) are set
  - Add GitHub Actions workflow for `detect-stale-processing` cron (or update existing workflow)
  - _Requirements: Deployment readiness_

---

_Last updated: March 15, 2026 | Internal use only_
