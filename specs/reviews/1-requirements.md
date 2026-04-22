# Blind Review System - Requirements Document

## Introduction

This document specifies a full revamp of the review system for Hoador, replacing the existing rental and service review implementations with a unified, two-sided blind review system. The core principle is that reviews are hidden from the other party until both parties have submitted or the review window expires, eliminating bias and retaliation concerns.

The system applies to all completed transactions (rentals and services). Each completed booking creates two independent review opportunities—one for each party. This is an MVP implementation; editing, reminders, moderation, and dispute-aware suppression are explicitly out of scope.

**Key change from current system:** The existing implementation uses separate tables (`reviews` for rentals, `serviceReviews` for services) with immediate visibility and one-directional rental reviews (renter → owner only). This revamp unifies both under a single model with bidirectional reviews and a blind release mechanism.

---

## Resolved Design Decisions

The following decisions were made during requirements gathering:

1. **Review window duration:** 7 days from booking completion for both rentals and services.
2. **Unified table:** Single `reviews` table replacing both `reviews` (rentals) and `serviceReviews` (services). User-to-user reviews, not tied to listings.
3. **Migration:** Production has minimal/no review data. Old tables will be dropped and replaced with the new unified schema. No migration of existing data needed.
4. **Simplified rating:** Single `rating` (1–5) + `comment`. Sub-ratings (accuracy, condition, communication) are dropped for MVP.
5. **User-to-user only:** Reviews are about the other party, not about a listing. No listing association. User profile aggregates serve the same purpose as listing-page reviews since the owner's rating reflects their listing experience.
6. **Aggregate ratings update on release:** Aggregates only change when `releasedAt` is set, not at submission time.
7. **Polymorphic booking reference:** Two nullable FK columns (`rentalId`, `serviceBookingId`) with a check constraint ensuring exactly one is non-null. Provides DB-level referential integrity without over-abstraction.
8. **Unified API route:** `POST /api/reviews` and `GET /api/reviews` with query params for booking type/ID. Review status returned inline with booking responses.
9. **Background processing:** GitHub Actions hourly cron calling a Next.js API endpoint (`/api/cron/release-reviews`), following the existing cron pattern.
10. **Post-release notification:** Users receive a "You received a review" notification when reviews are released.
11. **Review display locations:** Reviews appear on the booking detail page AND on the user's public profile (paginated, with aggregate rating).
12. **Attributed reviews:** Reviewer identity (name, avatar) is visible after release.

---

## Requirements

### Requirement 1: Review Eligibility

**User Story:** As a participant in a completed booking, I want to be able to leave a review for the other party, so that I can share my experience and help the community make informed decisions.

#### Acceptance Criteria

1. WHEN a user attempts to submit a review THEN the system SHALL verify ALL of the following conditions:
   - The user is an authenticated participant in the booking (either party)
   - The booking status is `completed`
   - The user has not already submitted a review for that booking
   - The review window has not expired (`now() <= reviewWindowEndAt`)
2. IF any eligibility condition is not met THEN the system SHALL reject the submission with an appropriate error indicating which condition failed
3. WHERE a booking has not reached `completed` status THEN the system SHALL NOT allow review submission regardless of other conditions
4. WHEN checking participation THEN the system SHALL verify:
   - For rentals: user is either the borrower or the owner
   - For services: user is either the client or the provider

### Requirement 2: Review Directionality

**User Story:** As a user, I want to review the other party in a transaction independently, so that both sides of the experience are captured fairly.

#### Acceptance Criteria

1. WHEN a booking reaches `completed` status THEN the system SHALL create two independent review opportunities:
   - Party A reviewing Party B
   - Party B reviewing Party A
2. The system SHALL support the following transaction types:
   - Rentals: borrower ↔ owner
   - Services: client ↔ provider
3. Each user SHALL be permitted exactly one review submission per booking (enforced by unique constraint on `reviewerId` + `bookingId`)
4. The two review opportunities SHALL be completely independent—neither party's ability to review depends on the other party's actions

### Requirement 3: Self-Review Prevention

**User Story:** As the system, I need to prevent users from reviewing themselves, so that the review system maintains integrity.

#### Acceptance Criteria

1. WHEN a review is submitted THEN the system SHALL validate that `reviewerId !== revieweeId`
2. IF a self-review is attempted THEN the system SHALL reject the request with an appropriate error message
3. The system SHALL derive the `revieweeId` automatically from the booking participants (the other party), rather than accepting it as user input
4. The system SHALL NOT rely solely on client-side validation for this constraint

### Requirement 4: Review Window

**User Story:** As a platform operator, I want reviews to be constrained to a time window after booking completion, so that reviews remain relevant and timely.

#### Acceptance Criteria

1. WHEN a booking transitions to `completed` status THEN the system SHALL calculate and store `reviewWindowEndAt = completedAt + 7 days`
2. The review window duration is 7 days for both rentals and services
3. WHILE `now() <= reviewWindowEndAt` THEN the system SHALL allow review submission for eligible users
4. WHEN `now() > reviewWindowEndAt` THEN the system SHALL reject new review submissions for that booking
5. The `reviewWindowEndAt` SHALL be stored on the review record for use in release logic
6. WHEN the review window has expired THEN the UI SHALL hide the "Leave a Review" button (server-side validation remains as a safeguard)

### Requirement 5: Review Submission

**User Story:** As a booking participant, I want to submit a review with a rating and optional comment, so that I can share my experience.

#### Acceptance Criteria

1. WHEN a user submits a review THEN the system SHALL persist the review with:
   - `submittedAt = now()`
   - `releasedAt = null` (not yet visible)
   - `rating` (integer, 1–5)
   - `comment` (text, optional)
   - `reviewerId` (authenticated user)
   - `revieweeId` (derived from booking—the other party)
   - `bookingId` / booking reference
   - `reviewWindowEndAt`
2. AFTER a review is submitted THEN the system SHALL NOT allow the user to edit, delete, or resubmit
3. WHEN a review is submitted THEN the system SHALL immediately trigger release check logic (see Requirement 6)

### Requirement 6: Review Release Logic (Blind Mechanism)

**User Story:** As a user, I want reviews to be released fairly so that neither party can see the other's review until both have submitted or time runs out, preventing retaliation.

#### Acceptance Criteria

1. **Case 1 — Both parties submit before window ends:**
   WHEN both reviews for a booking exist THEN the system SHALL immediately set `releasedAt = now()` on BOTH reviews
2. **Case 2 — Only one party submits before window ends:**
   WHEN `reviewWindowEndAt` is reached AND only one review exists THEN the system SHALL set `releasedAt = reviewWindowEndAt` on the submitted review
3. **Case 3 — No submissions:**
   WHEN `reviewWindowEndAt` is reached AND no reviews exist THEN no action is required
4. The release logic for Case 1 SHALL execute synchronously as part of the submission request (when the second review is submitted)
5. The release logic for Case 2 SHALL execute via a background process (cron job, scheduled function, or queue worker) that runs at or shortly after `reviewWindowEndAt`
6. WHEN a review is released THEN the system SHALL update any aggregate ratings (e.g., provider profile ratings) at that time, not at submission time

### Requirement 7: Review Visibility

**User Story:** As a user, I want to see reviews only after they are released, so that the blind review system is not compromised.

#### Acceptance Criteria

1. The system SHALL NOT return review content (rating, comment, reviewer identity) for any review where `releasedAt IS NULL`
2. The system SHALL NOT return review content for any review where `releasedAt > now()` (future-dated release)
3. WHEN reviews are released THEN the system SHALL return:
   - Both reviews if both parties submitted
   - Only the single submitted review if only one party submitted
4. The system SHALL NOT expose whether the other party has submitted a review before release
5. WHERE a user queries their own review before release THEN the system SHALL confirm submission status without revealing the other party's status

### Requirement 8: Review Status for UI

**User Story:** As a user viewing a completed booking, I want to know my review status so the UI can guide me appropriately.

#### Acceptance Criteria

1. The system SHALL provide the following status fields for the current user on a booking:
   - `hasReviewed` (boolean): whether the current user has submitted a review
   - `canReview` (boolean): whether the current user is eligible to submit (booking completed, within window, hasn't already reviewed)
   - `reviewWindowEndAt` (timestamp): when the window closes
2. The status SHALL NOT include:
   - Whether the other party has reviewed
   - The other party's rating or comment
   - Any indication of the other party's review status
3. This status MAY be returned inline with the booking response or via a dedicated endpoint

### Requirement 9: API - Create Review (`POST /api/reviews`)

**User Story:** As a developer integrating with the review system, I want a clear API for creating reviews with proper validation.

#### Acceptance Criteria

1. The system SHALL expose `POST /api/reviews` for creating reviews
2. WHEN a POST request is received THEN the system SHALL validate:
   - User is authenticated
   - User is a participant in the referenced booking
   - Booking status is `completed`
   - User has not already submitted a review for this booking
   - Review window has not expired
   - `reviewerId !== revieweeId` (enforced server-side)
   - Rating is an integer between 1 and 5 (inclusive)
3. WHEN validation passes THEN the system SHALL:
   - Create the review with `releasedAt = null`
   - Execute release check logic (if both reviews now exist, release both)
   - Return success with the review ID
4. WHEN validation fails THEN the system SHALL return an appropriate HTTP error status with a descriptive error message

### Requirement 10: API - Get Reviews (`GET /api/reviews`)

**User Story:** As a developer, I want to fetch released reviews for a booking or user to display them in the UI.

#### Acceptance Criteria

1. The system SHALL expose `GET /api/reviews` with the following query parameters:
   - `rentalId` — fetch reviews for a rental booking
   - `serviceBookingId` — fetch reviews for a service booking
   - `revieweeId` — fetch all released reviews for a user (profile display, paginated)
2. WHEN querying by booking AND reviews are not yet released THEN the system SHALL return an empty array
3. WHEN querying by booking AND reviews are released THEN the system SHALL return all released reviews (1 or 2)
4. WHEN querying by revieweeId THEN the system SHALL return only released reviews, paginated, with aggregate summary
5. Each returned review SHALL include: reviewer name, reviewer avatar, rating, comment, submittedAt, releasedAt
6. The endpoint SHALL require authentication

### Requirement 11: API - Review Status

**User Story:** As a developer, I want to query the current user's review status for a booking to drive UI state.

#### Acceptance Criteria

1. The system SHALL provide review status (either inline with booking or dedicated endpoint) containing:
   - `hasReviewed`: boolean
   - `canReview`: boolean
   - `reviewWindowEndAt`: ISO timestamp
2. The system SHALL compute `canReview` based on: booking is completed AND user is participant AND user has not reviewed AND window has not expired
3. The response SHALL NOT leak information about the other party's review status

### Requirement 12: Data Model

**User Story:** As a developer, I need a clear data model that supports the blind review mechanism efficiently.

#### Acceptance Criteria

1. Each review record SHALL contain at minimum:
   - `id` (UUID, primary key)
   - `rentalId` (UUID, FK to rentals, nullable)
   - `serviceBookingId` (UUID, FK to serviceBookings, nullable)
   - `reviewerId` (text, FK to user)
   - `revieweeId` (text, FK to user)
   - `rating` (integer, 1–5)
   - `comment` (text, nullable)
   - `submittedAt` (timestamp, NOT NULL)
   - `releasedAt` (timestamp, nullable — null means not yet visible)
   - `reviewWindowEndAt` (timestamp, NOT NULL)
2. The system SHALL enforce a check constraint: exactly one of `rentalId` or `serviceBookingId` must be non-null
3. The system SHALL enforce a unique constraint on (`reviewerId`, `rentalId`) WHERE `rentalId` IS NOT NULL
4. The system SHALL enforce a unique constraint on (`reviewerId`, `serviceBookingId`) WHERE `serviceBookingId` IS NOT NULL
5. The system SHALL index on:
   - `rentalId` (for fetching both reviews for a rental)
   - `serviceBookingId` (for fetching both reviews for a service booking)
   - `revieweeId` (for fetching all reviews received by a user — profile display)
   - `releasedAt` (for filtering visible reviews)
   - `reviewWindowEndAt` WHERE `releasedAt IS NULL` (partial index for the background release job)

### Requirement 13: Background Release Processing (`/api/cron/release-reviews`)

**User Story:** As a platform operator, I want reviews to be automatically released when the window expires, without manual intervention.

#### Acceptance Criteria

1. The system SHALL expose a cron endpoint at `/api/cron/release-reviews` secured by `CRON_SECRET` bearer token
2. The endpoint SHALL be called hourly via the existing GitHub Actions cron workflow
3. The endpoint SHALL identify reviews where:
   - `releasedAt IS NULL`
   - `reviewWindowEndAt <= now()`
4. WHEN such reviews are found THEN the system SHALL set `releasedAt = reviewWindowEndAt`
5. The background process SHALL be idempotent (safe to run multiple times without side effects)
6. WHEN a review is released by the background process THEN the system SHALL:
   - Trigger aggregate rating updates for the reviewee
   - Send a "You received a review" notification to the reviewee

### Requirement 14: UI Expectations (Minimal)

**User Story:** As a user, I want clear messaging about the blind review process so I understand when my review will be visible.

#### Acceptance Criteria

1. WHILE a user has not yet submitted a review AND `canReview` is true THEN the UI SHALL display messaging indicating:
   - They can leave a review
   - The review will be shared after both parties submit OR the window expires
2. AFTER a user submits a review THEN the UI SHALL display:
   - Confirmation that the review was submitted
   - Messaging that it will be visible soon (without revealing the other party's status)
3. The UI SHALL NOT display:
   - Whether the other party has submitted
   - The other party's review content before release
   - Any countdown or indicator that would reveal the other party's action

### Requirement 15: Post-Release Notification

**User Story:** As a user, I want to be notified when I receive a review, so that I can see what the other party said about me.

#### Acceptance Criteria

1. WHEN a review is released (either via both-submitted immediate release OR background window expiry) THEN the system SHALL send a notification to the reviewee
2. The notification SHALL indicate that the user received a review without revealing content (user must navigate to view it)
3. The notification SHALL link to the booking detail page or user profile where the review is visible
4. IF both reviews are released simultaneously THEN each party SHALL receive a notification about the review they received

### Requirement 16: User Profile Review Display

**User Story:** As a user, I want to see reviews on another user's profile, so that I can assess their trustworthiness before transacting with them.

#### Acceptance Criteria

1. The system SHALL display released reviews on a user's public profile page
2. The profile SHALL show an aggregate rating (average of all released review ratings for that user)
3. The profile SHALL show a total review count
4. The profile SHALL display individual reviews in a paginated list, ordered by most recent first
5. Each displayed review SHALL include: reviewer name, reviewer avatar, rating, comment, and date
6. The system SHALL only include reviews where `releasedAt IS NOT NULL AND releasedAt <= now()` in profile aggregates and display
7. The system SHALL expose a GET endpoint for fetching a user's reviews (paginated): `GET /api/reviews?revieweeId=X`

### Requirement 17: Booking Detail Review Display

**User Story:** As a user viewing a past booking, I want to see reviews associated with that booking once they are released.

#### Acceptance Criteria

1. The booking detail page SHALL display released reviews for that booking (0, 1, or 2 reviews)
2. WHILE reviews are unreleased THEN the booking detail page SHALL show the review status (Requirement 8) instead of review content
3. The review display on the booking page SHALL show both parties' reviews once released

---

## Explicit Non-Goals (MVP)

The following are intentionally excluded from this implementation:

- Review reminders or notifications prompting users to review
- Editing or deleting reviews after submission
- Dispute-based review suppression or moderation
- Partial visibility, early hints, or "review received" indicators
- Rating weighting, ranking algorithms, or trust scoring
- Moderation workflows (flagging, admin removal)
- Review categories (tool condition vs. user behavior)
- Household/shared account review restrictions
- Nudges or gamification to increase completion rate
- Public vs. private feedback split

---

## Future Extensions (Documented for Context)

These are anticipated future enhancements and are recorded here to ensure the MVP design does not preclude them:

- Review categories (separate tool/listing review from user review)
- Household review restrictions (prevent reviews between shared accounts)
- Dispute-aware review logic (suppress or flag reviews during active disputes)
- Nudges/reminders to increase review completion rate
- Review editing window (brief window after submission, before release)
- Public vs. private feedback (private feedback visible only to the reviewee)
- Review responses (reviewee can respond publicly to a review)
- Moderation and content policy enforcement
- Rating decay or recency weighting for aggregate scores
