# Blind Review System - Design Document

## Overview

This design replaces the existing dual-review system (`reviews` + `serviceReviews` tables) with a single unified `blindReviews` table that supports bidirectional, time-windowed blind reviews for both rental and service bookings.

The core mechanism: reviews are submitted with `releasedAt = null` and only become visible when both parties submit (immediate release) or the 7-day window expires (cron release). Aggregate ratings update only at release time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│                                                                 │
│  POST /api/reviews          GET /api/reviews                    │
│  (create + release check)   (by booking or reviewee)            │
│                                                                 │
│  GET /api/cron/release-reviews                                  │
│  (hourly background release)                                    │
├─────────────────────────────────────────────────────────────────┤
│                       Service Layer                              │
│                                                                 │
│  BlindReviewService (static)                                    │
│  ├── submitReview()          → validate, create, release check  │
│  ├── getBookingReviews()     → released reviews for a booking   │
│  ├── getReviewStatus()       → canReview, hasReviewed, window   │
│  ├── getUserReviews()        → paginated profile reviews        │
│  └── releaseExpiredReviews() → cron batch release               │
├─────────────────────────────────────────────────────────────────┤
│                         DAL Layer                                │
│                                                                 │
│  BlindReviewDAL extends BaseDAL                                 │
│  ├── create()                                                   │
│  ├── findByBooking()                                            │
│  ├── findByReviewee()                                           │
│  ├── findByReviewerAndBooking()                                 │
│  ├── releaseReviews()                                           │
│  ├── findUnreleasedExpired()                                    │
│  └── getAggregate()                                             │
├─────────────────────────────────────────────────────────────────┤
│                       Database Layer                             │
│                                                                 │
│  blind_reviews table                                            │
│  ├── Two nullable FKs: rentalId, serviceBookingId               │
│  ├── CHECK(num_nonnulls(rental_id, service_booking_id) = 1)     │
│  ├── Partial unique indexes per booking type                    │
│  └── Partial index on reviewWindowEndAt WHERE releasedAt IS NULL│
└─────────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### 1. Database Schema (`src/db/schemas/blind-reviews.schema.ts`)

New file. The old `reviews` table (in `rentals.schema.ts`) and `serviceReviews` table will be dropped in a migration.

```typescript
// Schema definition (Drizzle ORM)
export const blindReviews = pgTable(
  "blind_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rentalId: uuid("rental_id").references(() => rentals.id),
    serviceBookingId: uuid("service_booking_id").references(
      () => serviceBookings.id,
    ),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id),
    revieweeId: text("reviewee_id")
      .notNull()
      .references(() => user.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    reviewWindowEndAt: timestamp("review_window_end_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    // Check constraint: exactly one booking FK is non-null
    check(
      "booking_ref_check",
      sql`num_nonnulls(${table.rentalId}, ${table.serviceBookingId}) = 1`,
    ),

    // Partial unique indexes (one review per user per booking)
    uniqueIndex("blind_reviews_reviewer_rental_idx")
      .on(table.reviewerId, table.rentalId)
      .where(sql`${table.rentalId} IS NOT NULL`),
    uniqueIndex("blind_reviews_reviewer_service_booking_idx")
      .on(table.reviewerId, table.serviceBookingId)
      .where(sql`${table.serviceBookingId} IS NOT NULL`),

    // Query indexes
    index("blind_reviews_rental_id_idx").on(table.rentalId),
    index("blind_reviews_service_booking_id_idx").on(table.serviceBookingId),
    index("blind_reviews_reviewee_id_idx").on(table.revieweeId),
    index("blind_reviews_released_at_idx").on(table.releasedAt),

    // Partial index for cron job: unreleased + expired window
    index("blind_reviews_pending_release_idx")
      .on(table.reviewWindowEndAt)
      .where(sql`${table.releasedAt} IS NULL`),
  ],
);
```

**Relations:**

```typescript
export const blindReviewsRelations = relations(blindReviews, ({ one }) => ({
  rental: one(rentals, {
    fields: [blindReviews.rentalId],
    references: [rentals.id],
  }),
  serviceBooking: one(serviceBookings, {
    fields: [blindReviews.serviceBookingId],
    references: [serviceBookings.id],
  }),
  reviewer: one(user, {
    fields: [blindReviews.reviewerId],
    references: [user.id],
    relationName: "blindReviewsAsReviewer",
  }),
  reviewee: one(user, {
    fields: [blindReviews.revieweeId],
    references: [user.id],
    relationName: "blindReviewsAsReviewee",
  }),
}));
```

### 2. DAL (`src/dal/blind-review.dal.ts`)

```typescript
export class BlindReviewDAL extends BaseDAL {
  async create(data: {
    rentalId?: string;
    serviceBookingId?: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment?: string | null;
    reviewWindowEndAt: Date;
  }): Promise<BlindReview>;
  // Inserts review with releasedAt = null
  // Throws ConflictError on duplicate (unique index violation)

  async findByBooking(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<BlindReview[]>;
  // Returns 0-2 reviews for a booking (regardless of release status — service layer filters)

  async findReleasedByBooking(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<BlindReviewWithReviewer[]>;
  // Returns released reviews with reviewer display info (name, avatar)
  // WHERE releasedAt IS NOT NULL AND releasedAt <= now()

  async findByReviewerAndBooking(
    reviewerId: string,
    params: { rentalId?: string; serviceBookingId?: string },
  ): Promise<BlindReview | null>;
  // For duplicate check and status queries

  async findReleasedByReviewee(
    revieweeId: string,
    options: { limit: number; offset: number },
  ): Promise<PaginatedResult<BlindReviewWithReviewer>>;
  // For profile display — only released reviews, paginated, newest first

  async getAggregate(
    revieweeId: string,
  ): Promise<{ averageRating: number; totalReviews: number }>;
  // AVG(rating) and COUNT(*) WHERE revieweeId AND releasedAt IS NOT NULL

  async releaseReviews(reviewIds: string[]): Promise<void>;
  // SET releasedAt = now() WHERE id IN (reviewIds) AND releasedAt IS NULL

  async findUnreleasedExpired(limit: number): Promise<BlindReview[]>;
  // WHERE releasedAt IS NULL AND reviewWindowEndAt <= now()
  // Uses partial index for efficient lookup
  // LIMIT for batch processing

  async releaseExpired(reviewIds: string[], releaseAt: Date): Promise<void>;
  // SET releasedAt = releaseAt WHERE id IN (reviewIds)
  // Used by cron — sets releasedAt to reviewWindowEndAt value
}
```

### 3. Service Layer (`src/features/reviews/services/blind-review-service.ts`)

```typescript
export class BlindReviewService {
  static async submitReview(params: {
    userId: string;
    rentalId?: string;
    serviceBookingId?: string;
    rating: number;
    comment?: string;
  }): Promise<{ reviewId: string }>;
  // 1. Resolve booking → validate exists, status completed, user is participant
  // 2. Derive revieweeId (other party)
  // 3. Validate reviewerId !== revieweeId
  // 4. Compute reviewWindowEndAt from booking completion + 7 days
  // 5. Validate window not expired
  // 6. Create review via DAL (ConflictError = already reviewed)
  // 7. Release check: query other review for same booking
  //    - If exists → releaseReviews([thisReview.id, otherReview.id])
  //      → update aggregates for both reviewees
  //      → send notifications to both reviewees
  // 8. Return { reviewId }

  static async getBookingReviews(params: {
    rentalId?: string;
    serviceBookingId?: string;
  }): Promise<BlindReviewWithReviewer[]>;
  // Returns released reviews only (DAL.findReleasedByBooking)

  static async getReviewStatus(
    userId: string,
    params: {
      rentalId?: string;
      serviceBookingId?: string;
    },
  ): Promise<{
    hasReviewed: boolean;
    canReview: boolean;
    reviewWindowEndAt: string | null;
  }>;
  // Checks: booking exists, completed, user is participant
  // hasReviewed: does review exist for this user + booking
  // canReview: completed AND within window AND !hasReviewed
  // reviewWindowEndAt: completedAt + 7 days (from booking)

  static async getUserReviews(
    revieweeId: string,
    options: {
      limit: number;
      offset: number;
    },
  ): Promise<{
    reviews: BlindReviewWithReviewer[];
    aggregate: Aggregate;
    pagination: PaginationMeta;
  }>;
  // For profile display

  static async releaseExpiredReviews(
    batchSize?: number,
  ): Promise<ReleaseSummary>;
  // Called by cron endpoint
  // 1. Find unreleased expired reviews (batch)
  // 2. Group by booking
  // 3. For each booking group: set releasedAt = reviewWindowEndAt
  // 4. Update aggregates for each reviewee
  // 5. Send notifications to each reviewee
  // 6. Return { eligible, released, failed }
}
```

### 4. API Routes

#### `POST /api/reviews` — Submit a review

**File:** `src/app/api/reviews/route.ts` (replaces existing)

```
Request:
  {
    rentalId?: string (uuid),
    serviceBookingId?: string (uuid),
    rating: number (1-5),
    comment?: string (max 2000)
  }

Response 201:
  { success: true, reviewId: string }

Errors:
  400 - Validation failed / window expired / booking not completed
  401 - Not authenticated
  403 - Not a participant in this booking
  404 - Booking not found
  409 - Already submitted a review for this booking
```

#### `GET /api/reviews` — Fetch reviews

**File:** `src/app/api/reviews/route.ts`

```
Query params (one required):
  rentalId — reviews for a rental
  serviceBookingId — reviews for a service booking
  revieweeId — all released reviews for a user (paginated)

  (pagination for revieweeId):
  limit (default 10, max 50)
  offset (default 0)

Response 200 (booking query):
  { reviews: [...], reviewStatus: { hasReviewed, canReview, reviewWindowEndAt } }

Response 200 (reviewee query):
  { reviews: [...], aggregate: { averageRating, totalReviews }, pagination: { total, limit, offset } }
```

#### `GET /api/cron/release-reviews` — Background release

**File:** `src/app/api/cron/release-reviews/route.ts`

```
Auth: Bearer CRON_SECRET
Response 200:
  { eligible: number, released: number, failed: number }
```

### 5. Validation Schema (`src/features/reviews/schemas/blind-review-schema.ts`)

```typescript
export const createBlindReviewSchema = z
  .object({
    rentalId: z.string().uuid().optional(),
    serviceBookingId: z.string().uuid().optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      (data.rentalId || data.serviceBookingId) &&
      !(data.rentalId && data.serviceBookingId),
    { message: "Exactly one of rentalId or serviceBookingId is required" },
  );

export type CreateBlindReviewInput = z.infer<typeof createBlindReviewSchema>;
```

### 6. Notification (`src/features/reviews/notifications/blind-review-released.ts`)

```typescript
export async function sendReviewReleasedNotification(params: {
  revieweeId: string;
  revieweeName: string;
  reviewerName: string;
  rating: number;
  bookingType: "rental" | "service";
  bookingId: string;
}): Promise<void>;
// Uses sendNotification() with type "review_received"
// Links to booking detail page
// Email includes star rating + reviewer name
// Does NOT include comment in notification (user must view in-app)
```

---

## Data Models

### BlindReview (Database Record)

| Field             | Type        | Nullable | Notes                   |
| ----------------- | ----------- | -------- | ----------------------- |
| id                | uuid        | NO       | PK, auto-generated      |
| rentalId          | uuid        | YES      | FK → rentals.id         |
| serviceBookingId  | uuid        | YES      | FK → serviceBookings.id |
| reviewerId        | text        | NO       | FK → user.id            |
| revieweeId        | text        | NO       | FK → user.id            |
| rating            | integer     | NO       | 1–5                     |
| comment           | text        | YES      | Free text, max 2000     |
| submittedAt       | timestamptz | NO       | Set on creation         |
| releasedAt        | timestamptz | YES      | null = not visible      |
| reviewWindowEndAt | timestamptz | NO       | completedAt + 7 days    |

**Constraints:**

- `CHECK(num_nonnulls(rental_id, service_booking_id) = 1)`
- `UNIQUE(reviewer_id, rental_id) WHERE rental_id IS NOT NULL`
- `UNIQUE(reviewer_id, service_booking_id) WHERE service_booking_id IS NOT NULL`

### BlindReviewWithReviewer (API Response Shape)

```typescript
interface BlindReviewWithReviewer {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: string; // ISO
  releasedAt: string; // ISO (always present in responses — unreleased never returned)
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
```

### ReviewStatus (Inline with Booking)

```typescript
interface ReviewStatus {
  hasReviewed: boolean;
  canReview: boolean;
  reviewWindowEndAt: string | null; // ISO timestamp, null if booking not completed
}
```

### Aggregate (Profile)

```typescript
interface ReviewAggregate {
  averageRating: number; // Decimal, rounded to 1 place
  totalReviews: number;
}
```

---

## Error Handling

Follows existing `DALError` hierarchy and `handleApiError()` mapping:

| Scenario              | Error                   | HTTP Status |
| --------------------- | ----------------------- | ----------- |
| Booking not found     | `NotFoundError`         | 404         |
| User not participant  | `ForbiddenError`        | 403         |
| Booking not completed | `ValidationError`       | 400         |
| Window expired        | `ValidationError`       | 400         |
| Already reviewed      | `ConflictError`         | 409         |
| Self-review attempted | `ValidationError`       | 400         |
| Invalid rating        | `ValidationError` (Zod) | 400         |

---

## Release Flow Diagrams

### Case 1: Both Parties Submit

```
User A submits review
  → review A created (releasedAt = null)
  → release check: review B exists? NO
  → response: { reviewId: A }

User B submits review
  → review B created (releasedAt = null)
  → release check: review A exists? YES
  → SET releasedAt = now() on BOTH reviews
  → update aggregate for User A (as reviewee)
  → update aggregate for User B (as reviewee)
  → notify User A: "You received a review"
  → notify User B: "You received a review"
  → response: { reviewId: B }
```

### Case 2: Window Expires with One Review

```
User A submits review at Day 2
  → review A created (releasedAt = null)
  → release check: review B exists? NO
  → response: { reviewId: A }

Day 7: Cron runs /api/cron/release-reviews
  → finds review A: releasedAt IS NULL AND reviewWindowEndAt <= now()
  → SET releasedAt = reviewWindowEndAt
  → update aggregate for reviewee (User B)
  → notify User B: "You received a review"
```

---

## Aggregate Rating Storage & Display

### Cached Aggregate

Rather than computing `AVG(rating)` on every page load, we store a cached aggregate that updates at release time. This extends the existing `serviceProviderProfiles.aggregateRating` pattern to cover all users (not just service providers).

**New columns on `user` table** (or a new `user_review_summary` table — preference for user table if feasible):

| Field                   | Type         | Notes                                           |
| ----------------------- | ------------ | ----------------------------------------------- |
| `reviewAggregateRating` | numeric(3,2) | Average of all released review ratings received |
| `reviewCount`           | integer      | Count of released reviews received              |

**Update trigger:** Whenever `releasedAt` is set (either via immediate both-submit release or cron expiry), recalculate and persist the aggregate for the reviewee.

```typescript
// In BlindReviewService, called after any release:
static async updateUserAggregate(revieweeId: string): Promise<void>
// 1. SELECT AVG(rating), COUNT(*) FROM blind_reviews
//    WHERE reviewee_id = ? AND released_at IS NOT NULL
// 2. UPDATE user SET review_aggregate_rating = avg, review_count = count
//    WHERE id = ?
```

### Caching Strategy

The aggregate rating is one of the most frequently read values in the app (listing cards, search results, user profiles, booking details, etc.). It must be heavily cached at multiple layers:

**Layer 1 — Database denormalization (write-time cache):**

- `user.reviewAggregateRating` and `user.reviewCount` are updated ONLY at release time
- Reads are a simple column fetch, not a computed `AVG()` — O(1) regardless of review count
- Already included in any query that loads user data (no extra join or subquery)

**Layer 2 — Application-level caching (React Query / SWR):**

- User data (including aggregate) cached with a long `staleTime` (e.g., 5+ minutes)
- The aggregate changes at most once per review release — extremely low write frequency
- Listing pages, search results, and booking details all reference the same cached user data
- Invalidation: only when the current user receives a new review (triggered by notification or booking detail refetch)

**Layer 3 — Next.js data cache / ISR (for public pages):**

- Public profile pages and listing pages can use `revalidate` with generous TTL (60–300s)
- The aggregate is stale-safe: a 5-minute delay in reflecting a new review is perfectly acceptable

**What we avoid:**

- ❌ Never run `SELECT AVG(rating) FROM blind_reviews WHERE reviewee_id = ?` on page loads
- ❌ Never join blind_reviews table just to display a star rating
- ❌ Never recompute aggregates on read paths
- ✅ Always read from user column (single row, already fetched)
- ✅ Only recompute on release events (max 2x per booking lifecycle)

### Display Consumption Points

| Location                                     | Data Needed                                | Source                                                                            |
| -------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| **User profile page**                        | Aggregate + paginated individual reviews   | `user.reviewAggregateRating` + `GET /api/reviews?revieweeId=X`                    |
| **Rental detail — user card**                | Aggregate for the other party              | `user.reviewAggregateRating` + `user.reviewCount` (already loaded with user data) |
| **Rental detail — reviews section**          | Released reviews for that specific booking | `GET /api/reviews?rentalId=X` (returns 0, 1, or 2 reviews)                        |
| **Service booking detail — user card**       | Aggregate for the other party              | `user.reviewAggregateRating` + `user.reviewCount`                                 |
| **Service booking detail — reviews section** | Released reviews for that booking          | `GET /api/reviews?serviceBookingId=X`                                             |
| **Listing cards / search results**           | Owner's aggregate (trust signal)           | `user.reviewAggregateRating` (joined via listing → owner)                         |

### Transition from `serviceProviderProfiles`

The existing `serviceProviderProfiles.aggregateRating` becomes redundant once the unified aggregate is in place. During migration:

1. Add `reviewAggregateRating` and `reviewCount` to the user table
2. Initialize both to `0` / `null` (no existing data to backfill)
3. After blind review system is live, deprecate reads from `serviceProviderProfiles.aggregateRating`
4. Eventually remove the aggregate fields from `serviceProviderProfiles` (keep table for bio/profile data)

### Individual Review Display on Booking Detail

The booking detail page shows reviews in context:

- **Before release:** Show `ReviewStatus` component (canReview / hasReviewed / window info)
- **After release:** Show 1 or 2 review cards with reviewer name, avatar, star rating, comment, and date
- Reviews are fetched as part of the booking detail query or via a client-side fetch to `GET /api/reviews?rentalId=X`

---

## Migration Strategy

Since production has minimal/no review data:

1. Create new `blind_reviews` table with schema above
2. Drop old `reviews` table (currently in `rentals.schema.ts`)
3. Drop old `serviceReviews` table
4. Remove old DALs (`review.dal.ts`, `service-review.dal.ts`)
5. Remove old services (`review-service.ts`, `service-review-service.ts`)
6. Remove old API routes and replace with unified routes
7. Update schema index (`src/db/schemas/index.ts`) to include new schema
8. Remove `review_received` and `review_submitted` from notification type enum only if unused elsewhere; otherwise keep and reuse
9. Update `serviceProviderProfiles` aggregate update logic to use new release-time trigger

**Note:** The `reviewEvents` table (admin listing approval/rejection audit trail) is unrelated to user reviews and should be kept as-is.

---

## Testing Strategy

- **Unit tests:** BlindReviewDAL methods (create, find, release), BlindReviewService validation logic
- **Integration tests:** Full submission flow (both-submit release, single-submit + cron release), duplicate prevention, window expiry
- **API tests:** Route validation, auth checks, response shapes, error codes
- **Edge cases:** Simultaneous submissions (race condition on release), cron idempotency, window boundary (submit at exact expiry)

---

## Configuration

| Constant             | Value  | Location                            |
| -------------------- | ------ | ----------------------------------- |
| `REVIEW_WINDOW_DAYS` | 7      | `src/features/reviews/constants.ts` |
| Cron frequency       | Hourly | `.github/workflows/cron-jobs.yml`   |
| Cron batch size      | 100    | Service default param               |
| Max comment length   | 2000   | Zod schema                          |
| Rating range         | 1–5    | Zod schema + DB constraint          |

---

## Security Considerations

- **revieweeId is server-derived:** Never accepted from client input. Derived from booking participants.
- **Release logic is atomic:** The release check after second submission uses a single query to find the counterpart review, preventing race conditions where both reviews remain unreleased.
- **Cron auth:** Bearer token via `CRON_SECRET` environment variable, same pattern as existing cron jobs.
- **No information leak:** API never returns unreleased review content or other party's submission status.
- **Unique constraints prevent duplicates:** Even under concurrent submissions, the DB-level partial unique indexes prevent double reviews.
