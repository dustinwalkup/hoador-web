# Implementation Notes - Blind Review System

## Summary

This feature replaces the existing dual-review system with a unified blind review mechanism. The core principle: reviews are invisible until both parties submit or the 7-day window expires. The implementation touches DB schema, DAL, service, API, cron, notifications, and UI layers.

---

## File Structure

```
src/
├── db/schemas/
│   └── blind-reviews.schema.ts          # NEW — table + relations + indexes
├── dal/
│   └── blind-review.dal.ts              # NEW — BlindReviewDAL class
├── features/reviews/
│   ├── constants.ts                     # NEW — REVIEW_WINDOW_DAYS = 7
│   ├── schemas/
│   │   └── blind-review-schema.ts       # NEW — Zod validation (replaces review-schema.ts)
│   ├── services/
│   │   └── blind-review-service.ts      # NEW — BlindReviewService (replaces review-service.ts)
│   ├── notifications/
│   │   └── blind-review-released.ts     # NEW — release notification (replaces review-received.ts)
│   └── components/
│       ├── review-status.tsx            # NEW — canReview/hasReviewed UI state
│       ├── review-submission-modal.tsx  # NEW — rating + comment form
│       ├── released-review-card.tsx     # NEW — single review display
│       └── user-reviews-section.tsx     # NEW — paginated profile section
├── app/api/
│   ├── reviews/
│   │   └── route.ts                     # REPLACE — unified POST + GET
│   └── cron/
│       └── release-reviews/
│           └── route.ts                 # NEW — hourly cron endpoint

Files to DELETE:
├── src/dal/review.dal.ts
├── src/dal/service-review.dal.ts
├── src/db/schemas/service-reviews.schema.ts
├── src/features/reviews/services/review-service.ts
├── src/features/reviews/schemas/review-schema.ts
├── src/features/reviews/notifications/review-received.ts
├── src/features/reviews/notifications/review-submitted.ts
├── src/features/reviews/components/leave-review-modal.tsx
├── src/features/rentals/components/detail-page/rental-reviews-card.tsx
├── src/features/services/services/service-review-service.ts
├── src/app/api/services/bookings/[id]/reviews/route.ts
```

---

## Critical Implementation Details

### 1. Release Check Must Be Atomic

When the second review is submitted, the release check (find counterpart → release both) must not have a race condition where both submissions think they're "first."

**Approach:** After inserting the new review, query for the counterpart in the same request. If found, release both. The partial unique index prevents true duplicates, so worst case is both submissions trigger the release — `releaseReviews()` must be idempotent (SET releasedAt = now() WHERE releasedAt IS NULL).

```typescript
// In submitReview(), after DAL.create():
const allReviews = await blindReviewDAL.findByBooking({
  rentalId,
  serviceBookingId,
});
if (allReviews.length === 2 && allReviews.every((r) => r.releasedAt === null)) {
  await blindReviewDAL.releaseReviews(allReviews.map((r) => r.id));
  // update aggregates + send notifications for both
}
```

### 2. RevieweeId Derivation — Never From Client

The `revieweeId` is ALWAYS derived server-side from the booking:

```typescript
// Rental:
const revieweeId =
  userId === rental.borrowerId ? rental.ownerId : rental.borrowerId;

// Service:
const revieweeId =
  userId === booking.requesterId ? booking.providerId : booking.requesterId;
```

Never accept `revieweeId` as an input parameter. The self-review check (`reviewerId !== revieweeId`) is a safeguard, not the primary defense.

### 3. Window Calculation from Booking Completion

The `reviewWindowEndAt` must be computed from the booking's completion timestamp, NOT from the current time:

```typescript
import { REVIEW_WINDOW_DAYS } from "../constants";

// Rental: completedAt comes from when rentalRequest.status → "completed"
// Service: completedAt is serviceBookings.completedAt

const reviewWindowEndAt = new Date(
  booking.completedAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
);
```

### 4. Aggregate Updates Only at Release Time

**Never** update `user.reviewAggregateRating` at submission time. Only when `releasedAt` transitions from null to a value:

- Immediate release (both submit): update aggregates for BOTH reviewees
- Cron release (window expiry): update aggregate for the single reviewee

The aggregate recalculation queries all released reviews for that user (not incremental) to avoid drift.

### 5. Cron Job — Batch and Group by Booking

The cron should:

1. Fetch batch of unreleased expired reviews (e.g., 100)
2. Group them by booking (rentalId or serviceBookingId)
3. For each booking group, release all reviews in that group together
4. This handles the edge case where both parties submitted but neither triggered the release (shouldn't happen, but defensive)

```typescript
const expired = await blindReviewDAL.findUnreleasedExpired(BATCH_SIZE);
const grouped = groupByBooking(expired);

for (const [bookingKey, reviews] of grouped) {
  await blindReviewDAL.releaseExpired(
    reviews.map((r) => r.id),
    reviews[0].reviewWindowEndAt, // Use window end as release timestamp
  );
  // Update aggregates and notify for each reviewee
}
```

### 6. Partial Unique Indexes (Not a Regular Unique Constraint)

Drizzle doesn't natively support `WHERE` clauses on unique indexes in all cases. You may need raw SQL in the migration:

```sql
CREATE UNIQUE INDEX blind_reviews_reviewer_rental_idx
  ON blind_reviews (reviewer_id, rental_id)
  WHERE rental_id IS NOT NULL;

CREATE UNIQUE INDEX blind_reviews_reviewer_service_booking_idx
  ON blind_reviews (reviewer_id, service_booking_id)
  WHERE service_booking_id IS NOT NULL;
```

Check Drizzle docs for `.where()` on `uniqueIndex()` — if unsupported, use `sql` in the migration file directly.

### 7. Check Constraint Syntax

PostgreSQL's `num_nonnulls()` is the cleanest way:

```sql
ALTER TABLE blind_reviews
  ADD CONSTRAINT booking_ref_check
  CHECK (num_nonnulls(rental_id, service_booking_id) = 1);
```

In Drizzle schema definition, use the `check()` helper with `sql` template literal.

### 8. Notification Type Reuse

The existing `notificationTypeEnum` already has `"review_received"`. Reuse this value for the blind review release notification — no enum migration needed. The notification content/template will be different (new file), but the type stays the same.

### 9. Old Table Removal — Check for Cascade Effects

Before dropping old tables, verify:

- No other tables have FK references to `reviews` or `serviceReviews`
- No views or triggers reference these tables
- The `reviewsRelations` and `serviceReviewsRelations` are removed from schema

### 10. User Table Columns — Null vs Zero

For new user columns:

- `reviewAggregateRating`: **nullable** (null = no reviews yet, distinct from 0.0)
- `reviewCount`: **default 0** (integer, never null)

UI should handle null aggregate gracefully (show "No reviews yet" rather than "0.0 stars").

---

## Naming Conventions

| Concept       | Convention      | Example                              |
| ------------- | --------------- | ------------------------------------ |
| Table         | snake_case      | `blind_reviews`                      |
| Schema file   | kebab-case      | `blind-reviews.schema.ts`            |
| DAL class     | PascalCase      | `BlindReviewDAL`                     |
| DAL instance  | camelCase       | `blindReviewDAL`                     |
| Service class | PascalCase      | `BlindReviewService`                 |
| API route     | kebab-case path | `/api/cron/release-reviews`          |
| Zod schema    | camelCase       | `createBlindReviewSchema`            |
| Constants     | UPPER_SNAKE     | `REVIEW_WINDOW_DAYS`                 |
| Components    | PascalCase      | `ReviewStatus`, `ReleasedReviewCard` |

---

## Error Handling Approach

Follow existing pattern — errors thrown from DAL/Service, caught and mapped in route handlers:

```typescript
// Route handler pattern:
try {
  const result = await BlindReviewService.submitReview(userId, parsed.data);
  return NextResponse.json(
    { success: true, reviewId: result.reviewId },
    { status: 201 },
  );
} catch (error) {
  return handleApiError(error);
}
```

Custom error messages for review-specific cases:

| Error            | Message                                                |
| ---------------- | ------------------------------------------------------ |
| Window expired   | "The review window for this booking has closed"        |
| Already reviewed | "You have already submitted a review for this booking" |
| Not completed    | "Reviews can only be submitted for completed bookings" |
| Not participant  | "You are not a participant in this booking"            |

---

## Order of Implementation

Recommended sequence to minimize broken state:

1. **Schema + migration** (task 1) — can run independently
2. **Constants** (task 5) — trivial, no dependencies
3. **DAL** (task 2) — depends on schema
4. **Validation schema** (task 3) — no dependencies
5. **Notifications** (task 6) — depends on existing notification infra only
6. **Service** (task 4) — depends on DAL + constants + notifications
7. **API routes** (task 7) — depends on service + validation
8. **Cron registration** (task 8) — depends on API route existing
9. **Remove old system** (task 9) — do AFTER new system is working
10. **UI components** (task 10) — depends on API routes being live
11. **Integration tests** (task 11) — alongside or after implementation

**Key principle:** Get the new system working end-to-end BEFORE removing the old one. This allows a brief overlap where both exist, making it easier to verify correctness.

---

## Gotchas & Known Challenges

1. **Rental completion is multi-step:** The rental doesn't have a simple `completedAt` field. Completion is tracked via `rentalRequests.status = "completed"` which happens after the 24-hour dispute window post-return. You'll need to derive `completedAt` — likely from the status transition timestamp or `returnConfirmedAt + 24 hours`.

2. **Service booking has explicit `completedAt`:** Much simpler — use it directly.

3. **Drizzle partial index support:** May need raw SQL in migration. Test the generated SQL before running.

4. **Notification preferences:** The "review_received" type maps to a notification category. Verify which category it falls under in `notification-type-map.ts` and ensure users can control email/push preferences for it.

5. **Old service review aggregate logic:** The current `ServiceReviewService.submitReview()` calls `updateProviderAggregateRating()` on the `serviceProviderProfiles` table. After migration, this is replaced by updating `user.reviewAggregateRating`. Make sure no other code reads from `serviceProviderProfiles.aggregateRating` without being updated.

6. **Existing imports:** After deleting old files, run a full build (`bun run build` or `tsc --noEmit`) to find all broken imports. There may be references in components, pages, or other services that import from the old review DAL/service.

7. **Review events table is unrelated:** `reviewEvents` (admin listing approval/rejection audit) has nothing to do with user reviews despite the naming. Do NOT delete it.
