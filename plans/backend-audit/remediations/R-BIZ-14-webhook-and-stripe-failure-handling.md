# Plan R-BIZ-14: Classify indeterminate Stripe failures, fix webhook state-handling gaps, add out-of-order/duplicate event tests

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/services/stripe/webhook-handlers.ts src/services/stripe/rental-payments.ts src/services/stripe/deposit-hold.ts src/services/stripe/service-payments.ts src/dal/payment.dal.ts src/dal/payment-lifecycle.dal.ts src/dal/errors.ts src/lib/api/route-helpers.ts src/features/rentals/services/rental-service.ts src/features/services/services/service-booking-service.ts src/features/rentals/services/cancellation-service.ts src/features/payments/lib/earnings.ts src/features/payments/components/payment-history-item.tsx src/db/schemas/_enums.ts src/app/api/rentals/\[id\]/approve/route.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: MED
- **Depends on**: none. Independent of
  [R-ARCH-04](R-ARCH-04-durable-jobs-and-reconciliation.md) — see that plan's
  Decision 5 for why BIZ-11 is split between the two.
  **Landing order (review 2026-09-25): land this before
  [R-CONC-04](R-CONC-04-freeze-aware-payouts-and-chargeback-after-payout.md).**
  Step 3 widens the rental payout finder's refunded guard, and CONC-04
  Step 6 copies that guard into `claimForProcessing`. If CONC-04 lands
  first, Step 3 here must widen **both** the finder and the claim (`grep -n
"refunded" src/dal/payment-lifecycle.dal.ts` → every hit). Both plans edit
  `webhook-handlers.ts`, in different handlers. R-ARCH-04 Part D's
  reconciliation reads `partially_refunded`, so land Part D after this plan.
  **This plan owns the dead `payment_intent.canceled` handler (Step 4);**
  R-DB-04 defers to it.
- **Category**: business logic / concurrency / testing
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: BIZ-11 (the charge-classification half only — "indeterminate
  Stripe failures are recorded as declines and retried under new idempotency
  keys, possible double charge"; the payout-retry half is R-ARCH-04 Part E);
  BIZ-14 (partial refunds recorded as full, out-of-order webhook events, the
  dead deposit-cancel handler, no `refund.failed` handling); TEST-19 (no
  tests for out-of-order or duplicate webhook events).

## Why this matters

Four independent gaps, found by re-reading every code path the two findings
name against live code (not the audit's line numbers, which predate this
commit):

1. **A network error or Stripe 5xx during a charge is indistinguishable from
   a card decline today**, in both `RentalService.approveRentalRequest` and
   `ServiceBookingService.acceptBooking`. Either is recorded as
   `paymentStatus: 'failed'`, which makes the row retryable — and a retry
   always uses a **new** Stripe idempotency key
   (`rental-charge-{id}-retry-${Date.now()}` for rentals;
   `service-charge-{id}-retry-{paymentMethodId}` for services). If the
   original request actually reached Stripe and created a charge despite the
   error we saw, the retry is a second, real charge. A card decline
   (`StripeCardError`) is a _definite_ "this card was not charged" outcome —
   safe to mark failed and let a new attempt through. A timeout or 5xx is
   _indeterminate_ — Stripe's own idempotency key would prevent a duplicate
   **if the retry reused it**, but nothing here does, because the code can't
   tell the two cases apart.
2. **Partial refunds are recorded as full.** `PaymentDAL.recordRefund`
   unconditionally sets `status: "refunded"` regardless of how much was
   refunded. A 50% late-cancellation refund (a normal, frequent path) already
   marks the payment fully refunded today.
3. **The deposit-hold's own `payment_intent.canceled` handler can never
   fire**, because the metadata it keys on is never actually sent to Stripe —
   see Current state. R-PERF-05 fixed the handler's `placing`-state race but
   didn't touch this; the handler still can't be reached at all.
4. **No `refund.failed` handling, and `payment_intent.succeeded` can flip a
   refunded payment back to `succeeded`** if a delayed or retried webhook
   event arrives after the refund. Nothing tests any of this (TEST-19).

## Current state

### 1. Charge failure classification (BIZ-11)

- `src/features/rentals/services/rental-service.ts` (charge call ~line 578,
  failure branch ~605-660): `tryCatch(chargeRentalPayment(...))`, one
  same-key retry only for `isRetryablePaymentError` (a **pre-response**
  retry inside the same call, safe — same idempotency key both times), then
  on any remaining error: `rentalDAL.updateRentalRequestPaymentStatus(rentalId, {paymentStatus: "failed", paymentFailureReason: errorMessage})`
  unconditionally, followed by both parties' "payment failed" notifications
  and `return {success:false, paymentFailed:true, error: errorMessage}`. A
  second branch a few lines down does the same
  (`rentalPaymentResult.data`'s `status !== "succeeded"`) when Stripe
  returned a resolved-but-not-succeeded PaymentIntent (e.g. `processing`,
  realistic for ACH/Link payment methods per the concurrency findings' open
  question 4) — also marked `failed` unconditionally.
- `src/features/services/services/service-booking-service.ts` — the "Region
  A" catch block (~line 420-483) around `chargeServicePayment` does the same
  thing: any thrown error →
  `serviceBookingDAL.update(bookingId, {status: "payment_failed", paymentStatus: "failed", selectedPaymentMethodId: paymentMethodId})`,
  two notifications, then `throw new ServiceBookingPaymentFailedError(...)`
  (400). The F12 guard (lines ~360-369) blocks a retry on the _same_ card
  that just failed, but a retry on a **different** card uses a brand-new key
  (`service-charge-{id}-retry-{newPaymentMethodId}`) — no protection if the
  original, indeterminate attempt actually went through.
- `src/services/stripe/rental-payments.ts` already has
  `isRetryablePaymentError` (used only for the one same-request retry, not
  for this classification) and `getPaymentErrorMessage`, both imported by
  `service-booking-service.ts` too (shared file, confirmed:
  `grep -n "from \"@/services/stripe/rental-payments\"" src/features/services/services/service-booking-service.ts`).
- There is already an hourly detector for exactly the state this plan will
  leave a row in: `src/features/admin/services/stale-processing-detection-service.ts`
  `detectStaleChargeClaims` (15-minute threshold) alerts when a rental
  request or service booking is stuck with `paymentStatus = 'processing'`,
  telling ops to check Stripe by metadata and resolve manually. **This plan
  reuses that existing detector as the safety net** — it does not build a
  new one. **Verified in review: it is alert-only.** It never writes
  `paymentStatus` (its doc comment: "Alert only: the charge may have
  succeeded... The claim is left in place"). It runs in the **hourly** job
  (`cron-jobs.yml`, step `detect-stale-charge-claims`), so the backstop
  fires within 15-75 minutes, and it re-alerts every hour until someone
  resolves the row. Nothing else auto-releases a `processing` claim either:
  expiry (`markRequestExpired`, `findExpiredPendingRequests`), renter cancel,
  owner decline (`notPaymentProcessing`, `rentals.dal.ts:498`), account
  deletion (`account-deletion.dal.ts:565-608`), service expiry
  (`markExpired` allowlists `null|failed`) and service cancel
  (`blockWhilePaymentProcessing`) all refuse it. Leaving an indeterminate
  claim in `processing` therefore holds the dates
  (`reserveDatesForApproval` treats `pending`+`processing` as a conflict)
  and can't bring back a double charge.
- Existing admin tooling has no route to reset a rental request's or service
  booking's `paymentStatus` back from `'processing'` (confirmed:
  `grep -rln "paymentStatus.*processing" src/features/admin src/app/api/admin`
  finds nothing) — today that's a manual DB fix by an engineer following the
  stale-claim alert's own instructions. This plan doesn't add one; see
  Maintenance notes.

### 2. Partial refunds recorded as full (BIZ-14)

- `src/dal/payment.dal.ts:544-566` `recordRefund` — unconditional
  `status: "refunded"`. Two callers pass a genuinely partial amount:
  `src/features/rentals/services/cancellation-service.ts:196` and `:435`
  (the <24h renter tier refunds 50%, and no-show refunds vary). The third
  caller, `webhook-handlers.ts:302` (`charge.refunded`), passes Stripe's
  **cumulative** `charge.amount_refunded`, which is also not necessarily the
  full charge amount.
- `src/db/schemas/_enums.ts:35-42` `paymentStatusEnum` has no
  `partially_refunded` value.
- **Callers that read `payments.status === "refunded"` and must be updated
  to also treat `"partially_refunded"` the same way** (found by
  `grep -rn '"refunded"' src --include="*.ts" | grep -v test`, excluding
  false positives that read an unrelated _transfer_-status synthetic value):

  | File:line                                                                  | What it does today                                                                  | Why it must also match `partially_refunded`                                                                                                                                                          |
  | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `dal/payment-lifecycle.dal.ts:477`                                         | `findEligibleForPayout`'s `NOT EXISTS (... payments.status = 'refunded')` (CONC-02) | **Highest priority.** This is the guard that stops an owner payout from a refunded charge. A partial refund must block payout exactly as a full one does — Stripe's transfer cap doesn't care which. |
  | `features/rentals/services/cancellation-service.ts:158`                    | `alreadyRefunded = ctx.paymentStatus === "refunded"` (skip re-refunding)            | A prior _partial_ refund (e.g. an earlier no-show adjustment) must also be recognized, or this cancels straight into a second refund attempt.                                                        |
  | `features/rentals/services/cancellation-service.ts:401`                    | Refuses a no-show refund when `ctx.paymentStatus === "refunded"`                    | Same idempotency reasoning — a partially refunded payment shouldn't be no-show-refunded again as if untouched.                                                                                       |
  | `dal/payment.dal.ts:151` (`refundedButRelevant`, inside `getUserEarnings`) | `eq(payments.status, "refunded")`                                                   | Correctness only (earnings-feed inclusion rule) — a partial refund with a real transfer/dispute is just as "relevant" as a full one.                                                                 |
  | `features/payments/lib/earnings.ts:188`                                    | `refundAmount: row.paymentStatus === "refunded" ? row.refundAmount : null`          | Cosmetic only — a partially refunded payment's `refundAmount` should still surface, not be hidden.                                                                                                   |

  (`earnings.ts`'s separate `EarningsTransferStatus`/`EARNINGS_TRANSFER_STATUSES`
  "refunded" value, lines 82-90 and 172, is a _different_, synthetic concept
  derived from `ownerTransferStatus`/`serviceTransferStatus`, not
  `payments.status` — confirmed by reading its surrounding comment; **do not
  touch it**, it's unrelated to this migration.)

  **Also found in review (2026-09-25):**
  - `payments.status` **does** reach mobile. `GET /api/payments/history`
    (`src/features/payments/lib/payment-history.ts:63-68` `asPaymentStatus`)
    passes through any value in `paymentStatusEnum.enumValues`, so
    `partially_refunded` goes out as `status`. Mobile's `paymentStatusSchema`
    (`hoador-mobile/src/api/contract/enums.ts:66-73`) is a `tolerantEnum`, so
    today's binaries render "unknown" and don't fail the parse. That needs a
    Mobile follow-up row (see Mobile compatibility).
  - `rental_requests.payment_status` uses the **same** `payment_status` enum
    (`rentals.schema.ts:78`). Nothing writes `refunded` or
    `partially_refunded` there today, so nothing changes.
  - `src/features/payments/components/payment-history-item.tsx:31-65`
    (`statusBadgeVariant`, `formatStatus`) falls to `default` and prints the
    raw `partially_refunded`. Cosmetic; add a case (Step 3).
  - The service payout finder (`service-payment-lifecycle.dal.ts`
    `findEligibleForPayout`) has **no** payments-status guard, and must not
    get one. Service partial dispute refunds lower `providerPayout` and then
    expect the cron to pay the rest. Only the **rental** finder (and, after
    R-CONC-04, the rental claim) blocks on a refund.

### 3. The dead deposit-cancel webhook handler (BIZ-14 / BIZ-18)

- `src/services/stripe/webhook-handlers.ts:205-234` `handlePaymentIntentCanceled`
  reads `pi.metadata?.rentalId` and returns early if absent (`:212-215`).
  R-PERF-05 (2026-09-24) added the `placing`-state check right after that —
  confirmed present at `:221-224` — but the function still can never get
  past the `rentalId` check, because:
- `src/services/stripe/deposit-hold.ts` `PlaceDepositHoldParams.metadata`
  declares `rentalId` (`:7-13`), but `placeDepositHold` (`:33-56`) calls
  `authorizeSecurityDeposit` with a hand-built object that drops it:
  `{ type: "security_deposit", rentalRequestId, listingId, renterId }`.
  `rental-payments.ts`'s `SecurityDepositMetadata` (`:16-21`) has no
  `rentalId` field either.
- **Forwarding `rentalId` would NOT fix the handler (review 2026-09-25).**
  The immediate-hold path (`rental-service.ts:735-748`, the common case for
  a rental starting within 48h) runs **before** the `rentals` row exists,
  and passes `rentalId: rentalRequest.id`, which is the _request_ id.
  `rentals.id` is a separate `defaultRandom()` uuid (`rentals.schema.ts:139`).
  Lifecycle rows key on `rentals.id`, so `getByRentalId(<request id>)`
  returns null and the handler stays dead for immediate holds. Only the
  cron and retry paths (`payment-lifecycle-service.ts:330-336, 659-665`) pass
  the real `rentals.id`.
- **`rentalRequestId` is already in every hold's metadata**, from every
  path, including holds placed before this deploy. The handler can resolve
  `rentalRequestId → rentalDAL.getRentalByRequestId (rentals.dal.ts:2162) →
rentals.id → lifecycle` with no Stripe-side change at all.
- **Our own releases also fire `payment_intent.canceled`.**
  `releaseSecurityDeposit` (payout cron, cancel's `settleDepositOnCancel`,
  admin `releaseDeposit`) calls `paymentIntents.cancel(id)` with no reason,
  so Stripe sends the event with `cancellation_reason: null`. Once the
  handler is reachable, a release whose webhook beats the `released` DB
  write would mark the row `expired` and page ops with "Deposit hold
  expired". The handler must skip our own cancellations.

### 4. Missing `refund.failed`, and `payment_intent.succeeded` can undo a refund

- `src/app/api/stripe/webhooks/route.ts` / `webhook-handlers.ts:22-73`'s
  `switch` has no `case "refund.failed"` — Stripe's own recommended handling
  for an async refund that later fails (e.g. the destination account closed)
  is simply never run; there's no ops alert, nothing.
- `webhook-handlers.ts:134-175` `handlePaymentIntentSucceeded`:
  `if (existingPayment.status !== "succeeded") { updatePaymentStatus(id, "succeeded", ...) }`.
  This transitions **from any status**, including `refunded` — a delayed or
  Stripe-retried `payment_intent.succeeded` event arriving after a refund
  already landed flips the payment back to `succeeded`, silently erasing the
  refund record from the payment's status (the `refundAmount`/`refundedAt`
  columns are untouched, but `status` is now wrong, and every consumer above
  reads `status`, not those columns, to decide "was this refunded").
- No event-id dedupe exists in `handleWebhookEvent` — **but the machinery to
  add one cheaply already exists**: it writes an
  `auditLogDAL.create({entityType: "webhook", entityId: event.id, action: "webhook.processed", ...})`
  row at the end of every successful run (`:100-105`), and `AuditLogDAL`
  already has a generic `exists(filter)` method
  (`src/dal/audit-log.dal.ts:60-88`) built exactly for "has this already
  happened" checks (its own doc comment cites the evidence-deadline reminder
  as a precedent). No new table or column is needed.

## Decisions for the maintainer

**1. Classification: definite failures vs indeterminate ones.** Add one
shared classifier next to `isRetryablePaymentError` in `rental-payments.ts`
(already imported by both call sites):

```ts
/**
 * True when Stripe's response leaves us unable to prove the charge did NOT
 * happen (BIZ-11). A card decline, an invalid request, an auth failure or a
 * rate limit are all definite: the request never became a charge, so it's
 * safe to mark the attempt failed and let a new one through. A 5xx or a
 * connection error means our process never learned the outcome — Stripe may
 * have created the charge anyway. Treat anything not in the definite list
 * (including a non-Stripe Error, e.g. a thrown timeout) as indeterminate.
 */
export function isIndeterminatePaymentError(error: unknown): boolean {
  // 409: another request with this idempotency key is still in flight at
  // Stripe (`idempotency_key_in_use`, sent as an invalid_request_error). The
  // same-key pre-response retry in rental-service/withPaymentRetry hits
  // exactly this when the first attempt timed out client-side but is still
  // running, and that first attempt may yet create the charge.
  if (
    error instanceof Stripe.errors.StripeError &&
    (error.statusCode === 409 || error.code === "idempotency_key_in_use")
  ) {
    return true;
  }
  if (
    error instanceof Stripe.errors.StripeCardError ||
    error instanceof Stripe.errors.StripeInvalidRequestError ||
    error instanceof Stripe.errors.StripeAuthenticationError ||
    error instanceof Stripe.errors.StripePermissionError ||
    error instanceof Stripe.errors.StripeRateLimitError
  ) {
    return false;
  }
  // StripeAPIError (5xx), StripeConnectionError, StripeIdempotencyError,
  // and anything that isn't a Stripe error (e.g. a thrown timeout).
  return true;
}
```

(Review 2026-09-25: added the 409/`idempotency_key_in_use` case. The draft
would have classed it as a definite `StripeInvalidRequestError`, marked the
row `failed`, and let the next attempt charge again under a new key. Also
added `StripePermissionError`, a 403 that never executes, to the definite
list.)

**Recommendation: on an indeterminate error, do not write `paymentStatus:
'failed'`. Leave the row exactly where the claim left it (`'processing'`),
send an ops alert immediately (don't wait for the hourly detector — the
detector is the 15-minute backstop for when the alert itself is lost, not
the primary signal), and return/throw a distinct "can't confirm, don't
retry" result** rather than the existing "payment failed" one. No auto
notification to either party (the existing "please update your payment
method" copy would be actively misleading if the charge in fact succeeded).
Steps below implement this.

**2. Response shape for the rental route's indeterminate case: additive.**
`POST /api/rentals/[id]/approve` gains one new possible shape,
`{error, code: "PAYMENT_INDETERMINATE", indeterminate: true}` at `409`,
alongside the existing `{error, paymentFailed: true}` at `400`. (Review:
every other 409 this route returns now carries a stable `code`, e.g.
`REQUEST_NOT_PENDING` and `DATES_UNAVAILABLE`, and mobile's `ApiErrorCode`
keys on it. So this one gets the **same** code as the service accept case,
Decision 3, and the app handles both with one branch.) Checked against
`hoador-mobile/src/api/errors.ts`: `apiFetch` throws on any non-2xx and the
app's error classifier already has a generic bucket for an unrecognized 409
(the same "conflict" classification other plans' new 409s fall into before
a release adds specific copy — e.g. R-BIZ-09's `BOOKING_START_PASSED` row).
No release is required before this ships; a future one can add specific
copy. **Do not** reuse `paymentFailed: true` for this case — that field
already drives "The renter has been notified to update their payment
method" copy in the route, which would be wrong here.

**3. `ServiceBookingPaymentIndeterminateError` — new `DALError` subclass,
409, code `PAYMENT_INDETERMINATE` (shared with the rental route), not in the
Sentry skip-list.** Modeled on
`ServiceBookingPaymentFailedError` (see `src/dal/errors.ts:44-49`), but
**not** added to `shouldCaptureError`'s skip-list in
`route-helpers.ts` — unlike a 400 "the card was declined" (an expected user
outcome), an indeterminate Stripe failure is an operational incident worth a
Sentry event in addition to the ops-alert email this plan sends directly.

**4. `partially_refunded` — add it, and fix every consumer, not just
`recordRefund`.** The alternative (leave the enum alone, only track cents
more precisely) would leave BIZ-14's core complaint — "a partial refund
reads as done" — unfixed for every consumer of `payments.status`, which is
the whole point of the finding. The blast radius is small and enumerated
above (five call sites, one of which — the CONC-02 payout guard — this
plan **must** get right). Recommendation: proceed with the full list in
"Current state" §2.

**5. Event-id dedupe: reuse `auditLogDAL.exists`, don't add a table.** A
dedicated `processed_webhook_events` table with a unique constraint would
also work, but `audit_logs` already records exactly this fact per event and
already has the lookup method. Recommendation: check-then-process at the top
of `handleWebhookEvent`, accepting the (already-present, already-accepted-
elsewhere-in-this-codebase) check-then-act race between two truly
simultaneous deliveries of the same event id — Stripe does not deliver the
same event concurrently in practice, and every handler is independently
state-idempotent regardless (see "Verified clean" in the concurrency
findings), so this is a strict improvement with no new risk, not a
safety-critical CAS.

## Commands

| Purpose            | Command                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck          | `bun run type-check`                                                                                                                                                                          |
| Lint               | `bun run lint`                                                                                                                                                                                |
| Generate migration | `bun run db:generate`                                                                                                                                                                         |
| Targeted tests     | `bun run test:run src/services/stripe src/dal/__tests__/payment.dal.test.ts src/dal/__tests__/payment-lifecycle.dal.test.ts src/features/rentals src/features/services src/features/payments` |
| Real-DB tests      | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                     |

## Scope

**In scope**: `src/db/schemas/_enums.ts` (+ generated migration);
`src/services/stripe/rental-payments.ts` (new `isIndeterminatePaymentError`);
`src/services/stripe/webhook-handlers.ts` (dedupe, succeeded-guard,
`refund.failed`, the `payment_intent.canceled` lookup); `src/dal/payment.dal.ts` (`recordRefund`,
`refundedButRelevant`); `src/dal/payment-lifecycle.dal.ts`
(`findEligibleForPayout`'s NOT EXISTS); `src/dal/errors.ts`
(`ServiceBookingPaymentIndeterminateError`); `src/lib/api/route-helpers.ts`
(map the new error); `src/features/rentals/services/rental-service.ts`
(charge + PI-status failure branches); `src/app/api/rentals/[id]/approve/route.ts`
(the new response branch); `src/features/services/services/service-booking-service.ts`
(Region A); `src/features/rentals/services/cancellation-service.ts` (two
"already refunded" checks); `src/features/payments/lib/earnings.ts`
(`refundAmount` display); `src/features/payments/components/payment-history-item.tsx`
(status label); tests for all of the above. **Not** `deposit-hold.ts` or
`SecurityDepositMetadata` (Step 4 was rewritten in review so it needs no
Stripe-side change).

**Out of scope**: BIZ-11's payout-retry half (R-ARCH-04 Part E); BIZ-13
(chargeback-after-payout); any change to the refund **amount** calculators
(`refund-calculations.ts`, `booking-cancellation.ts`) — this plan only fixes
how the _result_ of a refund is recorded; `charge.refund.updated` (Stripe's
newer Refunds-API event) — not added, since nothing in this codebase creates
`Refund` objects directly outside the `refunds.create` calls already
covered by `refund.failed`; see Maintenance notes.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Step 1: `partially_refunded` enum value

In `src/db/schemas/_enums.ts`, add to `paymentStatusEnum` (after
`"refunded"`, order doesn't matter for a Postgres enum but keep it readable):

```ts
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "completed",
  "failed",
  "refunded",
  "partially_refunded", // BIZ-14: a refund landed but didn't cover the full amount
]);
```

Generate: `bun run db:generate` (confirm the next free migration number
first — take the next free number after DB-02's baseline if it has landed,
otherwise after `0077`; see the cross-plan decision in the roadmap). Confirm
the output is a single `ALTER TYPE "payment_status" ADD VALUE 'partially_refunded'`.

**Verify**: `bun run type-check` → exit 0; one migration file with exactly that statement.

### Step 2: Fix `recordRefund` to distinguish full vs partial

In `src/dal/payment.dal.ts`, keep `recordRefund`'s builder `UPDATE` and
signature (so **no caller changes are needed**) and compute only `status`
in SQL, from the payment's own `amount` column:

```ts
await this.db
  .update(payments)
  .set({
    // Full when the (cumulative, from the webhook) refund covers the charge.
    status: sql`CASE WHEN ${data.refundAmount}::numeric >= ${payments.amount}
                     THEN 'refunded'::payment_status
                     ELSE 'partially_refunded'::payment_status END`,
    refundedAt: data.refundedAt,
    refundAmount: data.refundAmount,
    refundReason: data.refundReason,
    updatedAt: new Date(),
  })
  .where(eq(payments.id, paymentId));
```

(Review: the draft used a raw `db.execute` UPDATE. Keeping the builder
keeps drizzle's column mapping and Date serialization, and only the CASE is
raw.) Confirm `sql` is in the file's `drizzle-orm` import; add it if not.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Update the `"refunded"` consumers listed in Current state §2

- `payment-lifecycle.dal.ts:477` — change
  `sql`... AND ${payments.status} = ${"refunded"})`` to
`sql`... AND ${payments.status} IN ('refunded', 'partially_refunded'))``
  (or `inArray` if rewriting as a subquery builder instead of raw SQL — keep
  whichever style the surrounding `NOT EXISTS` already uses). **If R-CONC-04
  has already landed**, its `claimForProcessing` carries a copy of this
  guard. Widen it too, in the same edit, so the finder and the claim never
  disagree. Don't add a payments guard to the **service** finder or claim
  (Current state §2).
- `payment.dal.ts:151` `refundedButRelevant` — change
  `eq(payments.status, "refunded")` to
  `inArray(payments.status, ["refunded", "partially_refunded"])`.
- `cancellation-service.ts:158` — change
  `ctx.paymentStatus === "refunded"` to
  `ctx.paymentStatus === "refunded" || ctx.paymentStatus === "partially_refunded"`.
  A cancel after a **partial** out-of-band refund then skips its own refund
  (a full `calc.refundAmountCents` on top could over-refund, and Stripe
  rejects anything past the remaining balance). The renter may then be owed
  a top-up. So when `ctx.paymentStatus === "partially_refunded"`, also send
  `sendOpsAlert({ event: "cancel_after_partial_refund", rentalId: ctx.rentalId, metadata: { rentalRequestId, cancelRefundDue: calc.refundAmountCents / 100 }, ... })`
  so ops can top up the difference by hand.
- `cancellation-service.ts:401` — same change.
- `earnings.ts:188` — change
  `row.paymentStatus === "refunded" ? row.refundAmount : null` to
  `row.paymentStatus === "refunded" || row.paymentStatus === "partially_refunded" ? row.refundAmount : null`.

- `payment-history-item.tsx` — add `case "partially_refunded":` to
  `statusBadgeVariant` (`"outline"`) and `formatStatus`
  (`"Partially refunded"`).

Do **not** touch `earnings.ts:82-90,172` (`EARNINGS_TRANSFER_STATUSES`,
`toEarningsItem`'s `stored === "completed" && !transferId`) — confirmed
unrelated in Current state, a different, transfer-derived concept.

**Verify**: `bun run type-check` → exit 0 (the `ctx.paymentStatus`/
`row.paymentStatus` fields' TypeScript types are derived from the schema
enum, so they'll already accept the new literal — this step is a logic fix,
not a compile-error fix; confirm by re-reading each site rather than relying
on the compiler to catch a miss).

### Step 4: Make the `payment_intent.canceled` deposit handler reachable (owns BIZ-18 #2)

**Rewritten in review (2026-09-25).** The draft forwarded `rentalId` into
the hold's metadata, but the immediate-hold path passes the _request_ id
under that key (Current state §3), so the handler would have stayed dead
for the most common hold. Key the handler on `rentalRequestId` instead.
Every hold already carries it, including holds placed before this deploy.
No change to `deposit-hold.ts` or `rental-payments.ts`. (R-DB-04 Step 7
used to forward `rentalId`; it now defers to this step.)

In `webhook-handlers.ts` `handlePaymentIntentCanceled` (`:205-234`),
replace the `rentalId` lookup and the write:

```ts
if (pi.metadata?.paymentType !== "security_deposit_hold") return;

// Our own releases (payout cron, cancel, admin release) cancel with no
// reason. Only a Stripe-initiated cancellation (an authorization that
// expired) is news; acting on our own would race the `released` write and
// page ops for nothing.
if (pi.cancellation_reason == null) {
  getLogger().info(
    { paymentIntentId: pi.id },
    "payment_intent.canceled: our own release — no action",
  );
  return;
}

const rentalRequestId = pi.metadata?.rentalRequestId;
if (!rentalRequestId) return;
const rental = await rentalDAL.getRentalByRequestId(rentalRequestId);
if (!rental) return; // the hold outlived its request; nothing to update

// CAS: only a hold we still believe is live can expire. Leaves `placing`
// (CONC-10), `released`, `captured` and every other state alone, which
// replaces the old read-then-write `!== released && !== placing` check.
const expired = await paymentLifecycleDAL.updateDepositHoldStatus(
  rental.id,
  "expired",
  { fromStatus: ["held", "release_failed"] },
);
if (expired) {
  await sendOpsAlert({
    event: "deposit_hold_expired_webhook",
    rentalId: rental.id,
    message: `Deposit hold expired (detected via webhook): PaymentIntent ${pi.id} (${pi.cancellation_reason})`,
    sendEmailAlert: true,
  });
}
```

Add `rentalDAL` to the file's `@/dal` import. Also check the hold is the
rental's current one. `getRentalByRequestId` (`rentals.dal.ts:2162`)
selects only `{ id }`, so read
`rentalDAL.getSecurityDepositAuthId(rental.id)` (`:3200`). If it's set and
`!== pi.id`, return: an older, superseded hold expiring says nothing about
the live one.

`release_failed` is in `fromStatus` on purpose. A release that errored
locally but went through at Stripe comes back to us as this event. It
arrives with `cancellation_reason: null`, though, so the null-skip above
drops it and `monitor-deposit-expiry` stays its backstop, as today. Say so
in a code comment rather than special-casing it.

**Verify**: `bun run type-check` → exit 0; `grep -n "rentalRequestId" src/services/stripe/webhook-handlers.ts` shows the new lookup.

### Step 5: Webhook event-id dedupe

In `webhook-handlers.ts`'s `handleWebhookEvent`, right after the initial
`getLogger().info(...)` and before the `try`/`switch`:

```ts
const alreadyProcessed = await auditLogDAL.exists({
  entityType: "webhook",
  entityId: event.id,
  action: "webhook.processed",
});
if (alreadyProcessed) {
  getLogger().info(
    { message: "webhook.duplicate_skipped", eventId: event.id, eventType },
    "Stripe webhook already processed — skipping",
  );
  return;
}
```

`auditLogDAL` is already imported in this file. This makes a Stripe retry of
an already-fully-processed event a no-op before any handler runs (a
`webhook.failed` audit row from a _previous, failed_ attempt does **not**
match `action: "webhook.processed"`, so a genuinely-still-failing event
keeps retrying as today).

**Verify**: `bun run type-check` → exit 0.

### Step 6: Fix the out-of-order `succeeded` transition

In `handlePaymentIntentSucceeded`, change:

```ts
if (existingPayment.status !== "succeeded") {
  await paymentDAL.updatePaymentStatus(existingPayment.id, "succeeded", {
    paidAt: existingPayment.paidAt ?? new Date(),
  });
}
```

to:

```ts
// Only ever advance INTO succeeded from a state that hasn't resolved yet.
// A delayed or Stripe-retried event landing after a refund must not erase it
// (BIZ-14/TEST-19) — Stripe doesn't guarantee webhook delivery order.
if (
  existingPayment.status === "pending" ||
  existingPayment.status === "processing" ||
  existingPayment.status === "failed"
) {
  await paymentDAL.updatePaymentStatus(existingPayment.id, "succeeded", {
    paidAt: existingPayment.paidAt ?? new Date(),
  });
}
```

**Same bug in the other direction (found in review):**
`handlePaymentIntentFailed` (`webhook-handlers.ts:177-203`) writes
`"failed"` from **any** status except `failed`, and then sends the payer a
"Payment Failed" notification. A PaymentIntent can fail its first
confirmation and then succeed, so a delayed `payment_intent.payment_failed`
landing after the success (or after a refund) would mark a paid, or
refunded, payment `failed` and tell the renter to update their card. Guard
it the same way: only write and notify when
`existingPayment.status === "pending" || existingPayment.status === "processing"`.
Add a test: `status: "succeeded"` → no write, no notification.

**Verify**: `bun run type-check` → exit 0.

### Step 7: `refund.failed` handler

In `src/app/api/stripe/webhooks/route.ts`'s import — no change needed, the
switch lives in `webhook-handlers.ts`. Add a case:

```ts
case "refund.failed":
  await handleRefundFailed(event.data.object as Stripe.Refund);
  break;
```

New handler in `webhook-handlers.ts`:

```ts
/**
 * A refund we (or Stripe) initiated failed asynchronously — e.g. the
 * destination card or bank account can no longer accept funds. Nothing here
 * changes payment state automatically: we don't know if a different refund
 * path already fixed it, and guessing wrong risks a double refund attempt.
 * Alert ops with everything needed to look it up and decide manually.
 */
async function handleRefundFailed(refund: Stripe.Refund): Promise<void> {
  const chargeId =
    typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;

  await sendOpsAlert({
    event: "refund_failed_webhook",
    message: `A Stripe refund failed asynchronously: refund ${refund.id}, reason ${refund.failure_reason ?? "unknown"}. Reconcile manually — do not re-issue automatically.`,
    metadata: {
      refundId: refund.id,
      chargeId,
      paymentIntentId,
      amount: refund.amount,
      failureReason: refund.failure_reason,
    },
    sendEmailAlert: true,
  });

  await tryCatch(
    auditLogDAL.create({
      entityType: "webhook",
      entityId: refund.id,
      action: "webhook.refund_failed",
      metadata: {
        chargeId,
        paymentIntentId,
        amount: refund.amount,
        failureReason: refund.failure_reason,
      },
    }),
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 8: Charge-failure classification — rentals

In `rental-service.ts`'s charge-error branch (the `rentalPaymentResult.error`
case), before the existing `updateRentalRequestPaymentStatus(..., {paymentStatus: "failed", ...})`
call, branch on the classifier:

```ts
if (isIndeterminatePaymentError(rentalPaymentResult.error)) {
  await sendOpsAlert({
    event: "rental_charge_indeterminate",
    rentalId,
    message: `Charge for rental request ${rentalId} returned an indeterminate error (${errorMessage}). The claim is left in 'processing'. Search Stripe PaymentIntents for metadata rentalRequestId=${rentalId} (idempotency key ${idempotencyKey}) before resolving. Do not simply retry.`,
    metadata: { idempotencyKey, errorMessage },
    sendEmailAlert: true,
  });
  return {
    success: false,
    indeterminate: true,
    error:
      "We couldn't confirm whether this payment went through. Support has been notified and will follow up shortly — please don't try approving again until you hear back.",
  };
}
```

placed as an early return **before** the existing `updateRentalRequestPaymentStatus`
write, the audit-log `payment.failed` row, and both notification sends — none
of those should run for the indeterminate case (leaving `paymentStatus`
untouched at `'processing'`, which the claim already set).
`ApproveRentalRequestResult` (`rental-service.ts:104-119`) is a discriminated
union, so add a member rather than an optional flag:
`| { success: false; indeterminate: true; paymentFailed?: false; error: string }`,
and give the existing two failure members `indeterminate?: false` so the
route can narrow on it. `errorMessage` is computed _above_ the existing
`updateRentalRequestPaymentStatus` call (`getPaymentErrorMessage(...)`), so
place the new block right after it.

Do the identical thing in the second failure branch (the resolved-but-not-
succeeded `rentalPaymentIntent.status !== "succeeded"` case), but classify by
**status string**, not by a thrown error — treat `status === "processing"`
as indeterminate (a real possibility per the concurrency findings' open
question on ACH/Link methods) and every other non-succeeded status
(`requires_payment_method`, `requires_action`, `canceled`) as definite,
using the same `sendOpsAlert` shape with the PaymentIntent id.

**Verify**: `bun run type-check` → exit 0.

### Step 9: Wire the rental route's new response shape

In `src/app/api/rentals/[id]/approve/route.ts`, in the `!data.success`
branch, add the indeterminate case before the existing `paymentFailed`
branch:

```ts
if (!data.success) {
  if (data.indeterminate) {
    return NextResponse.json(
      { error: data.error, code: "PAYMENT_INDETERMINATE", indeterminate: true },
      { status: 409 },
    );
  }
  return NextResponse.json(
    {
      error: data.paymentFailed
        ? `Payment failed: ${data.error}. The renter has been notified to update their payment method.`
        : data.error,
      paymentFailed: data.paymentFailed ?? false,
    },
    { status: data.paymentFailed ? 400 : 500 },
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 10: Charge-failure classification — services

Add `ServiceBookingPaymentIndeterminateError` to `src/dal/errors.ts`, next to
`ServiceBookingPaymentFailedError`:

```ts
/**
 * Thrown when a service booking accept charge returns an indeterminate Stripe
 * error (BIZ-11) — we cannot prove the charge did not happen. The booking is
 * left claimed (`paymentStatus: 'processing'`) rather than reset to
 * `payment_failed`, so a retry can't create a second, real charge under a new
 * idempotency key. Not in `shouldCaptureError`'s skip-list: this is an
 * operational incident, not an expected user outcome.
 */
export class ServiceBookingPaymentIndeterminateError extends DALError {
  constructor(message: string) {
    super(message, "PAYMENT_INDETERMINATE", 409);
    this.name = "ServiceBookingPaymentIndeterminateError";
  }
}
```

In `route-helpers.ts`, **the generic `DALError` branch drops `code`**
(verified in review, `:297-302`: it returns `{ error: error.message }`
only). Add an explicit branch **before** the generic `ConflictError`/`DALError`
branches, next to the other coded 409s (`RentalRequestNotPendingError`,
`CounterpartyUnavailableError`, ~`:160-180`):

```ts
if (error instanceof ServiceBookingPaymentIndeterminateError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.statusCode },
  );
}
```

Do **not** add it to `shouldCaptureError`'s skip-list (Decision 3). Its
Sentry event is intended. Extend `route-helpers`' own test (the one that
pins the skip list and the coded bodies) with this class.

In `service-booking-service.ts`'s Region A catch block, branch the same way
as Step 8, before the existing `serviceBookingDAL.update(...)` call:

```ts
if (isIndeterminatePaymentError(error)) {
  const message = getPaymentErrorMessage(error);
  await sendOpsAlert({
    event: "service_charge_indeterminate",
    serviceBookingId: bookingId,
    message: `Charge for booking ${bookingId} returned an indeterminate error (${message}). The claim is left in 'processing' — check Stripe for PaymentIntent metadata bookingId=${bookingId} before resolving. Do not simply retry.`,
    metadata: { chargeIdempotencyKey, message },
    sendEmailAlert: true,
  });
  await auditLogDAL.create({
    entityType: "service_booking",
    entityId: bookingId,
    action: "service_booking.payment_indeterminate",
    userId: providerId,
    metadata: { error: message },
    ipAddress: context.ipAddress ?? undefined,
    userAgent: context.userAgent ?? undefined,
  });
  throw new ServiceBookingPaymentIndeterminateError(
    "We couldn't confirm whether the requester's payment went through. Support has been notified — do not try accepting this booking again until you hear back.",
  );
}
```

leaving `status`/`paymentStatus`/`selectedPaymentMethodId` untouched (still
`processing` from the claim) and skipping both "payment failed"
notifications for this branch only. Everything after this new block (the
existing card-decline path) is unchanged.

**Verify**: `bun run type-check` → exit 0.

### Step 11: Tests

- `src/services/stripe/__tests__/rental-payments.test.ts`: extend with
  `isIndeterminatePaymentError` cases — `StripeCardError`/
  `StripeInvalidRequestError`/`StripeAuthenticationError`/
  `StripePermissionError`/`StripeRateLimitError` → `false`;
  `StripeAPIError`/`StripeConnectionError`/`StripeIdempotencyError`/a plain
  `Error` (e.g. a timeout) → `true`; a `StripeInvalidRequestError` with
  `code: "idempotency_key_in_use"` (statusCode 409) → `true` (pins the
  review fix).
- `src/features/rentals/services/__tests__/rental-service.approve.test.ts`:
  a mocked `chargeRentalPayment` rejecting with a `StripeConnectionError` →
  `updateRentalRequestPaymentStatus` is **not** called, one `sendOpsAlert`
  call with `event: "rental_charge_indeterminate"`, result has
  `indeterminate: true`; a `StripeCardError` rejection → unchanged existing
  behavior (still marks `failed`, still notifies both parties). A resolved
  PaymentIntent with `status: "processing"` → indeterminate branch; `status: "canceled"` →
  unchanged existing "failed" branch.
- `src/app/api/rentals/[id]/approve/__tests__/route.test.ts` (extend; there
  is also an older `approve/route.test.ts` next to the route, so check which
  one mocks `RentalService`): a service result of
  `{success:false, indeterminate:true, error}` → response is `409` with
  `{error, code: "PAYMENT_INDETERMINATE", indeterminate: true}`, no
  `paymentFailed` key.
- `route-helpers` test: `ServiceBookingPaymentIndeterminateError` → `409
{error, code: "PAYMENT_INDETERMINATE"}`, and it is **not** in the
  skip list (captured).
- `src/features/services/__tests__/service-booking-service.test.ts`: mirror
  the rental cases — an indeterminate Region A error → booking stays
  `paymentStatus: 'processing'`, no `status` write, throws
  `ServiceBookingPaymentIndeterminateError`, one `sendOpsAlert` call; a card
  decline → unchanged existing behavior.
- `src/dal/__tests__/payment.dal.test.ts`: `recordRefund` with an amount
  equal to `payments.amount` → renders/produces `status = 'refunded'`; an
  amount less than `amount` → `'partially_refunded'` (assert via this file's
  existing SQL-render helper, matching how other raw-SQL DAL methods in this
  suite are pinned). Also add a real-DB case to
  `src/dal/__tests__/payment-earnings.integration.test.ts` (it already seeds
  `payments` rows): 50.00 of a 100.00 charge → `partially_refunded`, then a
  cumulative 100.00 → `refunded`. The CASE compares a bound string to a
  `numeric` column, and only a real Postgres proves the cast.
- `src/dal/__tests__/payment-lifecycle.dal.test.ts`: `findEligibleForPayout`'s
  rendered `NOT EXISTS` includes both `'refunded'` and `'partially_refunded'`.
- `src/features/rentals/services/__tests__/cancellation-service*.test.ts`:
  a context with `paymentStatus: 'partially_refunded'` → the "already
  refunded" branches (owner-cancel idempotency, no-show refusal) trigger the
  same as `'refunded'` does today, and the cancel path also fires
  `cancel_after_partial_refund`.
- `src/services/stripe/__tests__/webhook-handlers.test.ts` (TEST-19, the
  core of this plan's testing requirement):
  - **Duplicate event**: call `handleWebhookEvent` twice with the same
    `event.id`; mock `auditLogDAL.exists` to return `true` on the second
    call; assert the handler switch (e.g. `handlePaymentIntentSucceeded`'s
    underlying DAL call) fires exactly once.
  - **Out-of-order succeeded-after-refunded**: `existingPayment.status = "refunded"`,
    then `payment_intent.succeeded` arrives → `updatePaymentStatus` is
    **not** called.
  - **Partial refund not marked full**: a `charge.refunded` event with
    `amount_refunded` less than the charge's full amount, matched to a
    `payments` row → `recordRefund` is called, and (via a real or
    thin-integration check) the resulting status is `'partially_refunded'`,
    not `'refunded'`.
  - **Deposit-cancel handler now reachable** (Step 4): the existing
    `describe("payment_intent.canceled")` block (`webhook-handlers.test.ts:327-460`)
    builds events with `metadata.rentalId`. Rewrite its fixtures to carry
    `metadata.rentalRequestId` (no `rentalId`), mock
    `rentalDAL.getRentalByRequestId` → `{id: "rental-1"}`, and set
    `cancellation_reason: "automatic"`. Cases: `held` →
    `updateDepositHoldStatus("rental-1", "expired", {fromStatus: ["held","release_failed"]})`
    - alert; CAS returns `false` → no alert; `cancellation_reason: null`
      (our own release) → no lookup, no write; a PI id that isn't the rental's
      current `securityDepositAuthId` → no write. Invert or delete the old
      `"ignores cancellations without rentalId metadata"` case (`:425`),
      which pins the bug.
  - **`refund.failed`**: dispatch the new event type → one `sendOpsAlert`
    call with the refund id and reason.

**Verify**: `bun run test:run src/services/stripe src/dal/__tests__/payment.dal.test.ts src/dal/__tests__/payment-lifecycle.dal.test.ts src/features/rentals src/features/services src/features/payments` → all pass.

## Test plan

Covered by Step 11. Full regression: `bun run test:run`. This plan has no
CAS/claim changes of its own (it relies on the _existing_ rental/service
claims already holding `processing` — nothing here races a new write path).
The one real-DB addition is `recordRefund`'s CASE (Step 11), because a
numeric cast is exactly what a mock can't prove. Re-run
`docker compose up -d && bun run db:push:e2e && bun run test:integration`
anyway since `payment.dal.ts` and `payment-lifecycle.dal.ts` changed and both
have existing real-DB coverage from earlier plans.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0
- [ ] Migration generated from the schema (single `ADD VALUE`), applied on local + confirmed on dev/staging per Production cutover
- [ ] A duplicate webhook event id is a documented no-op (test)
- [ ] A `payment_intent.succeeded` after a refund does not change `payments.status` (test)
- [ ] A partial `charge.refunded` records `partially_refunded`, not `refunded` (test)
- [ ] The `payment_intent.canceled` handler resolves the rental through `metadata.rentalRequestId`, skips our own (reason-less) cancellations, and CAS-expires only `held`/`release_failed` (test)
- [ ] `ServiceBookingPaymentIndeterminateError` responses carry `code: "PAYMENT_INDETERMINATE"` (route-helpers test)
- [ ] An indeterminate charge error leaves the claim in `processing` and never marks `failed` (both rental and service, tests)
- [ ] Every `"refunded"`-reading call site in Current state §2 (the five in the table, plus `payment-history-item.tsx` and, if landed, R-CONC-04's rental claim) also matches `"partially_refunded"` (grep or test per site)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` (Phase 2 step 2)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- R-CONC-04 has landed and `payment-lifecycle.dal.ts` has a refunded
  guard in a place other than `findEligibleForPayout` and
  `claimForProcessing`. Widen every one, or stop and report if one of them
  is on the service side (it must not be).
- `payment.dal.ts` doesn't already import `sql` from `drizzle-orm` and
  adding it collides with an existing different `sql` import/alias — resolve
  by reading the file's actual imports first.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

**New response shape**: `POST /api/rentals/[id]/approve` can now return
`409 {error, code: "PAYMENT_INDETERMINATE", indeterminate: true}` (Decision 2) and
`POST /api/services/bookings/[id]/accept` can now return
`409 {error, code: "PAYMENT_INDETERMINATE"}`. Both are
additive and both are rare (Stripe 5xx/timeout during an off-session charge
is uncommon). Per the same generic-non-2xx-handling precedent cited in
R-BIZ-02/R-BIZ-09/R-PERF-02's plans, the current app handles an unrecognized
409 without a release. Add this row to the roadmap's Mobile client
follow-ups table:

| Fix      | Contract change                                                                                                                                      | Where the app sees it                  | Mobile task | Status                                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-BIZ-14 | `409 {error, code: "PAYMENT_INDETERMINATE"}` on rental approve (plus `indeterminate: true`) and service accept — both rare, Stripe-outage-only paths | rental approve, service booking accept | —           | TODO: add `PAYMENT_INDETERMINATE` to `ApiErrorCode` (`src/api/errors.ts`) with "We couldn't confirm this payment — support will follow up; don't retry" copy, and don't offer a retry button |
| R-BIZ-14 | new `payments.status` value `partially_refunded` in `GET /api/payments/history` `status`                                                             | payment history                        | —           | TODO: add `partially_refunded` to `paymentStatusSchema` (`contract/enums.ts:66`) and render "Partially refunded" next to `refundAmount`. Tolerant today, so it renders "unknown" until then  |

**Correction (review 2026-09-25):** the draft said `payments` rows never
reach mobile. They do: `GET /api/payments/history` returns `payments.status`
verbatim (`payment-history.ts:63-68`, contract
`payment-history.contract.ts:23`), hence the second row. The deposit-hold
handler fix and the other webhook fixes are server-to-Stripe only.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-BIZ-14 — apply migration 00NN (payment_status: partially_refunded)` |
  From: R-BIZ-14 | dev: TODO | staging: TODO | prod: TODO. No data prep — a
  new enum value only; existing rows keep reading `'refunded'` until a new
  refund event recomputes their status (this plan does not retroactively
  reclassify old rows — see Maintenance notes).
- **New row**: `R-BIZ-14 — subscribe the Stripe webhook endpoint to refund.failed` |
  From: R-BIZ-14 | dev: TODO | staging: TODO | prod: TODO. Stripe
  Dashboard → Developers → Webhooks → the endpoint for that environment →
  add `refund.failed` to its events (or `stripe webhook_endpoints update`).
  Without it, Step 7's handler never receives anything. While there,
  confirm `payment_intent.canceled` and `transfer.reversed` are subscribed
  too. (Step 4 needs no data prep: every existing hold already carries
  `rentalRequestId`.)

## Maintenance notes

- Retroactively reclassifying old `'refunded'` rows that were actually
  partial (before this fix) is possible via a one-off script comparing
  `payments.refund_amount` to `payments.amount`, but is **not** done here —
  hoador isn't in production yet, so there's no real backlog to fix (a
  dev/staging-only concern, and those are test data).
- A dedicated admin action to reset a rental request's or service booking's
  `paymentStatus` out of a stuck `'processing'` (the indeterminate-error
  outcome) doesn't exist; today it's a manual DB update following the
  stale-charge-claim alert's own instructions, same maturity level as other
  manual reconciliation steps in `13-production-cutover.md`. A follow-up
  admin route (`resetChargeClaimStatus`, mirroring
  `resetPayoutStatus`/`resetTransferStatus`) would be a natural next step
  once this happens often enough in practice to justify it — and would sit
  in `payment-lifecycle-admin-service.ts` alongside those.
- `charge.refund.updated` (Stripe's newer Refunds-API status-change event)
  isn't handled — this codebase creates refunds via `refunds.create` inside
  our own services, not through a separate Refunds API flow, so
  `refund.failed` covers the async-failure case that matters today. Add it
  only if a future feature starts creating refunds asynchronously outside
  the current request-response flows.
- R-ARCH-04 Part D's reconciliation derives the expected status as
  `refunded` when Stripe's `amount_refunded >= amount`, else
  `partially_refunded` (its Step D2, rewritten in review). Land Part D after
  this plan. If it somehow lands first, its "before BIZ-14" rule (accept
  `refunded` for both) must be flipped when this plan lands.
- The deposit-hold idempotency key still differs by path:
  `deposit-hold-{requestId}` on the immediate path, `deposit-hold-{rentals.id}`
  on cron/retry, because `placeDepositHold` keys on `params.rentalId`. That's
  harmless (they're never both live for one rental) and left alone. Don't
  "fix" it by forwarding `rentalId` into the metadata; Step 4 explains why.
