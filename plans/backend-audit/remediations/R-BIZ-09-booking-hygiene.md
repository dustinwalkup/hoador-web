# Plan R-BIZ-09: Booking hygiene — five independent fixes

> **Executor instructions**: This plan bundles five unrelated fixes (Parts
> A–E), ordered by money risk. Land and verify each part on its own — a
> part's Steps and Verify lines are self-contained, and you can stop after
> any part and hand off cleanly. Run every verification command and confirm
> the result before moving on. On a STOP condition, stop and report — do not
> improvise.
>
> **Drift check (run first)**:
> `git diff --stat 25e2233..HEAD -- src/features/rentals/services/rental-service.ts src/features/services/services/service-booking-service.ts src/features/services/lib/booking-cancellation.ts src/dal/service-booking.dal.ts src/dal/messages.dal.ts src/db/schemas/messages.schema.ts src/dal/errors.ts src/lib/api/route-helpers.ts`
> If any in-scope file changed, compare "Current state" below against the
> live code before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED · **Depends on**: none
  (Part B reuses R-BIZ-01's rejection pattern and R-BIZ-02's
  `serviceInstant`/`ServiceNotYetDueError` shape; Part C reuses the CAS
  helper R-BIZ-01/plans 009/011 already added)
- **Category**: bug (money) + database
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: BIZ-09, BIZ-10, BIZ-12, CONC-03 (service half), DB-03

## Why this matters

Five separate gaps in the booking lifecycle, each independently exploitable:

- **BIZ-12** (Part A): a transient DB error after a successful rental charge
  silently strands the owner unpaid, with no alert — the highest-risk item
  because the money has already moved and nothing today notices.
- **BIZ-10** (Part B): an owner or provider who answers late charges the
  renter/requester for time that has already elapsed, with no race required.
- **CONC-03 service half** (Part C): a provider's decline can lose a race
  against their own accept, leaving a "declined" booking that was actually
  charged.
- **BIZ-09** (Part D): a requester whose card failed has no way to walk away
  from a `payment_failed` booking, and the provider can re-charge them months
  later on a stale card choice.
- **DB-03** (Part E): deleting a conversation destroys the counterparty's
  copy too — no money at stake, but real data loss and a dispute-evidence
  gap.

## Current state (verified against `25e2233`, re-derived — do not trust old

line numbers)

All five gaps below were re-checked against the live code; nothing in this
list has already been fixed by a prior plan.

- **BIZ-12**: `rental-service.ts:731-744` calls `paymentDAL.createPayment`
  inside `tryCatch`; on error, **nothing happens at all** — no `if`
  branch reads `paymentRecordError`. `rental-service.ts:799-814` calls
  `paymentLifecycleDAL.create`; on error, only
  `captureNonCriticalError(lifecycleError, ...)` (Sentry, non-critical) runs.
  Neither path calls `sendOpsAlert`. Both writes run **after**
  `rentalDAL.approveRentalRequest` (`:712-719`) has already committed its own
  transaction (status → `approved`, `paymentStatus` → `succeeded`, the
  `rentals` row inserted) — R-BIZ-01 made _that_ step transactional, but the
  payment record and payout-lifecycle row are separate DAL calls with no
  shared transaction and, today, no alert on failure. This is exactly the
  BIZ-12 finding; R-BIZ-01/R-CONC-01 did not touch it.
- **BIZ-10, rental side**: `rental-service.ts:408-411` (R-BIZ-01) rejects a
  non-`pending` request before any Stripe call, but nothing compares
  `rentalRequest.startDate` to `now`. `startRental`
  (`rentals.dal.ts:2934-2936`) already blocks _starting_ a rental before its
  day, using `isPastDay` (`src/features/rentals/lib/availability.ts:109-113`)
  — a **day**, not instant, comparison (a same-day rental is still
  startable). Approve has no equivalent check.
- **BIZ-10, service side**: `service-booking-service.ts:274-276` rejects a
  non-`pending`/`payment_failed` booking, but nothing compares the booking's
  scheduled instant to `now`. `completeBooking`
  (`service-booking-service.ts:661-670`, from R-BIZ-02) already does this
  for the _other_ end of the window: `serviceInstant(detail)`
  (`booking-cancellation.ts:118-128`) turns `proposedDate`/`proposedTime`
  into a real instant in `MARKET_TIME_ZONE`, and `now < scheduledAt` throws
  `ServiceNotYetDueError`. `acceptBooking` has no equivalent check for the
  instant having already **passed**.
- **CONC-03, service half**: `service-booking-service.ts:618-622`
  (`declineBooking`) calls `serviceBookingDAL.update(bookingId, {status:
"declined", ...})` — a plain `WHERE id` update, no CAS. `acceptBooking`'s
  claim (`claimForAcceptance`, `service-booking.dal.ts:249-275`) sets
  `paymentStatus = "processing"` before charging, so a concurrent decline
  can read the booking as `pending`, then write `declined` over an
  in-flight (or just-succeeded) charge. `cancelBooking`
  (`service-booking-service.ts:772-782`) already fixed the identical shape
  for cancel, via `serviceBookingDAL.updateIfStatus(bookingId, detail.status,
{...}, {blockWhilePaymentProcessing: true})` (plans 009/011). Decline is
  the one sibling write plans 009/011 and R-BIZ-01 did not cover — this is
  the exact gap `plans/README.md`'s deleted "Follow-ups left by 009/011" note
  flagged ("`declineBooking` is still an unguarded update").
- **BIZ-09**: `assessServiceCancellation`
  (`booking-cancellation.ts:52-90`) refuses cancellation for any status
  other than `pending`/`accepted` (line 68), so a `payment_failed` booking
  has no requester exit. `findPendingExpired`
  (`service-booking.dal.ts:282-317`) and `markExpired` (`:330-352`) both
  filter `eq(status, "pending")` and `isNull(paymentStatus)` — a
  `payment_failed` row (`paymentStatus = "failed"`, not `null`) never
  matches either query, so it never expires. `declineBooking` already
  covers the _provider's_ exit from `payment_failed`
  (`service-booking-service.ts:614`) — only the requester's cancel path and
  the cron are missing.
- **DB-03**: `messages.dal.ts:943-961` `deleteConversation` does
  `this.db.delete(conversations).where(eq(conversations.id, conversationId))`
  after only a participant check — a hard, two-sided delete; `messages`
  cascades (`messages.schema.ts:56-58`, `onDelete: "cascade"`). There is no
  per-user delete column; `user1Archived`/`user2Archived`
  (`messages.schema.ts:29-30`) are the existing per-user precedent for the
  column shape to copy. **The mobile app already knows this is broken and
  works around it**: `hoador-mobile/src/api/contract/conversations.contract.ts:16-19`
  and `hoador-mobile/src/features/messages/components/conversation-actions-sheet.tsx:44-51`
  both document, by name (D-E11-5, F17), that the app never calls `DELETE
/api/messages/conversations/[id]` because it is a "hard, two-sided delete
  that destroys the other party's copy of the thread with no soft-delete and
  no way back." Fixing this server-side unblocks that mobile gap (see Part
  E's Mobile compatibility note).

## Decisions for the maintainer

**D1 — BIZ-12: alert-and-continue vs. a real cross-DAL transaction.** The
finding's recommended fix offers two options: "do the post-charge DB work in
one `db.transaction`, or treat it as Region B (ops alert, keep the claim)."
`paymentDAL.createPayment` and `paymentLifecycleDAL.create` are separate DAL
classes with no `tx` parameter on either method; wrapping both in one real
transaction means adding a `tx` param to both methods (and auditing every
other caller of each). **Recommendation: alert-and-continue**, matching the
pattern `acceptBooking`'s own "Region B" already uses for the identical
post-charge-persistence-failure shape (`service-booking-service.ts:507-527`).
By the time these two writes run, the rental is already `approved` and
`paymentStatus = "succeeded"` (R-BIZ-01's transaction), so there is no claim
left to strand — a missing payment or lifecycle row is a reconciliation gap,
not a stuck claim, and an ops alert is the correct signal. Steps below
assume this recommendation.

**D2 — DB-03: what "delete" does to an already-deleted-for-you thread.**
Once one side deletes, should sending them a **new** message revive it in
their inbox? **Recommendation: yes** — clear both sides' `deletedAt` on any
new message in the thread, mirroring the fact that a live person cannot
be made permanently invisible to messages the other party keeps sending.
This also means a user who deletes, then messages the same person again
later, sees the _same_ thread reappear (with its old history) rather than a
confusing empty one — consistent with the schema's existing
`unique(user1Id, user2Id)` design (one thread per pair, forever). Steps
below assume this recommendation. GET-by-id and send-into are **not** gated
by the caller's own `deletedAt` (only the inbox _list_ is) — deleting hides
a thread from your inbox; it does not revoke your ability to open a link to
it, matching how `archived` already behaves.

## Commands you will need

| Purpose             | Command                                                                                                                                                                                           | Expected                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Typecheck           | `bun run type-check`                                                                                                                                                                              | exit 0                   |
| Lint                | `bun run lint`                                                                                                                                                                                    | exit 0                   |
| Part A/B/D targeted | `bun run test:run src/features/rentals/services/__tests__/rental-service.approve.test.ts`                                                                                                         | all pass                 |
| Part B/C/D targeted | `bun run test:run src/features/services/__tests__/service-booking-service.test.ts src/features/services/lib/__tests__/booking-cancellation.test.ts src/dal/__tests__/service-booking.dal.test.ts` | all pass                 |
| Part C race test    | `docker compose up -d && bun run db:push:e2e && bun run test:integration src/features/services/services/__tests__/service-decline-accept-race.integration.test.ts`                                | all pass                 |
| Part E targeted     | `bun run test:run src/dal/__tests__/messages.dal.test.ts`                                                                                                                                         | all pass                 |
| DB diff (Part E)    | `bun run db:generate --name=conversation_per_user_delete`                                                                                                                                         | review the generated SQL |
| Full tests          | `bun run test:run`                                                                                                                                                                                | all pass                 |

## Scope

**In scope**: `src/dal/errors.ts`, `src/lib/api/route-helpers.ts`,
`src/features/rentals/services/rental-service.ts`,
`src/features/services/services/service-booking-service.ts`,
`src/features/services/lib/booking-cancellation.ts`,
`src/dal/service-booking.dal.ts`, `src/db/schemas/messages.schema.ts` (new
migration), `src/dal/messages.dal.ts`, and tests for all of the above
(including one new integration test file for Part C).

**Out of scope**: tightening `expiresAt` to the booking start (BIZ-10's
finding mentions it, but the roadmap note only asks to block late
approve/accept; leaving `expiresAt` at a flat 72h is a UX nicety, not a
money-safety gap, once late approve/accept is blocked — do not add it here);
a real cross-DAL transaction for BIZ-12 (see D1); Region B's own post-charge
write in `acceptBooking` (already correct — not part of CONC-03's scope);
BIZ-15/BIZ-16 (free-form `proposedTime`, late-cancel refund base — separate,
lower-priority findings); enforcing a dispute-evidence deadline on `open`
disputes (BIZ-17, separate).

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes
uncommitted for the maintainer to review and commit.

---

## Part A — BIZ-12: alert ops when a rental's post-charge writes fail

### Step A1: Add the ops alert import

In `rental-service.ts`, add:

```ts
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
```

### Step A2: Alert on a failed payment-record write

At `rental-service.ts:731-744`, the `paymentDAL.createPayment` call sits
inside `if (createdRental) { const { error: paymentRecordError } =
await tryCatch(paymentDAL.createPayment({...})); if (!paymentRecordError) {
trackActivity(...); ...meta CAPI via after()...} }` — there is no `else`.
Add one:

```ts
if (!paymentRecordError) {
  trackActivity(rentalRequest.renterId, "payment_made", { ... }); // unchanged
  // ...existing Meta CAPI `after()` block, unchanged...
} else {
  await sendOpsAlert({
    event: "rental_approve_payment_record_failed",
    rentalId: createdRental.id,
    message: `Rental ${createdRental.id} (request ${rentalRequest.id}) was charged (PaymentIntent ${rentalPaymentIntent.id}) but writing its payment record failed: ${
      paymentRecordError instanceof Error
        ? paymentRecordError.message
        : String(paymentRecordError)
    }`,
    sendEmailAlert: true,
  });
}
```

### Step A3: Alert on a failed payout-lifecycle write

At `rental-service.ts:799-814`, the `lifecycleError` branch currently only
calls `captureNonCriticalError`. Keep that call (Sentry visibility is still
useful) and add an ops alert alongside it:

```ts
if (lifecycleError) {
  captureNonCriticalError(lifecycleError, {
    route: "RentalService.approveRentalRequest",
    action: "create_payment_lifecycle",
  });
  await sendOpsAlert({
    event: "rental_approve_lifecycle_record_failed",
    rentalId: createdRental.id,
    message: `Rental ${createdRental.id} (request ${rentalRequest.id}) was charged but creating its payout lifecycle row failed: ${
      lifecycleError instanceof Error
        ? lifecycleError.message
        : String(lifecycleError)
    }`,
    sendEmailAlert: true,
  });
}
```

**Verify (A1-A3)**: `bun run type-check` → exit 0.

### Step A4: Tests

In `rental-service.approve.test.ts`, add:

```ts
const mockSendOpsAlert = vi.fn();
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));
```

Add two new tests after "still approves when the post-charge audit log write
fails" (line ~368):

- `mockCreatePayment.mockRejectedValueOnce(new Error("db down"))` → approve
  still returns `{success: true}` (a throw here would strand a charged
  request); `mockSendOpsAlert` called once with
  `event: "rental_approve_payment_record_failed"` and a `message` containing
  the rental id.
- `mockLifecycleCreate.mockRejectedValueOnce(new Error("db down"))` →
  `{success: true}`; both `mockCaptureNonCriticalError` (existing assertion
  pattern) **and** `mockSendOpsAlert` (`event:
"rental_approve_lifecycle_record_failed"`) are called.

**Verify**: `bun run test:run src/features/rentals/services/__tests__/rental-service.approve.test.ts` → all pass, including the two new cases.

---

## Part B — BIZ-10: no approve/accept after the booking's start

### Step B1: Add the shared error

In `src/dal/errors.ts`, near `CounterpartyUnavailableError` (mirrors it: one
class reused across both rental and service domains, same reasoning as
`COUNTERPARTY_UNAVAILABLE`):

```ts
/**
 * Thrown when an owner/provider tries to approve or accept a booking whose
 * start has already passed. Approving late still charges the renter/
 * requester full price for time they can no longer use, and immediately
 * places any deposit hold — the reverse of what the rental's own
 * ≤48h-before-pickup branch assumes (BIZ-10).
 *
 * `code: "BOOKING_START_PASSED"`. Not a `ConflictError` subclass, for the
 * same reason as `CounterpartyUnavailableError`.
 */
export class BookingStartPassedError extends DALError {
  constructor(message: string) {
    super(message, "BOOKING_START_PASSED", 409);
    this.name = "BookingStartPassedError";
  }
}
```

In `route-helpers.ts`: import it alongside the other rental/service errors,
add it to the `shouldCaptureError` exclusion list (next to
`CounterpartyUnavailableError`), and add its response branch next to
`ServiceNotYetDueError`'s (same `{error: error.message, code: error.code}`
at `error.statusCode` shape).

**Verify**: `bun run type-check` → exit 0.

### Step B2: Reject a late rental approve

In `rental-service.ts`, add the import
`import { isPastDay } from "@/features/rentals/lib/availability";` and
insert, between the existing BIZ-01 status check (ends `:411`) and the
BIZ-07 comment (`:412`):

```ts
// R-BIZ-10: approving after the start day charges the renter for time they
// can never use, and the ≤48h-before-pickup branch below would place the
// deposit hold immediately. Compared as a DAY via isPastDay, matching
// startRental's own definition of "start" (rentals.dal.ts:2934-2936) — a
// rental starting today is still approvable.
if (isPastDay(rentalRequest.startDate)) {
  const { BookingStartPassedError } = await import("@/dal/errors");
  throw new BookingStartPassedError(
    "This rental's start date has already passed, so it can no longer be approved.",
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### Step B3: Reject a late service accept

In `service-booking-service.ts`, `serviceInstant` is already imported.
Insert, between the status check (ends `:276`) and the BIZ-07 comment
(`:277`):

```ts
// R-BIZ-10: accepting after the scheduled instant charges the requester for
// a job that has already passed. `null` (an unreadable schedule) is
// unknown, not "now" — allow it rather than strand the booking, same choice
// completeBooking already made for the opposite boundary (BIZ-02).
const scheduledAt = serviceInstant(detail);
if (scheduledAt && new Date() > scheduledAt) {
  throw new BookingStartPassedError(
    "This booking's scheduled time has already passed, so it can no longer be accepted.",
  );
}
```

Add `BookingStartPassedError` to this file's existing `@/dal/errors` import
list (it is already a static import here, unlike `rental-service.ts`'s lazy
style).

**Verify**: `bun run type-check` → exit 0.

### Step B4: Fix the test fixtures before they collide with the new checks

**This is the step most likely to be skipped and break the suite.** Both
test files' default fixtures currently sit in the past relative to the
plan's date (2026-09-24), because they were written with a hardcoded date
that has since rotted:

- `rental-service.approve.test.ts`'s `createMockRentalRequest` defaults to
  `startDate: new Date("2026-07-01")`. Change both `startDate` and `endDate`
  to be relative, e.g. `new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)` /
  `+ 7 * ...`, so the fixture never rots again (mirrors the `futureDay()`
  helper the service test file already added for the identical reason — see
  its own comment at line ~189-196). No test in this file depends on the
  literal date string.
- `service-booking-service.test.ts`'s shared `bookingPending` fixture
  defaults to `proposedDate: "2025-06-15"` — also now in the past, and used
  by **every** `acceptBooking` test via `mockBookingGetById.mockResolvedValue
(bookingPending)` or a spread of it. Unlike the rental file, this literal
  date is load-bearing elsewhere: `completeBooking`'s "before the scheduled
  instant" tests (line ~1187-1257) fake the clock to specific ISO strings
  keyed to this exact date (`arrangeAt("2025-06-14T15:00:00Z")` etc.), so
  changing the fixture's default would break _those_ tests instead. **Do
  not change the shared fixture.** Instead, scope a fake clock to the
  `acceptBooking` describe block only, set safely before `2025-06-15`:

  ```ts
  describe("acceptBooking", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    // ...existing tests, unchanged...
  });
  ```

  (`afterEach` is already imported in this file.) This keeps every existing
  `acceptBooking` test passing unmodified, and does not touch
  `completeBooking`'s own timer handling (a sibling `describe` block).

**Verify**: `bun run test:run src/features/rentals/services/__tests__/rental-service.approve.test.ts src/features/services/__tests__/service-booking-service.test.ts` → all pass, **before** adding the new tests in Step B5 (isolates whether a failure is the fixture fix or the new check).

### Step B5: New tests

In `rental-service.approve.test.ts`, add near the other "before any Stripe
call" tests:

```ts
it("refuses to approve after the start day, before any Stripe call", async () => {
  mockGetRentalRequestById.mockResolvedValue(
    createMockRentalRequest({
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }),
  );

  await expect(
    RentalService.approveRentalRequest("req-1", "owner-1", {}, context),
  ).rejects.toThrow(BookingStartPassedError);
  expect(mockGetOrCreateStripeCustomerId).not.toHaveBeenCalled();
  expect(mockChargeRentalPayment).not.toHaveBeenCalled();
});
```

In `service-booking-service.test.ts`, inside `describe("acceptBooking", ...)`
(after Step B4's fake clock is in place):

```ts
it("refuses to accept once the scheduled instant has passed (BIZ-10)", async () => {
  vi.setSystemTime(new Date("2025-06-16T10:00:00Z")); // a day after proposedDate
  mockBookingGetById.mockResolvedValue(bookingPending);

  await expect(
    ServiceBookingService.acceptBooking("book-1", "prov-1", ctx),
  ).rejects.toThrow(BookingStartPassedError);
  expect(mockChargeServicePayment).not.toHaveBeenCalled();
});

it("still allows accept when the schedule cannot be read", async () => {
  vi.setSystemTime(new Date("2025-06-16T10:00:00Z"));
  mockBookingGetById.mockResolvedValue({
    ...bookingPending,
    proposedTime: "whenever",
  });
  // ...arrange the happy-path mocks as the existing "charges and sets
  // accepted on success" test does...

  await ServiceBookingService.acceptBooking("book-1", "prov-1", ctx);
  expect(mockChargeServicePayment).toHaveBeenCalled();
});
```

Import `BookingStartPassedError` from `@/dal/errors` in both test files.

**Verify**: `bun run test:run src/features/rentals/services/__tests__/rental-service.approve.test.ts src/features/services/__tests__/service-booking-service.test.ts` → all pass.

---

## Part C — CONC-03 (service half): CAS the service decline

### Step C1: Make decline a compare-and-swap

In `service-booking-service.ts`, replace the plain update at `:618-622`:

```ts
const updated = await serviceBookingDAL.update(bookingId, {
  status: "declined",
  declinedAt: new Date(),
  declineReason: trimmed,
});
```

with the same pattern `cancelBooking` already uses (`:772-782`):

```ts
const updated = await serviceBookingDAL.updateIfStatus(
  bookingId,
  detail.status,
  {
    status: "declined",
    declinedAt: new Date(),
    declineReason: trimmed,
  },
  { blockWhilePaymentProcessing: true },
);
if (!updated) {
  throw new ConflictError(
    "This booking changed state while declining — refresh and try again.",
  );
}
```

`detail.status` is already narrowed to `"pending" | "payment_failed"` by the
precondition check above it (`:614-616`), so this single CAS covers both
starting statuses — no signature change to `updateIfStatus` needed.
`ConflictError` is already imported in this file.

**Verify**: `bun run type-check` → exit 0.

### Step C2: Unit test

In `service-booking-service.test.ts`'s `describe("declineBooking", ...)`
block, add:

```ts
it("refuses to decline while an accept-charge claim is held (CONC-03)", async () => {
  mockBookingGetById.mockResolvedValue(bookingPending);
  mockBookingUpdateIfStatus.mockResolvedValue(null); // CAS lost

  await expect(
    ServiceBookingService.declineBooking(
      "book-1",
      "prov-1",
      "Not available",
      ctx,
    ),
  ).rejects.toThrow(ConflictError);
  expect(mockBookingUpdateIfStatus).toHaveBeenCalledWith(
    "book-1",
    "pending",
    expect.objectContaining({ status: "declined" }),
    { blockWhilePaymentProcessing: true },
  );
});
```

**Verify**: `bun run test:run src/features/services/__tests__/service-booking-service.test.ts` → all pass.

### Step C3: Real-DB race test

New file `src/features/services/services/__tests__/service-decline-accept-race.integration.test.ts`, modeled directly on
`src/features/rentals/services/__tests__/rental-approval-pending-gate.integration.test.ts`'s
final race test:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

const mockChargeServicePayment = vi.fn();
vi.mock("@/services/stripe/service-payments", () => ({
  chargeServicePayment: (...a: unknown[]) => mockChargeServicePayment(...a),
  createServiceTransfer: vi.fn(),
}));

const mockGetStripeCustomerContext = vi.fn();
vi.mock("@/services/stripe/payment-method", () => ({
  getStripeCustomerContext: (...a: unknown[]) =>
    mockGetStripeCustomerContext(...a),
}));

const mockAssertConnectReady = vi.fn();
vi.mock("@/features/payments/lib/assert-connect-ready", () => ({
  assertConnectReady: (...a: unknown[]) => mockAssertConnectReady(...a),
}));

vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { serviceBookingDAL } from "@/dal";
import { ConflictError } from "@/dal/errors";
import { ServiceBookingService } from "../service-booking-service";
import {
  createUser,
  createServiceListing,
  createServiceBooking,
} from "@/test/integration/factories";
import {
  raceTwo,
  expectExactlyOneFulfilled,
} from "@/test/integration/run-concurrently";

const { serviceBookings } = schema;
const reload = async (id: string) =>
  (
    await db.select().from(serviceBookings).where(eq(serviceBookings.id, id))
  )[0];

async function pendingBooking() {
  const provider = await createUser({ stripeConnectedAccountId: "acct_race" });
  const requester = await createUser();
  const listing = await createServiceListing(provider.id);
  const booking = await createServiceBooking(listing, requester.id);
  return { provider, requester, booking };
}

describe("service decline vs accept (CONC-03, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertConnectReady.mockResolvedValue(undefined);
    mockGetStripeCustomerContext.mockResolvedValue({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
    });
    mockChargeServicePayment.mockResolvedValue({
      paymentIntent: { id: "pi_race", status: "succeeded" },
      chargeId: "ch_race",
    });
  });

  it("will not decline a booking whose accept charge is claimed", async () => {
    const { booking } = await pendingBooking();
    expect(await serviceBookingDAL.claimForAcceptance(booking.id)).toBe(true);

    await expect(
      ServiceBookingService.declineBooking(
        booking.id,
        booking.providerId,
        "Not available",
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toThrow(ConflictError);
    expect((await reload(booking.id)).status).toBe("pending");
  });

  it("lets exactly one of decline and accept's claim win a real race", async () => {
    const { provider, booking } = await pendingBooking();

    const { results } = await raceTwo(
      async () => {
        await ServiceBookingService.declineBooking(
          booking.id,
          provider.id,
          "Not available",
          { ipAddress: null, userAgent: null },
        );
        return "declined" as const;
      },
      async () => {
        if (!(await serviceBookingDAL.claimForAcceptance(booking.id))) {
          throw new Error("claim lost");
        }
        return "claimed" as const;
      },
    );

    const { fulfilled } = expectExactlyOneFulfilled(results);
    const stored = await reload(booking.id);
    if (fulfilled.value === "declined") {
      expect(stored.status).toBe("declined");
      expect(stored.paymentStatus).toBeNull();
    } else {
      expect(stored.status).toBe("pending");
      expect(stored.paymentStatus).toBe("processing");
    }
  });
});
```

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration src/features/services/services/__tests__/service-decline-accept-race.integration.test.ts` → both tests pass.

---

## Part D — BIZ-09: let `payment_failed` service bookings be cancelled and expire

### Step D1: Let the requester (and provider) cancel a `payment_failed` booking

In `booking-cancellation.ts`, `assessServiceCancellation` (`:52-90`):

```ts
if (
  booking.status !== "pending" &&
  booking.status !== "accepted" &&
  booking.status !== "payment_failed"
) {
  return {
    canCancel: false,
    code: "NOT_CANCELLABLE",
    message: "Booking cannot be cancelled",
  };
}
...
return {
  canCancel: true,
  cancelledBy: isRequester ? "requester" : "provider",
  // payment_failed never moved money — same "nothing to give back" path as pending.
  path: booking.status === "accepted" ? "accepted" : "pending",
};
```

No change needed to `cancelBooking` itself: it already reads `detail.status`
and passes it straight into `updateIfStatus`'s CAS and into
`serviceRefundTierFor`'s existing `"pending"` handling.

**Verify**: `bun run type-check` → exit 0.

### Step D2: Expire stale `payment_failed` bookings

In `service-booking.dal.ts`, `findPendingExpired` (`:282-317`) and
`markExpired` (`:330-352`) both currently gate on `eq(status, "pending")`
and `isNull(paymentStatus)` — the second condition alone excludes every
`payment_failed` row, since their `paymentStatus` is `"failed"`, not
`null`. Change both queries' status predicate to
`inArray(serviceBookings.status, ["pending", "payment_failed"])`, and
widen the payment-status guard to allow exactly `"failed"` as well, the
same predicate `claimForAcceptance` uses (`service-booking.dal.ts:257-261`):

```ts
or(
  isNull(serviceBookings.paymentStatus),
  eq(serviceBookings.paymentStatus, "failed"),
);
```

**Do not use `ne(paymentStatus, "processing")`.** That would also match
`"succeeded"`, and a booking left `pending` with a succeeded charge (a
post-charge persistence failure, which plan 005's stale-claim detector
reports) would then be expired with the money still captured and no refund.
An allowlist fails closed.

(`inArray`, `or`, `eq` are already imported in this file.)

**Verify**: `bun run type-check` → exit 0.

### Step D3: Tests

`booking-cancellation.test.ts`:

- Remove `"payment_failed"` from the "refuses every status the action
  refuses" list (`:41-46`).
- Add: `assessServiceCancellation({...BOOKING, status: "payment_failed"},
"requester-1")` → `{canCancel: true, cancelledBy: "requester", path:
"pending"}`.

`service-booking.dal.test.ts`:

- Update `markExpired`'s existing assertion (`:285-287`) — the WHERE no
  longer renders as exactly `"service_bookings"."payment_status" is null`;
  update it to check for the OR'd fragment: assert the SQL contains both
  `is null` and `= $n` bound to `'failed'`, and contains no `<>` on
  `payment_status`.
- Add a new case to `markExpired`: a `payment_failed` row with
  `expiresAt` in the past is matched (assert the rendered WHERE's status
  fragment is `in ($1, $2)` bound to `'pending'`/`'payment_failed'`, not a
  bare `= 'pending'`).
- Add a `describe("findPendingExpired", ...)` block with the same two
  assertions (status `inArray`, guard OR) against that method's WHERE.

**Verify**: `bun run test:run src/features/services/lib/__tests__/booking-cancellation.test.ts src/dal/__tests__/service-booking.dal.test.ts` → all pass.

---

## Part E — DB-03: per-user conversation delete

### Step E1: Schema

In `messages.schema.ts`, next to `user1Archived`/`user2Archived`
(`:29-30`), add:

```ts
user1DeletedAt: timestamp("user1_deleted_at"),
user2DeletedAt: timestamp("user2_deleted_at"),
```

Generate the migration: `bun run db:generate --name=conversation_per_user_delete`.
Confirm it is two plain `ALTER TABLE "conversations" ADD COLUMN
"user1_deleted_at" timestamp;` / `..."user2_deleted_at"...` statements — no
data prep needed (nullable, defaults `NULL` = "not deleted").

**Verify**: `bun run type-check` → exit 0; migration file exists under
`src/db/migrations/`.

### Step E2: Soft-delete for the caller; hard-delete once both have

In `messages.dal.ts`, replace `deleteConversation` (`:943-961`):

```ts
async deleteConversation(
  conversationId: string,
  userId: string,
): Promise<{ hardDeleted: boolean }> {
  const { data, error } = await tryCatch(
    (async () => {
      const conversation = await this.requireParticipant(
        conversationId,
        userId,
      );
      const isUser1 = conversation.user1Id === userId;

      const [updated] = await this.db
        .update(conversations)
        .set(
          isUser1
            ? { user1DeletedAt: new Date() }
            : { user2DeletedAt: new Date() },
        )
        .where(eq(conversations.id, conversationId))
        .returning();

      const otherAlreadyDeleted = isUser1
        ? updated.user2DeletedAt != null
        : updated.user1DeletedAt != null;

      if (otherAlreadyDeleted) {
        // Both sides are gone — nothing left to preserve for either.
        await this.db
          .delete(conversations)
          .where(eq(conversations.id, conversationId));
        return { hardDeleted: true };
      }
      return { hardDeleted: false };
    })(),
  );

  if (error) {
    this.handleError(error, "deleteConversation");
  }
  return data;
}
```

The route (`messages/conversations/[conversationId]/route.ts:84-90`) does
not need to change: it already ignores the resolved value and returns
`{success: true}`.

### Step E3: Exclude the caller's deleted conversations from their inbox

In `getUserConversationsPaginated` (`:503-550`), add a fourth condition
inside the outer `and(...)`, alongside the existing `archived` ternary:

```ts
or(
  and(eq(conversations.user1Id, userId), isNull(conversations.user1DeletedAt)),
  and(eq(conversations.user2Id, userId), isNull(conversations.user2DeletedAt)),
),
```

Apply the same per-caller `deletedAt` filter to `getUnreadMessageCount`
(`:968`). Otherwise unread messages in a thread the caller deleted keep the
inbox badge lit with nothing to open.

### Step E4: A new message revives the thread for both sides (Decision D2)

In both `sendMessageToUser` (`:454-457`) and `sendMessageInConversation`
(`:880-883`), the existing `lastMessageAt` update becomes:

```ts
.update(conversations)
.set({ lastMessageAt: new Date(), user1DeletedAt: null, user2DeletedAt: null })
.where(eq(conversations.id, conversation.id)); // or conversationId
```

**Verify (E2-E4)**: `bun run type-check` → exit 0.

### Step E5: Tests

In `messages.dal.test.ts`'s `describe("deleteConversation", ...)`:

- Keep the existing "throw error when user not participant" test.
- Replace "should delete conversation when user is participant" with two
  cases:
  - The other participant has **not** deleted it: mock the `.returning()`
    result as `[{...mockConversation, user1Id: userId, user1DeletedAt: new
Date(), user2DeletedAt: null}]` → `db.delete` is **not** called; result
    is `{hardDeleted: false}`.
  - The other participant **already** deleted it: `.returning()` resolves
    `[{...mockConversation, user1Id: userId, user1DeletedAt: new Date(),
user2DeletedAt: <past Date>}]` → `db.delete` **is** called; result is
    `{hardDeleted: true}`.

**Verify**: `bun run test:run src/dal/__tests__/messages.dal.test.ts` → all pass.

---

## Test plan (all parts)

- **Part A**: unit tests prove a failed payment/lifecycle write still
  returns `success: true` and pages ops via `sendOpsAlert`.
- **Part B**: unit tests prove approve/accept refuse before any Stripe call
  once the start/instant has passed, and still allow an unreadable service
  schedule through.
- **Part C**: a unit test pins the CAS shape; a real-Postgres test proves
  exactly one of a concurrent decline/accept wins.
- **Part D**: unit tests prove a `payment_failed` booking is cancellable
  (requester, `path: "pending"`) and that both expiry queries now include
  it, without matching a `processing` or `succeeded` row.
- **Part E**: unit tests prove a single-sided delete is reversible (no hard
  delete, `hardDeleted: false`) and a second-sided delete is not
  (`hardDeleted: true`).

Run `bun run test:run` (plus the Part C integration command) before calling
this plan done.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including every new case above
- [ ] Part C's real-DB race test passes against a real Postgres
- [ ] `bun run db:generate` (Part E) produced exactly one migration with two
      `ADD COLUMN` statements; reviewed
- [ ] Each part's own Verify line has been run and passed independently
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
- [ ] Mobile client follow-ups rows added (Part B's new code; see Mobile
      compatibility below for exact row text)
- [ ] Production cutover row added for Part E's migration (see below)

## STOP conditions

- Excerpts above don't match live code (drift since `25e2233`).
- Any of the five parts' existing tests still fail after the fixture fix in
  Step B4 alone (before the new checks are added) — investigate the fixture
  mismatch itself rather than adjusting the new check to compensate.
- `bun run db:generate` (Part E) produces anything other than two plain
  `ADD COLUMN` statements.
- Any step's test fails twice after a reasonable fix attempt.
- A part's Steps conflict with a sibling plan that landed after `25e2233`
  and touches the same lines (re-read "Current state" for that part before
  continuing; do not silently merge).

## Mobile compatibility

Checked `hoador-mobile/src/api/contract/` and grepped
`hoador-mobile/src` for call sites of every touched route.

- **Part A (BIZ-12)**: no response shape change. `POST
/api/rentals/[id]/approve`'s success body is unchanged; failures surface
  only as an ops email, never to the client.
- **Part B (BIZ-10)**: new `409 {error, code: "BOOKING_START_PASSED"}` on
  `POST /api/rentals/[id]/approve` and `POST
/api/services/bookings/[id]/accept`. Additive. Verified safe without an
  app update: `hoador-mobile/src/features/rentals/lib/approve-outcome.ts`'s
  `classifyApproveError` falls through an unrecognized code to
  `error.kind === 'conflict'` → `{kind: 'unavailable', message:
"This request can no longer be answered. Pull to refresh for its current
state."}`; `hoador-mobile/src/features/services/lib/accept-outcome.ts`
  has the equivalent fallback. **Add a Mobile client follow-ups row**:
  | Fix | Contract change | Where the app sees it | Mobile task | Status |
  |---|---|---|---|---|
  | R-BIZ-09 (BIZ-10) | `409 {code: BOOKING_START_PASSED}` | rental approve, service accept | — | TODO (optional: specific copy in `approve-outcome.ts`/`accept-outcome.ts`) |
- **Part C (CONC-03)**: a losing decline CAS now returns a generic `409
{error}` (no code) instead of previously always succeeding. New failure
  path (an already-claimed booking can no longer be silently declined out
  from under an in-flight accept); falls to the app's existing generic
  conflict handling. No shape change on the success path.
- **Part D (BIZ-09)**: `POST /api/services/bookings/[id]/cancel` on a
  `payment_failed` booking now **succeeds** (previously 400
  `ValidationError`). This is additive (a previously-refused call now
  works), but the mobile app currently hides the Cancel button for this
  exact status: `hoador-mobile/src/features/services/components/service-booking-detail-screen.tsx:174`
  computes `canOfferCancel = !isProvider && (isPending || data.status ===
'accepted')` — `payment_failed` is excluded. **Add a Mobile client
  follow-ups row**:
  | Fix | Contract change | Where the app sees it | Mobile task | Status |
  |---|---|---|---|---|
  | R-BIZ-09 (BIZ-09) | `cancel` now succeeds on `payment_failed` (was 400) | requester's booking detail screen | — | TODO: add `payment_failed` to `canOfferCancel` |
- **Part E (DB-03)**: `DELETE /api/messages/conversations/[id]`'s response
  shape is unchanged (`{success: true}`). No app update needed — the app
  never calls this route today, precisely because of the bug this plan
  fixes (see "Current state"). This is worth flagging to the mobile team as
  an unblock, not a follow-up row: once this lands, `conversations.contract.ts`'s
  comment ("hard, two-sided delete... no soft-delete and no way back
  (F17)") and `conversation-actions-sheet.tsx`'s decision note (D-E11-5) are
  both stale and describe a fixed bug — a future mobile task could add a
  real Delete action against the now-safe endpoint.

## Production cutover

Add to `13-production-cutover.md`'s migration table (M-row, next free
letter/number after M3):

| Migration                                         | Fix              | Notes                                                                                                              |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `<next free number>_conversation_per_user_delete` | R-BIZ-09 (DB-03) | No data prep: two nullable `ADD COLUMN` statements, existing rows read as `NULL` = "not deleted for either party." |

No ops-check or backfill needed for any other part: Parts A-D are pure code
changes with no persisted-state cleanup (BIZ-12's ops alerts are forward-
looking; BIZ-10/CONC-03/BIZ-09 change validation logic only, not stored
data).

## Maintenance notes

- Part A's ops alerts are the detection mechanism the finding asked for;
  there is still no admin action to _resolve_ a flagged reconciliation gap
  (create the missing payment/lifecycle row by hand) — that is deliberately
  out of scope here, same posture as the existing
  `detect-stale-charge-claims` cron (plan 005) and R-BIZ-05's alert-only
  fixes.
- Part B's `BookingStartPassedError` is intentionally shared across both
  domains (like `CounterpartyUnavailableError`) rather than split into
  `RENTAL_`/`SERVICE_`-prefixed codes — keep it that way if a future plan
  adds a third booking type, rather than forking the code.
- Part D leaves `expiresAt` itself untouched (see Scope) — if a future plan
  tightens it to the booking start, re-check `expirePendingBookings`'
  per-row notification copy (`expire-pending-bookings.ts`), which currently
  assumes "the owner/provider did not respond in time," not "the start
  already passed."
- Part E's revival-on-send behavior (D2) means `findOrCreateConversation`
  does not need its own delete-aware branch — sending is the only place a
  deleted thread can come back to life, and every send path already runs
  through one of the two updated `.set(...)` calls.
