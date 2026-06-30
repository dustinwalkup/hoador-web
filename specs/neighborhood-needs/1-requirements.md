# Neighborhood Needs (MVP) — Requirements Document

## Introduction

**Neighborhood Needs** introduces a demand-side surface to the HOADOR
marketplace. Today the marketplace is supply-first: owners and providers
publish listings, and renters/requesters search what already exists. When a
user can't find what they need, the demand is invisible and the funnel dead-ends.

Neighborhood Needs lets a user post a request for a rental or a service they're
looking for. The request is surfaced to nearby providers as a demand signal,
encouraging them to create a listing in response. Once a listing exists, the
requester is notified and proceeds through the **existing** listing and booking
workflow.

This feature is deliberately the **demand-side mirror of a listing**, not a new
transaction type. It introduces **no new booking flow, no provider proposal /
quote / offer / negotiation system, and no new payment lifecycle.** A
Neighborhood Need's only job is to convert latent demand into a real listing,
then hand off to the flows that already exist.

The feature name in navigation is **Neighborhood Needs**; the page heading is
**What Your Neighbors Need**.

### Scope

**In scope:**

- A `neighborhood_needs` request entity (type Rental | Service, category, title,
  description, optional needed dates, Open/Closed status).
- A `neighborhood_need_listings` join entity linking a need to the listing(s)
  created in response.
- A network-scoped Needs feed reusing the existing `community_visibility`
  model — visible to the viewer's visible-community set, exactly like listings.
- Need detail, create, edit, manual close, and admin moderation.
- "Create Listing From Need" — launching the existing listing-creation flow
  pre-populated from the need, and linking the resulting listing back to it.
- Auto-close of a need when a linked listing is booked.
- In-app notifications: a new opt-out **Neighborhood Needs** category for "new
  need posted" fan-out, and a direct "listing created for your need" notification
  to the requester.
- Dashboard **Neighborhood Pulse** integration (open-needs count).
- Empty-state CTAs that route inventory dead-ends into creating a need.
- A post-creation share screen (Copy Link + native share).

**Out of scope (MVP):** see [Out of Scope](#out-of-scope-deferred) for the full
list. Headline exclusions: provider proposals, quotes, offers, negotiation,
comments, photos, budgets, tags, interest/category-subscription matching,
cross-network requests, AI-generated requests, automatic matching of unrelated
listings, and any product-analytics pipeline.

### Key Architectural Decisions (resolved in clarifications)

These are inputs to every requirement below; capturing them here so they are
not re-litigated:

1. **Network-scoped, not single-community.** A need's `community_id` is the
   creator's **home (primary) community** — the denormalized truth for the need,
   analogous to `listings.community_id`. Visibility follows the **exact same
   symmetric `community_visibility` rule as listings**: a need is visible to a
   viewer if and only if **both** the creator and the viewer have
   `community_visibility(need.community_id).is_visible = true`. Scoping to a
   single HOA was rejected because it hides demand from exactly the network
   providers the feature exists to activate. (See `specs/multi-community-marketplace/`.)
2. **Notifications are in-app + opt-out; no interest matching.** There is no
   "interested in Power Tools" subscription model and one is **not** built in
   MVP. "New need" fan-out goes **in-app only by default**, under a new,
   user-mutable **Neighborhood Needs** notification category. Email is OFF by
   default; push is opt-in. This avoids notification fatigue and avoids
   inventing an interest model. "Category matching" from the source brief is
   explicitly deferred.
3. **Analytics deferred entirely.** No product-analytics platform exists
   (only Meta Pixel + Sentry + internal payment logs). No events table and no
   dashboards ship in MVP. The schema SHOULD nonetheless be designed so the
   originally-requested metrics remain derivable by future SQL (timestamps,
   `close_reason`, join rows), but no metric is computed or surfaced in MVP.
4. **Two category tables, resolved in the service layer.** Rentals use
   `listing_categories` (hierarchical); services use `service_listing_categories`
   (flat). A need stores `type` + `category_id` with **no hard DB FK**; the
   service layer validates `category_id` against the correct table based on
   `type`.
5. **Auto-close only when the requester books.** A need auto-closes when its
   **creator** completes a booking against one of its linked listings — that is
   the moment the demand is actually met. A booking by any other user does **not**
   close the need (the listing simply got booked by someone else; the requester's
   need is still open). See [Edge Cases](#edge-cases) #4.
6. **Reuse, don't rebuild.** Listing creation, booking/approval, notifications,
   the Pulse widget, the DAL/BaseDAL pattern, and route-helpers
   (`getAuthenticatedUserResponse`, `requireAdminResponse`, `handleApiError`)
   are all reused. This feature adds two tables, one notification category, a
   small number of routes/pages, and two integration hooks (listing-publish,
   booking-success).

---

## Requirements

### Requirement 1: Navigation & Feed Entry Point

**User Story:** As an authenticated user, I want a clear "Neighborhood Needs"
entry in the primary navigation, so that I can discover and post neighborhood
demand from anywhere in the app.

#### Acceptance Criteria

1. The system SHALL add a primary navigation item labeled **"Neighborhood
   Needs"** to `MAIN_NAV` in `src/constants/navbar.ts`, rendered by
   `src/components/nav-main.tsx`.
2. WHEN the user activates the Neighborhood Needs nav item THEN the system SHALL
   route to the Needs feed page whose heading is **"What Your Neighbors Need"**.
3. The nav item SHALL follow the existing active-state and styling conventions
   used by sibling items (e.g. Browse, Bookings).
4. The system SHALL only render the Needs feed for authenticated users; an
   unauthenticated request to the feed route SHALL be redirected to sign-in via
   the existing auth/proxy behavior.

### Requirement 2: Neighborhood Need Data Model

**User Story:** As the platform, I want a well-defined request entity, so that
demand can be stored, listed, linked to listings, and moderated consistently.

#### Acceptance Criteria

1. The system SHALL introduce a `neighborhood_needs` table with columns:
   - `id UUID PK`
   - `created_by_user_id TEXT NOT NULL FK → user.id`
   - `community_id UUID NOT NULL FK → communities.id` (the creator's home
     community, captured at creation time)
   - `type need_type NOT NULL` — enum `('rental','service')`
   - `category_id UUID NOT NULL` (no DB FK; references `listing_categories.id`
     WHEN `type = 'rental'`, else `service_listing_categories.id`)
   - `title VARCHAR(120) NOT NULL`
   - `description TEXT NOT NULL`
   - `needed_start_date DATE` (nullable)
   - `needed_end_date DATE` (nullable)
   - `status need_status NOT NULL DEFAULT 'open'` — enum `('open','closed')`
   - `close_reason need_close_reason` (nullable) — enum `('manual','booking','admin')`
   - `closed_at TIMESTAMP` (nullable)
   - `deleted_at TIMESTAMP` (nullable; admin soft-delete)
   - `created_at TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMP NOT NULL`
2. The system SHALL index `neighborhood_needs(community_id, status)` to serve the
   default feed query, and `neighborhood_needs(created_by_user_id)` to serve the
   "my needs" view.
3. WHEN a need is created THEN the system SHALL set `community_id` to the
   creator's **primary** community via
   `CommunityDAL.getPrimaryMembershipForUser(userId)`.
4. IF the authenticated user has no primary community membership THEN the system
   SHALL reject creation with a validation error (a user must have a home
   community to post demand to it).
5. The system SHALL expose all read paths through a `NeighborhoodNeedsDAL`
   extending `BaseDAL`, returning domain types or `null` / `PaginatedResult<T>`
   per existing DAL conventions, and SHALL contain no auth/permission logic in
   the DAL.
6. The `neighborhood_needs` schema SHALL be added under `src/db/schemas/` and
   the enums (`need_type`, `need_status`, `need_close_reason`) added to
   `src/db/schemas/_enums.ts`, consistent with existing schema organization.

### Requirement 3: Linked Listing Model

**User Story:** As the platform, I want to record which listings were created in
response to a need, so that requesters can find them, providers see traction,
and the demand→supply conversion is traceable.

#### Acceptance Criteria

1. The system SHALL introduce a `neighborhood_need_listings` join table with
   columns:
   - `id UUID PK`
   - `neighborhood_need_id UUID NOT NULL FK → neighborhood_needs.id ON DELETE CASCADE`
   - `listing_type need_type NOT NULL` — `('rental','service')` (disambiguates
     the polymorphic listing reference)
   - `listing_id UUID NOT NULL` (references `listings.id` WHEN
     `listing_type = 'rental'`, else `service_listings.id`; no hard cross-table FK)
   - `created_at TIMESTAMP NOT NULL`
2. The system SHALL enforce that a listing belongs to **at most one** originating
   need via a UNIQUE index on `(listing_type, listing_id)`.
3. The system SHALL allow a need to have **many** linked listings (one-to-many
   from need to join rows).
4. WHERE a need's `type` is Rental THEN every linked `listing_type` SHALL be
   `'rental'`; WHERE a need's `type` is Service THEN every linked `listing_type`
   SHALL be `'service'`. The system SHALL reject a link whose `listing_type`
   does not match the need's `type`.
5. The system SHALL index `neighborhood_need_listings(neighborhood_need_id)` to
   serve linked-listing lookups for a need.

### Requirement 4: Create a Neighborhood Need

**User Story:** As a renter or requester, I want to post what I'm looking for, so
that nearby neighbors know there is demand and can create a listing for it.

#### Acceptance Criteria

1. The system SHALL provide a create-need form requiring: **Type** (Rental |
   Service), **Category**, **Title**, **Description**.
2. The system SHALL provide optional **Needed Start Date** and **Needed End
   Date** inputs.
3. WHEN the user selects Type = Rental THEN the Category selector SHALL be
   populated from `listing_categories`; WHEN Type = Service THEN it SHALL be
   populated from `service_listing_categories`.
4. The system SHALL validate the request body server-side with a Zod schema
   before use, and SHALL reject a `category_id` that does not exist in the table
   implied by `type`.
5. WHERE `needed_start_date` and `needed_end_date` are both provided THEN the
   system SHALL reject the request if `needed_end_date` is before
   `needed_start_date`.
6. The system SHALL infer `community_id` from the authenticated user's primary
   community (Requirement 2.3) — the form SHALL NOT ask the user to choose a
   community.
7. The system SHALL NOT support photos, budget, tags, or comments on a need.
8. WHEN creation succeeds THEN the system SHALL create the need with
   `status = 'open'` and route the user to the share screen (Requirement 13).
9. The create endpoint SHALL authenticate via `getAuthenticatedUserResponse()`
   and map errors via `handleApiError()`, per route-helper conventions.

### Requirement 5: Neighborhood Needs Feed (Network-Scoped)

**User Story:** As a community member, I want to browse what my neighbors need
across my network, so that I can decide whether to create a listing in response.

#### Acceptance Criteria

1. WHEN a user opens the Needs feed THEN the system SHALL return a need
   (`community_id = X`, creator C) **if and only if both** the creator and the
   viewer have `community_visibility(X).is_visible = true` — the identical
   symmetric rule applied to listings in `specs/multi-community-marketplace/`.
   A missing `community_visibility` row counts as `false` (fail-closed).
2. The system SHALL compute the viewer's visible-community set ONCE per request
   (e.g. `CommunityDAL.getVisibleCommunityIds(userId)`) and pass it into the feed
   query — never a per-need visibility lookup.
3. The default feed SHALL show only `status = 'open'` needs that are not
   soft-deleted, sorted **newest first**.
4. The feed SHALL provide filters: **Rental**, **Service**, **Category**, and
   **Open Only** (Open Only is the default-on state).
5. Each feed card SHALL display: Type, Title, Description (truncated), Needed
   dates (when present), Created date, and the **count of linked listings**
   visible to the viewer.
6. Each card SHALL expose a **View Details** action routing to the need detail
   (Requirement 6).
7. The feed SHALL be paginated using the existing `PaginatedResult<T>`
   convention.
8. WHERE the viewer's visible-community set is empty THEN the feed SHALL
   short-circuit to an empty state with no DB hit.

### Requirement 6: Need Detail

**User Story:** As a viewer, I want a detailed view of a need, so that I can
understand the request and act on it (create a listing, or manage my own need).

#### Acceptance Criteria

1. The need detail SHALL display: Title, Description, Category, Type (Rental /
   Service), Needed dates, Created date, and the list of **linked listings**
   visible to the viewer (each deep-linking to the listing).
2. The system SHALL enforce the same network-visibility rule as the feed
   (Requirement 5.1) on the detail route and its API: a viewer who cannot see
   the need SHALL receive `notFound()` / 404, except the creator and admins who
   may always view it.
3. WHERE the current user is **not** the need owner AND the need is Open THEN
   the system SHALL display a primary CTA **"Create Listing"** (Requirement 9).
4. WHERE the current user **is** the need owner THEN the system SHALL display
   **Edit** and **Close Request** actions (Requirements 7 and 8).
5. WHERE the need is Closed THEN the system SHALL NOT display the "Create
   Listing" CTA, but SHALL still render the need and its existing linked
   listings as read-only.

### Requirement 7: Edit a Need

**User Story:** As a requester, I want to edit my open request, so that I can
correct or refine it as I learn more.

#### Acceptance Criteria

1. WHERE the current user is the need owner OR an admin THEN the system SHALL
   allow editing **Title**, **Description**, **Category**, **Needed Start Date**,
   and **Needed End Date**.
2. The system SHALL NOT allow changing **Type** or **Community** after creation.
3. WHEN the category is edited THEN the new `category_id` SHALL be validated
   against the table implied by the need's existing `type` (Requirement 4.4
   rules apply).
4. The system SHALL reject edits from any non-owner, non-admin user with a 403.
5. WHERE a need is Closed or soft-deleted THEN the system SHALL reject edits
   (owner must reopen is out of scope; closed needs are terminal in MVP).

### Requirement 8: Close a Need (Manual)

**User Story:** As a requester, I want to manually close my request, so that I
can signal I no longer need it.

#### Acceptance Criteria

1. WHERE the current user is the need owner OR an admin THEN the system SHALL
   allow closing an Open need.
2. WHEN a need is closed manually THEN the system SHALL set `status = 'closed'`,
   `close_reason = 'manual'` (or `'admin'` when closed by an admin), and
   `closed_at = NOW()`.
3. WHEN a need is closed THEN the system SHALL remove it from the active
   (Open Only) feed and SHALL prevent any new linked listings from being created
   against it (Requirement 9.7).
4. WHEN a need is closed THEN the system SHALL keep existing linked listings
   viewable on the need detail.
5. Closing SHALL be idempotent: closing an already-closed need SHALL be a no-op
   success, not an error.

### Requirement 9: Create a Listing From a Need

**User Story:** As a provider, I want to create a listing directly from a need
with details pre-filled, so that responding to demand is low-friction and the
listing is automatically linked back to the request.

#### Acceptance Criteria

1. WHEN a non-owner activates **"Create Listing"** on an Open need THEN the
   system SHALL launch the **existing** listing-creation flow — the rental flow
   (`src/app/dashboard/listings/add`) WHEN `type = 'rental'`, the service flow
   (`src/app/dashboard/services/listings/create`) WHEN `type = 'service'`.
2. The system SHALL pre-populate the listing form with: **Listing Type**
   (fixed by the need's type), **Category**, **Suggested Title**, and
   **Suggested Description**, derived from the need and carried via query params
   (including a `neighborhoodNeedId`).
3. The provider SHALL complete all remaining listing fields normally; the
   feature SHALL NOT bypass any required listing field, validation, or the
   existing admin-approval flow (`approvalStatus` for rentals, `status` for
   service listings).
4. WHEN the listing is successfully created THEN the system SHALL create a
   `neighborhood_need_listings` row linking the listing to the originating need,
   atomically with (or immediately following) listing creation.
5. WHEN the linked listing becomes **live/approved** (rental `approvalStatus =
'approved'`, or service listing `status = 'active'`) THEN the system SHALL
   notify the need's creator (Requirement 11). The system SHALL NOT notify the
   requester about a listing that is still pending review or was rejected.
6. WHERE the pre-fill query params are tampered with or reference a
   non-existent / non-visible / closed need THEN the system SHALL ignore the
   linkage (creating an ordinary listing) rather than fail the listing creation.
7. WHERE the need is Closed or soft-deleted at the moment of listing creation
   THEN the system SHALL NOT create a link row, and SHALL NOT notify
   (the listing is still created as a normal listing).
8. The system SHALL prevent linking a listing that is already linked to another
   need (the UNIQUE constraint in Requirement 3.2 is the backstop; the service
   layer SHALL surface a clean outcome rather than a raw DB error).

### Requirement 10: Auto-Close on Booking

**User Story:** As a requester, I want my need to close once **I** book a linked
listing, so that the need I personally fulfilled stops being advertised — while a
booking by someone else leaves my need open.

#### Acceptance Criteria

1. WHEN a booking reaches its **success point** — a rental approval
   (`POST /api/rentals/[id]/approve`) or a service booking acceptance
   (`POST /api/services/bookings/[id]/accept`) — THEN the system SHALL check
   whether the booked listing is linked to an Open need **whose creator is the
   renter/requester on that booking**, and if so close that need.
2. WHERE the booker is **not** the need's creator THEN the system SHALL NOT close
   the need (the listing was booked by someone else; the requester's demand is
   still unmet).
3. WHEN such a need is auto-closed THEN the system SHALL set `status =
'closed'`, `close_reason = 'booking'`, and `closed_at = NOW()`.
4. WHEN a need auto-closes THEN the system SHALL remove it from the active feed
   and SHALL NOT send any further "new need" notifications for it.
5. The auto-close hook SHALL be **fire-and-forget relative to the money
   operation**: a failure to close the need SHALL NOT fail or roll back the
   booking approval/acceptance (wrap with `captureNonCriticalError`, per the
   notification convention).
6. WHERE the creator books a listing linked to more than one of their own Open
   needs THEN the system SHALL close every such need whose creator is that booker.
7. The system SHALL NOT introduce any new booking state or payment behavior;
   this requirement is strictly an additional side-effect on the existing
   success transitions.

### Requirement 11: Notifications — Listing Created For Your Need

**User Story:** As a requester, when a neighbor creates a listing for my
request, I want to be notified, so that I can decide whether to book it.

#### Acceptance Criteria

1. The system SHALL add a notification type (e.g. `neighborhood_need_listing_created`)
   to `src/db/schemas/_enums.ts` and map it to a category in
   `src/features/notifications/lib/notification-type-map.ts`.
2. WHEN a linked listing becomes live/approved (per Requirement 9.5) THEN the
   system SHALL send the need's creator a notification via the existing
   `sendNotification()` orchestrator, with copy such as _"A new listing has been
   created for your Neighborhood Need."_
3. The notification SHALL deep-link to the **listing** (not the need).
4. The notification SHALL be delivered in-app, and via push/email subject to the
   user's existing per-category channel preferences.
5. The send SHALL be fire-and-forget (`.catch(captureNonCriticalError)`) and
   SHALL NOT block or fail listing creation/approval.

### Requirement 12: Notifications — New Neighborhood Need (Opt-Out, In-App)

**User Story:** As a provider, I want to learn when new demand appears in my
network without being spammed, so that I can respond while the request is fresh.

#### Acceptance Criteria

1. The system SHALL add a new **Neighborhood Needs** notification category (e.g.
   `neighborhood_needs`) to the category enum and the
   `NOTIFICATION_TYPE_TO_CATEGORY` map, and a notification type (e.g.
   `neighborhood_need_created`).
2. WHEN a new need is created THEN the system SHALL fan out an **in-app**
   notification to the set of users for whom the need is visible — i.e. users
   with `community_visibility(need.community_id).is_visible = true` — **excluding
   the creator**.
3. For the new **Neighborhood Needs** category, the system SHALL default
   **email = OFF** and **push = opt-in (off by default)**; in-app SHALL be on by
   default. Users SHALL be able to mute the category via the existing
   notification-preferences UI.
4. The fan-out SHALL respect each recipient's category preferences (a user who
   muted the category receives nothing).
5. The "new need" notification SHALL deep-link to the need detail.
6. The system SHALL NOT perform interest/category-subscription matching in MVP;
   the audience is the whole visible-community set, gated only by the category
   mute. (Interest matching is deferred — see Out of Scope.)
7. The fan-out SHALL be performed without an N+1 send loop blocking the create
   response — it SHALL be dispatched fire-and-forget after the need is persisted,
   and failures SHALL be captured via `captureNonCriticalError` without failing
   creation.

### Requirement 13: Post-Creation Share Flow

**User Story:** As a requester, after posting, I want to share my request, so
that more neighbors see it.

#### Acceptance Criteria

1. WHEN a need is created successfully THEN the system SHALL present a success
   screen with copy such as _"Your request has been posted. Help more neighbors
   see it by sharing your request."_
2. The success screen SHALL provide a **Copy Link** action and, where supported
   (mobile / `navigator.share`), a **Native Share** action.
3. The shared link SHALL open directly to the need detail.
4. WHEN an **unauthenticated** user opens a shared need link THEN the system
   SHALL prompt sign-in before showing the need, then return them to the need.
5. WHERE an authenticated viewer opening a shared link is **outside the need's
   visible-community set** THEN the system SHALL show a neutral "not available in
   your area" state rather than the need content (network visibility from
   Requirement 5.1 still governs shared links).

### Requirement 14: Dashboard — Neighborhood Pulse Integration

**User Story:** As a user, I want the dashboard pulse to surface neighborhood
demand, so that I'm nudged to browse needs.

#### Acceptance Criteria

1. The system SHALL extend the existing `DashboardPulseData`
   (`src/features/dashboard/lib/pulse-data.ts`) with a **Neighborhood Needs**
   count.
2. The count SHALL represent the number of **Open** needs visible to the viewer
   (per Requirement 5.1) — i.e. open demand in the viewer's network.
3. The `dashboard-pulse.tsx` widget SHALL render the count (e.g. _"Neighborhood
   Needs (4)"_) and, when activated, route to the Needs feed.
4. The count query SHALL reuse the viewer's precomputed visible-community set and
   SHALL NOT introduce a per-need lookup.

### Requirement 15: Empty-State CTAs

**User Story:** As a user hitting an inventory dead-end, I want a prompt to post
what I'm looking for, so that my unmet demand becomes visible instead of lost.

#### Acceptance Criteria

1. WHERE a browse/search returns zero results THEN the system SHALL present a CTA
   to create a Neighborhood Need, with copy such as _"Can't find what you need?
   Let your neighbors know what you're looking for. [Create Neighborhood Need]"_.
2. WHERE a category page is empty THEN the system SHALL present the same CTA.
3. WHEN the CTA is activated from a search/category context THEN the system
   SHOULD pre-seed the create-need form's Type and Category from that context
   where it can be inferred (best-effort; not required for MVP correctness).
4. The empty-state CTA SHALL appear for both rental and service browse surfaces.

### Requirement 16: Permissions

**User Story:** As the platform, I want clear permissions on needs, so that only
the right actors can create, view, edit, close, or delete them.

#### Acceptance Criteria

1. The **creator (requester)** SHALL be able to Create, View, Edit, and Close
   their own need.
2. Any **community member who can see the need** (per Requirement 5.1) SHALL be
   able to View it and Create a listing from it.
3. **Administrators** (`isAdmin` — `userType` of `admin` or `superadmin`) SHALL
   be able to Edit, Close, and Delete any need regardless of community.
4. Admin **Delete** SHALL be a **soft delete** (`deleted_at = NOW()`),
   preserving linked-listing rows and excluding the need from all feeds and
   detail views (404 for non-admins).
5. The system SHALL reject Edit/Close/Delete attempts from unauthorized users
   with a 403, using the existing route-helper auth checks
   (`getAuthenticatedUserResponse`, `requireAdminResponse`).
6. No action in this feature SHALL be gated on community **verification status**
   (consistent with the multi-community trust model: verification is a badge,
   not a gate).

---

## Non-Functional Requirements

### Performance

1. The feed visibility-filtered query SHALL compute the viewer's visible-community
   set once per request and SHALL avoid N+1 per-need lookups (mirrors the listing
   feed budget in `specs/multi-community-marketplace/`).
2. The "new need" fan-out SHALL NOT add measurable latency to the create request:
   it SHALL be dispatched after persistence, fire-and-forget.
3. The Pulse count SHALL reuse the precomputed visible set and add at most one
   aggregate query.

### Reliability

1. All side-effect hooks introduced by this feature (auto-close on booking,
   both notification paths) SHALL be non-critical: failures SHALL be captured via
   `captureNonCriticalError` and SHALL NEVER fail or roll back a listing
   creation, booking approval, or booking acceptance.
2. The need-create operation and its `community_id` resolution SHALL be
   transactional with respect to need persistence; the fan-out is explicitly
   outside that transaction.

### Security & Privacy

1. The system SHALL NOT expose a need outside its visible-community set on any
   path (feed, detail, share link, API) except to the creator and admins.
2. The system SHALL validate all inputs server-side with Zod and SHALL treat
   `category_id`, `type`, and `neighborhoodNeedId` as untrusted.
3. The system SHALL NOT leak the creator's address or any PII beyond what an
   ordinary listing exposes about its owner.

### Usability

1. Type and Category selectors SHALL clearly reflect the rental-vs-service split
   (the two category sources are never mixed in one selector).
2. The "Create Listing" pre-fill SHALL be presented as editable suggestions, not
   locked values (except Listing Type, which is fixed by the need's type).

---

## Assumptions

1. `CommunityDAL.getPrimaryMembershipForUser(userId)` reliably returns the user's
   home community, and a user without one is an exceptional state handled by
   Requirement 2.4.
2. The existing listing-creation pages can read pre-fill values from query params
   (to be confirmed in design; if not, a small addition to those forms is in
   scope for this feature).
3. The rental approval (`/api/rentals/[id]/approve`) and service acceptance
   (`/api/services/bookings/[id]/accept`) endpoints are the correct, sole
   "booking success" hook points for auto-close.
4. The `community_visibility` model and `getVisibleCommunityIds` helper are the
   single source of truth for who can see a need, identical to listings.
5. The existing `sendNotification()` orchestrator and category-preferences system
   can accommodate a new category and two new types without structural change.
6. "Live/approved" is the right trigger for the requester-facing "listing created"
   notification (vs. notifying on submission of a still-pending listing).

## Constraints

1. No new booking flow, payment lifecycle, or provider-proposal/quote/offer/
   negotiation system is introduced.
2. No product-analytics pipeline, events table, or dashboard is introduced.
3. No interest/category-subscription matching is introduced.
4. The two category tables (`listing_categories`,
   `service_listing_categories`) are reused as-is; no unification.
5. The change must work within the Next.js 16 App Router + React Query (no server
   actions) architecture, and follow the DAL/Service/route-helper layering.
6. Cross-network needs are not supported; a need lives in exactly one home
   community and surfaces only through the network visibility rule.

## Edge Cases

1. **Creator with no primary community** — Need creation is rejected
   (Requirement 2.4). The create UI SHALL surface a clear message rather than a
   raw error.
2. **Type/category mismatch** — A `category_id` from the wrong table for the
   chosen `type` is rejected at validation (Requirement 4.4).
3. **Listing created for a need, then rejected by admin** — The link row exists,
   but no requester notification fires (Requirement 9.5). The need remains Open.
   The linked-listing count MAY exclude non-live listings from the viewer-facing
   count (design decision; default: count only viewer-visible/live listings).
4. **Stranger books a linked listing** — The need stays Open. Auto-close fires
   only when the **need's own creator** books a linked listing (Requirement 10.1–10.2).
   A booking by anyone else means the listing got booked but the requester's
   demand is still unmet.
5. **Need closed between pre-fill and listing publish** — No link row is created;
   listing is created normally (Requirement 9.7).
6. **Viewer outside network opens a shared link** — Neutral "not available in
   your area" state after sign-in (Requirement 13.5).
7. **Creator toggles their home community visibility off** — Per the symmetric
   rule, their need disappears from everyone's feed (they cannot toggle off their
   _primary_ community per the multi-community rules, so in practice the need
   stays visible; documented for completeness).
8. **Need with zero linked listings** — Fully valid and expected; surfaces in the
   feed with a linked-listing count of 0 (and is a future demand-gap signal).
9. **Listing already linked to another need** — Second link attempt is rejected
   by the UNIQUE constraint; the service layer returns a clean outcome
   (Requirement 9.8).
10. **Admin soft-deletes a need with linked listings** — Need is hidden
    everywhere; linked listings and their join rows are preserved (Requirement
    16.4).

## Out of Scope (Deferred)

These are explicitly deferred to keep MVP scope tight; they inform later phases
but SHALL NOT appear in this phase's design/tasks/implementation:

- **Provider proposals, quotes, offers, negotiation** on a need.
- **Comments, photos, budgets, tags** on a need.
- **Interest / category-subscription matching** for "new need" notifications
  (MVP fans out to the whole visible network, gated only by the mutable
  category). The originally-requested "category matching only" rides on this.
- **Analytics** — Requests Created/Closed/Converted, Listings Per Request, Time
  to First Listing, Most Requested Categories/Titles, Zero-Listing Requests, and
  any dashboards or events pipeline. (Schema is designed to keep these derivable
  by future SQL, but nothing is computed/surfaced in MVP.)
- **Existing-listing recommendations** shown before a user posts a need.
- **Cross-community / cross-network needs.**
- **AI-generated request drafting.**
- **Automatic matching** of unrelated, independently-published listings to needs.
- **Reopening a closed need** (closed is terminal in MVP).

## Success Criteria

1. A user can post a Neighborhood Need (rental or service) in their home
   community and immediately reach the share screen.
2. Needs surface to the correct network audience using the **same** visibility
   rule as listings — no need is ever shown outside the visible-community set.
3. A provider can go from a need's "Create Listing" CTA to a published listing
   that is automatically linked back to the need, with the requester notified
   once it goes live.
4. Booking a linked listing auto-closes the need and removes it from the active
   feed, without affecting the booking/payment flow.
5. New-need notifications reach the network in-app without producing
   email/push spam, and any user can mute them.
6. The dashboard Pulse surfaces an accurate count of open neighborhood demand.
7. No regression to listing creation, booking approval/acceptance, or the
   notification system is introduced by the new side-effect hooks.

## Open Items for Design Phase

1. Exact route paths and page structure for the feed (`/dashboard/needs`?),
   detail, and create screens.
2. Whether the existing listing-creation forms already accept query-param
   pre-fill, or need a small addition (Assumption 2).
3. Whether the linked-listing **count** on feed cards counts all links or only
   viewer-visible/live links (Edge Case 3).
4. Exact placement and copy of the new **Neighborhood Needs** notification
   category in the preferences UI, and its default channel matrix.
5. Whether the "new need" fan-out runs inline fire-and-forget or via an existing
   background mechanism if the visible-member set is large (scale ceiling for MVP
   networks is small — ~8 communities — so inline is likely fine).
6. Whether `needed_start_date` / `needed_end_date` are `DATE` or `TIMESTAMP`
   (DATE assumed; confirm against how listings/rentals model dates).
7. Soft-delete vs. the Open/Closed status interplay — confirm `deleted_at` is the
   only delete mechanism and admins don't hard-delete.

```

```
