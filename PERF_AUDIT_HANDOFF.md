# Hoador Web — Performance Audit Handoff

**Audit date:** 2026-04-14
**Branch in flight:** `perf/phase-1-db-fixes` (off `develop`)
**Stack context:** Next.js App Router, Drizzle ORM, Postgres (Neon), React Query, Vercel deploy, React Native mobile client sharing APIs.

**Original symptom:** App "feels slow" on navigation and interaction.

**Architectural constraint respected throughout:** React Query is the intentional client data layer for authenticated/dashboard routes. The plan _optimizes_ React Query usage (prefetch + hydration) rather than replacing it with server components wholesale.

---

## Table of contents

1. [Phase 1 — DB indexes + N+1 fixes](#phase-1--db-indexes--n1-fixes-in-progress)
2. [Phase 1.5 — Residual N+1 cleanup](#phase-15--residual-n1-cleanup)
3. [Phase 2 — Dashboard streaming](#phase-2--dashboard-streaming)
4. [Phase 3 — React Query server hydration primitive](#phase-3--react-query-server-hydration-primitive)
5. [Phase 4 — Cleanup, query tracking, image hygiene](#phase-4--cleanup-query-tracking-image-hygiene)
6. [Metrics & observability plan](#metrics--observability-plan)
7. [Per-phase "where you should notice the improvement"](#per-phase-where-you-should-notice-the-improvement)
8. [Open questions / known risks](#open-questions--known-risks)
9. [Agent delegation patterns](#agent-delegation-patterns)

---

## Phase 1 — DB indexes + N+1 fixes (IN PROGRESS — ready to commit)

### Goal

Stop the bleeding on the two worst offenders: unindexed filter columns on `rental_requests` and two high-traffic DAL methods that issue one DB round trip per row.

### What was delivered

| File                                                                                                                                                | Change                                                                                                                               | Impact                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [src/db/schemas/rentals.schema.ts](src/db/schemas/rentals.schema.ts)                                                                                | +2 composite indexes: `(owner_id, status)`, `(renter_id, status)` on `rental_requests`                                               | Dashboard alert queries stop sequential-scanning            |
| [src/db/migrations/0054_fresh_caretaker.sql](src/db/migrations/0054_fresh_caretaker.sql)                                                            | Generated migration, two `CREATE INDEX` statements only                                                                              | Ready for Neon branch → preview → prod                      |
| [src/dal/rentals.dal.ts](src/dal/rentals.dal.ts) `getBorrowedListings`                                                                              | Loop over `listingIds` issuing one image query each → single batched `inArray` query with JS reduction to first-per-listingId        | `1 + N` → `2` queries. For 10 rentals: 11 → 2 round trips   |
| [src/dal/listing.dal.ts](src/dal/listing.dal.ts) `_getUserListingsWithFilters` (private helper called by public `getUserActiveListingsWithFilters`) | Per-listing `reviews` + `listingImages` queries → two batched `inArray` queries running in parallel via `Promise.all`, mapped in JS  | `1 + 2N` → `3` queries. For 10 listings: 21 → 3 round trips |
| [src/dal/**tests**/rentals.dal.test.ts](src/dal/__tests__/rentals.dal.test.ts)                                                                      | +characterization test locking the exact return shape of `getBorrowedListings` with a 3-listing/2-image fixture                      | Guarantees refactor is shape-identical                      |
| [src/dal/**tests**/listing.dal.test.ts](src/dal/__tests__/listing.dal.test.ts)                                                                      | +characterization test for `getUserActiveListingsWithFilters` covering rating computation, image null handling, and numeric coercion | Same                                                        |

### Deviations from the original plan

1. **`listing_images.listing_id` index was NOT added.** It already exists as `listing_images_listing_id_idx` in [listings.schema.ts](src/db/schemas/listings.schema.ts) (plus a composite `(listing_id, order_index)`). My original audit was wrong — Postgres uses the existing single-column index for `listing_id` lookups.
2. **A3 scope retargeted.** Original audit pointed at `getUserListings` (line ~1066), but `getUserActiveListingsWithFilters` actually delegates to a private helper `_getUserListingsWithFilters` (line ~1316). The private helper contained the same N+1 pattern and is the one actually fixed. `getUserListings` and `_getUserListingsWithConditions` are still broken — see Phase 1.5.
3. **Nullable FK gotcha.** The refactor hit a TypeScript error because `listingImages.listingId` is typed `string | null` (the FK column is nullable in the schema — suspicious, flagged for future investigation). Fixed with a one-line `continue` guard in the batched-image loop.

### Verification

- `npm run type-check` — clean
- `npm run test:run -- src/dal/__tests__/rentals.dal.test.ts src/dal/__tests__/listing.dal.test.ts` — **88/88 passing**
- Migration generated only. **Not applied to any database.**

### To ship Phase 1

1. Review the diff on `perf/phase-1-db-fixes`.
2. Commit in one logical commit (or split migration from code if your review process prefers).
3. Open PR into `develop`.
4. Apply migration manually: Neon branch → preview env → `EXPLAIN ANALYZE` the two fixed DAL methods against realistic data to confirm index usage → merge → prod.
5. Keep an eye on p95 DB time for `/api/garage/*` and `/dashboard` for 24h post-deploy.

---

## Phase 1.5 — Residual N+1 cleanup

### Why this exists

Phase 1's A3 agent flagged that the N+1 pattern in [listing.dal.ts](src/dal/listing.dal.ts) exists in **two more places** beyond what was fixed:

- `_getUserListingsWithConditions`
- `getUserListings` (public, called from various non-garage routes)

Both use the same `.map(async)` loop issuing per-listing review + image queries. We scoped them out of Phase 1 to keep the PR small and the characterization surface manageable, but they need the same fix.

There is also a strong suspicion that similar patterns exist in other DAL files. The Phase 4 query tracking tooling will surface them definitively — but a quick grep-based sweep can catch the obvious ones now.

### Tasks

1. Apply the same Drizzle `inArray` pattern used in `_getUserListingsWithFilters` to:
   - `_getUserListingsWithConditions` in [listing.dal.ts](src/dal/listing.dal.ts)
   - `getUserListings` in [listing.dal.ts](src/dal/listing.dal.ts)
2. Add characterization tests for each, matching the pattern from Phase 1.
3. Grep across `src/dal/**/*.ts` for `\.map\(async` and `for.*await.*this\.db` — investigate each match. Likely offenders to audit manually:
   - `messages.dal.ts` (conversation list with last-message + unread count lookups)
   - `notifications.dal.ts` (if it enriches notifications with actor/target data)
   - `dispute.dal.ts`
   - `service-listing.dal.ts` (mirror of listing.dal; probably has the same bug)
4. Investigate why `listingImages.listingId` is nullable. A FK on an image join table being nullable is very suspicious. If it should be `NOT NULL`, add a migration — but only after confirming no orphaned rows exist (`SELECT COUNT(*) FROM listing_images WHERE listing_id IS NULL`).

### Size estimate

1–2 PRs. Can run agents in parallel per DAL file since they touch disjoint files.

### Acceptance criteria

- All identified N+1 loops replaced with batched queries.
- Type-check clean.
- All DAL test suites passing.
- Query tracking tooling from Phase 4 (if landed first) shows no route exceeds 15 queries per request.

---

## Phase 2 — Dashboard streaming

### Goal

Stop blocking the entire dashboard render on the slowest of 8 parallel DAL calls. Give the user a painted shell immediately and stream widgets in as their data resolves.

### Current state (the problem)

[src/app/dashboard/page.tsx:51-92](src/app/dashboard/page.tsx#L51-L92) does a single giant `Promise.all` over 8 DAL calls:

- `getLendingRequestsByStatus`
- `getActionableAlerts`
- `getUnreadMessageCount`
- `getUserConversationsPaginated`
- `getUpcomingSchedule`
- `getDashboardActivityFeed`
- `getUserDisputes`
- `getDashboardPulseData`

Nothing renders until **all 8** resolve. There is no `loading.tsx` at the dashboard index ([dashboard/loading.tsx](src/app/dashboard/loading.tsx) doesn't exist), so the user stares at the previous page until TTFB completes. There are no `<Suspense>` boundaries around individual widgets.

The layout at [src/app/dashboard/layout.tsx:9](src/app/dashboard/layout.tsx#L9) is `force-dynamic` and awaits `getCurrentUser()` at line 17. Since `getCurrentUser` is now memoized via `React.cache()` (user confirmed 2026-04-14), this is cheap — but it still blocks the shell from rendering.

### Task breakdown

#### B1 — Dashboard skeleton

- Create `src/app/dashboard/loading.tsx` rendering a skeleton that matches the widget grid layout. Use existing skeleton primitives in `src/components/ui/skeleton.tsx` if present; otherwise a grid of shimmer `div`s.
- Visual spot-check in `npm run dev` — when navigating to `/dashboard`, skeleton should paint immediately.
- **Ship B1 independently.** Even without B2 it's a visible perceived-perf win.

#### B2 — Widget Suspense islands

Refactor [dashboard/page.tsx](src/app/dashboard/page.tsx):

1. Create `src/app/dashboard/_widgets/` directory (underscore prefix = private, not a route).
2. For each of the 8 DAL calls, create a corresponding `*.widget.tsx` — an async server component that does its own single DAL call and renders its own UI fragment. Example:
   ```tsx
   // src/app/dashboard/_widgets/actionable-alerts.widget.tsx
   export async function ActionableAlertsWidget({
     userId,
   }: {
     userId: string;
   }) {
     const alerts = await safe(() => dal.getActionableAlerts(userId), []);
     return <AlertsCard alerts={alerts} />;
   }
   ```
3. The page becomes a layout + suspense islands:
   ```tsx
   export default async function DashboardPage() {
     const user = await getCurrentUser();
     return (
       <DashboardGrid>
         <Suspense fallback={<AlertsSkeleton />}>
           <ActionableAlertsWidget userId={user.id} />
         </Suspense>
         <Suspense fallback={<MessagesSkeleton />}>
           <UnreadMessagesWidget userId={user.id} />
         </Suspense>
         {/* ...6 more... */}
       </DashboardGrid>
     );
   }
   ```
4. Preserve the existing `safe()` error wrapper per widget — widget failure must not crash the page.
5. Verify streaming works: temporarily add `await new Promise(r => setTimeout(r, 3000))` inside one widget and confirm the other seven render while it's still pending.

#### Risks

- **Waterfall risk.** If each widget component does its own `getCurrentUser()` call, that's 8x the work even with `React.cache()`. Pass `userId` as a prop from the page.
- **Cache boundary risk.** If a widget both fetches data AND imports a heavy client component, the bundle for that client component still ships. No regression from today — just don't make it worse.
- **Layout shift.** Skeleton dimensions must match rendered widget dimensions or CLS will spike.

### Acceptance criteria

- `/dashboard` paints shell + skeletons within one frame of navigation.
- Each widget streams in independently (network tab shows staggered chunks).
- Widget failure doesn't break the page (test by throwing inside one widget).
- Real-user LCP on `/dashboard` improves (measure via Speed Insights — see metrics plan).

---

## Phase 3 — React Query server hydration primitive

### Goal

Eliminate the invisible tax where client `useQuery`s re-fetch data the server just fetched. This is the systemic gap that makes every dashboard navigation feel like "shell → spinner → content" instead of "shell → content."

### Current state (the problem)

- QueryClient config at [src/components/providers.tsx:20-28](src/components/providers.tsx#L20-L28) is good: `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`.
- **NO** `HydrationBoundary` or `dehydrate` call exists anywhere in the codebase.
- **NO** server-side `prefetchQuery` exists anywhere.
- Every client `useQuery` starts cold on first mount, even when the server component that contains it just fetched the same data for SSR.

### Task breakdown

#### C1 — Build the primitive

Create `src/lib/react-query/server.ts`:

```ts
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cache } from "react";

// cache() ensures one QueryClient per request (not per component)
export const getServerQueryClient = cache(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // must match providers.tsx
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
}));

export function HydrateClient({ children }: { children: React.ReactNode }) {
  const qc = getServerQueryClient();
  return <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>;
}
```

Add a unit test that round-trips a prefetched query through `dehydrate` and confirms the client cache sees it as `fresh` (not `stale`).

**Critical:** the `staleTime` in the server QueryClient must be ≥ the staleTime on the client query, or the client will immediately refetch on mount. This is the most common mistake with this pattern.

#### C2 — Pilot on the garage page

The garage page ([src/app/dashboard/listings/rentals](src/app/dashboard/listings/rentals)) is the best pilot:

- It uses `useActiveListings` (a client query) heavily.
- It already has a DAL call that could be prefetched.
- It's a focused route, easy to validate.

Pattern:

```tsx
// server component
import { getServerQueryClient, HydrateClient } from "@/lib/react-query/server";
import { listingDal } from "@/dal/listing.dal";

export default async function GaragePage() {
  const qc = getServerQueryClient();
  await qc.prefetchQuery({
    queryKey: ["listings", "active", defaultFilters],
    queryFn: () => listingDal.getUserActiveListingsWithFilters(...),
  });
  return (
    <HydrateClient>
      <GarageClient />
    </HydrateClient>
  );
}
```

**Critical validation gate:** Open React Query Devtools, navigate to `/dashboard/listings/rentals` cold. The `["listings", "active", ...]` query MUST appear as `fresh` with no fetch. If it fires a network request on mount, the hydration is broken — debug before proceeding to C3.

Common failure modes to check first:

- Query key mismatch (server prefetch key ≠ client `useQuery` key — must be deep-equal).
- `staleTime: 0` on the client query (default) — client treats hydrated data as stale and refetches immediately. Fix: match the staleTime.
- The client component isn't a descendant of `<HydrateClient>`.

#### C3 — Roll out to mailbox + dashboard pulse

Once C2 is validated, apply the same pattern to:

- [src/app/dashboard/mailbox/page.tsx](src/app/dashboard/mailbox/page.tsx) — prefetch conversation list.
- Dashboard pulse widget (from Phase 2) — prefetch pulse data.

Do **not** try to hydrate every client query everywhere. Start with the routes where the double-fetch tax is most visible.

### Acceptance criteria

- C1's helper exists with a passing unit test.
- C2: React Query Devtools shows the query as `fresh` on cold navigation to garage. Network tab shows zero fetches for that query on mount.
- C3: same for mailbox and dashboard pulse.
- No regression on `/dashboard` LCP (server prefetch adds time to TTFB; the client-side save should more than offset it).

---

## Phase 4 — Cleanup, query tracking, image hygiene

### D1 — Push `"use client"` down

**Where:**

- [src/app/dashboard/(rentals)/(flow)/layout.tsx:1](<src/app/dashboard/(rentals)/(flow)/layout.tsx#L1>)
- [src/app/dashboard/services/(flow)/layout.tsx:1](<src/app/dashboard/services/(flow)/layout.tsx#L1>)

**Task:** These layouts are marked `"use client"`, forcing the entire flow subtree to ship as client JS. Before editing, investigate _why_ they're client components — if they host a context provider for multi-step flow state, that's legitimate but the provider should be moved into a separate component. The layout itself usually doesn't need to be client.

**Agent must report findings before editing.** If the layout is holding a non-trivial context, plan the extraction first.

### D2 — Query tracking tooling (CRITICAL — don't skip)

This is the single most valuable piece of tooling to prevent future N+1s and to validate every subsequent phase. Build it in **D2a** (dev-mode counter) and optionally **D2b** (production p95 telemetry).

#### D2a — Dev-mode per-request query counter

**Goal:** when running locally, log the number of DB queries executed per request, with a per-route breakdown and an optional warning threshold.

**Where to instrument:** the Drizzle client factory. Find it by searching `drizzle-orm` imports — it's likely `src/db/index.ts` or `src/db/client.ts`. There will be exactly one place where the client is instantiated.

**Implementation sketch:**

```ts
// src/db/query-tracker.ts
import { AsyncLocalStorage } from "node:async_hooks";

type Counter = {
  count: number;
  queries: Array<{ sql: string; durationMs: number }>;
  startedAt: number;
};

export const queryCounterStorage = new AsyncLocalStorage<Counter>();

export function startQueryCounter(): Counter {
  const counter: Counter = { count: 0, queries: [], startedAt: Date.now() };
  return counter;
}

export function recordQuery(sql: string, durationMs: number) {
  const counter = queryCounterStorage.getStore();
  if (!counter) return;
  counter.count++;
  counter.queries.push({ sql, durationMs });
}
```

**Wrapping the Drizzle client (postgres-js example):**

```ts
// src/db/index.ts (modify existing)
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { recordQuery } from "./query-tracker";

const sql = postgres(process.env.DATABASE_URL!, {
  debug:
    process.env.NODE_ENV !== "production"
      ? (_conn, query, _params, _types) => {
          // postgres-js debug hook fires per query
          recordQuery(query, 0); // duration tracked separately if needed
        }
      : undefined,
});

export const db = drizzle(sql, { schema });
```

If you're using `drizzle-orm/neon-http`, the hook mechanism is different — use a logger:

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

export const db = drizzle(neon(process.env.DATABASE_URL!), {
  schema,
  logger:
    process.env.NODE_ENV !== "production"
      ? {
          logQuery(query, params) {
            recordQuery(query, 0);
          },
        }
      : undefined,
});
```

**Starting the counter per request:** in a Next.js middleware OR in a top-level `instrumentation.ts` file, wrap each request in `queryCounterStorage.run(startQueryCounter(), () => ...)`. For App Router, the cleanest place is a custom wrapper in your DAL base class — or a `beforeRequest` hook in `instrumentation.ts`.

Simpler alternative that avoids middleware gymnastics: make DAL methods self-reporting. Wrap the DAL base class constructor so every DAL method call logs `[DAL] <className>.<method> → N queries in Xms`. This gives 80% of the value with 20% of the work, and localizes the cost.

**Output:** at end of request (or end of DAL call), log to console:

```
[query-tracker] GET /dashboard — 47 queries, 812ms total DB time
  - dashboard.getDashboardActivityFeed: 12 queries
  - listings.getUserActiveListingsWithFilters: 3 queries
  - rentals.getBorrowedListings: 2 queries
  ...
```

**Warning threshold:** log `WARN` if any single request exceeds 15 queries. Tune based on real usage.

**Not for production.** Gate entirely behind `NODE_ENV !== "production"` to avoid overhead.

#### D2b — Production p95 telemetry (optional, deferred)

If you want production visibility without the dev-mode overhead:

1. Turn on Neon's `pg_stat_statements` extension (Neon supports it).
2. Query top-N slowest statements weekly from a small admin dashboard or cron job.
3. Optionally forward DAL method timings to Sentry as `Sentry.startSpan()` — the project already has Sentry ([next.config.ts:122-134](next.config.ts#L122-L134)).

**Verification for D2:**

- Navigate to `/dashboard` in dev → see query count logged.
- Before Phase 1 lands, count should be high (estimated 30–60+). After Phase 1, should drop ~15–25 queries from the two N+1 fixes alone.
- Integrate into CI as a soft gate later: a smoke test that hits key routes and asserts query count < threshold.

### D3 — Replace raw `<img>` tags

**Where:** grep found 4 raw `<img` tags during the audit. Re-run `rg -l '<img[[:space:]]' src` to get the current list.

**Task:** Convert each to `next/image` with explicit `sizes` prop. Include `width`/`height` (or `fill` + sized parent) to prevent CLS. Do not forget to add remote domains to [next.config.ts](next.config.ts) `images.remotePatterns` if a new domain appears.

---

## Metrics & observability plan

### What to turn on now (before Phase 2)

1. **Vercel Speed Insights** — user confirmed enabled 2026-04-14. Install the local package if not yet done (`@vercel/speed-insights/next`). This is the single most important tool for validating every subsequent phase.
2. **Vercel Analytics** (Web Vitals) — same package family, complementary.
3. **`pg_stat_statements` on Neon** — enable now so by Phase 2 you have a week of baseline data.
4. **React Query Devtools** — gate to dev only:
   ```tsx
   {
     process.env.NODE_ENV === "development" && <ReactQueryDevtools />;
   }
   ```

### What to build in Phase 4

- Dev-mode query counter (D2a above).
- Optional CI smoke test asserting query-count threshold.

### What to measure per phase

| Metric                                                     | How                         | Baseline (before Phase 1) | After Phase 1                       | After Phase 2                                     | After Phase 3                                            |
| ---------------------------------------------------------- | --------------------------- | ------------------------- | ----------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| **p75 TTFB `/dashboard`**                                  | Vercel Speed Insights       | _record now_              | small improvement                   | moderate (shell streams)                          | moderate (prefetch adds to TTFB but total feel improves) |
| **p75 LCP `/dashboard`**                                   | Vercel Speed Insights       | _record now_              | small                               | **large**                                         | **large**                                                |
| **p75 INP `/dashboard`**                                   | Vercel Speed Insights       | _record now_              | none expected                       | small (less hydration blocking)                   | small                                                    |
| **Per-request DB query count on `/dashboard`**             | Dev-mode counter (D2a)      | est. 30–60                | est. 15–25                          | unchanged                                         | unchanged                                                |
| **p95 DB query time — `getUserActiveListingsWithFilters`** | `pg_stat_statements`        | _record now_              | **large drop** (21 → 3 round trips) | unchanged                                         | unchanged                                                |
| **p95 DB query time — `getBorrowedListings`**              | `pg_stat_statements`        | _record now_              | **large drop** (`1+N` → 2)          | unchanged                                         | unchanged                                                |
| **Cold-navigation fetch count (garage)**                   | Chrome DevTools Network tab | _record now_              | unchanged                           | unchanged                                         | **drop** — prefetched queries stop refetching            |
| **First Load JS on dashboard route**                       | `next build` output         | _record now_              | unchanged                           | unchanged (maybe slight change from widget split) | unchanged                                                |

**Action before Phase 1 merges:** record every "baseline" cell above by navigating to the route in prod or a prod-like preview and noting the number. Without a baseline, "we made it faster" is just a claim.

---

## Per-phase "where you should notice the improvement"

### After Phase 1 merges and the migration is applied

- **Where to look:** `/dashboard` page (specifically the garage-active-listings card and the borrowed-listings widget), any `/api/garage/*` endpoint.
- **What to feel:** the garage grid should load noticeably faster when you have ≥5 active listings. Dashboard alert loading should be snappier if you have a lot of rental history.
- **What to measure:** `EXPLAIN ANALYZE` on the two fixed DAL methods in Neon — should show `Index Scan` (not `Seq Scan`) on `rental_requests` after the index lands. DB query count for `getUserActiveListingsWithFilters` should drop from ~21 to 3 per call.
- **What you will NOT feel yet:** dashboard shell still waits for all 8 Promise.all calls. Navigation into the dashboard still shows the "nothing → everything" jump. That's Phase 2.

### After Phase 2 ships

- **Where to look:** `/dashboard` cold navigation (click from another page, or hard-refresh).
- **What to feel:** the dashboard shell paints almost instantly with skeletons, then widgets fill in one by one. Even if the data takes the same total time to fetch, it _feels_ ~2x faster because you see something immediately.
- **What to measure:** LCP on `/dashboard` should drop significantly in Speed Insights. CLS should stay stable if skeletons are sized correctly (watch for regression).
- **What you will NOT feel yet:** navigating _within_ the dashboard (e.g., from dashboard to garage) still shows a brief spinner as client queries refetch. That's Phase 3.

### After Phase 3 ships

- **Where to look:** navigating between dashboard routes (dashboard → garage, dashboard → mailbox).
- **What to feel:** the "shell → spinner → content" jank disappears. Content shows up with the shell because React Query sees the cache as fresh immediately.
- **What to measure:** in React Query Devtools, the relevant queries show as `fresh` with no fetch on mount. In Chrome Network tab, cold navigation to these routes does not trigger the corresponding fetch.
- **What you will NOT feel yet:** any remaining N+1s not caught in Phase 1/1.5. The query counter (D2a) will surface them.

### After Phase 4 ships

- **D1:** minor — the rental and services flow pages should have slightly smaller JS bundles.
- **D2a:** you gain visibility. You don't "feel" anything, but you can now _see_ every DAL bug before it ships. Run through the app in dev and watch for `WARN` logs.
- **D2b:** long-term production observability — informs future phases.
- **D3:** minor LCP improvement on pages that had raw `<img>` tags, especially on slow connections.

---

## Open questions / known risks

1. **Nullable `listingImages.listingId` FK.** Flagged in Phase 1. Investigate whether this is intentional; if not, migrate to `NOT NULL` after checking for orphans. Deferred to Phase 1.5.
2. **Drizzle logger hook depends on driver.** The query tracker implementation in D2 differs between `postgres-js`, `neon-http`, and `neon-serverless`. Confirm the project's driver before implementing — check the `db/` directory.
3. **Server prefetch + dynamic rendering.** Phase 3's prefetch adds work to the server render. If a DAL call is slow, prefetching it makes TTFB worse. Only prefetch what the client will 100% need immediately — not speculative queries.
4. **Layout `force-dynamic`.** The dashboard layout's `force-dynamic` ([layout.tsx:9](src/app/dashboard/layout.tsx#L9)) disables all caching for the entire subtree. If `experimental.dynamicIO` + `'use cache'` become viable, some read-only widgets (activity feed, pulse) could be edge-cached with stale-while-revalidate. Not in any current phase — flag as a future optimization.
5. **The 250 `"use client"` files.** Most are justified (forms, interactive UX). At scale, consider setting a First Load JS budget per route in CI via `@next/bundle-analyzer` output. Not a phase, just a future guardrail.
6. **Mobile (React Native) impact.** Every API route change improves mobile too, since they share the same APIs. Phase 1 helps mobile garage page load. Phase 2/3 are web-only (no React Server Components on RN). Phase 4's tooling helps both.

---

## Agent delegation patterns

Each phase is broken into agent-sized work units. General guidance for delegating:

- **Each agent gets a self-contained prompt** with exact file paths, line numbers, and acceptance criteria. No "figure it out" prompts.
- **One agent per disjoint file set.** Agents touching the same file must run sequentially, not in parallel.
- **Characterization tests first.** For any non-trivial refactor, the agent writes a test locking the current behavior, runs it against the broken code to confirm it passes, _then_ refactors. This is how Phase 1 survived a subtle type error and preserved return shapes byte-identically.
- **Generate-only for migrations.** Agents never run `drizzle-kit migrate` or `push`. You apply manually via Neon branching.
- **Report, don't commit.** Agents report findings and leave the working tree dirty. You review and commit.
- **Verify agent claims.** A Phase 1 agent claimed the type errors at [rentals.dal.ts:485-486](src/dal/rentals.dal.ts#L485-L486) were "pre-existing" — they weren't; the refactor introduced them. Always run the type checker and tests yourself before believing the report.

### Suggested agent sequence per phase

| Phase | Parallel?                   | Agents                                                         |
| ----- | --------------------------- | -------------------------------------------------------------- |
| 1     | yes (3 disjoint files)      | A1 schema, A2 rentals.dal, A3 listing.dal                      |
| 1.5   | yes (per DAL file)          | one agent per suspected DAL                                    |
| 2     | no — B1 must land before B2 | B1 skeleton, then B2 widget split                              |
| 3     | no — C1 before C2 before C3 | C1 primitive, then C2 pilot + validation gate, then C3 rollout |
| 4     | yes                         | D1 layout cleanup, D2 query tracker, D3 image hygiene          |

---

## Appendix — commands you'll use repeatedly

```bash
# Type-check
npm run type-check

# Run a single test file
npm run test:run -- src/dal/__tests__/rentals.dal.test.ts

# Run all DAL tests
npm run test:run -- src/dal/__tests__/

# Generate a drizzle migration (do NOT apply)
pnpm drizzle-kit generate

# Bundle size per route
npm run build  # look at the route table in output

# Dev server with query counter (once D2a lands)
npm run dev
```
