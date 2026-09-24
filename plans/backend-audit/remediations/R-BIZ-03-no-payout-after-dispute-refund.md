# R-BIZ-03: Stop paying providers after a favor_renter dispute refund

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/disputes/services/dispute-resolution-service.ts src/features/services/services/service-booking-service.ts src/dal/service-payment-lifecycle.dal.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: S · **Risk**: MED
- **Depends on**: none (coordinate with R-BIZ-02 — see Maintenance notes)
- **Category**: bug (money)
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

A `favor_renter` resolution refunds the requester in full and marks the
service-payment lifecycle `completed`, but never changes the booking's own
status — it stays `accepted`. The provider can then tap "Mark Complete",
which **unconditionally** resets `payoutStatus` back to `pending`, and the
next payout cron transfers the provider's share from **platform funds**
against an already-fully-refunded charge. Per Stripe's docs
(docs.stripe.com/connect/separate-charges-and-transfers), a `source_transaction`
transfer is capped only by `sum(transfers) ≤ charge amount`, and "refunding a
charge has no impact on any associated transfers" — so this transfer
**succeeds**, it doesn't just fail loud. This is a real double-spend of up to
80% of the service price. Audit finding BIZ-03 (HIGH), gap TEST-04 (re-arm
part).

## Current state

- `dispute-resolution-service.ts:317-341` `resolveServiceBookingDispute`,
  `favor_renter` branch: refunds in full via `executeServiceRefund`, then
  calls `servicePaymentLifecycleDAL.markRefundedAfterDispute(bookingId)`
  (line 341). The booking row itself is never touched.
- `service-payment-lifecycle.dal.ts:396-412` `markRefundedAfterDispute` — sets
  **both** `ownerTransferStatus` and `payoutStatus` to `"completed"`.
- `service-booking-service.ts:664-678` `completeBooking` — the CAS
  (`accepted → completed`) succeeds regardless of dispute history, then:
  `await servicePaymentLifecycleDAL.updatePayoutStatus(bookingId, "pending")`
  (line 678) — **unconditional**, no `WHERE payout_status = ...` guard.
- `service-booking-service.ts:488-494` `acceptBooking` — confirmed by direct
  read: already creates the lifecycle row with
  `ownerTransferStatus: "pending", payoutStatus: "pending"`. So
  `completeBooking`'s reset is **always redundant on the happy path** — its
  only observable effect is undoing `markRefundedAfterDispute`.
- `service-payment-lifecycle.dal.ts:231-287` `findEligibleForPayout` — WHERE
  requires `payoutStatus = "pending"` and `ownerTransferStatus != "frozen"`.
  `"completed"` satisfies `!= "frozen"`, so once `completeBooking` resets
  `payoutStatus` to `"pending"`, the row is fully eligible again even though
  `ownerTransferStatus` already reads `"completed"`.
- `services.schema.ts:71-156` `serviceBookings` — `status` enum already
  includes `"cancelled"` (`_enums.ts:291-298`), and the table already has
  `cancelledAt`, `cancelledBy` (nullable, FK to `user.id`), and
  `cancellationReason` (free text) columns. **No migration needed** — this is
  a genuine fit, not a STOP condition.
- `dispute-creation-service.ts:308-313` — a dispute can only be filed while a
  service booking is `accepted` or `completed`, so `favor_renter` resolution
  always finds the booking in one of those two states.

## Commands

| Purpose        | Command                                                                                                                | Expected |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                   | exit 0   |
| Lint           | `bun run lint`                                                                                                         | exit 0   |
| Targeted tests | `bun run test:run src/features/disputes src/features/services src/dal/__tests__/service-payment-lifecycle.dal.test.ts` | all pass |
| Full tests     | `bun run test:run`                                                                                                     | all pass |

## Scope

**In scope**:
`src/features/disputes/services/dispute-resolution-service.ts`
(`resolveServiceBookingDispute`, `favor_renter` branch only),
`src/features/services/services/service-booking-service.ts`
(`completeBooking` only), `src/dal/service-payment-lifecycle.dal.ts`
(`findEligibleForPayout`), and tests for all three.

**Out of scope**: the `partial_provider`/`partial_renter`/`dismissed`
branches of `resolveServiceBookingDispute` (correct today — they unfreeze
rather than force-complete); rental disputes (different code path, no
equivalent bug); R-BIZ-02's date-check work (separate plan, same two files —
see Maintenance notes).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Remove the unconditional re-arm in `completeBooking`

Delete line 678:
`await servicePaymentLifecycleDAL.updatePayoutStatus(bookingId, "pending");`

First confirm via `grep -n "updatePayoutStatus" src/features/services/services/service-booking-service.ts` that this is the **only** call inside `completeBooking` — if there's another, STOP and report it instead of guessing its intent. `acceptBooking` already sets `payoutStatus: "pending"` at creation (verified above), so this line has no legitimate effect to preserve.
**Verify**: `bun run type-check` → exit 0; `grep -n "updatePayoutStatus" src/features/services/services/service-booking-service.ts` → 0 hits.

### Step 2: Move the booking to a terminal status on `favor_renter`

In `resolveServiceBookingDispute`'s `favor_renter` branch
(`dispute-resolution-service.ts`), immediately after the
`markRefundedAfterDispute(bookingId)` call (line 341), fetch the booking and,
**only if its status is currently `"accepted"`**, CAS it to `"cancelled"`:

```ts
const booking = await serviceBookingDAL.getById(bookingId);
if (booking?.status === "accepted") {
  await serviceBookingDAL.updateIfStatus(bookingId, "accepted", {
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: adminId,
    cancellationReason: "dispute_favor_renter_refund",
  });
}
```

If the booking is already `"completed"` (the provider tapped complete before
the dispute was filed or resolved), leave it as-is — Step 3's eligibility
fix already blocks its payout, and retroactively "un-completing" a job that
was in fact performed is misleading to both parties. A CAS loss here (status
changed between the fetch and the update) is not an error: fall through
silently, since Step 1 and Step 3 make the outcome safe either way.
Import `serviceBookingDAL` (already imported in this file's sibling methods —
verify with `grep -n "serviceBookingDAL" src/features/disputes/services/dispute-resolution-service.ts`; add the import if missing).
**Verify**: `bun run type-check` → exit 0.

### Step 3: Tighten payout eligibility

In `findEligibleForPayout` (`service-payment-lifecycle.dal.ts:260-269`),
change `ne(servicePaymentLifecycle.ownerTransferStatus, "frozen")` to require
equality instead: `eq(servicePaymentLifecycle.ownerTransferStatus, "pending")`.
This is a strict tightening (every row that passed before still needs
`payoutStatus = "pending"` too, and a fresh accept sets `ownerTransferStatus`
to `"pending"`), and it excludes `"completed"` rows left behind by
`markRefundedAfterDispute` even if some other path re-arms `payoutStatus`.
**Verify**: `bun run type-check` → exit 0.

### Step 4: Ops query for past double-pays (manual — describe only)

Do not write code for this step. Add to this plan's Maintenance notes (already
done below) a SQL sketch ops can run by hand:
`SELECT booking_id FROM service_payment_lifecycle WHERE owner_transfer_status = 'completed' AND stripe_transfer_id IS NOT NULL AND booking_id IN (SELECT service_booking_id FROM disputes WHERE resolution_outcome = 'favor_renter')`
— rows here had a transfer complete _and_ a full-refund resolution; recover
via Stripe `transfers.createReversal` (manual, no code path exists today).

## Test plan

- **Service** (`service-booking-service.test.ts`): accept → complete on a
  booking with no prior dispute still sets `payoutStatus: "pending"`
  (regression guard for Step 1's removal). A booking whose lifecycle already
  reads `{payoutStatus: "completed", ownerTransferStatus: "completed"}`
  (simulate post-refund) → `completeBooking` leaves it `"completed"`/`"completed"`
  (assert `updatePayoutStatus` mock is never called).
- **Dispute resolution** (`dispute-resolution-service.test.ts`): `favor_renter`
  on an `accepted` service booking → booking status becomes `"cancelled"`
  with `cancellationReason: "dispute_favor_renter_refund"`. Same outcome on
  an already-`"completed"` booking → status is left `"completed"`.
- **DAL** (`service-payment-lifecycle.dal.test.ts`, model after its existing
  `whereSql` pattern): render `findEligibleForPayout`'s WHERE and assert it
  contains `owner_transfer_status" = ` bound to `"pending"`, not `!=`/`frozen`.
- **Real-DB** (needs `R-TEST-HARNESS`; if that harness doesn't exist yet, skip
  this case and leave a `// TODO(R-TEST-HARNESS)` comment rather than
  inventing a mock DB): favor_renter then complete →
  `findEligibleForPayout` returns empty for that booking.

**Verify**: `bun run test:run src/features/disputes src/features/services src/dal/__tests__/service-payment-lifecycle.dal.test.ts` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] `grep -n "updatePayoutStatus(bookingId, \"pending\")" src/features/services/services/service-booking-service.ts` → 0 hits
- [ ] A DAL test pins `findEligibleForPayout`'s `ownerTransferStatus = 'pending'` guard
- [ ] A service test proves `favor_renter` + complete leaves the lifecycle non-payout-eligible
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `completeBooking` has more than one `updatePayoutStatus` call, or another
  code path resets `payoutStatus` to `"pending"` outside `acceptBooking` and
  the payout cron — report it instead of deleting blindly.
- `serviceBookingDAL` isn't already importable in
  `dispute-resolution-service.ts` without a circular-import error.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- No new error codes or status codes. The only visible change: a service
  booking that was disputed and resolved `favor_renter` while `accepted` now
  shows status `"cancelled"` (already a value the mobile
  `serviceBookingStatusEnum`/contract schema handles) instead of staying
  `"accepted"` forever with a stale "Mark Complete" affordance. Booking-detail
  screens that render a status badge or action buttons off `status` will
  correctly stop offering "Mark Complete" once this ships — verify no mobile
  screen assumes `accepted` is reachable only via the normal flow (search
  `hoador-mobile` for `status === 'accepted'` if touching that UI later; this
  plan does not touch mobile).
- `completedAt`/payout fields are unaffected for bookings completed before a
  dispute — this plan only changes the **post-refund** path.

## Maintenance notes

- **R-BIZ-02** (`R-BIZ-02-block-early-service-completion.md`) also edits
  `completeBooking` (adds a date guard) and `findEligibleForPayout` (adds a
  scheduled-instant check) in the same two files this plan touches. Land
  either plan first; the second executor must re-read the current file
  content before editing — do not assume the line numbers above still hold.
- Ops recovery query (Step 4) belongs in a runbook, not code — do not
  automate the Stripe reversal; a human should confirm each case before
  moving money back.
- If a future change lets a booking re-enter `accepted` after
  `"cancelled"` (none exists today), re-verify this plan's CAS still holds —
  `updateIfStatus`'s `expectedStatus` parameter would need updating too.
