# Plan R-ARCH-08: Re-baseline the payment-lifecycle unification spike; unify code paths via R-ARCH-01, not the tables

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- docs/payment-lifecycle-unification.md src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts src/dal/rental-agreement-document.dal.ts src/dal/service-agreement-document.dal.ts src/features/admin/services/stale-processing-detection-service.ts src/features/services/services/service-payment-lifecycle-service.ts src/db/schemas/_enums.ts`
>
> This diff will not be empty — R-CONC-04, R-BIZ-14, R-DB-04 (Phase 2) and
> R-ARCH-01 (this plan's own dependency) all edit `payment-lifecycle.dal.ts`
> and/or `service-payment-lifecycle.dal.ts` before this plan runs. **Read all
> four of those plans' Status/landed-diff notes first**, then re-verify every
> claim in "Current state" against live code — this plan's job is precisely
> to re-baseline the existing design doc against what's true _after_ those
> land, so treat "the doc is now more out of date than this plan assumed" as
> expected, not a STOP condition. Only unexplained drift (a change none of
> the four dependency plans account for) is a STOP condition.

## Status

- **Priority**: P3 (opportunistic/structural) · **Effort**: The roadmap sizes
  ARCH-08 as **L**, assuming a schema-unification project. This plan's own
  investigation (see Decisions) recommends **against** that project — the
  actual work this plan asks for is **M**: a doc re-baseline plus two small,
  independently-low-risk extractions. Effort is stated as it will actually be
  executed, not as originally sized; if the maintainer instead wants the
  full schema unification (Option B), re-scope to L and treat this plan's
  Decision as declined. · **Risk**: LOW (the recommended path touches no
  money-moving code — it's a doc, two DAL subclasses with a common
  non-generic superclass, and one service-layer merge)
- **Depends on**: R-ARCH-01 (its `claimTransition` helper is this plan's
  answer to "unify the code paths" — read that plan's Part D diff before
  starting this one)
- **Category**: architecture / documentation · **Planned at**: commit
  `29fe557`, 2026-09-25
- **Fixes**: ARCH-08 (re-baselines `docs/payment-lifecycle-unification.md`)

## Why this matters

`docs/payment-lifecycle-unification.md` (a 2026-09-23-era design spike) is
the audit's own source for ARCH-08's recommended fix: re-baseline the doc
after Phase 0/1, then extract the genuinely shared primitives. That spike's
verdict was **GO-LATER**: most of the divergence between the rental and
service payment-lifecycle stacks is intrinsic to the two domains (security
deposits are rental-only; the payout-amount model differs by design —
rentals read live, services snapshot; admin tooling exists only for rentals),
and the honestly-shareable surface was small (~5–7 methods, ~150–250 LOC:
the atomic claim, freeze/unfreeze, stale-record query, and the metrics
shell). Its own recommendation was **narrow Option A** (a generic
`PaymentLifecycleBaseDAL<TTable>` base class) **triggered by the next
cross-cutting payment feature**, not done in isolation.

Two things changed since that spike that this plan must account for: (1) the
divergence has grown, not shrunk — R-CONC-04 adds a `reversed` transfer
state to both enums (symmetric, cheap) but also adds _asymmetric_ claim
tightening (rental's claim excludes `frozen`; service's claim requires
exactly `pending`, deliberately stricter, per that plan's own Step 7 note);
R-DB-04 adds `release_deposit`/`skipped` to the **rental-only** dispute
ledger enum, with no service twin (services have no deposits, so there is
nothing to unify there); (2) **R-ARCH-01 now exists**, and it already builds
the one thing the original spike worried was too risky to build generically —
a shared atomic-claim primitive — as a **plain function** (`claimTransition`),
not a class hierarchy. That sidesteps the spike's own stated objection to
Option A ("generics over Drizzle table types add real type friction") by
never generic-izing over the table type in the first place. The honest
conclusion, verified rather than assumed: **most of "unify the code paths"
is already done as a side effect of R-ARCH-01. What's left is small.**

## Current state

### What the original spike got right (still true)

- **Money model is genuinely different by design**: rental lifecycle rows
  store no money (`totalAmount`/`ownerPayout` read live from `rentalRequests`
  at payout time); service lifecycle rows snapshot `providerPayout` at charge
  time. Any unification of the payout-eligibility/claim step would have to
  pick one model — this is a **product decision** (does a `PLATFORM_FEE_PERCENTAGE`
  change mid-rental matter?), not an engineering one, and remains unresolved.
- **Security deposits are rental-only** — `updateDepositHoldStatus` (21 call
  sites), the two deposit-only crons, `findScheduledDepositsNearPickup`,
  `findExpiringDeposits`, `markDepositCaptured` have no service twin and
  none is proposed.
- **Admin lifecycle browse/detail exists only for rentals**
  (`getLifecycleListForAdmin`/`getLifecycleDetailForAdmin`) — unchanged.
- **Enums are value-identical, type-distinct** — `owner_transfer_status`/`service_owner_transfer_status`
  and `payout_status`/`service_payout_status` still don't need value
  remapping to unify, only collapsing two Postgres type names into one, if a
  single-table design were ever chosen. Still true after R-CONC-04's
  `reversed` addition (added to **both** enums identically — confirmed by
  reading that plan's Step 1, which adds it to both `ownerTransferStatusEnum`
  and `serviceOwnerTransferStatusEnum` in the same migration).

### What changed since the spike (re-verify each at execution time)

- **R-CONC-02, R-BIZ-03, R-BIZ-05** (Phase 0/1, DONE) are now the _actual_
  baseline for `findEligibleForPayout`'s rental/service divergence the spike
  described — re-read both DALs' current `findEligibleForPayout` bodies
  directly rather than trusting the spike's line numbers; the shape
  (cutoff-inside-DAL vs. cutoff-passed-in; live-join vs. snapshot amount) is
  reported as unchanged by those plans' own status notes, but confirm.
- **R-CONC-04** (Phase 2) makes the two claim methods **more** different, not
  less: rental's `claimForProcessing` gains `ne(ownerTransferStatus, "frozen")`
  plus a `notExists` dispute subquery; service's gains
  `eq(ownerTransferStatus, "pending")` (exact match, stricter) plus the same
  `notExists` shape. Both remain single-purpose CAS UPDATEs with a boolean
  return today — **after R-ARCH-01 lands, both are re-expressed as calls to
  `claimTransition` with each claim's own `extraWhere` array carrying its own
  predicate** (R-ARCH-01 Part D, Step D2) — this is the "unify the code path"
  outcome this plan builds on, not one it does itself.
- **R-BIZ-14** adds `partially_refunded` to `payments.status` (not a
  lifecycle-table column) and fixes the deposit-hold `rentalId` metadata
  forwarding (rental-only, no service equivalent needed — services have no
  deposit holds). Neither touches the shared-vs-divergent method inventory.
- **R-DB-04** adds `release_deposit`/`skipped` to `financial_operation_type`/`_status`
  (dispute-ledger enums, not the payment-lifecycle tables) and fixes
  `resolved → closed` (dispute machine, not payment-lifecycle). No effect on
  this plan's inventory.
- **R-ARCH-01** re-expresses `claimForProcessing`, `unfreezeAfterResolution`,
  `updateDepositHoldStatus` (rental only — no service twin) on both DALs
  through the shared `claimTransition` function, and — per its Step D3 —
  adds real `from`-list guards to some of the previously-unguarded plain
  writes (`updateOwnerTransferStatus`, `markCancelled`, `updatePayoutStatus`)
  on **both** DALs using the **same helper function**. This is the spike's
  "~5-7 shared methods" list, now sharing an implementation primitive without
  sharing a class or a table.

### The one extraction still genuinely undone: agreement-document DALs

`src/dal/rental-agreement-document.dal.ts` (85 LOC) and
`src/dal/service-agreement-document.dal.ts` (88 LOC) remain near-textual
twins, 5 consumers each, **no money on either row** (they store PDF blob
references and generation status, not payment state). The spike's Option C
("do this now — cheap, no risk") was never executed. Re-read both files in
full before writing the base class — confirm the "near-textual twin" claim
still holds (nothing in Phase 0-2 touched either file, per the drift check
above, but confirm no unrelated drift crept in).

### The stale-detection consumer split — also still undone

`src/features/admin/services/stale-processing-detection-service.ts` (rental,
a separate admin-feature module reading an env-configurable threshold) and
`ServicePaymentLifecycleService.detectStaleProcessing(60)` (service, inlined
with a hard-coded default) both call the **same-shaped** DAL method
(`findStaleProcessingRecords`) with different consumers. Re-verify both
still call an identical query shape (unaffected by any Phase 2 plan) before
merging their consumers.

## Decisions for the maintainer

**1. Reaffirm GO-LATER; do not build Option B (single table).** If anything,
the case against a shared table is **stronger** now than at the spike: R-CONC-04
gave the two claim methods _more_ divergent predicates (rental excludes
`frozen`, service requires exactly `pending`) precisely because their real
failure modes differ, and R-DB-04 added a rental-only ledger enum
distinction that has no service analog to unify with. A `lifecycleType`
discriminator table would need to re-encode both of these as
conditionally-applied WHERE fragments anyway — it relocates the branching
onto a wider, sparser table instead of removing it, exactly as the original
spike concluded, now with one more concrete data point supporting that
conclusion. **Recommendation: do not build Option B.** Revisit only if
product commits to **both** service-booking security deposits **and** admin
lifecycle parity for services (the spike's own open question 1/3) — neither
has happened.

**2. Do not build a generic `PaymentLifecycleBaseDAL<TTable>` class either —
R-ARCH-01 already achieved Option A's goal by a different, cheaper route.**
The spike's Option A wanted a base class hosting `claimForProcessing`,
`unfreezeAfterResolution`, `updatePayoutStatus`, `findStaleProcessingRecords`,
`getByX` parameterized over the Drizzle table type, explicitly flagging "generics
over Drizzle table types add real type friction" as its main cost. R-ARCH-01's
`claimTransition(db, {table, idColumn, statusColumn, from, set, extraWhere})`
is a **plain function**, not a class — each DAL calls it with its own table
and column references, fully typed at each call site, no shared generic base
needed. Once R-ARCH-01 lands, `PaymentLifecycleDAL` and
`ServicePaymentLifecycleDAL` already call the same underlying claim/CAS code
for every method the spike wanted to share (Current state, above) —
**building a class hierarchy on top of that would only relocate the same
logic into a different, riskier shape (inheritance across two schemas with
different key columns) for zero additional sharing.** **Recommendation: do
not build the base-DAL class.** The honest statement for the re-baselined
doc: \*"unify the code paths via the shared `claimTransition` helper (done, as
a side effect of ARCH-01); do not unify the DAL classes or the tables."\*\*

**3. Do the agreement-document base extraction now — it's the one item with
no argument against it.** No money on either row, 5 consumers each, both
files confirmed unchanged since the spike. **Recommendation: proceed** (Step 2).

**4. Merge the stale-detection consumer, but keep the two crons.** Same DAL
query, two different wrapper services for no principled reason (one reads an
env-configurable threshold via a dedicated admin-feature module; one
hardcodes 60 minutes inline). **Recommendation: proceed** (Step 3) — this is
mechanical, not risky, and removes one of the spike's own named "co-changing,
easy to drift" surfaces. Do **not** merge the two payout crons or the two
deposit-adjacent crons themselves (rental has two the service side has none)
— that's Option B territory (one cron set implies one table/one eligibility
query), not this decision.

**5. Leave the open product questions open — restate them for whoever
answers them later.** Read-live-vs-snapshot payout amounts, the
platform-revenue metric mismatch (`applicationFeeAmount + serviceFee` vs.
`serviceFee` only), and the cron error-recovery-model divergence (rental
marks `failed` in its catch; service leaves `processing` for the stale
detector) are all still unresolved, still require product/finance sign-off,
and still aren't blocking anything today. **Recommendation: this plan
restates them verbatim in the re-baselined doc (Step 1) and does not attempt
to answer any of them** — answering them is out of scope for an
architecture-hygiene plan.

## Commands

| Purpose        | Command                                                                                                                                                                                                                                                                                        | Expected |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                                                                                           | exit 0   |
| Lint           | `bun run lint`                                                                                                                                                                                                                                                                                 | exit 0   |
| Targeted tests | `bun run test:run src/dal/__tests__/rental-agreement-document.dal.test.ts src/dal/__tests__/service-agreement-document.dal.test.ts src/features/admin/services/__tests__/stale-processing-detection-service.test.ts src/features/services/__tests__/service-payment-lifecycle-service.test.ts` | all pass |
| Full suite     | `bun run test:run`                                                                                                                                                                                                                                                                             | all pass |

No schema change — no migration commands needed.

## Scope

**In scope**: `docs/payment-lifecycle-unification.md` (full re-baseline, not
a patch — Step 1); new `src/dal/lib/agreement-document-base.dal.ts`;
`src/dal/rental-agreement-document.dal.ts` and
`src/dal/service-agreement-document.dal.ts` (become thin subclasses);
`src/features/admin/services/stale-processing-detection-service.ts` (widen to
accept either DAL's `findStaleProcessingRecords` shape, or extract a shared
threshold-resolving helper both crons call — see Step 3);
`src/features/services/services/service-payment-lifecycle-service.ts`
(`detectStaleProcessing` delegates to the shared helper); tests for all of
the above.

**Out of scope**: any change to `PaymentLifecycleDAL`/`ServicePaymentLifecycleDAL`
themselves (R-ARCH-01 already did the relevant work; this plan only verifies
and documents it — Decision 2); a single unified `payment_lifecycle` table
(Decision 1); merging the payout or deposit crons; answering any of the five
open product questions (Decision 5); `getFinancialMetrics`'s differing fee
formulas (a product decision, not a code change).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### Step 1: Re-baseline `docs/payment-lifecycle-unification.md`

Rewrite the document (keep its existing structure — TL;DR, baseline section,
divergence inventory, consumer inventory, target design options, verdict,
appendix) reflecting:

1. **Baseline section**: replace the "Baseline this design assumes" list
   (003/004/005-era) with the actual Phase 0-2 state — R-BIZ-01, R-CONC-01,
   R-CONC-02, R-BIZ-03, R-BIZ-05 (rental claim/cancel fixes), R-CONC-04
   (freeze-aware claims, `reversed` enum, chargeback-after-payout reversal),
   R-BIZ-14 (`partially_refunded`, deposit-hold metadata fix), R-DB-04
   (dispute ledger enum, `resolved → closed`), and R-ARCH-01 (the shared
   `claimTransition` helper). Re-verify each plan's actual landed diff before
   describing it — don't restate its own plan doc's _planned_ steps as fact.
2. **Divergence inventory (Step 1 of the doc)**: update every row in "Methods
   that are genuinely identical" and "Methods that diverge behaviorally" to
   reflect the post-Phase-2/ARCH-01 shape — in particular, `claimForProcessing`'s
   row should now read "same underlying `claimTransition` call, different
   `extraWhere` predicate (rental excludes `frozen`; service requires
   `pending` exactly)" rather than "byte-for-byte identical," since R-CONC-04
   made them meaningfully different in a way worth documenting precisely.
3. **Target design options (Step 3 of the doc)**: replace "Option A — shared
   generic base DAL" with a description of what actually happened (a shared
   function, not a base class — Decision 2) and mark it **DONE, via R-ARCH-01**
   rather than "recommended, pending trigger." Keep Option B and Option C's
   text, updating Option C's status to **DONE** once Step 2 below lands.
4. **Verdict (Step 4 of the doc)**: **GO-LATER, reaffirmed and narrowed
   further** — the code-path sharing part of the original recommendation is
   done; only the table-unification part (Option B) remains open, gated on
   the same two product questions as before.
5. Keep the "Open product questions" appendix verbatim (Decision 5) — do not
   resolve them, just carry them forward with a note that they're still open
   as of this plan's date.

**Verify**: the rewritten doc reads as a standalone document (no dangling
references to "plan 008" or pre-Phase-2 line numbers); every code claim in it
was re-checked against a live file in this same execution (not copied from
the old doc or from this plan's own "Current state" without re-verifying,
since even this plan's excerpts could drift if executed much later than
planned).

### Step 2: Agreement-document base extraction

Read both `rental-agreement-document.dal.ts` and
`service-agreement-document.dal.ts` in full. If confirmed near-identical
(same three methods per the spike's inventory — create/get/update-status-shaped
operations over a PDF-record table), extract:

```ts
// src/dal/lib/agreement-document-base.dal.ts
import { BaseDAL } from "@/dal/base";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

/**
 * Shared shape for the rental/service agreement-document DALs (ARCH-08) — no
 * money on either row, so this is a pure DRY extraction with none of the
 * payment-lifecycle DALs' risk profile.
 */
export abstract class AgreementDocumentBaseDAL<
  TTable extends PgTable,
> extends BaseDAL {
  protected abstract table: TTable;
  protected abstract idColumn(table: TTable): AnyPgColumn;

  // Fill in the 2-3 genuinely identical methods found by reading both files —
  // do not guess the shape here; this plan's own investigation did not read
  // either file's full body. Confirm method names/signatures directly before
  // writing this class, and only include methods that are truly identical
  // (a method with even one differing column stays on the subclass).
}
```

`RentalAgreementDocumentDAL`/`ServiceAgreementDocumentDAL` extend it, keeping
any domain-specific method (if either has one the other lacks) as a subclass
addition. No caller of either DAL's public methods changes signature — this
is a pure internal refactor, same contract as R-ARCH-01's Part B/C/D
behavior-preserving steps.

**Verify**: `bun run type-check` → exit 0; every existing test for both DALs
passes unmodified (same method names, same behavior, moved implementation).

### Step 3: Merge the stale-detection consumer

Re-read `stale-processing-detection-service.ts`'s threshold-resolution logic
(the env-configurable part) and `ServicePaymentLifecycleService.detectStaleProcessing`'s
hard-coded `60`. Extract one shared helper both call:

```ts
// in a shared location both features can import from — confirm the right
// home (src/features/admin/services/ is rental-specific by convention; a
// neutral location such as src/features/payments/lib/ may fit better —
// decide based on where findStaleProcessingRecords' two DALs' shared
// concerns already live, if anywhere)
export function resolveStaleProcessingThresholdMinutes(): number {
  return Number(process.env.STALE_PROCESSING_THRESHOLD_MINUTES ?? 60);
}
```

`StaleProcessingDetectionService` and
`ServicePaymentLifecycleService.detectStaleProcessing` both call this instead
of resolving the threshold independently; each keeps calling its own DAL's
`findStaleProcessingRecords` (rental vs. service) — this step unifies the
_threshold policy_, not the query or the two services themselves (they still
alert through different admin-facing channels, per the spike's own note that
this is a "structurally divergent consumer of identical DAL method," not an
identical consumer).

**Verify**: `bun run type-check` → exit 0; existing tests for both services
pass unmodified except the threshold-resolution assertion, which now reads
from the shared helper (update the mock/env-var reference in each test to
point at the new function's env var name, if it changed).

### Step 4: Tests

- `agreement-document-base.dal.test.ts` (new): the shared methods, tested
  once against a fixture table, plus one existing rental test and one
  existing service test confirming their subclasses still behave
  identically post-extraction.
- `resolve-stale-processing-threshold.test.ts` (new, or added to whichever
  file Step 3's helper lives in): default value, env-var override.

**Verify**: the targeted command in Commands → all pass.

## Test plan

Covered by Step 4. No real-DB test required — no money-moving code changes
in this plan (Decisions 1-2 explicitly reject the two paths that would have
needed one). Full regression: `bun run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `docs/payment-lifecycle-unification.md` re-baselined, verdict restated
      as "GO-LATER, code paths unified via R-ARCH-01; tables intentionally
      not unified"
- [ ] `AgreementDocumentBaseDAL` exists and both agreement-document DALs
      extend it, with all existing tests passing unmodified
- [ ] The two stale-processing consumers share one threshold-resolution
      function
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 3 outline's fourth item, and its own Execution-order row)

## STOP conditions

- Any "Current state" excerpt doesn't match live code beyond what
  R-CONC-04/R-BIZ-14/R-DB-04/R-ARCH-01 explain — re-read before continuing.
- Reading either agreement-document DAL in full (Step 2) finds them **less**
  identical than the spike claimed — narrow the base class to only the
  methods actually confirmed identical, or skip the extraction entirely and
  report why, rather than forcing a shared abstraction over methods that
  differ.
- R-ARCH-01 has not actually landed `claimTransition` calls in both
  payment-lifecycle DALs by the time this plan executes (check
  `grep -rn "claimTransition(" src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts`) —
  this plan's Decision 2 depends on that being true; if it isn't, stop and
  report rather than re-baselining the doc to describe work that hasn't
  happened.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

No route, response shape, or client-visible behavior changes anywhere in
this plan — it is a documentation re-baseline plus two internal DAL/service
refactors behind unchanged public contracts. No Mobile client follow-ups row
needed.

## Production cutover

None. No schema change, no data migration, no new manual step for any
environment.

## Maintenance notes

- The re-baselined doc's open product questions (read-live vs. snapshot,
  platform-revenue metric definition, cron error-recovery convergence) are
  unchanged from the spike and remain the trigger conditions for ever
  revisiting Option B — restate them, don't resolve them (Decision 5).
- If a future cross-cutting payment feature (service deposits, an escrow
  change, a new payout schedule) is scheduled, that is the moment to
  re-evaluate Option B specifically — not before. R-ARCH-01's
  `claimTransition` helper being in place by then makes whatever that
  feature needs to share cheaper to extract than it would have been at the
  original spike's baseline.
- If `getFinancialMetrics`'s two fee formulas are ever asked to roll up into
  one cross-marketplace KPI, that's a finance/product decision this plan
  explicitly does not make (Decision 5) — flag it back to whoever asks.
