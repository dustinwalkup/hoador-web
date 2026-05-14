# Implementation Tasks: Multi-Community Marketplace Expansion

Tasks are ordered by dependency. Each task is sized to be completable in a
single focused session. Sub-tasks (`X.Y`) build incrementally on the
parent. Tests are co-located with the work that introduces them (TDD where
practical).

References:

- [1-requirements.md](./1-requirements.md) — `R#` references below
- [2-design.md](./2-design.md) — `§#` section references below

---

## 1. Schema definitions (Drizzle)

- [x] **1.1 Add `communityNetworks` table to schema**
  - Add table definition + relations + types in
    [src/db/schemas/communities.schema.ts](src/db/schemas/communities.schema.ts)
  - Export `CommunityNetwork`, `NewCommunityNetwork`, `UpdateCommunityNetwork` types
  - Unique indexes on `name` and `slug`
  - _Requirements: R6, R10.1_ — _Design: §3.1, §4.1_

- [x] **1.2 Modify `communities` table definition**
  - Add `networkId UUID` (nullable FK), `latitude DECIMAL(10,8)`,
    `longitude DECIMAL(11,8)`, `isActive BOOLEAN NOT NULL DEFAULT true`
  - Make `joinCode` nullable (drop `.notNull()`)
  - Add index on `networkId`
  - _Requirements: R6.2, R7.1, R10.2_ — _Design: §3.1, §4.2_

- [x] **1.3 Modify `communityMemberships` table definition**
  - Add `isPrimary`, `verificationStatus` (reuse existing
    `verificationStatusEnum`), `verifiedAt`, `verifiedBy` (FK → user.id),
    `adminNotes`
  - Add partial unique index `(user_id) WHERE is_primary = true`
  - Add index on `verificationStatus`
  - _Requirements: R3.1, R10.3_ — _Design: §3.1, §4.3_

- [x] **1.4 Add `communityVisibility` table to schema**
  - Add table definition + relations + types
  - Unique index on `(user_id, community_id)`
  - Partial indexes for `(user_id) WHERE is_visible = true` and
    `(community_id) WHERE is_visible = true`
  - _Requirements: R4.1, R10.1, R14.3_ — _Design: §3.1, §4.4_

- [x] **1.5 Update `userRelations` and `communitiesRelations`**
  - Add `communityVisibility` relation on user and community sides
  - Add `network` relation on `communities`
  - Verify [src/db/schemas/index.ts](src/db/schemas/index.ts) exports the new tables
  - _Design: §3.1_

---

## 2. Database migration files

- [x] **2.1 Generate Migration A — schema DDL**
  - Run `bun drizzle-kit generate` to produce migration based on schema
    changes from §1
  - Hand-edit if needed for partial-index syntax (Drizzle may not emit
    `WHERE` clauses for partial indexes — verify and add raw SQL)
  - Inspect generated SQL against design §5.1
  - _Requirements: R10.1, R10.2, R10.3_ — _Design: §5.1_

- [x] **2.2 Write Migration B — idempotent data backfill**
  - Add a custom migration file (or `drizzle-kit` empty migration)
    containing the SQL from design §5.2:
    1. INSERT KC Metro network (`ON CONFLICT (slug) DO NOTHING`)
    2. INSERT 8 KC Metro communities, attached to network (idempotent)
    3. UPDATE existing memberships → `is_primary=true`,
       `verification_status='verified'`, `verified_at = COALESCE(verified_at, created_at)`
    4. INSERT `community_visibility` rows for all existing primary
       memberships × every community in their network
  - Wrap entire backfill in a transaction
  - _Requirements: R3.5, R4.7, R6.3, R10.4_ — _Design: §5.2_

- [x] **2.3 Test migration idempotency**
  - Add `src/db/migrations/__tests__/multi_community_backfill.test.ts`
  - Create test scenario: run Migration B twice; assert no duplicate rows,
    no error, all expected counts unchanged on second run
  - _Requirements: R10.4 (idempotent backfill)_ — _Design: §7.4_

---

## 3. Seed updates

- [x] **3.1 Update `src/db/seeds/communities.seed.ts`**
  - Insert "Kansas City Metro" + "Test Network" rows
  - Move existing 3 dev communities to "Test Network"
  - Insert 8 KC Metro communities to "Kansas City Metro"
  - For seeded users: assign primary memberships with
    `verification_status='verified'`, `is_primary=true`
  - Initialize `community_visibility` rows for each seeded user × every
    community in their network (all `is_visible=true`)
  - _Requirements: R10.4_ — _Design: §5.3_

- [x] **3.2 Update `src/db/seeds/e2e.seed.ts`**
  - Same shape as 3.1 for e2e environment
  - Preserve `E2E_JOIN_CODE` on a community in "Test Network"
  - Add `E2E_PRIMARY_COMMUNITY_NAME = "Foxcroft"` constant for the new flow
  - Backfill `community_visibility` for all e2e users
  - _Requirements: R13.3_ — _Design: §5.3_

- [x] **3.3 Verify dev DB after seed** (manual; deferred to user)
  - Run full seed; assert: 1 KC Metro network with 8 communities, 1 Test
    Network with 3 communities, every seeded user has correct primary +
    visibility rows
  - Manual checklist (run after `bun run db:migrate && bun run seed`):
    ```sql
    -- 2 networks
    SELECT slug, name FROM community_networks ORDER BY slug;
    -- KC Metro: 8 communities
    SELECT COUNT(*) FROM communities c
      JOIN community_networks n ON n.id = c.network_id
      WHERE n.slug = 'kansas-city-metro';
    -- Test Network: 3 communities
    SELECT COUNT(*) FROM communities c
      JOIN community_networks n ON n.id = c.network_id
      WHERE n.slug = 'test-network';
    -- Every user has exactly 1 primary, all verified
    SELECT verification_status, COUNT(*) FROM community_memberships
      WHERE is_primary = true GROUP BY verification_status;
    -- Visibility row count per user matches their network's community count
    SELECT u.email, COUNT(cv.*) AS visible_count, n.slug
      FROM "user" u
      JOIN community_memberships m ON m.user_id = u.id AND m.is_primary = true
      JOIN communities pc ON pc.id = m.community_id
      JOIN community_networks n ON n.id = pc.network_id
      LEFT JOIN community_visibility cv ON cv.user_id = u.id
      GROUP BY u.email, n.slug
      ORDER BY u.email;
    ```
  - _Design: §5.3_

---

## 4. CommunityDAL extensions

- [x] **4.1 Add network read methods**
  - `getNetworkById`, `getNetworkBySlug`, `listNetworks`,
    `listCommunitiesByNetwork(networkId, { activeOnly? })`
  - Add unit tests in [src/dal/**tests**/community.dal.test.ts](src/dal/__tests__/community.dal.test.ts)
  - _Requirements: R6.1, R6.2_ — _Design: §3.2_

- [x] **4.2 Add `selectPrimaryCommunity` method**
  - Inserts new `community_memberships` row with `is_primary=true`,
    `verification_status='pending'`
  - Throws `ConflictError` if user already has a primary membership
  - Throws `ValidationError` if community is inactive
  - Unit tests cover: success, conflict, inactive community, unknown community
  - _Requirements: R1.3, R3.2_ — _Design: §3.2, §6_

- [x] **4.3 Add visibility methods**
  - `initializeUserVisibility(userId, networkId)` — bulk insert one row
    per active community in network (`ON CONFLICT DO NOTHING`)
  - `getVisibleCommunityIds(userId)` — returns string[] (hot path)
  - `getVisibilityForUser(userId)` — returns rows joined with community
    info (for UI)
  - `bulkSetVisibility(userId, updates[])` — upsert; reject toggling primary
    to false (`ValidationError`)
  - Unit tests for each, including the primary-locked rule
  - _Requirements: R4.2, R4.4, R4.5, R4.6_ — _Design: §3.2, §6_

- [x] **4.4 Add admin verification queue methods**
  - `listPendingVerifications({ page, limit, communityId? })` — joins
    user + user_addresses to return submitted address with each row
  - `verifyMembership(membershipId, adminUserId, adminNotes?)` — sets
    status to `verified`, populates `verifiedAt`, `verifiedBy`
  - `denyMembership(membershipId, adminUserId, adminNotes)` — required
    notes; sets status to `denied`
  - Unit tests for each path including required-notes validation on deny
  - _Requirements: R2.4, R2.5, R9.1_ — _Design: §3.2, §6_

- [x] **4.5 Add audit logging on verification decisions**
  - In `verifyMembership` / `denyMembership`, write to `audit_logs`
    using existing `AuditLogDAL`
  - Test that audit row is created with admin user id and decision
  - _Requirements: R9.5_ — _Design: §3.2_

---

## 5. ListingDAL & ServiceListingDAL — search rewrite

> Note: tasks 5.1–5.4 were first shipped with an owner-side-only join
> (`cv.user_id = l.owner_id`); they were later corrected to the symmetric
> per-community rule below. See
> [5-implementation-notes.md §14](./5-implementation-notes.md#14-post-implementation-correction--r5-symmetric-per-community-visibility).

- [x] **5.1 Change `ListingDAL.searchListings` signature**
  - Replace `communityId: string` parameter with
    `visibleCommunityIds: string[]`
  - Replace `eq(listings.communityId, communityId)` with:
    `inArray(listings.communityId, visibleCommunityIds)` (viewer side) plus
    `INNER JOIN community_visibility` on `(owner_id, listings.communityId)`
    requiring `is_visible = true` (owner side) — per design §3.3
  - When `visibleCommunityIds` is empty, return empty paginated result
    early (no DB hit)
  - Keep `selectDistinct`/`countDistinct` as a guard for the primary-address
    `leftJoin` (the visibility join is now 1:1 with the listing)
  - _Requirements: R5.3, R5.4, R5.7, R5.8, R8.1, R8.3, R8.5, R14.4_ — _Design: §3.3_

- [x] **5.2 Update `ListingDAL.searchListings` unit tests**
  - Empty `visibleCommunityIds` → empty result (no query executed)
  - Listing whose `community_id` is not in the viewer's visible set →
    excluded (even if owner is visible in other communities the viewer shares)
  - Listing whose owner has `is_visible = false` (or no row) for the
    listing's `community_id` → excluded (fail-closed)
  - Listing whose `community_id` is visible to the viewer AND whose owner is
    visible there → returned exactly once
  - Existing filters (status, approval, isActive, category, price) still apply
  - Distance sort still works when viewer has lat/lng
  - _Requirements: R5.7, R5.8, R8.1, R8.6_ — _Design: §7.1_

- [x] **5.3 Apply same change to `ServiceListingDAL`**
  - Mirror 5.1 for `findByCommunityForBrowse` (join pinned to
    `(provider_id, service_listings.communityId)`; viewer-side filter on
    `service_listings.communityId IN (...)`)
  - Mirror 5.2 unit tests
  - _Requirements: R5.4, R8.4_ — _Design: §3.3_

- [x] **5.4 Capture `EXPLAIN ANALYZE` baseline**
  - Run the query against seeded dev DB; record p50/p95 in PR description
  - Verify the `community_visibility(user_id, community_id)` unique index
    (owner-side point lookup) and `listings(community_id)` (viewer-side `IN`)
    are used by the planner
  - _Requirements: R14.1_ — _Design: §7.4, §8.3_

---

## 6. Per-request cache helper

- [x] **6.1 Add `getCurrentUserVisibleCommunityIds` to membership utils**
  - Add to [src/features/community/utils/membership.ts](src/features/community/utils/membership.ts)
    using React `cache()`, mirroring existing `getCurrentUserCommunityId`
  - Returns `[]` for unauthenticated user
  - _Requirements: R8.8, R14.2_ — _Design: §3.5_

- [x] **6.2 Unit tests for the cache helper**
  - Add to [src/features/community/utils/**tests**/membership.test.ts](src/features/community/utils/__tests__/membership.test.ts)
  - Test: returns DAL output; returns `[]` if no user; cached within request scope
  - _Design: §7.1_

---

## 7. Auth service: primary community selection

- [x] **7.1 Add `AuthService.selectPrimaryCommunity`**
  - Validate input (`communityId` non-empty)
  - Call `communityDAL.selectPrimaryCommunity(userId, communityId)`
  - Resolve community's `networkId`; if not null, call
    `communityDAL.initializeUserVisibility(userId, networkId)`
  - Call `userDAL.updateUserStatus(userId, "incomplete_profile")`
  - Return `{ redirect: "/onboarding" }`
  - _Requirements: R1.3, R3.1, R4.2, R11.3_ — _Design: §3.4_

- [x] **7.2 Unit tests for `selectPrimaryCommunity`**
  - Add to [src/features/auth/services/auth-service.test.ts](src/features/auth/services/auth-service.test.ts)
  - Happy path; existing-primary conflict; inactive community rejection;
    standalone community (network_id null) skips visibility init;
    status update happens after successful join
  - _Design: §7.1_

- [x] **7.3 Preserve existing `joinCommunity` (legacy)**
  - Verify no behavior change to existing method (still validates join code,
    creates membership)
  - Update its membership creation to also set `is_primary=true`,
    `verification_status='verified'` (since legacy code-based joins are
    pre-verified by the code itself)
  - Update existing tests
  - _Requirements: R1.5, R3.5_ — _Design: §3.4_

---

## 8. API routes

- [x] **8.1 `POST /api/auth/select-community`**
  - Create `src/app/api/auth/select-community/route.ts`
  - Authenticated; body `{ communityId: string }`
  - Delegates to `AuthService.selectPrimaryCommunity`
  - Returns `{ redirect: string }` on success; maps DAL errors to HTTP
  - Unit + integration tests
  - _Requirements: R1.3, R11.1_ — _Design: §3.6_

- [x] **8.2 `GET /api/communities`**
  - Create `src/app/api/communities/route.ts`
  - Query params: `?networkSlug=kansas-city-metro&active=true`
  - Returns `Community[]` for use by the community-select dropdown
  - Cached headers: `Cache-Control: public, max-age=60` (data changes rarely)
  - Tests
  - _Requirements: R1.2_ — _Design: §3.6_

- [x] **8.3 `GET /api/users/me/visibility`**
  - Create `src/app/api/users/me/visibility/route.ts`
  - Returns `Array<{ community: Community; isVisible: boolean }>` for the
    current user
  - Tests
  - _Requirements: R4.3_ — _Design: §3.6_

- [x] **8.4 `PATCH /api/users/me/visibility`**
  - Add PATCH handler in same route file
  - Body `{ updates: Array<{ communityId: string; isVisible: boolean }> }`
  - Delegates to `communityDAL.bulkSetVisibility`
  - Returns 400 if attempting to hide primary (mapped from `ValidationError`)
  - Tests including the primary-locked path
  - _Requirements: R4.4, R4.5_ — _Design: §3.6_

- [x] **8.5 `GET /api/admin/community-memberships/pending`**
  - Create `src/app/api/admin/community-memberships/pending/route.ts`
  - Admin-gated via `getAdminUser`
  - Returns paginated queue rows
  - Tests including 401 for non-admin
  - _Requirements: R9.1, R9.4_ — _Design: §3.6_

- [x] **8.6 `POST /api/admin/community-memberships/[id]/verify`**
  - Create `src/app/api/admin/community-memberships/[id]/verify/route.ts`
  - Admin-gated; body `{ adminNotes?: string }`
  - Tests
  - _Requirements: R2.4, R2.5, R9.1_ — _Design: §3.6_

- [x] **8.7 `POST /api/admin/community-memberships/[id]/deny`**
  - Create `src/app/api/admin/community-memberships/[id]/deny/route.ts`
  - Admin-gated; body `{ adminNotes: string }` (required)
  - Tests including required-notes validation
  - _Requirements: R2.4, R9.1_ — _Design: §3.6_

- [x] **8.8 `GET/POST/PATCH /api/admin/communities`**
  - Create routes for community CRUD (list, create, edit)
  - Admin-gated
  - PATCH supports updating name, address, lat/lng, `isActive`, `networkId`
    (single-dropdown selection)
  - Tests
  - _Requirements: R9.2, R9.3_ — _Design: §3.6_

---

## 9. Routing & middleware

- [x] **9.1 Update `proxy.ts` for new community-select route**
  - Add `/community-select` to `PROTECTED_ROUTES` and `AUTH_ROUTES`
  - Change the `email_verified` redirect target from `/join-code` to
    `/community-select`; permit both `/community-select` and
    `/join-code` to satisfy the status check (R1.5 keeps legacy live)
  - _Requirements: R11.1, R11.2, R1.5_ — _Design: §3.8_

- [x] **9.2 Tests for proxy redirect changes**
  - Update / add tests for the proxy redirect logic (or add e2e coverage
    via R13 — see §13)
  - _Requirements: R11.1_ — _Design: §3.8_

- [x] **9.3 Repoint the non-proxy `email_verified → /join-code` redirects**
  - The design §3.8 only covered `proxy.ts`, but the freshly-verified user
    is also routed by Node-runtime code paths that hard-coded `/join-code`.
    Updated to `/community-select` (legacy `/join-code` stays reachable):
    - [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) — status backstop
    - [src/app/(auth)/signup/email/callback/page.tsx](<src/app/(auth)/signup/email/callback/page.tsx>) — email-verification callback default
    - [src/app/(auth)/signup/google/callback/page.tsx](<src/app/(auth)/signup/google/callback/page.tsx>) — Google OAuth callback
    - [src/app/(auth)/signup/google/legal-acceptance/page.tsx](<src/app/(auth)/signup/google/legal-acceptance/page.tsx>)
    - `AuthService.acceptLegalDocuments` in [src/features/auth/services/auth-service.ts](src/features/auth/services/auth-service.ts)
    - [src/services/better-auth/e2e-google-plugin.ts](src/services/better-auth/e2e-google-plugin.ts) — non-forced status path (the explicit `email_verified@e2e.test` `forceJoinCode` path is left as the legacy-path tester for §13.4)
  - _Requirements: R11.1, R11.2, R1.5_

---

## 10. UI components — new

- [x] **10.1 Create `/community-select` page + form**
  - Add [src/app/(auth)/community-select/page.tsx](<src/app/(auth)/community-select/page.tsx>)
  - Add `src/features/auth/components/community-select-form.tsx`
  - shadcn `Select` populated from `GET /api/communities?networkSlug=kansas-city-metro`
  - "Don't see yours?" → opens existing `RequestHoadorModal`
  - "Have a private invite code?" → links to `/join-code`
  - Submit calls `useSelectCommunity()` mutation; on success router-pushes
    to `/onboarding`
  - Tests in `__tests__/community-select-form.test.tsx`
  - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.5_ — _Design: §3.7_

- [x] **10.2 Add `useSelectCommunity` mutation hook**
  - Extend [src/features/auth/hooks/use-auth-mutations.ts](src/features/auth/hooks/use-auth-mutations.ts)
  - Posts to `/api/auth/select-community`; invalidates relevant queries on
    success (`["currentUser"]`, etc.)
  - Tests
  - _Requirements: R1.3_ — _Design: §3.6_

- [x] **10.3 Build `VisibilitySettingsCard`**
  - Add `src/features/users/components/visibility-settings-card.tsx`
  - Pulls visibility list via `useVisibility()`
  - Renders `Switch` per community; primary row shows locked state with
    helper copy ("Home community — always visible")
  - Save button calls `useUpdateVisibility()` with diff array
  - Tests covering: render list, lock primary, diff detection, error display
  - _Requirements: R4.3, R4.4, R4.5, R4.6_ — _Design: §3.7_

- [x] **10.4 Add `useVisibility` + `useUpdateVisibility` hooks**
  - Add `src/features/users/hooks/use-visibility.ts`
  - `useVisibility` (query) → `GET /api/users/me/visibility`
  - `useUpdateVisibility` (mutation) → `PATCH /api/users/me/visibility`
  - Mutation invalidates the visibility query + listing search caches
  - Tests
  - _Requirements: R4.3, R4.5_ — _Design: §3.6_

- [x] **10.5 Mount `VisibilitySettingsCard` on profile page**
  - Edit [src/app/dashboard/profile/page.tsx](src/app/dashboard/profile/page.tsx)
    (or its child component) to render the card under existing sections
  - _Requirements: R4.3_ — _Design: §3.7_

- [x] **10.6 Build admin pending-verifications tab**
  - Add `src/features/admin/components/user-management/pending-verifications-tab.tsx`
  - Pulls queue via `useAdminPendingVerifications()` query
  - Renders rows: address, claimed community, submitted-date, action buttons
  - Verify button → `useVerifyMembership()` mutation
  - Deny opens dialog requiring notes → `useDenyMembership()` mutation
  - Tests
  - _Requirements: R9.1, R9.5_ — _Design: §3.7_

- [x] **10.7 Add admin hooks**
  - Extend [src/features/admin/hooks/use-admin-mutations.ts](src/features/admin/hooks/use-admin-mutations.ts)
    with `useVerifyMembership`, `useDenyMembership`,
    `useAdminPendingVerifications` (query)
  - Tests
  - _Requirements: R9.1_ — _Design: §3.6_

- [x] **10.8 Convert admin users page into tabs**
  - Edit [src/app/admin/dashboard/users/page.tsx](src/app/admin/dashboard/users/page.tsx)
    to render shadcn `Tabs`: "All Users" (existing content) and
    "Pending Verifications" (new tab from 10.6)
  - Pending-tab label includes count badge from queue length
  - _Requirements: R9.1_ — _Design: §3.7_

- [x] **10.9 Build admin community CRUD UI**
  - Add `src/features/admin/components/community-management/communities-list.tsx`
    and `community-edit-form.tsx`
  - Form: name, address, city, state, zip, image, lat/lng, isActive,
    networkId (single dropdown populated from `community_networks`)
  - Mount under `src/app/admin/dashboard/communities/page.tsx` (new route)
  - Tests
  - _Requirements: R9.2, R9.3_ — _Design: §3.7_

---

## 11. Wire search consumers to new visibility-aware DAL

- [x] **11.1 Update `/api/listings/search` to use new signature**
  - Edit [src/app/api/listings/search/route.ts](src/app/api/listings/search/route.ts)
  - Replaced `getCurrentUserCommunityId()` with
    `getCurrentUserVisibleCommunityIds()`; removed the old "must be a member
    of a community" 400 (an authenticated user now always has a visibility set)
  - Passes the IDs array to `listingDAL.searchListings`
  - When IDs empty, returns an empty page without a DB hit via the new
    `emptyPaginatedResult` helper ([src/lib/api/pagination.ts](src/lib/api/pagination.ts))
  - Added `src/app/api/listings/search/__tests__/route.test.ts`
  - _Requirements: R8.3_ — _Design: §3.5_

- [x] **11.2 Update service-listing search consumers**
  - `findByCommunityForBrowse` now takes `visibleCommunityIds: string[]`
    (changed in task 5.3). Updated both callers:
    - [src/app/api/services/listings/route.ts](src/app/api/services/listings/route.ts) — GET
      now resolves `getCurrentUserVisibleCommunityIds()` instead of the
      single-membership lookup (removed the 403)
    - [src/app/dashboard/services/page.tsx](src/app/dashboard/services/page.tsx) — same;
      keeps the "need to be a member" empty-state when the visibility set is empty
  - Updated `src/app/api/services/listings/__tests__/route.test.ts`
  - _Requirements: R8.4_ — _Design: §3.3_

- [x] **11.3 Audit other listing-query call sites**
  - Callers of `listingDAL.searchListings`: the search route (11.1) and
    [src/app/dashboard/explore/page.tsx](src/app/dashboard/explore/page.tsx)
    (prefetch) — both now pass the visible-IDs array and gate the prefetch
    on `visibleCommunityIds.length > 0`
  - Callers of `serviceListingDAL` search: covered by 11.2
  - Fixed `src/features/listings/__tests__/integration/approval-visibility.test.ts`
    (passed `string` where `string[]` is now expected)
  - `bun run type-check` clean (TS would have caught any remaining old-signature call site)
  - _Requirements: R8.3_ — _Design: §3.3_

---

## 12. UI: Pending verification badge

- [x] **12.1 Show "verification pending" badge on user profile**
  - Added `CommunityDAL.getPrimaryMembershipForUser(userId)` — distinct from
    `getMembershipForUser`, it filters `is_primary = true` so the badge
    reflects the home community's verification status (unit tests added in
    [src/dal/**tests**/community.dal.test.ts](src/dal/__tests__/community.dal.test.ts))
  - Added `src/features/users/components/pending-verification-badge.tsx`
    ("Verification Pending" `Badge` + amber styling + a `title` that spells
    out that access is _not_ gated while pending — R2.7) with tests in
    `src/features/users/components/__tests__/pending-verification-badge.test.tsx`
  - Mounted on [src/app/dashboard/profile/page.tsx](src/app/dashboard/profile/page.tsx)
    under the user's name, rendered only when the primary membership is
    `pending`
  - _Requirements: R2.6, R2.7_ — _Design: §3.7 (implied)_

---

## 13. E2E tests + e2e seed updates

- [x] **13.1 Update [signup-funnel.spec.ts](e2e/auth/signup-funnel.spec.ts)**
  - Funnel rewritten: `/signup` → `/verify-email` → `/community-select`
    (select Foxcroft from the dropdown, click Continue) → `/onboarding` →
    `/dashboard`. Extracted the shared signup+verify steps into
    [e2e/auth/helpers.ts](e2e/auth/helpers.ts) (`signupAndReachCommunitySelect`)
  - _Requirements: R13.1_ — _Design: §7.3_

- [x] **13.2 Update [status-redirect.spec.ts](e2e/auth/status-redirect.spec.ts)**
  - `email_verified` user (login + `/dashboard` navigation) now redirects to
    `/community-select`; added a case asserting `/join-code` is still
    reachable by direct URL for an `email_verified` user (R1.5)
  - _Requirements: R13.2_ — _Design: §7.3_

- [x] **13.3 Add new e2e test for community-selection**
  - [e2e/auth/community-select.spec.ts](e2e/auth/community-select.spec.ts):
    dropdown populated (Foxcroft + a second community visible), "Request your
    community" opens the modal, selecting one persists + redirects to
    `/onboarding` (and re-visiting `/community-select` then bounces forward),
    "Enter it here" links to `/join-code`
  - _Requirements: R13.4_ — _Design: §7.3_

- [x] **13.4 Add new e2e test for legacy `/join-code` path**
  - [e2e/auth/join-code-legacy.spec.ts](e2e/auth/join-code-legacy.spec.ts):
    a freshly verified user reaches `/join-code` by direct URL, submits
    `E2E_JOIN_CODE`, and the legacy code-based membership grant still routes
    to `/onboarding`
  - _Requirements: R13.6, R1.5_ — _Design: §7.3_

- [x] **13.5 Update [e2e/auth/constants.ts](e2e/auth/constants.ts)**
  - Added `E2E_PRIMARY_COMMUNITY_NAME = "Foxcroft"`,
    `E2E_SECONDARY_COMMUNITY_NAME = "Glen Arbor Estates"`, and the two new
    seeded users (`E2E_USER_METRO_MEMBER`, `E2E_USER_PENDING_MEMBER`);
    `E2E_JOIN_CODE` kept for the legacy-path test
  - _Requirements: R13.5_ — _Design: §5.3_

- [x] **13.6 Update test fixtures + e2e seed**
  - [src/test/fixtures/community.ts](src/test/fixtures/community.ts) already
    carries network + visibility + pending-membership shapes (added in §1/§4);
    added `mockSelectCommunityData` to
    [src/test/fixtures/auth.ts](src/test/fixtures/auth.ts) for the new flow
  - [src/db/seeds/e2e.seed.ts](src/db/seeds/e2e.seed.ts): added
    `metro_member@e2e.test` (active, primary in Foxcroft, full KC Metro
    visibility) and `pending_member@e2e.test` (active, primary in Glen Arbor
    Estates with `verification_status='pending'`) — the fixtures the
    visibility-settings and admin-verification e2e tests need
  - _Requirements: R13.7_ — _Design: §7.3_

- [x] **13.7 Add e2e for visibility settings**
  - [e2e/auth/visibility-settings.spec.ts](e2e/auth/visibility-settings.spec.ts):
    `metro_member@e2e.test` logs in, visits `/dashboard/profile`, asserts the
    home-community switch is checked + disabled, toggles a non-primary
    community off, saves (asserts `PATCH /api/users/me/visibility` → 200),
    reloads, asserts the off state persisted
  - _Requirements: R4.3, R4.5_ — _Design: §7.3_

- [x] **13.8 Add e2e for admin verification queue**
  - [e2e/auth/admin-verification-queue.spec.ts](e2e/auth/admin-verification-queue.spec.ts)
    (ordered tests): `pending_member@e2e.test`'s profile shows the
    "Verification Pending" badge → admin opens the Pending Verifications tab,
    clicks Verify (asserts the verify POST → 200), the row leaves the queue →
    the now-verified user's profile no longer shows the badge
  - _Requirements: R9.1, R2.6_ — _Design: §7.3_

> Note: e2e specs are type-checked / linted here but not executed (no E2E
> DB/server in this environment). They need a run via `bun run test:e2e:auth`
> against the migrated + seeded E2E DB — that's task 15.2.

---

## 14. Cross-spec doc updates

- [x] **14.1 Update related spec test plans**
  - [specs/auth/4-test-plan.md](specs/auth/4-test-plan.md): added a cross-spec
    note (post-verification step is now `/community-select`; legacy `/join-code`
    preserved per R1.5); `AuthService.selectPrimaryCommunity` +
    `POST /api/auth/select-community` + `GET /api/communities` +
    `CommunitySelectForm` + `useSelectCommunity` coverage; annotated
    `joinCommunityAction`/`JoinCodeForm` as legacy (now pre-verified primary);
    updated the email-verification integration flow, the unauthorized-access
    and signup/community-select/legacy E2E entries, added a "Post-verification
    community selection" BDD feature, added `mockSelectCommunityData` fixture,
    refreshed coverage targets + the existing/missing-coverage lists
  - [specs/onboarding/4-test-plan.md](specs/onboarding/4-test-plan.md): added a
    cross-spec note (onboarding is entered after community select; pending
    verification is a trust signal not a gate; the onboarding address is what
    admins review); updated the E2E workflow + BDD background/scenarios
  - [specs/community/4-test-plan.md](specs/community/4-test-plan.md): rewritten
    to cover networks, `community_visibility` (symmetric, primary-locked),
    `selectPrimaryCommunity`, the admin verification queue + audit logging,
    `getCurrentUserVisibleCommunityIds`, the legacy join-code path, migration
    backfill idempotency, the new E2E specs, and BDD scenarios; points at the
    multi-community engineering/UAT plans as the owning docs
  - The multi-community [4-uat-test-plan.md](./4-uat-test-plan.md) was reviewed
    and is already current — no changes needed
  - _Requirements: R13.8_

---

## 15. Pre-merge verification

- [x] **15.1 Run full test suite (unit + integration)**
  - `bun run test:run`: **269 test files passed (3605 tests passed, 7
    skipped)** — no regressions. `bun run type-check` and `bun run lint`
    both clean.
  - Coverage thresholds: none enforced — `thresholds` is commented out in
    [vitest.config.mjs](vitest.config.mjs), so "per project conventions"
    is a no-op here. Coverage report still produced via `bun run
test:coverage` if needed.

- [ ] **15.2 Run e2e suite against migrated dev DB** _(deferred to user —
      needs Docker Postgres + Next server)_
  - Run: `bun run e2e:db:up && bun run e2e:setup && bun run db:migrate:e2e
&& bun run e2e:seed && bun run test:e2e:auth` (then `bun run
e2e:db:down`)
  - All updated + new e2e tests pass; existing unrelated e2e suites still
    pass

- [x] **15.3 EXPLAIN ANALYZE the new search query**
  - Re-ran [scripts/explain-search-listings.ts](scripts/explain-search-listings.ts)
    against the dev DB (viewer with 11 visible communities, 16 candidate
    listings). DB-side `Execution Time: 0.331 ms`; round-trip p50 34 ms /
    p95 63 ms over 10 trials — well inside the design §8.3 budget. Updated
    baseline recorded in
    [5-implementation-notes.md §13.1](./5-implementation-notes.md#131-explain-analyze--visibility-aware-listing-search-task-54).
  - Caveat: at this tiny dev-DB scale the planner picks a `Seq Scan` on
    `community_visibility` (cheaper than the partial index when the table
    is ~76 rows). The earlier 3-community baseline showed the partial index
    in use; re-confirm index usage when re-running against prod-shape data.
    Both runs must go in the PR description.
  - _Requirements: R14.1_ — _Design: §7.4_

- [ ] **15.4 Manual smoke through the flow** _(deferred to user — browser
      walkthrough)_
  - Sign up new user → verify email → land on /community-select → pick
    Foxcroft → land on /onboarding → submit address → land on /dashboard
  - Browse listings (should see metro-wide results)
  - Toggle off a non-primary community in profile → confirm those
    listings disappear
  - As admin: verify the new user's pending membership; observe badge
    update on user profile

---

## Requirements coverage matrix

| Requirement                                                       | Tasks                                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 (community search)                                             | 1.2, 4.2, 7.1, 8.1, 8.2, 9.1, 10.1, 10.2, 13.1, 13.3                                                                                              |
| R2 (address verification)                                         | 4.4, 4.5, 8.6, 8.7, 12.1, 13.8                                                                                                                    |
| R3 (one primary)                                                  | 1.3, 4.2, 7.1                                                                                                                                     |
| R4 (visibility)                                                   | 1.4, 4.3, 8.3, 8.4, 10.3, 10.4, 10.5, 13.7                                                                                                        |
| R5 (per-community listing visibility, symmetric)                  | 5.1, 5.2, 5.3                                                                                                                                     |
| R6 (networks)                                                     | 1.1, 1.2, 4.1, 8.8, 10.9                                                                                                                          |
| R7 (geo data)                                                     | 1.2                                                                                                                                               |
| R8 (feed / search / single-listing & provider-profile visibility) | 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 11.1, 11.2, 11.3; R8.9/R8.10 fix: detail, booking/rent, and provider-profile gates (see 5-implementation-notes §14) |
| R9 (admin tooling)                                                | 4.4, 4.5, 8.5, 8.6, 8.7, 8.8, 10.6, 10.7, 10.8, 10.9, 13.8                                                                                        |
| R10 (migration)                                                   | 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3                                                                                                            |
| R11 (routing)                                                     | 9.1, 9.2                                                                                                                                          |
| R13 (e2e)                                                         | 13.1–13.8, 14.1                                                                                                                                   |
| R14 (performance)                                                 | 1.4, 5.4, 6.1, 11.1, 15.3                                                                                                                         |

## Parallelization opportunities

After §1–§3 land (schema + migrations + seeds), the following can
proceed in parallel:

- §4 (CommunityDAL extensions)
- §5 (Listing search rewrite — depends on §1.4 only)
- §6 (cache helper — depends on §4.3 only)

After §4 + §6 land, §7–§10 can run mostly in parallel:

- §7 (auth service)
- §8 (API routes — different routes are independent)
- §10 (UI components — different components are independent)

§11 depends on §5 + §6. §13 depends on the e2e seed update from §3 and the
UI from §10.
