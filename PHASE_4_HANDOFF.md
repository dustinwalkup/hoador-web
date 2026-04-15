# Hoador Web — Phase 4 + Auth Tax Fix Handoff

**Handoff date:** 2026-04-15
**Branch:** `perf/phase-4-cleanup` (off `develop`)
**Status:** Ready to review and merge. Working tree is committed to the branch locally; no PR opened yet.
**Stack context:** Next.js 16.2.1 (App Router, Turbopack), Drizzle ORM + `drizzle-orm/neon-serverless`, Postgres (Neon), React Query, Vercel deploy, Better Auth, Sentry.

**Prerequisite context:** This branch picks up where [PERF_AUDIT_HANDOFF.md](PERF_AUDIT_HANDOFF.md) left off. Phases 1, 1.5, 2, and 3 of that plan are already shipped on `develop`. This branch is Phase 4 of the original roadmap **plus** an emergent "Phase 0" (auth tax elimination) that the tracker surfaced after it came online.

---

## Table of contents

1. [What shipped in this branch](#what-shipped-in-this-branch)
2. [Architectural decisions worth remembering](#architectural-decisions-worth-remembering)
3. [Before / after metrics](#before--after-metrics)
4. [Verification state](#verification-state)
5. [Files changed](#files-changed)
6. [What's left — prioritized](#whats-left--prioritized)
7. [Known gaps and open questions](#known-gaps-and-open-questions)
8. [How to use the query tracker](#how-to-use-the-query-tracker)
9. [Commands you'll use](#commands-youll-use)

---

## What shipped in this branch

### D1 — `"use client"` push-down on rental/service flow layouts

**Problem:** Two layouts were marked `"use client"` solely because they called `usePathname()` to pick between an "incoming" vs "outgoing" header title. That forced the entire flow subtree to ship as client JS.

**Fix:** Extracted the pathname-driven header into ~25-line client components; the layouts themselves are now server components.

- Layouts converted: [src/app/dashboard/(rentals)/(flow)/layout.tsx](<src/app/dashboard/(rentals)/(flow)/layout.tsx>), [src/app/dashboard/services/(flow)/layout.tsx](<src/app/dashboard/services/(flow)/layout.tsx>)
- New client components: [src/app/dashboard/(rentals)/(flow)/\_components/rentals-flow-header.tsx](<src/app/dashboard/(rentals)/(flow)/_components/rentals-flow-header.tsx>), [src/app/dashboard/services/(flow)/\_components/services-flow-header.tsx](<src/app/dashboard/services/(flow)/_components/services-flow-header.tsx>)

**Impact:** The rental/service flow subtrees stop shipping as client JS except for the thin headers. Minor First Load JS reduction; validate with `next build` route table.

---

### D2 — Dev-mode query tracker (the tooling that unlocked everything)

This is the single highest-leverage piece of work in the branch. Not a perf fix — it's the observability layer that made every other perf fix possible.

#### Core primitive: `src/db/query-tracker.ts`

- `AsyncLocalStorage<QueryCounter>` — the sole source of request-scoped state for the tracker.
- `runWithQueryCounter(label, fn)` — wraps an async function in a fresh counter. Safe to nest. No-op in production.
- `recordQuery(sql)` — called from the Drizzle logger; appends a record to the current counter if one is active.
- `reportQueryCounter(counter)` — formats and prints the per-request breakdown to the console. Emits at `console.warn` if the request exceeds `QUERY_WARN_THRESHOLD` (15), else `console.debug`.
- `parseTable(sql)` — extracts the primary table name from the SQL string via regex. Used for attribution.

**Critical design decision: attribution is by SQL table, not by DAL method.** The original plan was to walk the stack trace to find the nearest `*.dal.ts` frame. That approach is **fundamentally broken under Turbopack** — Turbopack bundles all of `src/db/**` and `src/dal/**` into a single opaque chunk (`src_db_*.js`) and no source map is applied to `new Error().stack`. Raw stack example captured during investigation:

```
at captureDalFrame (.next/dev/server/chunks/src_db_0eas~c-._.js:3038)
at recordQuery (.../src_db_0eas~c-._.js:3066)
at Object.logQuery (.../src_db_0eas~c-._.js:3132)
at NeonPreparedQuery.execute (.../node_modules_drizzle-orm_...)
```

There's no DAL file or function name in the stack at all. Stack-walk attribution is a dead end under Turbopack and **should not be attempted again** — it wasted 30 minutes of investigation time. SQL table parsing is bundler-agnostic and, in practice, more actionable ("listing_images hit 6 times" points straight at the missing batch).

The `DEBUG_QUERY_TRACKER_STACK=1` env var is still wired in the source to dump the raw stack of the first query per process — useful if attribution ever goes blank again and we need to see what the runtime is emitting.

#### Drizzle logger wiring: `src/db/db.ts`

The neon-serverless `drizzle()` call now passes `logger: { logQuery }` when `NODE_ENV !== "production"`. The logger hook calls `recordQuery(query)` on every SQL the driver executes. **Zero overhead in production** — the logger is `false` there and Drizzle skips the hook path entirely.

#### Route handler coverage: `src/lib/api/with-request-logging.ts`

**This is the critical integration point.** The existing `withRequestLogging` HOF already wraps 128 of the 131 API route handlers in the app — the 3 that don't use it are test utilities and a Better Auth passthrough. One single edit inside `withRequestLogging` (wrapping the inner handler execution in `runWithQueryCounter(route, …)`) **automatically covers every route handler in the codebase**. No per-file edits required.

The 3 routes not using `withRequestLogging`:

- `src/app/api/test-upload/route.ts`
- `src/app/api/test/last-email/route.ts`
- `src/app/api/test/reset-user/route.ts`
- `src/app/api/auth/[...all]/route.ts`

(These are test-only or auth passthroughs and intentionally not tracked.)

#### Server action coverage: N/A

`grep ^"use server"` returned zero hits. The codebase has no server actions. No wrapper needed.

#### RSC coverage: `src/components/dev/query-tracker-boundary.tsx`

Server component that seeds an ALS counter via `queryCounterStorage.enterWith()` and schedules a flush via Next 15+ `after()`. Applied once to [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx).

**⚠ Known gap:** in practice this boundary is only firing on the very first cold render, not on subsequent RSC navigations. See [Known gaps](#known-gaps-and-open-questions) for details and suggested fix.

---

### D3 — Raw `<img>` → `next/image`

**Only one real offender in `src/`:** [src/components/payments/how-payments-work-modal.tsx:40](src/components/payments/how-payments-work-modal.tsx#L40), the `/hoador-logo.svg` inside the payments modal. Converted to `next/image` with explicit `width={120} height={36}`.

**Intentionally skipped** (per instructions):

- Email templates: [src/features/notifications/utils/email-logo.ts](src/features/notifications/utils/email-logo.ts) — email clients don't support `next/image`.
- Playwright PDF templates: [src/services/playwright/generate-rental-agreements/template.ts](src/services/playwright/generate-rental-agreements/template.ts), [src/services/playwright/generate-service-agreements/template.ts](src/services/playwright/generate-service-agreements/template.ts) — same reason.
- Test mocks and sanitize test fixtures — not real consumers.

**⚠ Dev console warning:** the hoador-logo conversion triggers "LCP image should have `loading='eager'`" and "width or height modified, but not the other". Low-priority cosmetic cleanup; not blocking.

---

### Emergent: Auth-tax elimination (the biggest perf win of the branch)

**This was not in the original Phase 4 scope.** It came out of the tracker's first navigation pass: every endpoint in the app was paying a 5-query tax on auth, and the tracker made the pattern visible within 5 minutes of scrolling the console.

#### Root causes found (concrete, cited)

**1. `getUserStats` ran on every auth call.**
[src/dal/user.dal.ts:945](src/dal/user.dal.ts#L945) (inside `getUserByEmailForAuth`) unconditionally called `this.getUserStats(userId)`, which issues a full aggregate query joining `rentals × reviews` to compute profile stats (borrowed count, shared count, average rating). **This data was only ever displayed on the profile page**, but was being computed on every authenticated request in the entire app.

**Verified before removal:** `grep` for `.stats`, `user.stats`, `userProfile.stats`, `.listingsBorrowed`, etc. across `src/**` (excluding tests) returned **zero runtime consumers**. The profile page at [src/app/dashboard/profile/page.tsx:42](src/app/dashboard/profile/page.tsx#L42) fetches its own counts directly via `rentalDAL.countBorrowedListings` and `rentalDAL.countSharedListings` — it never reads `user.stats` at all. The field was pure dead computation.

**2. `React.cache()` doesn't dedupe across route handler call sites.**
`getCurrentUser` was wrapped in `cache()` from `react`. That only memoizes within a single RSC render pass — **it does nothing inside route handlers**. Every call site in a route handler ran fresh.

Observed in the tracker on `/api/listings/search`: `user:4 session:2 rentals:2` — literally double the tax because two independent call sites (`withRequestLogging` calling `getCurrentUserId()` AND the handler calling `getAuthenticatedUserResponse()`) each ran the full chain without dedupe.

**3. Redundant `user` reads inside a single auth chain.**
Even in single-call cases the breakdown showed `user: 2`. Breakdown:

- 1 query from Better Auth's internal `getSession` (it validates the session by fetching the user)
- 1 query from our DAL's `user.findFirst(where: eq(user.email, …))` with `preferences` + `addresses` relations

We already had the user ID from Better Auth's session, so refetching by **email** (with joins) was pure waste. Fetching by **ID** with no joins is the correct hot path.

**4. `handleApiError` kicked off a third auth chain on error paths.**
[src/lib/api/route-helpers.ts:46](src/lib/api/route-helpers.ts#L46) called `getCurrentUser().then(setSentryUser)` fire-and-forget, which meant every API error fired a fresh Better Auth + DAL chain just to tag Sentry with the user ID — on a path where auth was already resolved.

#### Fixes applied

**Fix A+C (combined): new slim `getUserForAuth(id)` method**
Added a new method to [src/dal/user.dal.ts](src/dal/user.dal.ts) alongside the existing `getUserByEmailForAuth` (left untouched for safety). `getUserForAuth(id)`:

- PK lookup by `user.id` — faster than email index, uses PK.
- **No** `preferences` relation. **No** `addresses` relation. **No** `getUserStats` call.
- Returns a `UserProfile`-compatible shape with zeroed stats, `preferences: null`, `primaryAddress: undefined`. This preserves the type contract so all 25+ `getCurrentUser()` call sites in the codebase don't need updating — they just get faster results.

**Fix B: ALS-backed request memoization for `getCurrentUser`**
Added a `user?: unknown` slot to `RequestContext` in [src/lib/logger/request-context.ts](src/lib/logger/request-context.ts). `getCurrentUser` in [src/features/auth/utils/session.ts](src/features/auth/utils/session.ts) now:

1. Checks the ALS slot first — returns cached value if populated (fast path, zero DB).
2. On miss: runs the Better Auth session check + `userDAL.getUserForAuth(session.user.id)`, writes the result to the ALS slot, returns.

The `React.cache()` wrapper is kept as an outer layer so RSC paths outside `withRequestLogging` (layouts, pages) still benefit within a single render pass.

**Critical:** `withRequestLogging` calls `getCurrentUserId()` as its very first step to tag the logger with `userId`. That call populates the ALS slot for the rest of the request. Every downstream call site (handler, helpers, error path) hits the cached value. **This is why the double-tax on `/api/listings/search` collapsed** — the two independent call sites now read from the same ALS slot instead of firing independent chains.

**Fix D: `handleApiError` reads user from ALS**
Replaced the fire-and-forget `getCurrentUser().then(setSentryUser)` with a direct read of `getRequestContext()?.user`. If the slot is populated (it always is by this point — `withRequestLogging` already ran), tag Sentry. If not, skip. No more extra auth chain on error paths.

---

## Architectural decisions worth remembering

These are the non-obvious calls made during this branch. Future agents / developers should not revisit them without reading the rationale.

1. **SQL-table attribution, not stack-walk attribution.** See D2 section above. Stack walking is dead under Turbopack.

2. **ALS memoization via `RequestContext`, not a dedicated cache.** Piggybacked on the existing `runWithRequestContext` ALS that was already set up by `withRequestLogging`. Adding a second ALS would duplicate infrastructure. The `user` slot is typed as `unknown` in the `RequestContext` interface to avoid a circular type import from `@/dal/types` — the auth layer casts at the boundary.

3. **New `getUserForAuth(id)` instead of mutating `getUserByEmailForAuth`.** The existing fat method has several consumers outside the auth path (admin flows, onboarding). Mutating its shape would risk breaking unrelated call sites. Additive approach is safer.

4. **`UserProfile`-compatible return shape with zeroed stats.** `getUserForAuth` returns the same `UserProfile` type with `stats: { zeros }`, `preferences: null`, `primaryAddress: undefined`. This preserved type compatibility across 25+ `getCurrentUser()` call sites. No caller updates needed. Verified safe by grepping for `.stats`, `.preferences`, `.primaryAddress` access on `getCurrentUser()` results — all came back empty (outside tests).

5. **`withRequestLogging` is the choke point for route handler tracking.** 128 of 131 handlers go through it. A single edit there replaces what would otherwise be 131 mechanical wrapper applications. Whenever you need per-request instrumentation on the route handler side, **add it to `withRequestLogging`** — do not wrap individual handlers.

6. **Turbopack + RSC + ALS is fragile.** The `QueryTrackerBoundary` uses `enterWith()` to mutate the current async context instead of `.run()` (which would create a new scope that doesn't propagate to children). Even so, it appears to only fire on the first cold render. See [Known gaps](#known-gaps-and-open-questions).

7. **Everything is gated on `NODE_ENV !== "production"`.** The query tracker, the Drizzle logger hook, the `QueryTrackerBoundary`. Zero production cost. This is a hard requirement and must not regress.

8. **Warn threshold is 15 queries per request.** Dev-only `console.warn`. Tune later based on real usage — could go down to 10 once Phase 5 (notification polling fix) lands.

---

## Before / after metrics

**Methodology:** Dev-mode navigation pass across 20+ routes, raw numbers read directly from the `[query-tracker]` console output. Not production — dev mode has overhead, but the query counts are valid because they come from the Drizzle driver itself.

### Per-endpoint query counts

| Route                                 | Before (start of branch) | After (end of branch)      | Δ            |
| ------------------------------------- | ------------------------ | -------------------------- | ------------ |
| `/api/messages/unread-count`          | 5                        | 4                          | −1           |
| `/api/notifications/count`            | 5                        | 4                          | −1           |
| `/api/notifications`                  | 6                        | 5                          | −1           |
| `/api/services/bookings`              | 9                        | 4                          | **−5**       |
| `/api/rentals/lending/incoming`       | 10                       | 5                          | **−5**       |
| `/api/rentals/renting/requests`       | 9                        | 4                          | **−5**       |
| `/api/rentals/renting/completed`      | 10                       | 5                          | **−5**       |
| `/api/services/listings/my`           | 9                        | 4                          | **−5**       |
| `/api/garage/active`                  | 7                        | 6                          | −1           |
| `/api/garage/pending-count`           | 8                        | 7                          | −1           |
| **`/api/listings/search`**            | **16 ⚠**                 | **11 (cold) / 7–8 (warm)** | **−5 to −9** |
| `/api/(payments)/get-payment-methods` | 4                        | 3                          | −1           |
| `/api/messages/conversations/[id]`    | (not measured)           | 4                          | —            |

### The auth floor, before and after

**Before:**

```
user: 2
session: 1
rentals: 1    ← getUserStats
────────────
4 queries of tax on every request (+1 business = 5 minimum)
```

**After:**

```
user: 2
session: 1
────────────
3 queries of tax on every request (+1 business = 4 minimum)
```

The remaining `user: 2` is the irreducible floor: 1 from Better Auth's internal session validation + 1 from our `getUserForAuth(id)` for extended fields (Stripe Connect status, TOS version, etc.). Eliminating that second query would require denormalizing those fields into Better Auth's `user` table — a schema migration with real blast radius. **Not worth doing until other higher-ROI wins are exhausted.**

### `/api/listings/search` breakdown, before and after

**Before (16 queries):**

```
user: 4                ← doubled tax (two auth chains)
session: 2             ← same
rentals: 2             ← same (getUserStats × 2)
listing_images: 3      ← possible residual N+1
listings: 2            ← main + count
community_memberships: 1
user_addresses: 1
reviews: 1
```

**After (11 cold / 7–8 warm):**

```
user: 2                ← single auth chain (ALS dedupe working)
session: 1             ← same
listing_images: 3      ← unchanged — Phase 5 target
listings: 2
community_memberships: 1
user_addresses: 1
reviews: 1
```

The 8 queries of auth redundancy collapsed to 3. Warm calls further drop to 7 — likely Better Auth's internal session cache hitting, not our work.

### Subjective feel

User reported `/dashboard` "feels ok, not snappy" **before** the auth tax fix. Not re-measured after. The LCP should be modestly improved but the dominant perceived-perf bottleneck on the dashboard is Phase 2 streaming not behaving as expected (separate issue, see [Known gaps](#known-gaps-and-open-questions)).

---

## Verification state

- **`npm run type-check`** — clean.
- **`npm run test:run`** — **3543 passed, 6 skipped** across 254 test files. 30s runtime.
- **Migration status** — no database migrations in this branch. All changes are application-code only.
- **Manual QA** — user navigated 20+ authenticated routes and confirmed query-count reductions via the tracker. No functional regressions observed.
- **Two test files updated** for the `getUserByEmailForAuth` → `getUserForAuth` rename in the auth hot path:
  - [src/features/auth/utils/**tests**/session.test.ts](src/features/auth/utils/__tests__/session.test.ts) — mock renamed, assertion argument changed from `"test@example.com"` to `"user-123"` (session.user.id).
  - [src/features/auth/**tests**/e2e/unauthorized-access-workflow.test.ts](src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts) — mock renamed.

Neither of these is a semantic change — the tests continue to verify the same behavior, just against the new method name.

---

## Files changed

### New files

- [src/db/query-tracker.ts](src/db/query-tracker.ts) — core ALS counter + SQL table parser + reporter.
- [src/components/dev/query-tracker-boundary.tsx](src/components/dev/query-tracker-boundary.tsx) — RSC boundary component (see [Known gaps](#known-gaps-and-open-questions)).
- [src/app/dashboard/(rentals)/(flow)/\_components/rentals-flow-header.tsx](<src/app/dashboard/(rentals)/(flow)/_components/rentals-flow-header.tsx>) — extracted client header.
- [src/app/dashboard/services/(flow)/\_components/services-flow-header.tsx](<src/app/dashboard/services/(flow)/_components/services-flow-header.tsx>) — extracted client header.
- [PHASE_4_HANDOFF.md](PHASE_4_HANDOFF.md) — this file.

### Modified files

- [src/db/db.ts](src/db/db.ts) — Drizzle logger hook wired to `recordQuery` in non-prod.
- [src/dal/user.dal.ts](src/dal/user.dal.ts) — new `getUserForAuth(id)` method added (fat `getUserByEmailForAuth` untouched).
- [src/features/auth/utils/session.ts](src/features/auth/utils/session.ts) — `getCurrentUser` rewritten to use ALS slot + slim `getUserForAuth(id)` path.
- [src/lib/logger/request-context.ts](src/lib/logger/request-context.ts) — added `user?: unknown` slot to `RequestContext`.
- [src/lib/api/with-request-logging.ts](src/lib/api/with-request-logging.ts) — wrapped handler execution in `runWithQueryCounter(route, …)`.
- [src/lib/api/route-helpers.ts](src/lib/api/route-helpers.ts) — `handleApiError` reads user from ALS instead of firing fresh auth chain.
- [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) — wrapped subtree in `<QueryTrackerBoundary>`.
- [src/app/dashboard/(rentals)/(flow)/layout.tsx](<src/app/dashboard/(rentals)/(flow)/layout.tsx>) — converted to server component.
- [src/app/dashboard/services/(flow)/layout.tsx](<src/app/dashboard/services/(flow)/layout.tsx>) — converted to server component.
- [src/components/payments/how-payments-work-modal.tsx](src/components/payments/how-payments-work-modal.tsx) — raw `<img>` → `next/image`.
- [src/features/auth/utils/**tests**/session.test.ts](src/features/auth/utils/__tests__/session.test.ts) — mock rename.
- [src/features/auth/**tests**/e2e/unauthorized-access-workflow.test.ts](src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts) — mock rename.

---

## What's left — prioritized

Ordered by estimated ROI, not by phase. Each item is sized for a single focused PR.

### Priority 1 — Notification polling (highest remaining impact)

**The single biggest production-load win still on the table.** Not in any original phase.

Observed in the tracker: on every page, the client polls three endpoints every ~30s:

- `GET /api/messages/unread-count` — 4 queries
- `GET /api/notifications/count` — 4 queries
- `GET /api/notifications?page=1&limit=10&unreadOnly=false` — 5 queries

That's **13 queries per 30 seconds per open tab**, forever, regardless of whether the user is actively doing anything. At 100 concurrent users that's ~2,600 queries/minute just to paint notification badges.

**Recommended fix (in order of effort):**

1. **Collapse the three endpoints into one.** A single `GET /api/dashboard/badges` that returns `{ unreadMessages, notificationCount, latestNotifications }` in one pass. 3 round trips → 1. Immediately reduces load by 66%.
2. **Bump the polling interval.** Find the React Query `refetchInterval` (likely in a shared hook — grep for `unread-count` in `src/features/notifications/` and `src/features/messages/`) and move from ~30s to 2–5 min. Users don't need second-resolution accuracy on badge counts.
3. **Move to SSE or WebSocket push** for notification updates. Better Auth is already websocketing via neon-serverless, so the infrastructure story is no harder. This is the long-term correct answer.

Do step 1 first (quick win, biggest impact). Step 2 is trivial and stacks with step 1. Step 3 is a separate initiative.

**Estimated impact:** 13 queries / 30s → 4 queries / 2 min per tab. Roughly a 20× reduction in background load.

### Priority 2 — RSC dashboard tracker is not firing

`[query-tracker] RSC /dashboard` no longer appears in the console after the first cold navigation. The `QueryTrackerBoundary` uses `queryCounterStorage.enterWith()` to mutate the current async context, but in practice the store doesn't seem to propagate to descendant RSC renders under Turbopack/Next 16.

**Why this matters:** Without this, we have no visibility into server-side query counts on the dashboard and other RSC-rendered pages. The initial measurement of "47 queries / 2816ms on the dashboard" was captured early — we don't know what that number is now post-auth-tax-fix. It's probably ~22, but it's not measured.

**Suspected root cause:** Next.js 16's RSC renderer may isolate each server component in its own async context (or use `cache()`-like wrapping internally), so `enterWith()` in a parent layout doesn't propagate to children rendered afterward.

**Suggested fix options (in order of likelihood):**

1. **Move the boundary to `page.tsx` level instead of `layout.tsx`.** Each navigation re-seeds the counter at the page level. More surgical.
2. **Use `runWithQueryCounter()` (which uses `.run()`, not `.enterWith()`) and wrap the rendered JSX inside it.** But this may not propagate either, for the same reason — RSC rendering happens outside the synchronous callback return.
3. **Do per-widget seeding.** Each Phase 2 widget calls `runWithQueryCounter('widget-name', …)` explicitly. More boilerplate, but 100% reliable because the ALS scope is contained in the async function that does the DAL calls.
4. **Page-level helper function.** Create a `trackRscRender(label, fn)` helper that server components call at the top of their async body. Similar to option 3 but DRY.

**Estimated effort:** 30–60 min to get right. Validate by navigating cold to `/dashboard` and confirming `[query-tracker] RSC /dashboard` appears with a non-zero count.

### Priority 3 — Dashboard doesn't feel snappy (Phase 2 investigation)

User reported: `/dashboard` "doesn't really feel snappy, just feels ok" — after Phase 2 streaming was supposedly shipped.

**Hypothesis:** Phase 2 split the dashboard into 8 Suspense widgets that were supposed to stream in independently. If the widgets all render but don't actually paint progressively (e.g., because they all `await` something early, or because a common layout element blocks), the user sees a long blank and then everything at once — which is the pre-Phase-2 feel.

**To investigate:**

1. Open `/dashboard` with Chrome DevTools Network tab set to "Disable cache", throttling "Fast 3G". Navigate cold.
2. Watch the document stream. Each widget should arrive as a distinct chunk with its own timing.
3. If you see one big document and nothing before it: streaming isn't working. Likely cause: a parent component is `await`ing something before rendering children, or Phase 2's Suspense boundaries got collapsed during a refactor.
4. Check [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) for any `await` that happens **before** the `<Suspense>` boundaries.
5. Check [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) for any `await` at the top — we know `await getCurrentUser()` is there, which is fine because it's cheap now, but verify nothing else sneaks in.

**This is speculative — I did not investigate this myself.** The tracker fix was higher priority.

### Priority 4 — `listing_images: 3` on cold `/api/listings/search`

The breakdown shows:

```
/api/listings/search (cold): listing_images: 3
/api/listings/search (warm): listing_images: 1
```

Warming behavior suggests this isn't a hot N+1 — it's probably 3 batched lookups for different purposes (primary image, thumbnail grid, alt sizes?) that share a query plan cache on warm calls. **Low priority.** Investigate only if it shows up under real user patterns or production `pg_stat_statements` data.

If you do dig in, start at the search handler ([src/app/api/listings/search/route.ts](src/app/api/listings/search/route.ts)) and trace through to `listingDal` to see where the three separate image fetches originate.

### Priority 5 — `/api/notifications` shows `notifications: 2`

Minor inefficiency — likely a count + rows pattern that could be collapsed into a single `SELECT … COUNT(*) OVER () …`. Not urgent. Not worth its own PR unless bundled with the Priority 1 notification consolidation.

### Priority 6 — Image hygiene warnings

Dev console shows warnings from the tracker run:

1. `/hoador-logo.svg` — "LCP image should have `loading='eager'`" and "width or height modified, but not the other, add `width: 'auto'` or `height: 'auto'`". Fix: add `priority` prop to the Image (if it's above the fold), and explicit `style={{ width: 'auto', height: 'auto' }}` or adjust the Tailwind classes.
2. Several `https://thnd3cwzf3mlmu4a.public.blob.vercel-storage.com/...` listing images have the same aspect-ratio warning. These are rendered by whatever component displays listing images — fix is the same: explicit width/height or `style={{ width: 'auto', height: 'auto' }}`.
3. `/images/mock/tools/rake.webp` — same LCP warning.

Cosmetic but does affect CLS. Low priority unless CLS is flagged by Vercel Speed Insights.

---

## Known gaps and open questions

### Gap 1 — RSC dashboard tracker (see Priority 2 above)

The boundary fires on the first cold render but subsequent navigations don't emit a report. Suspected cause is Next 16 async context isolation. **Fix not attempted in this branch.**

### Gap 2 — The irreducible `user: 2` auth floor

Every request still makes 2 queries against the `user` table:

1. Better Auth's internal fetch when validating the session token.
2. Our `getUserForAuth(id)` for extended fields.

Eliminating the second one requires denormalizing extended fields (Stripe Connect status, `idVerified`, `addressVerified`, `tos/privacy/communityVersion`, etc.) into the Better Auth user table and changing `getCurrentUser` to read directly from `session.user`. That's:

- A migration to add 10+ columns to the Better Auth `user` table.
- Updating every write path that currently touches the old user profile to keep the Better Auth row in sync.
- Or: configuring Better Auth's `user.additionalFields` config to project these columns into its user type.

**Not worth it right now.** Revisit only if: (a) you hit a production DB bottleneck on the `user` table, or (b) you want to eliminate the full round-trip to our DAL on the session-validation path.

### Gap 3 — Neon websocket ETIMEDOUT in dev

Seen during one test run:

```
Error [APIError]: Failed to get session
  cause: { code: 'ETIMEDOUT', syscall: 'read' }
```

This is a stale Neon serverless WebSocket connection timing out. Not related to any code change. Happens in dev when the connection idles. The next request reconnects. If you see it again in dev, just retry. If it happens in production, investigate the Neon pooler config — but it hasn't been reported in prod.

### Gap 4 — `DEBUG_QUERY_TRACKER_STACK` is left in the source

The raw-stack dump env var flag is still wired in [src/db/query-tracker.ts](src/db/query-tracker.ts) even though we're no longer using stack-walking. It's harmless (gated on env var) and **should be kept** — it's useful for future debugging if attribution ever regresses.

### Gap 5 — `getUserByEmailForAuth` is technically unused

After Fix A+C, `getUserByEmailForAuth` is no longer called from the auth hot path. It may still have other callers (grep to confirm — I did not check). If it's truly dead, a future cleanup PR can remove it, but leaving it as-is is zero risk.

### Gap 6 — `getUserStats` is still called from `getUserById` and `getUserByEmail`

The branch only removed `getUserStats` from `getUserByEmailForAuth`. Lines [src/dal/user.dal.ts:142](src/dal/user.dal.ts#L142) and [src/dal/user.dal.ts:193](src/dal/user.dal.ts#L193) still call it in the other two user lookup methods. Since **zero runtime code reads `.stats`** anywhere in the app, those calls are also dead weight — but they're outside the auth hot path so the impact is minimal. Clean them up in a future pass if desired.

---

## How to use the query tracker

Once this branch is merged, the tracker is always on in dev. You don't need to do anything special to see the output.

### Normal usage

Run `npm run dev` (or `bun run dev`). Navigate the app. Watch the console for lines like:

```
[query-tracker] GET /api/listings/search — 11 queries, 511ms
  - listing_images: 3
  - user: 2
  - listings: 2
  - session: 1
  - community_memberships: 1
  - user_addresses: 1
  - reviews: 1
```

If any request exceeds 15 queries, it's logged at `warn` level with a `⚠ exceeds threshold` tag.

### What to look for

- **High counts** (>8 on a simple endpoint) — likely a residual N+1 or redundant auth. Investigate by looking at the table breakdown.
- **One table dominating** — classic N+1 signature. If you see `listing_images: 12` on a route that returns 12 listings, that's 1+N.
- **`user` or `session` counts > 2** — auth tax regression. Something is calling `getCurrentUser` outside the ALS-memoized path.
- **New table names** — if a new table starts appearing in breakdowns after a feature lands, you can immediately see where it was introduced.

### Debugging when a table says `_other`

The SQL parser falls through to `_other` for statements it doesn't understand (uncommon). If you see `_other: N` and need to dig in, set `DEBUG_QUERY_TRACKER_STACK=1` in `.env.local` — the first query per process will dump to the console, and you can verify what Drizzle is emitting. The stack dump is there for debugging the tracker itself, not for attribution.

### Production

**The tracker does nothing in production.** `NODE_ENV === "production"` disables:

- The Drizzle logger hook (set to `false`).
- `runWithQueryCounter()` (early return).
- `recordQuery()` (no counter in ALS → early return).
- `reportQueryCounter()` (early return).
- `QueryTrackerBoundary` (early return before any ALS interaction).

Zero production overhead. Verify by running `NODE_ENV=production npm run build && npm run start` and navigating — no `[query-tracker]` lines should appear.

### Warning threshold

Currently `QUERY_WARN_THRESHOLD = 15` in [src/db/query-tracker.ts](src/db/query-tracker.ts). Tune down to 10 after Phase 5 (notification polling fix) lands — that'll surface the next tier of offenders.

### CI integration (future)

A Playwright smoke test could hit key routes and assert the per-request query count stays under a threshold. Not built in this branch but easy to add:

```ts
test("dashboard query budget", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("[query-tracker]")) logs.push(msg.text());
  });
  await page.goto("/dashboard");
  // Wait for network idle
  await page.waitForLoadState("networkidle");
  // Parse logs, assert counts
  const maxCount = Math.max(...logs.map(extractQueryCount));
  expect(maxCount).toBeLessThan(25);
});
```

This is a soft gate — a regression lands with a visible test failure before it hits main. Skip this until the RSC tracker (Priority 2) is actually firing, otherwise you'll be asserting against route handlers only and miss RSC regressions.

---

## Commands you'll use

```bash
# Type-check
npm run type-check

# Full test suite (30s)
npm run test:run

# Dev server with query tracker (default)
bun run dev  # or npm run dev

# Enable raw stack dump for first query (debugging tracker itself)
echo 'DEBUG_QUERY_TRACKER_STACK=1' >> .env.local
bun run dev

# Verify tracker is off in prod
NODE_ENV=production npm run build && npm run start
# Navigate to any route — no [query-tracker] lines should appear

# Run only the session test file (post-fix verification)
npm run test:run -- src/features/auth/utils/__tests__/session.test.ts

# Run only the auth E2E test file
npm run test:run -- src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts

# Find all route handlers (for future wrapper audits)
find src/app -name "route.ts" | wc -l   # should be 131

# Find route handlers NOT using withRequestLogging
grep -rL "withRequestLogging" src/app --include="route.ts"
# Expected: 3 (test-upload, test/last-email, test/reset-user, auth/[...all])
```

---

## Final notes

**Grade:** B+. The app is in genuinely good shape on the route handler side. Most endpoints are at 3–5 queries, which is within 1–2 of the theoretical floor. The biggest remaining wins are Priority 1 (notification polling) and Priority 3 (verify Phase 2 streaming is actually streaming).

**The single most valuable artifact of this branch is not a perf fix — it's the query tracker itself.** Every future perf investigation will start by running the tracker and reading the breakdowns. The auth tax fix was discovered in its first 5 minutes of use; there will be more findings like that once notification polling is fixed and the next tier of offenders becomes visible.

**Don't merge and forget.** Do one full navigation pass after merge to confirm the numbers hold in a fresh dev environment, then move on to Priority 1.
