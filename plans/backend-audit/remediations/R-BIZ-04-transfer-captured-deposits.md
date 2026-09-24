# R-BIZ-04: Transfer captured security deposits to the owner

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/disputes/services/dispute-resolution-service.ts src/dal/rentals.dal.ts src/dal/dispute.dal.ts src/db/schemas/_enums.ts src/db/schemas/disputes.schema.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED
- **Depends on**: none · **Category**: bug (money)
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

When a damage dispute is resolved in the owner's favor (`favor_provider`) or
partially (`partial_provider`/`partial_renter`), the platform captures the
renter's security deposit hold — but no code ever moves that captured amount
to the owner. The rental payout cron transfers only the pre-computed rental
`ownerPayout`. The lifecycle then reads `captured` + `completed`, which looks
healthy on every dashboard while the platform silently keeps money that is
contractually the owner's. This is required by
`specs/payments/phase3/1-requirements.md` Req 10.1/10.3/10.4 and by
`specs/cancellation-refund-policy.html` §4 (the owner gets the full captured
deposit on top of the rental payout). Audit finding BIZ-04 (HIGH).

## Current state

- `dispute-resolution-service.ts:513-574` `executeCapture` — captures the
  deposit hold via `PAYMENT_SERVER_INSTANCE.paymentIntents.capture(...)`
  (533-544), calls `paymentLifecycleDAL.markDepositCaptured(rentalId)`
  (546), records a `capture_deposit` financial operation (548-556). **No
  transfer.**
- `payment-lifecycle-service.ts:135-143` (rentals, cron `processPayouts`) —
  the only amount ever transferred: `ownerPayoutAmount: Number(rental.ownerPayout)`.
- `src/services/stripe/payout.ts` (full file, 56 lines) — the pattern to
  mirror for a new transfer helper:

```ts
export async function createOwnerTransfer(params: CreateOwnerTransferParams) {
  const idempotencyKey = /* transfer-owner-{rentalId}[-retry-{n}] */;
  const transfer = await PAYMENT_SERVER_INSTANCE.transfers.create(
    { amount: Math.round(params.ownerPayoutAmount * 100), currency: "usd",
      destination: params.ownerConnectedAccountId,
      source_transaction: params.rentalChargeId,
      metadata: { rentalId: params.rentalId, ... } },
    { idempotencyKey },
  );
  return { success: true, transferId: transfer.id };
}
```

- `assert-connect-ready.ts:27-81` `assertConnectReady(userId, {bookingType, bookingId})` — fail-closed live Stripe check; throws `PaymentSetupRequiredError` if not ready. Used at accept/approve time; not yet used for post-resolution transfers.
- `disputes.schema.ts:162-190` `disputeFinancialOperations` — has a
  `stripeTransferId` column already (line 175), but
  `financialOperationTypeEnum` (`_enums.ts:177-182`) is
  `["hold_payout", "refund_partial", "refund_full", "capture_deposit"]` —
  **no value fits a transfer-to-owner**. `dispute.dal.ts:1357-1388`
  `createFinancialOperation` already accepts `stripeTransferId` in its input
  type — only the enum needs a new value, not the DAL method.
- `constants/payments.ts` — `PLATFORM_FEE_PERCENTAGE = 0.2`.
- **Fee rule — decided by the product owner 2026-09-24: no platform fee on a
  captured deposit.** The owner receives the **full** captured amount:
  `depositTransfer = capturedAmount`. The deposit compensates the owner for
  damage; it is not platform revenue (matches Turo, which pays hosts 100% of
  reimbursements, and Airbnb/Vrbo damage claims). The platform absorbs
  Stripe's processing fee on the capture. The spec (phase 3 Req 10) and the
  policy page (§4) were reworded to say so; the audit-time wording of §4
  ("… captured deposit minus platform fee") is superseded. The existing
  rental `ownerPayout` transfer is untouched — this plan adds a **second,
  separate** transfer for the deposit leg, not a change to the first.
  `PLATFORM_FEE_PERCENTAGE` must **not** appear in the deposit-transfer code.
- No `rentalDAL` method returns owner + Connect-account info by `rentalId`
  alone; the closest existing pattern is
  `getRentalDepositReleaseContext(rentalId)` (`rentals.dal.ts:3066-3089`), a
  small purpose-built join. Model the new lookup on it.

## Commands

| Purpose        | Command                                                                        | Expected                                   |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| Typecheck      | `bun run type-check`                                                           | exit 0                                     |
| Lint           | `bun run lint`                                                                 | exit 0                                     |
| DB diff        | `bun run db:generate`                                                          | review the generated SQL before continuing |
| Targeted tests | `bun run test:run src/features/disputes src/dal/__tests__/rentals.dal.test.ts` | all pass                                   |
| Full tests     | `bun run test:run`                                                             | all pass                                   |

## Scope

**In scope**: `src/db/schemas/_enums.ts` (`financialOperationTypeEnum`, add
one value), a new migration file, `src/dal/rentals.dal.ts` (new context
method), `src/services/stripe/payout.ts` (new transfer helper OR a new
private method in `dispute-resolution-service.ts` — pick one, see Step 2),
`src/features/disputes/services/dispute-resolution-service.ts`
(`executeCapture` only), tests for all of the above.

**Out of scope**: the rental payout cron's existing `ownerPayout` transfer
(unchanged); `partial_renter`/`dismissed` outcomes (no capture, nothing to
transfer); the dead `src/services/stripe/dispute-financial.ts` (already
flagged unreachable by the audit — do not resurrect it).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Add the `transfer_deposit` enum value

In `_enums.ts`, add `"transfer_deposit"` to `financialOperationTypeEnum`.
Generate the migration: `bun run db:generate --name=add_transfer_deposit_financial_op`.
Open the generated SQL and confirm it's a single
`ALTER TYPE "financial_operation_type" ADD VALUE 'transfer_deposit';`
statement — review it, do not hand-edit unless it's not that.
**Verify**: `bun run type-check` → exit 0; migration file exists under `src/db/migrations/`.

### Step 2: Add a rental owner/Connect-account lookup

In `rentals.dal.ts`, near `getRentalDepositReleaseContext`, add:

```ts
async getRentalOwnerTransferContext(rentalId: string): Promise<{
  ownerId: string; requestId: string;
  ownerConnectedAccountId: string | null;
} | null> {
  const [row] = await this.db
    .select({ ownerId: rentals.ownerId, requestId: rentals.requestId,
      ownerConnectedAccountId: user.stripeConnectedAccountId })
    .from(rentals).innerJoin(user, eq(rentals.ownerId, user.id))
    .where(eq(rentals.id, rentalId)).limit(1);
  return row ?? null;
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 3: Transfer the captured amount after a successful capture

In `executeCapture` (`dispute-resolution-service.ts`), after
`markDepositCaptured(rentalId)` succeeds (after line 546) and before the
`createFinancialOperation` "succeeded" call, add: fetch the context from
Step 2; call `assertConnectReady(ctx.ownerId, {bookingType: "rental", bookingId: rentalId})`
(catch and treat a throw the same as "not ready" below — do not let it
propagate and fail the whole capture); if ready and
`ctx.ownerConnectedAccountId` is set, set
`depositTransferAmount = captureAmount` — the full captured amount, no
platform fee (see "Fee rule" above; use the same `captureAmount` already
computed at line 532-535; for a full capture it's the full deposit) and call a new transfer with idempotency key
`` `deposit-transfer-${dispute.id}` `` and `source_transaction` = the
just-captured `paymentIntent.latest_charge` (coerce
`string | Stripe.Charge`, same pattern as `chargeback-service.ts:37-38`'s
`dispute.charge` extraction). On success, include
`stripeTransferId: transfer.id` in the `createFinancialOperation` call with
`operationType: "transfer_deposit"` — a **second** operation row, separate
from the `capture_deposit` one already being written. On failure (Connect not
ready, or the transfer call fails), do **not** throw and do **not** fail the
capture (deposit capture already succeeded and money already left the
renter) — instead `await sendOpsAlert({event: "deposit_transfer_failed", rentalId, message: ..., sendEmailAlert: true})`
and record a `transfer_deposit` financial operation with `status: "failed"`
so it's retryable/visible. The resolution completes normally either way.
**Verify**: `bun run type-check` → exit 0.

### Step 4: Ops backfill query (manual — describe only)

No code. Add the query below to Maintenance notes for ops to run by hand
against past captures that predate this plan.

## Test plan

- **Service** (`dispute-resolution-service.test.ts`): `favor_provider` (full
  capture) on a rental with a ready Connect account → one
  `transfers.create` call with amount = the full `capturedAmount` in cents (no fee deducted) and key
  `deposit-transfer-{disputeId}`; one new `transfer_deposit` financial
  operation with `status: "succeeded"` and the transfer id. A
  `partial_provider` capture → same, scaled to the partial amount.
- **Failure path**: Connect account not ready (mock `assertConnectReady` to
  throw) → capture and dispute resolution still succeed; `sendOpsAlert`
  called with `event: "deposit_transfer_failed"`; a `transfer_deposit`
  financial operation recorded `status: "failed"`.
- **DAL**: `getRentalOwnerTransferContext` returns `null` for an unknown
  rental id (existing mock pattern, e.g. `rentals.dal.test.ts`).

**Verify**: `bun run test:run src/features/disputes src/dal/__tests__/rentals.dal.test.ts` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] `bun run db:generate` produces exactly one new migration; its SQL was reviewed
- [ ] A test proves a `favor_provider`/partial capture creates exactly one transfer with key `deposit-transfer-{disputeId}`
- [ ] A test proves the failure path alerts ops and does not fail the resolution
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `bun run db:generate` produces anything other than a single `ADD VALUE`
  statement (e.g. it tries to recreate the enum type) — report the generated
  SQL rather than hand-editing it.
- `paymentIntent.latest_charge` from the capture response is `null` (should
  not happen for a captured PaymentIntent, but if seen, treat as a transfer
  failure per Step 3's failure path, not a thrown error).
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- No API response shape changes — this is a server-side/admin-only money
  movement inside dispute resolution. `POST /api/disputes/[id]/resolve`'s
  success response is unchanged.
- The owner's earnings/payment-history views (mobile and web) read from
  `payments`/transfer records; a new `transfer_deposit` financial-operation
  row and a real Stripe transfer make the owner's actual balance correct.
  If either client surfaces `dispute_financial_operations.operationType` in
  a UI (check before shipping a client-facing changelog item), it must treat
  `"transfer_deposit"` as an unknown-safe value — confirm any such enum on
  the client is rendered through a tolerant/unknown fallback, not a switch
  that throws on an unrecognized case.

## Maintenance notes

- **Ops backfill** for captures that predate this plan (manual, not
  automated here):
  `SELECT dfo.dispute_id, dfo.amount, d.rental_id FROM dispute_financial_operations dfo JOIN disputes d ON d.id = dfo.dispute_id WHERE dfo.operation_type = 'capture_deposit' AND dfo.status = 'succeeded' AND NOT EXISTS (SELECT 1 FROM dispute_financial_operations t WHERE t.dispute_id = dfo.dispute_id AND t.operation_type = 'transfer_deposit')`
  — for each row, transfer the full `amount` (no fee) to the owner's Connect account with
  key `deposit-transfer-{dispute_id}` (safe to reuse — Stripe dedupes) via
  the Stripe Dashboard or a one-off script; do not bulk-automate without
  ops sign-off per row.
- The no-fee rule is a product decision (2026-09-24). If it is ever reversed,
  only Step 3's `depositTransferAmount` and the test amounts change — and the
  policy page §4 and phase 3 Req 10 must be reworded with it.
- Depends conceptually on R-BIZ-05's rental eligibility work only in that
  both touch payout correctness for rentals; they do not touch the same
  functions, so no rebase coordination is needed.
