# Plan 014: Notification-convention hardening (Sentry-visible failures, no awaited sends in money paths)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/features/reviews/services/blind-review-service.ts src/features/services/services/service-payment-lifecycle-service.ts src/dal/blind-review.dal.ts docs/ARCHITECTURE_V2.md`
> Plan 012 adds tests for the reviews service (no production change), so test
> drift is fine. Any mismatch with the production-code excerpts below is a
> STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (coordinate with plan 012: whichever lands second
  updates the notification-failure test assertions — see Maintenance notes)
- **Category**: tech-debt / observability
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

The repo's convention (CLAUDE.md): fire-and-forget notifications use
`.catch(captureNonCriticalError)` so failures reach Sentry without failing
the operation. Four sites violate it:

- Three catches in `BlindReviewService` log to bare `console.error` —
  invisible to Sentry/ops. A broken email template silently kills every
  review-released notification.
- The service-payout success notification is **awaited inside the payout
  loop's try** — a notification throw makes a _succeeded_ payout increment
  the run's `failed` counter and fire a misleading
  `service_payout_unexpected_error` ops alert (the transfer itself already
  completed and stays completed; only the accounting and alert are wrong).

Plus one cheap hardening rider from the same audit: the cron's
`releaseExpired` UPDATE doesn't filter already-released rows, so two
overlapping cron runs double-send release notifications. And one
documentation rider: `docs/ARCHITECTURE_V2.md` doesn't mention the
infrastructure-services tier (`src/services/*`), leaving contributors
guessing where Stripe/Resend wrappers belong.

## Current state

### Site 1 & 2 — blind-review-service catches (src/features/reviews/services/blind-review-service.ts)

Lines 100–102 (inside `submitReview`):

```ts
BlindReviewService.notifyReleasedReviews(allReviews, booking.type).catch(
  (err) => console.error("Failed to send release notifications:", err),
);
```

Lines 244–247 (inside `releaseExpiredReviews`):

```ts
BlindReviewService.notifyReleasedReviews(reviews, bookingType).catch((err) =>
  console.error("Failed to send cron release notifications:", err),
);
```

### Site 3 — group-release failure (same file, lines 250–253)

```ts
} catch (err) {
  console.error("Failed to release expired review group:", err);
  failed += reviews.length;
}
```

`captureNonCriticalError` is NOT yet imported in this file (check the import
block, lines 1–11). It lives in `@/lib/api/route-helpers`.

### Site 4 — awaited payout notification (src/features/services/services/service-payment-lifecycle-service.ts:101–117)

```ts
const updatedBooking = await serviceBookingDAL.getById(row.bookingId);
if (updatedBooking) {
  await sendServicePayoutNotification(row.providerId, updatedBooking);  // ← awaited in try
}

succeeded += 1;
} catch (error) {
  failed += 1;
  const message =
    error instanceof Error ? error.message : "Unknown payout error";
  await sendOpsAlert({
    event: "service_payout_unexpected_error",
    serviceBookingId: row.bookingId,
    ...
```

By this point the transfer already completed and both lifecycle statuses are
`completed` (lines 87–99) — a notification throw can no longer change money
state, only miscount the run.

### Rider A — releaseExpired guard (src/dal/blind-review.dal.ts:375–386)

```ts
async releaseExpired(reviewIds: string[]): Promise<void> {
  try {
    if (reviewIds.length === 0) return;

    await this.db
      .update(blindReviews)
      .set({ releasedAt: blindReviews.reviewWindowEndAt })
      .where(inArray(blindReviews.id, reviewIds));
```

The feeding query (`findUnreleasedExpired`, lines 354–365) already filters
`isNull(blindReviews.releasedAt)`, and the SET value is fixed — so the only
exposure is duplicate _notifications_ when two cron runs overlap. Adding
`isNull(blindReviews.releasedAt)` to this WHERE costs one line.
(Note: `releaseReviews` at lines 332–352 — the dual-submit path — is NOT in
scope; its release timestamps differ and plan 012's tests pin its behavior.)

### Rider B — architecture doc gap (docs/ARCHITECTURE_V2.md:46–50)

```md
### 3. Services Own Business Logic and Side Effects

Anything beyond a single read/write — state transitions, money movement,
multi-DAL coordination, notifications, legal/audit recording — belongs in a
service. Routes stay thin; DALs stay dumb.
```

The doc never explains `src/services/` (better-auth, geocoding, openai,
playwright, resend, stripe, vercel-blob) vs `src/features/<domain>/services/`.

### Conventions

- `captureNonCriticalError(error, { route, action })` — see usage at
  `src/features/services/services/service-booking-service.ts:432-435` and
  ~140 other sites.

## Commands you will need

| Purpose                            | Command                                                                                      | Expected on success |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck                          | `bun run type-check`                                                                         | exit 0              |
| Tests                              | `bun run test:run src/features/services/__tests__/service-payment-lifecycle-service.test.ts` | all pass            |
| Reviews tests (if plan 012 landed) | `bun run test:run src/features/reviews`                                                      | all pass            |
| Full suite                         | `bun run test:run`                                                                           | all pass            |
| Lint                               | `bun run lint`                                                                               | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/features/reviews/services/blind-review-service.ts` (3 catch sites +
  one import; nothing else)
- `src/features/services/services/service-payment-lifecycle-service.ts`
  (the notification call only)
- `src/dal/blind-review.dal.ts` (`releaseExpired` WHERE only)
- `docs/ARCHITECTURE_V2.md` (one new subsection)
- `src/features/services/__tests__/service-payment-lifecycle-service.test.ts`
  (assertion updates + 1 new test)
- `src/features/reviews/services/__tests__/blind-review-service.test.ts`
  (only if it exists, i.e. plan 012 landed — update notification-failure
  assertions)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- Every other `console.error` in the repo — this plan fixes the four audited
  sites, not a global sweep.
- `notifyReleasedReviews` itself, `sendServicePayoutNotification`,
  `sendOpsAlert` — the senders are fine.
- `releaseReviews` (dual-submit release) in the DAL.
- `acceptBooking`'s awaited notification — that is plan 009 Step 4 territory.

## Git workflow

- Branch: `advisor/014-notification-convention-hardening`
- One commit for the convention fixes, one for each rider.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Convert the three blind-review catches

Add to the import block of `blind-review-service.ts`:

```ts
import { captureNonCriticalError } from "@/lib/api/route-helpers";
```

Replace site 1:

```ts
BlindReviewService.notifyReleasedReviews(allReviews, booking.type).catch(
  (err) =>
    captureNonCriticalError(err, {
      route: "BlindReviewService.submitReview",
      action: "notify_released_reviews",
    }),
);
```

Site 2: same shape with
`route: "BlindReviewService.releaseExpiredReviews"`,
`action: "notify_cron_released_reviews"`.

Site 3 (keep the counter increment):

```ts
} catch (err) {
  captureNonCriticalError(err, {
    route: "BlindReviewService.releaseExpiredReviews",
    action: "release_expired_review_group",
  });
  failed += reviews.length;
}
```

**Verify**: `grep -c "console.error" src/features/reviews/services/blind-review-service.ts`
→ 0. `bun run type-check` → exit 0.

### Step 2: Fire-and-forget the payout notification

In `service-payment-lifecycle-service.ts`, replace the awaited send
(Site 4) with:

```ts
const updatedBooking = await serviceBookingDAL.getById(row.bookingId);
if (updatedBooking) {
  sendServicePayoutNotification(row.providerId, updatedBooking).catch((err) =>
    captureNonCriticalError(err, {
      route: "ServicePaymentLifecycleService.processEligiblePayouts",
      action: "payout_notification_failed",
    }),
  );
}
```

Check whether `captureNonCriticalError` is already imported in this file;
add the import if not. The `getById` stays awaited (it feeds the payload);
only the send becomes fire-and-forget.

**Verify**: `bun run test:run src/features/services/__tests__/service-payment-lifecycle-service.test.ts`
→ if an existing test asserted the awaited call ordering, update it; all pass.

### Step 3: New test — notification failure no longer fails the payout run

In `service-payment-lifecycle-service.test.ts`, add: transfer succeeds,
`sendServicePayoutNotification` mock rejects → the run result counts the row
in `succeeded` (not `failed`), and no
`service_payout_unexpected_error` ops alert fires for it. Follow the file's
existing mock wiring (it already mocks
`@/features/services/notifications/service-notifications` at line 34).

Note on flushing: with a fire-and-forget promise, the rejection may surface
after the method returns — have the mock return a rejected promise and
`await vi.waitFor(() => expect(mockCaptureError).toHaveBeenCalled())` (or
flush microtasks via `await Promise.resolve()` twice) before asserting; if
the file has no `mockCaptureError`, add a `@/lib/api/route-helpers` mock the
way `service-booking-service.test.ts:92-94` does.

**Verify**: the new test passes; the whole file passes.

### Step 4 (Rider A): Idempotent releaseExpired

In `blind-review.dal.ts`, change the WHERE:

```ts
.where(
  and(
    isNull(blindReviews.releasedAt),
    inArray(blindReviews.id, reviewIds),
  ),
);
```

`and` / `isNull` — check the file's drizzle imports (line 1 region) and add
as needed.

**Verify**: `bun run type-check` → exit 0; if plan 012's DAL test for
`releaseExpired` exists, update its chain stub for the new `and(...)` shape.

### Step 5 (Rider B): Document the infrastructure-services tier

In `docs/ARCHITECTURE_V2.md`, immediately after the "### 3. Services Own
Business Logic and Side Effects" paragraph (line 50), insert:

```md
Two service tiers exist:

- **Domain services** (`src/features/<domain>/services/`) — business logic:
  state transitions, money movement, multi-DAL orchestration. This is what
  "services" means everywhere else in this document.
- **Infrastructure services** (`src/services/` — stripe, resend, openai,
  vercel-blob, geocoding, better-auth) — thin wrappers around third-party
  SDKs. Domain services call these instead of touching SDKs directly. Keep
  them stateless; no domain rules, no DAL access (the narrow exception:
  Stripe webhook handlers in `src/services/stripe/webhook-handlers.ts`
  orchestrate DAL updates because Stripe, not a domain flow, is the caller).
```

Before committing, verify the webhook-handlers caveat is accurate:
`grep -n "DAL" src/services/stripe/webhook-handlers.ts | head -5` — if it
does NOT touch DALs, drop the parenthetical instead of inventing one.

**Verify**: `bun run lint` → exit 0 (prettier checks markdown).

### Step 6: Full gates

**Verify**: `bun run type-check && bun run lint && bun run test:run` → exit 0.

## Test plan

- Step 3's new test is the behavioral pin for Site 4.
- Sites 1–3 are covered by plan 012's notification-failure tests if present
  (update their assertions from `console.error` to `captureNonCriticalError`
  mocks); if 012 hasn't run, the grep in Done criteria is the gate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "console.error" src/features/reviews/services/blind-review-service.ts` → 0
- [ ] `grep -n "await sendServicePayoutNotification" src/features/services/services/service-payment-lifecycle-service.ts` → no output
- [ ] `grep -n "isNull(blindReviews.releasedAt)" src/dal/blind-review.dal.ts`
      → 2 hits (findUnreleasedExpired + releaseExpired)
- [ ] `grep -n "Infrastructure services" docs/ARCHITECTURE_V2.md` → 1 hit
- [ ] `bun run type-check && bun run lint && bun run test:run` → exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the "Current state" locations doesn't match the excerpts.
- An existing test in `service-payment-lifecycle-service.test.ts` asserts
  that a notification failure marks the run failed — that would mean the
  current behavior is _intended_, contradicting this audit; report before
  changing it.
- `captureNonCriticalError`'s signature differs from
  `(error, { route, action })` (read it in `src/lib/api/route-helpers.ts`
  before Step 1).

## Maintenance notes

- Plan 012 ↔ 014 ordering: 012's tests assert the catch behavior of whichever
  code is live. If 012 ran first, its tests mock `console.error` behavior —
  update them here (both plans carry this note; the second one to land does
  the reconciliation).
- The repo still has bare `console.error` catches outside the reviews
  service (e.g. messages DAL logging). A global lint rule
  (`no-console` with allowlist) would prevent regressions — deliberately not
  part of this plan; suggest it in the PR description.
- Reviewer focus: Step 2 must keep `getById` awaited; only the send detaches.
