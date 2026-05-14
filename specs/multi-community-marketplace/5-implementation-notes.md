# Implementation Notes: Multi-Community Marketplace Expansion

This is the closing document for the spec. It pulls everything together
into actionable implementation guidance: ordering, conventions, gotchas,
and a final checklist.

References:

- [1-requirements.md](./1-requirements.md) — what we're building
- [2-design.md](./2-design.md) — how it's shaped
- [3-tasks.md](./3-tasks.md) — the work, broken down
- [4-test-plan.md](./4-test-plan.md) — how we'll verify it
- [.ai/AI-coding-standards.md](.ai/AI-coding-standards.md) — quality bar
- [.ai/AI-tdd-methodology.md](.ai/AI-tdd-methodology.md) — TDD where applied

---

## 1. Specification Summary

We are expanding HOADOR from a **single-community** marketplace to a
**connected neighborhood network** with the following moving parts:

- **A new "Kansas City Metro" network** containing 8 seeded communities.
- **Replace `/join-code` with `/community-select`** as the canonical
  post-verification step (legacy `/join-code` preserved for private
  invites — R1.5).
- **A single `community_visibility` table** providing symmetric, all-or-
  nothing per-community visibility for each user; primary community is
  always-on.
- **Listings surface through their home community** — no per-listing
  visibility table; `listings.community_id` / `service_listings.community_id`
  is the single community a listing appears in, and a listing is visible to
  a viewer only when **both** the owner and the viewer have that community
  toggled visible.
- **Manual admin verification queue** for residency claims; pending
  users still have full marketplace access (verification is a trust
  signal, not a gate).
- **Listing search rewrite**: replaces the exact-match
  `community_id = $userPrimary` filter with `community_id IN (viewer's
visible set)` plus an owner-side `community_visibility` join pinned to
  `(owner_id, listings.community_id)` requiring `is_visible = true`.

The 17 architectural decisions (D1–D17) listed in [2-design.md §1](./2-design.md#1-overview)
are the binding contract for implementation.

---

## 2. Critical Implementation Details

These are the load-bearing pieces. If they're wrong, the rest unravels.

### 2.1 Symmetric visibility (the core invariant)

A listing has exactly one home community — its `community_id` (`X`). It
appears for a viewer **if and only if both** the owner and the viewer have
`community_visibility(X).is_visible = true`. A missing row counts as
`false` (fail-closed). There is no per-listing override. Toggling community
`X` off is symmetric and atomic — one row updated; every listing with
`community_id = X` vanishes from that user's search, and every one of that
user's own listings with `community_id = X` vanishes from everyone else's.

Concretely, the search query is `... WHERE listings.community_id IN
(viewer's visible set) AND <owner is visible in listings.community_id>`,
where the owner check is an `INNER JOIN community_visibility` pinned to
`(owner_id, listings.community_id)` requiring `is_visible = true`. The
listing's `community_id` is the visibility key — not just origin metadata.

If you find yourself adding a per-listing query path, or matching
`community_visibility` on anything other than the listing's own
`community_id`, **stop** and revisit
[1-requirements.md R5](./1-requirements.md#requirement-5-symmetric-per-community-listing-visibility).
Per-listing overrides are explicitly deferred (R12).

### 2.2 Primary community is locked visible

`bulkSetVisibility` must reject any update that sets `is_visible=false`
for the user's `is_primary=true` community. UI must render that toggle
as disabled with helper copy. **Both layers** enforce — UI for UX, DAL
for safety.

### 2.3 `getCurrentUserVisibleCommunityIds` is the hot-path entry point

Wrap it in React `cache()` exactly like the existing
[`getCurrentUserCommunityId`](src/features/community/utils/membership.ts#L31).
**Every** consumer of the listing search uses this helper — no consumer
should query `community_visibility` directly inline. This is what
prevents N+1 and what makes the search query plan stable.

### 2.4 Migration B (backfill) must be idempotent

Every INSERT uses `ON CONFLICT DO NOTHING`. Every UPDATE is gated by
`WHERE` conditions that exclude already-backfilled rows. The migration
test (task 2.3) runs it twice and asserts no duplicates and no
overwritten `verified_at` timestamps. Re-running must be a no-op.

### 2.5 No feature flags — fix-forward rollout

Per architectural decision #16, we ship with no feature-flag safety net.
That makes the **EXPLAIN ANALYZE pre-merge step (task 5.4 / 15.3)
non-negotiable**. If the new query plan is bad in dev, fix it before
merge — there is no toggle to flip in prod.

### 2.6 Legacy `/join-code` stays alive

Preserve the existing route, the existing `joinCommunity` service
method, and the existing API endpoint. Do not delete them.
`AuthService.joinCommunity` now also sets `is_primary=true` and
`verification_status='verified'` on the membership it creates (legacy
code-based joins are pre-trusted by the issued code).

---

## 3. Deviations & Decisions Captured Across Phases

| Decision                                                                                                                    | Phase                          | Source              |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------- |
| Replace join code with community search (not augment)                                                                       | Requirements                   | R1, AD#1            |
| Single-layer visibility table (no per-listing override)                                                                     | Requirements (revised)         | R4, R5, AD#11       |
| Listing visibility keyed on the listing's own `community_id`, symmetric (owner + viewer both visible there)                 | Post-impl correction (see §14) | R5, R8, AD#2, AD#11 |
| Pending users get full marketplace access (no gate)                                                                         | Requirements                   | R2.7, AD#5          |
| `join_code` becomes nullable (legacy preserved)                                                                             | Requirements                   | R1.5, AD#6          |
| Drop polygon GeoJSON column from MVP                                                                                        | Requirements (cut)             | R7, AD#7            |
| Drop dedicated networks-management UI                                                                                       | Requirements (cut)             | AD#12               |
| Drop server-side autocomplete (≤8 communities)                                                                              | Requirements (cut)             | R1.7                |
| No feature flags                                                                                                            | Requirements                   | AD#16               |
| Use `verification_status` enum as-is (`pending\|verified\|denied`)                                                          | Requirements                   | AD#8                |
| Each community in at most one network (single FK)                                                                           | Requirements                   | AD#9                |
| Extend existing `CommunityDAL` (don't split)                                                                                | Design                         | D10                 |
| Pre-compute viewer's visible IDs once per request; owner-side `community_visibility` join pinned to the listing's community | Design (+ §14 correction)      | D11                 |
| Schema migration + separate backfill migration                                                                              | Design                         | D9                  |
| Visibility settings = card on `/dashboard/profile`                                                                          | Design                         | D14                 |
| Admin queue = new tab in `/admin/dashboard/users`                                                                           | Design                         | D15                 |
| `/community-select` UI = shadcn `Select` dropdown                                                                           | Design                         | §3.7                |
| KC Metro communities seeded via inline migration SQL                                                                        | Design                         | D16                 |
| Dev: keep 3 existing communities as separate "Test Network"                                                                 | Design                         | D17                 |
| `verified_at = COALESCE(verified_at, created_at)` in backfill                                                               | Design                         | §5.2                |
| Legacy `joinCommunity` now creates pre-verified primary membership                                                          | Tasks                          | Task 7.3            |

---

## 4. File Structure (where things go)

```
src/
├── db/
│   ├── schemas/
│   │   └── communities.schema.ts        # extended (networks, visibility, mods)
│   ├── migrations/
│   │   ├── 00XX_multi_community_schema.sql      # Migration A (DDL)
│   │   ├── 00XX_multi_community_backfill.sql    # Migration B (idempotent data)
│   │   └── __tests__/
│   │       └── multi_community_backfill.test.ts # idempotency test
│   └── seeds/
│       ├── communities.seed.ts          # KC Metro + Test Network setup
│       └── e2e.seed.ts                  # e2e equivalent
├── dal/
│   └── community.dal.ts                 # extended (networks, visibility, verification)
│   └── listing.dal.ts                   # searchListings signature change
│   └── service-listing.dal.ts           # mirror change
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   └── community-select-form.tsx       # NEW
│   │   ├── hooks/
│   │   │   └── use-auth-mutations.ts           # extend with useSelectCommunity
│   │   └── services/
│   │       └── auth-service.ts                 # extend with selectPrimaryCommunity
│   ├── community/
│   │   └── utils/
│   │       └── membership.ts                   # add getCurrentUserVisibleCommunityIds
│   ├── users/
│   │   ├── components/
│   │   │   └── visibility-settings-card.tsx    # NEW
│   │   └── hooks/
│   │       └── use-visibility.ts               # NEW
│   └── admin/
│       ├── components/
│       │   ├── user-management/
│       │   │   └── pending-verifications-tab.tsx   # NEW
│       │   └── community-management/
│       │       ├── communities-list.tsx        # NEW
│       │       └── community-edit-form.tsx     # NEW
│       └── hooks/
│           └── use-admin-mutations.ts          # extend with verify/deny hooks
├── app/
│   ├── (auth)/
│   │   ├── community-select/
│   │   │   └── page.tsx                        # NEW (replaces /join-code as canonical)
│   │   └── join-code/
│   │       └── page.tsx                        # LEGACY (preserved)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── select-community/
│   │   │   │   └── route.ts                    # NEW
│   │   │   └── join-community/
│   │   │       └── route.ts                    # LEGACY (preserved)
│   │   ├── communities/
│   │   │   └── route.ts                        # NEW (GET — list by network)
│   │   ├── users/
│   │   │   └── me/
│   │   │       └── visibility/
│   │   │           └── route.ts                # NEW (GET + PATCH)
│   │   └── admin/
│   │       ├── community-memberships/
│   │       │   ├── pending/
│   │       │   │   └── route.ts                # NEW
│   │       │   └── [id]/
│   │       │       ├── verify/
│   │       │       │   └── route.ts            # NEW
│   │       │       └── deny/
│   │       │           └── route.ts            # NEW
│   │       └── communities/
│   │           ├── route.ts                    # NEW (CRUD list/create)
│   │           └── [id]/
│   │               └── route.ts                # NEW (edit)
│   ├── dashboard/
│   │   └── profile/
│   │       └── page.tsx                        # mount VisibilitySettingsCard
│   └── admin/
│       └── dashboard/
│           ├── users/
│           │   └── page.tsx                    # tabs: Users | Pending Verifications
│           └── communities/
│               └── page.tsx                    # NEW (admin community CRUD)
└── proxy.ts                                    # update email_verified redirect

e2e/
└── auth/
    ├── signup-funnel.spec.ts                   # update
    ├── status-redirect.spec.ts                 # update
    ├── community-select.spec.ts                # NEW
    ├── visibility-settings.spec.ts             # NEW
    ├── admin-verification-queue.spec.ts        # NEW
    └── constants.ts                            # add E2E_PRIMARY_COMMUNITY_NAME
```

---

## 5. Naming Conventions for This Feature

Match existing patterns; these are the new identifiers introduced:

| Layer                 | Convention      | Examples                                                                   |
| --------------------- | --------------- | -------------------------------------------------------------------------- |
| Schema tables         | snake_case      | `community_networks`, `community_visibility`                               |
| Drizzle table exports | camelCase       | `communityNetworks`, `communityVisibility`                                 |
| TS types              | PascalCase      | `CommunityNetwork`, `CommunityVisibility`                                  |
| DAL methods           | verbCamelCase   | `getNetworkBySlug`, `bulkSetVisibility`                                    |
| Service methods       | verbCamelCase   | `selectPrimaryCommunity`                                                   |
| API routes            | kebab-case path | `/api/auth/select-community`, `/api/users/me/visibility`                   |
| Hooks                 | `use*`          | `useSelectCommunity`, `useVisibility`, `useUpdateVisibility`               |
| React Query keys      | array literal   | `["users", "me", "visibility"]`, `["admin", "pending-verifications"]`      |
| Components            | PascalCase      | `CommunitySelectForm`, `VisibilitySettingsCard`, `PendingVerificationsTab` |
| Page routes           | kebab-case      | `/community-select`, `/dashboard/profile`, `/admin/dashboard/communities`  |

---

## 6. Error Handling Approach

Follows existing project conventions ([src/dal/base.ts](src/dal/base.ts), [src/dal/errors.ts](src/dal/errors.ts)):

- **DAL** throws typed errors (`ValidationError`, `ConflictError`,
  `NotFoundError`, `DALError`); never returns `null` for "not found"
  unless a `null`-return is the explicit contract (`getNetworkById` etc.).
- **Postgres constraint codes** auto-mapped by `BaseDAL.handleError`:
  - `23505` (unique violation) → `ConflictError`
  - `23503` (FK violation) → `ValidationError`
  - `23514` (check violation) → `ValidationError`
- **Service layer** maps DAL errors to user-facing messages, preserving
  the typed error so the API route can choose the right HTTP status.
- **API routes** use the existing `withRequestLogging` wrapper and the
  shared error→status mapping helpers.

Specific cases for this feature, all named in the test plan:

| Scenario                               | Throws            | HTTP         |
| -------------------------------------- | ----------------- | ------------ |
| Select community when user has primary | `ConflictError`   | 409          |
| Select inactive community              | `ValidationError` | 400          |
| Toggle primary visibility off          | `ValidationError` | 400          |
| Deny membership without notes          | `ValidationError` | 400          |
| Admin endpoint without admin role      | (gate fails)      | 403          |
| Unknown membership ID in admin verify  | `NotFoundError`   | 404          |
| Empty `visibleCommunityIds`            | (no throw)        | empty result |

---

## 7. Logging / Monitoring Strategy

- **Existing patterns reused** — no new infra. `BaseDAL.handleError`
  already routes unexpected errors to Sentry; route handlers already use
  `withRequestLogging`.
- **Audit trail** for admin verification decisions — write to
  `audit_logs` via existing `AuditLogDAL` (task 4.5). Each
  verify/deny decision produces a row with admin user ID, action,
  target membership ID, and notes. No new audit infra needed.
- **No new telemetry events in MVP.** If product wants signup-completion
  or visibility-toggle analytics later, add them in a follow-up. Don't
  over-instrument up front.

---

## 8. TDD Approach (selective)

Per [.ai/AI-tdd-methodology.md](.ai/AI-tdd-methodology.md), TDD is best
for "complex business logic" and "API endpoints with defined contracts."
For UI-heavy / glue code, pre-written tests add overhead without
proportional benefit.

**Apply Red-Green-Refactor strictly to:**

- All new DAL methods (tasks 4.1–4.5) — these have clear inputs/outputs
  and constraints. The test plan already lists scenarios per method;
  start each method by writing those tests, watch them fail, then
  implement. **Especially**: `bulkSetVisibility` (primary-locked rule)
  and `searchListings` rewrite (symmetric per-community visibility — see
  §2.1; the fail-closed exclusions in R8.1).
- `AuthService.selectPrimaryCommunity` (task 7.1) — orchestration with
  multiple branches (existing-primary, inactive community, network-null
  case, status update ordering).
- The `getCurrentUserVisibleCommunityIds` cache helper (task 6.1) —
  small surface, clear contract.

**Test-first is optional / lower priority for:**

- UI components (tasks 10.1, 10.3, 10.6, 10.9) — write tests after the
  component shape stabilizes; render tests are easier to write against
  finished JSX.
- Admin community CRUD form — mostly form binding, light logic.
- Page-level routing wiring (task 9.1) — covered by e2e.
- Migration files (testing happens via the dedicated idempotency test
  in task 2.3).

**Recommended cycle for DAL work:**

1. Open the test plan section for the method.
2. Stub the method signature in the DAL.
3. Write each scenario from the test plan as a `test()` block.
4. Run — tests fail (Red).
5. Implement minimal code to pass each in turn (Green).
6. Refactor (extract helpers, clarify naming) with the green test suite as a safety net.

---

## 9. Implementation Checklist

A linear, task-ordered ship list. Tick off in order; check the
referenced tasks in [3-tasks.md](./3-tasks.md) for sub-detail.

### Phase 1 — Foundation (must complete in order)

- [x] §1 Schema: define new tables, modify existing tables, update relations
- [x] §2.1 Generate Migration A (DDL); verify partial-index syntax
- [x] §2.2 Author Migration B (idempotent backfill SQL)
- [x] §2.3 Migration idempotency test passes
- [x] §3 Seeds updated; dev DB seeds cleanly with KC Metro + Test Network
      (3.3 dev-DB verification deferred to the user — manual checklist in §3 of
      [3-tasks.md](./3-tasks.md))

### Phase 2 — DAL & Services (parallelizable after Phase 1)

- [x] §4.1 Network read methods + tests
- [x] §4.2 `selectPrimaryCommunity` + tests
- [x] §4.3 Visibility methods + tests (with primary-locked rule)
- [x] §4.4 Verification queue methods + tests
- [x] §4.5 Audit logging on verify/deny
- [x] §5.1–5.3 ListingDAL + ServiceListingDAL search rewrite + tests
- [x] §5.4 EXPLAIN ANALYZE captured (baseline in §13.1 below)
- [x] §6.1–6.2 Per-request cache helper + tests
- [x] §7.1–7.2 `AuthService.selectPrimaryCommunity` + tests
- [x] §7.3 Legacy `joinCommunity` updated for `is_primary=true,verified`

### Phase 3 — API Routes (parallelizable)

- [x] §8.1 POST /api/auth/select-community
- [x] §8.2 GET /api/communities
- [x] §8.3 GET /api/users/me/visibility
- [x] §8.4 PATCH /api/users/me/visibility
- [x] §8.5 GET /api/admin/community-memberships/pending
- [x] §8.6 POST /api/admin/community-memberships/[id]/verify
- [x] §8.7 POST /api/admin/community-memberships/[id]/deny
- [x] §8.8 GET/POST/PATCH /api/admin/communities

### Phase 4 — Routing

- [x] §9.1 proxy.ts updated; legacy `/join-code` still allowed (+ §9.3
      non-proxy redirects repointed)
- [x] §9.2 Proxy redirect tests pass

### Phase 5 — UI (parallelizable, after Phase 3)

- [x] §10.1–10.2 `/community-select` page + form + hook
- [x] §10.3–10.5 `VisibilitySettingsCard` + hooks + mounted on profile
- [x] §10.6–10.8 Admin verification queue tab in users page
- [x] §10.9 Admin community CRUD page
- [x] §12.1 Pending verification badge on profile

### Phase 6 — Wire-up & E2E

- [x] §11.1–11.3 All listing-search consumers updated to new signature
- [x] §13.1–13.8 E2E tests updated and added (per R13) — written + type-checked;
      execution against the migrated/seeded E2E DB is §15.2
- [x] §14.1 Cross-spec test plans updated (auth / onboarding / community)

### Phase 7 — Pre-merge gate

- [x] §15.1 Full unit + integration suite green — `bun run test:run`: 269
      files / 3605 tests passed (7 skipped); `type-check` + `lint` clean. No
      enforced coverage thresholds (commented out in `vitest.config.mjs`).
- [ ] §15.2 Full e2e suite green — deferred to the user (needs Docker
      Postgres + Next server; see §15.2 in [3-tasks.md](./3-tasks.md))
- [x] §15.3 EXPLAIN ANALYZE within budget — re-run captured in §13.2 below
      (re-confirm partial-index usage against prod-shape data before merge)
- [ ] §15.4 Manual smoke through entire flow — deferred to the user

---

## 10. Gotchas & Known Challenges

These are the surprises that will bite during implementation. Read
before starting each.

### 10.1 Drizzle Kit and partial indexes

`drizzle-kit generate` historically does not emit `WHERE` clauses for
partial indexes. After generating Migration A (task 2.1), **inspect the
SQL** and hand-add the partial-index `WHERE` clauses. The partial
indexes are critical for performance (see R14.3).

### 10.2 The `community_visibility` table absence-as-not-visible rule

R4.8 says missing rows = not visible (fail-closed). After backfill, the
invariant is "every user in a network has N rows, one per network
community." If you see a `(user, community)` lookup miss in the wild
after backfill, treat it as a bug — don't paper over it by defaulting to
visible.

### 10.3 DISTINCT in the search query

The `community_visibility` join is now pinned to `(owner_id,
listings.community_id)` — a unique key — so it is 1:1 with the listing and
produces no duplicates. `selectDistinct`/`countDistinct` are retained only
as a cheap guard against the primary-address `leftJoin` fanning out. (Prior
to the §14 correction the join was on `owner_id` alone and a listing could
appear K times when owner and viewer shared K communities; that fan-out no
longer exists.)

### 10.4 Admin user excluded from search? No.

Existing `searchListings` has an admin-bypass for approval status. The
new visibility filter does **not** have an admin bypass — admins still
see only listings visible to them via their own visibility rows. If you
want admin to see-everything, that's a separate decision and not in
scope. Confirm during code review.

### 10.5 `verified_at` backfill choice

We're setting `verified_at = COALESCE(verified_at, created_at)` for
existing memberships, not `NOW()`. Rationale: it's an honest historical
signal ("trusted from membership creation"). If you change this during
implementation, document it and update the migration test.

### 10.6 The `network_id` on KC Metro communities

The backfill inserts the 8 communities with `network_id` already set.
If you ever see a KC Metro community with `network_id = NULL`, the
backfill failed partway. The migration is wrapped in a transaction so
this should be impossible — but the test (task 2.3) verifies it.

### 10.7 React Query cache invalidation on visibility update

After `useUpdateVisibility` succeeds, invalidate **both** the visibility
query AND any listing-search caches the user might be looking at. The
listing feed is downstream of visibility; without invalidation, the user
toggles a community off and the page still shows old listings until
refresh.

### 10.8 `searchListings` call sites

The signature change in task 5.1 requires **every caller** to be
updated. Task 11.3 audits the codebase. Don't merge any phase that
leaves a build error on the old signature — TypeScript will catch this
locally, but it's the highest-risk merge moment.

**Audit result (task 11):** `listingDAL.searchListings` has two callers —
`src/app/api/listings/search/route.ts` and `src/app/dashboard/explore/page.tsx`
(SSR prefetch). `serviceListingDAL.findByCommunityForBrowse` has two —
`src/app/api/services/listings/route.ts` and `src/app/dashboard/services/page.tsx`.
All four now resolve `getCurrentUserVisibleCommunityIds()` and pass the
array. Empty-set handling is fail-closed at the route boundary (search route
returns `emptyPaginatedResult`) and again in the DAL short-circuit (defence
in depth). Test fixture `approval-visibility.test.ts` updated for the new
positional arg type. `bun run type-check` is the merge gate here.

**Single-listing paths (R8.9 — fixed post-impl, see §14):** the _search/browse_
audit above missed the paths that fetch a listing (or a provider's listings)
by id and gate inline. All now converted off the stale `getMembershipForUser`

- `communityId === membership.community.id` pattern to the symmetric rule:

* tool detail page (`src/app/dashboard/listings/[id]/page.tsx` — previously had
  **no** community check), tool rent page (`.../[id]/rent/page.tsx`), service
  detail page + API GET (`src/app/dashboard/services/listings/[id]/page.tsx`,
  `src/app/api/services/listings/[id]/route.ts`), service booking page
  (`.../[id]/book/page.tsx`) — gated via
  `communityDAL.isVisibleInCommunity(userId, listing.communityId)` for both the
  viewer and the owner/provider (plus a browseable-status check for non-owners);
* provider profile page + API GET (`src/app/dashboard/services/providers/[userId]/page.tsx`,
  `src/app/api/services/providers/[userId]/route.ts`) — there's no single
  community to check, so the gate is "share ≥1 community where both are
  visible" via `communityDAL.getVisibleCommunityIds` for viewer + provider, and
  the listed active listings are scoped to that shared set (the provider sees
  their own profile/listings unfiltered).

`getMembershipForUser` itself is `LIMIT 1` with no `is_primary` filter, so it's
the wrong primitive for "is this user in community X" anyway — use
`isVisibleInCommunity` (or `getPrimaryMembershipForUser` when you genuinely need
the _primary_).

### 10.9 The `/community-select` page layout

We chose a plain shadcn `Select` (≤8 items). If during build you find
the dropdown is awkward (e.g., truncates community names, no preview),
the design fallback is shadcn `Combobox`. This is in §9 of the design
as TBD — don't agonize over it pre-build, but flag it in the PR if you
end up swapping.

### 10.10 No feature flag means no toggle-back

Re-reading note 2.5: pre-merge `EXPLAIN ANALYZE` (task 15.3) is the
final safety net. Do not skip it. If the query plan looks bad, fix it
in this PR — there is no flag to flip later.

---

## 11. Pre-Implementation Approval Checklist

Before opening a PR for any task in §1–§3 of the task list, confirm:

- [ ] The 17 design decisions in [2-design.md §1](./2-design.md#1-overview) are still the contract; no scope drift.
- [ ] You've read this doc's §10 gotchas.
- [ ] You've identified which tasks you're tackling and in what order.
- [ ] The DAL surface in §3.2 of the design matches what you're about
      to write — if you find yourself adding methods not in the design,
      pause and confirm.
- [ ] You're following the TDD ordering in §8 of this doc for DAL work.
- [ ] Existing tests still green on your branch before you start.

---

## 12. After Implementation

After §15 of the task list is complete:

1. Open the PR with the EXPLAIN ANALYZE output pasted in the description.
2. Tag the PR with all relevant requirement numbers.
3. Update [README.md](README.md) only if a top-level project description changes (unlikely).
4. **Do not** delete any of the spec docs — they are the historical
   record of the decision trail and are referenced by the requirements
   coverage matrix in [3-tasks.md](./3-tasks.md#requirements-coverage-matrix).

---

**Specifications are complete. Implementation can begin.**

---

## 13. Captured Baselines

> ⚠️ **§13.1 and §13.2 below predate the §14 correction.** They captured the
> original `JOIN community_visibility ON cv.user_id = l.owner_id` query
> (owner-side only). The current query joins on `(owner_id, l.community_id)`
> and filters `l.community_id IN (...)` — see §14. Re-run
> [scripts/explain-search-listings.ts](scripts/explain-search-listings.ts)
> against prod-shape data to capture a fresh baseline before relying on these
> numbers; expected indexes are now the `community_visibility(user_id,
community_id)` unique index (owner-side point lookup) and
> `listings(community_id)` (viewer-side `IN`).

### 13.1 EXPLAIN ANALYZE — visibility-aware listing search (task 5.4, pre-§14)

Captured against the dev DB after migrations `0058`, `0059`, `0060` were
applied. Test viewer had 3 visible communities (Test Network); 33 active
listings in the DB. Reproduce with
[scripts/explain-search-listings.ts](scripts/explain-search-listings.ts).

```
Limit  (cost=24.24..24.41 rows=7 width=332) (actual time=0.248..0.263 rows=12 loops=1)
  ->  Unique  (cost=24.24..24.41 rows=7 width=332) (actual time=0.247..0.261 rows=12 loops=1)
        ->  Sort  (Sort Method: quicksort  Memory: 32kB)
              ->  Nested Loop  (rows=48)
                    ->  Hash Join (Hash Cond: cv.user_id = l.owner_id)
                          ->  Bitmap Heap Scan on community_visibility cv
                                Recheck Cond: (community_id = ANY (...) AND is_visible)
                                ->  Bitmap Index Scan on
                                      community_visibility_community_visible_idx
                                      Index Cond: (community_id = ANY (...))
                          ->  Hash → Seq Scan on listings l
                                Filter: is_active AND status IN (...)
                                  AND owner_id <> $viewer
                                  AND approval_status = 'approved'
                    ->  Index Scan using listing_categories_pkey
                    ->  Seq Scan on "user" u
Planning Time: 0.553 ms
Execution Time: 0.347 ms
```

**Index usage verified**: the planner picks the partial index
`community_visibility_community_visible_idx` (the §1.4 partial index on
`(community_id) WHERE is_visible = true`) for the visibility filter,
satisfying R14.3.

**Timings (10 trials over neon-serverless WebSocket from local dev)**:

| stat | ms    |
| ---- | ----- |
| min  | 36.31 |
| p50  | 39.87 |
| p95  | 70.80 |
| max  | 70.80 |

DB-side execution is sub-millisecond (0.347 ms). Round-trip dominates;
that's the network/Neon serverless overhead, not the query. Both metrics
are well inside the design §8.3 budget (<50 ms p95 at MVP scale,
<200 ms p95 at 10× scale). Re-run before merge with seeded prod-shape
data per task 15.3.

### 13.2 EXPLAIN ANALYZE — re-run (task 15.3, pre-§14)

Re-run via [scripts/explain-search-listings.ts](scripts/explain-search-listings.ts)
against the dev DB after all phases landed. Viewer had **11** visible
communities; 16 candidate listings after the status/approval filter.

```
Limit  (cost=34.40..34.70 rows=12) (actual time=0.226..0.271 rows=12 loops=1)
  Buffers: shared hit=9
  ->  Unique  (actual time=0.225..0.267 rows=12)
        ->  Sort  Sort Key: l.created_at DESC, l.id, ...  Sort Method: quicksort  Memory: 40kB
              ->  Hash Join  Hash Cond: l.owner_id = cv.user_id  (rows=104)
                    ->  Hash Join  Hash Cond: l.owner_id = u.id  (rows=16)
                          ->  Hash Join  Hash Cond: l.category_id = lc.id
                                ->  Seq Scan on listings l
                                      Filter: is_active AND status = ANY('{available,rented}')
                                        AND owner_id <> $viewer AND approval_status = 'approved'
                                ->  Hash → Seq Scan on listing_categories lc
                          ->  Hash → Seq Scan on "user" u
                    ->  Hash → Seq Scan on community_visibility cv
                          Filter: is_visible AND community_id = ANY('{...11 ids...}')
Planning Time: 0.778 ms
Execution Time: 0.331 ms
```

**Timings (10 trials)**: min 32.92 ms · p50 34.33 ms · p95 62.72 ms ·
max 62.72 ms. DB-side execution **0.331 ms** — round-trip still dominates.

**Index note**: at this dev-DB scale (~76 `community_visibility` rows) the
planner now prefers a `Seq Scan` on `community_visibility` over the partial
index — a seq scan is genuinely cheaper for a tiny table. This is expected
and not a regression; the §13.1 run (3 visible communities) showed the
partial index in use, and at prod scale the planner will use it. Re-confirm
index usage when re-running task 15.3 against seeded prod-shape data; paste
both runs in the PR description.

---

## 14. Post-Implementation Correction — R5 Symmetric Per-Community Visibility

**When:** after the spec was first implemented and shipped.
**What changed:** the listing-search visibility rule, and the spec text that
described it (R5, R8, AD#2, AD#11, design §2.1/§3.3/§4.4/§8.1, this doc's
§1/§2.1/§3/§8.3/§10.3, the EXPLAIN baselines in §13).

### Why

The original implementation joined `community_visibility` on the **owner
only** (`cv.user_id = listings.owner_id`) and filtered
`cv.community_id IN (viewer's visible set) AND cv.is_visible = true`. That
made a listing appear whenever the owner and the viewer shared **any one**
community where both were visible — the listing's own `community_id` was
ignored ("origin only", per the original AD#2/R5).

In practice that broke the symmetric promise of AD#11 ("turning a community
off removes that community's listings from your feed and yours from theirs").
Because every user is auto-seeded a `community_visibility` row for **every**
community in their network (`initializeUserVisibility`, all `is_visible =
true`), any two same-network users share ~all communities by default;
toggling one off still leaves the rest, so nothing disappeared. A user who
turned "Verona Hills" off still saw every Verona Hills listing (their owners
were visible in other shared communities) and was still visible to Verona
Hills members.

### The corrected rule

A listing with `community_id = X`, owner O, is visible to viewer V **iff**
both O and V have `community_visibility(X).is_visible = true` (missing row =
`false`). The listing's `community_id` is the visibility key; it surfaces
through that community only. This is symmetric by construction: O hiding X
removes O's `community_id = X` listings for everyone (R5.7); V hiding X
removes all `community_id = X` listings for V (R5.8).

### Code touched

- [src/dal/listing.dal.ts](src/dal/listing.dal.ts) `searchListings` — count
  and data queries: `INNER JOIN community_visibility` condition changed from
  `eq(userId, ownerId)` to `and(eq(userId, ownerId), eq(communityId,
listings.communityId))`; `whereConditions` swapped
  `inArray(communityVisibility.communityId, visibleCommunityIds)` for
  `inArray(listings.communityId, visibleCommunityIds)`. `selectDistinct` /
  `countDistinct` kept as a guard for the primary-address `leftJoin` only.
- [src/dal/service-listing.dal.ts](src/dal/service-listing.dal.ts)
  `findByCommunityForBrowse` — same change, pinned to `(provider_id,
serviceListings.communityId)` and `inArray(serviceListings.communityId,
…)`.
- [scripts/explain-search-listings.ts](scripts/explain-search-listings.ts) —
  SQL updated to match.
- DAL tests: the "dedup when owner visible in multiple communities" cases
  were renamed/re-commented — that fan-out no longer exists.
- **Single-listing paths (R8.9):** added
  `communityDAL.isVisibleInCommunity(userId, communityId)` (a
  `(user_id, community_id)` unique-index point lookup, fail-closed). Replaced
  the `getMembershipForUser` + `listing.communityId === membership.community.id`
  gate — or, for the tool detail page, added one where there was none — across:
  - service detail page + API GET ([page](src/app/dashboard/services/listings/[id]/page.tsx),
    [route](src/app/api/services/listings/[id]/route.ts)) — `isProvider ||
(status active && isVisibleInCommunity(viewer, c) && isVisibleInCommunity(provider, c))`;
  - service booking page ([book/page](src/app/dashboard/services/listings/[id]/book/page.tsx)) — same gate
    (provider gets the "can't book your own" view; non-providers must pass it);
  - tool detail page ([page](src/app/dashboard/listings/[id]/page.tsx)) and tool rent page
    ([rent/page](src/app/dashboard/listings/[id]/rent/page.tsx)) — `isOwner ||
(status ∈ {available, rented} && isVisibleInCommunity(viewer, c) && isVisibleInCommunity(owner, c))`;
  - provider profile page + API GET ([page](src/app/dashboard/services/providers/[userId]/page.tsx),
    [route](src/app/api/services/providers/[userId]/route.ts)) — no single community to check, so
    the gate is "viewer and provider share ≥1 community where both are visible"
    (`getVisibleCommunityIds` for each), and the active-listings list is scoped
    to that shared set; the provider sees their own profile/listings unfiltered.

  Added `communityId: string` to the `ListingDetails` DTO + populated it in
  `listingDAL.getListingById` (and the test fixtures that build a
  `ListingDetails`). Added GET tests for the service detail route and the
  provider profile route, plus unit tests for `isVisibleInCommunity`.

### Not changed

`initializeUserVisibility` still seeds a row per network community
(`is_visible = true`) — that's fine: under the new rule those rows just gate
each listing's own community, and the default "see everything in the
network" behavior is preserved until a user opts out. No data migration
needed (`community_id` is already `NOT NULL` on both `listings` and
`service_listings`). No admin bypass added (§10.4 still holds).

### Follow-up

- [ ] Re-run [scripts/explain-search-listings.ts](scripts/explain-search-listings.ts)
      against prod-shape data; confirm the `community_visibility(user_id,
community_id)` unique index and `listings(community_id)` are used; replace
      the stale baselines in §13 (or add §13.3).
- [x] Apply the same gate to the remaining single-listing paths that were on
      the old `getMembershipForUser` pattern — done: service booking page, tool
      rent page, provider profile page + API route (see the bullet above).
- [ ] Minor wart: the tool detail/rent pages call `listingDAL.getListingById`
      (which bumps `view_count` for non-owners) before the visibility gate, so a
      blocked viewer still increments the count by 1. Fixing cleanly needs a
      pre-check query or restructuring `getListingById`.
