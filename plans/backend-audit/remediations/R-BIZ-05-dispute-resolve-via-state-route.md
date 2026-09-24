# R-BIZ-05: Close the dispute state-route bypass around real resolution

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- "src/app/api/disputes/[id]/state/route.ts" src/features/disputes/lib/state-machine.ts src/features/disputes/components/admin-state-controls.tsx src/features/rentals/services/payment-lifecycle-service.ts src/dal/payment-lifecycle.dal.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED
- **Depends on**: none — **coordinates with R-CONC-02** (see Maintenance notes)
- **Category**: bug (money)
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`PATCH /api/disputes/[id]/state` can set a dispute straight to `resolved`
without releasing or capturing the deposit and without unfreezing the owner
transfer — and the admin UI's own "State Management" panel has a plain
"Resolve" button that calls exactly this route, on the same screen as the
real resolution flow. Every use of it silently strands the owner's payout: the
rental payout cron then finds `ownerTransferStatus` still `frozen`, skips the
transfer, and **still marks the payout `completed`** — so both the deposit
decision and the owner's money are lost with no alert. Audit finding BIZ-05
(HIGH, upgraded from the auditors' own MEDIUM), gap TEST-11.

## Current state

- `` `src/app/api/disputes/[id]/state/route.ts` `` (full file, 158 lines) —
  `updateStateSchema` (19-28) accepts `newState: "resolved"` with no
  restriction; `DisputeStateMachine.validateTransition` (called at 68-72) is
  the only gate.
- `state-machine.ts` (full file, 113 lines) — `VALID_TRANSITIONS` (7-13)
  allows `open|evidence_requested|under_review → resolved`;
  `ADMIN_ONLY_STATES` (18-23) includes `resolved`, so any admin can reach it
  through this route today.
- `admin-state-controls.tsx:166-171` — a plain `<Button onClick={() => handleTransitionClick("resolved")}>Resolve</Button>` inside the same panel that offers "Request Evidence" and "Move to Review". Confirmed present, matches the audit's citation.
- `use-resolve-dispute.ts` (full file, 47 lines) — the **real** flow:
  `POST /api/disputes/${disputeId}/resolve` with
  `{outcome, reason, financialOperations?}`, which reaches
  `DisputeResolutionService.resolveDispute` (does the deposit capture/release
  and `unfreezeAfterResolution`, per R-BIZ-04's plan file for that service).
- `payment-lifecycle-service.ts:32-209` `processPayouts` — read in full:

```ts
// :95-173 — transfer only runs when ownerTransferStatus === "pending"
if (rental.lifecycle.ownerTransferStatus === "pending") {
  /* ...release deposit if held, create transfer, mark completed... */
}
// :175-179 — UNCONDITIONAL, runs even when the block above was skipped
await paymentLifecycleDAL.updatePayoutStatus(rental.rentalId, "completed");
successCount++;
```

- `payment-lifecycle.dal.ts:358-405` `findEligibleForPayout` — WHERE requires
  `rentalRequests.status = "completed"`, `returnConfirmedAt` ≤ 24h ago,
  `payoutStatus = "pending"`, and no dispute in
  `open|evidence_requested|under_review`. It does **not** exclude
  `resolved` disputes, and does **not** check `ownerTransferStatus` at all —
  so a rental "resolved" via the state route (frozen, but dispute status now
  `resolved` and therefore invisible to the open-dispute filter) becomes
  fully eligible again.
- Why a frozen-but-eligible row exists at all: normally the filing window
  closes exactly when payout opens, so a legitimate dispute can't coexist
  with eligibility — but a state-route "resolve" leaves `ownerTransferStatus`
  `frozen` while making the dispute row itself `resolved` (a final status the
  eligibility join doesn't count as blocking), which is exactly the gap this
  plan closes.

## Commands

| Purpose        | Command                                                                                                                                                             | Expected |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                                                                | exit 0   |
| Lint           | `bun run lint`                                                                                                                                                      | exit 0   |
| Targeted tests | `bun run test:run "src/app/api/disputes/[id]/state" src/features/disputes/components src/features/rentals/services src/dal/__tests__/payment-lifecycle.dal.test.ts` | all pass |
| Full tests     | `bun run test:run`                                                                                                                                                  | all pass |

## Scope

**In scope**: `` `src/app/api/disputes/[id]/state/route.ts` `` (schema +
handler), `src/features/disputes/components/admin-state-controls.tsx`
(remove the Resolve button only), `src/features/rentals/services/payment-lifecycle-service.ts`
(`processPayouts`), `src/dal/payment-lifecycle.dal.ts`
(`findEligibleForPayout`), tests for all four.

**Out of scope**: `DisputeResolutionService`/`/resolve` route (already
correct — this plan routes traffic away from the bypass, not into it);
service-booking payout eligibility (already excludes `frozen`, confirmed
clean by the audit); `state-machine.ts`'s missing party-check (a separate,
known follow-up noted in `plans/README.md` — do not fix here).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Refuse `resolved` on the state route

In `updateStateSchema`, remove `"resolved"` from the `z.enum([...])` list. In
`patchHandler`, before the existing `DisputeStateMachine.validateTransition`
call, add:

```ts
if (validationResult.data.newState === "resolved") {
  return NextResponse.json(
    {
      error: "Use POST /api/disputes/[id]/resolve to resolve a dispute.",
      code: "USE_RESOLUTION_ENDPOINT",
    },
    { status: 400 },
  );
}
```

(Zod already rejects `"resolved"` at the schema level once removed from the
enum, returning the existing 400 validation-failure shape at lines 48-56 —
the explicit branch above is only needed if you keep `"resolved"` in the Zod
enum for a friendlier message; prefer removing it from the enum for a single
source of truth, and skip the extra branch if so.) Leave
`DisputeStateMachine`'s `VALID_TRANSITIONS`/`ADMIN_ONLY_STATES` unchanged —
the state machine is shared read-only logic; the route is what narrows.
**Verify**: `bun run type-check` → exit 0.

### Step 2: Remove the "Resolve" button from the state panel

In `admin-state-controls.tsx`, delete the `<Button onClick={() => handleTransitionClick("resolved")}>Resolve</Button>` block (166-171) only. Leave "Request
Evidence" and "Move to Review" untouched. Do not add a redirect or new
component — the real resolution UI already exists elsewhere on the same
dispute-details page (per the audit's citation of `dispute-details.tsx:530`);
this step only removes the dangerous duplicate.
**Verify**: `bun run type-check && bun run lint` → exit 0; the component
still renders for `open`/`under_review` disputes with the remaining buttons.

### Step 3: Never mark a non-transferred payout `completed`

In `processPayouts`, replace the unconditional block at lines 175-179 with a
guard that only reaches "mark completed" when the transfer branch actually
ran or the transfer was already done:

```ts
const transferStatus = rental.lifecycle.ownerTransferStatus;
if (transferStatus !== "pending" && transferStatus !== "completed") {
  // frozen / failed / processing — a state-route "resolve" or a chargeback
  // left this inconsistent; claiming success here is the BIZ-05 bug.
  await paymentLifecycleDAL.updatePayoutStatus(rental.rentalId, "failed");
  await sendOpsAlert({
    event: "payout_skipped_transfer_not_pending",
    rentalId: rental.rentalId,
    message: `ownerTransferStatus is '${transferStatus}', not 'pending' — refusing to mark payout completed`,
    sendEmailAlert: true,
  });
  failureCount++;
  continue;
}
await paymentLifecycleDAL.updatePayoutStatus(rental.rentalId, "completed");
successCount++;
```

`"failed"` (not leaving it `"processing"`) is chosen to match every other
failure branch already in this function (missing connected account, missing
charge id, transfer API failure all mark `"failed"` + alert) — internal
consistency, and it surfaces on the existing `getPaymentMetrics`
"needs attention" panel immediately rather than waiting on the
stale-processing cron.
**Verify**: `bun run type-check` → exit 0.

### Step 4: Exclude frozen rows from eligibility

In `findEligibleForPayout` (`payment-lifecycle.dal.ts`), add
`ne(rentalPaymentLifecycle.ownerTransferStatus, "frozen")` to the WHERE,
mirroring the service DAL's identical guard
(`service-payment-lifecycle.dal.ts:266`). `ne` is already imported in this
file (used elsewhere) — confirm with
`grep -n "^import" src/dal/payment-lifecycle.dal.ts` before adding a
duplicate import. **Verify**: `bun run type-check` → exit 0.

### Step 5: Ops query for already-affected rentals (manual — describe only)

No code. See Maintenance notes for the query.

## Test plan

- **Route** (new or extended `route.test.ts` next to the state route): PATCH
  with `newState: "resolved"` → 400, `disputeDAL.updateState` never called.
  Existing transitions (`evidence_requested`, `under_review`) unaffected.
- **Component**: `admin-state-controls.tsx` no longer renders a button whose
  accessible name is "Resolve".
- **Service** (`payment-lifecycle-service.test.ts` or sibling): a rental with
  `ownerTransferStatus: "frozen"` reaching `processPayouts` → `updatePayoutStatus`
  called with `"failed"`, not `"completed"`; `sendOpsAlert` called with
  `event: "payout_skipped_transfer_not_pending"`; `successCount` unchanged,
  `failureCount` incremented. Existing happy-path (`"pending"` → transfer →
  `"completed"`) test still passes unchanged.
- **DAL** (`payment-lifecycle.dal.test.ts`, model after its existing
  `whereSql` pattern if present, else add one per `service-payment-lifecycle.dal.test.ts`):
  render `findEligibleForPayout`'s WHERE and assert it contains
  `owner_transfer_status" <>` bound to `"frozen"`.

**Verify**: `bun run test:run "src/app/api/disputes/[id]/state" src/features/disputes/components src/features/rentals/services src/dal/__tests__/payment-lifecycle.dal.test.ts` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] `grep -n "\"resolved\"" "src/app/api/disputes/[id]/state/route.ts"` → 0 hits in the Zod enum
- [ ] A DAL test pins the new `ownerTransferStatus <> 'frozen'` guard
- [ ] A service test proves a frozen transfer status never yields `payoutStatus: "completed"`
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `admin-state-controls.tsx`'s Resolve button has behavior beyond calling
  `handleTransitionClick("resolved")` (e.g. it's the _only_ way to reach some
  other needed side effect) — report instead of deleting.
- Removing `"resolved"` from the Zod enum breaks a caller that legitimately
  depends on the route accepting it (search
  `grep -rn "newState.*resolved\|state.*resolved" src/` outside this route
  before assuming none exists).
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- `PATCH /api/disputes/[id]/state` is an **admin-only, web-console** route —
  not called by the mobile app (mobile's dispute surface uses
  `POST /api/disputes` and `/resolve`, per `hoador-mobile/specs`). Confirm
  with `grep -rn "/state" hoador-mobile/src/api` before relying on this if
  reused elsewhere; expected result is no hits. No mobile contract impact.
- `processPayouts` is a cron, invisible to any client. Its only externally
  visible effect is that an owner who was previously paid despite a frozen
  transfer will now correctly **not** be paid until the dispute is properly
  resolved via `/resolve` — this is a behavior fix, not a shape change.

## Maintenance notes

- **Coordinates with R-CONC-02** (`R-CONC-02-rental-cancel-claim-first.md`):
  that plan also edits `findEligibleForPayout` (it adds a guard related to
  refunded charges per the same lead-auditor note this plan's Current State
  cites). Both plans touch the same WHERE clause in
  `payment-lifecycle.dal.ts` — whichever lands second must re-read the
  current WHERE before adding its own condition, and re-run this plan's DAL
  test afterward.
- **Ops query** for rentals already stuck in the bad state (run by hand, no
  code): `SELECT rental_id FROM rental_payment_lifecycle WHERE payout_status = 'completed' AND stripe_transfer_id IS NULL AND owner_transfer_status != 'completed'`
  — each row is a rental marked paid with no transfer ever sent; recover
  manually via the admin reset-transfer-status tool or a direct Stripe
  transfer, owner by owner.
- If a future change adds a legitimate reason for the state route to reach
  `resolved` (none exists today), route it through
  `DisputeResolutionService` rather than reopening this bypass.
