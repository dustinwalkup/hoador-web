# Implementation Tasks: Neighborhood Needs (MVP)

Tasks are ordered by dependency. Each task is sized to be completable in a
single focused session. Sub-tasks (`X.Y`) build incrementally on the parent.
Tests are co-located with the work that introduces them (TDD where practical).

References:

- [1-requirements.md](./1-requirements.md) — `R#` references below
- [2-design.md](./2-design.md) — `§#` section references below

---

## 1. Schema definitions (Drizzle)

- [x] **1.1 Add the three need enums to `_enums.ts`**
  - In [src/db/schemas/\_enums.ts](src/db/schemas/_enums.ts) add
    `needTypeEnum` (`rental`,`service`), `needStatusEnum` (`open`,`closed`),
    `needCloseReasonEnum` (`manual`,`booking`,`admin`)
  - _Requirements: R2.1, R2.6_ — _Design: §3.1, §4.1_

- [x] **1.2 Append new notification enum values**
  - Add `neighborhood_need_created`, `neighborhood_need_listing_created` to
    `notificationTypeEnum` and `neighborhood_needs` to
    `notificationCategoryEnum` in [src/db/schemas/\_enums.ts](src/db/schemas/_enums.ts)
  - _Requirements: R11.1, R12.1_ — _Design: §3.5, §5_

- [x] **1.3 Create `neighborhood-needs.schema.ts`**
  - New file `src/db/schemas/neighborhood-needs.schema.ts` with
    `neighborhoodNeeds` + `neighborhoodNeedListings` tables, relations, and
    inferred types (`NeighborhoodNeed`, `NewNeighborhoodNeed`,
    `NeighborhoodNeedListing`) exactly per design §3.1
  - Indexes: `neighborhood_needs(community_id, status)`,
    `neighborhood_needs(created_by_user_id)`,
    `neighborhood_need_listings(neighborhood_need_id)`, and UNIQUE
    `neighborhood_need_listings(listing_type, listing_id)`
  - _Requirements: R2.1, R2.2, R3.1, R3.2, R3.5_ — _Design: §3.1, §4.1, §4.2_

- [x] **1.4 Export new tables + relations from the schema barrel**
  - Verify [src/db/schemas/index.ts](src/db/schemas/index.ts) re-exports the new
    schema file so Drizzle query API + `db.query.neighborhoodNeeds` work
  - _Design: §3.1_

---

## 2. Database migrations

- [x] **2.1 Generate Migration A — enums + tables**
  - Run `bun run db:generate`; inspect the SQL against design §5 (3 new
    `CREATE TYPE`, 2 `CREATE TABLE`, indexes)
  - Hand-verify the partial/unique index DDL (Drizzle may not emit exactly as
    designed)
  - _Requirements: R2.1, R3.1, R3.2_ — _Design: §5_

- [x] **2.2 Write Migration B — notification enum additions (non-transactional)**
  - Separate migration file with
    `ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'neighborhood_needs'`
    and the two `notification_type` additions
  - **Must not run inside a transaction** (Postgres `ALTER TYPE ... ADD VALUE`
    restriction) — confirm the generated/edited file has no `BEGIN/COMMIT`
  - _Requirements: R11.1, R12.1_ — _Design: §3.1 (migration note), §5_

- [x] **2.3 Apply + smoke-check migrations on dev DB**
  - `bun run db:migrate`; confirm both tables + enum values exist
    (`\dT+ need_type`, `\d neighborhood_needs`)
  - _Design: §5_

---

## 3. Seed updates

- [x] **3.1 Seed a few sample needs (dev + e2e)**
  - In `src/db/seeds/*` add 2–3 `neighborhood_needs` (one rental, one service)
    anchored to seeded users/communities, plus one linked listing, so the feed
    renders locally and the e2e feed test has data
  - _Requirements: R5, R13_ — _Design: §5_

---

## 4. CommunityDAL extension

- [x] **4.1 Add `getUserIdsVisibleInCommunity`**
  - In [src/dal/community.dal.ts](src/dal/community.dal.ts): returns `string[]`
    of `user_id` from `community_visibility` where `community_id = X AND
is_visible = true` (fan-out audience)
  - Unit test in [src/dal/**tests**/community.dal.test.ts](src/dal/__tests__/community.dal.test.ts)
  - _Requirements: R12.2_ — _Design: §3.3_

---

## 5. NeighborhoodNeedsDAL

- [x] **5.1 Create the DAL with CRUD + close + soft-delete**
  - New `src/dal/neighborhood-needs.dal.ts` extending `BaseDAL`:
    `createNeed`, `getNeedById` (excludes `deleted_at`),
    `getNeedByIdIncludingDeleted`, `updateNeed`, `closeNeed(id, reason)`,
    `softDeleteNeed`
  - Register in the DAL barrel ([src/dal/index.ts](src/dal/index.ts))
  - Unit tests in `src/dal/__tests__/neighborhood-needs.dal.test.ts` (create,
    close is idempotent, soft-delete hides from `getNeedById`)
  - _Requirements: R2.5, R8.2, R8.5, R16.4_ — _Design: §3.2, §6_

- [x] **5.2 Add the visibility-aware feed query**
  - `listFeed(visibleCommunityIds, filters, pagination)` mirroring
    `searchListings`: viewer side `community_id = ANY(ids)`, creator side via
    `community_visibility` JOIN on `(created_by_user_id, community_id)` with
    `is_visible = true`; empty `ids` → empty result, no DB hit; newest-first;
    filters type/category/openOnly; `linkedListingCount` via LATERAL subquery
  - Unit tests: empty ids → empty (no query); creator `is_visible=false`/no row
    → excluded (fail-closed); community ∉ viewer set → excluded; both-visible →
    included once; each filter; sort order
  - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5, R5.7, R5.8_ — _Design: §3.2, §7.1_

- [x] **5.3 Add detail, my-needs, and pulse-count reads**
  - `getNeedDetail(id)` (need + linked listings via the join, polymorphic
    resolve to listing/service-listing title + href + isLive),
    `listNeedsByUser(userId, p)`, `countOpenVisibleNeeds(visibleCommunityIds)`
  - Unit tests for each
  - _Requirements: R6.1, R14.2_ — _Design: §3.2, §3.11_

- [x] **5.4 Add linking reads/writes**
  - `linkListing({ needId, listingType, listingId })`,
    `getLinkByListing(listingType, listingId)`,
    `findOpenNeedsLinkedToListing(listingType, listingId)`,
    `listLinkedListings(needId)`
  - Unit tests incl. UNIQUE `(listing_type, listing_id)` violation surfaces as
    `ConflictError`
  - _Requirements: R3.2, R3.3, R3.4, R9.4_ — _Design: §3.2_

---

## 6. NeighborhoodNeedsService

- [x] **6.1 `createNeed` + category/type validation + fan-out**
  - New `src/features/neighborhood-needs/services/neighborhood-needs-service.ts`
  - Resolve home community via `CommunityDAL.getPrimaryMembershipForUser`
    (ValidationError if none); validate `categoryId` against
    `listingDAL.getListingCategories()` (rental) or
    `serviceListingDAL.listCategories()` (service); validate date order; insert
  - Fire-and-forget `fanOutNewNeed(need)` in an `after()` block
    (`captureNonCriticalError`) — in-app to `getUserIdsVisibleInCommunity` minus
    creator, no email payload
  - Unit tests (mock `sendNotification`): no-primary → error; category/type
    mismatch → error; date-order → error; fan-out excludes creator
  - _Requirements: R2.3, R2.4, R4.4, R4.5, R4.6, R12.2, R12.7_ — _Design: §3.4, §6_

- [x] **6.2 `updateNeed`, `closeNeed`, `deleteNeed`**
  - Owner-or-admin guard (passed-in `isAdmin`); `updateNeed` rejects
    type/community change, re-validates category vs existing type, rejects
    closed/deleted; `closeNeed` idempotent with reason `manual`/`admin`;
    `deleteNeed` admin-only soft delete
  - Unit tests for each path
  - _Requirements: R7.1, R7.2, R7.3, R7.5, R8.1, R8.2, R8.5, R16.1, R16.3, R16.4_ — _Design: §3.4, §6_

- [x] **6.3 `linkListingToNeed` (listing-create hook)**
  - Best-effort: no-op if need missing/deleted/closed or not visible to creator
    or `listingType !== need.type`; swallow UNIQUE violation to a clean no-op
  - Unit tests: closed/invalid/type-mismatch → no-op; duplicate → no-op
  - _Requirements: R9.4, R9.6, R9.7, R9.8_ — _Design: §3.4_

- [x] **6.4 `notifyRequesterListingLive` (approval hook)**
  - Look up link by listing; if present, `sendNotification` to
    `need.createdByUserId` (type `neighborhood_need_listing_created`,
    deep-link to the listing); no link → no-op
  - Unit tests: link present → notifies; no link → no-op
  - _Requirements: R9.5, R11.2, R11.3_ — _Design: §3.4, §3.5_

- [x] **6.5 `closeNeedsFulfilledByBooking` (booking hook)**
  - `findOpenNeedsLinkedToListing`; close only needs where
    `createdByUserId === bookerUserId` (reason `booking`); stranger → no-op;
    multiple own needs → all close
  - Unit tests for all three cases
  - _Requirements: R10.1, R10.2, R10.3, R10.6_ — _Design: §3.4, §3.8_

---

## 7. Notification wiring

- [x] **7.1 Map new types → `neighborhood_needs` category**
  - Add both new types to `NOTIFICATION_TYPE_TO_CATEGORY` in
    [notification-type-map.ts](src/features/notifications/lib/notification-type-map.ts)
  - _Requirements: R11.1, R12.1_ — _Design: §3.5_

- [x] **7.2 Default channel matrix for the new category**
  - In [preference-service.ts](src/features/notifications/lib/preference-service.ts),
    ensure the `neighborhood_needs` category defaults to `inApp:true,
email:false, push:false` when no per-user preference row exists (absent row
    must read as default, not "all on")
  - Unit tests: `shouldSendEmail`/`shouldSendPush` return false by default for
    the new category; true once a user opts in
  - _Requirements: R12.3, R12.4_ — _Design: §3.5, §9_

---

## 8. API routes

- [x] **8.1 `POST /api/needs` (create) + `GET /api/needs` (feed)**
  - `src/app/api/needs/route.ts`; authenticated; Zod-validate create body;
    delegate to service. Feed: resolve `getCurrentUserVisibleCommunityIds()`,
    short-circuit empty → empty page, else `listFeed` with filters/pagination
  - Tests: create happy/validation-fail/no-primary; feed visibility +
    empty-set + filters; mock `@/features/auth/utils/session`
  - _Requirements: R4.1–R4.9, R5.1–R5.8_ — _Design: §3.6_

- [x] **8.2 `GET /api/needs/[id]` (detail)**
  - `src/app/api/needs/[id]/route.ts` GET; enforce visibility (creator/admin
    exempt, else 404 when not in visible set)
  - Tests: owner sees own; outside-network → 404; admin sees any
  - _Requirements: R6.1, R6.2_ — _Design: §3.6_

- [x] **8.3 `PATCH /api/needs/[id]` (edit) + `DELETE` (admin soft delete)**
  - Same route file; PATCH owner-or-admin; DELETE admin-only via
    `requireAdminResponse`
  - Tests: non-owner PATCH → 403; non-admin DELETE → 403; admin delete hides
  - _Requirements: R7.1, R7.4, R16.3, R16.4, R16.5_ — _Design: §3.6_

- [x] **8.4 `POST /api/needs/[id]/close`**
  - `src/app/api/needs/[id]/close/route.ts`; owner-or-admin; idempotent
  - Tests: owner closes; non-owner → 403; double-close → success no-op
  - _Requirements: R8.1, R8.5_ — _Design: §3.6_

---

## 9. Listing-create linking hook

- [x] **9.1 Thread `neighborhoodNeedId` into rental listing creation**
  - Add optional `neighborhoodNeedId` to the create body/Zod schema for
    `POST /api/listings`; pass through `ListingService.createListing(...)`
    ([listing-service.ts](src/features/listings/services/listing-service.ts),
    returns `{ listingId }`); after insert, call
    `linkListingToNeed({ neighborhoodNeedId, listingType:'rental', listingId,
creatorUserId: userId })`
  - Tests: valid open need → link row created; closed/invalid → listing created,
    no link
  - _Requirements: R9.1, R9.4, R9.6, R9.7_ — _Design: §3.4, §3.6_

- [x] **9.2 Thread `neighborhoodNeedId` into service listing creation**
  - Mirror 9.1 for `ServiceListingService.createListing(...)` (returns
    `{ listing }`) and its create route; `listingType:'service'`
  - Tests as in 9.1
  - _Requirements: R9.1, R9.4, R9.6, R9.7_ — _Design: §3.4, §3.6_

---

## 10. Listing-approval notify hook

- [x] **10.1 Rental approval → notify requester**
  - In [src/app/api/admin/listings/[listingId]/approve/route.ts](src/app/api/admin/listings/[listingId]/approve/route.ts),
    after the idempotency guard (post `updateApprovalStatus(...,'approved',...)`)
    add `NeighborhoodNeedsService.notifyRequesterListingLive('rental',
listingId).catch(captureNonCriticalError)`
  - Test: linked listing approval notifies the need creator; unlinked → no-op
  - _Requirements: R9.5, R11.2_ — _Design: §3.4, §9_

- [x] **10.2 Service listing approval → notify requester**
  - In `ServiceListingService.approveListing` (after
    `sendListingApprovedNotification`, before return) add the fire-and-forget
    `notifyRequesterListingLive('service', listingId)`
  - Test as in 10.1
  - _Requirements: R9.5, R11.2_ — _Design: §3.4, §9_

---

## 11. Booking-success auto-close hooks

- [x] **11.1 Rental approval → auto-close need**
  - In `RentalService.approveRentalRequest` `after()` block
    ([rental-service.ts](src/features/rentals/services/rental-service.ts)) add
    fire-and-forget `closeNeedsFulfilledByBooking({ listingType:'rental',
listingId: rentalRequest.listingId, bookerUserId: rentalRequest.renterId })`
    with `captureNonCriticalError`
  - Integration test: creator-renter approval closes the need; different renter
    leaves it open; a thrown hook does not fail the approval
  - _Requirements: R10.1, R10.2, R10.4, R10.7_ — _Design: §3.8_

- [x] **11.2 Service accept → auto-close need**
  - In `ServiceBookingService.acceptBooking` `after()` block
    ([service-booking-service.ts](src/features/services/services/service-booking-service.ts))
    add the equivalent with `listingType:'service', listingId: detail.listingId,
bookerUserId: detail.requesterId`
  - Integration test mirroring 11.1
  - _Requirements: R10.1, R10.2, R10.4, R10.7_ — _Design: §3.8_

---

## 12. Listing-create form pre-fill

- [x] **12.1 Pre-fill the rental create page from `searchParams`**
  - In [src/app/dashboard/listings/add/page.tsx](src/app/dashboard/listings/add/page.tsx)
    read `searchParams`, parse `{ needId, category, title, description }`, pass
    into `CreateListingClient` `initialValues` + a hidden `neighborhoodNeedId`
    threaded into the submit body
  - _Requirements: R9.2_ — _Design: §3.7_

- [x] **12.2 Pre-fill the service create page from `searchParams`**
  - Mirror 12.1 for [service create page](src/app/dashboard/services/listings/create/page.tsx)
    → `ServiceListingForm` `initial` prop + hidden `neighborhoodNeedId`
  - _Requirements: R9.2_ — _Design: §3.7_

---

## 13. React Query hooks

- [x] **13.1 Needs query/mutation hooks**
  - `src/features/neighborhood-needs/hooks/*`: `useNeedsFeed(filters)`,
    `useNeed(id)`, `useCreateNeed`, `useUpdateNeed`, `useCloseNeed`,
    `useDeleteNeed`; keys `["needs","feed",filters]` / `["needs",id]`; mutations
    invalidate feed + detail. No server actions.
  - Tests for cache invalidation
  - _Requirements: R4, R5, R7, R8_ — _Design: §3.10_

---

## 14. UI components

- [x] **14.1 Feed page + cards + filters**
  - `src/app/dashboard/needs/page.tsx` (heading **"What Your Neighbors Need"**)
    rendering `NeedsFeed` → `NeedCard` + `NeedFilters` (Rental/Service/Category/
    Open-Only, default-on); newest-first; card shows Type, Title, truncated
    Description, needed dates, created date, linked-listing count, View Details
  - Component tests
  - _Requirements: R1.2, R5.3, R5.4, R5.5, R5.6_ — _Design: §3.9_

- [x] **14.2 Need detail page**
  - `src/app/dashboard/needs/[id]/page.tsx` → `NeedDetail`: full fields + linked
    listings (deep links); non-owner+open → **Create Listing** CTA routing to the
    pre-filled create page (rental vs service); owner → Edit / Close; closed →
    read-only
  - Component tests for the owner/non-owner/closed branches
  - _Requirements: R6.1, R6.3, R6.4, R6.5, R9.1_ — _Design: §3.9_

- [x] **14.3 Create form + share success screen**
  - `src/app/dashboard/needs/new/page.tsx` → `CreateNeedForm` (Type drives
    category source; Title/Description required; optional dates; no photos/
    budget/tags). On success render `NeedShareSuccess` (Copy Link + `navigator.
share` guard, deep link to need)
  - Component tests incl. category source switching + share fallback
  - _Requirements: R4.1, R4.2, R4.3, R4.7, R13.1, R13.2, R13.3_ — _Design: §3.9_

- [x] **14.4 Shared-link gating**
  - Unauthenticated open of a need link → sign-in then return; authenticated
    out-of-network viewer → neutral "not available in your area" state (driven
    by the detail route's 404/visibility)
  - Test the out-of-network state render
  - _Requirements: R1.4, R13.4, R13.5_ — _Design: §3.6, §3.9_

- [x] **14.5 Reusable empty-state CTA**
  - `EmptyStateNeedCTA` ("Can't find what you need? … [Create Neighborhood
    Need]"); best-effort pre-seed of Type/Category from context
  - Mount in browse zero-results and empty category pages (rental + service)
  - Component test
  - _Requirements: R15.1, R15.2, R15.3, R15.4_ — _Design: §3.9_

---

## 15. Navigation & Dashboard Pulse

- [x] **15.1 Add nav item**
  - Add "Neighborhood Needs" → `/dashboard/needs` to `MAIN_NAV` in
    [navbar.ts](src/constants/navbar.ts); follows active-state conventions
  - _Requirements: R1.1, R1.2, R1.3_ — _Design: §3.11_

- [x] **15.2 Extend Pulse with open-needs count**
  - Add `needs: { open: number }` to `DashboardPulseData`
    ([types.ts](src/features/dashboard/types.ts)); in
    [pulse-data.ts](src/features/dashboard/lib/pulse-data.ts) add a `safe()`
    fetch (`getVisibleCommunityIds` → `countOpenVisibleNeeds`); render
    "Neighborhood Needs (N)" linking to the feed in
    [dashboard-pulse.tsx](src/features/dashboard/components/dashboard-pulse.tsx)
  - Tests for the count + render
  - _Requirements: R14.1, R14.2, R14.3, R14.4_ — _Design: §3.11_

---

## 16. E2E tests

- [x] **16.1 Post-a-need + feed visibility**
  - New `e2e/needs/*.spec.ts`: user posts a rental need → share screen → need
    appears in the feed; a user in a different (toggled-off) network does not see
    it
  - _Requirements: R5.1, R13_ — _Design: §7.4_

- [x] **16.2 Create-listing-from-need → notify → book**
  - Second seeded user opens the need → Create Listing (pre-filled) → submit →
    admin-approve (seed/helper) → requester gets the "listing created"
    notification → requester books the linked listing → need auto-closes
  - UI surface (need detail CTA, pre-fill params, owner vs. non-owner view,
    out-of-network 404) covered by `e2e/needs/needs.spec.ts`; the
    approve→notify→book→auto-close chain is covered by route integration tests
    (`src/app/api/admin/listings/[listingId]/approve/__tests__/route.test.ts`
    and `src/features/neighborhood-needs/services/__tests__/`)
  - _Requirements: R9, R10, R11_ — _Design: §7.4_

---

## 17. Pre-merge verification

- [x] **17.1 Run `bun run ci`** (type-check + lint + coverage tests + build)
  - **Result:** 319 test files, 4155 passed, 7 skipped — build green, no
    regressions
- [x] **17.2 EXPLAIN ANALYZE the feed query** against seeded dev DB; record
      p50/p95 in the PR; confirm the `(community_id, status)` and
      `community_visibility(user_id, community_id)` indexes are used
  - **p50 (warm): ~0.20ms · p95 (warm): ~0.40ms · cold first-run: 4.1ms**
  - **Indexes used:**
    - `neighborhood_needs_creator_idx` (`created_by_user_id`) — Nested Loop
      join from `community_visibility` → `neighborhood_needs`; the planner
      chose the creator-side path because it is the more selective first leg
      at current data size. The `neighborhood_needs_community_status_idx`
      (`community_id, status`) will engage when the needs table grows and
      the community-side becomes the cheaper leading scan.
    - `neighborhood_need_listings_need_idx` — Bitmap Index Scan used by the
      LATERAL linked-listing count; loops=N (one per result row, no N+1).
    - `community_visibility` — correctly seq-scanned at 152-row MVP scale;
      `community_visibility_user_community_idx` (UNIQUE) and the partial
      `community_visibility_user_visible_idx` are available for production
      scale.
  - **No N+1**: single query + LATERAL — one visible-set look-up + one feed
    scan; Pulse count reuses the same visible-set pre-computed by the route.
  - _Requirements: R-NFR Perf_ — _Design: §8_
- [ ] **17.3 Manual smoke** _(deferred to user)_ — post a need, fan-out
      notification arrives in-app, create listing from need, approve, book,
      auto-close; verify empty-state CTA on a zero-result browse

---

## Requirements coverage matrix

| Requirement                       | Tasks                                      |
| --------------------------------- | ------------------------------------------ |
| R1 (nav / entry)                  | 8.1, 14.1, 14.4, 15.1                      |
| R2 (need model)                   | 1.1, 1.3, 2.1, 5.1, 6.1                    |
| R3 (linked-listing model)         | 1.3, 2.1, 5.4, 6.3                         |
| R4 (create)                       | 6.1, 8.1, 13.1, 14.3                       |
| R5 (feed, network-scoped)         | 5.2, 8.1, 14.1, 16.1                       |
| R6 (detail)                       | 5.3, 8.2, 14.2                             |
| R7 (edit)                         | 6.2, 8.3, 13.1                             |
| R8 (close)                        | 5.1, 6.2, 8.4                              |
| R9 (create listing from need)     | 6.3, 6.4, 9.1, 9.2, 10.1, 10.2, 12.1, 12.2 |
| R10 (auto-close on booking)       | 6.5, 11.1, 11.2                            |
| R11 (notify: listing created)     | 1.2, 6.4, 7.1, 10.1, 10.2                  |
| R12 (notify: new need, opt-out)   | 1.2, 4.1, 6.1, 7.1, 7.2                    |
| R13 (share flow)                  | 14.3, 14.4, 16.1                           |
| R14 (pulse)                       | 5.3, 15.2                                  |
| R15 (empty states)                | 14.5                                       |
| R16 (permissions)                 | 6.2, 8.3, 8.4                              |
| R-NFR (perf/reliability/security) | 5.2, 6.1, 6.5, 11.1, 11.2, 17.2            |

## Parallelization opportunities

After §1–§3 land (schema + migrations + seeds):

- §4 (CommunityDAL add) and §5 (NeighborhoodNeedsDAL) can proceed together.
- §7 (notification wiring) is independent of the DALs.

After §4–§5 land:

- §6 (service) → then §8 (routes), §9/§10/§11 (hooks) can run in parallel
  (different files).
- §12 (form pre-fill), §13 (RQ hooks), §14 (UI), §15 (nav/pulse) are mostly
  independent once the routes (§8) exist.

§16 (e2e) depends on the seed update (§3) and the UI (§14). §17 is last.

```

```
