# Disputes Feature - Implementation Tasks

## Overview

This document breaks down the Disputes feature implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Add dispute enums to schema definitions
  - Add `disputeStatusEnum` to `src/db/schemas/_enums.ts`
  - Define enum with values: `open`, `evidence_requested`, `under_review`, `resolved`, `closed`
  - Add `disputeReasonCodeEnum` with values: `damage`, `non_delivery`, `quality_issue`, `cancellation`, `payment_issue`, `other`
  - Add `disputeRoleEnum` with values: `renter`, `provider`
  - Add `disputeResolutionOutcomeEnum` with values: `favor_renter`, `favor_provider`, `partial_renter`, `partial_provider`, `dismissed`
  - Add `evidenceTypeEnum` with values: `image`, `text`
  - Add `auditActionTypeEnum` with values: `dispute_created`, `state_change`, `evidence_uploaded`, `evidence_deleted`, `financial_operation`, `note_created`, `note_updated`, `note_deleted`, `resolution`
  - Add `financialOperationTypeEnum` with values: `hold_payout`, `refund_partial`, `refund_full`, `capture_deposit`
  - Add `financialOperationStatusEnum` with values: `pending`, `succeeded`, `failed`
  - Export all enums for use in schemas
  - _Requirements: 2.1, 3.1, 3.8, 7.2, 7.6_

- [ ] 2. Add dispute notification types to enum
  - Add `dispute_created` to `notificationTypeEnum` in `src/db/schemas/_enums.ts`
  - Add `dispute_evidence_requested` to `notificationTypeEnum`
  - Add `dispute_evidence_deadline_approaching` to `notificationTypeEnum`
  - Add `dispute_evidence_deadline_expired` to `notificationTypeEnum`
  - Add `dispute_resolved` to `notificationTypeEnum`
  - Verify enum exports correctly
  - _Requirements: 11.4_

- [ ] 3. Create disputes table schema
  - Create `src/db/schemas/disputes.schema.ts`
  - Define `disputes` table with fields:
    - `id` (uuid, primary key)
    - `rentalId` (uuid, foreign key to rentals, unique, onDelete: restrict)
    - `createdBy` (text, foreign key to user, onDelete: cascade)
    - `createdByRole` (disputeRoleEnum)
    - `reasonCode` (disputeReasonCodeEnum)
    - `description` (text)
    - `status` (disputeStatusEnum, default: open)
    - `policyVersion` (varchar(50))
    - `evidenceDeadline` (timestamp, nullable)
    - `additionalEvidenceDeadline` (timestamp, nullable)
    - `resolvedAt` (timestamp, nullable)
    - `resolvedBy` (text, foreign key to user, nullable, onDelete: set null)
    - `resolutionOutcome` (disputeResolutionOutcomeEnum, nullable)
    - `resolutionReason` (text, nullable, max 1000 chars)
    - `stripeChargebackId` (varchar(255), nullable)
    - `createdAt` (timestamp, defaultNow)
    - `updatedAt` (timestamp, defaultNow, onUpdate)
  - Add indexes: rentalId, createdBy, status, reasonCode, createdAt, composite (rentalId, status)
  - Export table and relations
  - _Requirements: 1.6, 1.7, 1.10, 3.1, 3.8, 7.2, 7.6, 7.7, 10.3_

- [ ] 4. Create dispute_evidence table schema
  - Add `disputeEvidence` table to `src/db/schemas/disputes.schema.ts`
  - Define fields:
    - `id` (uuid, primary key)
    - `disputeId` (uuid, foreign key to disputes, onDelete: cascade)
    - `uploadedBy` (text, foreign key to user, onDelete: cascade)
    - `uploadedByRole` (disputeRoleEnum)
    - `evidenceType` (evidenceTypeEnum)
    - `content` (text) - stores image URL or text content
    - `uploadedAt` (timestamp, defaultNow)
  - Add indexes: disputeId, uploadedBy, uploadedAt
  - Export table and relations
  - _Requirements: 4.5, 4.6, 4.10_

- [ ] 5. Create dispute_audit_logs table schema
  - Add `disputeAuditLogs` table to `src/db/schemas/disputes.schema.ts`
  - Define fields:
    - `id` (uuid, primary key)
    - `disputeId` (uuid, foreign key to disputes, onDelete: cascade)
    - `actionType` (auditActionTypeEnum)
    - `userId` (text, foreign key to user, nullable, onDelete: set null)
    - `previousState` (disputeStatusEnum, nullable)
    - `newState` (disputeStatusEnum, nullable)
    - `details` (jsonb, nullable)
    - `reason` (text, nullable)
    - `createdAt` (timestamp, defaultNow)
  - Add indexes: disputeId, userId, actionType, createdAt
  - Export table and relations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 6. Create dispute_internal_notes table schema
  - Add `disputeInternalNotes` table to `src/db/schemas/disputes.schema.ts`
  - Define fields:
    - `id` (uuid, primary key)
    - `disputeId` (uuid, foreign key to disputes, onDelete: cascade)
    - `adminId` (text, foreign key to user, onDelete: cascade)
    - `content` (text)
    - `createdAt` (timestamp, defaultNow)
    - `updatedAt` (timestamp, defaultNow, onUpdate)
  - Add indexes: disputeId, adminId, createdAt
  - Export table and relations
  - _Requirements: 5.4, 5.5_

- [ ] 7. Create dispute_financial_operations table schema
  - Add `disputeFinancialOperations` table to `src/db/schemas/disputes.schema.ts`
  - Define fields:
    - `id` (uuid, primary key)
    - `disputeId` (uuid, foreign key to disputes, onDelete: cascade)
    - `operationType` (financialOperationTypeEnum)
    - `amount` (decimal(10,2), nullable)
    - `stripeOperationId` (varchar(255), nullable)
    - `stripePaymentIntentId` (varchar(255), nullable)
    - `stripeTransferId` (varchar(255), nullable)
    - `status` (financialOperationStatusEnum, default: pending)
    - `errorMessage` (text, nullable)
    - `performedBy` (text, foreign key to user, onDelete: set null)
    - `performedAt` (timestamp, defaultNow)
  - Add indexes: disputeId, stripeOperationId, status
  - Export table and relations
  - _Requirements: 6.2, 6.3, 6.9_

- [ ] 8. Define relations for dispute tables
  - Add `disputesRelations` to `src/db/schemas/disputes.schema.ts`
  - Define relations: rental, createdByUser, resolvedByUser, evidence, auditLogs, internalNotes, financialOperations
  - Add `disputeEvidenceRelations`, `disputeAuditLogsRelations`, `disputeInternalNotesRelations`, `disputeFinancialOperationsRelations`
  - Export all relations
  - _Requirements: All schema requirements_

- [ ] 9. Export dispute schema from index
  - Add dispute schema exports to `src/db/schemas/index.ts`
  - Export all tables, relations, and types
  - Verify exports are accessible
  - _Requirements: Schema integration_

- [ ] 10. Generate database migration
  - Run Drizzle migration generation: `bun run db:generate`
  - Review generated migration SQL in `src/db/migrations/`
  - Verify migration creates all enum types correctly
  - Verify migration creates all tables with correct constraints
  - Verify migration includes all indexes
  - Verify foreign key constraints are correct
  - Test migration rollback works correctly
  - _Requirements: 9.1, 9.4_

### Phase 2: Data Access Layer (DAL)

- [ ] 11. Create DisputeDAL class structure
  - Create `src/dal/dispute.dal.ts`
  - Extend `BaseDAL` class
  - Import necessary types and schemas
  - Set up error handling using `handleError()` from BaseDAL
  - _Requirements: DAL structure_

- [ ] 12. Implement dispute creation method
  - Add `create()` static method to DisputeDAL
  - Accept data: rentalId, createdBy, createdByRole, reasonCode, description, policyVersion
  - Calculate evidenceDeadline (createdAt + 7 days)
  - Insert dispute record
  - Return created dispute
  - Handle database errors
  - _Requirements: 1.6, 1.7, 1.10, 4.7_

- [ ] 13. Implement getById method with relations
  - Add `getById()` static method to DisputeDAL
  - Query dispute with all relations (rental, createdByUser, resolvedByUser, evidence, auditLogs, internalNotes, financialOperations)
  - Use Drizzle relations for efficient queries
  - Return `DisputeWithRelations` type or null
  - _Requirements: 12.2_

- [ ] 14. Implement getActiveByRentalId method
  - Add `getActiveByRentalId()` static method to DisputeDAL
  - Query for dispute where rentalId matches and status is not 'closed'
  - Return dispute or null
  - Used for checking existing disputes before creation
  - _Requirements: 1.1, 1.2_

- [ ] 15. Implement getUserDisputes method with pagination
  - Add `getUserDisputes()` static method to DisputeDAL
  - Accept userId and options: role, status, page, limit
  - Query disputes where user is renter or provider based on role filter
  - Join with rental to filter by user role
  - Include relations (evidence count, latest status)
  - Implement pagination using existing pagination helpers
  - Return `PaginatedResult<DisputeWithRelations>`
  - _Requirements: 11.7, 11.8_

- [ ] 16. Implement getAdminDisputes method with filters
  - Add `getAdminDisputes()` static method to DisputeDAL
  - Accept options: status, reasonCode, page, limit
  - Query all disputes with filters applied
  - Include all relations
  - Implement pagination
  - Return `PaginatedResult<DisputeWithRelations>`
  - _Requirements: 12.1, Admin access_

- [ ] 17. Implement updateState method
  - Add `updateState()` static method to DisputeDAL
  - Accept id, newState, userId, optional reason
  - Update dispute status and updatedAt
  - Return updated dispute
  - Note: State transition validation happens in service layer
  - _Requirements: 3.3, 3.7_

- [ ] 18. Implement resolve method
  - Add `resolve()` static method to DisputeDAL
  - Accept id, outcome, reason, resolvedBy
  - Update dispute: status='resolved', resolvedAt, resolvedBy, resolutionOutcome, resolutionReason
  - Return updated dispute
  - _Requirements: 7.2, 7.3, 7.4_

- [ ] 19. Implement checkRateLimits method (on-the-fly)
  - Add `checkRateLimits()` static method to DisputeDAL
  - Accept userId
  - Count disputes created by user in current month (using createdAt)
  - Count disputes created by user in current year (using createdAt)
  - Return: monthlyCount, yearlyCount, withinLimits (monthlyCount < 3 && yearlyCount < 10)
  - Use indexed queries on createdAt and createdBy
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 20. Implement validateTimeWindow method
  - Add `validateTimeWindow()` static method to DisputeDAL
  - Accept rentalId and reasonCode
  - Get rental with startDate and endDate
  - Calculate time window based on reasonCode:
    - DAMAGE: 7 days after endDate
    - NON_DELIVERY: 3 days after startDate
    - QUALITY_ISSUE: 7 days after endDate
    - CANCELLATION: 2 days after cancellation (if applicable)
    - PAYMENT_ISSUE: 30 days after payment
    - OTHER: 14 days after endDate
  - Check if current date is within window
  - Return: valid (boolean), message (optional error message)
  - _Requirements: 1.8, 1.9_

- [ ] 21. Implement evidence management methods
  - Add `createEvidence()` static method to DisputeDAL
  - Accept: disputeId, uploadedBy, uploadedByRole, evidenceType, content
  - Insert evidence record
  - Return created evidence
  - Add `getEvidenceByDisputeId()` static method
  - Query evidence for dispute, ordered by uploadedAt ascending
  - Return array of evidence
  - Add `checkEvidenceDeadline()` static method
  - Get dispute and check evidenceDeadline or additionalEvidenceDeadline based on status
  - Return: expired (boolean), deadline (Date | null), timeRemaining (optional milliseconds)
  - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.13_

- [ ] 22. Implement audit log methods
  - Add `createAuditLog()` static method to DisputeDAL
  - Accept: disputeId, actionType, userId (optional), previousState (optional), newState (optional), details (optional), reason (optional)
  - Insert audit log record
  - Return created audit log
  - Add `getAuditLogsByDisputeId()` static method
  - Query audit logs for dispute, ordered by createdAt ascending
  - Return array of audit logs
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 23. Implement internal notes methods
  - Add `createInternalNote()` static method to DisputeDAL
  - Accept: disputeId, adminId, content
  - Insert internal note record
  - Return created note
  - Add `getInternalNotesByDisputeId()` static method
  - Query notes for dispute, ordered by createdAt descending (newest first)
  - Return array of notes
  - Add `updateInternalNote()` static method
  - Accept noteId and content
  - Update note content and updatedAt
  - Return updated note
  - Add `deleteInternalNote()` static method
  - Accept noteId
  - Delete note record
  - _Requirements: 5.4, 5.5, 5.7, 5.8_

- [ ] 24. Implement financial operations methods
  - Add `createFinancialOperation()` static method to DisputeDAL
  - Accept: disputeId, operationType, amount (optional), stripeOperationId (optional), stripePaymentIntentId (optional), stripeTransferId (optional), status, errorMessage (optional), performedBy
  - Insert financial operation record
  - Return created operation
  - Add `getFinancialOperationsByDisputeId()` static method
  - Query financial operations for dispute, ordered by performedAt descending
  - Return array of operations
  - _Requirements: 6.3, 6.9_

- [ ] 25. Export DisputeDAL from dal index
  - Add DisputeDAL export to `src/dal/index.ts`
  - Create singleton instance if needed (following existing pattern)
  - Verify export is accessible
  - _Requirements: DAL integration_

### Phase 3: State Machine and Business Logic

- [ ] 26. Create state machine service
  - Create `src/features/disputes/lib/state-machine.ts`
  - Define `VALID_TRANSITIONS` constant mapping current state to allowed next states
  - Implement `canTransition()` static method
  - Implement `validateTransition()` static method
  - Check transition validity, final state protection, admin-only transitions
  - Return validation result with error message if invalid
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.9_

- [ ] 27. Create deadline enforcement service
  - Create `src/features/disputes/lib/deadline-enforcement.ts`
  - Implement `checkAndEnforce()` static method
  - Accept disputeId
  - Get dispute and check if status is 'evidence_requested'
  - Check if evidence deadline has expired
  - If expired, auto-transition to 'under_review' state
  - Create audit log for automatic transition
  - Send notification about deadline expiration
  - _Requirements: 4.9, 11.4_

- [ ] 28. Create time window validation utility
  - Create `src/features/disputes/lib/time-window-validation.ts`
  - Implement helper functions for each dispute type time window calculation
  - Export utility functions for use in DAL and API routes
  - _Requirements: 1.8, 1.9_

### Phase 4: Stripe Service Integration

- [ ] 29. Create Stripe dispute financial service
  - Create `src/services/stripe/dispute-financial.ts`
  - Import Stripe server instance and necessary types
  - Create `StripeDisputeService` class
  - Implement `executeOperation()` static method
  - Accept dispute and financial operation
  - Route to appropriate operation handler based on type
  - Return created financial operation record
  - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.7_

- [ ] 30. Implement refund operations
  - Add `createRefund()` private static method to StripeDisputeService
  - Handle 'refund_full' and 'refund_partial' operation types
  - Get payment record from rental
  - Calculate refund amount (full or partial)
  - Call Stripe refunds.create API
  - Include metadata: disputeId, rentalId, operationType
  - Create financial operation record via DisputeDAL
  - Handle errors and return appropriate status
  - _Requirements: 6.5, 6.8_

- [ ] 31. Implement payout hold operation
  - Add `holdPayout()` private static method to StripeDisputeService
  - Handle 'hold_payout' operation type
  - Get payment record from rental
  - Create financial operation record with status 'succeeded'
  - Note: Actual hold is enforced by preventing future payouts (business logic)
  - Store hold information for reference
  - _Requirements: 6.6_

- [ ] 32. Implement security deposit capture operation
  - Add `captureDeposit()` private static method to StripeDisputeService
  - Handle 'capture_deposit' operation type
  - Get rental record with securityDepositAuthId
  - Call Stripe paymentIntents.capture API with auth ID
  - Create financial operation record with capture ID
  - Handle errors appropriately
  - _Requirements: 6.7, 6.8_

### Phase 5: API Routes

- [ ] 33. Create disputes list API route
  - Create `src/app/api/disputes/route.ts`
  - Implement GET handler
  - Authenticate using `getAuthenticatedUserResponse()`
  - Check if user is admin or regular user
  - If admin: call `DisputeDAL.getAdminDisputes()` with query params
  - If user: call `DisputeDAL.getUserDisputes()` with userId and query params
  - Return paginated disputes
  - Handle errors using `handleApiError()`
  - _Requirements: 11.7, 12.1_

- [ ] 34. Create dispute creation API route
  - Add POST handler to `src/app/api/disputes/route.ts`
  - Authenticate using `getAuthenticatedUserResponse()`
  - Validate request body with Zod schema
  - Check for existing active dispute using `DisputeDAL.getActiveByRentalId()`
  - Verify user is renter or provider of rental
  - Check rate limits using `DisputeDAL.checkRateLimits()`
  - Validate time window using `DisputeDAL.validateTimeWindow()`
  - Get policy version from env var or config
  - Create dispute using `DisputeDAL.create()`
  - Create audit log using `DisputeDAL.createAuditLog()`
  - Send notifications (will implement in Phase 7)
  - Return created dispute
  - _Requirements: 1.1-1.11_

- [ ] 35. Create dispute details API route
  - Create `src/app/api/disputes/[id]/route.ts`
  - Implement GET handler
  - Authenticate using `getAuthenticatedUserResponse()`
  - Get dispute using `DisputeDAL.getById()`
  - Verify user has access (renter, provider, or admin)
  - Return dispute with all relations
  - Handle 404 if dispute not found
  - Handle 403 if user doesn't have access
  - _Requirements: 12.1, 12.2_

- [ ] 36. Create state transition API route
  - Create `src/app/api/disputes/[id]/state/route.ts`
  - Implement PATCH handler
  - Authenticate using `getAuthenticatedUserResponse()`
  - Get dispute using `DisputeDAL.getById()`
  - Validate transition using `DisputeStateMachine.validateTransition()`
  - Update state using `DisputeDAL.updateState()`
  - Create audit log for state change
  - Send notifications if needed (evidence_requested)
  - Return updated dispute
  - _Requirements: 3.3, 3.7, 11.4_

- [ ] 37. Create evidence upload API route
  - Create `src/app/api/disputes/[id]/evidence/route.ts`
  - Implement POST handler
  - Authenticate using `getAuthenticatedUserResponse()`
  - Get dispute and verify user is renter or provider
  - Check evidence deadline using `DisputeDAL.checkEvidenceDeadline()`
  - Verify dispute status allows evidence uploads
  - Handle file upload (image) or text content
  - For images: validate file type and size, upload to Vercel Blob
  - Create evidence record using `DisputeDAL.createEvidence()`
  - Create audit log
  - Return created evidence
  - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.8_

- [ ] 38. Create dispute resolution API route
  - Create `src/app/api/disputes/[id]/resolve/route.ts`
  - Implement POST handler
  - Require admin using `requireAdminResponse()`
  - Get dispute using `DisputeDAL.getById()`
  - Validate request body (outcome, reason, financialOperations)
  - Execute financial operations using `StripeDisputeService.executeOperation()`
  - Resolve dispute using `DisputeDAL.resolve()`
  - Create audit log for resolution
  - Send notifications (will implement in Phase 7)
  - Return resolved dispute
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 6.1, 6.8_

- [ ] 39. Create internal notes API routes
  - Create `src/app/api/disputes/[id]/notes/route.ts`
  - Implement POST handler for creating notes
  - Require admin using `requireAdminResponse()`
  - Create note using `DisputeDAL.createInternalNote()`
  - Create audit log
  - Return created note
  - Implement PUT handler for updating notes
  - Accept noteId in body
  - Update note using `DisputeDAL.updateInternalNote()`
  - Create audit log
  - Implement DELETE handler for deleting notes
  - Accept noteId in body
  - Delete note using `DisputeDAL.deleteInternalNote()`
  - Create audit log
  - _Requirements: 5.1, 5.4, 5.8, 5.9_

- [ ] 40. Create audit logs API route
  - Create `src/app/api/disputes/[id]/audit/route.ts`
  - Implement GET handler
  - Authenticate using `getAuthenticatedUserResponse()`
  - Get audit logs using `DisputeDAL.getAuditLogsByDisputeId()`
  - Return audit logs (admin can see all, users see filtered if needed)
  - _Requirements: 8.10, 12.5_

### Phase 6: React Query Hooks

- [ ] 41. Create useDisputes hook
  - Create `src/features/disputes/hooks/use-disputes.ts`
  - Implement `useDisputes()` hook using `useQuery`
  - Accept optional filters (status, role)
  - Call GET `/api/disputes` with query params
  - Set appropriate staleTime (1 minute)
  - Handle errors with toast notifications
  - Return query result
  - _Requirements: 11.7, React Query pattern_

- [ ] 42. Create useDispute hook
  - Create `src/features/disputes/hooks/use-dispute.ts`
  - Implement `useDispute(id)` hook using `useQuery`
  - Call GET `/api/disputes/[id]`
  - Set enabled based on id presence
  - Set staleTime (5 minutes)
  - Handle errors
  - Return query result
  - _Requirements: 12.1, React Query pattern_

- [ ] 43. Create useCreateDispute hook
  - Create `src/features/disputes/hooks/use-create-dispute.ts`
  - Implement `useCreateDispute()` hook using `useMutation`
  - Call POST `/api/disputes` with dispute data
  - Invalidate disputes queries on success
  - Show success/error toast notifications
  - Return mutation object
  - _Requirements: 1.1-1.11, React Query pattern_

- [ ] 44. Create useUploadEvidence hook
  - Create `src/features/disputes/hooks/use-upload-evidence.ts`
  - Implement `useUploadEvidence()` hook using `useMutation`
  - Accept disputeId and evidence data (file or text)
  - Handle FormData for file uploads
  - Call POST `/api/disputes/[id]/evidence`
  - Invalidate dispute query on success
  - Show success/error toast notifications
  - Return mutation object
  - _Requirements: 4.1-4.13, React Query pattern_

- [ ] 45. Create useResolveDispute hook
  - Create `src/features/disputes/hooks/use-resolve-dispute.ts`
  - Implement `useResolveDispute()` hook using `useMutation`
  - Accept disputeId and resolution data
  - Call POST `/api/disputes/[id]/resolve`
  - Invalidate dispute and disputes queries on success
  - Show success/error toast notifications
  - Return mutation object
  - _Requirements: 7.1-7.10, React Query pattern_

- [ ] 46. Create useUpdateDisputeState hook
  - Create `src/features/disputes/hooks/use-update-dispute-state.ts`
  - Implement `useUpdateDisputeState()` hook using `useMutation`
  - Accept disputeId, newState, and optional reason
  - Call PATCH `/api/disputes/[id]/state`
  - Invalidate dispute query on success
  - Show success/error toast notifications
  - Return mutation object
  - _Requirements: 3.3-3.9, React Query pattern_

### Phase 7: Notification Integration

- [ ] 47. Create dispute notification utility
  - Create `src/features/disputes/notifications/dispute-notifications.ts`
  - Import `sendNotification` from notification utils
  - Implement `sendDisputeNotifications()` function
  - Accept dispute and event type ('created', 'evidence_requested', 'resolved')
  - Get rental and user information
  - Send appropriate notifications based on event type
  - Use new dispute notification types from enum
  - Include disputeId, rentalId, and linkUrl in notification data
  - _Requirements: 11.4, 11.6_

- [ ] 48. Integrate notifications into API routes
  - Update dispute creation route to call `sendDisputeNotifications()` after creation
  - Update state transition route to call `sendDisputeNotifications()` for evidence_requested
  - Update resolution route to call `sendDisputeNotifications()` after resolution
  - Handle notification errors gracefully (log but don't fail request)
  - _Requirements: 11.4_

### Phase 8: Components - Dispute List and Details

- [ ] 49. Create disputes list page component
  - Create `src/app/dashboard/disputes/page.tsx` (Server Component)
  - Authenticate using `getAuthenticatedUser()`
  - Fetch disputes server-side or use client component with React Query
  - Create `src/features/disputes/components/disputes-list.tsx` (Client Component)
  - Display disputes in table or card layout
  - Show: dispute ID, rental info, status, created date, deadline (if applicable)
  - Add filters for status
  - Add pagination
  - Link to dispute details
  - _Requirements: 11.7, 11.8_

- [ ] 50. Create dispute details page component
  - Create `src/app/dashboard/disputes/[id]/page.tsx` (Server Component)
  - Authenticate and verify access
  - Create `src/features/disputes/components/dispute-details.tsx` (Client Component)
  - Display dispute information: ID, rental info, reason, status, description
  - Show evidence section with images and text
  - Show timeline of state transitions
  - Show resolution information if resolved
  - Show financial operations if any
  - Show internal notes section (admin only)
  - Add admin action buttons (admin only)
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 51. Create dispute status badge component
  - Create `src/features/disputes/components/dispute-status-badge.tsx`
  - Accept dispute status prop
  - Display colored badge with status text
  - Use appropriate colors for each status
  - Make it reusable for rental UI integration
  - _Requirements: 11.1, 11.2_

### Phase 9: Components - Dispute Creation and Evidence

- [ ] 52. Create dispute creation form component
  - Create `src/features/disputes/components/create-dispute-form.tsx`
  - Accept rentalId as prop
  - Form fields: reason code (select), description (textarea)
  - Validate form inputs
  - Use `useCreateDispute` hook
  - Show loading state during submission
  - Handle errors and display messages
  - Redirect to dispute details on success
  - _Requirements: 1.6, 1.7, 11.1_

- [ ] 53. Create evidence upload component
  - Create `src/features/disputes/components/evidence-upload.tsx`
  - Accept disputeId and dispute status as props
  - Support drag-and-drop for image uploads
  - Support text input for text evidence
  - Show evidence deadline and time remaining
  - Disable upload if deadline expired or dispute resolved
  - Use `useUploadEvidence` hook
  - Display uploaded evidence list
  - Show image thumbnails with full-size view
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.10, 4.11, 4.12, 4.13_

- [ ] 54. Create dispute timeline component
  - Create `src/features/disputes/components/dispute-timeline.tsx`
  - Accept audit logs as prop
  - Filter for state_change actions
  - Display timeline of state transitions
  - Show: state change, timestamp, user who initiated, reason
  - Order chronologically
  - Style as vertical timeline
  - _Requirements: 12.5_

### Phase 10: Components - Admin Features

- [ ] 55. Create admin resolution panel component
  - Create `src/features/disputes/components/admin-resolution-panel.tsx`
  - Only visible to admins
  - Form fields: resolution outcome (select), resolution reason (textarea)
  - Financial operations section:
    - Checkboxes/options for: hold payout, refund (full/partial with amount), capture deposit
  - Use `useResolveDispute` hook
  - Show loading state
  - Handle errors
  - Display success message
  - _Requirements: 7.1, 7.2, 7.3, 12.3_

- [ ] 56. Create internal notes section component
  - Create `src/features/disputes/components/internal-notes-section.tsx`
  - Only visible to admins
  - Display list of internal notes (newest first)
  - Add form to create new note
  - Allow editing and deleting notes (with confirmation)
  - Use API routes for CRUD operations
  - Show admin name and timestamp for each note
  - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 12.3_

- [ ] 57. Create admin state transition controls
  - Create `src/features/disputes/components/admin-state-controls.tsx`
  - Only visible to admins
  - Show current state
  - Display buttons for valid state transitions
  - For evidence_requested: show button to request evidence
  - For under_review: show button to resolve
  - Use `useUpdateDisputeState` hook
  - Show confirmation dialog for important transitions
  - _Requirements: 3.3, 3.4, 12.3, 12.8_

### Phase 11: Integration - Rental UI

- [ ] 58. Integrate dispute status into rental details page
  - Update rental details page to check for active dispute
  - Display dispute status badge if dispute exists
  - Add link to dispute details page
  - Show evidence deadline if applicable
  - Update `src/app/dashboard/rentals/[id]/page.tsx` or relevant component
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 59. Add dispute creation link to rental details
  - Add "File Dispute" button/link to rental details page
  - Only show if: user is renter or provider, no active dispute exists, within time window
  - Link to dispute creation form with rentalId pre-filled
  - _Requirements: 1.1, 1.2, 1.8_

### Phase 12: Testing and Validation

- [ ] 60. Write unit tests for DisputeDAL methods
  - Create `src/dal/__tests__/dispute.dal.test.ts`
  - Test dispute creation with valid data
  - Test rate limit checking (on-the-fly calculation)
  - Test time window validation for each reason code
  - Test state transitions
  - Test evidence management
  - Test audit log creation
  - Test internal notes CRUD
  - Test financial operations creation
  - Mock database calls appropriately
  - _Requirements: All DAL requirements_

- [ ] 61. Write unit tests for state machine
  - Create `src/features/disputes/lib/__tests__/state-machine.test.ts`
  - Test valid transitions for each state
  - Test invalid transitions are rejected
  - Test final state protection (resolved, closed)
  - Test admin-only transition validation
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.9_

- [ ] 62. Write integration tests for API routes
  - Create `src/app/api/disputes/__tests__/route.test.ts`
  - Test dispute creation with authentication
  - Test dispute creation with existing dispute (should fail)
  - Test dispute creation with rate limit exceeded (should fail)
  - Test dispute creation outside time window (should fail)
  - Test unauthorized access (should fail)
  - Test admin-only endpoints require admin
  - Mock Stripe service calls
  - _Requirements: API route requirements_

- [ ] 63. Test deadline enforcement
  - Create test for deadline check logic
  - Test automatic transition when deadline expires
  - Test on-demand deadline checking
  - Verify notifications are sent on deadline expiration
  - _Requirements: 4.9, 27_

- [ ] 64. Test Stripe financial operations
  - Create `src/services/stripe/__tests__/dispute-financial.test.ts`
  - Mock Stripe API calls
  - Test refund operations (full and partial)
  - Test payout hold operation
  - Test security deposit capture
  - Test error handling for failed operations
  - _Requirements: 6.1, 6.5, 6.6, 6.7, 6.8_

### Phase 13: Environment Configuration

- [ ] 65. Add dispute policy version configuration
  - Add `DISPUTE_POLICY_VERSION` to `.env.example`
  - Document in README or environment docs
  - Set default value in code if not provided (e.g., "v1.0")
  - Update API route to use env var
  - _Requirements: 1.10, 8.8_

- [ ] 66. Verify all environment variables are documented
  - Check that Stripe keys are already configured
  - Verify Vercel Blob configuration exists
  - Document any new environment variables needed
  - _Requirements: Configuration_

### Phase 14: Documentation and Cleanup

- [ ] 67. Update feature documentation
  - Create or update `src/features/disputes/README.md`
  - Document dispute workflow
  - Document API endpoints
  - Document component usage
  - Include examples
  - _Requirements: Documentation_

- [ ] 68. Add JSDoc comments to all public methods
  - Add JSDoc to all DisputeDAL methods
  - Add JSDoc to state machine methods
  - Add JSDoc to Stripe service methods
  - Add JSDoc to API route handlers
  - Include parameter descriptions and return types
  - _Requirements: Code quality standards_

- [ ] 69. Verify all imports and exports
  - Check all files have correct imports
  - Verify all exports are used
  - Remove unused imports
  - Ensure circular dependencies don't exist
  - _Requirements: Code quality_

- [ ] 70. Run final linting and type checking
  - Run `bun run lint` and fix any issues
  - Run `bun run type-check` and fix any type errors
  - Ensure all files follow code quality standards
  - _Requirements: Code quality standards_
