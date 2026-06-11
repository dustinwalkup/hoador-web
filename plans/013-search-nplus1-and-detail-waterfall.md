# Plan 013: Batch the searchListings image N+1 and parallelize the rental-details fetch waterfall

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/dal/listing.dal.ts src/features/rentals/components/detail-page/rental-details-server.tsx`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

Two independent, mechanical latency wins on hot paths:

1. **`ListingDAL.searchListings` issues one image query per listing in a
   for-loop** — the explore/search page (default 12 results) pays 12+
   sequential DB round-trips per render on the app's primary discovery
   surface. The same file already contains the correct batched pattern
   (`_enrichListingsWithRatingsAndImages`), so this is a consolidation, not
   an invention.
2. **The rental detail page awaits 3–5 independent fetches sequentially** in
   its server component — agreement acceptance, dispute policy, active
   dispute, review status, owner onboarding — adding serial round-trips to
   every rental detail view.

## Current state

### Part A — the N+1

- `src/dal/listing.dal.ts` — `searchListings` starts at line 696; the N+1
  loop is at lines 930–952; the **exemplar batch helper**
  `_enrichListingsWithRatingsAndImages` is at lines 1338–1381 (same file).

The loop (listing.dal.ts:930–952):

```ts
// Get first image for each listing (matching getUserlistings pattern)
const listingIds = listingsWithRelations.map((t) => t.listing.id);
const listingImagesMap = new Map<string, string>();

if (listingIds.length > 0) {
  // Get first image for each listing individually to match getUserlistings behavior
  for (const listingId of listingIds) {
    const firstImage = await this.db
      .select({ imageUrl: listingImages.imageUrl })
      .from(listingImages)
      .where(
        and(
          eq(listingImages.listingId, listingId),
          eq(listingImages.orderIndex, 0),
        ),
      )
      .limit(1);

    if (firstImage[0]?.imageUrl) {
      listingImagesMap.set(listingId, firstImage[0].imageUrl);
    }
  }
}
```

(The comment "to match getUserlistings behavior" is stale — `getUserListings`
batches via the helper below.)

The exemplar batch (listing.dal.ts:1345–1363):

```ts
const allFirstImages = await this.db
  .select({
    listingId: listingImages.listingId,
    imageUrl: listingImages.imageUrl,
  })
  .from(listingImages)
  .where(
    and(
      inArray(listingImages.listingId, listingIds),
      eq(listingImages.orderIndex, 0),
    ),
  );

const firstImageByListing = new Map<string, string>();
for (const img of allFirstImages) {
  if (img.listingId && !firstImageByListing.has(img.listingId)) {
    firstImageByListing.set(img.listingId, img.imageUrl);
  }
}
```

Downstream, `listingImagesMap` is read in the transform at ~line 955+
(`listingImagesMap.get(...)`) — the fix must produce a Map with identical
keys/values.

### Part B — the waterfall

- `src/features/rentals/components/detail-page/rental-details-server.tsx` —
  async server component. After the blocking `getRentalDetailsById` (line 28,
  must stay first — everything depends on it and on the access check at
  lines 35–37), five fetches run sequentially:
  1. lines 56–77: rental agreement acceptance, with internal fallback to
     current version (`legalDocumentDAL.getRentalAgreementAcceptance` →
     `legalDocumentDAL.getCurrentVersion(PER_RENTAL_AGREEMENT)`), in its own
     try/catch (continue without URL on error);
  2. lines 79–91: dispute policy current version
     (`legalDocumentDAL.getCurrentVersion(DISPUTE_POLICY)`), own try/catch;
  3. lines 93–101: active dispute (`disputeDAL.getActiveByRentalId`), own
     try/catch;
  4. lines 103–114: review status (`BlindReviewService.getReviewStatus`),
     only when `rentalDetails.status === "completed"`, own try/catch;
  5. lines 116–127: owner payout readiness (`userDAL.getUserById` →
     `getPayoutReadiness`), only when `isOwner && status === "pending"`,
     own try/catch.

All five are mutually independent (none reads another's result). The
conditions for 4 and 5 depend only on `rentalDetails`, which is already
loaded.

### Conventions

- Per-fetch error isolation must be preserved: each fetch currently fails
  soft (page renders without that datum). The parallel version must keep
  that — wrap each branch's logic in an async closure with its own
  try/catch, then `Promise.all` the closures (`Promise.all` over functions
  that never reject ≡ `Promise.allSettled` but keeps the existing per-branch
  fallback semantics and logging).

## Commands you will need

| Purpose    | Command                                                  | Expected on success |
| ---------- | -------------------------------------------------------- | ------------------- |
| Typecheck  | `bun run type-check`                                     | exit 0              |
| DAL tests  | `bun run test:run src/dal/__tests__/listing.dal.test.ts` | all pass            |
| Full suite | `bun run test:run`                                       | all pass            |
| Lint       | `bun run lint`                                           | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/dal/listing.dal.ts` (only the loop inside `searchListings`)
- `src/features/rentals/components/detail-page/rental-details-server.tsx`
- `src/dal/__tests__/listing.dal.test.ts` (extend if a searchListings test
  exists and stubs the per-listing queries; otherwise no test change needed)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `_enrichListingsWithRatingsAndImages` and its callers — already correct.
- The main search query / filters / distance logic in `searchListings`
  (everything above line 930) — only the image-fetch block changes.
- The transform below the loop — it keeps consuming `listingImagesMap`
  unchanged.
- Other server components with waterfalls — one exemplar fix here; a broader
  sweep is not this plan.
- Any caching/staleTime/React Query changes.

## Git workflow

- Branch: `advisor/013-search-nplus1-and-detail-waterfall`
- Commit Part A and Part B separately; plain imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (Part A): Replace the loop with one batched query

In `searchListings`, replace the entire `if (listingIds.length > 0) { for ... }`
block (excerpt above) with the batch shape from the exemplar, keeping the
variable name `listingImagesMap` so the downstream transform is untouched:

```ts
if (listingIds.length > 0) {
  const allFirstImages = await this.db
    .select({
      listingId: listingImages.listingId,
      imageUrl: listingImages.imageUrl,
    })
    .from(listingImages)
    .where(
      and(
        inArray(listingImages.listingId, listingIds),
        eq(listingImages.orderIndex, 0),
      ),
    );

  for (const img of allFirstImages) {
    if (img.listingId && !listingImagesMap.has(img.listingId)) {
      listingImagesMap.set(img.listingId, img.imageUrl);
    }
  }
}
```

`inArray` is already imported in this file (used at line 1353). Also delete
the stale "individually to match getUserlistings behavior" comment.

**Verify**: `bun run type-check` → exit 0;
`bun run test:run src/dal/__tests__/listing.dal.test.ts` → all pass (if a
test stubbed the per-listing select chain, update its stub to the single
batched select).

### Step 2 (Part B): Parallelize the independent fetches

In `rental-details-server.tsx`, keep lines 28–52 (details fetch, access
check, view context) unchanged. Replace the five sequential blocks with
closures executed in one `Promise.all`. Each closure contains exactly the
body of the current block, including its try/catch and conditional, and
returns the value the block used to assign:

```ts
const [
  rentalAgreementUrl,
  disputePolicyUrl,
  activeDispute,
  canReview,
  ownerOnboardingStatus,
] = await Promise.all([
  (async (): Promise<string | undefined> => {
    try {
      const acceptance = await legalDocumentDAL.getRentalAgreementAcceptance(
        rentalId,
        userId,
      );
      if (acceptance) return acceptance.url;
      const currentVersion = await legalDocumentDAL.getCurrentVersion(
        LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
      );
      return currentVersion?.url;
    } catch (error) {
      console.error("Error fetching rental agreement:", error);
      return undefined;
    }
  })(),
  // ... same treatment for the other four; the conditional ones return
  // their default (null / false / undefined) immediately when the condition
  // doesn't hold, e.g.:
  (async () => {
    if (rentalDetails.status !== "completed") return false;
    try {
      const reviewStatus = await BlindReviewService.getReviewStatus(userId, {
        rentalId,
      });
      return reviewStatus.canReview;
    } catch {
      return false;
    }
  })(),
  // ...
]);
```

Preserve each block's exact fallback value and its `console.error` message
text. The JSX below must keep receiving identically-typed values — check how
each variable is consumed before changing its declared type.

**Verify**: `bun run type-check` → exit 0; `bun run lint` → exit 0.

### Step 3: Behavior check

`grep -c "await " src/features/rentals/components/detail-page/rental-details-server.tsx`
→ awaits inside the closures are fine; the _top level_ of the component should
now have 3 awaits or fewer (auth, details fetch, the `Promise.all`).

Run the full suite: `bun run test:run` → all pass.

If the dev environment is available (optional, not a gate):
`bun run dev` and load a rental detail page — page renders identically.

## Test plan

- Part A: existing `listing.dal.test.ts` continues to pass (update chain
  stubs only if a searchListings test stubbed the per-listing loop).
- Part B: server components have no unit-test harness in this repo —
  verification is type-check + lint + full suite + the structural grep in
  Step 3. Do not introduce a new test framework for this.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "for (const listingId of listingIds)" src/dal/listing.dal.ts`
      → no output (the loop is gone)
- [ ] `grep -c "inArray(listingImages.listingId" src/dal/listing.dal.ts` → 2
      (the exemplar + the new batch)
- [ ] `grep -n "Promise.all" src/features/rentals/components/detail-page/rental-details-server.tsx`
      → ≥1 hit
- [ ] `bun run type-check && bun run lint && bun run test:run` → exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the "Current state" locations doesn't match the excerpts.
- The downstream transform in `searchListings` turns out to consume anything
  other than `listingImagesMap.get(<listingId>)` (e.g. it relies on insertion
  order) — re-read before improvising.
- In Part B, any of the five blocks turns out to READ another block's result
  (they don't, per this audit — but if drift introduced a dependency, the
  parallelization is invalid for that pair).
- Type errors reveal that a fallback value's type differs from what the JSX
  expects (e.g. `activeDispute` must be `null`, not `undefined`).

## Maintenance notes

- If `searchListings` ever needs ratings too, use
  `_enrichListingsWithRatingsAndImages` outright instead of growing a second
  parallel implementation — the only reason it isn't reused here is the
  different input shape (`listingsWithRelations` vs raw listing rows) and the
  desire to keep this change minimal.
- Other dashboard server components likely have similar small waterfalls;
  this plan deliberately fixed only the audited one. A future sweep should
  measure first (the query-tracker telemetry in `src/db/query-tracker.ts`
  can quantify per-request query counts).
- Reviewer focus: Part B fallback values must be bit-identical to the old
  ones (`undefined` vs `null` vs `false`), and no closure may throw (every
  path returns).
