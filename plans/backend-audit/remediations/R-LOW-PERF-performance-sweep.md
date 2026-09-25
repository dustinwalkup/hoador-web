# Plan R-LOW-PERF: Low-severity performance sweep — thread polling, notification queries, push-receipt batching, mobile list endpoints, missing indexes, dispute query shape

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise. **This plan has six independently landable
> parts (A–F).** Land and verify one part at a time; a STOP or test failure
> in one part does not block the others.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/dal/messages.dal.ts src/app/api/messages src/app/api/dashboard/badges/route.ts src/dal/notifications.dal.ts src/db/schemas/notifications.schema.ts src/features/notifications/lib/expo-push-service.ts src/app/api/garage src/dal/listing.dal.ts src/dal/rentals.dal.ts "src/app/api/(payments)/get-payment-methods/route.ts" src/app/api/schedule/route.ts src/dal/service-booking.dal.ts src/db/schemas/user.schema.ts src/db/schemas/rental-payment-lifecycle.schema.ts src/db/schemas/service-payment-lifecycle.schema.ts src/db/schemas/services.schema.ts src/dal/dispute.dal.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition. Mobile-side pieces (Part A) additionally need, from
> `hoador-mobile`: `git diff --stat -- src/features/messages/hooks/use-conversation.ts src/api/contract/conversations.contract.ts`.

## Status

- **Priority**: P3 · **Effort**: L (split A–F, each S–M individually) ·
  **Risk**: LOW (Parts B–F), LOW-MED (Part A — touches the most-polled
  endpoint and adds mobile-side merge logic)
- **Depends on**: R-DB-02 (this plan's migrations take "the next free number
  after DB-02's baseline" — confirm via `ls src/db/migrations` at execution
  time, do not hard-code); no hard dependency on R-PERF-04, but re-run `ls`
  again if it landed first, since it also adds migrations
- **Category**: performance · **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: PERF-11, PERF-12, PERF-13, PERF-14, PERF-15, PERF-16

## Why this matters

Six independent LOW findings, none attacker-exploitable, all the kind of cost
that compounds as the network grows — the same framing R-PERF-04 used for its
five MEDIUM siblings, one severity tier down. **Already covered by R-PERF-04
— do not duplicate here**: `searchListings`/`buildSelectFields`, service
browse `selectDistinct`, the three trigram indexes +
`listings_community_created_at_idx`, `user_addresses_primary_unique`, the
messages `(conversation_id, created_at, id)` composite index + dropping the
duplicate `lastMessageAtIdx`, `getUnreadMessageCount`'s `lastMessageAt`
narrowing, `after()`-wrapping the message/rental/service/dispute notification
call sites + a Resend timeout, `getRentalDetailsById`, the rental detail
route, `getListingById`, and the rental-reminders cron. This plan's Part A
touches the _same file_ as R-PERF-04 Part B (`messages.dal.ts`) but a
different method (`getConversationDetails`, not `getUnreadMessageCount`) — no
overlap in code, but land R-PERF-04 Part B first if both are in flight, and
re-run this plan's drift check afterward.

- **PERF-11** — the open-conversation poll (every 20s while a thread is
  focused) re-fetches and re-joins the full 50-message window every tick,
  even when nothing changed.
- **PERF-12** — the dashboard/mobile badges endpoint always pays for a
  10-row notifications fetch mobile never reads; `notifications.dal.ts`'s
  `create()` does a wasted existence check on every single notification, and
  `getUserNotifications()` joins in the viewer's own user row (nobody reads
  it, and it's a PRIV angle — the endpoint hands the client's own
  name/email/image back to itself for no reason).
- **PERF-13** — the push-receipt cron updates up to 3,000 rows one at a time,
  sequentially awaited.
- **PERF-14** — several mobile-only list/count endpoints over-fetch full rows
  to compute a length, run redundant queries, or await independent reads
  sequentially.
- **PERF-15** — `session.user_id`, `account.user_id`, `verification.identifier`,
  `user.stripe_connected_account_id`, both payment-lifecycle tables'
  transfer/charge-id columns, `service_bookings.listing_id`, and
  `rental_requests`'s stale-processing lookup all lack an index a real query
  path uses.
- **PERF-16** — `getUserDisputes`'s default branch (no role filter) ORs four
  correlated `EXISTS` subqueries against `rentals`/`service_bookings`, which
  can't use any of `disputes`' own indexes.

## Current state

### Part A — PERF-11: thread poll has no incremental cursor

- Mobile `hoador-mobile/src/features/messages/hooks/use-conversation.ts`:
  `THREAD_POLL_INTERVAL_MS = 20_000`, `THREAD_PAGE_SIZE = 50`,
  `threadPath(conversationId, before?)` builds `?limit=50[&before=...]` — the
  poll (`refetchInterval` while `useIsFocused()`) calls the same `queryFn`
  every tick with no cursor, so it's always a full-window request.
  `use-older-messages.ts` is the only existing caller of `before` (backward
  pagination, unrelated to this fix).
- Web `src/dal/messages.dal.ts` `getConversationDetails(conversationId, userId, {limit, before})`
  (~648-786): resolves an optional `before` keyset cursor via
  `resolveThreadCursor` (~358-406, before-only — accepts a message id or ISO
  timestamp), then
  `db.query.messages.findMany({ where: and(eq(conversationId), cursor ? olderThan(cursor) : undefined), orderBy: [desc(createdAt), desc(id)], limit: limit+1, with: {sender, listing, serviceListing} })`.
  `olderThan(cursor)` (~104-111) is a keyset predicate on `(createdAt, id)`.
  Route `src/app/api/messages/conversations/[conversationId]/route.ts` reads
  only `limit`/`before` from the query string.
- Contract `hoador-mobile/src/api/contract/conversations.contract.ts`:
  `conversationDetailsSchema { id, otherUser, messages, unread?, archived, hasMore? }`
  — no `after`/cursor field today.

### Part B — PERF-12: notification-query waste

- `src/app/api/dashboard/badges/route.ts` `getHandler`: unconditional
  `Promise.all([messagesDAL.getUnreadMessageCount, notificationsDAL.getUnreadCount, notificationsDAL.getUserNotifications(userId, {page:1, limit:10, unreadOnly:false})])`.
  The third call's rows feed only the web bell dropdown
  (`src/features/dashboard/hooks/use-dashboard-badges.ts`'s
  `DashboardBadges.notifications.data`). Mobile calls the same endpoint
  (`hoador-mobile/src/features/dashboard/hooks/use-badges.ts` →
  `apiFetch('/api/dashboard/badges', {schema: badgesSchema})`) but its
  `badges.contract.ts` models only `{unreadMessages, unreadNotifications}` —
  confirmed the third field is never read on mobile.
- `notifications.dal.ts` `create()` (~69-95): `this.db.query.user.findFirst({where: eq(user.id, data.userId)})`
  before every insert, solely to throw a nicer `ValidationError("User not found", "userId")`.
  `base.ts`'s `handleError` (~45-46) already maps a raw FK violation (Postgres
  `23503`) to `ValidationError("Referenced record does not exist")` — a
  generic message, no field name, but the same error class and status code.
- `getUserNotifications()` (~145-218): `innerJoin(user, eq(notifications.userId, user.id))`
  selecting `{id, name, email, image}` on every row. `BadgeNotification`
  (`use-dashboard-badges.ts:5-15`, the web type for this exact response) has
  no `user` field — confirmed no consumer reads it.
- `notifications.schema.ts` (~21-44): single-column indexes on `userId`,
  `type`, `isRead` only — every real query (`getUserNotifications`,
  `getUnreadCount`) filters on `userId` **and** `isRead` together; no
  composite exists.

### Part C — PERF-13: push-receipt cron updates rows one at a time

- `src/features/notifications/lib/expo-push-service.ts`
  `checkExpoPushReceipts()` (~375-458): `RECEIPT_BATCH_LIMIT = 3000`. Per
  Expo-capped chunk (≤300 ticket ids), a `for...of Object.entries(receipts)`
  loop `await`s `pushSubscriptionDAL.resolveReceipt(audit.id, "ok" | "error", message)`
  **and**, for `DeviceNotRegistered` errors, `pushSubscriptionDAL.deactivateByToken(token)`
  — both per-row, sequentially, inside the loop.
- `notifications.dal.ts` `resolveReceipt` (~985-1004): single-row `UPDATE ...
WHERE id = auditId`. `deactivateByTokens` (~844-854, plural, already exists
  from PERF-02): `UPDATE ... WHERE token IN (...)` — the batched precedent
  this plan reuses; `deactivateByToken` (singular) is the one still called
  per-row in the loop.

### Part D — PERF-14: mobile list/count endpoints

- `src/app/api/garage/pending-count/route.ts`: `listingDAL.getUserListingsByApprovalStatus("rejected", userId)`
  then `.length` — fetches every column of every rejected listing to count
  them.
- `src/app/api/garage/pending-review/route.ts` (~9-40): fetches
  `pending_review` listings, fetches `rejected` listings, **then a third,
  redundant query** — `db.select({id, rejectionReason}).from(listings).where(eq(listings.ownerId, userId))`
  (no status filter at all) — to build a `rejectionReasonsMap`, when
  `rejectionReason` is already a column on the `rejectedListings` rows
  already fetched in the second query.
- `listing.dal.ts` `_enrichListingsWithRatingsAndImages` (~1451-1494): selects
  **every** `listingImages` row for the id set, `orderBy(asc(orderIndex))`,
  then keeps the first-seen row per `listingId` in a JS `Map` loop. Also used
  by `pulse-data.ts` (~107).
- `rentals.dal.ts` `countBorrowedListings` (~503-506): `select().from(rentalRequests).where(...)` (full rows) → `.length`.
  **Zero callers** (`grep -rn "countBorrowedListings(" src --include=*.ts` →
  only its own definition and a test file). `countSharedListings` (~517-527,
  same full-row-then-`.length` shape) **is** called, by `pulse-data.ts` (~99).
- `src/app/api/schedule/route.ts`: already `Promise.all`s its 6 top-level DAL
  calls. Each DAL method still `await`s its own two role queries
  sequentially: `rentals.dal.ts` `getScheduleRentals` (~3394-3444, `asRenter`
  then `asOwner`), `getActionableRentals` (~3457-3521, same shape),
  `getReviewableRentals` (~3522-, same shape); `service-booking.dal.ts`
  `getScheduleBookings` (~569), `getActionableBookings` (~636),
  `getReviewableBookings` (~704) — confirmed identical
  `await asX; await asY; return [...]` structure in
  `getScheduleRentals`/`getActionableRentals` by direct read.
- `src/app/api/(payments)/get-payment-methods/route.ts`: sequential
  `PAYMENT_SERVER_INSTANCE.paymentMethods.list(...)` then
  `PAYMENT_SERVER_INSTANCE.customers.retrieve(...)` — both only need
  `user.stripeCustomerId`, independent of each other's result.

### Part E — PERF-15: missing indexes (verified against the live schema)

- `session.userId`, `account.userId` (`user.schema.ts` ~108-145, better-auth
  tables): no index on either FK column (only `user.lastActiveAtIdx` exists
  on the `user` table itself).
- `verification.identifier` (`user.schema.ts` ~150-159): no index.
- `user.stripeConnectedAccountId`: no index.
- `rental_payment_lifecycle.stripeTransferId` (lookup:
  `payment-lifecycle.dal.ts` ~234) and `rentalChargeId`: neither indexed.
- `service_payment_lifecycle.stripeTransferId` (lookup:
  `service-payment-lifecycle.dal.ts` ~146) and `chargeId`: neither indexed.
- `service_bookings.listingId` (lookup: `service-booking.dal.ts` ~441): not
  indexed.
- `rental_requests` — `findStaleProcessingRequests` (`rentals.dal.ts` ~1955)
  filters `payment_status = 'processing'`, no supporting index; precedent for
  a partial index already in this table: `pendingExpiresAtIdx`.
- **Re-verify each lookup's live query at execution time** (this Part's own
  inventory step, Step E1) rather than trusting this list frozen — a Phase 2
  plan (R-ARCH-04's reconciliation, R-CONC-04's reversal) may have already
  landed and added its own index on the same transfer/charge-id columns by
  the time this executes.

### Part F — PERF-16: `getUserDisputes` can't use an index

- `dispute.dal.ts` `getUserDisputes` (~346-455): the default (no-role) branch
  ORs 4 correlated `EXISTS` subqueries (rentals renter/owner, service_bookings
  requester/provider); the `renter`/`provider` role branches OR 2 each. Both
  the `count(*)` query and the paginated `findMany` build the same
  `whereClause` from these conditions.
- Confirmed present on both sides: `rentals_renter_id_idx`,
  `rentals_owner_id_idx` (`rentals.schema.ts:190-191`), `sb_requester_idx`,
  `sb_provider_idx` (`services.schema.ts:150-151`), `disputes_rental_id_idx`,
  `disputes_service_booking_id_idx` (`disputes.schema.ts:75-76`) — every
  index the rewrite below needs already exists; this Part is a pure query
  rewrite, no migration.
- Callers: `src/app/api/disputes/route.ts` (~58, the general list, worst
  case: no role, `limit` from pagination), `admin/users/[userId]/route.ts`
  (~49, `limit: 1`), `pulse-data.ts` (~111, `limit: 100`, no role — also the
  worst case, run for every dashboard load).

## Decisions for the maintainer

**1. Part A: additive `after` cursor, with the merge done client-side by
concatenate-and-dedupe, not a server-side "is this a full window or a
catch-up" flag.** Two designs were possible: (a) have the server return a
flag distinguishing "here's your incremental catch-up" from "the gap was too
big, here's the full window instead," or (b) keep the response shape
identical either way and let the client merge safely regardless. **(b) is
simpler and safer**: the client always merges the returned `messages` into
its cached array by `(createdAt, id)`, de-duplicating by `id` — if the server
served a full window (either because `after` was omitted, or because the
gap exceeded the page size and the server fell back), the merge is still
correct, just a no-op-heavy one (most ids already present get filtered out).
No new response field, no client branch on "which kind of response was
this." **Recommendation: implement (b), Steps A2-A4 below.**

**2. Part A: skip the poll entirely using the inbox's `unread`/`lastMessageAt`
signal instead?** Considered and rejected for this plan. It would mean
cross-referencing a separate poller (the dashboard badges poll, Part B) that
isn't guaranteed to be mounted while a thread screen is open, and would only
suppress _some_ ticks rather than shrinking the ones that do run — it doesn't
fix the underlying full-window re-fetch, it just skips it sometimes,
unreliably. The cursor approach (Decision 1) fixes the actual cost on every
tick that does run.

**3. Part B: `?include=recent` opt-in, not a separate endpoint.** The web
dashboard bell needs the 10 recent notifications; mobile's identical call
today never reads them. Adding a query param the web hook explicitly passes
(`?include=recent`) and defaulting to _not_ running that query keeps one
endpoint, one contract, zero mobile changes (mobile's existing call, with no
param, gets the cheaper default automatically). **Recommendation: proceed as
written (Step B1).**

**4. Part C: group error updates by `(status, message)`, not a single
`unnest`-based batch statement.** Expo's receipt errors come from a small,
fixed set of codes (`DeviceNotRegistered`, `MessageTooBig`,
`MessageRateExceeded`, `InvalidCredentials`); grouping by the exact
`(receiptStatus, errorMessage)` pair collapses a chunk's ≤300 rows into at
most a handful of `UPDATE ... WHERE id IN (...)` statements, using a
`inArray` pattern already established in this file
(`deactivateByTokens`) — no new SQL idiom. An `UPDATE ... FROM unnest(...)`
single-statement batch (each row could carry a distinct message) was
considered; it has no precedent anywhere in this repo and adds real
complexity for a LOW-severity cron. **Recommendation: group-by-message
(Step C1) — simpler, reuses an existing pattern.** If Expo's error messages
ever prove more varied than expected (e.g. include a per-token substring),
re-evaluate: the fallback is still correct, just with more groups (worst case
degrades gracefully back toward one group per row, no worse than today).

**5. Part E: which indexes actually still need adding — re-verify, don't
trust the frozen list.** Phase 2 plans (R-ARCH-04's Stripe reconciliation,
R-CONC-04's freeze-aware payouts/reversal) look up rows by
transfer/charge id and may have already added indexes on the same columns by
the time this plan executes. **Recommendation: Step E1 is a live inventory —
re-run every `grep`/`EXPLAIN` in "Current state" and skip any index that
already exists**, rather than generating a migration that duplicates one.

## Commands

| Purpose                   | Command                                                                   | Expected                              |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| Typecheck                 | `bun run type-check`                                                      | exit 0                                |
| Lint                      | `bun run lint`                                                            | exit 0                                |
| Generate migration        | `bun run db:generate`                                                     | new migration file(s), Parts B/E only |
| Targeted tests (per part) | `bun run test:run <paths>`                                                | all pass                              |
| Full tests                | `bun run test:run`                                                        | all pass                              |
| Real-DB tests             | `docker compose up -d && bun run db:push:e2e && bun run test:integration` | all pass                              |
| Mobile typecheck (Part A) | `npx tsc --noEmit` (from `hoador-mobile`)                                 | exit 0                                |
| Mobile tests (Part A)     | `npm test` (from `hoador-mobile`, filtered)                               | all pass                              |

## Scope

**In scope**:

- Part A: `src/dal/messages.dal.ts` (`getConversationDetails`, a new
  `newerThan` helper), `src/app/api/messages/conversations/[conversationId]/route.ts`,
  and (hoador-mobile) `src/features/messages/hooks/use-conversation.ts`,
  tests in both repos.
- Part B: `src/app/api/dashboard/badges/route.ts`,
  `src/features/dashboard/hooks/use-dashboard-badges.ts`,
  `src/dal/notifications.dal.ts` (`create`, `getUserNotifications`),
  `src/db/schemas/notifications.schema.ts` (+ generated migration), tests.
- Part C: `src/features/notifications/lib/expo-push-service.ts`,
  `src/dal/notifications.dal.ts` (new `resolveReceiptsBatch`), tests.
- Part D: `src/app/api/garage/pending-count/route.ts`,
  `src/app/api/garage/pending-review/route.ts`, `src/dal/listing.dal.ts`
  (`_enrichListingsWithRatingsAndImages`), `src/dal/rentals.dal.ts`
  (`countBorrowedListings` — delete; `countSharedListings`,
  `getScheduleRentals`, `getActionableRentals`, `getReviewableRentals`),
  `src/dal/service-booking.dal.ts` (`getScheduleBookings`,
  `getActionableBookings`, `getReviewableBookings`),
  `src/app/api/(payments)/get-payment-methods/route.ts`, tests.
- Part E: `src/db/schemas/user.schema.ts`,
  `src/db/schemas/rental-payment-lifecycle.schema.ts`,
  `src/db/schemas/service-payment-lifecycle.schema.ts`,
  `src/db/schemas/services.schema.ts`, `src/db/schemas/rentals.schema.ts` (+
  generated migration(s)), tests.
- Part F: `src/dal/dispute.dal.ts` (`getUserDisputes`), tests.

**Out of scope**: everything R-PERF-04 already claims (see Why this matters);
PERF-01/02/03/05/06 (DONE); the booking state-machine question any stale-data
policy might raise; rewriting `pulse-data.ts`'s own architecture (only its
call sites into the DAL methods this plan touches are affected, transparently
— same return shapes).

## Git workflow

hoador-web: work directly on `develop`. Do not commit — leave changes
uncommitted. hoador-mobile (Part A only): no `develop` branch in this repo —
work directly on the checked-out branch, do not commit unless the maintainer
says otherwise.

## Steps

### Part A — PERF-11: incremental thread polling

**A1. Add a `newerThan` helper and an `after` option.** In `messages.dal.ts`,
next to `olderThan` (~104-111):

```ts
/** Everything strictly newer than the cursor, in `(createdAt, id)` order —
 * the poll's incremental-catch-up counterpart to `olderThan` (PERF-11). */
function newerThan(cursor: ThreadCursor) {
  if (cursor.id === null) {
    return gt(messages.createdAt, cursor.createdAt);
  }

  return or(
    gt(messages.createdAt, cursor.createdAt),
    and(eq(messages.createdAt, cursor.createdAt), gt(messages.id, cursor.id)),
  );
}
```

(`gt` — confirm it's already imported from `drizzle-orm` in this file;
`resolveThreadCursor`'s validation logic is reusable as-is, since `after` is
the same "message id or ISO timestamp" shape as `before`.)

**A2. Wire `after` through `getConversationDetails`.** Change the options
type to `{ limit?: number; before?: string; after?: string }`. `after` only
applies when `before` is not given (backward pagination keeps its existing
semantics unconditionally):

```ts
async getConversationDetails(
  conversationId: string,
  userId: string,
  options: { limit?: number; before?: string; after?: string } = {},
): Promise<ConversationDetails> {
  // ...unchanged conversation lookup + membership check...

  const limit = normalizeThreadLimit(options.limit);
  const beforeCursor = await this.resolveThreadCursor(conversationId, options.before);
  const afterCursor =
    !options.before && options.after
      ? await this.resolveThreadCursor(conversationId, options.after)
      : null;

  const windowCondition = beforeCursor
    ? olderThan(beforeCursor)
    : afterCursor
      ? newerThan(afterCursor)
      : undefined;

  const window = await this.db.query.messages.findMany({
    where: and(eq(messages.conversationId, conversationId), windowCondition),
    orderBy: afterCursor
      ? [asc(messages.createdAt), asc(messages.id)]
      : [desc(messages.createdAt), desc(messages.id)],
    limit: limit + 1,
    with: { sender: ..., listing: ..., serviceListing: ... }, // unchanged
  });

  // afterCursor path: ascending already matches render order, no reverse.
  // beforeCursor / no-cursor path: unchanged existing hasMore + reverse logic.
  ...
}
```

`resolveThreadCursor` is `private` — reusing it for `after` needs no
signature change, it already just resolves a string to a `ThreadCursor`
regardless of direction. Keep every existing field
(`otherUser`, `unread`, `archived`, `hasMore`) computed exactly as today —
Decision 1 keeps them cheap and unconditional. When `afterCursor` was used,
`hasMore` should reflect whether _older_ messages exist beyond this response,
same meaning as always (compute it the existing way, independent of the
`after` path — it answers "can you page backward from here," which remains
true/false regardless of how this page was fetched).

**Verify**: `bun run type-check` → exit 0.

**A3. Route: accept `after`.** In
`conversations/[conversationId]/route.ts`, read a third optional param:

```ts
const after = searchParams.get("after") ?? undefined;
// ...
messagesDAL.getConversationDetails(conversationId, userId, {
  limit: limitParam ? Number(limitParam) : undefined,
  before,
  after,
}),
```

**Verify**: `bun run type-check` → exit 0.

**A4. Mobile: pass `after`, merge client-side (Decision 1).** In
`use-conversation.ts`, change `threadPath` to accept `after` too:

```ts
export function threadPath(
  conversationId: string,
  before?: string,
  after?: string,
): string {
  const params = new URLSearchParams({ limit: String(THREAD_PAGE_SIZE) });
  if (before !== undefined) params.set("before", before);
  if (after !== undefined) params.set("after", after);
  return `/api/messages/conversations/${encodeURIComponent(conversationId)}?${params.toString()}`;
}
```

In `useConversation`'s `queryFn`, read the previously-cached page (React
Query v5 passes the `client` in the function's context) to compute `after`
from the last message currently held, fetch, then merge by id:

```ts
export function useConversation(conversationId: string) {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.conversations.detail(conversationId);

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const cached = queryClient.getQueryData<ConversationDetails>(queryKey);
      const after = cached?.messages.at(-1)?.id;

      const page = await apiFetch<ConversationDetails>(
        threadPath(conversationId, undefined, after),
        { schema: conversationDetailsSchema, signal },
      );

      if (!cached || !after || page.messages.length === 0) {
        return page; // first load, or nothing new — no merge needed
      }

      const seen = new Set(cached.messages.map((m) => m.id));
      const appended = page.messages.filter((m) => !seen.has(m.id));
      return {
        ...page, // otherUser / unread / archived / hasMore always fresh
        messages: [...cached.messages, ...appended],
      };
    },
    // ...unchanged refetchInterval / staleTime / retry: false...
  });
}
```

This merge is safe under Decision 1 even if the server fell back to a full
window (the `seen` filter drops everything already cached, whatever the
server actually returned). **Does not change `use-older-messages.ts`** — its
own `before`-based backward pagination is untouched; it independently
prepends to `cached.messages`, and both hooks writing to the same query key
is already how that file works today (confirm by reading it before editing,
not assumed).

**Verify**: `npx tsc --noEmit` → exit 0 (mobile).

**A5. Tests.**

- `src/dal/__tests__/messages.dal.test.ts` (web): `getConversationDetails`
  with `after` set → the query's `where` uses `newerThan`'s shape and
  `orderBy` ascending (assert via the mocked query builder's call args, this
  file's existing style); `before` takes precedence when both are somehow
  present.
- `route.test.ts` (web, extend): `?after=<id>` is forwarded to the DAL call.
- New `hoador-mobile/src/features/messages/hooks/__tests__/use-conversation.test.ts`
  (or extend if one exists): first fetch with no cache → no `after` param,
  full response returned as-is; second fetch with a cached page → `after` is
  the cached last message's id, and a response containing 2 new + 1
  already-seen message merges to `cached.length + 2`, not `+3`.

**Verify**: `bun run test:run src/dal/__tests__/messages.dal.test.ts src/app/api/messages` (web);
`npm test -- src/features/messages/hooks/__tests__/use-conversation.test.ts` (mobile) → all pass.

### Part B — PERF-12: notification-query waste

**B1. `?include=recent` opt-in on the badges route.** In
`dashboard/badges/route.ts`:

```ts
async function getHandler(request: NextRequest) {
  // ... auth unchanged ...
  const includeRecent =
    request.nextUrl.searchParams.get("include") === "recent";

  const [unreadMessages, unreadNotifications, notifications] =
    await Promise.all([
      messagesDAL.getUnreadMessageCount(userId),
      notificationsDAL.getUnreadCount(userId),
      includeRecent
        ? notificationsDAL.getUserNotifications(userId, {
            page: 1,
            limit: BADGE_NOTIFICATION_LIMIT,
            unreadOnly: false,
          })
        : Promise.resolve(null),
    ]);

  return NextResponse.json({
    unreadMessages,
    unreadNotifications,
    notifications,
  });
}
```

(needs `NextRequest` as the handler's parameter — confirm the current
signature; `withRequestLogging` already passes it through for other routes in
this codebase.) In `use-dashboard-badges.ts`, change the fetch to
`fetch("/api/dashboard/badges?include=recent")` — the only web caller, and it
does need the recent list for the bell dropdown. Mobile's identical call
(`hoador-mobile/src/features/dashboard/hooks/use-badges.ts`, no param) now
gets `notifications: null` — already unread by mobile's `badgesSchema`
(confirmed: models only `{unreadMessages, unreadNotifications}`) — no mobile
change, no contract change.

**Verify**: `bun run type-check` → exit 0.

**B2. Drop the pre-insert existence check.** In `notifications.dal.ts`
`create()`, remove:

```ts
const existingUser = await this.db.query.user.findFirst({
  where: eq(user.id, data.userId),
});
if (!existingUser) {
  throw new ValidationError("User not found", "userId");
}
```

The `insert(notifications).values({...}).returning()` that follows already
FK-references `user.id`; a bad `userId` now surfaces via `base.ts`'s existing
`23503 → ValidationError("Referenced record does not exist")` mapping instead
— same error class and status code, a more generic message (no `"userId"`
field name). Update any test asserting the specific old message.

**Verify**: `bun run type-check` → exit 0.

**B3. Drop the `user` join in `getUserNotifications`.** Remove the
`.innerJoin(user, eq(notifications.userId, user.id))` and the `user: {...}`
columns from the `select({...})`; return the same row shape minus `user`.
Update `NotificationWithUser`'s type (or introduce a narrower type if it's
used elsewhere with the join expected — grep
`grep -rn "NotificationWithUser" src --include=*.ts` first and confirm every
other caller of `getUserNotifications` tolerates the dropped field; if one
reads `.user`, keep the join for that caller's code path and only drop it for
the badges route's specific call — report which if so).

**Verify**: `bun run type-check` → exit 0.

**B4. Composite index.** In `notifications.schema.ts`'s index array, add and
prune:

```ts
(table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_type_idx").on(table.type),
  // notifications_is_read_idx removed — dominated by the composite below;
  // no query filters on is_read alone without also scoping to a user.
  index("notifications_user_id_is_read_idx").on(table.userId, table.isRead),
],
```

Run `bun run db:generate` (a plain generated migration — take "the next free
number after DB-02's baseline," confirm via `ls src/db/migrations`).

**Verify**: `bun run type-check` → exit 0; generated SQL has one `DROP INDEX
"notifications_is_read_idx"` and one `CREATE INDEX "notifications_user_id_is_read_idx"`.

**B5. Tests.**

- `dashboard/badges/__tests__/route.test.ts` (extend/new): no `include` param
  → `getUserNotifications` not called, `notifications: null` in the body;
  `?include=recent` → it is called, response has the `notifications` object.
- `notifications.dal.test.ts` (extend): `create()` with a nonexistent
  `userId` → still throws (a mocked FK-violation error, not the old
  pre-check) → `ValidationError`; `getUserNotifications()`'s built select no
  longer joins `user` (assert on the mocked query builder, this file's
  existing style).

**Verify**: `bun run test:run src/app/api/dashboard/badges src/dal/__tests__/notifications.dal.test.ts` → all pass.

### Part C — PERF-13: batch push-receipt updates

**C1. `resolveReceiptsBatch` in `notifications.dal.ts`**, near
`resolveReceipt`:

```ts
/** Batched `resolveReceipt`, grouped by (status, message) — a chunk's ≤300
 * rows collapse to a handful of `IN (...)` updates instead of 300 single-row
 * ones (PERF-13, Decision 4). */
async resolveReceiptsBatch(
  okIds: string[],
  errorGroups: { message: string | null | undefined; ids: string[] }[],
): Promise<void> {
  try {
    if (okIds.length) {
      await this.db
        .update(pushNotificationAudit)
        .set({ receiptStatus: "ok", success: true })
        .where(inArray(pushNotificationAudit.id, okIds));
    }
    for (const group of errorGroups) {
      if (!group.ids.length) continue;
      await this.db
        .update(pushNotificationAudit)
        .set({
          receiptStatus: "error",
          success: false,
          ...(group.message !== undefined ? { errorMessage: group.message } : {}),
        })
        .where(inArray(pushNotificationAudit.id, group.ids));
    }
  } catch (error) {
    this.handleError(error, "resolveReceiptsBatch");
  }
}
```

**C2. Rewrite the per-chunk loop in `checkExpoPushReceipts`.** Replace the
inner `for (const [ticketId, receipt] of Object.entries(receipts))` body's
per-row `resolveReceipt`/`deactivateByToken` calls with accumulation, then
one batched call per chunk:

```ts
const okIds: string[] = [];
const errorGroupsByMessage = new Map<
  string,
  { message: string | null | undefined; ids: string[] }
>();
const tokensToDeactivate: string[] = [];

for (const [ticketId, receipt] of Object.entries(receipts)) {
  const audit = auditByTicketId.get(ticketId);
  if (!audit) continue;
  result.checked += 1;

  if (receipt.status === "ok") {
    okIds.push(audit.id);
    result.ok += 1;
    continue;
  }

  const key = receipt.message ?? "";
  const group = errorGroupsByMessage.get(key) ?? {
    message: receipt.message,
    ids: [],
  };
  group.ids.push(audit.id);
  errorGroupsByMessage.set(key, group);
  result.errored += 1;

  if (
    receipt.details?.error === "DeviceNotRegistered" &&
    receipt.details?.expoPushToken
  ) {
    tokensToDeactivate.push(receipt.details.expoPushToken);
  }
}

await pushSubscriptionDAL.resolveReceiptsBatch(okIds, [
  ...errorGroupsByMessage.values(),
]);
if (tokensToDeactivate.length) {
  await pushSubscriptionDAL.deactivateByTokens(tokensToDeactivate);
  result.deactivated += tokensToDeactivate.length;
  getLogger().info(
    {
      event: "expo_push_device_not_registered",
      count: tokensToDeactivate.length,
      source: "receipt",
    },
    "[expo-push] deactivated subscriptions: DeviceNotRegistered",
  );
}
```

Keep the outer `try/catch` around `getPushNotificationReceiptsAsync(chunk)`
unchanged (a chunk lookup failure still leaves those rows `pending` for the
next run). `deactivateByTokens` already de-dupes-safely on a repeated token
(plain `inArray` `UPDATE`) — no need to `Set`-dedupe `tokensToDeactivate`
first, though doing so is harmless if preferred.

**Verify**: `bun run type-check` → exit 0.

**C3. Tests.** Extend `expo-push-service.test.ts`: a chunk with 250 `ok`
receipts and 50 errors split across 3 distinct messages → `resolveReceiptsBatch`
called once with `okIds.length === 250` and 3 groups; a `DeviceNotRegistered`
receipt → its token collected and `deactivateByTokens` called once with all
such tokens from the chunk, not once per token. Extend
`notifications.dal.test.ts`: `resolveReceiptsBatch` issues one `inArray`
update for `okIds` (when non-empty) and one per error group (assert call
count equals `1 + errorGroups.length` when `okIds` is non-empty).

**Verify**: `bun run test:run src/features/notifications/lib/__tests__/expo-push-service.test.ts src/dal/__tests__/notifications.dal.test.ts` → all pass.

### Part D — PERF-14: mobile list/count endpoints

**D1. `pending-count`: `COUNT` instead of full rows.** Add a count-shaped DAL
method (mirroring `getTotalUserCount`'s style) —
`listingDAL.countUserListingsByApprovalStatus("rejected", userId)` — and use
it in the route instead of `.length` on the full-row fetch. Confirm no other
caller of `getUserListingsByApprovalStatus` also wants a count-only variant
before adding a new method name (if one does, generalize rather than adding a
near-duplicate).

**D2. `pending-review`: drop the redundant third query.** Remove the
unfiltered `db.select({id, rejectionReason}).from(listings).where(eq(ownerId, userId))`
query and its `rejectionReasonsMap` entirely. `rejectedListings` (from the
second, already-`rejected`-filtered query) already carries `rejectionReason`
as a column — read it directly:
`rejectedListings.map((listing) => ({ ...listing, approvalStatus: "rejected" as const, rejectionReason: listing.rejectionReason ?? undefined }))`.

**Verify (D1+D2)**: `bun run type-check` → exit 0.

**D3. `_enrichListingsWithRatingsAndImages`: `DISTINCT ON` instead of
select-all-then-JS-loop.** Replace the `allFirstImages` select with:

```ts
const firstImages = await this.db
  .selectDistinctOn([listingImages.listingId], {
    listingId: listingImages.listingId,
    imageUrl: listingImages.imageUrl,
  })
  .from(listingImages)
  .where(inArray(listingImages.listingId, listingIds))
  .orderBy(listingImages.listingId, asc(listingImages.orderIndex));

const firstImageByListing = new Map(
  firstImages.map((r) => [r.listingId, r.imageUrl]),
);
```

(Drizzle's `selectDistinctOn` requires the `orderBy`'s leading column(s) to
match the `DISTINCT ON` list — `listingId` first, then `orderIndex` — confirm
this compiles against the installed drizzle-orm version; if `selectDistinctOn`
isn't available, fall back to a raw `sql` `DISTINCT ON (listing_id) ... ORDER
BY listing_id, order_index` and select into the same shape.) This changes
only the SQL shape, not the returned `Map`, so `pulse-data.ts`'s call site
(~107, into the same private method) needs no change.

**Verify**: `bun run type-check` → exit 0.

**D4. `rentals.dal.ts`: delete dead code, `count()` the rest.** Delete
`countBorrowedListings` entirely (zero callers, confirmed). Change
`countSharedListings` to:

```ts
async countSharedListings(userId: string): Promise<number> {
  try {
    const [row] = await this.db
      .select({ n: count() })
      .from(rentalRequests)
      .where(and(eq(rentalRequests.ownerId, userId), inArray(rentalRequests.status, ["active"])));
    return row?.n ?? 0;
  } catch (error) {
    this.handleError(error, "countSharedListings");
  }
}
```

**Verify**: `grep -n "countBorrowedListings" src/dal/rentals.dal.ts src/features/dashboard/**/*.ts` →
no remaining reference outside this plan's own test-file cleanup;
`bun run type-check` → exit 0.

**D5. Parallelize each Schedule DAL method's two role queries.** In
`getScheduleRentals`, `getActionableRentals`, `getReviewableRentals`
(`rentals.dal.ts`) and `getScheduleBookings`, `getActionableBookings`,
`getReviewableBookings` (`service-booking.dal.ts`), change each method's
`const asRenter = await ...; const asOwner = await ...;` (or requester/provider
equivalent) to:

```ts
const [asRenter, asOwner] = await Promise.all([
  this.db.select(...).from(...)... /* asRenter query unchanged */,
  this.db.select(...).from(...)... /* asOwner query unchanged */,
]);
```

Do **not** merge the two queries into one OR'd query — the result mapping
differs by role (`role: "renter"` vs `"owner"` tagging happens per-array
below the parallelized pair), confirmed by reading each method's return
statement first.

**Verify**: `bun run type-check` → exit 0.

**D6. Parallelize `get-payment-methods`.** Change:

```ts
const allPaymentMethods = await PAYMENT_SERVER_INSTANCE.paymentMethods.list({
  customer: user.stripeCustomerId,
});
// ...
const customer = await PAYMENT_SERVER_INSTANCE.customers.retrieve(
  user.stripeCustomerId,
);
```

to:

```ts
const [allPaymentMethods, customer] = await Promise.all([
  PAYMENT_SERVER_INSTANCE.paymentMethods.list({
    customer: user.stripeCustomerId,
  }),
  PAYMENT_SERVER_INSTANCE.customers.retrieve(user.stripeCustomerId),
]);
```

**Verify**: `bun run type-check` → exit 0.

**D7. Tests.**

- `garage/pending-count/__tests__/route.test.ts` (new/extend): asserts a
  `COUNT`-shaped DAL call, not a full-row fetch (mock the new DAL method).
- `garage/pending-review/__tests__/route.test.ts`: asserts only 2 DAL calls
  (`pending_review` + `rejected`), not 3; `rejectionReason` still appears
  correctly on rejected items.
- `listing.dal.test.ts`: `_enrichListingsWithRatingsAndImages` still returns
  the lowest-`orderIndex` image per listing when a listing has gaps in its
  order indexes (regression case for the fix).
- `rentals.dal.test.ts`: `countBorrowedListings` no longer exported/callable
  (a type-level check, or just its removal); `countSharedListings` uses a
  `count()`-shaped mock, not a full-row one; each Schedule method's two role
  queries are issued via `Promise.all` (call-order assertion, this file's
  existing style for R-PERF-04 Part D's similar cases).
- `get-payment-methods/__tests__/route.test.ts`: both Stripe calls issued
  before either resolves (delayed-mock timing assertion, or call-order).

**Verify**: `bun run test:run src/app/api/garage src/dal/__tests__/listing.dal.test.ts src/dal/__tests__/rentals.dal.test.ts src/dal/__tests__/service-booking.dal.test.ts "src/app/api/(payments)/get-payment-methods"` → all pass.

### Part E — PERF-15: missing indexes

**E1. Live inventory (Cross-plan decision 4) — re-verify before generating
anything.** Re-run, against current `develop`:

```
grep -n "stripeTransferId\|rentalChargeId" src/dal/payment-lifecycle.dal.ts
grep -n "stripeTransferId\|chargeId" src/dal/service-payment-lifecycle.dal.ts
grep -n "listingId" src/dal/service-booking.dal.ts | grep -i where
grep -n "session\|account\|verification" src/db/schemas/user.schema.ts | grep -i idx
```

and confirm each column in "Current state" is still unindexed (a Phase 2
plan — R-ARCH-04, R-CONC-04 — may have already added one). Drop any bullet
below whose index already exists; do not generate a duplicate.

**E2. Add the confirmed-missing indexes.** In each schema file's index
array (object or array form, matching that file's existing style):

```ts
// user.schema.ts — session table
index("session_user_id_idx").on(table.userId),
// user.schema.ts — account table
index("account_user_id_idx").on(table.userId),
// user.schema.ts — verification table
index("verification_identifier_idx").on(table.identifier),
// user.schema.ts — user table, alongside lastActiveAtIdx
stripeConnectedAccountIdIdx: index("user_stripe_connected_account_id_idx").on(table.stripeConnectedAccountId),
```

```ts
// rental-payment-lifecycle.schema.ts
index("rental_payment_lifecycle_stripe_transfer_id_idx").on(table.stripeTransferId),
index("rental_payment_lifecycle_rental_charge_id_idx").on(table.rentalChargeId),
```

```ts
// service-payment-lifecycle.schema.ts
index("service_payment_lifecycle_stripe_transfer_id_idx").on(table.stripeTransferId),
index("service_payment_lifecycle_charge_id_idx").on(table.chargeId),
```

```ts
// services.schema.ts — service_bookings table
index("service_bookings_listing_id_idx").on(table.listingId),
```

```ts
// rentals.schema.ts — rental_requests table, mirroring pendingExpiresAtIdx's
// partial-index style
processingPaymentStatusIdx: index("rental_requests_processing_payment_status_idx")
  .on(table.updatedAt)
  .where(sql`${table.paymentStatus} = 'processing'`),
```

Run `bun run db:generate` once after all schema edits (one migration file for
this Part, or split per file if `drizzle-kit` naturally does so — either is
fine, note which in the PR). Confirm every table name/column name against the
live schema file before typing these (`better-auth`'s `session`/`account`/
`verification` tables use `text` FKs, not `uuid` — the index type is
unaffected either way, just noting it's a plain btree on a text column, no
special handling needed).

**Verify**: `bun run type-check` → exit 0; read the generated SQL once,
confirm it's only `CREATE INDEX` statements (no unrelated drift — re-run
`bunx drizzle-kit check` first if the diff looks larger than expected).

**E3. Tests.** A real-DB test isn't necessary for a plain single-column
index (unlike PERF-04's trigram case, there's no extension/availability
question) — the generated migration's `CREATE INDEX` statement is the
verification. If any DAL method above lacked a unit test asserting its WHERE
clause shape, this is a good time to add one (e.g.
`findStaleProcessingRequests`'s existing test, if any, should still pass
unchanged — the index doesn't change query semantics, only its cost).

**Verify**: `bun run test:run` (full suite — index additions shouldn't break
anything, this is a regression check) → all pass.

### Part F — PERF-16: rewrite `getUserDisputes`'s default branch

**F1.** In `dispute.dal.ts` `getUserDisputes`, replace the default (no-role)
branch's four correlated `EXISTS` subqueries with two `IN` subqueries against
each side's indexed FK columns:

```ts
} else {
  conditions.push(
    or(
      inArray(
        disputes.rentalId,
        this.db.select({ id: rentals.id }).from(rentals)
          .where(or(eq(rentals.renterId, userId), eq(rentals.ownerId, userId))),
      ),
      inArray(
        disputes.serviceBookingId,
        this.db.select({ id: serviceBookings.id }).from(serviceBookings)
          .where(or(eq(serviceBookings.requesterId, userId), eq(serviceBookings.providerId, userId))),
      ),
    ),
  );
}
```

Leave the `role === "renter"` and `role === "provider"` branches as-is for
now unless the same rewrite shape trivially applies (it does — same pattern,
one `inArray` per side instead of the `EXISTS`; apply it there too for
consistency, since the indexes are identical):

```ts
} else if (options.role === "renter") {
  conditions.push(
    or(
      inArray(disputes.rentalId, this.db.select({ id: rentals.id }).from(rentals).where(eq(rentals.renterId, userId))),
      inArray(disputes.serviceBookingId, this.db.select({ id: serviceBookings.id }).from(serviceBookings).where(eq(serviceBookings.requesterId, userId))),
    ),
  );
} else if (options.role === "provider") {
  conditions.push(
    or(
      inArray(disputes.rentalId, this.db.select({ id: rentals.id }).from(rentals).where(eq(rentals.ownerId, userId))),
      inArray(disputes.serviceBookingId, this.db.select({ id: serviceBookings.id }).from(serviceBookings).where(eq(serviceBookings.providerId, userId))),
    ),
  );
}
```

Both `rentals` and `serviceBookings` must already be imported into
`dispute.dal.ts` (they're referenced inside the `sql\`EXISTS (...)\``template
strings today, so the tables themselves are already in scope — confirm the
Drizzle table objects, not just their names inside a raw`sql` tag, are
importable; if only referenced via raw SQL today, add the imports).

**Verify**: `bun run type-check` → exit 0.

**F2. Tests.** Extend `dispute.dal.test.ts`'s `getUserDisputes` cases (or add
if none target this method specifically): same result set for each of
"no role," `"renter"`, `"provider"` as a fixture with a user on all 4 sides
plus a non-party dispute would have produced under the old `EXISTS` version
(a real-DB test, R-TEST-HARNESS conventions, since this is exactly the kind
of "prove the rewrite is equivalent" case a mocked DAL test can't cover) —
new `src/dal/__tests__/dispute-user-disputes.integration.test.ts`. A second,
rendered-SQL unit test asserting the built query contains no `EXISTS` (the
mocked-query-builder style already used elsewhere in this file).

**Verify**: `bun run test:run src/dal/__tests__/dispute.dal.test.ts` → pass;
`docker compose up -d && bun run db:push:e2e && bun run test:integration` →
includes the new integration test, passes.

## Test plan

Each part's own Steps end in a **Verify** line. Part A adds a mobile unit
test (merge logic) alongside its web DAL/route tests; Part F adds a real-DB
integration test (equivalence proof for the rewritten query, the one case in
this plan where a mocked-DAL test can't prove correctness). Full regression:
`bun run type-check && bun run lint && bun run test:run` (web); `npx tsc
--noEmit && npm run lint && npm test` (mobile, Part A only).

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0; `bun run test:run` → exit 0
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0 (includes Part F's new test)
- [ ] Part A: the poll sends `after` on every tick after the first; a merged
      response never duplicates a message id (mobile test); web
      `getConversationDetails` honors `after` when `before` is absent (test)
- [ ] Part B: `?include=recent` gates the third badges query (test);
      `create()`'s pre-check is gone (`grep -n "existingUser" src/dal/notifications.dal.ts` → no match in `create`); `getUserNotifications` no longer joins `user` (test); the composite index migration is generated
- [ ] Part C: `resolveReceiptsBatch` exists and is called at most
      `1 + <distinct error messages>` times per chunk, not once per row (test)
- [ ] Part D: `pending-count` uses a `COUNT` query (test); `pending-review`
      makes exactly 2 DAL calls (test); `countBorrowedListings` is deleted;
      each Schedule DAL method's two role queries run via `Promise.all` (test);
      `get-payment-methods`'s two Stripe calls run via `Promise.all` (test)
- [ ] Part E: every index in Step E2 that Step E1's inventory confirmed
      missing now exists in a generated migration; no duplicate index created
- [ ] Part F: `getUserDisputes` builds no `EXISTS` clause (test); the
      integration test proves identical result sets pre/post rewrite for all
      three role modes
- [ ] No files outside Scope modified (`git status`, both repos)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (note which parts landed if not all land together)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`)
  — re-read before editing that part.
- Part A: `use-older-messages.ts`'s own cache-writing behavior turns out to
  conflict with the new `queryFn`'s merge logic (e.g. both racing to write
  the same query key mid-scroll) — re-read it fully before assuming they
  compose safely, and report the exact interaction if not.
- Part E1: an index in "Current state" already exists (added by a Phase 2
  plan since this was written) — skip it, don't duplicate; if _every_ index
  already exists, Part E is a no-op, report and skip Step E2.
- Part F: the integration test finds a result-set mismatch between the old
  `EXISTS` version and the rewritten `IN` version for any role — this means
  the rewrite has a correctness gap (e.g. a dispute whose `rentalId` is null
  behaving differently under `IN` vs `EXISTS` with a NULL on one side) — stop
  and report the exact mismatching case rather than adjusting the test to
  match.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- **Part A**: additive `after` query param on
  `GET /api/messages/conversations/[conversationId]` — old app binaries that
  never send it get the unchanged full-window response; this plan's own
  mobile change (Step A4) is optional/same-release, not a hard requirement
  for the server-side fix to be safe. No new contract field, no roadmap
  Mobile-follow-ups row (the response shape is unchanged either way).
- **Part B**: `notifications` becomes `null` instead of the recent-list object
  when `?include=recent` is absent — mobile's `badgesSchema` doesn't model
  that field today (confirmed), so this is invisible to it. No Mobile
  follow-ups row.
- **Part C, E, F**: fully internal (cron batching, indexes, a query rewrite
  with an identical result set) — no response shape change anywhere. No
  Mobile follow-ups rows.
- **Part D**: `pending-count`/`pending-review` are mobile-only endpoints
  (garage screens); their response shapes are unchanged by this plan (same
  fields, computed more cheaply) — confirm via each route's existing test
  fixtures before/after. `get-payment-methods` and the Schedule routes are
  shared with web but also return unchanged shapes. No Mobile follow-ups
  rows for any Part D change.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-LOW-PERF (Part B) — apply the notifications composite-index
migration` | From: R-LOW-PERF Part B | dev: TODO | staging: TODO | prod:
  TODO (n/a until prod exists) — standard `bun run db:migrate`; if this ever
  runs against an already-populated `notifications` table (a future prod with
  real traffic), re-cut as `CREATE INDEX CONCURRENTLY` + manual apply per
  R-DB-02's Step 5 pattern instead.
- **New row**: `R-LOW-PERF (Part E) — apply the missing-index migration(s)
(session/account/verification/user/payment-lifecycle/service_bookings/
rental_requests)` | From: R-LOW-PERF Part E | dev: TODO | staging: TODO |
  prod: TODO (n/a until prod exists) — same `CONCURRENTLY`-if-populated
  caveat, especially for `session`/`account` if either table has grown by
  the time this lands.
- No data backfill needed for either — both are additive index-only
  migrations.

## Maintenance notes

- Part A's client-side merge (concatenate + de-dupe by id) is intentionally
  tolerant of the server falling back to a full window — if a future change
  makes the server's fallback behavior stricter (e.g. it starts rejecting an
  `after` cursor outside some window instead of silently ignoring it), the
  mobile merge logic doesn't need to change; it already handles "the server
  gave me everything again" correctly.
- Part B's dropped `user` join in `getUserNotifications` — if a future
  feature needs the notification's own recipient's name/avatar in the
  response (unlikely; a notification is already scoped to `req.userId`), add
  it back deliberately at that call site rather than reintroducing an
  unconditional join every caller pays for.
- Part C's grouping-by-message batching (Decision 4) degrades gracefully if
  Expo's error messages become more varied per-row — worst case is one group
  per row, same as today, never worse.
- Part E's index list came from a point-in-time inventory (Step E1) —
  re-verify against `10-remediation-roadmap.md`'s Phase 2 status before
  assuming this plan's list is still accurate if executed long after Phase 2
  work lands.
