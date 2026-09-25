# Plan R-CONC-04: Freeze-aware payout claims, dispute-aware service cancel, chargeback-after-payout reversal

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts src/dal/rentals.dal.ts src/dal/service-booking.dal.ts src/features/rentals/services/payment-lifecycle-service.ts src/features/rentals/services/cancellation-service.ts src/features/services/services/service-payment-lifecycle-service.ts src/features/services/services/service-booking-service.ts src/services/stripe/chargeback-service.ts src/services/stripe/payout.ts src/services/stripe/webhook-handlers.ts src/features/disputes/services/dispute-creation-service.ts src/features/payments/lib/earnings.ts src/db/schemas/_enums.ts src/features/admin/components/payments/payment-lifecycle-list-client.tsx src/features/admin/components/payments/payment-lifecycle-detail-client.tsx src/features/admin/services/payment-lifecycle-admin-service.ts`
> If R-BIZ-14 has landed (the recommended order, see Status), expect
> diffs in `payment-lifecycle.dal.ts` (`findEligibleForPayout`'s refunded
> list) and `webhook-handlers.ts` (other handlers). Those are expected, not
> drift; re-read them and carry on.
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: L · **Risk**: MED (touches every
  money-completion write in both payout crons and both cancel paths, but each
  change is a narrowing CAS, not a reorder of existing money calls)
- **Depends on**: none. Coordinates with R-BIZ-05, R-CONC-02, R-BIZ-03 (all
  three already landed and already edited `findEligibleForPayout` on both
  rental and service DALs — read their roadmap status notes before touching
  those WHERE clauses; this plan only adds to the claim CAS and the transfer
  writes, and does not remove anything they added to the finder queries).
  **Landing order (review 2026-09-25): land after
  [R-BIZ-14](R-BIZ-14-webhook-and-stripe-failure-handling.md).** BIZ-14
  widens the rental finder's refunded guard to
  `IN ('refunded','partially_refunded')`; Step 6 copies that guard into the
  claim, so the claim must copy the finder's list as it stands when this
  plan runs. If this plan lands first, Step 6 uses `= 'refunded'` and
  R-BIZ-14 Step 3 must widen both the finder and this claim. Both plans also
  edit `webhook-handlers.ts` (different functions: BIZ-14 the dedupe,
  `payment_intent.*`, `refund.failed`; this plan `transfer.reversed`).
  [R-ARCH-04](R-ARCH-04-durable-jobs-and-reconciliation.md) Parts D/E read
  the `reversed` value this plan adds; land them after this plan.
- **Category**: concurrency / bug (money) · **Planned at**: commit `29fe557`,
  2026-09-25
- **Fixes**: CONC-04, CONC-05, BIZ-13

## Why this matters

Three related gaps let a dispute, chargeback or freeze lose a race against
money that is already moving:

1. **CONC-04** — both payout crons pick their eligible batch with
   `findEligibleForPayout` (which already excludes frozen/disputed rows as of
   the read), then **claim** each row with `claimForProcessing`, whose WHERE
   checks only `payoutStatus = 'pending'`. A chargeback or dispute that
   freezes the lifecycle _after_ the batch read but _before_ the claim is not
   re-checked — the claim still succeeds, and the cron pays out (or releases
   the deposit) while a dispute is open.
2. **CONC-05** — service cancel reads whether an active dispute exists, then
   claims the cancellation by status only (no dispute predicate on the CAS).
   A dispute filed in that window doesn't block the cancel, and the cancel's
   provider-transfer write unconditionally sets `ownerTransferStatus:
"completed"`, clobbering a `"frozen"` a concurrent dispute just set. The
   rental cancel/no-show twin has the same clobber (it has no dispute check
   at all).
3. **BIZ-13** — a chargeback arriving _after_ a transfer has already
   completed calls the same `freezeForDispute` used for ordinary disputes,
   which unconditionally overwrites `ownerTransferStatus: "completed"` with
   `"frozen"`. Nothing then claws the money back: Stripe transfers are not
   reduced by a refund/chargeback on the source charge
   (`docs.stripe.com/connect/separate-charges-and-transfers`), so the
   platform silently eats the loss and the lifecycle state is now wrong
   (`payoutStatus` still reads `completed` while `ownerTransferStatus` reads
   `frozen`, which the earnings screen and admin dashboard both render as "on
   hold" on money that already left).

All three share one root cause and one fix shape: **a freeze must never be
silently gained or lost by a write that doesn't check for it first.**

## Current state

### CONC-04 — claim doesn't re-check what the finder already excluded

- `src/dal/payment-lifecycle.dal.ts:432-487` `findEligibleForPayout` — already
  excludes `ne(ownerTransferStatus, "frozen")` (landed with R-BIZ-05) and
  `isNull(disputes.id)` for `open|evidence_requested|under_review` disputes,
  plus a `NOT EXISTS` on refunded payments (R-CONC-02). **This is a snapshot
  read** — nothing re-checks it at claim time.
- `src/dal/payment-lifecycle.dal.ts:247-267` `claimForProcessing` — WHERE is
  `eq(rentalId) AND eq(payoutStatus, "pending")` only. Returns `boolean`.
- `src/features/rentals/services/payment-lifecycle-service.ts:47-80`
  `processPayouts`: claims by id, then reads
  `rental.lifecycle.ownerTransferStatus` (**the stale array element from the
  finder's read, not a fresh read**) to decide whether to proceed
  (`:66-80`, landed with R-BIZ-05). A freeze that lands between the finder
  read and the claim is invisible to both checks — the claim succeeds (it
  never looked at `ownerTransferStatus`) and the stale snapshot still says
  `"pending"`, so the deposit release (`:83-113`) and transfer (`:116-194`)
  both proceed.
- `src/dal/service-payment-lifecycle.dal.ts:237-302` `findEligibleForPayout`
  — tightened by R-BIZ-03 to `eq(ownerTransferStatus, "pending")` (not just
  `ne(..., "frozen")`) plus `isNull(disputes.id)`.
- `src/dal/service-payment-lifecycle.dal.ts:158-178` `claimForProcessing` —
  WHERE is `eq(bookingId) AND eq(payoutStatus, "pending")` only. Same gap.
- `src/features/services/services/service-payment-lifecycle-service.ts:54-120`
  `processPayouts`: claims by id, then acts unconditionally — it never
  re-reads `ownerTransferStatus` at all (there is no equivalent of the
  rental cron's stale-snapshot guard here), so a freeze landing after the
  finder read is not caught by any check before the transfer at `:85-116`.

### CONC-05 — cancel's dispute check and transfer write are TOCTOU

- `src/features/services/services/service-booking-service.ts:771-782`
  `cancelBooking`: reads `disputeDAL.getActiveByServiceBookingId(bookingId)`
  (active = `status <> 'closed'`, i.e. includes `resolved`, per
  `src/dal/dispute.dal.ts:240-248`) and feeds it into
  `assessServiceCancellation`. `:820-830` claims with
  `serviceBookingDAL.updateIfStatus(bookingId, detail.status, {...},
{blockWhilePaymentProcessing: true})` — no dispute predicate. A dispute
  filed between the read and the claim is not caught.
- `src/dal/service-booking.dal.ts:184-212` `updateIfStatus` — WHERE is
  `eq(id) AND eq(status, expectedStatus)`, plus the optional
  `blockWhilePaymentProcessing` OR-clause. No dispute-aware option exists.
  `disputes` is **not** imported in this file today.
- `src/features/services/services/service-booking-service.ts:872-896`: on a
  successful provider transfer, `updateOwnerTransferStatus(bookingId,
"completed", {...})` — unconditional, clobbers `"frozen"`.
- **Rental twin** (noted by the audit as "never checks disputes at all"):
  `src/features/rentals/services/cancellation-service.ts:110-184`
  `cancelApprovedRental` and `:383-424` `applyNoShow` both call
  `rentalDAL.cancelApprovedRental(requestId, ...)` — `src/dal/rentals.dal.ts:3646-3676`
  — whose WHERE is `eq(id) AND eq(status, "approved")` only, no dispute
  predicate, and no rental-id parameter to build one from (it operates on
  `rental_requests`, not `rentals`, and disputes key off `rentals.id`).
  Both functions already have `ctx.rentalId` in scope from
  `rentalDAL.getRentalCancellationContext` before calling the CAS. Both then
  write the transfer completion unconditionally in **two places each**: the
  transfer-result branch (`cancellation-service.ts:254-261` /
  `:475-482`, `updateOwnerTransferStatus(ctx.rentalId, "completed", {...})`)
  and again via `markCancelled`'s `ownerTransferStatus` extra
  (`:276-281` / `:497-502`), which redundantly re-asserts `"completed"`
  unconditionally on the same call.
- `src/dal/payment-lifecycle.dal.ts:367-389` `updateOwnerTransferStatus` and
  `src/dal/service-payment-lifecycle.dal.ts:181-214` (same name) — both plain
  `UPDATE ... WHERE id` with no status guard at all, return `Promise<void>`.

### BIZ-13 — freeze always wins, even over a completed transfer

- `src/dal/payment-lifecycle.dal.ts:628-657` `freezeForDispute` — reads the
  existing row, then unconditionally `SET ownerTransferStatus = "frozen"`
  regardless of the row's current value.
- `src/dal/service-payment-lifecycle.dal.ts:324-376` (same name) — identical
  shape.
- `src/services/stripe/chargeback-service.ts:154` (service) and `:233`
  (rental) `handleChargebackCreated` — calls `freezeForDispute` unconditionally
  after linking/creating the auto-dispute (R-BIZ-06 already made that insert
  itself resilient — this plan doesn't touch that part). The return value is
  discarded at both call sites today.
- **Contrast**: `src/features/disputes/services/dispute-creation-service.ts:405-419`
  (service, user-filed dispute path) already refuses to file at all when
  `lifecycle?.ownerTransferStatus === "completed"`, alerting
  `dispute_filed_post_payout` and throwing `ConflictError` — but this is a
  pre-check (TOCTOU against a concurrent transfer) and it doesn't exist for
  the **rental** dispute-filing path (`:236`, no such check) or for either
  **chargeback** path (banks don't ask permission — the webhook must always
  accept the event). BIZ-13 is specifically about the chargeback path, where
  refusing isn't an option.
- No reversal logic exists anywhere in the codebase:
  `grep -rn "createReversal" src` → no matches.
- `src/features/disputes/services/dispute-resolution-service.ts:222`
  (rental) `unfreezeAfterResolution` and `:397/:400` (service, two outcome
  branches) flip `frozen → pending`. Once freeze never clobbers `completed`
  (this plan's fix), these calls stay correct as-is — they only ever unfreeze
  a row this plan's fix allowed to become `frozen` in the first place.

### Found in review (2026-09-25) — readers and writers the draft missed

- **`transfer.reversed` webhook turns a reversal into a resettable
  failure.** `src/services/stripe/webhook-handlers.ts:236-252`
  `handleTransferReversed` looks the transfer up on the **rental** DAL only
  (`paymentLifecycleDAL.getByTransferId`) and writes
  `updateOwnerTransferStatus(rentalId, "failed")` unconditionally. The
  reversal this plan creates (Step 5) fires that event. If the webhook lands
  after Step 5's `"reversed"` write, the row ends `failed`, and
  `resetTransferStatus` (only allowed from `failed`) would reset it to
  `pending` and **re-pay the owner** on the next cron. Step 5b fixes it.
- **`completed` with no transfer is a normal service state.**
  `service-payment-lifecycle.dal.ts:409-425` `markRefundedAfterDispute`
  writes `ownerTransferStatus: "completed"` for a `favor_renter` refund with
  no transfer made (R-BIZ-03; `earnings.ts:70-81` reads it as "refunded").
  So a chargeback on such a booking reaches Step 5's helper with
  `stripeTransferId = null`. That is expected, not "shouldn't happen":
  nothing was paid out, so there is nothing to reverse.
- **Payout crons don't check the transfer-id invariant.** A real transfer is
  the only thing that sets `stripeTransferId` (a `failed` write never does).
  Neither cron checks it before creating a transfer, so once a row holds a
  transfer id while reading `pending` (which Step 2's frozen race below can
  produce, followed by an unfreeze and a payout reset), the cron would
  transfer again. After 24h the idempotency key has expired, so Stripe would
  create a second transfer.
- **Imports.** `payment-lifecycle.dal.ts:2-13` does **not** import
  `notExists` (the draft said it did). `service-payment-lifecycle.dal.ts:1-11`
  imports neither `ne` nor `notExists`.
- **Earnings drop unknown transfer states.** `src/features/payments/lib/earnings.ts:58-64`
  `TRANSFER_STATUSES` has no `reversed`, and `asTransferStatus` (`:150-155`)
  maps anything unlisted to `null`, so a reversed payout would reach the
  earnings feed (web and mobile `GET /api/payouts/earnings`) with
  `transferStatus: null`.
- **`handleChargebackClosed`** (`chargeback-service.ts:283-335`) only
  resolves a `rentalId` and alerts `chargeback_won`/`chargeback_lost`. It
  does not know about service bookings, and it has no idea a transfer was
  reversed.
- **Rental dispute filing after payout** (`dispute-creation-service.ts:236`)
  used to (wrongly) flip `completed → frozen`. Under Step 3 it becomes a
  silent no-op, so ops would get no signal. Step 3 adds an alert.

## Decisions for the maintainer

**1. Guard `updateOwnerTransferStatus`'s `"completed"` write inside the DAL,
unconditionally, rather than adding an opt-in flag to every call site.**
Every current caller that writes `"completed"` (both payout crons, both
cancel paths, both no-show paths) has the exact same requirement: never turn
a `"frozen"` row into `"completed"`. There is no call site where clobbering a
freeze is correct. **Recommendation: when `status === "completed"`, write
the status as `CASE WHEN owner_transfer_status = 'frozen' THEN 'frozen' ELSE
'completed' END` and write the transfer facts (`stripeTransferId`,
`ownerTransferredAt`, `transferAmount`) unconditionally** (both DAL
classes). Return `Promise<boolean>`: true when the row now reads the
requested status. (Review 2026-09-25: the draft used `WHERE <> 'frozen'`, so
losing the race also dropped the transfer id. The money had moved, but the
row kept no record of it, and a later unfreeze plus payout reset would pay
again. A CASE keeps the freeze and still records the transfer.) Callers
that don't care ignore the return value. Every call site that records a
transfer completion (both crons, both cancel paths, both no-show paths)
checks it (Steps 6-9).

**2. Add a new `"reversed"` value to both `owner_transfer_status` enums,
rather than reusing `"frozen"`/leaving `"completed"`.** BIZ-13's reversal
needs a terminal state distinct from both: `"frozen"` implies a resolution is
still pending (it isn't — the chargeback already resolved the money), and
leaving `"completed"` after a successful `transfers.createReversal` would
make the earnings/admin screens keep saying the owner was paid when the
money came back. **Recommendation: add `"reversed"`.** Needs a migration —
take the next free migration number after DB-02's baseline (do not hard-code
a number; DB-02 is item 1 of this Phase and squashes the migration history
first). Mobile risk is nil: `hoador-mobile/src/api/contract/enums.ts:95`
`ownerTransferStatusSchema` is a `tolerantEnum` (confirmed by
`hoador-mobile/src/api/contract/__tests__/enums.test.ts:41`), so an
unrecognized value degrades to "unknown," not a parse failure — see Mobile
compatibility.

**3. Attempt one automatic `transfers.createReversal`, alert either way; do
not build a debt ledger.** The finding's recommended fix offers
"`transfers.createReversal`, or book a debt." No debt/ledger table exists in
this codebase, and building one is a materially bigger feature (it would
need its own collection mechanism against a future payout, which doesn't
exist for a provider/owner who never books again). **Recommendation:
call `transfers.createReversal` for the full remaining transfer amount, once,
with a deterministic idempotency key; alert ops on success (so the reversal
is visible) and alert ops on failure** (insufficient connected-account
balance is the realistic failure mode — Stripe's reversal moves funds from
the _connected account's_ balance, which may not have them if the owner
already made a standard payout) **with the `stripeTransferId` and amount for
manual recovery.** This is strictly better than today (nothing happens) and
doesn't block on ARCH-04.

**3b. When to reverse: on `charge.dispute.created`, or only when the
chargeback closes as lost?** (Added in review 2026-09-25.) Stripe debits the
platform when the chargeback opens and credits it back only if the platform
wins. Reversing at `created` matches that timing, and it gives the best
chance that the owner's connected balance still holds the funds (the longer
we wait, the likelier the owner has already been paid out to their bank and
the reversal fails). The cost: if the platform **wins**, the owner has been
clawed back for money the platform recovered, and someone has to re-pay
them. Reversing on `closed/lost` is fairer to the owner but will often fail
for lack of balance. **Recommendation: reverse at `created` (Steps 5-5c
assume this), and on `charge.dispute.closed` with `status = "won"` for a
lifecycle in `reversed`, alert ops `chargeback_won_after_reversal` for a
manual re-transfer (Step 5c).** Re-paying automatically is out of scope. A
new transfer after a reversal needs a new idempotency key and a human
decision.

**4. Do not add a `dispute_filed_post_payout`-style pre-check to the rental
dispute-filing path in this plan.** The service side already has one
(Current state, above); the rental side doesn't. Adding it would be a good
symmetry fix, but it's not required by any of this plan's three findings
(the audit's own mitigating-layers note for CONC-04 says the rental dispute
window and rental payout eligibility are normally complementary), and this
plan's DAL-level `freezeForDispute` guard (Decision 2 corollary: freeze
becomes a no-op, not a throw, when the transfer already completed) already
makes it safe even if that path is reached. Left as a Maintenance note.

## Commands

| Purpose             | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Expected                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Typecheck           | `bun run type-check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | exit 0                                             |
| Lint                | `bun run lint`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | exit 0                                             |
| Generate migration  | `bun run db:generate`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | one `ALTER TYPE ... ADD VALUE 'reversed'` per enum |
| Targeted unit tests | `bun run test:run src/dal/__tests__/payment-lifecycle.dal.test.ts src/dal/__tests__/service-payment-lifecycle.dal.test.ts src/dal/__tests__/rentals.dal.test.ts src/dal/__tests__/service-booking.dal.test.ts src/features/rentals/services/__tests__/payment-lifecycle-service.test.ts src/features/rentals/services/__tests__/cancellation-service.test.ts src/features/services/__tests__/service-payment-lifecycle-service.test.ts src/features/services/__tests__/service-booking-service.test.ts src/services/stripe/__tests__/chargeback-service.test.ts src/services/stripe/__tests__/payout.test.ts src/services/stripe/__tests__/webhook-handlers.test.ts src/features/payments src/features/disputes` | all pass                                           |
| Real-DB tests       | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | all pass, includes three new files (Step 12)       |
| Full suite          | `bun run test:run`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | all pass                                           |

## Scope

**In scope**: `src/db/schemas/_enums.ts` (+ generated migration);
`src/dal/payment-lifecycle.dal.ts` (`claimForProcessing`,
`updateOwnerTransferStatus`, `freezeForDispute`, new
`markTransferReversed`); `src/dal/service-payment-lifecycle.dal.ts`
(same four); `src/dal/rentals.dal.ts` (`cancelApprovedRental`, add
`disputes` import); `src/dal/service-booking.dal.ts` (`updateIfStatus`, add
`disputes` import); `src/features/rentals/services/payment-lifecycle-service.ts`
(`processPayouts`); `src/features/rentals/services/cancellation-service.ts`
(`cancelApprovedRental`, `applyNoShow`); `src/features/services/services/service-payment-lifecycle-service.ts`
(`processPayouts`); `src/features/services/services/service-booking-service.ts`
(`cancelBooking`); `src/services/stripe/chargeback-service.ts`
(`handleChargebackCreated` both branches, `handleChargebackClosed`);
`src/services/stripe/webhook-handlers.ts` (`handleTransferReversed` only);
`src/features/disputes/services/dispute-creation-service.ts` (rental freeze
call site: alert only); `src/services/stripe/payout.ts`
(new `reverseTransfer`); `src/features/payments/lib/earnings.ts`
(`TRANSFER_STATUSES`, `disputeId` link); `src/features/admin/components/payments/payment-lifecycle-list-client.tsx`
(`COMBINED_PAYOUT_OPTIONS`, `getCombinedPayoutStatus`,
`combinedPayoutToFilters`, `statusBadgeVariant`); tests for all of the above.

**Out of scope**: R-ARCH-04's durable queue/reconciliation job (cross-plan
decision 2 — this plan must not depend on it); a debt ledger (Decision 3);
the rental dispute-filing pre-check (Decision 4); `payment-lifecycle-admin-service.ts`'s
reset-transfer-status tool (`canResetTransfer` only allows resetting from
`"failed"` — `"reversed"` is intentionally not resettable through that tool;
no code change needed there, confirm with the STOP condition below);
CONC-06 (separate plan); CONC-07/08/09/10/11 (LOW, Phase 3).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### 1: Add the `reversed` enum value

In `src/db/schemas/_enums.ts:237-243` and `:311-314`, add `"reversed"` to
both enums:

```ts
export const ownerTransferStatusEnum = pgEnum("owner_transfer_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "frozen",
  "reversed", // Chargeback arrived after payout; transfer reversed (BIZ-13)
]);
```

(same addition to `serviceOwnerTransferStatusEnum`). Run `bun run db:generate`
— a plain enum addition, fully expressible by drizzle-kit, so do not use
`--custom`. **Verify**: the generated migration's SQL is exactly two
`ALTER TYPE ... ADD VALUE 'reversed'` statements (one per enum); if
`db:generate` produces anything else (e.g. it also tries to rewrite unrelated
schema drift), STOP and report rather than accepting an unexpected diff.

### 2: Guard `updateOwnerTransferStatus`'s `"completed"` write against `frozen`

In both `payment-lifecycle.dal.ts` and `service-payment-lifecycle.dal.ts`,
change the return type to `Promise<boolean>`. For `"completed"`, keep a
`frozen` status but still record the transfer facts (Decision 1):

```ts
// payment-lifecycle.dal.ts — updateOwnerTransferStatus
async updateOwnerTransferStatus(
  rentalId: string,
  status: OwnerTransferStatus,
  extra?: { stripeTransferId?: string; ownerTransferredAt?: Date },
): Promise<boolean> {
  try {
    const col = rentalPaymentLifecycle.ownerTransferStatus;
    const [row] = await this.db
      .update(rentalPaymentLifecycle)
      .set({
        // A dispute that froze the row while the transfer was in flight keeps
        // its freeze (CONC-04/05), but the transfer id below is still written:
        // money moved, and the row must say so.
        ownerTransferStatus:
          status === "completed"
            ? sql`CASE WHEN ${col} = 'frozen' THEN ${col} ELSE 'completed'::owner_transfer_status END`
            : status,
        ...(extra?.stripeTransferId && { stripeTransferId: extra.stripeTransferId }),
        ...(extra?.ownerTransferredAt && { ownerTransferredAt: extra.ownerTransferredAt }),
        updatedAt: new Date(),
      })
      .where(eq(rentalPaymentLifecycle.rentalId, rentalId))
      .returning({ ownerTransferStatus: col });
    // True only if the row now reads what was asked for.
    return row?.ownerTransferStatus === status;
  } catch (error) {
    this.handleError(error, "PaymentLifecycleDAL.updateOwnerTransferStatus");
  }
}
```

Mirror this in `ServicePaymentLifecycleDAL.updateOwnerTransferStatus`:
`bookingId` instead of `rentalId`, the cast is
`'completed'::service_owner_transfer_status` (the service enum's pg name,
`_enums.ts:311-314`), and `transferAmount` stays in the unconditional
extras. Every other `status` value (`"failed"`, `"pending"`, `"reversed"`)
keeps today's unconditional write.

Drizzle accepts an `SQL` value for an enum column in `.set()`. If
type-check rejects it, cast the CASE with `sql<OwnerTransferStatus>`. Do not
fall back to a `WHERE <> 'frozen'` guard: that drops the transfer id on a
lost race, which is the bug this step fixes.

Existing callers that write `"failed"`/`"processing"` and ignore the return
value are unaffected by the type change (an unused `Promise<boolean>` is not
a type error). **Verify**: `bun run type-check` → exit 0 (confirms no caller
destructures the old `void` return in a way that breaks).

### 3: `freezeForDispute` no-ops (not clobbers) an already-completed transfer

In both DAL classes, change the return shape and add the guard:

```ts
// payment-lifecycle.dal.ts — freezeForDispute
async freezeForDispute(rentalId: string): Promise<{
  record: RentalPaymentLifecycleRecord;
  /**
   * True when the transfer had already completed (or been reversed). The
   * row was NOT frozen: a closed payout must never be silently reopened
   * (BIZ-13). The caller decides what to do: chargeback-service.ts reverses
   * or alerts, and dispute-creation-service.ts alerts.
   */
  alreadyPaidOut: boolean;
}> {
  try {
    const existing = await this.getByRentalId(rentalId);

    if (existing) {
      if (
        existing.ownerTransferStatus === "completed" ||
        existing.ownerTransferStatus === "reversed"
      ) {
        return { record: existing, alreadyPaidOut: true };
      }
      const [updated] = await this.db
        .update(rentalPaymentLifecycle)
        .set({ ownerTransferStatus: "frozen", updatedAt: new Date() })
        .where(
          and(
            eq(rentalPaymentLifecycle.rentalId, rentalId),
            // Re-check: the transfer may have completed between the read
            // above and this write (the same race this plan closes
            // elsewhere — freezeForDispute is not exempt from it either).
            notInArray(rentalPaymentLifecycle.ownerTransferStatus, [
              "completed",
              "reversed",
            ]),
          ),
        )
        .returning();
      if (!updated) {
        const fresh = await this.getByRentalId(rentalId);
        return { record: fresh ?? existing, alreadyPaidOut: true };
      }
      return { record: updated, alreadyPaidOut: false };
    }

    const created = await this.create({
      rentalId,
      rentalChargeId: null,
      depositHoldStatus: "not_applicable",
      ownerTransferStatus: "frozen",
      payoutStatus: "pending",
    });
    return { record: created, alreadyPaidOut: false };
  } catch (error) {
    this.handleError(error, "PaymentLifecycleDAL.freezeForDispute");
  }
}
```

Mirror in `ServicePaymentLifecycleDAL.freezeForDispute` (same two-branch
read-then-conditional-write-then-recheck shape; keep its existing
no-lifecycle-row `create(...)` fallback unchanged).

Add `notInArray` to both files' `drizzle-orm` imports. The service file
also needs `ne` and `notExists` for Steps 2/7, and the rental file needs
`notExists` for Step 6. None of these are imported today (checked in
review).

Both existing callers in `dispute-creation-service.ts` (`:236` rental, `:450`
service) discard the return value today. The service branch's own `:405-419`
pre-check means it only ever sees `alreadyPaidOut: true` in a race. At the
**rental** call site (`:236`), destructure the result and, on
`alreadyPaidOut`, send the same alert the service pre-check sends:
`sendOpsAlert({ event: "dispute_filed_post_payout", rentalId: actualRentalId, message: "Dispute filed after owner payout already completed — the freeze was skipped; review manually", ... }).catch(() => {})`.
Don't throw: the dispute row already exists at that point, and Decision 4
keeps the rental pre-check out of scope. Without the alert, the old (wrong)
`completed → frozen` flip becomes a silent no-op.
**Verify**: `bun run type-check` → exit 0.

### 4: `reverseTransfer` helper

In `src/services/stripe/payout.ts`, add alongside `createOwnerTransfer`:

```ts
interface ReverseTransferParams {
  transferId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

type ReversalResult =
  | { success: true; reversalId: string }
  | { success: false; error: string };

/**
 * Reverse an owner/provider transfer after a chargeback arrives on an
 * already-paid-out charge (BIZ-13). Reverses the full remaining amount
 * (omitting `amount` reverses whatever hasn't already been reversed).
 * Fails with "insufficient funds" if the connected account's balance can't
 * cover it — that failure is expected and must be alerted on, not retried
 * automatically.
 */
export async function reverseTransfer(
  params: ReverseTransferParams,
): Promise<ReversalResult> {
  try {
    const reversal = await PAYMENT_SERVER_INSTANCE.transfers.createReversal(
      params.transferId,
      { metadata: params.metadata },
      { idempotencyKey: params.idempotencyKey },
    );
    return { success: true, reversalId: reversal.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown reversal error";
    console.error("Error reversing transfer:", message);
    return { success: false, error: message };
  }
}
```

**Verify**: `bun run type-check` → exit 0.

### 5: `chargeback-service.ts` reverses instead of clobbering

In `handleChargebackCreated`, both branches: replace the current
`await paymentLifecycleDAL.freezeForDispute(rentalId);` /
`await servicePaymentLifecycleDAL.freezeForDispute(serviceBookingId);` (which
today runs unconditionally right before the `chargeback_created` alert) with:

```ts
const { record: lifecycle, alreadyPaidOut } =
  await paymentLifecycleDAL.freezeForDispute(rentalId);

if (alreadyPaidOut) {
  await handleChargebackAfterPayout({
    kind: "rental",
    entityId: rentalId,
    currentStatus: lifecycle.ownerTransferStatus,
    stripeTransferId: lifecycle.stripeTransferId,
    amountCents: dispute.amount,
    stripeDisputeId,
    chargeId,
  });
} else {
  await sendOpsAlert({
    event: "chargeback_created",
    rentalId,
    message: `Stripe chargeback received: ${stripeDisputeId} (amount: ${dispute.amount / 100} ${dispute.currency})`,
    metadata: {
      stripeDisputeId,
      chargeId,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
    },
    sendEmailAlert: true,
  }).catch(() => {});
}
```

(mirror for the service branch, `kind: "service"`, `entityId: serviceBookingId`,
`servicePaymentLifecycleDAL.freezeForDispute`). Add the shared helper in the
same file:

```ts
async function handleChargebackAfterPayout(params: {
  kind: "rental" | "service";
  entityId: string;
  /** `completed` or `reversed` — the only two statuses `alreadyPaidOut` covers. */
  currentStatus: string;
  stripeTransferId: string | null;
  amountCents: number;
  stripeDisputeId: string;
  chargeId: string;
}) {
  const { kind, entityId, stripeTransferId, amountCents, stripeDisputeId } =
    params;

  if (params.currentStatus === "reversed") {
    // A second chargeback, or a redelivery that got past dedupe: the
    // transfer is already back. Nothing to reverse.
    await sendOpsAlert({
      event: "chargeback_after_reversal",
      rentalId: kind === "rental" ? entityId : undefined,
      serviceBookingId: kind === "service" ? entityId : undefined,
      message: `Chargeback ${stripeDisputeId} arrived on a ${kind} whose transfer was already reversed — no action taken`,
      metadata: { stripeDisputeId, stripeTransferId, amountCents },
      sendEmailAlert: true,
    }).catch(() => {});
    return;
  }

  if (!stripeTransferId) {
    // `completed` with no transfer = closed by a refund, never paid out
    // (service `markRefundedAfterDispute`, R-BIZ-03). Nothing to reverse;
    // this is an ordinary chargeback on a refunded booking.
    await sendOpsAlert({
      event: "chargeback_created",
      rentalId: kind === "rental" ? entityId : undefined,
      serviceBookingId: kind === "service" ? entityId : undefined,
      message: `Stripe chargeback ${stripeDisputeId} on a ${kind} whose payout was closed without a transfer (refunded) — nothing to reverse`,
      metadata: { stripeDisputeId, amountCents },
      sendEmailAlert: true,
    }).catch(() => {});
    return;
  }

  const { reverseTransfer } = await import("./payout");
  const result = await reverseTransfer({
    transferId: stripeTransferId,
    idempotencyKey: `reverse-transfer-${entityId}-${stripeDisputeId}`,
    metadata: {
      [kind === "rental" ? "rentalId" : "serviceBookingId"]: entityId,
      stripeDisputeId,
    },
  });

  const dal =
    kind === "rental" ? paymentLifecycleDAL : servicePaymentLifecycleDAL;
  if (result.success) {
    // CAS completed → reversed (Step 5b's DAL method), so it composes with
    // the transfer.reversed webhook this reversal fires, whichever lands first.
    await dal.markTransferReversed(entityId);
    await auditLogDAL.create({
      entityType: kind === "rental" ? "rental" : "service_booking",
      entityId,
      action: "chargeback.transfer_reversed",
      metadata: {
        stripeDisputeId,
        stripeTransferId,
        reversalId: result.reversalId,
        amountCents,
      },
    });
    await sendOpsAlert({
      event: "chargeback_after_payout_reversed",
      rentalId: kind === "rental" ? entityId : undefined,
      serviceBookingId: kind === "service" ? entityId : undefined,
      message: `Chargeback ${stripeDisputeId} arrived after payout — transfer ${stripeTransferId} reversed (${result.reversalId})`,
      metadata: {
        stripeDisputeId,
        stripeTransferId,
        reversalId: result.reversalId,
        amountCents,
      },
      sendEmailAlert: true,
    }).catch(() => {});
  } else {
    await sendOpsAlert({
      event: "chargeback_after_payout_reversal_failed",
      rentalId: kind === "rental" ? entityId : undefined,
      serviceBookingId: kind === "service" ? entityId : undefined,
      message: `Chargeback ${stripeDisputeId} arrived after payout and the automatic reversal of transfer ${stripeTransferId} failed: ${result.error} — recover manually via the Stripe Dashboard`,
      metadata: {
        stripeDisputeId,
        stripeTransferId,
        amountCents,
        error: result.error,
      },
      sendEmailAlert: true,
    }).catch(() => {});
  }
}
```

`markTransferReversed` leaves `stripeTransferId`/`ownerTransferredAt`
alone, so the original transfer id stays on the row. The reversal id lives
only in the audit log and alert metadata; a dedicated column is out of
scope (Decision 2 only adds the enum value). `auditLogDAL` is already
imported in this file (`chargeback-service.ts:6-12`). If TS rejects the call
on the `dal` union, branch on `kind` explicitly. The shared helper must
also go in the service branch, passing
`currentStatus: lifecycle.ownerTransferStatus`. **Verify**:
`bun run type-check` → exit 0.

### 5b: `transfer.reversed` records `reversed`, never a resettable `failed`

Add to both DAL classes:

```ts
/** completed → reversed (BIZ-13). A no-op on any other status; returns whether it landed. */
async markTransferReversed(rentalId: string): Promise<boolean> {
  const rows = await this.db
    .update(rentalPaymentLifecycle)
    .set({ ownerTransferStatus: "reversed", updatedAt: new Date() })
    .where(
      and(
        eq(rentalPaymentLifecycle.rentalId, rentalId),
        eq(rentalPaymentLifecycle.ownerTransferStatus, "completed"),
      ),
    )
    .returning({ rentalId: rentalPaymentLifecycle.rentalId });
  return rows.length > 0;
}
```

(Wrap it in the usual try/`handleError`. The service mirror keys on
`bookingId`.)

In `webhook-handlers.ts` `handleTransferReversed` (`:236-252`), replace the
unconditional `"failed"` write:

- Look the transfer up on **both** DALs: `paymentLifecycleDAL.getByTransferId`,
  then `servicePaymentLifecycleDAL.getByTransferId` (both exist). Add the
  service DAL to the file's `@/dal` import.
- `transfer.reversed === true` (Stripe sets it only when the transfer is
  **fully** reversed): call `markTransferReversed`, then send the existing
  `transfer_reversed_webhook` alert (add `serviceBookingId` for the service
  case). A `false` return means Step 5 already wrote `reversed`, or the row
  was never `completed`. Either way, alert and leave it.
- `transfer.reversed === false` (a partial reversal, done by hand in the
  Dashboard): no status write; alert
  `transfer_partially_reversed_webhook` with `amount_reversed`.
- Never write `"failed"`. A `failed` row is resettable by
  `resetTransferStatus`, and a reset re-pays the owner.
- A transfer id that matches neither DAL: the captured-deposit transfers
  (`createDepositTransfer`, metadata `kind: "captured_deposit"`) aren't
  recorded on a lifecycle row. Log at info and return, as today.

**Verify**: `bun run type-check` → exit 0.

### 5c: `charge.dispute.closed` knows about a reversal

In `handleChargebackClosed`, resolve the payment the same way
`handleChargebackCreated` does (`getByChargeId` → `getByPaymentIntentId`),
for both `rentalId` and `serviceBookingId`. When `dispute.status === "won"`
and the matching lifecycle reads `reversed`, send
`chargeback_won_after_reversal` ("the platform recovered the funds; the
owner/provider's transfer {id} was reversed on {created} — re-pay manually")
**in addition to** the existing `chargeback_won` alert. Nothing
automatic (Decision 3b). **Verify**: `bun run type-check` → exit 0.

### 6: Freeze-aware claim CAS — rental cron

In `payment-lifecycle.dal.ts`, change `claimForProcessing` to also exclude
`frozen`, any row with an open dispute, and any row whose charge was
refunded (the finder's CONC-02 guard, copied verbatim so a Dashboard refund
landing between the finder and the claim is caught too). Return the fresh
row instead of a boolean:

```ts
async claimForProcessing(
  rentalId: string,
): Promise<{
  ownerTransferStatus: OwnerTransferStatus;
  stripeTransferId: string | null;
} | null> {
  try {
    const [result] = await this.db
      .update(rentalPaymentLifecycle)
      .set({ payoutStatus: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(rentalPaymentLifecycle.rentalId, rentalId),
          eq(rentalPaymentLifecycle.payoutStatus, "pending"),
          // Re-check at claim time what findEligibleForPayout only checked
          // at its own snapshot read (CONC-04): a freeze landing in between
          // must not let the claim through.
          ne(rentalPaymentLifecycle.ownerTransferStatus, "frozen"),
          notExists(
            this.db
              .select({ id: disputes.id })
              .from(disputes)
              .where(
                and(
                  eq(disputes.rentalId, rentalPaymentLifecycle.rentalId),
                  inArray(disputes.status, [
                    "open",
                    "evidence_requested",
                    "under_review",
                  ]),
                ),
              ),
          ),
          // Same list as findEligibleForPayout's CONC-02 guard. After R-BIZ-14:
          // IN ('refunded', 'partially_refunded'). Before it: = 'refunded'.
          // Keep the two in lockstep.
          sql`NOT EXISTS (SELECT 1 FROM ${payments} WHERE ${payments.rentalId} = ${rentalPaymentLifecycle.rentalId} AND ${payments.status} IN ('refunded', 'partially_refunded'))`,
        ),
      )
      .returning({
        ownerTransferStatus: rentalPaymentLifecycle.ownerTransferStatus,
        stripeTransferId: rentalPaymentLifecycle.stripeTransferId,
      });
    return result ?? null;
  } catch (error) {
    this.handleError(error, "PaymentLifecycleDAL.claimForProcessing");
  }
}
```

Add `notExists` to this file's `drizzle-orm` import (it is **not** imported
today; `inArray`, `sql`, `payments` and `disputes` are). In
`payment-lifecycle-service.ts`'s `processPayouts` (`:47-58`), replace the
boolean check and the stale snapshot read:

```ts
const claimed = await paymentLifecycleDAL.claimForProcessing(rental.rentalId);
if (!claimed) {
  getLogger().info(
    { rentalId: rental.rentalId },
    "Rental already claimed, frozen, or disputed — skipping",
  );
  continue;
}
```

and change `:66` from `const transferStatus = rental.lifecycle.ownerTransferStatus;`
to `const transferStatus = claimed.ownerTransferStatus;` — this is the fresh
value the claim itself just read, not the finder's stale snapshot. Change
`:116` `if (rental.lifecycle.ownerTransferStatus === "pending")` to
`if (transferStatus === "pending")` for the same reason. Leave every other
read of `rental.lifecycle.*` (`depositHoldStatus`, `rentalChargeId`) as the
finder snapshot — those aren't part of this race (CONC-10 already covers
deposit-hold staleness separately).

Two more guards in the same loop (added in review):

1. **Transfer-id invariant**, before `createOwnerTransfer`: if
   `transferStatus === "pending" && claimed.stripeTransferId`, money already
   moved for this rental (Step 2's frozen race, then an unfreeze). Set
   `payoutStatus` to `failed`, alert
   `payout_skipped_transfer_already_recorded` with the transfer id,
   `failureCount++`, `continue`. Never create a second transfer.
2. **Lost race on the completion write.** Check the `"completed"` write's
   return value (`:186-193` today):
   ```ts
   const recorded = await paymentLifecycleDAL.updateOwnerTransferStatus(
     rental.rentalId,
     "completed",
     {
       stripeTransferId: transferResult.transferId,
       ownerTransferredAt: new Date(),
     },
   );
   if (!recorded) {
     // A dispute froze the row while the transfer was in flight. The
     // transfer id is recorded (Step 2); the freeze stands. Needs a human:
     // the dispute's resolution must account for money already paid out.
     await paymentLifecycleDAL.updatePayoutStatus(rental.rentalId, "failed");
     await sendOpsAlert({
       event: "owner_transfer_completed_but_frozen",
       rentalId: rental.rentalId,
       message: `Owner transfer ${transferResult.transferId} sent, but a dispute froze the lifecycle in the same window — reconcile manually`,
       metadata: { stripeTransferId: transferResult.transferId },
       sendEmailAlert: true,
     });
     failureCount++;
     continue;
   }
   ```
   `payoutStatus: failed` keeps the finder away from the row. If an admin
   later resets it, guard 1 refuses the second transfer.

**Verify**: `bun run type-check` → exit 0.

### 7: Freeze-aware claim CAS — service cron

Mirror Step 6 in `service-payment-lifecycle.dal.ts`. The service finder
already requires `eq(ownerTransferStatus, "pending")` exactly (R-BIZ-03), so
match that in the claim rather than `ne(..., "frozen")` — anything other than
`"pending"` (including `"completed"` from a prior favor-renter refund) must
not be claimable here, which is also stricter than rental and intentional:

```ts
async claimForProcessing(
  bookingId: string,
): Promise<{ ownerTransferStatus: ServiceOwnerTransferStatus } | null> {
  try {
    const [result] = await this.db
      .update(servicePaymentLifecycle)
      .set({ payoutStatus: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(servicePaymentLifecycle.bookingId, bookingId),
          eq(servicePaymentLifecycle.payoutStatus, "pending"),
          eq(servicePaymentLifecycle.ownerTransferStatus, "pending"),
          notExists(
            this.db
              .select({ id: disputes.id })
              .from(disputes)
              .where(
                and(
                  eq(disputes.serviceBookingId, servicePaymentLifecycle.bookingId),
                  inArray(disputes.status, [
                    "open",
                    "evidence_requested",
                    "under_review",
                  ]),
                ),
              ),
          ),
        ),
      )
      .returning({ ownerTransferStatus: servicePaymentLifecycle.ownerTransferStatus });
    return result ?? null;
  } catch (error) {
    this.handleError(error, "ServicePaymentLifecycleDAL.claimForProcessing");
  }
}
```

Add `notExists` and `ne` to this file's drizzle-orm import (neither is
imported today).
In `service-payment-lifecycle-service.ts`'s `processPayouts` (`:57-62`),
replace the boolean check:

```ts
const claimed = await servicePaymentLifecycleDAL.claimForProcessing(
  row.bookingId,
);
if (!claimed) {
  continue;
}
```

No stale-snapshot read to fix here (unlike rental, this function never
branched on `ownerTransferStatus` after the claim — it went straight to the
transfer). Do **not** add a payments-refunded guard to the service claim.
Service partial dispute refunds lower `providerPayout` and then expect this
cron to pay the reduced amount (`dispute-resolution-service.ts`
`resolveServiceBookingDispute`). A full refund closes the row via
`markRefundedAfterDispute` (`completed`), which `eq(..., "pending")` already
excludes.

Also return `stripeTransferId` from the claim and add the same two guards
as Step 6: refuse when the claim returns a `stripeTransferId`, and check
the `"completed"` write in `processPayouts` (`:108-116`). On a lost race,
set `payoutStatus` to `failed`, alert `provider_transfer_completed_but_frozen`,
`failed += 1`, `continue`, and skip the payout notification.
**Verify**: `bun run type-check` → exit 0.

### 8: Dispute-aware cancel CAS — service

In `service-booking.dal.ts`, add the `disputes` import
(`import { disputes } from "@/db/schemas/disputes.schema";`) and extend
`updateIfStatus`:

```ts
async updateIfStatus(
  bookingId: string,
  expectedStatus: ServiceBooking["status"],
  updates: Partial<Omit<ServiceBooking, "id" | "createdAt">>,
  opts: {
    blockWhilePaymentProcessing?: boolean;
    /** Refuse the transition while an active (not-closed) dispute exists (CONC-05). */
    blockIfActiveDispute?: boolean;
  } = {},
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
    if (opts.blockIfActiveDispute) {
      conditions.push(
        notExists(
          this.db
            .select({ id: disputes.id })
            .from(disputes)
            .where(
              and(
                eq(disputes.serviceBookingId, serviceBookings.id),
                ne(disputes.status, "closed"),
              ),
            ),
        ),
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

`notExists`, `and`, `ne`, `isNull`, `or` are already imported in this file.
In `service-booking-service.ts`'s `cancelBooking` (`:820-830`), add
`blockIfActiveDispute: true` to the existing `opts` object:

```ts
const claimed = await serviceBookingDAL.updateIfStatus(
  bookingId,
  detail.status,
  {
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: userId,
    cancellationReason: reason?.trim() ?? null,
  },
  { blockWhilePaymentProcessing: true, blockIfActiveDispute: true },
);
```

The existing `if (!claimed) throw new ConflictError(...)` at `:831-835` is
unchanged — a dispute filed in the race window now surfaces as the same 409
a plain status race already produces, no new error shape. Then guard the
transfer-completion write (`:887-896`):

```ts
if (transferResult.success) {
  const recorded = await servicePaymentLifecycleDAL.updateOwnerTransferStatus(
    bookingId,
    "completed",
    {
      stripeTransferId: transferResult.transferId,
      ownerTransferredAt: new Date(),
      transferAmount: providerPayoutAmount,
    },
  );
  if (!recorded) {
    await sendOpsAlert({
      event: "provider_transfer_completed_but_frozen",
      serviceBookingId: bookingId,
      message: `Provider transfer ${transferResult.transferId} sent but the lifecycle was frozen by a dispute in the same window — funds sent, bookkeeping needs manual reconciliation`,
      metadata: {
        stripeTransferId: transferResult.transferId,
        amountCents: Math.round(providerPayoutAmount * 100),
      },
      sendEmailAlert: true,
    });
  }
}
```

**Verify**: `bun run type-check` → exit 0.

### 9: Dispute-aware cancel CAS — rental

In `rentals.dal.ts`, add `import { disputes } from "@/db/schemas/disputes.schema";`
and give `cancelApprovedRental` a `rentalId` parameter (every caller already
has `ctx.rentalId` in scope):

```ts
async cancelApprovedRental(
  requestId: string,
  rentalId: string,
  cancelledBy: string,
  cancellationReason: CancellationReason,
  cancellationNotes?: string | null,
): Promise<void> {
  try {
    const result = await this.db
      .update(rentalRequests)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason,
        ...(cancellationNotes != null && { cancellationNotes }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rentalRequests.id, requestId),
          eq(rentalRequests.status, "approved"),
          notExists(
            this.db
              .select({ id: disputes.id })
              .from(disputes)
              .where(and(eq(disputes.rentalId, rentalId), ne(disputes.status, "closed"))),
          ),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new ConflictError(RENTAL_STATE_CHANGED_MESSAGE);
    }
  } catch (error) {
    this.handleError(error, "cancelApprovedRental");
  }
}
```

Update both call sites in `cancellation-service.ts`:
`rentalDAL.cancelApprovedRental(rentalRequestId, ctx.rentalId, userId,
cancellationReason, context.reason ?? null)` (`:168-173`) and
`rentalDAL.cancelApprovedRental(rentalRequestId, ctx.rentalId, opsUserId,
cancellationReason)` (`:420-424`). The existing catch blocks (the
`alreadyRefunded` special case in `cancelApprovedRental`'s service function,
nothing special in `applyNoShow`) are unchanged — a dispute-caused CAS loss
surfaces as the same `ConflictError`/409 a status race already produces.

Then guard both transfer-completion sites. In `cancelApprovedRental`
(service function), replace the transfer-success branch (`:252-261`):

```ts
let transferRecorded = false;
if (transferResult.success) {
  ownerTransferAmountDollars = calc.ownerTransferAmountCents / 100;
  transferRecorded = await paymentLifecycleDAL.updateOwnerTransferStatus(
    ctx.rentalId,
    "completed",
    {
      stripeTransferId: transferResult.transferId,
      ownerTransferredAt: new Date(),
    },
  );
  if (!transferRecorded) {
    await sendOpsAlert({
      event: "owner_transfer_completed_but_frozen",
      rentalId: ctx.rentalId,
      message: `Owner transfer ${transferResult.transferId} sent but the lifecycle was frozen by a dispute in the same window — funds sent, bookkeeping needs manual reconciliation`,
      metadata: {
        stripeTransferId: transferResult.transferId,
        amount: calc.ownerTransferAmountCents / 100,
      },
      sendEmailAlert: true,
    });
  }
}
```

and gate `markCancelled`'s extra (`:276-281`) on `transferRecorded`, not on
`ownerTransferAmountDollars` (money can have moved — `ownerTransferAmountDollars`
stays set so the caller-facing response is still accurate — while the
lifecycle write itself lost the race):

```ts
await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
  ...(depositReleaseFailed ? {} : { depositHoldStatus: "released" as const }),
  ...(transferRecorded ? { ownerTransferStatus: "completed" as const } : {}),
});
```

(**R-DB-04 Step 8 edits the same two `markCancelled` calls**: it replaces the
`depositReleaseFailed ? {} : { depositHoldStatus: "released" }` line with
`depositOutcome === "released" ? { depositHoldStatus: "released" } : {}`.
Change only the `ownerTransferStatus` line here; if R-DB-04 has landed, keep
its deposit line as it is. Don't paste the snippet above over it.)

Mirror both changes in `applyNoShow` (`:472-482` transfer branch and
`:497-502` `markCancelled` call), same `transferRecorded` variable, same
alert event name. **Verify**: `bun run type-check` → exit 0.

### 10: Admin UI recognizes `"reversed"`

In `payment-lifecycle-list-client.tsx`: add `"reversed"` to
`COMBINED_PAYOUT_OPTIONS` (`:37-43`); add a branch to `getCombinedPayoutStatus`
(`:51-61`, before the `"completed"` check so it takes priority — a reversed
transfer is not "completed"):
`if (ownerTransferStatus === "reversed") return "reversed";`; add a case to
`combinedPayoutToFilters`'s switch (`:70-82`, TS will flag it as
non-exhaustive if you don't — that's the point):
`case "reversed": return { ownerTransferStatus: "reversed" };`. Add
`"reversed"` to `statusBadgeVariant`'s (`:84-93`) destructive list (treat it
like `"failed"` — needs ops attention): add `"reversed"` to the array on
`:87`. **Verify**: `bun run type-check` → exit 0 (the switch's exhaustiveness
check is the real verification here — a missing case is a compile error).

In `src/features/payments/lib/earnings.ts`: add `"reversed"` to
`TRANSFER_STATUSES` (`:58-64`). Without it, `asTransferStatus` maps the value
to `null` and the earnings feed (web and mobile) shows no status at all. Add
`transferStatus === "reversed"` to the `disputeId` link condition
(`:194-197`), since the chargeback's dispute is what explains the clawback.
Update the doc comment above `EARNINGS_TRANSFER_STATUSES`. Extend the
earnings test that pins `toEarningsItem` with a `reversed` row.

### 11: Tests

- **DAL** (`payment-lifecycle.dal.test.ts`, `service-payment-lifecycle.dal.test.ts`):
  render the WHERE for `claimForProcessing` and assert it contains
  `owner_transfer_status" <>`/`=` bound to `frozen`/`pending` plus a
  `NOT EXISTS` referencing `disputes` (rental: also the `payments`
  refunded `NOT EXISTS`); `updateOwnerTransferStatus` writing `"completed"`
  renders the `CASE WHEN ... 'frozen'` and still sets `stripe_transfer_id`,
  while `"failed"` renders a plain value; `freezeForDispute` on a fixture
  row with `ownerTransferStatus: "completed"` **and** one with `"reversed"`
  returns `alreadyPaidOut: true` and issues no UPDATE;
  `markTransferReversed` renders `WHERE ... owner_transfer_status = 'completed'`.
- **Webhook** (`webhook-handlers.test.ts`): `transfer.reversed` with
  `reversed: true` on a rental and on a service transfer calls
  `markTransferReversed`. With `reversed: false`, no status write and the
  partial alert fires. `updateOwnerTransferStatus(..., "failed")` is never
  called from this handler (regression pin: the old write made a reversal
  resettable).
- **Chargeback closed**: `won` + lifecycle `reversed` → both
  `chargeback_won` and `chargeback_won_after_reversal` fire. `won` +
  `completed` → only `chargeback_won`.
- **DAL** (`rentals.dal.test.ts`, `service-booking.dal.test.ts`): render
  `cancelApprovedRental`'s WHERE (contains `NOT EXISTS` + `disputes.rental_id`);
  `updateIfStatus` with `blockIfActiveDispute: true` adds the
  `NOT EXISTS` + `disputes.service_booking_id` condition; without the flag,
  unchanged from today.
- **Service** (`payment-lifecycle-service.test.ts`,
  `service-payment-lifecycle-service.test.ts`): claim returns `null` → the
  loop `continue`s, no deposit release/transfer call; claim returns
  `{ownerTransferStatus: "frozen"}` (can happen if the claim's own guard
  somehow still let a frozen row through in a future refactor — belt and
  suspenders) → the existing "not pending/completed" branch fires using the
  claim's fresh value, not a stale mock.
- **Service** (`cancellation-service.test.ts`): CAS loses (mock
  `rentalDAL.cancelApprovedRental` to throw `ConflictError`) →
  `processRefund` never called (mirrors the existing R-CONC-02 test, now
  also covering the dispute-caused loss path — same assertion, no new test
  needed if the existing "CAS loses" test already mocks the DAL to throw
  generically). New case: transfer succeeds but the guarded
  `updateOwnerTransferStatus` mock returns `false` → `sendOpsAlert` called
  with `event: "owner_transfer_completed_but_frozen"`, and
  `markCancelled`'s call args do NOT include `ownerTransferStatus`.
- **Service** (`service-booking-service.test.ts`): same transfer-guard case
  for `cancelBooking`, asserting `event: "provider_transfer_completed_but_frozen"`.
- **Unit** (`chargeback-service.test.ts`): mock `freezeForDispute` to return
  `{alreadyPaidOut: true, record: {stripeTransferId: "tr_1", ...}}` →
  `reverseTransfer` called with `idempotencyKey:
"reverse-transfer-{id}-{stripeDisputeId}"`; on success,
  `updateOwnerTransferStatus(id, "reversed")` called and `sendOpsAlert` fires
  `chargeback_after_payout_reversed`; on failure,
  `chargeback_after_payout_reversal_failed` fires instead and
  `updateOwnerTransferStatus` is never called with `"reversed"`. Existing
  `alreadyPaidOut: false` path: unchanged `chargeback_created` alert still
  fires (regression guard).
- **Unit** (`payout.test.ts`): `reverseTransfer` calls
  `transfers.createReversal(transferId, {metadata}, {idempotencyKey})`;
  Stripe rejection → `{success: false, error}`.

**Verify**: the targeted command in Commands → all pass, new cases included.

### 12: Real-DB tests (all required — money races)

New file `src/features/rentals/services/__tests__/payout-freeze-claim.integration.test.ts`,
modeled on `deposit-hold-claim.integration.test.ts` (its `createBarrier`
and local `until` helper). Seed a completed, payout-eligible rental
(`rentalPaymentLifecycle` row `payoutStatus: "pending"`,
`ownerTransferStatus: "pending"`, a `payments` row `status: "succeeded"`).
Three tests:

1. **Freeze between finder and claim (the CONC-04 window).** Wrap the real
   `findEligibleForPayout` with `vi.spyOn(paymentLifecycleDAL, "findEligibleForPayout")`
   so that, after the real query returns, it inserts an open `disputes` row
   and calls the real `paymentLifecycleDAL.freezeForDispute(rentalId)`
   before handing the (now stale) rows back. Run `processPayouts(20)`.
   Assert: `createOwnerTransfer` never called, and a fresh `db.select` shows
   `payoutStatus` still `pending` (claim refused) and `ownerTransferStatus`
   `frozen`. Repeat with only the dispute insert (no freeze call) to prove
   the claim's `NOT EXISTS` works alone, and with only a `payments` row
   flipped to `refunded`.
2. **Freeze while the transfer is in flight (the write-guard window).** Park
   `createOwnerTransfer` on a barrier and start `processPayouts(20)`. Wait
   until `payoutStatus = 'processing'`, then call the **real**
   `freezeForDispute(rentalId)` (a bare dispute insert doesn't change
   `ownerTransferStatus`, so it can't exercise the guard). Release the
   barrier with `{success: true, transferId: "tr_race"}`. Assert via a fresh
   `db.select`: `ownerTransferStatus = 'frozen'`,
   `stripeTransferId = 'tr_race'` (recorded despite losing),
   `payoutStatus = 'failed'`; `sendOpsAlert` fired
   `owner_transfer_completed_but_frozen`.
3. **Invariant guard.** Continue from test 2: `unfreezeAfterResolution`,
   reset `payoutStatus` to `pending` directly, run `processPayouts(20)`.
   Assert `createOwnerTransfer` was not called a second time and
   `payout_skipped_transfer_already_recorded` fired.

New file `src/features/services/services/__tests__/cancel-dispute-race.integration.test.ts`,
modeled on `service-decline-accept-race.integration.test.ts`. Seed an
`accepted` service booking with a charge and lifecycle. **Force** the
window instead of racing: wrap the real
`disputeDAL.getActiveByServiceBookingId` with `vi.spyOn` so it returns
`null` (the pre-read saw no dispute) and, before returning, inserts an
`open` dispute row and calls the real `freezeForDispute`. Then call
`ServiceBookingService.cancelBooking(...)`. Assert: it throws
`ConflictError`, the booking is still `accepted`, and neither
`processRefund` nor `createServiceTransfer` was called. Add the rental twin
in `src/features/rentals/services/__tests__/rental-cancel-dispute-race.integration.test.ts`:
spy on `rentalDAL.getRentalCancellationContext` the same way (insert an
open dispute on `ctx.rentalId` after the real read) and assert
`cancelApprovedRental` throws `ConflictError` with `processRefund` never
called. (An unforced `raceTwo` can't prove this: either order passes.) All
new test files mock Stripe and notifications the way their models do
(`vi.mock` blocks at the top); every DB statement is real.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration`
→ all pass, all three new files included.

## Test plan

Step 11 (unit/DAL, mocked) plus Step 12 (real-DB, forced interleavings) cover
every WHERE-clause change and every write-guard added by this plan. Full
regression: `bun run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0 (all new unit/DAL tests from Step 11)
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration`
      → exit 0 (all three new files from Step 12)
- [ ] Migration generated (two `ALTER TYPE ... ADD VALUE 'reversed'`
      statements), applied to local + confirmed on dev/staging per Production
      cutover
- [ ] `grep -n "notExists" src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts src/dal/rentals.dal.ts src/dal/service-booking.dal.ts` shows the new claim/CAS usage in all four files
- [ ] `grep -n "createReversal" src/services/stripe/payout.ts` shows a hit
- [ ] `grep -n '"failed"' src/services/stripe/webhook-handlers.ts` shows no
      `updateOwnerTransferStatus(..., "failed")` in `handleTransferReversed`
- [ ] `grep -n '"reversed"' src/features/payments/lib/earnings.ts` shows it
      in `TRANSFER_STATUSES`
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2 step outline item 3, and its own Execution-order row once one
      exists)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- `bun run db:generate` produces anything beyond the two enum-value
  `ALTER TYPE` statements.
- `payment_status` has no `partially_refunded` value yet (R-BIZ-14 not
  landed) but Step 6's claim lists it. Postgres rejects an unknown enum
  literal at runtime (`invalid input value for enum payment_status`), so
  use `= 'refunded'` and tell R-BIZ-14's executor to widen both the finder
  and the claim.
- `payment-lifecycle-admin-service.ts`'s reset-transfer-status tool turns out
  to allow resetting from `"reversed"` (it shouldn't — re-check
  `canResetTransfer`'s condition after this plan's enum change; if it's not
  an exact `=== "failed"` check today, tighten it as part of this plan rather
  than shipping a tool that can silently un-reverse a chargeback).
- A test fails twice after a reasonable fix attempt.
- The real-DB tests in Step 12 can't force the interleaving described (e.g.
  `processPayouts`'s claim and the dispute insert can't be made to land in
  the intended order even with a barrier) — report the actual ordering
  achieved rather than weakening the assertion.

## Mobile compatibility

- `ownerTransferStatus: "reversed"` reaches mobile through **`GET
/api/payouts/earnings`** (verified in review): `getUserEarnings` selects
  both lifecycles' `ownerTransferStatus` and `toEarningsItem` passes it
  through as `transferStatus` (Step 10 adds it to `TRANSFER_STATUSES`).
  Mobile's `earningsTransferStatusSchema`
  (`hoador-mobile/src/api/contract/earnings.contract.ts:31-38`) is a
  `tolerantEnum`, so today's binaries render the "unknown" pill, not a
  parse failure. The admin lifecycle routes and the service-booking
  lifecycle projection (`toServiceBookingLifecycleResponse`) also carry it;
  mobile's `ownerTransferStatusSchema` (`enums.ts:95`) is tolerant too. Add
  this row to the roadmap's Mobile client follow-ups table:

| Fix                | Contract change                                                                                 | Where the app sees it               | Mobile task | Status                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-CONC-04 (BIZ-13) | new terminal transfer state `reversed` in earnings `transferStatus` (and `ownerTransferStatus`) | earnings feed (`earnings-feed.tsx`) | —           | TODO: add `reversed` to `earningsTransferStatusSchema` and `ownerTransferStatusSchema`; render it as "Reversed (chargeback)", distinct from "Paid out"/"Refunded", with the dispute link |

- The 409 responses from Steps 8-9 (`blockIfActiveDispute`, the rental
  dispute-aware CAS) reuse the existing generic
  `"This booking/rental changed state while cancelling — refresh and try
again."` message with no new `code` — no mobile contract change, same as
  R-CONC-02's precedent.
- No other route shape changes anywhere in this plan.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-CONC-04 — apply migration 00NN (owner_transfer_status /
service_owner_transfer_status: reversed)` | From: R-CONC-04 | dev: TODO |
  staging: TODO | prod: TODO. Apply via the repo's standard migration step
  against both `.env.local` hosts (`ep-lucky-block` dev, `ep-polished-tree`
  staging — check host before running). No backfill — new enum values only.
- **New row**: `R-CONC-04 — confirm payment-lifecycle-admin-service.ts's
reset-transfer-status tool still rejects "reversed"` | From: R-CONC-04 |
  manual smoke check post-deploy on staging, per the STOP condition above.

## Maintenance notes

- **Rental dispute-filing has no `dispute_filed_post_payout`-style pre-check**
  (Decision 4). If a future incident shows this path is actually reached in
  practice (unlikely per the audit's own complementary-windows note), add the
  same pre-check `dispute-creation-service.ts:405-419` already has for
  service bookings, mirrored onto the rental branch around `:236`.
- **No debt ledger** (Decision 3). If reversal failures (insufficient
  connected-account balance) become common enough to need automated
  collection against a future payout, that's an ARCH-04-adjacent project, not
  a patch to this plan.
- **The `reversed` state is intentionally not resettable** by the admin
  reset-transfer-status tool (STOP condition) — a chargeback reversal is not
  a retry-able failure, it's a completed, opposite-direction transaction.
- `owner_transfer_completed_but_frozen` rows (Step 6/7 guard 2) are frozen
  with a recorded transfer id and `payoutStatus: failed`. The dispute's
  resolution must account for money already paid out. For a rental
  `favor_renter` or a service refund outcome, that means a manual reversal
  (Step 4's `reverseTransfer` is reusable). `unfreezeAfterResolution` leaves
  the row `pending` with a transfer id, and the crons' invariant guard keeps
  it from being paid again.
- Reversal timing (Decision 3b): a chargeback the platform **wins** after
  the reversal needs a manual re-transfer. The alert names the transfer.
- The claim-CAS `NOT EXISTS` subqueries (Steps 6-9) add one correlated
  subquery per claimed row per cron run (batch size ≤ 20) — negligible at
  this volume; if payout batch sizes grow substantially, consider indexing
  `disputes(rental_id, status)` / `disputes(service_booking_id, status)` if
  `EXPLAIN` shows a sequential scan (not expected at current data volume).
