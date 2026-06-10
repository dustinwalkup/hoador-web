# Plan 004: Stop cancellation from clobbering failed deposit releases; make deposit-hold retries actually retryable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- src/features/rentals/services/cancellation-service.ts src/services/stripe/deposit-hold.ts src/features/rentals/services/payment-lifecycle-service.ts src/dal/payment-lifecycle.dal.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (highest-value bug fix in this plan set)
- **Effort**: M
- **Risk**: MED (money path; mitigated by tests and small diffs)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

Two related bugs in the security-deposit-hold lifecycle:

1. **The `release_failed` clobber.** When an approved rental is cancelled and the Stripe deposit-hold release fails, the code correctly sets `depositHoldStatus = "release_failed"` and sends an ops alert — and then, ~50 lines later, unconditionally calls `markCancelled(rentalId, { depositHoldStatus: "released" })`, overwriting the failure marker. Result: a live authorization hold sits on the renter's card (until Stripe auto-expires it, ~7 days) while the database says "released". The expiry-monitoring cron only looks at `"held"` rows, so nothing ever notices. The only trace is one ops email.

2. **Retries blocked by a fixed idempotency key.** `placeDepositHold` always uses idempotency key `deposit-hold-${rentalId}`. When the scheduled hold fails (card declined) and the renter updates their payment method and hits "retry", `retryDepositHold` calls Stripe with the **same key but different parameters** (new payment method). Within Stripe's 24h idempotency window that returns an `idempotency_error` ("keys can only be used with the same parameters"), so the retry can never succeed on the day it matters. The rental-charge path already solved this exact problem (`rental-service.ts:443-447` appends a retry suffix); the deposit path was missed.

## Current state

- `src/features/rentals/services/cancellation-service.ts:178-203` — the release attempt:
  ```ts
  const depositStatus = ctx.depositHoldStatus;
  if (depositStatus === "held" && ctx.securityDepositAuthId) {
    try {
      await releaseDepositHold(ctx.securityDepositAuthId);
      await paymentLifecycleDAL.updateDepositHoldStatus(ctx.rentalId, "released", { depositReleasedAt: new Date() });
    } catch {
      await paymentLifecycleDAL.updateDepositHoldStatus(ctx.rentalId, "release_failed");
      await sendOpsAlert({ event: "deposit_release_failed_on_cancel", … });
    }
  } else if (depositStatus === "scheduled") {
    await paymentLifecycleDAL.updateDepositHoldStatus(ctx.rentalId, "released");
  }
  ```
- `src/features/rentals/services/cancellation-service.ts:248-253` — the clobber:
  ```ts
  await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
    depositHoldStatus: "released",
    ...(ownerTransferAmountDollars != null
      ? { ownerTransferStatus: "completed" as const }
      : {}),
  });
  ```
- `src/dal/payment-lifecycle.dal.ts:495-531` — `markCancelled` sets `payoutStatus: "completed"` always, and spreads `extra.depositHoldStatus` only when provided. So **omitting** `depositHoldStatus` from the call preserves whatever the earlier code set.
- `src/dal/payment-lifecycle.dal.ts:459-485` — `findExpiringDeposits` filters `eq(rentalPaymentLifecycle.depositHoldStatus, "held")`, joined to `rentals` for `securityDepositAuthId`, `limit(20)`. (Uses `and`, `eq`, `lte` from drizzle-orm.)
- `src/services/stripe/deposit-hold.ts:27-46` — `placeDepositHold` hardcodes:
  ```ts
  const idempotencyKey = `deposit-hold-${params.rentalId}`;
  const paymentIntent = await authorizeSecurityDeposit(params.customerId, params.paymentMethodId, params.amount, {…}, idempotencyKey);
  ```
  `authorizeSecurityDeposit` (`src/services/stripe/rental-payments.ts:66`) already accepts `idempotencyKey?: string` and passes it to `paymentIntents.create`.
- `src/features/rentals/services/payment-lifecycle-service.ts:487-594` — `retryDepositHold`: validates renter ownership, requires `lifecycle.depositHoldStatus === "failed"`, resolves a payment method (possibly a new default from Stripe), then calls `placeDepositHold({ rentalId: rental.id, customerId, paymentMethodId, amount, metadata })` — no key control. On success calls `updateDepositHoldStatus(rental.id, "held", …)`.
- `src/features/rentals/services/payment-lifecycle-service.ts:232-298` — the cron path (`scheduleDepositHolds`) processes `"scheduled"` rows and calls the same `placeDepositHold`. Cron and retry operate on **disjoint statuses** ("scheduled" vs "failed"), so they cannot race each other. Two _concurrent retries_ converge on the same payment method and (after this plan) the same idempotency key, so Stripe dedupes them to one PaymentIntent.
- Deposit status enum (`src/db/schemas/_enums.ts:202`): `scheduled | held | released | expired | release_failed | failed | captured | not_applicable`. **Do not add enum values** — that requires a DB migration and is out of scope.
- Test conventions: vitest, mocks via `vi.mock`, exemplar service test `src/features/rentals/services/__tests__/payment-lifecycle-service.test.ts`.

## Commands you will need

| Purpose        | Command                                                             | Expected on success |
| -------------- | ------------------------------------------------------------------- | ------------------- |
| Typecheck      | `bun run type-check`                                                | exit 0              |
| Lint           | `bun run lint`                                                      | exit 0              |
| Targeted tests | `bun run test:run src/features/rentals src/dal src/services/stripe` | all pass            |
| Full tests     | `bun run test:run`                                                  | all pass            |

## Scope

**In scope**:

- `src/features/rentals/services/cancellation-service.ts`
- `src/services/stripe/deposit-hold.ts` (add optional param)
- `src/features/rentals/services/payment-lifecycle-service.ts` (`retryDepositHold` only)
- `src/dal/payment-lifecycle.dal.ts` (`findExpiringDeposits` filter only)
- Tests: `src/features/rentals/services/__tests__/` (cancellation + retry cases), `src/dal/__tests__/` if a payment-lifecycle DAL test exists

**Out of scope**:

- `src/db/schemas/**` and migrations — no enum/schema changes.
- `scheduleDepositHolds` (the cron path) — its fixed key is correct for its state machine; leave it.
- `service-payment-lifecycle*` — services have no deposit holds; the rental/service unification is plan 008.
- `monitorDepositExpiry`'s per-row logic — only the DAL query filter changes.
- Refund/transfer logic in cancellation-service — only the deposit-status handling and the `markCancelled` call.

## Git workflow

- Branch: `advisor/004-deposit-hold-lifecycle-fixes` off `develop`
- Commit per step; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Preserve `release_failed` through cancellation

In `cancellation-service.ts`, introduce a flag around the release attempt:

```ts
let depositReleaseFailed = false;
// … in the catch block that sets "release_failed":
depositReleaseFailed = true;
```

Then change the `markCancelled` call to omit the deposit override when the release failed:

```ts
await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
  ...(depositReleaseFailed ? {} : { depositHoldStatus: "released" as const }),
  ...(ownerTransferAmountDollars != null
    ? { ownerTransferStatus: "completed" as const }
    : {}),
});
```

The rental still transitions to cancelled (correct — the renter shouldn't be blocked by our Stripe failure); the lifecycle row now truthfully says `release_failed`.

**Verify**: `bun run type-check` → exit 0.

### Step 2: Make the expiry monitor see `release_failed` holds

In `findExpiringDeposits` (`src/dal/payment-lifecycle.dal.ts:459`), replace the equality filter with an `inArray` over both stuck-hold states:

```ts
inArray(rentalPaymentLifecycle.depositHoldStatus, ["held", "release_failed"]);
```

(import `inArray` from `drizzle-orm` if not already imported in the file). `monitorDepositExpiry` retrieves the PI from Stripe and marks the row `expired` when Stripe reports `canceled` — exactly the right terminal handling for a failed release that later auto-expires, with an ops alert on that transition already built in.

**Verify**: `bun run type-check` → exit 0. `grep -n "inArray" src/dal/payment-lifecycle.dal.ts` → match in `findExpiringDeposits`.

### Step 3: Per-payment-method idempotency key on retry

1. `src/services/stripe/deposit-hold.ts` — add an optional override:
   ```ts
   interface PlaceDepositHoldParams {
     …existing fields…
     idempotencyKey?: string;
   }
   // in the function body:
   const idempotencyKey = params.idempotencyKey ?? `deposit-hold-${params.rentalId}`;
   ```
2. `retryDepositHold` (`payment-lifecycle-service.ts:563`) — pass a key that varies by payment method:
   ```ts
   const holdResult = await placeDepositHold({
     …existing args…,
     idempotencyKey: `deposit-hold-${rental.id}-${paymentMethodId}`,
   });
   ```

Why payment-method-keyed rather than `Date.now()`-keyed (the charge path's approach): two concurrent retry clicks resolve the same payment method → same key → Stripe returns the **same** PaymentIntent, so a double-click cannot place two holds. A retry with a genuinely new card gets a new key and proceeds. A retry with the _same_ card that just declined replays the decline within 24h — acceptable, since retrying an unchanged declining card cannot succeed anyway.

**Verify**: `bun run type-check` → exit 0.

## Test plan

Extend/create tests under `src/features/rentals/services/__tests__/` (model mock structure on `payment-lifecycle-service.test.ts`; check whether a cancellation-service test file already exists and extend it if so):

1. **Cancellation, release succeeds** → `markCancelled` called WITH `depositHoldStatus: "released"`.
2. **Cancellation, `releaseDepositHold` throws** → `updateDepositHoldStatus(…, "release_failed")` called, AND `markCancelled` called WITHOUT a `depositHoldStatus` key (assert via `expect.not.objectContaining` or by inspecting the call args object), AND rental cancellation still proceeds.
3. **Cancellation, deposit was `scheduled`** → unchanged behavior (`released`).
4. **retryDepositHold success** → `placeDepositHold` called with `idempotencyKey` equal to `deposit-hold-<rentalId>-<paymentMethodId>`.
5. **retryDepositHold when status is not `failed`** → returns `{ success: false }` without calling Stripe (existing behavior — regression guard).

If `src/dal/__tests__/` has a payment-lifecycle DAL test, add: `findExpiringDeposits` query includes `release_failed` (or, if DAL tests run against mocked db builders, assert the `inArray` arguments).

**Verification**: `bun run test:run src/features/rentals src/dal src/services/stripe` → all pass including the new cases.

## Done criteria

- [ ] After a failed release during cancellation, the lifecycle row reads `release_failed` (test 2 passes)
- [ ] `findExpiringDeposits` covers `held` and `release_failed`
- [ ] `retryDepositHold` uses a payment-method-scoped idempotency key; cron path unchanged (`grep -n "deposit-hold-" src/services/stripe/deposit-hold.ts src/features/rentals/services/payment-lifecycle-service.ts` shows the default in deposit-hold.ts and the suffixed key in retryDepositHold only)
- [ ] `bun run type-check`, `bun run lint`, `bun run test:run` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any "Current state" excerpt doesn't match the live code (drift) — especially line numbers in cancellation-service.ts.
- `markCancelled`'s conditional-spread behavior differs from the excerpt (i.e. omitting `depositHoldStatus` does NOT preserve the existing value) — the whole Step 1 design rests on that; report.
- `placeDepositHold` has other callers besides `scheduleDepositHolds` and `retryDepositHold` (`grep -rn "placeDepositHold(" src`) — assess whether the new param affects them; if unclear, report.
- A test reveals the cron picks up `"failed"` rows (would reintroduce a cron/retry race) — report; do not redesign inline.

## Maintenance notes

- Deferred deliberately: a DB-level claim (conditional `UPDATE … WHERE depositHoldStatus = expected`) for deposit transitions, mirroring `claimForProcessing` on the payout path. Stripe-level idempotency now covers the realistic races; add the claim if a new concurrent writer appears (e.g. an admin "force release" button).
- Plan 008 (payment-lifecycle unification spike) must take the post-fix semantics as its baseline — deposit statuses, the `release_failed` flow, and the keying scheme.
- Reviewer should scrutinize Step 1's flag placement: `depositReleaseFailed` must only be true in the `catch` of the `"held"` branch, not the `"scheduled"` branch.
