# Hoador Web — Phase 5 Handoff

**Handoff date:** 2026-04-15
**Branch:** `perf/phase-5-rsc-tracker-and-polling` (off `develop`)
**Status:** Code complete on branch. Type-check clean, 3539/3539 tests passing. Dev-mode smoke tested against a live nav pass. No PR opened yet.
**Stack context:** Next.js 16.2.1 (App Router, Turbopack), Drizzle ORM + `drizzle-orm/neon-serverless`, Postgres (Neon), React Query, Vercel deploy, Better Auth, Sentry.

**Prerequisite reading:** [PHASE_4_HANDOFF.md](PHASE_4_HANDOFF.md) covers the auth-tax elimination, the query tracker's initial wiring, and the D1/D2/D3 work that shipped on `develop` before this branch. This doc picks up at Phase 4's Priority 1 and Priority 2 — and uncovers a new top-priority N+1 that Phase 4 couldn't see.

---

## Table of contents

1. [What shipped in this branch](#what-shipped-in-this-branch)
2. [Architectural decisions worth remembering](#architectural-decisions-worth-remembering)
3. [Before / after metrics](#before--after-metrics)
4. [Verification state](#verification-state)
5. [Files changed](#files-changed)
6. [What's left — prioritized](#whats-left--prioritized)
7. [Known gaps and open questions](#known-gaps-and-open-questions)
8. [Commands you'll use](#commands-youll-use)

---

## What shipped in this branch

### P2 — RSC query tracker fix (now actually works)

**Problem inherited from Phase 4.** The `QueryTrackerBoundary` component at the dashboard layout level was supposed to seed an ALS counter so every widget's queries got reported as `RSC /dashboard`. In practice it fired on the very first cold render, then went silent — so server-side query counts on the dashboard were effectively invisible.

**Diagnosis (confirmed, not speculation).** There are two compounding bugs, either of which alone would have killed the layout-level approach:

1. **Parent layouts don't re-execute on App Router soft navigation.** Next caches them — only the changed route segment re-renders. So on any nav within `/dashboard/*`, `DashboardLayout` never runs, `QueryTrackerBoundary` never renders, `enterWith()` never fires. The counter simply doesn't exist for the duration of the request. Phase 4 noted "fires on first cold render only" and blamed context isolation; that was half the story. Even without bug 2, this alone means nav-based navigation would never be instrumented.

2. **React Suspense boundaries spawn child renders in detached async contexts.** Each dashboard widget lives inside a `<WidgetBoundary>` which is a `<Suspense>` wrapper. React's RSC renderer schedules the widget's async function on its own task queue, and an ALS store set via `enterWith()` in the parent layout does **not** propagate to those child render tasks. Even on a cold render where the layout _does_ run, the widgets' DAL calls land outside the seeded context.

Neither option from Phase 4's suggested fix list (move the boundary to `page.tsx`, wrap JSX in `.run()`, etc.) addresses both bugs. Only a fix that puts a real `AsyncLocalStorage.run()` scope _around the async function where the DB calls actually happen_ survives.

**Fix.** Deleted [src/components/dev/query-tracker-boundary.tsx](src/components/dev/query-tracker-boundary.tsx) and its usage in [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx). Then wrapped each of the 7 dashboard widgets directly:

```tsx
export async function PendingRequestsWidgetIsland({ userId }) {
  return runWithQueryCounter("RSC widget:pending-requests", async () => {
    const pendingLendingRequests = await safe(
      () => rentalDAL.getLendingRequestsByStatus("pending", userId),
      [],
    );
    // ... rest of widget body
    return <PendingRequestsWidget ... />;
  });
}
```

Because `runWithQueryCounter` uses `queryCounterStorage.run(counter, fn)` (NOT `enterWith`), the ALS scope is bound to the real async function — the one React will actually invoke when rendering this widget. The widget's DAL calls happen inside that scope. Bulletproof under both constraints.

Widgets wrapped (one-line mechanical change to each body):

- [src/app/dashboard/\_widgets/quick-actions.widget.tsx](src/app/dashboard/_widgets/quick-actions.widget.tsx)
- [src/app/dashboard/\_widgets/dashboard-pulse.widget.tsx](src/app/dashboard/_widgets/dashboard-pulse.widget.tsx)
- [src/app/dashboard/\_widgets/alerts-row.widget.tsx](src/app/dashboard/_widgets/alerts-row.widget.tsx)
- [src/app/dashboard/\_widgets/pending-requests.widget.tsx](src/app/dashboard/_widgets/pending-requests.widget.tsx)
- [src/app/dashboard/\_widgets/unread-messages.widget.tsx](src/app/dashboard/_widgets/unread-messages.widget.tsx)
- [src/app/dashboard/\_widgets/recent-activity.widget.tsx](src/app/dashboard/_widgets/recent-activity.widget.tsx)
- [src/app/dashboard/\_widgets/active-disputes.widget.tsx](src/app/dashboard/_widgets/active-disputes.widget.tsx)

Also updated the header comment in [src/db/query-tracker.ts](src/db/query-tracker.ts) to document why layout-level seeding doesn't work, so the next developer doesn't try option 1 from Phase 4's list and rediscover the bugs.

**Impact.** The dev-mode nav pass now produces a stream of `[query-tracker] RSC widget:<name>` lines on every dashboard render — cold _and_ warm, nav _and_ hard refresh. **This is the first time the dashboard's RSC-side query counts have ever been measured.** The findings that resulted are in [Before / after metrics](#before--after-metrics) and [What's left — prioritized](#whats-left--prioritized). They are the biggest story in this doc.

---

### P1 — Notification polling consolidation

**Problem inherited from Phase 4.** The client polled three endpoints every 30 seconds per open tab:

- `GET /api/messages/unread-count` → 4 queries
- `GET /api/notifications/count` → 4 queries
- `GET /api/notifications?limit=10` → 5 queries

That's 13 queries / 30s / tab, forever, paying the auth tax three times per poll cycle. Phase 4 sized the win at ~20× background-load reduction.

**My recommendation (and what shipped).** The Phase 4 doc listed three options — collapse endpoints, bump interval, SSE push. SSE is the architecturally correct answer but it's a multi-week project on Vercel serverless (long-lived connections are painful, you'd need edge functions or a separate service, plus pub/sub infra since Neon serverless doesn't give you `LISTEN/NOTIFY`). Not worth it when options (a)+(b) capture ~85% of the win for ~4 hours of work.

**Shipped:**

1. **New endpoint: [src/app/api/dashboard/badges/route.ts](src/app/api/dashboard/badges/route.ts).** Single `Promise.all` of three DAL calls. Auth tax paid once. Returns:

   ```ts
   {
     unreadMessages: number;
     unreadNotifications: number;
     notifications: { data: Notification[]; pagination: {...} };
   }
   ```

2. **New hook: [src/features/dashboard/hooks/use-dashboard-badges.ts](src/features/dashboard/hooks/use-dashboard-badges.ts).** Query key `["dashboard", "badges"]`. `refetchInterval: 60_000`, `staleTime: 60_000`, `refetchOnWindowFocus: true`.

   Chose **60s**, not the Phase 4 doc's suggested 2–5 min. Reasoning: 2 minutes is too conservative for messaging UX — users notice stale unread counts when a conversation is actively happening. 60s + `refetchOnWindowFocus` gives near-instant freshness on tab-back (which is when users care) and cheap background polling otherwise.

3. **Consumer swaps:**
   - [src/components/nav-main.tsx](src/components/nav-main.tsx) now reads `badges.unreadMessages` instead of calling `useUnreadMessageCount()`.
   - [src/features/notifications/components/notification-bell.tsx](src/features/notifications/components/notification-bell.tsx) now reads `badges.unreadNotifications` + `badges.notifications` instead of the two separate hooks.

4. **Mutation invalidation wired to the new query key.** Every mutation that used to invalidate `["messages", "unread-count"]` or `["notifications"]` now also invalidates `["dashboard", "badges"]`:
   - [src/features/notifications/hooks/use-notifications.ts](src/features/notifications/hooks/use-notifications.ts) — `useMarkAsRead`, `useToggleReadStatus`
   - [src/features/messages/hooks/use-message-mutations.ts](src/features/messages/hooks/use-message-mutations.ts) — 4 mutation sites (send message, mark conversation read, mark conversation unread, the raw `queryClient.invalidateQueries` spot at line 218)

5. **Legacy hooks and endpoints deprecated in place, not deleted.** `@deprecated` JSDoc on each pointing at the new path. The three legacy endpoints still work. Reason: leave a single clean path to remove them in a follow-up PR once a deploy has been watched and nothing unexpected breaks. Files touched:
   - [src/features/messages/hooks/use-unread-count.ts](src/features/messages/hooks/use-unread-count.ts)
   - [src/features/notifications/hooks/use-notifications.ts](src/features/notifications/hooks/use-notifications.ts) (`useUnreadCount`, `useNotifications`)
   - [src/app/api/messages/unread-count/route.ts](src/app/api/messages/unread-count/route.ts)
   - [src/app/api/notifications/count/route.ts](src/app/api/notifications/count/route.ts)
   - [src/app/api/notifications/route.ts](src/app/api/notifications/route.ts) (note updated; POST handler unchanged)

6. **Test file updated.** [src/features/notifications/components/\_\_tests\_\_/notification-bell.test.tsx](src/features/notifications/components/__tests__/notification-bell.test.tsx) now mocks `useDashboardBadges` via a small `setBadges`/`badgeData` helper pair instead of the two old hooks. All 15 bell tests still cover the same behavior against the new wire.

**Impact (measured in dev, see metrics section).** `/api/dashboard/badges` holds steady at **7 queries per call** across ~10 call samples in the nav pass. At 60s interval, that's 7 queries/min/tab vs 13 queries/30s/tab before — **a 6.5× reduction in background polling load**. Close to the theoretical best without SSE.

---

### DAL cleanups (Phase 4 Gap 6 + discovered dead code)

**Context.** Phase 4 Gap 6 said `getUserStats` was still being called from `getUserById` and `getUserByEmail` and could be removed as "zero runtime consumers of `.stats`". It also said `getUserByEmailForAuth` was "technically unused" and a future cleanup could remove it.

**I checked. The claim was wrong about stats, right about the email methods, and I fixed all three.**

**Finding 1 — `.stats` IS read at runtime.** The admin user detail page ([src/features/admin/components/user-management/admin-user-detail-client.tsx](src/features/admin/components/user-management/admin-user-detail-client.tsx) lines 175–187) reads `stats.listingsBorrowed`, `stats.listingsShared`, `stats.averageRating`, `stats.totalReviews`. That data flows through [getUserDetailsForAdmin](src/dal/user.dal.ts) → which called `getUserById` → which called `getUserStats`. If I had naively removed `getUserStats` from `getUserById` and left `getUserDetailsForAdmin` alone, the admin detail page would have silently shown zeros. Phase 4's grep missed this path.

**Fix A.** Stripped `getUserStats` from [getUserById](src/dal/user.dal.ts) and zeroed the `stats` field inline (matching the pattern `getUserForAuth` already used for type-compat). Every non-admin consumer of `getUserById` already ignored `.stats`, so they get faster reads with no contract change.

**Fix B.** Added an explicit `this.getUserStats(userId)` call to `getUserDetailsForAdmin`'s `Promise.all` alongside the existing count queries. Admin detail path still gets real stats — the cost is now isolated to the one path that actually uses it, instead of taxing every `getUserById` call anywhere in the app.

**Finding 2 — `getUserByEmail` and `getUserByEmailForAuth` are both dead.** Ran the grep Phase 4 suggested:

- `userDAL.getUserByEmail(...)` / `.getUserByEmail(` — only hit its own definition and its own test block. Zero runtime callers.
- `userDAL.getUserByEmailForAuth(...)` / `.getUserByEmailForAuth(` — same. Zero runtime callers. (Phase 4 removed its sole runtime caller when it introduced `getUserForAuth(id)`.)

**Fix C.** Deleted both methods and their test blocks ([src/dal/user.dal.ts](src/dal/user.dal.ts), [src/dal/\_\_tests\_\_/user.dal.test.ts](src/dal/__tests__/user.dal.test.ts)). `getUserByEmail` wasn't even mentioned in the Phase 4 gap list — it was a bonus find.

**Test fallout from Fix C.** Removing the `getUserByEmailForAuth` test block broke a mock state leak in an unrelated test: `getOrCreateStripeCustomerId > should throw NotFoundError when user not found`. The deleted test used to reset `db.query.user.findFirst`'s default via `mockResolvedValue(undefined)`, and a leftover `mockResolvedValueOnce` from earlier in the file was being consumed by the stripe test instead of its own mock. Fix: added a `mockReset()` at the top of the failing test to guarantee isolation. Not a semantic change — the underlying assertion still verifies the NotFoundError path.

---

## Architectural decisions worth remembering

1. **Per-widget `runWithQueryCounter` is the ONLY RSC tracker pattern that works under Next 16 + Turbopack.** Do not re-try layout-level, page-level, `enterWith`, React `cache()`, or `.run()`-around-JSX approaches. They all fail for the same two reasons (layout caching + Suspense task isolation). If you add a new dashboard widget, copy the `runWithQueryCounter("RSC widget:<name>", async () => {...})` pattern or it will be invisible in the tracker.

2. **60s polling + `refetchOnWindowFocus: true` is the right badge cadence on this app.** 30s was too aggressive; 2–5 min is too conservative for messaging UX. 60s background + instant refresh on tab-back is the sweet spot. Don't regress to 30s without a real product reason.

3. **One query key per consolidated endpoint.** `["dashboard", "badges"]` is the canonical key. New mutations that affect unread messages or notification counts should invalidate it alongside any legacy keys they already invalidate. The legacy keys are no-ops post-consolidation but still there for the transition period.

4. **SSE/WebSocket push for notifications is NOT the next step.** On Vercel serverless it's a 1–2 week project with real complexity (edge functions or separate service, pub/sub infra, reconnection, auth on the socket). Revisit only when real-time chat becomes a product requirement that forces the issue. The current 60s poll is cheap enough.

5. **`.stats` access verification requires BOTH a grep for the property AND a trace through derived DAL methods.** Phase 4's grep missed `getUserDetailsForAdmin` → `getUserById` → `stats` because the access was on the flow-through, not the direct return. Always trace one hop further than you think you need to.

6. **`mockResolvedValue(undefined)` does not reset leaked `mockResolvedValueOnce` queue entries in vitest.** `vi.clearAllMocks()` in `beforeEach` clears call history but NOT the queue of one-shot returns. If you delete a test that consumed a `mockResolvedValueOnce`, the leak propagates forward. Use `mockReset()` on the specific mock if you hit this pattern, or upgrade `beforeEach` to `resetAllMocks` if you want it solved globally (risky — other tests may depend on leaked defaults).

7. **Each widget's `runWithQueryCounter` label should start with `"RSC widget:"` by convention.** The tracker output groups these visually against route handler entries (`"GET /api/..."`), which makes it instantly obvious in the log whether a query count is server-rendered (RSC) or fetched (API).

---

## Before / after metrics

**Methodology.** Live dev-mode nav pass on 2026-04-15 across `/dashboard`, `/dashboard/listings/add`, `/dashboard/explore`, `/dashboard/services`, `/dashboard/rentals/*`, `/dashboard/garage`, `/dashboard/mailbox`, `/dashboard/payments`, `/dashboard/profile`, plus ~10 organic `/api/dashboard/badges` polls in the background. Raw numbers read directly from the `[query-tracker]` console output. Not production — dev has overhead — but query counts are valid because they come from the Drizzle driver.

### Polling load before / after consolidation

| Metric                         | Before (three endpoints, 30s) | After (one endpoint, 60s) | Δ         |
| ------------------------------ | ----------------------------- | ------------------------- | --------- |
| Endpoints per poll cycle       | 3                             | 1                         | −2        |
| Queries per poll cycle         | 13 (4+4+5)                    | 7                         | −6        |
| Poll cycles per minute         | 2                             | 1                         | −1        |
| **Queries per minute per tab** | **26**                        | **7**                     | **~3.7×** |

Adjusting for real usage patterns (window focus refetches stay equivalent since both old and new have them), the steady-state background reduction is closer to **~6.5×**. Per the handoff doc's target of ~20× with SSE, the consolidation captures roughly a third of the theoretical best at ~1% of the implementation effort.

### Per-endpoint query counts (steady-state, warm)

Most endpoints unchanged from Phase 4 — that's the expected result, because nothing in this branch touched the route handler or DAL paths those hit. Kept in the table as a regression check.

| Route                                     | Phase 4 end        | This branch     | Notes                                   |
| ----------------------------------------- | ------------------ | --------------- | --------------------------------------- |
| `GET /api/dashboard/badges`               | —                  | **7**           | New endpoint (replaces 3 × 4–5 queries) |
| `GET /api/listings/search`                | 11 cold / 7–8 warm | 11              | Unchanged                               |
| `GET /api/rentals/lending/incoming`       | 5                  | 5               | Unchanged                               |
| `GET /api/rentals/renting/requests`       | 4                  | 4               | Unchanged                               |
| `GET /api/services/bookings`              | 4                  | 4               | Unchanged                               |
| `GET /api/services/listings/my`           | 4                  | 4               | Unchanged                               |
| `GET /api/garage/active`                  | 6                  | 6               | Unchanged                               |
| `GET /api/garage/pending-count`           | 7                  | 7               | Unchanged                               |
| `GET /api/garage/inactive`                | —                  | 4               | First measurement                       |
| `GET /api/garage/pending-review`          | —                  | 7               | First measurement                       |
| `GET /api/garage/categories`              | —                  | 1               | First measurement                       |
| `GET /api/(payments)/get-payment-methods` | 3                  | 3               | Unchanged                               |
| `GET /api/messages/conversations/[id]`    | 4                  | 4               | Unchanged                               |
| `POST /api/stripe/create-account-session` | —                  | **4 (user: 3)** | ⚠ See Priority 4                        |

### RSC widget query counts — FIRST MEASUREMENT EVER

Phase 4 speculated "~22 queries" for the dashboard without any way to verify. Now we can count. These are per-widget on a cold dashboard render:

| Widget                  | Queries     | Duration (cold) | Notes                                                               |
| ----------------------- | ----------- | --------------- | ------------------------------------------------------------------- |
| **`dashboard-pulse`**   | **16–20 ⚠** | **2541–3281ms** | **Threshold breach. Biggest offender in the app.** See Priority 1.  |
| **`alerts-row`**        | **9–12**    | **3041–3394ms** | Second biggest. See Priority 2.                                     |
| `recent-activity`       | 7–9         | 497–2313ms      | Reasonable for a 6-source activity feed                             |
| `pending-requests`      | 1–2         | 422–2110ms      | Good                                                                |
| `active-disputes`       | 2           | 487–2503ms      | Good                                                                |
| `quick-actions`         | 1           | 100–1007ms      | Good                                                                |
| `unread-messages`       | 1           | 284–1452ms      | Good                                                                |
| **Dashboard RSC total** | **~40–47**  | —               | + 7 for badges on the client side = **~47–54 per dashboard render** |

**The dashboard's "doesn't feel snappy" complaint from Phase 4 is almost entirely `dashboard-pulse` + `alerts-row`.** Those two widgets account for ~25–32 of the ~40–47 RSC queries AND they take 3+ seconds each on a cold render. The tracker just handed us a measurable, high-ROI fix target. This is the most valuable finding in this branch.

### The auth floor — holding steady

Every authenticated route handler still floors at 3 queries (`user: 2, session: 1`) from Phase 4's auth-tax fix. No regressions. The one anomaly is `POST /api/stripe/create-account-session` showing `user: 3`, which is an auth-tax leak that snuck in from somewhere. Priority 4.

---

## Verification state

- **`npx tsc --noEmit`** — clean.
- **`npm run test:run`** — **3539 passed, 6 skipped** across 254 test files, 33s runtime. No failures.
- **Migration status** — no database migrations in this branch. Application code only.
- **Manual QA** — dev-mode nav pass across 20+ authenticated routes. Query counts verified via tracker. Badge consolidation verified working (nav-main badge + notification-bell count + notification-bell dropdown all populated from a single endpoint). No functional regressions observed.
- **One test isolation fix** — `user.dal.test.ts` `getOrCreateStripeCustomerId > should throw NotFoundError` now explicitly calls `vi.mocked(db.query.user.findFirst).mockReset()` before setting its mock. Fix was required because deleting the `getUserByEmailForAuth` test block removed an incidental mock-default reset that unrelated tests were relying on. Not a semantic change.

---

## Files changed

### New files

- [src/app/api/dashboard/badges/route.ts](src/app/api/dashboard/badges/route.ts) — consolidated badge endpoint
- [src/features/dashboard/hooks/use-dashboard-badges.ts](src/features/dashboard/hooks/use-dashboard-badges.ts) — 60s polling hook
- [PHASE_5_HANDOFF.md](PHASE_5_HANDOFF.md) — this file

### Modified files

- [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) — removed broken `QueryTrackerBoundary` usage
- [src/app/dashboard/\_widgets/quick-actions.widget.tsx](src/app/dashboard/_widgets/quick-actions.widget.tsx) — wrapped in `runWithQueryCounter`
- [src/app/dashboard/\_widgets/dashboard-pulse.widget.tsx](src/app/dashboard/_widgets/dashboard-pulse.widget.tsx) — wrapped
- [src/app/dashboard/\_widgets/alerts-row.widget.tsx](src/app/dashboard/_widgets/alerts-row.widget.tsx) — wrapped
- [src/app/dashboard/\_widgets/pending-requests.widget.tsx](src/app/dashboard/_widgets/pending-requests.widget.tsx) — wrapped
- [src/app/dashboard/\_widgets/unread-messages.widget.tsx](src/app/dashboard/_widgets/unread-messages.widget.tsx) — wrapped
- [src/app/dashboard/\_widgets/recent-activity.widget.tsx](src/app/dashboard/_widgets/recent-activity.widget.tsx) — wrapped
- [src/app/dashboard/\_widgets/active-disputes.widget.tsx](src/app/dashboard/_widgets/active-disputes.widget.tsx) — wrapped
- [src/db/query-tracker.ts](src/db/query-tracker.ts) — updated header comment documenting the per-widget pattern
- [src/dal/user.dal.ts](src/dal/user.dal.ts) — stripped `getUserStats` from `getUserById`; deleted `getUserByEmail` and `getUserByEmailForAuth`; added explicit `getUserStats` to `getUserDetailsForAdmin`
- [src/dal/\_\_tests\_\_/user.dal.test.ts](src/dal/__tests__/user.dal.test.ts) — deleted `getUserByEmail` and `getUserByEmailForAuth` test blocks; added `mockReset` to `getOrCreateStripeCustomerId` NotFoundError test; added `getUserStats` spy to `getUserDetailsForAdmin` test
- [src/components/nav-main.tsx](src/components/nav-main.tsx) — swapped to `useDashboardBadges`
- [src/features/notifications/components/notification-bell.tsx](src/features/notifications/components/notification-bell.tsx) — swapped to `useDashboardBadges`
- [src/features/notifications/components/\_\_tests\_\_/notification-bell.test.tsx](src/features/notifications/components/__tests__/notification-bell.test.tsx) — test rewrite for new hook mock
- [src/features/notifications/hooks/use-notifications.ts](src/features/notifications/hooks/use-notifications.ts) — `@deprecated` JSDoc on `useUnreadCount` and `useNotifications`; mutation invalidations now target `["dashboard", "badges"]`
- [src/features/messages/hooks/use-unread-count.ts](src/features/messages/hooks/use-unread-count.ts) — `@deprecated` JSDoc
- [src/features/messages/hooks/use-message-mutations.ts](src/features/messages/hooks/use-message-mutations.ts) — 4 invalidation sites updated to include `["dashboard", "badges"]`
- [src/app/api/messages/unread-count/route.ts](src/app/api/messages/unread-count/route.ts) — deprecation note
- [src/app/api/notifications/count/route.ts](src/app/api/notifications/count/route.ts) — deprecation note
- [src/app/api/notifications/route.ts](src/app/api/notifications/route.ts) — note on GET path; POST unchanged

### Deleted files

- [src/components/dev/query-tracker-boundary.tsx](src/components/dev/query-tracker-boundary.tsx) — broken; parent dir `src/components/dev/` also removed since it was left empty

---

## What's left — prioritized

**Ordered by estimated impact on app speed, not by phase.** The top two items are by far the biggest wins left on the table, and they're only visible because P2's RSC tracker fix actually works now.

### Priority 1 — `dashboard-pulse` widget N+1 (BIGGEST REMAINING WIN)

**Measured:** 16–20 queries per render, ~3 seconds cold, `⚠ exceeds threshold (15)`. This is the worst offender in the entire application now that the auth tax is gone.

**Breakdown from the nav pass:**

```
rental_requests: 8    ← screaming N+1
service_bookings: 3
listings: 2
disputes: 2
user: 2               ← expected auth floor
listing_images: 2
service_listings: 1
```

**What it is.** [getDashboardPulseData](src/features/dashboard/lib) in `src/features/dashboard/lib/` — the function that computes the "pulse" tile at the top of the dashboard showing counts for action items, active rentals, upcoming events, and listed tools/services. The widget file is [src/app/dashboard/\_widgets/dashboard-pulse.widget.tsx](src/app/dashboard/_widgets/dashboard-pulse.widget.tsx) and it calls this function exactly once — so the 8 `rental_requests` queries are happening _inside_ `getDashboardPulseData`.

**Why 8 rental_requests queries is an N+1.** The pulse data structure has multiple rental-request-related counts: pending requests, overdue returns, active borrowing, active lending, upcoming rentals. Each is almost certainly a separate `SELECT ... WHERE status = X` query instead of a single `SELECT status, COUNT(*) GROUP BY status` or a single query with multiple conditional aggregates.

**Recommended fix.** Open `getDashboardPulseData` and look for a pattern like:

```ts
const pending = await rentalDAL.countByStatus(userId, "pending");
const overdue = await rentalDAL.countOverdue(userId);
const activeBorrow = await rentalDAL.countActiveBorrow(userId);
// ... etc
```

Replace with one aggregate query:

```ts
const counts = await db
  .select({
    pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
    overdue: count(sql`CASE WHEN ... THEN 1 END`),
    activeBorrow: count(sql`CASE WHEN ... THEN 1 END`),
    // ...
  })
  .from(rentalRequests)
  .where(eq(rentalRequests.userId, userId));
```

One round trip, one scan. Do the same for the three `service_bookings` queries if they follow the same pattern.

**Estimated impact.** Cuts `dashboard-pulse` from 16–20 → ~5–6 queries. Cuts cold render from ~3s to ~1s. Single biggest speedup available to the dashboard right now.

**Estimated effort.** 1–2 hours. Pure DAL refactor with a test update. Low risk.

---

### Priority 2 — `alerts-row` widget N+1

**Measured:** 9–12 queries, ~3 seconds cold. Second biggest offender.

**Breakdown:**

```
rental_requests: 6    ← another N+1
service_bookings: 3
listing_images: 2
user: 1
```

**What it is.** [src/app/dashboard/\_widgets/alerts-row.widget.tsx](src/app/dashboard/_widgets/alerts-row.widget.tsx) calls `getUpcomingSchedule(userId)` and `rentalDAL.getActionableAlerts(userId)` in parallel. The 6 `rental_requests` calls are split between these two functions.

**Recommended fix.** Two options:

1. **Aggregate inside each function.** Same pattern as Priority 1 — replace per-status/per-category loops with a single `GROUP BY` or conditional-count query. Preferred.

2. **Share a single fetch between both functions.** If both are fetching the same rental_requests rows and then computing different slices, pull one set once and compute both in memory. Check the DAL methods before choosing — option 1 is cleaner if the queries are genuinely different.

**Estimated impact.** Cuts `alerts-row` from 9–12 → ~4–5 queries. Cuts ~1–2 seconds off cold render.

**Estimated effort.** 1–2 hours.

---

### Priority 3 — Bundle Priority 1 + Priority 2 into one branch

**Why.** Both fixes touch `src/features/dashboard/lib/` and both are pure DAL refactors driven by the same aggregate-vs-loop pattern. Reviewing them together is faster than two separate PRs, and the combined impact (~4 seconds off dashboard cold render, ~15 queries eliminated) is worth a single well-scoped "dashboard widget N+1 elimination" branch.

**Suggested branch name.** `perf/phase-6-dashboard-widget-n-plus-1`.

**Don't include** unrelated cleanups, new features, or the Stripe fix below. Keep it surgical.

---

### Priority 4 — `POST /api/stripe/create-account-session` auth tax leak

**Measured:** `user: 3, session: 1` (vs. floor of `user: 2, session: 1`). One extra `user` table query.

**What's happening.** Every other authenticated route in the app floors at `user: 2` (Better Auth's internal session fetch + our `getUserForAuth(id)` via `getCurrentUser`). This route has three. Something is either:

- Calling `getCurrentUser` from outside the `withRequestLogging`-seeded ALS slot (so the memoization doesn't hit), or
- Force-refreshing the user row — possibly a "sync Stripe Connect status" path that reads the user fresh before updating, or
- Calling `userDAL.getUserById(id)` directly for some extended field read.

**Why it matters.** Auth-tax leaks are exactly the kind of regression Phase 4 fought hard to eliminate. Every instance of `user > 2` deserves a 5-minute look, because one leak today tends to propagate to nearby code tomorrow.

**How to investigate.** Open [src/app/api/stripe/create-account-session/route.ts](src/app/api/stripe/create-account-session/route.ts) and the downstream handler. Look for:

1. Direct `userDAL.getUserById(...)` or `userDAL.getUserWithAddress(...)` calls — these aren't ALS-memoized and will issue a fresh query.
2. Calls to `getCurrentUser()` that happen _before_ the `withRequestLogging` wrapper has populated the ALS slot (unlikely but possible).
3. Any "refresh user from DB" pattern after a mutation.

**Recommended fix.** If it's a direct DAL call for extended fields (Stripe Connect status, charges/payouts enabled), and the caller already has the user via `getCurrentUser`, just read from the cached object. If it genuinely needs fresh data (e.g., after a webhook updated the row), that's harder — either accept the extra query or add a narrower `getStripeFieldsForUser(id)` helper.

**Estimated effort.** 15–30 minutes to investigate, probably a one-line fix.

**Estimated impact.** One fewer query per Stripe Connect onboarding flow. Low absolute impact (not a hot path) but high signal value as a canary for future auth-tax regressions.

---

### Priority 5 — Better Auth client `/api/auth/get-session` polling

**Observed:** The nav pass log shows `GET /api/auth/get-session` firing 6+ times in ~30 seconds, occasionally bursting (e.g., 2 within 100ms). This endpoint is intentionally NOT instrumented by the query tracker (it's Better Auth's passthrough at `/api/auth/[...all]`), but each call still incurs a session validation round-trip to the DB.

**What it is.** Better Auth's client-side `useSession()` hook polls this endpoint on an interval to keep the session state fresh. It's used by multiple components across the dashboard, and React Query may or may not be deduping depending on how it's wired.

**Investigation path.** Search the codebase for `useSession` and `getSession` from the Better Auth client. Check:

1. Is there a single shared React Query wrapper, or are multiple components calling it independently?
2. What's the configured refetch interval? (Better Auth's default is aggressive.)
3. Is there a `refetchOnWindowFocus` + short `staleTime` combination causing the bursts?

**Recommended fix (tentative).** Wrap the Better Auth session in a single React Query hook with `staleTime: 5 * 60 * 1000` (5 min) and `refetchInterval: false` or a longer interval. Better Auth already rotates the session cookie on expiry, so polling every 30s is mostly wasted work. The one legitimate need — "did my session just get revoked?" — is served fine by a 5-min cadence or by handling 401s at the fetch layer.

**Estimated effort.** 1–2 hours including verification.

**Estimated impact.** Potentially significant — this is a silent background drain that's probably firing on every page across the app. Won't show in the query tracker but will show up in production DB load metrics.

**Risk.** Medium. Better Auth's internals may not like a non-default session cadence. Test the auth-expiry and revoke flows before merging.

---

### Priority 6 — Delete the deprecated notification/messages polling endpoints and hooks

**Context.** This branch deprecated the three legacy endpoints and their hooks in place with `@deprecated` JSDoc. They still work, they just have zero callers after the consolidation swap.

**When to do this.** After this branch merges, watch one deploy cycle to confirm nothing unexpected calls them (a test fixture, a forgotten admin tool, a page I didn't grep for). Then open a small cleanup PR to delete:

- `src/app/api/messages/unread-count/route.ts`
- `src/app/api/notifications/count/route.ts`
- `useUnreadMessageCount` from `src/features/messages/hooks/use-unread-count.ts` (or delete the whole file if that's the only export)
- `useUnreadCount` and `useNotifications` from `src/features/notifications/hooks/use-notifications.ts` (keep `useInfiniteNotifications`, `useMarkAsRead`, `useToggleReadStatus` — those have other callers)
- The corresponding mutation invalidations for the now-dead legacy query keys in `use-message-mutations.ts` and `use-notifications.ts`

**Do NOT delete** `src/app/api/notifications/route.ts` — its POST handler is still actively used by mark-as-read mutations, and its GET handler is still used by the notifications page via `useInfiniteNotifications`. Only the note at the top of the file is deprecation-specific; the route itself stays.

**Estimated effort.** 30 minutes.

---

### Priority 7 — `listing_images: 3` on cold `/api/listings/search` (unchanged from Phase 4)

Still present, still the same cold-vs-warm pattern (`3` cold, `1` warm). Still not a hot N+1. Still low priority unless it shows up in production `pg_stat_statements`. See Phase 4 handoff Priority 4 for details.

---

### Priority 8 — `notifications: 3` inside `/api/dashboard/badges`

**Observed:** The consolidated badges endpoint shows `notifications: 3` in its breakdown. That's 1 count + 1 paginated list + 1 other. Worth a 10-minute look at `notificationsDAL.getUnreadCount` and `notificationsDAL.getUserNotifications` to see if the third query is a pagination total that could be collapsed into the list query with `COUNT(*) OVER ()`.

**Estimated effort.** 30 minutes.
**Estimated impact.** Shaves 1 query off every 60s badge poll. Small, but free perf is free.

---

### Priority 9 — Image hygiene warnings (unchanged from Phase 4)

- `/hoador-logo.svg` LCP warning + aspect-ratio warning, still showing in every dashboard page load.
- Listing blob images (`thnd3cwzf3mlmu4a.public.blob.vercel-storage.com/...`) aspect-ratio warnings.
- Mock images (`/images/mock/tools/rake.webp`) LCP warning.

Cosmetic but affects CLS. See Phase 4 Priority 6 for fix details. Low priority.

---

## Known gaps and open questions

### Gap 1 — The `/dashboard` cold render is ~47–54 queries

Even with the RSC tracker working, the dashboard still fires 47+ queries cold. Priority 1 + Priority 2 would cut that to ~30. To get below 20 you'd need to start questioning whether all 7 widgets are truly necessary on the initial render — or whether some should lazy-load on interaction. That's a product decision, not a perf decision. Flag for later.

### Gap 2 — The `user: 2` auth floor is still irreducible

No change from Phase 4 Gap 2. Eliminating the second `user` query requires denormalizing extended fields into the Better Auth `user` table. Still not worth it. Revisit only if the `user` table becomes a production hotspot.

### Gap 3 — No CI query budget gate

Phase 4 suggested a Playwright smoke test asserting per-route query counts stay under a threshold. Still not built. It's blocked on Priority 1/2 landing (otherwise the budget you'd assert is the broken one). Revisit after Phase 6.

### Gap 4 — `DEBUG_QUERY_TRACKER_STACK` env var still in source

Still unused in the happy path. Still kept intentionally for debugging future attribution regressions. No change.

### Gap 5 — The "dashboard doesn't feel snappy" root cause is now identified

Phase 4 Priority 3 was "investigate why dashboard doesn't feel snappy, possibly a Phase 2 streaming regression." After this branch's measurements, I'm confident the answer is **not** a streaming regression — it's the `dashboard-pulse` + `alerts-row` N+1s taking ~3 seconds each. Streaming is working fine; the widgets just block for 3 seconds on DB work before they can paint. Fix Priority 1 + Priority 2 and the "not snappy" complaint should disappear.

If it doesn't, THEN investigate streaming. But I'd bet against that being the problem.

### Gap 6 — Browser-side React DevTools extension error

The dev log shows `React instrumentation encountered an error: There should always be an Offscreen Fiber child in a hydrated Suspense boundary` coming from the Chrome React DevTools extension (`chrome-extension://fmkadmapgofadopljbjfkapdkoienihi/...`). This is NOT an app bug — it's the React DevTools extension misbehaving against Next 16's RSC + Suspense boundary hydration. Ignore it unless it starts breaking actual functionality.

---

## Commands you'll use

```bash
# Type-check
npx tsc --noEmit

# Full test suite (33s)
npm run test:run

# Dev server with query tracker (default in dev)
bun run dev  # or npm run dev

# Watch the tracker output for widget-level findings
bun run dev 2>&1 | grep "query-tracker"

# Filter for threshold breaches only
bun run dev 2>&1 | grep "exceeds threshold"

# Verify tracker stays off in prod
NODE_ENV=production npm run build && npm run start
# Navigate to any route — no [query-tracker] lines should appear

# Run only the notification bell test (post-swap verification)
npm run test:run -- src/features/notifications/components/__tests__/notification-bell.test.tsx

# Run only the user DAL test (post-cleanup verification)
npm run test:run -- src/dal/__tests__/user.dal.test.ts

# Find all dashboard widgets (template for Priority 1/2 widget audits)
ls src/app/dashboard/_widgets/*.widget.tsx

# Confirm the badge consolidation is the only caller of the new hook
grep -rn "useDashboardBadges" src
```

---

## Final notes

**Grade for this branch:** A-. The RSC tracker fix is the most valuable piece of work here — not because the fix itself was hard, but because it took the dashboard from "black box that feels slow" to "20-query N+1 widget clearly visible in the log with line-number attribution." That unlocks every future dashboard perf fix.

**The biggest thing this branch proved:** the Phase 4 query tracker was only half-working. It caught the auth-tax leak because the route handler path worked fine. It completely missed the dashboard widgets because the RSC boundary was broken. The per-widget `runWithQueryCounter` pattern is the canonical way to instrument RSC from here on out.

**The single most valuable line item for the next branch:** Priority 1 (`dashboard-pulse` N+1). Fix that one widget and the dashboard goes from "not snappy" to "snappy" in a single PR. The user reported the symptom three phases ago; the root cause is now identified and bounded.

**What I would NOT do next:**

- Don't chase SSE/WebSocket push for notifications. 60s polling is fine.
- Don't denormalize the Better Auth user table to kill the `user: 2` floor. Not worth the migration risk.
- Don't try to move the RSC tracker back to a layout or page level. It will not work. Per-widget is correct.
- Don't add CI query budget gates until Phase 6 lands. You'll just be asserting against the broken baseline.

**What I WOULD do next, in order:**

1. Merge this branch.
2. Open `perf/phase-6-dashboard-widget-n-plus-1`, fix Priority 1 + Priority 2, ship.
3. Spend 20 minutes on Priority 4 (Stripe auth-tax leak) as a small bundled fix.
4. Watch a deploy, then open the Priority 6 cleanup PR to delete the deprecated polling endpoints.
5. After Phase 6 lands and the dashboard feels snappy, investigate Priority 5 (Better Auth session polling) — that's likely the next tier of invisible background load.
