# Test Plan: Neighborhood Needs (MVP)

## Requirements Traceability

This test plan verifies Neighborhood Needs across every surface it touches:
schema/migrations, the new DAL + service, notification wiring, API routes, the
three integration hooks (listing-create, listing-approval, booking-success),
UI, navigation, and the dashboard Pulse. The central behaviors to prove are:

1. **Network-scoped visibility** — a need surfaces under the _same_ symmetric
   `community_visibility` rule as a listing (creator + viewer both visible in
   the need's home community; missing row = fail-closed).
2. **Demand→supply linkage** — a listing created from a need links back, and the
   requester is notified only when the listing goes _live/approved_.
3. **Creator-only auto-close** — a need closes only when _its creator_ books a
   linked listing; a stranger's booking leaves it open.
4. **Opt-out, no-spam notifications** — new-need fan-out is in-app by default
   (email off, push opt-in), and never blocks or fails the create.
5. **Non-critical hooks** — fan-out, auto-close, and notify-on-approval can fail
   without failing the host money operation.

References:

- [1-requirements.md](./1-requirements.md) — `R#` references
- [2-design.md](./2-design.md) — `§#` references
- [3-tasks.md](./3-tasks.md) — task numbering

### Test Coverage Summary

- **Unit tests:** schema types, `NeighborhoodNeedsDAL` methods, the
  `NeighborhoodNeedsService` orchestration + validation, notification-preference
  defaults, React Query hooks, components
- **Integration tests:** API route handlers (DAL → service → route), the three
  cross-feature hooks (link-on-create, notify-on-approval, auto-close-on-book),
  fan-out, run against the real test DB
- **E2E tests:** post-a-need + feed visibility; create-listing-from-need →
  notify → book → auto-close
- **Performance tests:** `EXPLAIN ANALYZE` budget on the feed query, single
  visible-set computation (no N+1), Pulse count reuse
- **Schema/migration tests:** table + enum creation, the non-transactional enum
  split, the `(listing_type, listing_id)` unique constraint, soft-delete + FK
  cascade

### Frameworks

- **Unit / integration:** Vitest (existing config)
- **Component:** Vitest + Testing Library + happy-dom (existing pattern)
- **E2E:** Playwright (existing config)
- **DB tests:** real Postgres against the test DB (existing pattern in
  [src/dal/**tests**/](src/dal/__tests__/))
- **Route tests** mock `@/features/auth/utils/session`, **not**
  `@/lib/api/route-helpers` (per CLAUDE.md)

---

## Test Types

### Unit Tests

#### DAL — `NeighborhoodNeedsDAL` CRUD (task 5.1)

- [ ] `createNeed` — inserts with `status='open'`, returns the row
- [ ] `getNeedById` — returns the row; returns `null` for a soft-deleted need
- [ ] `getNeedByIdIncludingDeleted` — returns a soft-deleted need (admin path)
- [ ] `closeNeed(id, reason)` — sets `status='closed'`, `close_reason`,
      `closed_at`; **idempotent** (closing a closed need is a no-op success)
- [ ] `softDeleteNeed` — sets `deleted_at`; row then absent from `getNeedById`
      and from the feed
- _Requirements: R2.5, R8.2, R8.5, R16.4_

#### DAL — Feed query (`listFeed`, task 5.2) — the visibility hot path

- [ ] Empty `visibleCommunityIds` → empty paginated result with **no DB call**
      (verified via spy)
- [ ] Need whose `community_id` is **not** in the viewer's visible set →
      excluded (even when the creator is visible in other shared communities)
- [ ] Need whose **creator** has `is_visible=false` for the need's
      `community_id` → excluded; creator with **no** visibility row for that
      community → also excluded (fail-closed)
- [ ] Need whose `community_id` is in the viewer's set **and** whose creator is
      visible there → returned exactly once
- [ ] Filters: `type` (Rental/Service), `categoryId`, `openOnly` (default-on
      excludes closed; off includes closed)
- [ ] Soft-deleted needs never appear regardless of filters
- [ ] Sort: newest-first (`created_at DESC`)
- [ ] `linkedListingCount` reflects the number of join rows for each need
- [ ] Pagination (page, limit, total) correct
- _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5, R5.7, R5.8_

#### DAL — Detail / my-needs / pulse count (task 5.3)

- [ ] `getNeedDetail` — returns need + linked listings (polymorphic title +
      href + `isLive`); `null` for missing/deleted
- [ ] `listNeedsByUser` — paginated, the user's own needs (incl. closed)
- [ ] `countOpenVisibleNeeds(visibleIds)` — counts open, non-deleted, both-sides-
      visible needs; `[]` → 0 with no DB hit
- _Requirements: R6.1, R14.2_

#### DAL — Linking (task 5.4)

- [ ] `linkListing` — creates a join row; **UNIQUE `(listing_type, listing_id)`**
      violation surfaces as `ConflictError` (a listing belongs to ≤1 need)
- [ ] `getLinkByListing(type, id)` — returns the row or `null`
- [ ] `findOpenNeedsLinkedToListing(type, id)` — returns only open, non-deleted
      needs linked to that listing
- [ ] `listLinkedListings(needId)` — returns all links for a need
- _Requirements: R3.2, R3.3, R3.4, R9.4_

#### DAL — `CommunityDAL.getUserIdsVisibleInCommunity` (task 4.1)

- [ ] Returns `user_id[]` where `is_visible=true` for the community
- [ ] Excludes `is_visible=false` rows; empty community → `[]`
- _Requirements: R12.2_

#### Service — `createNeed` + validation + fan-out (task 6.1)

- [ ] Happy path: resolves home community, inserts, returns need
- [ ] No primary community → `ValidationError` (R2.4) before any insert
- [ ] `categoryId` not in the table implied by `type` → `ValidationError`
      (rental id given for a service need, and vice-versa)
- [ ] `neededEndDate` before `neededStartDate` → `ValidationError`
- [ ] Fan-out (mock `sendNotification`): called for every
      `getUserIdsVisibleInCommunity` recipient **except the creator**
- [ ] Fan-out failure does **not** fail `createNeed` (mock throws →
      `captureNonCriticalError`, need still returned)
- _Requirements: R2.3, R2.4, R4.4, R4.5, R4.6, R12.2, R12.7_

#### Service — `updateNeed` / `closeNeed` / `deleteNeed` (task 6.2)

- [ ] `updateNeed`: owner or admin only; rejects `type` and `community` change;
      re-validates `categoryId` against the existing `type`; rejects when the
      need is closed or deleted
- [ ] Non-owner non-admin update → 403-mapped error
- [ ] `closeNeed`: owner/admin; `close_reason='manual'` (owner) /
      `'admin'` (admin); idempotent
- [ ] `deleteNeed`: admin-only soft delete; non-admin rejected; linked rows
      preserved
- _Requirements: R7.1, R7.2, R7.3, R7.5, R8.1, R8.2, R8.5, R16.1, R16.3, R16.4_

#### Service — `linkListingToNeed` (task 6.3)

- [ ] Valid open need visible to creator → link created
- [ ] No-op (listing still created) when the need is missing / deleted / closed
- [ ] No-op when the need is not visible to the creator
- [ ] No-op when `listingType !== need.type`
- [ ] Duplicate link (UNIQUE violation) swallowed to a clean no-op
- _Requirements: R9.4, R9.6, R9.7, R9.8_

#### Service — `notifyRequesterListingLive` (task 6.4)

- [ ] Link present → `sendNotification` to `need.createdByUserId`, type
      `neighborhood_need_listing_created`, deep-link to the **listing**
- [ ] No link for the listing → no-op (no notification)
- _Requirements: R9.5, R11.2, R11.3_

#### Service — `closeNeedsFulfilledByBooking` (task 6.5)

- [ ] Booker **is** the need creator → need closes with `close_reason='booking'`
- [ ] Booker is **not** the creator → **no-op** (need stays open)
- [ ] Creator books a listing linked to several of _their own_ open needs → all
      close
- [ ] Listing linked to no open need → no-op
- _Requirements: R10.1, R10.2, R10.3, R10.6_

#### Notification preference defaults (task 7.1–7.2)

- [ ] Both new types map to the `neighborhood_needs` category in
      `NOTIFICATION_TYPE_TO_CATEGORY`
- [ ] With **no** preference row, `shouldSendEmail(user, 'neighborhood_needs')`
      → `false` and `shouldSendPush(...)` → `false` (absent row reads as the
      default, not "all on")
- [ ] After a user opts in, push/email return `true`
- _Requirements: R12.1, R12.3, R12.4_

#### Components (tasks 14.1–14.5)

- [ ] `NeedCard` — renders Type, Title, truncated Description, needed dates,
      created date, linked-listing count, "View Details"
- [ ] `NeedFilters` — Rental/Service/Category/Open-Only; Open-Only default-on
- [ ] `NeedDetail` — non-owner + open → "Create Listing" CTA (routes to the
      pre-filled create page for the right type); owner → Edit / Close; closed →
      read-only, no CTA
- [ ] `CreateNeedForm` — selecting Rental vs Service switches the Category source
      (`listing_categories` vs `service_listing_categories`); Title/Description
      required; date-order validation; no photo/budget/tag inputs
- [ ] `NeedShareSuccess` — Copy Link always shown; Native Share only when
      `navigator.share` exists; both target the need deep link
- [ ] `EmptyStateNeedCTA` — renders the copy + CTA; best-effort pre-seed of
      Type/Category from context
- _Requirements: R5.5, R6.3, R6.4, R6.5, R4.1, R4.2, R4.7, R13.1–R13.3, R15_

#### React Query hooks (task 13.1)

- [ ] `useNeedsFeed(filters)` / `useNeed(id)` — stable query keys
- [ ] `useCreateNeed` — invalidates the feed on success
- [ ] `useUpdateNeed` / `useCloseNeed` — invalidate feed + the affected detail
- [ ] `useDeleteNeed` — invalidates feed
- _Requirements: R4, R5, R7, R8_

---

### Integration Tests

#### API Routes (real test DB; mock session module)

- [ ] **`POST /api/needs`** (task 8.1)
  - 401 unauthenticated
  - 400 on invalid body / bad category-for-type / date-order
  - 400 (ValidationError) when the user has no primary community
  - 201/200 happy path; DB row exists with `status='open'`,
    `community_id` = creator's primary
- [ ] **`GET /api/needs`** (task 8.1)
  - 401 unauthenticated
  - Returns only needs visible to the viewer (both-sides visible); a need from a
    toggled-off community is absent
  - Empty visible set → empty page (no DB hit)
  - Filters (type/category/openOnly) applied
- [ ] **`GET /api/needs/[id]`** (task 8.2)
  - Creator sees own need; admin sees any
  - Viewer outside the need's visible set → 404
- [ ] **`PATCH /api/needs/[id]`** (task 8.3)
  - Owner edits allowed; non-owner → 403; type/community change rejected
- [ ] **`DELETE /api/needs/[id]`** (task 8.3)
  - Non-admin → 403; admin soft-deletes (need then 404s for non-admins; link
    rows preserved)
- [ ] **`POST /api/needs/[id]/close`** (task 8.4)
  - Owner closes; non-owner → 403; double-close → success no-op

#### Hook — listing-create linking (tasks 9.1–9.2)

- [ ] `POST /api/listings` with a valid `neighborhoodNeedId` (open need) → link
      row created; listing still created on its own merits
- [ ] With a closed / invalid / non-visible `neighborhoodNeedId` → listing
      created, **no** link row (best-effort)
- [ ] Service-listing create mirrors both cases with `listingType='service'`
- _Requirements: R9.1, R9.4, R9.6, R9.7_

#### Hook — notify-on-approval (tasks 10.1–10.2)

- [ ] Approving a rental listing
      ([approve route](src/app/api/admin/listings/[listingId]/approve/route.ts))
      that is linked to a need → the need's creator receives
      `neighborhood_need_listing_created`; an unlinked listing → no extra
      notification
- [ ] `ServiceListingService.approveListing` on a linked service listing →
      requester notified; unlinked → no-op
- [ ] A still-pending or rejected listing → **no** requester notification
      (notification only on the live/approved transition)
- _Requirements: R9.5, R11.2_

#### Hook — auto-close on booking (tasks 11.1–11.2)

- [ ] `RentalService.approveRentalRequest` where the **renter is the need
      creator** on a linked listing → the need auto-closes
      (`close_reason='booking'`)
- [ ] Same approval where the renter is a **different** user → need stays open
- [ ] `ServiceBookingService.acceptBooking` mirrors both cases via
      `detail.requesterId`
- [ ] **Reliability:** a thrown auto-close hook (mock the service to throw) does
      **not** fail or roll back the rental approval / service accept
- _Requirements: R10.1, R10.2, R10.4, R10.7_

#### Fan-out (task 6.1, integration)

- [ ] Creating a need dispatches in-app notifications to the visible-community
      audience minus the creator; with the default category matrix, no email is
      sent and push only to opt-in users
- [ ] Creating a need with a large audience does not block the create response
      (dispatched in `after()`)
- _Requirements: R12.2, R12.3, R12.7_

#### Pulse integration (task 15.2)

- [ ] `getDashboardPulseData` returns `needs.open` = count of open needs visible
      to the user; reuses the single visible-set computation
- [ ] A sub-fetch failure degrades to `0` (existing `safe()` pattern), not a
      thrown Pulse
- _Requirements: R14.1, R14.2, R14.4_

---

### E2E Tests (Playwright)

#### Post-a-need + feed visibility (task 16.1)

- [ ] A user posts a **rental** need (Type, Category, Title, Description) → lands
      on the share screen → the need appears in `/dashboard/needs`
- [ ] A second user in the **same** network sees the need in the feed
- [ ] A user whose network does **not** include the need's home community (or who
      toggled it off) does **not** see the need
- _Requirements: R4, R5.1, R13_

#### Create-listing-from-need → notify → book → auto-close (task 16.2)

- [ ] A provider opens the need → "Create Listing" → the create form is
      pre-filled (Type fixed, Category/Title/Description suggested) → submits
- [ ] Admin approves the listing (seed/test helper) → the requester receives the
      "listing created" in-app notification deep-linking to the listing
- [ ] The **requester** books the linked listing → the need auto-closes and
      drops out of the active feed
- [ ] (Negative) a **different** user booking the same listing leaves the need
      open
- _Requirements: R9, R10, R11_

#### Regression sweep

- [ ] Existing listing creation, rental approval, and service accept flows are
      unaffected by the added hooks
- [ ] Empty-state CTA appears on a zero-result browse and routes to the create
      form

---

### Performance Tests

- [ ] **`EXPLAIN ANALYZE` the feed query** (task 17.2) against the seeded DB
  - p50 < 25ms, p95 < 50ms at MVP scale
  - Planner uses `neighborhood_needs(community_id, status)` (viewer-side filter +
    sort) and `community_visibility(user_id, community_id)` (creator-side point
    lookup)
- [ ] **No N+1** — a feed page issues one visible-set query + one feed query
      (with the LATERAL count), never a per-need visibility or count lookup
- [ ] **Pulse count** reuses the same visible-set computation (no extra
      per-need work)
- _Requirements: R-NFR Perf.1, Perf.3_

---

### Schema / Migration Tests

- [ ] **Migration A** creates `need_type` / `need_status` / `need_close_reason`
      and both tables with the designed indexes
- [ ] **Migration B is non-transactional** — the `ALTER TYPE ... ADD VALUE`
      statements run outside a transaction; re-running is safe
      (`ADD VALUE IF NOT EXISTS`)
- [ ] **UNIQUE `(listing_type, listing_id)`** on `neighborhood_need_listings`
      rejects a second link for the same listing
- [ ] **FK cascade** — deleting a need cascades to its `neighborhood_need_listings`
      rows; soft-delete (`deleted_at`) does **not** delete link rows
- [ ] **Soft delete** — a need with `deleted_at` set is excluded from feed,
      detail (non-admin), and the Pulse count
- _Requirements: R2.1, R3.1, R3.2, R16.4_

---

## Coverage Goals

Following project standards (AI-coding-standards.md: 80% baseline):

| Surface                            | Target                                    |
| ---------------------------------- | ----------------------------------------- |
| `NeighborhoodNeedsDAL`             | ≥ 90% lines (incl. the visibility path)   |
| `NeighborhoodNeedsService`         | ≥ 90% branches (validation + hook no-ops) |
| API route handlers                 | ≥ 80% lines                               |
| The three cross-feature hooks      | 100% of the added branches                |
| UI components (new)                | ≥ 75% lines                               |
| Notification preference defaults   | 100% (small surface)                      |
| Overall Neighborhood Needs feature | ≥ 85%                                     |

---

## Test Data Requirements

### Database fixtures

- ≥ 2 networks (reuse the existing KC Metro + Test Network seeds) so cross-
  network invisibility can be exercised
- ≥ 3 users: a need creator, a same-network provider, and an out-of-network
  user; plus an admin
- ≥ 2 seeded needs (one rental, one service) with one linked listing, anchored
  to seeded communities/users
- A community the creator is visible in but a test viewer has toggled off (to
  prove symmetric, fail-closed feed visibility)
- A user with **no** preference row for `neighborhood_needs` (to prove the
  default channel matrix) and one who has opted into push

### Mock / stub strategy

- **`sendNotification`** — mocked at its module boundary for service unit tests;
  real in integration tests asserting an in-app row was created
- **Session** — mock `@/features/auth/utils/session` in route tests (per
  CLAUDE.md), not the route-helpers
- **Stripe / payments** — not exercised by this feature; booking-hook tests stub
  the host service's success path and assert only the added side-effect
- **`navigator.share`** — present/absent toggled in component tests
- **DB** — real Postgres for DAL + integration; fully mocked at the hook level
  for component tests (existing pattern)

---

## BDD Scenarios

```gherkin
Feature: Post a neighborhood need
  As a renter or requester
  I want to post what I'm looking for
  So that nearby neighbors know there is demand

  Background:
    Given I am a verified member of "Foxcroft" in the "Kansas City Metro" network

  Scenario: Successfully post a need
    Given I am on /dashboard/needs/new
    When I choose type "Rental", category "Cleaning", title "Pressure washer",
        and a description
    And I submit
    Then a need is created with status "open" and community "Foxcroft"
    And I am shown a share screen with Copy Link
    And neighbors visible in "Foxcroft" receive an in-app notification
    But no email is sent for the new need

  Scenario: I have no home community
    Given I have no primary community membership
    When I try to post a need
    Then I see a validation error and no need is created

Feature: Network-scoped needs feed (symmetric)
  As a community member
  I want to see a need only when both its creator and I are visible in its
  home community
  So that demand reaches the right neighbors

  Scenario: Need visible when both parties are visible
    Given another user posted a need whose community is "Verona Gardens"
    And that user and I are both visible in "Verona Gardens"
    Then I see that need in the feed

  Scenario: Need hidden when I toggled off its home community
    Given another user posted a need whose community is "Glen Arbor Estates"
    And I have toggled "Glen Arbor Estates" off
    Then I do NOT see that need, even if we share other visible communities

  Scenario: Need hidden when its creator toggled off its home community
    Given another user posted a need whose community is "Verona Gardens"
    And I am visible in "Verona Gardens"
    And that user has toggled "Verona Gardens" off
    Then I do NOT see that need

Feature: Create a listing from a need
  As a provider
  I want to respond to a need with a listing
  So that the requester can book it through the normal flow

  Scenario: Create and link a listing
    Given I am viewing an open need of type "Rental"
    When I click "Create Listing"
    Then the listing form opens pre-filled with the type, category, suggested
        title and description
    And on publish the listing is linked to the originating need

  Scenario: Requester notified when the listing goes live
    Given a listing I created is linked to a need
    When an admin approves the listing
    Then the need's creator receives a "listing created" notification
        deep-linking to the listing
    But a still-pending or rejected listing sends no such notification

Feature: Auto-close on the requester's booking
  As a requester
  I want my need to close when I book a linked listing
  So that fulfilled demand stops being advertised

  Scenario: Requester books a linked listing
    Given my open need has a linked listing
    When I book that listing and the booking is accepted/approved
    Then my need is closed with reason "booking" and leaves the active feed

  Scenario: A stranger books the linked listing
    Given my open need has a linked listing
    When a different user books that listing
    Then my need stays open

Feature: Opt-out notifications
  As a provider
  I want new-need alerts in-app without spam
  So that I can respond while requests are fresh

  Scenario: Default channels
    Given I have never set a preference for "Neighborhood Needs"
    When a new need is posted in my network
    Then I receive an in-app notification
    And I receive no email
    And I receive no push

  Scenario: Mute the category
    Given I muted the "Neighborhood Needs" category
    When a new need is posted in my network
    Then I receive nothing
```

---

## Existing Test Coverage

- **`CommunityDAL`** ([src/dal/**tests**/community.dal.test.ts](src/dal/__tests__/community.dal.test.ts))
  — extended (not rewritten) with `getUserIdsVisibleInCommunity`
- **Listing create services** — existing `ListingService.createListing` /
  `ServiceListingService.createListing` tests extended for the optional
  `neighborhoodNeedId` link
- **Booking services** — existing `approveRentalRequest` / `acceptBooking` tests
  extended to assert the added fire-and-forget hook and that a thrown hook does
  not affect the host result
- **Listing approval** — existing approve-route / `approveListing` tests
  extended for the notify hook
- **Notification preference service** — existing `shouldSendEmail` /
  `shouldSendPush` tests extended for the new category default

## Missing Test Coverage (To Build)

- The entire `NeighborhoodNeedsDAL` and `NeighborhoodNeedsService`
- All new `/api/needs*` routes
- All new UI components + hooks (feed, detail, create, share, empty-state CTA)
- The three cross-feature hooks' added branches
- Schema/migration tests for the two new tables + the non-transactional enum
  migration
- The feed-query performance baseline

---

## Risk-Based Test Prioritization

If we must triage, ship in this order:

1. **DAL + schema/migration tests** — data-layer bugs are the hardest to fix
   post-deploy; the visibility feed query is the highest-blast-radius logic.
2. **Service validation + the three hooks** — category/type validation,
   creator-only auto-close, link-on-create no-ops, notify-on-approval.
3. **Notification default matrix** — the one place a wrong default produces
   real-world spam.
4. **API route auth/visibility integration** — 401/403/404 + the symmetric feed.
5. **E2E happy paths** — post-a-need + create→notify→book→auto-close.
6. **Component-render polish** — last; safe to defer if needed.

---

## Out of Scope for This Test Plan

- Interest/category-subscription matching for fan-out (deferred — fan-out is
  whole-network minus mutes)
- Provider proposals / quotes / offers / negotiation / comments / photos /
  budgets / tags (deferred)
- Any analytics/event assertions (analytics deferred entirely)
- Reopening a closed need (closed is terminal in MVP)
- Cross-network need scenarios beyond the smoke seed
- Load testing beyond the MVP `EXPLAIN ANALYZE` budget

```

```
