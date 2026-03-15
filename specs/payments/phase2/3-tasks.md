# Stripe Connect Payment Lifecycle (Phase 2) - Cancellation Policies - Implementation Tasks

## Overview

This document breaks down the Phase 2 cancellation policies implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

Phase 1 infrastructure (payment lifecycle table, deposit hold service, payout service, ops alerts, webhook handlers) is already in place. Phase 2 builds on it: new schema columns, a new CancellationService, a RefundService, DAL extensions, route handler refactoring, webhook extension, and the no-show admin API.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Add `cancellationReasonEnum` to schema
  - Add enum to `src/db/schemas/_enums.ts` with values: `renter_cancellation`, `owner_cancellation`, `renter_no_show`, `owner_no_show`
  - Export the new enum
  - _Requirements: 8.4_

- [ ] 2. Add cancellation columns to `rental_requests` table
  - Add `cancelledAt` (timestamp, nullable) to `src/db/schemas/rentals.schema.ts` on `rentalRequests`
  - Add `cancelledBy` (uuid, nullable, FK to user) to `rentalRequests`
  - Add `cancellationReason` (cancellationReasonEnum, nullable) to `rentalRequests`
  - _Requirements: 8.1_

- [ ] 3. Generate and verify database migration
  - Run `bun run db:generate`
  - Review generated migration SQL — should create enum type and add 3 nullable columns
  - Confirm migration is additive, backward-compatible, no data migration needed
  - _Requirements: 8.1, 8.4_

### Phase 2: Data Access Layer Extensions

- [ ] 4. Add `getRentalCancellationContext` to RentalDAL
  - Add method to `src/dal/rentals.dal.ts`
  - Join `rental_requests` → `rentals` → `rental_payment_lifecycle` → `payments` → `listings` → `user` (owner)
  - Return typed `RentalCancellationContext`: rentalRequestId, rentalId, renterId, ownerId, status, startDate, rentalPrice, totalChargeAmount, depositHoldStatus, securityDepositAuthId, rentalChargeId, paymentId, paymentStatus, ownerConnectedAccountId
  - Return `null` if not found
  - _Requirements: 2.1, 3.1, 7.1, 7.2_

- [ ] 5. Add `cancelApprovedRental` to RentalDAL
  - Add method to `src/dal/rentals.dal.ts`
  - Accept `requestId`, `cancelledBy` (userId), `cancellationReason` (enum value)
  - Atomic UPDATE: set `status='cancelled'`, `cancelledAt=NOW()`, `cancelledBy`, `cancellationReason`
  - WHERE `id = requestId AND status IN ('approved')`
  - Throw error if no rows affected (status guard)
  - _Requirements: 2.10, 3.5, 8.1_

- [ ] 6. Add `recordRefund` to PaymentDAL
  - Add method to `src/dal/payment.dal.ts`
  - Accept `paymentId`, `{ refundedAt, refundAmount, refundReason }`
  - UPDATE payment: set `status='refunded'`, `refundedAt`, `refundAmount`, `refundReason`
  - _Requirements: 2.11, 3.6, 6.4, 6.5_

- [ ] 7. Add `markCancelled` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept `rentalId` and optional overrides for `depositHoldStatus`, `ownerTransferStatus`, `stripeTransferId`, `ownerTransferredAt`
  - Set `payoutStatus='completed'` (terminal — prevents payout cron from picking up)
  - Apply passed overrides for deposit and transfer statuses
  - Set `updatedAt=NOW()`
  - _Requirements: 5.1, 5.2, 5.3, 8.3_

### Phase 3: Stripe Refund Service

- [ ] 8. Create RefundService
  - Create `src/services/stripe/refund.ts`
  - Define `ProcessRefundParams` interface: `rentalId`, `chargeId`, `refundAmountCents`, `reason`, optional `metadata`
  - Define `RefundResult` type: `{ success: true, refundId }` | `{ success: false, error }`
  - Implement `processRefund()`:
    - Idempotency key: `refund-rental-{rentalId}`
    - Call `PAYMENT_SERVER_INSTANCE.refunds.create({ charge, amount, metadata }, { idempotencyKey })`
    - Return success with refund ID, or failure with error message
  - _Requirements: 6.1, 6.2, 6.6, 6.7_

### Phase 4: CancellationService

- [ ] 9. Create CancellationService class structure
  - Create `src/features/rentals/services/cancellation-service.ts`
  - Define result interfaces: `CancelRentalResult`, `ApplyNoShowResult`
  - Import DALs, RefundService, DepositHoldService, PayoutService, notifications, ops alerts
  - Stub out static methods: `cancelRental`, `cancelPendingRequest`, `cancelApprovedRental`, `applyNoShow`
  - _Requirements: Service structure_

- [ ] 10. Implement refund calculation helpers
  - Add `calculateRenterCancellationRefund(rentalPriceDollars, startDate, now)` — returns `{ refundAmountCents, ownerTransferAmountCents, refundReason }`
  - > =24h: 100% rental price refund, 0 owner transfer, reason `renter_cancellation_24h`
  - <24h: 50% rental price refund, (50% - platform fee) owner transfer, reason `renter_cancellation_under_24h`
  - Add `calculateOwnerCancellationRefund(totalChargeDollars)` — full charge refund, 0 owner transfer, reason `owner_cancellation`
  - Add `calculateNoShowRefund(rentalPriceDollars, totalChargeDollars, type)` — renter: 50% rental price refund + owner transfer; owner: full charge refund
  - Use `PLATFORM_FEE_PERCENTAGE` from `src/constants/payments.ts`
  - Use `Math.round` for cent conversion, `Math.max(0)` for owner transfer floor
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 7.1, 7.2_

- [ ] 11. Implement `cancelPendingRequest`
  - Extract logic from current `src/app/api/rentals/[id]/cancel/route.ts` into `CancellationService.cancelPendingRequest()`
  - Load rental request via DAL, validate renter ownership, validate `pending` status
  - Call `rentalDAL.cancelRentalRequest()` (existing method for pending cancellations)
  - Create audit log entry
  - Track activity
  - Send `rental_cancelled` notification to owner
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 12. Implement `cancelApprovedRental`
  - [ ] 12.1 Load and validate
    - Load full cancellation context via `rentalDAL.getRentalCancellationContext()`
    - Validate rental exists, status is `approved`, current time is before `startDate`
    - Determine if caller is renter or owner based on userId match
    - Reject if status is `active` (Requirement 4)
    - Reject if already cancelled
    - _Requirements: 2.1, 3.1, 4.1_
  - [ ] 12.2 Process refund
    - Check payment not already refunded (status gate)
    - Calculate refund via appropriate helper (renter or owner)
    - Call `RefundService.processRefund()` with chargeId and calculated amount
    - If refund fails: throw error, do NOT mark as cancelled
    - Update payment record via `paymentDAL.recordRefund()`
    - _Requirements: 2.7, 2.8, 2.11, 2.12, 3.2, 3.6, 6.1, 6.2, 6.3_
  - [ ] 12.3 Handle deposit hold
    - If `depositHoldStatus='held'`: call `releaseDepositHold()`, update to `released`
    - If `depositHoldStatus='scheduled'`: update to `released` (cron won't place it)
    - If other statuses (`failed`, `expired`, `not_applicable`, `released`): skip
    - If release fails: set `release_failed`, OPS_ALERT, continue with rest of flow
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 12.4 Handle owner transfer (renter <24h only)
    - If renter cancel and `ownerTransferAmountCents > 0`: call `createOwnerTransfer()` with non-refunded amount minus platform fee
    - Use existing `transfer-owner-{rentalId}` idempotency key pattern
    - On success: update lifecycle with `ownerTransferStatus='completed'`, `stripeTransferId`, `ownerTransferredAt`
    - On failure: set `ownerTransferStatus='failed'`, OPS_ALERT
    - If owner cancel or >=24h renter cancel: no transfer needed
    - _Requirements: 2.5, 2.6_
  - [ ] 12.5 Update statuses and notify
    - Call `rentalDAL.cancelApprovedRental()` to set `cancelled` status with metadata
    - Call `paymentLifecycleDAL.markCancelled()` with appropriate terminal states
    - Create audit log entry
    - Send `rental_cancelled` notification to other party
    - Send `payment_refunded` notification to renter with refund amount
    - Call `sendOpsAlert()` with `sendEmailAlert: true`
    - Return result with `refundAmount` and optional `ownerTransferAmount`
    - _Requirements: 2.10, 2.14, 2.15, 3.5, 3.7, 3.8, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 13. Implement `applyNoShow`
  - Load rental and context via DAL
  - Validate: rental not already cancelled or refunded
  - Calculate refund via `calculateNoShowRefund()`
  - Call `RefundService.processRefund()`
  - Update payment record via `paymentDAL.recordRefund()`
  - Release deposit hold if present (same logic as 12.3)
  - If renter no-show: call `createOwnerTransfer()` for non-refunded portion minus platform fee
  - Update rental request: set cancellation metadata with `renter_no_show` or `owner_no_show` reason
  - Update payment lifecycle to terminal state
  - Create audit log entry
  - Call `sendOpsAlert()` with `sendEmailAlert: true`
  - Return result with `refundAmount` and optional `ownerTransferAmount`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 14. Implement `cancelRental` (router method)
  - This is the entry point called by the route handler
  - Load rental request, determine status (`pending` vs `approved` vs `active`)
  - Determine caller role (renter or owner based on userId vs renterId/ownerId)
  - If `pending` and renter: delegate to `cancelPendingRequest()`
  - If `approved` and (renter or owner): delegate to `cancelApprovedRental()`
  - If `active`: throw `BadRequestError("Cancellation not allowed for active rentals")`
  - If already `cancelled`, `completed`, `denied`: throw appropriate error
  - If not authorized (neither renter nor owner): throw `ForbiddenError`
  - _Requirements: 1.3, 1.5, 2.1, 2.13, 3.9, 4.1_

### Phase 5: Route Handlers

- [ ] 15. Refactor cancel route to use CancellationService
  - Rewrite `src/app/api/rentals/[id]/cancel/route.ts` as thin handler
  - Auth + parse params + call `CancellationService.cancelRental()` + map errors to HTTP responses
  - Map `NotFoundError` → 404, `ForbiddenError` → 403, `BadRequestError` → 400
  - Remove all DAL calls, audit log, activity tracking, notification sending from the route
  - _Requirements: 1, 2, 3, 4 (all cancel paths)_

- [ ] 16. Create no-show admin API route
  - Create `src/app/api/admin/rentals/[id]/no-show/route.ts`
  - Thin handler: auth + validate body (`{ type: "renter_no_show" | "owner_no_show" }`) + call `CancellationService.applyNoShow()` + map errors
  - Use `withRequestLogging` wrapper
  - TODO: admin/ops role check (may use existing admin middleware or defer to Phase 4)
  - _Requirements: 7.3_

### Phase 6: Webhook Extension

- [ ] 17. Add `charge.refunded` webhook handler
  - In `src/app/api/stripe/webhooks/route.ts`:
  - Add case for `charge.refunded` event type
  - Extract `payment_intent` ID from charge object
  - Look up payment via `paymentDAL.getByPaymentIntentId()`
  - If payment found and not already `refunded`: call `paymentDAL.recordRefund()` with `amount_refunded` and metadata
  - If already refunded: no-op, return 200 (idempotent)
  - If payment not found: log warning, return 200 (don't block Stripe retries)
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 18. Update Stripe Dashboard webhook configuration
  - Document that `charge.refunded` must be added to the Stripe webhook endpoint event types
  - Add to deployment notes
  - _Requirements: 10.3_

### Phase 7: React Query Hook Update

- [ ] 19. Update `useCancelRentalRequest` hook
  - In `src/features/rentals/hooks/use-rental-mutations.ts`:
  - Update `successMessage` to handle refund case (e.g. dynamic based on response data, or keep generic "Rental cancelled successfully")
  - Hook already calls the correct endpoint and invalidates the right queries
  - Ensure the response type accommodates `{ success, refundAmount?, ownerTransferAmount? }`
  - No new hooks needed; no-show is admin-only
  - _Requirements: Hook patterns_

### Phase 8: Testing

- [ ] 20. Write unit tests for refund calculation helpers
  - Create tests in `src/features/rentals/services/__tests__/cancellation-service.test.ts` (or similar)
  - Test `calculateRenterCancellationRefund`:
    - > =24h: full rental price refund, 0 owner transfer
    - <24h: 50% rental price refund, correct owner transfer (50% minus platform fee)
    - Exactly 24h boundary (should be full refund)
    - Very small amounts (rounding edge cases)
    - Platform fee exceeds retained amount (ownerTransfer floor at 0)
  - Test `calculateOwnerCancellationRefund`: full charge refund, 0 transfer
  - Test `calculateNoShowRefund`: renter (50% + owner transfer) and owner (full refund)
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.6_

- [ ] 21. Write unit tests for RefundService
  - Create `src/services/stripe/__tests__/refund.test.ts`
  - Mock Stripe `refunds.create()`
  - Test success path: correct charge ID, amount in cents, idempotency key `refund-rental-{rentalId}`
  - Test failure path: returns `{ success: false, error }`
  - Test metadata is passed through
  - _Requirements: 6.1, 6.2_

- [ ] 22. Write unit tests for CancellationService
  - Create `src/features/rentals/services/__tests__/cancellation-service.test.ts`
  - Mock all DALs and Stripe services
  - [ ] 22.1 Test `cancelPendingRequest`
    - Renter cancels pending request → status cancelled, owner notified, no Stripe calls
    - Non-renter rejected (ForbiddenError)
    - Non-pending status rejected
    - _Requirements: 1.1–1.5_
  - [ ] 22.2 Test `cancelApprovedRental` (renter, >=24h)
    - Full rental price refund, no service fee refund, no owner transfer
    - Deposit released if held, marked released if scheduled
    - Status cancelled, notifications sent, OPS_ALERT sent
    - _Requirements: 2.1–2.15_
  - [ ] 22.3 Test `cancelApprovedRental` (renter, <24h)
    - 50% rental price refund, owner transfer for remainder minus platform fee
    - Deposit released, status cancelled, notifications + OPS_ALERT
    - _Requirements: 2.4, 2.5_
  - [ ] 22.4 Test `cancelApprovedRental` (owner)
    - Full charge refund (rental + service fee), no owner transfer
    - Renter notified, OPS_ALERT sent
    - _Requirements: 3.1–3.10_
  - [ ] 22.5 Test `cancelApprovedRental` (active rental rejected)
    - Active status → BadRequestError
    - _Requirements: 4.1_
  - [ ] 22.6 Test `cancelApprovedRental` (deposit edge cases)
    - Deposit already expired → skip release
    - Deposit release fails → `release_failed`, OPS_ALERT, continue
    - Deposit not applicable → skip
    - _Requirements: 5.1–5.5_
  - [ ] 22.7 Test `cancelApprovedRental` (refund failure)
    - Refund fails → error returned, rental NOT cancelled
    - _Requirements: Error handling_
  - [ ] 22.8 Test `cancelApprovedRental` (already cancelled)
    - Second cancel → rejected
    - _Requirements: Edge case 1_
  - [ ] 22.9 Test `applyNoShow` (renter no-show)
    - 50% rental price refund, owner transfer, deposit released, OPS_ALERT
    - _Requirements: 7.1, 7.4_
  - [ ] 22.10 Test `applyNoShow` (owner no-show)
    - Full refund (rental + service fee), no owner transfer, OPS_ALERT
    - _Requirements: 7.2, 7.5_
  - [ ] 22.11 Test `applyNoShow` (already cancelled)
    - Rejected — no double refund
    - _Requirements: Edge case 6_

- [ ] 23. Write integration tests for cancel route
  - Create `src/app/api/rentals/[id]/cancel/__tests__/route.test.ts`
  - Test POST: pending cancel (renter) → 200, no Stripe calls
  - Test POST: approved cancel (renter, >=24h) → 200, refund created
  - Test POST: approved cancel (renter, <24h) → 200, partial refund + owner transfer
  - Test POST: approved cancel (owner) → 200, full refund
  - Test POST: active rental → 400
  - Test POST: unauthorized user → 403
  - Test POST: not found → 404
  - Test POST: already cancelled → 400
  - _Requirements: All cancel requirements_

- [ ] 24. Write integration tests for no-show route
  - Create `src/app/api/admin/rentals/[id]/no-show/__tests__/route.test.ts`
  - Test POST renter_no_show → 200, 50% refund + owner transfer
  - Test POST owner_no_show → 200, full refund
  - Test POST invalid type → 400
  - Test POST already cancelled → error
  - _Requirements: 7.1–7.7_

- [ ] 25. Write integration tests for `charge.refunded` webhook
  - In `src/app/api/stripe/webhooks/__tests__/route.test.ts`:
  - Test `charge.refunded` event updates payment status to `refunded`
  - Test idempotent: already refunded → no-op, 200
  - Test payment not found → logged, 200
  - _Requirements: 10.1, 10.2, 10.4_

- [ ] 26. Write unit tests for DAL extensions
  - Test `cancelApprovedRental`: status transition, cancellation metadata stored
  - Test `getRentalCancellationContext`: returns full context with joins
  - Test `recordRefund`: payment fields updated correctly
  - Test `markCancelled`: lifecycle set to terminal state
  - _Requirements: DAL correctness_

### Phase 9: Final Verification

- [x] 27. Run linting and type checking
  - Run `bun run lint` and fix any issues
  - Run `bun run type-check` and fix any type errors
  - Ensure all new files follow existing code style
  - _Requirements: Code quality_

- [x] 28. Verify all imports and exports
  - Check all new files have correct imports
  - Verify `CancellationService` is importable from route handlers
  - Verify `RefundService` is importable from `CancellationService`
  - Ensure no circular dependencies
  - _Requirements: Code quality_

- [x] 29. Verify Stripe Dashboard and deployment configuration
  - Document that `charge.refunded` event type must be added to Stripe webhook endpoint
  - Verify existing `OPS_ALERT_EMAIL` and `CRON_SECRET` env vars are set
  - No new environment variables needed for Phase 2
  - _Requirements: Deployment readiness_
  - See `specs/payments/phase2/5-deployment-verification.md`

---

_Last updated: March 12, 2026 | Internal use only_
