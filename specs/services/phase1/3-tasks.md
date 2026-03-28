# HOA Services Marketplace (Phase 1) — Implementation Tasks

## Overview

This document breaks down the Phase 1 Services Marketplace implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task is sized for a single development session and includes references to specific requirements.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Add new enums to schema definitions
  - Open `src/db/schemas/_enums.ts`
  - Add `serviceListingStatusEnum` with values: `pending_approval`, `active`, `inactive`, `denied`
  - Add `servicePricingTypeEnum` with values: `fixed`, `hourly`
  - Add `serviceBookingStatusEnum` with values: `pending`, `accepted`, `declined`, `payment_failed`, `completed`, `cancelled`
  - Add `servicePayoutStatusEnum` with values: `pending`, `processing`, `completed`, `failed`
  - Extend existing `notificationTypeEnum` with 9 new values: `service_booking_requested`, `service_booking_accepted`, `service_booking_declined`, `service_booking_completed`, `service_payout_sent`, `service_listing_approved`, `service_listing_rejected`, `service_listing_pending`, `service_no_show_reported`
  - Export all new enums
  - _Requirements: 2.1, 3.1, 4.1, 5.1_

- [ ] 2. Create `services.schema.ts` with core service tables
  - Create `src/db/schemas/services.schema.ts`
  - Define `service_listing_categories` table: `id` (uuid pk), `name` (varchar 100, unique, notNull), `description` (text), `createdAt` (timestamp defaultNow)
  - Define `service_listings` table with all fields per design: `id`, `communityId` (fk communities cascade), `providerId` (fk users cascade), `categoryId` (fk service_listing_categories), `title`, `description`, `pricingType`, `price`, `photos` (jsonb string[]), `serviceNotes`, `status` (default pending_approval), `adminNote`, `rejectionReason`, `createdAt`, `updatedAt`
  - Add indexes: `sl_community_status_idx` on (communityId, status), `sl_provider_idx` on (providerId), `sl_category_idx` on (categoryId)
  - Define `service_bookings` table with all fields per design: `id`, `listingId` (fk restrict), `requesterId` (fk restrict), `providerId` (fk restrict), `communityId` (fk restrict), `proposedDate`, `proposedTime`, `hours`, `notes`, `declineReason`, `servicePrice`, `serviceFee`, `totalAmount`, `status` (default pending), `stripePaymentIntentId`, `stripeChargeId`, `paymentStatus`, `refundAmount`, `stripeRefundId`, `cancelledAt`, `cancelledBy`, `cancellationReason`, `completedAt`, `payoutStatus`, `stripeTransferId`, `ownerTransferredAt`, `createdAt`, `updatedAt`
  - Add indexes: `sb_payout_status_idx`, `sb_completed_at_idx`, `sb_provider_idx`, `sb_requester_idx`
  - Define `service_provider_profiles` table: `id`, `userId` (fk users cascade, unique), `bio`, `aggregateRating` (numeric 3,2), `reviewCount` (default 0), `createdAt`, `updatedAt`
  - Define relations for all tables
  - Export all tables and relations
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1_

- [ ] 3. Create `service-reviews.schema.ts`
  - Create `src/db/schemas/service-reviews.schema.ts`
  - Define `service_reviews` table: `id`, `bookingId` (fk service_bookings cascade), `listingId` (fk service_listings cascade), `reviewerId` (fk users cascade), `revieweeId` (fk users cascade), `rating` (integer), `comment` (text), `createdAt`
  - Add unique index `sr_reviewer_booking_idx` on (bookingId, reviewerId) — enforces one review per party per booking
  - Add indexes: `sr_reviewee_idx` on (revieweeId), `sr_listing_idx` on (listingId)
  - Define relations
  - Export table and relations
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 4. Create `service-no-show-reports.schema.ts`
  - Create `src/db/schemas/service-no-show-reports.schema.ts`
  - Define `service_no_show_reports` table: `id`, `bookingId` (fk service_bookings cascade), `reportedBy` (fk users cascade), `notes` (text), `reportedAt` (timestamp defaultNow)
  - Define relations
  - Export table and relations
  - _Requirements: 5.5_

- [ ] 5. Export new schemas from index
  - Update `src/db/schemas/index.ts` to export all new schema files:
    - `services.schema.ts` exports (serviceListingCategories, serviceListings, serviceBookings, serviceProviderProfiles + relations)
    - `service-reviews.schema.ts` exports
    - `service-no-show-reports.schema.ts` exports
  - Verify all new enums and tables are accessible
  - _Requirements: Schema integration_

- [ ] 6. Generate and verify database migration
  - Run `bun run db:generate`
  - Review the generated SQL in `src/db/migrations/`
  - Verify migration creates 4 new enums correctly
  - Verify migration extends `notification_type` enum with 9 new values
  - Verify all 6 new tables are created with correct columns, types, and constraints
  - Verify all indexes are created (composite + single-column)
  - Verify all foreign key constraints and `onDelete` behaviors are correct
  - Confirm migration is additive and backward-compatible with existing rental system
  - _Requirements: All schema requirements_

---

### Phase 2: Data Access Layer

- [ ] 7. Create ServiceListingDAL
  - Create `src/dal/service-listing.dal.ts`
  - Extend `BaseDAL` from `src/dal/base.ts`
  - Implement `create(data: CreateListingData): Promise<ServiceListing>` — insert into service_listings
  - Implement `update(listingId: string, updates: Partial<ServiceListing>): Promise<ServiceListing>` — update and return updated row
  - Implement `getById(listingId: string): Promise<ServiceListing | null>` — fetch single listing with category and provider
  - Implement `findByCommunity(communityId: string, filters?: { categoryId?: string }, pagination?: { limit: number; offset: number }): Promise<ServiceListing[]>` — active listings for a community, optional category filter
  - Implement `findPendingApproval(): Promise<ServiceListing[]>` — listings where status = 'pending_approval', includes provider info
  - Implement `findByProvider(providerId: string): Promise<ServiceListing[]>` — all listings for a provider
  - Use `handleError()` from BaseDAL for all error handling
  - Export `ServiceListingDAL` class
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2_

- [ ] 8. Create ServiceBookingDAL
  - Create `src/dal/service-booking.dal.ts`
  - Extend `BaseDAL`
  - Implement `create(data: CreateBookingData): Promise<ServiceBooking>` — insert booking record
  - Implement `update(bookingId: string, updates: Partial<ServiceBooking>): Promise<ServiceBooking>` — update and return
  - Implement `getById(bookingId: string): Promise<ServiceBooking | null>` — fetch booking with listing and user info
  - Implement `getCancellationContext(bookingId: string): Promise<ServiceBookingCancellationContext>` — aggregates all context needed for cancellation: status, proposedDate, totalAmount, stripeChargeId, requesterId, providerId
  - Implement `claimForPayoutProcessing(bookingId: string): Promise<boolean>` — atomic UPDATE SET payoutStatus='processing' WHERE id=$1 AND payoutStatus='pending' RETURNING \*; returns true if updated, false if not
  - Implement `findEligibleForPayout(cutoff: Date, limit: number): Promise<PayoutEligibleBooking[]>` — JOIN users to get providerConnectedAccountId; WHERE completedAt < cutoff AND payoutStatus = 'pending'; ORDER BY completedAt ASC; LIMIT limit
  - Implement `findByRequester(requesterId: string): Promise<ServiceBooking[]>`
  - Implement `findByProvider(providerId: string): Promise<ServiceBooking[]>`
  - Export `ServiceBookingDAL` class and relevant interfaces
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

- [ ] 9. Create ServiceReviewDAL
  - Create `src/dal/service-review.dal.ts`
  - Extend `BaseDAL`
  - Implement `create(data: CreateReviewData): Promise<ServiceReview>` — insert review; DB unique constraint handles duplicate rejection
  - Implement `findByListing(listingId: string): Promise<ServiceReview[]>` — all reviews for a listing, with reviewer info
  - Implement `findByBooking(bookingId: string): Promise<ServiceReview[]>` — both reviews for a booking
  - Implement `calculateProviderAggregateRating(providerId: string): Promise<{ average: number; count: number }>` — AVG and COUNT of ratings where revieweeId = providerId across service_reviews
  - Implement `updateProviderAggregateRating(providerId: string): Promise<void>` — calls calculateProviderAggregateRating, then updates service_provider_profiles.aggregateRating and reviewCount for that user
  - Export `ServiceReviewDAL` class
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 10. Export new DALs from DAL index
  - Update `src/dal/index.ts` to instantiate and export:
    - `serviceListingDAL` (singleton ServiceListingDAL)
    - `serviceBookingDAL` (singleton ServiceBookingDAL)
    - `serviceReviewDAL` (singleton ServiceReviewDAL)
  - Follow the existing singleton pattern used by `rentalDAL`, `paymentDAL`, etc.
  - _Requirements: DAL integration_

---

### Phase 3: Stripe Service Layer

- [ ] 11. Create service-payments.ts
  - Create `src/services/stripe/service-payments.ts`
  - Define `ChargeServicePaymentParams` interface: `customerId`, `paymentMethodId`, `amount` (dollars), `metadata` (paymentType: "service_charge", bookingId, serviceId, providerId, requesterId), `idempotencyKey` (format: `service-charge-{bookingId}`)
  - Implement `chargeServicePayment(params)`: create Stripe PaymentIntent with `confirm: true`, `off_session: true`, `capture_method: 'automatic'`, **no `transfer_data`** — funds stay in platform account; store `paymentIntent.latest_charge` as chargeId; use idempotency key
  - Define `CreateServiceTransferParams` interface: `bookingId`, `providerConnectedAccountId`, `chargeId` (source_transaction), `servicePrice` (dollars — NOT totalAmount), `idempotencyKey` (format: `service-transfer-{bookingId}`)
  - Define `ServiceTransferResult` type: `{ success: true; transferId: string } | { success: false; error: string }`
  - Implement `createServiceTransfer(params)`: call `stripe.transfers.create()` with `source_transaction: chargeId`, `destination: providerConnectedAccountId`; transfer amount = `Math.round(servicePrice * 100) - Math.round(servicePrice * 100 * PLATFORM_FEE_PERCENTAGE)`; return result
  - Wrap both functions with retry logic using `isRetryablePaymentError()` from `src/services/stripe/rental-payments.ts` (retry once after 1s for retryable errors)
  - Export both functions and interfaces
  - _Requirements: 3.3, 4.2, 4.3, 4.4_

---

### Phase 4: Notification Helpers

- [ ] 12. Create service-notifications.ts
  - Create `src/features/services/notifications/service-notifications.ts`
  - Import and delegate to existing `sendNotification()` from `src/features/notifications/utils/send-notification.ts`
  - Implement all 9 notification helpers using the corresponding new notification types:
    - `sendNewBookingRequestNotification(providerId, booking)` → type: `service_booking_requested`
    - `sendBookingAcceptedNotification(requesterId, booking)` → type: `service_booking_accepted`
    - `sendBookingDeclinedNotification(requesterId, booking, reason)` → type: `service_booking_declined`
    - `sendJobCompletedNotification(requesterId, booking)` → type: `service_booking_completed`
    - `sendServicePayoutNotification(providerId, booking)` → type: `service_payout_sent`
    - `sendListingApprovedNotification(providerId, listing)` → type: `service_listing_approved`
    - `sendListingRejectedNotification(providerId, listing, reason)` → type: `service_listing_rejected`
    - `sendListingPendingAdminNotification(listing)` → type: `service_listing_pending`
    - `sendNoShowReportAdminNotification(report, booking)` → type: `service_no_show_reported`
  - Export all helpers
  - _Requirements: 2.5, 3.4, 3.5, 4.4, 5.4, 5.5_

---

### Phase 5: Service Layer

- [ ] 13. Create ServiceListingService
  - Create `src/features/services/services/service-listing-service.ts`
  - Implement `static async createListing(formData: CreateListingInput, providerId: string, context: AuditContext)`:
    - Verify provider has an active Stripe Connected Account (via users table); return error `stripe_connect_required` if not
    - Insert listing via `serviceListingDAL.create()` with `status: 'pending_approval'`
    - Create audit log entry
    - Call `sendListingPendingAdminNotification()`
    - Return created listing
  - Implement `static async editListing(listingId, providerId, updates, context)`:
    - Verify listing exists and `providerId` matches; throw `ForbiddenError` if not
    - Update via `serviceListingDAL.update()`; no re-approval required in Phase 1
    - Create audit log
    - Return updated listing
  - Implement `static async deactivateListing(listingId, providerId, context)`:
    - Verify ownership
    - Set `status: 'inactive'` via `serviceListingDAL.update()`
    - Create audit log
  - Implement `static async approveListing(listingId, adminId, note?)`:
    - Set `status: 'active'`, optionally store `adminNote`
    - Create audit log
    - Call `sendListingApprovedNotification(listing.providerId, listing)`
  - Implement `static async rejectListing(listingId, adminId, reason)`:
    - Validate `reason` is non-empty
    - Set `status: 'denied'`, store `rejectionReason`
    - Create audit log
    - Call `sendListingRejectedNotification(listing.providerId, listing, reason)`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2_

- [ ] 14. Create ServiceBookingService
  - Create `src/features/services/services/service-booking-service.ts`
  - Implement `static async createBooking(formData: CreateBookingInput, requesterId: string, context: AuditContext)`:
    - Verify listing is `status: 'active'`; throw `NotFoundError` if not
    - Verify `requesterId !== listing.providerId`; throw `ForbiddenError` (`cannot_book_own_listing`) if so
    - Verify requester has a saved default payment method; throw `ValidationError` (`payment_method_required`) if not
    - Calculate: `serviceFee = calculateServiceFee(servicePrice)`, `totalAmount = servicePrice + serviceFee` (or `price * hours + serviceFee` for hourly)
    - Insert booking via `serviceBookingDAL.create()` with `status: 'pending'`
    - Create audit log
    - Call `sendNewBookingRequestNotification(listing.providerId, booking)`
    - Return created booking
  - Implement `static async acceptBooking(bookingId, providerId, context)`:
    - Verify booking exists and `providerId` matches; verify `status === 'pending'`
    - Resolve requester's Stripe customerId and default paymentMethodId
    - Verify provider Stripe Connect is active
    - Call `chargeServicePayment()` with idempotency key `service-charge-{bookingId}`
    - On success: store `stripePaymentIntentId` + `stripeChargeId` (from `paymentIntent.latest_charge`); set `status: 'accepted'`; insert payments record (paymentType: service_charge); call `sendBookingAcceptedNotification()`
    - On failure: set `status: 'payment_failed'`; notify both parties; log error
    - Create audit log
  - Implement `static async declineBooking(bookingId, providerId, reason, context)`:
    - Validate `reason` is non-empty (`decline_reason_required`)
    - Verify booking exists, provider matches, `status === 'pending'`
    - Set `status: 'declined'`, store `declineReason`
    - Call `sendBookingDeclinedNotification(booking.requesterId, booking, reason)`
    - Create audit log
  - Implement `static async completeBooking(bookingId, providerId, context)`:
    - Verify booking exists, provider matches, `status === 'accepted'`
    - Set `status: 'completed'`, `completedAt: now`, `payoutStatus: 'pending'`
    - Call `sendJobCompletedNotification(booking.requesterId, booking)`
    - Create audit log (note: no payout here — deferred to cron)
  - Implement `static async cancelBooking(bookingId, userId, reason?, context?)`:
    - Fetch context via `serviceBookingDAL.getCancellationContext()`
    - Verify `status` is `'pending'` or `'accepted'`; verify userId is requester or provider
    - Calculate refund:
      - Requester cancels + proposedDate > 24hrs: 100% of totalAmount
      - Requester cancels + proposedDate ≤ 24hrs: 50% of totalAmount
      - Provider cancels: 100% of totalAmount
    - Call `processRefund()` from `src/services/stripe/refund.ts` with `stripeChargeId` and calculated amount
    - On success: set `status: 'cancelled'`, store `refundAmount`, `stripeRefundId`, `cancelledAt`, `cancelledBy`, `cancellationReason`
    - On refund failure: log + `captureNonCriticalError()` + `sendOpsAlert()`
    - Notify both parties with refund details
    - Create audit log
  - Implement `static async reportNoShow(bookingId, reportedBy, notes?)`:
    - Verify booking `status === 'accepted'`; verify reportedBy is requester or provider
    - Insert `service_no_show_reports` record
    - Call `sendNoShowReportAdminNotification(report, booking)` — no automatic refund
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 15. Create ServicePayoutService
  - Create `src/features/services/services/service-payout-service.ts`
  - Define `PayoutSummary` interface: `{ eligible: number; processed: number; succeeded: number; failed: number }`
  - Implement `static async processPayouts(batchSize: number): Promise<PayoutSummary>`:
    1. Set `cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)`
    2. Call `serviceBookingDAL.findEligibleForPayout(cutoff, batchSize)` → eligible list
    3. For each eligible booking (process independently — wrap in try/catch):
       a. Call `serviceBookingDAL.claimForPayoutProcessing(booking.id)` — skip if returns false
       b. Call `createServiceTransfer()` with idempotency key `service-transfer-{bookingId}`
       c. On success: set `payoutStatus: 'completed'`, store `stripeTransferId` and `ownerTransferredAt`; call `sendServicePayoutNotification(booking.providerId, booking)`
       d. On failure: set `payoutStatus: 'failed'`; call `sendOpsAlert()` with bookingId + error details
    4. Return summary counts
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 16. Create ServiceReviewService
  - Create `src/features/services/services/service-review-service.ts`
  - Implement `static async submitReview(bookingId: string, reviewerId: string, input: { rating: number; comment?: string }): Promise<void>`:
    - Fetch booking; verify `status === 'completed'`
    - Verify `reviewerId` is requester or provider
    - Validate `rating` is integer 1–5
    - Determine `revieweeId` (opposite party from reviewer)
    - Call `serviceReviewDAL.create()` — unique constraint will throw `ConflictError` on duplicate; surface as `review_already_submitted` (409)
    - Call `serviceReviewDAL.updateProviderAggregateRating(listing.providerId)` to recalculate aggregate
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

---

### Phase 6: API Routes

- [ ] 17. Create listings browse and create routes
  - Create `src/app/api/services/listings/route.ts`
  - `GET`: require auth; extract `communityId` from user's membership; call `serviceListingDAL.findByCommunity()`; support optional `categoryId` query param; return listings array
  - `POST`: require auth; parse and validate input (Zod); call `ServiceListingService.createListing()`; return `{ listingId, status }`
  - Use `withRequestLogging`, `requireAuthResponse`, `tryCatch` per existing route patterns
  - _Requirements: 2.1, 2.2_

- [ ] 18. Create listing detail and edit routes
  - Create `src/app/api/services/listings/[id]/route.ts`
  - `GET`: require auth; call `serviceListingDAL.getById()`; return listing detail
  - `PATCH`: require auth; parse and validate updates (Zod); call `ServiceListingService.editListing()`; return updated listing
  - _Requirements: 2.2, 2.3_

- [ ] 19. Create listing deactivate route
  - Create `src/app/api/services/listings/[id]/deactivate/route.ts`
  - `POST`: require auth; call `ServiceListingService.deactivateListing()`; return `{ status: 'inactive' }`
  - _Requirements: 2.4_

- [ ] 20. Create booking creation route
  - Create `src/app/api/services/bookings/route.ts`
  - `POST`: require auth; parse and validate input (Zod — proposedDate, proposedTime, hours, notes, listingId); call `ServiceBookingService.createBooking()`; return `{ bookingId, status: 'pending' }`
  - _Requirements: 3.1_

- [ ] 21. Create booking accept route
  - Create `src/app/api/services/bookings/[id]/accept/route.ts`
  - `POST`: require auth; call `ServiceBookingService.acceptBooking(bookingId, userId, context)`; return updated booking status
  - _Requirements: 3.2, 3.3_

- [ ] 22. Create booking decline route
  - Create `src/app/api/services/bookings/[id]/decline/route.ts`
  - `POST`: require auth; parse body (Zod — reason required); call `ServiceBookingService.declineBooking()`; return `{ status: 'declined' }`
  - _Requirements: 3.4_

- [ ] 23. Create booking complete route
  - Create `src/app/api/services/bookings/[id]/complete/route.ts`
  - `POST`: require auth; call `ServiceBookingService.completeBooking()`; return `{ status: 'completed' }`
  - _Requirements: 4.1_

- [ ] 24. Create booking cancel route
  - Create `src/app/api/services/bookings/[id]/cancel/route.ts`
  - `POST`: require auth; parse optional body (Zod — reason); sanitize reason with `sanitizeTextWithMaxLength()`; call `ServiceBookingService.cancelBooking()`; return `{ status: 'cancelled', refundAmount }`
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 25. Create no-show report route
  - Create `src/app/api/services/bookings/[id]/no-show/route.ts`
  - `POST`: require auth; parse optional body (Zod — notes); call `ServiceBookingService.reportNoShow()`; return `{ reported: true }`
  - _Requirements: 5.5_

- [ ] 26. Create booking reviews route
  - Create `src/app/api/services/bookings/[id]/reviews/route.ts`
  - `POST`: require auth; parse and validate body (Zod — rating 1–5, comment optional); call `ServiceReviewService.submitReview()`; return `{ submitted: true }`
  - Handle `ConflictError` → 409 `review_already_submitted`
  - _Requirements: 7.1, 7.2_

- [ ] 27. Create provider profile routes
  - Create `src/app/api/services/providers/[userId]/route.ts`
  - `GET`: require auth; fetch `service_provider_profiles` for userId + their active listings + recent reviews; return profile data
  - `PATCH`: require auth; verify `userId === session.userId`; parse body (Zod — bio); update `service_provider_profiles.bio`; return updated profile
  - _Requirements: 6.1, 6.2_

- [ ] 28. Create admin listing approval routes
  - Create `src/app/api/admin/services/listings/[id]/approve/route.ts`
  - `POST`: require auth + admin role; parse optional body (Zod — note); call `ServiceListingService.approveListing()`; return `{ status: 'active' }`
  - Create `src/app/api/admin/services/listings/[id]/reject/route.ts`
  - `POST`: require auth + admin role; parse body (Zod — reason required); call `ServiceListingService.rejectListing()`; return `{ status: 'denied' }`
  - _Requirements: 2.5, 3.1, 3.2_

---

### Phase 7: Cron Endpoint and Workflow

- [ ] 29. Create process-service-payouts cron route
  - Create `src/app/api/cron/process-service-payouts/route.ts`
  - `GET` handler:
    1. Verify `CRON_SECRET` bearer token via `verifyCronSecret()` — return 401 if invalid
    2. Use `withRequestLogging` wrapper
    3. Call `ServicePayoutService.processPayouts(20)` inside `tryCatch`
    4. Record run in `CronRunHistoryDAL` (reuse existing pattern)
    5. Return `NextResponse.json({ processedCount, successCount, failureCount })`
  - On unexpected error: call `sendOpsAlert()` + return 500
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 30. Create GitHub Actions cron workflow
  - Create `.github/workflows/cron-process-service-payouts.yml`
  - Schedule: `0 * * * *` (hourly) + `workflow_dispatch` trigger
  - Job: `curl -f -X GET "${{ secrets.APP_URL }}/api/cron/process-service-payouts" -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"`
  - Match structure of existing cron workflow files in `.github/workflows/`
  - _Requirements: 4.1_

---

### Phase 8: Presentation Layer

- [ ] 31. Create service browse page
  - Create `src/app/dashboard/services/page.tsx`
  - Server component: fetch active listings for user's community via `serviceListingDAL.findByCommunity()`
  - Category filter tabs above listing grid (fetch categories for tab labels)
  - Listing card: provider avatar + name, title, pricing type + price, aggregate star rating (or "New" badge if no reviews)
  - Empty state: "No services available in your community yet" with CTA to create a listing (shown only if user has active Stripe Connect)
  - Pass data to client grid component for category filter interactivity
  - _Requirements: 1.1, 1.2_

- [ ] 32. Create listing detail page
  - Create `src/app/dashboard/services/listings/[id]/page.tsx`
  - Server component: fetch listing by id (404 if not found or not in user's community)
  - Render: title, description, service notes, photo gallery, provider summary (avatar + name + rating → links to provider profile), reviews section
  - Booking CTA: hidden if viewer is the listing's provider ("This is your listing" label instead); if viewer has no payment method, CTA shows prompt to add one
  - _Requirements: 1.2, 3.1_

- [ ] 33. Create listing create page
  - Create `src/app/dashboard/services/listings/create/page.tsx`
  - Server component gate: if user has no active Stripe Connected Account, render onboarding prompt — do not render form
  - Form fields: title, category (dropdown from seeded categories), pricingType (fixed/hourly), price, description, photos (optional), serviceNotes (optional)
  - On submit: POST to `/api/services/listings`
  - Success state: "Your listing has been submitted for review. You'll be notified when it's approved."
  - _Requirements: 2.1, 2.2_

- [ ] 34. Create listing edit page
  - Create `src/app/dashboard/services/listings/[id]/edit/page.tsx`
  - Server component: fetch listing; verify ownership (redirect if not provider)
  - Pre-populate form with current values; same fields as create form
  - Deactivate button: visible on any non-denied listing; calls POST `/api/services/listings/[id]/deactivate`
  - On save: PATCH `/api/services/listings/[id]`
  - _Requirements: 2.3, 2.4_

- [ ] 35. Create booking request flow page
  - Create `src/app/dashboard/services/listings/[id]/book/page.tsx`
  - 3-step client component flow:
    - Step 1 — Details: proposed date (date picker), proposed time (time input), hours (if pricingType = 'hourly'), notes to provider (optional)
    - Step 2 — Summary: itemized price breakdown (fixed: price + service fee = total; hourly: rate × hours + service fee = total)
    - Step 3 — Confirm: submit button → POST `/api/services/bookings`
  - After submit: redirect to `/dashboard/services/bookings/[id]` with confirmation banner
  - _Requirements: 3.1_

- [ ] 36. Create my bookings list page
  - Create `src/app/dashboard/services/bookings/page.tsx`
  - Two tabs: Booked (user as requester) and Providing (user as provider)
  - Booking card: counterparty avatar + name, listing title, proposed date, status badge
  - Status badges: Pending, Accepted, Declined, Completed, Cancelled, Payment Failed
  - _Requirements: 3.1, 3.2, 3.4, 4.1, 5.1_

- [ ] 37. Create booking detail page
  - Create `src/app/dashboard/services/bookings/[id]/page.tsx`
  - Fetch booking with listing + user data; verify viewer is requester or provider
  - Render status-driven action surface per design:
    - `pending` — Requester: Cancel; Provider: Accept, Decline
    - `accepted` — Requester: Cancel, Report No-Show; Provider: Mark Complete, Cancel
    - `payment_failed` — Requester: prompt to update payment method; Provider: info shown
    - `completed` — Both: Leave Review (if not yet submitted, replaced with submitted review after); Requester: Report No-Show
    - `declined` — read-only, decline reason shown
    - `cancelled` — read-only, refund amount shown
  - Dialogs: Decline (required reason), Cancel (shows refund tier), Mark Complete (confirmation)
  - Leave Review: inline star rating (1–5) + optional comment
  - _Requirements: 3.2, 3.4, 4.1, 5.1, 5.2, 5.3, 5.5, 7.1_

- [ ] 38. Create provider profile page
  - Create `src/app/dashboard/services/providers/[userId]/page.tsx`
  - Fetch provider profile, their active listings, and all reviews where revieweeId = userId
  - Render: avatar, name, member since, bio (editable inline by the provider via PATCH `/api/services/providers/[userId]`), aggregate star rating + count, active listings grid, reviews list
  - _Requirements: 6.1, 6.2_

- [ ] 39. Create admin listing review page
  - Create `src/app/admin/dashboard/services/listings/review/page.tsx`
  - Server component: fetch listings with `status: 'pending_approval'` via `serviceListingDAL.findPendingApproval()`; require admin role
  - Table rows: provider name, listing title, category, pricing, submitted date
  - Approve action: optional internal note field → POST `/api/admin/services/listings/[id]/approve`
  - Reject action: required reason field → POST `/api/admin/services/listings/[id]/reject`
  - Empty state: "No listings pending review"
  - _Requirements: 2.5, 3.1, 3.2_

- [ ] 40. Add Services nav link to dashboard navigation
  - Locate the existing dashboard nav component (sidebar or top nav)
  - Add `/dashboard/services` link with appropriate label ("Services") and icon
  - Place the link in a logical position in the nav hierarchy (after or alongside Explore/Rentals section)
  - Verify link is visible and active state is applied correctly when on any `/dashboard/services/*` route
  - _Requirements: 1.1_

---

### Phase 9: React Query Hooks

- [ ] 41. Create service listing query and mutation hooks
  - Create `src/features/services/hooks/use-service-listings.ts` (or follow existing hook file organization)
  - `useServiceListings(communityId, filters?)` — query: GET `/api/services/listings`
  - `useServiceListing(listingId)` — query: GET `/api/services/listings/[id]`
  - `useCreateServiceListing()` — mutation: POST `/api/services/listings`; invalidate listings query on success
  - `useEditServiceListing(listingId)` — mutation: PATCH `/api/services/listings/[id]`; invalidate listing query on success
  - `useDeactivateServiceListing(listingId)` — mutation: POST `/api/services/listings/[id]/deactivate`; invalidate listings query on success
  - Follow existing `useCreateMutation` pattern from rental hooks
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 42. Create service booking query and mutation hooks
  - Create booking hooks following existing patterns:
  - `useServiceBookings(role: 'requester' | 'provider')` — query: GET `/api/services/bookings?role=...`
  - `useServiceBooking(bookingId)` — query: GET `/api/services/bookings/[id]`
  - `useCreateServiceBooking()` — mutation: POST `/api/services/bookings`
  - `useAcceptServiceBooking(bookingId)` — mutation: POST `/api/services/bookings/[id]/accept`
  - `useDeclineServiceBooking(bookingId)` — mutation: POST `/api/services/bookings/[id]/decline`
  - `useCompleteServiceBooking(bookingId)` — mutation: POST `/api/services/bookings/[id]/complete`
  - `useCancelServiceBooking(bookingId)` — mutation: POST `/api/services/bookings/[id]/cancel`
  - `useReportNoShow(bookingId)` — mutation: POST `/api/services/bookings/[id]/no-show`
  - Invalidate relevant booking queries on mutation success
  - _Requirements: 3.1, 3.2, 3.4, 4.1, 5.1, 5.5_

- [ ] 43. Create review and provider profile hooks
  - `useSubmitServiceReview(bookingId)` — mutation: POST `/api/services/bookings/[id]/reviews`; invalidate booking query on success
  - `useProviderProfile(userId)` — query: GET `/api/services/providers/[userId]`
  - `useUpdateProviderBio()` — mutation: PATCH `/api/services/providers/[userId]`; invalidate profile query on success
  - _Requirements: 6.2, 7.1_

---

### Phase 10: Testing

- [ ] 44. Unit tests for ServiceListingDAL
  - Create `src/dal/__tests__/service-listing.dal.test.ts`
  - Test `create()` — verify correct insert, returns created record
  - Test `update()` — verify fields updated, updatedAt refreshed
  - Test `getById()` — found and not-found cases
  - Test `findByCommunity()` — only returns active listings; category filter applied; pagination applied
  - Test `findPendingApproval()` — only returns pending_approval listings
  - Test `findByProvider()` — scoped to correct providerId
  - Mock database calls appropriately
  - _Requirements: DAL unit tests_

- [ ] 45. Unit tests for ServiceBookingDAL
  - Create `src/dal/__tests__/service-booking.dal.test.ts`
  - Test `create()` — verify insert
  - Test `getCancellationContext()` — returns all required cancellation fields
  - Test `claimForPayoutProcessing()` — returns true when status was 'pending'; returns false when already 'processing' (atomic lock behavior)
  - Test `findEligibleForPayout()` — only returns completedAt < cutoff AND payoutStatus = 'pending'; ORDER BY completedAt ASC; respects limit; includes providerConnectedAccountId
  - _Requirements: DAL unit tests, 4.2_

- [ ] 46. Unit tests for ServiceReviewDAL
  - Create `src/dal/__tests__/service-review.dal.test.ts`
  - Test `create()` — verify insert; verify unique constraint triggers ConflictError on duplicate
  - Test `findByListing()` — scoped to correct listingId
  - Test `calculateProviderAggregateRating()` — correct AVG and COUNT calculation
  - Test `updateProviderAggregateRating()` — updates service_provider_profiles correctly
  - _Requirements: DAL unit tests, 7.4_

- [ ] 47. Unit tests for service-payments.ts
  - Create `src/services/stripe/__tests__/service-payments.test.ts`
  - Mock Stripe API calls
  - Test `chargeServicePayment()`:
    - Verify **no `transfer_data`** in PaymentIntent params
    - Verify `confirm: true`, `off_session: true`
    - Verify `paymentType: 'service_charge'` in metadata
    - Verify idempotency key format: `service-charge-{bookingId}`
    - Verify `paymentIntent.latest_charge` is returned as chargeId
    - Verify retryable error triggers one retry
  - Test `createServiceTransfer()`:
    - Verify `source_transaction` = chargeId (not paymentIntentId)
    - Verify fee deduction math: transfer = servicePrice - (servicePrice × PLATFORM_FEE_PERCENTAGE), in cents
    - Verify idempotency key format: `service-transfer-{bookingId}`
    - Verify success returns `{ success: true, transferId }`
    - Verify failure returns `{ success: false, error }`
  - _Requirements: 3.3, 4.2, 4.3, 4.4_

- [ ] 48. Unit tests for ServiceListingService
  - Create `src/features/services/__tests__/service-listing-service.test.ts`
  - Test `createListing()` — blocked when no active Stripe Connect; succeeds with Connect; sends admin notification
  - Test `approveListing()` — sets status active; sends provider notification
  - Test `rejectListing()` — requires reason; sets status denied; sends provider notification with reason
  - Test `deactivateListing()` — ownership enforced; sets status inactive
  - Mock DAL calls and notification helpers
  - _Requirements: 2.1, 2.5, 3.1, 3.2_

- [ ] 49. Unit tests for ServiceBookingService
  - Create `src/features/services/__tests__/service-booking-service.test.ts`
  - Test `createBooking()` — blocked if listing not active; blocked if requester = provider (403); blocked if no payment method; succeeds with valid input
  - Test `acceptBooking()` — charge called with correct params; success → status 'accepted'; failure → status 'payment_failed', both parties notified
  - Test `cancelBooking()` — requester >24hrs → 100% refund; requester ≤24hrs → 50% refund; provider → 100% refund
  - Test `declineBooking()` — requires reason; status set to 'declined'; requester notified
  - Test `reportNoShow()` — creates report; admin notified; no automatic refund
  - Mock DAL, Stripe service, and notification helpers
  - _Requirements: 3.1, 3.2, 3.4, 5.1, 5.2, 5.3, 5.5_

- [ ] 50. Unit tests for ServicePayoutService
  - Create `src/features/services/__tests__/service-payout-service.test.ts`
  - Test `processPayouts()` — queries with correct 24-hour cutoff; respects batchSize
  - Test atomic claim: claimForPayoutProcessing returning false → booking skipped
  - Test successful transfer → status 'completed', provider notified
  - Test failed transfer → status 'failed', ops alerted
  - Test one booking failure does not block subsequent bookings
  - Test summary counts are accurate
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 51. Unit tests for ServiceReviewService
  - Create `src/features/services/__tests__/service-review-service.test.ts`
  - Test `submitReview()` — rating must be 1–5; duplicate rejected with ConflictError (409); aggregate rating recalculated after submission; only works for completed bookings
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 52. Integration tests — full booking lifecycle
  - Create integration test covering end-to-end flow:
    - Create listing → pending_approval
    - Admin approve → active
    - Create booking request → pending
    - Accept booking → charge captured → accepted; stripeChargeId stored
    - Complete booking → completed; payoutStatus = 'pending'
    - Simulate cron run: atomic claim → createServiceTransfer → payoutStatus = 'completed'; provider notified
  - Verify concurrent cron calls: only one process wins the atomic claim (double-transfer prevented)
  - Verify payment failure at acceptance: status = 'payment_failed', both parties notified
  - Verify all 3 cancellation refund tiers against correct Stripe refund amounts
  - Verify review submission triggers aggregate rating update on provider profile
  - _Requirements: Integration test coverage_

---

### Phase 11: Final Verification

- [ ] 53. Run linting and type checking
  - Run `bun run lint` — fix any issues
  - Run `bun run type-check` — fix all type errors
  - Ensure all new files follow existing code style (no `any`, proper return types, consistent naming)
  - _Requirements: Code quality_

- [ ] 54. Verify all imports, exports, and dependencies
  - Check all new files have correct imports
  - Verify all DALs, services, and helpers are exported and accessible
  - Remove any unused imports
  - Ensure no circular dependencies introduced
  - Confirm all new routes use `withRequestLogging`, `requireAuthResponse`, and `tryCatch` per existing patterns
  - _Requirements: Code quality_

---

_Last updated: March 21, 2026 | Internal use only_
