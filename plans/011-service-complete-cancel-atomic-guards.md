# Plan 011: Atomic status guards on service-booking complete/cancel (no refund+payout double-spend)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/features/services/services/service-booking-service.ts src/dal/service-booking.dal.ts`
> Plan 009 intentionally modifies `acceptBooking` in the same file — that drift
> is expected; verify 009's status in `plans/README.md` is DONE and that the
> `completeBooking`/`cancelBooking` excerpts below still match. Any OTHER
> mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/009-service-accept-charge-safety.md` (introduces the
  `paymentStatus = "processing"` claim this plan must respect; same file —
  execute sequentially, never in parallel worktrees)
- **Category**: bug (money)
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

`completeBooking` and `cancelBooking` both follow read → validate → act with
no atomic guard on the status transition. In the race window where both are
invoked on the same `accepted` booking (provider taps "complete" while the
requester taps "cancel"):

- `cancelBooking` issues a **refund** to the requester (full or partial), and
- `completeBooking` sets `payoutStatus` to `pending`, queueing a **transfer**
  to the provider via the payout cron.

Both Stripe operations fire → the platform pays both sides of one booking.
Additionally, today `cancelBooking` flips the booking's status to `cancelled`
**last**, after the refund — so an unexpected throw mid-refund leaves an
`accepted` booking that already refunded money and can still be completed and
paid out later. Atomic compare-and-swap (CAS) transitions close both holes.

## Current state

Files:

- `src/features/services/services/service-booking-service.ts` —
  `completeBooking` (lines 537–576), `cancelBooking` (lines 581–762).
  Line numbers are pre-plan-009; locate by symbol name after 009 lands.
- `src/dal/service-booking.dal.ts` — `update()` at lines 90–109 (unguarded
  by-id update used by both methods). After plan 009 this file also has
  `claimForAcceptance` — a useful in-file reference for the guarded-update
  shape.
- `src/dal/__tests__/service-booking.dal.test.ts` — DAL test exemplar
  (mocks the drizzle `db` chain; see its `create` test for the pattern).
- `src/features/services/__tests__/service-booking-service.test.ts` —
  service tests; `describe("completeBooking")` at ~line 626,
  `describe("cancelBooking")` at ~line 652.

### Excerpt 1 — completeBooking's check-then-act (service-booking-service.ts:542–562)

```ts
const detail = await serviceBookingDAL.getById(bookingId);
if (!detail) {
  throw new NotFoundError("Service booking", bookingId);
}
if (detail.providerId !== providerId) {
  throw new ForbiddenError("You are not the provider for this booking");
}
if (detail.status !== "accepted") {
  throw new ValidationError("Booking must be accepted to complete", "status");
}

const now = new Date();
const updated = await serviceBookingDAL.update(bookingId, {
  // ← unguarded
  status: "completed",
  completedAt: now,
});

await servicePaymentLifecycleDAL.updatePayoutStatus(bookingId, "pending");
```

### Excerpt 2 — cancelBooking's shape (service-booking-service.ts:587–718, abridged)

```ts
const detail = await serviceBookingDAL.getById(bookingId);
// ... NotFoundError / ForbiddenError (requester or provider) ...
if (detail.status !== "pending" && detail.status !== "accepted") {
  throw new ValidationError("Booking cannot be cancelled", "status");
}
// ... active-dispute ConflictError check ...
// ... refundFraction computed from detail.status + proposed date/time ...
const existingLifecycle = await servicePaymentLifecycleDAL.getByBookingId(bookingId);
if (existingLifecycle) {
  await servicePaymentLifecycleDAL.markCancelled(bookingId);
}
if (refundAmountCents > 0 && detail.stripeChargeId) {
  const refundResult = await processRefund({ ... });          // ← money moves
  // {success:false} → ops alert, continue; success → capture refund ids
}
// ... possible partial provider transfer (requester <24h cancel) ...
const updated = await serviceBookingDAL.update(bookingId, {   // ← status flips LAST
  status: "cancelled",
  refundAmount: refundAmountStr,
  stripeRefundId,
  cancelledAt: new Date(),
  cancelledBy: userId,
  cancellationReason: reason?.trim() ?? null,
});
```

### Interaction with plan 009 (must respect)

Plan 009 makes `acceptBooking` claim a booking by setting
`paymentStatus = "processing"` while the off-session charge is in flight
(status stays `pending` during the charge). A cancel that CAS-es
`pending → cancelled` mid-charge would still collide with the charge landing.
Therefore the cancel CAS must additionally require
`paymentStatus IS NULL OR paymentStatus <> 'processing'`.

### Conventions

- Throw `@/dal/errors` types; `handleApiError` maps `ConflictError` → 409
  (`src/lib/api/route-helpers.ts:103`). `ConflictError` is already used in
  `cancelBooking` (active-dispute check).
- DAL stays auth-agnostic — the CAS method takes ids/statuses only.

## Commands you will need

| Purpose       | Command                                                                            | Expected on success |
| ------------- | ---------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `bun run type-check`                                                               | exit 0              |
| Service tests | `bun run test:run src/features/services/__tests__/service-booking-service.test.ts` | all pass            |
| DAL tests     | `bun run test:run src/dal/__tests__/service-booking.dal.test.ts`                   | all pass            |
| Full suite    | `bun run test:run`                                                                 | all pass            |
| Lint          | `bun run lint`                                                                     | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/dal/service-booking.dal.ts` (add one method)
- `src/features/services/services/service-booking-service.ts` (only
  `completeBooking` and `cancelBooking`)
- `src/features/services/__tests__/service-booking-service.test.ts`
- `src/dal/__tests__/service-booking.dal.test.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `acceptBooking` / `declineBooking` — accept is plan 009's territory;
  decline's race (decline vs accept) is bounded by 009's claim: a charge in
  flight ends in `accepted` or `payment_failed` either way, and decline of a
  claimed booking is a pre-existing low-stakes edge explicitly deferred here.
- `src/features/services/services/service-payment-lifecycle-service.ts` —
  the payout cron; its transfer idempotency key (`service-transfer-${bookingId}`)
  already prevents double transfers.
- `processRefund` / `createServiceTransfer` in `src/services/stripe/` —
  correct as-is.
- Rental-side complete/cancel — different lifecycle, covered by plans 004/005.

## Git workflow

- Branch: `advisor/011-service-complete-cancel-atomic-guards`
- Commit per step; plain imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a CAS update to ServiceBookingDAL

In `src/dal/service-booking.dal.ts`, next to `update()`:

```ts
/**
 * Compare-and-swap update: applies `updates` only when the booking is
 * still in `expectedStatus`. With `blockWhilePaymentProcessing`, also
 * refuses while an accept-charge claim holds paymentStatus="processing"
 * (see ServiceBookingService.acceptBooking). Returns null when the guard
 * fails — caller decides how to surface the conflict.
 */
async updateIfStatus(
  bookingId: string,
  expectedStatus: ServiceBooking["status"],
  updates: Partial<Omit<ServiceBooking, "id" | "createdAt">>,
  opts: { blockWhilePaymentProcessing?: boolean } = {},
): Promise<ServiceBooking | null> {
  try {
    const conditions = [
      eq(serviceBookings.id, bookingId),
      eq(serviceBookings.status, expectedStatus),
    ];
    if (opts.blockWhilePaymentProcessing) {
      conditions.push(
        or(
          isNull(serviceBookings.paymentStatus),
          ne(serviceBookings.paymentStatus, "processing"),
        )!,
      );
    }
    const [row] = await this.db
      .update(serviceBookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return row ?? null;
  } catch (error) {
    this.handleError(error, "ServiceBookingDAL.updateIfStatus");
  }
}
```

Import `or`, `isNull`, `ne` from `drizzle-orm` as needed.

**Verify**: `bun run type-check` → exit 0.

### Step 2: completeBooking uses the CAS

Replace the unguarded update (Excerpt 1) with:

```ts
const now = new Date();
const updated = await serviceBookingDAL.updateIfStatus(bookingId, "accepted", {
  status: "completed",
  completedAt: now,
});
if (!updated) {
  throw new ConflictError(
    "This booking is no longer in an accepted state — it may have been cancelled or already completed.",
  );
}
```

Keep the existing pre-checks (NotFound/Forbidden/Validation) — they produce
better error messages for the common non-race cases; the CAS is the
correctness backstop. Everything after (payout-status update, audit log,
notification) is unchanged and now runs at most once.

Add `ConflictError` to the `@/dal/errors` import if not already there (it is,
for `cancelBooking`'s dispute check).

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts`
→ completeBooking tests fail only because the mock lacks `updateIfStatus`;
wire `updateIfStatus` into the `serviceBookingDAL` mock
(`vi.mock("@/dal", ...)` block) returning the updated row, then they pass.

### Step 3: cancelBooking claims the cancellation BEFORE money moves

Restructure `cancelBooking`:

1. Keep everything through the refund-fraction computation unchanged
   (`detail` read, NotFound/Forbidden/Validation, active-dispute check,
   `refundFraction` / `refundAmountCents` math — these only read `detail`).
2. **Immediately after** the refund math and **before**
   `servicePaymentLifecycleDAL.getByBookingId`, insert the CAS — this is the
   point of no return:

```ts
// Claim the cancellation atomically: only one terminal transition can win,
// and never while an accept-charge is in flight (paymentStatus="processing").
const claimed = await serviceBookingDAL.updateIfStatus(
  bookingId,
  detail.status, // the exact status the refund math was computed from
  {
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: userId,
    cancellationReason: reason?.trim() ?? null,
  },
  { blockWhilePaymentProcessing: true },
);
if (!claimed) {
  throw new ConflictError(
    "This booking changed state while cancelling — refresh and try again.",
  );
}
```

3. The final update (Excerpt 2's last block, line ~711) now only records the
   refund outcome — remove the status/cancellation fields from it:

```ts
const updated = await serviceBookingDAL.update(bookingId, {
  refundAmount: refundAmountStr,
  stripeRefundId,
});
```

4. Everything between (lifecycle markCancelled, refund, partial transfer,
   audit, notifications) stays in the same order.

Behavior note (intended, document in the commit message): a hard throw during
the refund now leaves the booking `cancelled` with refund fields unset plus
the existing ops-alert path — previously it left an `accepted` booking that
had possibly already refunded, which the payout cron could later pay out too.
Cancelled-pending-refund-reconciliation is strictly safer than
accepted-with-refund.

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts`
→ cancelBooking tests updated (Step 4) and passing.

### Step 4: Tests

**Service tests** (`service-booking-service.test.ts`): wire `updateIfStatus`
into the `serviceBookingDAL` mock (default: resolve to the updated row).
Update existing complete/cancel tests to assert against `updateIfStatus`
calls where they previously asserted `update` for the status flip (the
refund-fields update still goes through `update`). Add:

1. `completeBooking` → `updateIfStatus` resolves `null` → rejects with
   `ConflictError`; `servicePaymentLifecycleDAL.updatePayoutStatus` NOT
   called; no notification sent.
2. `cancelBooking` → `updateIfStatus` resolves `null` → rejects with
   `ConflictError`; `processRefund` NOT called; `markCancelled` NOT called.
3. `cancelBooking` happy path (accepted, >24h, requester) → `updateIfStatus`
   called with `("book-1", "accepted", expect.objectContaining({ status: "cancelled" }), { blockWhilePaymentProcessing: true })`,
   then `processRefund` called, then `update` called with
   `expect.objectContaining({ refundAmount: expect.any(String) })`.
4. `completeBooking` happy path → `updateIfStatus` called with
   `("book-1", "accepted", expect.objectContaining({ status: "completed" }))`.

**DAL tests** (`service-booking.dal.test.ts`, drizzle-chain mock pattern —
copy the `create` test's chain stubbing): `updateIfStatus` returns the row
when the chain resolves one, and `null` when the chain resolves `[]`.

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts src/dal/__tests__/service-booking.dal.test.ts`
→ all pass, including ≥6 new tests.

### Step 5: Full gates

**Verify**: `bun run type-check && bun run lint && bun run test:run` → exit 0.

## Test plan

Covered in Step 4. Pattern exemplars: `describe("acceptBooking")` in the same
service test file (module-level mock fns), and the `create` test in
`src/dal/__tests__/service-booking.dal.test.ts` (drizzle chain stubbing).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "updateIfStatus" src/dal/service-booking.dal.ts` → 1 method
- [ ] In `completeBooking` and `cancelBooking`, the status flip goes through
      `updateIfStatus` (read the diff); `serviceBookingDAL.update` remains
      only for the refund-fields write in `cancelBooking`
- [ ] `bun run test:run` exits 0; the ConflictError race tests exist and pass
- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 009 is not DONE (this plan assumes `paymentStatus = "processing"`
  exists as a claim state; without it, `blockWhilePaymentProcessing` guards
  nothing real).
- The `completeBooking`/`cancelBooking` excerpts don't match the live code
  beyond plan 009's documented changes to `acceptBooking`.
- You find another caller of `serviceBookingDAL.update` that flips `status`
  to `completed`/`cancelled` outside these two methods
  (check: `grep -rn "status: \"completed\"\|status: \"cancelled\"" src/features/services src/app/api/services src/app/api/cron --include="*.ts"`)
  — e.g. an admin or cron path that would bypass the CAS; it needs the same
  treatment and a human call on scope.
- Drizzle's `.returning()` behaves differently than assumed for 0-row updates
  in a test you cannot make pass (it must resolve `[]`, not throw).

## Maintenance notes

- The expire-pending-bookings cron (`findPendingExpired`) transitions
  `pending → expired/declined`-like states; if it uses an unguarded update it
  has the same theoretical race against accept, bounded by 009's claim. Worth
  a look when next touching that cron — deliberately out of scope here.
- If a future feature adds new terminal transitions (e.g. provider no-show),
  use `updateIfStatus` from the start.
- Reviewer focus: cancelBooking's point-of-no-return placement — the CAS must
  come _after_ the refund-fraction math (which reads `detail.status`) and
  _before_ `markCancelled`/`processRefund`; and the CAS `expectedStatus` must
  be `detail.status`, not a hardcoded value.
