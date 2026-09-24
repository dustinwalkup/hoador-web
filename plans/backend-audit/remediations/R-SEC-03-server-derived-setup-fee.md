# Plan R-SEC-03: Derive setup/delivery fees from the listing, never the request body

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/rentals/lib/form-schema.ts src/features/rentals/lib/pricing.ts src/features/rentals/services/rental-quote.ts src/app/api/rentals/preview/route.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED · **Depends on**: none
- **Category**: security
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`createRentalRequestSchema` accepts a renter-supplied `setupFee` (any number,
including negative), and `calculateRentalPricing` uses it in preference to
the listing's own fee — the zod default of `0` means the listing's real fee
is _never_ used unless the client happens to omit the field. A renter can
send `setupFee: -499.5` (or simply `0`) on a request the owner is asked to
approve, silently discounting the whole rental or wiping out the owner's
setup charge. The owner's glance at the total before approving is the only
control, and a modest discount is easy to miss — this moves real money on
every occurrence. The fix removes the client's ability to supply this value
at all and prices setup/delivery strictly from server-held listing data.

## Current state

- `src/features/rentals/lib/form-schema.ts:16` —
  `setupFee: z.number().default(0),` inside `createRentalRequestSchema`
  (plain `z.object()`, not `.strict()`/`.passthrough()` — unknown keys are
  already dropped by default, which is what makes Step 1 backward compatible).
- `src/app/api/rentals/preview/route.ts:19` — `setupFee: z.number().optional(),`
  in the same shape, in `previewSchema`.
- `src/features/rentals/lib/pricing.ts:23-30,85-91` —
  `RentalPricingInput.setupFee?: number | null` (an "override"), used at
  `:85-87`: `const setupFeeAmount = setupRequested ? Number(input.setupFee ?? listing.setupFee ?? 0) : 0;`.
- `src/features/rentals/services/rental-quote.ts:57-65,87-178`
  (`quoteRentalRequest`) is the single pre-flight both `POST /api/rentals`
  (via `RentalService.createRentalRequest`) and `POST /api/rentals/preview`
  call, so fixing it here fixes both routes at once. It forwards
  `input.setupFee` straight into `calculateRentalPricing` at `:177` and
  checks nothing about whether the listing offers setup or delivery.
- `src/db/schemas/listings.schema.ts:35-38,97-108` — the real field names:
  `deliveryModeEnum = pgEnum("delivery_mode", ["pickup_only","delivery_only","both_available"])`,
  `deliveryMode` (default `"pickup_only"`), `setupFee` (decimal, default
  `"0"`), `setupAvailable` (boolean, default `false`).
- `src/features/rentals/lib/pricing.test.ts:99-108` — the test
  `"uses input.setupFee override when provided"` currently pins the exact
  behavior this plan removes; it must be rewritten, not left in place (it
  will fail to compile once `setupFee` leaves `RentalPricingInput`).
- Mobile: `hoador-mobile/src/features/rentals/lib/checkout-state.ts:189-212`
  (`buildCreateRentalBody`) already sends
  `setupFee: setup ? Number(listing.setupFee) : 0` — the listing's own
  current figure, "passed straight through... an echo, not an input to any
  arithmetic" per its own comment. The shipped app never sends an
  attacker-style override; only a non-app client would.

## Commands you will need

| Purpose    | Command                                                                           |
| ---------- | --------------------------------------------------------------------------------- |
| Install    | `bun install`                                                                     |
| Typecheck  | `bun run type-check`                                                              |
| Lint       | `bun run lint`                                                                    |
| Tests      | `bun run test:run <path>` / `bun run test:run`                                    |
| Migrations | `bun run db:generate` (review generated SQL); local DB via `docker compose up -d` |

## Scope

**In scope**: `src/features/rentals/lib/form-schema.ts`,
`src/app/api/rentals/preview/route.ts`, `src/features/rentals/lib/pricing.ts`,
`src/features/rentals/lib/pricing.test.ts`, `src/features/rentals/services/rental-quote.ts`
(add `SETUP_NOT_OFFERED`/`DELIVERY_NOT_OFFERED` blockers), tests for the
above.

**Out of scope**: the DB `CHECK` constraint migration (optional, see Steps);
`paymentMethodId` validation (PRIV-01/BIZ-08 territory); any change to
`deliveryFee`'s own handling beyond the new `DELIVERY_NOT_OFFERED` blocker —
`deliveryFee` was already fully server-derived (`listing.deliveryFee`, never
client-supplied) and is not part of this finding.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes uncommitted
for the maintainer to review and commit.

## Steps

### Step 1: Remove `setupFee` from both request schemas

Delete line 16 from `createRentalRequestSchema`
(`src/features/rentals/lib/form-schema.ts`) and line 19 from `previewSchema`
(`src/app/api/rentals/preview/route.ts`). Neither schema is `.strict()` or
`.passthrough()`, so a client that still sends `setupFee` simply has it
dropped during `safeParse` — no 400, no behavior change for a well-behaved
caller.

**Verify**: `bun run type-check` → exit 0 (this will show every downstream
type error from removing the field — expected; fixed by the next steps).

### Step 2: Price setup from the listing only

In `src/features/rentals/lib/pricing.ts`, remove `setupFee?: number | null`
from `RentalPricingInput` (`:23-30`) and change `:85-87` to:

```ts
const setupFeeAmount = setupRequested ? Number(listing.setupFee ?? 0) : 0;
```

**Verify**: `bun run type-check` → exit 0.

### Step 3: Add availability blockers to the quote

In `src/features/rentals/services/rental-quote.ts`: add
`"SETUP_NOT_OFFERED"` and `"DELIVERY_NOT_OFFERED"` to `QuoteBlockerCode`
(`:40-46`); remove `setupFee` from `RentalQuoteInput` (`:57-65`); remove
`setupFee: input.setupFee` from the `calculateRentalPricing` call (`:177`).
In the blocker-building section (`:108-158`), add:

```ts
if (setupRequested && !listing.setupAvailable) {
  blockers.push({
    code: "SETUP_NOT_OFFERED",
    message: "This listing does not offer setup service",
  });
}
if (deliveryRequested && listing.deliveryMode === "pickup_only") {
  blockers.push({
    code: "DELIVERY_NOT_OFFERED",
    message: "This listing does not offer delivery",
  });
}
```

Confirm `listing` (from `listingDAL.getListingById`, `:94`) exposes
`setupAvailable`/`deliveryMode` under those names before writing this — they
are top-level `listings` columns (`listings.schema.ts:97-108`), so the DAL
object should already carry them; check the projection if it doesn't.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Fix the existing pricing test

In `src/features/rentals/lib/pricing.test.ts`, replace the test
`"uses input.setupFee override when provided"` (`:99-108`) — which no longer
compiles, since `setupFee` is gone from `RentalPricingInput` — with a test
proving the override path is gone: calling `calculateRentalPricing` with
`setupRequested: true` always yields `result.setupFee === Number(baseListing.setupFee)`
regardless of any other input, and passing an extra unknown property in the
input object (if the test harness allows it) has no effect.

**Verify**: `bun run test:run src/features/rentals/lib/pricing.test.ts` → all pass.

### Step 5: Remaining tests

- `form-schema.test.ts`: a `setupFee` key in the input is accepted (ignored)
  by `.safeParse`, and the parsed result has no `setupFee` key.
- `rental-quote.test.ts` (or wherever `quoteRentalRequest` is tested):
  `setupRequested: true` against `setupAvailable: false` returns
  `SETUP_NOT_OFFERED`; `deliveryRequested: true` against `pickup_only`
  returns `DELIVERY_NOT_OFFERED`; a negative/zero client-supplied `setupFee`
  (passed through the raw route body) has zero effect on the quote.
- Route-level: `POST /api/rentals/preview` and the create path produce
  identical `setupFee` for the same inputs (they share `quoteRentalRequest`
  by construction — add one test asserting it explicitly).

**Verify**: `bun run test:run` → all pass.

## Test plan

Covered by Steps 4-5: rewritten `pricing.test.ts` case, extended
`form-schema.test.ts`, extended/new `rental-quote` tests for both new
blockers, and a preview-equals-create parity test. Verification:
`bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run test:run` exits 0
- [ ] `grep -rn "setupFee" src/features/rentals/lib/form-schema.ts src/app/api/rentals/preview/route.ts` shows no `z.number()` field named `setupFee`
- [ ] A quote/create with `setupFee: -100` in the request body produces the
      same `setupFee` as one with no `setupFee` at all (test)
- [ ] `SETUP_NOT_OFFERED`/`DELIVERY_NOT_OFFERED` blockers fire correctly (test)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` ("Execution order & status")

## STOP conditions

- `listingDAL.getListingById`'s returned object does not include
  `setupAvailable`/`deliveryMode` — confirm with a quick read of its
  select/projection before Step 3; do not invent field names.
- `deliveryModeEnum`'s values differ from
  `["pickup_only","delivery_only","both_available"]` — re-check
  `listings.schema.ts:35-38` before choosing the `DELIVERY_NOT_OFFERED` condition.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

The shipped app's checkout already sends `setupFee: Number(listing.setupFee)`
— the listing's own current figure, never a client-computed override
(`checkout-state.ts:189-212`, whose own comment calls it "an echo, not an
input to any arithmetic"). Since the server now ignores whatever `setupFee`
value arrives and always prices from `listing.setupFee` itself, app behavior
is unchanged for every legitimate booking — it only loses an ability it was
never designed to use. No companion mobile change is required. If a future
release adds setup/delivery toggles for listings that don't offer them, it
will receive `SETUP_NOT_OFFERED`/`DELIVERY_NOT_OFFERED` blockers from the
preview route instead of a silently-wrong quote — a strictly better failure
mode, using the same `blockers` array the response already carries.

## Maintenance notes

- **Optional, not implemented here — DB `CHECK` constraints** (`setup_fee >= 0`,
  `total_amount >= 0`, etc.) would close this class of bug at the schema
  level too. Before adding one, run this read-only pre-check and STOP if it
  returns any rows (existing bad data would block the migration):
  ```sql
  select id, setup_fee, total_amount from rental_requests
  where setup_fee < 0 or total_amount < 0;
  ```
  If clean, add the constraint via `bun run db:generate` and review the
  generated SQL by hand before handing it to the maintainer — this plan does
  not run migrations itself.
- **Ops query — existing requests priced off a stale/overridden setup fee**
  (read-only, hand to the maintainer):
  ```sql
  select rr.id, rr.setup_fee as request_fee, l.setup_fee as listing_fee, rr.created_at
  from rental_requests rr
  join listings l on l.id = rr.listing_id
  where rr.setup_requested = true and rr.setup_fee::numeric <> l.setup_fee::numeric;
  ```
  A listing's fee can legitimately change after a request was made, so this
  lists candidates for review, not proof of exploitation.
- If weekly/monthly discount pricing (currently disabled in
  `getEffectiveDailyRate`) is re-enabled later, re-check that it doesn't
  reintroduce a similar client-trusted override pattern.
