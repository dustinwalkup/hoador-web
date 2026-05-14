# Test Plan: Multi-Community Marketplace Expansion

## Requirements Traceability

This test plan verifies the multi-community marketplace expansion across
all six surfaces it touches: schema/migrations, DAL, services, API routes,
UI, and middleware. Tests prove the symmetric visibility model, the
verification queue workflow, and the listing-search rewrite — without
regressing the legacy join-code flow that R1.5 keeps alive.

References:

- [1-requirements.md](./1-requirements.md) — `R#` references
- [2-design.md](./2-design.md) — `§#` references
- [3-tasks.md](./3-tasks.md) — task numbering

### Test Coverage Summary

- **Unit tests:** schema types, DAL methods, service orchestration,
  validation rules, React hooks, components, the per-request cache helper
- **Integration tests:** API route handlers (DAL → service → route),
  proxy/middleware redirect logic, migration backfill idempotency
- **E2E tests:** the four flows in R13 — new signup, status redirect,
  visibility toggle, admin verification — plus the legacy join-code
  fallback
- **Performance tests:** `EXPLAIN ANALYZE` budgets on the rewritten
  listing search, single-query-per-request verification

### Frameworks

- **Unit / integration:** Vitest (existing project config)
- **Component:** Vitest + Testing Library (existing pattern)
- **E2E:** Playwright (existing config)
- **DB tests:** real Postgres against the `e2e` DB (existing pattern in
  [src/dal/**tests**/](src/dal/__tests__/))

---

## Test Types

### Unit Tests

#### DAL — Networks (`CommunityDAL`, task 4.1)

- [ ] `getNetworkById` — returns network or null
  - Happy path: existing ID returns the row
  - Edge case: unknown ID returns null
  - Edge case: invalid UUID format throws

- [ ] `getNetworkBySlug` — returns network by slug
  - Happy path: `kansas-city-metro` returns row
  - Edge case: unknown slug returns null
  - Edge case: case-sensitivity expectation pinned
  - _Requirements: R6.1, R6.3_

- [ ] `listNetworks` — returns all (active + inactive in MVP)
  - Happy path: returns expected count after seed
  - _Requirements: R6.1_

- [ ] `listCommunitiesByNetwork(networkId, { activeOnly? })`
  - Happy path: returns 8 KC Metro communities
  - With `activeOnly=true`: deactivated communities excluded
  - Edge case: network with zero communities returns []
  - _Requirements: R1.2, R6.5_

#### DAL — Primary community (`selectPrimaryCommunity`, task 4.2)

- [ ] `selectPrimaryCommunity(userId, communityId)`
  - Happy path: creates membership with `is_primary=true`,
    `verification_status='pending'`
  - Error: user already has primary → `ConflictError`
  - Error: community is inactive → `ValidationError`
  - Error: unknown community ID → `ValidationError` (FK violation mapped)
  - Verifies partial unique index enforces "one primary per user"
  - _Requirements: R1.3, R3.1, R3.2_

#### DAL — Visibility (task 4.3)

- [ ] `initializeUserVisibility(userId, networkId)`
  - Happy path: inserts N rows, one per active community in network
  - Idempotent: re-running for same user is a no-op (no duplicates)
  - Skips inactive communities in network
  - Edge case: network with zero communities inserts zero rows
  - _Requirements: R4.2, R4.7_

- [ ] `getVisibleCommunityIds(userId)` (hot path)
  - Happy path: returns all community IDs where `is_visible=true`
  - Returns [] for user with no rows (R4.8 fail-closed)
  - Excludes rows where `is_visible=false`
  - _Requirements: R4.8, R8.8, R14.2_

- [ ] `isVisibleInCommunity(userId, communityId)` (single-listing auth)
  - Returns `true` when the `(user_id, community_id)` row has `is_visible=true`
  - Returns `false` when the row has `is_visible=false`
  - Returns `false` when no row exists (R4.8 fail-closed)
  - _Requirements: R4.8, R8.9_

- [ ] `getVisibilityForUser(userId)`
  - Happy path: returns rows joined with community info for UI
  - Includes both visible and hidden communities so UI can render toggles
  - _Requirements: R4.3_

- [ ] `bulkSetVisibility(userId, updates[])`
  - Happy path: upserts each update; returns updated rows
  - Error: attempting to set primary's `isVisible=false` → `ValidationError`
  - Edge case: duplicate community IDs in updates → last write wins
  - Edge case: empty updates array → no-op
  - Idempotent: setting already-true to true is a no-op
  - _Requirements: R4.4, R4.5, R4.6_

#### DAL — Admin verification queue (task 4.4)

- [ ] `listPendingVerifications({ page, limit, communityId? })`
  - Happy path: returns paginated rows with user + address info
  - Sorted oldest-first
  - With `communityId` filter: only that community's pending rows
  - Excludes verified / denied rows
  - Pagination boundaries (page 1, last page, beyond)
  - _Requirements: R9.1_

- [ ] `verifyMembership(membershipId, adminUserId, adminNotes?)`
  - Happy path: status → `verified`; sets `verifiedAt`, `verifiedBy`,
    `adminNotes`
  - Error: membership not found → `NotFoundError`
  - Edge case: already-verified membership → no-op or re-verify (decide
    in implementation; test pins behavior)
  - _Requirements: R2.4, R2.5, R9.1_

- [ ] `denyMembership(membershipId, adminUserId, adminNotes)`
  - Happy path: status → `denied`; persists `adminNotes`, `verifiedBy`
  - Error: empty `adminNotes` → `ValidationError`
  - Error: membership not found → `NotFoundError`
  - _Requirements: R2.4, R9.1_

#### DAL — Audit logging (task 4.5)

- [ ] `verifyMembership` writes to `audit_logs`
  - Verifies row created with admin user id, action type, target id
- [ ] `denyMembership` writes to `audit_logs`
  - Same shape; includes admin notes in details
  - _Requirements: R9.5_

#### DAL — Listing search (`ListingDAL.searchListings`, task 5.1–5.2)

- [ ] `searchListings` — symmetric per-community visibility
  - Empty `visibleCommunityIds` → returns empty paginated result with no
    DB call (verified via mock spy)
  - Listing whose `community_id` is **not** in the viewer's visible set is
    excluded (even if the owner is visible in other communities the viewer
    shares)
  - Listing whose owner has `is_visible = false` for the listing's
    `community_id` is excluded; owner with **no** `community_visibility`
    row for that community is also excluded (fail-closed)
  - Listing whose `community_id` **is** in the viewer's visible set AND
    whose owner is visible in that community → returned exactly once
    (the visibility join is 1:1 with the listing; `selectDistinct` /
    `countDistinct` only guard the primary-address `leftJoin`)
  - Existing filters (status, approval, isActive, category, price,
    condition, deliveryMode, setupAvailable, owner ≠ viewer) all still apply
  - Distance sort returns ordered results when viewer has lat/lng
  - Pagination (page, limit, total) correct
  - _Requirements: R5.3, R5.4, R5.7, R5.8, R8.1, R8.6_

#### DAL — Service-listing search (task 5.3)

Mirror of the above for `ServiceListingDAL.findByCommunityForBrowse`:

- [ ] Symmetric per-community visibility filtering (join pinned to
      `(provider_id, service_listings.community_id)`; viewer-side filter on
      `service_listings.community_id IN (...)`)
- [ ] Listing excluded when its `community_id` is hidden by the viewer or by
      the provider (or the provider has no row for it)
- [ ] Returned exactly once; existing service filters preserved
- _Requirements: R8.4_

#### Service — `AuthService.selectPrimaryCommunity` (task 7.1–7.2)

- [ ] Happy path: orchestrates membership → visibility init → status
      update → returns `{ redirect: "/onboarding" }`
- [ ] Existing-primary conflict propagated as `ConflictError`
- [ ] Inactive community rejected before any DB writes
- [ ] Standalone community (network_id null) skips visibility init but
      still creates membership and updates status
- [ ] User status update happens after successful join (not before)
- [ ] Failure during visibility init does NOT leave user in inconsistent
      state (membership rolled back via transaction OR explicit cleanup —
      pin the chosen behavior)
- _Requirements: R1.3, R3.1, R4.2, R11.3_

#### Service — `AuthService.joinCommunity` regression (task 7.3)

- [ ] Existing happy path still works
- [ ] Now also sets `is_primary=true` and `verification_status='verified'`
      on the created membership (legacy join codes are pre-trusted)
- [ ] Existing error cases preserved (invalid code, conflict)
- _Requirements: R1.5, R3.5_

#### Per-request cache (`getCurrentUserVisibleCommunityIds`, task 6.1–6.2)

- [ ] Returns DAL output for authenticated user
- [ ] Returns [] for unauthenticated user (no DB call)
- [ ] React `cache()` memoizes per request: two calls in same request →
      one DAL call (verified via spy/mock)
- _Requirements: R8.8, R14.2_

#### Components — `CommunitySelectForm` (task 10.1)

- [ ] Renders dropdown populated from `GET /api/communities` query
- [ ] Submits selected `communityId` to `useSelectCommunity` mutation
- [ ] On success, navigates to `/onboarding`
- [ ] On error (e.g., conflict), displays error message
- [ ] "Don't see yours?" opens `RequestHoadorModal`
- [ ] "Have a private invite code?" link points to `/join-code`
- [ ] Submit button disabled when no community selected
- [ ] Submit button shows loading state during mutation
- _Requirements: R1.1, R1.2, R1.4, R1.5_

#### Components — `VisibilitySettingsCard` (task 10.3)

- [ ] Renders one toggle row per community returned by `useVisibility`
- [ ] Primary community row shows locked Switch + helper copy
      ("Home community — always visible")
- [ ] Toggling a non-primary community marks form as dirty
- [ ] Save button disabled when no diff
- [ ] On save, calls `useUpdateVisibility` with array of changed entries
      only (not all rows)
- [ ] Error from mutation surfaces as inline error
- [ ] Loading state during save
- _Requirements: R4.3, R4.4, R4.5, R4.6_

#### Components — `PendingVerificationsTab` (task 10.6)

- [ ] Renders queue rows with address, claimed community, submitted-date,
      action buttons
- [ ] "Verify" triggers `useVerifyMembership` mutation; on success row
      disappears (cache invalidation)
- [ ] "Deny" opens dialog; submitting requires non-empty notes
- [ ] Empty queue renders empty-state copy
- [ ] Pagination controls work
- _Requirements: R9.1_

#### Components — Admin community CRUD (task 10.9)

- [ ] List page renders all communities with stats
- [ ] Edit form persists changes via PATCH
- [ ] Network dropdown populated from `community_networks`
- [ ] Activate/deactivate toggle works
- _Requirements: R9.2_

#### Hooks (tasks 10.2, 10.4, 10.7)

- [ ] `useSelectCommunity` — POSTs to `/api/auth/select-community`;
      invalidates `["currentUser"]` on success
- [ ] `useVisibility` — GETs visibility list; cache key stable
- [ ] `useUpdateVisibility` — PATCHes; invalidates visibility query AND
      listing search caches
- [ ] `useAdminPendingVerifications` — GETs queue
- [ ] `useVerifyMembership` / `useDenyMembership` — invalidate the queue
      query on success
- _Requirements: R1.3, R4.3, R4.5, R9.1_

---

### Integration Tests

#### API Routes

- [ ] **`POST /api/auth/select-community`** (task 8.1)
  - 401 when unauthenticated
  - 400 on missing/invalid `communityId`
  - 409 when user already has primary
  - 400 when community inactive
  - 200 on happy path; response body matches `{ redirect: "/onboarding" }`
  - DB state: membership row exists with `is_primary=true,
verification_status='pending'`; visibility rows initialized

- [ ] **`GET /api/communities?networkSlug=...`** (task 8.2)
  - Returns expected list filtered by network
  - Returns active-only when `active=true`
  - Cache headers present
  - Public access (no auth required) — verify

- [ ] **`GET /api/users/me/visibility`** (task 8.3)
  - 401 when unauthenticated
  - Returns rows for authenticated user only

- [ ] **`PATCH /api/users/me/visibility`** (task 8.4)
  - Bulk update applied
  - 400 when attempting to hide primary
  - 400 on malformed body (validation)

- [ ] **`GET /api/admin/community-memberships/pending`** (task 8.5)
  - 401 for unauthenticated
  - 403 for non-admin user
  - Returns paginated queue for admin

- [ ] **`POST /api/admin/community-memberships/[id]/verify`** (task 8.6)
  - 403 for non-admin
  - 404 for unknown membership
  - 200 on success; DB row status updated

- [ ] **`POST /api/admin/community-memberships/[id]/deny`** (task 8.7)
  - 403 for non-admin
  - 400 when `adminNotes` missing
  - 200 on success

- [ ] **Admin community CRUD** (task 8.8)
  - GET / POST / PATCH happy paths and admin-gating

- [ ] **Single-listing visibility — detail / booking / rent paths** (R8.9)
  - `GET /api/services/listings/[id]`: 401 unauth; 404 when listing missing;
    200 to the provider regardless of status/community; 200 to a non-provider
    only when the listing is active AND both viewer and provider are visible
    in `listing.communityId`; 403 otherwise (not active, viewer hidden, or
    provider hidden)
  - Service detail page (`/dashboard/services/listings/[id]`) and tool detail
    page (`/dashboard/listings/[id]`): same rule → `notFound()` when a
    non-owner can't view; owner always passes; tool detail additionally
    `notFound()`s non-owners for non-browseable statuses (`maintenance`,
    `inactive`)
  - Service booking page (`/dashboard/services/listings/[id]/book`) and tool
    rent page (`/dashboard/listings/[id]/rent`): a non-owner reaching the
    flow must pass the same gate (active/browseable + both visible in the
    listing's community), else `notFound()`; the owner/provider gets the
    "can't book/rent your own" path
  - Regression: a listing that appears in a viewer's browse feed is also
    openable (detail + booking/rent) by that viewer — same rule everywhere

- [ ] **Provider profile visibility** (R8.10)
  - `communityDAL.getVisibleCommunityIds` for viewer and provider; share ≥1
    community where both are visible → page/route returns the profile; no
    overlap → `notFound()` / `403`; self is always allowed
  - Active listings in the response/page are scoped to the shared visible
    communities; for self, no scoping

#### Middleware (`proxy.ts`, task 9.1–9.2)

- [ ] `email_verified` user navigating to `/dashboard` redirects to
      `/community-select`
- [ ] `email_verified` user navigating to `/community-select` is allowed
- [ ] `email_verified` user navigating to `/join-code` is allowed
      (legacy path preserved)
- [ ] `email_verified` user navigating to any other path redirects to
      `/community-select`
- [ ] `incomplete_profile` user redirects to `/onboarding` (unchanged)
- [ ] `active` user behavior unchanged
- _Requirements: R11.1, R11.2_

#### Migration backfill idempotency (task 2.3)

- [ ] Run Migration B once; capture row counts (networks, communities,
      memberships updated, visibility rows inserted)
- [ ] Run Migration B again; assert same counts (no duplicates, no errors)
- [ ] Verify `verified_at` is preserved on second run (not overwritten)
- _Requirements: R10.4_

#### Per-request cache integration

- [ ] Within a single Next.js request, two consumers calling
      `getCurrentUserVisibleCommunityIds` produce one DB query
- [ ] Across two separate requests, two queries are made (no global
      leakage)
- _Requirements: R8.8, R14.2_

---

### E2E Tests (Playwright)

These are the concrete realizations of R13.

#### Updated: signup funnel (task 13.1)

- [ ] **`signup → verify-email → /community-select → /onboarding → /dashboard`**
      ([signup-funnel.spec.ts](e2e/auth/signup-funnel.spec.ts))
  - User signs up, verifies email
  - Lands on `/community-select`
  - Selects "Foxcroft" from dropdown
  - Clicks Continue → lands on `/onboarding`
  - Submits address → lands on `/dashboard`
  - Asserts dashboard greeting visible

#### Updated: status-based redirect (task 13.2)

- [ ] **`email_verified` user logs in → `/community-select`**
- [ ] **`email_verified` user navigates to `/dashboard` → `/community-select`**
- [ ] **`email_verified` user navigates to `/join-code` → allowed (200)**

#### New: community-selection flow (task 13.3)

- [ ] Dropdown opens and renders the 8 KC Metro communities
- [ ] Selecting one persists the membership and redirects to `/onboarding`
- [ ] "Don't see yours? Request your community" opens the
      `RequestHoadorModal`
- [ ] "Have a private invite code?" link routes to `/join-code`
- _Requirements: R13.4_

#### New: legacy join-code fallback (task 13.4)

- [ ] `email_verified` user visits `/join-code` directly, enters
      `E2E_JOIN_CODE`, joins the legacy community, lands on `/onboarding`
- _Requirements: R13.6, R1.5_

#### New: visibility settings (task 13.7)

- [ ] User logs in (active, in network), visits `/dashboard/profile`
- [ ] Sees `VisibilitySettingsCard` with N rows
- [ ] Primary row's toggle is disabled
- [ ] Toggles a non-primary community OFF, clicks Save
- [ ] Reloads page; toggle state persists
- [ ] Visits the marketplace; verifies a listing from the toggled-off
      community is no longer in the feed
- _Requirements: R4.3, R4.5, R5.7, R8.5_

#### New: admin verification queue (task 13.8)

- [ ] Admin logs in, navigates to `/admin/dashboard/users`
- [ ] Switches to "Pending Verifications" tab
- [ ] Verifies one pending membership (clicks Verify)
- [ ] Asserts the row disappears from the queue
- [ ] Asserts the user's `verification_status` is now `verified` in DB
      (via API spy or test endpoint)
- [ ] As the verified user: re-login, profile no longer shows the
      "verification pending" badge
- _Requirements: R9.1, R2.6_

#### Existing tests — regression sweep

- [ ] Login / logout (unchanged)
- [ ] Password reset (unchanged)
- [ ] Google OAuth (unchanged)
- [ ] Protected route enforcement (verify after middleware change)

---

### Performance Tests

#### Listing search query (R14)

- [ ] **`EXPLAIN ANALYZE` on the `searchListings` query** (task 5.4)
  - Captured against the seeded e2e DB
  - p50 < 25ms, p95 < 50ms at MVP scale
  - p95 < 200ms at 10× scale (synthesize via test seed multiplier)
  - Planner output shows the `community_visibility(user_id, community_id)`
    unique index for the owner-side point lookup and `listings(community_id)`
    for the viewer-side `community_id IN (...)` filter
  - _Requirements: R14.1, R14.3_

- [ ] **N+1 prevention** (verified by query log)
  - Loading a 25-listing page triggers exactly: 1 query for visibility
    IDs + 1 query for listings (+ joins) = 2 queries total
  - No per-listing visibility query
  - _Requirements: R14.4_

- [ ] **`getCurrentUserVisibleCommunityIds` cache verification**
  - Multiple consumers in one server request → one DB call
  - _Requirements: R8.8, R14.2_

---

### Schema / Migration Tests

- [ ] **Schema migration applies cleanly** against a clone of seeded DB
- [ ] **Backfill migration is idempotent** (run twice; verify no
      duplicates, no errors, no overwritten `verified_at` timestamps)
- [ ] **Partial unique index `(user_id) WHERE is_primary = true`**
      enforces "one primary per user" — direct insert violating it raises
      unique-violation
- [ ] **Unique index `(user_id, community_id)` on
      `community_visibility`** prevents duplicates (and serves the owner-side
      point lookup in listing search)
- [ ] **FK behavior**: deleting a user cascades to their memberships and
      visibility rows
- [ ] **`join_code` is now nullable**: insert a community with NULL
      join_code succeeds
- _Requirements: R3.2, R4.1, R6.2, R10.1–R10.4_

---

## Coverage Goals

Following project standards (AI-coding-standards.md: 80% as a baseline):

| Surface                                 | Target                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| `CommunityDAL` (new methods)            | ≥ 90% lines                                                        |
| `ListingDAL.searchListings` (rewritten) | ≥ 85% lines, including the symmetric per-community visibility path |
| `AuthService.selectPrimaryCommunity`    | ≥ 90% branches                                                     |
| API route handlers                      | ≥ 80% lines                                                        |
| UI components (3 new)                   | ≥ 75% lines                                                        |
| Per-request cache helper                | 100% (small surface)                                               |
| Overall multi-community feature         | ≥ 85%                                                              |

---

## Test Data Requirements

### Database fixtures

- 1 KC Metro network with the 8 seeded communities
- 1 "Test Network" with the 3 legacy dev communities
- ≥ 4 users in different `verification_status` states (verified, pending,
  denied, mixed-network)
- ≥ 8 listings across multiple owners and communities — including a listing
  whose `community_id` a test viewer has hidden, and one whose owner has
  hidden its `community_id` — to exercise the symmetric per-community
  visibility rule (both directions, plus fail-closed on a missing row)
- ≥ 5 memberships in `pending` status for the verification queue tests

### Mock / stub strategy

- **Geocoding service**: existing project pattern — mocked at the
  `services/geocoding` boundary (community lat/lng is admin-entered, so
  no live geocode calls)
- **BetterAuth**: existing pattern — auth state injected via fixtures
- **Sentry**: silenced in tests (existing convention)
- **DB**: real Postgres for DAL + integration tests (existing pattern);
  fully mocked at hook level for component tests

---

## BDD Scenarios

```gherkin
Feature: Community selection at signup
  As a new user
  I want to select my community from a list
  So that I can join HOADOR without needing a code

  Background:
    Given I have signed up and verified my email
    And the "Kansas City Metro" network has 8 active communities

  Scenario: Successfully select a community
    Given I am on /community-select
    When I select "Foxcroft" from the community dropdown
    And I click Continue
    Then a primary community membership is created with
        verification_status "pending"
    And visibility rows are created for me in all 8 KC Metro communities
    And I am redirected to /onboarding

  Scenario: My community is not in the list
    Given I am on /community-select
    When I click "Don't see yours? Request your community"
    Then the Request Hoador modal opens

  Scenario: I have a private invite code
    Given I am on /community-select
    When I click "Have a private invite code?"
    Then I am routed to /join-code
    And I can enter my admin-issued code as before

Feature: Per-community visibility (symmetric)
  As a user with a verified primary community
  I want to control which neighboring communities I appear in
  So that visibility is unambiguous and all-or-nothing

  Background:
    Given I am verified in "Foxcroft" (my primary)
    And I am visible in all 8 KC Metro communities by default

  Scenario: Toggle off a non-primary community (symmetric)
    Given I am on /dashboard/profile
    When I toggle "Glen Arbor Estates" off
    And I click Save
    Then every listing whose community is "Glen Arbor Estates" disappears
        from my search results
    And every one of my own listings whose community is "Glen Arbor Estates"
        disappears from everyone else's search results
    And listings I have in other communities are unaffected

  Scenario: Cannot hide my home community
    Given I am on /dashboard/profile
    Then the toggle for "Foxcroft" (my primary) is disabled
    And helper copy explains it is my home community

  Scenario: Re-enable visibility
    Given I previously toggled "Glen Arbor Estates" off
    When I toggle it back on
    And I click Save
    Then "Glen Arbor Estates" listings reappear in my search
    And my "Glen Arbor Estates" listings reappear for everyone else

Feature: Admin verification queue
  As an admin
  I want to verify pending residency claims
  So that the platform's trust model holds

  Background:
    Given I am signed in as an admin
    And there are 5 pending memberships in the queue

  Scenario: Verify a pending membership
    Given I am on /admin/dashboard/users on the "Pending Verifications" tab
    When I look up the user's address against the claimed community
    And I click "Verify"
    Then the membership status becomes "verified"
    And verified_at and verified_by are set
    And an audit_log row is created
    And the row disappears from the queue

  Scenario: Deny a pending membership
    Given I am on the verification queue
    When I click "Deny" for a row
    And I enter notes "Address is outside community boundary"
    Then the membership status becomes "denied"
    And admin_notes are persisted
    And an audit_log row is created

  Scenario: Cannot deny without notes
    Given I click "Deny"
    When I leave the notes field empty and submit
    Then I see a validation error
    And the membership remains "pending"

Feature: Multi-community listing feed
  As a user
  I want to see a listing exactly when both its owner and I have its home
  community toggled visible
  So that turning a community off cleanly removes its listings from my feed

  Scenario: Listing is visible when both parties are visible in its community
    Given I am visible in "Foxcroft" and "Verona Gardens"
    And another user has a listing whose community is "Verona Gardens"
    And that user is visible in "Verona Gardens"
    Then I see that listing in my feed

  Scenario: Listing hidden when I have toggled off its home community
    Given another user has a listing whose community is "Glen Arbor Estates"
    And that user is visible in "Glen Arbor Estates"
    And I have toggled "Glen Arbor Estates" off
    Then I do NOT see that listing in my feed
    Even if I share other visible communities with that user

  Scenario: Listing hidden when its owner has toggled off its home community
    Given another user has a listing whose community is "Verona Gardens"
    And I am visible in "Verona Gardens"
    And that user has toggled "Verona Gardens" off
    Then I do NOT see that listing in my feed

  Scenario: Listing appears once
    Given another user has a listing whose community is "Verona Gardens"
    And both that user and I are visible in "Verona Gardens"
    Then that listing appears exactly once in my feed
        (the community_visibility join is 1:1 with the listing)

Feature: Pending verification badge
  As an unverified user
  I want a visible "verification pending" indicator
  So that other users see I am still being verified
  And so that I retain full marketplace access in the meantime

  Scenario: Pending user has full access
    Given my membership is in "pending" status
    Then I can browse, list, message, and rent
    And my profile shows a "Verification Pending" badge

  Scenario: Verified user has no badge
    Given my membership is in "verified" status
    Then no "Verification Pending" badge appears on my profile

Feature: Legacy join-code fallback
  As a user with an admin-issued join code
  I want the legacy /join-code path to still work

  Scenario: Legacy join code grants membership
    Given I am email_verified
    And my admin issued me code "PRIVATE-XYZ-123"
    When I navigate to /join-code and enter the code
    Then a membership is created with is_primary=true and
        verification_status='verified'
    And I am redirected to /onboarding
```

---

## Existing Test Coverage

- **`CommunityDAL`** ([src/dal/**tests**/community.dal.test.ts](src/dal/__tests__/community.dal.test.ts))
  - Existing: `getCommunityByJoinCode`, `joinCommunityByCode`,
    `joinCommunityForNewUser`, `getMembershipForUser`, `listMembers`
  - Will be extended (not rewritten) for new methods
- **Auth service** ([src/features/auth/services/auth-service.test.ts](src/features/auth/services/auth-service.test.ts))
  - Existing: `signUpWithEmail`, `joinCommunity`, `acceptLegalDocuments`
  - `joinCommunity` test must be updated for the `is_primary=true,
verified` change in task 7.3
- **`searchListings`** — existing tests for filters / pagination
  - Signature change in task 5.1 means tests must be updated to pass
    `visibleCommunityIds` instead of `communityId`
- **E2E** — three existing files to update (R13.1, R13.2, R13.4)

---

## Missing Test Coverage (To Build)

- All new DAL methods (network, visibility, admin verification)
- `AuthService.selectPrimaryCommunity` (entirely new)
- All new API routes
- All new UI components (`CommunitySelectForm`, `VisibilitySettingsCard`,
  `PendingVerificationsTab`, admin community CRUD)
- All new React Query hooks
- Migration idempotency tests (entirely new)
- E2E for visibility settings and admin verification queue
- Performance baselines for the rewritten search query

---

## Risk-Based Test Prioritization

If we have to triage, ship in this order:

1. **DAL + migration tests** — anything that touches the schema. Bugs
   here are the hardest to fix post-deploy because of the data layer.
2. **Search-query tests (symmetric per-community visibility: hidden by
   viewer, hidden by owner, missing-row fail-closed, empty IDs)** —
   biggest behavior change on a hot path.
3. **AuthService.selectPrimaryCommunity orchestration** — the new
   signup happy path.
4. **E2E signup funnel + visibility toggle** — proves the flow holds
   end-to-end.
5. **Admin verification queue tests** — important but lowest blast
   radius (internal users).
6. **Component-render polish tests** — last to ship; safe to defer if
   needed.

---

## Out of Scope for This Test Plan

- **Polygon-based residency verification** (R12 deferred)
- **Per-listing visibility overrides** (R12 deferred)
- **Self-service community-change flow** (R12 deferred)
- **Distance-based search ranking** (R12 deferred)
- **Cross-network test scenarios beyond Test Network smoke seed**
- **Load testing at 100× scale** (defer until network growth justifies)
