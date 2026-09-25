# Plan R-PERF-04: Search, messaging, detail-endpoint and cron performance

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise. **This plan has five independently
> landable parts (A–E).** Land and verify one part at a time; a STOP or test
> failure in one part does not block the others.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/dal/listing.dal.ts src/dal/service-listing.dal.ts src/db/schemas/listings.schema.ts src/db/schemas/user.schema.ts src/db/schemas/messages.schema.ts src/dal/messages.dal.ts src/app/api/messages src/features/notifications/utils/send-notification.ts src/features/notifications/utils/send-email.ts src/features/services/services/service-booking-service.ts src/features/disputes/services/dispute-creation-service.ts src/app/api/rentals src/dal/rentals.dal.ts src/app/api/cron/rental-reminders/route.ts src/dal/user.dal.ts src/app/dashboard/explore/page.tsx scripts/e2e-push.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: L (split A–E, each S–M individually) ·
  **Risk**: LOW (Parts A, D, E), MED (Parts B, C — touch the hottest polled
  endpoint and every notification-sending mutation)
- **Depends on**: R-DB-02 (this plan's two migrations take "the next free
  number after DB-02's baseline" — confirm via `ls src/db/migrations` at
  execution time, do not hard-code)
- **Category**: performance · **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: PERF-04, PERF-07, PERF-08, PERF-09, PERF-10, CONC-11 (the
  primary-address index and upsert, taken over from R-LOW-BIZ Part F-c)

## Why this matters

Five independent MEDIUM findings, bundled into one plan per the roadmap's
Phase 2 step 5 ("Performance and indexes... one endpoint at a time"):

- **PERF-04** — listing/service search `selectDistinct`s the _entire_
  `listings`/`service_listings` row (every column, including large text/jsonb
  fields) on every page, purely to guard against a non-unique join, then
  sorts/hashes the whole matched set before `LIMIT` applies. Text search
  (`ILIKE '%q%'`) can't use any index.
- **PERF-07** — chat sends and several other mutations `await` a full
  notification chain (2 user reads, an insert, a preference read, and an
  un-timeouted Resend call) before responding.
- **PERF-08** — `messages` has two identical `created_at` indexes and no
  `(conversation_id, created_at)` composite; the unread-badge count and the
  inbox's per-conversation lateral both read a user's entire message history
  to compute a small number.
- **PERF-09** — rental and listing detail endpoints run 6-7 independent
  queries in sequence instead of in parallel, including one that pulls full
  rows just to read `.length`, and bump a view counter synchronously on every
  GET.
- **PERF-10** — the rental-reminders cron's "missed start" query has no
  upper bound on how far back it looks, so it grows every day a rental stays
  `approved` and never starts, and sends two sequential notifications per row
  forever (not just for a bounded window).

None of the five is attacker-exploitable; all compound with the network
growing, which is the phase this fix is scheduled for.

## Current state

### Part A — PERF-04 (listing/service search)

- `src/dal/listing.dal.ts`: `searchListings` (~`:770-1010`). The heavy query
  (~`:936-959`):

  ```ts
  listingsWithRelations = await this.db
    .selectDistinct(selectFields)          // selectFields.listing = listings (whole table)
    .from(listings)
    .innerJoin(listingCategories, ...)
    .innerJoin(user, ...)
    .innerJoin(communityVisibility, ...)
    .leftJoin(userAddresses, and(eq(userAddresses.userId, user.id), eq(userAddresses.isPrimary, true)))
    .where(and(...whereConditions))
    .orderBy(...orderByClause)
    .limit(pagination.limit)
    .offset(offset);
  ```

  `buildSelectFields` (`:168-206`) sets `listing: listings` — the entire
  table spread into the row, including `description`, `instructions`,
  `specifications` (jsonb). `selectDistinct` exists only to guard against the
  `userAddresses` left join fanning out (a user can have more than one
  address row; only one has `isPrimary = true`, but nothing in the schema
  enforces that it's exactly one). Text search (`:838-844`):
  `or(ilike(listings.name, ...), ilike(listings.description, ...),
ilike(listings.brand, ...), ilike(listings.model, ...))`. Total count
  (`:895-911`) is a separate, sequential query before the page query — not
  run in parallel.

- `src/db/schemas/user.schema.ts:164-186`: `userAddresses` has
  `userIdIdx`/`locationIdx` only — **no unique constraint on `(user_id) WHERE
is_primary`**, confirmed by reading the full index list.
- **Primary-address writers** (the index turns their races into errors):
  `src/dal/user.dal.ts` `updateUserPrimaryAddress` (find primary `:790`,
  update-or-insert `:795-816`) and `updateUserAddress` (find `~:967`,
  update-or-insert `:976-1002`) are both plain find-then-insert, so two
  concurrent first saves (a double-submitted onboarding) both insert a
  primary row today; with the new unique index the loser gets `23505`
  (`src/dal/base.ts:42` maps it to `ConflictError`, a 409). Also
  `createUserWithAddress` (`:908`, inside a transaction, new user, safe) and
  the seeds (`e2e.seed.ts`, `users.seed.ts`: one primary per user; checked).
  Phase 3's `R-LOW-BIZ-policy-and-race-sweep.md` Part F-c (CONC-11) planned
  the same index plus an upsert; **this plan owns both** (Step A2) and
  R-LOW-BIZ F-c defers to it.
- **Who reads the search response** (the projection in Step A3 must keep
  every field any of them reads):
  - Mobile (released binaries): `hoador-mobile/src/api/contract/listings.contract.ts`
    `listingCardSchema` requires `id`, `name`, `dailyRate` (number),
    `status`, `condition`, `deliveryMode`, `setupAvailable`,
    `firstImageUrl`, `averageRating`, `reviewCount`, `communityId`,
    `categoryId`, and optional `createdAt`. A missing required key fails
    `z.object` parsing for the whole page. It deliberately strips
    `approvalStatus`/`rejectionReason`.
  - Web: `src/features/listings/components/explore-page/explore-page-content.tsx`
    reads `id`, `name`, `dailyRate`, `distanceMiles`, `averageRating`,
    `reviewCount`, `firstImageUrl`, `createdAt`, `status`; the client
    dedupes on `id`.
  - Both web paths go through `searchListings`: the API route
    (`src/app/api/listings/search/route.ts:68`) and the RSC prefetch
    `src/app/dashboard/explore/page.tsx:85`, which `qc.setQueryData`s the
    first page inside `<HydrateClient>`. Narrowing the DAL covers both.
  - Today the transform (`listing.dal.ts:~1036-1063`) returns
    `...item.listing` (every column) plus the derived fields; the `category`,
    `owner` and `ownerAddress` objects it selects are never returned.
- `src/db/schemas/listings.schema.ts:123-142`: existing indexes are
  `ownerIdIdx`, `communityIdIdx`, `categoryIdIdx`, `statusIdx`,
  `dailyRateIdx`, `nameSearchIdx` (plain btree on `name` — can't serve
  `ILIKE '%x%'`), `communityStatusIdx`, `approvalStatusIdx`,
  `statusApprovalStatusIdx`, `reviewedAtIdx`. No trigram index anywhere; no
  `(community_id, created_at)` index.
- `src/dal/service-listing.dal.ts`: `findByCommunityForBrowse`
  (`:280-345`) has the identical shape —
  `.selectDistinct({ listing: serviceListings, providerFirstName: ..., ... })`
  guarding the same kind of join, default `limit(50)`.
- **Extension availability, checked directly, not assumed**: `compose.yaml`
  runs plain `postgres:16` (no PostGIS build) for local/e2e/CI — confirmed by
  reading the file (`image: postgres:16`, nothing else). `pg_trgm` is a
  standard contrib module bundled with every stock PostgreSQL distribution
  (unlike PostGIS, which needs a special image), so it is available on
  `postgres:16` out of the box. It is also almost certainly available on Neon:
  `btree_gist` (an even less common contrib extension) was already
  successfully installed on both Neon branches by migration `0072`
  (`R-CONC-01`, DONE per the roadmap, applied dev+staging 2026-09-24) — `pg_trgm`
  is a more commonly supported extension than `btree_gist` on managed
  Postgres providers. **Verify, don't assume** (Step A1): `SELECT * FROM
pg_available_extensions WHERE name = 'pg_trgm';` on both.
- No test today creates the trigram extension in the local e2e/integration
  DB (`grep -rn "pg_trgm\|btree_gist" src/test scripts src/db/seeds` — no
  hits at all), matching the same known gap `13-production-cutover.md`
  documents for `btree_gist`/`0072` (a database built with `db:push:e2e` is
  missing anything `push` can't express). Since a trigram GIN index _is_
  expressible via `schema.ts` (unlike an exclusion constraint), this plan
  closes that specific gap for its own index (Step A5) rather than leaving
  it as an accepted limitation.

### Part B — PERF-08 (messages/unread badge)

- `src/db/schemas/messages.schema.ts:78-92`: `conversationIdIdx`,
  `senderIdIdx`, `rentalIdIdx`, `listingIdIdx`, `serviceListingIdIdx`,
  `createdAtIdx` (on `createdAt`), `lastMessageAtIdx` (**also** on
  `createdAt` — a literal duplicate, confirmed by reading both definitions;
  the name is misleading, it does not index `conversations.lastMessageAt`,
  it re-indexes `messages.createdAt`). No composite
  `(conversation_id, created_at)`.
- `src/dal/messages.dal.ts:1033-1099` `getUnreadMessageCount` — joins
  `messages` to `conversations` and evaluates the unread condition
  (`gt(messages.createdAt, conversationsN.LastReadAt)` OR `isNull(...)`) over
  **every message in every one of the user's conversations**, with no
  narrowing by `conversations.lastMessageAt` first. `notDeletedFor(userId)`
  (`:190-199`, from R-BIZ-09/DB-03) is already applied — confirmed present,
  not something this plan adds.
- `conversations.lastMessageAt` (`src/db/schemas/messages.schema.ts:49`,
  indexed) is updated by `sendMessageToUser` (`messages.dal.ts:477`) and
  `sendMessageInConversation` (`:909`) — the exact column the fix narrows
  on. **Not** by `sendMessage` (`:405-440`), which inserts a message and
  never touches `lastMessageAt`. It has no non-test caller today (`grep -rn
"\.sendMessage(" src` outside `__tests__`), but if one appears, B2's
  narrowing would silently hide its messages from the unread badge. Step B2
  fixes that first. `lastMessageAt` and `userNLastReadAt` are both JS
  `new Date()`; `messages.createdAt` is DB `now()`. The narrowing compares
  the first two, so it's no worse on clock skew than today's comparison.

### Part C — PERF-07 (blocking notification sends)

- `src/app/api/messages/conversations/[conversationId]/messages/route.ts:53-72`
  (`postHandler`) — after `messagesDAL.sendMessageInConversation` returns,
  the handler `await`s `Promise.all([userDAL.getUserById(userId),
userDAL.getUserById(data.recipientId)])` then `await
sendMessageReceivedNotification(...)`, all inside a plain `try/catch` (not
  `after()`), before `NextResponse.json(...)`. `sendMessageReceivedNotification`
  → `sendNotification` (`send-notification.ts:47-98`) → in-app insert, then
  (if `email` provided) `shouldSendEmail` + `sendEmail`.
  `src/services/resend/index.ts` constructs `new Resend(...)` with no
  timeout option (confirmed: `resend@6.12.4`'s public `.d.mts` exposes no
  client-level timeout config).
- Same **awaited, blocking** shape, confirmed by direct read, at:
  `src/app/api/messages/conversations/route.ts:129`
  (`sendMessageReceivedNotification`), `src/app/api/rentals/[id]/end/route.ts:154`
  (`sendRentalEndedNotification`), `src/app/api/rentals/[id]/decline/route.ts:136`
  (`sendRentalDeniedNotification`), `src/app/api/rentals/[id]/instructions/route.ts:102`
  (`sendInstructionsUpdatedNotification`),
  `src/features/services/services/service-booking-service.ts:166`
  (`sendNewBookingRequestNotification`), `:682`
  (`sendBookingDeclinedNotification`), `:752` (`sendJobCompletedNotification`),
  `src/features/disputes/services/dispute-creation-service.ts:254-258`
  (`sendDisputeNotifications`, wrapped in a bare `try/catch`, still awaited).
- **Already dangling, not awaited, not in `after()`** (the audit's
  "elsewhere" bullet) —
  `src/features/services/services/service-booking-service.ts:566`:
  `sendBookingAcceptedNotification(...).catch(...)` — fired without `await`
  _or_ `after()`. On Vercel/Next, a promise neither awaited nor registered
  with `after()` can be torn down the instant the response is sent; this is
  a reliability bug (the notification may silently never complete), not a
  latency one — this plan wraps it in `after()` too, not just the awaited
  ones, since `after()` is correct for _every_ one of these calls regardless
  of today's await style.
- The route sites already wrap the awaited send in `try/catch` +
  `captureNonCriticalError`, so a notification failure can't fail those
  requests today. The service sites **don't**: `service-booking-service.ts:166`
  (`createBooking`), `:682` (`declineBooking`) and `:752` (`completeBooking`)
  `await` the send bare, and `sendNewBookingRequestNotification` etc. do
  their own DB reads (`listingTitleForBooking`, `recipientForUserId`,
  `shouldSendEmail`) that can throw. A throw there fails the request **after**
  the booking row is committed (a client retry then creates a duplicate
  booking). Moving them into `after()` with a catch fixes that too.
- `after()` from `next/server` **throws** `` `after` was called outside a
request scope `` when there's no Next work store
  (`node_modules/next/dist/server/after/after.js:16`). Every
  `ServiceBookingService` method is called only from the five
  `src/app/api/services/bookings/**` routes, and `createDispute` only from
  `src/app/api/disputes/route.ts:137`, so production is fine. **Tests are
  not**: any test that calls these without mocking `next/server` will throw
  after the DB commit. Known ones that call the affected methods and don't
  mock it today: `src/features/services/services/__tests__/service-decline-accept-race.integration.test.ts`
  (`declineBooking`) and `service-early-completion.integration.test.ts`
  (`completeBooking`). The existing pattern to copy is
  `need-fanout.integration.test.ts:15-23`.
- `sendNotification`'s push branch (`send-notification.ts:109-157`) is itself
  un-awaited. Inside `after()`, the callback resolves once the in-app row
  and email are done, and the push promise still dangles past it, as it does
  today. That's no regression, and it's out of scope here; see Maintenance
  notes.

### Part D — PERF-09 (detail endpoint chains)

- `src/dal/rentals.dal.ts` `getRentalDetailsById` (`:2351-` — two branches,
  request-type at `~2410-2500` and rental-type at `~2600-2705`, structurally
  identical). Per branch, after the initial joined query, **six sequential,
  mutually-independent `await`s**: `listing`
  (`this.db.query.listings.findFirst`), `firstImage`
  (`listingImages` select), `renter` (`this.db.query.user.findFirst`),
  `renterCompletedRentals` (`this.db.select().from(rentalRequests).where(...)`
  — a **full row select used only for `.length`**), `owner`
  (`this.db.query.user.findFirst`), `ownerAddress`
  (`this.db.query.userAddresses.findFirst`). None depends on another's
  result — all only need `request.listingId`/`renterId`/`ownerId` from the
  first query. `count` is already imported and used elsewhere in this same
  file (`:2786`, `:2799`, `sql<number>\`count(\*)::int\``at`:807`) —
  precedent for the fix.
- `src/app/api/rentals/[id]/route.ts` `getHandler` (`:93-` ) — after
  `rentalDAL.getRentalDetailsById`, sequentially `await`s
  `legalDocumentDAL.getRentalAgreementAcceptance(id, userId)`, then
  `resolveRentalIdForDispute(data)` + `rentalDisputeEligibility(...)`. Both
  independent of each other (both only need `data`/`id`/`userId`), each
  already individually wrapped in `tryCatch` and degrading to `null`/ineligible
  on failure — safe to run via `Promise.all`.
- `src/dal/listing.dal.ts` `getListingById` (`:335-`) — `listing` (relational
  query with `owner`/`category`/`availability`), `images` (separate select),
  `ownerUser` (**a second query for `user.id = listing.ownerId`** solely to
  get `reviewAggregateRating`/`reviewCount`, columns not requested in the
  first query's `owner` relation — could be eliminated by adding those two
  columns to the first query's `owner.columns` instead of a second round
  trip), `isFavorited` (conditional), `ownerAddress`
  (`getUserPrimaryAddress`), then an **unconditional `UPDATE listings SET
view_count = view_count + 1`** on every non-owner GET, awaited before the
  function returns.
- `getListingById` has **14 callers**, not two (`grep -rn "getListingById("
src` outside tests): three RSC pages (`dashboard/listings/[id]/page.tsx:23`,
  `.../rent/page.tsx:23`, `.../edit/page.tsx:59`), `api/listings/[listingId]/route.ts:79`,
  and `updateListing` (`listing.dal.ts:615`) pass a `userId`, so they can
  reach the view bump. Every other caller (`rental-quote.ts:99`,
  `listing-service.ts:61`, the images/status/availability/admin
  approve/reject routes) passes no `userId` and never reaches it. All five
  bump-capable callers run inside a request (route handler or Server
  Component), and `after()` is valid in both. The return shape doesn't
  change, so no caller needs editing. Test files that exercise the real
  `getListingById` with a `userId` need a `next/server` `after` mock
  (`src/dal/__tests__/listing.dal.test.ts` at least; grep the 13 test files
  that mention it).
- `getRentalDetailsById`'s viewer: the route computes `viewerRole`
  (`route.ts:~160`) **between** the agreement fetch and the dispute fetch,
  so Step D2 must move it above both. R-PRIV-05 (agreement signed URLs)
  edits the same `agreement` block of this handler; whichever lands second
  rebases onto the other.

### Part E — PERF-10 (rental-reminders cron)

- `src/app/api/cron/rental-reminders/route.ts` (full file, read above) —
  `maxDuration = 60` already set (R-PERF-05, landed). Loops `rows` (from
  `getApprovedRentalsForDailyReminders`), 2 sequential `sendNotification`
  calls per row (owner + renter), each individually try/caught, no batching,
  no time budget beyond `maxDuration`.
- `src/dal/rentals.dal.ts:1349-1408` `getApprovedRentalsForDailyReminders` —
  two queries: `startingToday` (bounded to exactly one day, fine) and
  `missedStart`:

  ```ts
  .where(and(eq(rentalRequests.status, "approved"), lt(rentalRequests.startDate, day)))
  ```

  **No lower bound** — every `approved` request that ever missed its start
  date, no matter how long ago, is re-selected and re-notified _every single
  day_ forever, because nothing ever moves a never-started `approved` request
  out of that status. `grep -rn "hasRentalReminderBeenSent"
src/dal/rentals.dal.ts src/app/api/cron/rental-reminders` → no matches —
  confirmed genuinely absent, not just unused; there is no dedupe or
  windowing mechanism to build on.

## Decisions for the maintainer

**1. PERF-04 index: `pg_trgm` availability.** Confirmed available on stock
`postgres:16` (bundled contrib module); confirmed with high confidence but
not yet directly queried on Neon (`btree_gist` — a rarer extension —
already works there per `0072`). **Recommendation: proceed assuming
availability, with Step A1 as a hard gate** — verify via
`pg_available_extensions` on dev/staging before generating the migration; if
either environment doesn't have it (unlikely), STOP and report rather than
guessing at a workaround.

**2. PERF-04 trigram index shape.** The search predicate is one `OR` of four
`ILIKE`s: `name`, `description`, `brand`, `model` (`listing.dal.ts:838-844`).
Postgres can only answer an `OR` from indexes with a `BitmapOr`, and a
`BitmapOr` needs **every** arm to be indexable. Index only
name/brand/model (the finding's wording) and the unindexed `description` arm
forces a sequential scan for the whole predicate, so those three indexes
would never be used by this query.

- **Option A — four single-column `gin_trgm_ops` indexes** (name,
  description, brand, model). Query unchanged, search behavior unchanged.
  `description` is the largest column, so its index is the biggest, but
  listings are few.
- **Option B — drop `description` from the search `OR`** and index the
  other three. Smaller, but a user-visible behavior change (searching a
  word that appears only in a description stops matching).
- **Option C — one expression index** on `(name || ' ' || coalesce(description,'')
|| ...)` with the query rewritten to one `ILIKE` on the same expression.
  One index, but the query and index must stay byte-identical forever.

**Recommendation: Option A.** Steps assume it. Step A7's test proves the
plan actually uses the indexes, which is what would have caught the
three-index version.

**3. `CREATE INDEX CONCURRENTLY`: needed now, or deferred?** hoador has no
production traffic yet, and dev/staging's `listings`/`messages` tables are
near-empty (pre-launch seed/test data only) — a plain, transactional `CREATE
INDEX` via `bun run db:migrate` is safe and fast on both today.
**Recommendation: land both index migrations as ordinary (non-concurrent)
migrations now.** Per R-DB-02's Maintenance notes, `CREATE INDEX
CONCURRENTLY` cannot run inside `db:migrate`'s single-transaction batch at
all (a hard Postgres restriction, not a style choice) — so if either index
is ever applied after real rows accumulate (a future prod launch with an
already-populated `messages`/`listings` table, or a staging environment that
has grown large), it must be re-cut as a manual, `CONCURRENTLY`, autocommit
`psql` step, then marked applied exactly as R-DB-02's Step 5 describes
(insert one row into `drizzle.__drizzle_migrations` with that migration's
hash/`when`, do not run it through `db:migrate`). Flagged again in each
part's Production cutover note below so this isn't missed at that point in
the future.

**4. PERF-10 stale-approval policy.** The finding itself says "decide a
policy for stale approvals" — this plan does not invent a business rule for
what happens to a rental that never started (auto-cancel, flag for admin
review, etc. — a real product decision out of this plan's scope).
**Recommendation: bound the reminder window to 1-3 days after the missed
start** (remind daily for up to 3 days, then stop — no further reminders,
and no automatic status change) rather than adding a new dedupe table or
column. This directly fixes the "grows forever" bug (the query result size
is now capped by how many rentals go stale _within a 3-day window_, not by
the total historical backlog) without a schema change or a business-policy
decision this plan isn't positioned to make. If the maintainer later decides
stale approvals should auto-cancel or otherwise transition, that is a
separate, larger plan (touches the booking state machine).

## Commands

| Purpose                                  | Command                                                                                   | Expected              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| Typecheck                                | `bun run type-check`                                                                      | exit 0                |
| Lint                                     | `bun run lint`                                                                            | exit 0                |
| Generate migration                       | `bun run db:generate`                                                                     | new migration file(s) |
| Targeted tests (per part, see each Step) | `bun run test:run <paths>`                                                                | all pass              |
| Full tests                               | `bun run test:run`                                                                        | all pass              |
| Real-DB tests                            | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                 | all pass              |
| Extension check                          | `psql "$DATABASE_URL" -c "SELECT * FROM pg_available_extensions WHERE name = 'pg_trgm';"` | one row               |

## Scope

**In scope**:

- Part A: `src/dal/listing.dal.ts`, `src/dal/service-listing.dal.ts`,
  `src/db/schemas/listings.schema.ts`, `src/db/schemas/user.schema.ts`
  (+ generated migration), `src/dal/user.dal.ts` (the two primary-address
  upserts), the web readers type-check forces for `ListingSearchCard`
  (`src/app/dashboard/explore/page.tsx`, `explore-page-content.tsx`,
  `use-listings.ts`, `src/app/test-api/page.tsx`), `scripts/e2e-push.ts`
  (pg_trgm extension bootstrap for local/CI), tests for all of the above.
- Part B: `src/db/schemas/messages.schema.ts` (+ generated migration),
  `src/dal/messages.dal.ts` (`getUnreadMessageCount`), tests.
- Part C: `src/services/resend/index.ts` or `src/features/notifications/utils/send-email.ts`
  (timeout wrapper), the 8 route/service call sites listed under Part C's
  "Current state", tests.
- Part D: `src/dal/rentals.dal.ts` (`getRentalDetailsById`, both branches),
  `src/app/api/rentals/[id]/route.ts`, `src/dal/listing.dal.ts`
  (`getListingById`), tests.
- Part E: `src/dal/rentals.dal.ts` (`getApprovedRentalsForDailyReminders`),
  `src/app/api/cron/rental-reminders/route.ts`, tests.

**Out of scope**: PERF-03 (auth hot path, DONE), PERF-05/06 (cron
reliability, DONE), PERF-11 through PERF-16 (LOW, Phase 3); ARCH-04's
durable queue (Cross-plan decision 2 — this plan uses `after()` only, no
queue); rewriting `sendNotification`'s architecture; the booking
state-machine question Decision 4 raises.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Part A — PERF-04: listing/service search

**A1. Verify `pg_trgm` on dev and staging (Decision 1).** Against each
environment (check `.env.local`'s active `DATABASE_URL` first):

```sql
SELECT * FROM pg_available_extensions WHERE name = 'pg_trgm';
```

**STOP condition**: zero rows on either environment — report and do not
proceed with Steps A2-A5 until resolved.

**A2. Partial unique index on `user_addresses`, drop the `selectDistinct` it
was guarding against.** In `src/db/schemas/user.schema.ts`, in the
`userAddresses` table's index object (the same object as `userIdIdx`/`locationIdx`,
matching this file's existing object-return style, not an array):

```ts
primaryPerUserIdx: uniqueIndex("user_addresses_primary_unique")
  .on(table.userId)
  .where(sql`${table.isPrimary} = true`),
```

Import `uniqueIndex` (already imported in this file — confirm) and `sql`
from `drizzle-orm` if not already imported. In `listing.dal.ts`'s
`searchListings`, change `.selectDistinct(selectFields)` to
`.select(selectFields)` (the `communityVisibility` join was already
confirmed 1:1 by the surrounding comment; the new unique index makes the
`userAddresses` left join 1:1 too, so `DISTINCT` no longer guards anything).
Do the same in `service-listing.dal.ts`'s `findByCommunityForBrowse`
(`.selectDistinct(...)` → `.select(...)`) — its join shape is the same
community-visibility pattern with no address join at all, so nothing was
ever fanning it out; the `DISTINCT` there was pure overhead
(`community_visibility_user_community_idx` is unique on `(user_id,
community_id)`, so the visibility join is 1:1 in both queries).

Keep the count query's `countDistinct(listings.id)`: it's cheap, and it's
the guard that stays correct if a future join fans out.

Make the two find-then-insert primary-address writers conflict-safe, since
the index turns their race into a 409 (Current state). In
`updateUserPrimaryAddress` and `updateUserAddress`, replace the
"find existing primary → update by id, else insert" branch with one upsert
on the partial index (drizzle-orm 0.45 supports `targetWhere`,
`pg-core/query-builders/insert.d.ts:65`):

```ts
await this.db
  .insert(userAddresses)
  .values({ userId, ...fields, isPrimary: true })
  .onConflictDoUpdate({
    target: userAddresses.userId,
    targetWhere: sql`${userAddresses.isPrimary} = true`,
    set: { ...fields, updatedAt: new Date() },
  });
```

(`fields` = exactly what each method sets today in its update branch; read
both first. The `targetWhere` must match the index predicate textually
enough for Postgres to infer it: `is_primary = true`.) This takes over
R-LOW-BIZ Part F-c (CONC-11), including its race test (A7).

**Verify**: `bun run type-check` → exit 0.

**A3. Narrow the search SELECT to card fields.** In `buildSelectFields`
(`listing.dal.ts:168-206`), replace `listing: listings` (the whole table)
with an explicit column object, and drop the never-returned `category` and
`ownerAddress` sub-objects (keep the `userAddresses` join itself: the
distance expression reads it). The columns are the **union** of the mobile
contract and the web card (Current state):

```ts
listing: {
  id: listings.id,
  name: listings.name,
  dailyRate: listings.dailyRate,
  status: listings.status,
  condition: listings.condition,
  deliveryMode: listings.deliveryMode,
  setupAvailable: listings.setupAvailable,
  communityId: listings.communityId,
  categoryId: listings.categoryId,
  createdAt: listings.createdAt,
},
```

and the transform returns exactly those plus the derived `averageRating`,
`reviewCount`, `firstImageUrl`, `distanceMiles` (no more `...item.listing`
spread of the full row, and no `weeklyRate`/`securityDeposit`/`deliveryFee`/
`setupFee` conversions, which only existed for the spread). Give it its own
type, `export type ListingSearchCard = Pick<UserListing, ...> & {...}`, and
change `searchListings`' return type to `PaginatedResult<ListingSearchCard>`.
Type-check then lists every web reader of a dropped field: the explore page
RSC prefetch, `ExplorePageContent`'s `UserListing[]` prop,
`useSearchListings`' cache type, and `src/app/test-api/page.tsx`. Retype
those; don't re-add fields to satisfy a type that nothing renders.

Before finalizing, check that no **earlier released** mobile build required
more: `git -C ../hoador-mobile log -p --follow -- src/api/contract/listings.contract.ts`,
and keep any field an older `listingCardSchema` required. This is the same
"explicit allowlist, not a spread" rule R-PRIV-01/R-SEC-07 used, applied here
for query cost. **STOP condition**: a field any consumer reads is missing
from the list. Add it; don't ship a card regression to save one column.

**Verify**: `bun run type-check` → exit 0; the search route's existing
tests (`src/app/api/listings/search/__tests__/route.test.ts`) still pass
(update its fixtures if they assert on now-dropped fields); a new test
case parses one real `searchListings` result with a copy of mobile's
`listingCardSchema` (the R-SEC-07 contract-test pattern, if the repo has
one; otherwise inline the zod object) and succeeds.

**A4. Run count and page in parallel.** In `searchListings`, the count query
(`~:895-911`) and the page query (`~:936-959`) don't depend on each other
(both use the same `whereConditions`, built once, already). Wrap both in
`Promise.all`:

```ts
const [[{ total }], listingsWithRelations] = await Promise.all([
  this.db.select({ total: countDistinct(listings.id) }).from(listings)....where(...),
  this.db.select(selectFields).from(listings)....where(...).orderBy(...).limit(...).offset(...),
]);
```

(the existing `try/catch` around the page query's PostGIS-fallback handling,
noted in Current state, must stay — wrap only the two independent awaits,
not the fallback retry logic that depends on the page query's own result).

**Verify**: `bun run type-check` → exit 0.

**A5. Trigram indexes and the community/created_at index.** In
`listings.schema.ts`'s index object, add:

```ts
// .op() is drizzle's column opclass API (pg-core/columns/common.d.ts:103);
// a raw sql`` expression would be stored as an opaque expression and can
// make later push/generate diffs noisy.
nameTrgmIdx: index("listings_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
descriptionTrgmIdx: index("listings_description_trgm_idx").using("gin", table.description.op("gin_trgm_ops")),
brandTrgmIdx: index("listings_brand_trgm_idx").using("gin", table.brand.op("gin_trgm_ops")),
modelTrgmIdx: index("listings_model_trgm_idx").using("gin", table.model.op("gin_trgm_ops")),
communityCreatedAtIdx: index("listings_community_created_at_idx").on(
  table.communityId,
  table.createdAt.desc(),
).where(sql`${table.isActive} = true AND ${table.status} IN ('available', 'rented')`),
```

Import `sql` if not already present. Run `bun run db:generate` — this emits
`CREATE INDEX ... USING gin (... gin_trgm_ops)` and the partial btree index,
but **not** `CREATE EXTENSION pg_trgm` (drizzle-kit's snapshot schema has no
extension concept — confirmed in R-DB-02's plan). Hand-edit the generated
`.sql` file to prepend, before the first `CREATE INDEX`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
```

This is a normal generated migration with one manually-added line, not a
`--custom` file — future `drizzle-kit generate`/`push` runs still track the
three trigram indexes and the partial index correctly; only the one-time
extension line needed hand-adding, same treatment R-DB-02's Step 4 gives
`btree_gist`.

Per Decision 3, land this as an ordinary migration now (tables are
near-empty). Note in the migration file's own comment, next to the extension
line, that a future re-application against a populated table needs
`CONCURRENTLY` + manual apply (see Maintenance notes).

Generate once for all of Part A (after A2 and A5's schema edits), so the
`user_addresses_primary_unique` index lands in the same file.

**Verify**: `bun run type-check` → exit 0; read the generated file once,
confirm it contains exactly the extension line (first), 4 `USING gin (...
gin_trgm_ops)` indexes, the partial `listings_community_created_at_idx`,
and `CREATE UNIQUE INDEX "user_addresses_primary_unique" ... WHERE
"user_addresses"."is_primary" = true`, and nothing else (a stray unrelated
diff from schema drift is a STOP condition — re-run `bunx drizzle-kit check`
first if so). Then, against the local e2e DB, `bun run db:migrate:e2e` on a
fresh volume (`docker compose down -v && docker compose up -d`) → succeeds,
which proves the extension line precedes its first use inside the one
migration transaction.

**A6. Bootstrap `pg_trgm` for local e2e/CI so the new indexes are actually
exercisable in tests** (closing the same gap `0072`/`btree_gist` left open,
which this plan does not have to accept for its own index since — unlike an
exclusion constraint — a trigram index is fully expressible in `schema.ts`
and `db:push` will create it correctly once the extension exists). In
`scripts/e2e-push.ts`, before the `drizzle-kit push` call, add a raw
`CREATE EXTENSION IF NOT EXISTS pg_trgm;` against `DATABASE_URL` (use the
`pg` client already available in this repo's dependencies — read
`scripts/e2e-push.ts`'s current imports first and match its style; a plain
`new Client(...).query(...)` before the `spawnSync` call is enough).

`db:push:e2e` is what CI's `test` job and `e2e:setup` both run, so this
covers CI too. A developer's plain `bun run db:push` against some other
local DB will fail with `operator class "gin_trgm_ops" does not exist`
until they run `CREATE EXTENSION pg_trgm` there; say so in the migration's
comment.

**Verify**: `docker compose up -d && bun run db:push:e2e` → succeeds;
`psql "$DATABASE_URL" -c "\di listings_name_trgm_idx"` shows the index
exists on the local e2e DB.

**A7. Tests.**

- `src/dal/__tests__/listing.dal.test.ts`: `searchListings` no longer calls
  `selectDistinct` (assert on the mocked query builder's method calls, per
  this file's existing mocking style); the two independent queries are
  issued via `Promise.all` (assert both mocks are called before either
  resolves, or simplest: assert the total elapsed time with both mocks
  delayed is ~one delay, not two, if the test harness supports fake timers —
  otherwise a call-order/count assertion is sufficient).
- New `src/dal/__tests__/listing-search.integration.test.ts` (real Postgres,
  R-TEST-HARNESS conventions): seed a few thousand listings via
  `src/test/integration/factories.ts` (extend it if it has no bulk listing
  factory), run `EXPLAIN (FORMAT JSON) SELECT ...` for a text-query search
  reproducing `searchListings`'s actual query (or call `listingDAL.searchListings`
  directly and assert the query plan via `pg_stat_statements`/`EXPLAIN` on
  the same connection — follow whatever pattern R-PRIV-02's integration test
  used for its own "prove the index gets used" assertion, since it hit the
  same no-PostGIS-locally class of problem) — assert the plan contains a
  `BitmapOr` over `Bitmap Index Scan`s on the four trgm indexes for a text
  query, not a `Seq Scan` on `listings`. A few thousand rows won't reliably
  make the planner prefer the index, so run `ANALYZE listings` and then the
  `EXPLAIN` inside a transaction with `SET LOCAL enable_seqscan = off`: that
  proves the indexes _can_ serve the predicate (which is what a missing
  arm breaks), without depending on cost estimates.
- New `src/dal/__tests__/user-address-race.integration.test.ts` (moved here
  from R-LOW-BIZ F-c): two concurrent `updateUserPrimaryAddress(userId, …)`
  calls for a user with no address (`raceTwo` from
  `src/test/integration/run-concurrently.ts`) → both fulfil, and `SELECT
count(*) FROM user_addresses WHERE user_id = $1 AND is_primary` is 1.
  Same for `updateUserAddress`.
- `src/app/api/listings/search/__tests__/route.test.ts`: extend/update for
  the narrowed field list (Step A3) — assert the response no longer includes
  `description`/`instructions`/`specifications` if the card fields list
  (Step A3) excludes them, or keep them if the real card needs them; this
  test is the guardrail either way.

**Verify**: `bun run test:run src/dal/__tests__/listing.dal.test.ts
src/app/api/listings/search` → pass; `docker compose up -d && bun run
db:push:e2e && bun run test:integration` → includes the new integration test,
passes.

### Part B — PERF-08: messages index and unread count

**B1. Composite index, drop the duplicate.** In `messages.schema.ts`'s index
object, remove `lastMessageAtIdx` (confirmed duplicate of `createdAtIdx` —
both index `table.createdAt`) and add:

```ts
conversationCreatedAtIdx: index("messages_conversation_created_at_idx").on(
  table.conversationId,
  table.createdAt.desc(),
  table.id.desc(),
),
```

Run `bun run db:generate` (a normal generated migration — both statements
are plain DDL, no custom SQL needed). Per Decision 3, land as an ordinary
(non-concurrent) migration now; note in the migration file's comment that a
future re-application against a populated `messages` table needs
`CONCURRENTLY` + manual apply.

**Verify**: `bun run type-check` → exit 0; the generated SQL contains one
`DROP INDEX "messages_last_message_at_idx"` and one `CREATE INDEX
"messages_conversation_created_at_idx"`.

**B2. Narrow `getUnreadMessageCount` before touching `messages`.** The
narrowing is only correct if **every** message insert also advances
`conversations.lastMessageAt`. First re-run `grep -rn "insert(messages)"
src --include=*.ts | grep -v __tests__` and read each hit: today
`sendMessageToUser` and `sendMessageInConversation` do, `sendMessage`
(`:405-440`) does not. Delete `sendMessage` if it still has no non-test
caller (and its tests); otherwise add the same `update(conversations).set({
lastMessageAt: new Date(), user1DeletedAt: null, user2DeletedAt: null })`
the other two do. **STOP** if another insert path exists that can't be made
to set it.

Then, in `messages.dal.ts`, add a first condition to the existing `and(...)` that
filters on `conversations.lastMessageAt` before the `messages` join is even
relevant:

```ts
or(
  and(eq(conversations.user1Id, userId), gt(conversations.lastMessageAt, sql`coalesce(${conversations.user1LastReadAt}, '-infinity')`)),
  and(eq(conversations.user2Id, userId), gt(conversations.lastMessageAt, sql`coalesce(${conversations.user2LastReadAt}, '-infinity')`)),
),
```

added as an additional top-level `and(...)` condition (not replacing any
existing one) — every conversation that reaches the `messages` join must
already have at least one message newer than that user's last read, so the
subsequent per-message `gt(messages.createdAt, ...)` check now only scans
the composite index's range for conversations that can possibly contribute,
instead of every message in every conversation the user has ever had. Keep
every existing condition (`notDeletedFor`, archived exclusion, sender
exclusion, the existing per-message unread check) — this is a **narrowing
addition**, not a replacement of the correctness logic.

**Verify**: `bun run type-check` → exit 0.

**B3. Tests.**

- `src/dal/__tests__/messages.dal.test.ts`: extend `getUnreadMessageCount`'s
  existing tests (if present) or add — the new `lastMessageAt` condition
  doesn't change the _result_ for any existing case (it's a redundant-but-
  narrowing filter), so every existing assertion must still pass unchanged;
  add one case proving the new clause is actually present (assert on the
  rendered SQL/mock `.where()` call args, this file's existing style).
- New `src/dal/__tests__/messages-unread.integration.test.ts` (real
  Postgres). **Correctness first**, since B2 adds a filter that can hide
  messages if it's wrong: messages created through the real DAL send
  methods (not raw inserts, so `lastMessageAt` is set the way production
  sets it), then assert the exact count for: never-read conversation;
  read, then one new message from the other user; read, then one new
  message from the user themselves (0); "mark unread" (`lastReadAt` set to
  `NULL`, `:835-842`); archived; deleted-for-user (`notDeletedFor`); user as
  `user1` and as `user2`. **Then scale**: 50 conversations × 100 messages,
  all read, plus one unread → count is 1, and `EXPLAIN` (after `ANALYZE` on
  both tables, inside a transaction with `SET LOCAL enable_seqscan = off`,
  as in A7) shows `messages_conversation_created_at_idx` used for
  `messages`. Don't assert on planner row estimates; they
  vary by version and stats.

**Verify**: `bun run test:run src/dal/__tests__/messages.dal.test.ts` →
pass; `docker compose up -d && bun run db:push:e2e && bun run
test:integration` → includes the new test, passes.

### Part C — PERF-07: move notification sends off the request path

**C1. Timeout wrapper for Resend.** The `resend` SDK (v6.12.4) exposes no
client-level timeout. In `src/features/notifications/utils/send-email.ts`,
wrap the `resend.emails.send(...)` call:

```ts
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Resend call timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
```

Wrap the existing `resend.emails.send(...)` call with `withTimeout(..., 8000)`
(8s — generous enough not to false-positive on a normal slow response, short
enough that a hung call doesn't run indefinitely inside `after()`, which
shares the request's execution budget per Vercel/Next semantics). On
timeout, the existing `catch`/error-return path already handles a rejected
promise — no new error handling needed, confirm by reading the surrounding
`try/catch` in this file first.

**Verify**: `bun run type-check` → exit 0. New test: mock `resend.emails.send`
to hang forever, assert `sendEmail` resolves within ~8s with
`{success: false}`, not indefinitely.

**C2. Wrap every listed call site in `after()`.** For each of the 8 call
sites under Part C's "Current state" (chat send route, conversations POST
route, rentals end/decline/instructions routes, and the three
`service-booking-service.ts` sites — including the already-dangling one at
`:566`), import `after` from `next/server` (already the established pattern:
`src/features/neighborhood-needs/services/neighborhood-needs-service.ts:1,83-90`)
and wrap the notification call:

```ts
// Capture plain values before scheduling; never the request, a tx, or
// anything that reads headers()/cookies() later.
const recipientId = data.recipientId;
after(async () => {
  try {
    // any user lookups the notification needs go INSIDE the try
    await sendXNotification({ ... });
  } catch (err) {
    captureNonCriticalError(err, { route: "...", action: "..." });
  }
});
```

The whole callback body sits in one `try`, not a `.catch()` on the last
call: with the user reads moved inside, a throw from `getUserById` must be
caught too. A rejection escaping an `after` callback doesn't fail the
response (it already went), but it skips `captureNonCriticalError` and
lands as an unhandled error log. Place each `after()` **after** the last
statement that can fail the request (the commit, the audit log), so the
notification is scheduled only for a mutation that actually succeeded.

using each call site's own existing route/action label where one already
exists in a nearby `captureNonCriticalError`/log call, or a short new one
matching the file's convention otherwise. For the routes that currently
build `[sender, recipient]` via `Promise.all(userDAL.getUserById(...))`
_before_ calling the notification (the chat-send route) — move that
`Promise.all` **inside** the `after()` callback too, since it's part of the
notification-building work, not something the response needs.
`dispute-creation-service.ts:254-258`'s existing bare `try/catch` becomes the
`.catch()` inside `after()` instead (drop the `try/catch`, since
`after()` + `.catch()` is this codebase's established fire-and-forget
pattern — see house rules).

**STOP condition**: if any of the 8 call sites' surrounding function is
_not_ invoked during an active request (e.g. reachable only from a cron
route or a non-request context where `after()` has no request to attach
to) — Next's `after()` requires an active request/response lifecycle;
report the exact call site rather than wrapping it incorrectly. (All 8 are
confirmed request-handler-invoked API routes/services above — this should
not trigger, but re-verify before editing since line numbers may have
drifted.)

**Verify**: `bun run type-check` → exit 0.

**C3. Tests.**

- Route tests for chat send, conversations POST, rentals end/decline/instructions
  (extend existing `__tests__/route.test.ts` files, or the pattern in
  `need-fanout.integration.test.ts:15-23` for mocking `after()`): assert the
  response is returned **before** the notification promise resolves — mock
  `sendXNotification` to hang, assert the route still responds within a
  short window (e.g. a fake-timer or a `Promise.race` against the route call
  in the test itself).
- `service-booking-service.test.ts`: same shape for accept/decline/create —
  assert `after()` (mocked per this repo's existing pattern) is called with
  a function that, when invoked, calls the expected notification.
- `send-email.test.ts`: the timeout case from C1.
- Add a `next/server` `after` mock (hold-then-run, `need-fanout.integration.test.ts:15-23`)
  to every test that now reaches an `after()` it didn't before, or it throws
  "`after` was called outside a request scope" after the commit. At least:
  `service-decline-accept-race.integration.test.ts`,
  `service-early-completion.integration.test.ts`, the route tests for the
  five routes above, and whatever `grep -rln "createBooking\|declineBooking\|completeBooking\|createDispute\|sendMessageInConversation" src --include=*.test.ts`
  finds that doesn't already mock it.
- One test per service site that throws from the mocked notification
  (`mockRejectedValue`) and asserts the method still resolves with the
  committed row and `captureNonCriticalError` was called: this is the
  "a notification failure never fails the request" guarantee, and it's new
  for `createBooking`/`declineBooking`/`completeBooking`.

**Verify**: `bun run test:run src/app/api/messages src/app/api/rentals
src/features/services src/features/disputes
src/features/notifications/utils/__tests__/send-email.test.ts` → all pass.

### Part D — PERF-09: detail endpoint parallelization

**D1. Rental detail — parallelize the 6 independent reads, use `count()`.**
In `rentals.dal.ts`'s `getRentalDetailsById`, in **both** branches
(confirmed at two near-identical locations — re-run `grep -n
"renterCompletedRentals = await this.db" src/dal/rentals.dal.ts` to find
both before editing), replace the 6 sequential `await`s with one
`Promise.all`:

```ts
const [
  listing,
  firstImage,
  renter,
  renterCompletedRentalsCount,
  owner,
  ownerAddress,
] = await Promise.all([
  this.db.query.listings.findFirst({
    where: eq(listings.id, request.listingId),
  }),
  this.db
    .select({ imageUrl: listingImages.imageUrl })
    .from(listingImages)
    .where(eq(listingImages.listingId, request.listingId))
    .orderBy(listingImages.orderIndex)
    .limit(1)
    .then((r) => r[0]),
  this.db.query.user.findFirst({ where: eq(user.id, request.renterId) }),
  this.db
    .select({ n: count() })
    .from(rentalRequests)
    .where(
      and(
        eq(rentalRequests.renterId, request.renterId),
        eq(rentalRequests.status, "completed"),
      ),
    )
    .then((r) => r[0]?.n ?? 0),
  this.db.query.user.findFirst({ where: eq(user.id, request.ownerId) }),
  this.db.query.userAddresses.findFirst({
    where: and(
      eq(userAddresses.userId, request.ownerId),
      eq(userAddresses.isPrimary, true),
    ),
  }),
]);
```

adjusting every downstream reference from `renterCompletedRentals.length` to
the new `renterCompletedRentalsCount` value directly (`count` is already
imported in this file — confirm at the top before adding a duplicate
import). Keep the return shape identical (`renterCompletedRentals:
renterCompletedRentalsCount || undefined`).

**Verify**: `bun run type-check` → exit 0.

**D2. Rental detail route — parallelize agreement + dispute eligibility.**
In `src/app/api/rentals/[id]/route.ts`'s `getHandler`, the sequential
`agreement` fetch (`legalDocumentDAL.getRentalAgreementAcceptance`) and
`dispute` fetch (`resolveRentalIdForDispute` + `rentalDisputeEligibility`)
are independent — combine into one `Promise.all`:

```ts
const [{ data: agreementRow }, { data: dispute }] = await Promise.all([
  tryCatch(legalDocumentDAL.getRentalAgreementAcceptance(id, userId)),
  tryCatch(
    (async () => {
      const rentalId = await resolveRentalIdForDispute(data);
      return rentalDisputeEligibility(rentalId, viewerRole !== "admin");
    })(),
  ),
]);
```

`viewerRole` is computed today **between** the two fetches (`route.ts:~160`),
so move its `const viewerRole: RentalViewerRole = ...` block up to just
after the 403 check, above this `Promise.all`. Keep the `agreement` mapping
(`agreementRow ? { pdfUrl, templateVersion } : null`) after it unchanged.
If R-PRIV-05 has already landed, its signed-URL change lives in that
mapping; keep it.

**Verify**: `bun run type-check` → exit 0.

**D3. Listing detail — parallelize, eliminate the redundant owner-rating
query, move the view bump to `after()`.** In `listing.dal.ts`'s
`getListingById`: add `reviewAggregateRating: true, reviewCount: true` to the
existing `owner: { columns: {...} }` selection inside the main relational
`listings.findFirst` call, and delete the separate `ownerUser` query
entirely (read `ownerAverageRating`/`ownerReviewCount` off `listing.owner`
instead). Then parallelize the remaining independent reads:

```ts
const [images, isFavorited, ownerAddress] = await Promise.all([
  this.db
    .select({
      id: listingImages.id,
      imageUrl: listingImages.imageUrl,
      orderIndex: listingImages.orderIndex,
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, id))
    .orderBy(listingImages.orderIndex),
  userId
    ? this.db.query.userFavorites
        .findFirst({
          where: and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.listingId, id),
          ),
        })
        .then((r) => !!r)
    : Promise.resolve(false),
  this.getUserPrimaryAddress(listing.ownerId),
]);
```

Move the view-count increment off the response path — import `after` from
`next/server` and change:

```ts
if (userId && userId !== listing.ownerId) {
  await this.db
    .update(listings)
    .set({ viewCount: sql`${listings.viewCount} + 1` })
    .where(eq(listings.id, id));
}
```

to:

```ts
if (userId && userId !== listing.ownerId) {
  after(async () => {
    await this.db
      .update(listings)
      .set({ viewCount: sql`${listings.viewCount} + 1` })
      .where(eq(listings.id, id))
      .catch((err) =>
        captureNonCriticalError(err, {
          route: "getListingById",
          action: "increment_view_count",
        }),
      );
  });
}
```

**STOP condition**: `getListingById` is a DAL method, and DALs are meant to
be auth-agnostic pure DB operations (per `CLAUDE.md`'s architecture section)
— `after()` itself has no auth/session dependency, so this does not violate
that boundary. But `after()` throws outside a request, and the bump runs
only when a `userId` is passed. Re-run `grep -rn "getListingById(" src`: the
five callers that pass a `userId` today (Current state: three RSC pages, the
`GET /api/listings/[listingId]` route, `updateListing`) all run inside a
request. If a new one passes a `userId` from a cron or script, stop and
report it.

The callback captures only `id` and `this.db` (the module-level pool
client), no request state. `after()` in a Server Component is supported
(Next 15+), and the callback reads no `headers()`/`cookies()`, which
Server-Component `after` forbids.

**Verify**: `bun run type-check` → exit 0; confirm every caller still
type-checks with the unchanged return shape.

**D4. Tests.**

- `src/dal/__tests__/rentals.dal.test.ts`: `getRentalDetailsById` — assert
  the 6 reads are issued via `Promise.all` (mock each with a resolved delay
  and assert total time ≈ the max, not the sum, if the test harness supports
  fake timers/delayed mocks — otherwise assert all 6 mocks were called
  before any of their results were awaited, via call-order tracking);
  `renterCompletedRentals` now uses a `count`-shaped query, not a full
  `select()`.
- New `src/dal/__tests__/rental-detail.integration.test.ts` (real
  Postgres). Mocked-DAL call counting can't see queries inside
  `getRentalDetailsById`, so count real round trips the way
  `need-fanout.integration.test.ts:252-262` does:
  `vi.spyOn((db as unknown as { $client: Pool }).$client, "query")` around
  one `rentalDAL.getRentalDetailsById(requestId, ownerId)` call on a
  factory-built request (and once on an approved rental, for the other
  branch). Assert `> 0` (the spy sees them) and `<= 7` (1 joined read + 6),
  and assert the result's `renterCompletedRentals` equals the number of
  `completed` requests the factory made for that renter. Then the route:
  agreement + dispute eligibility add their own reads; the finding's target
  is **≤ 8 for the endpoint**, so if the route total exceeds it, report the
  number rather than loosening the assertion.
- `src/dal/__tests__/listing.dal.test.ts`: `getListingById` — assert
  `ownerUser`'s separate query is gone (no second `user.findFirst` call for
  `listing.ownerId`); assert the view-count update is scheduled via a mocked
  `after()`, not awaited inline.

**Verify**: `bun run test:run src/dal/__tests__/rentals.dal.test.ts
src/dal/__tests__/listing.dal.test.ts src/app/api/rentals` → all pass;
`docker compose up -d && bun run db:push:e2e && bun run test:integration` →
includes any new integration test, passes.

### Part E — PERF-10: bound the rental-reminders cron

**E1. Window the "missed start" query.** In `rentals.dal.ts`'s
`getApprovedRentalsForDailyReminders`, add a lower bound to the `missedStart`
query per Decision 4 (remind for 1-3 days after the missed start, then
stop):

```ts
const reminderWindowStart = new Date(day);
reminderWindowStart.setDate(reminderWindowStart.getDate() - 3);

const missedStart = await this.db
  .select({...})
  .from(rentalRequests)
  .innerJoin(listings, ...)
  .where(
    and(
      eq(rentalRequests.status, "approved"),
      lt(rentalRequests.startDate, day),
      gte(rentalRequests.startDate, reminderWindowStart), // PERF-10: cap the backlog to a 3-day window
    ),
  );
```

**Verify**: `bun run type-check` → exit 0.

**E2. Cap and batch the notification sends.** In the cron route, the loop
already try/catches per-recipient — that stays (a failure on one row's
notification must not stop the rest). Add an explicit upper bound as a
second, independent safety net beyond the windowing (defense in depth, in
case the windowed query still returns an unexpectedly large batch on a bad
day): after fetching `rows`, `const capped = rows.slice(0, 200);` and log
(via the existing logger, not a new alert channel) when `rows.length >
200`. Batch the two-per-row sends with `Promise.allSettled` in chunks of,
say, 20 concurrent (matching the payout crons' existing batch-size
precedent) rather than one at a time in a plain sequential `for`:

```ts
const CHUNK_SIZE = 20;
for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
  const chunk = recipients.slice(i, i + CHUNK_SIZE);
  const results = await Promise.allSettled(
    chunk.map(({ userId, message }) =>
      sendNotification({
        userId,
        type: "rental_reminder",
        title: "Rental reminder",
        message,
        linkUrl,
      }),
    ),
  );
  sent += results.filter(
    (r) => r.status === "fulfilled" && r.value.success,
  ).length;
  for (const r of results) {
    if (r.status === "rejected")
      console.error("[rental-reminders] sendNotification failed", r.reason);
  }
}
```

(flatten `recipients` across all capped rows before chunking — build the
full `{userId, message}[]` list first, matching today's per-row
`ownerMessage`/`renterMessage` construction, then chunk that flat list).

**Verify**: `bun run type-check` → exit 0.

**E3. Tests.** `src/app/api/cron/rental-reminders/__tests__/route.test.ts`
(extend or create): a mocked `getApprovedRentalsForDailyReminders` returning
250 rows → `sendNotification` is called for at most 200 rows × 2 = 400
recipients, in chunks (assert via mock call timing/grouping, or simply that
it completes and `sent` reflects the cap); a rental request with
`startDate` 5 days before `day` is excluded from the DAL call's own test
(new case in `src/dal/__tests__/rentals.dal.test.ts` for
`getApprovedRentalsForDailyReminders`'s windowing).

**Verify**: `bun run test:run src/app/api/cron/rental-reminders
src/dal/__tests__/rentals.dal.test.ts` → all pass.

## Test plan

Each part's own Steps end in a **Verify** line; Parts A, B and D each add
one real-DB integration test (R-TEST-HARNESS conventions,
`docker compose up -d && bun run db:push:e2e && bun run test:integration`).
Full regression after all parts: `bun run type-check && bun run lint && bun
run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0 (new tests from every landed part included)
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration`
      → exit 0
- [ ] Part A: `grep -n "selectDistinct" src/dal/listing.dal.ts
  src/dal/service-listing.dal.ts` shows neither call site anymore; the
      four trigram indexes, the partial index and `user_addresses_primary_unique`
      exist in one generated migration; the address race test passes; `Verify`
      lines A1-A7 all pass
- [ ] Part B: `grep -n "lastMessageAtIdx" src/db/schemas/messages.schema.ts`
      → no match; the composite index migration is generated; the new
      integration test's `EXPLAIN` assertion passes
- [ ] Part C: all 8 call sites wrapped in `after()`; `send-email.ts` has a
      timeout; each route's test proves the response doesn't wait on the
      notification
- [ ] Part D: `grep -c "await this.db" <the getRentalDetailsById region>`
      drops from 6 sequential to 1 `Promise.all` per branch (manual read,
      not a mechanical grep, since the exact call count/shape varies); the
      route-level query-count test asserts ≤ 8
- [ ] Part E: `getApprovedRentalsForDailyReminders`'s `missedStart` query has
      a lower bound; the cron route chunks sends instead of one sequential
      loop
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2 step 5 / PERF-04, 07, 08, 09, 10) — note which parts landed if
      not all land together

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`)
  — re-read before editing that part.
- Part A1: `pg_trgm` unavailable on dev or staging.
- Part A3: a search-card field is dropped that a live component actually
  reads.
- Part C2: a listed call site turns out not to run inside an active request.
- Part D3: `getListingById` is called from a non-request context.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- **Part A**: `GET /api/listings/search` drops every column the card
  doesn't read (description, rates other than daily, deposit, fees,
  instructions, specifications, approvalStatus, …). Mobile's
  `listingCardSchema` (`hoador-mobile/src/api/contract/listings.contract.ts`)
  is a `z.object` that strips unknown keys and requires only fields Step A3
  keeps, so released binaries are unaffected. Step A3's contract-parse test
  pins that. `GET /api/services/listings` is unchanged (only `DISTINCT` goes).
  No Mobile client follow-ups row, provided A3's history check finds no
  older released schema needing more.
- **Part B, C, D, E**: no response shape change anywhere — index additions,
  `after()` wrapping, query parallelization and cron windowing are all
  internal. No Mobile client follow-ups row for any of these parts.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-PERF-04 — apply the search index migration(s) (pg_trgm +
trigram indexes on listings, user_addresses primary-unique)` | From:
  R-PERF-04 Part A | dev: TODO | staging: TODO | prod: TODO (n/a until prod
  exists) — apply via the standard `bun run db:migrate` step; **if this ever
  runs against an already-populated `listings` table** (a future prod with
  real traffic, or a staging that has grown large), re-cut the index
  creation as `CREATE INDEX CONCURRENTLY` run by hand via `psql` outside a
  transaction, then mark the migration applied per R-DB-02's Step 5 pattern
  instead of running it through `db:migrate`.
- **New row**: `R-PERF-04 — apply the messages composite-index migration` |
  From: R-PERF-04 Part B | dev: TODO | staging: TODO | prod: TODO (n/a until
  prod exists) — same `CONCURRENTLY`-if-populated caveat as above, since
  `messages` is the table most likely to have real row volume by the time
  this reaches a live environment.
- **Before Part A's migration on dev and staging**: the unique index fails
  (and rolls back the whole `db:migrate` batch) if any user already has two
  primary addresses. Run first, per environment, after checking the host:

  ```sql
  SELECT user_id, count(*) FROM user_addresses
  WHERE is_primary GROUP BY user_id HAVING count(*) > 1;
  ```

  For each hit, keep the most recently updated row primary:

  ```sql
  UPDATE user_addresses ua SET is_primary = false
  WHERE ua.is_primary AND ua.id <> (
    SELECT id FROM user_addresses x
    WHERE x.user_id = ua.user_id AND x.is_primary
    ORDER BY x.updated_at DESC, x.id LIMIT 1);
  ```

  Record the row counts in the cutover row (dev/staging). Prod: N/A.

- **Prod** is a brand-new database built by R-DB-02's single `db:migrate`
  (cutover row M0), so on prod both migrations simply run as part of M0 on
  empty tables: no duplicate check, no `CONCURRENTLY` question. Mark their
  prod column "covered by M0". The `CONCURRENTLY` caveat above only applies
  if prod launches **before** this plan lands and then accumulates rows.
- Otherwise no data cleanup: both migrations are additive
  index/extension changes.

## Maintenance notes

- Part A's narrowed search projection (Step A3) is an explicit allowlist —
  when a future feature needs a new search-card field, add it there
  deliberately rather than reverting to a full-table spread.
- Part C's `after()` wrapping still shares the request's execution budget
  (per Vercel/Next semantics) — it removes the _user-visible_ latency, not
  the underlying cost. If notification fan-out volume grows enough to matter
  even off the response path, move it onto R-ARCH-04's durable queue
  (Cross-plan decision 2) rather than building a second ad hoc mechanism
  here.
- Part E's 1-3 day reminder window doesn't solve what happens to a rental
  that never starts after 3 days — it just stops re-notifying about it
  forever. If stale approvals become a real operational problem, that needs
  its own plan against the booking state machine (`12-booking-state-machine.md`),
  not a reminder-cron tweak.
- **This plan owns `user_addresses_primary_unique` and the primary-address
  upsert** (CONC-11). R-LOW-BIZ Part F-c defers to it; if R-LOW-BIZ is
  executed first by mistake, skip Part A2's index/upsert and verify
  instead.
- `sendNotification`'s push is still an un-awaited promise inside the
  `after()` callbacks (Current state). Now that the callers are off the
  request path, awaiting it inside `sendNotification` would make it
  reliable; that changes latency for the callers that still await
  `sendNotification` inline (crons, cancel), so it's a separate change. Or
  move it onto R-ARCH-04's queue.
- Part D's `getListingById` view-count bump now runs in `after()` — if this
  method is ever called from a non-request context (see STOP conditions), that
  call site will need its own explicit `await`ed increment instead, not
  `after()`.
