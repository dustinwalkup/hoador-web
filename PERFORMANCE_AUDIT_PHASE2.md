# Second-Pass Performance Audit: HOADOR Marketplace

**Audit date:** 2026-04-16
**Context:** Post-optimization audit (after Phases 4-6 query work)
**Focus:** UX-level slowness, architectural inefficiencies beyond query count

---

## Table of contents

1. [Top 5 Remaining Bottlenecks](#top-5-remaining-bottlenecks-post-optimization)
2. [Why It Still Feels Slow](#why-it-still-feels-slow)
3. [High-Leverage Fixes](#high-leverage-fixes-biggest-ux-impact)
4. [React Query Improvements](#react-query-improvements-advanced)
5. [Architectural Improvements](#architectural-improvements-next-1-3-months)
6. [What NOT to Optimize Further](#what-not-to-optimize-further)

---

## Top 5 Remaining Bottlenecks (Post-Optimization)

### 1. No Server-to-Client Query Hydration (The "Double Fetch" Gap)

> **Status update (2026-06): largely resolved.** HydrateClient is now wired on
> mailbox, listings/rentals, listings/services, explore, and both
> rentals/services flow pages. Remaining unhydrated pages are low-traffic
> detail/admin pages. §2 (router.refresh) addressed by plans/007.

**Only 1 of ~30 dashboard pages** uses `HydrateClient` — the [mailbox page](src/app/dashboard/mailbox/page.tsx). Every other page that renders a client component with `useQuery` starts with a **cold cache**. The server fetches data for RSC rendering, then the client component mounts and immediately fires the same API call again.

The infrastructure exists ([server.tsx](src/lib/react-query/server.tsx) exports `getServerQueryClient` + `HydrateClient`) — it's just not wired up anywhere except mailbox.

**Affected high-traffic pages:**

- [Garage/Listings page](src/app/dashboard/listings/rentals/page.tsx) — `GarageClient` fires 4 parallel `useQuery` calls cold
- [Rentals flow](<src/app/dashboard/(rentals)/(flow)/rentals/[direction]/[status]/page.tsx>) — `RentalsClient` fires up to 12 conditional `useQuery` hooks, the active one starts cold
- Every service booking, payment, and explore page

**Impact:** Users see skeleton/loading state for 200-500ms on every navigation to these pages, even though the server already had the data.

### 2. `router.refresh()` Used as Primary State Sync (14 Call Sites)

Found **14 `router.refresh()` calls** across the codebase. Each one triggers a full server-side re-render of the entire page tree:

- [rental-card.tsx:469](src/features/rentals/components/renting-lending/rental-card.tsx#L469) — after review
- [rental-actions.tsx:93,97](src/features/rentals/components/detail-page/rental-actions.tsx#L93) — after instructions update, status change
- [retry-deposit-button.tsx:26](src/features/rentals/components/detail-page/retry-deposit-button.tsx#L26) — after deposit retry
- [service-listing-form.tsx:173,201](src/features/services/components/service-listing-form.tsx#L173) — after create/update
- [service-booking-flow.tsx:227](src/features/services/components/service-booking-flow.tsx#L227) — after booking
- [service-booking-detail-client.tsx:328](src/features/services/components/service-booking-detail-client.tsx#L328) — refresh helper
- [service-provider-bio-form.tsx:57](src/features/services/components/service-provider-bio-form.tsx#L57) — after bio update
- [admin-service-listings-review.tsx:205](src/features/services/components/admin-service-listings-review.tsx#L205) — after mutation
- [use-rental-mutations.ts:127](src/features/rentals/hooks/use-rental-mutations.ts#L127) — after rental action
- [renting-card.tsx:201](src/components/rentals/renting-card.tsx#L201) — after review
- [legal-document-upload-form.tsx:92](src/features/admin/components/legal-document-upload-form.tsx#L92) — after upload

Each `router.refresh()` re-executes auth, re-runs all server queries, and re-streams the full page. On a detail page with 5-10 queries, this adds 300-800ms of "nothing happening" after a user action.

### 3. No Global Navigation Feedback

There is **no loading indicator during route transitions**. No NProgress bar, no `useTransition`-based pending state (only 1 file uses `useTransition` — [favorites-button.tsx](src/features/listings/components/favorites-button.tsx)), no navigation spinner.

When a user clicks a sidebar link, the old page stays frozen until the new RSC completes server-side rendering. With `force-dynamic` on every dashboard page, that means 170-350ms of **zero visual feedback** on every navigation.

### 4. Animation Delays Compound with Data Delays

[AnimatedSection](src/components/animation-section.tsx) wraps most dashboard widgets with `initial="hidden"` (opacity: 0, y: 18) and delays up to 0.1s + 0.45s animation duration. When a widget streams in after a Suspense boundary resolves:

1. Widget data arrives (170-350ms server time)
2. Skeleton disappears
3. Content is invisible (opacity: 0)
4. Animation plays (delay + 450ms)

Total perceived time: server wait + animation delay. The animation **fights the streaming benefit** — content is ready but the user can't see it yet. The `whileInView` trigger with `viewport.margin: "-40px"` also means above-fold widgets may not animate until the user scrolls slightly.

### 5. Missing `loading.tsx` on High-Traffic Routes

Only **5 routes** have `loading.tsx` files, all for detail/form pages:

- `listings/[id]/loading.tsx`
- `rental/[id]/loading.tsx`
- `listings/[id]/edit/loading.tsx`
- `listings/add/loading.tsx`
- `favorites/loading.tsx`

Missing from the highest-traffic routes:

- `/dashboard` (main dashboard)
- `/dashboard/rentals/[direction]/[status]` (rental flow)
- `/dashboard/listings/rentals` (garage)
- `/dashboard/listings/services` (services garage)
- `/dashboard/mailbox` (messages)

Without `loading.tsx`, Next.js cannot show instant loading UI during server-side rendering. The user sees the previous page frozen until the new page is fully ready.

---

## Why It Still Feels Slow

The backend is fast (170-350ms). The problem is **everything between the click and the pixels**:

1. **Click sidebar link** → nothing happens visually (no loading indicator)
2. **Server renders** → 170-350ms, user stares at frozen old page
3. **Page arrives** → client components mount with empty React Query cache
4. **Queries fire** → another 200-500ms round-trip to API routes for data the server already had
5. **Data arrives** → content renders but hidden behind `AnimatedSection` (opacity: 0)
6. **Animation plays** → 100-450ms more before visible

**Total perceived latency: 500ms-1.5s**, of which only 170-350ms is actual server time. The rest is architectural overhead: missing hydration, missing loading states, and cosmetic animation delays.

After a mutation (approve rental, leave review), `router.refresh()` replays the entire cycle. The user clicks a button, it succeeds, then the page goes "blank" for 300-800ms while the server re-renders everything.

---

## High-Leverage Fixes (Biggest UX Impact)

### Fix 1: Add a Global Navigation Progress Indicator (1-2 hours)

Add a thin top-bar progress indicator using Next.js router events or `useTransition`. This is the single highest-ROI change — it converts "is the app broken?" into "the app is loading."

Options:

- `next-nprogress-bar` (drop-in, ~5 min)
- Custom `useTransition` wrapper on `<Link>` components in sidebar
- CSS-only animation triggered by a React context that tracks pending navigations

### Fix 2: Wire Up `HydrateClient` on 4-5 Core Pages (4-6 hours)

The pattern already works on mailbox. Apply it to:

- **Garage page** — prefetch active/pending/inactive listings server-side, hydrate into `GarageTabsClient`
- **Rentals flow** — prefetch the active tab's data server-side based on URL params
- **Listing detail** — prefetch listing data server-side
- **Service bookings** — prefetch booking list

This eliminates the client-side "cold query" flash on the most-visited pages.

### Fix 3: Replace `router.refresh()` with Targeted Invalidation (3-4 hours)

Most `router.refresh()` calls sit next to React Query mutations that already invalidate the right keys. The refresh is redundant for client data and harmful for perceived speed. Replace with:

```ts
// Instead of:
onSuccess: () => router.refresh();

// Use:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: rentalKeys.detail(rentalId) });
};
```

For cases where RSC-rendered data must update (e.g., server-rendered status badges), use `router.refresh()` only after a `startTransition` wrapper so the old UI stays interactive.

### Fix 4: Add `loading.tsx` to Top 5 Routes (1-2 hours)

Create skeleton-based `loading.tsx` files for:

- `/dashboard/`
- `/dashboard/rentals/[direction]/[status]/`
- `/dashboard/listings/rentals/`
- `/dashboard/listings/services/`
- `/dashboard/mailbox/`

These enable Next.js instant loading states — the skeleton appears immediately on navigation while the server renders.

### Fix 5: Tame Animation Timing (30 min)

In [AnimatedSection](src/components/animation-section.tsx):

- Reduce duration from 0.45s to 0.2-0.25s
- Remove staggered delays on above-fold widgets (delay 0 for everything in first viewport)
- Consider `layout` animation instead of `whileInView` for dashboard widgets that stream in via Suspense — they should animate once on arrival, not wait for viewport intersection

---

## React Query Improvements (Advanced)

### Prefetch on Hover is Underutilized

Prefetch hooks exist for [conversations](src/features/messages/hooks/use-conversations.ts#L53), [rentals](src/features/rentals/hooks/use-rentals.ts#L163), [listings](src/features/listings/hooks/use-listings.ts#L127), and [garage](src/features/listings/hooks/use-garage.ts#L165). But only [ConversationsList](src/features/messages/components/conversations-list.tsx) actually wires prefetch to `onMouseEnter`.

Wire prefetch to hover/focus on:

- Rental cards (prefetch rental detail on hover)
- Listing cards in garage (prefetch listing detail on hover)
- Sidebar nav items (prefetch route data on hover — more ambitious)

### Rentals Page: 12 Hook Declarations, 1 Active

[RentalsClient](src/features/rentals/components/renting-lending/rentals-client.tsx) declares 12 separate `useQuery` hooks with `enabled` flags. Only 1 fires at a time. This is correct functionally, but:

- All 12 hooks register with React Query on every render
- Tab switching triggers a full `router.push()` → server re-render → cold client mount
- The previous tab's cached data is lost on navigation because it's a new page render

**Better pattern:** Keep the client component mounted across tab changes using query params instead of path segments, or use `shallow: true` routing. This preserves the React Query cache across tabs and makes switching instant after first load.

### staleTime Inconsistency Creates Refetch Surprises

Default `staleTime` is 5 minutes, but individual hooks override it:

- Conversations: 30s
- Garage listings: 30s-5min depending on tab
- Admin metrics: 30s

When a user navigates away and back within 30s-5min, some data refetches and some doesn't. This creates inconsistent "flash of loading" behavior. Consider standardizing around 2-3 tiers (real-time: 30s, interactive: 2min, static: 5min) and documenting which tier each query belongs to.

### Missing Optimistic Updates on Mutations

Most mutations use `queryClient.invalidateQueries` + `router.refresh()`. For actions where the outcome is deterministic (approve rental, mark read, archive conversation), optimistic updates via `onMutate` would make the UI respond instantly.

---

## Architectural Improvements (Next 1-3 Months)

### 1. Rethink RSC ↔ React Query Boundary

The current pattern is: RSC fetches data → renders widgets → client components inside widgets fire `useQuery` to the **same API routes** the RSC could have called directly. This is the root cause of the double-fetch problem.

Long-term, adopt one of:

- **RSC-first:** RSC fetches everything, passes as props, client components are pure renderers. Remove `useQuery` from pages that don't need client-side refetching.
- **Hydration-first:** RSC prefetches into server QueryClient, dehydrates to client. Client components read from cache (instant) and refetch in background. This is the TanStack-recommended pattern and the infrastructure is already in [server.tsx](src/lib/react-query/server.tsx).

The mailbox page proves pattern B works. Scale it.

### 2. Route-Level Code Splitting for Heavy Client Components

`framer-motion` ships to every page that uses `AnimatedSection` (which is the entire dashboard). Consider:

- `next/dynamic` for `AnimatedSection` with `ssr: false` — renders immediately without animation on server, animates on client
- Dynamic import for Stripe components (only needed on payment pages)
- Dynamic import for admin-only components

### 3. Partial Prerendering (PPR) Evaluation

Next.js 16 supports PPR. The dashboard layout (sidebar, header) is identical for all users — only the widget content varies. With PPR:

- Shell (sidebar + header + skeletons) serves from edge cache instantly
- Widget content streams in from the server

This could eliminate the 170-350ms server wait for the initial paint entirely. Requires removing `force-dynamic` from the layout and using Suspense boundaries (already in place) as the static/dynamic split points.

---

## What NOT to Optimize Further

### Query Count (Diminishing Returns)

31 queries for a full dashboard with 7 widgets averaging 4.4 queries each is reasonable. The remaining queries are legitimate data needs. Don't chase single-digit reductions — focus on perceived speed.

### Polling Interval

60s for badges is the right cadence. Don't go lower (waste) or higher (stale badges).

### Auth Floor

3 queries per request is the irreducible minimum without schema migration. Not worth touching.

### RSC Widget Architecture

Per-widget `runWithQueryCounter` + `WidgetBoundary` + `Suspense` is the correct pattern. Don't consolidate widgets or remove boundaries — the isolation is valuable for streaming and error containment.

### Server Actions Migration

The app uses API route handlers exclusively. Migrating to Server Actions would be a large refactor with marginal performance benefit for this use case (the auth overhead is the same either way). Not worth it unless you're adding new features that naturally fit the pattern.
