# Plan 009: Make service-booking acceptance charge-safe (no double charge on retry or post-charge failure)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/features/services/services/service-booking-service.ts src/dal/service-booking.dal.ts src/features/services/__tests__/service-booking-service.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but read `plans/005-approve-double-charge-guard.md` §"Why this matters" and the 004/005 BLOCKED notes in `plans/README.md` first — this plan is the service-side twin and deliberately avoids the trap that blocked 005 Step 3)
- **Category**: bug (money)
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

`ServiceBookingService.acceptBooking` charges the requester's card off-session
when a provider accepts a booking. Today it can charge the same requester
**twice** for one booking, two ways:

1. **Post-charge failure re-arms the charge.** The entire accept flow — charge,
   booking update, payment record, lifecycle create, audit log, and an _awaited_
   notification — sits in one `try`. The `catch` unconditionally resets the
   booking to `payment_failed`. So if the Stripe charge **succeeds** and any
   later step throws (a transient DB error, or the notification at line 401
   failing), the booking is marked retryable even though money moved. The
   provider retries, and because the retry idempotency key embeds `Date.now()`,
   Stripe does not deduplicate → second real charge.
2. **Concurrent retries.** There is no atomic claim on the status check
   (`getById` then validate then act). Two concurrent accept calls on a
   `payment_failed` booking each compute a different `Date.now()` key → two
   real charges. (Two concurrent _first_ accepts are safe today only because
   the first-attempt key `service-charge-${id}` is deterministic.)

The rental side had the same class of bug and was fixed in plan 005 with an
atomic claim. Critically, 005's Step 3 (catch-all reset) was **rejected as a
new double-charge vector** — resetting to a retryable status after a
successful charge is exactly the bug. This plan applies that lesson from the
start: the failure handler must be **charge-aware**.

## Current state

Files:

- `src/features/services/services/service-booking-service.ts` — the service
  with the bug. `acceptBooking` spans lines 275–487.
- `src/dal/service-booking.dal.ts` — `ServiceBookingDAL`; `update()` at
  lines 90–109 (unguarded by-id update). The atomic claim method will be added
  here.
- `src/dal/rentals.dal.ts:1808–1831` — the **exemplar** atomic claim from plan
  005 (`claimRentalRequestPaymentProcessing`). Match this shape.
- `src/features/services/__tests__/service-booking-service.test.ts` — existing
  tests, including ones that pin the current buggy behavior (must be updated).
- `src/app/api/services/bookings/[id]/accept/route.ts` — the route; it funnels
  all errors through `handleApiError`, which already maps `ConflictError` →
  409 (`src/lib/api/route-helpers.ts:103`). No route change needed.

### Excerpt 1 — status check and idempotency key (service-booking-service.ts:280–341)

```ts
const detail = await serviceBookingDAL.getById(bookingId);
if (!detail) {
  throw new NotFoundError("Service booking", bookingId);
}
if (detail.providerId !== providerId) {
  throw new ForbiddenError("You are not the provider for this booking");
}
if (detail.status !== "pending" && detail.status !== "payment_failed") {
  throw new ValidationError("Booking is not pending", "status");
}
// ... assertConnectReady, getStripeCustomerContext ...
if (detail.status === "payment_failed") {
  // On retry, always use the requester's current Stripe default — not the previously failed PM.
  paymentMethodId = stripeCtx.paymentMethodId;

  // Guard: if the default hasn't changed since the failure, reject early.
  if (
    detail.selectedPaymentMethodId != null &&
    detail.selectedPaymentMethodId === paymentMethodId
  ) {
    throw new ValidationError(
      "Payment method is unchanged. Please update your default payment method and ask the provider to retry.",
      "paymentMethod",
    );
  }
} else {
  paymentMethodId = detail.selectedPaymentMethodId ?? stripeCtx.paymentMethodId;
}
// ...
const chargeIdempotencyKey =
  detail.status === "payment_failed"
    ? `service-charge-${detail.id}-retry-${Date.now()}` // ← BUG: non-deterministic
    : `service-charge-${detail.id}`;
```

Note the guard hole: when the requester never picked a PM at booking creation,
`detail.selectedPaymentMethodId` is `null`, so the "unchanged PM" guard never
fires and a same-card retry sails through.

### Excerpt 2 — the monolithic try/catch (service-booking-service.ts:343–486, abridged)

```ts
try {
  const { paymentIntent, chargeId } = await chargeServicePayment({ ... idempotencyKey: chargeIdempotencyKey });
  const updated = await serviceBookingDAL.update(bookingId, { status: "accepted", ... });
  await paymentDAL.createPayment({ ... });
  await servicePaymentLifecycleDAL.create({ ... });
  await auditLogDAL.create({ ... });
  await sendBookingAcceptedNotification(detail.requesterId, updated);  // ← awaited inside try
  // ... after() PDF trigger (fine, already fire-and-forget) ...
  return updated;
} catch (error) {
  await serviceBookingDAL.update(bookingId, {
    status: "payment_failed",          // ← fires even when the charge SUCCEEDED
    paymentStatus: "failed",
  });
  // ... payment-failed notifications to both parties, captureNonCriticalError,
  //     audit log, then:
  throw new ServiceBookingPaymentFailedError(
    "We could not process the requester's payment for this booking.",
  );
}
```

### Excerpt 3 — the exemplar atomic claim (rentals.dal.ts:1808–1831)

```ts
/**
 * Atomically claim a rental request for payment processing.
 * Transitions paymentStatus -> "processing" only from "pending" or "failed".
 * Returns false if another request already claimed it (or it already succeeded).
 */
async claimRentalRequestPaymentProcessing(
  requestId: string,
): Promise<boolean> {
  try {
    const result = await this.db
      .update(rentalRequests)
      .set({ paymentStatus: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(rentalRequests.id, requestId),
          inArray(rentalRequests.paymentStatus, ["pending", "failed"]),
        ),
      )
      .returning({ id: rentalRequests.id });
    return result.length > 0;
  } catch (error) {
    this.handleError(error, "claimRentalRequestPaymentProcessing");
  }
}
```

### Relevant schema facts

- `serviceBookings.status` is the pgEnum `service_booking_status`:
  `pending | accepted | declined | payment_failed | completed | cancelled`
  (`src/db/schemas/_enums.ts:271–278`).
- `serviceBookings.paymentStatus` is a free `varchar(50)`, **nullable**
  (`src/db/schemas/services.schema.ts:104`). It is `null` before any charge,
  set to `"failed"` by the catch, and to `paymentIntent.status` (normally
  `"succeeded"`) on success. Because it's a varchar, `"processing"` needs no
  migration.

### Conventions that apply

- Throw `@/dal/errors` types; `handleApiError` maps them
  (`ConflictError` → 409). Already imported in the service file.
- Fire-and-forget notifications use `.catch(captureNonCriticalError)` — never
  let a notification failure fail a money operation (CLAUDE.md; the
  `captureNonCriticalError` import already exists in this file, line 27).
- Ops alerts go through `sendOpsAlert` from
  `@/features/notifications/lib/ops-alerts` (already imported, line 28).

## Commands you will need

| Purpose   | Command                                                                            | Expected on success |
| --------- | ---------------------------------------------------------------------------------- | ------------------- |
| Install   | `bun install`                                                                      | exit 0              |
| Typecheck | `bun run type-check`                                                               | exit 0              |
| Tests     | `bun run test:run src/features/services/__tests__/service-booking-service.test.ts` | all pass            |
| DAL tests | `bun run test:run src/dal/__tests__/service-booking.dal.test.ts`                   | all pass            |
| Lint      | `bun run lint`                                                                     | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/features/services/services/service-booking-service.ts` (only
  `acceptBooking`)
- `src/dal/service-booking.dal.ts` (add one method)
- `src/features/services/__tests__/service-booking-service.test.ts`
- `src/dal/__tests__/service-booking.dal.test.ts` (add cases, if this file
  tests against mocks; if it requires a live DB, skip and note it)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `completeBooking` / `cancelBooking` in the same file — their races are plan
  011; touching them here creates merge conflicts.
- `src/features/rentals/**` — the rental twin was fixed in plans 004/005.
- `src/services/stripe/service-payments.ts` — the charge helper is correct;
  the bug is in how the service calls it.
- The accept route — `handleApiError` already maps the new `ConflictError`.
- Any DB migration — `paymentStatus` is a varchar; no schema change.

## Git workflow

- Branch: `advisor/009-service-accept-charge-safety` (matches the repo's
  `advisor/NNN-slug` convention, e.g. `advisor/005-approve-double-charge-guard`)
- Commit per step; plain imperative messages (repo style, e.g.
  "Add atomic claim to service booking acceptance").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `claimForAcceptance` to ServiceBookingDAL

In `src/dal/service-booking.dal.ts`, next to `update()` (line 90), add a
method mirroring the rental exemplar (Excerpt 3):

```ts
/**
 * Atomically claim a booking for payment processing.
 * Sets paymentStatus -> "processing" only when the booking is still
 * acceptable (status pending|payment_failed) and no other accept call
 * holds the claim (paymentStatus null|failed).
 * Returns false when another call already claimed it or the charge
 * already succeeded.
 */
async claimForAcceptance(bookingId: string): Promise<boolean> {
  try {
    const result = await this.db
      .update(serviceBookings)
      .set({ paymentStatus: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(serviceBookings.id, bookingId),
          inArray(serviceBookings.status, ["pending", "payment_failed"]),
          or(
            isNull(serviceBookings.paymentStatus),
            eq(serviceBookings.paymentStatus, "failed"),
          ),
        ),
      )
      .returning({ id: serviceBookings.id });
    return result.length > 0;
  } catch (error) {
    this.handleError(error, "ServiceBookingDAL.claimForAcceptance");
  }
}
```

Import `inArray`, `or`, `isNull` from `drizzle-orm` if not already imported in
this file (check the existing import block at the top).

**Verify**: `bun run type-check` → exit 0.

### Step 2: Claim atomically in `acceptBooking`

In `service-booking-service.ts`, immediately after the existing status
validation (the `ValidationError("Booking is not pending", "status")` throw)
and **before** `assertConnectReady`, insert:

```ts
const claimed = await serviceBookingDAL.claimForAcceptance(bookingId);
if (!claimed) {
  throw new ConflictError("This booking's payment is already being processed.");
}
```

Add `ConflictError` to the existing `@/dal/errors` import (line 12–18) if not
present.

Then, because the claim now flips `paymentStatus` to `"processing"` _before_
the Connect-readiness and payment-method checks, every pre-charge throw after
the claim must release it, or a failed precondition bricks the booking. Wrap
the pre-charge section — `assertConnectReady` through the
`STRIPE_MINIMUM_CHARGE_USD` check — so that on ANY throw in that region you
first release the claim, then rethrow:

```ts
try {
  await assertConnectReady(...);
  // ... stripeCtx lookup, paymentMethodId resolution + unchanged-PM guard,
  //     charge amount floor check ...
} catch (err) {
  await serviceBookingDAL.update(bookingId, {
    paymentStatus: detail.status === "payment_failed" ? "failed" : null,
  });
  throw err;
}
```

(Releasing restores the prior paymentStatus: `null` for first attempts,
`"failed"` for retries — so the booking stays acceptable.)

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts`
→ the Stripe Connect gating tests still pass (they throw inside the wrapped
region; the new release path must call `serviceBookingDAL.update`, which is
already mocked). Some tests will fail until Step 5 updates mocks for
`claimForAcceptance` — add `claimForAcceptance: vi.fn().mockResolvedValue(true)`
style wiring to the `serviceBookingDAL` mock in the test file's `vi.mock("@/dal", ...)`
block (line 44–48) NOW so the suite runs; full new tests come in Step 5.

### Step 3: Make the retry idempotency key deterministic and close the guard hole

Still in `acceptBooking`:

1. Replace the key computation (Excerpt 1, last lines) with:

```ts
const chargeIdempotencyKey =
  detail.status === "payment_failed"
    ? `service-charge-${detail.id}-retry-${paymentMethodId}`
    : `service-charge-${detail.id}`;
```

Two concurrent retries with the same card now share a key (Stripe dedupes);
a retry with a genuinely new card gets a new key (intended new attempt).

2. In the charge-failure handler (Step 4 reshapes it), persist the PM that
   failed so the "unchanged PM" guard fires even when the requester never
   explicitly selected one: add `selectedPaymentMethodId: paymentMethodId` to
   the failure update. Then the retry guard condition
   `detail.selectedPaymentMethodId != null && detail.selectedPaymentMethodId === paymentMethodId`
   becomes effective for every retry, not just explicit-PM bookings.

**Verify**: `grep -n "Date.now()" src/features/services/services/service-booking-service.ts`
→ no hit inside `acceptBooking` (hits elsewhere in the file, e.g.
`cancelBooking`'s `hoursUntil` math, are fine and out of scope).

### Step 4: Split the monolithic try/catch — charge-aware failure handling

Restructure the `try` block (Excerpt 2) into two regions:

**Region A — the charge.** Only `chargeServicePayment` stays inside the
existing `try`. Its `catch` keeps the current behavior (reset to
`payment_failed`/`failed`, both notifications, `captureNonCriticalError`,
audit log, throw `ServiceBookingPaymentFailedError`) **plus** the
`selectedPaymentMethodId: paymentMethodId` addition from Step 3.

**Region B — post-charge persistence.** Everything after a successful charge
(booking update → payment record → lifecycle create → audit log) moves into a
new `try/catch` whose catch must **NOT** reset the booking to a retryable
state. Money has moved; a retryable status is the double-charge bug. Instead:

```ts
} catch (error) {
  // The charge succeeded but persistence failed. Do NOT mark the booking
  // payment_failed — that re-arms a second charge. Leave the claim in
  // place (paymentStatus stays "processing") and alert ops with the
  // PaymentIntent id for manual reconciliation.
  captureNonCriticalError(error, {
    route: "/api/services/bookings",
    action: "accept_booking_post_charge_persistence_failed",
  });
  await sendOpsAlert({
    event: "service_booking_accept_post_charge_failure",
    serviceBookingId: bookingId,
    message: `Charge ${paymentIntent.id} succeeded but post-charge persistence failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
    sendEmailAlert: true,
  });
  throw new ConflictError(
    "Payment was processed but finalizing the booking failed. Support has been alerted; do not retry.",
  );
}
```

(`sendOpsAlert`'s exact parameter shape: copy the call at
`service-booking-service.ts:655–660` — `event`, `serviceBookingId`, `message`,
`sendEmailAlert`.)

**Region C — the notification.** `sendBookingAcceptedNotification` moves
_after_ Region B, converted to fire-and-forget per repo convention:

```ts
sendBookingAcceptedNotification(detail.requesterId, updated).catch((err) =>
  captureNonCriticalError(err, {
    route: "/api/services/bookings",
    action: "accept_booking_notification_failed",
  }),
);
```

The `after()` PDF-trigger block and `return updated` stay last, unchanged.

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts`
→ the test "sets payment_failed and notifies both parties on charge error"
(line 483) still passes (Region A preserves that path).

### Step 5: Update and extend tests

In `src/features/services/__tests__/service-booking-service.test.ts`:

1. **Update** the test at line 450
   ("uses retry idempotency key when booking status is payment_failed"):
   the asserted pattern `/^service-charge-book-1-retry-\d+$/` becomes the
   exact deterministic key — with the mock Stripe context returning
   `paymentMethodId: "pm"`, and a changed-PM retry setup
   (`selectedPaymentMethodId: "pm_old"` on the booking), expect
   `idempotencyKey: "service-charge-book-1-retry-pm"`.
2. **Add** (model each on the existing `acceptBooking` tests, lines 328–510):
   - _claim rejected_: `claimForAcceptance` mock resolves `false` → expect
     rejection with `ConflictError` and `mockChargeServicePayment` NOT called.
   - _pre-charge throw releases claim_: make `mockGetStripePm` resolve `null`
     (triggers `ValidationError("payment_method_required")`) → expect
     `mockBookingUpdate` called with `{ paymentStatus: null }` (claim release)
     and the error to propagate.
   - _post-charge persistence failure does not re-arm_: charge resolves, make
     `mockPaymentCreate` reject → expect `mockBookingUpdate` NOT called with
     `expect.objectContaining({ status: "payment_failed" })` after the charge,
     expect `mockSendOpsAlert` called with
     `event: "service_booking_accept_post_charge_failure"`, and the call to
     reject with `ConflictError`.
   - _notification failure does not fail acceptance_: charge + persistence
     succeed, `mockSendAccepted` rejects → `acceptBooking` resolves normally
     and `mockCaptureError` is called.
   - _charge failure records the failed PM_: charge rejects → expect
     `mockBookingUpdate` called with
     `expect.objectContaining({ status: "payment_failed", selectedPaymentMethodId: "pm" })`.
3. Wire `claimForAcceptance` into the `serviceBookingDAL` mock (done in
   Step 2) and default it to `true` in `beforeEach`.

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts`
→ all pass, including 5 new tests.

### Step 6: Full gates

**Verify**: `bun run type-check && bun run lint && bun run test:run` → all exit 0.

## Test plan

Covered by Step 5. Structural pattern: the existing `describe("acceptBooking")`
block in the same file (module-level `vi.fn()` mocks wired through
`vi.mock("@/dal", ...)`; see lines 6–106).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run type-check` exits 0
- [ ] `bun run test:run` exits 0; the 5 new acceptBooking tests exist and pass
- [ ] `grep -c "Date.now()" src/features/services/services/service-booking-service.ts`
      returns a count identical to pre-change count minus 1 (only the retry-key
      use removed)
- [ ] `grep -n "claimForAcceptance" src/dal/service-booking.dal.ts` → 1 method
- [ ] In `acceptBooking`, no code path after a resolved `chargeServicePayment`
      sets `status: "payment_failed"` (read the diff to confirm)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the "Current state" locations doesn't match the excerpts.
- You find a caller of `acceptBooking` other than
  `src/app/api/services/bookings/[id]/accept/route.ts`
  (check: `grep -rn "acceptBooking" src --include="*.ts" --include="*.tsx"`).
  A second caller may depend on the current error contract.
- The existing test "does not charge Stripe on a duplicate acceptance attempt
  (UAT-SVC-26)" (line 348) conflicts with the claim semantics in a way you
  cannot resolve by mocking `claimForAcceptance` → that test may encode a
  product expectation about duplicate accepts that needs a human call.
- You are tempted to have the post-charge catch (Region B) reset the booking
  to `payment_failed` "for UX". That is STOP condition #4 of plan 005 — it
  re-arms the double charge. Report instead.
- `paymentStatus` turns out to be consumed anywhere as a strict enum (search
  `paymentStatus ===` across `src/`) such that `"processing"` breaks a
  consumer.

## Maintenance notes

- **Residual trade-off (same as plan 005):** a post-charge persistence failure
  now leaves the booking claimed (`paymentStatus: "processing"`) and
  unacceptable until manually reconciled. That is deliberate — stuck-but-paid
  beats double-charged. The ops alert carries the PaymentIntent id. A
  stale-claim detector (mirroring
  `ServicePaymentLifecycleService.detectStaleProcessing`) is a sensible
  follow-up, deferred here to keep the money path small.
- Plan 011 (complete/cancel atomic guards) touches the same file — execute
  sequentially, never in parallel worktrees.
- Plan 008's unification design (`docs/payment-lifecycle-unification.md`)
  baselines on 004/005 partial state; whoever executes it should re-baseline
  on this plan's claim semantics too.
- Reviewer focus: the Region A/B boundary — exactly one awaited call
  (`chargeServicePayment`) decides which failure semantics apply.
