# R-BIZ-07: Stop charging self-deleted users

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/dal/account-deletion.dal.ts src/features/users/services/account-deletion-service.ts src/dal/rentals.dal.ts src/dal/service-booking.dal.ts src/services/stripe/payment-method.ts`
> A mismatch against "Current state" below is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED (deletion path + two claim paths)
- **Depends on**: none (may land before or after `R-BIZ-01`; both touch the
  rental claim's WHERE — re-run each other's DAL tests after either lands)
- **Category**: bug (money) · **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

A user who deletes their account (`anonymizeUser`) keeps `stripeCustomerId`
and every Stripe card attached, because the "cards to detach" query reads
`user_payment_methods`, a table nothing but seeds writes — the list is
always empty. Their pending outbound rental requests and service bookings
are left untouched (a deliberate non-blocker for self-deletion), so an owner
or provider can still approve/accept them **after** the user is anonymized,
charging "Deleted User" who can no longer log in to see, dispute or cancel
it. Audit finding BIZ-07 (HIGH): a consumer-protection and App Store issue.

## Current state

- `account-deletion.dal.ts:272-362` `anonymizeUser` — a single
  `this.db.transaction(async (tx) => {...})` (opens line 274). Reads
  `userPaymentMethods` for `stripeId`s to return (285-288: always empty in
  practice); scrubs PII; deactivates `userPaymentMethods` rows and push
  subscriptions; delists `listings`/`serviceListings`. **Never touches
  `rentalRequests` or `serviceBookings`.** `stripeCustomerId` is deliberately
  kept on the row (comment, line 306-308) but the method never reads or
  returns it.
- `account-deletion-service.ts:107-126` `deleteOwnAccount` — after the
  transaction, detaches only the (empty) `paymentMethodIds` list via
  `detachPaymentMethod` (imported from `@/services/stripe/payment-method`).
- `src/services/stripe/payment-method.ts:160-164` `detachPaymentMethod(id)` —
  calls `paymentMethods.detach` for one id; no "list all for a customer"
  helper exists yet, though `listStripeCardPaymentMethodsForUser` (same
  file) already shows the `paymentMethods.list({customer, type:"card"})`
  call shape to copy.
- `rentals.dal.ts:1884-1902` `claimRentalRequestPaymentProcessing` and
  `service-booking.dal.ts:241-261` `claimForAcceptance` — neither reads
  `user.anonymizedAt` or `user.status`.
- `_enums.ts:258-264` `cancellationReasonEnum` (for `rental_requests`):
  `renter_cancellation | owner_cancellation | renter_no_show |
owner_no_show | expired_no_acceptance` — **no `account_deleted` value.**
  Use `"renter_cancellation"` for the rental side. `service_bookings.
cancellationReason` (`services.schema.ts`) is a free-text column (used as
  `reason?.trim() || "service_booking_cancelled"` in
  `service-booking-service.ts:785`) — `"account_deleted"` is fine there.

```ts
// account-deletion.dal.ts:284-288 — always empty
const pmRows = await tx
  .select({ stripeId: userPaymentMethods.stripePaymentMethodId })
  .from(userPaymentMethods)
  .where(eq(userPaymentMethods.userId, userId));
```

**Conventions**: mirror `R-BIZ-01`'s `RentalRequestNotPendingError` /
`handleApiError`-branch pattern for the new `CounterpartyUnavailableError`.
Cancellation notification: `sendRentalCancelledNotification`
(`src/features/rentals/notifications/rental-cancelled.ts`, takes
`cancelledBy: "owner"|"renter"`). Services have no dedicated cancelled-notify
file; mirror the inline `sendNotification({type:"system", title:"Booking
cancelled", ...})` calls in `service-booking-service.ts:878-894`. **SEC-16**:
drizzle 0.45 wraps driver errors in `DrizzleQueryError`; not relevant here
(no code relies on catching a pg error code).

## Commands

| Purpose   | Command                                                                                                                         | Expected |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck | `bun run type-check`                                                                                                            | exit 0   |
| Lint      | `bun run lint`                                                                                                                  | exit 0   |
| Tests     | `bun run test:run src/dal/__tests__/account-deletion.dal.test.ts src/features/users src/features/rentals src/features/services` | all pass |

## Scope

**In scope**: `src/dal/account-deletion.dal.ts`, `src/features/users/services/account-deletion-service.ts`,
`src/services/stripe/payment-method.ts` (new list+detach-all helper),
`src/dal/rentals.dal.ts` (claim guard), `src/dal/service-booking.dal.ts`
(claim guard), `src/dal/errors.ts`, `src/lib/api/route-helpers.ts`, tests.

**Out of scope**: the deletion-blocker checks (`getDeletionBlockers`) — these
deliberately do not block on pending outbound requests, by design; do not
add one. Admin/superadmin user actions (covered by `R-DB-01`).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Cancel pending outbound requests inside the anonymize transaction

In `anonymizeUser`, extend the initial `existing` select to also fetch
`stripeCustomerId`. Before the transaction returns, add two `tx.update(...)`
calls: `rentalRequests` `SET status='cancelled', cancelledAt=now(),
cancellationReason='renter_cancellation', denialReason='Account deleted'
WHERE renter_id=userId AND status='pending' AND (payment_status IS NULL OR
payment_status <> 'processing') RETURNING id, owner_id`; and
`serviceBookings` `SET status='cancelled', cancelledAt=now(),
cancellationReason='account_deleted' WHERE requester_id=userId AND
status='pending' AND payment_status IS NULL RETURNING id, provider_id`. Both
predicates exclude a claim currently mid-charge (`processing`), which stays
untouched and is handled by the existing stale-claim detector. Return the
affected rows (ids + counterpart id) alongside `paymentMethodIds` and
`stripeCustomerId` from `anonymizeUser`.

**Verify**: `bun run type-check` → exit 0.

### Step 2: Detach every Stripe card, not just the local table

In `payment-method.ts`, add:

```ts
export async function detachAllPaymentMethodsForCustomer(
  customerId: string,
): Promise<{ detached: number; failed: number }> {
  const { data } = await PAYMENT_SERVER_INSTANCE.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  const results = await Promise.allSettled(
    data.map((pm) => detachPaymentMethod(pm.id)),
  );
  return {
    detached: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
```

In `account-deletion-service.ts`, after the transaction commits, call this
with the returned `stripeCustomerId` (guard `if (stripeCustomerId)`) instead
of iterating the empty `paymentMethodIds` list. On `failed > 0`, send an ops
alert (mirror the `sendOpsAlert` shape used in `cancellation-service.ts`,
e.g. `event: "account_deletion_card_detach_failed"`), matching the existing
"best-effort, never fail the deletion" comment.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Notify the counterpart on each withdrawn request

Still in `deleteOwnAccount`, after the transaction commits, for each
cancelled rental request call `sendRentalCancelledNotification({...,
cancelledBy: "renter", cancellationReason: "Renter's account was deleted"})`
to its `ownerId`; for each cancelled service booking, send the inline
`sendNotification({userId: providerId, type:"system", title:"Booking
cancelled", message:"The requester's account was deleted; this booking was
withdrawn.", ...})` pattern. Both fire-and-forget with
`.catch(captureNonCriticalError)` per repo convention.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Add `CounterpartyUnavailableError` and guard both claims

`src/dal/errors.ts`:

```ts
export class CounterpartyUnavailableError extends DALError {
  constructor(message = "The other party's account is no longer active.") {
    super(message, "COUNTERPARTY_UNAVAILABLE", 409);
    this.name = "CounterpartyUnavailableError";
  }
}
```

Add its `handleApiError` branch (mirror R-BIZ-01 Step 1). In
`RentalService.approveRentalRequest`, right after the (R-BIZ-01) pending
check, add `EXISTS`-in-WHERE atomicity to the claim itself: extend
`claimRentalRequestPaymentProcessing`'s `and(...)` with `sql`EXISTS (SELECT 1
FROM "user" u WHERE u.id = ${rentalRequests.renterId} AND u.anonymized_at IS
NULL AND u.status = 'active')``. On a claim failure, before returning the
existing "already being processed" message, re-check the renter's row
(`userDAL.getUserById`); if `anonymizedAt`is set or`status !== 'active'`,
throw `CounterpartyUnavailableError`instead — this keeps the atomic guard
while giving a correct error message. Mirror the same shape in`ServiceBookingDAL.claimForAcceptance`/`ServiceBookingService.acceptBooking`,
checking `requesterId`.

**Verify**: `bun run type-check` → exit 0.

## Test plan

- **DAL** (`account-deletion.dal.test.ts`): `anonymizeUser` on a user with
  one pending rental request and one pending service booking cancels both
  and returns their ids/counterpart ids; a `processing`-claimed request is
  left untouched.
- **Service**: `deleteOwnAccount` calls `detachAllPaymentMethodsForCustomer`
  with the user's `stripeCustomerId` (Stripe mocked); a card-list of 3 →
  3 detach calls.
- **Rental/service claim**: approving/accepting a request whose renter/
  requester has `anonymizedAt` set → `CounterpartyUnavailableError`, no
  charge attempted. `renderWhere` pins the `EXISTS (... anonymized_at IS
NULL ...)` fragment in the claim's WHERE.

**Verify**: `bun run test:run src/dal/__tests__/account-deletion.dal.test.ts src/features/users src/features/rentals src/features/services` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including new cases above
- [ ] `grep -n "anonymized_at\|anonymizedAt" src/dal/rentals.dal.ts src/dal/service-booking.dal.ts` → both files have a hit inside the claim methods
- [ ] `grep -n "detachAllPaymentMethodsForCustomer" src/services/stripe/payment-method.ts src/features/users/services/account-deletion-service.ts` → both files reference it
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Live code doesn't match "Current state" (drift since `21bdc61`).
- `cancellationReasonEnum` gained an `account_deleted` value since this plan
  was written — use it directly instead of `renter_cancellation` and note
  the change; do not add a new enum value yourself.
- The `EXISTS` subquery inside a drizzle `.where(and(...))` doesn't compile
  against this file's existing query-builder style — fall back to a plain
  `sql`` WHERE fragment for the whole condition, matching the pattern at
`account-deletion.dal.ts:235-244`, and report which form worked.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- New: `POST /api/rentals/[id]/approve` and `POST /api/services/bookings/[id]/accept`
  can both return 409 `{"error": "...", "code": "COUNTERPARTY_UNAVAILABLE"}`
  (same `handleApiError`-branch pattern as R-BIZ-01; the accept route has no
  manual chain, so it reaches this branch directly). New failure mode where
  none existed — a renter/requester whose account is deleted mid-flow
  previously charged successfully.
- The renter/requester themselves see no new response shape — their own
  session is gone (sessions are deleted in the same transaction), so they
  cannot poll this request/booking again.
- Self-deletion (`deleteOwnAccount`) response shape is unchanged
  (`204`/void); the newly cancelled requests surface to the _owner/provider_
  as an ordinary `rental_cancelled` / `system` notification and status
  change on their existing dashboard lists — no new field for mobile to add.

## Maintenance notes

- `R-BIZ-01` also edits `claimRentalRequestPaymentProcessing`'s WHERE; land
  either order, but re-run both plans' DAL tests after the second lands.
- `getDeletionBlockers` intentionally still does not block on outbound
  pending requests (design note in `account-deletion.dal.ts:108-113`) — this
  plan makes that safe by cancelling them instead of leaving them chargeable.
- If a future admin "impersonate/reactivate" tool clears `anonymizedAt`, the
  new claim guards will naturally re-permit that user — no extra work needed.
