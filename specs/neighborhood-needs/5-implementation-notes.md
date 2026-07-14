# Neighborhood Needs (MVP) — Implementation Notes

## Summary of the Specification

Neighborhood Needs adds a **demand-side surface** to the marketplace. A user
posts a _need_ (a request for a rental or service); it surfaces to their network
under the same `community_visibility` rule as listings; a provider creates a
listing in response; the listing links back to the need; the requester is
notified when that listing goes live; and the need auto-closes when **its
creator** books a linked listing. It is the demand-side mirror of a listing —
**no new booking flow, payment lifecycle, or proposal/quote system.**

**Key documents:**

- [1-requirements.md](1-requirements.md) — EARS requirements + BDD scenarios
- [2-design.md](2-design.md) — architecture, data model, the three integration hooks
- [3-tasks.md](3-tasks.md) — ordered tasks (§1–§17) and the coverage matrix
- [4-test-plan.md](4-test-plan.md) — unit/integration/E2E strategy mapped to `R#`

## Critical Implementation Details

1. **The feed is the listing-search visibility rule, reused verbatim.** A need
   `(community_id=X, creator=C)` is visible to viewer `V` **iff both** `C` and
   `V` have `community_visibility(X).is_visible=true`. Implement `listFeed` as a
   mirror of `searchListings`: viewer side `community_id = ANY(visibleIds)`,
   creator side via an INNER JOIN to `community_visibility` pinned to
   `(created_by_user_id, community_id)`. A **missing row = not visible**
   (fail-closed). Compute the viewer's visible set **once** per request via the
   existing `getCurrentUserVisibleCommunityIds()` cache helper; an empty set
   short-circuits to an empty page with **no DB hit**.

2. **Auto-close fires only for the need's creator.** In the booking-success
   `after()` blocks, call `closeNeedsFulfilledByBooking({ listingType, listingId,
bookerUserId })` where `bookerUserId` is `rentalRequest.renterId` /
   `detail.requesterId`. The service closes a linked open need **only when
   `need.createdByUserId === bookerUserId`**. A stranger's booking is a no-op.

3. **The three cross-feature hooks are non-critical and fire-and-forget.**
   Listing-create link, notify-on-approval, and auto-close-on-book must each run
   inside `after()` (or post-success) wrapped with `.catch(captureNonCriticalError)`.
   A failure in any of them must **never** fail or roll back the host operation
   (listing creation, listing approval, rental approval, service accept).

4. **Notify the requester on _live/approved_, not on submit.** The link row is
   created at listing-create time, but the
   `neighborhood_need_listing_created` notification is sent from the **approval**
   transitions (rental approve route after `updateApprovalStatus(...,'approved')`;
   service `approveListing` after `sendListingApprovedNotification`). A pending or
   rejected listing sends nothing — the requester only hears about a bookable
   listing.

5. **Two category tables; validate in the service, no DB FK.** `category_id` is a
   bare `uuid`. In `createNeed`/`updateNeed`, validate it against
   `listingDAL.getListingCategories()` when `type='rental'`, else
   `serviceListingDAL.listCategories()`. `type` and `community` are immutable
   after creation.

6. **Migration B must not run in a transaction.** Adding values to the existing
   `notification_type` / `notification_category` enums uses
   `ALTER TYPE ... ADD VALUE`, which Postgres forbids inside a transaction block.
   Keep it in its own migration file, separate from the table-creation migration
   (Migration A), and use `ADD VALUE IF NOT EXISTS`.

7. **New-need fan-out is in-app, opt-out, no spam.** Audience =
   `CommunityDAL.getUserIdsVisibleInCommunity(need.communityId)` minus the
   creator. Send via `sendNotification` with **no `email` payload**; the new
   `neighborhood_needs` category defaults to `email:false, push:false`
   (in-app only), so push reaches opt-in users only. Dispatch in `after()`.

## Decisions and Deviations

- **Network-scoped feed, not single-community** (overrides the source brief's
  "same community only") — needs are the demand mirror of listings, so they reuse
  the multi-community visibility model. Scoping to one HOA would hide demand from
  the network providers the feature exists to activate.
- **No interest/category matching** — there is no per-user interest model and
  one is not built. Fan-out is the whole visible network, gated only by the
  mutable category. ("Category matching only" from the brief is deferred.)
- **Analytics deferred entirely** — no events table or pipeline. The schema
  (`created_at`, `closed_at`, `close_reason`, the join table) keeps every
  originally-requested metric derivable by future SQL, but nothing is computed
  or surfaced in MVP.
- **Creator-only auto-close** — chosen over "any booking closes the need"
  (per the requester's call) because the need is only _met_ when the requester
  books.
- **Polymorphic link table** — `neighborhood_need_listings` carries
  `listing_type` + `listing_id` with no cross-table FK (can't FK to two tables);
  uniqueness on `(listing_type, listing_id)`.
- **New DAL + Service, not overloads** — `NeighborhoodNeedsDAL` /
  `NeighborhoodNeedsService` rather than extending Community/Listing layers, to
  keep the feature cohesive and the existing classes lean.
- **Server-page `searchParams` for pre-fill** — the create pages are server
  components, so pre-fill reads `searchParams` and feeds the existing
  `initialValues`/`initial` props; no client `useSearchParams` refactor.

## Coding Standards

Apply [.ai/AI-coding-standards.md](.ai/AI-coding-standards.md) and the project
conventions in [CLAUDE.md](CLAUDE.md):

- **Layering (strict):** API routes own auth (`getAuthenticatedUserResponse`,
  `requireAdminResponse`, `handleApiError`); `NeighborhoodNeedsDAL` is
  auth-agnostic pure DB; `NeighborhoodNeedsService` holds business logic and
  orchestrates DAL + notifications. **No session/permission checks in the DAL.**
- **DRY:** reuse `getCurrentUserVisibleCommunityIds`, `getVisibleCommunityIds`,
  `sendNotification`, `captureNonCriticalError`, `BaseDAL`, the existing
  category fetchers, and the listing/booking services — do not reimplement.
- **Errors:** throw `@/dal/errors` types (`NotFoundError`, `ValidationError`,
  `ConflictError`) and let `handleApiError` map them. Validate all bodies with
  Zod before use.
- **Money / notifications convention:** fire-and-forget notifications use
  `.catch(captureNonCriticalError)`; never let a notification (or any of the
  three hooks) fail a money or create operation.
- **TypeScript:** strict, no `any`; explicit return types on public DAL/service
  methods; reuse Drizzle `$inferSelect`/`$inferInsert` types.
- **Formatting/lint:** Prettier + ESLint (`bun run format`, `bun run lint:fix`);
  `bun run type-check` clean before merge.
- **Package manager:** **bun only** (no npm/yarn/pnpm).

## TDD

Follow [.ai/AI-tdd-methodology.md](.ai/AI-tdd-methodology.md) where it pays off —
Red→Green→Refactor for:

- `NeighborhoodNeedsDAL.listFeed` (the visibility matrix: hidden-by-viewer,
  hidden-by-creator, missing-row fail-closed, empty-set, filters, sort)
- `NeighborhoodNeedsService` validation + the hook no-op branches
  (category/type mismatch, no-primary, closed/deleted, creator-vs-stranger
  auto-close)
- The notification default matrix (absent row → push/email off)

Integration tests for the routes and the three hooks can be written alongside
implementation. Use the scenarios in [4-test-plan.md](4-test-plan.md) as the
failing-test source. Route tests **mock `@/features/auth/utils/session`**, not
the route-helpers (per CLAUDE.md).

## File Structure

```
src/
  db/schemas/
    _enums.ts                              # + need_type/status/close_reason; + 2 notif types, 1 category
    neighborhood-needs.schema.ts           # neighborhood_needs, neighborhood_need_listings + relations + types
    index.ts                               # re-export the new schema
  db/migrations/
    00XX_neighborhood_needs.sql            # Migration A: enums + tables (transactional)
    00XX_neighborhood_needs_notif_enums.sql# Migration B: ALTER TYPE ADD VALUE (NON-transactional)
  dal/
    neighborhood-needs.dal.ts              # NeighborhoodNeedsDAL (extends BaseDAL)
    community.dal.ts                       # + getUserIdsVisibleInCommunity
    index.ts                               # export the new DAL
  features/neighborhood-needs/
    services/neighborhood-needs-service.ts # NeighborhoodNeedsService
    hooks/                                 # useNeedsFeed, useNeed, useCreateNeed, useUpdateNeed, useCloseNeed, useDeleteNeed
    components/                            # NeedsFeed, NeedCard, NeedFilters, NeedDetail, CreateNeedForm, NeedShareSuccess, EmptyStateNeedCTA
  features/notifications/lib/
    notification-type-map.ts               # map both new types -> 'neighborhood_needs'
    preference-service.ts                  # default matrix for the new category
  app/api/needs/
    route.ts                               # POST (create) + GET (feed)
    [id]/route.ts                          # GET (detail) + PATCH (edit) + DELETE (admin soft delete)
    [id]/close/route.ts                    # POST (close)
  app/dashboard/needs/
    page.tsx                               # feed — "What Your Neighbors Need"
    [id]/page.tsx                          # detail
    new/page.tsx                           # create + share success
  app/dashboard/listings/add/page.tsx      # read searchParams -> pre-fill + neighborhoodNeedId
  app/dashboard/services/listings/create/page.tsx  # same for services
  app/api/admin/listings/[listingId]/approve/route.ts  # + notifyRequesterListingLive('rental', id)
  features/services/services/service-listing-service.ts# + notifyRequesterListingLive('service', id)
  features/rentals/services/rental-service.ts          # after(): auto-close (rental)
  features/services/services/service-booking-service.ts# after(): auto-close (service)
  features/listings/services/listing-service.ts        # accept neighborhoodNeedId -> linkListingToNeed
  constants/navbar.ts                      # + "Neighborhood Needs" nav item
  features/dashboard/
    types.ts                               # DashboardPulseData += needs: { open }
    lib/pulse-data.ts                      # + open-needs count
    components/dashboard-pulse.tsx         # render the count
specs/neighborhood-needs/                  # 1..5 spec docs
```

## Naming Conventions for This Feature

- **Tables:** `neighborhood_needs`, `neighborhood_need_listings`.
- **Enums:** `need_type` (`rental`/`service`), `need_status` (`open`/`closed`),
  `need_close_reason` (`manual`/`booking`/`admin`).
- **Notification types:** `neighborhood_need_created` (fan-out),
  `neighborhood_need_listing_created` (to requester). **Category:**
  `neighborhood_needs`.
- **DAL:** `NeighborhoodNeedsDAL` — `createNeed`, `getNeedById`, `updateNeed`,
  `closeNeed`, `softDeleteNeed`, `listFeed`, `getNeedDetail`, `listNeedsByUser`,
  `countOpenVisibleNeeds`, `linkListing`, `getLinkByListing`,
  `findOpenNeedsLinkedToListing`, `listLinkedListings`.
- **Service:** `NeighborhoodNeedsService` — `createNeed`, `updateNeed`,
  `closeNeed`, `deleteNeed`, `linkListingToNeed`, `notifyRequesterListingLive`,
  `closeNeedsFulfilledByBooking`, `fanOutNewNeed` (private).
- **Types:** `NeighborhoodNeed`, `NewNeighborhoodNeed`,
  `NeighborhoodNeedListing`, `NeedFeedRow`, `NeedDetail`, `CreateNeedInput`,
  `LinkedListingSummary`, `NeedType`.
- **Routes/pages:** `/api/needs`, `/api/needs/[id]`, `/api/needs/[id]/close`;
  `/dashboard/needs`, `/dashboard/needs/[id]`, `/dashboard/needs/new`.
- **Query body field:** `neighborhoodNeedId` (the link key threaded through
  listing creation).

## Error Handling

- **Routes:** authenticate via route-helpers; Zod-validate; `handleApiError` in
  the catch maps DAL errors to status codes.
- **`createNeed`:** no primary community → `ValidationError`; bad
  category-for-type → `ValidationError`; `neededEndDate < neededStartDate` →
  `ValidationError`.
- **`updateNeed`:** non-owner/non-admin → 403; `type`/`community` change →
  `ValidationError`; closed/deleted need → `ValidationError`/`ConflictError`.
- **`linkListingToNeed`:** all failure modes (missing/closed/deleted/not-visible
  need, type mismatch, duplicate-link UNIQUE violation) resolve to a **clean
  no-op** — the listing is still created.
- **Detail route:** a viewer outside the need's visible set → `notFound()` /
  404 (creator + admin exempt).
- **The three hooks:** catch and log via `captureNonCriticalError`; never
  rethrow into the host operation.

## Logging and Monitoring

- **Fan-out / auto-close / notify:** log at error (with `needId`/`listingId`/
  `userId` context) on failure via `captureNonCriticalError`; do **not** log the
  full recipient list or PII.
- **Need lifecycle:** info-level on create/close is optional; avoid logging the
  full description.
- **Host independence:** never log a hook's success as the host operation's
  success — approval/accept/create success is independent of the side-effect.

## Implementation Checklist

Use [3-tasks.md](3-tasks.md) as the source of truth. High-level order:

1. **Schema + migrations (§1–§2):** enums, two tables, barrel export; Migration A
   (tables, transactional) and Migration B (enum `ADD VALUE`, **non-transactional**).
2. **Seeds (§3):** a couple of sample needs + one linked listing.
3. **DAL (§4–§5):** `getUserIdsVisibleInCommunity`; then `NeighborhoodNeedsDAL`
   (CRUD → feed → detail/counts → linking), TDD on `listFeed`.
4. **Service (§6):** `createNeed` (+ validation + fan-out), update/close/delete,
   then the three hook methods.
5. **Notifications (§7):** type→category map + the default channel matrix (the
   one to watch — absent row must read as push/email off).
6. **Routes (§8):** `/api/needs` create+feed, `[id]` detail/edit/delete, close.
7. **Hooks into existing flows (§9–§11):** link-on-create (rental + service),
   notify-on-approval (rental route + service service), auto-close (rental
   approve + service accept).
8. **Pre-fill (§12), RQ hooks (§13), UI (§14):** feed/detail/create/share +
   empty-state CTA.
9. **Nav + Pulse (§15).**
10. **E2E (§16) + pre-merge verification (§17):** `bun run ci`, EXPLAIN ANALYZE
    the feed query, manual smoke (deferred to user).

## Test Plan Reference

Tests are defined in [4-test-plan.md](4-test-plan.md). Highest-leverage areas:

- **Unit:** `NeighborhoodNeedsDAL.listFeed` visibility matrix; service validation
  - hook no-ops; creator-only auto-close; notification default matrix.
- **Integration:** `/api/needs*` auth + symmetric visibility; the three hooks
  (link, notify-on-approval, auto-close) **including** the reliability assertion
  that a thrown hook does not fail the host operation.
- **E2E:** post-a-need + feed visibility; create-from-need → approve → notify →
  book → auto-close.
- **Perf/schema:** feed `EXPLAIN ANALYZE` budget + no-N+1; non-transactional
  enum migration; `(listing_type, listing_id)` uniqueness; soft-delete + cascade.

Run with `bun run test:run` (filter by path); full gate is `bun run ci`.

## Gotchas and Known Challenges

1. **Enum migration transaction trap (§Critical #6).** Migration B will fail if
   the generator wraps it in `BEGIN/COMMIT`. Verify the file has no transaction
   block and uses `ADD VALUE IF NOT EXISTS`.
2. **Fail-closed feed.** A missing `community_visibility` row must exclude the
   need. Use an INNER JOIN (not LEFT JOIN with a null-tolerant filter) on the
   creator side so absence excludes, mirroring `searchListings`.
3. **Notification default matrix (task 7.2).** Confirm where category defaults
   are resolved in [preference-service.ts](src/features/notifications/lib/preference-service.ts):
   an **absent** preference row for `neighborhood_needs` must read as
   `email:false, push:false`, not "all on." A wrong default here is real-world
   email/push spam to the whole network. Unit-test it explicitly.
4. **Notify timing.** The link row is created at listing-create; the requester
   notification fires at **approval**. Don't notify from the create path (the
   listing isn't bookable yet) and don't notify on rejection.
5. **Creator-vs-booker.** In the auto-close hooks the booker is the
   `renterId`/`requesterId` — not the owner/provider. Closing must compare
   `need.createdByUserId === bookerUserId`.
6. **Polymorphic linked-listing reads.** `getNeedDetail` /
   `findOpenNeedsLinkedToListing` resolve `listing_id` against `listings` or
   `service_listings` by `listing_type`; there is no FK to lean on, so guard for
   a listing that was hard-deleted.
7. **Listing forms are server-rendered.** Thread `neighborhoodNeedId` through the
   submit body (hidden field), not just the pre-fill — the API needs it to create
   the link.
8. **Shared link gating.** An out-of-network authenticated viewer must get the
   "not available in your area" state, driven by the same detail-route 404; don't
   special-case shared links around the visibility rule.

---

**Implementation can begin.** Follow [3-tasks.md](3-tasks.md) in order; write the
[4-test-plan.md](4-test-plan.md) tests as you go. If you discover a gap or need to
deviate, update the relevant spec doc **and** this file so the spec stays the
source of truth.

```

```
