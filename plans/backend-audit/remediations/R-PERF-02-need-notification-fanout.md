# R-PERF-02: Bulk-insert need notifications and batch the push fan-out

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/neighborhood-needs/services/neighborhood-needs-service.ts src/dal/community.dal.ts src/dal/notifications.dal.ts src/features/notifications/utils/send-notification.ts src/features/notifications/lib/expo-push-service.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED
- **Depends on**: none · **Category**: perf (+ optional SEC-15 throttle)
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

Posting a Neighborhood Need loads every user visible in the community — at
join time `initializeUserVisibility` makes a user visible in every community
of their whole network, so this is effectively the network's full membership
— then calls `sendNotification` once per recipient inside `after()`. Each
call costs an existence-check + insert for the in-app row, two preference
reads, and (for push-opted-in users) a subscription lookup and an audit-log
write: roughly 4 queries per recipient, released into a 10-connection pool
all at once. A 3,000-member network means ~12k queued queries and measured
4-6s of pool saturation that blocks **every request on that instance**, not
just the poster's. Audit finding PERF-02 (HIGH); SEC-15 (posting is
unthrottled) is the same code path and is fixed as an optional extra step.

## Current state

- `neighborhood-needs-service.ts:301-345` `fanOutNewNeed` (full, read
  directly):

```ts
const recipientIds = await communityDAL.getUserIdsVisibleInCommunity(need.communityId);
await Promise.all(
  recipientIds.filter((uid) => uid !== creatorUserId).map((uid) =>
    sendNotification({ userId: uid, type: "neighborhood_need_created", ...,
      sendEmail: false }).catch((err) => captureNonCriticalError(err, {...})),
  ),
);
```

Called from `createNeed` inside `after()` (line 65-72), so it runs after
the response is sent but still shares the request's time budget and this
instance's connection pool.

- `community.dal.ts:965-980` `getUserIdsVisibleInCommunity(communityId)` —
  one simple `SELECT user_id FROM community_visibility WHERE community_id=$1 AND is_visible=true`.
  This part is already cheap; the fan-out afterward is the problem.
- `send-notification.ts` (full file, 177 lines) — per recipient: (1)
  `notificationsDAL.create(...)` **always** runs (in-app row is
  unconditional by design — preferences never gate it); (2) `email` is never
  passed here (`fanOutNewNeed` sets `sendEmail:false` and no `email` payload),
  so `shouldSendEmail` is **never called** — email truly costs nothing today,
  confirmed; (3) `shouldSendPush(userId, category)` always runs (line
  110-111), which is 2 more reads.
- `notifications.dal.ts:63-88` `NotificationDAL.create` — does
  `this.db.query.user.findFirst(...)` (an existence check) **before** the
  `INSERT`, i.e. 2 queries per recipient just for the in-app row. This check
  is redundant for a fan-out sourced from `community_visibility.user_id`,
  which already has a `user.id` FK — bulk-inserting from that table makes
  existence guaranteed by construction.
- `preference-service.ts:12-22` `CATEGORY_DEFAULTS.neighborhood_needs` =
  `{email: false, push: false}` — **opt-in only**. A user with no
  `notification_category_preferences` row for `neighborhood_needs` gets no
  push by default; only a row with `push: true` opts them in. Master gate:
  `user.dal.ts:564-580` `getUserPreferences` returns
  `pushNotifications: true` when no `user_preferences` row exists (that
  default is opt-out-only, unlike the category one).
- `expo-push-service.ts:83-183` `sendExpoPush(userId, rows, payload)` — scoped
  to **one user's** devices; internally chunks at 100
  (`expo.chunkPushNotifications`, line 132) and writes an audit row **per
  ticket** via `pushSubscriptionDAL.createAuditLog` inside per-chunk handling
  (confirmed at the error path, lines 158-168; the success path calls
  `handleTicket`, not fully read here — read it before Step 3). Calling this
  once per push-eligible user still costs at least one DB write per
  recipient, which is fine at small push-opt-in scale but not what "chunks
  of 100" in the recommended fix implies — the intent is a genuinely
  multi-user batched send, not N single-user calls.

## Commands

| Purpose        | Command                                                                                                                   | Expected |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                      | exit 0   |
| Lint           | `bun run lint`                                                                                                            | exit 0   |
| Targeted tests | `bun run test:run src/features/neighborhood-needs src/dal/__tests__/notifications.dal.test.ts src/features/notifications` | all pass |
| Full tests     | `bun run test:run`                                                                                                        | all pass |

## Scope

**In scope**: `src/features/neighborhood-needs/services/neighborhood-needs-service.ts`
(`fanOutNewNeed`, and optionally `createNeed` for the SEC-15 throttle),
`src/dal/notifications.dal.ts` (new bulk-insert method),
`src/dal/community.dal.ts` or a new query in `notifications.dal.ts` (new
push-targets join), `src/features/notifications/lib/expo-push-service.ts`
(new multi-user broadcast function), `src/features/neighborhood-needs/*`
(SEC-15 count query, if you do the optional step), tests for all of the
above.

**Out of scope**: `sendNotification`/`sendExpoPush`'s single-recipient path
(still used everywhere else — do not change its behavior or signature);
email for this notification type (already off, stays off); other
notification types' fan-out (none currently reach community-wide scale).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Bulk-insert the in-app notification rows

Add to `notifications.dal.ts`, near `create`:

```ts
async bulkCreateForVisibleCommunity(params: {
  communityId: string; excludeUserId: string;
  type: NotificationType; title: string; message: string;
  data: Record<string, string | number | boolean | string[] | null>;
}): Promise<number> {
  try {
    const result = await this.db.execute(sql`
      INSERT INTO notifications (user_id, type, title, message, data, is_read)
      SELECT cv.user_id, ${params.type}, ${params.title}, ${params.message}, ${JSON.stringify(params.data)}::jsonb, false
      FROM community_visibility cv
      WHERE cv.community_id = ${params.communityId} AND cv.is_visible = true AND cv.user_id != ${params.excludeUserId}
    `);
    return result.rowCount ?? 0;
  } catch (error) { this.handleError(error, "bulkCreateForVisibleCommunity"); }
}
```

Use drizzle's `sql` tag (already imported this way elsewhere in the DAL
layer, e.g. the `COUNT(*) FILTER` queries in
`service-payment-lifecycle.dal.ts`) — this bypasses the per-row existence
check by construction (`community_visibility.user_id` already has a FK to
`user.id`). In `fanOutNewNeed`, replace the `Promise.all` notification-row
half of the loop with one call to this method. Keep every recipient still
getting their in-app row unconditionally — matches today's behavior.
**Verify**: `bun run type-check` → exit 0.

### Step 2: One join for push targets

Add a method (same file or `community.dal.ts`, your choice — keep it near
its closest sibling) that returns `{userId, token}` pairs for recipients who
are: visible in the community, not the creator, have an active native
(`platform != 'web'`) push subscription, have `pushNotifications` true (or no
row) in `user_preferences`, **and** have an explicit
`notification_category_preferences` row with `category='neighborhood_needs' AND push=true`
(the opt-in default means no row = excluded, unlike the master toggle). One
query: `community_visibility` INNER JOIN `push_subscriptions` (active,
native) INNER JOIN `notification_category_preferences` (category + push=true)
LEFT JOIN `user_preferences` (COALESCE master push to `true` when absent).
Web-push subscribers are out of scope for this plan (their fan-out was never
the bottleneck — `web-push` has no batch API and this population is small
per the audit's "email off, push opt-in" mitigating-layers note); leave the
existing per-user `sendPush`/web path untouched for any future work.
**Verify**: `bun run type-check` → exit 0.

### Step 3: Batch the Expo send

Read `handleTicket` in `expo-push-service.ts` (below line 183, not excerpted
here) before writing this — preserve its success/failure/deactivation
semantics. Add `sendExpoPushBroadcast(rows: {userId: string; token: string}[], payload: PushPayload): Promise<void>` that: builds one `ExpoPushMessage` per row (reuse `toExpoMessage`'s shape), chunks via `expo.chunkPushNotifications` exactly like `sendExpoPush` does, and for each chunk collects every ticket's audit outcome **in memory**, writing **one bulk insert** into `push_notification_audit` after all chunks finish (not one `createAuditLog` call per ticket) — the query-count win this step exists for. Preserve per-token deactivation on a `DeviceNotRegistered`-type ticket error, same as `handleTicket` does. In `fanOutNewNeed`, replace the push half of the loop with: query Step 2's targets, call `sendExpoPushBroadcast` once, still inside `.catch(err => captureNonCriticalError(...))`.
**Verify**: `bun run type-check` → exit 0.

### Step 4 (optional, SEC-15): Per-user posting limits

In `createNeed` (`neighborhood-needs-service.ts:38-75`), before the insert,
add a DB count check: reject with `ValidationError` if the user already has
≥5 open needs (`neighborhoodNeedsDAL` — add a
`countOpenNeedsByUser(userId)` method) or has posted ≥10 needs (open or
closed) in the last 24h (`countNeedsByUserSince(userId, since)`). This is a
plain count query, no new rate-limit infrastructure, per the audit's own
recommendation (no durable rate-limit store exists in this repo). Return a
machine-readable code (`NEED_LIMIT_REACHED`) following the
`ConversationArchivedError` pattern in `src/dal/errors.ts` if you add this —
same handleApiError-branch-before-generic-ConflictError rule applies.
**Verify**: `bun run type-check` → exit 0.

## Test plan

- **Query-count** (new test in `neighborhood-needs-service.test.ts` or a DAL
  test): seed/mock 500 visible community members (a handful push-opted-in),
  call `fanOutNewNeed`, and assert the total query count is ≤ 5 — use
  `runWithQueryCounter` if a harness exists in this suite already, else
  assert directly on mock call counts (`db.execute`/`db.insert`/`db.select`
  invoked a small, fixed number of times regardless of recipient count).
- **Correctness**: a user with no `neighborhood_needs` category preference
  row still gets an in-app notification row but **no** push (opt-in default
  respected). A user with an explicit `push: true` row for that category
  **does** get a push message built for them.
- **DAL**: `bulkCreateForVisibleCommunity` excludes the creator (assert via
  the rendered SQL's `!=` bind, or via a mocked `db.execute` call
  inspection) and excludes `is_visible = false` rows.
- **Expo broadcast**: `sendExpoPushBroadcast` with 250 rows (mock
  `expo.chunkPushNotifications` to return 3 chunks) results in exactly 3
  `sendPushNotificationsAsync` calls and exactly 1 audit-log bulk insert
  call, not 250.

**Verify**: `bun run test:run src/features/neighborhood-needs src/dal/__tests__/notifications.dal.test.ts src/features/notifications` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] A test proves ≤5 total queries for a 500-recipient fan-out
- [ ] A test proves opted-out users receive an in-app row but no push
- [ ] `grep -n "Promise.all" src/features/neighborhood-needs/services/neighborhood-needs-service.ts` no longer shows a per-recipient `sendNotification` loop in `fanOutNewNeed`
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `handleTicket`'s actual logic (unread in this plan) can't be cleanly split
  into "per-ticket outcome" + "one deferred bulk audit insert" — e.g. it does
  something per-ticket that has an ordering dependency on the DB write
  landing immediately. Report the exact obstruction rather than skipping the
  audit trail silently.
- `db.execute(sql\`...\`)`isn't available on this drizzle client version, or
behaves differently than a plain`INSERT ... SELECT` (verify against one
existing raw-`sql` usage in the codebase before assuming).
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- No API response shape change — `POST /api/needs`'s response is unaffected;
  this plan only changes what happens inside `after()`.
- If Step 4 ships, `POST /api/needs` gains a new possible 429/409
  `{"error": "...", "code": "NEED_LIMIT_REACHED"}`. Per the same
  `hoador-mobile/src/api/errors.ts` generic-code-parsing behavior verified in
  R-BIZ-02's plan, the current app handles this via generic
  conflict/rate-limit classification with no release required; a future
  release can add a specific message.
- Recipients' in-app notification rows and push payloads are byte-for-byte
  identical to today's per-recipient `sendNotification` output — the mobile
  notifications list and push payload shape are unaffected.

## Maintenance notes

- If web-push fan-out ever needs the same treatment (currently out of scope,
  Step 2), the join in Step 2 already isolates "native, opted-in" — add a
  parallel "web, opted-in" query rather than modifying it in place.
- The 5-open/10-per-day limits in Step 4 are a starting point, not a
  product decision — flag them as adjustable in the PR description.
- `initializeUserVisibility`'s "visible in every community of the network"
  semantics (referenced in Why this matters) is a separate, pre-existing
  design choice this plan does not revisit.
