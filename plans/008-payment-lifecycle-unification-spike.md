# Plan 008: Design spike — unify the rental and service payment-lifecycle stacks (no code changes)

> **Executor instructions**: This is a DESIGN SPIKE. The deliverable is a
> document, not code. Do not modify anything under `src/`. Follow the steps,
> honor STOP conditions, and update this plan's row in `plans/README.md` when
> done.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts src/features/rentals/services/payment-lifecycle-service.ts src/features/services/services/service-payment-lifecycle-service.ts`
> Drift here is EXPECTED if plans 003-005 landed first (they touch these files);
> read the changed versions, not the excerpts below, as your source of truth.

## Status

- **Priority**: P3
- **Effort**: L (the spike itself is ~1-2 days; it scopes a 1-2 week implementation)
- **Risk**: LOW (spike is read-only; the implementation it designs is HIGH risk — that's why we spike)
- **Depends on**: 003, 004, 005 (the design must reflect post-fix semantics, not the buggy baseline)
- **Category**: tech-debt / direction
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

The rental and service sides of the marketplace each carry a complete, parallel payment-lifecycle stack: `payment-lifecycle.dal.ts` (1,002 lines) vs `service-payment-lifecycle.dal.ts` (555 lines), `payment-lifecycle-service.ts` vs `service-payment-lifecycle-service.ts`, paired cron routes (`process-payouts`/`process-service-payouts`, `detect-stale-processing`/`detect-stale-service-processing`), and paired agreement-document DALs that are near-textual copies. Fixes land asymmetrically: the payout path's atomic `claimForProcessing` exists on both sides, but deposit holds (and their failure/retry machinery, plus the bugs fixed in plan 004) exist only on the rental side; metrics methods (`getPaymentMetrics`, `getFinancialMetrics`) have drifted independently. Every future payment feature (escrow changes, fraud checks, new payout schedules) is currently a double implementation with double the bug surface on the most money-critical code in the repo. Before anyone refactors this, the shape, cost, and risk need to be established by reading, not vibes — hence a spike.

## Current state (verified at 5c32982)

- `src/dal/payment-lifecycle.dal.ts` — rental side. Methods include: `create`, `getByRentalId`, `getByTransferId`, `claimForProcessing` (conditional UPDATE on `payoutStatus = 'pending'`, returns boolean), `updateDepositHoldStatus`, `updateOwnerTransferStatus`, `updatePayoutStatus`, `findEligibleForPayout`, `findScheduledDepositsNearPickup`, `findExpiringDeposits`, `markCancelled`, `freezeForDispute`, `getPaymentMetrics` (~line 867), and more.
- `src/dal/service-payment-lifecycle.dal.ts:79+` — service side. Methods: `create`, `getByBookingId`, `getByTransferId`, `claimForProcessing` (line 152), `updateOwnerTransferStatus`, `updatePayoutStatus`, `findEligibleForPayout`, `markCancelled`, `freezeForDispute`, `unfreezeAfterResolution`, `markRefundedAfterDispute`, `updateProviderPayout`, `findStaleProcessingRecords`, `getPaymentMetrics` (475), `getFinancialMetrics` (514). **No deposit-hold methods.**
- Schemas: `src/db/schemas/rental-payment-lifecycle.schema.ts` and `src/db/schemas/service-payment-lifecycle.schema.ts`; shared enums in `src/db/schemas/_enums.ts` (`depositHoldStatusEnum`, `ownerTransferStatusEnum`, …).
- Agreement-document twins: `src/dal/rental-agreement-document.dal.ts` and `src/dal/service-agreement-document.dal.ts` (~90 LOC each, same structure).
- Cron pairs under `src/app/api/cron/`: `process-payouts` / `process-service-payouts`; `detect-stale-processing` / `detect-stale-service-processing`; rental-only: `schedule-deposit-holds`, `monitor-deposit-expiry`.
- Services: `src/features/rentals/services/payment-lifecycle-service.ts` (~600 lines) vs `src/features/services/services/service-payment-lifecycle-service.ts`.

## Commands you will need

| Purpose           | Command                                                                                                      | Expected on success  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| Method inventory  | `grep -n "async [a-zA-Z]" src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts`         | the two method lists |
| Call-site counts  | `grep -rn "paymentLifecycleDAL\." src --include="*.ts" \| grep -v __tests__ \| wc -l` (and the service twin) | blast-radius numbers |
| Docs format check | `bun run format:check`                                                                                       | exit 0               |

## Scope

**In scope** (create only):

- `docs/payment-lifecycle-unification.md` — the design document

**Out of scope**:

- ANY change under `src/`, `package.json`, migrations — this plan writes one markdown file.
- Implementing the design (that's a future plan, written only if the verdict is GO).

## Git workflow

- Branch: `advisor/008-payment-lifecycle-unification-spike` off `develop`
- Single commit; message: "Add payment lifecycle unification design spike"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the divergence inventory

Read both DALs and both services end to end. Produce a method-by-method table:

| Capability | Rental impl | Service impl | Divergence (behavioral, not cosmetic) |

Pay specific attention to: `claimForProcessing` WHERE-clauses; stale-processing detection (service has `findStaleProcessingRecords` — what does rental use? trace `detect-stale-processing/route.ts`); dispute freeze/unfreeze symmetry; metrics definitions (are "platform fees" computed the same way?); `markCancelled` semantics (rental's sets `payoutStatus: "completed"` — service's?).

### Step 2: Inventory the consumers

For each DAL public method, count and list call sites (`grep -rn`). Same for the two lifecycle services. This is the blast radius that decides between refactor strategies.

### Step 3: Draft the target design

In `docs/payment-lifecycle-unification.md`, propose and compare AT LEAST two options with honest trade-offs:

- **Option A — shared generic base**: `PaymentLifecycleBaseDAL<TTable>` with the common state machine (claim, transfer/payout transitions, freeze/unfreeze, metrics template), rental/service subclasses adding domain columns (deposit holds rental-only). No schema change.
- **Option B — single table + `lifecycleType` discriminator**: one DAL, one cron set; requires data migration of `service_payment_lifecycle` rows into the unified table and enum reconciliation.
- (Optional C: status quo + "parity checklist" process, if the spike shows unification costs exceed its benefit.)

For the recommended option, include: migration sequencing (what lands first, what's behind a flag), test strategy (characterization tests on both sides BEFORE refactor — reference the route-test pattern from plans/006), rollback story, and an explicit list of behavioral questions for the product owner (e.g. "should service bookings get deposit holds? If yes, unification should precede that feature; if never, Option A's subclass split is cleaner").

### Step 4: Verdict

End the doc with a GO / NO-GO / GO-LATER recommendation, one paragraph of justification, and a coarse effort estimate (engineer-days, marked as coarse). "NO-GO, revisit when the next payment feature is scheduled" is a fully acceptable outcome — say so plainly if the evidence points there.

**Verify**: `test -f docs/payment-lifecycle-unification.md && echo ok` → ok; `bun run format:check` → exit 0; `git status` shows only the new doc (+ plans/README.md).

## Test plan

None — read-only spike. The deliverable's quality bar: a reader who has never seen these files can decide GO/NO-GO from the doc alone.

## Done criteria

- [ ] `docs/payment-lifecycle-unification.md` exists with: divergence table, consumer counts, ≥2 options with trade-offs, migration sequencing for the recommended option, open product questions, explicit verdict
- [ ] No `src/` files modified (`git status`)
- [ ] `bun run format:check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plans 003/004/005 are not yet DONE in `plans/README.md` — STOP; the spike would bake the buggy semantics into the design.
- You find evidence a unification effort already started (a shared base class, a `lifecycleType` column, a design doc) — reconcile with it and report rather than producing a competing design.

## Maintenance notes

- If the verdict is GO, the implementation gets its own plan(s) with characterization tests as the first dependency — do not let an executor start the refactor from this spike alone.
- Until unification lands, every PR touching one lifecycle stack should be reviewed with the question "does the twin need this too?" — consider adding that line to CLAUDE.md if the GO-LATER path is chosen.
