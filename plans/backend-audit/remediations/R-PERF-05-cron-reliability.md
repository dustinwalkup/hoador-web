# Plan R-PERF-05: Cron reliability — hourly payouts, independent steps, concurrency guard, claim-first deposit holds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first, from `hoador-web`)**:
> `git diff --stat 25e2233..HEAD -- .github/workflows/cron-jobs.yml src/app/api/cron/ src/dal/payment-lifecycle.dal.ts src/features/rentals/services/payment-lifecycle-service.ts src/db/schemas/_enums.ts`
> On any change, compare "Current state" against the live files before
> proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: performance / concurrency / reliability
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: PERF-05, PERF-06, CONC-10, ARCH-04 (short-term half only)

## Why this matters

Payouts run once a day, capped at 20 per type, against a spec that says
hourly — the ceiling is cadence × cap, not a broken loop, and it's invisible
until the backlog outgrows 20/day. The daily job's 7 `curl --fail` steps run
sequentially with no `continue-on-error`, so one failing step (most likely
the Stripe-heavy payout step) silently skips every step after it — including
the stale-processing detector that would otherwise catch the very row the
failure left stuck. No cron route sets `maxDuration`, so a slow day can hit
the platform's default function timeout with no explicit budget. And
`scheduleDepositHolds` places a hold from a stale snapshot with no claim and
an unconditional `held`/`failed` write, so a renter's cancel landing between
the cron's read and its write can leave an authorized hold on a cancelled
rental. None of this is attacker-exploitable; it's ops risk that compounds
silently.

## Current state

- `.github/workflows/cron-jobs.yml` already evolved since the audit into
  three jobs (`hourly` `0 * * * *`, `daily` `0 10 * * *`, `cleanup` `0 13 * * *`),
  not one sequential job — plans 005/R-BIZ-05 added `check-push-receipts`,
  `evidence-deadlines`, `detect-stale-charge-claims` to `hourly` since. Still
  true: **no `concurrency:` key** anywhere, `workflow_dispatch` can overlap a
  scheduled run, and steps run sequentially with no `continue-on-error` —
  `daily` (lines 51-92) has 7 such steps, including `process-payouts` and
  `process-service-payouts`.
- `src/app/api/cron/process-payouts/route.ts:8-11` (batch `20`) and
  `process-service-payouts/route.ts:19` (same cap) both have doc comments
  already saying "Schedule: 0 \* \* \* \* (hourly)", contradicting the
  workflow's actual `daily` placement — written for hourly, never moved.
  `specs/payments/0-overview.md:205` and
  `specs/cancellation-refund-policy.html:556` both confirm hourly is the
  spec.
- No cron route exports `maxDuration` (`grep -rn "maxDuration"
src/app/api/cron` → no matches); `vercel.json` is `{}`.
- CAS/idempotency already in place, unaffected by this plan:
  `paymentLifecycleDAL.claimForProcessing` (`:246-266`, `pending→processing`)
  and Stripe idempotency keys on every transfer/hold call
  (`src/services/stripe/payout.ts:27,79`, `deposit-hold.ts:38-39`) — raising
  payout frequency is safe: a claimed row can't double-process, and a
  retried Stripe call with the same key is a no-op on Stripe's side.
- `scheduleDepositHolds` (`payment-lifecycle-service.ts:237-345`) reads
  `findScheduledDepositsNearPickup` (a `depositHoldStatus = 'scheduled'`
  snapshot), then calls `placeDepositHold` with **no claim** and writes
  `held`/`failed` via a plain `UPDATE ... WHERE rentalId` with no status
  precondition (`payment-lifecycle.dal.ts:408-425`). Plan 004 (deposit-hold
  lifecycle; its file was deleted when it was DONE, see the Completed table in
  `plans/README.md`) made the cron query `scheduled`-only, made retry the
  only path for `failed` holds, and keyed holds
  `deposit-hold-{rentalId}-{paymentMethodId}`. So the cron and retry never
  pick up the same row. What's left: overlapping cron runs (the
  concurrency group in Step 5 covers these), two concurrent retries after the
  renter changed their default card (different keys, so Stripe doesn't
  dedupe), and a cancel racing an in-flight placement.
- `retryDepositHold` (`:507-628`) has the same unconditional write, plus its
  own check-then-act race: it reads `lifecycle.depositHoldStatus !==
"failed"` (line 526) as a plain read, not a claim — two concurrent retries
  (different default cards) can both pass and both write `held`.
- `depositHoldStatusEnum` (`_enums.ts:224-233`) has no in-flight state
  between `scheduled`/`failed` and `held`, unlike `payoutStatus`'s
  `pending → processing → completed`. Next migration: `0075` (or the next
  free number — confirm via `ls src/db/migrations`).

## Decisions for the maintainer

**1. `maxDuration` values — Vercel plan tier is unknown.** Hobby caps
function duration at 60s hard; Pro allows up to 300s without Fluid Compute.
**Recommendation: `maxDuration = 120` on the three Stripe-loop routes**
(`process-payouts`, `process-service-payouts`, `schedule-deposit-holds` —
each an up-to-20-item loop of Stripe calls, ~20-60s observed, doubled for
margin) **and `maxDuration = 60` on the other 11** (single-query or
small-batch DB work). Both fit Hobby's ceiling, so this is safe regardless
of plan tier; if the maintainer confirms Pro, `120` can be raised later for
extra headroom. Steps assume this.

**2. CONC-10 scope: cron + retry claim race only, not a new stale-hold
detector.** The CAS claim (`scheduled|failed → placing`) is implemented for
both `scheduleDepositHolds` and `retryDepositHold` — cheap once the claim
method exists, and it closes both bullets in the finding. **Not
implemented**: a cron detecting a hold stuck in `placing` (a crash
mid-Stripe-call) — that window is one API call, the same order of magnitude
as `payoutStatus`'s `processing` window, which has no crash-recovery
detector of its own class either. Noted in Maintenance notes for later.

**3. `recordsEligible` still reports the capped batch size, not the true
backlog.** Hourly cadence alone removes the throughput ceiling (PERF-05's
actual complaint); a real `count(*)` for ops visibility is a nice-to-have.
Left as a maintenance note, not implemented, to keep this plan tight.

## Commands you will need

| Purpose            | Command                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Install            | `bun install`                                                                                                                                |
| Typecheck          | `bun run type-check`                                                                                                                         |
| Lint               | `bun run lint`                                                                                                                               |
| Generate migration | `bun run db:generate`                                                                                                                        |
| Targeted tests     | `bun run test:run src/dal/__tests__/payment-lifecycle.dal.test.ts src/features/rentals/services/__tests__/payment-lifecycle-service.test.ts` |
| Real-DB test       | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                    |
| YAML syntax check  | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"`                                                          |

## Scope

**In scope**: `src/db/schemas/_enums.ts` (+ generated migration);
`src/dal/payment-lifecycle.dal.ts` (`claimForDepositHold`,
`updateDepositHoldStatus`'s new `fromStatus` option);
`src/features/rentals/services/payment-lifecycle-service.ts`
(`scheduleDepositHolds`, `retryDepositHold`); `.github/workflows/cron-jobs.yml`
(move steps, add `concurrency:`, `continue-on-error`, `--max-time`); all 14
`src/app/api/cron/*/route.ts` (`maxDuration` export only).

**Out of scope**: `ARCH-04`'s medium-term half (a durable queue / Postgres
job table, Stripe↔DB reconciliation job) — Phase 2 work, not "short-term."
`cleanup` job's two steps — low-stakes, sequential is fine, left alone.
`.github/workflows/deploy.yml`, `deploy-staging.yml`, `ci.yml` — R-ARCH-06
(roadmap 1.17) edits those; confirmed no overlap (`grep -n "cron-jobs"
.github/workflows/deploy*.yml .github/workflows/ci.yml` → no matches). A new
stale-`placing` detector (Decision 2). The exact-backlog-count fix
(Decision 3).

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes
uncommitted for the maintainer.

## Steps

### Step 1: Add the `placing` deposit-hold state

In `src/db/schemas/_enums.ts:224-233`, add `"placing"` to
`depositHoldStatusEnum`, right after `"scheduled"`:

```ts
export const depositHoldStatusEnum = pgEnum("deposit_hold_status", [
  "scheduled",
  "placing", // Claimed by a cron run or retry, Stripe call in flight (CONC-10)
  "held",
  ...
```

Run `bun run db:generate` (not `--custom` — this is a plain enum value
addition, fully expressible by drizzle-kit) to produce
`src/db/migrations/00NN_*.sql` (an `ALTER TYPE ... ADD VALUE`).

**Verify**: `bun run type-check` → exit 0; the generated SQL file contains
`ALTER TYPE "deposit_hold_status" ADD VALUE 'placing'`.

### Step 2: Claim-first CAS for deposit-hold placement

In `src/dal/payment-lifecycle.dal.ts`, add near `claimForProcessing`
(~line 246):

```ts
/**
 * Atomically claim a rental for deposit-hold placement (CONC-10). Only
 * `scheduled` or `failed` rows are claimable — the same states
 * scheduleDepositHolds/retryDepositHold read from — so a cron run racing a
 * renter's cancel, two overlapping cron runs, or two concurrent retries all
 * contend for one `placing` row and exactly one wins.
 */
async claimForDepositHold(rentalId: string): Promise<boolean> {
  try {
    const result = await this.db
      .update(rentalPaymentLifecycle)
      .set({ depositHoldStatus: "placing", updatedAt: new Date() })
      .where(
        and(
          eq(rentalPaymentLifecycle.rentalId, rentalId),
          inArray(rentalPaymentLifecycle.depositHoldStatus, [
            "scheduled",
            "failed",
          ]),
        ),
      )
      .returning();
    return result.length > 0;
  } catch (error) {
    this.handleError(error, "PaymentLifecycleDAL.claimForDepositHold");
  }
}
```

Extend `updateDepositHoldStatus` (~line 407) with an optional `fromStatus`
so the finalize write is conditional on the claim still being ours:

```ts
async updateDepositHoldStatus(
  rentalId: string,
  status: DepositHoldStatus,
  extra?: {
    depositHoldPlacedAt?: Date;
    depositReleasedAt?: Date;
    fromStatus?: DepositHoldStatus;
  },
): Promise<void> {
  try {
    await this.db
      .update(rentalPaymentLifecycle)
      .set({ depositHoldStatus: status, /* ...unchanged fields... */ updatedAt: new Date() })
      .where(
        extra?.fromStatus
          ? and(
              eq(rentalPaymentLifecycle.rentalId, rentalId),
              eq(rentalPaymentLifecycle.depositHoldStatus, extra.fromStatus),
            )
          : eq(rentalPaymentLifecycle.rentalId, rentalId),
      );
  } catch (error) {
    this.handleError(error, "PaymentLifecycleDAL.updateDepositHoldStatus");
  }
}
```

Every existing caller (13 call sites — `grep -rn "updateDepositHoldStatus("
src --include="*.ts"`) omits `fromStatus` and keeps its current unconditional
behavior; only Steps 3-4 below pass it.

**Verify**: `bun run type-check` → exit 0.

### Step 3: `scheduleDepositHolds` claims before every write

In `payment-lifecycle-service.ts`, right after `for (const rental of
eligible) {` (line 254), add:

```ts
const claimed = await paymentLifecycleDAL.claimForDepositHold(rental.rentalId);
if (!claimed) {
  getLogger().info(
    { rentalId: rental.rentalId },
    "Deposit hold no longer scheduled/failed — skipping (CONC-10)",
  );
  continue;
}
```

This must run before the `renterStripeCustomerId`/`paymentMethodId` checks,
so every exit from this loop iteration (missing customer, missing payment
method, hold success, hold failure) happens only after a successful claim.
Add `fromStatus: "placing"` to the three `updateDepositHoldStatus` calls
already inside this loop (the two `"failed"` writes and the one `"held"`
write, lines ~300, ~323/338, ~340).

**Verify**: `bun run type-check` → exit 0.

### Step 4: `retryDepositHold` claims instead of reading

Replace the plain read-check (line ~525-527):

```ts
const lifecycle = await paymentLifecycleDAL.getByRentalId(rental.id);
if (!lifecycle || lifecycle.depositHoldStatus !== "failed") {
  return { success: false, error: "Deposit hold is not in a failed state" };
}
```

with:

```ts
const claimed = await paymentLifecycleDAL.claimForDepositHold(rental.id);
if (!claimed) {
  return { success: false, error: "Deposit hold is not in a failed state" };
}
```

Same external error message and behavior for the ordinary "not failed"
case; now also correctly rejects a second concurrent retry. Add `fromStatus:
"placing"` to the success-path `updateDepositHoldStatus(rental.id, "held",
{...})` call (line ~598). **Add a write-back on the failure path**, which
today returns without ever resetting the status — after the claim, a failed
`placeDepositHold` must not leave the row stuck in `placing`:

```ts
return {
  success: false,
  error: holdResult.error || "Failed to place deposit hold",
};
```

becomes:

```ts
await paymentLifecycleDAL.updateDepositHoldStatus(rental.id, "failed", {
  fromStatus: "placing",
});
return {
  success: false,
  error: holdResult.error || "Failed to place deposit hold",
};
```

**Verify**: `bun run type-check` → exit 0.

### Step 4b: Make every other reader of `depositHoldStatus` handle `placing`

A new enum value changes every place that branches on this column. Without
this step, `placing` opens a worse race than it closes: a cancel that sees
`placing` matches neither its `held` nor its `scheduled` branch
(`cancellation-service.ts:243`, `:503`) and does nothing. The in-flight
placement then writes `held` and a cancelled rental keeps a live hold.

1. `updateDepositHoldStatus` returns `Promise<boolean>` (rows affected > 0)
   so a `fromStatus` write can tell it lost. Existing callers ignore the
   return value.
2. In `scheduleDepositHolds` and `retryDepositHold`, when a hold **succeeded**
   but the `held` write with `fromStatus: "placing"` returns `false`,
   someone moved the row mid-flight (a cancel, see 3). Release the hold
   just placed with the same helper cancellation uses. Then send
   `sendOpsAlert({ event: "deposit_hold_released_after_race", rentalId })`
   and don't count it as held.
3. `cancellation-service.ts` (both branches at `:243` and `:503`): treat
   `"placing"` like `"scheduled"` and write `"released"`. The in-flight placer
   then loses its `fromStatus` write and releases its own hold (point 2).
4. `account-deletion.dal.ts:66` `BLOCKING_DEPOSIT_STATUSES`: add
   `"placing"`, since a hold is being placed on the user's card.
5. Re-run `grep -rn "depositHoldStatus" src --include=*.ts | grep -v __tests__`
   and check each remaining hit. At plan time, the `=== "held"` checks
   (dispute resolution, admin lifecycle, webhook, cancellation preview) are
   correct to treat `placing` as not-yet-held, and the notification and
   `rental-service.ts:666` local type never see it. Report any new reader.

**Verify**: `bun run type-check` → exit 0. Add tests: a cancel during
`placing` writes `released`; a successful hold whose finalize write returns
`false` releases the hold and alerts; deletion is blocked while `placing`.

### Step 5: `cron-jobs.yml` — hourly payouts, concurrency, independent steps

**5a.** Move `process-payouts`, `process-service-payouts`,
`detect-stale-processing`, `detect-stale-service-processing` from the
`daily` job to the `hourly` job (append after the existing `Check push
receipts` step). `daily` keeps `monitor-deposit-expiry`, `release-reviews`,
`rental-reminders` (their own cadence is correct as-is).

**5b.** Add to every one of `hourly`, `daily`, `cleanup` (right after each
job's `runs-on:`/`environment:` line):

```yaml
concurrency:
  group: cron-${{ github.job }}
  cancel-in-progress: false
```

`cancel-in-progress: false` — never kill a job mid-Stripe-call; a
scheduled/dispatched overlap queues instead.

**5c.** On every step in `hourly` and `daily` (not `cleanup`), add an `id:`
and `continue-on-error: true`, and add `--max-time <N>` to the `curl`
(120 for the three Stripe-loop routes named in Decision 1, matching their
`maxDuration`; 90 for the rest — 30s margin over their 60s `maxDuration`).
Example (`process-payouts`):

```yaml
- name: Process payouts
  id: process-payouts
  continue-on-error: true
  run: |
    curl --fail --max-time 120 -s -X GET \
      -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/process-payouts
```

**5d.** At the end of `hourly` and `daily`, add a final step that keeps the
job's overall status honest without re-introducing the skip-everything
failure mode:

```yaml
- name: Check job status
  if: always()
  run: |
    FAILED=0
    for outcome in \
      "${{ steps.schedule-deposit-holds.outcome }}" \
      "${{ steps.expire-pending-bookings.outcome }}" \
      "${{ steps.detect-stale-charge-claims.outcome }}" \
      "${{ steps.evidence-deadlines.outcome }}" \
      "${{ steps.check-push-receipts.outcome }}" \
      "${{ steps.process-payouts.outcome }}" \
      "${{ steps.process-service-payouts.outcome }}" \
      "${{ steps.detect-stale-processing.outcome }}" \
      "${{ steps.detect-stale-service-processing.outcome }}"; do
      [ "$outcome" = "failure" ] && FAILED=1
    done
    [ "$FAILED" = "1" ] && { echo "One or more steps failed — see above."; exit 1; }
    exit 0
```

(list only the step ids that belong to that job — `hourly`'s nine above,
`daily`'s three remaining: `monitor-deposit-expiry`, `release-reviews`,
`rental-reminders`).

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"` → no error. There's no local way to exercise `schedule`/`workflow_dispatch` semantics — real verification is the next scheduled run (Done criteria).

### Step 6: `maxDuration` on every cron route

Add `export const maxDuration = <N>;` right after the imports, before `const
JOB_NAME = ...`, in all 14 `src/app/api/cron/*/route.ts` files:
`120` for `process-payouts`, `process-service-payouts`,
`schedule-deposit-holds`; `60` for the other 11 (`check-push-receipts`,
`cleanup-cron-history`, `cleanup-notifications`, `detect-stale-charge-claims`,
`detect-stale-processing`, `detect-stale-service-processing`,
`evidence-deadlines`, `expire-pending-bookings`, `monitor-deposit-expiry`,
`release-reviews`, `rental-reminders`).

**Verify**: `grep -rln "export const maxDuration" src/app/api/cron | wc -l` → `14`.

### Step 7: Tests

Extend `src/dal/__tests__/payment-lifecycle.dal.test.ts`: `claimForDepositHold`
returns `true` for a `scheduled`/`failed` row, `false` otherwise (mock the
update's `.returning()` length); `updateDepositHoldStatus` with `fromStatus`
adds the extra `where` condition (assert the built query, per this file's
existing `claimForProcessing` style).

Extend `payment-lifecycle-service.test.ts`: add `mockClaimForDepositHold` to
the `paymentLifecycleDAL` mock. `scheduleDepositHolds`: claim `false` →
`placeDepositHold` never called, loop continues; claim `true` → unchanged
happy-path assertions, plus `updateDepositHoldStatus` called with
`fromStatus: "placing"`. `retryDepositHold`: claim `false` → the "not in a
failed state" error, `placeDepositHold` never called; hold failure after a
successful claim → the new `updateDepositHoldStatus(..., "failed", {
fromStatus: "placing" })` write-back from Step 4 fires.

Add one real-DB test (new file
`src/dal/__tests__/payment-lifecycle-cas.integration.test.ts`, R-TEST-HARNESS
conventions — own truncate list, real Postgres): seed one
`rental_payment_lifecycle` row `scheduled`, fire two concurrent
`claimForDepositHold(rentalId)` calls, assert exactly one resolves `true` —
pins the claim's exclusivity (the DB-level half of the finding's "cancel
between read and write" test; the cron/cancel interleaving itself isn't
reproducible without a Stripe sandbox).

**Verify**: `bun run test:run src/dal/__tests__/payment-lifecycle.dal.test.ts src/features/rentals/services/__tests__/payment-lifecycle-service.test.ts` → all pass; `docker compose up -d && bun run db:push:e2e && bun run test:integration` → includes the new file, passes.

## Test plan

Step 7 covers the DAL claim/CAS logic (unit + real-DB race), the service
call sites (unit, both cron and retry paths, both success and failure
write-backs). No test exercises GitHub Actions' `schedule`/`concurrency`
semantics directly — the YAML syntax check plus the next real scheduled run
are the available signal (Done criteria). Full regression: `bun run
test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0 (includes new unit tests)
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0 (includes the new CAS race test)
- [ ] `cron-jobs.yml` parses as YAML; `grep -c "continue-on-error: true" .github/workflows/cron-jobs.yml` ≥ 12 (9 hourly + 3 daily steps)
- [ ] `grep -rln "export const maxDuration" src/app/api/cron | wc -l` → `14`
- [ ] Migration `00NN_*` generated from the schema (not `--custom`) and applied on local + confirmed on dev per Production cutover
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` (mark ARCH-04 "short-term half DONE, medium-term open — Phase 2")
- [ ] **Post-merge, manual**: confirm the next hourly run actually hits `process-payouts` (a GitHub Actions run log check) — record in the roadmap status row

## STOP conditions

- Excerpts above don't match the live files — re-read before editing.
- Do not run any `db:*` script against a real dev/staging database to verify
  the migration beyond the local e2e DB — apply to dev/staging only per
  Production cutover, as a deliberate step, not part of local verification.
- A test fails twice after a reasonable fix attempt.
- `bun run db:generate` produces anything other than a single `ALTER TYPE
... ADD VALUE` statement (e.g. it also tries to rewrite unrelated schema
  drift) — stop and report rather than accepting an unexpected diff.

## Mobile compatibility

**`placing` reaches the app.** `depositHoldStatus` is in the rental detail
and cancellation-preview responses. Mobile parses it with
`depositHoldStatusSchema`, a `tolerantEnum` (`hoador-mobile/src/api/contract/enums.ts:83`),
so the new value won't fail parsing, but for the seconds it lasts the app
renders an unknown state. Add this row to the roadmap's Mobile client
follow-ups table:

| Fix                 | Contract change                                                | Where the app sees it               | Mobile task | Status                                                                             |
| ------------------- | -------------------------------------------------------------- | ----------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| R-PERF-05 (CONC-10) | new transient `depositHoldStatus: placing` (hold being placed) | rental detail, cancellation preview | —           | TODO (optional: add `placing` to `depositHoldStatusSchema`; render as "scheduled") |

Otherwise, cron routes are server-to-server only (`Authorization: Bearer
$CRON_SECRET`, verified by `verify-cron-secret.ts`) — confirmed
`grep -rn "cron" hoador-mobile/src` matches only unrelated comments about
cron _timing_ (e.g. a booking not yet relabelled by the expiry cron), no
call sites. No contract change. The only user-visible effect is faster
payouts and faster stale-claim detection (hourly instead of daily) — purely
beneficial, shrinks the staleness window those mobile comments describe.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-PERF-05 — apply migration 00NN (deposit_hold_status:
placing)` | From: R-PERF-05 | dev: TODO | staging: TODO | prod: TODO
  (blocked on dev+staging first, app not yet in production). Apply via the
  repo's standard migration step against both `.env.local` hosts
  (`ep-lucky-block` dev, `ep-polished-tree` staging — check host before
  running). No data backfill needed — new enum value only, no existing rows
  reference it.
- **New row**: `R-PERF-05 — confirm GitHub Actions cron schedule picks up
the moved steps` | From: R-PERF-05 | prod: TODO — first hourly run after
  deploy should show `process-payouts`/`process-service-payouts` in the
  `hourly` job's log, not `daily`'s.

## Maintenance notes

- A hold stuck in `placing` (process crash mid-Stripe-call) has no
  crash-recovery detector, same class of gap as any other in-flight state in
  this codebase without one. If this becomes a real incident class, add a
  `detect-stale-deposit-hold-claims` cron mirroring
  `detect-stale-processing`'s pattern.
- `recordsEligible` in `CronRunHistoryService.recordRun` calls still reports
  the capped batch size, not the true backlog — add a `count(*)` DAL variant
  if ops needs backlog visibility beyond "hourly cadence removed the
  ceiling."
- ARCH-04's medium-term half (durable queue, Stripe↔DB reconciliation job)
  is Phase 2 (`10-remediation-roadmap.md:100`) — not this plan.
