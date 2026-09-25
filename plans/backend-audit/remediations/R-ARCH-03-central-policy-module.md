# Plan R-ARCH-03: Central policy module; typed errors instead of substring matching; remove decorative DAL ownership params

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/lib/api/route-helpers.ts src/features/auth/utils/guards.ts src/features/auth/utils/session.ts src/proxy.ts src/dal/rentals.dal.ts src/dal/dispute.dal.ts src/dal/errors.ts src/app/api/rentals/\[id\]/approve/route.ts src/app/api/rentals/\[id\]/decline/route.ts src/features/rentals/services/rental-service.ts src/features/rentals/services/cancellation-service.ts src/features/services/services/service-booking-service.ts src/features/rentals/services/rental-quote.ts src/features/services/services/service-booking-quote.ts src/dal/community.dal.ts src/app/api/users/me/visibility/route.ts`
>
> On any change, compare "Current state" against live code first — this
> plan's investigation corrected the roadmap's own framing of the substring-
> matching problem (see below), so re-verify rather than assume the original
> framing still holds. A mismatch beyond what R-ARCH-01 explains (it edits
> `rentals.dal.ts`/`dispute.dal.ts` around the same time) is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: LOW (mostly moving existing,
  already-correct logic into one module and deleting unused function
  parameters; the one behavior change — typing three plain `Error` throws —
  only affects an already-broken 500/400 split, narrowing it to a correct
  403/400/409) · **Depends on**: none. Coordinates with R-ARCH-01, which also
  edits `rentals.dal.ts` (removes the same decorative `_ownerId`/`_userId`
  params this plan targets happen to sit next to the transitions it migrates)
  and `dispute.dal.ts`'s `updateState` (this plan removes its unused
  `_userId`/`_reason` params; R-ARCH-01 adds a `from`-list guard to the same
  method). **Re-read the live signature of every touched DAL method before
  editing it** — whichever plan lands second will find the other's edits
  already there.
- **Category**: architecture / security · **Planned at**: commit `29fe557`,
  2026-09-25
- **Fixes**: ARCH-03

## Why this matters

"Who may do what, in which account state, and can they see this community's
data" is decided in at least six different places today: a route-helpers
account-status gate, two copy-pasted `assertCounterpartyActive`/`assertRequesterActive`
functions, eight independent call sites of the same community-visibility DB
lookup, one route with a hand-rolled inline ownership check and its own JSON
403, seven DAL method signatures carrying an ownership-shaped parameter that
is silently ignored, and — the one still-broken piece — one route that
recovers its error status codes by testing `error.message` against three
English-language substrings, one of which matches raw Stripe SDK text. None
of this is exploitable on its own (every real check the substring matching
guards is already correct; the DAL params are inert, not permissive), but
each is a place where the next feature can plausibly get the check wrong by
copying the nearest example instead of finding the one true source.

**Correction to the finding's own framing, verified against live code**: the
finding (and the roadmap's Phase 3 outline) describes substring matching as
still present in "approve, cancel and no-show." Only **approve** still has it
— R-SEC-16 or a later plan already migrated `cancel/route.ts` and
`admin/rentals/[id]/no-show/route.ts` to clean `instanceof` typed-error
branches (both backed by `cancellation-service.ts` throwing `NotFoundError`/`ForbiddenError`/`ValidationError`
throughout). Service-booking's accept/decline/cancel routes never had this
problem — `service-booking-service.ts` has thrown typed `ForbiddenError`/`CounterpartyUnavailableError`
consistently since it was written. This plan's scope reflects the corrected,
smaller finding: fix `approve/route.ts` (three substring blocks, one matching
raw Stripe text) and a newly-found sibling with the same defect class,
`decline/route.ts` (a hand-rolled inline ownership check with its own JSON
403, never migrated to a service-layer typed error at all).

## Current state

### 1. Substring matching — only `approve/route.ts`

`src/app/api/rentals/[id]/approve/route.ts` (current lines ~79-93):

```ts
const message =
  result.error instanceof Error ? result.error.message : "An error occurred";
if (message.includes("Forbidden")) {
  return NextResponse.json({ error: message }, { status: 403 });
}
if (
  message.includes("payment method") ||
  message.includes("onboarding") ||
  message.includes("Stripe")
) {
  return NextResponse.json({ error: message }, { status: 400 });
}
return handleApiError(result.error);
```

Root cause is upstream in `src/features/rentals/services/rental-service.ts`,
which throws plain `Error`s instead of typed errors:

- `rental-service.ts` (~419-423): ownership check throws
  `new Error("Forbidden: Only the listing owner can approve rental requests")`.
- `rental-service.ts` (~501-504): `new Error("No payment method on file for renter...")`
  (matches the `"payment method"` branch).
- `rental-service.ts` (~484-486): `new Error(customerError?.message || "Failed to get renter's payment info")` —
  re-throws whatever the Stripe SDK put in `.message` verbatim, which is why
  the route also greps for the unbounded `"Stripe"` substring.
- The `"onboarding"` branch may already be dead: `assertConnectReady` already
  throws a typed `PaymentSetupRequiredError`, handled generically by
  `handleApiError` before this block runs. Confirm by tracing every
  `assertConnectReady` caller before deciding whether to delete the branch or
  replace it — do not assume dead code without checking (Step 3).

**Newly found, same defect class**: `src/app/api/rentals/[id]/decline/route.ts`
(~87-96) does its own inline ownership check with a hand-rolled 403, never
going through a typed error at all:

```ts
if (rentalRequest.listing.ownerId !== userId) {
  return NextResponse.json(
    { error: "Forbidden: Only the listing owner can decline rental requests" },
    { status: 403 },
  );
}
```

and passes `currentUserId` into `rentalDAL.declineRentalRequest(rentalId, denialReason, currentUserId)`'s
decorative third parameter (see §4).

**Already clean, no action needed**: `cancel/route.ts` (~87-106) and
`admin/rentals/[id]/no-show/route.ts` (~59-79) both already do
`instanceof NotFoundError | ForbiddenError | ValidationError` branches backed
by typed throws in `cancellation-service.ts`. `services/bookings/[id]/{accept,decline,cancel}/route.ts`
all just call `handleApiError(error)` directly, backed by
`service-booking-service.ts`'s consistent typed `ForbiddenError`/`CounterpartyUnavailableError` throws.

**Shared substring matching in `route-helpers.ts`** (affects any route that
falls through to it): `handleApiError`'s final `Error` branch (~306-317)
matches `"not found"` → 404 and `"Unauthorized" | "Authentication"` → 401;
`requireAdminResponse` (~468) matches `"Admin"` → the same shape. Both exist
only because `guards.ts`/`session.ts` throw plain `Error("Authentication required")` /
`Error("Admin privileges required")` / `Error("Superadmin privileges required")`.
**Left alone in this plan** — fixing these would mean changing `guards.ts`/`session.ts`'s
error types, which is a bigger, ARCH-05-shaped change with a much wider blast
radius (every route using `requireAuth`/`requireAdmin`) than this finding
asks for. Noted in Maintenance notes as the natural next target once someone
touches those files for another reason.

### 2. `route-helpers.ts` — account-state gate (R-SEC-01/R-PERF-03, already landed)

Current exports include `RestrictedAccountCode`, and (not exported, module-private)
`restrictedStatusCode`, `restrictedAccountResponse`, `unverifiedEmailResponse`,
`authGateResponse` — the account-status/email-verification decision logic
lives entirely inside this HTTP-helpers file today:

```ts
export type RestrictedAccountCode = "ACCOUNT_SUSPENDED" | "ACCOUNT_INACTIVE";

function restrictedStatusCode(user: {
  status?: string | null;
}): RestrictedAccountCode | null {
  if (user.status === "suspended") return "ACCOUNT_SUSPENDED";
  if (user.status === "inactive") return "ACCOUNT_INACTIVE";
  return null;
}

function unverifiedEmailResponse(user: { emailVerified?: boolean | null }) {
  /* ... */
}

function authGateResponse(user, options: AuthGateOptions) {
  const code = !options.allowRestricted && restrictedStatusCode(user);
  if (code) return restrictedAccountResponse(code);
  if (!options.allowUnverifiedEmail) return unverifiedEmailResponse(user);
  return null;
}
```

`AuthGateOptions`'s `allowRestricted`/`allowUnverifiedEmail` are caller-supplied
booleans passed per-route (`getAuthenticatedUserResponse({allowRestricted: true})`)
— there's no central declaration of which routes opt out, each call site
decides. This is exactly "account-state policy" living in what is nominally
an HTTP-shaping file, and the clearest, lowest-risk item to relocate.

### 3. Duplicated counterparty-active checks (R-BIZ-07)

Near-identical private functions in two files:

- `rental-service.ts` (~93-100): `assertCounterpartyActive(userId)` — throws
  `CounterpartyUnavailableError` unless `userDAL.isActiveAccount(userId)`.
  Called at approve (~478, ~546 — a check-then-recheck pair).
- `service-booking-service.ts` (~62-66): `assertRequesterActive(requesterId)` —
  identical body, different name. Called at accept (~315, ~325).

### 4. Decorative DAL ownership params

`src/dal/rentals.dal.ts`:

| Function (line)                   | Signature                                                     | Param referenced anywhere in the WHERE clause? |
| --------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `getRentalRequestById` (671)      | `(requestId: string, _userId?: string)`                       | No                                             |
| `cancelRentalRequest` (1831)      | `(requestId: string, _userId: string, cancellationNotes?)`    | No                                             |
| `approveRentalRequest` (2081)     | `(requestId: string, _ownerId: string, options?)`             | No                                             |
| `declineRentalRequest` (2181)     | `(requestId: string, denialReason: string, _ownerId: string)` | No                                             |
| `getBookedDatesForListing` (2815) | `(listingId: string, _userId?: string)`                       | No                                             |
| `startRental` (2890)              | `(rentalId: string, _ownerId: string, input?)`                | No                                             |
| `endRental` (3047)                | `(rentalId: string, _ownerId: string, input?)`                | No                                             |

Every caller passes the real user id — `rental-service.ts:363,413,775`,
`cancellation-service.ts:52,547`, `decline/route.ts:99-103`, `start/route.ts`,
`end/route.ts` — which is exactly the misleading part: a reader would
reasonably assume these DALs enforce ownership; none of them do. The real
check happens separately, inconsistently: `rental-service.ts:418-423`'s
inline `!==` throw for approve, `decline/route.ts`'s own inline check (§1),
and `start/route.ts:85`/`end/route.ts:106`'s own inline checks.

`src/dal/dispute.dal.ts`:

| Function (line)         | Signature                            | Param referenced?                                                              |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `updateState` (768-776) | `(id, newState, _userId?, _reason?)` | No — its own doc comment (763-764) says "for audit purposes, currently unused" |

`src/app/api/disputes/[id]/state/route.ts` (~83-88) passes the real `userId`
and `reason` from the request body straight into these dropped parameters —
they are not persisted anywhere. This is a minor audit-trail gap in addition
to the decorative-param problem; **fixing the gap (actually recording who
changed a dispute's state and why) is out of scope** — it's a feature, not a
cleanup, and adding it correctly means a schema change (a column or an audit
log row) this plan doesn't need for its stated goal of removing misleading
signatures. Flagged in Maintenance notes.

No other decorative `_owner`/`_user`/`_renter`/`_requester`/`_provider`
params exist elsewhere in `src/dal` (repo-wide grep confirmed).

### 5. Community visibility (R-SEC-08) — eight independent call sites

`communityDAL.isVisibleInCommunity(userId, communityId): Promise<boolean>`
(`community.dal.ts:1039-1056`) is called directly, with no shared wrapper,
from: `rental-quote.ts:144-151` (`COMMUNITY_NOT_VISIBLE` blocker),
`rental-service.ts:458-469` (re-check at approve, throws `CommunityNotVisibleError`),
`service-booking-quote.ts:119-125`, `service-booking-service.ts:298-306`,
`neighborhood-needs-service.ts:327`, and three GET-detail routes
(`needs/[id]/route.ts:50-56`, `listings/[listingId]/route.ts:100-106`,
`services/listings/[id]/route.ts:56-62`). Each site decides its own
error/blocker type on a miss. The visibility **write** path
(`communityDAL.bulkSetVisibility`, `community.dal.ts:1096`, with its
`VisibilityPrimaryLockedError` throw around line 1155) has exactly one caller
(`users/me/visibility/route.ts:89`) and is not part of the duplication
problem — left alone.

The quote-blocker error taxonomy (`ListingNotBookableError`, `ListingArchivedError`,
`ListingNotApprovedError`, `CommunityNotVisibleError`, all extending
`ListingEligibilityError` in `src/dal/errors.ts:240-283`) is already a small,
well-typed policy module in miniature, currently embedded inside
`rental-quote.ts`'s and `rental-service.ts`'s own `ErrorByCode` lookup — a
natural home to extend, not replace.

### 6. `src/features/policy/` and `canBook`/`canActOnBooking`

`ls src/features/policy` → does not exist. No function named `canBook` or
`canActOnBooking` exists anywhere in `src/features` — `canBook` only appears
as a boolean **field** on quote result types (`RentalQuote.canBook`,
`rental-quote.ts:78`), not a policy function. Every route/service
re-implements its own ownership check inline (§1, §4, plus
`service-booking-service.ts`'s own, already-typed `ForbiddenError` throws at
lines 103, 279, 647, 700, 785).

### 7. `src/dal/errors.ts` — the one gap

Every error class needed for §1's typed-error conversion already exists
**except** one: there is no typed error for "the renter has no usable
payment method on file" (`PaymentSetupRequiredError`, `src/features/payments/lib/errors.ts:14-16`,
covers Stripe Connect **onboarding** for the owner/provider, a different
failure). This plan adds one new class.

## Decisions for the maintainer

**1. Centralize the clearly-duplicated logic; do not rewrite every
already-typed ownership check.** `service-booking-service.ts`'s five
`ForbiddenError` throws (§6) are already correct and already typed — moving
them into the policy module too would be a larger, lower-value diff with no
finding requiring it. **Recommendation: build `src/features/policy/` and
migrate (a) the account-state gate, (b) the duplicated counterparty-active
check, (c) the duplicated community-visibility lookup, and (d) approve's/decline's
untyped ownership checks — the four places with either real duplication or a
real typed-error gap.** Leave `service-booking-service.ts`'s existing checks
as Maintenance-notes candidates for the next feature that touches those
files, per this plan's precedent.

**2. Two failure causes collapse into one new error class.** `approve/route.ts`'s
`"payment method"` branch (renter has no saved card) and `"Stripe"` branch
(the Stripe customer lookup itself failed) both currently produce the same
400 with the "please update your payment method" family of copy — from the
renter's perspective both mean the same thing: "we don't have a usable
payment method for you." **Recommendation: one new `RenterPaymentMethodMissingError`**
(400, code `RENTER_PAYMENT_METHOD_MISSING`) covers both call sites, rather
than minting two classes for a distinction the current UI doesn't surface
differently anyway. If the `"onboarding"` branch turns out to be live (Step 3
confirms it isn't before deleting it), it stays covered by the existing
`PaymentSetupRequiredError`, unrelated to this new class.

**3. Policy module shape: plain functions, not a class hierarchy, and no
dependency on R-ARCH-01's `claimTransition`.** This plan's centralization
targets are all pre-write checks (can this user do X, is Y visible to them,
is Z account active) — none of them are a state-machine transition, so there
is no overlap with R-ARCH-01's helper beyond both plans touching
`rentals.dal.ts` (Decision, Status). **Recommendation**: `src/features/policy/`
exports plain, independently-testable functions grouped by concern
(`account-state.ts`, `parties.ts`, `community-visibility.ts`), re-exported
from an `index.ts` barrel — no shared base class, no generic parameterization
over domain types, matching the "prefer a function over a class hierarchy"
lesson the payment-lifecycle-unification spike already drew for a similar
problem.

## Commands

| Purpose        | Command                                                                                                                                                                                                                       | Expected |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                          | exit 0   |
| Lint           | `bun run lint`                                                                                                                                                                                                                | exit 0   |
| Targeted tests | `bun run test:run src/features/policy src/lib/api/__tests__/route-helpers.test.ts src/dal/__tests__/rentals.dal.test.ts src/dal/__tests__/dispute.dal.test.ts src/app/api/rentals src/features/rentals src/features/services` | all pass |
| Full suite     | `bun run test:run`                                                                                                                                                                                                            | all pass |

No schema change in this plan — no migration commands needed.

## Scope

**In scope**: new `src/features/policy/{account-state,parties,community-visibility,index}.ts`
and their tests; `src/lib/api/route-helpers.ts` (move the account-state/email
gate's decision functions out, keep the HTTP-shaping call sites);
`rental-service.ts` (`assertCounterpartyActive` → import from policy;
ownership/payment-method throws → typed errors); `service-booking-service.ts`
(`assertRequesterActive` → import from policy, no other change); `rental-quote.ts`,
`service-booking-quote.ts`, `neighborhood-needs-service.ts`, the three GET-detail
routes named in §5 (community-visibility call sites → policy function, same
error each already throws); `src/app/api/rentals/[id]/approve/route.ts` and
`decline/route.ts`; `src/dal/errors.ts` (new `RenterPaymentMethodMissingError`);
`src/lib/api/route-helpers.ts` (map the new error, if not already generic —
confirm first, Step 6); `src/dal/rentals.dal.ts` and `src/dal/dispute.dal.ts`
(remove the seven + one decorative params, §4) and every caller of those
eight methods; tests for all of the above.

**Out of scope**: `guards.ts`/`session.ts`'s plain-`Error` throws and
`route-helpers.ts`'s generic `"not found"`/`"Unauthorized"`/`"Admin"`
substring fallbacks (§1, Maintenance notes); `service-booking-service.ts`'s
already-typed ownership checks (Decision 1); `communityDAL.bulkSetVisibility`'s
write path (§5, single caller, not duplicated); the dispute audit-trail gap
(§4, Maintenance notes); R-ARCH-01's transition-table work (coordinates, does
not overlap); R-ARCH-02 (response-DTO layer).

## Git workflow

Work directly on `develop`. Do not commit.

## Inventory step (run at execution time)

```bash
grep -rn "\.message\.includes(" src/app/api src/lib/api --include="*.ts" | grep -v __tests__
grep -rn "_ownerId\|_userId\|_renterId\|_requesterId\|_providerId" src/dal --include="*.ts" | grep -v __tests__
grep -rln "isVisibleInCommunity(" src --include="*.ts" | grep -v __tests__
grep -rn "assertCounterpartyActive\|assertRequesterActive\|isActiveAccount(" src/features --include="*.ts" | grep -v __tests__
```

Confirm the four hit-sets match §1/§4/§5/§3 above before proceeding — Phase 2
plans landing between the audit and execution may have added new call sites
(e.g. a new route reading `isVisibleInCommunity` directly) that also need
migrating.

## Steps

### Step 1: Create the policy module skeleton

```
src/features/policy/
  account-state.ts     — restrictedAccountCode, isEmailVerified, assertActiveCounterparty
  parties.ts            — assertIsRentalOwner, assertIsRequestParty, etc.
  community-visibility.ts — assertCommunityVisible / isCommunityVisible
  index.ts              — re-exports
```

**Verify**: `bun run type-check` → exit 0 (empty modules with just exports compile).

### Step 2: Move the account-state gate's decision logic

Cut `restrictedStatusCode`, `unverifiedEmailResponse`'s pure-decision half
(is the email unverified — keep the `NextResponse.json(...)` construction in
`route-helpers.ts`, since that's HTTP shaping, not policy) into
`src/features/policy/account-state.ts`:

```ts
export type RestrictedAccountCode = "ACCOUNT_SUSPENDED" | "ACCOUNT_INACTIVE";

export function restrictedAccountCode(user: {
  status?: string | null;
}): RestrictedAccountCode | null {
  if (user.status === "suspended") return "ACCOUNT_SUSPENDED";
  if (user.status === "inactive") return "ACCOUNT_INACTIVE";
  return null;
}

export function isEmailUnverified(user: {
  emailVerified?: boolean | null;
}): boolean {
  return user.emailVerified === false;
}
```

`route-helpers.ts` imports both and keeps `authGateResponse`/`restrictedAccountResponse`/`unverifiedEmailResponse`
as thin wrappers that call these and build the `NextResponse`. `RestrictedAccountCode`
re-exports from `route-helpers.ts` for any existing importer (`grep -rn "RestrictedAccountCode" src`
first — update every import path to the new module, or keep a re-export if
call sites are numerous; prefer updating imports directly since the count is
almost certainly small).

**Verify**: `bun run type-check` → exit 0; `route-helpers.test.ts`'s existing
account-status tests pass unmodified (same behavior, moved implementation).

### Step 3: Dedup the counterparty-active check

Confirm whether `PaymentSetupRequiredError`/`assertConnectReady`'s callers
make the `"onboarding"` substring branch in `approve/route.ts` reachable
(`grep -rn "assertConnectReady" src/features/rentals src/features/services` —
trace every call site's error path). If unreachable, note it for removal in
Step 6.

Add to `src/features/policy/account-state.ts`:

```ts
import { CounterpartyUnavailableError } from "@/dal/errors";
import { userDAL } from "@/dal";

/**
 * Throws unless `userId` is an active account that has not self-deleted
 * (BIZ-07). Shared by rental approve and service accept — the two places a
 * transaction is about to charge a counterparty who may no longer be able to
 * see, dispute, or receive notifications about it.
 */
export async function assertCounterpartyActive(userId: string): Promise<void> {
  if (!(await userDAL.isActiveAccount(userId))) {
    throw new CounterpartyUnavailableError();
  }
}
```

Delete `rental-service.ts`'s private `assertCounterpartyActive` and
`service-booking-service.ts`'s private `assertRequesterActive`; both files
import the shared one instead. No call-site signature change (both existing
call sites pass just a user id).

**Verify**: `bun run type-check` → exit 0; existing tests for both call sites
(the "already-deleted counterparty" 409 case) pass unmodified.

### Step 4: Centralize community visibility

Add to `src/features/policy/community-visibility.ts`:

```ts
import { communityDAL } from "@/dal";

/** Thin, testable wrapper — every call site keeps deciding what to throw on
 * a miss (the error taxonomy differs: quote blockers vs. `CommunityNotVisibleError`
 * vs. a plain 404 on a GET-detail route), so this centralizes the lookup, not
 * the error type. */
export async function isCommunityVisible(
  userId: string,
  communityId: string,
): Promise<boolean> {
  return communityDAL.isVisibleInCommunity(userId, communityId);
}
```

At each of the eight call sites in §5, replace the direct
`communityDAL.isVisibleInCommunity(...)` call with
`policyIsCommunityVisible(...)` (import from `@/features/policy`), keeping
every site's existing branching/error-throwing logic on the result
byte-for-byte identical — this step is a pure indirection, not a behavior
change. If a future reviewer wants the eight sites' error handling unified
too, that's a separate, larger decision this plan doesn't make.

**Verify**: `bun run type-check` → exit 0; every existing test for the eight
call sites passes unmodified.

### Step 5: `parties.ts` — approve's and decline's ownership checks

```ts
import { ForbiddenError } from "@/dal/errors";

export function assertIsListingOwner(
  userId: string,
  ownerId: string,
  action: string,
): void {
  if (userId !== ownerId) {
    throw new ForbiddenError(
      `Only the listing owner can ${action} this rental request.`,
    );
  }
}
```

Use at `rental-service.ts`'s approve ownership check (replacing the plain
`Error` throw) and at `decline/route.ts` (replacing the inline `!==` check
and hand-rolled `NextResponse.json` 403 — the route now calls
`assertIsListingOwner` and lets the thrown `ForbiddenError` reach
`handleApiError`, same as `cancel/route.ts` already does).

**Verify**: `bun run type-check` → exit 0.

### Step 6: Fix `approve/route.ts`'s substring matching

Add to `src/dal/errors.ts`:

```ts
/**
 * The renter has no usable saved payment method, or the platform couldn't
 * retrieve their Stripe customer record (ARCH-03) — both read to the renter
 * as "we can't charge you," so they share one error rather than two.
 */
export class RenterPaymentMethodMissingError extends DALError {
  constructor(message = "No payment method on file for the renter.") {
    super(message, "RENTER_PAYMENT_METHOD_MISSING", 400);
    this.name = "RenterPaymentMethodMissingError";
  }
}
```

In `rental-service.ts`, replace the two plain-`Error` throws named in §1 with
`throw new RenterPaymentMethodMissingError(...)` (keep each site's existing
message text as the constructor argument). Confirm `handleApiError` maps any
unrecognized `DALError` subclass generically to `{error, code}` + its own
`statusCode` (re-read the function; if there's an explicit `instanceof`
allow-list gating which subclasses surface their `code`, add this one to it —
do not assume the generic path applies without checking, same caution
R-BIZ-14 used for its own new error class).

In `approve/route.ts`, delete the substring-matching block entirely (all
three branches) and fall straight through to `return handleApiError(result.error);` —
matching `cancel/route.ts`'s and `no-show/route.ts`'s already-clean shape.
If Step 3 found the `"onboarding"` branch unreachable, this deletion is safe
as-is; if it found a live caller, that caller's error must be converted to a
typed error too before deleting the branch (do not leave a reachable
plain-`Error` path with no substring match to catch it — it would silently
fall through to the generic 500).

**Verify**: `bun run type-check` → exit 0. Extend
`approve/__tests__/route.test.ts`: an ownership-mismatch service rejection →
403 with the same message text as before; a missing-payment-method rejection →
400 `{error, code: "RENTER_PAYMENT_METHOD_MISSING"}` (new: previously no
`code` at all); a Stripe-customer-lookup-failure rejection → same 400 shape,
confirming the raw Stripe message text from `customerError.message` is no
longer what reaches the client body (assert the response body does **not**
equal the raw mocked Stripe error string — this plan's real security value:
today's "Stripe" substring match happens to catch this case and return it as
`error: message` verbatim, so a Stripe error message can already reach the
client; converting to a typed error with the plan's own message text closes
that incidentally).

### Step 7: `decline/route.ts` end to end

Replace the inline ownership check (§1) with
`assertIsListingOwner(userId, rentalRequest.listing.ownerId, "decline")`
(imported from policy) before calling the DAL, letting the thrown
`ForbiddenError` reach `handleApiError` the same way `cancel/route.ts` does.

**Verify**: `bun run type-check` → exit 0; extend the route's test: a
non-owner decline attempt → 403 via `ForbiddenError`, same message text as
today's hand-rolled JSON.

### Step 8: Remove decorative DAL params

For each of the seven `rentals.dal.ts` methods and `dispute.dal.ts`'s
`updateState` in §4: delete the unused parameter from the signature, and
update every caller found by
`grep -rn "<methodName>(" src --include="*.ts" | grep -v __tests__`
to drop the corresponding argument. This is mechanical but touches many
files — do it one method at a time, running `bun run type-check` after each
(a dropped positional argument shifts every argument after it, so type-check
will immediately flag any caller missed by the grep).

**Verify** (after all eight methods): `bun run type-check` → exit 0;
`grep -rn "_ownerId\|_userId\|_renterId" src/dal/rentals.dal.ts src/dal/dispute.dal.ts` →
no matches.

### Step 9: Tests

- `src/features/policy/__tests__/account-state.test.ts`: `restrictedAccountCode`
  and `assertCounterpartyActive` unit tests (mock `userDAL.isActiveAccount`).
- `src/features/policy/__tests__/community-visibility.test.ts`: thin
  pass-through test (mock `communityDAL.isVisibleInCommunity`, confirm the
  wrapper calls it with the same arguments and returns its result).
- `src/features/policy/__tests__/parties.test.ts`: `assertIsListingOwner`
  throws `ForbiddenError` on mismatch, no-ops on match.
- Extend the tests named in Steps 2, 3, 4, 6, 7 as described inline.
- `src/dal/__tests__/rentals.dal.test.ts` / `dispute.dal.test.ts`: confirm the
  eight narrowed signatures still render the same SQL (no behavior change
  from dropping an unused param).

**Verify**: the targeted command in Commands → all pass.

## Test plan

Covered by Step 9. Full regression: `bun run test:run`. No real-DB test is
required — this plan adds no new CAS or claim (that's R-ARCH-01's job); every
change here is either a pure relocation, a pure indirection, or a typed-error
substitution for an existing, already-correct decision.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `grep -rn "\.message\.includes(" src/app/api/rentals/\[id\]/approve` → no matches
- [ ] `grep -rn "_ownerId\|_userId\|_renterId" src/dal/rentals.dal.ts src/dal/dispute.dal.ts` → no matches
- [ ] A missing-payment-method approve rejection returns
      `{error, code: "RENTER_PAYMENT_METHOD_MISSING"}`, not a raw Stripe
      message (test)
- [ ] A non-owner decline returns 403 via `ForbiddenError`, same message as
      today (test)
- [ ] `src/features/policy/` exists with `account-state.ts`, `parties.ts`,
      `community-visibility.ts`, each independently tested
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 3 outline's third item, and its own Execution-order row)

## STOP conditions

- Any "Current state" excerpt doesn't match live code beyond R-ARCH-01's
  explained edits.
- Step 3's `assertConnectReady` trace finds the `"onboarding"` branch is
  live and its caller doesn't already throw a typed error — convert that
  caller too before deleting the branch; don't leave an uncaught plain-`Error`
  path.
- `handleApiError` does not surface a `DALError` subclass's `code` generically
  (Step 6) — re-derive the exact branch needed from the live file.
- Step 8's grep for a method's callers misses one and type-check doesn't
  catch it (e.g. the call uses a spread or an intermediate variable) —
  re-grep more broadly (drop the `--include` filter, check `.test.ts` files
  too even though they're not edited, to confirm no test directly asserts on
  the old signature) before declaring the method done.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

- **New `code: "RENTER_PAYMENT_METHOD_MISSING"` on approve's existing 400** —
  additive (the response was already a 400 with an `error` string; it gains a
  `code` field it didn't have before). No existing mobile logic branches on
  approve's 400 body text (checked: the approve-outcome classifier already
  buckets on HTTP status generically for unrecognized codes). Add this row to
  the roadmap's Mobile client follow-ups table:

| Fix       | Contract change                                                                                                                                                                                                                                                         | Where the app sees it          | Mobile task | Status                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------- | -------------------------------------------------------------------- |
| R-ARCH-03 | new `code: "RENTER_PAYMENT_METHOD_MISSING"` on rental approve's existing 400 (previously no `code`); `ForbiddenError`'s existing `code: "FORBIDDEN"` now also covers decline's ownership check (previously an untyped inline 403 with the same status and message text) | rental approve, rental decline | —           | TODO (optional: specific copy instead of the generic 400/403 bucket) |

- No other route's status code, body shape, or existing message text changes —
  every other edit in this plan is an internal reorganization behind an
  unchanged public contract.

## Maintenance notes

- `guards.ts`/`session.ts`'s plain `Error("Authentication required")` /
  `Error("Admin privileges required")` throws, and `route-helpers.ts`'s
  matching `"not found"`/`"Unauthorized"`/`"Admin"` substring fallbacks, are
  the same defect class this plan fixes for approve/decline but are
  deliberately out of scope here (wider blast radius — every route using
  `requireAuth`/`requireAdmin`). Convert them the same way (typed
  `UnauthorizedError`/`ForbiddenError`, `instanceof` branch in
  `handleApiError`) the next time either file is touched for another reason.
- The dispute state-change audit-trail gap (`updateState`'s dropped
  `_userId`/`_reason`) is a real feature gap, not fixed here — if it's ever
  prioritized, it needs a schema decision (a column on `disputes`, or a row
  in the existing `disputeAuditLogs` table, which may already be the right
  place — check before adding a new column).
- `service-booking-service.ts`'s five already-typed `ForbiddenError` throws
  (§6) were deliberately left as direct throws rather than migrated to
  `parties.ts` (Decision 1) — migrate them opportunistically the next time
  that file is touched for a real feature change, not as a standalone
  cleanup PR.
- If R-ARCH-01 lands after this plan, its transition-table work on
  `rentals.dal.ts`/`dispute.dal.ts` operates on the same methods this plan
  narrowed the signatures of — no conflict expected (different parts of each
  signature/body), but re-read this plan's diff first per the header note.
