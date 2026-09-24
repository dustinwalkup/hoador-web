# 016 — Earnings: show the exact amount paid out when a refund reduced it

> **Executor instructions:** Read the whole plan first. Run the drift check,
> honor the STOP conditions, and update this plan's row in `plans/README.md`
> when done (then delete this file, per the README).
>
> **Drift check (run first):**
> `git diff --stat HEAD -- src/features/payments/lib/earnings.ts src/dal/payment.dal.ts src/db/schemas/rental-payment-lifecycle.schema.ts src/features/rentals/services/cancellation-service.ts src/features/rentals/services/payment-lifecycle-service.ts src/dal/payment-lifecycle.dal.ts`
> If anything in scope changed since this plan was written, compare
> "Current state" against the live code; a mismatch is a STOP condition.

## Status

- **Priority:** P2 · **Effort:** M · **Risk:** MED (money display, migration)
- **Category:** feature gap (money visibility)
- **Written:** 2026-09-24, as the planned half of the Earnings "Paid out" fix
  (mobile Epic 13 follow-up to R-BIZ-03). The first half shipped the same day
  and is described under "Current state".

## Why this matters

The earnings feed (`GET /api/payouts/earnings`, mobile's Earnings screen)
shows each booking's `gross`, `platformFee` and `net`, where `net` is
`gross − fee` **before any refund**. When a refund reduced what the owner or
provider was paid (a partial dispute outcome, or a cancellation that paid
them a share), `net` is not what they received. Today the app handles that by
**not** showing a payout figure ("Your payout: Reduced by the refund"), which
is honest but unhelpful: the one number the screen exists to answer is
missing exactly when someone has a question about it.

## Current state (after the 2026-09-24 first half)

- `toEarningsItem` (`src/features/payments/lib/earnings.ts`) derives
  `transferStatus: "refunded"` for `completed` with no `stripeTransferId`
  (a full dispute refund, `markRefundedAfterDispute`), and sends
  `refundAmount` (`payments.refund_amount`, verbatim) when the charge is
  marked refunded.
- `paymentDAL.getUserEarnings` includes a refunded charge only when the payee
  was paid, is owed, or a dispute refunded it (transfer id present, transfer
  `failed`, or a dispute row). Pinned by
  `src/dal/__tests__/payment-earnings.integration.test.ts`.
- The mobile row shows "Your payout: None" for `refunded`, "Your payout:
  Reduced by the refund" when `refundAmount` is set, and `net` otherwise
  (`hoador-mobile/src/features/payments/components/earnings-feed.tsx`,
  `PayoutRow`).
- **Where the real amounts live:**
  - **Service:** `service_payment_lifecycle.transfer_amount` is the USD actually
    transferred, written by both completed-transfer paths
    (`service-payment-lifecycle-service.ts` payout cron,
    `service-booking-service.ts` cancellation share). Before transfer,
    `provider_payout` is what is owed, already reduced for partial dispute
    outcomes (`updateProviderPayout`).
  - **Rental:** `rental_payment_lifecycle` has **no** amount column. The
    normal payout transfers `rentals.owner_payout`
    (`payment-lifecycle-service.ts`). A cancellation transfers a computed
    `calc.ownerTransferAmountCents` (`cancellation-service.ts`, two call sites)
    that is not persisted anywhere queryable.

## Design

1. **Record the rental transfer amount.** Add
   `rental_payment_lifecycle.transfer_amount numeric(10,2)` (nullable),
   mirroring the service column. Write it in every path that sets
   `owner_transfer_status = 'completed'` with a transfer id: the payout cron
   (`rentals.owner_payout`) and both cancellation paths
   (`calc.ownerTransferAmountCents / 100`). Extend
   `paymentLifecycleDAL.updateOwnerTransferStatus`'s `extra` with
   `transferAmount`, as the service DAL already has.
2. **Backfill** past completed rental transfers with a one-off script that
   reads each `stripe_transfer_id` from Stripe (`transfers.retrieve`, amount in
   cents) and writes `transfer_amount`. It must be idempotent (only rows where
   it is null), have a dry-run mode, and not run from CI. Service rows need no
   backfill (the column has been written since it was added; verify with a
   count of `completed` service rows where `transfer_amount IS NULL AND
stripe_transfer_id IS NOT NULL`, and STOP if non-zero).
3. **Expose `paidOut`** on `EarningsItem`: a decimal string or null, never
   computed in JS.
   - `completed`: the lifecycle's `transfer_amount`.
   - `refunded`: null, not `"0.00"`. A zero the server never recorded would be
     a computed value. The app keeps its "None" wording.
   - `pending` / `processing` / `frozen` / `failed`: what is owed. For a service
     that is `provider_payout`. For a rental that is `rentals.owner_payout`, and
     null when the charge has a refund (a cancellation share is transferred
     immediately, so a refunded rental that is still pending is an ops case).
   - Select these in `getUserEarnings` as the columns themselves (they are
     `numeric`, so the driver returns strings), not via a raw `sql` expression.
4. **App:** add `paidOut: decimalStringSchema.nullish()` to the earnings
   contract (normalize to null). `PayoutRow` shows `paidOut` when present,
   falls back to the current wording when null, and never shows `net` for a
   row with a `refundAmount`. Label: "Your payout" for completed, "Payout due"
   for owed states.

## Steps

1. Migration + schema column (coordinate the migration number with any
   in-flight migration on `develop`; `bun run db:generate`, review the SQL).
2. DAL `updateOwnerTransferStatus` `extra.transferAmount`; write it in the three
   rental completed-transfer paths. Unit tests on each path assert the amount.
3. Backfill script under `scripts/`, with dry-run, idempotent, logged. Do not run
   it against production as part of this plan: hand it to the user.
4. `EarningsRow` / `EarningsItem` / `toEarningsItem`: add `paidOut` per Design
   §3. Unit tests in `earnings.test.ts` for each state × marketplace.
5. Extend `payment-earnings.integration.test.ts` with a rental row factory (none
   exists yet; add `createRental` to `src/test/integration/factories.ts`) and
   assert `paidOut` for a completed rental, a partly refunded service, a frozen
   service with a reduced `provider_payout`, and a full dispute refund (null).
6. Mobile (`../hoador-mobile`): contract field, `PayoutRow`, tests in
   `earnings-feed.test.tsx`. Keep the "never computes money" rule: no arithmetic
   on `gross`/`net`/`refundAmount`.

## Test plan

- `bun run type-check && bun run lint && bun run test:run`
- `docker compose up -d && bun run db:push:e2e && bun run test:integration`
  (the integration DB is shared with other sessions; coordinate before running)
- Mobile: `npx tsc --noEmit && npx eslint . && npx jest`
- Mutation checks: `paidOut` taken from `net`; rental cancellation path not
  writing `transfer_amount`; `refunded` sent as `"0.00"`.

## STOP conditions

- Any `completed` service row with a transfer id and no `transfer_amount`
  (step 2's count is non-zero): the "service needs no backfill" assumption is
  wrong.
- A completed-transfer write path not listed here (grep
  `updateOwnerTransferStatus(` with `"completed"` on both lifecycles first).
- Stripe transfer amounts that disagree with `rentals.owner_payout` for normal
  payouts in the backfill dry run: report the rows rather than choosing one.

## Mobile compatibility

Additive: `paidOut` is optional on the wire and normalized to null, so an app
built before this change ignores it, and one built after it handles a server
without it. No enum changes.
