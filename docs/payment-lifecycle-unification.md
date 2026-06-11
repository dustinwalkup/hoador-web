# Payment-lifecycle unification — design spike

> **Type**: read-only design spike (plan 008). The deliverable is this document.
> No `src/` code was changed.
> **Read this if**: you are deciding whether to merge the rental and service
> payment-lifecycle stacks, or you are about to touch one of them and want to
> know what the twin does.

## TL;DR — verdict

**GO-LATER.** The two stacks _look_ like wasteful duplication, but most of the
divergence is intrinsic to the two domains (security deposits are rental-only;
the payout-amount model differs by design; admin tooling exists only for
rentals). The genuinely-duplicated, co-changing surface is modest (~5–7 methods,
roughly 150–250 LOC: the atomic claim, freeze/unfreeze, stale-record query, and
the metrics shell). Unifying the **schema** (Option B) is high risk for low
payoff on two small tables. A narrow **Option A** (shared base DAL over the
proven-identical methods) plus extracting the trivially-identical
agreement-document DAL is the right shape — but it should be done **as the first
step of the next cross-cutting payment feature** (service deposits, escrow
change, new payout schedule), gated behind characterization tests that do not
exist yet. Pure-cleanup unification today buys a bounded reduction in bug surface
at HIGH risk on the most money-critical code in the repo, with no test net. Not
worth it in isolation; clearly worth it the moment a feature would otherwise be
built twice.

Coarse effort if/when triggered: **~7–10 engineer-days** for the narrow Option A
path (characterization tests + base extraction + agreement-doc base); **~10–15
engineer-days** for full Option B (adds a data migration + dual-write/backfill +
rollback rehearsal). Both marked _coarse_.

---

## Baseline this design assumes (important)

Per plan 008's dependency on 003/004/005, this spike must reflect the **fixed**
lifecycle semantics, not the buggy baseline. The actual state at the time of
writing (from `plans/README.md`):

- **003 (webhook failure audit trail)** — DONE. Reflected.
- **004 (deposit-hold lifecycle fixes)** — Steps 1–2 DONE (the `release_failed`
  clobber fix + expiry-monitor now watches `held` **and** `release_failed`, see
  `payment-lifecycle.dal.ts:462`). **Step 3 (per-payment-method retry
  idempotency key) was deliberately NOT implemented** — it would have created a
  _new_ bug: the deposit cron's `findScheduledDepositsNearPickup` selects both
  `scheduled` **and** `failed` rows (`payment-lifecycle.dal.ts:434-443`) and
  retries failed holds, so giving the renter retry a per-PM key while the cron
  kept a fixed key would let a concurrent cron+retry place **two** holds on the
  same card. Current state keeps a shared deterministic key → Stripe dedupes →
  no double hold.
- **005 (atomic approve / double-charge guard)** — Steps 1–2 DONE (atomic
  `claimForProcessing` on approval). **Step 3 (catch-all claim release) was
  deliberately NOT implemented** — a blind catch-reset-to-`failed` after a
  successful charge would re-arm a double charge on retry; today a post-charge
  throw self-heals because a bare re-approve reuses the deterministic
  PaymentIntent key and Stripe replays the same charge. Residual known
  trade-off: a post-charge throw can leave a request stuck in `processing`
  (unapprovable without manual reset) rather than double-charging.

**Why this matters for unification:** the unified design must preserve two
load-bearing invariants that are easy to lose in a refactor:

1. **Deterministic Stripe idempotency keys are the real concurrency guard**, not
   the DB status. Any unified claim/charge/hold path must keep deterministic
   keys so that cron+retry races and post-failure replays converge on _one_
   Stripe object. Do not "fix" this into per-attempt keys without re-deriving
   the disjointness argument from scratch.
2. **`payoutStatus = 'processing'` is the lock, and stale detection is the
   safety net for rows that never leave it.** Both must survive unification.

If 004/005 Step 3 are revisited later, this design does not need to change — it
already treats deterministic keys + stale detection as the contract.

---

## STOP-condition disposition

- **STOP #1 (003/004/005 not DONE):** Literally, 004/005 are `IN PROGRESS`
  (Steps 1–2 done, Step 3 blocked). The README's dependency notes explicitly
  and repeatedly direct that **"Plan 008 must baseline on this partial state,"**
  and the blocked Step 3s are _deliberately-rejected wrong fixes_, not pending
  semantics — so the STOP's purpose (don't bake buggy semantics into the design)
  is satisfied. Proceeded, with the partial state documented above.
- **STOP #2 (a unification effort already started):** Checked — no
  `lifecycleType` discriminator column, no `PaymentLifecycleBaseDAL`, no
  pre-existing design doc. Clear to produce this design.

---

## The two stacks at a glance

| Layer             | Rental side                                                       | Service side                                                      | Notes                                                         |
| ----------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| DAL               | `src/dal/payment-lifecycle.dal.ts` (1,008 LOC, 21 methods)        | `src/dal/service-payment-lifecycle.dal.ts` (555 LOC, 14 methods)  | rental ≈2× larger, mostly deposit + admin methods             |
| Schema            | `rental-payment-lifecycle.schema.ts` (keyed by `rentalId`)        | `service-payment-lifecycle.schema.ts` (keyed by `bookingId`)      | distinct tables                                               |
| Enums             | `deposit_hold_status`, `owner_transfer_status`, `payout_status`   | `service_owner_transfer_status`, `service_payout_status`          | transfer/payout enums are **value-identical, distinct types** |
| Lifecycle service | `payment-lifecycle-service.ts` (595 LOC, 4 methods)               | `service-payment-lifecycle-service.ts` (159 LOC, 2 methods)       | rental adds deposit scheduling/expiry/retry                   |
| Stale detection   | `admin/services/stale-processing-detection-service.ts` (separate) | inlined as `ServicePaymentLifecycleService.detectStaleProcessing` | **structurally divergent consumer of identical DAL method**   |
| Payout cron       | `cron/process-payouts` (hourly)                                   | `cron/process-service-payouts` (hourly)                           | near-identical wrappers                                       |
| Stale cron        | `cron/detect-stale-processing` (hourly)                           | `cron/detect-stale-service-processing` (hourly)                   | near-identical wrappers                                       |
| Deposit cron      | `cron/schedule-deposit-holds`, `cron/monitor-deposit-expiry`      | — none —                                                          | rental-only                                                   |
| Agreement-doc DAL | `rental-agreement-document.dal.ts` (85 LOC)                       | `service-agreement-document.dal.ts` (88 LOC)                      | near-textual twins (5 consumers each)                         |

Money model, stated plainly:

- **Rental lifecycle row is a pure state machine — it stores no money.** Payout
  amounts (`totalAmount`, `ownerPayout`) are read **live** from `rentalRequests`
  at payout time (`findEligibleForPayout`, `payment-lifecycle.dal.ts:358`).
- **Service lifecycle row carries a money snapshot.** `providerPayout` is locked
  on the row at charge time (so a later `PLATFORM_FEE_PERCENTAGE` change doesn't
  move an already-charged booking), and `transferAmount` records what actually
  moved. `updateProviderPayout` exists to adjust the snapshot for partial
  dispute outcomes.

This single difference — **read-live vs snapshot** — is the deepest divergence
and the one a unified design must take a position on.

---

## Step 1 — Divergence inventory (behavioral, not cosmetic)

### Methods that are genuinely identical (the safe shared core)

| Capability                | Rental                                | Service                               | Divergence                                                                                                                                                                         |
| ------------------------- | ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic claim for payout   | `claimForProcessing` (`:246`)         | `claimForProcessing` (`:152`)         | **None.** Both: `UPDATE … SET payoutStatus='processing' WHERE id=? AND payoutStatus='pending' RETURNING` → boolean. Byte-for-byte the same logic.                                  |
| Unfreeze after resolution | `unfreezeAfterResolution` (`:584`)    | `unfreezeAfterResolution` (`:366`)    | **None.** Atomic `frozen → pending`, no-op otherwise.                                                                                                                              |
| Update payout status      | `updatePayoutStatus` (`:337`)         | `updatePayoutStatus` (`:211`)         | **None.**                                                                                                                                                                          |
| Stale-processing query    | `findStaleProcessingRecords` (`:983`) | `findStaleProcessingRecords` (`:441`) | **None** at the SQL level (`payoutStatus='processing' AND updatedAt<=cutoff`). Differs only in the result key name (`rentalId`/`bookingId`) and the consuming service (see below). |
| Get by transfer id        | `getByTransferId` (`:226`)            | `getByTransferId` (`:133`)            | **None** (key column aside).                                                                                                                                                       |
| Get by entity id          | `getByRentalId` (`:209`)              | `getByBookingId` (`:116`)             | Same query, different key column/name.                                                                                                                                             |

> **Correction to the plan's framing:** plan 008 Step 1 asks "service has
> `findStaleProcessingRecords` — what does rental use?" Rental **also** has an
> identical `findStaleProcessingRecords` (`:983`); it was already present at the
> baseline commit. What actually diverges is the _consumer_: rental routes call
> a dedicated `StaleProcessingDetectionService` (an admin-feature module that
> reads an env-configurable threshold), while the service side inlines the same
> logic as `ServicePaymentLifecycleService.detectStaleProcessing(60)` with a
> hard-coded default. Same DAL method, two different service wrappers.

### Methods that diverge behaviorally

| Capability                  | Rental impl                                                                                                                                                                                                                               | Service impl                                                                                                                                                                       | Behavioral divergence                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`                    | requires `depositHoldStatus`; stores `rentalChargeId`; no money on row                                                                                                                                                                    | requires/locks `providerPayout`; stores `chargeId`; money on row                                                                                                                   | Different required fields and supporting columns.                                                                                                                                 |
| `findEligibleForPayout`     | 24h cutoff computed **inside** the DAL; `limit` defaults 20; joins `rentalRequests` for amounts; filters only `isNull(dispute)` — **does not** explicitly exclude `frozen`                                                                | cutoff **passed in** by the service; `limit` required; reads `providerPayout` off the row; **also** filters `ownerTransferStatus != 'frozen'` **and** `providerPayout IS NOT NULL` | (a) cutoff ownership; (b) service has belt-and-suspenders frozen/non-null guards rental lacks; (c) amount source (live join vs snapshot).                                         |
| `markCancelled`             | sets `payoutStatus='completed'` **plus** optional deposit/transfer overrides                                                                                                                                                              | sets `payoutStatus='completed'` only                                                                                                                                               | Same "skip the cron" sentinel; rental also carries deposit cleanup.                                                                                                               |
| `freezeForDispute`          | update→`frozen`, or create with `depositHoldStatus='not_applicable'`, `chargeId=null`                                                                                                                                                     | update→`frozen`, or create **after computing `providerPayout` from `servicePrice·(1−fee)`** and pulling `chargeId` from the booking                                                | Service's create-on-missing path does real money math; rental's is inert. Service also throws if the update returns no row; rental does not.                                      |
| `updateOwnerTransferStatus` | extra: `stripeTransferId`, `ownerTransferredAt`                                                                                                                                                                                           | extra: `stripeTransferId`, `ownerTransferredAt`, **`transferAmount`**                                                                                                              | Service records the actual USD moved; rental has no such column.                                                                                                                  |
| `getPaymentMetrics`         | `ownerTransfer` block has **no `processing` count** (despite the enum having the value) + an 8-status `depositHold` block                                                                                                                 | `ownerTransfer` block **includes `processing`**; no deposit block                                                                                                                  | Rental metrics under-report rows stuck in `ownerTransfer='processing'` (latent gap). Deposit metrics are rental-only.                                                             |
| `getFinancialMetrics`       | `platformRevenue = Σ(applicationFeeAmount + serviceFee)`; `grossVolume = Σ rentalRequests.totalAmount`; `ownerPayouts = Σ rentalRequests.ownerPayout`; **6** needs-attention counts (incl. failedDeposits/failedReleases/expiredDeposits) | `platformRevenue = Σ serviceFee` **only**; `grossVolume = Σ serviceBookings.totalAmount`; `ownerPayouts = Σ serviceBookings.servicePrice`; **3** needs-attention counts            | **"Platform fees" are computed differently.** These two numbers are **not** summable into one platform-revenue KPI without reconciling the fee model first — open question below. |

### Methods with no twin

| Method                                                                                                                                                         | Side         | Why no twin                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateDepositHoldStatus` (**21 call sites**), `findScheduledDepositsNearPickup`, `findExpiringDeposits`, `markDepositCaptured`, `findFailedDepositsForRenter` | rental-only  | Security deposits are rental-only. ~4 columns + 2 crons + the largest call-site cluster.                                                                              |
| `incrementOwnerTransferRetryCount`                                                                                                                             | rental-only  | Service has no `ownerTransferRetryCount` column.                                                                                                                      |
| `getLifecycleListForAdmin`, `getLifecycleDetailForAdmin`                                                                                                       | rental-only  | Admin lifecycle browse/detail UI exists only for rentals. Heavy (paginated search + dispute/audit joins).                                                             |
| `markRefundedAfterDispute`                                                                                                                                     | service-only | Sets both transfer+payout to `completed` for `favor_requester`. Rental routes refund-after-dispute through `markCancelled` overrides + dispute financial-ops instead. |
| `updateProviderPayout`                                                                                                                                         | service-only | Only meaningful because the service row snapshots the payout; rental reads live so there is nothing to adjust.                                                        |

### Service-layer divergences (crons)

- **Error recovery differs.** Rental `processPayouts` catch → `updatePayoutStatus('failed')`
  (`payment-lifecycle-service.ts:183`). Service `processPayouts` catch → ops
  alert **only**, leaving the row in `processing`
  (`service-payment-lifecycle-service.ts:107-117`), relying on the stale
  detector to surface it. Two different recovery models for the same failure.
- **Idempotency strategy differs.** Service transfer uses a deterministic
  `service-transfer-${bookingId}` key. Rental transfer threads
  `ownerTransferRetryCount` into `createOwnerTransfer` (retry-count-scoped key).
- **Deposit pipeline (rental-only):** `scheduleDepositHolds`,
  `monitorDepositExpiry`, `retryDepositHold` (renter-triggered) have no service
  analog.
- **Eligibility cutoff ownership:** service service owns the 24h cutoff and
  passes it in; rental hides it in the DAL.

### Schema / enum divergence

- **Enums are value-identical, type-distinct.** `owner_transfer_status` and
  `service_owner_transfer_status` both = `{pending, processing, completed,
failed, frozen}`; `payout_status` and `service_payout_status` both =
  `{pending, processing, completed, failed}`. **No value remapping is needed**
  to unify them — only collapsing two Postgres type names into one. This makes
  Option B's "enum reconciliation" cheaper than it sounds.
- **Columns:** rental-only `rentalChargeId`, `depositHold*` (4 cols),
  `ownerTransferRetryCount`; service-only `providerPayout`, `transferAmount`
  (both `numeric`). Secondary indexes differ (rental indexes
  `depositHoldStatus`; service indexes `ownerTransferStatus`).

---

## Step 2 — Consumer inventory (blast radius)

Counts exclude `__tests__` (`grep -rn … | grep -v __tests__`).

| Surface                                  | External call sites | Distinct methods used |
| ---------------------------------------- | ------------------- | --------------------- |
| `paymentLifecycleDAL.*` (rental)         | **65**              | 21                    |
| `servicePaymentLifecycleDAL.*` (service) | **23**              | 14                    |
| `PaymentLifecycleService` (rental)       | 9                   | —                     |
| `ServicePaymentLifecycleService`         | 5                   | —                     |
| `*AgreementDocumentDAL` (each side)      | 5 each              | 3                     |

Rental DAL call-site distribution (top): `updateDepositHoldStatus` ×21,
`getByRentalId` ×14, `freezeForDispute` ×13, `updateOwnerTransferStatus` ×10,
`updatePayoutStatus` ×8, `unfreezeAfterResolution` ×5, `markDepositCaptured` ×3,
`markCancelled` ×2, then singletons. Service DAL: `updatePayoutStatus` ×4,
`getByBookingId` ×4, `updateOwnerTransferStatus`/`unfreezeAfterResolution`/`freezeForDispute`
×2 each, the rest singletons.

**Reading of the blast radius:** the rental DAL's 65 sites are dominated by the
deposit machinery (`updateDepositHoldStatus` alone is ~⅓) and the dispute flows
(`freezeForDispute`/`getByRentalId`). Those are exactly the methods with **no
twin**, so they would stay on a rental subclass under any plan and do **not**
need to be touched. The methods that would actually move into a shared base
(`claimForProcessing`, `unfreezeAfterResolution`, `updatePayoutStatus`,
`findStaleProcessingRecords`, `getByX`) have a **small** combined external
footprint and, being signature-preserving, can move without changing call sites.
**The scary-looking 65 is mostly not in scope for unification.**

### Test coverage (the safety net — thin)

- Rental: `payment-lifecycle-service.test.ts` exists (service layer only).
- **No** `payment-lifecycle.dal.test.ts` (the rental DAL state machine —
  claim/freeze/eligibility — is uncharacterized).
- **No** service-side lifecycle tests at all (DAL or service).
- **No** cron payout/stale/deposit tests.

For a HIGH-risk money refactor, the characterization net is largely greenfield.
This is the single biggest reason the verdict is GO-_LATER_ and not GO.

---

## Step 3 — Target design options

### Option A — shared generic base DAL (no schema change)

`PaymentLifecycleBaseDAL<TTable>` hosting only the proven-identical methods —
`claimForProcessing`, `unfreezeAfterResolution`, `updatePayoutStatus`,
`updateOwnerTransferStatus` (skeleton), `findStaleProcessingRecords`, `getByX`,
the `create`/`freezeForDispute` skeletons, and a `getPaymentMetrics` template —
parameterized over the Drizzle table + its key column. `PaymentLifecycleDAL` and
`ServicePaymentLifecycleDAL` extend it; each keeps its domain methods (rental:
all deposit + admin methods + retry count; service: `updateProviderPayout`,
`markRefundedAfterDispute`, `transferAmount`). Two crons/services remain but
delegate their shared steps to shared helpers; the divergent recovery model and
metrics formulas stay explicit in subclasses.

- **Pros:** no migration, no data risk; signature-preserving (call sites
  unchanged); DRYs the methods most likely to co-change and drift (the
  bug-for-bug history the plan cites lives here); reversible per-method;
  incremental.
- **Cons:** generics over Drizzle table types add real type friction; the
  honestly-shareable surface is small (~5–7 methods), so the LOC win is modest
  (~150–250); still two tables, two crons, two services to reason about; the
  read-live vs snapshot split means the eligibility + payout step can _not_ be
  fully shared.

### Option B — single table + `lifecycleType` discriminator

One `payment_lifecycle` table with `lifecycleType ∈ {rental, service}`, one DAL,
one cron set, one service. Requires migrating `service_payment_lifecycle` rows
into the unified table, collapsing the value-identical enums into one type each,
and making the union of columns nullable (deposit cols null for service rows;
`providerPayout`/`transferAmount` null for rental rows; one of
`rentalId`/`bookingId` null per row).

- **Pros:** genuinely one stack — one cron pair, one metrics query, one place for
  the next payment feature; admin tooling becomes free for services; kills the
  "did the twin get this?" tax permanently.
- **Cons:** **a data migration on the most money-critical table in the repo**;
  the unified table is wide and sparse (a discriminator gating which half of the
  columns are valid — a code smell that re-encodes the same split inside one
  table); every query grows a `WHERE lifecycleType=…`; FK integrity to two
  different parents (`rentals` vs `serviceBookings`) can't be a simple column FK;
  highest blast radius (all 88 call sites converge); needs dual-write + backfill
  - rollback rehearsal. High risk, and much of the "duplication" it removes is
    intrinsic, so it largely _relocates_ the branching rather than deleting it.

### Option C — status quo + parity checklist (process, not code)

Accept the split as largely intrinsic. Add one line to `CLAUDE.md`: _"every PR
touching one payment-lifecycle stack must answer: does the twin need this too?"_
Extract the agreement-document DAL into a tiny shared base now (near-zero risk,
no money, 5+5 consumers) as the one cheap win.

- **Pros:** zero risk; honest about how much divergence is domain-driven; frees
  the team to spend the refactor budget elsewhere.
- **Cons:** the double-maintenance tax persists on the ~5–7 shared methods (the
  ones that have historically drifted); relies on review discipline holding.

### Recommendation: **narrow Option A, triggered by the next payment feature**

Do Option C's agreement-doc extraction now (cheap down payment). Hold the DAL
base extraction (narrow Option A) until a cross-cutting payment feature is
scheduled, then do it as that feature's first step behind characterization
tests. Skip Option B unless/until product decides services get deposits **and**
admin parity — at which point the unified table earns its migration cost.

#### Migration sequencing (narrow Option A, when triggered)

1. **Characterization tests first** (hard dependency). Using the route-test
   pattern from plan 006, pin current behavior of: `claimForProcessing`
   (concurrent claim → one winner), `freezeForDispute`/`unfreezeAfterResolution`,
   `findEligibleForPayout` (both amount sources), both `getFinancialMetrics`
   formulas, both `processPayouts` crons incl. the **divergent catch behavior**,
   and the deposit cron + `retryDepositHold` idempotency under cron+retry race.
   These tests are the contract; they must pass unchanged after each step.
2. **Agreement-doc base** (independent, ship anytime): extract
   `AgreementDocumentBaseDAL<TTable>`; rental/service become thin subclasses.
3. **Extract `PaymentLifecycleBaseDAL`** with the identical methods only,
   signature-preserving. Land rental subclass first (bigger, better-tested),
   then service. No call-site changes.
4. **Unify the stale-detection consumer**: collapse
   `StaleProcessingDetectionService` and
   `ServicePaymentLifecycleService.detectStaleProcessing` onto one
   threshold-resolving helper over the shared DAL method.
5. **(Optional) converge the cron recovery model** — pick rental's
   "mark `failed` in catch" vs service's "leave `processing` for the detector"
   — but only with product sign-off (it's a behavior change, see open
   questions), and only after the characterization tests encode the chosen one.

Everything behind a flag? Not needed for A — it's signature-preserving and
reversible per-method; a feature flag adds nothing. (Option B _would_ need a
dual-write flag + backfill + read-cutover.)

#### Test strategy

Characterization tests (step 1 above) are the gate and the regression net.
Because the base is signature-preserving, the same suite runs green before and
after; any red is a real behavior change, not a refactor artifact. Add the
missing service-side and DAL-level tests as part of this effort — they are worth
having regardless of whether the base extraction proceeds.

#### Rollback story

- Option A: revert the extraction commit(s); subclasses re-inline. No data
  touched, so rollback is a code revert — trivial.
- Option B (if ever): rollback requires reversing a data migration. Mandatory
  dual-write window with the old tables kept in sync until the unified path is
  proven; cutover and backfill rehearsed on a prod snapshot first (per the
  team's staged-prod-repair convention: one record, verify, then bulk in one
  transaction).

#### Open product questions (must be answered before B, and before any shared metric)

1. **Will service bookings ever get security deposits?** This is the biggest
   fork. If **yes**, unify _before_ building them so deposits land once → favors
   B (or A with deposits promoted into the base). If **never**, the rental-only
   deposit subclass is the clean end-state → favors A/C.
2. **Read-live vs snapshot — which wins?** Rentals read payout live from
   `rentalRequests`; services snapshot `providerPayout` at charge. A unified
   payout path needs one model. Snapshot is arguably safer (immune to
   `PLATFORM_FEE_PERCENTAGE` drift between charge and payout) — should rentals
   adopt it? This is a money-semantics decision, not an engineering one.
3. **Should service lifecycles get rental's admin list/detail + financial
   dashboard?** If yes, that's a _feature_, and a shared base/table makes it land
   once instead of porting `getLifecycleListForAdmin`/`getLifecycleDetailForAdmin`.
4. **Platform-revenue metric mismatch — bug or intent?** Rental counts
   `applicationFeeAmount + serviceFee`; service counts `serviceFee` only.
   Finance/product must confirm the intended definition before these roll up
   into one cross-marketplace KPI.
5. **Cron error-recovery model — converge or keep both?** Mark `failed` in the
   catch (rental) vs leave `processing` for the stale detector (service). Pick
   one for a unified cron, or document why they intentionally differ.

---

## Step 4 — Verdict

**GO-LATER.** The duplication is real but mostly _intrinsic_: security deposits,
the read-live-vs-snapshot payout model, admin tooling, and the fee-formula
difference account for the bulk of the divergence, and none of them disappear by
sharing code — Option B largely relocates that branching into a sparse,
discriminated table on the repo's most money-critical data, at HIGH risk, with
no characterization tests in place. The portion that _is_ wasteful duplication —
the atomic claim, freeze/unfreeze, stale query, and metrics shell — is small
(~5–7 methods, ~150–250 LOC) and has a small, signature-preservable blast
radius. Extracting it (narrow Option A) is worth doing, but its payoff (less
drift on the shared methods) is realized mainly when a feature would otherwise be
implemented twice. So: do the trivial agreement-doc base now; do the DAL base as
the opening move of the next cross-cutting payment feature, behind
characterization tests; and reserve full single-table unification (Option B) for
the day product commits to service deposits **and** admin parity. Until then,
add the CLAUDE.md "does the twin need this too?" line so the GO-LATER path stays
safe.

Coarse effort (engineer-days, _coarse_): characterization tests **3–5**; narrow
Option A base extraction **3–4**; agreement-doc base **0.5–1**; full Option B,
if ever, **10–15** on top (migration + dual-write/backfill + rollback rehearsal).

---

## Appendix — file index

| File                                                                                                                                                               | Role                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/dal/payment-lifecycle.dal.ts`                                                                                                                                 | rental DAL (state machine, no money on row)                                         |
| `src/dal/service-payment-lifecycle.dal.ts`                                                                                                                         | service DAL (money snapshot on row)                                                 |
| `src/db/schemas/rental-payment-lifecycle.schema.ts`                                                                                                                | rental table + indexes                                                              |
| `src/db/schemas/service-payment-lifecycle.schema.ts`                                                                                                               | service table + indexes                                                             |
| `src/db/schemas/_enums.ts`                                                                                                                                         | `deposit_hold_status`, `(service_)owner_transfer_status`, `(service_)payout_status` |
| `src/features/rentals/services/payment-lifecycle-service.ts`                                                                                                       | rental crons: payouts, deposit schedule/expiry, renter retry                        |
| `src/features/services/services/service-payment-lifecycle-service.ts`                                                                                              | service crons: payouts, stale detection                                             |
| `src/features/admin/services/stale-processing-detection-service.ts`                                                                                                | rental stale-detection consumer (separate from the lifecycle service)               |
| `src/dal/rental-agreement-document.dal.ts` / `src/dal/service-agreement-document.dal.ts`                                                                           | near-identical PDF-record DALs (cheap shared-base candidate)                        |
| `src/app/api/cron/{process-payouts,process-service-payouts,detect-stale-processing,detect-stale-service-processing,schedule-deposit-holds,monitor-deposit-expiry}` | cron routes (all hourly; last two rental-only)                                      |
