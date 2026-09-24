# R-CONC-01: Prevent overlapping rental approvals

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/rentals/services/rental-quote.ts src/dal/rentals.dal.ts src/features/rentals/services/rental-service.ts src/db/schemas/rentals.schema.ts`
> Also confirm `plans/backend-audit/remediations/R-BIZ-01-approve-only-pending-requests.md`
> is DONE (its claim + transaction shape are load-bearing here). A mismatch
> in either check is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED (adds a migration + a lock)
- **Depends on**: `R-BIZ-01-approve-only-pending-requests.md` (must land first
  — this plan extends its claim step and its DAL transaction)
- **Category**: bug (money) · **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

Availability is checked only once, at request creation, against `approved`
and `active` requests. Pending requests never block each other, and approve
never re-checks. An owner can approve two overlapping requests for the same
dates in the ordinary course of business — no concurrency needed — charging
two renters for one item. There is no DB constraint behind any of this.
Audit finding CONC-01 (HIGH), related to BIZ-01.

## Current state

- `rental-quote.ts:101-158` `quoteRentalRequest` wraps
  `rentalDAL.getBookedDatesForListing` in `tryCatch`; on failure `blocked` is
  `undefined`, so `conflict = blocked ? findConflict(...) : null` → `null`.
  **A failed read is treated as "no conflict" (fails open).**
- `rentals.dal.ts:2662-2731` `getBookedDatesForListing` only queries
  `status IN ('approved','active')` (line 2686); ignores `overdue` and any
  `paymentStatus='processing'` claim.
- `rental-quote.ts` already declares `"DATES_UNAVAILABLE"` as a
  `QuoteBlockerCode` (line 46), used at create/preview time (150-157) — reuse
  it at approve time so mobile needs no new branch, only a new call site.
- `rentals.schema.ts:29-39,81` `rentalRequests`: `listingId: uuid` (30-32),
  `startDate`/`endDate: timestamp` (39-40, **not** `date`), `status:
rentalStatusEnum` (81; `approved`/`active`/`overdue` confirmed valid via
  `BLOCKING_RENTAL_STATUSES`, `account-deletion.dal.ts:31-35`).
- After `R-BIZ-01`: the claim requires `status='pending'` before charging,
  and DAL `approveRentalRequest` runs in one transaction, CAS
  `status='pending' AND payment_status='processing' → 'approved'`, then
  inserts into `rentals`.

```ts
// rental-quote.ts:101-106 — fails open today
const { data: blocked } = await tryCatch(
  (async () => rentalDAL.getBookedDatesForListing(input.listingId))(),
);
const bookedRanges = toBookedRanges(blocked ?? []);
```

**Conventions**: mirror R-BIZ-01's transaction/CAS shape and its
`errors.ts`/`handleApiError` pattern. **SEC-16**: drizzle 0.45 wraps driver
errors in `DrizzleQueryError`; the pg code is on `.cause`. Map exclusion
violations as `((error as {cause?:{code?:string}}).cause ?? error).code === "23P01"`.

## Commands

| Purpose            | Command                                                                       | Expected                                                                     |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Typecheck          | `bun run type-check`                                                          | exit 0                                                                       |
| Lint               | `bun run lint`                                                                | exit 0                                                                       |
| Generate migration | `bun run db:generate --custom --name=rental_requests_no_overlap`              | scaffolds an empty numbered SQL file — **review before running it anywhere** |
| Local DB           | `docker compose up -d`                                                        | postgres healthy on 5432                                                     |
| Tests              | `bun run test:run src/dal/__tests__/rentals.dal.test.ts src/features/rentals` | all pass                                                                     |

## Scope

**In scope**: `src/features/rentals/services/rental-quote.ts`,
`src/dal/rentals.dal.ts` (new re-check method, `approveRentalRequest`'s
transaction from R-BIZ-01), `src/features/rentals/services/rental-service.ts`
(insert the re-check call), `src/dal/errors.ts`, `src/lib/api/route-helpers.ts`,
one new migration file, its tests.

**Out of scope**: rewriting `getBookedDatesForListing`'s two-source shape
(rentals + manual blocks); any change to `listingAvailability`; BIZ-01's
already-landed claim/transaction code beyond the additions below.

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Pre-check for existing overlaps (run, do not skip)

Against a real DB with production-shaped data (or the local/e2e DB after
seeding), run:

```sql
SELECT a.id, b.id FROM rental_requests a JOIN rental_requests b
  ON a.listing_id = b.listing_id AND a.id < b.id
  AND a.status IN ('approved','active','overdue')
  AND b.status IN ('approved','active','overdue')
  AND tsrange(a.start_date, a.end_date + interval '1 day') &&
      tsrange(b.start_date, b.end_date + interval '1 day');
```

**STOP condition**: if this returns any rows, the exclusion constraint
(Step 3) cannot be added until those rows are resolved (cancel/reschedule
one side) — report the rows and stop; do not weaken the constraint's WHERE
to work around existing bad data.

### Step 2: Add `RentalDatesUnavailableError` and its response branch

`src/dal/errors.ts`, next to `RentalRequestNotPendingError` (from R-BIZ-01):

```ts
export class RentalDatesUnavailableError extends DALError {
  constructor(
    message = "Those dates are no longer available for this listing.",
  ) {
    super(message, "DATES_UNAVAILABLE", 409);
    this.name = "RentalDatesUnavailableError";
  }
}
```

Add its `handleApiError` branch the same way as R-BIZ-01 Step 1, before the
generic `ConflictError` branch. **Verify**: `bun run type-check` → exit 0.

### Step 3: Backing exclusion constraint (migration)

Run the generate command from **Commands**, then write into the scaffolded
file:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE rental_requests ADD CONSTRAINT rental_requests_no_overlap
  EXCLUDE USING gist (listing_id WITH =, tsrange(start_date, end_date + interval '1 day') WITH &&)
  WHERE (status IN ('approved','active','overdue'));
```

Column types were confirmed above — `listing_id` is `uuid`, `start_date`/
`end_date` are `timestamp`, matching `tsrange`. This constraint cannot be
expressed in the Drizzle TS schema; it lives only in this SQL file.
**Verify**: apply to the local DB (`docker compose up -d`, then `bun run
db:migrate` against `DATABASE_URL` from `.env.local`); confirm `\d
rental_requests` in `psql` shows the constraint.

### Step 4: Re-check conflicts inside the claim step, before the charge

In `rentals.dal.ts`, add a method used only by approve:

```ts
async reserveDatesForApproval(
  requestId: string, listingId: string, startDate: Date, endDate: Date, priorPaymentStatus: "pending" | "failed",
): Promise<{ ok: boolean }> {
  return await this.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${listingId}::text))`);
    const conflicts = await tx.select({ id: rentalRequests.id }).from(rentalRequests).where(and(
      eq(rentalRequests.listingId, listingId), ne(rentalRequests.id, requestId),
      or(inArray(rentalRequests.status, ["approved", "active", "overdue"]), eq(rentalRequests.paymentStatus, "processing")),
      sql`tsrange(${rentalRequests.startDate}, ${rentalRequests.endDate} + interval '1 day') && tsrange(${startDate}::timestamp, ${endDate}::timestamp + interval '1 day')`,
    ));
    if (conflicts.length > 0) {
      // Release the claim in-tx (do NOT throw here — a throw rolls the release back too).
      await tx.update(rentalRequests).set({ paymentStatus: priorPaymentStatus, updatedAt: new Date() }).where(eq(rentalRequests.id, requestId));
      return { ok: false };
    }
    return { ok: true };
  });
}
```

Caller throws on the returned sentinel. In `rental-service.ts`, immediately
after R-BIZ-01's claim succeeds (its Step 3) and before the charge:

```ts
const reserved = await rentalDAL.reserveDatesForApproval(
  rentalId,
  rentalRequest.listingId,
  rentalRequest.startDate,
  rentalRequest.endDate,
  isRetryAfterFailure ? "failed" : "pending",
);
if (!reserved.ok) {
  const { RentalDatesUnavailableError } = await import("@/dal/errors");
  throw new RentalDatesUnavailableError();
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 5: Catch the exclusion violation as a backstop

Wrap the DAL `approveRentalRequest` transaction's (R-BIZ-01 Step 5) call so
that a rejection with `(error.cause ?? error).code === "23P01"` throws
`RentalDatesUnavailableError` instead of the generic DB error — this covers
the residual window between Step 4's lock release (tx commit) and the
post-charge approve transaction. **Verify**: `bun run type-check` → exit 0.

### Step 6: Fail closed at create/preview time

In `rental-quote.ts`, when the `tryCatch` around `getBookedDatesForListing`
errors, push a `DATES_UNAVAILABLE` blocker instead of treating it as "no
conflict" (`blockers.push({code:"DATES_UNAVAILABLE", message:"We couldn't
verify availability for these dates — please try again."})`). Locate the
existing test pinning today's fail-open behavior
(`grep -rn "getBookedDatesForListing" src/features/rentals --include="*.test.ts"`)
and invert it to expect this blocker on a read error. **Verify**: `bun run
test:run src/features/rentals` → that test passes against the new behavior.

## Test plan

- **DAL**: `renderWhere`-style assertion that the re-check query covers
  `status IN (approved,active,overdue)` OR `payment_status='processing'`,
  scoped by `listing_id`. Unit test for `reserveDatesForApproval` returning
  `{ok:false}` and releasing `paymentStatus` on a mocked conflict row.
- **Service**: approve on dates overlapping an existing `approved` request →
  `RentalDatesUnavailableError`, charge mock NOT called.
- **Real-DB** (needs `R-TEST-HARNESS`): two pending requests, overlapping
  dates, same listing; approve both sequentially — second rejected before
  any charge. Concurrent variant: exactly one charge happens.

**Verify**: `bun run test:run src/dal/__tests__/rentals.dal.test.ts src/features/rentals` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including new cases above
- [ ] Migration file exists, applies cleanly to a local DB, and `\d
rental_requests` shows `rental_requests_no_overlap`
- [ ] The fail-open test is inverted and passes
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Step 1's pre-check returns existing overlap rows.
- Live code doesn't match "Current state" (drift since `21bdc61`), or
  `R-BIZ-01` is not DONE.
- `drizzle-kit push`, if used anywhere in the dev loop, proposes _dropping_
  `rental_requests_no_overlap` because it's absent from the TS schema —
  report; do not let push run unattended against a shared DB.
- The exclusion constraint rejects a legitimate same-day back-to-back
  booking (checkout day == next checkin day): the range is
  `[start, end+1day)`; verify this against `findConflict`'s inclusive-both-
  ends semantics (`availability.ts:88-99`) before assuming they agree, and
  report a mismatch rather than adjusting the constraint ad hoc.

## Mobile compatibility

`DATES_UNAVAILABLE` is **not a new code** — it already exists as a
`QuoteBlockerCode` the create/preview flow returns today (`rental-quote.ts:46`).
This plan makes `POST /api/rentals/[id]/approve` able to **throw** it too, as
409 `{"error": "...", "code": "DATES_UNAVAILABLE"}` (falls through the
approve route's manual chain to `handleApiError`, like R-BIZ-01's error). If
the app already branches on this code from booking creation, no new client
handling should be needed — confirm before assuming a UI gap. The 23P01
backstop (Step 5) surfaces identically.

## Maintenance notes

- If `R-BIZ-05` (dispute-resolution payout-cron edits, not authored here)
  lands later and touches the same `rentals.dal.ts` transaction helpers,
  re-run this plan's tests.
- The advisory lock key `hashtext(listing_id::text)` is a 32-bit hash;
  distinct listings can theoretically collide and serialize unnecessarily —
  accepted as harmless (a brief false wait, not a correctness issue).
