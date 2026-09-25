# Plan R-SEC-08: Enforce community/network isolation on visibility, join codes, and booking eligibility

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 25e2233..HEAD -- src/dal/community.dal.ts src/db/schemas/communities.schema.ts src/app/api/communities/route.ts src/app/api/users/me/visibility/route.ts src/dal/errors.ts src/lib/api/route-helpers.ts src/features/rentals/services/rental-quote.ts src/features/rentals/services/rental-service.ts src/dal/rentals.dal.ts src/features/services/services/service-booking-quote.ts src/features/services/services/service-booking-service.ts src/dal/types.ts src/dal/listing.dal.ts src/app/api/listings/[listingId]/route.ts`
> If any in-scope file changed, compare "Current state" below against the
> live code before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED
- **Depends on**: none functionally. It touches `src/lib/api/route-helpers.ts`
  and its test, which several Phase 1 plans also extend (1.7 R-SEC-16,
  1.8 R-ARCH-07, 1.16 R-BIZ-09). See "Git workflow" below.
- **Category**: security / business-logic
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: SEC-08, SEC-09, BIZ-08 (roadmap 1.9)

## Why this matters

**SEC-08**: `PATCH /api/users/me/visibility` upserts a `community_visibility`
row for whatever `communityId` the caller sends, with no check that the
community is in the caller's network. `getVisibleCommunityIds` (search) and
`isVisibleInCommunity` (listing detail, both quote paths below) read that same
table with no membership join, so an injected row lets any user browse
listings/services/needs in a community outside their network — the platform's
core isolation guarantee.

**SEC-09**: `GET /api/communities` and `GET /api/users/me/visibility` both
return the full `communities` row, including `joinCode` — a shareable
residency-proof secret — to any logged-in user, and the former is cached
`public`. Anyone can read every community's join code and self-verify into any
community (including inactive ones) without admin review.

**BIZ-08**: Neither the rental quote nor the service quote checks listing
status/archive/approval or two-party community visibility, and neither is
re-checked at approve/accept time. Anyone with a listing id can request (and
have approved) an archived, unapproved, or out-of-community listing — this is
also what lets PRIV-01's harvest target arbitrary listing ids with a live
price.

## Current state

### SEC-08 — `src/dal/community.dal.ts`

- `bulkSetVisibility` (:1074-1129): only guard is "don't hide primary"
  (:1093-1097). No check that `communityId` belongs to the caller's network.
- `getVisibleCommunityIds` (:986-999) and `isVisibleInCommunity` (:1010-1027)
  read `community_visibility` with no network/membership join — they trust
  whatever `bulkSetVisibility` wrote.
- The model (`src/db/schemas/communities.schema.ts`): `communities.networkId`
  (nullable FK to `community_networks`); a community with `networkId = null`
  is standalone/isolated. A user's network is their **primary** community's
  `networkId` (`communityMemberships.isPrimary = true`). Confirmed against
  `specs/multi-community-marketplace/1-requirements.md` §"Network model"
  (R4.8/R9): visibility rows are initialized "for every community in their
  network" and cross-network exposure must not happen.
- `initializeUserVisibility` (:932-956) only ever inserts rows for communities
  in the network passed to it — it is the write path this plan's read-side
  check must match.

### SEC-09 — join code exposure

- `src/app/api/communities/route.ts:39-49`: `communityDAL.listCommunitiesByNetwork(...)`
  → `NextResponse.json(communities, {headers: {"Cache-Control": "public, max-age=60"}})`.
- `src/dal/community.dal.ts:848-864` `listCommunitiesByNetwork`: `.select().from(communities)` — full row, `joinCode` included.
- `src/dal/community.dal.ts:1037-1057` `getVisibilityForUser`: `community: communities` — same full-row leak, consumed unmodified by `GET /api/users/me/visibility` (`src/app/api/users/me/visibility/route.ts:24-31`).
- Mobile already narrows both responses client-side and never reads `joinCode`
  (`hoador-mobile/src/api/contract/community.contract.ts:6-9`,
  `visibility.contract.ts:9-11` — both comments cite this exact finding, dated
  2026-09-24). **Who legitimately needs `joinCode`**: admins only, via
  `GET /api/admin/communities` (`listCommunities`, admin-gated,
  `requireAdminResponse`) and `POST /api/admin/communities` — unchanged by
  this plan. No community-member-facing route needs it.
- `src/dal/community.dal.ts:102-118` `validateJoinCodeForSignup`: does not
  check `communities.isActive`, so a join code for a deactivated community
  still lets someone self-verify into it, skipping admin review (part of the
  same finding's recommended fix).

### BIZ-08 — booking eligibility

- `src/features/rentals/services/rental-quote.ts:88-117`: `quoteRentalRequest`'s
  only listing gate is existence (:96) and `OWN_LISTING` (:112-117). No
  `status`/`isActive`/`approvalStatus`/visibility check.
- `src/features/rentals/services/rental-service.ts:186-189`: `createRentalRequest`
  throws the first blocker as a bare `Error` (pre-existing; out of scope —
  see Scope).
- `src/features/rentals/services/rental-service.ts:401-410`: `approveRentalRequest`
  re-checks request `status` (BIZ-01) but nothing about the listing.
- `src/dal/rentals.dal.ts:671-704` `getRentalRequestById`: already joins
  `listings` for `listingName`; does not select `status`/`isActive`/`approvalStatus`/`communityId`.
- `src/features/services/services/service-booking-quote.ts:96-99`: `quoteServiceBooking`
  throws `NotFoundError` when `listing.status !== "active"` — this **already**
  covers approval + archive for services, because `service_listing_status`
  (`pending_approval | active | inactive | denied`) conflates them into one
  column (unlike rentals, which split `status`/`isActive`/`approvalStatus`
  into three). What's missing for services is only two-party visibility.
- `src/features/services/services/service-booking-service.ts:262-281`
  `acceptBooking`: re-checks booking `status` and counterparty-active
  (R-BIZ-07); nothing about the listing. `detail` (from `serviceBookingDAL.getById`)
  already carries `detail.listing.status`/`detail.listing.communityId` and
  `detail.providerId`/`detail.requesterId` — no new query needed for the
  service-side re-check.
- `src/app/api/listings/[listingId]/route.ts:88-105`: the detail route already
  does the two-party visibility check this plan adds to quote/approve —
  reusing its shape (`communityDAL.isVisibleInCommunity` for both parties).
- **Already correct, not part of this plan's scope**: rentals' `status` check
  for booking eligibility should allow `{available, rented}` (mirroring
  `BROWSEABLE_STATUSES` in the detail route) and block `{maintenance, inactive}`.
- **Known pre-existing bug, explicitly out of scope**: `createRentalRequest`
  throws every blocker as a bare `Error`, which `handleApiError`'s generic
  `Error` branch maps to 500 unless the message contains "not found" — so
  today even `OWN_LISTING` returns 500, not 400. This plan does not fix that
  general mapping; it only ensures the 4 new blockers get proper codes when
  mapped explicitly (see Step 5).

## Commands you will need

| Purpose        | Command                                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                                            |
| Lint           | `bun run lint`                                                                                                                                                                                                                                  |
| Targeted tests | `bun run test:run src/dal/__tests__/community.dal.test.ts src/app/api/communities src/app/api/users/me/visibility src/lib/api/__tests__/route-helpers.test.ts src/features/rentals src/features/services src/dal/__tests__/listing.dal.test.ts` |
| Full tests     | `bun run test:run`                                                                                                                                                                                                                              |

## Scope

**In scope**: `src/db/schemas/communities.schema.ts`, `src/dal/community.dal.ts`,
`src/app/api/communities/route.ts`, `src/dal/errors.ts`,
`src/lib/api/route-helpers.ts` (additive only — see Git workflow),
`src/features/rentals/services/rental-quote.ts`,
`src/features/rentals/services/rental-service.ts`, `src/dal/rentals.dal.ts`
(`getRentalRequestById` only), `src/features/services/services/service-booking-quote.ts`,
`src/features/services/services/service-booking-service.ts`, `src/dal/types.ts`
(`ListingDetails` only), `src/dal/listing.dal.ts` (`getListingById` only),
`src/app/api/listings/[listingId]/route.ts` (non-owner destructure only),
`src/features/users/hooks/use-visibility.ts`, `src/features/community/hooks/use-communities.ts`,
plus every test file listed in the Test plan.

**Out of scope**: the pre-existing "every rental-create blocker maps to 500"
bug (see Current state); the listing detail route's own `isActive` gate for
non-owners (a related but separate, unflagged gap — noted for the maintainer,
not fixed here); admin community routes (legitimately keep `joinCode`);
`joinCommunityByCode` (dead code, no callers); services' `approvalStatus`
(folded into `status`, nothing to add); Phase 2 items.

## Git workflow

Work directly on `develop`. Do not commit or push.

**`src/lib/api/route-helpers.ts` and its test are shared** with other Phase 1
plans (1.7, 1.8, 1.16) that may land first. Before Step 3, re-read both files
live — do not trust the excerpts below if they've drifted. Make only additive edits (new
import names, new `if` branches, new `it` cases) placed next to unrelated
existing code, so a merge is a simple union rather than a conflict.

## Steps

### Step 1 (SEC-09): Stop projecting `joinCode`, fix the cache header and the inactive join-code check

In `src/db/schemas/communities.schema.ts`, add near `export type Community = typeof communities.$inferSelect;`:

```ts
/** `Community` minus `joinCode` — the shape every non-admin response uses (SEC-09). */
export type PublicCommunity = Omit<Community, "joinCode">;
```

Change `CommunityVisibilityWithCommunity.community` from `Community` to `PublicCommunity`.

In `src/dal/community.dal.ts`, add a module-level column map (near the top,
after the imports) and use it in both places that currently leak the row:

```ts
/** Every `communities` column except `joinCode` (SEC-09). */
const PUBLIC_COMMUNITY_COLUMNS = {
  id: communities.id,
  name: communities.name,
  imageUrl: communities.imageUrl,
  address: communities.address,
  city: communities.city,
  state: communities.state,
  zip: communities.zip,
  networkId: communities.networkId,
  latitude: communities.latitude,
  longitude: communities.longitude,
  isActive: communities.isActive,
  createdAt: communities.createdAt,
  updatedAt: communities.updatedAt,
};
```

- `listCommunitiesByNetwork` (:848): change `.select()` to `.select(PUBLIC_COMMUNITY_COLUMNS)` and the return type to `Promise<PublicCommunity[]>`.
- `getVisibilityForUser` (:1037): change `community: communities` to `community: PUBLIC_COMMUNITY_COLUMNS`.
- `validateJoinCodeForSignup` (:102): add the active check to the where clause:
  ```ts
  .where(
    and(eq(communities.joinCode, joinCode.trim()), eq(communities.isActive, true)),
  )
  ```
  (add `and` — already imported at the top of this file.) A code for an
  inactive community now returns `null`, which the caller
  (`AuthService.joinCommunity`, `src/features/auth/services/auth-service.ts:141-144`)
  already turns into a 404 `NotFoundError("Invalid join code...")` — the same
  outcome as a bogus code, no new error type needed.

In `src/app/api/communities/route.ts:47`, change the header to
`"Cache-Control": "private, max-age=60"` (mirrors `legal-documents/route.ts:53`'s
`"private, no-store"` precedent for an authenticated, per-user-varying response).

In `src/features/users/hooks/use-visibility.ts` and
`src/features/community/hooks/use-communities.ts`, change the `Community`
import/type-param to `PublicCommunity` (no behavior change — these hooks never
read `joinCode`; this just makes the type honest).

**Verify**: `bun run type-check` → exit 0. `grep -n "joinCode" src/dal/community.dal.ts` shows it only inside `getCommunityByJoinCode`/`validateJoinCodeForSignup`/`joinCommunityByCode`/`createCommunity`/`updateCommunity`/`getCommunityWithStats`/`listCommunities` (admin path) — never in `listCommunitiesByNetwork` or `getVisibilityForUser`.

### Step 2 (SEC-08): Restrict visibility writes to the caller's network

In `src/dal/community.dal.ts`, rewrite the start of `bulkSetVisibility` (:1074-1098):

```ts
async bulkSetVisibility(
  userId: string,
  updates: Array<{ communityId: string; isVisible: boolean }>,
): Promise<CommunityVisibility[]> {
  try {
    if (updates.length === 0) return [];

    const [primary] = await this.db
      .select({
        communityId: communityMemberships.communityId,
        networkId: communities.networkId,
      })
      .from(communityMemberships)
      .innerJoin(communities, eq(communityMemberships.communityId, communities.id))
      .where(
        and(
          eq(communityMemberships.userId, userId),
          eq(communityMemberships.isPrimary, true),
        ),
      )
      .limit(1);

    // SEC-08: a visibility row may only be toggled for a community in the
    // caller's own network — otherwise getVisibleCommunityIds (the search
    // gate) and isVisibleInCommunity (the listing-detail/quote gate) can be
    // made to include a community the caller was never initialized into.
    if (!primary?.networkId) {
      throw new ValidationError(
        "You must belong to a network to set community visibility",
      );
    }
    const networkCommunityIds = new Set(
      (await this.listCommunitiesByNetwork(primary.networkId)).map((c) => c.id),
    );
    const outsideNetwork = updates.find(
      (u) => !networkCommunityIds.has(u.communityId),
    );
    if (outsideNetwork) {
      throw new ValidationError(
        `Community ${outsideNetwork.communityId} is not in your network`,
      );
    }

    const hidingPrimary = updates.find(
      (u) => u.communityId === primary.communityId && u.isVisible === false,
    );
    if (hidingPrimary) {
      throw new VisibilityPrimaryLockedError();
    }

    // ...unchanged upsert loop below
```

Add `VisibilityPrimaryLockedError` to this file's existing `from "./errors"` import.

**Verify**: `bun run type-check` → exit 0.

### Step 3 (mobile P-E14-6): Give the hide-primary refusal a stable code

`hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md:169`
dissolved P-E14-6 into this roadmap item, asking for `VISIBILITY_PRIMARY_LOCKED`
in the `{error, code}` shape used elsewhere (e.g. `ConversationArchivedError`).
Step 2 above already throws it from the DAL — this step defines it.

In `src/dal/errors.ts`, add:

```ts
/** Hiding the primary (home) community is refused (R4.5); mobile P-E14-6 asked for a stable code. */
export class VisibilityPrimaryLockedError extends DALError {
  constructor(message = "You can't hide your home community.") {
    super(message, "VISIBILITY_PRIMARY_LOCKED", 400);
    this.name = "VisibilityPrimaryLockedError";
  }
}
```

In `src/lib/api/route-helpers.ts`, add `VisibilityPrimaryLockedError` to the
`@/dal/errors` import, add `!(error instanceof VisibilityPrimaryLockedError)`
to the `shouldCaptureError` list (it's an expected 4xx, like its siblings),
and add a branch next to the other single-code classes (e.g. beside
`CannotMessageSelfError`'s branch):

```ts
if (error instanceof VisibilityPrimaryLockedError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.statusCode },
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 4 (BIZ-08 shared plumbing): One error family for listing eligibility

Four new conditions (below) are needed at both quote time and approve/accept
time, across two domains (rentals, services). Following the `DisputeError`
pattern already in this codebase (`src/features/disputes/lib/dispute-errors.ts`),
add one abstract base + a type guard so `route-helpers.ts` needs exactly one
new branch, not four — this also minimizes collision with the parallel
R-PERF-02 edits to that file.

In `src/dal/errors.ts`, add:

```ts
/** A listing failed an eligibility re-check at quote/approve/accept time (BIZ-08). */
export abstract class ListingEligibilityError extends Error {
  abstract readonly code: string;
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export function isListingEligibilityError(
  error: unknown,
): error is ListingEligibilityError {
  return error instanceof ListingEligibilityError;
}

/** Listing `status` is not one of the bookable states. */
export class ListingNotBookableError extends ListingEligibilityError {
  readonly code = "LISTING_NOT_BOOKABLE";
  constructor(message = "This listing isn't available for booking right now.") {
    super(message);
  }
}

/** Rental listing `isActive = false` (archived by its owner). */
export class ListingArchivedError extends ListingEligibilityError {
  readonly code = "LISTING_ARCHIVED";
  constructor(message = "This listing has been removed by its owner.") {
    super(message);
  }
}

/** Rental listing `approvalStatus !== "approved"`. */
export class ListingNotApprovedError extends ListingEligibilityError {
  readonly code = "LISTING_NOT_APPROVED";
  constructor(message = "This listing hasn't been approved yet.") {
    super(message);
  }
}

/** Either party is not visible in the listing's community (the symmetric R5 rule). */
export class CommunityNotVisibleError extends ListingEligibilityError {
  readonly code = "COMMUNITY_NOT_VISIBLE";
  constructor(message = "This listing isn't visible to you right now.") {
    super(message);
  }
}
```

In `src/lib/api/route-helpers.ts`, add `isListingEligibilityError` to the
`@/dal/errors` import, add `!isListingEligibilityError(error)` to
`shouldCaptureError`, and add one branch next to the existing `isDisputeError`
branch (before the generic `Error` fallback):

```ts
if (isListingEligibilityError(error)) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.statusCode },
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 5 (BIZ-08, rentals — quote): Add the four blockers

In `src/features/rentals/services/rental-quote.ts`, add `communityDAL` to the
`@/dal` import, extend `QuoteBlockerCode` with
`"LISTING_NOT_BOOKABLE" | "LISTING_ARCHIVED" | "LISTING_NOT_APPROVED" | "COMMUNITY_NOT_VISIBLE"`,
and after the `OWN_LISTING` block (:112-117) add:

```ts
if (listing.status !== "available" && listing.status !== "rented") {
  blockers.push({
    code: "LISTING_NOT_BOOKABLE",
    message: "This listing isn't available for booking right now.",
  });
}
if (!listing.isActive) {
  blockers.push({
    code: "LISTING_ARCHIVED",
    message: "This listing has been removed by its owner.",
  });
}
if (listing.approvalStatus !== "approved") {
  blockers.push({
    code: "LISTING_NOT_APPROVED",
    message: "This listing hasn't been approved yet.",
  });
}
const [viewerVisible, ownerVisible] = await Promise.all([
  communityDAL.isVisibleInCommunity(userId, listing.communityId),
  communityDAL.isVisibleInCommunity(listing.owner.id, listing.communityId),
]);
if (!viewerVisible || !ownerVisible) {
  blockers.push({
    code: "COMMUNITY_NOT_VISIBLE",
    message: "This listing isn't visible to you right now.",
  });
}
```

`listing.isActive` does not exist on `ListingDetails` yet — add it (Step 7).

In `src/features/rentals/services/rental-service.ts`, change the blocker
throw in `createRentalRequest` (:186-189) to map the four new codes to typed
errors, preserving today's behavior (bare `Error`, 500) for every other code:

```ts
const [blocker] = quote.blockers;
if (blocker) {
  if (
    blocker.code === "LISTING_NOT_BOOKABLE" ||
    blocker.code === "LISTING_ARCHIVED" ||
    blocker.code === "LISTING_NOT_APPROVED" ||
    blocker.code === "COMMUNITY_NOT_VISIBLE"
  ) {
    const errors = await import("@/dal/errors");
    const ErrorByCode = {
      LISTING_NOT_BOOKABLE: errors.ListingNotBookableError,
      LISTING_ARCHIVED: errors.ListingArchivedError,
      LISTING_NOT_APPROVED: errors.ListingNotApprovedError,
      COMMUNITY_NOT_VISIBLE: errors.CommunityNotVisibleError,
    } as const;
    throw new ErrorByCode[blocker.code](blocker.message);
  }
  throw new Error(blocker.message);
}
```

(Dynamic import matches this file's existing convention — see
`CounterpartyUnavailableError`/`RentalRequestNotPendingError` a few lines
below, both loaded the same way.)

**Verify**: `bun run type-check` → exit 0.

### Step 6 (BIZ-08, rentals — approve re-check): Extend `getRentalRequestById`, re-check in `approveRentalRequest`

In `src/dal/rentals.dal.ts`, extend `getRentalRequestById`'s return-type
annotation and `.select({...})` projection (:671-736) with four fields —
add after `listingImageUrl` in the type and after `listingName: listings.name,`
in the select (this reuses the existing `listings` join; no new query):

```ts
listingStatus: string;
listingIsActive: boolean;
listingApprovalStatus: string;
listingCommunityId: string;
```

```ts
listingStatus: listings.status,
listingIsActive: listings.isActive,
listingApprovalStatus: listings.approvalStatus,
listingCommunityId: listings.communityId,
```

The final `return { ...request, listingImageUrl: ... }` (:754-757) already
spreads `request`, so the new fields flow through with no further change.
Before touching this, `grep -n "getRentalRequestById" src/app/api/rentals src/features/rentals` —
confirm (as of this writing) every caller builds an explicit response shape
rather than spreading the raw object; if any caller spreads it into a JSON
response, exclude the new fields there too.

In `src/features/rentals/services/rental-service.ts`, add `communityDAL` to
the `@/dal` import, and in `approveRentalRequest`, right after the
`status !== "pending"` check (:401-410, before `assertCounterpartyActive`), add:

```ts
if (
  rentalRequest.listingStatus !== "available" &&
  rentalRequest.listingStatus !== "rented"
) {
  const { ListingNotBookableError } = await import("@/dal/errors");
  throw new ListingNotBookableError();
}
if (!rentalRequest.listingIsActive) {
  const { ListingArchivedError } = await import("@/dal/errors");
  throw new ListingArchivedError();
}
if (rentalRequest.listingApprovalStatus !== "approved") {
  const { ListingNotApprovedError } = await import("@/dal/errors");
  throw new ListingNotApprovedError();
}
const [ownerVisible, renterVisible] = await Promise.all([
  communityDAL.isVisibleInCommunity(
    rentalRequest.ownerId,
    rentalRequest.listingCommunityId,
  ),
  communityDAL.isVisibleInCommunity(
    rentalRequest.renterId,
    rentalRequest.listingCommunityId,
  ),
]);
if (!ownerVisible || !renterVisible) {
  const { CommunityNotVisibleError } = await import("@/dal/errors");
  throw new CommunityNotVisibleError();
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 7: Give `ListingDetails` an `isActive` field

In `src/dal/types.ts`, add `isActive: boolean;` to `ListingDetails` (near
`status: string;`, :260). In `src/dal/listing.dal.ts`'s `getListingById`
(:435), add `isActive: listing.isActive,` next to `status: listing.status,`
(the raw drizzle row already has this column; it just wasn't projected).

Because `getListingById`'s result is spread into
`GET /api/listings/[listingId]`'s response, exclude the new field from what
non-owners see — it's an internal lifecycle flag the app has never received,
same treatment as `approvalStatus`. In
`src/app/api/listings/[listingId]/route.ts:103`, change:

```ts
const { approvalStatus, rejectionReason, ...visibleToRenter } = listing;
void approvalStatus;
void rejectionReason;
```

to also destructure and void `isActive`.

**Verify**: `bun run type-check` → exit 0. `grep -rn "ListingDetails" src --include="*.ts"` — confirm the two other consumers (`src/test/fixtures/listings.ts`, `src/features/listings/hooks/use-listings.ts`) still compile after Step 8's fixture fix (the hooks file only has a coincidental name match, no type import — no change needed there).

### Step 8 (BIZ-08, services — quote + accept re-check)

In `src/features/services/services/service-booking-quote.ts`, add
`communityDAL` to the `@/dal` import, extend `ServiceQuoteBlockerCode` with
`"COMMUNITY_NOT_VISIBLE"`, and after the `OWN_LISTING` block add:

```ts
const [providerVisible, requesterVisible] = await Promise.all([
  communityDAL.isVisibleInCommunity(listing.providerId, listing.communityId),
  communityDAL.isVisibleInCommunity(requesterId, listing.communityId),
]);
if (!providerVisible || !requesterVisible) {
  blockers.push({
    code: "COMMUNITY_NOT_VISIBLE",
    message: "This listing isn't visible to you right now.",
  });
}
```

In `src/features/services/services/service-booking-service.ts`: this file
already statically imports several `@/dal/errors` classes (:11-18) — add
`CommunityNotVisibleError` and `ListingNotBookableError` to that same import,
and `communityDAL` to the `@/dal` import (:1-8).

In `createBooking`'s blocker mapping, add a branch before the generic
`ValidationError` fallback:

```ts
const [blocker] = quote.blockers;
if (blocker) {
  if (blocker.code === "OWN_LISTING") throw new ForbiddenError(blocker.message);
  if (blocker.code === "COMMUNITY_NOT_VISIBLE") {
    throw new CommunityNotVisibleError(blocker.message);
  }
  throw new ValidationError(
    blocker.message,
    blocker.code === "HOURS_REQUIRED" ? "hours" : "proposedDate",
  );
}
```

In `acceptBooking` (:262-281), right after the booking-`status` check, add the
re-check — no new query, `detail` already has everything:

```ts
if (detail.listing.status !== "active") {
  throw new ListingNotBookableError();
}
const [providerVisible, requesterVisible] = await Promise.all([
  communityDAL.isVisibleInCommunity(
    detail.providerId,
    detail.listing.communityId,
  ),
  communityDAL.isVisibleInCommunity(
    detail.requesterId,
    detail.listing.communityId,
  ),
]);
if (!providerVisible || !requesterVisible) {
  throw new CommunityNotVisibleError();
}
```

**Verify**: `bun run type-check` → exit 0.

## Test plan

Run `bun run test:run <path>` per file as you go; all listed cases are new
unless noted.

- **`src/dal/__tests__/community.dal.test.ts`**:
  - `listCommunitiesByNetwork`/`getVisibilityForUser`: since these tests mock
    the whole `db.select` chain, they can't observe SQL columns by returning
    canned data — instead assert on the projection object passed _into_
    `db.select`: `const projection = vi.mocked(db.select).mock.calls[0][0]; expect(projection).toHaveProperty("id"); expect(projection).not.toHaveProperty("joinCode");`.
  - `validateJoinCodeForSignup`: existing tests unchanged; add one case
    (`mockInactiveCommunity`) confirming the DAL is still exercised — the real
    filtering is SQL-level, so this only pins that `db.select` is still called
    once with a `.where().limit()` chain; the isActive semantics themselves
    are effectively covered by `selectPrimaryCommunity`'s existing inactive-community
    test pattern (same fixture).
  - `bulkSetVisibility`: the primary-lookup query gains an `.innerJoin()` —
    update the two existing mocked chains (":1988" "rejects toggling primary",
    ":2004" "upserts each update") to insert an `innerJoin` step returning
    `{ where }` between `from` and `where`, and change the resolved row shape
    to `{ communityId: "primary-c", networkId: mockCommunityNetwork.id }` (or
    `{communityId: undefined, networkId: undefined}` for the no-primary case,
    which should now throw `ValidationError`, not proceed to insert). Add:
    mock `listCommunitiesByNetwork` (via `db.select`'s next call, or spy on
    `communityDAL.listCommunitiesByNetwork` directly) to return
    `[{id: "primary-c"}, {id: "c2"}]`; assert an update with `communityId: "outside-network"` rejects with `ValidationError` and `db.insert` is never called; assert hiding primary now rejects with `VisibilityPrimaryLockedError` (not `ValidationError`).

- **`src/app/api/communities/__tests__/route.test.ts`** (:78): change the
  expected header to `"private, max-age=60"`.

- **`src/app/api/users/me/visibility/__tests__/route.test.ts`** (:147-158):
  import `VisibilityPrimaryLockedError` instead of `ValidationError`, reject
  with it; status assertion (400) is unchanged.

- **`src/lib/api/__tests__/route-helpers.test.ts`**: add, mirroring the
  existing `RentalDatesUnavailableError`/`NeedLimitReachedError` cases:
  - `VisibilityPrimaryLockedError` → 400, `code: "VISIBILITY_PRIMARY_LOCKED"`.
  - Each of `ListingNotBookableError`, `ListingArchivedError`,
    `ListingNotApprovedError`, `CommunityNotVisibleError` → 409, matching code.
  - Add all five to the `it.each` Sentry-capture-exclusion list.

- **`src/test/fixtures/listings.ts`**: add `isActive: true` to `mockListing`
  (the base fixture — required now that `ListingDetails.isActive` exists);
  add `isActive: false` to `mockListingArchived` (currently identical to
  `mockListingActive`, which was already a latent fixture bug this surfaces).

- **`src/app/api/rentals/preview/__tests__/route.test.ts`**: add
  `communityDAL: { isVisibleInCommunity: (...a) => mockIsVisibleInCommunity(...a) }`
  to the `@/dal` mock, default it to resolve `true`; add `status: "available", isActive: true, approvalStatus: "approved", communityId: "community-1"` to the `listing()` helper's defaults; add one case per new blocker (override the one field, assert `blockers` contains the matching code and `canBook: false`).

- **`src/features/rentals/services/rental-service.test.ts`**: add a
  `communityDAL` entry to the `@/dal` mock (default `isVisibleInCommunity` →
  `true`); add the same four fields (eligible defaults) to the `beforeEach`
  default `mockGetListingById` resolution and to every per-test override
  literal (`grep -n "mockGetListingById.mockResolvedValue" src/features/rentals/services/rental-service.test.ts`
  to find each one) so existing tests keep passing; add one new test per
  blocker asserting the create call now rejects with the matching typed error.

- **`src/features/rentals/services/__tests__/rental-service.approve.test.ts`**:
  change `listingDAL: {}` to also not be needed (no new DAL call here — see
  Step 6); add a `communityDAL` entry to the `@/dal` mock; add
  `listingStatus: "available", listingIsActive: true, listingApprovalStatus: "approved", listingCommunityId: "community-1"`
  to every `mockGetRentalRequestById.mockResolvedValue(...)` fixture (`grep -n "mockGetRentalRequestById.mockResolvedValue"` to find each); add four new tests, one per re-check, each overriding one field/mock to the ineligible value and asserting the matching typed error, `assertConnectReady`/Stripe never called.

- **`src/app/api/services/bookings/preview/__tests__/route.test.ts`**: add
  `communityDAL` to the `@/dal` mock (default visible `true`); add a case
  where one party is not visible → `COMMUNITY_NOT_VISIBLE` blocker, `canBook: false`.

- **`src/features/services/__tests__/service-booking-service.test.ts`**: add
  `communityDAL: { isVisibleInCommunity: (...a) => mockIsVisibleInCommunity(...a) }`
  to the `@/dal` mock, default `true` in `beforeEach`; add a `createBooking`
  test asserting `COMMUNITY_NOT_VISIBLE` → `CommunityNotVisibleError`; add two
  `acceptBooking` tests: listing `status: "inactive"` → `ListingNotBookableError`,
  claim never called; one party not visible → `CommunityNotVisibleError`, claim never called.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `grep -n "joinCode" src/dal/community.dal.ts` shows it nowhere in
      `listCommunitiesByNetwork` or `getVisibilityForUser`
- [ ] A test proves `PATCH /api/users/me/visibility` with a foreign/standalone
      `communityId` is rejected and writes no row
- [ ] A test proves hiding the primary community returns `code: "VISIBILITY_PRIMARY_LOCKED"`
- [ ] A test proves each of the four new blockers is returned by the relevant
      quote endpoint and enforced (as a typed 409) at create/approve/accept time
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status")
- [ ] Rows added to the roadmap's "Mobile client follow-ups" table (see Mobile
      compatibility below — this is an API contract change)

## STOP conditions

- Excerpts above don't match live code (drift since `25e2233`) — re-read
  before editing, especially `route-helpers.ts`.
- `getRentalRequestById`'s callers include one that spreads the raw return
  object into a JSON response (Step 6's grep) — stop and exclude the four new
  fields there before proceeding, rather than shipping a new leak.
- Any step's test fails twice after a reasonable fix attempt.
- Another plan's changes to `route-helpers.ts` conflict with
  Step 3/4's additions in a way that isn't a clean union — stop and report
  rather than discarding either side.

## Mobile compatibility

- **SEC-09** (joinCode removal, Cache-Control): no app change. Mobile already
  parses both responses through narrow Zod schemas
  (`community.contract.ts`, `visibility.contract.ts`) that never read
  `joinCode` — confirmed by their own comments citing this finding.
- **SEC-08** (network-scoped visibility writes): additive server-side
  rejection. The app only ever toggles ids it received from
  `GET /api/users/me/visibility`, which is already network-scoped, so it
  cannot trigger the new rejection in normal use.
- **VISIBILITY_PRIMARY_LOCKED**: new stable `code` on an existing 400. Mobile's
  visibility-settings screen (epic 14, task 14.2.1) can branch on it instead
  of the message once built; the response shape (`{error, code}`) already
  matches other 4xx codes the app knows how to read generically.
- **New quote-blocker codes** (`LISTING_NOT_BOOKABLE`, `LISTING_ARCHIVED`,
  `LISTING_NOT_APPROVED` on rentals; `COMMUNITY_NOT_VISIBLE` on both): both
  mobile blocker enums are `tolerantEnum`-based
  (`hoador-mobile/src/api/contract/rental-pricing.contract.ts:48-55`,
  `service-booking-pricing.contract.ts:26-31`) — an unrecognized code still
  renders its `message`, so this is safe to ship without a mobile release.
  Reused at approve/accept as a `409 {error, code}` body, same shape as
  `DATES_UNAVAILABLE`'s existing reuse (roadmap 1.1/R-CONC-01).
- Add these rows to the roadmap's "Mobile client follow-ups" table:

  | Fix                     | Contract change                                                                                                                                                                                                       | Where the app sees it                     | Mobile task   | Status                                                                               |
  | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
  | R-SEC-08/09 (this plan) | `joinCode` removed from `GET /api/communities` and `GET /api/users/me/visibility`; `Cache-Control` now `private`                                                                                                      | community list, visibility settings       | —             | DONE (no app change — mobile already parses via a schema that never read `joinCode`) |
  | R-SEC-08 (this plan)    | `400 {code: VISIBILITY_PRIMARY_LOCKED}` on `PATCH /api/users/me/visibility` when hiding the primary community                                                                                                         | visibility settings screen                | 14.2.1 (soft) | TODO (P-E14-6; can branch on `code` instead of message)                              |
  | R-BIZ-08 (this plan)    | New quote-blocker codes `LISTING_NOT_BOOKABLE`, `LISTING_ARCHIVED`, `LISTING_NOT_APPROVED` (rentals) and `COMMUNITY_NOT_VISIBLE` (both) on preview; same codes reused as `409 {error, code}` on create/approve/accept | rental request flow, service booking flow | —             | TODO (additive/tolerant — optional: per-code copy)                                   |

## Maintenance notes

- The listing detail route (`GET /api/listings/[listingId]`) has a related but
  unflagged gap: it never checks `isActive` (archive) for non-owners, only
  `status`. This plan deliberately does not touch it (not cited by BIZ-08's
  files, and expanding scope there risks a second, larger contract review of
  that route's response shape) — worth a follow-up finding if the maintainer
  wants full parity with the quote/approve gates added here.
- If a future network gets a second/third community, SEC-08's fix is what
  makes that safe; today's single-network deployment bounded the original
  finding's severity, but this closes it before that changes.
