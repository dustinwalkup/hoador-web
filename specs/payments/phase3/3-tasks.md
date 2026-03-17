# Stripe Connect Payment Lifecycle (Phase 3) - Dispute Resolution & Chargebacks - Implementation Tasks

## Overview

This document breaks down the Phase 3 dispute resolution and chargebacks implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

Phase 1 infrastructure (payment lifecycle table, deposit hold service, payout service, ops alerts, webhook handlers) and Phase 2 infrastructure (cancellation service, refund service, no-show handling) are in place. Phase 3 builds on existing dispute infrastructure (schema, DAL, API routes, state machine, evidence upload, admin resolution UI) and adds: schema extensions, filing window correction, button visibility, new services (DisputeCreationService, DisputeResolutionService, ChargebackService), StripeDisputeService enhancements (idempotency, partial capture, lifecycle updates), route refactoring to slim pattern, chargeback webhooks, and client-side updates.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Add `renter_no_show` and `owner_no_show` to `disputeReasonCodeEnum`
  - Modify `src/db/schemas/_enums.ts`: add `"renter_no_show"` and `"owner_no_show"` to the existing `disputeReasonCodeEnum` array
  - Add values before `"other"` so `"other"` remains the last option
  - _Requirements: 3.1, 14.1_

- [ ] 2. Add `depositCapturedAt` column to `rental_payment_lifecycle`
  - Add `depositCapturedAt: timestamp("deposit_captured_at")` (nullable) to the `rentalPaymentLifecycle` table in `src/db/schemas/rentals.schema.ts`
  - Semantically distinct from `depositReleasedAt` — tracks when a deposit was captured for damage
  - _Requirements: 9.4, 14.4_

- [ ] 3. Generate and verify database migration
  - Run `bun run db:generate`
  - Review generated migration SQL — should alter enum type to add two values and add one nullable column
  - Confirm migration is additive, backward-compatible, no data migration needed
  - _Requirements: 14.1, 14.4_

### Phase 2: Data Access Layer Extensions

- [ ] 4. Add `freezeForDispute` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept `rentalId`; set `ownerTransferStatus='frozen'` and `updatedAt=NOW()`
  - If no lifecycle record exists (edge case): create one with `ownerTransferStatus: 'frozen'`, `depositHoldStatus: 'not_applicable'`, `payoutStatus: 'pending'`
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Add `unfreezeAfterResolution` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept `rentalId`; set `ownerTransferStatus='pending'` WHERE `ownerTransferStatus='frozen'`
  - Atomic update ensures idempotency — no-op if not currently frozen
  - _Requirements: 5.1, 5.4_

- [ ] 6. Add `markDepositCaptured` to PaymentLifecycleDAL
  - Add method to `src/dal/payment-lifecycle.dal.ts`
  - Accept `rentalId`; set `depositHoldStatus='captured'`, `depositCapturedAt=NOW()`, `updatedAt=NOW()`
  - _Requirements: 9.4_

- [ ] 7. Add `updateStripeChargebackId` to DisputeDAL
  - Add method to `src/dal/dispute.dal.ts`
  - Accept `disputeId`, `stripeChargebackId`; update the `stripeChargebackId` column on the dispute
  - _Requirements: 11.2, 14.2_

- [ ] 8. Add `validateFilingWindowUnified` to DisputeDAL
  - Add method to `src/dal/dispute.dal.ts`
  - Accept `rentalId`; load rental with `startDate` and `returnConfirmedAt`
  - Apply unified logic: if `returnConfirmedAt` is set, `now <= returnConfirmedAt + 24h`; else `now >= startDate`
  - Return `{ valid: boolean; message?: string }`
  - This replaces the per-reason-code `validateTimeWindow` for Phase 3 dispute creation
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 9. Add `getByChargeId` to PaymentDAL
  - Add method to `src/dal/payment.dal.ts`
  - Accept `chargeId` (string); query payments table for matching Stripe charge ID
  - Return payment record or `null`
  - Used by ChargebackService to identify rental from chargeback webhook
  - _Requirements: 11.2_

### Phase 3: DisputeCreationService

- [ ] 10. Create DisputeCreationService class structure
  - Create `src/features/disputes/services/dispute-creation-service.ts`
  - Define `CreateDisputeParams` and `CreateDisputeResult` interfaces
  - Import DALs (DisputeDAL, PaymentLifecycleDAL, RentalDAL), notifications, audit log, ops alerts
  - Stub out static method: `createDispute(params)`
  - _Requirements: Service structure per design_

- [ ] 11. Implement unified filing window validation helper
  - Add `validateFilingWindow` as a private helper in the service (or shared utility)
  - Rules: if `returnConfirmedAt` set → `now <= returnConfirmedAt + 24h`; else → `now >= startDate`
  - Return `{ valid: boolean; message?: string }`
  - This is the server-side logic; client uses the same rules (Task 24)
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 12. Implement `createDispute`
  - [ ] 12.1 Load and validate
    - Load rental context via DAL (rental + request + listing)
    - Validate: rental exists, user is renter or owner
    - Validate: no active dispute via `disputeDAL.getActiveByRentalId()`
    - Validate: filing window via `validateFilingWindow()`
    - Validate: rate limits via `disputeDAL.checkRateLimits()`
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 3.3_
  - [ ] 12.2 Create dispute and freeze payout
    - Get current legal policy version via `legalDocumentDAL.getCurrentVersion()`
    - Call `disputeDAL.create()` with dispute data (rentalId, reasonCode, description, userId, role, policyVersion, evidenceDeadline)
    - Call `paymentLifecycleDAL.freezeForDispute(rentalId)` to set `ownerTransferStatus='frozen'`
    - _Requirements: 4.1, 4.2, 14.2_
  - [ ] 12.3 Audit log and notifications
    - Create audit log via `disputeDAL.createAuditLog()` and `auditLogDAL.create()`
    - Send notifications via `sendDisputeNotifications(dispute, "created")` (non-blocking with `captureNonCriticalError`)
    - Return `{ dispute }` with full relations
    - _Requirements: 13.1_

### Phase 4: DisputeResolutionService

- [ ] 13. Create DisputeResolutionService class structure
  - Create `src/features/disputes/services/dispute-resolution-service.ts`
  - Define `ResolveDisputeParams` (disputeId, outcome, reason, partialAmount?, adminId) and `ResolveDisputeResult`
  - Import DALs, StripeDisputeService, PaymentLifecycleDAL, notifications, ops alerts
  - Stub out static method: `resolveDispute(params)`
  - _Requirements: Service structure per design_

- [ ] 14. Implement outcome-to-financial-operations mapping
  - Add `getFinancialOperationsForOutcome()` helper
  - Map each `DisputeResolutionOutcome` to the correct deposit operation based on `depositHoldStatus`:
    - `favor_provider` + held → `capture_deposit` (full)
    - `favor_renter` / `dismissed` + held → release deposit
    - `partial_provider` / `partial_renter` + held → `capture_deposit` (partial amount)
    - Any outcome + not held (expired, released, not_applicable) → no deposit operation; record skip
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 15. Implement `resolveDispute`
  - [ ] 15.1 Load and validate
    - Load dispute with relations via `disputeDAL.getById()`
    - Validate: dispute exists, not already resolved/closed
    - Load payment lifecycle for the rental
    - _Requirements: 8.1, 8.2_
  - [ ] 15.2 Execute financial operations
    - Determine operations via `getFinancialOperationsForOutcome()`
    - For capture: call `StripeDisputeService.captureDeposit()` → update lifecycle via `markDepositCaptured()`
    - For release: call `StripeDisputeService.releaseDeposit()` → update lifecycle deposit status to `'released'`
    - For expired/not-held: skip Stripe call, record as skipped in `dispute_financial_operations`
    - If financial operation fails: do NOT resolve dispute, do NOT unfreeze, return error
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7_
  - [ ] 15.3 Resolve dispute and unfreeze
    - Call `disputeDAL.resolve()` with outcome, reason, adminId
    - Call `paymentLifecycleDAL.unfreezeAfterResolution(rentalId)` to set `ownerTransferStatus='pending'`
    - _Requirements: 5.1, 5.2, 8.3, 8.4_
  - [ ] 15.4 Audit log, notifications, and ops alert
    - Create audit logs via `disputeDAL.createAuditLog()` and `auditLogDAL.create()`
    - Send notifications via `sendDisputeNotifications(dispute, "resolved")`
    - Send OPS_ALERT with `sendEmailAlert: true` for all resolutions
    - _Requirements: 8.6, 13.5, 13.6_

### Phase 5: StripeDisputeService Enhancements

- [ ] 16. Add idempotency key to `captureDeposit`
  - Modify `src/services/stripe/dispute-financial.ts`
  - Add idempotency key `deposit-capture-{disputeId}` to the `captureSecurityDeposit` Stripe call
  - Check `depositHoldStatus` before calling Stripe: if not `'held'`, skip capture and record as skipped
  - _Requirements: 9.3, 9.6_

- [ ] 17. Add partial capture support to `captureDeposit`
  - Accept optional `amountToCapture` parameter (cents) for partial captures
  - Pass `amount_to_capture` to `stripe.paymentIntents.capture()` when partial
  - Record the captured amount in `dispute_financial_operations`
  - _Requirements: 9.2, 10.3, 10.4_

- [ ] 18. Add lifecycle updates to `captureDeposit`
  - After successful capture, call `paymentLifecycleDAL.markDepositCaptured()` to set `depositHoldStatus='captured'` and `depositCapturedAt`
  - _Requirements: 9.4_

- [ ] 19. Add `releaseDeposit` method to StripeDisputeService
  - New method in `src/services/stripe/dispute-financial.ts`
  - Cancel the deposit PaymentIntent via `stripe.paymentIntents.cancel(securityDepositAuthId)`
  - Update `depositHoldStatus='released'` and `depositReleasedAt` via PaymentLifecycleDAL
  - Record release in `dispute_financial_operations`
  - Check `depositHoldStatus` before calling: if not `'held'`, skip and record as skipped
  - _Requirements: 10.2, 10.5_

### Phase 6: ChargebackService

- [ ] 20. Create ChargebackService
  - Create `src/services/stripe/chargeback-service.ts`
  - Import DALs (DisputeDAL, PaymentDAL, PaymentLifecycleDAL), ops alerts, Stripe instance
  - Define static methods: `handleChargebackCreated`, `handleChargebackUpdated`, `handleChargebackClosed`, `submitEvidence`
  - _Requirements: 11.1, 12.1_

- [ ] 21. Implement `handleChargebackCreated`
  - Extract charge ID from Stripe dispute object
  - Look up payment via `paymentDAL.getByChargeId()`; if not found, log and return
  - Check for existing internal dispute via `disputeDAL.getActiveByRentalId()`
  - If exists: update `stripeChargebackId` via `disputeDAL.updateStripeChargebackId()`
  - If not: auto-create internal dispute with `reasonCode: 'payment_issue'` and `stripeChargebackId`
  - Freeze payout via `paymentLifecycleDAL.freezeForDispute()`
  - Send OPS_ALERT with `sendEmailAlert: true`
  - _Requirements: 11.2, 11.3, 11.5_

- [ ] 22. Implement `handleChargebackUpdated` and `handleChargebackClosed`
  - `handleChargebackUpdated`: log the update, update internal state if needed
  - `handleChargebackClosed`: record outcome (won/lost) in audit log; if lost, may need to adjust financial state; send OPS_ALERT
  - Both handlers must be idempotent
  - _Requirements: 11.4, 11.5_

- [ ] 23. Implement `submitEvidence`
  - Accept `disputeId` and `adminId`
  - Load dispute; validate `stripeChargebackId` is set
  - Gather internal evidence via `disputeDAL.getEvidenceByDisputeId()`
  - Map to Stripe evidence format (`product_description`, `service_date`, etc.)
  - Call `stripe.disputes.update()` with idempotency key `chargeback-evidence-{disputeId}`
  - Record submission in audit log
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

### Phase 7: Route Handlers (Slim Refactoring)

- [ ] 24. Refactor dispute creation route to use DisputeCreationService
  - Rewrite `src/app/api/disputes/route.ts` POST handler as thin handler
  - Auth + Zod parse + single call to `DisputeCreationService.createDispute()` + map errors to HTTP responses
  - Map `NotFoundError` → 404, `ForbiddenError` → 403, `ValidationError` → 400
  - Remove all inline DAL calls, audit log, notification sending, rate limit checks from route
  - Keep GET handler unchanged
  - _Requirements: 1, 2, 3, 4 (all creation requirements)_

- [ ] 25. Refactor dispute resolution route to use DisputeResolutionService
  - Rewrite `src/app/api/disputes/[id]/resolve/route.ts` as thin handler
  - Auth + admin check + Zod parse + single call to `DisputeResolutionService.resolveDispute()` + map errors
  - Remove inline financial operation loop, DAL calls, and notification sending from route
  - _Requirements: 5, 8, 9, 10 (all resolution requirements)_

- [ ] 26. Create chargeback evidence admin route
  - Create `src/app/api/admin/disputes/[id]/chargeback-evidence/route.ts`
  - Thin handler: `requireAdminResponse()` + call `ChargebackService.submitEvidence()` + map errors
  - Use `withRequestLogging` wrapper
  - _Requirements: 12.1_

### Phase 8: Webhook Extension

- [ ] 27. Add `charge.dispute.*` webhook handlers
  - In `src/services/stripe/webhook-handlers.ts`, add three new cases:
    - `charge.dispute.created` → `ChargebackService.handleChargebackCreated()`
    - `charge.dispute.updated` → `ChargebackService.handleChargebackUpdated()`
    - `charge.dispute.closed` → `ChargebackService.handleChargebackClosed()`
  - Follow existing handler pattern (extract event object, delegate to service, audit log)
  - _Requirements: 11.1, 11.6_

- [ ] 28. Document Stripe Dashboard webhook configuration
  - Add note that `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` must be added to Stripe webhook endpoint event types
  - Add to deployment verification doc
  - _Requirements: 11.6_

### Phase 9: Client-Side Changes

- [ ] 29. Update `canFileDispute` logic in rental-actions.tsx
  - Replace existing `canFileDispute` computation in `src/features/rentals/components/detail-page/rental-actions.tsx`
  - New rules: approved + `now >= startDate` → show; active → show; completed + `now <= returnConfirmedAt + 24h` → show; all other cases → hide
  - Remove dependency on `TimeWindowValidation.isDisputeFilingWindowExpired`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 30. Update `TimeWindowValidation` utility
  - In `src/features/disputes/lib/time-window-validation.ts`:
  - Add new `isDisputeFilingWindowOpen(startDate, returnConfirmedAt)` static method with unified 24h logic
  - Mark old `isDisputeFilingWindowExpired` as `@deprecated`
  - Keep old methods for backward compatibility
  - _Requirements: 1.4_

- [ ] 31. Update create-dispute form with contextual reason codes
  - In `src/features/disputes/components/create-dispute-form.tsx`:
  - Add `renter_no_show` and `owner_no_show` to reason code options
  - Show no-show codes only when rental status is `approved` and `now >= startDate`
  - The form needs `rentalStatus` and `startDate` props (or passed via context) to determine which codes to show
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 32. Pass rental context to FileDisputeDialog and CreateDisputeForm
  - Update `FileDisputeDialog` component to accept and pass `rentalStatus` and `startDate` props
  - Update `rental-actions.tsx` to pass these props when rendering the dialog
  - _Requirements: 3.2_

### Phase 10: Testing

- [ ] 33. Write unit tests for filing window validation
  - Create `src/features/disputes/services/__tests__/dispute-creation-service.test.ts` (or add to existing)
  - Test `validateFilingWindow`:
    - returnConfirmedAt set, within 24h → valid
    - returnConfirmedAt set, exactly 24h → boundary (valid)
    - returnConfirmedAt set, 24h01m → invalid
    - returnConfirmedAt not set, now >= startDate → valid
    - returnConfirmedAt not set, now < startDate → invalid
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 34. Write unit tests for DisputeCreationService
  - Mock all DALs and notifications
  - [ ] 34.1 Test successful creation
    - Dispute created, payout frozen, audit log, notification sent
    - _Requirements: 4.1, 13.1_
  - [ ] 34.2 Test authorization
    - User not renter or owner → ForbiddenError
    - _Requirements: 2.1_
  - [ ] 34.3 Test filing window expired
    - returnConfirmedAt + 25h → ValidationError with clear message
    - _Requirements: 1.5_
  - [ ] 34.4 Test active dispute exists
    - Already has open dispute → ValidationError
    - _Requirements: 2.1_
  - [ ] 34.5 Test rate limits
    - Exceeds 3/month or 10/year → ValidationError
  - [ ] 34.6 Test lifecycle freeze edge case
    - No lifecycle record → creates one with frozen status
    - _Requirements: 4.3_

- [ ] 35. Write unit tests for DisputeResolutionService
  - Mock DALs, StripeDisputeService, notifications
  - [ ] 35.1 Test favor_provider resolution
    - Deposit captured (full), lifecycle updated to `'captured'`, unfrozen to `'pending'`, notification sent
    - _Requirements: 9.1, 9.4, 10.1, 5.1_
  - [ ] 35.2 Test favor_renter resolution
    - Deposit released, lifecycle updated to `'released'`, unfrozen, notification sent
    - _Requirements: 10.2, 5.1_
  - [ ] 35.3 Test partial_provider resolution
    - Partial capture with correct amount, lifecycle captured, unfrozen
    - _Requirements: 9.2, 10.3_
  - [ ] 35.4 Test dismissed resolution
    - Same as favor_renter: release deposit, unfreeze
    - _Requirements: 10.5_
  - [ ] 35.5 Test deposit expired at resolution
    - `depositHoldStatus='expired'` → skip capture, record as skipped, still unfreeze and resolve
    - _Requirements: 9.6_
  - [ ] 35.6 Test deposit capture failure
    - Stripe returns error → financial op recorded as failed, NOT unfrozen, NOT resolved, error returned
    - _Requirements: 9.7, 5.2_
  - [ ] 35.7 Test already resolved dispute
    - Dispute in `resolved` or `closed` → ValidationError
    - _Requirements: 8.1_

- [ ] 36. Write unit tests for StripeDisputeService enhancements
  - Create or extend `src/services/stripe/__tests__/dispute-financial.test.ts`
  - Test `captureDeposit` with idempotency key `deposit-capture-{disputeId}`
  - Test partial capture passes `amount_to_capture` to Stripe
  - Test capture when `depositHoldStatus` is not `'held'` → skip
  - Test `releaseDeposit` cancels PaymentIntent and updates lifecycle
  - _Requirements: 9.3, 9.2, 9.6, 10.2_

- [ ] 37. Write unit tests for ChargebackService
  - Create `src/services/stripe/__tests__/chargeback-service.test.ts`
  - [ ] 37.1 Test `handleChargebackCreated` with existing internal dispute
    - Links via `stripeChargebackId`, freezes payout, sends ops alert
    - _Requirements: 11.2_
  - [ ] 37.2 Test `handleChargebackCreated` without existing dispute
    - Auto-creates internal dispute, sets `stripeChargebackId`, freezes, alerts
    - _Requirements: 11.3_
  - [ ] 37.3 Test `handleChargebackCreated` with unknown charge
    - Payment not found → logs error, returns without action
  - [ ] 37.4 Test `submitEvidence`
    - Calls `stripe.disputes.update()` with correct evidence and idempotency key
    - _Requirements: 12.1, 12.3_
  - [ ] 37.5 Test `submitEvidence` without stripeChargebackId
    - Throws ValidationError
    - _Requirements: 12.1_

- [ ] 38. Write integration tests for dispute creation route
  - Create or extend `src/app/api/disputes/__tests__/route.test.ts`
  - Test POST: successful creation → 201, payout frozen
  - Test POST: filing window expired → 400
  - Test POST: unauthorized user → 403
  - Test POST: active dispute exists → 400
  - Test POST: no-show reason code accepted when `approved` and past `startDate`
  - _Requirements: 1, 2, 3, 4_

- [ ] 39. Write integration tests for dispute resolution route
  - Create or extend `src/app/api/disputes/[id]/resolve/__tests__/route.test.ts`
  - Test POST favor_provider → 200, deposit captured, unfrozen
  - Test POST favor_renter → 200, deposit released, unfrozen
  - Test POST partial_provider → 200, partial capture
  - Test POST non-admin → 403
  - Test POST already resolved → 400
  - _Requirements: 5, 8, 9, 10_

- [ ] 40. Write integration tests for chargeback webhooks
  - Extend `src/services/stripe/__tests__/webhook-handlers.test.ts`
  - Test `charge.dispute.created` → links to existing dispute or creates new one, freezes payout
  - Test `charge.dispute.closed` → records outcome, ops alerted
  - Test idempotent: same event processed twice → no duplicate
  - _Requirements: 11.1, 11.5_

- [ ] 41. Write tests for client-side canFileDispute logic
  - Create or extend tests for `rental-actions.tsx` canFileDispute computation
  - Test: approved + past startDate → visible
  - Test: approved + before startDate → hidden
  - Test: active → visible
  - Test: completed + within 24h of returnConfirmedAt → visible
  - Test: completed + 25h after returnConfirmedAt → hidden
  - Test: cancelled/denied/pending → hidden
  - Test: active dispute exists → hidden
  - _Requirements: 2.1, 2.2, 2.3_

### Phase 11: Final Verification

- [ ] 42. Run linting and type checking
  - Run `bun run lint` and fix any issues
  - Run `bun run type-check` and fix any type errors
  - Ensure all new files follow existing code style
  - _Requirements: Code quality_

- [ ] 43. Verify all imports and exports
  - Check all new files have correct imports
  - Verify `DisputeCreationService` is importable from the disputes route
  - Verify `DisputeResolutionService` is importable from the resolve route
  - Verify `ChargebackService` is importable from webhook handlers
  - Ensure no circular dependencies
  - _Requirements: Code quality_

- [ ] 44. Verify Stripe Dashboard and deployment configuration
  - Document that `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` event types must be added to Stripe webhook endpoint
  - Verify existing env vars (`OPS_ALERT_EMAIL`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`) are set
  - No new environment variables needed for Phase 3
  - Create or update `specs/payments/phase3/5-deployment-verification.md`
  - _Requirements: Deployment readiness_

---

_Last updated: March 15, 2026 | Internal use only_
