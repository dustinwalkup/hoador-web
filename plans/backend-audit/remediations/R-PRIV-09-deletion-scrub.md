# Plan R-PRIV-09: Delete blobs and scrub leftover PII on self-deletion

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 25e2233..HEAD -- src/dal/account-deletion.dal.ts src/features/users/services/account-deletion-service.ts src/services/vercel-blob/index.ts src/db/schemas/listings.schema.ts src/db/schemas/services.schema.ts src/db/schemas/rentals.schema.ts src/db/schemas/disputes.schema.ts src/db/schemas/notifications.schema.ts src/db/schemas/user-activity.schema.ts`
> A mismatch against "Current state" below is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED (touches the anonymize
  transaction; no migration)
- **Depends on**: none. Lands after `R-BIZ-07` (`6eac776`, already merged),
  which this plan's "why the dispute-evidence gate is provably safe"
  reasoning relies on — re-read `getDeletionBlockers`/`countOpenDisputes` if
  that method's predicates change later.
- **Category**: privacy / data retention · **Planned at**: commit `25e2233`,
  2026-09-24 · **Fixes**: PRIV-09

## Why this matters

`DELETE /api/users/me` anonymizes the user row and revokes sessions, but
never touches blob storage: an avatar, every listing/service-listing photo,
every owner-uploaded damage photo and every dispute-evidence image the user
ever uploaded stays live on Vercel Blob's public CDN at its existing URL
forever. `push_subscriptions` rows are deactivated, not deleted, leaving a
live device token/endpoint on a "deleted" account. `rental_requests` keeps
the renter's delivery address, free-text message and Meta Ads
`attributionContext` (fbp/fbc/IP/user agent). `user_activity_log` keeps IPs
and user agents. None of this needs the row destroyed — R-DB-01's
RESTRICT/archive rules protect financial and legal records, not photos or
marketing metadata — so this is a narrower, lower-risk fix than R-DB-01's.
This is also the one gap mobile Epic 14 flagged against Apple Guideline
5.1.1(v)/the account-deletion support page's "delete the entire account
record, along with associated personal data": moved to before store
submission on 2026-09-24 (roadmap item 1.19).

## Current state

- `account-deletion.dal.ts:21-44` `AnonymizeUserResult` — no blob or PII-field
  bookkeeping.
- `account-deletion.dal.ts:305-521` `anonymizeUser`, inside `this.db.transaction`:
  - `:326-344` scrubs the `user` row's own PII (name/email tombstoned,
    image/profileImageUrl/phone/bio nulled) but never deletes the blob
    `profileImageUrl` pointed at.
  - `:365-374` deactivates `push_subscriptions` (`isActive: false`) instead
    of deleting.
  - `:375-378` deactivates `user_payment_methods` — **out of scope here**;
    the roadmap note only asks for push tokens, and local card metadata
    follows the Stripe-customer retention window (Phase 2), same as
    `stripeCustomerId` at `:339-341`.
  - `:380-397` sets `listings.status`/`serviceListings.status` to
    `"inactive"` and soft-deletes `neighborhoodNeeds` — never touches
    `listing_images`, `service_listings.photos`, `rentals.damage_photos`, or
    `dispute_evidence`, and never sets `listings.isActive` (the flag R-DB-01
    uses for "archived").
  - `:399-452` (R-BIZ-07) cancels the user's own pending `rental_requests`/
    `service_bookings` but only sets cancellation fields — `deliveryAddress`,
    `deliveryInstructions`, `message`, `attributionContext` on
    `rental_requests` are untouched, for cancelled rows and for every other
    status (completed, denied, expired) too.
  - `user_activity_log` is never referenced in this file.
- `account-deletion-service.ts:117-145` `deleteOwnAccount` — post-commit,
  best-effort: `detachAllCards` (`:151-187`), `revokeAppleTokens`
  (`:195-213`), `notifyCounterparts` (`:216-252`). No blob step.
- `src/services/vercel-blob/index.ts:1-31` — exports `uploadToBlob`/
  `deleteFromBlob` only. `@vercel/blob` (v2.4.0, already a dependency) also
  exports `list({ prefix })`, unused anywhere in the repo.
- Blob path conventions (confirmed by reading every uploader):
  `profiles/<userId>/...` (`src/app/api/profile/upload/route.ts:71`, stored
  as a full URL in `user.profileImageUrl`); `listings/<listingId>/...`
  (`listing-service.ts:148`, pathname stored directly in
  `listing_images.blob_pathname` — `listings.schema.ts:146-159`);
  `service-listings/<listingId>/...` (`service-listing-service.ts:268`, full
  URLs in `service_listings.photos` jsonb array —
  `services.schema.ts:31-58`); `rentals/<rentalId>/damage/...`
  (damage-photos route, full URLs in `rentals.damage_photos` jsonb array,
  owner-only upload — `rentals.schema.ts:136-186`); `disputes/<disputeId>/evidence/...`
  (evidence route, full URL in `dispute_evidence.content` when
  `evidence_type = 'image'` — `disputes.schema.ts:90-110`). Every one of
  these is keyed by the **resource** id, not the user id, except `profiles/`
  — so avatar cleanup can enumerate by prefix, the rest must come from DB
  columns (there's no cheap way to `list()` "every listing/rental/dispute
  this user touched").
- `disputes.schema.ts` (`disputeRoleEnum`, `_enums.ts:145-150`) has no admin
  role, and `POST /api/disputes/[id]/evidence` (`:44-84`) 403s anyone who
  isn't the rental's renter/owner or the booking's requester/provider. So
  every `dispute_evidence.uploaded_by` is a party to the underlying
  rental/booking — the same set `getDeletionBlockers`'s `countOpenDisputes`
  (`account-deletion.dal.ts:242-278`) already checks. **This is load-bearing
  for Decision 2 below.**

## Decisions for the maintainer

**Decision 1 — whose damage photos get deleted.**
`rentals.damage_photos` is written only by `POST /api/rentals/[id]/damage-photos`,
which 403s anyone but `rental.ownerId` (the listing owner's condition report,
not the renter's). A rental has two parties; deleting either account could
plausibly trigger cleanup.

- **Option A (recommended)**: scrub `damage_photos` only for rentals where
  `ownerId = <the deleting user>` — it's their upload, mirroring how listing
  photos (`listings.ownerId`) and dispute evidence (`uploadedBy`) are scoped
  everywhere else in this plan: always delete what _this_ user created,
  never a counterparty's content.
- **Option B**: also scrub when the deleting user is the renter. Rejected —
  the photos document the _renter's_ rental but are the _owner's_ uploaded
  content/property record; deleting them because the renter left would let a
  renter erase the owner's own condition documentation by closing their
  account.
- Steps below implement Option A.

**Decision 2 — the dispute-evidence gate.**
The finding says evidence "may be needed by the counterparty or an admin in
an open dispute." Tracing it: `getDeletionBlockers` refuses deletion while
any dispute with status `open`/`evidence_requested`/`under_review` touches a
rental/booking the user was ever a party to (as creator, renter, owner,
requester, or provider — `countOpenDisputes`), and evidence upload requires
being exactly one of those parties. So **by the time `anonymizeUser` runs,
every dispute this user could have uploaded evidence on is already
`resolved`/`closed`** — there is no live "admin still needs this" case
reachable through the normal flow.

- **Recommended**: delete evidence images unconditionally would be correct
  today, but Step 2 below adds a defensive filter anyway (skip evidence on a
  non-terminal dispute) and returns a count. If that count is ever nonzero,
  it means the blocker's invariant broke somewhere else — Step 3 pages ops
  instead of silently over-deleting. Cheap insurance, not a hard requirement.
- **Rejected**: building a cron to sweep evidence after a dispute _later_
  closes — unnecessary, since the gate above should never actually skip
  anything; add one only if the ops alert in Step 3 ever fires for real.

## Commands you will need

| Purpose   | Command                                                                                                                                              | Expected |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck | `bun run type-check`                                                                                                                                 | exit 0   |
| Lint      | `bun run lint`                                                                                                                                       | exit 0   |
| Local DB  | `docker compose up -d && bun run db:push:e2e`                                                                                                        | applies  |
| DAL test  | `bun run test:integration src/dal/__tests__/account-deletion.integration.test.ts`                                                                    | passes   |
| Unit test | `bun run test:run src/features/users/services/__tests__/account-deletion-service.test.ts src/dal/__tests__/account-deletion-blocking-states.test.ts` | passes   |

No migration: every change is a data write to existing columns (null, `[]`,
`false`) or a row delete on existing tables.

## Scope

**In scope**: `src/services/vercel-blob/index.ts` (new `pathnameFromBlobUrl`,
`listBlobsByPrefix`); `src/dal/account-deletion.dal.ts` (`AnonymizeUserResult`,
`anonymizeUser`); `src/features/users/services/account-deletion-service.ts`
(`deleteOwnAccount` + two new helpers); tests in
`src/dal/__tests__/account-deletion.integration.test.ts` and
`src/features/users/services/__tests__/account-deletion-service.test.ts`.

**Out of scope**: `user_payment_methods` (card last4/expiry — Phase 2, tied
to the Stripe-customer retention window); the Stripe customer/Connect
account itself; `audit_logs`/`user_legal_acceptances` IP/user-agent columns
(append-only 5-year audit trail and RESTRICT'd legal-acceptance record
respectively — same retention rationale as agreement PDFs, which move with
PRIV-05, not here); `disputeEvidence` rows with `evidenceType: "text"` (no
blob, and the written statement is dispute-resolution content, not raw PII);
a backfill for users anonymized _before_ this fix lands (see **Production
cutover**).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### Step 1: Blob-service helpers

In `src/services/vercel-blob/index.ts`:

```ts
import { put, del, list } from "@vercel/blob";
```

Add, after `deleteFromBlob`:

```ts
/** `del()`/`list()` key on the pathname; DB columns store the full URL. */
export function pathnameFromBlobUrl(url: string): string {
  return new URL(url).pathname.slice(1);
}

/**
 * Every blob under a prefix, e.g. `profiles/<userId>/` — a superset of
 * whatever a single DB column currently points at, since a prior failed
 * "replace" can orphan an earlier upload.
 */
export async function listBlobsByPrefix(
  prefix: string,
): Promise<{ pathname: string }[]> {
  const { blobs } = await list({ prefix });
  return blobs.map((b) => ({ pathname: b.pathname }));
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 2: Collect blob pathnames and scrub PII fields inside the transaction

In `account-deletion.dal.ts`, add imports:

```ts
import { listingImages, listings } from "@/db/schemas/listings.schema"; // listings already imported — add listingImages
import { disputes, disputeEvidence } from "@/db/schemas/disputes.schema"; // disputes already imported — add disputeEvidence
import { userActivityLog } from "@/db/schemas/user-activity.schema";
import { pathnameFromBlobUrl } from "@/services/vercel-blob";
```

Extend `AnonymizeUserResult` (after `cancelledServiceBookings`):

```ts
  /**
   * Blob pathnames to delete after commit: listing/service-listing photos,
   * owner-uploaded damage photos, and this user's own closed-dispute
   * evidence images. The avatar is swept separately by prefix — see the
   * service.
   */
  blobPathnamesToDelete: string[];
  /**
   * Always 0 today: see "Decision 2" in the plan. Nonzero means evidence
   * this user uploaded was retained because its dispute wasn't closed —
   * should be unreachable; the service alerts ops if it ever isn't.
   */
  skippedOpenDisputeEvidenceCount: number;
```

Inside the transaction, after the `appleRows` select (`:350-359`) and before
the `pushSubscriptions`/`userPaymentMethods` updates, add:

```ts
// Blob-bearing PII (PRIV-09). Collected now, deleted after commit — blob
// storage is an external call and must never roll back or gate this
// transaction.
const blobPathnamesToDelete: string[] = [];

const listingImageRows = await tx
  .select({ id: listingImages.id, pathname: listingImages.blobPathname })
  .from(listingImages)
  .innerJoin(listings, eq(listingImages.listingId, listings.id))
  .where(eq(listings.ownerId, userId));
blobPathnamesToDelete.push(...listingImageRows.map((r) => r.pathname));
if (listingImageRows.length > 0) {
  await tx.delete(listingImages).where(
    inArray(
      listingImages.id,
      listingImageRows.map((r) => r.id),
    ),
  );
}

const serviceListingRows = await tx
  .select({ id: serviceListings.id, photos: serviceListings.photos })
  .from(serviceListings)
  .where(eq(serviceListings.providerId, userId));
blobPathnamesToDelete.push(
  ...serviceListingRows.flatMap((r) =>
    (r.photos ?? []).map(pathnameFromBlobUrl),
  ),
);

// Owner-uploaded only (Decision 1) — damage-photos upload is owner-only.
const damagePhotoRows = await tx
  .select({ id: rentals.id, damagePhotos: rentals.damagePhotos })
  .from(rentals)
  .where(eq(rentals.ownerId, userId));
blobPathnamesToDelete.push(
  ...damagePhotoRows.flatMap((r) => r.damagePhotos.map(pathnameFromBlobUrl)),
);
if (damagePhotoRows.length > 0) {
  await tx
    .update(rentals)
    .set({ damagePhotos: [] })
    .where(eq(rentals.ownerId, userId));
}

// This user's own dispute-evidence images (Decision 2's defensive gate).
// `notInArray`/`inArray` on `disputes.status`, not a JS `.includes()` — the
// column's type is the full 5-value enum, wider than the 3-value constant,
// so filtering in SQL avoids a TS-narrowing cast for no real benefit.
const evidenceRows = await tx
  .select({ id: disputeEvidence.id, content: disputeEvidence.content })
  .from(disputeEvidence)
  .innerJoin(disputes, eq(disputeEvidence.disputeId, disputes.id))
  .where(
    and(
      eq(disputeEvidence.uploadedBy, userId),
      eq(disputeEvidence.evidenceType, "image"),
      notInArray(disputes.status, [...BLOCKING_DISPUTE_STATUSES]),
    ),
  );
blobPathnamesToDelete.push(
  ...evidenceRows.map((r) => pathnameFromBlobUrl(r.content)),
);
if (evidenceRows.length > 0) {
  await tx
    .update(disputeEvidence)
    .set({ content: "[Photo removed — account deleted]", evidenceType: "text" })
    .where(
      inArray(
        disputeEvidence.id,
        evidenceRows.map((r) => r.id),
      ),
    );
}

const [{ n: skippedOpenDisputeEvidenceCount }] = await tx
  .select({ n: count() })
  .from(disputeEvidence)
  .innerJoin(disputes, eq(disputeEvidence.disputeId, disputes.id))
  .where(
    and(
      eq(disputeEvidence.uploadedBy, userId),
      eq(disputeEvidence.evidenceType, "image"),
      inArray(disputes.status, [...BLOCKING_DISPUTE_STATUSES]),
    ),
  );
```

Add `notInArray` to the top-level `drizzle-orm` import (`count` is already
imported at line 1).

Replace the `pushSubscriptions` deactivate block (`:365-374`) with a hard
delete (PRIV-09 asks for delete, not deactivate — a deactivated row still
carries a live endpoint/token):

```ts
await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
```

Leave the `userPaymentMethods` deactivate call untouched (out of scope).

In the "Delist content from discovery" block (`:380-397`), add `isActive:
false` to the `listings` update (matching R-DB-01's archive flag — photos
are gone either way, per Decision above, regardless of rental history) and
`photos: []` to the `serviceListings` update:

```ts
await tx
  .update(listings)
  .set({ status: "inactive", isActive: false, updatedAt: new Date() })
  .where(eq(listings.ownerId, userId));
await tx
  .update(serviceListings)
  .set({ status: "inactive", photos: [], updatedAt: new Date() })
  .where(eq(serviceListings.providerId, userId));
```

Immediately after (still before the `withdrawnRequests` update), add the
leftover-field scrubs — these apply to **every** status, not just pending,
so they're separate statements from R-BIZ-07's cancellation update:

```ts
await tx
  .update(rentalRequests)
  .set({
    deliveryAddress: null,
    deliveryInstructions: null,
    message: null,
    attributionContext: null,
  })
  .where(eq(rentalRequests.renterId, userId));

await tx
  .update(userActivityLog)
  .set({ ipAddress: null, userAgent: null })
  .where(eq(userActivityLog.userId, userId));
```

Finally, add `blobPathnamesToDelete` and `skippedOpenDisputeEvidenceCount` to
the method's `return { ... }` object.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Delete the collected blobs and sweep the avatar prefix, after commit

In `account-deletion-service.ts`, add:

```ts
import { deleteFromBlob, listBlobsByPrefix } from "@/services/vercel-blob";
```

Add two helpers (mirror `detachAllCards`'s "best-effort, alert on failure"
shape):

```ts
/**
 * Best-effort, after the commit: blob storage is external and must never
 * fail or roll back the deletion. A failure alerts ops — a broken deletion
 * promise stays reachable — rather than only Sentry.
 */
async function deleteCollectedBlobs(
  userId: string,
  pathnames: string[],
): Promise<{ deleted: number; failed: number }> {
  if (pathnames.length === 0) return { deleted: 0, failed: 0 };
  const results = await Promise.allSettled(pathnames.map(deleteFromBlob));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    await sendOpsAlert({
      event: "account_deletion_blob_delete_failed",
      message: `${failed} of ${pathnames.length} blob(s) could not be deleted after account deletion`,
      metadata: { userId, failed, total: pathnames.length },
      sendEmailAlert: true,
    }).catch((e) =>
      captureNonCriticalError(e, {
        route: "account-deletion",
        action: "ops-alert-blob-delete",
      }),
    );
  }
  return { deleted: pathnames.length - failed, failed };
}

/** The avatar's blob(s) under its per-user prefix — see Step 1's doc. */
async function sweepAvatarBlobs(userId: string): Promise<number> {
  try {
    const blobs = await listBlobsByPrefix(`profiles/${userId}/`);
    if (blobs.length === 0) return 0;
    const { deleted } = await deleteCollectedBlobs(
      userId,
      blobs.map((b) => b.pathname),
    );
    return deleted;
  } catch (error) {
    captureNonCriticalError(error, {
      route: "account-deletion",
      action: "sweep-avatar-blobs",
    });
    return 0;
  }
}
```

In `deleteOwnAccount`, after `anonymized = await accountDeletionDAL.anonymizeUser(userId)`
and alongside the existing `detachAllCards`/`revokeAppleTokens` calls, add:

```ts
const { deleted: blobsDeleted } = await deleteCollectedBlobs(
  userId,
  anonymized.blobPathnamesToDelete,
);
const avatarBlobsDeleted = await sweepAvatarBlobs(userId);

if (anonymized.skippedOpenDisputeEvidenceCount > 0) {
  await sendOpsAlert({
    event: "account_deletion_open_dispute_evidence_retained",
    message: `Retained ${anonymized.skippedOpenDisputeEvidenceCount} dispute-evidence blob(s) for a deleted user because their dispute wasn't closed — should be unreachable; check getDeletionBlockers`,
    metadata: { userId, count: anonymized.skippedOpenDisputeEvidenceCount },
    sendEmailAlert: true,
  }).catch((e) =>
    captureNonCriticalError(e, {
      route: "account-deletion",
      action: "ops-alert-open-dispute-evidence",
    }),
  );
}
```

Add `blobsDeleted: blobsDeleted + avatarBlobsDeleted` to the `auditLogDAL.create`
metadata object (no PII — counts only, matching the existing convention).

**Verify**: `bun run type-check` → exit 0.

## Test plan

Blob deletion is architecturally split (DB scrub inside a real transaction;
blob calls after commit in the service), so the tests split the same way:

- **DAL, real DB** (`account-deletion.integration.test.ts`, new `describe`):
  build a fully-populated user — a listing with one `listing_images` row, a
  service listing with two `photos` URLs, a `rentals` row they own with two
  `damage_photos` URLs, a closed dispute (`status: "resolved"`) with one
  `image`-type `dispute_evidence` row they uploaded, a `rental_requests` row
  with `deliveryAddress`/`message`/`attributionContext` set, a
  `user_activity_log` row with an IP, and two `push_subscriptions` rows.
  Call `anonymizeUser(user.id)` and assert: `listing_images` row gone;
  `listings.isActive` is `false`; `service_listings.photos` is `[]`;
  `rentals.damage_photos` is `[]`; the `dispute_evidence` row's `content` is
  the tombstone and `evidenceType` is `"text"`; `rental_requests.deliveryAddress`/
  `deliveryInstructions`/`message`/`attributionContext` are all `null`;
  `user_activity_log.ipAddress`/`userAgent` are `null`; `push_subscriptions`
  has zero rows for the user; the returned `blobPathnamesToDelete` contains
  all five expected pathnames; `skippedOpenDisputeEvidenceCount` is `0`.
  Add a second case: an **open** dispute's evidence (status `"open"`) is
  left untouched and counted in `skippedOpenDisputeEvidenceCount` — this
  case can only be reached by inserting the dispute directly (bypassing
  `getDeletionBlockers`), which is exactly the point: it proves the
  defensive filter, not the normal flow. Add a third case: a rental where
  this user is the **renter**, not the owner — its `damage_photos` (owned by
  the other party) are left untouched.
- **Service, mocked** (`account-deletion-service.test.ts`): add
  `vi.mock("@/services/vercel-blob", ...)` with `deleteFromBlob`/
  `listBlobsByPrefix` mocks; extend the `anonymized()` helper with
  `blobPathnamesToDelete: []` and `skippedOpenDisputeEvidenceCount: 0`
  defaults. New cases mirroring the existing Stripe-detach tests: (1)
  `deleteOwnAccount` calls `deleteFromBlob` for every collected pathname and
  `listBlobsByPrefix` with `profiles/<userId>/`; (2) a blob-delete failure
  still resolves the deletion and alerts ops with `account_deletion_blob_delete_failed`;
  (3) `listBlobsByPrefix` throwing doesn't fail the deletion (caught, `0`
  returned); (4) a nonzero `skippedOpenDisputeEvidenceCount` alerts ops with
  `account_deletion_open_dispute_evidence_retained`; (5) the audit row's
  metadata includes `blobsDeleted` and still has no PII (reuse the existing
  `expect(serialized).not.toMatch(/@|email|name|phone/i)` assertion).

**Verify**: both commands in **Commands you will need** → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0 (unit suite), plus the integration command
      above against the local e2e DB
- [ ] A fully-populated user's `anonymizeUser` call leaves no listing image,
      service-listing photo, owner-uploaded damage photo, or closed-dispute
      evidence blob referenced anywhere in the DB
- [ ] `push_subscriptions` has zero rows for a deleted user (not
      `isActive: false`)
- [ ] `grep -n "listBlobsByPrefix\|pathnameFromBlobUrl" src/services/vercel-blob/index.ts src/dal/account-deletion.dal.ts src/features/users/services/account-deletion-service.ts` → all three files have a hit
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (1.19)
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Live code doesn't match "Current state" (drift since `25e2233`).
- `getDeletionBlockers`'s dispute predicates (`countOpenDisputes`,
  `account-deletion.dal.ts:242-278`) have changed since this plan was
  written in a way that no longer guarantees "every dispute this user could
  have uploaded evidence on is closed" — re-verify Decision 2's reasoning
  before relying on the defensive filter alone.
- Any new evidence-upload path is added that lets someone other than a
  rental/booking party upload `dispute_evidence` (e.g., an admin role) —
  Decision 2's safety argument depends on uploader-implies-party.
- Drizzle's jsonb column typing rejects `damagePhotos: []` /
  `photos: []` as a bare array literal in `.set()` — fall back to
  `sql\`'[]'::jsonb\`` and report which form worked.
- `notInArray`/`inArray` against `disputes.status` don't accept the spread
  `[...BLOCKING_DISPUTE_STATUSES]` cleanly (a drizzle version mismatch) —
  fall back to an explicit `sql` fragment, matching the existing 3-way
  dispute reach at `:261-271`, and report which form worked.

## Mobile compatibility

- `DELETE /api/users/me` response shape is **unchanged**: still `200
{success: true}` or `409 {error, blockers}`. No new field, status, or
  error `code` — nothing to add to the roadmap's Mobile client follow-ups
  table.
- Mobile Epic 14 (task 14.3.3, not yet built — unblocked by R-BIZ-07 but no
  code exists in `hoador-mobile/src` for it yet; confirmed by grep) plans a
  deletion consequence screen whose copy (D-E14-10) currently says "Photos
  you uploaded may stay reachable at links someone already has... true
  today and stays harmless once PRIV-09's Phase-2 blob scrub lands, when it
  should be revisited." **Once this plan lands, drop that line** — the
  scrub is real, not "may." Flag this to whoever picks up 14.3.3.
- The mobile spec's device-test checklist (epic-14, §"Deletion (14.3.3)")
  currently asserts "the push subscription is inactive" after a staging
  deletion. After this plan, the row is **deleted**, not deactivated — the
  mobile device pass should assert zero rows, not `isActive: false`. Purely
  an internal DB-state assertion, not a wire contract change.
- No change to `GET /api/users/me/deletion-blockers` (P-E14-5).

## Production cutover

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                 | From      | dev  | staging | prod |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- | ------- | ---- |
| A5  | Optional backfill for accounts anonymized before this fix (dev/staging test accounts only; prod has none). **Do not just re-invoke `anonymizeUser`.** It hasn't been checked for re-entry on an already-anonymized row, and blob deletion lives in the service, not the DAL. If the leftovers matter, write a one-off script that runs Step 2's scrub statements and Step 3's blob helpers for `WHERE anonymized_at IS NOT NULL`. Otherwise mark N/A | R-PRIV-09 | TODO | TODO    | N/A  |

Not required before store submission — Apple review exercises a freshly
created-and-deleted test account, which goes through the fixed code path
from the start. Needed only to clean up blobs/fields left by accounts
deleted on dev/staging _before_ this plan landed.

## Maintenance notes

- `pathnameFromBlobUrl`/`listBlobsByPrefix` could later replace the three
  duplicated `new URL(url).pathname.slice(1)` call sites this plan didn't
  touch (`profile/upload/route.ts:83`, `service-listing-service.ts:333`,
  `legal-document.dal.ts:311`) — a pure refactor, not bundled here to keep
  this plan's diff to the deletion path only.
- If a future feature adds a non-owner damage-photo uploader (e.g., the
  renter contesting with their own photos), Decision 1's "owner only" scope
  will need revisiting — it currently assumes the route stays owner-only.
