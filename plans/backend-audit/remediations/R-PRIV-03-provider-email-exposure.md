# Plan R-PRIV-03: Stop leaking provider email, admin notes and rejection reasons on service listing detail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/dal/service-listing.dal.ts src/app/api/services/listings/[id]/route.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: security
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`GET /api/services/listings/[id]` returns the provider's email address to
every viewer who can see the listing — not just the requester, any visible
community member. It also returns internal moderation state (`adminNote`,
`rejectionReason`) to non-providers. Browsing the community's service
listings and fetching each detail lets any member harvest every provider's
email. The mobile app already strips the email client-side, which is exactly
the kind of protection that must live on the server (PRIV-03).

## Current state

- `src/dal/service-listing.dal.ts:170-203` (`getById`) selects the provider
  projection and spreads the full listing row:
  ```ts
  provider: {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    email: user.email,
  },
  ...
  return { ...row.listing, category: row.category, provider: row.provider };
  ```
  `row.listing` is the raw `serviceListings` row, which includes
  `adminNote: text("admin_note")` and `rejectionReason: text("rejection_reason")`
  (`src/db/schemas/services.schema.ts:56-57`).
- `src/app/api/services/listings/[id]/route.ts:52-76` computes
  `isProvider = listing.providerId === userId` (already used for the
  visibility gate at `:53-63`) and returns `{ ...listing, isProvider }`
  verbatim — no field ever removed for a non-provider.
- Callers of `serviceListingDAL.getById` other than this route: three web
  dashboard server pages (`dashboard/services/listings/[id]/{edit,page,book}.tsx`,
  out of scope — see below), and several internal, non-serializing callers in
  `src/features/services/services/service-listing-service.ts` (ownership
  checks before mutations), `service-booking-quote.ts` (pricing), and
  `notifications/service-notifications.ts:36` (reads only `.title`). **None
  of these read `provider.email`** (`grep -n "provider\.email" src/features/services`
  returns nothing) — confirmed safe to drop `email` at the DAL source rather
  than filtering it per-caller.
- Mobile already treats `adminNote`/`rejectionReason` as provider-only, by
  convention, not by trusting the server: `hoador-mobile/src/api/contract/services.contract.ts:84-129`
  declares `rejectionReason` on `serviceListingDetailSchema` with an explicit
  comment — "Render only when `isProvider` AND `status === 'denied'`" — for
  the provider's own edit screen. It does **not** declare `email` or
  `adminNote` at all (`:11-13,76-83`: "Deliberately absent... the app never
  holds, renders or logs a provider's email address").

## Commands you will need

| Purpose   | Command                                        |
| --------- | ---------------------------------------------- |
| Install   | `bun install`                                  |
| Typecheck | `bun run type-check`                           |
| Lint      | `bun run lint`                                 |
| Tests     | `bun run test:run <path>` / `bun run test:run` |

## Scope

**In scope**:

- `src/dal/service-listing.dal.ts` (modify: drop `email` from the provider select)
- `src/features/services/lib/service-listing-response.ts` (create: the
  non-provider projection helper)
- `src/features/services/lib/__tests__/service-listing-response.test.ts` (create)
- `src/app/api/services/listings/[id]/route.ts` (modify: use the helper)
- `src/app/api/services/listings/[id]/__tests__/route.test.ts` (extend)

**Out of scope**:

- `src/app/dashboard/services/listings/[id]/{edit,page,book}.tsx` — web
  server pages that call `serviceListingDAL.getById` directly; "web UI
  retiring," same reasoning as SEC-23 and R-PRIV-01. Removing `email` at the
  DAL (this plan's Step 1) already stops the leak there for `email`;
  `adminNote`/`rejectionReason` remain visible on those pages to any viewer,
  which is a smaller, web-only residual left for that UI's retirement.
- PRIV-04 (service _booking_ list/lifecycle routes leaking counterparty
  email and Stripe ids) — a related but separate finding, not this plan.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes uncommitted
for the maintainer to review and commit.

## Steps

### Step 1: Remove email from the DAL projection

In `src/dal/service-listing.dal.ts`, in `getById`'s `provider` select
(`:174-180`), delete the `email: user.email,` line. No other change to this
method — every internal caller only reads other fields (confirmed above).

**Verify**: `bun run type-check` → exit 0. `grep -n "email" src/dal/service-listing.dal.ts` shows no match inside `getById`.

### Step 2: Create the non-provider response helper

Create `src/features/services/lib/service-listing-response.ts`:

```ts
import type { ServiceListingWithCategoryAndProvider } from "@/dal/service-listing.dal";

/**
 * Drops moderation-internal fields for anyone who isn't the listing's own
 * provider (PRIV-03/PRIV-10). The provider keeps `adminNote`/`rejectionReason`
 * — the mobile edit screen renders `rejectionReason` for a denied listing
 * (services.contract.ts:84-129).
 */
export function toServiceListingDetailResponse(
  listing: ServiceListingWithCategoryAndProvider,
  isProvider: boolean,
):
  | Omit<ServiceListingWithCategoryAndProvider, "adminNote" | "rejectionReason">
  | ServiceListingWithCategoryAndProvider {
  if (isProvider) return listing;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminNote, rejectionReason, ...rest } = listing;
  return rest;
}
```

Confirm the exact exported type name for `getById`'s return type in
`service-listing.dal.ts` before importing it — adjust the import if it
differs from `ServiceListingWithCategoryAndProvider`.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Wire the helper into the route

In `src/app/api/services/listings/[id]/route.ts`, import
`toServiceListingDetailResponse` and change
`return NextResponse.json({ ...listing, isProvider });` to
`return NextResponse.json({ ...toServiceListingDetailResponse(listing, isProvider), isProvider });`.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Tests

`service-listing-response.test.ts`: a fixture listing with `adminNote`/
`rejectionReason` set — `isProvider: true` returns them unchanged;
`isProvider: false` omits both, keeps everything else.

Extend `route.test.ts` (already exists — model its DAL/session mocking on
its current structure) with a non-provider-viewer case asserting the
response body has no `email` key anywhere and no `adminNote`/`rejectionReason`,
plus a provider-viewer case asserting `rejectionReason` is still present when
set.

**Verify**: `bun run test:run src/features/services/lib/__tests__/service-listing-response.test.ts src/app/api/services/listings/\[id\]/__tests__/route.test.ts` → all pass.

## Test plan

New `service-listing-response.test.ts` (provider vs. non-provider table
test) and an extended `route.test.ts` (end-to-end body check for both
viewer types). Verification: `bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run test:run` exits 0
- [ ] `grep -n "email: user.email" src/dal/service-listing.dal.ts` returns no match
- [ ] A non-provider `GET` response contains no `email`, `adminNote`, or `rejectionReason`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` ("Execution order & status")

## STOP conditions

- Any caller of `serviceListingDAL.getById` reads `.provider.email` — re-run
  `grep -rn "provider\.email\|\.provider\.email" src/features src/app` and
  treat a hit as a STOP; do not remove the DAL field if something depends on it.
- The `serviceListings` schema's `adminNote`/`rejectionReason` column names
  differ from `src/db/schemas/services.schema.ts:56-57` — re-check before
  writing the destructure.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

The shipped app's contract already never parses `email` or `adminNote`
(`services.contract.ts:11-13,76-83`) — Zod strips them, so removing `email`
server-side is a pure size reduction with zero behavior change. It **does**
parse `rejectionReason` on `serviceListingDetailSchema` for the provider's
own denied-listing edit screen, gated in the UI on `isProvider && status ===
'denied'` (`:119-129`) — this plan's helper keeps `rejectionReason` present
for `isProvider: true`, so that screen keeps working unchanged. Only a
non-provider viewer (who the app never shows this field to anyway) loses it
from the wire. No companion mobile change is required.

## Maintenance notes

- If a future screen needs the provider's email for a legitimate purpose
  (e.g. a "contact provider" feature), add it back explicitly at the point of
  need — through a dedicated, purpose-scoped endpoint or field — rather than
  restoring it to this general-purpose detail projection.
- The three web dashboard pages left out of scope still leak `adminNote`/
  `rejectionReason` to any viewer who can reach them by URL (they call the
  DAL directly, bypassing this route's helper). Revisit when that UI is
  retired or rebuilt; the DAL-level `email` removal already protects them.
