# Plan 012: Test coverage for the blind-review system and the service payment-lifecycle DAL

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/features/reviews src/dal/blind-review.dal.ts src/dal/service-payment-lifecycle.dal.ts`
> Note: plan 014 changes three `.catch(console.error)` sites in
> `blind-review-service.ts` to `captureNonCriticalError` — that drift is
> expected if 014 ran first; adjust the notification-failure assertions
> accordingly. Any other mismatch with the excerpts below is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only; no production code changes)
- **Depends on**: none (coordinate with plan 014: if 014 is DONE, mock
  `captureNonCriticalError` instead of `console.error` in
  notification-failure tests)
- **Category**: tests
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

Two money/reputation-critical areas have **zero** tests:

- `src/features/reviews/` has no `__tests__` directory at all.
  `BlindReviewService` (425 lines) implements time-window expiry, two-party
  blind release, participant authorization, and a cron batch release — all
  date-boundary and state-machine logic where a one-line regression silently
  releases reviews early, blocks legitimate submissions, or corrupts rating
  aggregates.
- `src/dal/service-payment-lifecycle.dal.ts` (15 methods, drives the service
  payout cron: atomic claim, payout eligibility query, transfer status
  state machine, dispute freeze/unfreeze) has no
  `src/dal/__tests__/service-payment-lifecycle.dal.test.ts` — every other
  major DAL has a paired test file.

These tests also act as the characterization safety net under plans 009/011
(service-booking money fixes) and any future change to review release rules.

## Current state

Files under test:

- `src/features/reviews/services/blind-review-service.ts` — all-static
  `BlindReviewService`. Public methods: `submitReview` (line 33),
  `getBookingReviews` (111), `getReviewStatus` (142), `getUserReviews` (189),
  `releaseExpiredReviews` (208). Private: `resolveBooking` (265) →
  `resolveRental` (280) / `resolveServiceBooking` (329),
  `notifyReleasedReviews` (377).
- `src/dal/blind-review.dal.ts` — `create` (41, maps Postgres `23505`
  unique-violation to `ConflictError`), `findByBooking` (85),
  `findUnreleasedExpired` (354), `releaseExpired` (375), others.
- `src/dal/service-payment-lifecycle.dal.ts` — see method list in Step 4.

Existing exemplars (the patterns to copy):

- `src/features/services/__tests__/service-booking-service.test.ts` —
  service-layer pattern: module-level `vi.fn()` mocks wired through
  `vi.mock("@/dal", () => ({ ... }))` plus mocks for notification modules;
  fixtures as plain objects.
- `src/dal/__tests__/service-booking.dal.test.ts` — DAL pattern: mock
  `@/db/db` and stub the drizzle chain per test:
  ```ts
  vi.mock("@/db/db", () => ({
    db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() },
  }));
  // per test:
  const mockReturning = vi.fn().mockResolvedValue([row]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);
  ```
- Fake timers are already used in this repo (e.g.
  `src/features/payments/lib/__tests__/assert-connect-ready.test.ts`) —
  `vi.useFakeTimers()` / `vi.setSystemTime(...)` / `vi.useRealTimers()`.

### Key excerpts (behavior to pin)

`submitReview` window check and dual-release (blind-review-service.ts:64–103):

```ts
// Validate window not expired
if (new Date() > booking.reviewWindowEndAt) {
  throw new ValidationError("The review window has expired for this booking");
}
const review = await blindReviewDAL.create({ ... });
const allReviews = await blindReviewDAL.findByBooking({ ... });
if (allReviews.length === 2) {
  await blindReviewDAL.releaseReviews(reviewIds);
  const revieweeIds = [...new Set(allReviews.map((r) => r.revieweeId))];
  await Promise.all(revieweeIds.map((id) => userDAL.updateReviewAggregate(id)));
  BlindReviewService.notifyReleasedReviews(allReviews, booking.type).catch(
    (err) => console.error("Failed to send release notifications:", err),
  );
}
```

Note the boundary asymmetry to pin in tests: `submitReview` rejects when
`new Date() > reviewWindowEndAt` (exactly-at-deadline is ALLOWED), while
`getReviewStatus` computes `withinWindow = new Date() <= booking.reviewWindowEndAt`
(consistent: exactly-at-deadline can review).

`releaseExpiredReviews` batch + per-group failure (208–256): groups expired
reviews by `rentalId ?? serviceBookingId`, calls `releaseExpired(ids)` per
group, updates aggregates per distinct reviewee, notifies fire-and-forget,
counts `released`/`failed` per group; a group whose DAL call throws increments
`failed` by the group size and continues.

`getReviewStatus` (142–183): returns the all-false safe default when
`resolveBooking` throws OR the user is not a participant; uses the
**resolved** booking ids (a rental-request id input resolves to the rental
id — comment at lines 164–165).

`ServicePaymentLifecycleDAL.claimForProcessing` (152–172): guarded update
`payoutStatus: "pending" → "processing"`, returns `result.length > 0`.

## Commands you will need

| Purpose               | Command                                                                                                               | Expected on success |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Run new service tests | `bun run test:run src/features/reviews`                                                                               | all pass            |
| Run new DAL tests     | `bun run test:run src/dal/__tests__/blind-review.dal.test.ts src/dal/__tests__/service-payment-lifecycle.dal.test.ts` | all pass            |
| Typecheck             | `bun run type-check`                                                                                                  | exit 0              |
| Full suite            | `bun run test:run`                                                                                                    | all pass            |
| Lint                  | `bun run lint`                                                                                                        | exit 0              |

## Scope

**In scope** (create only; NO production code changes):

- `src/features/reviews/services/__tests__/blind-review-service.test.ts` (create)
- `src/dal/__tests__/blind-review.dal.test.ts` (create)
- `src/dal/__tests__/service-payment-lifecycle.dal.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- ANY file under `src/features/reviews/services/`, `src/dal/` — if a test
  reveals a real bug, that is a STOP condition (report it; do not fix it here).
- `src/dal/payment-lifecycle.dal.ts` (the RENTAL lifecycle DAL — also
  untested, deliberately deferred; see Maintenance notes).
- `src/features/services/__tests__/service-payment-lifecycle-service.test.ts`
  — the service-layer payout tests exist; this plan covers the DAL beneath.
- Review API routes — route-level tests are not this plan.

## Git workflow

- Branch: `advisor/012-review-and-lifecycle-test-coverage`
- Commit per test file; plain imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the code under test, fully

Read `src/features/reviews/services/blind-review-service.ts` top to bottom,
including `resolveRental` (note: accepts either a rental id or a
rental-request id) and `resolveServiceBooking` (requires status `completed`
— confirm by reading). Read the two DALs' methods listed in Steps 3–4. Do not
write a test that asserts behavior you have not read.

**Verify**: you can answer — what does `resolveBooking` throw for a
non-completed booking, and which id does `getReviewStatus` pass to
`findByReviewerAndBooking`? (resolved rental id, not the raw param).

### Step 2: BlindReviewService tests

Create `src/features/reviews/services/__tests__/blind-review-service.test.ts`,
modeled on `service-booking-service.test.ts`'s mock wiring. Mock:

- `@/dal` → `blindReviewDAL` (create, findByBooking, releaseReviews,
  findUnreleasedExpired, releaseExpired, findByReviewerAndBooking, ...) and
  `userDAL` (updateReviewAggregate);
- `@/features/reviews/notifications/blind-review-released` →
  `sendReviewReleasedNotification` (used by `notifyReleasedReviews`);
- **`@/db/db`** — the private `resolveRental`/`resolveServiceBooking` methods
  bypass the DAL and query `db` directly with a
  `db.select({...}).from(...).innerJoin?(...).where(...).limit(1)` chain
  (blind-review-service.ts:285–296 and 332–342). Stub the chain the way
  `src/dal/__tests__/service-booking.dal.test.ts` does, resolving to
  `[{ rentalId, renterId, ownerId, returnConfirmedAt, requestStatus }]` for
  rentals or `[{ id, requesterId, providerId, status, completedAt }]` for
  service bookings. `reviewWindowEndAt` is derived as
  `completedAt + REVIEW_WINDOW_DAYS` (see `../constants`).

Use `vi.useFakeTimers()` + `vi.setSystemTime` for all window tests; restore
real timers in `afterEach`.

`submitReview`:

1. non-participant → `ForbiddenError`, `blindReviewDAL.create` not called.
2. window expired (`now > reviewWindowEndAt`) → `ValidationError`.
3. boundary: `now === reviewWindowEndAt` exactly → submission ALLOWED.
4. first review of two → created, `releaseReviews` NOT called, no aggregate
   update, no notification.
5. second review → `releaseReviews` called with both ids,
   `updateReviewAggregate` called once per distinct reviewee, notification
   fired.
6. notification rejection does NOT reject `submitReview` (catch handler
   swallows — assert resolves; if plan 014 already landed, also assert
   `captureNonCriticalError` was called).

`getReviewStatus`: 7. `resolveBooking` throws → `{ hasReviewed: false, canReview: false, reviewWindowEndAt: null }`. 8. non-participant → same safe default. 9. already reviewed, window open → `hasReviewed: true, canReview: false`. 10. not reviewed, window open → `canReview: true`. 11. not reviewed, window past → `canReview: false` with ISO `reviewWindowEndAt`.

`releaseExpiredReviews`: 12. no expired → `{ eligible: 0, released: 0, failed: 0 }`, no DAL writes. 13. two bookings' worth of reviews (e.g. 2 rental + 2 service) → grouped:
`releaseExpired` called once per group; counts
`{ eligible: 4, released: 4, failed: 0 }`. 14. one group's `releaseExpired` rejects → that group counted in `failed`
(by group size), the other group still released; method resolves. 15. aggregates updated once per distinct reviewee per group.

**Verify**: `bun run test:run src/features/reviews` → 15 tests pass.

### Step 3: BlindReviewDAL tests

Create `src/dal/__tests__/blind-review.dal.test.ts` using the drizzle-chain
mock pattern from `service-booking.dal.test.ts`. These verify wiring, return
mapping, and error mapping (the repo's existing DAL-test trade-off — they do
not execute SQL):

1. `create` returns the inserted row.
2. `create` maps a thrown `{ code: "23505" }` to `ConflictError` with the
   "already submitted" message.
3. `releaseExpired` with `[]` returns without touching `db.update`.
4. `releaseExpired` with ids calls `db.update` (chain: `.set().where()`).
5. `findUnreleasedExpired` returns the selected rows.

**Verify**: `bun run test:run src/dal/__tests__/blind-review.dal.test.ts` → 5 pass.

### Step 4: ServicePaymentLifecycleDAL tests

Create `src/dal/__tests__/service-payment-lifecycle.dal.test.ts`, same
pattern. Read each method before writing its test. Cover the money-critical
subset:

1. `create` returns the inserted lifecycle row.
2. `claimForProcessing` → chain resolves `[row]` → `true`.
3. `claimForProcessing` → chain resolves `[]` → `false` (the concurrency
   guard contract the payout cron relies on).
4. `updateOwnerTransferStatus` with `extra` → `.set` called with
   `ownerTransferStatus`, `stripeTransferId`, `transferAmount` as a string
   (`String(extra.transferAmount)`), and `ownerTransferredAt`.
5. `updateOwnerTransferStatus` without `extra` → `.set` called WITHOUT those
   optional keys.
6. `updatePayoutStatus` sets the status.
7. `findEligibleForPayout` returns mapped rows (read the method at line 231
   first — stub the select chain it actually builds).
8. `markCancelled` and `unfreezeAfterResolution` — return-shape checks
   (read both; `unfreezeAfterResolution` returns a boolean).

**Verify**: `bun run test:run src/dal/__tests__/service-payment-lifecycle.dal.test.ts`
→ 8 pass.

### Step 5: Full gates

**Verify**: `bun run type-check && bun run lint && bun run test:run` → exit 0,
no existing test broken.

## Test plan

This plan IS the test plan (Steps 2–4: 15 + 5 + 8 ≈ 28 new tests). Patterns:
`service-booking-service.test.ts` (service), `service-booking.dal.test.ts`
(DAL chain stubbing).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] The three new test files exist at the exact paths in Scope
- [ ] `bun run test:run src/features/reviews` → ≥15 tests, all pass
- [ ] `bun run test:run src/dal/__tests__/blind-review.dal.test.ts src/dal/__tests__/service-payment-lifecycle.dal.test.ts` → ≥13 tests, all pass
- [ ] `git diff --stat` shows NO changes outside the three new files +
      `plans/README.md`
- [ ] `bun run type-check && bun run lint && bun run test:run` → exit 0

## STOP conditions

Stop and report back (do not improvise) if:

- A test you believe is correct fails because the **production code** is
  wrong (e.g. the boundary behaves differently than the excerpt, aggregates
  update for the wrong user, a release path double-fires). Report the
  suspected bug with the failing test — do NOT change production code and do
  NOT bend the test to pass.
- `resolveBooking`'s actual contract differs materially from what Step 1's
  reading predicts (e.g. it doesn't require `completed` status) — the test
  suite's fixtures would be built on sand; report first.
- Mocking `@/dal` for the reviews service requires mocking more than ~6
  modules — that suggests the import graph changed since planning; report.

## Maintenance notes

- `src/dal/payment-lifecycle.dal.ts` (rental side) is equally untested —
  same recipe applies; deferred to keep this plan a day's work. Whoever
  executes plan 008's unification later inherits both suites as the
  characterization net.
- These DAL tests pin query _wiring_, not SQL semantics. If a real-database
  test harness ever lands (e.g. pglite), the claim/eligibility queries are
  the first candidates to migrate.
- Plan 014 rewrites the `console.error` catches these tests touch — whichever
  lands second updates the notification-failure assertions (both plans note
  this).
- Reviewer focus: fake-timer hygiene (`useRealTimers` in `afterEach`) and
  that test 3 (exact-boundary submission allowed) matches the strict-`>`
  in the code rather than assuming rejection.
