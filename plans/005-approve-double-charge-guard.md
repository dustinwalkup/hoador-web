# Plan 005: Prevent concurrent rental approvals from double-charging the renter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- src/features/rentals/services/rental-service.ts src/dal/rentals.dal.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (touches the charge path; small diff, well-tested)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

`RentalService.approveRentalRequest` charges the renter, but nothing prevents two concurrent invocations for the same rental request. On the _first_ approval that's mostly harmless — both requests use the deterministic idempotency key `rental-charge-${id}`, so Stripe dedupes. But on **retry after a failed payment**, the key is `rental-charge-${id}-retry-${Date.now()}`: two concurrent retry-approvals (owner double-clicks, or two tabs) get _different_ keys and produce **two real charges** that ops must refund manually. The fix is a standard atomic claim: transition `paymentStatus` to `"processing"` with a conditional UPDATE, and refuse to charge if the claim fails.

## Current state

- `src/features/rentals/services/rental-service.ts:383` — `const isRetryAfterFailure = rentalRequest.paymentStatus === "failed";` (read from an earlier unconditional fetch).
- `src/features/rentals/services/rental-service.ts:431-433` — the unconditional status write, immediately before building the charge:
  ```ts
  await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
    paymentStatus: "processing",
  });
  ```
- `src/features/rentals/services/rental-service.ts:443-447` — the keying:
  ```ts
  const idempotencyKey = isRetryAfterFailure
    ? `rental-charge-${rentalRequest.id}-retry-${Date.now()}`
    : `rental-charge-${rentalRequest.id}`;
  ```
- On charge failure the service already resets: `updateRentalRequestPaymentStatus(rentalId, { paymentStatus: "failed", paymentFailureReason })` (lines 480-483) and returns `{ success: false, paymentFailed: true, error }` (line 534) — so `"failed"` is re-claimable, which is what makes retry work.
- `src/dal/rentals.dal.ts` — `updateRentalRequestPaymentStatus(requestId, paymentData)` does an unconditional `.update(rentalRequests).set({...}).where(eq(rentalRequests.id, requestId))`. The DAL convention for atomic claims already exists in this codebase: `PaymentLifecycleDAL.claimForProcessing` (`src/dal/payment-lifecycle.dal.ts:241-266`) does `.update(...).set(...).where(and(eq(id), eq(status, expected))).returning()` and returns `result.length > 0`.
- `paymentStatus` values (from the DAL method's type): `"pending" | "processing" | "succeeded" | "failed" | "refunded"`.
- The route caller is `src/app/api/rentals/[id]/approve/route.ts`, which wraps the service call in `tryCatch` and maps thrown errors via `handleApiError`. Service-level "business" failures are returned as `{ success: false, ... }`, not thrown.
- Error classes: `ConflictError` in `src/dal/errors.ts` maps to HTTP 409 in `handleApiError` (`src/lib/api/route-helpers.ts:103-108`).

## Commands you will need

| Purpose        | Command                                         | Expected on success |
| -------------- | ----------------------------------------------- | ------------------- |
| Typecheck      | `bun run type-check`                            | exit 0              |
| Lint           | `bun run lint`                                  | exit 0              |
| Targeted tests | `bun run test:run src/features/rentals src/dal` | all pass            |
| Full tests     | `bun run test:run`                              | all pass            |

## Scope

**In scope**:

- `src/dal/rentals.dal.ts` — add one method (`claimRentalRequestPaymentProcessing`)
- `src/features/rentals/services/rental-service.ts` — `approveRentalRequest` only
- Tests: `src/features/rentals/services/__tests__/` and `src/dal/__tests__/rentals.dal.test.ts`

**Out of scope**:

- The approve route handler — its contract (`{ success: false, error }` → response) is unchanged.
- The deposit-hold flow (plan 004) and payout flow.
- Idempotency-key format changes — `Date.now()` retry keys are fine once the claim exists.
- Client-side double-click prevention — server-side correctness first; UI debounce is cosmetic.

## Git workflow

- Branch: `advisor/005-approve-double-charge-guard` off `develop`
- Commit per step; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the atomic claim to the DAL

In `src/dal/rentals.dal.ts`, next to `updateRentalRequestPaymentStatus`, add (modeled exactly on `PaymentLifecycleDAL.claimForProcessing`):

```ts
/**
 * Atomically claim a rental request for payment processing.
 * Transitions paymentStatus -> "processing" only from "pending" or "failed".
 * Returns false if another request already claimed it (or it already succeeded).
 */
async claimRentalRequestPaymentProcessing(requestId: string): Promise<boolean> {
  try {
    const result = await this.db
      .update(rentalRequests)
      .set({ paymentStatus: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(rentalRequests.id, requestId),
          inArray(rentalRequests.paymentStatus, ["pending", "failed"]),
        ),
      )
      .returning({ id: rentalRequests.id });
    return result.length > 0;
  } catch (error) {
    this.handleError(error, "claimRentalRequestPaymentProcessing");
  }
}
```

Check the file's existing drizzle imports (`and`, `eq`, `inArray`) and add any missing. Note: if new rental requests are created with a NULL `paymentStatus` rather than `"pending"`, `inArray` won't match NULL — check the schema default in `src/db/schemas/rentals.schema.ts`; if the column is nullable without default, the WHERE needs `or(isNull(...), inArray(...))`. Verify which case applies before writing the test.

**Verify**: `bun run type-check` → exit 0.

### Step 2: Use the claim in approveRentalRequest

Replace the unconditional write at `rental-service.ts:431-433` with:

```ts
const claimed = await rentalDAL.claimRentalRequestPaymentProcessing(rentalId);
if (!claimed) {
  return {
    success: false,
    error:
      "This rental request's payment is already being processed. Refresh the page to see its current status.",
  };
}
```

Confirm `ApproveRentalRequestResult` allows `{ success: false, error: string }` without `paymentFailed` (it's the same shape returned at line 425-429 for the minimum-charge guard, so it does).

**Important ordering**: the claim must stay where the old write was — _after_ all validation/Connect-readiness checks (which throw without having mutated state) and _immediately before_ the charge block. Anything that can fail after the claim must release it (Step 3).

**Verify**: `bun run type-check` → exit 0. `grep -n "claimRentalRequestPaymentProcessing" src/features/rentals/services/rental-service.ts` → one call site.

### Step 3: Release the claim on unexpected exceptions

The failure paths that already reset to `"failed"` (charge declined, non-succeeded status) keep the claim consistent. The remaining hole: an unexpected **throw** between the claim and those handlers (e.g. Stripe SDK network exception outside `tryCatch`, a bug) would leave the request stuck in `"processing"` forever, blocking all future approvals.

Wrap the region from immediately after the claim through the end of the charge/deposit/approval logic in `try/catch`:

```ts
try {
  // …existing code from the chargePayload build to the end of the method…
} catch (error) {
  await tryCatch(
    rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
      paymentStatus: "failed",
      paymentFailureReason: "Unexpected error during payment processing",
    }),
  );
  throw error;
}
```

Re-indenting the whole block is acceptable; do not otherwise reorder statements. `tryCatch` is already imported in this file.

Careful: the method's existing successful return paths must remain _inside_ the `try` and still execute their own status updates (e.g. setting `succeeded`); the catch only handles throws.

**Verify**: `bun run type-check` → exit 0; `bun run lint` → exit 0.

## Test plan

**DAL test** (`src/dal/__tests__/rentals.dal.test.ts` — extend; it exists and is the repo's largest DAL test): following the file's existing style for update methods, add cases for `claimRentalRequestPaymentProcessing`:

- status `pending` → returns true
- status `failed` → returns true
- status `processing` → returns false
- status `succeeded` → returns false

**Service test** (`src/features/rentals/services/__tests__/` — extend the rental-service test if present, else create `rental-service.approve.test.ts` modeled on `payment-lifecycle-service.test.ts` mocks):

1. claim returns `false` → result `{ success: false }` with the "already being processed" message, and `chargeRentalPayment` (mock) is **never called**.
2. claim returns `true`, charge succeeds → existing happy path unaffected.
3. claim returns `true`, charge mock **throws** (not a rejected tryCatch — an actual throw from a non-wrapped call) → `updateRentalRequestPaymentStatus` called with `paymentStatus: "failed"`, and the error propagates.

**Verification**: `bun run test:run src/features/rentals src/dal` → all pass including 7 new cases.

## Done criteria

- [ ] Two sequential `approveRentalRequest` calls where the first holds the claim: second returns the already-processing error without charging (service test 1)
- [ ] An unexpected throw after the claim resets paymentStatus to `failed` (service test 3)
- [ ] `bun run type-check`, `bun run lint`, `bun run test:run` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts don't match (drift) — particularly if someone already added a status guard.
- `rentalRequests.paymentStatus` turns out to be nullable with NULL as the de-facto initial state AND adding `isNull` handling changes other call sites' assumptions — report with the schema excerpt.
- `ApproveRentalRequestResult` does not admit `{ success: false, error }` — report rather than widening the type ad hoc.
- The `try/catch` wrap in Step 3 would have to cross a code region that commits the approval (DAL `approveRentalRequest`/payment-record creation) in a way that makes "reset to failed" wrong after partial success — report with the exact line range; this needs a human decision on compensation semantics.

## Maintenance notes

- This claim covers approve-vs-approve races. It does NOT serialize approve against _cancellation_ of a pending request; if a cancel-pending path mutates `paymentStatus`, revisit.
- If a queue/worker ever takes over charging, the claim moves with it — the invariant is "exactly one writer may move `pending|failed` → `processing`".
- Reviewer should scrutinize Step 3's catch: it must rethrow (the route's `tryCatch` + `handleApiError` depend on it) and must not mask the original error with a status-reset failure.
- A stale-`processing` detector (cron that flags requests stuck in `processing` > N minutes, like `detect-stale-processing` does for payouts) was considered and deferred — Step 3 closes the realistic leak.
