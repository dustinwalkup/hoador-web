# Plan R-SEC-10: Close listing-moderation bypasses and lock uploads to their owner's blob prefix

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 25e2233..HEAD -- src/app/api/listings/[listingId]/status/route.ts src/app/api/listings/[listingId]/route.ts src/dal/listing.dal.ts src/features/rentals/services/rental-quote.ts src/features/services/services/service-listing-service.ts src/app/api/onboarding/route.ts src/app/api/profile/route.ts src/app/api/profile/upload/route.ts src/dal/types.ts src/app/api/rentals/[id]/end/route.ts src/services/vercel-blob/index.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: MED · **Depends on**: none
  (see "Ordering with R-PRIV-09")
- **Category**: security · **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: SEC-10, SEC-11, SEC-22

## Why this matters

- **SEC-10**: `PATCH /api/listings/[id]/status` accepts `available` from any
  status, including `pending_review`/`rejected` — a denied owner
  self-approves. Services merge approval into `status`
  (`pending_approval`/`active`/`inactive`/`denied`), and `deactivateListing`
  writes `inactive` from **any** status, so `denied`→deactivate→reactivate
  reaches `active` with no review. Neither the rental detail GET nor the
  quote checks `approvalStatus`, so an unapproved listing is bookable by
  direct link regardless.
- **SEC-11**: `profileImageUrl` is client-settable on `PATCH /api/profile`
  and `POST /api/onboarding`, and `DELETE /api/profile/upload` trusts that
  same column for its ownership check — set it to a victim's avatar path,
  then DELETE it, and the victim's blob is gone. Mobile Epic 14's "Remove
  photo" also waits on `DELETE` clearing the column (P-E14-2); today it
  deletes the blob but leaves the column pointing at a 404.
- **SEC-22**: `POST /api/rentals/[id]/end`'s `damagePhotos` accepts any
  external URL, unlike the upload route that actually writes photos there —
  an owner can attach a tracking pixel or someone else's blob as "evidence."

## Current state

- `listings/[listingId]/status/route.ts:12-14,60-87` — schema is
  `z.enum(["available","maintenance","inactive"])`; no approval check.
  `listing.dal.ts:672-694` `updateListingStatus` is a raw write.
- `listings/[listingId]/route.ts:25,92` — `BROWSEABLE_STATUSES = new Set(["available","rented"])` gates non-owners; `listing.approvalStatus` is never checked there.
- `rental-quote.ts` `quoteRentalRequest` never reads `listing.status`/`listing.approvalStatus` (grep confirms no hits); `rental-service.ts:169-186` throws the quote's first blocker, so fixing the quote fixes both preview and creation.
- `services.schema.ts:268-273` — `serviceListingStatusEnum = ["pending_approval","active","inactive","denied"]`, one column for lifecycle + approval.
- `service-listing-service.ts:353-373` `deactivateListing` writes `inactive` unconditionally; `:378-404` `reactivateListing` only requires current `status === "inactive"` (`:391-395`).
- `profile.schema.ts:18,54` / `onboarding/schemas/validation.ts:40-44` — both accept `profileImageUrl: z.string().url()`, optional.
- `profile/upload/route.ts:18-118` `POST` uploads to `profiles/${userId}/...` (already user-scoped) but never writes `user.profileImageUrl` (no `userDAL` import) — the client PATCHes it back, which is the hole SEC-11 closes. `:80-101`'s old-image cleanup only checks the `profiles/` prefix, not the user's own.
- `profile/upload/route.ts:120-188` `DELETE` — ownership check at `:141-173` is correct, but never clears `user.profileImageUrl` (`:175` deletes the blob only).
- `dal/types.ts:42-55` `UpdateUserDTO.profileImageUrl?: string` — no `null`, so the column can't be cleared today.
- `rentals/[id]/end/route.ts:31-41` — `damagePhotos: z.array(z.string().url())...`, no prefix check. `rentals/[id]/damage-photos/route.ts:96-99` uploads to `rentals/${rentalId}/damage/...`. `rentals.dal.ts:3113-3115` `endRental` writes `input.damagePhotos` verbatim.

**Ordering with R-PRIV-09** (sibling plan, not yet executed): it adds
`pathnameFromBlobUrl` to `src/services/vercel-blob/index.ts`. This plan adds
the same helper (Step 3) — whichever plan lands first, the second should
find it already there and skip re-adding it.

## Decisions for the maintainer

**Drop `profileImageUrl` from the write schemas, or keep and restrict it?**
The finding says drop it; the roadmap's own note (after folding in mobile
P-E14-2) says keep it but accept only same-prefix values, because mobile's
`setAvatar()`/onboarding still PATCH it right after upload. **Recommended:
keep it, validate it, drop it silently when it doesn't match** — additive,
matches the roadmap note, and mobile's own follow-up removes the redundant
PATCH once this lands (see Mobile compatibility). Steps below implement this.

## Commands

| Purpose   | Command                                                                                                                                                                                           | Expected |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck | `bun run type-check`                                                                                                                                                                              | exit 0   |
| Lint      | `bun run lint`                                                                                                                                                                                    | exit 0   |
| Tests     | `bun run test:run src/app/api/listings src/app/api/services/listings src/app/api/profile src/app/api/onboarding src/app/api/rentals src/features/rentals/services src/features/services/services` | all pass |

## Scope

**In scope**: `listings/[listingId]/status/route.ts`,
`listings/[listingId]/route.ts`, `service-listing-service.ts`,
`onboarding/route.ts`, `profile/route.ts`, `profile/upload/route.ts`,
`dal/types.ts`, `services/vercel-blob/index.ts`,
`src/features/users/lib/profile-image.ts` (new), `rentals/[id]/end/route.ts`,
and tests for all of the above.

**Out of scope**: web `/dashboard/listings/[id]/edit` (SEC-23, Phase 3);
validating the better-auth `image` field on `acceptLegalDocuments` (separate
write path); `listBlobsByPrefix` (R-PRIV-09's, unused here); hard-erroring a
mismatched `profileImageUrl`/`damagePhotos` instead of dropping it (the
finding's own tests say "ignored").

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### 1 (SEC-10, rentals): refuse `available` unless approved

In `status/route.ts`, after the ownership check, before the update call:

```ts
if (status === "available" && existingListing.approvalStatus !== "approved") {
  return NextResponse.json(
    { error: "This listing hasn't been approved yet." },
    { status: 400 },
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### 2 (SEC-10, rentals): gate the detail GET and the quote

In `listings/[listingId]/route.ts`, change
`if (!BROWSEABLE_STATUSES.has(listing.status))` to
`if (!BROWSEABLE_STATUSES.has(listing.status) || listing.approvalStatus !== "approved")`.

**The quote half belongs to roadmap 1.9** (`R-SEC-08-community-isolation.md`,
Step 5). That plan adds the `LISTING_NOT_BOOKABLE` and `LISTING_NOT_APPROVED`
quote blockers, which cover this, and re-checks them at approve time. Don't add a
second, differently named blocker here. If 1.9 is DONE, there's nothing to
do. If it isn't, land 1.9's Step 5 first, or leave the quote to it and note in
the roadmap status row that SEC-10's quote gap closes with 1.9.

**Verify**: `bun run type-check` → exit 0.

### 3 (SEC-11 / SEC-22 shared helper): blob-ownership helper

In `src/services/vercel-blob/index.ts` add `pathnameFromBlobUrl` (skip it if
already present; see "Ordering with R-PRIV-09"), plus a host-checked
prefix test:

```ts
export function pathnameFromBlobUrl(url: string): string {
  return new URL(url).pathname.slice(1);
}

/**
 * True only for an https URL on OUR Vercel Blob store whose pathname starts
 * with `prefix`. Checking the pathname alone isn't enough, because
 * `https://evil.example/profiles/<id>/x.png` has the same pathname. That's
 * the tracking-pixel case SEC-22 is about. Never throws.
 */
export function isOwnBlobUrl(url: string, prefix: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.slice(1).startsWith(prefix)
    );
  } catch {
    return false;
  }
}
```

(Any `*.public.blob.vercel-storage.com` host is accepted rather than
hard-coding the two store ids in `next.config.ts:51-57`. Another customer's
store on that suffix can't be under _this_ user's prefix by accident, and a
deliberate one only affects the attacker's own avatar or their own rental's
evidence. Pin the store hosts if you want it tighter.)

Create `src/features/users/lib/profile-image.ts`:

```ts
import { isOwnBlobUrl } from "@/services/vercel-blob";

/** Whether `url` is this user's own avatar blob (SEC-11). */
export function isOwnProfileImagePath(url: string, userId: string): boolean {
  return isOwnBlobUrl(url, `profiles/${userId}/`);
}
```

**Verify**: `bun run type-check` → exit 0.

### 4 (SEC-10, services): deactivate only from `active`

In `service-listing-service.ts`'s `deactivateListing`, after the ownership
check: `if (existing.status !== "active") throw new ValidationError("Only active listings can be deactivated", "status");`.
Leave `reactivateListing` unchanged — `inactive` can now only follow
`active`, so its existing check is already sufficient.

**Verify**: `bun run type-check` → exit 0.

### 5 (SEC-11): restrict `profileImageUrl` on write; upload route sets it

In `profile/route.ts`'s `patchHandler`, after destructuring `userFields`:

```ts
if (
  typeof userFields.profileImageUrl === "string" &&
  !isOwnProfileImagePath(userFields.profileImageUrl, userId)
) {
  delete userFields.profileImageUrl;
}
```

In `onboarding/route.ts`, same check on `profileData.profileImageUrl` (also
guard `!== ""`, since the schema allows an empty string). Import
`isOwnProfileImagePath` in both.

In `profile/upload/route.ts`'s `postHandler`, after the upload call:
`await userDAL.updateUser(userId, { profileImageUrl: blob.url });` (import
`userDAL` from `@/dal`). Tighten the old-image cleanup's
`oldPathname.startsWith("profiles/")` to
``oldPathname.startsWith(`profiles/${userId}/`)``.

**Verify**: `bun run type-check` → exit 0.

### 6 (SEC-11 / mobile P-E14-2): `DELETE` clears the column first

In `dal/types.ts`, widen `UpdateUserDTO.profileImageUrl?: string;` to
`profileImageUrl?: string | null;`.

In `profile/upload/route.ts`'s `deleteHandler`, after the existing ownership
check and **before** `await deleteFromBlob(pathname);`:

```ts
if (pathname === currentImagePathname) {
  await userDAL.updateUser(userId, { profileImageUrl: null });
}
```

Order matters: a failed column write then aborts before the blob is touched.

**Verify**: `bun run type-check` → exit 0.

### 7 (SEC-22): restrict `damagePhotos` to the rental's own prefix

In `rentals/[id]/end/route.ts`, after `const { id: rentalId } = await params;`,
import `isOwnBlobUrl` and filter before building `endInput`:

```ts
const ownedDamagePhotos = parsed.data.damagePhotos?.filter((url) =>
  isOwnBlobUrl(url, `rentals/${rentalId}/damage/`),
);
```

Use `ownedDamagePhotos` in `endInput.damagePhotos`.

**Verify**: `bun run type-check` → exit 0.

### 8: Tests

- `listings/[listingId]/status/__tests__/route.test.ts` (new): `available`
  on `pending_review`/`rejected` → 400, DAL never called; on `approved` → 200.
- `listings/[listingId]/__tests__/route.test.ts` (extend): non-owner GET of
  an `available`-but-unapproved listing → 404.
- `src/services/vercel-blob/__tests__/index.test.ts` (new): `isOwnBlobUrl`
  accepts a store URL under the prefix; rejects a foreign host with the same
  pathname, `http:`, a different prefix, and a malformed string.
- `service-listing-service.test.ts` (extend): deactivate on
  `pending_approval`/`denied` throws `ValidationError`; active→deactivate→reactivate
  still works.
- `profile/__tests__/route.test.ts` + `onboarding/__tests__/route.test.ts`
  (extend): foreign-prefix `profileImageUrl` → written value omits it;
  own-prefix → written value includes it.
- `profile/upload/__tests__/route.test.ts` (extend, add `mockUpdateUser` to
  its `@/dal` mock): POST → `updateUser({profileImageUrl: blob.url})`; DELETE
  of the current avatar → `updateUser({profileImageUrl: null})` before
  `deleteFromBlob`.
- `rentals/[id]/end/__tests__/route.test.ts` (extend): a foreign
  `damagePhotos` URL is dropped (including `https://evil.example/rentals/<id>/damage/x.png`);
  mixed owned/foreign keeps only the owned one.

**Verify**: `bun run test:run` (targeted paths, then full) → all pass.

## Test plan

Covered by Step 8. `bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0; `bun run test:run` → exit 0
- [ ] `PATCH /api/listings/[id]/status {status:"available"}` on an unapproved
      listing → 400 (test)
- [ ] A `pending_approval`/`denied` service listing can't reach `active` via
      deactivate→reactivate (test)
- [ ] Upload sets `profileImageUrl`; DELETE clears it before deleting the
      blob (test)
- [ ] PATCH/onboarding silently drop a foreign-prefix `profileImageUrl` (test)
- [ ] `end` drops any `damagePhotos` URL outside the rental's own prefix (test)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `10-remediation-roadmap.md` (1.10)

## STOP conditions

- Any "Current state" excerpt doesn't match live code.
- A caller of `updateListingStatus`/`deactivateListing`/`reactivateListing`
  other than the routes named in Scope exists (re-grep before editing).
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

- **SEC-10**: no new quote code here (1.9 owns those). Service deactivate/reactivate
  errors are handled generically on mobile (no status-code branching), so the
  new 400 isn't a contract change.
- **SEC-11**: confirmed via `grep -rn "profile/upload\|profileImageUrl" hoador-mobile/src`
  — `avatar-upload.ts`/`profile/lib/avatar.ts`'s `setAvatar()` PATCH the
  exact URL the upload just returned, always under the caller's own prefix,
  so nothing breaks. The mobile spec
  (`hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md:40`)
  already plans to drop that redundant PATCH once this lands and add a
  `removeAvatar()` — tracked as mobile task P-E14-2, not a wire-shape change
  here, so no row in this repo's roadmap table.
- **SEC-22**: confirmed via `grep -rn "damage-photos\|damagePhotos" hoador-mobile/src`
  — the app always uploads first and passes back only the returned URLs, so
  no behavior change.

## Maintenance notes

- The DELETE route's legacy "matches current `profileImageUrl`" fallback
  (unchanged here) is for avatars from before user-scoped paths existed; drop
  it once a data check confirms no such row remains.
- `isOwnBlobUrl` accepts any `*.public.blob.vercel-storage.com` host (see
  Step 3). Pin the two store hosts from `next.config.ts` if the residual
  matters.
