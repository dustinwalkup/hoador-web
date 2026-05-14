# Test Plan: Community

## Requirements Traceability

This test plan covers community membership functionality including community
selection, networks, per-community visibility, admin residency verification,
and the legacy join-code path. Tests verify community access, membership
validation, symmetric visibility, and authorization requirements.

> **Cross-spec note:** The community model was substantially expanded by the
> [Multi-Community Marketplace](../multi-community-marketplace/1-requirements.md)
> spec — networks, `community_visibility`, primary memberships, and the admin
> verification queue. The engineering test plan that owns the bulk of those
> scenarios is
> [multi-community-marketplace/4-test-plan.md](../multi-community-marketplace/4-test-plan.md);
> the UAT plan is
> [multi-community-marketplace/4-uat-test-plan.md](../multi-community-marketplace/4-uat-test-plan.md).
> This file tracks the community-feature-local view of that coverage.

**Test Coverage**:

- Unit tests: Community/membership utilities, the per-request visible-IDs
  cache helper, `CommunityDAL` (networks, visibility, verification queue)
- Integration tests: Community-selection flow, legacy join-code flow,
  visibility-filtered listing search, migration backfill idempotency
- E2E tests: Community-selection screen, visibility settings, admin
  verification queue, legacy `/join-code` path
- BDD scenarios: Community-selection and symmetric-visibility acceptance criteria

## Test Types

### Unit Tests

#### Utilities

- [ ] `membership.ts` — community membership utilities
  - `getCurrentUserCommunity` / `getCurrentUserCommunityId`: returns the
    user's (primary) community or `null` when unauthenticated; cached
    within request scope
  - `requireCommunityMembership`: throws when the user has no membership
  - `getCurrentUserVisibleCommunityIds`: returns the user's visible
    community-ID array (hot path); returns `[]` for an unauthenticated
    user; wrapped in React `cache()` so it executes once per request
  - Error handling: unauthenticated scenarios

#### DAL Methods (`CommunityDAL`)

- [ ] **Network reads** — `getNetworkById`, `getNetworkBySlug`,
      `listNetworks`, `listCommunitiesByNetwork(networkId, { activeOnly? })`
  - Happy path returns expected rows; unknown id/slug returns `null`
  - `activeOnly` filter excludes inactive communities

- [ ] **`selectPrimaryCommunity(userId, communityId)`**
  - Happy path: inserts membership with `is_primary=true`,
    `verification_status='pending'`
  - Throws `ConflictError` when the user already has a primary membership
  - Throws `ValidationError` for an inactive community
  - Throws for an unknown community

- [ ] **Visibility methods**
  - `initializeUserVisibility(userId, networkId)`: bulk-inserts one row per
    active community in the network; `ON CONFLICT DO NOTHING` (idempotent)
  - `getVisibleCommunityIds(userId)`: returns `string[]`
  - `getVisibilityForUser(userId)`: returns rows joined with community info
  - `bulkSetVisibility(userId, updates[])`: upserts; **rejects** any update
    that sets the user's primary community to `is_visible=false`
    (`ValidationError`)

- [ ] **Admin verification queue**
  - `listPendingVerifications({ page, limit, communityId? })`: returns
    paginated rows joined with user + submitted address; oldest-first
  - `verifyMembership(membershipId, adminUserId, adminNotes?)`: sets
    `verification_status='verified'`, populates `verifiedAt`, `verifiedBy`;
    writes an `audit_logs` row via `AuditLogDAL`
  - `denyMembership(membershipId, adminUserId, adminNotes)`: requires
    notes (`ValidationError` when missing); sets status to `denied`;
    writes an audit row
  - `getPrimaryMembershipForUser(userId)`: returns the `is_primary=true`
    membership (drives the pending-verification badge)
  - Error handling: unknown membership id → `NotFoundError`

#### Legacy

- [ ] `joinCommunityForNewUser` (legacy join-code path) — still creates a
      membership, now also sets `is_primary=true` and
      `verification_status='verified'` (code-based joins are pre-trusted)

### Integration Tests

- [ ] **Community-selection flow: form → API → service → DAL → DB**
  - User selects a community → `POST /api/auth/select-community` →
    `AuthService.selectPrimaryCommunity` → primary membership created,
    visibility rows initialized for the network, user status →
    `incomplete_profile`, redirect to `/onboarding`
  - Existing-primary conflict → 409; inactive community → 400

- [ ] **Legacy join-code flow: code → validation → membership**
  - User enters a valid code → membership granted as primary + verified →
    continues to onboarding
  - Invalid code → error; DB unchanged

- [ ] **Visibility-filtered listing search** (symmetric, per-community)
  - A listing appears for a viewer only when the viewer **and** the owner
    both have `is_visible = true` for the listing's own `community_id`
  - Listing whose `community_id` is hidden by the viewer (or by the owner,
    or has no owner row) is excluded — even if the viewer shares other
    visible communities with the owner
  - Listing surfaces exactly once (the `community_visibility` join is 1:1
    with the listing)
  - Empty visible-ID set → empty result, no DB hit

- [ ] **Single-listing & provider-profile visibility** — `communityDAL.isVisibleInCommunity`,
      the tool/service detail + booking/rent pages, `GET /api/services/listings/[id]`,
      and the provider profile page + `GET /api/services/providers/[userId]`
  - `isVisibleInCommunity(userId, communityId)`: true / false / fail-closed
    when no row exists
  - Detail / booking / rent paths return the listing to the owner always; to a
    non-owner only when the listing is browseable AND both viewer and owner are
    visible in its `community_id`; `notFound()` / `403` otherwise
  - Provider profile: viewable when viewer and provider share ≥1 community
    where both are visible (self always); listings shown are scoped to that
    shared set
  - A listing in a viewer's browse feed is openable by that viewer (browse,
    detail, and booking/rent all enforce the same rule)

- [ ] **Migration backfill idempotency**
  - Running the backfill migration twice produces no duplicate rows, no
    errors, and does not overwrite `verified_at`

### E2E Tests

- [ ] **Community-selection screen**
      ([e2e/auth/community-select.spec.ts](e2e/auth/community-select.spec.ts))
  - Dropdown populated with active network communities
  - "Request your community" opens the inquiry modal
  - Selecting a community persists it and redirects to `/onboarding`;
    re-visiting `/community-select` bounces forward
  - "Enter it here" links to `/join-code`

- [ ] **Legacy `/join-code` path**
      ([e2e/auth/join-code-legacy.spec.ts](e2e/auth/join-code-legacy.spec.ts))
  - A freshly verified user reaches `/join-code` by direct URL, submits
    `E2E_JOIN_CODE`, and the legacy membership grant routes to `/onboarding`

- [ ] **Visibility settings**
      ([e2e/auth/visibility-settings.spec.ts](e2e/auth/visibility-settings.spec.ts))
  - Home-community switch is checked + disabled
  - Toggling a non-primary community off and saving persists across reload
  - `PATCH /api/users/me/visibility` returns 200

- [ ] **Admin verification queue**
      ([e2e/auth/admin-verification-queue.spec.ts](e2e/auth/admin-verification-queue.spec.ts))
  - A pending user's profile shows the "Verification Pending" badge
  - Admin opens the Pending Verifications tab, clicks Verify (POST → 200),
    the row leaves the queue, the user's badge clears

## Coverage Goals

- **Utilities**: 90%+ (`membership.ts`, including the visible-IDs cache helper)
- **DAL Methods**: 85%+ for the new network/visibility/verification methods
  (`bulkSetVisibility` primary-locked rule and `searchListings` symmetric
  per-community visibility are must-cover); 70%+ overall (exceeds 50% threshold)
- **Overall**: > 85% lines (meets 80% threshold)

## BDD Scenarios

```gherkin
Feature: Community selection after email verification
  As a new resident
  I want to pick my community from the metro list
  So that I can onboard without a private invite code

  Background:
    Given I have verified my email
    And I do not yet have a primary community

  Scenario: Select a community from the network list
    Given I am on the community-select page
    When I choose a community from the dropdown
    And I continue
    Then a primary membership is created with verification status "pending"
    And visibility rows are initialized for every community in that network
    And I am redirected to onboarding

  Scenario: Cannot select an inactive community
    Given a community in the network has been deactivated
    Then it does not appear in the community-select dropdown

  Scenario: Legacy private-invite code still works
    Given I navigate directly to the join-code page
    When I submit a valid join code
    Then a primary membership is created with verification status "verified"
    And I am redirected to onboarding

Feature: Symmetric per-community visibility
  As a resident
  I want turning off a neighboring community to hide listings in both directions
  So that my privacy expectations match my settings

  Scenario: Primary community visibility is locked on
    Given I am on my profile's community visibility section
    Then the toggle for my home community is disabled
    And an attempt to set it to off is rejected

  Scenario: Hiding a non-primary community
    When I turn off visibility for a neighboring community and save
    Then I no longer see any listing whose home community is that community
    And my own listings whose home community is that community are no longer
        shown to anyone
    And listings I have in other communities are unaffected
    And the change persists after a refresh

Feature: Admin residency verification
  As a platform admin
  I want to verify or deny pending residency claims with notes
  So that the trust badge is accurate

  Scenario: Verify a pending membership
    Given a pending membership is in the queue
    When I click Verify
    Then the membership status becomes "verified"
    And an audit log row records my user id and the decision
    And the row leaves the queue

  Scenario: Deny requires documentation
    Given a pending membership is in the queue
    When I attempt to deny without notes
    Then the application blocks me until I provide a reason
```

## Existing Test Coverage

- `CommunityDAL` network/visibility/verification methods and the
  `getCurrentUserVisibleCommunityIds` helper have unit tests added under
  the multi-community work — see
  [src/dal/**tests**/community.dal.test.ts](src/dal/__tests__/community.dal.test.ts)
  and
  [src/features/community/utils/**tests**/membership.test.ts](src/features/community/utils/__tests__/membership.test.ts)

## Missing Test Coverage

- Legacy `membership.ts` join-code utilities still lack dedicated unit tests
- Cross-browser passes for the visibility UI are tracked in the
  multi-community UAT plan, not here
