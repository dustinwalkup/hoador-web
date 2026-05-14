# Requirements Document: Multi-Community Marketplace Expansion

## Introduction

HOADOR is expanding from a single-community HOA marketplace into a connected
neighborhood marketplace network. Today, users belong to exactly one HOA via
a join code and can only see/share listings inside that single community. With
this update, users still have **one verified primary community** for trust
and moderation, but listings and marketplace visibility extend across all
communities in a shared regional **network** (the initial network being
**Kansas City Metro**).

The product principle is:

> Verified local residents participating in a connected neighborhood
> marketplace.

The core trust model — one verified home community per user — is preserved.
What changes is **how marketplace exposure works**: liquidity, inventory
visibility, and growth all extend across nearby neighborhoods, while
neighborhood identity stays intact.

### Initial Communities (Kansas City Metro)

Glen Arbor Estates · Foxcroft · Timber Trace · Blue Hills Estates ·
Redbridge North · Verona Gardens · Redbridge Estates · Leawood Estates

### Key Architectural Decisions (resolved in clarifications)

These decisions are inputs to every requirement below; capturing them here so
they are not re-litigated:

1. **Signup flow** — `/join-code` is replaced with a community-search step;
   address is still collected at `/onboarding` (unchanged location).
2. **Listings model** — `listings.community_id` and
   `service_listings.community_id` are the listing's **home community**: the
   single community a listing surfaces through, and the denormalized truth
   for ownership and dispute jurisdiction. A listing with `community_id = X`
   is visible to a viewer only when **both** the owner and the viewer have
   `community_visibility(X).is_visible = true` (symmetric). There is no
   per-listing visibility table.
3. **Default visibility** — On signup, a user becomes auto-visible in every
   community in their network immediately, **before** primary-community
   verification. Verification is a trust signal (badge), not a marketplace
   gate.
4. **Migration** — All existing data is preserved via backfill SQL.
5. **Pending verification gates** — Pending users have full marketplace access
   (browse, list, message, rent). A "pending verification" badge is shown.
6. **Join codes** — `communities.join_code` becomes nullable. Existing codes
   are preserved for backward compatibility and future private-invite use,
   but the search-based flow is the default new-user path.
7. **Geographic storage** — Plain numeric `latitude`/`longitude` columns on
   `communities` only. No polygon/GeoJSON column in MVP — added later when
   needed (cheap `ALTER TABLE`). No PostGIS extension.
8. **Verification status enum** — Reuse existing `verification_status` enum
   (`pending | verified | denied`). `manual_review` is deferred.
9. **Network model** — Each community belongs to **at most one** network via
   a single `network_id` FK on `communities`. Many-to-many is deferred.
10. **Visibility ≠ membership** — A user has exactly one primary membership
    plus N rows in `community_visibility` for each community in their
    network. They are not "members" of those other communities.
11. **Single-layer visibility / symmetric** — `community_visibility` is the
    SOLE source of truth for cross-community exposure. Toggling community X
    off is symmetric: every listing with `community_id = X` disappears from
    the user's search AND every one of the user's own listings with
    `community_id = X` disappears from everyone else's search. A listing is
    visible to a viewer only when both the owner and the viewer have
    `community_visibility(X).is_visible = true`. There is no per-listing
    override (deferred to a future phase if needed). A user CANNOT toggle
    visibility off for their own primary community.
12. **MVP admin scope** — Membership verification queue and community CRUD.
    Network assignment is a single dropdown on the community CRUD form (no
    dedicated networks-management UI). Per-user visibility audit deferred.
13. **Moderation** — All listing/user moderation is handled by platform
    admins (any user with `userType` of `admin` or `superadmin`). There is
    no community-scoped moderator role.
14. **Community changes** — MVP does not support self-service primary-
    community changes. A user requesting a change contacts support; an
    admin updates the membership manually. Self-service flow is deferred.
15. **Messaging scope** — Messages are scoped to a specific rental/service
    interaction (initiated from a listing), not free-form user-to-user.
    The multi-community model affects listing discovery only; messaging
    inherits whatever listing the conversation is attached to.
16. **Rollout** — No feature flags. Migrations are additive (new columns/
    tables, no destructive drops) and idempotent. Rollback strategy is
    fix-forward via `git revert` + redeploy. The migration's backfill SQL
    runs in a transaction and is safe to retry.

---

## Requirements

### Requirement 1: Replace Join Code with Community Search at Signup

**User Story:** As a new user signing up, I want to search for and select my
community from a list, so that I can join HOADOR even if I don't have a
join code from an administrator.

#### Acceptance Criteria

1. WHEN a user reaches the post-email-verification step
   THEN the system SHALL present a community-selection screen at
   `/community-select` (replacing the current `/join-code` screen as the
   canonical path).
2. WHEN the user opens `/community-select`
   THEN the system SHALL display the full list of active communities in the
   default network (Kansas City Metro) with a client-side text filter input.
   No server-side autocomplete is required for MVP (~8 communities).
3. WHEN the user selects a community from the list
   THEN the system SHALL set that community as the user's `is_primary = true`
   membership with `verification_status = 'pending'`.
4. WHEN the user's community cannot be found in the list
   THEN the system SHALL surface the existing "Request Hoador for your
   community" flow (`hoa-inquiries` modal) so they can request it.
5. The system SHALL preserve the existing `/join-code` route as a legacy /
   private-invite path so admin-issued codes remain functional. The link to
   it is NOT prominent on `/community-select` (e.g., a small "Have a private
   invite code?" affordance, or accessible by direct URL only).
6. IF a user attempts to bypass community selection (e.g., direct URL to
   `/onboarding`) THEN the proxy/middleware SHALL redirect them to
   `/community-select`.
7. The community list SHALL be filterable by case-insensitive substring
   match on community name. Server-side search is deferred until the network
   exceeds ~50 communities.

---

### Requirement 2: Address Collection & Verification

**User Story:** As a verified resident, I want to submit my street address
during onboarding so that admins can verify I actually live in the community
I claim.

#### Acceptance Criteria

1. WHEN a user reaches the onboarding step
   THEN the system SHALL collect: street address (required), unit/apartment
   number (optional), city, state, ZIP code (already collected today).
2. The system SHALL persist the address in the existing `user_addresses`
   table with `is_primary = true`.
3. WHEN a user submits their address during onboarding
   THEN the system SHALL set their primary `community_memberships`
   `verification_status = 'pending'` and `verified_at = NULL`.
4. The system SHALL allow admins to transition a membership's
   `verification_status` between `pending → verified` or `pending → denied`
   via the admin UI (Requirement 9).
5. WHEN an admin sets `verification_status = 'verified'`
   THEN the system SHALL set `verified_at = NOW()` and persist the admin's
   user id (`verified_by`) plus an optional `admin_notes` text field.
6. The system SHALL display a "verification pending" badge on the user's
   profile until their primary membership is verified.
7. The system SHALL NOT block any marketplace action (browse, list, message,
   rent) based on verification status. Verification is a trust signal only.
8. The system SHALL preserve geographic verification (lat/lng & polygon
   containment) as **deferred** scope; only manual admin verification ships
   in MVP.

#### MVP Verification Procedure (admin runbook)

For each pending membership in the verification queue, the admin SHALL:

1. Open the user's submitted address (street, unit, city, state, ZIP).
2. Confirm the address falls within the claimed community's boundaries
   using one or more of:
   - Google Maps / Street View against known community layout
   - County assessor / parcel records (e.g., Johnson County, Jackson
     County, etc.)
   - HOA-provided resident list or community board confirmation
3. Click **Verify** if the address is within boundaries — `verified_at` and
   `verified_by` are set automatically.
4. Click **Deny** with a reason in `admin_notes` if the address is clearly
   outside the community or appears fraudulent. The user SHALL be able to
   re-submit a corrected address (deferred UX — for MVP they contact
   support).
5. Leave as **Pending** if the verification is ambiguous; add a note for
   follow-up. Pending users retain full marketplace access (Architectural
   Decision #5), so leaving in pending is non-blocking.

---

### Requirement 3: One Verified Primary Community per User

**User Story:** As a HOADOR user, I want a single home community tied to my
identity, so that the platform's trust model and moderation are clear.

#### Acceptance Criteria

1. The system SHALL extend `community_memberships` with:
   - `is_primary BOOLEAN NOT NULL DEFAULT false`
   - `verification_status verification_status NOT NULL DEFAULT 'pending'`
   - `verified_at TIMESTAMP` (nullable)
   - `verified_by TEXT` (nullable, FK → user.id)
   - `admin_notes TEXT` (nullable)
2. The system SHALL enforce that **at most one** row per user has
   `is_primary = true` (partial unique index on `(user_id) WHERE
is_primary = true`).
3. WHEN a user has no membership row, they MUST go through community
   selection before reaching the dashboard.
4. WHEN a user already has a primary membership, the system SHALL NOT offer
   a self-service primary-community change in MVP. The user contacts
   support to request a change; an admin manually updates the membership
   via the admin UI. Self-service community change is **deferred**.
5. The system SHALL backfill all existing memberships with `is_primary = true`
   and `verification_status = 'verified'` (since they joined under the
   pre-multi-community model and are already trusted).

---

### Requirement 4: Per-Community Visibility (Single-Layer, Symmetric)

**User Story:** As a user, I want a single switch per neighboring community
that controls whether I and that community can see each other's listings,
so that opting out of a community is unambiguous and all-or-nothing.

#### Acceptance Criteria

1. The system SHALL introduce a `community_visibility` table with columns:
   - `id UUID PK`
   - `user_id TEXT FK → user.id ON DELETE CASCADE`
   - `community_id UUID FK → communities.id ON DELETE CASCADE`
   - `is_visible BOOLEAN NOT NULL DEFAULT true`
   - `created_at TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMP NOT NULL`
   - Unique index on `(user_id, community_id)`.
2. WHEN a new user completes community selection
   THEN the system SHALL create one `community_visibility` row per community
   in the user's network with `is_visible = true`, including the user's
   primary community.
3. The system SHALL provide a settings UI (e.g., under the profile/settings
   page) where the user can toggle `is_visible` per community.
4. The system SHALL enforce **symmetric visibility**: when a user sets
   `is_visible = false` for community X, BOTH directions take effect:
   - That user's listings (rental and service) SHALL NOT appear in feeds
     filtered to community X.
   - Listings owned by users in community X SHALL NOT appear in this user's
     feed when sliced to community X.
5. The system SHALL prevent a user from toggling `is_visible = false` for
   the community where their membership has `is_primary = true`. The UI
   SHALL display the primary community's toggle as disabled with copy
   indicating it is the user's home community.
6. The system SHALL allow re-enabling visibility (`is_visible = true`)
   without data loss; toggles are reversible.
7. The system SHALL backfill `community_visibility` rows for all existing
   users: one row for each community in their network, all `is_visible =
true`.
8. The system SHALL treat absence of a `community_visibility` row for a
   `(user, community)` pair as **not visible** (fail-closed) to prevent
   accidental cross-network exposure.
9. WHEN an admin assigns a NEW community to an existing network
   THEN the system SHALL backfill `community_visibility` rows for all users
   already in that network with `is_visible = true` (so they participate
   by default in the newly added community).

---

### Requirement 5: Symmetric Per-Community Listing Visibility

**User Story:** As a member of one community, when I turn another community
off I want that community's listings gone from my search **and** my listings
gone from that community's search — a single toggle that severs the
connection both ways, with no per-listing fiddling.

#### Acceptance Criteria

1. The system SHALL NOT introduce a per-listing visibility table. A listing's
   visibility is derived from exactly two `community_visibility` rows: the
   owner's and the viewer's, both for the listing's `community_id`.
2. The system SHALL treat `listings.community_id` and
   `service_listings.community_id` as the listing's **home community** — the
   single community a listing surfaces through (also the denormalized truth
   for ownership, moderation, and dispute jurisdiction). A listing never
   appears in any community other than its `community_id`.
3. The system SHALL determine whether a listing with `community_id = X`,
   owner O, is visible to viewer V using the rule: visible **if and only if
   both** O has `community_visibility(X).is_visible = true` **and** V has
   `community_visibility(X).is_visible = true`. Absence of a row counts as
   `false` (fail-closed).
4. The system SHALL apply the same rule uniformly to both `listings`
   (rental/tool) and `service_listings`.
5. The system SHALL NOT require any data migration to `listings` or
   `service_listings` for this feature; the existing `community_id` columns
   remain unchanged. (`community_id` is `NOT NULL` on both tables, so every
   listing has a well-defined home community.)
6. The system SHALL NOT duplicate listing records to achieve multi-community
   exposure; a listing has exactly one row and one `community_id`, and the
   search joins listing → owner's `community_visibility(community_id)`.
7. WHEN a user toggles `community_visibility.is_visible = false` for
   community X
   THEN ALL of that user's listings whose `community_id = X` (every rental
   and every service listing) SHALL atomically stop appearing in everyone's
   search — without any per-listing row updates.
8. WHEN a user toggles `community_visibility.is_visible = false` for
   community X
   THEN that user SHALL no longer see any listing whose `community_id = X` in
   their search results.

---

### Requirement 6: Community Network Support

**User Story:** As a product owner, I want communities grouped into regional
networks so that the marketplace can scale beyond a single metro area.

#### Acceptance Criteria

1. The system SHALL introduce a `community_networks` table with columns:
   - `id UUID PK`
   - `name VARCHAR(255) NOT NULL UNIQUE`
   - `slug VARCHAR(100) NOT NULL UNIQUE`
   - `description TEXT`
   - `is_active BOOLEAN NOT NULL DEFAULT true`
   - `created_at TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMP NOT NULL`
2. The system SHALL add `network_id UUID` (nullable) to `communities`,
   referencing `community_networks.id`.
3. The system SHALL seed a single network "Kansas City Metro" (slug:
   `kansas-city-metro`) and assign all 8 initial communities to it.
4. The system SHALL NOT hard-code mileage or radius logic; cross-community
   exposure is determined entirely by network membership (and per-user
   `community_visibility`).
5. WHEN a community has `network_id = NULL`
   THEN it SHALL behave like a standalone community (visible only to its
   own members) — not part of any network's shared marketplace.
6. The system SHALL allow admins to assign or change a community's
   `network_id` via the admin UI (Requirement 9).

---

### Requirement 7: Geographic Data Support on Communities

**User Story:** As a product owner, I want to store community centroid
coordinates so we can later build map-based browsing without a downstream
schema change, while keeping MVP scope tight.

#### Acceptance Criteria

1. The system SHALL add to `communities`:
   - `latitude DECIMAL(10,8)` (nullable) — community centroid
   - `longitude DECIMAL(11,8)` (nullable) — community centroid
2. The system SHALL NOT add a polygon / GeoJSON column in MVP. When polygon-
   based features (residency verification, map containment, etc.) are
   actually needed, the column can be added via `ALTER TABLE`.
3. The system SHALL NOT depend on the PostGIS extension. Distance logic,
   when introduced, uses Haversine in app code or SQL.
4. The system SHALL leave `latitude` / `longitude` NULL for the initial
   seeded communities (populated later by admin via the community CRUD UI).
5. The system SHALL treat all map-search, polygon-verification, distance-
   filtering, and nearby-community features as **deferred scope** (out of
   MVP).

---

### Requirement 8: Listing Feed & Search Logic

**User Story:** As a user browsing the marketplace, I want to see a listing
only when both its owner and I have its home community toggled visible, so
turning a community off cleanly removes that community's listings from my
feed (and mine from theirs).

#### Acceptance Criteria

1. WHEN a user requests the marketplace search/feed
   THEN the system SHALL return a listing (`community_id = X`, owner O) if
   and only if:
   - The VIEWER has `community_visibility(viewer, X).is_visible = true`
     (i.e. `X` is in the viewer's precomputed visible-community set), AND
   - The OWNER has `community_visibility(O, X).is_visible = true`, AND
   - Existing filters (status, approval, isActive, owner ≠ viewer) still apply.
     A missing `community_visibility` row counts as `false` (fail-closed).
2. WHEN a user filters the feed to a specific community X
   THEN the system SHALL return only listings whose `community_id = X`, and
   only when the viewer has `community_visibility(viewer, X).is_visible =
true` (else return empty / 403-equivalent state).
3. The system SHALL retire the existing exact-match filter
   (`listings.community_id = userCommunityId`) in `searchListings` and
   replace it with: `listings.community_id IN (viewer's visible set)` plus an
   `INNER JOIN community_visibility` pinned to
   `(owner_id, listings.community_id)` requiring `is_visible = true`.
4. The system SHALL apply the same filtering logic to `service_listings`
   (no parallel join table needed — same `community_visibility` join, pinned
   to `(provider_id, service_listings.community_id)`).
5. The system SHALL support a "metro-wide" feed (default): the union of
   listings whose `community_id` is in the viewer's visible set (and whose
   owner is visible in that community).
6. The system SHALL preserve sorting (newest, price, rating, distance) and
   pagination semantics already in use.
7. The system SHALL treat distance-based sorting as **deferred** (still
   stub-supported, but no improved logic in MVP).
8. The system SHALL compute the viewer's set of visible community IDs ONCE
   per request (server-side cache or single query upfront) and pass that
   set into downstream listing queries — never per-listing lookups. An empty
   set short-circuits to an empty result with no DB hit.
9. The system SHALL apply the **same** visibility rule on every path that
   surfaces a single listing — the tool and service listing **detail** pages
   and their API routes, and the downstream **booking/rent** pages: the owner
   (provider) may always view their own listing; any other viewer may view it
   only when its `status` is browseable AND **both** the viewer and the owner
   have `community_visibility(listing.community_id).is_visible = true`. A
   listing not satisfying this returns `notFound()` / `403` — never a stale
   `community_id == viewer's primary community` check.
10. The system SHALL gate the **provider profile** page and its API route on
    the same model: a non-self viewer may see it only when the viewer and the
    provider share at least one community where **both** have
    `is_visible = true`; the active listings shown SHALL be scoped to that
    shared set. The provider sees their own profile and listings unfiltered.

---

### Requirement 9: Admin Tooling for Communities & Verification

**User Story:** As an admin, I need tooling to manage communities, verify
memberships, and assign communities to networks so the platform's trust
model can scale.

#### Acceptance Criteria

1. The system SHALL provide an **admin membership verification queue** that:
   - Lists all `community_memberships` with `verification_status =
'pending'`, sorted oldest-first.
   - Shows the user's submitted address, primary community, and any
     existing admin notes.
   - Lets the admin transition status to `verified` or `denied` per the
     verification procedure documented in R2.
   - Records `verified_at`, `verified_by`, and `admin_notes` on transition.
2. The system SHALL provide a **community CRUD UI** for admins:
   - Create / edit / activate / deactivate communities.
   - Edit name, address, city, state, zip, image, lat/lng, `is_active`,
     and `network_id` (the network is selected via a single dropdown
     populated from `community_networks`).
   - View member count, listing count, and pending-verification count per
     community.
3. The system SHALL NOT build a dedicated networks-management UI in MVP.
   The single seeded network ("Kansas City Metro") is created via migration;
   future networks are seeded via SQL. Network assignment to a community
   happens on the community edit form (per R9.2).
4. The system SHALL gate all admin endpoints behind the existing admin auth
   check (`getAdminUser` / `userType IN ('admin', 'superadmin')`).
5. The system SHALL audit-log all admin verification decisions
   (status changes, notes) into `audit_logs`.
6. All listing and user moderation SHALL be performed by platform admins
   (any user with `userType` of `admin` or `superadmin`). There is no
   community-scoped moderator role; an admin can act on any listing
   regardless of its home community (`community_id`). (Moderation reach is
   independent of the per-community _visibility_ rule in R5/R8.)
7. The system SHALL **defer** the per-user visibility audit/override UI to
   a later phase.

---

### Requirement 10: Database / Schema Changes & Migration

**User Story:** As a developer, I want the schema migration and backfill to
be atomic and reversible so that we can ship the multi-community model
without downtime or data loss.

#### Acceptance Criteria

1. The system SHALL add these new tables in a single migration:
   - `community_networks`
   - `community_visibility`
     (No `listing_communities` or `service_listing_communities` tables —
     listing visibility is derived from `community_visibility` rows keyed on
     the listing's `community_id`, per Requirement 5.)
2. The system SHALL alter `communities` to add:
   - `network_id` (nullable FK → `community_networks.id`)
   - `latitude DECIMAL(10,8)` (nullable)
   - `longitude DECIMAL(11,8)` (nullable)
   - `is_active BOOLEAN NOT NULL DEFAULT true`
   - Make `join_code` nullable (`DROP NOT NULL`).
     (No polygon / GeoJSON column in MVP — see R7.)
3. The system SHALL alter `community_memberships` to add:
   - `is_primary BOOLEAN NOT NULL DEFAULT false`
   - `verification_status verification_status NOT NULL DEFAULT 'pending'`
   - `verified_at TIMESTAMP`
   - `verified_by TEXT FK → user.id`
   - `admin_notes TEXT`
   - Add partial unique index `(user_id) WHERE is_primary = true`.
4. The migration SHALL include backfill SQL that:
   - Inserts the "Kansas City Metro" network row.
   - Sets `network_id` on each of the 8 initial communities (creating any
     missing seeded communities as needed).
   - For every existing `community_memberships` row: sets
     `is_primary = true` and `verification_status = 'verified'`.
   - For every existing user × every community in their network: inserts a
     `community_visibility` row with `is_visible = true`.
   - No backfill is required for `listings` or `service_listings`
     (their existing `community_id` is the home community used for visibility
     — see Requirement 5).
5. The system SHALL keep the existing tables `communities` and
   `community_memberships` (no rename/recreate).
6. The migration SHALL be split into ordered migration files so each step is
   independently reviewable.

---

### Requirement 11: Routing, Middleware, and User Status Flow

**User Story:** As a user, I want signup, verification, and onboarding
redirects to behave consistently with the new community-selection model.

#### Acceptance Criteria

1. The system SHALL update `proxy.ts` so that users with status
   `email_verified` are redirected to `/community-select` instead of
   `/join-code`.
2. The system SHALL retain `/join-code` as an accessible legacy route for
   private-invite scenarios (admin-issued codes). It is reachable by direct
   URL or via a small "Have a private invite code?" affordance on
   `/community-select`. It is no longer the canonical post-verification
   destination.
3. WHEN a user successfully completes community selection
   THEN the system SHALL transition `users.status` from `email_verified` to
   `incomplete_profile` (same transition as today's join-code flow).
4. The system SHALL NOT block any post-onboarding action based on
   `verification_status = 'pending'`.

---

### Requirement 12: Out-of-Scope (Defer Until Later)

The following are explicitly **deferred** to keep MVP scope tight. They
inform later spec phases but should not appear in this phase's design,
tasks, or implementation:

- Automated HOA detection by address geocoding.
- Polygon-based residency verification.
- Polygon / GeoJSON column on `communities` (added later via `ALTER TABLE`
  when needed).
- Map-based community / listing browsing.
- Self-service HOA admin onboarding.
- Self-service primary-community change flow (handled via support in MVP).
- Server-side community search / autocomplete (defer until network grows
  beyond ~50 communities).
- Distance-based search ranking improvements.
- Many-to-many community ↔ network relationships.
- Dedicated networks-management admin UI (assignment is a single dropdown
  on community CRUD for MVP).
- Per-user visibility audit/override admin UI.
- Community-scoped moderator role (all moderation handled by platform
  admins in MVP).
- The `manual_review` verification status state.
- Feature flag infrastructure (rollout uses additive migrations + fix-
  forward instead).
- **Per-listing visibility overrides.** Visibility is currently all-or-
  nothing per community: a listing surfaces through its `community_id` only,
  gated by both the owner's and the viewer's `community_visibility` for that
  community. A future need to hide a single listing independently could be a
  sparse override table (`listing_visibility_overrides`) layered on top.

---

### Requirement 13: E2E Test & Seed-Data Updates

**User Story:** As an engineer, I need the e2e test suite and seed data to
match the new community-selection flow so regressions are caught and the
test environment reflects production reality.

#### Acceptance Criteria

1. The system SHALL update the existing signup e2e test
   ([signup-funnel.spec.ts](e2e/auth/signup-funnel.spec.ts)) so the funnel
   walks through the new path:
   `signup → verify-email → /community-select → /onboarding → dashboard`.
   The existing `/join-code` step in this test is replaced with selecting
   a community from the new list UI.
2. The system SHALL update the status-based redirect e2e test
   ([status-redirect.spec.ts](e2e/auth/status-redirect.spec.ts)) so that
   `email_verified` users are expected to land on `/community-select`
   instead of `/join-code`.
3. The system SHALL update the e2e seed data
   ([e2e.seed.ts](src/db/seeds/e2e.seed.ts)) to:
   - Seed the "Kansas City Metro" network row.
   - Seed the 8 initial communities (or a representative subset) and
     attach them to the network.
   - Continue seeding the existing `E2E_JOIN_CODE` community as a private-
     invite community so the legacy `/join-code` route remains testable.
   - Backfill `community_visibility` rows for all seeded e2e users so they
     are visible in every community in their network by default.
   - Set `is_primary = true` and `verification_status = 'verified'` on
     existing seeded memberships.
4. The system SHALL add (at minimum) one new e2e test covering the
   community-selection screen:
   - User can filter the community list by name.
   - User can select a community and progresses to `/onboarding`.
   - The "request your community" affordance is reachable from
     `/community-select`.
5. The system SHALL update the e2e constants
   ([constants.ts](e2e/auth/constants.ts)) — `E2E_JOIN_CODE` is retained
   for the legacy private-invite test path; a new constant (e.g.,
   `E2E_PRIMARY_COMMUNITY_NAME`) is added for the community-selection
   test path.
6. The system SHALL keep the existing legacy join-code test alive (under
   `/join-code`) to exercise the private-invite path required by R1.5.
7. The system SHALL update any test fixtures
   ([src/test/fixtures/auth.ts](src/test/fixtures/auth.ts),
   [src/test/fixtures/community.ts](src/test/fixtures/community.ts)) and
   unit-test mocks that reference the join-code-only signup flow.
8. The system SHALL update the related auth/onboarding spec docs
   ([specs/auth/](specs/auth/), [specs/onboarding/](specs/onboarding/),
   [specs/community/](specs/community/)) so their test plans reflect the
   new flow. (Doc-only updates — they live alongside this spec.)

---

### Requirement 14: Feed Performance (Non-Functional)

**User Story:** As a user, I want the marketplace feed to load quickly even
as the network grows, so the multi-community model doesn't degrade UX.

#### Acceptance Criteria

1. WHEN a user loads the marketplace feed
   THEN the visibility-filtered query SHALL execute in under 50ms p95 at
   current data scale, and under 200ms p95 at 10× scale.
2. The system SHALL compute the viewing user's set of visible community
   IDs ONCE per request (no per-listing DB lookups).
3. The system SHALL include the following indexes:
   - `community_visibility` UNIQUE `(user_id, community_id)` — serves the
     owner-side point lookup `cv.user_id = owner AND cv.community_id =
listing.community_id` and the precompute query.
   - `community_visibility(user_id) WHERE is_visible = true` — for the
     viewer's precomputed visible-community set.
   - `community_visibility(community_id) WHERE is_visible = true`.
   - `listings(community_id)` and `service_listings(community_id)` — serve
     the viewer-side `community_id IN (visible set)` filter.
4. The system SHALL avoid N+1 query patterns in the listing service when
   resolving owner visibility for a page of listings (single join, not a
   per-listing lookup).

---

## Assumptions & Constraints

- Existing `verification_status` enum (`pending | verified | denied`) is
  reused for membership verification.
- BetterAuth's `user` table layout is unchanged; we only modify domain
  tables.
- Existing geocoding utility (`geocodeAddress`) on user addresses is
  unchanged in this phase; community lat/lng is admin-entered for now.
- Distance calculations in `searchListings` continue to operate on the
  user's primary `user_addresses` row.
- All eight initial communities are pre-seeded; the requirements doc's
  list is treated as canonical.

## Open Items for Design Phase

- Exact UI/UX for the community-selection screen (list layout, filter input
  styling, empty/no-match state copy, "request your community" affordance).
- Exact UI/UX for the per-community visibility settings page (where in
  account settings, how the primary-community lock is communicated).
- Migration ordering: a single migration vs. split files (one per concern:
  enums/columns, networks, visibility, backfill).
- Whether the listing search uses an explicit `IN (visible_community_ids)`
  filter computed once per request, vs. a join. Both produce the same plan
  with proper indexes — pick whichever is more readable in the DAL.
- The exact `EXPLAIN ANALYZE` budgets for the new search query at MVP
  scale, captured before deploy as a pre-flight check.
- How the verification queue UI handles bulk actions (probably none in
  MVP — single-row verify/deny is sufficient).
