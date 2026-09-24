# R-CONC-02: Claim before money moves on rental cancel/no-show/start/end

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/rentals/services/cancellation-service.ts src/dal/rentals.dal.ts src/dal/payment-lifecycle.dal.ts`
> A mismatch against "Current state" below is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: HIGH (reorders money-moving code)
- **Depends on**: none (mirrors plan 011's already-landed service-booking fix)
- **Category**: bug (money) · **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`cancelApprovedRental` (the service function) refunds the renter, releases
the deposit hold and transfers to the owner **before** its own status guard
runs. If an owner's `start` (a single unguarded UPDATE) wins a race against a
renter's `cancel`, the renter is refunded and the owner is still paid in
full from platform funds later — a real money loss with no alert. This is
the top money-integrity finding in the audit (CONC-02, HIGH): a colluding
owner+renter pair (or one person, two accounts) can repeat it. `applyNoShow`
has the identical ordering bug. `startRental`/`endRental` are read-then-write
with no status predicate on the UPDATE. Plan 011 fixed this exact class of
bug for service bookings; the rental twin was missed.

## Current state

- `cancellation-service.ts:105-345` `cancelApprovedRental` (service function,
  not the DAL method of the same name): reads `ctx` (111), refunds (161),
  releases deposit (181-206), transfers to owner (208-240), **then** calls
  `rentalDAL.cancelApprovedRental` — the CAS — at line 244.
- `cancellation-service.ts:150-159`: `if (ctx.paymentStatus === "refunded")
return success` — an early return that skips deposit release, transfer,
  the CAS and `markCancelled` entirely, leaving the rental row `approved`.
- `cancellation-service.ts:350-499` `applyNoShow`: guards only
  `ctx.status === "cancelled"` (359) and `ctx.paymentStatus === "refunded"`
  (362) — never checks `ctx.status === "approved"`. It refunds (378) and
  transfers (430) **before** calling `rentalDAL.cancelApprovedRental` (463),
  the same late CAS.
- `rentals.dal.ts:3443-3476` `cancelApprovedRental` (DAL): a real CAS,
  `WHERE status='approved' RETURNING`, throws a plain `Error` on 0 rows —
  correct shape, wrong position in the call order above.
- `rentals.dal.ts:2737-2827` `startRental`, `:2883-2966` `endRental`: both
  SELECT, check `status` in application code, then `UPDATE ... WHERE
id=rentalId` with **no status predicate** on the write.
- `payment-lifecycle.dal.ts:358-405` `findEligibleForPayout`: joins
  `rentalPaymentLifecycle`/`rentals`/`rentalRequests`/`user`, filters
  `rentalRequests.status='completed'`, `returnConfirmedAt` > 24h,
  `payoutStatus='pending'`, no open dispute. **It does not check
  `payments.status` or `ownerTransferStatus` at all** — the file does not
  even import the `payments` table.

```ts
// cancellation-service.ts:161-244 (abridged) — money moves before the CAS
const refundResult = await processRefund({ ... });          // 161
...
await releaseDepositHold(ctx.securityDepositAuthId);          // 183
...
const transferResult = await createOwnerTransfer({ ... });    // 210
...
await rentalDAL.cancelApprovedRental(rentalRequestId, userId, // 244 — CAS, too late
  cancellationReason, context.reason ?? null);
```

**Conventions**: mirror plan 011's `service-booking-service.ts` restructure —
claim the terminal transition first (CAS, `.returning()`), throw
`ConflictError` on 0 rows, only then move money. `POST /api/rentals/[id]/cancel`
maps a thrown `ConflictError` to 409 via its fallback `handleApiError` branch
(its manual chain only special-cases `NotFoundError`/`ForbiddenError`/
`ValidationError`, `route.ts:72-93`); `/start` and `/end` routes have no
manual chain at all — any thrown error goes straight to `handleApiError`.
**SEC-16**: drizzle 0.45 wraps driver errors in `DrizzleQueryError` (pg code
on `.cause`); this plan doesn't need to catch a pg error code.

## Commands

| Purpose   | Command                                                                                                                       | Expected |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck | `bun run type-check`                                                                                                          | exit 0   |
| Lint      | `bun run lint`                                                                                                                | exit 0   |
| Tests     | `bun run test:run src/features/rentals src/dal/__tests__/rentals.dal.test.ts src/dal/__tests__/payment-lifecycle.dal.test.ts` | all pass |

## Scope

**In scope**: `src/features/rentals/services/cancellation-service.ts`
(`cancelApprovedRental`, `applyNoShow`), `src/dal/rentals.dal.ts`
(`startRental`, `endRental` — add status predicates; `cancelApprovedRental`
DAL method is reused as-is), `src/dal/payment-lifecycle.dal.ts`
(`findEligibleForPayout`), tests for all of the above.

**Out of scope**: `cancelPendingRequest`/the `pending`-path cancel (no money
involved, unaffected); refund-amount math in `refund-calculations.ts`;
`R-BIZ-01`/`R-CONC-01` (approve-side); `R-BIZ-05`'s payout-cron edits (not
authored here — see Maintenance notes).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Claim first in `cancelApprovedRental` (service)

Move the call to `rentalDAL.cancelApprovedRental(...)` (the CAS) from its
current position (line 244) to **immediately after** the `calc` computation
(after line ~145, before `processRefund` at 161). On a thrown error (0 rows
affected — the DAL method already throws), catch it and re-throw
`ConflictError("This rental changed state — refresh and try again.")` so the
route maps it to 409. Only after the CAS succeeds do refund, deposit release
and transfer run, in their existing order. If refund/transfer then fails,
leave the rental `cancelled` (already the DB state) and keep the existing
`sendOpsAlert` calls (`:197-202`, `:233-238`) — do not add a rollback.

### Step 2: Idempotent repair for the "already refunded" case

Replace the early return at `:150-159` (`if paymentStatus==='refunded')
return success`) with: skip only the `processRefund` call, but still attempt
the CAS and, if it wins, still run deposit release / transfer / notifications
as normal. This finishes the DB transition for a rental whose payment was
refunded by a different path (e.g. a chargeback) while `status` stayed
`approved`, instead of leaving it stuck. If the CAS loses (already
cancelled), that's a no-op success, matching today's externally-visible
behavior for a true double-submit.

**Verify (Steps 1-2)**: `bun run type-check` → exit 0.

### Step 3: `applyNoShow` requires `approved` and claims first

Add `if (ctx.status !== "approved") throw new ValidationError("Only approved rentals can have a no-show applied", "status")`
alongside the existing cancelled/refunded guards. Move the
`rentalDAL.cancelApprovedRental(...)` call from line 463 to immediately
after that guard, before `processRefund` (378) — same restructure as Step 1,
same `ConflictError` on CAS loss.

**Verify**: `bun run type-check` → exit 0.

### Step 4: CAS `startRental` and `endRental`

Add `eq(rentalRequests.status, "approved")` to `startRental`'s UPDATE WHERE
(alongside `eq(id, rentalId)`), and `eq(rentalRequests.status, "active")` to
`endRental`'s. Use `.returning()` and throw `ConflictError` when it comes
back empty — `endRental` already special-cases `status==='completed'` with
its own `ConflictError` message (line ~2921); keep that pre-check for the
friendlier message, and let the CAS backstop every other case.

**Verify**: `bun run type-check && bun run lint` → exit 0.

### Step 5: Payout eligibility excludes refunded/non-pending-transfer rentals

In `findEligibleForPayout`, import `payments` from
`@/db/schemas/payments.schema` and add a join (`leftJoin(payments,
eq(payments.rentalId, rentals.id))`) plus two WHERE additions:
`ne(payments.status, "refunded")` and
`eq(rentalPaymentLifecycle.ownerTransferStatus, "pending")`. This is defense
in depth for Step 1's owner-variant scenario (refund succeeds, the CAS then
loses to a concurrent `start`, so `markCancelled` never runs and
`ownerTransferStatus` stays `pending` on a refunded payment).

**Verify**: `bun run type-check` → exit 0.

## Test plan

- **Unit** (`cancellation-service.test.ts`): CAS loses (mock
  `rentalDAL.cancelApprovedRental` to throw) → `processRefund`/
  `createOwnerTransfer` NOT called; error is `ConflictError`. Happy path:
  `invocationCallOrder` shows the CAS before `processRefund`. `applyNoShow`
  on a `status:'active'` context → `ValidationError`, no refund call.
- **DAL** (`renderWhere` technique): `startRental`'s UPDATE WHERE contains
  `status = 'approved'`; `endRental`'s contains `status = 'active'`.
  `findEligibleForPayout`'s WHERE contains `payments.status <> 'refunded'`
  and `owner_transfer_status = 'pending'`.
- **Real-DB** (needs `R-TEST-HARNESS`): park the refund call on a barrier,
  fire `cancel` and `start` concurrently; assert exactly one status
  transition wins and, when `start` wins, `processRefund` is never invoked.

**Verify**: `bun run test:run src/features/rentals src/dal/__tests__/rentals.dal.test.ts src/dal/__tests__/payment-lifecycle.dal.test.ts` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including new cases above
- [ ] `cancelApprovedRental`/`applyNoShow`: the CAS call precedes
      `processRefund` in source order (read the diff)
- [ ] `grep -n "eq(rentalRequests.status" src/dal/rentals.dal.ts` shows a hit
      inside both `startRental` and `endRental`
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Live code doesn't match "Current state" (drift since `21bdc61`).
- `calc` (the refund-amount computation) turns out to depend on a DB read
  that only makes sense pre-CAS in a way not captured above — report the
  exact dependency rather than reordering around it silently.
- `R-BIZ-05` has already landed and its payout-cron edits touch
  `findEligibleForPayout`'s WHERE in a conflicting way — merge the
  conditions; do not overwrite its predicate.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- `POST /api/rentals/[id]/cancel`: a losing CAS now returns 409
  `{"error": "This rental changed state — refresh and try again."}` (no
  `code` — none requested; falls through to the route's generic
  `handleApiError`/`ConflictError` branch). Previously this raced silently
  or 500'd after money had already moved.
- `POST /api/rentals/[id]/start` and `/end`: can now return 409 on a losing
  CAS (both routes already fall through cleanly to `handleApiError` — no
  manual chain to update).
- `POST /api/admin/rentals/[id]/no-show` (admin/ops only, not a
  mobile-consumer surface): same 409 addition.
- No success-path response shape changes on any of these four routes.

## Maintenance notes

- `R-BIZ-05` (not authored here) also edits the rental payout cron; land in
  either order, but re-run this plan's `findEligibleForPayout` tests after
  it lands (see STOP conditions).
- `applyNoShow`'s claim-first restructure means an admin retrying a no-show
  on an already-cancelled rental now gets a clean 409 instead of money
  moving twice — flag this behavior change to ops in the PR description.
- If a future admin "reset" tool re-arms a cancelled rental back to
  `approved`, it must not do so while `paymentStatus`/transfer state still
  reflects the earlier cancel — out of scope here, but adjacent.
