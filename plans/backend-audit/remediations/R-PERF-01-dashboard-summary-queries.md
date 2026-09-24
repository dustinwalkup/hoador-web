# R-PERF-01: Fetch dashboard summary sources once and bound the unbounded reads

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/app/api/dashboard/summary/route.ts src/features/dashboard/lib/`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: LOW
- **Depends on**: none · **Category**: perf
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`GET /api/dashboard/summary` is the mobile Home tab's single read, refetched
on every foreground. React's `cache()` (used by `cached-fetchers.ts`) only
dedupes within a true React Server Component render; a Next.js **route
handler** doesn't create that scope, so it does nothing here, and the same
underlying query re-runs on every independent call site. Two of the
re-running queries have no `LIMIT` at all. Verified by direct read (not just
the audit's estimate): the route independently triggers the provider-bookings
query **5 times**, the requester-bookings and borrowed-listings queries
**3 times each**, and four other sources **2 times each**, per request. The
slowest screen belongs to the most active users. Audit finding PERF-01
(HIGH).

## Current state

Call graph, traced by direct read (not the finding's estimate):
`route.ts` calls `getDashboardPulseData` (`pulse-data.ts`),
`getUpcomingSchedule` (`schedule.ts`), `getActionableAlertsCached`,
`getDashboardActivityFeed` (`activity-feed.ts`),
`getLendingRequestsByStatusCached("pending",...)`, and
`findServiceBookingsByProviderCached` — six `Promise.all` branches
(`route.ts:75-89`). But `getDashboardPulseData` **also** calls
`getUpcomingSchedule` internally (`pulse-data.ts:90`), and `getUpcomingSchedule`
itself calls `getBorrowedListingsCached`, `getLendingRequestsByStatusCached("approved"/"active",...)`,
`findServiceBookingsByRequesterCached`, and `findServiceBookingsByProviderCached`
(`schedule.ts:80-87`) — so the route's own direct
`getUpcomingSchedule` call and pulse's internal one both re-run all five of
those. `getDashboardActivityFeed` bypasses the cached wrappers entirely and
calls `serviceBookingDAL.findByProviderForDashboard`/`findByRequesterForDashboard`
and `listingDAL.getUserListings` **directly** (`activity-feed.ts:47-51`).
Net per-request call counts for the underlying DB query:
provider-bookings **5×**, requester-bookings **3×**, borrowed-listings **3×**,
pending/actionable-alerts/provider-service-listings **2× each**.

- `service-booking.dal.ts:796-829` `findByProviderForDashboard` (and its
  `findByRequesterForDashboard` sibling) — **no `LIMIT`**, `SELECT *` +
  listing title + counterparty email, `ORDER BY createdAt DESC` only.
- `listing.dal.ts:1042-1065` `getUserListings` — **no `LIMIT`**, and pipes
  through `_enrichListingsWithRatingsAndImages` (line 1065,
  `listing.dal.ts:1363`), which loads every image for every returned listing.
  `activity-feed.ts` uses only the newest 10 (line 71) after fetching all of
  them.
- `cached-fetchers.ts` (full file, 41 lines) — every export is
  `cache((userId) => daoCall(userId))`; this file is also used correctly by
  three **RSC widgets** (`dashboard-pulse.widget.tsx`,
  `alerts-row.widget.tsx`, `recent-activity.widget.tsx`), where `cache()`
  _does_ work, because those run inside a real render. **Do not remove
  `cache()` from this file** — the fix is to stop calling these functions
  redundantly from the route handler, not to change how RSC widgets use them.
- `src/lib/logger/request-context.ts` and `src/db/query-tracker.ts` — an ALS
  request-context and a dev-only per-request query counter
  (`runWithQueryCounter`, `QUERY_WARN_THRESHOLD = 15`) both already exist and
  are wired into `withRequestLogging`. This plan uses the query counter for
  its test, not to build a new caching layer — passing data down explicitly
  is simpler and carries no risk of a cache leaking one user's data into
  another's request (an ALS-cache mistake would be a data-isolation bug, not
  just a perf one).
- `hoador-mobile/src/api/contract/dashboard.contract.ts` — the response
  shape is a hand-maintained mirror of this route (comment at line 7: "copied
  2026-08-05"), validated by a strict Zod schema (`dashboardSummarySchema`,
  lines 140-147). Every field name, nesting level and array-vs-count
  distinction (e.g. `pendingRequests.rentalTotal: number` alongside a
  5-item preview array) must be preserved exactly.

## Commands

| Purpose        | Command                                                                                 | Expected |
| -------------- | --------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                    | exit 0   |
| Lint           | `bun run lint`                                                                          | exit 0   |
| Targeted tests | `bun run test:run src/features/dashboard src/dal/__tests__/service-booking.dal.test.ts` | all pass |
| Full tests     | `bun run test:run`                                                                      | all pass |

## Scope

**In scope**: `src/app/api/dashboard/summary/route.ts`,
`src/features/dashboard/lib/pulse-data.ts`,
`src/features/dashboard/lib/schedule.ts`,
`src/features/dashboard/lib/activity-feed.ts`,
`src/dal/service-booking.dal.ts` (`findByProviderForDashboard`,
`findByRequesterForDashboard` — add `limit`/`statusFilter` options),
`src/dal/listing.dal.ts` (new lean method for the activity feed), tests for
all of the above.

**Out of scope**: the three RSC widgets that call `getDashboardPulseData`/
`getUpcomingSchedule`/`getDashboardActivityFeed` directly (their call pattern
is already correct — `cache()` works there; only verify they still compile
with the new optional parameters, do not change their call sites unless
type-check fails); `PERF-03` (per-request auth resolution — separate
finding, no plan assigned here).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Accept optional pre-fetched inputs

Change these three functions to accept an optional second/extra argument that
short-circuits their own fetch when provided — default `undefined` preserves
every existing caller (the three RSC widgets) unchanged:

- `getUpcomingSchedule(userId, prefetched?: { borrowed, lendingApproved, lendingActive, asClient, asProvider })` — skip the `Promise.all` at `schedule.ts:80-87` when `prefetched` is given; use its fields instead.
- `getDashboardPulseData(userId, prefetched?: { upcomingSchedule: ScheduleEntry[] })` — skip the internal `getUpcomingSchedule` call at `pulse-data.ts:90`; use `prefetched.upcomingSchedule` instead.
- `getDashboardActivityFeed(userId, limit, prefetched?: { serviceBookingsAsRequester, serviceBookingsAsProvider })` — skip the two `serviceBookingDAL.find...ForDashboard` calls at `activity-feed.ts:49-50`; use the prefetched arrays instead (still apply the existing `.slice(0, fetchLimit)` locally).

**Verify**: `bun run type-check` → exit 0 (RSC widgets still compile calling these with one argument).

### Step 2: Fetch once in the route, pass down

In `route.ts`, before the existing `Promise.all` (line 75), fetch the shared
sources once each via `safe()`: `borrowed`, `lendingApproved`,
`lendingActive`, `asClient` (requester bookings), `asProvider` (provider
bookings). Build `upcomingSchedule` by calling the now-optional
`getUpcomingSchedule(userId, {borrowed, lendingApproved, lendingActive, asClient, asProvider})`
once. Pass `{upcomingSchedule}` into `getDashboardPulseData` and
`{serviceBookingsAsRequester: asClient, serviceBookingsAsProvider: asProvider}`
into `getDashboardActivityFeed`. Also thread `asProvider` into the route's
existing `pendingServiceBookings` computation (line 91) so
`findServiceBookingsByProviderCached` is no longer called a 6th time
separately — reuse `asProvider` directly. The response JSON shape (lines
95-149) must not change. **Verify**: `bun run type-check` → exit 0; manual
read confirms no source is fetched more than once per request.

### Step 3: Bound the provider/requester booking reads

Add an options parameter to `findByProviderForDashboard`/
`findByRequesterForDashboard`: `{ limit?: number }`, applying
`.limit(options?.limit ?? 100)` after the existing `.orderBy(...)`. Call
sites in Step 2 pass no explicit limit (100 is a generous cap — well above
any realistic "recent" or "pending" need, and eliminates the 500-row
pathological case from the audit's failure scenario without a multi-query
redesign). Keep the return shape identical. **Verify**: `bun run type-check` → exit 0.

### Step 4: Lean, capped listing feed

In `listing.dal.ts`, add a new method near `getUserListings`:

```ts
async getUserListingsForFeed(userId: string, limit: number) {
  return this.db.select({ id: listings.id, name: listings.name, updatedAt: listings.updatedAt })
    .from(listings).where(eq(listings.ownerId, userId))
    .orderBy(desc(listings.updatedAt)).limit(limit);
}
```

In `activity-feed.ts`, replace the `listingDAL.getUserListings(userId)` call
(line 48) with `listingDAL.getUserListingsForFeed(userId, limit)` and drop
the now-redundant `.slice(0, limit)` at line 71 (the query already limits).
**Verify**: `bun run type-check` → exit 0.

## Test plan

- **Query-count** (`route.test.ts` or a new integration test): using
  `runWithQueryCounter` (`src/db/query-tracker.ts`) around a call to the
  route handler with a mocked or seeded-real DB — assert the total query
  count is well under the current 33-46 (target: roughly a third, given the
  5×/3×/3×/2×/2×/2× redundancy is eliminated). Model the harness on any
  existing `runWithQueryCounter` test if one exists
  (`grep -rln "runWithQueryCounter" src/**/__tests__`); if none exists,
  assert directly on mock call counts instead (e.g.
  `findServiceBookingsByProviderCached`'s underlying DAL mock is called
  exactly once).
- **Response-shape snapshot**: call the route with a fixed mocked user and
  snapshot the JSON against `dashboardSummarySchema` from
  `hoador-mobile/src/api/contract/dashboard.contract.ts` (read-only import
  path, or hand-copy the shape into a local Zod schema in the test — do not
  edit the mobile repo) to pin the mobile contract.
- **DAL**: `findByProviderForDashboard({limit: 5})` returns at most 5 rows
  against a seeded/mocked set of 10.

**Verify**: `bun run test:run src/features/dashboard src/dal/__tests__/service-booking.dal.test.ts` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] A test asserts the response JSON shape is unchanged (mobile contract pin)
- [ ] A test or manual trace confirms no dashboard-summary source query runs more than once per request
- [ ] `grep -n "\.limit(" src/dal/service-booking.dal.ts` shows the two dashboard finders now bounded
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- A field in the current JSON response can't be reconstructed from the
  reshuffled data flow (e.g. something in `pulse-data.ts` needs a piece of
  `upcomingSchedule` that Step 1's `prefetched` shape doesn't carry) — report
  the exact field rather than widening the shape ad hoc.
- Any RSC widget fails to type-check after Step 1's signature change.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- No field, type, or nesting change to the `GET /api/dashboard/summary`
  response — verified against `hoador-mobile/src/api/contract/dashboard.contract.ts`'s
  `dashboardSummarySchema`. `pendingRequests.rentalTotal`/`serviceTotal` stay
  true totals (not affected by Step 3's 100-row cap, since realistic pending
  counts are far below 100; if a provider ever has >100 pending bookings
  simultaneously, the total would under-count — flag this as a known
  limitation in the PR description rather than building a separate COUNT
  query, since it's an extreme edge case for a neighborhood marketplace).
  `upcomingSchedule`'s wall-clock date serialization (the UTC round-trip fix
  noted at `route.ts:132-147`) is untouched by this plan.
- This is the mobile Home tab's primary read — run the full targeted test
  suite (not just typecheck) before considering this plan done; a subtle
  shape regression here breaks the app's most-used screen.

## Maintenance notes

- The 100-row cap in Step 3 is a pragmatic bound, not the audit's full
  purpose-built-query design (separate `count(*)` for pending, a 7-day
  window filter for upcoming, `LIMIT 20` for recent). If provider booking
  volumes grow enough that 100 stops being generous, revisit with real
  `query-tracker` telemetry and split into the fully purpose-built queries
  the audit describes.
- If a future widget needs `getDashboardPulseData`/`getUpcomingSchedule`/
  `getDashboardActivityFeed` with a _different_ prefetch shape than this
  plan introduces, extend the `prefetched` parameter rather than adding a
  parallel code path.
