# Plan R-DB-04: Dispute financial-ledger enum and state-machine drift fixes

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/db/schemas/_enums.ts src/features/disputes/services/dispute-resolution-service.ts src/features/disputes/lib/state-machine.ts src/features/disputes/components/admin-state-controls.tsx src/features/disputes/components/dispute-details.tsx src/dal/dispute.dal.ts src/dal/payment-lifecycle.dal.ts src/dal/rentals.dal.ts src/features/rentals/services/cancellation-service.ts src/features/rentals/services/payment-lifecycle-service.ts src/services/stripe/deposit-hold.ts src/services/stripe/rental-payments.ts src/services/stripe/webhook-handlers.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: LOW (one additive enum
  migration + a manual, idempotent backfill run after it; no destructive
  writes; every touched route already gates on admin or party)
- **Depends on**: none for the code fixes. The migration should land **after**
  R-DB-02's baseline squash (cross-plan decision 1) — take the next free
  migration number after that baseline, confirmed via `ls src/db/migrations`
  at execution time, not hard-coded here. **R-BIZ-14 owns** the dead
  `payment_intent.canceled` handler (its Step 4, which re-keys the handler
  on `metadata.rentalRequestId` instead of forwarding `rentalId`); this plan
  has no code for it (Step 7).
- **Category**: database / business-logic · **Planned at**: commit `29fe557`,
  2026-09-25
- **Fixes**: DB-04, BIZ-18 (partial — see "What this plan does NOT fix")

## Why this matters

**DB-04.** `dispute-resolution-service.ts` writes every rental deposit
financial operation as `operationType: "capture_deposit"`, whether the
dispute actually captured the deposit, released it, or had nothing to do
because there was no deposit or it wasn't `held`. A `favor_renter`/`dismissed`
resolution that releases a real deposit hold shows up in the participant's
dispute detail (`GET /api/disputes/[id]` → `financialOperations`) as "Capture
Deposit — succeeded", and a resolution with no deposit at all shows as
"Capture Deposit — failed" even though nothing failed. Both the audit trail
and the UI misstate what happened to the renter's money. Mobile already knows
about this: `resolution-copy.ts` carries a load-bearing comment explaining
that it has to _guess_ release-vs-capture from `resolutionOutcome` because the
wire gives it no way to tell — a workaround this plan removes the need for.

**BIZ-18 (the part this plan owns).** Four independent drift bugs, verified
against live code:

1. An admin can never move a `resolved` dispute to `closed`, even though the
   admin UI and the state-transition table both intend it. `getActiveByRentalId`/
   `getActiveByServiceBookingId` treat anything not `closed` as an active
   dispute, so once a dispute resolves, the "no active dispute" gate on service
   cancellation is permanently stuck — a resolved dispute blocks that party's
   service booking from ever being cancelled again.
2. The deposit hold's PaymentIntent metadata omits `rentalId`, so the
   `payment_intent.canceled` webhook handler — which explicitly reads
   `pi.metadata?.rentalId` — can never find a match and does nothing. The
   handler isn't dead by design; it's dead by a dropped field. **R-BIZ-14
   Step 4 owns this fix**; it is listed here only because BIZ-18 names it.
   (R-BIZ-14's review found forwarding `rentalId` wouldn't work: the
   immediate-hold path passes the rental _request_ id under that key. So
   Step 4 resolves the rental from `rentalRequestId`, which every hold
   already carries.)
3. `markCancelled` writes `depositHoldStatus: "released"` even when nothing
   was ever held (`not_applicable`) or a hold attempt had already failed
   (`failed`) — the audit trail then claims a release that never happened.
4. A renter cancelling their own still-`pending` request has that write
   go through the **denial** fields (`deniedAt`, `denialReason: "Cancelled by
renter"`) instead of the cancellation fields — a self-cancel is
   indistinguishable from an owner decline in the raw data (harmless today
   only because every UI consumer gates on `status === "denied"` first, which
   a self-cancel never sets).

## What this plan does NOT fix

BIZ-18 also lists "the freeze overwrites a `completed` transfer" and "make the
freeze a CAS" (`payment-lifecycle.dal.ts:628-657` `freezeForDispute`, an
unconditional `ownerTransferStatus: "frozen"` write). That single DAL method
is called both by an ordinary dispute filing (`dispute-creation-service.ts`)
and by a chargeback arriving **weeks after payout** — and the chargeback case
is BIZ-13's own finding, verbatim: "unconditionally overwrites
`ownerTransferStatus='completed'` with `'frozen'`... skip the freeze when the
transfer is already `'completed'`... suggest `transfers.createReversal`, or
auto-reverse." Roadmap Phase 2 step 3 assigns exactly that work — "chargeback
after payout" — to **R-CONC-04** alongside CONC-05, with its own real-DB race
tests. Touching `freezeForDispute`'s overwrite behavior here would collide
with that plan's edit to the same function and pre-empt its policy decision
(skip vs. reverse vs. book a debt). **Left alone. R-CONC-04 owns it —
re-read this note before changing `freezeForDispute`.** `overdue` having no
writer is also BIZ-18 text, but it's inert (state machine doc: "would be a
dead end if reached") and no recommended fix asks for a writer — not touched.

## Current state

**DB-04 — verified bug locations**, `src/features/disputes/services/dispute-resolution-service.ts`:

- `getDepositOperationForOutcome` (~L46-78) decides `{action}` only —
  `"held"`-gated `skip`/`capture_full`/`capture_partial`/`release` — with no
  way for a caller to know which of capture/release was _intended_ once
  `action === "skip"`.
- The skip branch inside `resolveDispute` (~L168-179) always writes:
  ```ts
  await disputeDAL.createFinancialOperation({
    disputeId,
    operationType: "capture_deposit",
    status: "failed",
    errorMessage: /* "No security deposit..." or "Deposit hold status is 'X'..." */,
    performedBy: adminId,
  });
  ```
  for every no-deposit `favor_renter`/`dismissed` resolution too — a
  perfectly normal, expected outcome recorded as a failure.
- `executeRelease` (~L721-770) — all three branches (no auth id, success,
  catch) write `operationType: "capture_deposit"`. The success branch
  (~L746-752) sets `stripePaymentIntentId: securityDepositAuthId` but never
  `stripeOperationId`, which is exactly the field R-BIZ-04's cutover backfill
  (`13-production-cutover.md` A3) already uses to tell a real capture from a
  mislabeled release (`stripe_operation_id IS NOT NULL`).
- `executeCapture` (~L534-596) already correctly uses `capture_deposit`
  throughout — not touched.
- The **service-booking** side of resolution
  (`resolveServiceBookingDispute`, ~L318-450, `executeServiceRefund`
  ~L462-522) correctly uses `refund_full`/`refund_partial` and writes no
  ledger row at all for the `favor_provider`/`dismissed` no-op case — DB-04
  does not reach service bookings.
- `src/services/stripe/dispute-financial.ts` (`StripeDisputeService`) has an
  independent, near-identical bug (`releaseDeposit`/`captureDeposit` both
  write `"capture_deposit"`) — but `grep -rln "StripeDisputeService" src`
  outside itself and its own test returns nothing. **Confirmed dead code, no
  production caller.** Not fixed (see Maintenance notes) — nothing recommends
  spending a migration on an unreachable path, but flag it for deletion.
- `src/db/schemas/_enums.ts:177-184`:
  ```ts
  export const financialOperationTypeEnum = pgEnum("financial_operation_type", [
    "hold_payout",
    "refund_partial",
    "refund_full",
    "capture_deposit",
    "transfer_deposit",
  ]);
  export const financialOperationStatusEnum = pgEnum(
    "financial_operation_status",
    ["pending", "succeeded", "failed"],
  );
  ```
- `src/features/disputes/lib/participant-view.ts` (~L287-293) already passes
  through only `{id, operationType, amount, status, performedAt}` to
  participants — no Stripe ids leak. Adding enum values needs no change here;
  the new values just flow through.
- `src/features/disputes/components/dispute-details.tsx` (admin/participant
  web dispute page) has two **non-exhaustive** `Record<string,string>` label
  maps (`getFinancialOperationLabel` ~L114-123, `getFinancialOperationStatusBadge`
  ~L125-145) that silently fall back to the raw enum string / a default badge
  for any type/status not listed — will render `"release_deposit"`/`"skipped"`
  literally until extended.

**BIZ-18 — verified bug locations**:

1. **Closed unreachable.** `src/features/disputes/lib/state-machine.ts`
   `VALID_TRANSITIONS.resolved = ["closed"]`, but `validateTransition`
   (~L52-83) checks `FINAL_STATES.includes(currentStatus)` **before**
   `canTransition`, and `FINAL_STATES = ["resolved", "closed"]` — so a
   `resolved → closed` call always fails with "Dispute is in final state
   (resolved) and cannot be modified", regardless of `VALID_TRANSITIONS`.
   Confirmed this is meant to be reachable, not dead by design:
   `state/route.ts`'s `updateStateSchema` already allows
   `newState: "closed"` (added when R-BIZ-05 removed `"resolved"` from the
   same enum, per its comment "Never `resolved`: that goes through
   POST .../resolve"), and `admin-state-controls.tsx` labels/describes
   `closed: "Close the dispute (final state)"` in code that can never
   execute — but the component's `if (isFinalState) return <...cannot be
modified.../>` (~L110-127) hides the whole panel, and thus the Close
   button, the moment `currentStatus === "resolved"`. Both the API and the UI
   need fixing together, or fixing one does nothing observable.
   `getActiveByRentalId`/`getActiveByServiceBookingId` (`dispute.dal.ts:194-279`)
   already correctly exclude only `"closed"` (`ne(disputes.status, "closed")`)
   — once `closed` is reachable, these need no change. Their readers, all
   re-checked: service cancel (`service-booking-service.ts:772`, preview
   route, booking detail page), dispute filing (`dispute-creation-service.ts:169,340`
   — one active dispute per booking), the rental detail RSC
   (`rental-details-server.tsx:106`), the admin lifecycle view
   (`payment-lifecycle.dal.ts:864`), and **chargebacks**
   (`chargeback-service.ts:110,190`): a chargeback on a booking whose
   dispute is `resolved` is attached to that dispute today; once it is
   `closed`, the same chargeback creates a new auto-dispute and freezes the
   transfer — the post-payout case R-CONC-04 owns. Closing is manual, so
   nothing changes until an admin closes one.
   **Two readers treat `closed` as "no outcome" and must change with this
   step** (neither is a wire-shape change): web `dispute-details.tsx:433`
   renders the resolution card only when `dispute.status === "resolved"`,
   and mobile `resolution-section.tsx` renders a bare "Dispute closed" for
   `closed` on the documented assumption that "support closed it by a
   status change, with no outcome and no financial operations". Today that
   is vacuously true; after this plan every `closed` dispute _was_ resolved
   and has an outcome, so both would hide the outcome and the money lines
   the moment an admin closes it. See Step 6 and Mobile compatibility.
2. **Hold metadata lacks `rentalId`.** `PlaceDepositHoldParams.metadata`
   (`src/services/stripe/deposit-hold.ts:6-23`) already **declares**
   `rentalId: string` as a required field, and every caller
   (`rental-service.ts:742`, `payment-lifecycle-service.ts:329,658`) already
   passes it. But `placeDepositHold`'s call into `authorizeSecurityDeposit`
   (~L45-50) drops it on the floor:
   ```ts
   {
     type: "security_deposit",
     rentalRequestId: params.metadata.rentalRequestId,
     listingId: params.metadata.listingId,
     renterId: params.metadata.renterId,
   },
   ```
   `SecurityDepositMetadata` (`rental-payments.ts:16-21`) has no `rentalId`
   field either. `webhook-handlers.ts:208-215` (`handlePaymentIntentCanceled`)
   reads `pi.metadata?.rentalId` and returns immediately if absent — dead
   code purely because of this one dropped field. (Correction, R-BIZ-14
   review: `rental-service.ts:742` passes `rentalRequest.id`, the request
   id, as `rentalId`, because the `rentals` row doesn't exist yet. So
   forwarding it wouldn't revive the handler for immediate holds. R-BIZ-14
   Step 4 keys on `rentalRequestId`.)
3. **`markCancelled` overwrites `not_applicable`/`failed`.**
   `cancellation-service.ts` L276-280 and L497-501 (the renter/owner-cancel
   and no-show handlers — the only two call sites):
   ```ts
   await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
     ...(depositReleaseFailed ? {} : { depositHoldStatus: "released" as const }),
     ...
   });
   ```
   `depositReleaseFailed` (from `settleDepositOnCancel`, ~L595-644) is `false`
   both when a real release succeeded **and** when there was nothing to
   release (`status !== "held"` — i.e. `not_applicable`, `failed`, or already
   `released`/`captured`/`expired`). `settleDepositOnCancel` returns a bare
   boolean today; it needs a third outcome so the caller can tell "released"
   from "nothing to do." The no-show path runs on `active`/`completed`
   rentals too, so today it also overwrites a dispute's `captured` with
   `released`.
   ⚠️ **The overwrite of `failed` is load-bearing today.**
   `PaymentLifecycleService.retryDepositHold` (`payment-lifecycle-service.ts:574-712`)
   checks only renter, `depositHoldStatus === "failed"` and a future start
   date — **not the request's status** — and `claimForDepositHold`
   (`payment-lifecycle.dal.ts:274-293`) claims any `scheduled`/`failed` row.
   Today `markCancelled` flips `failed → released`, which is what stops a
   renter from placing a real hold on a cancelled rental via
   `POST /api/rentals/[id]/retry-deposit`. It also closes a race: a retry
   that claimed `failed → placing` after the cancel read `ctx` loses its
   finalize CAS to the unconditional `released` write and releases the hold
   (`finalizePlacedHold`, `:531-568`). Simply leaving `failed` alone
   re-opens both. See Decision 4.
4. **Renter's pending-cancel writes denial fields.** `rentals.dal.ts`
   `cancelRentalRequest` (~L1855-1862):
   ```ts
   .set({
     status: "cancelled",
     deniedAt: new Date(),
     denialReason: "Cancelled by renter",
     ...
   })
   ```
   The schema (`rentals.schema.ts:83-87`) has separate `cancelledAt`/
   `cancellationReason` columns for exactly this. `cancellationReasonEnum`
   (`_enums.ts:261-267`) values are all approval-stage-specific by their own
   comments (`renter_cancellation // Renter cancelled after approval
(pre-pickup)`), so `cancellationReason` should stay `null` for a
   pre-approval self-cancel — only the field family (`cancelledAt`, not
   `deniedAt`/`denialReason`) is wrong. `grep -rn "denialReason\|deniedAt"`
   confirms every UI consumer already gates on `request.status === "denied"`
   first, so this is silent data pollution today, not a visible bug —
   still worth fixing before it corrupts an admin export or a future feature
   that reads `deniedAt IS NOT NULL` directly.

## Decisions for the maintainer

**1. One migration (the enum values); the backfill is a manual SQL step run
after `db:migrate`, not a second migration.** Postgres (12+) lets
`ALTER TYPE ... ADD VALUE` run inside a transaction but refuses to _use_ the
new value until that transaction commits ("unsafe use of new value"). The
check fires when the literal is parsed (`enum_in`), so an `UPDATE ... SET
operation_type = 'release_deposit'` fails even if it matches zero rows.
`bun run db:migrate` (drizzle-kit) runs **every pending migration in one
transaction** (`13-production-cutover.md` M1). An earlier draft split this
into Migration A (enum) + Migration B (custom backfill) "applied as two
`db:migrate` runs", but nothing can force two runs: wherever both files are
pending together — staging if it skips a deploy, **prod, where every
migration since the last cutover is pending at once**, any fresh database
built with `db:migrate` — the batch fails and rolls back everything with it.
Options: (a) two migrations, two runs — unenforceable, rejected; (b) a
backfill that avoids the new literals — impossible, it has to write them;
(c) the enum migration only, plus an idempotent SQL block the cutover doc
runs after M1 in each environment, like A3/A4 already do.
**Recommendation: (c).** Prod launches with this fix, so it has no
pre-fix rows; its step is a zero-count check. Steps 1 and 4 assume (c).

**2. Backfill keys off `stripe_operation_id` and `error_message`, not a new
column.** No schema change can retroactively record "this row was really a
release" — the plan reuses the same signal `13-production-cutover.md`'s R-BIZ-04
backfill (A3) already established: a succeeded `capture_deposit` with
`stripe_operation_id IS NULL` is a release (only a real Stripe capture call
sets that field); a failed row whose `error_message` matches the skip
branch's two known messages is a skip, not an attempt; the release path's
own "authorization not found … cannot release" message is a release.
Remaining failed rows (a Stripe error) can only be classified by the
dispute's **final** `resolution_outcome`. A failed attempt that an admin
then retried under a different outcome is misread; accept it (dev/staging
test data only, and a failed row never displays on mobile). See Step 4's
exact SQL.

**3. Pending-cancel keeps `cancellationReason: null`.** Reusing
`renter_cancellation` was considered and rejected — that value's own schema
comment restricts it to post-approval cancels, and repurposing it would break
that documented meaning for every future reader (admin exports, `12-booking-state-machine.md`'s
own tables). Only the field family moves (`deniedAt`/`denialReason` →
`cancelledAt`); `cancellationReason` stays `null`, matching what
`12-booking-state-machine.md`'s States table already documents as the
design ("It is NULL when a renter cancels a pending request").

**4. What a cancel does to a `failed` (never-placed) deposit.** BIZ-18 says
`markCancelled` shouldn't write `released` over `failed`. But that overwrite
is what keeps a cancelled rental out of `retryDepositHold` (see Current
state #3). Options: (a) leave `failed` and add a request-status check to
`retryDepositHold` — the check can't be atomic, because the cancel's
`approved → cancelled` CAS runs _after_ `settleDepositOnCancel`, so a retry
racing the cancel still places a hold; (b) CAS `failed → released` inside
`settleDepositOnCancel`, next to the existing `scheduled|placing → released`
CAS; (c) a new `cancelled` deposit status — another enum migration, and
every deposit reader to update. **Recommendation: (b).** `released` on a
never-placed hold already means "no hold outstanding and none will be
placed": that is exactly what the existing `scheduled → released` CAS writes.
The CAS wins or loses atomically against `claimForDepositHold`, and a retry
that already claimed the row (`placing`) is released by the same CAS, so its
finalize loses and it releases its own hold, as it does today. The drift
BIZ-18 is really about (`not_applicable`, `captured`, `expired` → `released`)
is removed. Step 8 assumes (b).

## Commands

| Purpose            | Command                                                                                                                                                                                                                                                                                            | Expected                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Typecheck          | `bun run type-check`                                                                                                                                                                                                                                                                               | exit 0                                              |
| Lint               | `bun run lint`                                                                                                                                                                                                                                                                                     | exit 0                                              |
| Generate migration | `bun run db:generate`                                                                                                                                                                                                                                                                              | one file, two `ALTER TYPE ... ADD VALUE` statements |
| Apply migration    | `bun run db:migrate` (local)                                                                                                                                                                                                                                                                       | exit 0                                              |
| Backfill (manual)  | Step 4's SQL block, run with `psql` after `db:migrate` — **not** a migration (Decision 1)                                                                                                                                                                                                          | idempotent; second run updates 0 rows               |
| Targeted tests     | `bun run test:run src/features/disputes src/dal/__tests__/dispute.dal.test.ts src/dal/__tests__/rentals.dal.test.ts src/features/rentals/services/__tests__/cancellation-service.test.ts src/services/stripe/__tests__/deposit-hold.test.ts src/services/stripe/__tests__/rental-payments.test.ts` | all pass                                            |
| Real-DB tests      | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                                                                                                                          | exit 0                                              |

## Scope

**In scope**: `src/db/schemas/_enums.ts` (+ one migration);
`src/features/disputes/services/dispute-resolution-service.ts`;
`src/features/disputes/lib/state-machine.ts`;
`src/features/disputes/components/admin-state-controls.tsx`;
`src/features/disputes/components/dispute-details.tsx` (labels + the
resolution card's `status === "resolved"` gate);
`src/app/admin/dashboard/how-it-works/payments/page.tsx` (its
`financialOperations` table and the "Release deposit … Gap" bullet at
~L855-866 become stale; update the copy);
`src/features/rentals/services/cancellation-service.ts`
(`settleDepositOnCancel` + its two callers); `src/dal/rentals.dal.ts`
(`cancelRentalRequest`); tests for all of the above.

**Out of scope**: the dead `payment_intent.canceled` handler
(`webhook-handlers.ts`; `deposit-hold.ts`/`rental-payments.ts` need no
change under R-BIZ-14's fix) — **R-BIZ-14 owns it** (Step 7); `payment-lifecycle.dal.ts` `freezeForDispute` (R-CONC-04,
see "What this plan does NOT fix"); `overdue`'s missing writer (inert, no
recommended fix); `src/services/stripe/dispute-financial.ts`
(`StripeDisputeService`, confirmed dead code — flagged in Maintenance notes,
not fixed); the service-booking dispute-resolution path (already correct).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### Step 1 (DB-04): Add `release_deposit` and `skipped` to the enums

In `src/db/schemas/_enums.ts`:

```ts
export const financialOperationTypeEnum = pgEnum("financial_operation_type", [
  "hold_payout",
  "refund_partial",
  "refund_full",
  "capture_deposit",
  "transfer_deposit",
  "release_deposit", // A deposit hold released, not captured (DB-04).
]);

export const financialOperationStatusEnum = pgEnum(
  "financial_operation_status",
  ["pending", "succeeded", "failed", "skipped"], // "skipped": nothing to capture/release (DB-04) — not a failure.
);
```

Run `bun run db:generate` (confirm the next free number under
`src/db/migrations/` first, after R-DB-02's baseline). This is a plain enum
addition, fully expressible by drizzle-kit — do not use `--custom` for this
one.

**Verify**: `bun run type-check` → exit 0 (the two new literals now flow
through `FinancialOperationType`/`FinancialOperationStatus` in `dal/types.ts`
automatically). The generated SQL contains exactly two `ALTER TYPE ... ADD
VALUE` statements, nothing else.

**Apply it locally**: `bun run db:migrate`, then
`SELECT enum_range(NULL::financial_operation_type);` lists `release_deposit`
and `SELECT enum_range(NULL::financial_operation_status);` lists `skipped`.
Do **not** add a second (custom) migration for the backfill (Decision 1).

### Step 2 (DB-04): Distinguish "release" from "capture" in the resolution service

In `dispute-resolution-service.ts`, change `DepositOperation` and
`getDepositOperationForOutcome` to carry the intended type through a skip:

```ts
type DepositAction = "capture_full" | "capture_partial" | "release" | "skip";

interface DepositOperation {
  action: DepositAction;
  /** What this would have been in ledger terms, even when action is "skip" —
   * so a no-op resolution still records which kind of operation there was
   * nothing to do for (DB-04), instead of a hardcoded "capture_deposit". */
  intendedType: "capture_deposit" | "release_deposit";
  partialAmountDollars?: number;
}

function intendedFinancialOperationType(
  outcome: DisputeResolutionOutcome,
): "capture_deposit" | "release_deposit" {
  return outcome === "favor_provider" ||
    outcome === "partial_provider" ||
    outcome === "partial_renter"
    ? "capture_deposit"
    : "release_deposit"; // favor_renter, dismissed
}

export function getDepositOperationForOutcome(
  outcome: DisputeResolutionOutcome,
  depositHoldStatus: string,
  partialAmountDollars?: number,
): DepositOperation {
  const intendedType = intendedFinancialOperationType(outcome);
  if (depositHoldStatus !== "held") {
    return { action: "skip", intendedType };
  }
  switch (outcome) {
    case "favor_provider":
      return { action: "capture_full", intendedType };
    case "favor_renter":
    case "dismissed":
      return { action: "release", intendedType };
    case "partial_provider":
    case "partial_renter":
      return { action: "capture_partial", intendedType, partialAmountDollars };
    default:
      return { action: "skip", intendedType };
  }
}
```

In `resolveDispute`'s skip branch (~L168-179), use `depositOp.intendedType`
and `status: "skipped"` instead of the hardcoded type and `"failed"`:

```ts
if (depositOp.action === "skip") {
  depositOperationStatus = "skipped";
  await disputeDAL.createFinancialOperation({
    disputeId,
    operationType: depositOp.intendedType,
    status: "skipped",
    errorMessage:
      depositHoldStatus === "not_applicable"
        ? "No security deposit on this rental"
        : `Deposit hold status is '${depositHoldStatus}' — cannot capture or release`,
    performedBy: adminId,
  });
}
```

Leave the `depositOperationStatus === "failed"` ops-alert-and-throw check
below unchanged — `"skipped"` (like `"captured"`/`"released"`) is a success
path, not a failure, and nothing here changes that control flow.

**Verify**: `bun run type-check` → exit 0.

### Step 3 (DB-04): Fix `executeRelease` — the actual mislabeling

Replace all three `createFinancialOperation` calls in `executeRelease`
(~L721-770) to use `"release_deposit"`, and capture the cancel PaymentIntent's
id on success (parity with `executeCapture`'s success branch):

```ts
private static async executeRelease(
  dispute: DisputeWithRelations,
  securityDepositAuthId: string | null,
  adminId: string,
): Promise<"released" | "failed"> {
  const rentalId = dispute.rentalId!;
  if (!securityDepositAuthId) {
    await disputeDAL.createFinancialOperation({
      disputeId: dispute.id,
      operationType: "release_deposit",
      status: "failed",
      errorMessage:
        "Security deposit authorization not found for rental — cannot release",
      performedBy: adminId,
    });
    return "failed";
  }

  try {
    const paymentIntent = await releaseSecurityDeposit(securityDepositAuthId);

    await paymentLifecycleDAL.updateDepositHoldStatus(rentalId, "released", {
      depositReleasedAt: new Date(),
    });

    await disputeDAL.createFinancialOperation({
      disputeId: dispute.id,
      operationType: "release_deposit",
      stripeOperationId: paymentIntent.id,
      stripePaymentIntentId: securityDepositAuthId,
      status: "succeeded",
      performedBy: adminId,
    });

    return "released";
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Deposit release failed:", error);

    await disputeDAL.createFinancialOperation({
      disputeId: dispute.id,
      operationType: "release_deposit",
      status: "failed",
      errorMessage,
      performedBy: adminId,
    });

    return "failed";
  }
}
```

`releaseSecurityDeposit` already returns `Promise<Stripe.PaymentIntent>`
(`rental-payments.ts:129-141`) — only the caller was discarding it.

**Verify**: `bun run type-check` → exit 0. Extend
`dispute-resolution-service.test.ts`: a `favor_renter`/`dismissed` resolution
on a `held` deposit writes `operationType: "release_deposit"`,
`status: "succeeded"`, and a non-null `stripeOperationId`; a no-deposit
`favor_renter` resolution writes `operationType: "release_deposit"`,
`status: "skipped"` (not `"failed"`); a `favor_provider`/`partial_*`
resolution is unchanged (`capture_deposit`).

### Step 4 (DB-04 backfill): Manual SQL reclassifying historical rows (not a migration)

**Do not** create a migration for this (Decision 1: it would share
`db:migrate`'s single transaction with Step 1's `ADD VALUE` wherever both are
pending, and Postgres rejects the new literals there). The SQL below goes
into `13-production-cutover.md` as a new "after deploying" step (see
Production cutover), run with `psql "$DATABASE_URL"` **after** `db:migrate`
has committed Step 1's migration in that environment. It is idempotent: rows
the fixed code writes never match (releases carry `stripe_operation_id`, skips
are already `skipped`), so a second run updates 0 rows. Run it soon after the
deploy: the third `UPDATE` classifies by final outcome, and the longer it
waits the more post-fix failed _capture_ rows it could see.

```sql
BEGIN;

-- 1. Succeeded "capture_deposit" rows with no Stripe capture id are releases
-- mislabeled by the pre-fix code (DB-04). Same signal as the cutover doc's
-- R-BIZ-04 step A3: only a real capture sets stripe_operation_id.
UPDATE dispute_financial_operations
SET operation_type = 'release_deposit'
WHERE operation_type = 'capture_deposit'
  AND status = 'succeeded'
  AND stripe_operation_id IS NULL;

-- 2. "failed" rows written by the skip branch (its two fixed messages) were
-- never attempts. Mark them skipped and take the type from the outcome;
-- a dispute with no outcome (never resolved) keeps its type.
UPDATE dispute_financial_operations dfo
SET status = 'skipped',
    operation_type = CASE
      WHEN d.resolution_outcome IN ('favor_renter', 'dismissed')
        THEN 'release_deposit'::financial_operation_type
      ELSE dfo.operation_type
    END
FROM disputes d
WHERE dfo.dispute_id = d.id
  AND dfo.operation_type = 'capture_deposit'
  AND dfo.status = 'failed'
  AND (
    dfo.error_message = 'No security deposit on this rental'
    OR dfo.error_message LIKE 'Deposit hold status is %'
  );

-- 3a. The release path's own "no authorization" failure is a release,
-- whatever the final outcome (the capture path's message has no suffix).
UPDATE dispute_financial_operations
SET operation_type = 'release_deposit'
WHERE operation_type = 'capture_deposit'
  AND status = 'failed'
  AND error_message = 'Security deposit authorization not found for rental — cannot release';

-- 3b. Other failures (a Stripe error) can only be read through the final
-- outcome (Decision 2). Capture-path failures are already correctly typed.
UPDATE dispute_financial_operations dfo
SET operation_type = 'release_deposit'
FROM disputes d
WHERE dfo.dispute_id = d.id
  AND dfo.operation_type = 'capture_deposit'
  AND dfo.status = 'failed'
  AND dfo.error_message IS DISTINCT FROM 'Security deposit authorization not found for rental'
  AND d.resolution_outcome IN ('favor_renter', 'dismissed');

COMMIT;
```

Before running it in any environment, take the four counts (the same
`WHERE` clauses as `SELECT count(*)`) and record them in the cutover row.

**Verify**: locally (after Step 1's `db:migrate`), run the block twice; the
second run reports `UPDATE 0` four times. Then
`SELECT operation_type, status, count(*) FROM dispute_financial_operations GROUP BY 1,2;`
shows no `capture_deposit`/`succeeded` row with a null `stripe_operation_id`
and no `capture_deposit`/`failed` row whose dispute resolved
`favor_renter`/`dismissed`. Local seeds create no resolved disputes, so to
exercise it, insert one row per `WHERE` branch by hand first (or run it
against a Neon branch of staging).

### Step 5 (DB-04): Web admin/participant labels

In `dispute-details.tsx`, add the two new literals so they don't fall back to
the raw enum string:

```ts
const labels: Record<string, string> = {
  hold_payout: "Hold Payout",
  refund_partial: "Partial Refund",
  refund_full: "Full Refund",
  capture_deposit: "Capture Deposit",
  release_deposit: "Release Deposit",
  transfer_deposit: "Deposit Paid to Owner",
};
```

and in the status badge config:

```ts
skipped: {
  className:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  label: "Skipped",
},
```

(the existing `config[status] || config.pending` fallback stays as the
catch-all for anything else).

**Verify**: `bun run type-check` → exit 0.

### Step 6 (BIZ-18 #1): Make `resolved → closed` actually reachable

In `state-machine.ts`, reorder `validateTransition` so the final-state check
only fires when the specific transition isn't the one `VALID_TRANSITIONS`
allows:

```ts
static validateTransition(
  currentStatus: DisputeStatus,
  newStatus: DisputeStatus,
  isAdmin: boolean,
): { valid: boolean; error?: string } {
  if (!this.canTransition(currentStatus, newStatus)) {
    if (this.isFinalState(currentStatus)) {
      return {
        valid: false,
        error: `Dispute is in final state (${currentStatus}) and cannot be modified`,
      };
    }
    return {
      valid: false,
      error: `Invalid transition from ${currentStatus} to ${newStatus}`,
    };
  }

  if (ADMIN_ONLY_STATES.includes(newStatus) && !isAdmin) {
    return {
      valid: false,
      error: `Admin privileges required to transition to ${newStatus}`,
    };
  }

  return { valid: true };
}
```

This still blocks `resolved → anything-else` and `closed → anything`
(`canTransition` is `false` for both), still gives the "final state" message
for those, and now lets `resolved → closed` (the one case `VALID_TRANSITIONS`
lists) through to the admin check.

In `admin-state-controls.tsx`, the whole panel is hidden by
`if (isFinalState) return <...cannot be modified.../>` whenever
`currentStatus` is `resolved` **or** `closed` — that hides the Close action
exactly when it should show. Change that one guard to `closed` only and let
`resolved` fall through to the component's generic last branch, which
already renders a button per `validNextStates` (for `resolved` that is
`["closed"]`, labelled "Closed", described "Close the dispute (final
state)") **and** the `AlertDialog` that `handleTransitionClick` opens:

```tsx
// Only `closed` is immutable; a `resolved` dispute can still be closed
// (BIZ-18). It falls through to the generic transitions branch below.
if (currentStatus === "closed") {
  return (/* the existing "final state and cannot be modified" card, unchanged */);
}
```

Delete the now-unused `isFinalState` local (lint). Do **not** give
`resolved` its own early-return card: the confirmation dialog lives inside
each branch's JSX, so a new branch without its own `AlertDialog` would render
a Close button whose click opens nothing.

In `dispute-details.tsx` (~L433), the resolution card is gated on
`dispute.status === "resolved"`; a closed dispute would lose its outcome,
reason, and resolver. Gate it on the outcome instead:

```tsx
{dispute.resolutionOutcome != null && (
```

(`closed` is only reachable from `resolved`, so every closed dispute has an
outcome; `updateState` doesn't touch the `resolution*` columns.) The
financial-operations card (~L480) is gated only on the list being non-empty,
so it needs no change.

`disputeDAL.updateState` is an unconditional `WHERE id` write. That is safe
for `resolved → closed` (nothing else moves a dispute out of `resolved`),
so this step doesn't change it. Making the state route a CAS belongs to
R-ARCH-01's transition helper.

**Verify**: `bun run type-check` → exit 0. New test in
`state-machine.test.ts`: a **transition-table test** — for every pair
`(from, to)` in the full `DisputeStatus` cross-product, assert
`validateTransition(from, to, true)` matches `VALID_TRANSITIONS` exactly:
`open→evidence_requested|under_review|resolved`,
`evidence_requested→under_review|resolved`, `under_review→resolved`,
`resolved→closed` valid; every other pair invalid, and every
`resolved→(not closed)` / `closed→*` pair carries the "final state" message.
(`open→resolved` is valid _here_; the state route's zod enum is what refuses
`resolved`, per BIZ-05 — pin that separately in the route test.) Also assert
`validateTransition("resolved", "closed", false)` is invalid (admin only).
Extend `admin-state-controls.test.tsx`: a `resolved` dispute shows a
"Closed" transition button (not the "cannot be modified" message); clicking
it opens the confirmation dialog, and confirming calls `updateState` with
`newState: "closed"`; a `closed` dispute still shows only the "cannot be
modified" card. Extend the `dispute-details` test (or add one): a `closed`
dispute with an outcome still renders the resolution card. Route test for
`PATCH /api/disputes/[id]/state`: `resolved → closed` as admin → 200.

### Step 7 (BIZ-18 #2): Deposit-hold `rentalId` metadata — owned by R-BIZ-14

**No code in this plan.** R-BIZ-14 Step 4 makes the
`payment_intent.canceled` handler reachable by resolving the rental from
`metadata.rentalRequestId`. It skips our own reason-less cancellations and
CAS-expires only `held`/`release_failed`, and it owns the tests. Don't edit
`deposit-hold.ts`, `rental-payments.ts` or `webhook-handlers.ts` here.

**Verify**: `grep -n "rentalRequestId" src/services/stripe/webhook-handlers.ts`
shows the handler's lookup. If R-BIZ-14 hasn't landed yet, note that in the
roadmap status row ("BIZ-18 #2 pending R-BIZ-14") and carry on; nothing else
in this plan depends on it.

### Step 8 (BIZ-18 #3): `markCancelled` no longer claims a release that didn't happen

In `cancellation-service.ts`, change `settleDepositOnCancel`'s return type
from `Promise<boolean>` to a three-way outcome so callers can tell "released"
from "nothing to release", and add `failed` to the never-placed CAS
(Decision 4):

```ts
type DepositSettleOutcome = "released" | "failed" | "not_held";

/** Never-placed states. A cancel closes them atomically so neither the cron
 * (`scheduled`) nor the renter's retry (`failed`, via `claimForDepositHold`)
 * can place a hold on a cancelled rental; a placer already in flight
 * (`placing`) loses its finalize CAS and releases its own hold. */
const NEVER_PLACED = ["scheduled", "placing", "failed"] as const;

async function settleDepositOnCancel(
  ctx: {
    rentalId: string;
    depositHoldStatus: string | null;
    securityDepositAuthId: string | null;
  },
  failureAlert: { event: string; message: string },
): Promise<DepositSettleOutcome> {
  let status = ctx.depositHoldStatus;
  let authId = ctx.securityDepositAuthId;

  if ((NEVER_PLACED as readonly string[]).includes(status ?? "")) {
    const released = await paymentLifecycleDAL.updateDepositHoldStatus(
      ctx.rentalId,
      "released",
      { fromStatus: [...NEVER_PLACED] },
    );
    if (released) return "released";

    const fresh = await paymentLifecycleDAL.getDepositHoldState(ctx.rentalId);
    status = fresh?.depositHoldStatus ?? null;
    authId = fresh?.securityDepositAuthId ?? null;
  }

  if (status !== "held" || !authId) return "not_held";

  try {
    await releaseDepositHold(authId);
    await paymentLifecycleDAL.updateDepositHoldStatus(
      ctx.rentalId,
      "released",
      {
        depositReleasedAt: new Date(),
      },
    );
    return "released";
  } catch {
    await paymentLifecycleDAL.updateDepositHoldStatus(
      ctx.rentalId,
      "release_failed",
    );
    await sendOpsAlert({
      event: failureAlert.event,
      rentalId: ctx.rentalId,
      message: failureAlert.message,
      sendEmailAlert: true,
    });
    return "failed";
  }
}
```

Update the function's doc comment (`@returns`) to describe the three
outcomes and why `failed` is in the CAS.

At both call sites (~L218 and ~L454), rename the local and change the
`markCancelled` argument to only claim `"released"` on the real outcome:

```ts
const depositOutcome = await settleDepositOnCancel(ctx, { ... });
// ...
await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
  ...(depositOutcome === "released" ? { depositHoldStatus: "released" as const } : {}),
  ...(ownerTransferAmountDollars != null
    ? { ownerTransferStatus: "completed" as const }
    : {}),
});
```

**R-CONC-04 edits the same two `markCancelled` calls** (its `ownerTransferStatus`
line becomes gated on `transferRecorded`). The edits are independent; if it
has landed, change only the deposit line and keep its transfer line.

`depositOutcome === "failed"` and `depositOutcome === "not_held"` both now
leave `depositHoldStatus` untouched by `markCancelled`: a `release_failed`
row stays `release_failed` (ops already alerted), and `not_applicable`,
`captured` (a no-show on a disputed, completed rental), `expired` and
`released` rows stay exactly what they were. `failed` never reaches
`not_held`: it is closed by the CAS above.

**Verify**: `bun run type-check` → exit 0. Extend
`cancellation-service.test.ts`/`cancellation-service-handlers.test.ts`
(mocked DAL): `not_applicable` and `captured` → `markCancelled` called with no
`depositHoldStatus` key; `failed` → `updateDepositHoldStatus(…, "released",
{ fromStatus: ["scheduled", "placing", "failed"] })`; `held` still ends
`released` (regression). **Real-DB test** (new
`src/features/rentals/services/__tests__/cancel-vs-deposit-retry.integration.test.ts`,
Stripe mocked, DB real): (1) a `failed` row, then `claimForDepositHold`
(the retry wins → `placing`), then the cancel runs with its stale `ctx`
(`failed`) → the row ends `released` and the retry's
`updateDepositHoldStatus("held", { fromStatus: "placing" })` returns false;
(2) a `failed` row cancelled first → a later `claimForDepositHold` returns
false; (3) a `not_applicable` row cancelled → still `not_applicable`.

### Step 9 (BIZ-18 #4): Renter's pending-cancel writes the cancellation fields

In `rentals.dal.ts` `cancelRentalRequest` (~L1855-1862):

```ts
.set({
  status: "cancelled",
  cancelledAt: new Date(),
  ...(cancellationNotes != null && { cancellationNotes }),
  updatedAt: new Date(),
})
```

(drop `deniedAt`/`denialReason` entirely — `cancellationReason` stays
unset/`null`, per Decision 3).

**Verify**: `bun run type-check` → exit 0. Extend `rentals.dal.test.ts`: a
renter cancelling their own `pending` request results in a row with
`cancelledAt` set, `cancellationReason: null`, and `deniedAt`/`denialReason`
both `null`.

### Step 10: Full regression

**Verify**: `bun run test:run` → all pass. `docker compose up -d && bun run
db:push:e2e && bun run test:integration` → all pass, including Step 8's new
`cancel-vs-deposit-retry.integration.test.ts`.

## Test plan

Covered inline per step: a transition-table test for the full
`DisputeStatus` state machine plus the admin panel's Close flow and the
resolution card on a `closed` dispute (Step 6); unit tests pinning the new
`operationType`/`status` combinations for release, skip, and capture (Steps
2-3); a `settleDepositOnCancel` three-way-outcome test for
`not_applicable`/`captured`/`failed`/`held` (Step 8); a DAL test for the
renter pending-cancel field family (Step 9). Step 8 changes a CAS
(`failed` joins the never-placed set) that races the renter's retry, so it
gets a **real-DB** interleaving test; mocks can't prove the `WHERE`. Step 4's
backfill is verified by running it twice against hand-inserted rows. The
deposit-hold metadata test belongs to R-BIZ-14. Full regression:
`bun run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; `bun run test:integration` → exit 0
- [ ] Exactly one new migration (the two `ADD VALUE`s); the backfill SQL is
      in `13-production-cutover.md`, not in `src/db/migrations/` (Decision 1)
- [ ] A `favor_renter`/`dismissed` resolution on a `held` rental deposit
      writes `operation_type = 'release_deposit'`, `status = 'succeeded'`
      (test)
- [ ] A no-deposit resolution writes `status = 'skipped'`, never `'failed'`
      (test)
- [ ] A `resolved` dispute can transition to `closed` via `PATCH
/api/disputes/[id]/state`, the admin UI offers that action with a
      working confirmation dialog, and the web resolution card still shows
      on the `closed` dispute (tests)
- [ ] Cancelling a rental whose deposit was `not_applicable`/`captured`
      leaves `depositHoldStatus` unchanged; a `failed` one is CAS-closed so
      the renter's retry can't claim it (unit + real-DB tests)
- [ ] A renter cancelling their own pending request sets `cancelledAt`, not
      `deniedAt`/`denialReason` (test)
- [ ] `12-booking-state-machine.md` updated: `resolved → closed` row
      (reachable, admin, `PATCH …/state`), the BIZ-18 `not_applicable|failed
→ released` row (now: `failed` closed by CAS; `not_applicable`
      untouched), and the "cancellation is blocked forever after any
      dispute" note
- [ ] No files outside Scope modified (`git status`)
- [ ] Mobile follow-up rows (below) added to the roadmap's Mobile client
      follow-ups table; cutover rows added to `13-production-cutover.md`
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2, "Dispute ledger enum and backfill; state-machine drift
      fixes")

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- You are about to put the backfill `UPDATE`s in a migration file, or in the
  same migration as the `ADD VALUE`s (Decision 1).
- `bun run db:generate` for Step 1 produces anything other than two
  `ALTER TYPE ... ADD VALUE` statements.
- `retryDepositHold` or `claimForDepositHold` has changed since `29fe557`
  (e.g. gained a request-status check) — Decision 4's reasoning depends on
  their current shape; re-read before Step 8.
- `freezeForDispute` has already been edited by R-CONC-04 in a way that
  conflicts with this plan's "leave it alone" — re-read that plan's diff
  before touching `payment-lifecycle.dal.ts` at all.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

**1. New ledger values.** `operationType: "release_deposit"` and
`status: "skipped"` now appear in `GET /api/disputes/[id]`'s
`financialOperations` (rental disputes only). Mobile's
`financialOperationTypeSchema`/`financialOperationStatusSchema`
(`hoador-mobile/src/api/contract/enums.ts:156-170`) are `tolerantEnum`, so
old binaries parse them as `unknown` (and `reportUnknownEnum` reports each
one; expect that noise until the mobile update ships). Both lists are also
missing R-BIZ-04's `transfer_deposit`. The behavioral effect:
`resolution-copy.ts`'s `depositLines()` filters
`succeeded(dispute, 'capture_deposit')` and _guesses_ release vs capture from
`resolutionOutcome` (its doc comment #2 names this gap, "R-13.2.2"). After
this plan, releases are `release_deposit`, so on an old binary the "The
security deposit hold was released. Nothing was taken from it." line
disappears — for disputes resolved after deploy **and**, once Step 4's
backfill has run, for historical ones too. No crash; a missing sentence.

**2. `closed` now follows `resolved`.** Admin-only on the write side, but
visible to mobile: `resolution-section.tsx` renders a bare "Dispute closed"
(plus `resolutionReason`) for `closed`, on the documented assumption that a
closed dispute has no outcome or financial operations. After this plan every
`closed` dispute was resolved first, so on every shipped binary closing a
dispute hides its outcome headline, deposit/refund lines and payout line.
The reason text still shows. Until the mobile fix ships, admins should close
disputes only when the outcome no longer matters to the parties (or not at
all). Nothing forces a close.

**3. Pending self-cancel.** No shape change. `rental-timeline.ts:84` reads
`cancelledAt` for a cancelled rental; a pending self-cancel had it `null`
(the date sat in `deniedAt`), so the timeline's terminal stage showed no
date. It now shows the date, which is a fix. `rental-detail-screen.tsx:252` shows
`denialReason` only when `status === 'denied'`, so it is unaffected.

Add these rows to the roadmap's Mobile client follow-ups table:

| Fix     | Contract change                                                                                                                                      | Where the app sees it              | Mobile task | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-DB-04 | New `operationType: "release_deposit"` (releases were sent as `capture_deposit`, and the backfill re-types historical ones); new `status: "skipped"` | Dispute detail, rental disputes    | —           | TODO: add `release_deposit`, `transfer_deposit` and `skipped` to the `enums.ts` contract lists; make `depositLines()` match `succeeded(dispute, 'release_deposit')` and render "The security deposit hold was released. Nothing was taken from it." for those rows. That **replaces** the `resolutionOutcome` guess for amount-less rows (keep "captured in full" for an amount-less `capture_deposit`). Update doc comments #1 (no-deposit rows are now `skipped`, not `failed`) and #2. |
| R-DB-04 | `closed` is now reachable, only from `resolved`, and keeps `resolutionOutcome`/`resolutionReason`/`financialOperations`                              | Dispute detail `ResolutionSection` | —           | TODO: render the resolved summary (headline + consequences) whenever `resolutionOutcome` is set, whether the status is `resolved` or `closed`; keep the bare "Dispute closed" only for a `closed` dispute with no outcome.                                                                                                                                                                                                                                                                |

## Production cutover

Add to `13-production-cutover.md`:

- **New M-row**: `bun run db:migrate` for 00NN (`financial_operation_type`
  `release_deposit`; `financial_operation_status` `skipped`) | From: R-DB-04 |
  dev: TODO | staging: TODO | prod: TODO. Also add it to M1's migration
  table: "No data prep. Two `ALTER TYPE ... ADD VALUE`; no existing row uses
  them." It must be applied **before** the code deploys (the new code writes
  both values), as every M-row already is.
- **New A-row**: "Reclassify pre-fix dispute ledger rows (R-DB-04)" |
  From: R-DB-04 | dev: TODO | staging: TODO | prod: **N/A expected** (prod
  launches with the fix; run the four counts, and mark N/A if all are 0).
  Its "After deploying" section holds Step 4's SQL block verbatim, with:
  run after the M-row in the same environment (check the host first);
  **never** as a migration (Postgres rejects a new enum value in the
  transaction that added it, and `db:migrate` batches every pending file into
  one transaction); record the four pre-run counts; it is idempotent.

## Maintenance notes

- `src/services/stripe/dispute-financial.ts` (`StripeDisputeService`) has the
  same release/capture mislabeling bug and is confirmed dead code (no
  importers outside itself and its own test). Not fixed here to keep this
  diff to the live path. **R-LOW-BIZ Part G deletes it** (and its test).
- If R-CONC-04 later needs `freezeForDispute` to also become a real CAS
  (BIZ-18's own recommended-fix text asked for this too, alongside the
  overwrite fix this plan deliberately left alone), that's the natural place
  to do both at once — don't split "make it a CAS" and "don't overwrite
  completed" across two plans editing the same function twice.
- **For R-BIZ-14 (the handler's owner; already folded into its Step 4 in
  review, kept here for the record):** once the handler is reachable,
  `handlePaymentIntentCanceled` also fires for **our own**
  releases, because every `releaseSecurityDeposit` is a
  `paymentIntents.cancel`. If the webhook beats the caller's `released`
  write (dispute `executeRelease`, `settleDepositOnCancel`, the
  return-release path), the row goes `held → expired` and ops gets a false
  "Deposit hold expired" email. The caller's unconditional write then
  restores `released`. Gate the handler on `pi.cancellation_reason ===
"automatic"` (Stripe's reason for an expired authorization; our cancels
  pass none) and make its write a CAS `fromStatus: "held"`.
- `overdue` still has no writer anywhere in production code. If a future
  feature needs it, re-verify the mermaid diagram's claim that it would be a
  dead end (end requires `active`, cancel refuses `overdue`) before wiring a
  writer — nothing in the current codebase exercises that state at all.
