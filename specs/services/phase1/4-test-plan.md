# HOA Services Marketplace (Phase 1) — Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/services/phase1/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

---

### Requirement 1: Service Listing Creation

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 1

**Test Coverage**:

- Unit tests: `ServiceListingService.createListing()` rejects when provider has no active Stripe Connected Account
- Unit tests: `ServiceListingService.createListing()` creates listing with `status: 'pending_approval'`
- Unit tests: `ServiceListingService.createListing()` calls `sendListingPendingAdminNotification()` on success
- Unit tests: `ServiceListingService.createListing()` creates audit log entry
- Unit tests: `ServiceListingService.editListing()` rejects if user is not the listing owner (ForbiddenError)
- Unit tests: `ServiceListingService.editListing()` updates listing fields without changing status
- Unit tests: `ServiceListingService.deactivateListing()` sets `status: 'inactive'`
- Unit tests: `ServiceListingService.deactivateListing()` rejects if user is not the listing owner
- Integration tests: POST `/api/services/listings` with no Stripe Connect → 400 `stripe_connect_required`
- Integration tests: POST `/api/services/listings` with valid data → listing created with `status: 'pending_approval'`
- Integration tests: Created listing is NOT returned by `findByCommunity()` (not yet active)
- Integration tests: PATCH `/api/services/listings/[id]` by non-owner → 403
- Integration tests: POST `/api/services/listings/[id]/deactivate` removes listing from browse results
- Schema tests: `service_listings.status` defaults to `'pending_approval'`
- Schema tests: `service_listings` has indexes on `communityId+status`, `providerId`, `categoryId`

---

### Requirement 2: Admin Listing Approval

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 2

**Test Coverage**:

- Unit tests: `ServiceListingService.approveListing()` sets `status: 'active'`
- Unit tests: `ServiceListingService.approveListing()` optionally stores `adminNote`
- Unit tests: `ServiceListingService.approveListing()` calls `sendListingApprovedNotification()` with provider ID
- Unit tests: `ServiceListingService.rejectListing()` requires non-empty reason (ValidationError if empty)
- Unit tests: `ServiceListingService.rejectListing()` sets `status: 'rejected'`, stores `rejectionReason`
- Unit tests: `ServiceListingService.rejectListing()` calls `sendListingRejectedNotification()` with reason
- Integration tests: POST `/api/admin/services/listings/[id]/approve` by non-admin → 403
- Integration tests: POST `/api/admin/services/listings/[id]/approve` → status becomes `'active'`, provider notified
- Integration tests: Approved listing is returned by `findByCommunity()` with `status: 'active'` filter
- Integration tests: POST `/api/admin/services/listings/[id]/reject` without reason → 400
- Integration tests: POST `/api/admin/services/listings/[id]/reject` with reason → status becomes `'rejected'`, provider notified with reason
- Integration tests: Rejected listing is NOT returned by `findByCommunity()`

---

### Requirement 3: Service Discovery & Browsing

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 3

**Test Coverage**:

- Unit tests: `ServiceListingDAL.findByCommunity()` only returns listings with `status: 'active'`
- Unit tests: `ServiceListingDAL.findByCommunity()` scoped to the correct `communityId` — does NOT return listings from other communities
- Unit tests: `ServiceListingDAL.findByCommunity()` applies `categoryId` filter when provided
- Unit tests: `ServiceListingDAL.findByCommunity()` returns all active listings when no category filter
- Unit tests: `ServiceListingDAL.getById()` returns listing with category and provider info
- Unit tests: `ServiceListingDAL.getById()` returns null for non-existent ID
- Integration tests: GET `/api/services/listings` returns only active listings in user's community
- Integration tests: GET `/api/services/listings?categoryId=X` returns only listings in that category
- Integration tests: GET `/api/services/listings/[id]` returns full listing detail
- Integration tests: GET `/api/services/listings/[id]` for listing in another community → 404
- Integration tests: Unauthenticated request → 401

---

### Requirement 4: Booking Request

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: `ServiceBookingService.createBooking()` rejects if listing `status !== 'active'` (NotFoundError)
- Unit tests: `ServiceBookingService.createBooking()` rejects if `requesterId === listing.providerId` (ForbiddenError, `cannot_book_own_listing`)
- Unit tests: `ServiceBookingService.createBooking()` rejects if requester has no saved payment method (ValidationError, `payment_method_required`)
- Unit tests: `ServiceBookingService.createBooking()` calculates `serviceFee` via `calculateServiceFee()` for fixed listings
- Unit tests: `ServiceBookingService.createBooking()` calculates `totalAmount = price × hours + serviceFee` for hourly listings
- Unit tests: `ServiceBookingService.createBooking()` creates booking with `status: 'pending'`
- Unit tests: `ServiceBookingService.createBooking()` calls `sendNewBookingRequestNotification()` with provider ID
- Unit tests: No Stripe call is made during `createBooking()` (payment deferred to acceptance)
- Integration tests: POST `/api/services/bookings` by listing owner → 403 `cannot_book_own_listing`
- Integration tests: POST `/api/services/bookings` with no payment method → 400 `payment_method_required`
- Integration tests: POST `/api/services/bookings` for inactive listing → 404
- Integration tests: POST `/api/services/bookings` with valid data → booking created with `status: 'pending'`, provider notified
- Integration tests: POST `/api/services/bookings` with hourly listing requires `hours` field
- Integration tests: Successful booking stores `servicePrice`, `serviceFee`, `totalAmount` snapshot at request time
- Schema tests: `service_bookings.status` defaults to `'pending'`
- Schema tests: `service_bookings` has indexes on `payoutStatus`, `completedAt`, `providerId`, `requesterId`

---

### Requirement 5: Provider Booking Response (Accept / Decline)

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: `ServiceBookingService.acceptBooking()` verifies booking `status === 'pending'` before proceeding
- Unit tests: `ServiceBookingService.acceptBooking()` verifies `providerId` matches booking's provider
- Unit tests: `ServiceBookingService.acceptBooking()` calls `chargeServicePayment()` with correct params
- Unit tests: `ServiceBookingService.acceptBooking()` on charge success: sets `status: 'accepted'`, stores `stripePaymentIntentId` and `stripeChargeId`
- Unit tests: `ServiceBookingService.acceptBooking()` on charge success: creates payment record with `paymentType: 'service_charge'`
- Unit tests: `ServiceBookingService.acceptBooking()` on charge success: calls `sendBookingAcceptedNotification()`
- Unit tests: `ServiceBookingService.acceptBooking()` on charge failure: sets `status: 'payment_failed'`, notifies both parties
- Unit tests: `ServiceBookingService.declineBooking()` rejects if `reason` is empty or missing (`decline_reason_required`)
- Unit tests: `ServiceBookingService.declineBooking()` verifies booking `status === 'pending'`
- Unit tests: `ServiceBookingService.declineBooking()` verifies `providerId` matches
- Unit tests: `ServiceBookingService.declineBooking()` sets `status: 'declined'`, stores `declineReason`
- Unit tests: `ServiceBookingService.declineBooking()` calls `sendBookingDeclinedNotification()` with reason
- Integration tests: POST `/api/services/bookings/[id]/accept` by non-provider → 403
- Integration tests: POST `/api/services/bookings/[id]/accept` on already-accepted booking → 409 `invalid_booking_status`
- Integration tests: POST `/api/services/bookings/[id]/accept` — successful charge → status `'accepted'`, requester notified
- Integration tests: POST `/api/services/bookings/[id]/accept` — failed charge → status `'payment_failed'`, both parties notified
- Integration tests: POST `/api/services/bookings/[id]/decline` without reason → 400 `decline_reason_required`
- Integration tests: POST `/api/services/bookings/[id]/decline` → status `'declined'`, requester notified with reason
- Integration tests: POST `/api/services/bookings/[id]/decline` on non-pending booking → 409

---

### Requirement 6: Payment Processing

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 6

**Test Coverage**:

- Unit tests: `chargeServicePayment()` creates PaymentIntent with `confirm: true`, `off_session: true`
- Unit tests: `chargeServicePayment()` does **NOT** include `transfer_data` — funds stay in platform account
- Unit tests: `chargeServicePayment()` includes metadata: `paymentType: 'service_charge'`, `bookingId`, `serviceId`, `providerId`, `requesterId`
- Unit tests: `chargeServicePayment()` uses idempotency key `service-charge-{bookingId}`
- Unit tests: `chargeServicePayment()` returns `paymentIntent.latest_charge` as `chargeId`
- Unit tests: `chargeServicePayment()` retries once on retryable Stripe errors (`StripeRateLimitError`, `StripeAPIError`, `StripeConnectionError`)
- Unit tests: `chargeServicePayment()` does NOT retry on non-retryable errors (`StripeCardError`)
- Unit tests: Fixed listing charge = listing price + `calculateServiceFee(listingPrice)`
- Unit tests: Hourly listing charge = (rate × hours) + `calculateServiceFee(rate × hours)`
- Integration tests: Accepted booking stores `stripePaymentIntentId` and `stripeChargeId` (from `latest_charge`)
- Integration tests: Accepted booking creates payments table record with `paymentType: 'service_charge'`, `status: 'succeeded'`
- Integration tests: Stripe PaymentIntent has NO `transfer_data` field
- Integration tests: Idempotency key format verified as `service-charge-{bookingId}`

---

### Requirement 7: Job Completion & Provider Payout

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 7

**Test Coverage**:

- Unit tests: `ServiceBookingService.completeBooking()` verifies `status === 'accepted'` and `providerId` matches
- Unit tests: `ServiceBookingService.completeBooking()` sets `status: 'completed'`, `completedAt: now`, `payoutStatus: 'pending'`
- Unit tests: `ServiceBookingService.completeBooking()` calls `sendJobCompletedNotification()` — does NOT trigger payout
- Unit tests: `ServicePayoutService.processPayouts()` queries with `cutoff = NOW() - 24hrs`
- Unit tests: `ServicePayoutService.processPayouts()` skips booking if `claimForPayoutProcessing()` returns false
- Unit tests: `ServicePayoutService.processPayouts()` calls `createServiceTransfer()` with correct params after successful claim
- Unit tests: `ServicePayoutService.processPayouts()` on transfer success: sets `payoutStatus: 'completed'`, stores `stripeTransferId` and `ownerTransferredAt`, calls `sendServicePayoutNotification()`
- Unit tests: `ServicePayoutService.processPayouts()` on transfer failure: sets `payoutStatus: 'failed'`, calls `sendOpsAlert()`
- Unit tests: `ServicePayoutService.processPayouts()` processes each booking independently — one failure does not block others
- Unit tests: `ServicePayoutService.processPayouts()` returns accurate `{ eligible, processed, succeeded, failed }` summary
- Unit tests: `createServiceTransfer()` calls `stripe.transfers.create()` with `source_transaction: chargeId`
- Unit tests: `createServiceTransfer()` sets `destination` to `providerConnectedAccountId`
- Unit tests: `createServiceTransfer()` transfer amount = `Math.round(servicePrice * 100) - Math.round(servicePrice * 100 * PLATFORM_FEE_PERCENTAGE)` (cents)
- Unit tests: `createServiceTransfer()` platform fee is calculated on `servicePrice` only (service fee excluded)
- Unit tests: `createServiceTransfer()` uses idempotency key `service-transfer-{bookingId}`
- Unit tests: `createServiceTransfer()` returns `{ success: true, transferId }` on success
- Unit tests: `createServiceTransfer()` returns `{ success: false, error }` on failure
- Unit tests: `ServiceBookingDAL.claimForPayoutProcessing()` returns `true` when `payoutStatus` was `'pending'`
- Unit tests: `ServiceBookingDAL.claimForPayoutProcessing()` returns `false` when `payoutStatus` is already `'processing'` or `'completed'`
- Unit tests: `ServiceBookingDAL.findEligibleForPayout()` only returns bookings where `completedAt < cutoff AND payoutStatus = 'pending'`
- Unit tests: `ServiceBookingDAL.findEligibleForPayout()` orders results by `completedAt ASC`
- Unit tests: `ServiceBookingDAL.findEligibleForPayout()` respects `limit` parameter
- Unit tests: `ServiceBookingDAL.findEligibleForPayout()` joins users table to include `providerConnectedAccountId`
- Integration tests: POST `/api/services/bookings/[id]/complete` by non-provider → 403
- Integration tests: POST `/api/services/bookings/[id]/complete` on non-accepted booking → 409
- Integration tests: Complete booking → `completedAt` recorded, `payoutStatus: 'pending'`, requester notified immediately
- Integration tests: Payout cron does NOT process booking until `completedAt > 24hrs` ago
- Integration tests: GET `/api/cron/process-service-payouts` without valid `CRON_SECRET` → 401
- Integration tests: Cron claims booking atomically → transfer created → `payoutStatus: 'completed'`, provider notified
- Integration tests: Cron with transfer failure → `payoutStatus: 'failed'`, ops alerted, booking stays `completed`
- Integration tests: Cron processes up to 20 bookings per run (batchSize enforced)
- Integration tests: Cron returns `{ processedCount: 0 }` when no eligible bookings
- Integration tests: Two concurrent cron executions do NOT process the same booking twice (atomic lock)

---

### Requirement 8: Cancellations & Refunds

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: `ServiceBookingService.cancelBooking()` — requester cancels, proposedDate > 24hrs → refund = 100% of `totalAmount`
- Unit tests: `ServiceBookingService.cancelBooking()` — requester cancels, proposedDate ≤ 24hrs → refund = 50% of `totalAmount`
- Unit tests: `ServiceBookingService.cancelBooking()` — provider cancels → refund = 100% of `totalAmount` (regardless of timing)
- Unit tests: `ServiceBookingService.cancelBooking()` calls `processRefund()` from `src/services/stripe/refund.ts` (reused utility)
- Unit tests: `ServiceBookingService.cancelBooking()` on refund success: sets `status: 'cancelled'`, stores `refundAmount`, `stripeRefundId`, `cancelledAt`, `cancelledBy`, `cancellationReason`
- Unit tests: `ServiceBookingService.cancelBooking()` on refund failure: logs error, calls `captureNonCriticalError()` + `sendOpsAlert()`
- Unit tests: `ServiceBookingService.cancelBooking()` notifies both parties with refund details on success
- Unit tests: `ServiceBookingService.cancelBooking()` rejects if `userId` is neither requester nor provider (ForbiddenError)
- Unit tests: `ServiceBookingService.cancelBooking()` rejects if booking `status` is not `'pending'` or `'accepted'`
- Unit tests: `ServiceBookingService.cancelBooking()` on pending booking (no charge): sets `status: 'cancelled'` without issuing refund
- Unit tests: `ServiceBookingService.reportNoShow()` verifies `status === 'accepted'`
- Unit tests: `ServiceBookingService.reportNoShow()` creates `service_no_show_reports` record with all required fields
- Unit tests: `ServiceBookingService.reportNoShow()` calls `sendNoShowReportAdminNotification()` — does NOT issue automatic refund
- Integration tests: POST `/api/services/bookings/[id]/cancel` by non-participant → 403
- Integration tests: POST `/api/services/bookings/[id]/cancel` on completed booking → 409
- Integration tests: Requester cancels accepted booking >24hrs before proposedDate → full refund, both notified
- Integration tests: Requester cancels accepted booking ≤24hrs before proposedDate → 50% refund, both notified
- Integration tests: Provider cancels accepted booking → full refund to requester, both notified
- Integration tests: POST `/api/services/bookings/[id]/no-show` → report created, admin alerted, booking status unchanged, no Stripe call
- Integration tests: POST `/api/services/bookings/[id]/no-show` on non-accepted booking → 409
- Schema tests: `service_no_show_reports` table has correct foreign keys to `service_bookings` and `users`

---

### Requirement 9: Mutual Reviews

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 9

**Test Coverage**:

- Unit tests: `ServiceReviewService.submitReview()` validates `rating` is integer 1–5 (rejects 0, 6, floats)
- Unit tests: `ServiceReviewService.submitReview()` determines `revieweeId` as the opposite party from `reviewerId`
- Unit tests: `ServiceReviewService.submitReview()` calls `serviceReviewDAL.create()` and then `serviceReviewDAL.updateProviderAggregateRating()`
- Unit tests: `ServiceReviewService.submitReview()` rejects with 409 `review_already_submitted` on duplicate (DB unique constraint)
- Unit tests: `ServiceReviewDAL.calculateProviderAggregateRating()` computes correct AVG and COUNT from review records
- Unit tests: `ServiceReviewDAL.updateProviderAggregateRating()` writes `aggregateRating` and `reviewCount` to `service_provider_profiles`
- Unit tests: `ServiceReviewDAL.create()` with valid data inserts correctly
- Unit tests: `ServiceReviewDAL.findByListing()` returns reviews scoped to correct `listingId`
- Unit tests: `ServiceReviewDAL.findByBooking()` returns up to 2 reviews (one per party) for a booking
- Integration tests: POST `/api/services/bookings/[id]/reviews` with invalid rating → 400
- Integration tests: POST `/api/services/bookings/[id]/reviews` by non-participant → 403
- Integration tests: POST `/api/services/bookings/[id]/reviews` → review created, aggregate rating recalculated
- Integration tests: POST `/api/services/bookings/[id]/reviews` twice by same user on same booking → 409 `review_already_submitted`
- Integration tests: Both parties may each submit exactly one review per booking (2 reviews total allowed)
- Integration tests: Aggregate rating recalculated correctly after multiple reviews across multiple bookings
- Schema tests: `service_reviews` has unique index on `(bookingId, reviewerId)` — enforces one review per party per booking
- Schema tests: `service_reviews` has indexes on `revieweeId`, `listingId`

---

### Requirement 10: Provider Profile

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 10

**Test Coverage**:

- Unit tests: Provider profile includes: name, photo, bio, aggregate rating, review count, active listings
- Unit tests: Profile with no reviews displays `aggregateRating: null`, `reviewCount: 0`
- Unit tests: `ServiceReviewDAL.calculateProviderAggregateRating()` returns `{ average: null, count: 0 }` when no reviews exist
- Integration tests: GET `/api/services/providers/[userId]` returns profile with listings and reviews
- Integration tests: PATCH `/api/services/providers/[userId]` by a different user → 403
- Integration tests: PATCH `/api/services/providers/[userId]` updates `bio` field
- Integration tests: Profile aggregate rating reflects all submitted reviews (not just listing-scoped)
- Schema tests: `service_provider_profiles.userId` is unique
- Schema tests: `service_provider_profiles.aggregateRating` allows null (no reviews yet)

---

### Requirement 11: Notifications

**Requirement Reference**: `specs/services/phase1/1-requirements.md` - Requirement 11

**Test Coverage**:

- Unit tests: `sendNewBookingRequestNotification()` delegates to `sendNotification()` with type `service_booking_requested`
- Unit tests: `sendBookingAcceptedNotification()` delegates with type `service_booking_accepted`
- Unit tests: `sendBookingDeclinedNotification()` delegates with type `service_booking_declined`
- Unit tests: `sendJobCompletedNotification()` delegates with type `service_booking_completed`
- Unit tests: `sendServicePayoutNotification()` delegates with type `service_payout_sent`
- Unit tests: `sendListingApprovedNotification()` delegates with type `service_listing_approved`
- Unit tests: `sendListingRejectedNotification()` delegates with type `service_listing_rejected`
- Unit tests: `sendListingPendingAdminNotification()` delegates with type `service_listing_pending`
- Unit tests: `sendNoShowReportAdminNotification()` delegates with type `service_no_show_reported`
- Integration tests: Booking request → provider receives `service_booking_requested` notification
- Integration tests: Booking accepted → requester receives `service_booking_accepted` notification
- Integration tests: Booking declined → requester receives `service_booking_declined` with reason
- Integration tests: Job completed → requester receives `service_booking_completed` notification immediately
- Integration tests: Payout transfer succeeds → provider receives `service_payout_sent` notification
- Integration tests: Listing approved → provider receives `service_listing_approved` notification
- Integration tests: No-show reported → admin receives `service_no_show_reported` notification
- Integration tests: Notifications do NOT fire on payment failure — ops alert fires instead

---

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and services in isolation.

**Framework**: Vitest

**Coverage Goals**: 85%+ for business logic (DAL, services), 100% for fee calculations and refund tier logic

**Areas to Test**:

- **ServiceListingDAL**: Mock database, test all CRUD operations and query filters
- **ServiceBookingDAL**: Mock database, test atomic claim behavior and payout eligibility query
- **ServiceReviewDAL**: Mock database, test aggregate rating calculation
- **chargeServicePayment()**: Mock Stripe, verify no `transfer_data`, correct metadata, idempotency key
- **createServiceTransfer()**: Mock Stripe, verify fee deduction math, `source_transaction`, idempotency key
- **ServiceListingService**: Mock DAL + notifications, test Stripe Connect gate, approval/rejection flows
- **ServiceBookingService**: Mock DAL + Stripe + notifications, test booking guards, accept/charge, cancellation refund tiers
- **ServicePayoutService**: Mock DAL + Stripe, test eligible query, atomic claim, batch summary
- **ServiceReviewService**: Mock DAL, test rating validation, aggregate recalc, duplicate rejection
- **Fee calculations**: Test platform fee deduction matches `PLATFORM_FEE_PERCENTAGE`; verify service fee excluded from transfer amount
- **Refund tiers**: Test all 3 cancellation tiers (requester >24hrs, requester ≤24hrs, provider)

**Test Structure** (AAA Pattern):

```typescript
describe("createServiceTransfer", () => {
  it("should transfer servicePrice minus platform fee, excluding service fee", async () => {
    // Arrange
    const mockTransfer = vi.mocked(stripe.transfers.create);
    mockTransfer.mockResolvedValue({ id: "tr_456" } as Stripe.Transfer);

    // Act
    const result = await createServiceTransfer({
      bookingId: "booking-1",
      providerConnectedAccountId: "acct_123",
      chargeId: "ch_abc",
      servicePrice: 100.0, // provider earns $100; service fee is requester-side pass-through
      idempotencyKey: "service-transfer-booking-1",
    });

    // Assert
    expect(result).toEqual({ success: true, transferId: "tr_456" });
    expect(mockTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8000, // $100 - 20% = $80 = 8000 cents
        currency: "usd",
        destination: "acct_123",
        source_transaction: "ch_abc",
      }),
      { idempotencyKey: "service-transfer-booking-1" },
    );
  });
});

describe("ServiceBookingService.cancelBooking", () => {
  it("should refund 50% when requester cancels within 24 hours of proposed date", async () => {
    // Arrange
    const proposedDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now
    const mockContext = {
      proposedDate,
      totalAmount: 100,
      stripeChargeId: "ch_abc",
      requesterId: "user-1",
      providerId: "user-2",
    };
    vi.spyOn(serviceBookingDAL, "getCancellationContext").mockResolvedValue(
      mockContext,
    );

    // Act
    await ServiceBookingService.cancelBooking("booking-1", "user-1");

    // Assert
    expect(processRefund).toHaveBeenCalledWith(
      expect.objectContaining({ chargeId: "ch_abc", amount: 50 }), // 50% of $100
    );
  });
});
```

### Integration Tests

**Purpose**: Test component interactions and data flow between layers.

**Framework**: Vitest with mocked DAL and Stripe

**Coverage Goals**: All critical financial flows, 80%+ for integration points

**Areas to Test**:

- **Listing creation → admin approval → browse visibility**: Full listing lifecycle pipeline
- **Booking creation → accept → charge → complete → cron payout**: Full booking lifecycle
- **Booking creation → accept → cancel → refund**: Cancellation pipeline for each tier
- **Cron → DAL query → atomic claim → Stripe transfer → status update**: Payout cron end-to-end
- **Review submission → aggregate rating recalculation**: Review pipeline
- **Concurrency**: Atomic `claimForPayoutProcessing` prevents double-transfer
- **Error propagation**: Stripe failures set correct statuses and trigger ops alerts
- **Auth guards**: All routes reject unauthenticated and unauthorized requests correctly

**Test Structure**:

```typescript
describe("POST /api/cron/process-service-payouts", () => {
  it("should atomically claim and transfer for eligible booking", async () => {
    // Arrange
    const eligibleBooking = {
      id: "booking-1",
      stripeChargeId: "ch_abc",
      servicePrice: 100.0,
      totalAmount: 110.0,
      providerConnectedAccountId: "acct_123",
      providerId: "provider-1",
    };
    vi.spyOn(serviceBookingDAL, "findEligibleForPayout").mockResolvedValue([
      eligibleBooking,
    ]);
    vi.spyOn(serviceBookingDAL, "claimForPayoutProcessing").mockResolvedValue(
      true,
    );
    vi.mocked(createServiceTransfer).mockResolvedValue({
      success: true,
      transferId: "tr_789",
    });

    // Act
    const response = await GET(mockCronRequest);

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      processedCount: 1,
      successCount: 1,
      failureCount: 0,
    });
    expect(createServiceTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ chargeId: "ch_abc", servicePrice: 100.0 }),
    );
  });
});
```

### End-to-End (E2E) Tests

**Purpose**: Test complete user workflows from UI to database.

**Framework**: Playwright (or Vitest with full stack)

**Coverage Goals**: Critical happy paths + primary failure paths

**Key E2E Scenarios**:

1. Provider creates listing → admin approves → listing appears in browse
2. Requester browses → views listing detail → submits booking request → provider notified
3. Provider accepts booking → payment captured → requester notified → job complete → payout after 24hrs
4. Requester cancels booking >24hrs ahead → full refund processed
5. Provider declines booking with reason → requester notified with reason

---

## Test Scenarios by Component

### ServiceListingDAL Tests (`src/dal/__tests__/service-listing.dal.test.ts`)

```
findByCommunity()
  ✓ Returns only active listings for the given communityId
  ✓ Does not return listings from other communities
  ✓ Applies categoryId filter when provided
  ✓ Returns all active listings when no category filter
  ✓ Returns empty array when no active listings exist
  ✓ Supports pagination (limit + offset)

create()
  ✓ Inserts listing with all required fields
  ✓ Defaults status to pending_approval
  ✓ Returns the created listing

update()
  ✓ Updates specified fields
  ✓ Refreshes updatedAt timestamp
  ✓ Returns updated listing

getById()
  ✓ Returns listing with category and provider info
  ✓ Returns null for non-existent listing ID

findPendingApproval()
  ✓ Returns only listings with status pending_approval
  ✓ Includes provider info for admin display
  ✓ Returns empty array when no pending listings

findByProvider()
  ✓ Returns all listings belonging to the given providerId
  ✓ Returns empty array when provider has no listings
```

### ServiceBookingDAL Tests (`src/dal/__tests__/service-booking.dal.test.ts`)

```
create()
  ✓ Inserts booking with status pending
  ✓ Stores pricing snapshot (servicePrice, serviceFee, totalAmount)

getCancellationContext()
  ✓ Returns all required fields: status, proposedDate, totalAmount, stripeChargeId, requesterId, providerId

claimForPayoutProcessing()
  ✓ Returns true when payoutStatus was pending (claim succeeded)
  ✓ Returns false when payoutStatus is already processing (concurrent claim)
  ✓ Returns false when payoutStatus is completed
  ✓ Atomic: only one caller succeeds when called concurrently with same bookingId

findEligibleForPayout()
  ✓ Returns bookings where completedAt < cutoff AND payoutStatus = pending
  ✓ Does not return bookings where completedAt >= cutoff (dispute window not closed)
  ✓ Does not return bookings where payoutStatus = processing or completed
  ✓ Orders results by completedAt ASC
  ✓ Respects batchSize limit
  ✓ Includes providerConnectedAccountId from joined users table
  ✓ Returns empty array when no eligible bookings
```

### ServiceReviewDAL Tests (`src/dal/__tests__/service-review.dal.test.ts`)

```
create()
  ✓ Inserts review with correct fields
  ✓ Throws ConflictError on duplicate (same bookingId + reviewerId)

findByListing()
  ✓ Returns all reviews for the given listingId with reviewer info
  ✓ Returns empty array when no reviews

findByBooking()
  ✓ Returns both reviews for a booking (one per party)

calculateProviderAggregateRating()
  ✓ Returns correct average and count for a provider with multiple reviews
  ✓ Returns { average: null, count: 0 } when provider has no reviews
  ✓ Calculates across all listings (not just one)

updateProviderAggregateRating()
  ✓ Writes aggregateRating and reviewCount to service_provider_profiles
  ✓ Creates profile record if one does not exist
```

### chargeServicePayment Tests (`src/services/stripe/__tests__/service-payments.test.ts`)

```
chargeServicePayment()
  ✓ Creates PaymentIntent with confirm: true, off_session: true
  ✓ Does NOT include transfer_data
  ✓ Includes metadata: paymentType, bookingId, serviceId, providerId, requesterId
  ✓ Uses idempotency key: service-charge-{bookingId}
  ✓ Returns latest_charge as chargeId
  ✓ Retries once on StripeRateLimitError
  ✓ Retries once on StripeAPIError
  ✓ Retries once on StripeConnectionError
  ✓ Does NOT retry on StripeCardError
  ✓ Returns error after retry fails

createServiceTransfer()
  ✓ Calls stripe.transfers.create with source_transaction = chargeId (not paymentIntentId)
  ✓ Sets destination = providerConnectedAccountId
  ✓ Transfer amount = Math.round(servicePrice * 100) - Math.round(servicePrice * 100 * PLATFORM_FEE_PERCENTAGE)
  ✓ Service fee is NOT included in transfer amount calculation
  ✓ Amount is in cents (integer)
  ✓ Uses idempotency key: service-transfer-{bookingId}
  ✓ Returns { success: true, transferId } on success
  ✓ Returns { success: false, error } on Stripe error
```

### ServiceBookingService Tests (`src/features/services/__tests__/service-booking-service.test.ts`)

```
createBooking()
  ✓ Rejects with NotFoundError if listing is not active
  ✓ Rejects with ForbiddenError (cannot_book_own_listing) if requesterId = listing.providerId
  ✓ Rejects with ValidationError (payment_method_required) if requester has no saved payment method
  ✓ Creates booking with status pending
  ✓ Stores servicePrice, serviceFee, totalAmount snapshot
  ✓ Calculates totalAmount correctly for fixed listings
  ✓ Calculates totalAmount correctly for hourly listings (rate × hours + serviceFee)
  ✓ Calls sendNewBookingRequestNotification with providerId
  ✓ Does NOT make any Stripe call

acceptBooking()
  ✓ Rejects if booking status is not pending
  ✓ Rejects if caller is not the provider
  ✓ Calls chargeServicePayment with correct params
  ✓ On success: sets status accepted, stores stripePaymentIntentId and stripeChargeId
  ✓ On success: creates payment record with paymentType service_charge
  ✓ On success: calls sendBookingAcceptedNotification
  ✓ On charge failure: sets status payment_failed, notifies both parties
  ✓ Creates audit log entry

declineBooking()
  ✓ Rejects if reason is empty or missing
  ✓ Rejects if booking status is not pending
  ✓ Rejects if caller is not the provider
  ✓ Sets status declined, stores declineReason
  ✓ Calls sendBookingDeclinedNotification with reason

cancelBooking()
  ✓ Requester cancels, proposedDate > 24hrs: calls processRefund with 100% of totalAmount
  ✓ Requester cancels, proposedDate ≤ 24hrs: calls processRefund with 50% of totalAmount
  ✓ Provider cancels: calls processRefund with 100% of totalAmount (regardless of timing)
  ✓ On refund success: sets status cancelled, stores refundAmount, stripeRefundId, cancelledAt, cancelledBy
  ✓ On refund failure: logs error, calls sendOpsAlert, does not update status to cancelled
  ✓ Notifies both parties on successful cancellation
  ✓ Rejects if userId is neither requester nor provider
  ✓ Rejects if booking status is not pending or accepted
  ✓ Cancels pending booking (no charge) without issuing Stripe refund

reportNoShow()
  ✓ Verifies status is accepted
  ✓ Verifies reporter is requester or provider
  ✓ Creates service_no_show_reports record with all required fields
  ✓ Calls sendNoShowReportAdminNotification
  ✓ Does NOT call processRefund or make any Stripe call
```

### ServicePayoutService Tests (`src/features/services/__tests__/service-payout-service.test.ts`)

```
processPayouts()
  ✓ Queries findEligibleForPayout with cutoff = NOW() - 24hrs
  ✓ Respects batchSize limit passed to findEligibleForPayout
  ✓ Skips booking if claimForPayoutProcessing returns false (concurrency guard)
  ✓ Calls createServiceTransfer with correct params after successful claim
  ✓ On transfer success: updates payoutStatus to completed, stores stripeTransferId and ownerTransferredAt
  ✓ On transfer success: calls sendServicePayoutNotification with providerId
  ✓ On transfer failure: updates payoutStatus to failed
  ✓ On transfer failure: calls sendOpsAlert with bookingId and error details
  ✓ One booking failure does not prevent processing of subsequent bookings
  ✓ Returns accurate summary: { eligible, processed, succeeded, failed }
  ✓ Returns { eligible: 0, processed: 0, succeeded: 0, failed: 0 } when no eligible bookings
```

### ServiceReviewService Tests (`src/features/services/__tests__/service-review-service.test.ts`)

```
submitReview()
  ✓ Rejects rating of 0 (ValidationError)
  ✓ Rejects rating of 6 (ValidationError)
  ✓ Rejects non-integer rating (ValidationError)
  ✓ Accepts ratings 1–5
  ✓ Accepts optional comment (may be undefined or empty string)
  ✓ Determines revieweeId as the opposite party from reviewerId
  ✓ Rejects if reviewer is not requester or provider
  ✓ Calls serviceReviewDAL.create() with correct data
  ✓ Calls serviceReviewDAL.updateProviderAggregateRating() after successful create
  ✓ Propagates ConflictError from DAL as 409 review_already_submitted
```

---

## BDD Scenarios

### Feature: Service Listing Creation

```gherkin
Feature: Service Listing Creation

  Scenario: Provider creates a listing — no Stripe Connect account
    Given a resident has no active Stripe Connected Account
    When they submit a service listing form
    Then the system returns error "stripe_connect_required"
    And no listing record is created

  Scenario: Provider creates a valid listing
    Given a resident has an active Stripe Connected Account
    When they submit a listing with title, description, category, fixed pricing, and price
    Then a listing is created with status "pending_approval"
    And the listing is NOT visible to other residents
    And admin receives a "service_listing_pending" notification

  Scenario: Admin approves a listing
    Given a listing with status "pending_approval"
    When admin approves the listing with an optional note
    Then the listing status becomes "active"
    And the listing appears in browse results for the HOA
    And the provider receives a "service_listing_approved" notification

  Scenario: Admin rejects a listing without a reason
    Given a listing with status "pending_approval"
    When admin submits a rejection without a reason
    Then the system returns 400 "decline_reason_required"
    And the listing status remains "pending_approval"

  Scenario: Admin rejects a listing with a reason
    Given a listing with status "pending_approval"
    When admin rejects the listing with reason "Service not HOA-related"
    Then the listing status becomes "rejected"
    And the provider receives a "service_listing_rejected" notification with the reason
    And the listing does NOT appear in browse results
```

### Feature: Booking Lifecycle

```gherkin
Feature: Booking Lifecycle

  Scenario: Requester attempts to book their own listing
    Given a provider has an active listing
    When the provider submits a booking request for their own listing
    Then the system returns 403 "cannot_book_own_listing"
    And no booking record is created

  Scenario: Requester has no saved payment method
    Given an active listing by another provider
    And the requester has no saved payment method
    When the requester submits a booking request
    Then the system returns 400 "payment_method_required"
    And no booking record is created

  Scenario: Requester submits a valid booking request
    Given an active listing
    And the requester has a saved payment method
    When the requester submits a booking with a proposed date and time
    Then a booking is created with status "pending"
    And NO payment is captured
    And the provider receives a "service_booking_requested" notification

  Scenario: Provider accepts booking — payment succeeds
    Given a pending booking
    When the provider accepts the booking
    Then payment is captured from the requester's saved payment method
    And the booking status becomes "accepted"
    And stripePaymentIntentId and stripeChargeId are stored on the booking
    And the requester receives a "service_booking_accepted" notification

  Scenario: Provider accepts booking — payment fails
    Given a pending booking
    And the requester's payment method will fail
    When the provider accepts the booking
    Then the booking status becomes "payment_failed"
    And both parties receive a payment failure notification
    And NO payout is scheduled

  Scenario: Provider declines booking without a reason
    Given a pending booking
    When the provider submits a decline without a reason
    Then the system returns 400 "decline_reason_required"
    And the booking status remains "pending"

  Scenario: Provider declines booking with a reason
    Given a pending booking
    When the provider declines with reason "Not available that day"
    Then the booking status becomes "declined"
    And the requester receives a "service_booking_declined" notification with the reason
    And NO payment is taken
```

### Feature: Job Completion and Payout

```gherkin
Feature: Job Completion and Payout

  Scenario: Provider marks job complete
    Given an accepted booking
    When the provider marks the booking as complete
    Then booking status becomes "completed"
    And completedAt is recorded
    And payoutStatus is set to "pending"
    And the requester receives a "service_booking_completed" notification immediately
    And NO payout transfer is created at this moment

  Scenario: Payout cron — booking completed less than 24 hours ago
    Given a completed booking where completedAt is 12 hours ago
    When the payout cron runs
    Then the booking is NOT included in the eligible payout set
    And no Stripe transfer is created

  Scenario: Payout cron — eligible booking processed successfully
    Given a completed booking where completedAt is 25 hours ago
    And payoutStatus is "pending"
    When the payout cron runs
    Then the cron atomically claims the booking (payoutStatus → "processing")
    And a Stripe transfer is created with source_transaction = chargeId
    And transfer amount = servicePrice - (servicePrice × 20%) in cents
    And payoutStatus becomes "completed"
    And stripeTransferId and ownerTransferredAt are recorded
    And the provider receives a "service_payout_sent" notification

  Scenario: Payout cron — transfer fails
    Given an eligible booking for payout
    When the payout cron runs and the Stripe transfer fails
    Then payoutStatus becomes "failed"
    And ops is alerted with bookingId and error details
    And the booking status remains "completed" (job was done)
    And the provider does NOT receive a payout notification

  Scenario: Concurrent payout cron runs
    Given an eligible booking for payout
    When two cron instances run simultaneously
    Then exactly one instance claims the booking
    And exactly one Stripe transfer is created
    And no duplicate transfer occurs
```

### Feature: Cancellations and Refunds

```gherkin
Feature: Cancellations and Refunds

  Scenario: Requester cancels — more than 24 hours before proposed date
    Given an accepted booking with proposedDate 48 hours from now
    When the requester cancels with an optional reason
    Then a full refund (100% of totalAmount) is issued via Stripe
    And booking status becomes "cancelled"
    And refundAmount and stripeRefundId are stored
    And both parties receive a cancellation notification

  Scenario: Requester cancels — 24 hours or less before proposed date
    Given an accepted booking with proposedDate 6 hours from now
    When the requester cancels
    Then a 50% partial refund of totalAmount is issued via Stripe
    And booking status becomes "cancelled"
    And refundAmount and stripeRefundId are stored
    And both parties receive a cancellation notification

  Scenario: Provider cancels an accepted booking
    Given an accepted booking
    When the provider cancels
    Then a full refund (100% of totalAmount) is issued via Stripe regardless of timing
    And booking status becomes "cancelled"
    And both parties receive a cancellation notification

  Scenario: No-show report filed
    Given an accepted booking
    When either party files a no-show report
    Then a service_no_show_reports record is created
    And admin receives a "service_no_show_reported" notification
    And booking status remains "accepted" (unchanged)
    And NO automatic refund is issued
```

### Feature: Mutual Reviews

```gherkin
Feature: Mutual Reviews

  Scenario: Requester submits a valid review
    Given a completed booking
    When the requester submits a 4-star review with a comment
    Then the review is created
    And the provider's aggregate rating is recalculated
    And the updated rating is reflected on the provider profile

  Scenario: Provider submits a duplicate review
    Given a completed booking where the provider already submitted a review
    When the provider submits another review for the same booking
    Then the system returns 409 "review_already_submitted"
    And no duplicate review record is created

  Scenario: Both parties submit reviews for the same booking
    Given a completed booking
    When the requester submits a review
    And the provider submits a review
    Then two review records exist for the booking (one per party)
    And the provider's aggregate rating accounts for both reviews submitted to them
```

---

## Fee Calculation Tests (100% Coverage Required)

These tests must achieve 100% coverage as they directly affect financial outcomes.

### Platform Fee Deduction

| servicePrice | PLATFORM_FEE_PERCENTAGE | Expected Transfer (cents) |
| ------------ | ----------------------- | ------------------------- |
| $100.00      | 20%                     | 8000                      |
| $50.00       | 20%                     | 4000                      |
| $33.33       | 20%                     | 2666                      |
| $0.01        | 20%                     | 0                         |
| $1.00        | 20%                     | 80                        |

**Calculation**: `Math.round(servicePrice * 100) - Math.round(servicePrice * 100 * PLATFORM_FEE_PERCENTAGE)`

### Cancellation Refund Tiers

| Cancelling Party | Hours Until proposedDate | Refund % | Refund on $100 booking |
| ---------------- | ------------------------ | -------- | ---------------------- |
| Requester        | > 24 hours               | 100%     | $100.00                |
| Requester        | exactly 24 hours         | 50%      | $50.00                 |
| Requester        | < 24 hours               | 50%      | $50.00                 |
| Requester        | 0 hours (past)           | 50%      | $50.00                 |
| Provider         | any timing               | 100%     | $100.00                |

**Note**: The `>24 hours` threshold is exclusive — exactly 24 hours qualifies for the 50% tier.

### Service Fee Calculation

```typescript
// Verify reuse of existing calculateServiceFee() from src/constants/payments.ts
it("uses calculateServiceFee() for service fee — not a custom calculation", () => {
  expect(serviceFee).toEqual(calculateServiceFee(servicePrice));
});
```

---

## Performance Tests

| Scenario                                      | Target       | Test Method                                   |
| --------------------------------------------- | ------------ | --------------------------------------------- |
| Browse page load (100 active listings)        | < 2 seconds  | Vitest timer + mock DB with 100 listings      |
| Payment capture at acceptance                 | < 10 seconds | Mock Stripe with realistic response delay     |
| Payout cron — 20 eligible bookings            | < 60 seconds | Integration test with mocked Stripe transfers |
| `findEligibleForPayout` query (1000 bookings) | < 500ms      | DB query plan analysis + index verification   |

---

## Security Tests

| Scenario                                                        | Expected Behavior                 |
| --------------------------------------------------------------- | --------------------------------- |
| Unauthenticated request to any `/api/services/*` route          | 401 Unauthorized                  |
| Non-admin accessing `/api/admin/services/listings/[id]/approve` | 403 Forbidden                     |
| Requester accessing a listing from another HOA                  | 404 Not Found (community scoping) |
| Provider accepting another provider's booking                   | 403 Forbidden                     |
| User cancelling a booking they are not party to                 | 403 Forbidden                     |
| User submitting a review for a booking they are not party to    | 403 Forbidden                     |
| Stripe secret key in error messages or logs                     | Must NOT appear                   |
| Audit log created for all financial operations                  | Verified via integration test     |

---

## Error Handling Tests

### Stripe Error Types

| Error Type                  | Retryable | Expected Action                                                          |
| --------------------------- | --------- | ------------------------------------------------------------------------ |
| `StripeCardError`           | No        | Status → `payment_failed`; notify both parties                           |
| `StripeRateLimitError`      | Yes       | Retry once after 1s; if second attempt fails → `payment_failed` + notify |
| `StripeAPIError`            | Yes       | Retry once after 1s; if second attempt fails → `payment_failed` + notify |
| `StripeConnectionError`     | Yes       | Retry once after 1s; if second attempt fails → `payment_failed` + notify |
| `StripeInvalidRequestError` | No        | Log + alert ops; `payment_failed`                                        |
| `StripeAuthenticationError` | No        | Log + alert ops (configuration issue)                                    |

### Business Rule Errors

| Scenario                               | HTTP Status | Error Code                 |
| -------------------------------------- | ----------- | -------------------------- |
| Provider has no Stripe Connect account | 400         | `stripe_connect_required`  |
| Requester has no saved payment method  | 400         | `payment_method_required`  |
| Requester books own listing            | 403         | `cannot_book_own_listing`  |
| Decline submitted without reason       | 400         | `decline_reason_required`  |
| Duplicate review from same party       | 409         | `review_already_submitted` |
| Action on wrong booking status         | 409         | `invalid_booking_status`   |

---

## Coverage Goals

| Component                                                  | Coverage Target | Critical Areas                        |
| ---------------------------------------------------------- | --------------- | ------------------------------------- |
| Fee calculations (platform fee, refund tiers, service fee) | 100%            | All boundary conditions               |
| ServiceBookingDAL (atomic claim, eligibility query)        | 90%+            | Concurrency behavior                  |
| ServiceListingDAL (community scoping, status filtering)    | 85%+            | Multi-community isolation             |
| ServiceReviewDAL (aggregate rating calc)                   | 90%+            | Math correctness                      |
| chargeServicePayment / createServiceTransfer               | 90%+            | No transfer_data, idempotency keys    |
| ServiceListingService                                      | 85%+            | Stripe Connect gate, approval flows   |
| ServiceBookingService                                      | 90%+            | All booking state transitions         |
| ServicePayoutService                                       | 90%+            | Atomic claim, batch processing        |
| ServiceReviewService                                       | 85%+            | Duplicate rejection, aggregate recalc |
| Notification helpers                                       | 80%+            | Correct type per scenario             |
| API routes                                                 | 80%+            | Auth guards, input validation         |

---

## Test Data Requirements

### Fixtures

```typescript
// Seeded test data
const testCommunity = { id: "community-1", name: "Oakwood HOA" };
const testProvider = {
  id: "provider-1",
  communityId: "community-1",
  stripeConnectedAccountId: "acct_test_123",
};
const testRequester = {
  id: "requester-1",
  communityId: "community-1",
  defaultPaymentMethodId: "pm_test_456",
};
const testCategory = { id: "category-1", name: "Plumbing" };

const testListing = {
  id: "listing-1",
  communityId: "community-1",
  providerId: "provider-1",
  categoryId: "category-1",
  title: "Drain Unclogging",
  pricingType: "fixed",
  price: 75.0,
  status: "active",
};

const testBooking = {
  id: "booking-1",
  listingId: "listing-1",
  requesterId: "requester-1",
  providerId: "provider-1",
  communityId: "community-1",
  proposedDate: "2026-04-15",
  proposedTime: "10:00",
  servicePrice: 75.0,
  serviceFee: 5.0,
  totalAmount: 80.0,
  status: "accepted",
  stripeChargeId: "ch_test_abc",
};
```

### Mocking Strategy

- **Stripe API**: Mock via `vi.mock()` — test all success and failure paths for PaymentIntents and Transfers
- **DAL methods**: Mock via `vi.spyOn()` — test service layer logic in isolation
- **Notification helpers**: Mock via `vi.mock()` — verify called with correct type and recipient
- **`sendOpsAlert()`**: Mock via `vi.mock()` — verify called on financial failures
- **Time-sensitive queries**: Use `vi.setSystemTime()` for 24-hour cutoff tests

---

## Test Execution

```bash
# Run all unit tests
bun run test

# Run with coverage
bun run test:coverage

# Run specific service tests
bun run test src/features/services/__tests__/

# Run specific DAL tests
bun run test src/dal/__tests__/service-

# Run specific Stripe tests
bun run test src/services/stripe/__tests__/service-payments

# Run integration tests (cron + API routes)
bun run test src/app/api/services/ src/app/api/cron/process-service-payouts/
```

---

_Last updated: March 21, 2026 | Internal use only_
