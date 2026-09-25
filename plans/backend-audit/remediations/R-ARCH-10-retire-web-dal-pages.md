# Plan R-ARCH-10: Fix the listing-edit ownership hole, then gate the retiring web dashboard

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/app/dashboard/listings/[id]/edit/page.tsx src/app/dashboard/layout.tsx plans/README.md`
> On any change, re-run this plan's Step 0 inventory before proceeding; a
> material mismatch against "Current state" is a STOP condition.

## Status

- **Priority**: P3 · **Effort**: S (SEC-23 fix) + S–M (gate, depending on
  which Decision option is chosen) · **Risk**: LOW · **Depends on**: none
- **Category**: security / architecture
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: ARCH-10, SEC-23

## Why this matters

`hoador-web` serves two clients: the Expo mobile app (the product going
forward) and a server-rendered `/dashboard/**` web UI that predates it and
is being retired (`plans/README.md:12-15`: _"the web front end is being
retired in favor of the native Expo app... Work that only touches web UI
(RSC pages, client components) is [deprioritized]"_). That web UI reads the
DAL directly from server components instead of going through the API
routes' authorization and response shaping, so every API-side security fix
in this audit has had to be independently re-applied to the equivalent web
page when one exists (R-PRIV-01 needed a second step just for
`rental-details-server.tsx`; R-SEC-07's status note found a second wire
boundary in the web services page that its own plan missed). SEC-23 is a
live instance of the same root cause: `/dashboard/listings/[id]/edit`
never checks the caller owns the listing, so any signed-in user can view
any listing's hidden/rejected state and the admin's `rejectionReason` by
guessing or harvesting a UUID.

SEC-23 is fixed **first, independently**, regardless of which ARCH-10
option is chosen (below) — it's a real, if LOW-severity, disclosure bug
today, and fixing it costs one line.

## Current state

### Inventory step (run this first; the numbers below are a snapshot from 29fe557)

```bash
# Every server page/layout reading the DAL directly
grep -rlE "from \"@/dal\"" src/app --include=page.tsx --include=layout.tsx

# Split by tree, to separate "the retiring consumer UI" from things that
# are not part of this finding
grep -rlE "from \"@/dal\"" src/app/dashboard --include=page.tsx --include=layout.tsx
grep -rlE "from \"@/dal\"" src/app/admin --include=page.tsx --include=layout.tsx
grep -rlE "from \"@/dal\"" "src/app/(auth)" --include=page.tsx --include=layout.tsx
```

At `29fe557` this found **33 files**: 26 under `src/app/dashboard/**`, 2
under `src/app/admin/**`, 5 under `src/app/(auth)/**`.

### SEC-23: `/dashboard/listings/[id]/edit` has no ownership check

`src/app/dashboard/listings/[id]/edit/page.tsx:52-64`:

```tsx
export default async function EditListingPage({ params }: {...}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return notFound();
  const { id } = await params;

  const [listing, categories, documentVersions] = await Promise.all([
    listingDAL.getListingById(id, currentUser.id),
    listingDAL.getListingCategories(),
    legalDocumentDAL.getAllCurrentVersions(),
  ]);

  if (!listing) return notFound();
  // ... no ownership check here ...
```

and further down (`:88-89`):

```tsx
{
  listing.approvalStatus === "rejected" && (
    <RevisionsRequestedBanner rejectionReason={listing.rejectionReason} />
  );
}
```

Any signed-in user who knows or guesses a listing id sees that listing's
full edit form, including a `rejected` listing's admin `rejectionReason` —
data the API deliberately withholds from non-owners
(`src/app/api/listings/[listingId]/route.ts:107-116`, the
`approvalStatus`/`rejectionReason`/`isActive` destructure-omit for
non-owners). `PATCH` on the same listing is already ownership-checked
(`ListingService`'s `verifyOwnership`, per the finding), so nothing can be
_modified_ — this is read-only disclosure, hence LOW.

`ListingDetails` (`src/dal/types.ts:249-296`) has `owner: { id: string; ... }`
— the check is a one-line addition.

### ARCH-10: the retiring web dashboard still reads the DAL directly

No retirement date has been set (`grep -rn "retirement date\|sunset" plans/`
finds nothing beyond the audit's own recommendation to pick one). The 26
`src/app/dashboard/**` files span every consumer-facing feature mobile
already has a native equivalent for (rentals, service bookings, listings,
mailbox, explore, profile, payments) — confirmed against
`hoador-mobile-progress` context: Epics 3–13 are code-complete, i.e. mobile
already covers this surface. `src/app/dashboard/layout.tsx:1-40` is the
**single chokepoint** every one of those 26 pages renders through — it
already gates on session + account status
(`getCurrentUser`/`redirect("/login...")`, status-based redirects at
`:20-24`) before any page's own DAL calls run.

`src/app/admin/**`'s 2 files (`legal/page.tsx`,
`services/listings/review/page.tsx`) are a different thing: the internal
moderation tool, gated by `requireAdmin` in `admin/dashboard/layout.tsx`
per `11-attack-surface-map.md:184`, with **no mobile equivalent** — out of
scope for "retiring web UI" (nothing is replacing it).

`src/app/(auth)/**`'s 5 files (`signup`, `signup/google/callback`,
`signup/google/legal-acceptance`, `signup/email/callback`, `onboarding`)
are the pre-dashboard auth funnel. Mobile has its own native onboarding
against the API directly and never renders these pages, but a browser
visitor reaching the marketing site (`src/app/page.tsx`) may still sign up
through them before installing the app — whether that funnel is also
retiring is a marketing/growth decision, not a security one, and none of
the 5 files were flagged with a vulnerability in
`11-attack-surface-map.md:183` (_"write status or profile photo on GET, for
the session user only... no effect"_). Out of scope for this plan; the
inventory step above will surface them again for the maintainer to decide
separately if the whole web front end (not just `/dashboard/**`) is ever
retired.

## Decisions for the maintainer

**Option A — Gate `/dashboard/**`behind a flag now, redirect to`/`.**
Add one check at the top of `dashboard/layout.tsx`(the confirmed single
chokepoint for all 26 files): when disabled,`redirect("/")` before any
child page's DAL call runs. No page file needs to change. Reversible by
flipping the flag. Every ARCH-02-shaped duplicate-fix problem this finding
describes stops applying the moment the flag is off in an environment,
because the DAL calls that would leak never execute.

- Pro: fixes the root cause (extra attack surface, duplicate-maintenance
  burden) in one file, today, before hoador is in production.
- Con: the 26 pages' code stays in the tree (dead code in prod/staging,
  live in dev) until a later cleanup deletes it; that cleanup is bigger
  than this plan's remaining budget and is opportunistic per the roadmap
  (`10-remediation-roadmap.md:129`).

**Option B — Keep the pages live, hardened.** Audit each of the 26 files
against its sibling API route's authorization (`11-attack-surface-map.md`'s
existing per-page table is most of this work already) and route each
through R-ARCH-02's response-mapper functions once that plan lands, so a
future DAL column addition can't reopen a leak silently.

- Pro: no behavior change for anyone currently using the web dashboard.
- Con: every future API-side fix still needs a manual "does the web page
  need this too" check, forever, for a UI whose own retirement is already
  decided in principle (`plans/README.md:12`) — this is the exact
  maintenance tax ARCH-10 is about.

### Recommendation: A

hoador is **not yet in production** (per this repo's own operating
assumption for this audit cycle) — there is no live user session to
disrupt by turning the flag off in staging/prod today, and mobile already
has Epics 3–13 code-complete, i.e. feature parity with what these 26 pages
do. Paying Option B's ongoing per-page audit cost for a UI nobody will be
using is a worse trade than flipping a flag reversibly now. Keep the flag
**on in development** so engineers can still exercise the web pages
locally while the mobile app is being worked on, and revisit deletion of
the 26 files once the retirement is final and irreversible (Maintenance
notes).

**Before flipping the flag off in staging/prod**: confirm with the mobile
progress notes / `plans/README.md` that no `/dashboard/**` subtree lacks a
mobile equivalent. If one is found, exclude that specific path from the
redirect (check `request.nextUrl.pathname` in the layout, or scope the flag
to a sibling layout under the specific subtree) until mobile catches up,
rather than blocking the whole gate on it.

The rest of this plan implements **Option A**. If the maintainer picks B
instead, do Step 1 (SEC-23) only, then re-scope Step 2 into a per-page audit
plan of its own (bigger than this document — write a fresh Phase-3-style
plan for it rather than improvising inline).

## Commands

| Purpose   | Command                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Typecheck | `bun run type-check`                                                                                    |
| Lint      | `bun run lint`                                                                                          |
| Tests     | `bun run test:run src/app/dashboard/listings/\[id\]/edit src/app/dashboard/__tests__ src/app/__tests__` |
| Full      | `bun run test:run`                                                                                      |

## Scope

**In scope**:

- `src/app/dashboard/listings/[id]/edit/page.tsx` (SEC-23 fix)
- `src/app/dashboard/listings/[id]/edit/__tests__/page.test.tsx` (new, if
  this repo has a convention for testing server-component pages — check
  `src/app/dashboard/**/__tests__` for an existing example first; if pages
  aren't unit-tested anywhere in this repo, a manual verification step is
  acceptable and should be recorded as such)
- `src/app/dashboard/layout.tsx` (Option A gate)
- `.env.example` (document the new flag)
- `src/env.ts` if R-ARCH-09 has landed by execution time (add the flag to
  its schema as optional, default-on-when-unset — see Step 2); otherwise
  read `process.env` directly in the layout and note the follow-up

**Out of scope**:

- The 26 individual `/dashboard/**` page files themselves — Option A
  doesn't touch them; they become unreachable in whatever environment the
  flag is off in, not deleted.
- `src/app/admin/**` (different tool, no mobile equivalent, already
  admin-gated — see Current state).
- `src/app/(auth)/**` (pre-dashboard funnel, not part of this finding — see
  Current state).
- Full deletion of dead dashboard code — opportunistic, later (Maintenance
  notes).

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Step 0: Re-run the inventory

Run the greps in "Current state → Inventory step". Confirm the 26/2/5 split
still holds. If a new file has been added to `src/app/dashboard/**` since
`29fe557`, it's automatically covered by Step 2's layout-level gate (no
extra work); if one was added to `src/app/admin/**` or `(auth)/**`,
re-confirm it's still out of scope for the same reasons given above before
excluding it.

### Step 1 (SEC-23, independent of the Decision above): ownership check

In `src/app/dashboard/listings/[id]/edit/page.tsx`, immediately after
`if (!listing) return notFound();`, add:

```tsx
if (listing.owner.id !== currentUser.id) return notFound();
```

`notFound()`, not a 403 — matching this codebase's existing convention for
"don't confirm existence to a non-owner" (`/api/listings/[listingId]`'s
comment: _"Failures return 404, never 403... A 403 would confirm that a
listing exists at an id the caller may not see."_).

**Verify**:

- `bun run type-check` → exit 0.
- Manual/automated check: a session user who isn't the listing's owner
  requesting `/dashboard/listings/<other-owner's-id>/edit` gets the
  not-found page; the actual owner still sees the edit form.

### Step 2 (Option A): gate `/dashboard/**` behind a flag

In `src/app/dashboard/layout.tsx`, add the check as the very first thing
the layout does (before `getCurrentUser()`, so a disabled environment does
zero DAL work for this tree):

```tsx
import { redirect } from "next/navigation";
// ...

/**
 * ARCH-10: the web dashboard is retiring in favor of the mobile app (Epics
 * 3-13 are already code-complete there). Default ON so local dev keeps
 * working; set to "false" in an environment once mobile has full parity
 * with everything under this tree, to stop these 26 pages' direct DAL
 * reads from being live attack surface.
 */
function isWebDashboardEnabled(): boolean {
  return process.env.WEB_DASHBOARD_ENABLED !== "false";
}

export default async function DashboardLayout({ children }: {...}) {
  if (!isWebDashboardEnabled()) {
    redirect("/");
  }
  const user = await getCurrentUser();
  // ...rest unchanged
}
```

Add to `.env.example`:

```
# Retiring web dashboard (ARCH-10). Unset/anything but "false" = enabled
# (dev default). Set to "false" once mobile has full feature parity with
# /dashboard/** in that environment, to stop its direct-DAL pages from
# being live attack surface.
# WEB_DASHBOARD_ENABLED=false
```

If `src/env.ts` (R-ARCH-09) exists by the time this plan executes, add
`WEB_DASHBOARD_ENABLED: z.string().optional()` to its schema and read it
via `validateEnv()` instead of `process.env` directly, for consistency —
this is a nice-to-have, not a blocker; a direct `process.env` read works
fine on its own.

**Verify**:

- `bun run type-check` → exit 0.
- With `WEB_DASHBOARD_ENABLED` unset, `bun run dev` and confirm
  `/dashboard/mailbox` (or any dashboard page) still renders normally for a
  signed-in user.
- With `WEB_DASHBOARD_ENABLED=false`, confirm the same URL redirects to `/`
  without executing any DAL call (add a `console.log`/breakpoint check, or
  trust the early-return placement above `getCurrentUser()`).
- `grep -n "isWebDashboardEnabled" src/app/dashboard/layout.tsx` → present,
  called before `getCurrentUser()`.

### Step 3: Tests

- SEC-23: if this repo has any existing page-level test (check
  `src/app/dashboard/**/__tests__` for a `page.test.tsx` pattern before
  assuming there isn't one); if none exists anywhere in the codebase for a
  server-component page, do not invent a new testing pattern for this one
  file — record the manual verification from Step 1 in the PR description
  instead, and note this repo's page-testing gap in Maintenance.
- Layout gate: if `dashboard/layout.tsx` has an existing test file, extend
  it with the flag-off → `redirect("/")` case and the flag-on/unset →
  normal render case (mock `next/navigation`'s `redirect` the way other
  tests in this repo do — check an existing layout/page test for the
  pattern first).

**Verify**: `bun run test:run` → all pass.

## Test plan

Step 1 and Step 2's manual verification, plus Step 3's tests where this
repo's existing conventions support them. `bun run type-check && bun run
lint && bun run test:run` → all exit 0.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0; `bun run test:run` → exit 0
- [ ] A non-owner requesting `/dashboard/listings/[id]/edit` for someone
      else's listing gets `notFound()`; the owner is unaffected (Step 1)
- [ ] `WEB_DASHBOARD_ENABLED=false` redirects every `/dashboard/**` request
      to `/` before any DAL call in that tree runs; unset/any other value
      preserves current behavior (Step 2)
- [ ] `.env.example` documents the new flag
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status")
- [ ] If Option B was chosen instead: SEC-23 (Step 1) is still done, and a
      new plan document exists for the per-page audit rather than having
      been improvised inline

## STOP conditions

- Step 0's inventory turns up a `/dashboard/**` page that mobile does _not_
  yet have parity for (check `hoador-mobile`'s progress notes/specs before
  assuming) — exclude that specific subtree from the flag (see the
  Recommendation's caveat) rather than blocking the whole gate on it, and
  say which page and why in the PR.
- `dashboard/layout.tsx`'s structure has changed enough that "first thing
  the layout does" is no longer a clean insertion point (e.g. it now reads
  request headers that must come first) — re-read the live file and adapt
  the insertion point; don't skip the early-return property.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

Zero effect. Nothing in this plan touches an API route, a response shape,
or any code path the mobile app calls. `WEB_DASHBOARD_ENABLED` only gates
server-rendered HTML pages under `/dashboard/**`, which the app never
requests. No roadmap Mobile-follow-ups row needed.

## Production cutover

No schema or migration change. One manual step once the maintainer is
ready to actually retire the web dashboard in a given environment: **set
`WEB_DASHBOARD_ENABLED=false`** in that environment's Vercel project
settings. Add a row to `13-production-cutover.md` for this, with an
explicit per-environment status (dev: stays enabled; staging: set once QA
confirms mobile parity; prod: set at or before launch) rather than a single
blanket "done" — this one is a product decision with a date, not a
mechanical migration step, so don't mark it done until the maintainer
confirms the date.

## Maintenance notes

- Once the flag has been off in every environment for a while and nobody
  has asked for it back, delete the 26 `/dashboard/**` files, their
  DAL-only code paths, and the now-unreachable `dashboard/layout.tsx`
  branch — this shrinks the attack surface for real and reduces the "~149
  of 379 test files exercise retiring web UI" burden noted in
  `07-testing-gaps.md:307`. That cleanup is its own plan; don't fold it
  into this one.
- If R-ARCH-02 lands after this plan, its response-mapper functions are
  still worth reusing inside `/dashboard/**` pages that stay reachable in
  development (defense in depth for the engineers actively using them
  locally) — not required, since Option A's gate is the real control for
  any environment that matters.
- `src/app/(auth)/**`'s DAL-reading pages were left alone (see Current
  state) — if the whole web front end is retired later (not just
  `/dashboard/**`), re-run this plan's inventory step against that tree
  too.
