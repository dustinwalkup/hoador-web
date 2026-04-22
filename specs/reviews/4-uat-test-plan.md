# Blind Review System - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Blind Review System. The system replaces the old dual-table review system with a unified, bidirectional, time-windowed blind review mechanism for both rentals and service bookings. Reviews are hidden until both parties submit or the 7-day window expires.

**Feature**: Blind Review System
**Version**: 2.0
**Date**: 2026-04-21
**Test Environment**: Staging/Production
**Reference Documents**:

- Requirements: `specs/reviews/1-requirements.md`
- Design: `specs/reviews/2-design.md`
- Implementation Tasks: `specs/reviews/3-tasks.md`
- Implementation Notes: `specs/reviews/5-implementation-notes.md`

## Test Objectives

1. Verify that reviews can be submitted by both parties (bidirectional) for rentals and service bookings
2. Validate the blind review mechanism — reviews are hidden until both submit or window expires
3. Confirm the 7-day review window is enforced correctly
4. Verify that review eligibility rules are enforced (authentication, participation, completion, no duplicates)
5. Validate that aggregate ratings update only at release time
6. Confirm the cron-based background release process works correctly
7. Verify post-release notifications are sent to reviewees
8. Validate reviews display correctly on booking detail pages and user profiles
9. Ensure no information about the other party's review status is leaked before release

---

## Test Scenarios

### [x] Scenario 1: Review Submission — Rental Borrower (Happy Path)

**User Story**: As a borrower in a completed rental, I want to leave a review for the owner so that I can share my experience.

**Preconditions**:

- User is logged in as the borrower of a completed rental
- Review window has not expired (within 7 days of completion)
- User has not already reviewed this booking

**Test Steps**:

1. Log in as the borrower
2. Navigate to the completed rental detail page
3. Verify a "Leave a Review" button/CTA is visible
4. Verify blind review explanation text is shown (reviews hidden until both submit or window expires)
5. Click "Leave a Review"
6. Verify review form/modal opens with star rating (1–5) and optional comment field
7. Select rating: 5 stars
8. Enter comment: "Great experience renting this tool. Owner was responsive and the tool was in excellent condition."
9. Click "Submit Review"
10. Verify success confirmation appears
11. Verify the UI updates to show "Review submitted — will be visible soon"
12. Verify the "Leave a Review" button is no longer shown

    **Expected Results**:

- ✅ Review form shows only overall rating (1–5) and optional comment (no sub-ratings)
- ✅ Comment field accepts up to 2000 characters
- ✅ Submission succeeds with valid data
- ✅ Status updates to "hasReviewed" state — user sees confirmation
- ✅ No review content is visible yet (releasedAt is null)
- ✅ No indication of whether the owner has reviewed

**Priority**: Critical
**Requirement Reference**: Requirements 1, 2, 4, 5, 8, 14

---

### [x] Scenario 2: Review Submission — Rental Owner

**User Story**: As the owner in a completed rental, I want to review the borrower so that I can share my experience.

**Preconditions**:

- User is logged in as the owner of a completed rental
- Review window has not expired
- User has not already reviewed this booking

**Test Steps**:

1. Log in as the listing owner
2. Navigate to the completed rental detail page (from Lending → Completed)
3. Verify "Leave a Review" CTA is visible
4. Click "Leave a Review"
5. Select rating: 4 stars
6. Enter comment: "Borrower returned the tool on time and in good condition."
7. Submit review
8. Verify success confirmation
9. Verify UI shows "Review submitted — will be visible soon"

**Expected Results**:

- ✅ Owner can submit a review independently of whether the borrower has reviewed
- ✅ Review form is identical to borrower's (same fields, same validation)
- ✅ Submission succeeds
- ✅ No indication of whether the borrower has submitted

**Priority**: Critical
**Requirement Reference**: Requirements 1, 2, 5, 14

---

### [x] Scenario 3: Review Submission — Service Booking Client

**User Story**: As a client in a completed service booking, I want to review the service provider.

**Preconditions**:

- User is logged in as the client of a completed service booking
- Review window has not expired

**Test Steps**:

1. Log in as the service client
2. Navigate to the completed service booking detail page
3. Verify "Leave a Review" CTA is visible
4. Click "Leave a Review"
5. Select rating: 5 stars
6. Enter comment: "Excellent service, very professional and timely."
7. Submit review
8. Verify success confirmation

**Expected Results**:

- ✅ Service booking reviews use the same unified review system
- ✅ Review is created with `serviceBookingId` reference
- ✅ UI behavior is consistent with rental reviews

**Priority**: Critical
**Requirement Reference**: Requirements 1, 2, 5

---

### [x] Scenario 4: Review Submission — Service Booking Provider

**User Story**: As a service provider in a completed service booking, I want to review the client.

**Preconditions**:

- User is logged in as the service provider of a completed service booking
- Review window has not expired

**Test Steps**:

1. Log in as the service provider
2. Navigate to the completed service booking detail page
3. Verify "Leave a Review" CTA is visible
4. Click "Leave a Review"
5. Select rating: 4 stars
6. Optionally enter comment
7. Submit review
8. Verify success confirmation

**Expected Results**:

- ✅ Provider can review the client
- ✅ Review is correctly associated with the service booking
- ✅ Comment is optional — review can be submitted with rating only

**Priority**: Critical
**Requirement Reference**: Requirements 1, 2, 5

---

### [x] Scenario 5: Blind Release — Both Parties Submit (Immediate Release)

**User Story**: As a user, I want reviews to be released immediately once both parties have submitted, so I can see the other party's feedback.

**Preconditions**:

- Completed rental exists with review window still open
- Neither party has submitted a review yet

**Test Steps**:

1. **User A** (borrower) logs in and submits a review (rating: 4, comment: "Good experience")
2. Verify User A sees "Review submitted — will be visible soon"
3. Verify no reviews are visible on the booking detail page for either party
4. **User B** (owner) logs in and submits a review (rating: 5, comment: "Great borrower")
5. Verify User B sees success confirmation
6. **User A** navigates to the booking detail page
7. Verify BOTH reviews are now visible (User A's and User B's)
8. **User B** navigates to the booking detail page
9. Verify BOTH reviews are now visible
10. Verify each review shows: reviewer name, reviewer avatar, star rating, comment, and date

**Expected Results**:

- ✅ After first submission: no reviews are visible to either party
- ✅ After second submission: both reviews become visible immediately
- ✅ Both reviews have `releasedAt` set (not null)
- ✅ Reviewer identity (name, avatar) is visible on released reviews
- ✅ Both parties receive a "You received a review" notification

**Priority**: Critical
**Requirement Reference**: Requirements 6 (Case 1), 7, 15, 17

---

### Scenario 6: Blind Release — Window Expiry with One Review (Cron Release)

**User Story**: As a user who submitted a review, I want my review to be released when the window expires even if the other party didn't submit.

**Preconditions**:

- Completed rental with review window about to expire
- Only one party has submitted a review
- Cron job is scheduled to run

**Test Steps**:

1. **User A** submits a review within the 7-day window
2. **User B** does NOT submit a review
3. Wait for the 7-day window to expire
4. Verify the hourly cron job (`/api/cron/release-reviews`) runs
5. After cron runs, **User A** navigates to booking detail page
6. Verify User A's review is now visible
7. Verify only one review is shown (User A's review — User B never submitted)
8. **User B** navigates to booking detail page
9. Verify User A's review about User B is visible to User B
10. Verify User B can no longer submit a review (window expired)

**Expected Results**:

- ✅ Single review is released after window expiry via cron
- ✅ `releasedAt` is set to `reviewWindowEndAt` (not current time)
- ✅ Only the submitted review is displayed
- ✅ Reviewee (User B) receives a notification about the received review
- ✅ User B's aggregate rating is updated
- ✅ The "Leave a Review" button is hidden for User B after window expiry

**Priority**: Critical
**Requirement Reference**: Requirements 6 (Case 2), 4, 13, 15

---

### Scenario 7: Blind Release — No Submissions (Window Expiry)

**User Story**: As a platform, when neither party submits a review, the window closes with no action needed.

**Preconditions**:

- Completed booking with review window expired
- Neither party submitted a review

**Test Steps**:

1. Verify neither party has submitted a review
2. Allow the 7-day window to expire
3. Cron job runs
4. Verify no reviews are created or released
5. Navigate to booking detail page
6. Verify no reviews section is displayed (or shows "No reviews" state)
7. Verify "Leave a Review" CTA is hidden (window expired)

**Expected Results**:

- ✅ No action taken by cron when no reviews exist for expired bookings
- ✅ No error or notification generated
- ✅ UI correctly reflects that no reviews were submitted

**Priority**: Medium
**Requirement Reference**: Requirements 6 (Case 3), 4

---

### Scenario 8: Review Eligibility — Blocked Scenarios

**User Story**: As the system, I need to prevent ineligible review submissions.

**Preconditions**:

- Various booking states and user roles as described per sub-test

**Test Steps and Expected Results**:

1. **Booking not completed**: Navigate to an active/pending rental → Verify "Leave a Review" is NOT shown → Attempt `POST /api/reviews` directly → Verify 400 error: "Reviews can only be submitted for completed bookings"

2. **Non-participant**: Log in as a user who is NOT part of the booking → Attempt `POST /api/reviews` with that booking ID → Verify 403 error: "You are not a participant in this booking"

3. **Review window expired**: Navigate to a completed booking older than 7 days → Verify "Leave a Review" is NOT shown → Attempt `POST /api/reviews` → Verify 400 error: "The review window for this booking has closed"

4. **Duplicate review**: Submit a review, then attempt to submit again for the same booking → Verify 409 error: "You have already submitted a review for this booking"

5. **Self-review prevention**: Verify `revieweeId` is derived server-side (other party) → Verify it's impossible for `reviewerId === revieweeId` → Verify no client input controls the reviewee

6. **Unauthenticated user**: Attempt `POST /api/reviews` without authentication → Verify 401 error

**Expected Results**:

- ✅ Each blocked scenario returns the correct HTTP status code and descriptive error message
- ✅ Server-side validation catches all cases regardless of client behavior
- ✅ UI hides the review CTA when `canReview` is false

**Priority**: Critical
**Requirement Reference**: Requirements 1, 3, 4, 9

---

### Scenario 9: Review Status API — No Information Leak

**User Story**: As a user, I should never see whether the other party has submitted a review before release.

**Preconditions**:

- Completed booking where one party has submitted a review

**Test Steps**:

1. **User A** submits a review
2. **User B** navigates to the booking detail page
3. Verify User B sees `canReview: true` and `hasReviewed: false`
4. Verify User B does NOT see any indication that User A has submitted
5. Verify the API response (`GET /api/reviews?rentalId=X`) returns empty reviews array (none released)
6. Verify no "1 of 2 reviews submitted" or similar messaging exists
7. Verify the review status response includes ONLY: `hasReviewed`, `canReview`, `reviewWindowEndAt`

**Expected Results**:

- ✅ Other party's review status is never exposed before release
- ✅ API returns empty reviews array when reviews exist but are unreleased
- ✅ No indirect indicators (counts, progress bars, etc.) reveal other party's action

**Priority**: Critical
**Requirement Reference**: Requirements 7, 8, 11

---

### Scenario 10: Review Validation — Rating and Comment

**User Story**: As a user, I want clear validation when I provide invalid review data.

**Preconditions**:

- User is logged in with a completed booking eligible for review
- Review form is open

**Test Steps**:

1. Attempt to submit without selecting a rating → Verify validation error
2. Select rating: 5 stars, leave comment empty → Submit → Verify success (comment is optional)
3. For another booking: select rating: 1 star, enter comment exceeding 2000 characters → Verify validation error
4. Enter comment with exactly 2000 characters → Submit → Verify success
5. Verify rating only accepts integers 1–5 (no 0, no 6, no decimals)

**Expected Results**:

- ✅ Rating is required (integer 1–5)
- ✅ Comment is optional
- ✅ Comment max length is 2000 characters
- ✅ Validation errors are shown near relevant fields
- ✅ Error messages are clear and actionable

**Priority**: High
**Requirement Reference**: Requirements 5, 9

---

### Scenario 11: Aggregate Ratings — Profile Display

**User Story**: As a user, I want to see another user's aggregate rating and individual reviews on their profile.

**Preconditions**:

- A user has received multiple released reviews

**Test Steps**:

1. Navigate to a user's public profile who has released reviews
2. Verify aggregate rating is displayed (average of all released ratings, rounded to 1 decimal)
3. Verify total review count is displayed
4. Verify individual reviews are listed in paginated format, newest first
5. Verify each review shows: reviewer name, reviewer avatar, star rating, comment, date
6. Verify pagination works (if more than 10 reviews)
7. Verify a user with no reviews shows "No reviews yet" (not "0.0 stars")

**Expected Results**:

- ✅ Aggregate rating matches the average of released review ratings
- ✅ Review count is accurate
- ✅ Only released reviews are included in aggregates and display
- ✅ Pagination works correctly
- ✅ Null aggregate handled gracefully (no reviews yet)

**Priority**: High
**Requirement Reference**: Requirements 16

---

### Scenario 12: Aggregate Updates — Timing

**User Story**: As the system, aggregate ratings must only update at release time, not at submission time.

**Preconditions**:

- User B has an existing aggregate rating from prior reviews
- A new booking between User A and User B is completed

**Test Steps**:

1. Note User B's current aggregate rating and review count
2. **User A** submits a review for User B (rating: 2 stars)
3. Verify User B's aggregate rating and count have NOT changed (review not released)
4. **User B** submits a review for User A (rating: 5 stars)
5. Both reviews are released immediately
6. Verify User B's aggregate rating now includes the new 2-star review
7. Verify User B's review count incremented by 1
8. Verify User A's aggregate rating now includes the new 5-star review

**Expected Results**:

- ✅ Aggregate is unchanged after submission (before release)
- ✅ Aggregate updates immediately upon release
- ✅ Both reviewees' aggregates update when both reviews release simultaneously

**Priority**: High
**Requirement Reference**: Requirements 6, 16

---

### [x] Scenario 13: Booking Detail — Review Display

**User Story**: As a user viewing a past booking, I want to see reviews once they are released.

**Preconditions**:

- Completed booking with reviews in various states

**Test Steps**:

1. **Before any submission**: Navigate to booking detail → Verify "Leave a Review" CTA is shown → Verify no reviews section displayed
2. **After one submission (unreleased)**: The submitter sees "Review submitted — will be visible soon" → The other party sees "Leave a Review" CTA → Neither sees review content
3. **After release**: Navigate to booking detail → Verify reviews section shows all released reviews (1 or 2) → Verify each review card shows reviewer name, avatar, rating, comment, date
4. Verify user aggregate rating is displayed in the user card section of the booking detail

**Expected Results**:

- ✅ Booking detail page correctly transitions through review states
- ✅ Unreleased reviews never show content
- ✅ Released reviews display all expected fields
- ✅ Both parties' reviews visible after release

**Priority**: High
**Requirement Reference**: Requirements 14, 17

---

### [x] Scenario 14: Post-Release Notifications

**User Story**: As a user, I want to be notified when I receive a review.

**Preconditions**:

- Reviews are about to be released (either both-submit or cron expiry)

**Test Steps**:

1. **Both-submit release**: User A and User B both submit → Verify User A receives a "You received a review" notification → Verify User B receives a "You received a review" notification
2. Verify notification does NOT reveal review content (rating/comment)
3. Verify notification links to the booking detail page (or user profile)
4. **Cron release**: Only User A submitted, window expires → Verify User B (the reviewee) receives the notification → Verify User A does NOT receive a notification (no review was written about User A)

**Expected Results**:

- ✅ Notifications sent to reviewees at release time
- ✅ Notification content does not include review details
- ✅ Notification links to where the review is viewable
- ✅ Both parties notified in dual-release; only the reviewee notified in single-release

**Priority**: High
**Requirement Reference**: Requirement 15

---

### Scenario 15: Cron Endpoint — Security and Idempotency

**User Story**: As a platform operator, the cron endpoint must be secure and safe to run repeatedly.

**Preconditions**:

- Cron endpoint is deployed at `/api/cron/release-reviews`
- `CRON_SECRET` environment variable is configured

**Test Steps**:

1. Call `GET /api/cron/release-reviews` without auth header → Verify 401 response
2. Call with invalid bearer token → Verify 401 response
3. Call with correct `CRON_SECRET` bearer token → Verify 200 response with `{ eligible, released, failed }` counts
4. Call again immediately → Verify idempotent (released count is 0, no errors)
5. Create a scenario with expired unreleased reviews → Call cron → Verify reviews are released
6. Call cron again → Verify no duplicate releases (idempotent)

**Expected Results**:

- ✅ Endpoint requires valid `CRON_SECRET` bearer token
- ✅ Returns structured summary JSON
- ✅ Safe to run multiple times without side effects
- ✅ Correctly identifies and releases expired unreleased reviews

**Priority**: High
**Requirement Reference**: Requirement 13

---

### Scenario 16: Immutability — No Edit or Delete

**User Story**: As a user, once I submit a review it cannot be edited or deleted (MVP).

**Preconditions**:

- User has submitted a review

**Test Steps**:

1. After submitting a review, verify no "Edit" or "Delete" buttons are shown
2. Verify the API does not expose PUT/PATCH/DELETE endpoints for reviews
3. Attempt to call a hypothetical `PUT /api/reviews/:id` → Verify 404 or 405

**Expected Results**:

- ✅ No edit/delete UI exists
- ✅ No edit/delete API exists
- ✅ Reviews are permanently immutable after submission

**Priority**: Medium
**Requirement Reference**: Requirement 5 (AC 2)

---

### Scenario 17: Review Window Boundary

**User Story**: As the system, the 7-day window must be computed from booking completion, not submission time.

**Preconditions**:

- Booking completed at a known timestamp

**Test Steps**:

1. Verify `reviewWindowEndAt` equals `completedAt + 7 days` (not "7 days from now")
2. Submit a review on day 6 → Verify success
3. Attempt to submit on day 8 (after window) → Verify 400 error: "The review window for this booking has closed"
4. Verify the UI hides "Leave a Review" after the window expires (even before cron runs)

**Expected Results**:

- ✅ Window is calculated from booking completion timestamp
- ✅ Reviews accepted within the window
- ✅ Reviews rejected after window expiry
- ✅ UI reflects window state server-side

**Priority**: High
**Requirement Reference**: Requirement 4

---

### Scenario 18: Mobile Responsiveness

**User Story**: As a mobile user, I want the review functionality to work correctly on mobile devices.

**Preconditions**:

- User is on a mobile device or mobile browser view
- User has completed bookings

**Test Steps**:

1. Open app on mobile device
2. Navigate to a completed booking detail page
3. Verify "Leave a Review" CTA is visible and tappable
4. Tap "Leave a Review"
5. Verify review form/modal is properly sized for mobile
6. Select star rating using touch
7. Enter comment using mobile keyboard
8. Submit review
9. Verify success state displays correctly on mobile
10. Verify released reviews display correctly on mobile
11. Verify user profile reviews section is mobile-friendly

**Expected Results**:

- ✅ Review form/modal is mobile-responsive
- ✅ Star rating touch targets are appropriately sized (at least 44x44px)
- ✅ Comment textarea is usable on mobile
- ✅ All text is readable without zooming
- ✅ No UI elements are cut off or inaccessible

**Priority**: Medium
**Requirement Reference**: Requirement 14

---

### Scenario 19: Concurrent Submission Protection

**User Story**: As the system, I need to prevent duplicate reviews from rapid double-clicks or race conditions.

**Preconditions**:

- User has a completed booking eligible for review

**Test Steps**:

1. Open review form, fill out data
2. Click "Submit" multiple times rapidly
3. Verify submit button is disabled during submission (loading state)
4. Verify only one review is created in the database
5. Verify success message appears once
6. Attempt `POST /api/reviews` directly twice for the same booking → Verify second attempt returns 409

**Expected Results**:

- ✅ UI prevents double-submission via disabled button / loading state
- ✅ Database unique constraint prevents duplicate reviews at DB level
- ✅ Only one review record exists per user per booking

**Priority**: Medium
**Requirement Reference**: Requirements 2 (AC 3), 9, 12

---

### Scenario 20: API Response Shapes

**User Story**: As a developer, I want to verify the API returns correctly shaped responses.

**Preconditions**:

- Various review states exist in the system

**Test Steps**:

1. `GET /api/reviews?rentalId=X` (no released reviews) → Verify: `{ reviews: [], reviewStatus: { hasReviewed, canReview, reviewWindowEndAt } }`
2. `GET /api/reviews?rentalId=X` (with released reviews) → Verify each review includes: `id`, `rating`, `comment`, `submittedAt`, `releasedAt`, `reviewer: { id, name, avatarUrl }`
3. `GET /api/reviews?revieweeId=X` → Verify paginated response: `{ reviews: [...], aggregate: { averageRating, totalReviews }, pagination: { total, limit, offset } }`
4. `GET /api/reviews?serviceBookingId=X` → Verify same shape as rental query
5. `POST /api/reviews` (success) → Verify 201: `{ success: true, reviewId: string }`

**Expected Results**:

- ✅ All response shapes match the design specification
- ✅ Review status is included inline with booking queries
- ✅ Pagination metadata is included with reviewee queries
- ✅ Aggregate data is included with reviewee queries

**Priority**: High
**Requirement Reference**: Requirements 9, 10, 11

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test data is prepared:
  - Completed rentals (both recent and > 7 days old)
  - Completed service bookings (both recent and > 7 days old)
  - Active/pending bookings (for eligibility testing)
  - Users with existing released reviews (for aggregate testing)
- [ ] Test user accounts are created:
  - Rental borrowers and owners
  - Service clients and providers
  - A non-participant user (for authorization testing)
- [ ] CRON_SECRET is configured in environment
- [ ] Cron job is registered in GitHub Actions workflow
- [ ] Database migration has been run successfully

### Test Environment

- **Environment**: Staging/Production
- **Browsers**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Database**: PostgreSQL with `blind_reviews` table

### Test Execution

- [ ] Execute all Critical priority scenarios (1–6, 8, 9)
- [ ] Execute all High priority scenarios (10–15, 17, 20)
- [ ] Execute all Medium priority scenarios (7, 16, 18, 19)
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Log defects in issue tracker
- [ ] Re-test failed scenarios after fixes
- [ ] Cross-browser testing
- [ ] Mobile device testing

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all Critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Sign off on feature acceptance
- [ ] Verify old review system components are fully removed
- [ ] Confirm no data leaks in the blind mechanism

## Acceptance Criteria Summary

The Blind Review System SHALL be considered accepted when:

1. ✅ Both parties can independently submit reviews for rentals and service bookings
2. ✅ Reviews are invisible until both parties submit (immediate release) or the 7-day window expires (cron release)
3. ✅ No information about the other party's review status is leaked before release
4. ✅ Review eligibility is enforced: authentication, participation, completion, window, no duplicates
5. ✅ Self-review is prevented (revieweeId always derived server-side)
6. ✅ Aggregate ratings update only at release time, not submission time
7. ✅ Cron endpoint is secure, idempotent, and correctly releases expired reviews
8. ✅ Post-release notifications are sent to reviewees
9. ✅ Released reviews display correctly on booking detail pages and user profiles
10. ✅ Rating (1–5 integer) is required; comment is optional (max 2000 chars)
11. ✅ Reviews are immutable after submission (no edit/delete in MVP)
12. ✅ API response shapes match the design specification
13. ✅ Mobile experience is functional and responsive
14. ✅ Old review system is fully removed with no broken references

## Known Issues and Limitations

_To be filled during test execution_

## Test Sign-Off

- **Test Executor**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_\_
- **Business Stakeholder**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_\_
- **Product Owner**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_\_
- **Technical Lead**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_\_

---

**Document Version**: 2.0
**Last Updated**: 2026-04-21
**Next Review**: After test execution
