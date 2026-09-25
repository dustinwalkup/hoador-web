# Plan R-ARCH-01: Shared claim/transition helper and declarative transition tables for every money state machine

> **Executor instructions**: Follow step by step, one Part at a time. Each
> Part is independently landable — run its own verification and its own
> real-DB race tests before moving to the next Part. On a STOP condition,
> stop and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/dal/rentals.dal.ts src/dal/service-booking.dal.ts src/dal/payment-lifecycle.dal.ts src/dal/service-payment-lifecycle.dal.ts src/dal/dispute.dal.ts src/features/rentals/services/cancellation-service.ts src/features/rentals/services/rental-service.ts src/features/rentals/services/payment-lifecycle-service.ts src/features/services/services/service-booking-service.ts src/features/services/services/service-payment-lifecycle-service.ts src/features/disputes/lib/state-machine.ts src/features/disputes/services/dispute-resolution-service.ts src/app/api/disputes/\[id\]/state/route.ts src/db/schemas/_enums.ts`
>
> **This diff will NOT be empty.** This plan depends on R-CONC-04, R-BIZ-14
> and R-DB-04 (Phase 2), which edit several of these same files (new `reversed`
> enum value, freeze-aware claims, `notExists` dispute predicates,
> `partially_refunded`, `release_deposit`/`skipped`, the `resolved → closed`
> fix). **Expected drift** = those three plans' changes, already landed. Read
> each of their "Status" rows in `10-remediation-roadmap.md` first, then
> re-read every function this plan touches in live code before writing any
> code — this plan's own "Current state" below is a snapshot from **before**
> Phase 2 landed and will be stale on every touched method's exact WHERE
> clause. **Unexpected drift** (anything not explained by those three plans,
> or by ARCH-03 if it already landed) is the real STOP condition.

## Status

- **Priority**: P2 · **Effort**: L (five state machines, staged so each part
  ships and is tested independently) · **Risk**: MED per part (each part is a
  behavior-preserving refactor of an already-tested CAS, or a narrowly-scoped
  tightening of a currently-unguarded write called out explicitly below — not
  a rewrite of business logic)
- **Depends on**: R-CONC-04, R-BIZ-14, R-DB-04 (Phase 2 — they add CAS
  predicates and enum values this plan's transition tables must encode
  correctly); R-TEST-HARNESS (DONE). Coordinates with R-ARCH-03 (touches the
  same `rentals.dal.ts` ownership-param signatures and `dispute.dal.ts`
  `updateState`) and is a prerequisite for R-ARCH-08.
- **Category**: architecture / concurrency (money) · **Planned at**: commit
  `29fe557`, 2026-09-25
- **Fixes**: ARCH-01 (consolidates the Phase 0–2 CAS fixes behind one shared
  helper and declarative transition tables); CONC-09 (dispute resolve/state
  changes gain an atomic claim)

## Why this matters

By the time this plan executes, ten separate plans (R-BIZ-01, R-CONC-01,
R-CONC-02, R-BIZ-03, R-BIZ-05, R-CONC-04, R-BIZ-14, R-DB-04, plus the
long-standing `ServiceBookingDAL.updateIfStatus`) will each have hand-rolled
their own compare-and-swap for one transition on one machine. That's the
correct order to have fixed CRITICAL/HIGH bugs fast, but it leaves five state
machines (rental request, rental payment lifecycle, service booking, service
payment lifecycle, dispute) each with their own ad-hoc claim shape, their own
error-throwing convention, and no single place that says "these are the legal
transitions for this machine" the way `12-booking-state-machine.md` documents
them. The next writer either re-derives the correct WHERE clause from scratch
(risk: repeats a bug class already fixed once) or copies the nearest existing
method without checking whether its guard is actually complete for the new
call site. ARCH-01's own recommended fix is explicit: introduce one shared
transition utility, express every machine as a declarative transition table,
and migrate the ad-hoc sites onto it one machine at a time, incrementally.

CONC-09 (dispute resolve has no atomic claim) rides along here because it has
no dedicated remediation plan of its own — the roadmap assigns it to ARCH-01
directly, and fixing it is now mechanical once the dispute machine has its own
declarative transition table with a claim step.

## Inventory step (run at execution time — do not trust the list below)

The exact set of ad-hoc CAS sites will have shifted after Phase 2. Before
writing any code, re-run:

```bash
grep -rn "updateIfStatus\|claimFor\|fromStatus" src/dal --include="*.ts" | grep -v __tests__
grep -rn "\.set({\s*status:\|\.set({\s*\w*[Ss]tatus:" src/dal --include="*.ts" | grep -v __tests__
grep -rln "\.where(eq(.*\.id," src/dal/{rentals,service-booking,payment-lifecycle,service-payment-lifecycle,dispute}.dal.ts
```

Cross-reference every hit against "Current state" below and `12-booking-state-machine.md`'s
tables. Report any site not accounted for in either place before proceeding —
that's new drift from Phase 2 this plan must also cover or explicitly exclude.

## Current state (verified at commit `29fe557`, before Phase 2)

Five state machines, five different conventions today:

| Machine                                     | File                                                                                  | Claim convention today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rental request (`rental_requests.status`)   | `src/dal/rentals.dal.ts` (3,678 lines)                                                | Mixed: real CAS with `.returning()` + a bespoke `ConflictError` message per method (`declineRentalRequest` :2181-2226, `cancelRentalRequest` :1831-1880, `markRequestExpired` :1803-1825 boolean, `startRental`/`endRental`/`cancelApprovedRental` all throw `ConflictError(RENTAL_STATE_CHANGED_MESSAGE)`); `approveRentalRequest` (:2081-2157) is a CAS **inside** `db.transaction` combined with a `rentals` row insert — not a pure status flip. Shared extra predicate `notPaymentProcessing` (:494-501, `or(isNull(paymentStatus), ne(paymentStatus,"processing"))`) is reused five times as a module-level `const`, not a composable parameter.                                                                                                                                                                                                                                                  |
| Rental payment lifecycle                    | `src/dal/payment-lifecycle.dal.ts` (1,056 lines)                                      | Split: `claimForProcessing` (:247-267) and `unfreezeAfterResolution` (:666-686) are real CAS, boolean return. `updateOwnerTransferStatus` (:367-389), `markCancelled` (:583-619) are **plain unconditional writes**, `Promise<void>`, no guard at all. `updateDepositHoldStatus` (:301-340) is the one method that already supports an optional `fromStatus: T \| T[]` — the closest existing analog to this plan's helper. `freezeForDispute` (:628-657) is read-then-write with no DB-level guard (a race Phase 2's R-CONC-04 narrows but does not turn into a single-statement CAS).                                                                                                                                                                                                                                                                                                                 |
| Service booking (`service_bookings.status`) | `src/dal/service-booking.dal.ts` (876 lines)                                          | `updateIfStatus` (:184-212) is the file's one general-purpose CAS: single `expectedStatus` (not an array), a boolean `blockWhilePaymentProcessing` flag rather than a composable predicate, returns the row or `null`, never throws. `claimForAcceptance` (:253-279) and `markExpired` (:342-367) are separate bespoke CAS methods with the same shape, not built on `updateIfStatus`. Accept/decline/cancel/complete live in `service-booking-service.ts`, each with its own `ConflictError` message on a lost claim.                                                                                                                                                                                                                                                                                                                                                                                  |
| Service payment lifecycle                   | `src/dal/service-payment-lifecycle.dal.ts` (570 lines)                                | Mirrors rental payment lifecycle's split, with one inconsistency: `freezeForDispute` (:324-376) throws a **plain `Error`** (not a `DALError`) on an unexpected miss — the only non-`DALError` throw in either lifecycle DAL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Dispute (`disputes.status`)                 | `src/dal/dispute.dal.ts` (1,565 lines) + `src/features/disputes/lib/state-machine.ts` | The **only** machine with a declarative transition table today (`VALID_TRANSITIONS`, `ADMIN_ONLY_STATES`, `FINAL_STATES` in `state-machine.ts`) — but it's consulted only in application code (`DisputeStateMachine.validateTransition`, called from the PATCH `/state` route) and never enforced at the DB layer: `dispute.dal.ts`'s `updateState` (:768-802) and `resolve` (:948-984) are both **plain unconditional writes**, `WHERE id` only. `transitionIfStatus` (:813-828) is a real single-`from` CAS but has no callers today — it's dead code, present but unused. `resolveDispute` (`dispute-resolution-service.ts:96-…`) does its money side effects (deposit capture/release or a Stripe refund) **before** calling `disputeDAL.resolve`, with only an application-level `dispute.status === "resolved" \| "closed"` pre-check (TOCTOU) in between — this is CONC-09 exactly as described. |

**Already partially fixed / worth noting as out of date:** `12-booking-state-machine.md`'s rental table (row "approved\|active\|completed → cancelled (no-show) … **Does not require approved**") predates R-CONC-02, which is now DONE and made `cancelApprovedRental`'s CAS `WHERE status = 'approved'` only — an admin no-show on an `active` or `completed` rental now correctly 409s instead of silently succeeding. The state-machine doc has not been updated to reflect this; this plan's transition table for the rental machine should encode the **current, fixed** behavior (no-show only from `approved`), and a maintenance note should flag the stale doc line rather than re-introducing the bug to match it.

**`src/features/disputes/lib/state-machine.ts`, current content** (the template to generalize):

```ts
const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["evidence_requested", "under_review", "resolved"],
  evidence_requested: ["under_review", "resolved"],
  under_review: ["resolved"],
  resolved: ["closed"],
  closed: [],
};
const ADMIN_ONLY_STATES = [
  "evidence_requested",
  "under_review",
  "resolved",
  "closed",
];
const FINAL_STATES = ["resolved", "closed"];
```

(After R-DB-04 lands, `resolved → closed` is actually reachable — see that
plan's Step 6. This plan builds on that fix, not around it.)

## Decisions for the maintainer

**1. The helper never throws — it returns the row or `null`.** Existing CAS
methods disagree on this today (some throw a bespoke `ConflictError` message,
some return `boolean`, `updateIfStatus` returns `T | null`). Standardizing on
"return `null`, caller decides whether/how to throw" matches the majority
pattern (`updateIfStatus`, `claimForProcessing`, `unfreezeAfterResolution`,
`updateDepositHoldStatus`) and preserves every call site's existing,
differentiated user-facing message — homogenizing those messages is not
required by any finding and would be a pure regression in UX specificity.
**Recommendation: adopt this.** Steps below assume it.

**2. Signature shape: close to the audit's `claimTransition(table, id, from[], to, extraSet?, extraWhere?)`, with two additions the audit's shorthand elides.** Drizzle has no generic way to `.set({[column]: value})` across an untyped `PgTable` without losing type safety on `.set()` itself — the payment-lifecycle-unification spike hit the identical wall ("generics over Drizzle table types add real type friction") and recommended avoiding a class hierarchy for exactly this reason. **Recommendation: the helper takes `idColumn`/`statusColumn` (the actual Drizzle column objects, for the WHERE clause, which stay fully typed) plus a `set` object the caller builds already including the new status value** (so `.set()` itself takes a plain object, typed by the caller's own literal, not by the generic). This trades a small amount of the audit's terse signature for keeping every `.update(...).set(...)` call's own type-check intact — no `as any` needed anywhere in this plan. See Step 1's exact code.

**3. `from` empty/omitted means unconditional — the same behavior as today's plain writes.** This lets every currently-unguarded method (`updateOwnerTransferStatus`, `markCancelled`, `updatePayoutStatus`, `disputeDAL.updateState`, `disputeDAL.resolve`, both `freezeForDispute`s) move onto the helper with **zero behavior change** as a first pass (Part D/E Step 1 of each), and a **second, explicit, reviewed step** adds a real `from` list where the machine's own transition table says one is warranted (Part D/E Step 2). Splitting "move onto the helper" from "add a guard that didn't exist before" keeps each commit's risk legible — a reviewer can accept the refactor and independently scrutinize the tightening.

**4. `approveRentalRequest`, `reserveDatesForApproval`, and the disputed-payout claim CAS added by R-CONC-04 are not migrated onto the helper.** They each combine the status flip with either a `db.transaction`-scoped insert, an advisory lock, or a correlated `NOT EXISTS` subquery keyed off a different table's rows — genuinely more than "one column's compare-and-swap." Forcing them through a single-purpose helper would either weaken the helper's signature for everyone else or produce a leaky abstraction. **Recommendation: leave these as their own methods**, but have them delegate their _status-column_ WHERE fragment to a small exported condition-builder the helper also uses internally (Step 1's `transitionWhere()`), so the "what counts as a valid `from`" logic still lives in one place even where the whole statement can't be genericized. Document this explicitly as a scope boundary, not a gap.

**5. CONC-09's fix needs one new enum value: `disputes.status` gains `"resolving"`.** The recommended fix (claim `open|evidence_requested|under_review → resolving` before any money operation, then `resolving → resolved` after) needs a transient state distinct from all four existing ones — reusing `under_review` would collide with its own deadline semantics, and there is no other unused value. This is the plan's only migration. Take the next free number after Phase 2's migrations (`DB-02`'s squash, plus `R-CONC-04`'s `reversed` and `R-BIZ-14`'s `partially_refunded` and `R-DB-04`'s two migrations) have landed — confirm via `ls src/db/migrations` at execution time, do not hard-code a number. Mobile risk: `hoador-mobile/src/api/contract/enums.ts`'s dispute-status schema is a `tolerantEnum` (confirmed pattern used throughout this audit's other enum additions) — a dispute briefly reporting an unrecognized status for the sub-second-to-few-second window a resolve request is in flight degrades to "unknown," not a parse failure. See Mobile compatibility.

## Commands

| Purpose                          | Command                                                                                                                            | Expected                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Typecheck                        | `bun run type-check`                                                                                                               | exit 0                                                  |
| Lint                             | `bun run lint`                                                                                                                     | exit 0                                                  |
| Generate migration (Part E only) | `bun run db:generate`                                                                                                              | one `ALTER TYPE "dispute_status" ADD VALUE 'resolving'` |
| Targeted unit/DAL tests          | `bun run test:run src/dal/__tests__ src/features/rentals/services/__tests__ src/features/services/__tests__ src/features/disputes` | all pass                                                |
| Real-DB tests                    | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                          | all pass, per-Part new files included                   |
| Full suite                       | `bun run test:run`                                                                                                                 | all pass                                                |

## Scope

**In scope**: new `src/dal/lib/claim-transition.ts`; new declarative
transition-table modules — `src/features/services/lib/service-booking-state-machine.ts`,
`src/features/rentals/lib/rental-request-state-machine.ts`,
`src/features/rentals/lib/payment-lifecycle-state-machine.ts` (shared shape,
used by both rental and service payment-lifecycle DALs), extending
`src/features/disputes/lib/state-machine.ts`; the CAS/plain-write methods
named in "Current state" across `rentals.dal.ts`, `service-booking.dal.ts`,
`payment-lifecycle.dal.ts`, `service-payment-lifecycle.dal.ts`, `dispute.dal.ts`;
`dispute-resolution-service.ts` (`resolveDispute`'s claim step);
`src/app/api/disputes/[id]/state/route.ts` (claim step); `_enums.ts` (+ one
migration, Part E only); tests for all of the above.

**Out of scope**: `approveRentalRequest`, `reserveDatesForApproval` (Decision
4); building a generic `PaymentLifecycleBaseDAL<TTable>` class hierarchy (left
to R-ARCH-08's judgment — this plan's transition-table module is a plain
object + functions, not a class, precisely so R-ARCH-08 can decide the DAL
class question separately); ARCH-02's response-DTO layer; any change to what
money moves or in what order — every Part preserves the exact sequence
"claim → side effect → finalize" each caller already has, only the claim's
implementation changes.

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### Part A — the shared helper (land first, used by nothing yet)

**Step A1**: Create `src/dal/lib/claim-transition.ts`:

```ts
import { and, eq, inArray, type AnyPgColumn, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Database } from "@/db"; // confirm the exported DB/transaction type name before writing this import

/**
 * Builds the WHERE fragment for a status compare-and-swap (ARCH-01). Exported
 * separately so callers that can't use `claimTransition` wholesale (a
 * transition combined with an insert, an advisory lock, or a correlated
 * subquery keyed off another table — see this plan's Decision 4) can still
 * share the "what counts as a valid `from`" logic.
 */
export function transitionWhere<TStatus extends string>(
  idColumn: AnyPgColumn,
  idValue: string,
  statusColumn: AnyPgColumn,
  from: TStatus | TStatus[] | undefined,
  extraWhere: SQL[] = [],
): SQL {
  const fromList =
    from === undefined ? undefined : Array.isArray(from) ? from : [from];
  return and(
    eq(idColumn, idValue),
    ...(fromList ? [inArray(statusColumn, fromList)] : []),
    ...extraWhere,
  )!;
}

export interface ClaimTransitionParams<
  TTable extends PgTable,
  TStatus extends string,
  TSet extends Record<string, unknown>,
> {
  table: TTable;
  idColumn: AnyPgColumn;
  idValue: string;
  statusColumn: AnyPgColumn;
  /** Omit for an unconditional write (matches today's plain-write methods —
   * see this plan's Decision 3). Provide to make the write a real CAS. */
  from?: TStatus | TStatus[];
  /** The full column set to write, including the new status value under its
   * own field — the caller's own object literal, so it's checked against
   * the table's real insert/update type at the call site, not lost to a
   * generic (Decision 2). Callers add `updatedAt: new Date()` themselves,
   * same as every existing DAL method — the helper doesn't inject it, so it
   * doesn't need to know the column's JS property name generically. */
  set: TSet;
  /** Additional AND-ed conditions — a frozen/dispute/payment-processing
   * guard, composed alongside the status check rather than baked into it. */
  extraWhere?: SQL[];
}

/**
 * One CAS UPDATE for a state-machine transition (ARCH-01). Returns the
 * updated row, or `null` if no row matched `idValue` AND (any `from` state)
 * AND every `extraWhere` condition — the caller decides whether a `null`
 * means "already gone" (404), "someone else claimed it" (409), or "frozen /
 * disputed" (409 with a different message). The helper never throws on a
 * lost claim; see this plan's Decision 1.
 */
export async function claimTransition<
  TTable extends PgTable,
  TStatus extends string,
  TSet extends Record<string, unknown>,
  TRow,
>(
  db: Database,
  params: ClaimTransitionParams<TTable, TStatus, TSet>,
): Promise<TRow | null> {
  const [row] = await db
    .update(params.table)
    .set(params.set)
    .where(
      transitionWhere(
        params.idColumn,
        params.idValue,
        params.statusColumn,
        params.from,
        params.extraWhere,
      ),
    )
    .returning();
  return (row as TRow) ?? null;
}
```

Confirm the exact exported name/path of the shared Drizzle database type
(`grep -n "^export" src/db/index.ts` or wherever DAL files import their `db`
type from — every DAL constructor already has this import; copy it exactly)
before finalizing the `Database` import above.

**Verify**: `bun run type-check` → exit 0. No caller yet — this step only adds
a new, unused file, so type-check passing confirms the generic signature
compiles against real Drizzle table/column types (write one throwaway call in
a scratch test against `rentalRequests`/`serviceBookings` to confirm inference
works, then delete the scratch file — do not leave dead code).

**Step A2 (test)**: New `src/dal/lib/__tests__/claim-transition.test.ts`: a
SQL-render test against a small fixture table (or `rentalRequests` directly
with a mocked `db`) — `from` omitted renders no status condition; `from` as a
scalar renders `inArray` with one element; `from` as an array renders all
elements; `extraWhere` conditions appear ANDed alongside the status check; a
`.returning()` empty array maps to `null`, non-empty maps to the row.

**Verify**: `bun run test:run src/dal/lib/__tests__/claim-transition.test.ts` → pass.

---

### Part B — service booking machine (lowest risk: already closest to the pattern)

**Step B1**: Create `src/features/services/lib/service-booking-state-machine.ts`,
transcribing `12-booking-state-machine.md` §3's table:

```ts
export const SERVICE_BOOKING_TRANSITIONS = {
  pending: ["accepted", "payment_failed", "declined", "cancelled"],
  payment_failed: ["accepted", "declined", "cancelled"],
  accepted: ["completed", "cancelled"],
  completed: [],
  declined: [],
  cancelled: [],
} as const satisfies Record<
  ServiceBooking["status"],
  readonly ServiceBooking["status"][]
>;
```

Add one test, `service-booking-state-machine.test.ts`, that walks
`SERVICE_BOOKING_TRANSITIONS` and asserts it matches `12-booking-state-machine.md`
§3's table exactly (a hand-written table in the test, compared key by key) —
this is the "checked against `12-booking-state-machine.md`" pin the audit
asked for, and it's the regression net if a future PR changes a transition
without updating this file.

**Verify**: `bun run type-check` → exit 0; new test passes.

**Step B2**: Rewrite `updateIfStatus` to delegate to `claimTransition`,
widening `expectedStatus` to accept an array (every current caller passes a
single value, so this is additive) and replacing the `blockWhilePaymentProcessing`
boolean with a pre-built `extraWhere` fragment:

```ts
async updateIfStatus(
  bookingId: string,
  expectedStatus: ServiceBooking["status"] | ServiceBooking["status"][],
  updates: Partial<Omit<ServiceBooking, "id" | "createdAt">>,
  opts: { blockWhilePaymentProcessing?: boolean; blockIfActiveDispute?: boolean } = {},
): Promise<ServiceBooking | null> {
  try {
    const extraWhere: SQL[] = [];
    if (opts.blockWhilePaymentProcessing) {
      extraWhere.push(or(isNull(serviceBookings.paymentStatus), ne(serviceBookings.paymentStatus, "processing"))!);
    }
    if (opts.blockIfActiveDispute) {
      extraWhere.push(/* the R-CONC-04 NOT EXISTS fragment — re-read that plan's landed Step 8 and reuse its exact SQL rather than re-deriving it */);
    }
    return await claimTransition<typeof serviceBookings, ServiceBooking["status"], typeof updates & { updatedAt: Date }, ServiceBooking>(
      this.db,
      {
        table: serviceBookings,
        idColumn: serviceBookings.id,
        idValue: bookingId,
        statusColumn: serviceBookings.status,
        from: expectedStatus,
        set: { ...updates, updatedAt: new Date() },
        extraWhere,
      },
    );
  } catch (error) {
    this.handleError(error, "ServiceBookingDAL.updateIfStatus");
  }
}
```

If R-CONC-04 has already added `blockIfActiveDispute` to `updateIfStatus`
directly (it lands first), **do not re-implement it** — just re-express its
existing `NOT EXISTS` fragment through `extraWhere` unchanged. Every current
call site (`declineBooking`, `cancelBooking`) passes a scalar `expectedStatus`
and compiles unchanged against the widened union type.

**Verify**: `bun run type-check` → exit 0. Existing `service-booking.dal.test.ts`
SQL-render assertions for `updateIfStatus` pass unmodified (same WHERE
clause, same shape) — if any assertion fails, the refactor changed behavior;
fix the refactor, not the test.

**Step B3**: Migrate `claimForAcceptance` and `markExpired` onto
`claimTransition` the same way — each keeps its own extra predicate
(active-requester `EXISTS`, payment-status allowlist) passed through
`extraWhere`, and each keeps its own return contract (`claimForAcceptance`
returns `boolean` today — wrap `claimTransition`'s row-or-null with `!== null`
to preserve the existing signature; do not change callers).

**Verify**: `bun run type-check` → exit 0; existing tests for both methods
pass unmodified.

**Step B4 (real-DB)**: Re-run the existing race-test files that already cover
this machine (`service-decline-accept-race.integration.test.ts` and friends —
`grep -rl "ServiceBookingDAL\|updateIfStatus" src/features/services/**/__tests__/*.integration.test.ts`)
without modification — they pin outcomes, not implementation, so they must
pass unchanged if the refactor is behavior-preserving.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration` → all pass, including the unmodified race tests.

---

### Part C — rental request machine

**Step C1**: Create `src/features/rentals/lib/rental-request-state-machine.ts`
transcribing `12-booking-state-machine.md` §1 (as **fixed** by R-BIZ-01/R-CONC-01/R-CONC-02,
not the pre-fix table — see "Current state"'s note on the stale doc line):

```ts
export const RENTAL_REQUEST_TRANSITIONS = {
  pending: ["approved", "denied", "cancelled"],
  approved: ["active", "cancelled"],
  active: ["completed"],
  completed: [],
  cancelled: [],
  denied: [],
  overdue: [], // enum-only, no writer (12-booking-state-machine.md)
} as const satisfies Record<
  RentalRequestStatus,
  readonly RentalRequestStatus[]
>;
```

Same transition-table test pattern as Step B1, comparing against
`12-booking-state-machine.md` §1, and flagging the doc's stale no-show note in
the test's own comment (not fixing the doc — out of scope, `10-remediation-roadmap.md`
governs plan docs, not audit docs).

**Verify**: `bun run type-check` → exit 0; new test passes.

**Step C2**: Migrate `declineRentalRequest`, `cancelRentalRequest`,
`markRequestExpired`, `startRental`, `endRental`, `cancelApprovedRental` onto
`claimTransition`, each keeping its existing `ConflictError` message and
existing extra predicates (`notPaymentProcessing`, R-CONC-04's dispute
`NOT EXISTS` on `cancelApprovedRental`) passed through `extraWhere`. Example
(`declineRentalRequest`):

```ts
async declineRentalRequest(requestId: string, denialReason: string): Promise<void> {
  // _ownerId param removed by R-ARCH-03 if that plan landed first — re-check
  // the live signature before editing.
  try {
    const updated = await claimTransition<typeof rentalRequests, RentalRequestStatus, ..., { id: string }>(this.db, {
      table: rentalRequests,
      idColumn: rentalRequests.id,
      idValue: requestId,
      statusColumn: rentalRequests.status,
      from: "pending",
      set: { status: "denied", deniedAt: new Date(), denialReason, updatedAt: new Date() },
      extraWhere: [notPaymentProcessing],
    });
    if (!updated) throw new ConflictError("Only pending requests that are not being approved can be declined");
  } catch (error) {
    this.handleError(error, "declineRentalRequest");
  }
}
```

`startRental`/`endRental` each keep their existing app-level pre-check (the
"friendlier" error message for the common case, e.g. "Only active rentals can
be ended") **before** the claim, and the claim's own `ConflictError(RENTAL_STATE_CHANGED_MESSAGE)`
stays as the race-losing case — both throws already exist today; only the
claim's implementation changes. Leave the two post-claim unguarded writes in
each (`rentals.actualStartDate`/`listings.status`) exactly as they are — they
already ride on the claim having just succeeded in the same call, and
wrapping them in a transaction is a separate, larger change (flag in
Maintenance notes, not required by ARCH-01's own recommended fix, which asks
for transactions on "multi-row finalizations," i.e. approve, not start/end).

**Verify**: `bun run type-check` → exit 0; every existing test for these six
methods (`rentals.dal.test.ts`) passes unmodified — same rendered WHERE, same
thrown message.

**Step C3 (real-DB)**: Re-run existing rental race tests unmodified
(`grep -rl "rentalDAL\|RentalDAL" src/features/rentals/**/__tests__/*.integration.test.ts`).

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration` → all pass, unmodified.

**Step C4 (BIZ-12, ARCH-01's recommended-fix item 3 — the one genuine behavior
addition in this Part)**: `approveRentalRequest`'s existing `db.transaction`
(Decision 4 — not migrated onto `claimTransition`) currently wraps only the
request-status CAS plus the `rentals` row insert. The payment row and
lifecycle row inserts happen afterward, outside that transaction, in
`RentalService.approveRentalRequest` (`rental-service.ts`) — a crash between
the DB transaction committing and those two inserts landing leaves an
`approved` request with no lifecycle row (BIZ-12's drift, still open).
**Extend the transaction** to also perform the payment-row and lifecycle-row
inserts, by moving those two `paymentDAL.create`/`paymentLifecycleDAL.create`
calls' SQL into the same `tx` the request/rentals insert already uses — this
requires threading the transaction handle through `PaymentDAL`/`PaymentLifecycleDAL`
(check whether they already accept an optional `tx` parameter on `create`; if
not, add one following whatever pattern `user.dal.ts`'s transactional methods
use, since that's the one other place in this codebase already does this).
The existing hourly `detect-stale-charge-claims` cron remains the backstop for
the (now much narrower) window between the transaction committing and the
Stripe charge/hold calls that still happen outside it — this step only closes
the "committed request row, no committed lifecycle row" gap, not the
Stripe-call ordering, which is unrelated to this plan.

**Verify**: `bun run type-check` → exit 0. Extend
`rental-service.approve.test.ts`: a mocked lifecycle-row insert failure after
the transaction's own inserts have run rolls back the request/rentals rows
too (assert via the mock's transaction-scoped call, or, if the unit-test mock
can't express transactional rollback, add this as a real-DB test instead —
seed a lifecycle-insert failure via a broken FK and assert the request row
was never left `approved`).

---

### Part D — payment lifecycle machines (rental + service)

**Step D1**: Create `src/features/rentals/lib/payment-lifecycle-state-machine.ts`
with three small tables — `DEPOSIT_HOLD_TRANSITIONS`, `OWNER_TRANSFER_TRANSITIONS`,
`PAYOUT_STATUS_TRANSITIONS` — transcribing `12-booking-state-machine.md` §2's
three sub-tables **as fixed by R-CONC-04** (`reversed` added to
`OWNER_TRANSFER_TRANSITIONS`'s reachable set from `completed`) and **R-PERF-05**
(`placing` already in `DEPOSIT_HOLD_TRANSITIONS`). Re-derive the exact
post-Phase-2 shape from live code (`_enums.ts`) rather than copying the
pre-Phase-2 doc. Export the same shape for the service twin
(`SERVICE_OWNER_TRANSFER_TRANSITIONS`, `SERVICE_PAYOUT_STATUS_TRANSITIONS`) —
no deposit table, services have none.

**Verify**: `bun run type-check` → exit 0; a transition-table test per table,
same pattern as Parts B/C.

**Step D2 (behavior-preserving refactor only)**: Migrate `claimForProcessing`,
`unfreezeAfterResolution`, `updateDepositHoldStatus` (rental) and their
service twins onto `claimTransition`, preserving R-CONC-04's exact `extraWhere`
predicates (the `notExists` dispute subquery, the `ne(ownerTransferStatus, "frozen")`
guard) unchanged — re-express, don't re-derive. `updateDepositHoldStatus`'s
existing `fromStatus: T | T[]` parameter maps directly onto `claimTransition`'s
`from`.

**Verify**: `bun run type-check` → exit 0; every existing SQL-render/DAL test
for these four methods (×2 files) passes unmodified.

**Step D3 (the tightening — new guards on previously-unguarded writes)**:
`updateOwnerTransferStatus`, `markCancelled`, `updatePayoutStatus` (×2 DALs)
are plain unconditional writes today (R-CONC-04 already guards
`updateOwnerTransferStatus`'s `"completed"` branch specifically — re-read its
landed diff first and don't duplicate that guard). For the remaining
unconditional paths, add a `from` list **only where `PAYOUT_STATUS_TRANSITIONS`/`OWNER_TRANSFER_TRANSITIONS`
says the write's target status has a defined predecessor set** (e.g.
`markCancelled`'s `payoutStatus: "completed"` sentinel is documented as the
`pending → completed` "skip" transition in `12-booking-state-machine.md` §2c —
guard it `from: "pending"`). **Before adding any such guard, grep every call
site of the method being tightened** (`grep -rn "\.markCancelled(\|\.updatePayoutStatus(" src`)
and confirm none of them legitimately calls it from a state the new guard
would now reject — if one does, that call site has a real, previously-latent
bug (a plain write silently no-oping is different from a guarded write now
throwing/returning null where the caller doesn't check) and needs its own
fix as part of this step, not a workaround that loosens the guard back to
unconditional.

**Verify**: `bun run type-check` → exit 0. New tests: each tightened method
called from an out-of-table state returns `null` (or throws, matching
Decision 1's contract) instead of silently succeeding — this is a genuine new
behavior, so it needs its own new test, not just an unmodified old one.

**Step D4 (real-DB)**: Re-run existing payout/freeze race tests unmodified,
plus one new test per tightened method from Step D3 forcing the previously-silent
wrong-state write and asserting it's now rejected.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration` → all pass.

---

### Part E — dispute machine (fixes CONC-09)

**Step E1**: Add `"resolving"` to `disputeStatusEnum` in `_enums.ts`
(Decision 5):

```ts
export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "evidence_requested",
  "under_review",
  "resolving", // Claimed for resolution; money ops in flight (CONC-09).
  "resolved",
  "closed",
]);
```

Run `bun run db:generate` (a plain enum addition — do not use `--custom`).

**Verify**: `bun run type-check` → exit 0; generated SQL is exactly one
`ALTER TYPE ... ADD VALUE`.

**Step E2**: Extend `state-machine.ts`'s `VALID_TRANSITIONS` (this is now the
plan's canonical transition table for this machine — no separate module
needed, unlike Parts B–D, since one already existed):

```ts
const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["evidence_requested", "under_review", "resolving"],
  evidence_requested: ["under_review", "resolving"],
  under_review: ["resolving"],
  resolving: ["resolved"],
  resolved: ["closed"],
  closed: [],
};
```

`resolved` no longer reachable directly from `open`/`evidence_requested`/`under_review`
in this table — it's now reached only via the internal `resolving` claim, never
via the admin PATCH route (`updateStateSchema` already excludes both `resolving`
and `resolved` from `newState` — confirmed current schema is
`z.enum(["open","evidence_requested","under_review","closed"])`; no route
change needed here). `ADMIN_ONLY_STATES`/`FINAL_STATES` are unaffected —
`resolving` is neither.

**Verify**: `bun run type-check` → exit 0. Update `state-machine.test.ts`'s
full-cross-product transition-table test (added by R-DB-04, if landed —
re-read and extend rather than duplicate) to include `resolving` as a valid
intermediate state and confirm `open/evidence_requested/under_review → resolved`
directly is now **invalid** per `canTransition` (this is intentional — it was
never valid via the admin route anyway, since `resolve()` is the only writer
of `"resolved"`, but pin it explicitly now that the table says so).

**Step E3**: Give `dispute.dal.ts` a claim method and make `resolve` CAS from
`resolving`:

```ts
async claimForResolution(id: string): Promise<Dispute | null> {
  try {
    return await claimTransition<typeof disputes, DisputeStatus, { status: "resolving"; updatedAt: Date }, Dispute>(
      this.db,
      {
        table: disputes,
        idColumn: disputes.id,
        idValue: id,
        statusColumn: disputes.status,
        from: ["open", "evidence_requested", "under_review"],
        set: { status: "resolving", updatedAt: new Date() },
      },
    );
  } catch (error) {
    this.handleError(error, "claimForResolution");
  }
}
```

Change `resolve` (:948-984) to require the row be `resolving`:

```ts
async resolve(id, resolvedBy, outcome, reason): Promise<Dispute> {
  try {
    const resolved = await claimTransition<typeof disputes, DisputeStatus, ..., Dispute>(this.db, {
      table: disputes,
      idColumn: disputes.id,
      idValue: id,
      statusColumn: disputes.status,
      from: "resolving",
      set: { status: "resolved", resolvedAt: new Date(), resolvedBy, resolutionOutcome: outcome, resolutionReason: reason, updatedAt: new Date() },
    });
    if (!resolved) throw new NotFoundError("Dispute", id);
  } catch (error) {
    this.handleError(error, "resolve");
  }
}
```

`resolve`'s pre-existing contract (throws `NotFoundError` on a miss) is
preserved, but the miss now also covers "someone else already resolved this
concurrently" as well as "id doesn't exist" — both 404 today, which is not
quite right for the former (it's really a 409, someone else won the race);
leave the existing `NotFoundError` mapping in place for this plan (changing
it to `ConflictError` when the row exists-but-wrong-state vs. doesn't-exist
is a real distinction, but `resolve`'s only callers already handle both
outcomes identically by surfacing `handleApiError`'s mapping to the admin, so
this is a Maintenance-notes-worthy nuance, not a required fix here).

**Verify**: `bun run type-check` → exit 0.

**Step E4**: Wire the claim into `resolveDispute` (`dispute-resolution-service.ts`),
right after the existing status pre-check (~line 107), **before** any deposit
capture/release or Stripe refund call:

```ts
const claimed = await disputeDAL.claimForResolution(disputeId);
if (!claimed) {
  throw new ConflictError(
    "This dispute is already being resolved or was just resolved — refresh and try again.",
  );
}
```

Every money operation between this point and the existing `disputeDAL.resolve(...)`
call (both branches, rental ~line 214 and service ~line 403) is unchanged —
only the claim is new. If a money operation throws after the claim succeeds,
the dispute is now stuck in `resolving` rather than its prior state — this is
the same "processing" trap every other claimed-then-failed money transition
in this codebase already has (rental/service payment claims, payout claims),
so it inherits the same safety net: **add `resolving` to whatever stale-claim
detection already covers dispute status** (check
`stale-processing-detection-service.ts` — if it doesn't currently watch
disputes at all, this is a new, small addition: a dispute stuck `resolving`
for more than 15 minutes is exactly as actionable as a stuck `processing`
rental/booking, and re-uses that service's existing alert shape).

**Verify**: `bun run type-check` → exit 0. Extend
`dispute-resolution-service.test.ts`: a mocked `claimForResolution` returning
`null` → no money operation is called (deposit capture/release, Stripe
refund), `disputeDAL.resolve` is never called, `ConflictError` is thrown.

**Step E5**: Wire the same claim pattern into the PATCH `/state` route for
non-resolve transitions, deriving the allowed `from` set from
`VALID_TRANSITIONS` itself rather than hardcoding it a second time:

```ts
function validFromStates(to: DisputeStatus): DisputeStatus[] {
  return (Object.keys(VALID_TRANSITIONS) as DisputeStatus[]).filter((from) =>
    VALID_TRANSITIONS[from].includes(to),
  );
}
```

In `dispute.dal.ts`'s `updateState`, replace the plain write with a
`claimTransition` guarded by `from: validFromStates(newState)` (imported from
`state-machine.ts`), returning `null` on a lost race instead of silently
overwriting a concurrent transition — this is CONC-09's second half ("dispute
resolve/**state changes** have no atomic claim"). The route's existing
`DisputeStateMachine.validateTransition` app-level check stays as the
friendlier pre-check (better error message: "Invalid transition from X to
Y"); the DAL-level claim is the actual guard against a second admin's
concurrent PATCH.

**Verify**: `bun run type-check` → exit 0. Extend the route test: two
concurrent PATCH calls to different `newState` values from the same starting
status → one succeeds, the other gets the DAL's `null` mapped to a 409 (add
this mapping in the route's catch if `updateState` doesn't already throw on
`null` — decide per Decision 1: since every other machine's convention here
is "return null, caller decides," have `updateState` throw `ConflictError`
itself, since it has exactly one caller and that caller has no other
information to add).

**Step E6 (real-DB, required — this is the money-race CONC-09 exists to
close)**: New file
`src/features/disputes/services/__tests__/concurrent-resolve.integration.test.ts`:
seed an `open` dispute with a `held` rental deposit; fire two concurrent
`DisputeResolutionService.resolveDispute` calls with different outcomes
(`favor_provider` vs `favor_renter`) using `raceTwo`; assert exactly one
claims (`claimForResolution` succeeds once), exactly one deposit
operation runs (capture XOR release, never both), and the loser gets the new
`ConflictError`, never reaching `disputeDAL.resolve`.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration` → all pass, new file included.

## Test plan

Each Part's own Verify lines are the test plan — a transition-table
consistency test per machine (Parts B–E), unmodified regression on every
behavior-preserving refactor (Parts B2-3, C2, D2), new tests only where a
Part deliberately tightens a previously-unguarded write (C4, D3, E3-5), and
one real-DB race test per Part that touches a claim (B4, C3, D4, E6). Full
regression: `bun run test:run` after every Part; full real-DB suite after
Part E.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0 (after every Part)
- [ ] `bun run test:run` → exit 0 (after every Part)
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0 (after every Part)
- [ ] Every transition-table test (Parts B–E) passes and matches
      `12-booking-state-machine.md`'s post-Phase-2 semantics (noting the one
      stale doc line called out in "Current state")
- [ ] `grep -rn "claimTransition(" src/dal | wc -l` shows at least one call
      per machine (rentals, service-booking, both payment-lifecycle DALs,
      dispute)
- [ ] Migration generated (one `ADD VALUE 'resolving'`), applied to local +
      confirmed on dev/staging per Production cutover
- [ ] A concurrent dispute resolve test proves exactly one claim wins and
      exactly one deposit/refund operation runs (Step E6)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 3 outline's first item, and its own Execution-order row)

## STOP conditions

- Any "Current state" excerpt doesn't match live code beyond what R-CONC-04/R-BIZ-14/R-DB-04
  (and R-ARCH-03, if it landed first) explain — re-read the live file before
  continuing.
- A transition-table test (Part B–E) fails to match `12-booking-state-machine.md` —
  stop and decide whether the doc or the code is wrong before encoding either
  into the table; do not silently pick one.
- Step C4's transactional extension can't be made to work without changing
  `PaymentDAL`/`PaymentLifecycleDAL`'s public `create` signatures in a way
  that breaks other callers — report the actual blocker rather than forcing
  it; BIZ-12 already has a cron backstop, so this step can be deferred to a
  follow-up if it turns out to need a larger refactor than expected.
- Step D3's tightening reveals a call site that depends on today's silent
  no-op — fix that call site's own bug as part of this step (see Step D3),
  don't loosen the new guard to avoid touching it.
- `bun run db:generate` (Part E) produces anything beyond the single
  `ADD VALUE` statement.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

- **New transient `disputes.status: "resolving"`** can appear in
  `GET /api/disputes/[id]` for the sub-second-to-few-second window a resolve
  request is in flight (Part E). Mobile's dispute-status schema is a
  `tolerantEnum` — this degrades to "unknown," not a parse failure, and is
  vanishingly unlikely to be observed by a poll (resolve is a single
  synchronous admin request, not a long-running job). Add this row to the
  roadmap's Mobile client follow-ups table:

| Fix                 | Contract change                                                                   | Where the app sees it                                     | Mobile task | Status                                                                      |
| ------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| R-ARCH-01 (CONC-09) | new transient `disputes.status: "resolving"` (claimed for resolution, sub-second) | dispute detail, if polled during an admin's resolve click | —           | TODO (optional: no action needed — tolerant enum, effectively unobservable) |

- Every other change in this plan is an internal refactor of DAL
  implementations behind unchanged public method contracts and unchanged
  HTTP response shapes — no other wire change.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-ARCH-01 — apply migration 00NN (dispute_status: resolving)` |
  From: R-ARCH-01 | dev: TODO | staging: TODO | prod: TODO. Apply via the
  repo's standard migration step against both `.env.local` hosts
  (`ep-lucky-block` dev, `ep-polished-tree` staging — check host before
  running). No backfill — new enum value only.

## Maintenance notes

- `approveRentalRequest`, `reserveDatesForApproval`, and R-CONC-04's payout
  claim CAS remain hand-written (Decision 4) — if a future refactor wants to
  fold these in too, extend `claimTransition` to accept an optional
  `insideTransaction: TxHandle` and an optional list of side-effect inserts,
  but that's a materially different (and riskier) helper shape than this
  plan builds; don't bolt it on casually.
- Step C4's transaction extension narrows but doesn't eliminate BIZ-12 — a
  crash between the transaction committing and the Stripe charge call
  (outside the transaction, necessarily — Stripe isn't transactional with
  Postgres) still needs the stale-claim detector. That detector is
  unaffected by this plan.
- `resolve`'s `NotFoundError`-on-lost-claim nuance (Step E3) is a known,
  minor status-code imprecision, not fixed here — revisit if it ever causes
  real admin confusion.
- Once R-ARCH-02 (response-DTO layer, not this plan) lands, re-check whether
  any of the new `claimTransition`-returned rows are ever spread directly
  into a response — they shouldn't be (that's ARCH-02's job to prevent going
  forward), but this plan doesn't audit for it.
- R-ARCH-08 depends on this plan specifically for its "unify the code paths,
  not the tables" recommendation — Parts D's `claimTransition` calls in both
  payment-lifecycle DALs are the shared code path R-ARCH-08 points to instead
  of building a generic base-DAL class. Read this plan's Part D diff before
  starting R-ARCH-08.
