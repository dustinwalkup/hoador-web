# R-BIZ-02: Block early service completion and fix the resulting dispute/payout windows

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/services/services/service-booking-service.ts src/features/disputes/lib/time-window-validation.ts src/dal/service-payment-lifecycle.dal.ts src/features/services/services/service-payment-lifecycle-service.ts src/dal/errors.ts src/lib/api/route-helpers.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED
- **Depends on**: none · **Category**: bug (money)
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

A provider can tap "Mark Complete" the instant a booking is accepted, days
before the scheduled service. `completeBooking` has no date check, so the
provider is paid for unperformed work and the requester's dispute window can
be **mathematically empty**: the window opens at the scheduled day's start and
closes 24h after `completedAt` — if completion happens more than 24h before
the service day, it closes before it opens. A completed booking also cannot
be cancelled, so the requester has no recourse but a chargeback. Audit finding
BIZ-02 (HIGH), gap TEST-04 (early-completion part).

## Current state

- `service-booking-service.ts:640-692` `completeBooking` — checks provider
  and `status === "accepted"`, then does the CAS at 664-671. **No date/time
  check anywhere.**

```ts
// service-booking-service.ts:664-678
const now = new Date();
const updated = await serviceBookingDAL.updateIfStatus(bookingId, "accepted", {
  status: "completed",
  completedAt: now,
});
if (!updated) throw new ConflictError("...");
await servicePaymentLifecycleDAL.updatePayoutStatus(bookingId, "pending");
```

- `time-window-validation.ts:191-225` `validateServiceFilingWindow` — opens
  strictly at `dayStart` (line 198: `if (now < dayStart) return invalid`) and
  closes at `completedAt + 24h` (205-214) if `completedAt` is set. If
  `completedAt < dayStart` (early completion), the deadline is already in the
  past by the time the window would open — empty window.
- `service-payment-lifecycle.dal.ts:231-287` `findEligibleForPayout` —
  requires `completedAt < cutoff` (cutoff = now − 24h) only; no check against
  the scheduled instant.
- `service-payment-lifecycle-service.ts:21-135` `processPayouts` — fetches
  eligible rows, then `claimForProcessing` **before** any further check. A
  row claimed-then-skipped is stuck in `payoutStatus='processing'` forever, so
  any extra guard must run **before** the claim.
- `booking-cancellation.ts:118-127` `serviceInstant(booking)` — turns
  `{proposedDate, proposedTime}` into a real `Date` via `wallClockToInstant`
  (`wall-clock-zone.ts:85-118`, market-zone aware). Already used by
  `cancelBooking` (`service-booking-service.ts:738`). Returns `null` if
  unparseable — treat as _unknown_, not _now_.
- `dispute-creation-service.ts:370-393` — "S12" allowance: if a booking was
  **never completed** and the window check fails, filing is still allowed and
  ops is alerted. Only fires when `completedAt` is unset, so it doesn't help
  the early-completion case.
- Error convention: a new machine-readable code mirrors
  `ConversationArchivedError` (`errors.ts:65-72`) plus its own
  `handleApiError` branch (`route-helpers.ts:118-130`), placed **before** the
  generic `ConflictError` branch (line 132), which returns `{error: message}`
  only and silently drops any `code`. Add the new error to the Sentry-skip
  list (`shouldCaptureError`, `route-helpers.ts:60-73`) — this is an expected
  user outcome, not an incident.
- The route (`src/app/api/services/bookings/[id]/complete/route.ts:37-46`)
  already pipes thrown errors through the generic `handleApiError` — no route
  change needed.

## Commands

| Purpose        | Command                                                                                                                    | Expected |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                       | exit 0   |
| Lint           | `bun run lint`                                                                                                             | exit 0   |
| Targeted tests | `bun run test:run src/features/services src/dal/__tests__/service-payment-lifecycle.dal.test.ts src/features/disputes/lib` | all pass |
| Full tests     | `bun run test:run`                                                                                                         | all pass |

## Scope

**In scope**: `src/dal/errors.ts`, `src/lib/api/route-helpers.ts`,
`src/features/services/services/service-booking-service.ts`
(`completeBooking` only), `src/features/disputes/lib/time-window-validation.ts`
(`validateServiceFilingWindow`), `src/dal/service-payment-lifecycle.dal.ts`
(`findEligibleForPayout`, its `PayoutEligibleServiceBooking` interface),
`src/features/services/services/service-payment-lifecycle-service.ts`
(`processPayouts`), and tests for all of the above.

**Out of scope**: `cancelBooking` and `declineBooking` (unaffected); the
rental side (no equivalent bug — rentals gate on `startDate`, see BIZ-10,
separate finding); mobile and web UI (describe the gap, do not fix — see
"Mobile compatibility").

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Add `ServiceNotYetDueError`

In `src/dal/errors.ts`, near `ConversationArchivedError`:

```ts
export class ServiceNotYetDueError extends DALError {
  constructor(
    message = "This service hasn't happened yet — you can mark it complete on or after the scheduled date.",
  ) {
    super(message, "SERVICE_NOT_YET_DUE", 409);
    this.name = "ServiceNotYetDueError";
  }
}
```

In `route-helpers.ts`: import it, add a branch returning
`{error: error.message, code: error.code}` at `error.statusCode` **before**
the generic `ConflictError` branch (~line 132), and add it to
`shouldCaptureError`'s exclusion list (~line 60-73).
**Verify**: `bun run type-check` → exit 0.

### Step 2: Reject completion before the scheduled instant

In `completeBooking`, after the `status === "accepted"` check and before the
CAS (before line 663's `const now = new Date()`):

```ts
const scheduledAt = serviceInstant(detail);
const now = new Date();
if (scheduledAt && now < scheduledAt) {
  throw new ServiceNotYetDueError();
}
```

Import `serviceInstant` from `@/features/services/lib/booking-cancellation`
and `ServiceNotYetDueError` from `@/dal/errors`. `scheduledAt === null`
(unparseable) falls through and allows completion — matches `serviceInstant`'s
"unknown, not harshest-case" contract and avoids a new way to strand a
booking. Reuse the single `now` for this check and the CAS's `completedAt`.
**Verify**: `bun run type-check` → exit 0; trace: booking with `proposedDate`
= tomorrow → `completeBooking` throws `ServiceNotYetDueError`.

### Step 3: Widen the filing window's open boundary

In `validateServiceFilingWindow` (`time-window-validation.ts:191-225`),
change the open boundary from `dayStart` to `min(dayStart, completedAt)`:

```ts
const windowOpensAt =
  completedAt && completedAt < dayStart ? completedAt : dayStart;
if (now < windowOpensAt) {
  return {
    valid: false,
    message: "Disputes cannot be filed before the scheduled service date",
  };
}
```

Once Step 2 ships, `completedAt` can never precede `serviceInstant` (always ≥
`dayStart`) for _new_ completions, so this is a no-op on the happy path. It
matters for rows completed early **before** this plan lands: today those have
a provably empty window; after this change it's real
(`[completedAt, completedAt+24h]`). Keep the close-boundary logic (205-222)
unchanged. **Verify**: `bun run type-check` → exit 0.

### Step 4: Require the scheduled instant to have passed for payout

Add `proposedDate`/`proposedTime` to the `findEligibleForPayout` SELECT and
to the `PayoutEligibleServiceBooking` interface — do **not** filter in SQL
(the wall-clock→instant conversion needs `Intl` timezone math). In
`ServicePaymentLifecycleService.processPayouts`, right after fetching
`eligibleRows` (line 25-28) and **before** the claim loop, filter out any row
whose `serviceInstant({proposedDate, proposedTime})` is non-null and still in
the future (log and skip; don't claim, don't alert — unreachable post-Step-2,
defense-in-depth for older rows). **Verify**: `bun run type-check` → exit 0.

### Step 5: Leave a pointer for mobile, don't edit it

`hoador-mobile` has uncommitted work — do not edit it. In
`service-booking-service.ts`, leave a one-line comment above the new check
referencing this plan so a future mobile fix has the pointer.
**Verify**: `grep -n "R-BIZ-02" src/features/services/services/service-booking-service.ts` → 1 hit.

## Test plan

- **Service** (`service-booking-service.test.ts` or sibling): accepted
  booking with `proposedDate` = tomorrow → `completeBooking` throws
  `ServiceNotYetDueError`; `updateIfStatus` NOT called. Accepted booking with
  `proposedDate` = today, `proposedTime` in the past → completes normally
  (existing happy-path test should still pass unchanged).
- **`time-window-validation.ts`**: a case with `completedAt` set to 2 days
  before `proposedDate` — assert the window is now
  `[completedAt, completedAt+24h]` and a `now` inside it returns `valid:true`
  (today's code returns `valid:false` here — this is the regression test for
  the empty-window bug).
- **DAL** (`service-payment-lifecycle.dal.test.ts`, model after its existing
  `describe("findEligibleForPayout", ...)` block): assert the SELECT
  includes `proposedDate`/`proposedTime` columns via the row shape returned
  by the mocked `db.select`.
- **Service payout** (`service-payment-lifecycle-service.test.ts` if it
  exists, else new file modeled on the DAL test's mock style): a row whose
  `serviceInstant` is in the future is filtered out before
  `claimForProcessing` is called (assert the mock was never invoked for that
  row).

**Verify**: `bun run test:run src/features/services src/dal/__tests__/service-payment-lifecycle.dal.test.ts src/features/disputes/lib` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] `grep -n "ServiceNotYetDueError" src/dal/errors.ts src/lib/api/route-helpers.ts src/features/services/services/service-booking-service.ts` → 3+ hits
- [ ] A test proves a booking is not payout-eligible before its scheduled instant
- [ ] A test proves a dispute can be filed after an early completion (Step 3)
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `serviceInstant(detail)` needs a field `completeBooking`'s `detail`
  (`serviceBookingDAL.getById`) doesn't already carry — `cancelBooking` uses
  the same `detail` object for the same helper (line 738), so this should not
  happen; report the exact missing field if it does.
- Adding the SELECT columns in Step 4 breaks the `PayoutEligibleServiceBooking`
  consumers outside `processPayouts` — report which caller.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- New: `POST /api/services/bookings/[id]/complete` can return **409**
  `{"error": "This service hasn't happened yet...", "code": "SERVICE_NOT_YET_DUE"}`.
  Verified against `hoador-mobile/src/api/errors.ts`: `ApiError.fromBody`
  generically detects any `SCREAMING_SNAKE_CASE` value in `code` via
  `CODE_PATTERN` — no mobile-side allowlist entry needed. The
  currently-released app surfaces this as `ApiError.kind = "conflict"` with
  `message` = this error's human string, via generic 409 handling. No mobile
  release is required for correctness; a future release can add a specific
  branch on `code === "SERVICE_NOT_YET_DUE"` (e.g. disabling the button
  pre-emptively).
- Read-only, for context (do not edit, per Step 5):
  `provider-booking-actions.tsx` renders "Mark complete" unconditionally once
  a booking is `accepted` (no client-side date gate) and its success toast
  promises "payout starts after the 24-hour dispute window" — true only after
  this plan. The web button (`service-booking-detail-client.tsx:357,741,1025`)
  shows `data.error` on failure — renders correctly, no web change needed.

## Maintenance notes

- R-BIZ-03 (`R-BIZ-03-no-payout-after-dispute-refund.md`) also edits
  `completeBooking` and `findEligibleForPayout` in the same two files. Land
  either plan first; the second executor should re-read the file before
  editing since line numbers will have shifted.
- If Hoador ever supports same-day emergency service bookings where
  `proposedTime` can be in the past at acceptance time, Step 2's check needs
  a carve-out — none exists today (`serviceInstant` is always in the future
  at booking time per the quote flow).
