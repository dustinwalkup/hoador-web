# Test Plan - Blind Review System

## Requirements Traceability

This test plan covers the unified blind review system including submission, release logic, visibility rules, aggregate caching, background processing, and UI integration. Tests verify all 17 requirements from the requirements document.

## Test Framework & Tools

- **Unit/Integration tests:** Vitest
- **Database:** Test PostgreSQL instance (real DB, no mocks for DAL tests)
- **API tests:** Vitest + Next.js route handler testing
- **E2E:** Playwright (if applicable for UI flows)
- **Mocking:** Vitest mocks for notifications, external services only

---

## Test Types

### Unit Tests

#### DAL Methods (`BlindReviewDAL`)

- [ ] `create()` — Create review
  - Happy path: Review created with releasedAt = null, submittedAt set
  - Happy path: Review with rentalId FK set, serviceBookingId null
  - Happy path: Review with serviceBookingId FK set, rentalId null
  - Error: Duplicate (reviewerId + rentalId) throws ConflictError
  - Error: Duplicate (reviewerId + serviceBookingId) throws ConflictError
  - Error: Both rentalId and serviceBookingId set violates check constraint
  - Error: Neither rentalId nor serviceBookingId set violates check constraint
  - Error: Invalid FK (nonexistent rental) throws ValidationError
  - _Requirements: 12, 2_

- [ ] `findByBooking()` — All reviews for a booking
  - Happy path: Returns 0 reviews when none exist
  - Happy path: Returns 1 review when one party submitted
  - Happy path: Returns 2 reviews when both parties submitted
  - Edge case: Does not return reviews from other bookings
  - _Requirements: 12_

- [ ] `findReleasedByBooking()` — Released reviews with reviewer info
  - Happy path: Returns released reviews with reviewer name and avatar
  - Happy path: Returns empty array when reviews exist but are unreleased
  - Happy path: Returns only released reviews when one is released and one is not (shouldn't happen in practice but defensive)
  - Edge case: Handles null avatar gracefully
  - _Requirements: 7, 10, 17_

- [ ] `findByReviewerAndBooking()` — Duplicate check
  - Happy path: Returns review when exists
  - Happy path: Returns null when no review for this user + booking
  - Edge case: Does not match different user on same booking
  - Edge case: Does not match same user on different booking
  - _Requirements: 1, 8_

- [ ] `findReleasedByReviewee()` — Profile reviews (paginated)
  - Happy path: Returns paginated reviews newest first
  - Happy path: Excludes unreleased reviews
  - Happy path: Pagination (limit/offset) works correctly
  - Edge case: Returns empty result when user has no released reviews
  - Edge case: Does not return reviews where user is reviewer (only reviewee)
  - _Requirements: 16_

- [ ] `getAggregate()` — Aggregate rating
  - Happy path: Returns correct average and count
  - Happy path: Only counts released reviews
  - Edge case: Returns 0/null when no released reviews exist
  - Edge case: Correctly rounds average
  - _Requirements: 16_

- [ ] `releaseReviews()` — Immediate release
  - Happy path: Sets releasedAt = now() for given IDs
  - Happy path: Does not modify reviews not in the ID list
  - Edge case: No-op when passed empty array
  - Edge case: Skips already-released reviews (idempotent)
  - _Requirements: 6_

- [ ] `findUnreleasedExpired()` — Cron query
  - Happy path: Returns reviews where releasedAt IS NULL AND reviewWindowEndAt <= now()
  - Happy path: Does not return already-released reviews
  - Happy path: Does not return reviews where window hasn't expired yet
  - Happy path: Respects batch limit
  - _Requirements: 13_

- [ ] `releaseExpired()` — Cron release
  - Happy path: Sets releasedAt to provided timestamp for given IDs
  - Edge case: Idempotent (safe to call twice with same IDs)
  - _Requirements: 13_

#### User Aggregate DAL

- [ ] `updateUserReviewAggregate()` — Recalculate and persist
  - Happy path: Correctly computes AVG and COUNT from released reviews
  - Happy path: Persists to user.reviewAggregateRating and user.reviewCount
  - Edge case: Sets to null/0 when no released reviews exist
  - Edge case: Only includes released reviews in calculation
  - _Requirements: 16_

#### Validation Schema

- [ ] `createBlindReviewSchema` — Zod validation
  - Happy path: Valid input with rentalId + rating passes
  - Happy path: Valid input with serviceBookingId + rating passes
  - Happy path: Comment is optional
  - Error: Rating 0 fails
  - Error: Rating 6 fails
  - Error: Non-integer rating fails
  - Error: Comment exceeding 2000 chars fails
  - Error: Both rentalId and serviceBookingId fails
  - Error: Neither rentalId nor serviceBookingId fails
  - Error: Non-UUID rentalId fails
  - _Requirements: 5, 9_

---

### Service Layer Tests (`BlindReviewService`)

#### `submitReview()`

- [ ] Happy path: Creates review for rental with correct fields
  - Verify releasedAt = null on creation
  - Verify reviewWindowEndAt = completedAt + 7 days
  - Verify revieweeId derived from booking (other party)
  - _Requirements: 1, 2, 5_

- [ ] Happy path: Creates review for service booking
  - Same verifications as rental
  - _Requirements: 1, 2, 5_

- [ ] Happy path: Immediate release when second review submitted
  - First review: created, releasedAt = null
  - Second review: created, BOTH reviews get releasedAt = now()
  - Aggregate updated for both reviewees
  - Notification sent to both reviewees
  - _Requirements: 6, 15_

- [ ] Happy path: No release when first review submitted (no counterpart)
  - Review created with releasedAt = null
  - No aggregate update
  - No notification sent
  - _Requirements: 6_

- [ ] Error: Booking not found → NotFoundError (404)
  - _Requirements: 9_

- [ ] Error: Booking not completed → ValidationError (400)
  - _Requirements: 1, 9_

- [ ] Error: User not a participant → ForbiddenError (403)
  - _Requirements: 1, 9_

- [ ] Error: Window expired → ValidationError (400)
  - _Requirements: 4, 9_

- [ ] Error: Already submitted → ConflictError (409)
  - _Requirements: 1, 9_

- [ ] Error: Self-review prevented (reviewerId === revieweeId) → ValidationError (400)
  - Note: This shouldn't happen with proper reviewee derivation but validates the safeguard
  - _Requirements: 3_

- [ ] Derivation: Rental — borrower submits → reviewee is owner
  - _Requirements: 2, 3_

- [ ] Derivation: Rental — owner submits → reviewee is borrower
  - _Requirements: 2, 3_

- [ ] Derivation: Service — client submits → reviewee is provider
  - _Requirements: 2, 3_

- [ ] Derivation: Service — provider submits → reviewee is client
  - _Requirements: 2, 3_

#### `getBookingReviews()`

- [ ] Happy path: Returns released reviews with reviewer info
  - _Requirements: 10, 17_

- [ ] Returns empty array when reviews exist but unreleased
  - _Requirements: 7, 10_

- [ ] Returns empty array when no reviews exist
  - _Requirements: 10_

- [ ] Returns 1 review when only one was released (single submission + window expired)
  - _Requirements: 10_

#### `getReviewStatus()`

- [ ] `canReview: true` — booking completed, within window, user is participant, hasn't reviewed
  - _Requirements: 8, 11_

- [ ] `canReview: false` — user already submitted
  - _Requirements: 8, 11_

- [ ] `canReview: false` — window expired
  - _Requirements: 8, 11_

- [ ] `canReview: false` — booking not completed
  - _Requirements: 8, 11_

- [ ] `hasReviewed: true` — user's review exists (regardless of release state)
  - _Requirements: 8_

- [ ] `hasReviewed: false` — no review from this user
  - _Requirements: 8_

- [ ] Does NOT reveal whether other party has reviewed
  - _Requirements: 8, 11_

- [ ] Returns correct `reviewWindowEndAt` timestamp
  - _Requirements: 8_

#### `getUserReviews()`

- [ ] Happy path: Returns paginated reviews + aggregate for profile
  - _Requirements: 16_

- [ ] Only includes released reviews
  - _Requirements: 7, 16_

- [ ] Pagination works (limit, offset, total count)
  - _Requirements: 16_

#### `releaseExpiredReviews()`

- [ ] Happy path: Releases expired reviews, updates aggregates, sends notifications
  - _Requirements: 13, 15, 16_

- [ ] Idempotent: Running twice doesn't double-release or duplicate notifications
  - _Requirements: 13_

- [ ] Batch limiting: Only processes up to batch size
  - _Requirements: 13_

- [ ] Returns correct summary counts (eligible, released, failed)
  - _Requirements: 13_

- [ ] Groups by booking: If both reviews for same booking are expired, both released together
  - _Requirements: 6, 13_

---

### API Route Tests

#### `POST /api/reviews`

- [ ] 201: Valid rental review submission returns `{ success: true, reviewId }`
- [ ] 201: Valid service booking review submission
- [ ] 400: Invalid rating (out of range)
- [ ] 400: Missing booking reference
- [ ] 400: Both rentalId and serviceBookingId provided
- [ ] 400: Booking not completed
- [ ] 400: Window expired
- [ ] 401: Unauthenticated request
- [ ] 403: User not a participant
- [ ] 404: Booking not found
- [ ] 409: Duplicate review submission
- _Requirements: 9_

#### `GET /api/reviews` (booking query)

- [ ] 200: Returns released reviews + reviewStatus when querying by rentalId
- [ ] 200: Returns released reviews + reviewStatus when querying by serviceBookingId
- [ ] 200: Returns empty reviews array + reviewStatus when unreleased
- [ ] 200: reviewStatus.canReview correctly computed
- [ ] 200: reviewStatus does NOT include other party's submission state
- [ ] 401: Unauthenticated request
- _Requirements: 10, 11_

#### `GET /api/reviews` (reviewee query)

- [ ] 200: Returns paginated reviews + aggregate for valid revieweeId
- [ ] 200: Pagination params (limit, offset) respected
- [ ] 200: Only released reviews included
- [ ] 200: Returns empty reviews + zero aggregate for user with no reviews
- [ ] 401: Unauthenticated request
- _Requirements: 16_

#### `GET /api/cron/release-reviews`

- [ ] 200: Releases expired reviews and returns summary
- [ ] 200: No-op when no expired reviews (returns zeros)
- [ ] 200: Idempotent (second call finds nothing to release)
- [ ] 401: Missing or invalid CRON_SECRET rejected
- [ ] 500: Error recorded in cron run history + ops alert sent
- _Requirements: 13_

---

### Integration Tests

#### Full Blind Release Flow (Both Submit)

- [ ] Scenario: Rental — borrower and owner both submit within window
  1. Create completed rental with two participants
  2. Borrower submits review → verify releasedAt = null
  3. GET reviews → verify empty array returned
  4. Owner submits review → verify both releasedAt set
  5. GET reviews → verify both reviews returned with correct data
  6. Verify user aggregate updated for both users
  7. Verify notifications sent to both users
  - _Requirements: 1, 2, 5, 6, 7, 10, 15, 16_

- [ ] Scenario: Service — client and provider both submit within window
  - Same flow as rental but with service booking
  - _Requirements: 1, 2, 5, 6, 7, 10, 15, 16_

#### Cron Release Flow (Single Submit + Expiry)

- [ ] Scenario: One party submits, window expires, cron releases
  1. Create completed booking (completedAt = 8 days ago)
  2. One party submits review (simulated at day 2)
  3. Run cron endpoint
  4. Verify review released with releasedAt = reviewWindowEndAt
  5. Verify aggregate updated for reviewee
  6. Verify notification sent to reviewee
  7. Run cron again → verify no-op
  - _Requirements: 4, 6, 13, 15, 16_

#### Window Expiry Prevention

- [ ] Scenario: User tries to submit after window closes
  1. Create completed booking (completedAt = 8 days ago, window expired)
  2. Attempt to submit review
  3. Verify 400 error with appropriate message
  4. Verify canReview = false in status
  - _Requirements: 4_

#### Visibility Isolation

- [ ] Scenario: First submitter cannot see own review or other's status
  1. User A submits review
  2. User A queries booking reviews → empty array
  3. User A queries review status → hasReviewed: true, no indication of User B's status
  4. User B queries review status → hasReviewed: false, canReview: true (no leak)
  - _Requirements: 7, 8, 11, 14_

#### Duplicate Prevention Under Concurrency

- [ ] Scenario: Same user submits twice rapidly
  1. Submit review
  2. Submit again immediately
  3. Second submission returns 409
  4. Only one review exists in DB
  - _Requirements: 1, 12_

---

### UI / Component Tests

#### Review Status Component

- [ ] Renders "Leave a Review" CTA when canReview = true
- [ ] Renders blind review explanation text
- [ ] Renders "Submitted, will be visible soon" when hasReviewed = true and not released
- [ ] Renders nothing when window expired and user hasn't reviewed
- [ ] Does NOT render any indicator of other party's status
- _Requirements: 8, 14_

#### Review Submission Form

- [ ] Star rating selection (1-5) works
- [ ] Comment textarea enforces max length
- [ ] Submit button disabled while loading
- [ ] On success: shows confirmation, updates status optimistically
- [ ] On error: shows error message (e.g., "Window expired")
- _Requirements: 5, 14_

#### Released Review Card

- [ ] Displays reviewer avatar, name, star rating, comment, date
- [ ] Handles null comment gracefully (shows rating only)
- [ ] Handles null avatar gracefully (shows fallback)
- _Requirements: 16, 17_

#### Booking Detail Integration

- [ ] Shows aggregate rating in user card section
- [ ] Shows review status component when reviews unreleased
- [ ] Shows review cards when reviews are released
- [ ] Transitions from status → cards after release (on refetch)
- _Requirements: 14, 16, 17_

#### User Profile Reviews Section

- [ ] Shows aggregate rating summary (stars + count)
- [ ] Shows paginated list of reviews
- [ ] "Load more" or pagination controls work
- [ ] Empty state when user has no reviews
- _Requirements: 16_

---

## Edge Cases & Boundary Conditions

- [ ] Window boundary: Submit at exactly `reviewWindowEndAt` (should succeed — using `<=`)
- [ ] Window boundary: Submit 1 second after `reviewWindowEndAt` (should fail)
- [ ] Rating boundary: 1 and 5 both accepted, 0 and 6 rejected
- [ ] Comment boundary: Empty string treated as null, 2000 chars accepted, 2001 rejected
- [ ] Aggregate with single review: Average equals that review's rating
- [ ] Cron with large batch: Correctly processes up to batch limit, picks up remainder on next run
- [ ] Booking with no reviews at window expiry: Cron finds nothing, no errors

---

## Test Data Requirements

- Users: At least 3 (two participants per booking + one non-participant for auth tests)
- Rentals: Completed rental with borrower + owner references
- Service bookings: Completed booking with requester + provider references
- Time manipulation: Tests need ability to set/mock `completedAt` in the past for window expiry scenarios

---

## Coverage Goals

- DAL methods: 100% branch coverage
- Service layer: 100% branch coverage (all validation paths)
- API routes: All status codes tested
- UI components: All conditional render states tested
- Integration: All three release scenarios (both-submit, single+cron, no-submit)
