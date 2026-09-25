# Plan R-ARCH-02: Generalize response allowlists into a response-DTO layer, plus a forbidden-keys contract test

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/dal/listing.dal.ts src/dal/service-listing.dal.ts src/dal/dispute.dal.ts src/app/api/listings/search/route.ts src/app/api/services/listings/route.ts src/app/api/services/providers/[userId]/route.ts src/app/api/disputes/route.ts src/app/api/reviews/route.ts src/features/disputes/lib/participant-view.ts src/features/services/lib/service-listing-response.ts src/features/reviews/services/blind-review-service.ts src/features/community/utils/membership.ts src/app/dashboard/explore/page.tsx src/app/dashboard/services/providers/[userId]/page.tsx src/app/dashboard/services/bookings/[id]/page.tsx`
> On any change, re-run this plan's Step 0 inventory before proceeding; a
> material mismatch against "Current state" is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: L · **Risk**: LOW · **Depends on**: none
  (Phase 2 items may land first per the roadmap's sequencing, but nothing here
  requires them)
- **Category**: security / privacy / architecture
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: ARCH-02, PRIV-10, PRIV-13

## Why this matters

Three CRITICAL/P0 plans (R-PRIV-01, R-PRIV-03, R-SEC-07) already fixed the
worst instances of ARCH-02 by hand-writing an explicit-allowlist mapper per
route. That stopped the specific bleeding but left the root cause: most
DAL reads still `select()`/relational-`with` a whole row, and most routes
still forward whatever the DAL gave them. Anywhere that pattern remains, a
future column addition (or, as happened here, a column that was always
there) leaks by default. This plan does two things:

1. Applies the same explicit-allowlist discipline to the remaining
   concrete leaks: **PRIV-10** (moderation internals — rejection reasons,
   reviewer/admin ids, dispute resolver ids and chargeback ids — sent to
   every viewer) and **PRIV-13** (`GET /api/reviews` has no visibility or
   party check at all).
2. Adds a **forbidden-keys contract test** so the next leak like this is
   caught in CI, not in a future audit.

Every fix below is additive-safe for mobile: fields are only ever removed
from a response the app never parsed (its narrow Zod contracts already
strip them — confirmed against `hoador-mobile/src/api/contract/*.contract.ts`
per finding), never added or renamed.

## Current state

### Inventory step (run this first; the list below is a snapshot from 29fe557)

```bash
# Cross-user routes that spread a DAL row or return it unmodified
grep -rn "NextResponse\.json({\s*\.\.\.\|Response\.json({\s*\.\.\.\|NextResponse\.json(\s*[a-zA-Z]" src/app/api --include=route.ts | grep -v "error:"

# RSC pages that hydrate a DAL row into the query cache (a second wire
# boundary: the hydrated cache is serialized into the page's RSC payload)
grep -rln "setQueryData" src/app --include=page.tsx | xargs grep -l "from \"@/dal\""

# RSC pages that pass a raw DAL row as a prop to a client component (the
# R-PRIV-01 web-page pattern — no HydrateClient/setQueryData involved, but
# the same serialization leak)
grep -rln "from \"@/dal\"" src/app --include=page.tsx
```

Re-run these before starting; the concrete sites below were current as of
`29fe557` (2026-09-25) and may have shifted.

### PRIV-10: moderation internals sent to every viewer

1. **Listing search** — `src/dal/listing.dal.ts:1057` (`searchListings`'s
   result transform): `return { ...item.listing, dailyRate: ..., ... }`
   spreads the entire `listings` row (`buildSelectFields`, `:173`, selects
   `listing: listings` — every column) into `UserListing`
   (`:114-135`), including `approvalStatus`, `rejectionReason`, `reviewedBy`
   (the admin's user id) and `reviewedAt`. `rejectionReason` accumulates and
   is **never cleared on approval** (`updateApprovalStatus`, `:2167-2169`
   `appendReviewScalar`), so a listing that was once rejected and later
   approved still carries the old text into search results forever.
   `src/app/api/listings/search/route.ts:76` forwards it unmodified:
   `return Response.json(searchResults);`. Also hydrated into the RSC cache
   at `src/app/dashboard/explore/page.tsx:85-96` (`qc.setQueryData(cacheKey, {pages: [firstPage], ...})`
   with `firstPage` = the same unmapped `searchListings` result) — the
   **second wire boundary**: even with the API route fixed, the explore
   page's initial render would still leak the same fields through its RSC
   payload.
   - Mobile already treats this as sensitive: `hoador-mobile/src/api/contract/listings.contract.ts:9-14`
     — _"Deliberately absent: `approvalStatus` and `rejectionReason`... Do not
     add them here."_ The bytes still leave the server today; mobile's Zod
     schema just never parses them.
   - Web card usage (`src/features/listings/components/explore-page/explore-page-content.tsx:27-38`):
     `id`, `name`, `dailyRate`, `distanceMiles`, `averageRating`,
     `reviewCount`, `firstImageUrl`, `createdAt`, `status`.
   - Full allowlist (union of the mobile contract's required fields and the
     web card's fields): `id`, `name`, `dailyRate`, `status`, `condition`,
     `deliveryMode`, `setupAvailable`, `firstImageUrl`, `averageRating`,
     `reviewCount`, `communityId`, `categoryId`, `createdAt`,
     `distanceMiles` (mobile's schema requires the first 12 as non-optional
     — check `listingCardSchema` before dropping any of them; `distanceMiles`
     is web-only, mobile doesn't declare it but tolerates its presence).

2. **Service browse** — `src/dal/service-listing.dal.ts:337`
   (`findByCommunityForBrowse`, the only one of the file's four `...row.listing`
   spreads that isn't admin-only — `:202` is `getById` (already projected,
   see below), `:415` is `findPendingApproval`, `:778` is `findReviewHistory`,
   both admin-only) spreads the full `service_listings` row (`adminNote`,
   `rejectionReason` — schema at `src/db/schemas/services.schema.ts:56-57`)
   into `ServiceListingBrowseItem` (`:82-87`).
   `src/app/api/services/listings/route.ts:63`:
   `return NextResponse.json({ listings: data ?? [] });` — no projection.
   - Mobile already documents the intended shape:
     `hoador-mobile/src/api/contract/services.contract.ts:9-15` —
     _"Deliberately absent: `adminNote` and `rejectionReason`."_
   - Web card usage (`src/features/services/components/listing-card.tsx`)
     additionally reads `description` (not in the mobile contract, but
     rendered on web).
   - Allowlist: `id`, `title`, `description`, `price`, `pricingType`,
     `photos`, `categoryId`, `communityId`, `providerId`,
     `providerFirstName`, `providerLastName`, `providerProfileImageUrl`,
     `aggregateRating`, `reviewCount`, `createdAt`.
   - Note: the sibling detail route already does this correctly —
     `src/features/services/lib/service-listing-response.ts`
     (`toServiceListingDetailResponse`, added for PRIV-03) is the pattern to
     copy; add a sibling `toServiceBrowseCard` in the same file.

3. **Provider profile's `activeListings`** —
   `src/dal/service-listing.dal.ts:849-858` (`findByProvider`) is
   `.select()` (all columns, including `adminNote`/`rejectionReason`) and is
   used by **two** unrelated call sites with different needs:
   - `src/app/api/services/providers/[userId]/route.ts:96,114,146` — any
     signed-in user's public profile (`activeListings` at `:146` is the
     filtered-but-unprojected result of `findByProvider`). Mobile's contract
     documents the intended shape and confirms the leak:
     `hoador-mobile/src/api/contract/provider-profile.contract.ts:19-31` —
     _"The provider's own listings arrive as RAW `service_listings` rows...
     `adminNote`/`rejectionReason` are not parsed: they're moderation state,
     and the profile is a public-facing view."_ Allowlist (from
     `providerListingSchema`): `id`, `title`, `price`, `pricingType`,
     `photos`, `categoryId`.
   - `src/app/dashboard/services/providers/[userId]/page.tsx:61,65,122-130` —
     the RSC equivalent of the same route, also unprojected, also a wire
     boundary (props into the rendered page). **Second wire boundary #2.**
   - `src/app/dashboard/listings/services/page.tsx:22-35` — the **owner's
     own** listings (garage-equivalent for services). Out of scope: this is
     same-user data and the page legitimately needs `adminNote`/
     `rejectionReason` to show moderation status. Do not narrow this call
     site.

4. **Dispute list** — `src/dal/dispute.dal.ts:425`
   (`getUserDisputes`): `this.db.query.disputes.findMany({ where, with: {...} })`
   has no top-level `columns` restriction, so every column of `disputes`
   comes back, including `resolvedBy` (raw user id,
   `src/db/schemas/disputes.schema.ts:53`) and `stripeChargebackId`
   (`:58`). `src/features/disputes/lib/participant-view.ts:306-317`
   (`toParticipantDisputeListItem`) already strips `createdByUser`,
   `resolvedByUser` and `internalNotes` — added for a different leak
   (F23/P-E13-2) — but is a **denylist** (`delete copy[key]`) and never
   named `resolvedBy`/`stripeChargebackId`, so both raw columns still ship
   in `src/app/api/disputes/route.ts:71`
   (`data: disputes.data.map(toParticipantDisputeListItem)`).
   - Mobile's contract confirms these were never meant to be sent:
     `hoador-mobile/src/api/contract/disputes.contract.ts:15-18` — _"NARROW
     by design... the same discipline that kept `joinCode`... and the
     counterparty email... out of the app."_ `disputeListItemSchema`
     doesn't declare `resolvedBy` or `stripeChargebackId` at all.
   - Allowlist (from `disputeListItemSchema`): `id`, `status`, `createdAt`,
     `referenceNumber`, `reasonCode`, `rental.listing.name`,
     `serviceBooking.listing.title`.

### PRIV-13: `GET /api/reviews` has no visibility or party check

`src/app/api/reviews/route.ts:44-93` (`getHandler`), three query modes:

- `?revieweeId=` (`:58-72`): calls `BlindReviewService.getUserReviews(revieweeId, ...)`
  directly with no check that the caller may see that user at all. The
  sibling route (`src/app/api/services/providers/[userId]/route.ts:27-47`,
  `resolveProviderProfileVisibility`) enforces "shared visible community, or
  self" for the same kind of cross-user profile read — this route has no
  equivalent.
- `?rentalId=`/`?serviceBookingId=` (`:77-88`): calls
  `BlindReviewService.getBookingReviews(bookingParams)` and
  `getReviewStatus(userId, bookingParams)` with no check that `userId` is a
  party to that rental/booking. `getReviewStatus` (`src/features/reviews/services/blind-review-service.ts:147-185`)
  already computes `isParticipant` internally (`:163-164`) but only uses it
  to silently return `canReview: false` — it never surfaces the fact to the
  route, and `getBookingReviews` doesn't check at all.
- Only _released_ reviews are ever returned (`findReleasedByBooking`,
  `findReleasedByReviewee`) — this bounds the blast radius to "who wrote
  what review", not draft/unreleased content. That's why the finding is LOW,
  not HIGH.

`BlindReviewService.resolveBooking` (private, `:276-291`) already resolves
`{participantA, participantB}` for any `{rentalId?, serviceBookingId?}` —
the exact primitive needed; no new DAL query is required, only a public
wrapper.

### Existing generalizable pattern (what this plan extends)

- `src/features/rentals/lib/rental-detail-response.ts` (R-PRIV-01):
  explicit allowlist function, `Omit<>` return type so a new `RentalDetails`
  field fails type-check until named.
- `src/features/services/lib/service-listing-response.ts` (R-PRIV-03): same
  shape, per-viewer branch (`isProvider`).
- `src/features/services/lib/service-booking-projections.ts` (R-SEC-07):
  same shape; its own docstring is explicit that these must be "allowlists,
  not denylists" — implemented as an object literal naming every surviving
  field, with the exported type kept as `Omit<...>` purely so type-check
  still flags an unhandled new column.

This plan adds the same style of module for each resource in scope, and one
still-outstanding second-wire-boundary fix (`services/bookings/[id]/page.tsx`,
below) that R-SEC-07 didn't reach.

### Second wire boundary already found unfixed: service booking detail (web page)

`src/app/dashboard/services/bookings/[id]/page.tsx:51-95` (`serializeBooking`)
reads `ServiceBookingWithDetails` (the same DAL type
`GET /api/services/bookings/[id]/route.ts` used to spread before P-E9-3) via
`serviceBookingDAL.getById` directly and does its own denylist
(`const { cancellationReason, ...rest } = b;`) — everything else, including
`stripePaymentIntentId`, `stripeChargeId`, `stripeRefundId`,
`selectedPaymentMethodId` and both parties' `email`, still passes through
`{ ...rest, ... }` into `ServiceBookingPayload`, which is rendered by a
client component. `11-attack-surface-map.md:179` already flagged this
(`✗`). The API route (`src/app/api/services/bookings/[id]/route.ts:242-372`)
was already fixed for the same booking (P-E9-3) with an inline explicit
object literal typed as `ServiceBookingDetailResponse` (`:266-278`) — but
that construction is inline in the route handler, not an exported function,
so the web page couldn't reuse it and grew its own separate (leaky) one.

## Decisions for the maintainer

**How to fix the web booking-detail page (above).** Two options:

- **A — full share**: extract the route's inline object literal
  (`:295-361`, everything from `id: booking.id,` to `dispute: dispute ?? null,`)
  into an exported `buildServiceBookingDetailResponse(booking, viewerRole, {agreement, storedPayout, dispute})`
  in a new `src/features/services/lib/service-booking-detail-response.ts`,
  and make the web page resolve `agreement`/`storedPayout`/`dispute` itself
  (duplicating the route's three lookups) to call the same builder.
- **B — narrow in place (recommended)**: give the web page's own
  `serializeBooking` the same allowlist discipline (explicit object literal,
  not `...rest`) without unifying it with the route's builder.

**Recommendation: B.** `R-ARCH-10` (companion Phase 3 plan) is deciding
whether `/dashboard/**` (including this exact page) gets redirected away
entirely; if it does, Option A's extra shared module is code that ships and
is then deleted. Narrowing in place is a ~15-line change either way and
removes the leak regardless of which way R-ARCH-10 lands. Revisit
unification only if the web UI is kept long-term (see that plan's
Maintenance notes).

## Commands

| Purpose   | Command                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck | `bun run type-check`                                                                                                                                                                                                                            |
| Lint      | `bun run lint`                                                                                                                                                                                                                                  |
| Tests     | `bun run test:run src/app/api/listings/search src/app/api/services/listings src/app/api/services/providers src/app/api/disputes src/app/api/reviews src/dal/__tests__/listing.dal.test.ts src/dal/__tests__/dispute.dal.test.ts src/test/utils` |
| Full      | `bun run test:run`                                                                                                                                                                                                                              |

## Scope

**In scope**:

- `src/test/utils/forbidden-keys.ts` (new)
- `src/test/utils/__tests__/forbidden-keys.test.ts` (new)
- `src/dal/listing.dal.ts` (type only: export a narrowed `ListingSearchCard`
  type; `searchListings` itself keeps returning `UserListing` — the mapping
  happens at the wire boundary, not the DAL, so internal callers such as
  `getRecentListingsNearUser`/dashboard prefetch are unaffected)
- `src/features/listings/lib/listing-search-projection.ts` (new)
- `src/app/api/listings/search/route.ts`
- `src/app/dashboard/explore/page.tsx`
- `src/features/listings/hooks/use-listings.ts`,
  `src/features/listings/components/explore-page/explore-page-content.tsx`
  (type-only import swaps)
- `src/features/services/lib/service-listing-response.ts` (add
  `toServiceBrowseCard` and `toProviderListingCard`)
- `src/app/api/services/listings/route.ts`
- `src/app/api/services/providers/[userId]/route.ts`
- `src/app/dashboard/services/providers/[userId]/page.tsx`
- `src/features/services/hooks/use-service-listings.ts`,
  `src/features/services/components/service-browse-client.tsx`,
  `src/features/services/components/listing-card.tsx` (type-only import
  swaps)
- `src/features/disputes/lib/participant-view.ts`
  (`toParticipantDisputeListItem` rewritten as an allowlist)
- `src/features/community/utils/membership.ts` (add
  `resolveSharedVisibility`)
- `src/app/api/services/providers/[userId]/route.ts` (reuse
  `resolveSharedVisibility` in `resolveProviderProfileVisibility` — optional
  dedupe, do it if it's a clean one-for-one swap, skip it and note why in
  the PR if not)
- `src/features/reviews/services/blind-review-service.ts` (add
  `isBookingParticipant`)
- `src/app/api/reviews/route.ts`
- `src/app/api/reviews/__tests__/route.test.ts` (new)
- `src/app/dashboard/services/bookings/[id]/page.tsx` (narrow
  `serializeBooking`, Decision B)
- Test files for every route touched above.

**Out of scope**:

- `src/dal/listing.dal.ts`'s `getPendingReviews`/`getReviewHistory` (admin
  review queue/history — `reviewedBy` there is legitimate, the viewer is an
  admin).
- `src/app/api/listings/[listingId]/route.ts` (already narrows
  `approvalStatus`/`rejectionReason` for non-owners via denylist destructure;
  leave as is — converting it to a positive allowlist is good hygiene but
  not a live leak, and is bigger than this plan's remaining budget. Note it
  in Maintenance).
- `src/dal/community.dal.ts:848-862` (ARCH-02's finding cites a full
  `.select()` here too; re-check at execution time whether a later plan
  already narrowed it — if not, it's community-membership data already
  scoped to members, lower priority, track separately).
- `src/app/dashboard/listings/services/page.tsx` (owner's own listings —
  not a leak, see Current state #3).
- Full unification of the service-booking-detail builder (Decision B).
- Any Phase 0/1 plan's already-shipped mappers (`rental-detail-response.ts`,
  `service-listing-response.ts`'s existing function,
  `service-booking-projections.ts`) — reused, not rewritten.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Step 0: Re-run the inventory

Run the three greps in "Current state → Inventory step". Confirm the four
PRIV-10 sites and the PRIV-13 route match what's described below. If the
grep turns up additional cross-user spread sites not listed here, add them
to Scope and fix them with the same allowlist discipline before continuing
— do not silently narrow scope down to only the sites this plan named.

### Step 1: The forbidden-keys test helper

Create `src/test/utils/forbidden-keys.ts`:

```ts
/**
 * Structural + value-level guard against PRIV-10-shaped leaks (ARCH-02): a
 * response that carries a key name or a value that looks like an internal
 * identifier, regardless of where in the object tree it appears.
 *
 * This is deliberately a **runtime walk**, not a type check: `Omit<>` return
 * types (the allowlist mappers this plan and R-PRIV-01/03/R-SEC-07 use) catch
 * a new column at compile time for the one function that builds the
 * response, but this test protects any route that skips a mapper entirely.
 */
const FORBIDDEN_KEYS = new Set([
  "email",
  "phone",
  "joinCode",
  "rejectionReason",
  "adminNote",
  "adminNotes",
  "reviewerId",
  "reviewedBy",
  "resolvedBy",
  "internalNotes",
  "latitude",
  "longitude",
  "password",
  "passwordHash",
  "token",
  "selectedPaymentMethodId",
  "stripePaymentIntentId",
  "stripeChargeId",
  "stripeRefundId",
  "stripeTransferId",
  "stripeChargebackId",
  "stripeCustomerId",
  "stripeConnectAccountId",
  "stripeAccountId",
  "chargeId",
]);

/** Stripe object id prefixes — catches a Stripe id shipped under a key name not listed above. */
const STRIPE_ID_VALUE = /^(pi_|ch_|re_|pm_|cus_|acct_|tr_|dp_)[A-Za-z0-9]+$/;

/**
 * @param allow Dotted key paths (e.g. `"owner.email"`) or bare key names
 *   exempt for this call — use sparingly, only for a route that has a
 *   documented reason to return the field to its actual viewer (e.g. an
 *   admin-only route, or the resource's own owner).
 */
export function assertNoForbiddenKeys(
  value: unknown,
  opts: { allow?: Iterable<string> } = {},
): void {
  const allow = new Set(opts.allow ?? []);
  const seen = new Set<object>();

  function walk(node: unknown, path: string): void {
    if (node === null || typeof node !== "object") {
      if (
        typeof node === "string" &&
        STRIPE_ID_VALUE.test(node) &&
        !allow.has(path)
      ) {
        throw new Error(`Forbidden Stripe id value at "${path}": ${node}`);
      }
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [key, v] of Object.entries(node as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN_KEYS.has(key) && !allow.has(keyPath) && !allow.has(key)) {
        throw new Error(`Forbidden key "${keyPath}" present in response`);
      }
      walk(v, keyPath);
    }
  }

  walk(value, "");
}
```

**Verify**: `bun run type-check` → exit 0.

Add `src/test/utils/__tests__/forbidden-keys.test.ts`: table test with a
fixture object containing every forbidden key at various nesting depths (top
level, nested object, array of objects) → throws once per case; a clean
fixture → doesn't throw; an `allow`-listed key → doesn't throw for that key
but still throws for a sibling forbidden key; a Stripe-shaped string value
under an innocuous key name (e.g. `{ note: "pm_abc123" }`) → throws.

**Verify**: `bun run test:run src/test/utils/__tests__/forbidden-keys.test.ts` → all pass.

### Step 2 (PRIV-10, listing search): allowlist + RSC boundary

In `src/dal/listing.dal.ts`, export:

```ts
export type ListingSearchCard = Pick<
  UserListing,
  | "id"
  | "name"
  | "dailyRate"
  | "status"
  | "condition"
  | "deliveryMode"
  | "setupAvailable"
  | "firstImageUrl"
  | "averageRating"
  | "reviewCount"
  | "communityId"
  | "categoryId"
  | "createdAt"
  | "distanceMiles"
>;
```

Create `src/features/listings/lib/listing-search-projection.ts`:

```ts
import type { UserListing, ListingSearchCard } from "@/dal/listing.dal";
import type { PaginatedResult } from "@/dal/types";

/** Explicit allowlist (ARCH-02/PRIV-10): `searchListings` selects the whole
 *  `listings` row, including `approvalStatus`/`rejectionReason`/`reviewedBy`,
 *  which must never reach a non-owner viewer (Req 6.1.3). */
export function toListingSearchCard(row: UserListing): ListingSearchCard {
  return {
    id: row.id,
    name: row.name,
    dailyRate: row.dailyRate,
    status: row.status,
    condition: row.condition,
    deliveryMode: row.deliveryMode,
    setupAvailable: row.setupAvailable,
    firstImageUrl: row.firstImageUrl,
    averageRating: row.averageRating,
    reviewCount: row.reviewCount,
    communityId: row.communityId,
    categoryId: row.categoryId,
    createdAt: row.createdAt,
    distanceMiles: row.distanceMiles,
  };
}

export function toListingSearchPage(
  page: PaginatedResult<UserListing>,
): PaginatedResult<ListingSearchCard> {
  return { ...page, data: page.data.map(toListingSearchCard) };
}
```

In `src/app/api/listings/search/route.ts`, change
`return Response.json(searchResults);` to
`return Response.json(toListingSearchPage(searchResults));`.

In `src/app/dashboard/explore/page.tsx`, wrap the prefetch:
`qc.setQueryData(cacheKey, { pages: [toListingSearchPage(firstPage)], pageParams: [1] });`.

Swap the `UserListing` type import for `ListingSearchCard` in
`use-listings.ts` and `explore-page-content.tsx` — every field the client
reads (see Current state #1) survives the projection, so no other change
should be needed; type-check will say otherwise if it isn't.

**Verify**: `bun run type-check` → exit 0. `grep -n "toListingSearchPage" src/app/dashboard/explore/page.tsx src/app/api/listings/search/route.ts` → one match each.

### Step 3 (PRIV-10, service browse + provider profile): two more allowlists

In `src/features/services/lib/service-listing-response.ts`, add (alongside
the existing `toServiceListingDetailResponse`):

```ts
import type {
  ServiceListingBrowseItem,
  ServiceListing,
} from "@/dal/service-listing.dal";

export type ServiceBrowseCard = Pick<
  ServiceListingBrowseItem,
  | "id"
  | "title"
  | "description"
  | "price"
  | "pricingType"
  | "photos"
  | "categoryId"
  | "communityId"
  | "providerId"
  | "providerFirstName"
  | "providerLastName"
  | "providerProfileImageUrl"
  | "aggregateRating"
  | "reviewCount"
  | "createdAt"
>;

/** Explicit allowlist (PRIV-10): `findByCommunityForBrowse` spreads the whole
 *  `service_listings` row, including `adminNote`/`rejectionReason`. */
export function toServiceBrowseCard(
  row: ServiceListingBrowseItem,
): ServiceBrowseCard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    pricingType: row.pricingType,
    photos: row.photos,
    categoryId: row.categoryId,
    communityId: row.communityId,
    providerId: row.providerId,
    providerFirstName: row.providerFirstName,
    providerLastName: row.providerLastName,
    providerProfileImageUrl: row.providerProfileImageUrl,
    aggregateRating: row.aggregateRating,
    reviewCount: row.reviewCount,
    createdAt: row.createdAt,
  };
}

export type ProviderListingCard = Pick<
  ServiceListing,
  "id" | "title" | "price" | "pricingType" | "photos" | "categoryId"
>;

/** Explicit allowlist (PRIV-10): `findByProvider` is `.select()` — every
 *  column, for a route/page that renders a STRANGER's active listings. */
export function toProviderListingCard(
  row: ServiceListing,
): ProviderListingCard {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    pricingType: row.pricingType,
    photos: row.photos,
    categoryId: row.categoryId,
  };
}
```

Check `ServiceListing`'s actual export name/location in
`service-listing.dal.ts` before writing the import — it may be
`typeof serviceListings.$inferSelect` under a different alias.

In `services/listings/route.ts`:
`NextResponse.json({ listings: (data ?? []).map(toServiceBrowseCard) })`.

In `services/providers/[userId]/route.ts`:
`activeListings: activeListings.map(toProviderListingCard),` in the final
`NextResponse.json({...})` call (the filter at `:114` stays as is; only the
final field changes).

In `src/app/dashboard/services/providers/[userId]/page.tsx`, map
`activeListings` through `toProviderListingCard` before it's used in JSX
(same reasoning as Step 2's RSC fix — this page reads `findByProvider`
directly and renders the result, a wire boundary of its own).

Swap type imports (`ServiceListingBrowseItem` → `ServiceBrowseCard`) in
`use-service-listings.ts`, `service-browse-client.tsx`, `listing-card.tsx`.

**Verify**: `bun run type-check` → exit 0.

### Step 4 (PRIV-10, dispute list): denylist → allowlist

In `src/features/disputes/lib/participant-view.ts`, replace
`toParticipantDisputeListItem`'s `delete`-based body with an explicit
allowlist. Read `DisputeWithRelations`'s actual shape first
(`src/dal/types.ts` or wherever it's declared) to get every field
`getUserDisputes` selects on `rental`/`serviceBooking`/`evidence` right —
the sketch below is from the mobile contract, cross-check before writing:

```ts
export type ParticipantDisputeListItem = Pick<
  DisputeWithRelations,
  "id" | "status" | "createdAt" | "referenceNumber" | "reasonCode"
> & {
  rental: { listing: { name: string | null } | null } | null;
  serviceBooking: { listing: { title: string | null } | null } | null;
};

export function toParticipantDisputeListItem(
  dispute: DisputeWithRelations,
): ParticipantDisputeListItem {
  return {
    id: dispute.id,
    status: dispute.status,
    createdAt: dispute.createdAt,
    referenceNumber: dispute.referenceNumber,
    reasonCode: dispute.reasonCode,
    rental: dispute.rental
      ? {
          listing: dispute.rental.listing
            ? { name: dispute.rental.listing.name }
            : null,
        }
      : null,
    serviceBooking: dispute.serviceBooking
      ? {
          listing: dispute.serviceBooking.listing
            ? { title: dispute.serviceBooking.listing.title }
            : null,
        }
      : null,
  };
}
```

This drops `resolvedBy`/`stripeChargebackId`/`internalNotes`/`createdByUser`/
`resolvedByUser`/`financialOperations`/`evidence` as a consequence of being
an allowlist, not because each was named — check the mobile contract
(`disputes.contract.ts`) is still satisfied (it is a strict subset of the
above). Update `src/app/api/disputes/route.ts` if the function's name or
import path changes; the call site (`disputes.data.map(toParticipantDisputeListItem)`)
should not otherwise need to change.

**Verify**: `bun run type-check` → exit 0.
`grep -n "resolvedBy\|stripeChargebackId" src/features/disputes/lib/participant-view.ts` → no match in `toParticipantDisputeListItem`'s new body (the detail-view function above it, `toParticipantDispute`, legitimately has none either — confirm).

### Step 5 (PRIV-13): visibility + party checks on `GET /api/reviews`

In `src/features/community/utils/membership.ts`, add:

```ts
export type SharedVisibilityResult =
  | { kind: "self" }
  | { kind: "shared"; communityIds: Set<string> }
  | { kind: "denied" };

/** "Self, or shares at least one visible community with the target" (R5). */
export async function resolveSharedVisibility(
  viewerId: string,
  targetUserId: string,
): Promise<SharedVisibilityResult> {
  if (viewerId === targetUserId) return { kind: "self" };
  const [viewerVisible, targetVisible] = await Promise.all([
    communityDAL.getVisibleCommunityIds(viewerId),
    communityDAL.getVisibleCommunityIds(targetUserId),
  ]);
  const targetSet = new Set(targetVisible);
  const shared = new Set(viewerVisible.filter((c) => targetSet.has(c)));
  if (shared.size === 0) return { kind: "denied" };
  return { kind: "shared", communityIds: shared };
}
```

Check `communityDAL.getVisibleCommunityIds`'s exact name/signature first
(`resolveProviderProfileVisibility` in the providers route already calls
something equivalent — reuse whatever it uses).

Optionally rewrite `resolveProviderProfileVisibility` in
`services/providers/[userId]/route.ts` to call this and map `denied` to its
existing 403 — only if it's a clean swap; skip and note in the PR if the
route's `sharedVisibleCommunityIds: Set<string> | null` return shape doesn't
line up cheaply.

In `src/features/reviews/services/blind-review-service.ts`, add:

```ts
/** Whether `userId` is one of the two parties on this rental/service booking (PRIV-13). */
static async isBookingParticipant(
  userId: string,
  params: { rentalId?: string; serviceBookingId?: string },
): Promise<boolean> {
  try {
    const booking = await BlindReviewService.resolveBooking(params);
    return userId === booking.participantA || userId === booking.participantB;
  } catch {
    return false;
  }
}
```

In `src/app/api/reviews/route.ts`:

```ts
if (revieweeId) {
  if (revieweeId !== userId) {
    const visibility = await resolveSharedVisibility(userId, revieweeId);
    if (visibility.kind === "denied") {
      return NextResponse.json(
        { error: "You cannot view this user's reviews" },
        { status: 403 },
      );
    }
  }
  // ...existing limit/offset + getUserReviews call, unchanged
}

if (rentalId || serviceBookingId) {
  const bookingParams = rentalId
    ? { rentalId }
    : { serviceBookingId: serviceBookingId! };
  const isParticipant = await BlindReviewService.isBookingParticipant(
    userId,
    bookingParams,
  );
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // ...existing getBookingReviews/getReviewStatus calls, unchanged
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 6 (ARCH-02 second wire boundary, Decision B): narrow the web booking-detail page

In `src/app/dashboard/services/bookings/[id]/page.tsx`, rewrite
`serializeBooking` to build `ServiceBookingPayload` as an explicit object
literal (every field named, no `...rest`) instead of
`const { cancellationReason, ...rest } = b;` + `{ ...rest, ... }`. Drop
`stripePaymentIntentId`, `stripeChargeId`, `stripeRefundId`,
`selectedPaymentMethodId`, `requester.email`/`provider.email` (or whatever
the equivalent nested fields are called on `ServiceBookingWithDetails` —
check its shape first) the same way `payment-lifecycle/route.ts`'s
`toServiceBookingLifecycleResponse` (R-SEC-07) does it. Keep every field the
page's JSX currently reads (grep the file's JSX for `booking.` after this
change to confirm nothing broke).

**Verify**: `bun run type-check` → exit 0.
`grep -n "\.\.\.rest\|stripePaymentIntentId\|selectedPaymentMethodId" src/app/dashboard/services/bookings/\[id\]/page.tsx` → no match.

### Step 7: Tests

For each fixed route, extend its existing test file (or create one where
none exists — `reviews/route.ts` has none today) with:

1. A happy-path case using a **poisoned fixture**: a mock DAL row/service
   result with every forbidden field populated (`rejectionReason: "denied
for X"`, `reviewedBy: "admin-1"`, `adminNote: "flagged"`,
   `resolvedBy: "admin-2"`, `stripeChargebackId: "dp_123"`, etc., matching
   whatever that route's DAL actually returns). Call the handler, parse the
   JSON body, and `assertNoForbiddenKeys(body)` from Step 1's helper.
2. `src/app/api/reviews/__tests__/route.test.ts` (new): the specific PRIV-13
   cases —
   - `?revieweeId=<stranger with no shared community>` → 403, `getUserReviews` never called.
   - `?revieweeId=<self>` → 200, no visibility check performed.
   - `?rentalId=<booking the caller isn't party to>` → 403.
   - `?rentalId=<booking the caller is party to>` → 200 (existing behavior).
3. `src/features/disputes/lib/__tests__/participant-view.test.ts` (extend or
   create): a `DisputeWithRelations` fixture with `resolvedBy`/
   `stripeChargebackId`/`internalNotes` set → `toParticipantDisputeListItem`'s
   output has none of them (plus the existing `createdByUser`/
   `resolvedByUser` assertions, if any already exist — keep them).
4. `blind-review-service.test.ts` (extend, if present, or add): table test
   for `isBookingParticipant` — participant → true, non-participant → false,
   nonexistent booking → false (no throw).

**Verify**: `bun run test:run` (paths from Commands, then full suite) → all pass.

## Test plan

Covered by Step 7. `bun run test:run` → all pass, including the new
forbidden-keys assertions on every route this plan touches.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0; `bun run test:run` → exit 0
- [ ] `GET /api/listings/search`, `GET /api/services/listings`,
      `GET /api/services/providers/[userId]` and `GET /api/disputes`
      responses contain none of `rejectionReason`/`adminNote`/`reviewedBy`/
      `resolvedBy`/`stripeChargebackId` for a non-owner/non-admin viewer
      (tests, Step 7.1)
- [ ] `GET /api/reviews?revieweeId=` 403s a viewer with no shared visible
      community with the target; `?rentalId=`/`?serviceBookingId=` 403s a
      non-party (tests, Step 7.2)
- [ ] `src/app/dashboard/explore/page.tsx` and
      `src/app/dashboard/services/providers/[userId]/page.tsx` map through
      the same projections as their API-route siblings before hydrating/
      rendering (grep from Steps 2–3)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status")

## STOP conditions

- Step 0's inventory turns up a cross-user spread site materially different
  from Current state — re-derive the affected allowlist from live code
  rather than guessing.
- `DisputeWithRelations`'s actual shape (Step 4) doesn't match the sketch —
  re-read it from source before writing the allowlist.
- A mobile contract file (`hoador-mobile/src/api/contract/*.contract.ts`)
  required-parses a field this plan would drop — keep that field; do not
  narrow past what the shipped app needs.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

Every field removed here is a field mobile's own Zod contracts already
document as "deliberately absent" (`listings.contract.ts`,
`services.contract.ts`, `provider-profile.contract.ts`,
`disputes.contract.ts`) or never declared (`reviews.contract.ts` has no
`resolvedBy`/`stripeChargebackId`/etc. anywhere) — confirmed by reading each
file, not inferred. This is a pure size reduction with zero behavior change
for the shipped app. The two new 403s (`GET /api/reviews`) are new failure
outcomes for calls the app makes today with a valid party/self id — normal
app usage never hits them; only an out-of-band/scripted call to another
user's review data would. No new stable `code` is introduced (both use the
existing bare `{error}` 403 shape other routes already return), so no
roadmap Mobile-follow-ups row is needed.

## Production cutover

None. No schema or migration change; every fix is response-shape narrowing
or an added authorization check.

## Maintenance notes

- `src/app/api/listings/[listingId]/route.ts` still narrows
  `approvalStatus`/`rejectionReason` via denylist destructure rather than a
  positive allowlist (Scope: out). Convert it the same way as this plan's
  other fixes next time that route is touched.
- `src/dal/community.dal.ts:848-862`'s full `.select()` (cited in ARCH-02's
  original finding) was not re-verified as a live leak in this plan —
  check it next time that file is touched.
- If R-ARCH-10 decides to keep `/dashboard/**` long-term rather than
  redirecting it away, revisit Decision B (Step 6) and do the full
  extraction (Option A) so the route and the page can't drift again.
- The forbidden-keys helper (Step 1) is opt-in per test file, not a global
  CI gate — a route added later without a call to `assertNoForbiddenKeys`
  in its test file will not be caught automatically. Consider a follow-up
  that greps `src/app/api/**/__tests__/*.test.ts` for the import and fails
  CI if a cross-user route's test file lacks it, once the inventory is
  stable enough to enumerate "cross-user route" mechanically.
