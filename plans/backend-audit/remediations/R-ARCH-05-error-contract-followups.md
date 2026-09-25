# Plan R-ARCH-05: Stop three routes from leaking raw Stripe/DAL messages and fix a wrong-status regression

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/lib/api/route-helpers.ts src/app/api/stripe/attach-payment-method/route.ts src/app/api/stripe/set-default-payment-method/route.ts src/app/api/rentals/[id]/instructions/route.ts src/app/api/rentals/[id]/instructions/__tests__/route.test.ts src/app/api/messages/unread-count/route.ts src/services/stripe/rental-payments.ts src/lib/api/__tests__/route-helpers.test.ts`
> On any change, re-read the affected file before editing it; a mismatch is
> a STOP condition.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW (status-code and message
  changes only, no new columns/migrations) · **Depends on**: none (builds on
  `R-SEC-16`, DONE — re-read `route-helpers.ts` before Step 1, since that
  plan is the last thing to touch its `handleApiError`/`shouldCaptureError`)
- **Category**: bug (error-handling contract) / security (info disclosure)
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: ARCH-05 (the remaining slice: raw Stripe/DAL message
  passthrough on 3 routes, and a wrong-status regression on 1 of them — the
  drizzle-wrapping and generic-message-leak slice was already fixed by
  `R-SEC-16`; the substring-matching-on-`error.message` slice in
  `approve`/`cancel`/`no-show` stays out of scope, deferred to Phase 3
  `ARCH-01`/`ARCH-03` per `R-SEC-16`'s own scope note)

## Why this matters

`R-TEST-09` (roadmap row 32) added route tests for `rentals/[id]/instructions`
and found, but didn't fix, three live bugs it wasn't scoped to touch:

1. `stripe/attach-payment-method` and `stripe/set-default-payment-method`
   build their own 500 response with `error?.message` straight from a raw
   Stripe SDK exception — bypassing `handleApiError` entirely, so neither
   route gets Sentry visibility on failure, and a `StripeInvalidRequestError`
   (which can describe internal request shape, not just "card declined") can
   reach the client verbatim. This is the same class of bug `R-SEC-16` fixed
   for DAL/generic errors; these two routes route around that fix by never
   calling `handleApiError` at all.
2. `rentals/[id]/instructions` wraps both its DAL calls in `tryCatch` and
   builds its own responses instead of letting the DAL's typed errors reach
   its existing `catch (error) { return handleApiError(error); }`. Result:
   any DAL error on the fetch surfaces as a flat 404 with the raw message,
   and any error on the update surfaces as a flat 400 — so a `ConflictError`
   (wrong rental status) comes back as **400, not 409**, which is what
   `R-TEST-09` pinned as "today's behaviour" in
   `instructions/__tests__/route.test.ts:118-128`. This plan fixes the bug
   and must flip that pin.

A repo-wide sweep for the same shape (`grep -rln "error\.message\|err\.message"
src/app/api --include=route.ts`, then reading every non-cron/internal hit)
found one more: `messages/unread-count` has the identical bypass pattern.
Everything else the grep turned up is either already safe (curated,
hardcoded strings; see "Verified clean") or explicitly out of scope
(`approve`/`cancel`/`no-show`'s substring-matching, and internal/cron routes'
bearer-secret-gated JSON, both already carved out by `R-SEC-16`).

## Current state

- `src/lib/api/route-helpers.ts:298-303` — `handleApiError`'s `DALError`
  branch (already safe post-`R-SEC-16`). `:305-329` — the generic
  `error instanceof Error` fallback: `:308-320` curated substring matches
  (`"not found"` → 404, `"Unauthorized"`/`"Authentication"` → 401, both
  return `error.message` — safe today because only app-thrown `Error`s with
  those exact curated substrings reach this far in practice), then `:322-329`
  a generic 500 `"An unexpected error occurred"` for anything else — this
  comment already anticipates the gap this plan closes: _"could be a raw
  driver error … or an unwrapped Stripe error"_. `:68-94` — the
  `shouldCaptureError` skip-list (errors that are expected user outcomes,
  never sent to Sentry in production); `StripeCardError` (a declined card)
  belongs on this list — it isn't yet.
- `src/services/stripe/rental-payments.ts:143-186` — `getPaymentErrorMessage(error)`,
  an existing, already-tested, cross-domain helper (already imported outside
  its own domain by `src/features/services/services/service-booking-service.ts`)
  that maps every `Stripe.errors.*` subclass to a curated, safe message and
  falls back to `error.message` for any other `Error`. Two problems with
  importing it into `route-helpers.ts` as-is:
  - **Import side effect.** `rental-payments.ts:2` imports
    `PAYMENT_SERVER_INSTANCE` from `./server`, and `src/services/stripe/server.ts:6`
    **throws `STRIPE_SECRET_KEY is not set` at module load**. `route-helpers.ts`
    is imported by nearly every route and route test; vitest sets no Stripe
    key (`vitest.config.mjs` `env` has only OpenCage and Resend). Importing
    `rental-payments` from `route-helpers` would make every such test file
    fail at import unless it happens to mock `@/services/stripe/server`.
    (Verified: importing the admin routes that touch Stripe without the key
    throws exactly this.)
  - **The fallback is not curated for every Stripe subclass.** It maps
    `StripeCardError`, `StripeRateLimitError`, `StripeInvalidRequestError`,
    `StripeAPIError`, `StripeConnectionError`, `StripeAuthenticationError`;
    `stripe@22.2.0` also has `StripePermissionError`,
    `StripeIdempotencyError`, `StripeSignatureVerificationError` and the
    OAuth errors, which fall through to `return error.message` — the raw
    SDK text (a permission error names the key and account). Step 1 wraps
    it so that can't reach a response. `StripeCardError`'s own `default:`
    branch returns `error.message`, which is Stripe's customer-facing
    decline text and fine to show.
- `src/app/api/stripe/attach-payment-method/route.ts:41-50` and
  `set-default-payment-method/route.ts:40-50` — both call their service
  function via `tryCatch`, then on `error` build
  `NextResponse.json({ error: error?.message || "Failed to …" }, { status: 500 })`
  directly, never touching `handleApiError` (which both files already
  import and use in their outer `catch`, so it's a two-line fix, not a new
  import). `src/services/stripe/payment-method.ts:44-57,64-76`
  `attachPaymentMethod`/`setDefaultPaymentMethod` let Stripe SDK errors
  propagate unmodified — nothing upstream of the route sanitizes them.
- `src/app/api/rentals/[id]/instructions/route.ts:59-68` (fetch) and
  `:82-98` (update) — both `tryCatch`-wrapped, both build a manual response
  from `fetchError?.message`/`updateError?.message`. The DAL calls
  underneath (`src/dal/rentals.dal.ts:671-772` `getRentalRequestById`, throws
  `NotFoundError` — never returns `null`; `:2233-2344` `updateRentalInstructions`,
  throws `NotFoundError("Rental not found")` if the row is gone or
  `ConflictError("Instructions can only be updated for approved or active
rentals")` if the status check fails, both via `this.handleError(error, …)`
  which (post-`R-SEC-16`) re-throws an already-typed error unchanged and
  wraps anything else into a safe generic `DALError`) already throw the
  right typed errors — the route just never lets them reach `handleApiError`.
  `instructions/__tests__/route.test.ts:90-98` mocks
  `getRentalRequestById` to **resolve `null`** (matching today's route code,
  not the DAL's real contract) and `:118-128` pins a 400 for a
  `ConflictError` rejection, with a comment explicitly citing this drift
  from `R-TEST-09`'s original plan.
- `src/app/api/messages/unread-count/route.ts:28-38` — same shape: `tryCatch`
  around `messagesDAL.getUnreadMessageCount(userId)`, manual
  `{ error: error.message || "Failed to fetch unread message count" }` at
  500, `handleApiError` imported and used in the outer catch but never
  reached for this error. Route is `@deprecated` in its own doc comment
  (superseded by `GET /api/dashboard/badges`) but still live; confirmed zero
  mobile call sites (`grep -rn "unread-count" hoador-mobile/src` — the only
  hit is a comment noting the deprecation, in `conversations.contract.ts:34`).

**Verified clean (sweep, not touched by this plan):**

- `admin/rentals/[id]/no-show/route.ts:55-77` — reads like the same shape
  (`result.error.message`) but every branch already matches the error's real
  type (`NotFoundError`→404, `ForbiddenError`→403, `ValidationError`→400,
  with `handleApiError(result.error)` as the fallback) and returns only
  already-curated DAL messages — no leak, no wrong status. Needlessly
  duplicates what `handleApiError` would do for free, but that's a
  simplification opportunity, not a bug; left alone.
- `auth/forgot-password/route.ts:58-77`, `auth/resend-verification/route.ts:49-77`
  — both read `error.message` only to **branch** (substring match on
  "rate limit"/"already verified"/"not found", the same pattern
  `R-SEC-16` deferred for `approve`/`cancel`), and every returned `error`
  field is a hardcoded, curated string. No raw message ever reaches the
  client.
- `stripe/webhooks/route.ts:65-67` — `error.message` goes into
  `getLogger().error(...)` (server-side structured log) and Sentry, never
  into the HTTP response body (`{ error: "Webhook handler failed" }`, fixed
  string). Not client-facing.
- `admin/users/bulk-actions/route.ts:186,232` — per-row `error` strings in a
  bulk re-engagement job's `results[]` array, visible only to the admin who
  triggered the batch (not an arbitrary end user), and operationally useful
  for diagnosing which recipient's send failed and why. Judged intentional;
  flagged here for the maintainer rather than changed — sanitizing this
  would remove the only diagnostic an admin has for a partial-failure batch.
- Every `cron/*` and `internal/*` route's own JSON `error.message` — bearer-
  secret-gated, server-to-server only, already carved out by `R-SEC-16`.

## Commands

| Purpose        | Command                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                            |
| Lint           | `bun run lint`                                                                                                                                                                                                                  |
| Targeted tests | `bun run test:run src/lib/api/__tests__/route-helpers.test.ts src/app/api/stripe/attach-payment-method src/app/api/stripe/set-default-payment-method "src/app/api/rentals/[id]/instructions" src/app/api/messages/unread-count` |
| Full suite     | `bun run test:run`                                                                                                                                                                                                              |

## Scope

**In scope**: `src/lib/api/route-helpers.ts` (`handleApiError`'s Stripe
branch, `shouldCaptureError`'s skip list); new
`src/services/stripe/payment-error-message.ts` and the re-export in
`src/services/stripe/rental-payments.ts` (Step 1a); `src/app/api/stripe/attach-payment-method/route.ts`;
`src/app/api/stripe/set-default-payment-method/route.ts`;
`src/app/api/rentals/[id]/instructions/route.ts`;
`src/app/api/rentals/[id]/instructions/__tests__/route.test.ts` (flip the
pinned 400→409 test, fix the `null`-vs-throw mock); `src/app/api/messages/unread-count/route.ts`;
new tests for all of the above.

**Out of scope**: `approve`/`cancel`/`admin/rentals/[id]/no-show`'s
substring-matching on `error.message` (Phase 3 `ARCH-01`/`ARCH-03`, per
`R-SEC-16`'s scope note — a shared policy module is the right fix, not a
one-off here); `admin/users/bulk-actions`'s per-row diagnostic messages
(judged intentional, see above); `auth/forgot-password`/`resend-verification`
(already safe); any cron/internal route; changing `getPaymentErrorMessage`'s own
raw-message fallback (its existing callers in `rental-service.ts` and
`service-booking-service.ts` rely on it; this plan's HTTP path goes through
`stripeErrorResponseMessage`, which never returns that fallback for a
Stripe error).

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted for
the maintainer to review and commit.

## Steps

### Step 1: Give `handleApiError` a curated Stripe-error branch

**1a. Move the message mapping somewhere side-effect-free.** Create
`src/services/stripe/payment-error-message.ts` that imports only `Stripe from
"stripe"` (the SDK's error classes; no client construction). Move
`getPaymentErrorMessage` there verbatim, and in `rental-payments.ts` replace
its body with a re-export (`export { getPaymentErrorMessage } from
"./payment-error-message";`) so its existing importers
(`rental-service.ts`, `service-booking-service.ts`) and the tests that mock
`@/services/stripe/rental-payments` keep working unchanged. Add, in the new
file:

```ts
/**
 * For HTTP responses: getPaymentErrorMessage, minus its raw-message
 * fallback. A Stripe subclass it doesn't map (permission, idempotency,
 * signature, OAuth) gets a fixed string instead of the SDK's own text.
 */
export function stripeErrorResponseMessage(
  error: Stripe.errors.StripeError,
): string {
  const message = getPaymentErrorMessage(error);
  if (
    message === error.message &&
    !(error instanceof Stripe.errors.StripeCardError)
  ) {
    return "Payment service error. Please try again.";
  }
  return message;
}
```

**1b.** In `src/lib/api/route-helpers.ts`, add the import (top of file,
alongside the other feature imports):

```ts
import Stripe from "stripe";
import { stripeErrorResponseMessage } from "@/services/stripe/payment-error-message";
```

**Never** import from `@/services/stripe/rental-payments` or anything that
reaches `@/services/stripe/server` here (Current state).

In the `shouldCaptureError` chain (`:68-83`), add one line after the
existing `!(error instanceof ListingDeletionBlockedError) &&` (`:83`):

```ts
    !(error instanceof ListingDeletionBlockedError) &&
    // A declined card is an expected user outcome, not an incident — the
    // curated message below is what the user needs; Sentry doesn't (ARCH-05).
    !(error instanceof Stripe.errors.StripeCardError) &&
```

Add a new branch in `handleApiError` **before** the generic
`if (error instanceof Error)` block at `:305` (Stripe errors extend `Error`,
so this must come first or the generic branch would shadow it):

```ts
  // ARCH-05: raw Stripe SDK errors (attach/set-default payment method, and
  // any future direct-to-Stripe route that funnels its error here) can
  // otherwise carry request/account detail in `.message`. Curated mapping
  // already exists and is used elsewhere (rental-payments.ts) — reuse it.
  if (error instanceof Stripe.errors.StripeError) {
    const ctx = getRequestContext();
    return NextResponse.json(
      {
        error: stripeErrorResponseMessage(error),
        // Same as the generic 500 below: support can find the logged error.
        ...(ctx?.requestId && { requestId: ctx.requestId }),
      },
      { status: 500 },
    );
  }

  // Handle standard Error objects
  if (error instanceof Error) {
```

Leave everything else in the generic `Error` branch untouched — this is
additive, not a replacement.

**Verify**: `bun run type-check` → exit 0.

### Step 2: Route `attach-payment-method` and `set-default-payment-method` through `handleApiError`

In both files, replace the manual 500 block. `attach-payment-method/route.ts:45-50`:

```ts
if (error || !data) {
  return NextResponse.json(
    { error: error?.message || "Failed to attach payment method" },
    { status: 500 },
  );
}
```

becomes:

```ts
if (error || !data) {
  return handleApiError(error ?? new Error("Failed to attach payment method"));
}
```

`set-default-payment-method/route.ts:44-50`:

```ts
if (error) {
  console.error("Error setting default payment method:", error);
  return NextResponse.json(
    { error: error.message || "Failed to set default payment method" },
    { status: 500 },
  );
}
```

becomes:

```ts
if (error) {
  return handleApiError(error);
}
```

(`handleApiError` already does its own `console.error("API error:", error)`
at the top — the route's separate `console.error` becomes redundant.) Both
files already `import { getAuthenticatedUserResponse, handleApiError }` —
no import changes needed.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Fix `rentals/[id]/instructions` — let typed DAL errors reach `handleApiError`

In `src/app/api/rentals/[id]/instructions/route.ts`, remove the `tryCatch`
import (no longer used after this step — confirm nothing else in the file
uses it before deleting the import). Replace `:59-68`:

```ts
const { data: rentalRequest, error: fetchError } = await tryCatch(
  rentalDAL.getRentalRequestById(rentalId, currentUserId),
);

if (fetchError || !rentalRequest) {
  return NextResponse.json(
    { error: fetchError?.message || "Rental request not found" },
    { status: 404 },
  );
}
```

with:

```ts
// getRentalRequestById throws NotFoundError (never resolves null) and
// handleApiError below maps it to 404 with its own safe message
// (ARCH-05 — previously this call was tryCatch-wrapped and returned a
// flat 404 with the raw error message for any failure).
const rentalRequest = await rentalDAL.getRentalRequestById(
  rentalId,
  currentUserId,
);
```

Replace `:82-98`:

```ts
const { data: rentalData, error: updateError } = await tryCatch(
  rentalDAL.updateRentalInstructions(
    rentalId,
    currentUserId,
    validatedData.pickupInstructions,
    validatedData.returnInstructions,
  ),
);

if (updateError || !rentalData) {
  return NextResponse.json(
    {
      error: updateError?.message || "Failed to update instructions",
    },
    { status: updateError ? 400 : 500 },
  );
}
```

with:

```ts
// updateRentalInstructions throws NotFoundError or ConflictError
// (wrong rental status) — handleApiError below maps ConflictError to
// 409, not the flat 400 this route returned before (ARCH-05).
const rentalData = await rentalDAL.updateRentalInstructions(
  rentalId,
  currentUserId,
  validatedData.pickupInstructions,
  validatedData.returnInstructions,
);
```

Every reference to `rentalRequest`/`rentalData` further down the function
(the ownership check, the notification payload) is unchanged — both are now
plain values instead of `{data, error}` results, but already have the same
shape once destructured. The function's own `catch (error) { return
handleApiError(error); }` (unchanged) now does the mapping.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Fix the pinned test (flip 400 → 409, fix the `null`-vs-throw mock)

In `src/app/api/rentals/[id]/instructions/__tests__/route.test.ts`:

The "404s when the rental request doesn't exist" case (`:90-98`) mocks
`mockGetRentalRequestById.mockResolvedValue(null)` — that matched the old
route's `tryCatch` check, but the real DAL method **throws**
`NotFoundError`, never resolves `null` (confirmed in "Current state"). After
Step 3, resolving `null` would reach `rentalRequest.ownerId` on `null` and
throw a `TypeError`, not the DAL's real `NotFoundError` — the test would
still get a non-200 status by accident, but for the wrong reason. Fix the
mock to match the DAL's actual contract:

```ts
it("404s when the rental request doesn't exist", async () => {
  mockGetRentalRequestById.mockRejectedValue(
    new NotFoundError("Rental request", "req-1"),
  );

  const { PATCH } = await import("../route");
  const res = await PATCH(patch(), params());

  expect(res.status).toBe(404);
  expect(mockUpdateRentalInstructions).not.toHaveBeenCalled();
});
```

Add `NotFoundError` to the existing `import { ConflictError } from
"@/dal/errors";` line (`→ import { ConflictError, NotFoundError } from
"@/dal/errors";`).

Flip the pinned 400 test (`:113-128`) to the now-correct 409, and correct
its comment:

```ts
// Instructions now goes through handleApiError like every other rental
// route, so a ConflictError from the DAL surfaces as 409 (ARCH-05 fix —
// previously pinned at 400 per R-TEST-09 executor instructions, since the
// route bypassed handleApiError; see roadmap row 32).
it("409s when the DAL mutation rejects with ConflictError", async () => {
  mockUpdateRentalInstructions.mockRejectedValue(
    new ConflictError("Instructions cannot be updated for this rental."),
  );

  const { PATCH } = await import("../route");
  const res = await PATCH(patch(), params());

  expect(res.status).toBe(409);
  expect((await res.json()).error).toMatch(/instructions cannot be updated/i);
});
```

The remaining three cases (401, 403, 200 happy path) are unaffected — their
mocks already resolve/reject in a way compatible with the new direct-`await`
route code (401 never reaches the DAL call at all; 403 mocks
`getRentalRequestById` to resolve the `FIXTURE` object, matching the DAL's
real success shape; 200 does the same).

**Verify**: `bun run test:run src/app/api/rentals/[id]/instructions` → all 5
cases pass, none pinning a wrong status.

### Step 5: Fix `messages/unread-count`

In `src/app/api/messages/unread-count/route.ts:32-38`, replace:

```ts
if (error) {
  console.error("Failed to fetch unread message count:", error);
  return NextResponse.json(
    { error: error.message || "Failed to fetch unread message count" },
    { status: 500 },
  );
}
```

with:

```ts
if (error) {
  return handleApiError(error);
}
```

(Already imports `handleApiError`; its own `console.error("API error:", …)`
replaces the route's.)

**Verify**: `bun run type-check` → exit 0.

### Step 6: Tests

1. `route-helpers.test.ts` — new cases inside the existing `describe("handleApiError", …)`
   (mirror the file's existing Stripe-adjacent test style; it doesn't
   currently import `stripe`, add `import Stripe from "stripe";`):

   ```ts
   it("maps a StripeCardError to its curated message at 500, not the raw SDK message", async () => {
     const error = new Stripe.errors.StripeCardError({
       type: "card_error",
       code: "insufficient_funds",
       message: "Your card has insufficient funds.", // Stripe's own raw text
     } as any);

     const response = handleApiError(error);

     expect(response.status).toBe(500);
     // getPaymentErrorMessage's curated text for this code, not raw.message.
     expect((await response.json()).error).toBe(
       "Insufficient funds on the payment method.",
     );
   });

   it("maps a StripeInvalidRequestError to a safe message, never the raw SDK text", async () => {
     const error = new Stripe.errors.StripeInvalidRequestError({
       type: "invalid_request_error",
       message: 'No such PaymentMethod: "pm_leaked_internal_detail"',
     } as any);

     const response = handleApiError(error);

     const body = await response.json();
     expect(response.status).toBe(500);
     expect(body.error).not.toContain("pm_leaked_internal_detail");
   });

   it("never returns the raw text of a Stripe subclass getPaymentErrorMessage doesn't map", async () => {
     const error = new Stripe.errors.StripePermissionError({
       type: "invalid_request_error",
       message:
         "The provided key 'rk_live_leak' does not have access to account 'acct_leak'",
     } as any);

     const body = await handleApiError(error).json();
     expect(body.error).toBe("Payment service error. Please try again.");
   });
   ```

   These run with no `STRIPE_SECRET_KEY` set (the vitest default), which is
   itself the check that 1a kept `route-helpers.ts` free of the Stripe
   client import. Also run `bun run test:run src/app/api` once: a module-load
   `STRIPE_SECRET_KEY is not set` failure in any route test means something
   reached `@/services/stripe/server` through `route-helpers`.

   Add `StripeCardError` to the existing `describe("Sentry capture in
production", …)` block's `it.each` **does-not-capture** list (it belongs
   there, not in the "still captures" case) — mirror the file's existing
   `it.each` row format for the other skip-list entries.

2. `attach-payment-method/__tests__/route.test.ts` and
   `set-default-payment-method/__tests__/route.test.ts` (create if they
   don't exist, per `R-TEST-09`'s Part D pattern — check first, since that
   plan's status row says it added real 401/404/200 cases for both; extend
   rather than duplicate): a case where the mocked service function rejects
   with a `Stripe.errors.StripeCardError` → response status 500, body
   `error` is the curated message, **not** the raw Stripe message used in
   the mock rejection.

3. `instructions/__tests__/route.test.ts` — covered by Step 4 above.

4. `unread-count/__tests__/route.test.ts` (create if it doesn't exist — check
   first): 401 unauthenticated; DAL rejects with a generic `Error("boom")` →
   500 with body `{ error: "An unexpected error occurred", ... }` (via
   `handleApiError`'s generic branch, post-`R-SEC-16`), **not** `"boom"`;
   200 happy path with a count.

**Verify**: `bun run test:run src/lib/api/__tests__/route-helpers.test.ts
src/app/api/stripe/attach-payment-method src/app/api/stripe/set-default-payment-method
"src/app/api/rentals/[id]/instructions" src/app/api/messages/unread-count` →
all pass.

## Test plan

Covered by Step 6. Full regression: `bun run test:run` and
`bun run type-check && bun run lint`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including all new/changed test cases
- [ ] `attach-payment-method`/`set-default-payment-method` return
      `stripeErrorResponseMessage`'s curated text on a Stripe error, never
      `error.message` verbatim, including for an unmapped subclass (test)
- [ ] `route-helpers.ts` imports nothing that reaches
      `@/services/stripe/server`; `bun run test:run src/app/api` shows no
      `STRIPE_SECRET_KEY is not set` import failure
- [ ] `rentals/[id]/instructions` returns 409 (not 400) for a `ConflictError`
      from the DAL mutation, and 404 (not a `TypeError`) for a real
      `NotFoundError` on the fetch (test)
- [ ] `messages/unread-count` returns the generic safe 500 body on a DAL
      error, never `error.message` verbatim (test)
- [ ] `grep -rn "error\.message\|err\.message" src/app/api --include=route.ts`
      shows no new client-facing hit beyond the ones this plan explicitly
      left in place (documented in "Verified clean")
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status", and the roadmap row that references
      `R-TEST-09`'s row-32 note about these follow-ups)

## STOP conditions

- Any "Current state" excerpt has drifted since `29fe557` — re-read the live
  file; in particular, re-confirm `getRentalRequestById` still throws rather
  than returning `null`, and that `updateRentalInstructions` still throws
  exactly `NotFoundError`/`ConflictError` before editing the route (Step 3)
  or its test (Step 4).
- `getPaymentErrorMessage` no longer lives at
  `src/services/stripe/rental-payments.ts` or its signature changed —
  re-verify before moving it (Step 1a).
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

**Status-code change**: `PATCH /api/rentals/[id]/instructions` now returns
**409** instead of 400 when the DAL rejects with `ConflictError` (wrong
rental status). Checked `hoador-mobile/src/features/rentals/hooks/use-rental-operations.ts:86-101`
`useUpdateInstructions` — its `onError` callback takes a plain `Error` and
forwards it to a caller-supplied `onError` with no branching on `status`,
`kind`, or `code` anywhere in the hook or its call sites
(`owner-request-actions.tsx`, `owner-operations.tsx`,
`rental-detail-screen.tsx` — confirmed via `grep -n "instructions" -A5` on
each, none inspects the error beyond displaying its message). Mobile's
`ApiError` classifies purely by HTTP status/`code`, never message text
(`hoador-mobile/src/api/errors.ts:1-3` documents this rule explicitly); a
409 becomes `kind: 'conflict'` where a 400 was `kind: 'validation'`, but
since no call site branches on `kind` for this endpoint, and the response
body's `error` string is unchanged (still `ConflictError`'s own curated
message), this is invisible to the user today. **No "Mobile client
follow-ups" row needed** — but if a future mobile screen adds
kind-specific handling for this endpoint, it should treat 409 as the
correct signal for "rental isn't in an editable state," not 400.

**Message-content changes, no status/shape change**:
`attach-payment-method` (web only: `src/features/payments/hooks/use-payment-setup.ts:38`;
mobile never calls it, `use-add-payment-method.ts:69` says so explicitly:
PaymentSheet attaches), `set-default-payment-method` (web
`use-payment-methods.ts:55`, mobile `use-payment-methods.ts:20`) and
`messages/unread-count` (zero mobile call sites — confirmed above) all keep
their existing status code (500) and response shape (`{ error: string }`,
plus `requestId` where the request context has one); only the `error`
string's content changes, from a raw SDK/DAL message to a curated one.
Mobile classifies a 500 as `kind: 'server'` by status alone and never reads
message text (`hoador-mobile/src/api/errors.ts:1-3`). Web throws the string as its
`Error` message (`use-payment-setup.ts:44-46`), so a user now sees "The payment method was declined." instead of
Stripe's raw text. No contract change.

**Side effect on other routes**: any route that already passes a raw
Stripe error to `handleApiError` (rather than wrapping it) used to get
R-SEC-16's generic "An unexpected error occurred" and now gets the curated
Stripe message. Same status (500), same shape. An improvement, and not a
contract change.

**Cross-plan**: R-PERF-04 Part C moves this same `instructions` route's
notification into `after()`. The two edits touch different blocks; whichever
lands second rebases, and the route test then also needs R-PERF-04's
`next/server` `after` mock.

## Production cutover

None. No schema change, no migration, no new env var.

## Maintenance notes

- The Stripe branch added to `handleApiError` in Step 1 is generic — any
  future route that calls `handleApiError(error)` on a raw Stripe error
  (rather than building its own response, the anti-pattern this plan fixes)
  gets the curated message for free. Prefer that over a new bespoke
  try/catch block.
- `approve/route.ts`, `cancel/route.ts`, and `admin/rentals/[id]/no-show`'s
  substring-matching on `error.message` are the deliberately-deferred other
  half of ARCH-05 (Phase 3 `ARCH-01`/`ARCH-03`, a shared claim/transition
  helper and policy module) — when that lands, it should absorb this plan's
  Stripe branch too rather than leaving two parallel error-mapping schemes
  in `route-helpers.ts`.
- `getPaymentErrorMessage`'s own fallback (`if (error instanceof Error)
return error.message;`) still reaches users through its two service
  callers, which put it in payment-failure notifications and errors. For a
  Stripe permission/idempotency error that is raw SDK text. Worth routing
  those callers through `stripeErrorResponseMessage` (or tightening the
  fallback) the next time that code is touched.
- Keep `payment-error-message.ts` import-free apart from `stripe`: it's on
  `route-helpers.ts`'s import graph, which every route and route test loads.
