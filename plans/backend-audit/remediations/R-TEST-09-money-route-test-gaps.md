# Plan R-TEST-09: Add negative, party and state tests for money and payment-method routes

> **Executor instructions**: This is a **test-only** plan — no production code
> changes, except where a test exposes a real, already-live bug. In that one
> case (Parts C, D and F below), pin **today's** behaviour with `it.fails` and
> a comment naming the roadmap item that owns the fix; do not fix the bug
> inline. Follow step by step, run every verification command, and confirm
> the result before moving on. On a STOP condition, stop and report.
>
> **Drift check (run first)**:
> `git diff --stat 25e2233..HEAD -- src/app/api/rentals/[id]/start/route.ts src/app/api/rentals/[id]/decline/route.ts src/app/api/rentals/[id]/instructions/route.ts src/app/api/services/bookings/[id]/accept/route.ts src/app/api/services/bookings/[id]/cancel/route.ts src/app/api/services/bookings/[id]/complete/route.ts src/app/api/services/bookings/[id]/decline/route.ts src/app/api/services/bookings/[id]/payment-lifecycle/route.ts src/features/services/services/service-listing-service.ts src/app/api/services/listings/[id]/deactivate/route.ts src/app/api/services/listings/[id]/reactivate/route.ts src/app/api/stripe/delete-payment-method/route.ts src/app/api/stripe/attach-payment-method/route.ts src/app/api/stripe/set-default-payment-method/route.ts src/services/stripe/payment-method.ts src/features/disputes/services/dispute-resolution-service.ts src/features/disputes/services/dispute-creation-service.ts src/services/better-auth/build-auth-options.ts src/services/better-auth/e2e-google-plugin.ts "src/app/api/auth/[...all]/route.ts" src/app/api/test`
> On any change to a file used in "Current state" below, re-read it before
> writing that part's tests; a mismatch is a STOP condition for that part
> only (the other parts are independent — keep going).
>
> **Before starting Parts C, D or F**, read the "Execution order & status"
> table in `plans/backend-audit/10-remediation-roadmap.md` for rows 1.10
> (moderation/uploads, fixes SEC-10), 1.11 (injection and gating, fixes
> SEC-17) and 1.12 (payment-method and booking projections, fixes SEC-07).
>
> - **Row still TODO/IN PROGRESS**: write the `it.fails` pin exactly as this
>   plan specifies.
> - **Row DONE**: the fix's own plan (search
>   `remediations/R-SEC-10-*.md`, `R-SEC-17-*.md`, `R-SEC-07-*.md`) already
>   added the real test for that behaviour. Skip that specific case here —
>   do not duplicate it — and leave a one-line comment in this plan's PR/diff
>   summary pointing at the commit that landed it. The rest of that Part
>   (the non-overlapping cases) still applies.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: LOW (test-only) · **Depends
  on**: none to start; Parts C/D/F should land after checking 1.10/1.11/1.12
  status (see above)
- **Category**: testing
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: TEST-09, TEST-12, TEST-13, TEST-14, TEST-16

## Why this matters

Six money-moving or account-security routes ship with **zero** tests today
(`rentals/[id]/start`, `/decline`, `/instructions`;
`services/bookings/[id]/accept`, `/cancel`, `/complete`, `/decline`,
`/payment-lifecycle`), so a regression that lets a stranger end a rental,
decline a charged booking without a refund, or read another party's payment
lifecycle would ship silently. `DELETE /api/stripe/delete-payment-method` has
no ownership check at all — any authenticated caller can detach any Stripe
payment method by ID. Service-listing moderation can be bypassed in two
calls (deactivate a `pending_approval`/`denied` listing, then reactivate it)
and one existing test asserts the bypass's first step as correct. The e2e
Google-auth stub's callback endpoint is registered unconditionally and its
own env gate ignores `NODE_ENV`, so if `E2E_TEST` were ever set in production
it would create or sign in as any user with no further check. Dispute
resolution's service-booking refund math (idempotency key, partial-amount
cap, payout reduction, failure-does-not-resolve) has no test at all, and
service-booking dispute filing has no non-party test.

## Current state

All file:line references are live at HEAD (`25e2233`); this plan changes no
production code.

**TEST-12 — rental routes with zero tests:**

- `src/app/api/rentals/[id]/start/route.ts:33-128` — owner check at line 85
  (`rentalRequest.ownerId !== currentUserId`), fetches via
  `new RentalDAL().getRentalRequestById`. No `__tests__` dir exists.
- `src/app/api/rentals/[id]/decline/route.ts:25-151` — owner check at line 73,
  uses the `rentalDAL` singleton from `@/dal`. No `__tests__` dir exists.
- `src/app/api/rentals/[id]/instructions/route.ts:23-126` — owner check at
  line 71, uses the `rentalDAL` singleton. No `__tests__` dir exists.
- Model: `src/app/api/rentals/[id]/end/__tests__/route.test.ts` (mocks
  `@/dal/rentals.dal`'s `RentalDAL` class and
  `@/features/auth/utils/session`'s `getCurrentUserId`/`getCurrentUser`, and
  `requireAuthResponse` from `@/lib/api/route-helpers`). Confirmed still
  true today: this file has **no** 401/403/404 case, only two happy-path
  tests plus a P-E8A-6 body-validation block — exactly what TEST-12
  describes for `end`.

**TEST-12 — 5 service-booking route files with zero tests:**

- `src/app/api/services/bookings/[id]/accept/route.ts:17-58`,
  `.../cancel/route.ts:22-83`, `.../complete/route.ts:17-58`,
  `.../decline/route.ts:19-72` — all four delegate every authz/state check to
  `ServiceBookingService` (`acceptBooking`/`cancelBooking`/
  `completeBooking`/`declineBooking`) and map its throw via `handleApiError`.
  None has a `__tests__` dir.
- `src/app/api/services/bookings/[id]/payment-lifecycle/route.ts:15-73` — its
  **own** inline party check at line 45:
  `if (booking.requesterId !== userId && booking.providerId !== userId) return 403`.
  No `__tests__` dir.
- Model: `src/app/api/services/bookings/[id]/cancellation-preview/__tests__/route.test.ts`
  — mocks `@/features/auth/utils/session` (`getCurrentUserId` +
  `getAuthenticatedUser`) and `@/dal` (`serviceBookingDAL.getById`, etc.),
  imports the real route.

**TEST-09 — service-listing moderation bypass (owned by SEC-10 / roadmap 1.10):**

- `src/features/services/services/service-listing-service.ts:353-373`
  `deactivateListing` — ownership check only (line 359); **no status guard**,
  so a `pending_approval` or `denied` listing can be deactivated.
- `:378-404` `reactivateListing` — checks only
  `existing.status !== "inactive"` (line 387); nothing checks the listing
  was ever approved.
- `src/features/services/__tests__/service-listing-service.test.ts:368-377`
  ("sets inactive for owner") calls `deactivateListing` on the shared
  `listing` fixture, whose `status` is `"pending_approval"` (line 90), and
  asserts the call **succeeds** — i.e. it pins the bypass's first step as
  correct, exactly as TEST-09 describes.
- `src/app/api/services/listings/[id]/deactivate/route.ts` and
  `.../reactivate/route.ts` delegate all authz to the service above and have
  no `__tests__` dir at all.
- Roadmap 1.10 (`R-SEC-10`, not yet drafted as of this plan) is the fix; this
  plan only adds coverage.

**TEST-13 — payment-method routes (IDOR owned by SEC-07 / roadmap 1.12):**

- `src/app/api/stripe/delete-payment-method/route.ts:15-45` — reads
  `paymentMethodId` from a query param and calls
  `detachPaymentMethod(paymentMethodId)` (line 32) with **no check** that the
  payment method belongs to the caller's Stripe customer. No `__tests__`
  dir.
- `src/services/stripe/payment-method.ts:186-190` `detachPaymentMethod` —
  `PAYMENT_SERVER_INSTANCE.paymentMethods.detach(paymentMethodId)`, no
  customer parameter at all.
- `src/app/api/stripe/attach-payment-method/route.ts:17-64` and
  `.../set-default-payment-method/route.ts:15-59` **are** scoped: both pass
  `user.stripeCustomerId` into the Stripe call
  (`customers.update`/`paymentMethods.attach`), and Stripe itself rejects a
  payment method that doesn't belong to that customer. Neither has a
  `__tests__` dir, but neither has the IDOR — only `delete-payment-method`
  does.
- Roadmap 1.12 (`R-SEC-07`, not yet drafted as of this plan) is the fix for
  the IDOR; this plan adds real tests for attach/set-default and pins
  today's IDOR on delete.

**TEST-14 — service-booking dispute paths:**

- `src/features/disputes/services/dispute-resolution-service.ts:286-456`
  `resolveServiceBookingDispute` and `:463-524` `executeServiceRefund` —
  live logic: `favor_renter` → full refund via
  `refunds.create({charge}, {idempotencyKey: "service-refund-{disputeId}"})`
  then `markRefundedAfterDispute`; `partial_provider`/`partial_renter` →
  refund `Math.round(partialAmount * 100)` cents with key
  `"service-refund-{disputeId}-partial"`, then
  `updateProviderPayout(bookingId, currentPayout - partialAmount)`; a
  partial amount exceeding `providerPayout` throws `ValidationError` at
  lines 310-315 **before** any refund call; a refund failure sets
  `refundOperationStatus = "failed"` and throws `ValidationError` (line
  340/382) — `disputeDAL.resolve` is never reached.
- `src/features/disputes/services/__tests__/dispute-resolution-service.test.ts:266-348`
  ("service booking favor_renter") already covers the booking-status CAS
  side effect (cancels an `accepted` booking, leaves `completed` alone, CAS
  loss still resolves) — added by R-BIZ-03. It does **not** assert the
  refund amount, the idempotency key, the partial-amount cap, the payout
  reduction, or the refund-failure path. Those are this plan's scope.
- `src/features/disputes/services/dispute-creation-service.ts:291-462`
  `createServiceBookingDispute` — party check at lines 315-318
  (`isRequester`/`isProvider`, else `ForbiddenError`), freeze at line 450
  (`servicePaymentLifecycleDAL.freezeForDispute`).
- `src/features/disputes/services/__tests__/dispute-creation-service.test.ts`
  (470 lines, cases "34.1"–"34.6b") exercises **only** the `rentalId` branch
  (`createRentalDispute`); grep confirms no test calls `createDispute` with
  `serviceBookingId`. The stranger-filing case is completely untested for
  service bookings.

**TEST-16 — e2e auth stub gating (owned by SEC-17 / roadmap 1.11):**

- `src/services/better-auth/build-auth-options.ts:243` —
  `plugins: [e2eGoogleCallbackPlugin(), expo(), nextCookies()]`, registered
  **unconditionally**, no `NODE_ENV`/`E2E_TEST` guard around the array entry.
- `src/services/better-auth/e2e-google-plugin.ts:28-30` — the plugin's own
  endpoint (`GET /e2e-callback`) checks only
  `process.env.E2E_TEST !== "1"` → 404; it never reads `NODE_ENV`.
- `src/app/api/auth/[...all]/route.ts:15-19` — the route's own
  Google-callback intercept checks **both**
  `NODE_ENV !== "production"` and `E2E_TEST === "1"` before redirecting to
  the plugin endpoint — this specific check is already correct.
- The five `src/app/api/test/*/route.ts` handlers (`last-email`,
  `reset-user`, `create-need`, `set-stripe-connect-state`, `delete-need`)
  **all** already gate on
  `process.env.NODE_ENV === "production" || process.env.E2E_TEST !== "1"`
  → `new Response(null, {status: 404})`, checked first, before any body
  parse or DB call. These are already correct; only untested.
- Net: the only live gap is the plugin endpoint itself ignoring `NODE_ENV`.
  If `E2E_TEST` were ever set in a production environment (audit open
  question 3), `/api/auth/e2e-callback` would still work.

## Commands you will need

| Purpose        | Command                   |
| -------------- | ------------------------- |
| Typecheck      | `bun run type-check`      |
| Lint           | `bun run lint`            |
| Targeted tests | `bun run test:run <path>` |
| Full tests     | `bun run test:run`        |

## Scope

**In scope**: new/extended `__tests__` files for the routes and services
listed above; a small clarifying comment (no assertion change) on the
pre-existing tautological test at
`service-listing-service.test.ts:368-377`. No production source file is
edited by this plan.

**Out of scope**: fixing SEC-10 (1.10), SEC-17 (1.11) or SEC-07 (1.12) — see
the executor instructions above for how to handle overlap; `rentals/[id]/retry-deposit`
(the audit files it as "wiring only", already covered by
`payment-lifecycle-service` tests, and it is not in TEST-12's file list);
TEST-15 (admin handlers), TEST-17–20 (Phase 2/3) — different findings.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes
uncommitted for the maintainer to review and commit.

## Steps

### Part A — TEST-12: rental routes (`start`, `decline`, `instructions`)

For each of the three routes, create
`src/app/api/rentals/[id]/<name>/__tests__/route.test.ts`, modeled on
`end/__tests__/route.test.ts`: mock `@/dal/rentals.dal`'s `RentalDAL` class
(for `start`) or the `@/dal` singleton `rentalDAL` (for `decline`/
`instructions`, matching each route's own import), mock
`@/features/auth/utils/session` (`getCurrentUserId`, and
`getCurrentUser: vi.fn().mockResolvedValue(null)` to avoid the Next request
store), mock `@/lib/api/route-helpers`'s `requireAuthResponse` to resolve
`null` (authenticated) by default, and mock
`@/lib/api/with-request-logging`'s `withRequestLogging` as the identity
function.

Cases per route (fixture: `{id: "req-1", ownerId: "owner-1", renterId: "renter-1", listingName: "Tool", listingId: "list-1"}`):

- **401**: `requireAuthResponse` mock resolves a `NextResponse.json({error}, {status: 401})` → route returns 401; the DAL method (`startRental`/`declineRentalRequest`/`updateRentalInstructions`) is never called.
- **404**: `getRentalRequestById` mock resolves `null` → 404; DAL mutation never called.
- **403**: fixture's `ownerId` is `"owner-1"`, caller is `"renter-1"` → 403 with the route's own "Only the listing owner can…" message; DAL mutation never called.
- **State/wrong-status**: mock the DAL mutation to reject with `new ConflictError(...)` (import from `@/dal/errors`) → 409 via `handleApiError`, mirroring the existing pattern in `end/route.test.ts`'s "returns 409" case.
- One happy-path 200 case per route (owner, valid body) if the file doesn't already have one after the above — `decline` and `instructions` currently have none at all.

**Verify**: `bun run test:run src/app/api/rentals`.

### Part B — TEST-12: 5 service-booking route files

Create `__tests__/route.test.ts` under each of `accept`, `cancel`,
`complete`, `decline` and `payment-lifecycle` in
`src/app/api/services/bookings/[id]/`, modeled on
`cancellation-preview/__tests__/route.test.ts`: mock
`@/features/auth/utils/session` (`getCurrentUserId` + `getAuthenticatedUser`,
same shape as the model file) and `@/lib/api/with-request-logging`.

For `accept`/`cancel`/`complete`/`decline` (all delegate to
`ServiceBookingService`), mock
`@/features/services/services/service-booking-service` wholesale:

```ts
vi.mock("@/features/services/services/service-booking-service", () => ({
  ServiceBookingService: {
    acceptBooking: vi.fn(), // swap per file
  },
}));
```

Cases per route:

- **401**: `getCurrentUserId`/`getAuthenticatedUser` resolve `null` → 401; the service method never called.
- **403 (non-party)**: mock the service method to reject `new ForbiddenError(...)` (`@/dal/errors`) → 403.
- **409/400 (wrong state)**: mock the service method to reject `new ConflictError(...)` / `new ValidationError(...)` as appropriate → 409/400.
- **200 happy path**: mock the service method to resolve (e.g. `{status: "accepted"}`) → 200 with that shape.
- `decline`/`cancel` also need a **400** case for an invalid body (missing required `reason`), since both parse with `declineServiceBookingSchema`/`cancelServiceBookingSchema` before calling the service.

For `payment-lifecycle` (real inline check, no service mock needed), mock
`@/dal`'s `serviceBookingDAL.getById` and `servicePaymentLifecycleDAL.getByBookingId`:

- **401**: unauthenticated → 401.
- **404**: `getById` resolves `null` → 404; `getByBookingId` never called.
- **403**: `getById` resolves a booking where caller is neither `requesterId` nor `providerId` → 403; `getByBookingId` never called (mirror the cancellation-preview model's "does not probe a stranger's booking" assertion).
- **404 (no lifecycle)**: `getById` resolves a booking where caller is the requester, `getByBookingId` resolves `null` → 404.
- **200**: both resolve → 200 with the lifecycle body.

**Verify**: `bun run test:run src/app/api/services/bookings`.

### Part C — TEST-09: service-listing moderation (check 1.10 status first)

1. Add a route test file
   `src/app/api/services/listings/[id]/deactivate/__tests__/route.test.ts`
   and the equivalent for `reactivate`, modeled on Part B's pattern: mock
   `@/features/services/services/service-listing-service`'s
   `ServiceListingService` wholesale. Cases: 401 (unauthenticated); 403
   (mock `ForbiddenError`, covers both "not found" and "not owner" per the
   service's own `if (!existing || existing.providerId !== providerId)`);
   200 happy path (deactivate an `"active"` listing → `inactive`; reactivate
   an `"inactive"` listing → `active`). **Use only these two neutral
   statuses** — do not use `pending_approval`/`denied` fixtures here; that
   is the bypass, handled next.

2. **If roadmap 1.10 is still TODO/IN PROGRESS**: in
   `src/features/services/__tests__/service-listing-service.test.ts`, add a
   comment directly above the existing `"sets inactive for owner"` test
   (line 368) noting it will need to assert a `ValidationError` once 1.10
   lands (do not change its assertion — that's the fix, not this plan). Then
   add a new case in the same `describe("deactivateListing", ...)` block:

   ```ts
   // SEC-10, open until remediation-roadmap item 1.10 adds a status guard.
   // it.fails passes while the bug is present and fails once it is fixed:
   // flip it to `it` in that change.
   it.fails(
     "refuses to deactivate a listing pending or denied moderation (SEC-10, roadmap 1.10)",
     async () => {
       mockListingGetById.mockResolvedValue({
         ...listing,
         status: "pending_approval",
       });

       await expect(
         ServiceListingService.deactivateListing("list-1", "prov-1", ctx),
       ).rejects.toThrow(ValidationError);
       expect(mockListingUpdate).not.toHaveBeenCalled();
     },
   );
   ```

   **If roadmap 1.10 is DONE**: skip this sub-step; confirm `R-SEC-10`'s own
   plan added an equivalent case, and note that commit in your summary
   instead.

**Verify**: `bun run test:run src/app/api/services/listings src/features/services/__tests__/service-listing-service.test.ts`. The `it.fails` case must show as passing (vitest reports `it.fails` tests that fail internally as pass).

### Part D — TEST-13: payment-method routes (check 1.12 status first)

1. Create `src/app/api/stripe/attach-payment-method/__tests__/route.test.ts`
   and `.../set-default-payment-method/__tests__/route.test.ts`, modeled on
   `payment-sheet-params/__tests__/route.test.ts`: mock
   `@/services/stripe/payment-method`'s `attachPaymentMethod`/
   `setDefaultPaymentMethod` (not the Stripe SDK — the route calls the
   service function directly), and `@/features/auth/utils/session`. Cases:
   401; 404 when `user.stripeCustomerId` is null ("No customer account
   found"); 400 when `paymentMethodId` is missing from the body; 200 happy
   path, asserting the service function is called with
   `(user.stripeCustomerId, paymentMethodId, user.id)`.

2. **If roadmap 1.12 is still TODO/IN PROGRESS**: create
   `src/app/api/stripe/delete-payment-method/__tests__/route.test.ts`. Mock
   `@/services/stripe/payment-method`'s `detachPaymentMethod` and
   `@/features/auth/utils/session`. Real cases first: 401; 400 when the
   `id` query param is missing (`detachPaymentMethod` never called); 200
   happy path. Then the pin:

   ```ts
   // SEC-07, open until remediation-roadmap item 1.12 adds an ownership
   // check. it.fails passes while the bug is present and fails once it is
   // fixed: flip it to `it` in that change.
   it.fails(
     "403s a payment method that does not belong to the caller, without detaching it (SEC-07, roadmap 1.12)",
     async () => {
       mockGetAuthenticatedUser.mockResolvedValue({
         user: { id: "user-1", stripeCustomerId: "cus_mine" },
         userId: "user-1",
         isAdmin: false,
       });

       const req = new NextRequest(
         "http://localhost/api/stripe/delete-payment-method?id=pm_belongs_to_someone_else",
         { method: "DELETE" },
       );
       const res = await DELETE(req);

       expect(res.status).toBe(403);
       expect(mockDetachPaymentMethod).not.toHaveBeenCalled();
     },
   );
   ```

   **If roadmap 1.12 is DONE**: skip the pin; confirm `R-SEC-07`'s own plan
   added the real 403 test, and note that commit in your summary. Still add
   the three real cases (401/400/200) if they aren't already covered by
   that plan's tests — check first to avoid duplicating.

**Verify**: `bun run test:run src/app/api/stripe`.

### Part E — TEST-14: service-booking dispute refund and filing

1. In `src/features/disputes/services/__tests__/dispute-resolution-service.test.ts`,
   extend the existing `describe("service booking favor_renter", ...)` block
   (reuse its `arrange` helper and `serviceDispute` fixture):

   - Assert the refund mechanics on the existing `"accepted"` case:
     `PAYMENT_SERVER_INSTANCE.refunds.create` called with
     `({charge: "ch_svc_1"}, {idempotencyKey: "service-refund-dispute-123"})`
     (no `amount` key — full refund).
   - New case: partial amount exceeding `providerPayout` (`arrange`'s
     lifecycle has `providerPayout: "80.00"`) — call `resolveDispute` with
     `outcome: "partial_provider"`, `partialAmount: 90` → rejects
     `ValidationError`; `PAYMENT_SERVER_INSTANCE.refunds.create` never
     called.
   - New case: `outcome: "partial_provider"`, `partialAmount: 30` → refund
     called with `amount: 3000`, key
     `"service-refund-dispute-123-partial"`;
     `servicePaymentLifecycleDAL.updateProviderPayout` called with
     `("booking-123", 50)` (80 − 30);
     `servicePaymentLifecycleDAL.unfreezeAfterResolution` called.
   - New case: refund failure — mock
     `PAYMENT_SERVER_INSTANCE.refunds.create` to reject, outcome
     `favor_renter` → `resolveDispute` rejects `ValidationError`;
     `disputeDAL.resolve` never called;
     `servicePaymentLifecycleDAL.markRefundedAfterDispute` never called.

2. In `src/features/disputes/services/__tests__/dispute-creation-service.test.ts`,
   add a new `describe("service booking disputes", ...)` block: mock
   `serviceBookingDAL.getById` to resolve
   `{id: "booking-1", requesterId: "requester-1", providerId: "provider-1", status: "accepted"}`
   (add whatever additional fields the filing-window check needs to not
   throw first — check `createServiceBookingDispute`'s early returns if the
   party check isn't reached first). Case: `createDispute({serviceBookingId: "booking-1", reasonCode: "damage", description: "Test", userId: "stranger-1"})` → rejects `ForbiddenError`;
   `servicePaymentLifecycleDAL.freezeForDispute` never called;
   `disputeDAL.create` never called (mirror the existing rental "34.2" case).

**Verify**: `bun run test:run src/features/disputes`.

### Part F — TEST-16: e2e auth stub gating (check 1.11 status first)

1. Create `src/app/api/test/__tests__/gating.test.ts`. For each of the 5
   route modules (`last-email`, `reset-user`, `create-need`,
   `set-stripe-connect-state`, `delete-need`), dynamically import the
   handler and assert: with `vi.stubEnv("NODE_ENV", "production")` and
   `vi.stubEnv("E2E_TEST", "1")`, calling the handler with a bodyless
   request returns status 404. Use `it.each` over the 5 module paths. Add
   `afterEach(() => vi.unstubAllEnvs())` (the repo's vitest config has no
   `unstubEnvs` option set, so stubs leak across tests without it).

2. **If roadmap 1.11 is still TODO/IN PROGRESS**: in
   `src/services/better-auth/__tests__/e2e-google-plugin-gating.test.ts`,
   build the real auth instance the way
   `src/services/better-auth/__tests__/apple-sign-in.test.ts` does
   (`betterAuth(buildAuthOptions({database: memoryAdapter({user: [], session: [], account: [], verification: []})}))`),
   then:

   ```ts
   // SEC-17, open until remediation-roadmap item 1.11 gates the plugin on
   // NODE_ENV !== "production". it.fails passes while the bug is present
   // and fails once it is fixed: flip it to `it` in that change.
   it.fails(
     "404s the e2e callback in production even with E2E_TEST=1 (SEC-17, roadmap 1.11)",
     async () => {
       vi.stubEnv("NODE_ENV", "production");
       vi.stubEnv("E2E_TEST", "1");
       const auth = betterAuth(
         buildAuthOptions({
           database: memoryAdapter({
             user: [],
             session: [],
             account: [],
             verification: [],
           }),
         }),
       );

       const response = await auth.handler(
         new Request(
           "http://localhost:3001/api/auth/e2e-callback?e2e_user=x@e2e.test",
         ),
       );

       expect(response.status).toBe(404);
     },
   );
   ```

   Add `afterEach(() => vi.unstubAllEnvs())` here too. **If roadmap 1.11 is
   DONE**: skip this sub-step; confirm `R-SEC-17`'s own plan added the real
   version of this test, and note that commit in your summary.

**Verify**: `bun run test:run src/app/api/test src/services/better-auth`.

## Test plan

Run `bun run test:run` at the end and confirm:

- Every new file above passes.
- Any `it.fails` case reports as passing (it is expected to fail internally;
  vitest reports the wrapping test as pass). If an `it.fails` case reports
  as **failing** the wrapping test, the underlying bug was already fixed
  without the roadmap status table being updated — re-check 1.10/1.11/1.12,
  and if genuinely fixed, convert that case to plain `it` instead of
  reporting a spurious failure.
- No existing test's assertions changed (only the one added comment in
  `service-listing-service.test.ts`).

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including all new files
- [ ] Parts A and B: every listed route has 401/403/404-or-409 negative
      cases plus a happy path
- [ ] Part C: 1.10 status checked; deactivate/reactivate route tests exist;
      the moderation-bypass case exists as `it.fails` or is skipped with a
      documented pointer
- [ ] Part D: 1.12 status checked; attach/set-default tests exist; the
      delete-payment-method IDOR case exists as `it.fails` or is skipped
      with a documented pointer
- [ ] Part E: the 4 new dispute-resolution cases and 1 new dispute-creation
      case exist and pass
- [ ] Part F: 1.11 status checked; the 5-route gating test exists; the
      plugin-endpoint case exists as `it.fails` or is skipped with a
      documented pointer
- [ ] No production source file is modified (`git status` shows only
      `__tests__/*` additions, this plan file, and the one comment in
      `service-listing-service.test.ts`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status")

## STOP conditions

- Any file in "Current state" has drifted since `25e2233` in a way that
  changes the authz/state logic described (not just formatting) — re-read
  it and adjust that Part's tests; don't guess.
- A roadmap-status check for 1.10/1.11/1.12 is ambiguous (e.g. "PARTIAL")
  — treat as "still open" (write the `it.fails` pin) rather than skip, since
  skipping an unfixed bug leaves it unpinned.
- Any test fails twice after a reasonable fix attempt.
- An `it.fails` case passes internally (i.e. the assertion holds today) —
  that means the bug is already fixed and the roadmap table is stale;
  convert to plain `it`, note it in your summary, and do not report a false
  STOP.

## Mobile compatibility

No response shape, status code or error `code` changes anywhere — this
plan adds tests only. For context (not required reading to execute this
plan): `hoador-mobile/src/api/contract/payment-methods.contract.ts` covers
the payment-method routes touched in Part D, and
`hoador-mobile/src/api/contract/dispute-detail.contract.ts` /
`dispute-filing.contract.ts` cover the dispute routes touched in Part E.
None of their shapes change here. If the SEC-07/SEC-10/SEC-17 fix plans
(1.12/1.10/1.11) introduce a new error `code`, that is their contract
change to declare, not this plan's.

## Maintenance notes

- When 1.10, 1.11 or 1.12 lands, grep this plan's output for `it.fails` and
  flip each surviving one to `it` in that change (the fix plans should do
  this as part of their own "Done criteria", but double-check — this plan
  can't enforce it after the fact).
- The comment added to `service-listing-service.test.ts:368` is a pointer
  only; do not let it drift out of sync if 1.10's plan restructures that
  test file.
