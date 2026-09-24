# R-BIZ-01: Approve only charges pending rental requests

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition,
> stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/rentals/services/rental-service.ts src/dal/rentals.dal.ts src/dal/errors.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED
- **Depends on**: none · **Category**: bug (money)
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`RentalService.approveRentalRequest` never checks that a rental request is
still `pending` before charging the renter. Cancel, decline and expiry never
touch `paymentStatus` (default `'pending'`), so a cancelled/declined/expired
request can still win the payment claim and be charged — **no concurrency
needed**; a stale owner screen triggers it. The DAL's own status check runs
only after the Stripe charge and deposit hold. Result: renter charged, no
rental created, manual refund, chargeback exposure. Audit finding BIZ-01
(HIGH), gap TEST-01.

## Current state

- `rental-service.ts:376-799` `approveRentalRequest` — checks only `ownerId`
  (389-393); no `status` check anywhere before the charge (476-489).
- `rentals.dal.ts:1884-1902` `claimRentalRequestPaymentProcessing` — claims
  on `paymentStatus IN ('pending','failed')` only, no `status` predicate.
- `rentals.dal.ts:1957-2021` `approveRentalRequest` (DAL) — checks
  `status !== 'pending'` at line 1980, but this runs from
  `rental-service.ts:675`, **after** the charge; not a transaction (status
  UPDATE at 1985-1998, separate `rentals` INSERT at 2001-2017).
- `rentals.dal.ts:1808-1847` `cancelRentalRequest` and `:2045-2079`
  `declineRentalRequest` — read-then-write, check only `status`, never touch
  `paymentStatus`.
- `rentals.dal.ts:1780-1802` `markRequestExpired` — **already safe** (its
  WHERE includes the module-level `notPaymentProcessing`, defined 478-485:
  `or(isNull(paymentStatus), ne(paymentStatus,'processing'))`). Do not touch.
- `rentals.dal.ts:2632-2660` `countInFlightRentalsForListing` — counts
  `status IN ('approved','active','overdue')` and `status='pending'`; ignores
  `paymentStatus`. Backs `listing-service.ts:346-375` `deleteListing`'s guard.

```ts
// rentals.dal.ts:1888-1897 — claim has no status predicate
.where(and(
  eq(rentalRequests.id, requestId),
  inArray(rentalRequests.paymentStatus, ["pending", "failed"]),
))
```

**Conventions:** CAS mirrors `ServiceBookingDAL.updateIfStatus`
(`service-booking.dal.ts:175-203`). A new error needing a machine-readable
`code` mirrors `ConversationArchivedError` (`errors.ts:65-72`) plus its own
`handleApiError` branch (`route-helpers.ts:118-123`), placed **before** the
generic `ConflictError` branch (line 132), which returns `{error: message}`
only. Transactions: `this.db.transaction(async (tx) => {...})`, example
`AccountDeletionDAL.anonymizeUser` (`account-deletion.dal.ts:274-358`).
**SEC-16**: drizzle 0.45 wraps driver errors in `DrizzleQueryError` (pg code
on `.cause`); this plan throws its own typed errors, not a caught pg error
code, so it is unaffected.

## Commands

| Purpose        | Command                                                                       | Expected |
| -------------- | ----------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                          | exit 0   |
| Lint           | `bun run lint`                                                                | exit 0   |
| Targeted tests | `bun run test:run src/dal/__tests__/rentals.dal.test.ts src/features/rentals` | all pass |
| Full tests     | `bun run test:run`                                                            | all pass |

## Scope

**In scope**: `src/dal/errors.ts`, `src/lib/api/route-helpers.ts`,
`src/dal/rentals.dal.ts` (claim, cancel, decline, approve,
countInFlightRentalsForListing), `rental-service.ts` (`approveRentalRequest`
top-of-function only), the DAL and service tests for these.

**Out of scope**: `markRequestExpired` (already safe — do not touch); deposit
scheduling/retry; payout crons; CONC-01's overlap re-check and CONC-02's
cancel-claim-first (separate plans — this plan only closes the `pending`
gate); the real-Postgres concurrency test (depends on `R-TEST-HARNESS`).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Add `RentalRequestNotPendingError`

`src/dal/errors.ts`, near `ConversationArchivedError`:

```ts
export class RentalRequestNotPendingError extends DALError {
  constructor(
    message = "This rental request is no longer pending and cannot be approved.",
  ) {
    super(message, "REQUEST_NOT_PENDING", 409);
    this.name = "RentalRequestNotPendingError";
  }
}
```

In `route-helpers.ts`, import it and add a branch before the generic
`ConflictError` branch (~line 132): `{error: error.message, code: error.code}`,
status `error.statusCode`. **Verify**: `bun run type-check` → exit 0.

### Step 2: Reject non-pending requests before any Stripe call

In `rental-service.ts`, right after the `ownerId` check (after line 393,
before the `stripeCustomerId` lookup at 396 — that call reaches Stripe):

```ts
if (rentalRequest.status !== "pending") {
  const { RentalRequestNotPendingError } = await import("@/dal/errors");
  throw new RentalRequestNotPendingError();
}
```

(Matches this file's existing lazy-import style for `@/dal/errors`.)
**Verify**: `grep -n "RentalRequestNotPendingError" src/features/rentals/services/rental-service.ts` → 1 hit; `bun run type-check` → exit 0.

### Step 3: Add the status predicate to the claim

Add `eq(rentalRequests.status, "pending")` to `claimRentalRequestPaymentProcessing`'s
`and(...)`, alongside the existing `inArray(paymentStatus,...)`.
**Verify**: `bun run type-check` → exit 0.

### Step 4: CAS `cancelRentalRequest` and `declineRentalRequest`

Rewrite both as one conditional UPDATE `.returning()`, reusing the existing
`notPaymentProcessing` constant (line 478):

```ts
.where(and(
  eq(rentalRequests.id, requestId),
  eq(rentalRequests.status, "pending"),
  notPaymentProcessing,
))
.returning({ id: rentalRequests.id });
// if result.length === 0: throw new ConflictError("...")
```

Keep each function's existing select-then-404 pre-check; only the mutating
UPDATE needs the CAS. **Verify**: `bun run type-check && bun run lint` → exit 0.

### Step 5: Make DAL `approveRentalRequest` one transaction with a CAS

Wrap the body in `this.db.transaction(async (tx) => {...})` (mirror
`AccountDeletionDAL.anonymizeUser`). Replace select→check→unconditional-update
with one conditional UPDATE via `tx`, `WHERE status='pending' AND
payment_status='processing' RETURNING`; on 0 rows throw `ConflictError`.
Then `tx.insert(rentals).values({...})` using the returned row's fields.
This also closes the "approveRentalRequest is not a transaction" follow-up
in `plans/README.md`. **Verify**: `bun run type-check` → exit 0.

### Step 6: Count `processing` claims as listing-deletion blockers

In `countInFlightRentalsForListing`, OR `paymentStatus='processing'` into the
`active` count query (defense in depth for the narrow window where `status`
has moved off `pending` but a charge claim is still live). Return shape
unchanged. **Verify**: `bun run type-check` → exit 0.

## Test plan

- **DAL** (`rentals.dal.test.ts`): use this file's existing `renderWhere`
  helper (`new PgDialect().sqlToQuery(where)`) to assert the claim's WHERE
  contains `"rental_requests"."status" = $` bound to `"pending"`. Add cases:
  cancel/decline CAS returns 0 rows when status isn't pending, and when
  `paymentStatus='processing'` even if status is pending.
- **Service**: `{status:'denied', paymentStatus:'pending'}` → approve throws
  `RentalRequestNotPendingError`; `chargeRentalPayment` mock NOT called.
  Existing happy-path/claim-lost tests still pass with the new check added.
- **Real-DB** (needs `R-TEST-HARNESS`): cancel a pending request, then call
  approve with Stripe mocked; expect no charge and a 409.

**Verify**: `bun run test:run src/dal/__tests__/rentals.dal.test.ts src/features/rentals` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] A DAL test renders the claim WHERE and pins `status = 'pending'`
- [ ] A service test proves no Stripe call for a denied/cancelled/expired request
- [ ] `grep -c "eq(rentalRequests.status, \"pending\")" src/dal/rentals.dal.ts` ≥ 4
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `ApproveRentalRequestResult` (`rental-service.ts:90-102`) can't admit the
  new thrown-error path cleanly — report, don't widen it ad hoc.
- The `rentals` INSERT inside the new transaction (Step 5) needs a field not
  present on the row returned by its own UPDATE — report the exact field.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- New: `POST /api/rentals/[id]/approve` can return **409**
  `{"error": "...", "code": "REQUEST_NOT_PENDING"}` (falls through the
  route's manual chain, `approve/route.ts:72-93`, to `handleApiError`, since
  that chain only special-cases `NotFoundError` and two message substrings).
  Previously this path either wrongly succeeded or 500'd with "Payment was
  processed but approval failed."
- Cancel/decline: a losing CAS now throws `ConflictError` — 409
  `{"error": "..."}`, no `code` (none requested for this pair). New possible
  response where none existed before; success-path shapes are unchanged.
- Confirm the app already generically handles a 409-with-`code` body (it does
  for `CONVERSATION_ARCHIVED`) before assuming an in-app message exists for
  `REQUEST_NOT_PENDING` — released binaries cannot be hot-fixed.

## Maintenance notes

- `R-CONC-01` depends on this plan: it adds its own re-check inside the same
  claim step and reuses the Step 5 transaction shape.
- `R-BIZ-07` adds a further guard to the same claim path (counterparty must
  be active); either plan may land first, but re-run this plan's DAL tests
  after BIZ-07 since both edit the claim's WHERE clause.
- The pre-existing claim-lost response (`rental-service.ts:459-464`) still
  maps to HTTP 500 via `approve/route.ts:112`'s `paymentFailed ? 400 : 500` —
  a known, separate quirk outside BIZ-01/TEST-01's scope; not fixed here.
