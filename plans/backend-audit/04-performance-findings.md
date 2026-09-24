# API and database performance findings

Graded against realistic neighborhood-marketplace scale (thousands to tens of thousands of users). Prioritizes the API routes the mobile app polls or loads on every focus; web-UI-only performance is out of scope because the web front end is being retired.

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 0 · HIGH 2 · MEDIUM 8 · LOW 6.

| ID      | Severity | Confidence | Finding                                                                                                                             | Plan                                                             |
| ------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| PERF-01 | HIGH     | High       | /api/dashboard/summary runs 33–46 queries and repeats unbounded history reads up to 5× (React cache() is a no-op in route handlers) | [R-PERF-01](remediations/R-PERF-01-dashboard-summary-queries.md) |
| PERF-02 | HIGH     | High       | Posting a need fans out ~4 queries per recipient across the whole network inside after(), saturating the 10-connection pool         | [R-PERF-02](remediations/R-PERF-02-need-notification-fanout.md)  |
| PERF-03 | MEDIUM   | High       | Every authenticated API request resolves the session three times (≈9 auth queries): wrapper before ALS, handler, and proxy          | —                                                                |
| PERF-04 | MEDIUM   | Medium     | Listing search sorts every visible listing on each page; text search has no trigram index                                           | —                                                                |
| PERF-05 | MEDIUM   | High       | Payout crons pay at most 20 rentals and 20 service bookings per day                                                                 | —                                                                |
| PERF-06 | MEDIUM   | Medium     | No cron sets maxDuration, and one failed step skips every later step of the daily job                                               | —                                                                |
| PERF-07 | MEDIUM   | High       | Chat sends and other mutations block on the Resend email call                                                                       | —                                                                |
| PERF-08 | MEDIUM   | High       | messages lacks a (conversation_id, created_at) index; the unread badge scans the user's whole message history                       | —                                                                |
| PERF-09 | MEDIUM   | Medium     | Detail endpoints run long sequential query chains                                                                                   | —                                                                |
| PERF-10 | MEDIUM   | Medium     | The rental-reminders cron loops over an ever-growing set with no cap                                                                | —                                                                |
| PERF-11 | LOW      | High       | The thread poll re-downloads the whole 50-message window every 20 s                                                                 | —                                                                |
| PERF-12 | LOW      | High       | Notification queries do avoidable work                                                                                              | —                                                                |
| PERF-13 | LOW      | High       | The push-receipt cron updates up to 3,000 rows one at a time                                                                        | —                                                                |
| PERF-14 | LOW      | High       | Mobile list endpoints over-fetch and run avoidable sequential awaits                                                                | —                                                                |
| PERF-15 | LOW      | High       | Lookups on rarely used paths have no index                                                                                          | —                                                                |
| PERF-16 | LOW      | Medium     | getUserDisputes can't use any dispute index                                                                                         | —                                                                |

## Findings

### PERF-01: /api/dashboard/summary runs 33–46 queries and repeats unbounded history reads up to 5× (React cache() is a no-op in route handlers)

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** PERF-02
**Remediation plan:** [R-PERF-01](remediations/R-PERF-01-dashboard-summary-queries.md)

> **Adversarial review (lead auditor):** Kept HIGH: the most-loaded mobile screen degrades with each power user's history.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `src/app/api/dashboard/summary/route.ts:75-89`, `src/features/dashboard/lib/cached-fetchers.ts:15-40`, `pulse-data.ts:37-91`, `schedule.ts:80-87`, `activity-feed.ts:40-52`, `src/dal/service-booking.dal.ts:755-822`, `src/dal/listing.dal.ts:1059-1065`
- **Affected routes:** mobile Home (30 s stale, refetch on focus).
- **Relevant code:**

```ts
38 export const findServiceBookingsByProviderCached = cache((userId: string) =>
39   serviceBookingDAL.findByProviderForDashboard(userId),
821        .where(eq(serviceBookings.providerId, providerId))
822        .orderBy(desc(serviceBookings.createdAt));
```

- **What is wrong:** `cache()` does nothing in a route handler, so every fetcher re-runs:
  - provider bookings: 5×
  - requester bookings and borrowed listings: 3× each
  - lending requests (pending, approved, active), actionable alerts and provider listings: 2× each

  The booking reads have no LIMIT and return full rows plus counterparty email. The route only uses them to count `pending`, find `accepted` in the next 7 days, and keep the newest 20. The feed loads every owned listing and all its images to show 10 titles.

- **Failure scenario:** a provider with 500 bookings pulls ~2,500 full rows on every Home focus, through a pool of 10.
- **Mitigating layers checked:** `safe()` per source; the provider and requester indexes exist, but every row is still read and sorted.
- **Real-world impact:** the slowest screen belongs to the most active users.
- **Recommended fix:** fetch each source once and pass it down (or memoize on ALS). Use `count(*)` for pending, a 7-day filter for accepted, and `LIMIT 20` for recent; the feed needs `LIMIT 10` listings without images.
- **Tests needed:** with 300 seeded bookings, ≤ ~15 queries and no result larger than 20 rows.
- **Related:** PERF-03, PERF-16.

### PERF-02: Posting a need fans out ~4 queries per recipient across the whole network inside after(), saturating the 10-connection pool

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** PERF-03
**Remediation plan:** [R-PERF-02](remediations/R-PERF-02-need-notification-fanout.md)

> **Adversarial review (lead auditor):** Kept HIGH; also an abuse lever because posting needs is unthrottled (SEC-15).

- _Auditor's original grading:_ HIGH | **Confidence:** High for the mechanics; the magnitude depends on network size.
- **Files:** `src/features/neighborhood-needs/services/neighborhood-needs-service.ts:65-72,315-344`, `src/dal/community.dal.ts:932-947,965-976`, `auth-service.ts:204`, `src/dal/notifications.dal.ts:69-87`, `send-notification.ts:110-111`
- **Affected routes:** `POST /api/needs`, plus every request on the same instance meanwhile.
- **Relevant code:**

```ts
315  const recipientIds = await communityDAL.getUserIdsVisibleInCommunity(
322  await Promise.all(
326        sendNotification({
```

- **What is wrong:** at join, `initializeUserVisibility` makes every user visible in every community of their network, so the recipients are the whole network. Each recipient costs a user-exists SELECT, an INSERT and 2 preference reads, plus a push lookup for users who opted in. ~4N queries are released at once into a 10-connection pool, inside `after()` on a live instance.
- **Failure scenario:** 3,000 users → ~12k queued queries → 4–6 s of pool saturation that blocks every request on that instance. `after()` shares the time limit, so the fan-out can stop partway, and the push chains aren't awaited.
- **Mitigating layers checked:** email is off for this notification; the push category defaults to off; errors are isolated per recipient.
- **Real-world impact:** latency spikes for unrelated users on every post, and it scales with the network.
- **Recommended fix:** one `INSERT … SELECT user_id FROM community_visibility WHERE community_id=$1 AND is_visible`; load push targets with one join; send Expo in chunks of 100, or queue the fan-out.
- **Tests needed:** 500 visible users → ≤ 5 queries.
- **Related:** PERF-07, PERF-12.

### PERF-03: Every authenticated API request resolves the session three times (≈9 auth queries): wrapper before ALS, handler, and proxy

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PERF-01

> **Adversarial review (lead auditor):** Downgraded HIGH→MEDIUM. Facts verified (the lead flagged the wrapper independently: `src/lib/api/with-request-logging.ts:47-54` resolves the user before `runWithRequestContext` exists; `src/proxy.ts:218` resolves again for every non-skipped `/api/*`), but ~12–20 ms and ~2× auth queries per request are not user-visible at neighborhood scale. Still the highest-leverage perf fix; scheduled early.

- _Auditor's original grading:_ HIGH | **Confidence:** High. Traced through the wrapper, the proxy build manifest and the better-auth source.
- **Files:** `src/lib/api/with-request-logging.ts:47-54`, `src/features/auth/utils/session.ts:36-60`, `src/proxy.ts:39,218,330`, `src/dal/user.dal.ts:891-895`, `node_modules/@better-auth/core/dist/db/adapter/factory.mjs:549`, `next/dist/compiled/react/cjs/react.react-server.production.js:311-312`
- **Affected routes:** every `withRequestLogging` handler (184 wraps). The proxy adds a third resolution on every `/api/*` path except `/api/auth*` and `/api/profile*`.
- **Relevant code:**

```ts
// with-request-logging.ts
49      userId = await getCurrentUserId();
54    return runWithRequestContext(
// session.ts
39  if (ctx && "user" in ctx && ctx.user !== undefined) {
44    const session = await auth.api.getSession({
58    const userProfile = await userDAL.getUserForAuth(session.user.id);
// proxy.ts
218    const user = await getCurrentUser();
```

- **What is wrong:** one resolution is 3 sequential queries: the session by token, the user by id (a separate query because joins are off), and the same user row again in `getUserForAuth`. It runs three times per request:
  1. **The wrapper**, at line 49, before `runWithRequestContext` creates `ctx`, so it never seeds `ctx.user`.
  2. **The handler.** `React.cache` doesn't memoize outside an RSC render, so the handler repeats the chain.
  3. **The proxy.** It runs `nodejs` with a matcher that covers `/api/*`, and repeats the chain again in its own invocation with its own Pool.

  That is 9 auth queries, 6–7 of them redundant. `route-helpers.ts:51-53` wrongly says the wrapper seeds the slot.

- **Failure scenario:** 9 of the badges route's 13 queries and 9 of the thread poll's 11 are auth. That adds about 12–20 ms per call in-region, and 100 ms+ cross-region or on a cold proxy.
- **Mitigating layers checked:** the ALS memo works after the handler's first call; the token is unique-indexed; no `cookieCache`.
- **Real-world impact:** about 2× the DB queries on the polled endpoints, plus a proxy invocation on every API call.
- **Recommended fix:**
  1. Resolve inside the context: `runWithRequestContext(ctx, async () => { ctx.userId = await getCurrentUserId(); … })`.
  2. In the proxy, return `next()` for `/api/*` before the auth call; the 4 protected API prefixes can check `getSessionCookie(request)`.
  3. Optionally remove the duplicate user read (`additionalFields`/`experimental.joins`) or add a short `cookieCache`.

  That takes 9 queries down to 3, or 1.

- **Tests needed:** mocked `getSession` called once per request; the proxy never authenticates `/api/*`; `runWithQueryCounter` shows ≤ 7 queries on badges.
- **Related:** PERF-01, PERF-11.

### PERF-04: Listing search sorts every visible listing on each page; text search has no trigram index

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** PERF-04

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. The code is verified; the plan and magnitude are inferred.
- **Files:** `src/dal/listing.dal.ts:149-172,786-793,840-903`, `listings.schema.ts:125-142`, `user.schema.ts:176-177`, `service-listing.dal.ts:289-332`
- **Affected routes:** `GET /api/listings/search`, `GET /api/services/listings`.
- **Relevant code:**

```ts
879          .selectDistinct(selectFields)
901          .orderBy(...orderByClause)
902          .limit(pagination.limit)
789            ilike(listings.description, `%${filters.query}%`),
```

- **What is wrong:**
  - DISTINCT covers every listing column (description, instructions, specifications jsonb) plus owner, category and `ST_Distance`, so each page hashes or sorts the whole matched set before LIMIT applies.
  - The DISTINCT only guards the `user_addresses` `is_primary` join, which isn't unique.
  - The visible set is the whole network by default.
  - `ILIKE '%q%'` on 4 columns can't use the btree index.
  - It takes 5 sequential round trips, and cards receive full rows.

  Services browse has the same DISTINCT and returns a fixed first 50 rows.

- **Failure scenario:** tens of ms at 1–2k visible listings. At ~10k per network the sort likely spills: hundreds of ms per page.
- **Mitigating layers checked:** `listings_community_status_idx`; batched images (plan 013); limit ≤ 100.
- **Real-world impact:** negligible today; becomes the main Explore latency as the network grows.
- **Recommended fix:**
  - add `UNIQUE (user_id) WHERE is_primary` on `user_addresses` (or a LATERAL `LIMIT 1`), then drop the DISTINCT
  - select only the card fields
  - add a `pg_trgm` GIN index on name/brand/model
  - add `(community_id, created_at DESC)` on browseable rows
  - run count and page in parallel
- **Tests needed:** EXPLAIN ANALYZE on 10k seeded listings shows no full-set Sort/HashAggregate.
- **Related:** PERF-02.

### PERF-05: Payout crons pay at most 20 rentals and 20 service bookings per day

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PERF-05

> **Adversarial review (lead auditor):** Kept MEDIUM. New evidence against the prior rejection 'batches capped at 20 - immaterial': that assumed hourly runs, but the payout crons run daily (`.github/workflows/cron-jobs.yml`), so throughput is capped at 20 payouts/day per marketplace.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `.github/workflows/cron-jobs.yml:6,50-60`, `src/app/api/cron/process-payouts/route.ts:20,27`, `payment-lifecycle.dal.ts:398-399`, `service-payment-lifecycle.dal.ts:271-272`, `blind-review-service.ts:213-216`
- **Affected routes:** process-payouts, process-service-payouts, release-reviews (100 a day).
- **Relevant code:**

```yaml
6    - cron: "0 10 * * *" # daily at 5 AM CDT
```

```ts
20    const result = await PaymentLifecycleService.processPayouts(20);
27      recordsEligible: result.processedCount,
```

- **What is wrong:** one run a day × FIFO `LIMIT 20` caps payouts at 20 a day per type. `recordsEligible` records the batch size, so the backlog is invisible. This is not the rejected "sequential loop" finding: the ceiling comes from cadence × cap.
- **Failure scenario:** once completions average more than 20 a day (Monday returns first), payouts slip and the slip compounds silently.
- **Mitigating layers checked:** FIFO means nothing starves; the selection is indexed.
- **Real-world impact:** late owner payouts with no ops signal.
- **Recommended fix:** run hourly or loop within a time budget; record the real `count(*)`; alert when the backlog grows or the oldest item is over 48 h.
- **Tests needed:** 45 eligible rows are all processed.
- **Related:** PERF-06.

### PERF-06: No cron sets maxDuration, and one failed step skips every later step of the daily job

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** PERF-06

> **Adversarial review (lead auditor):** Kept MEDIUM (the lead independently noted the sequential `curl --fail` steps).

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. The step chaining is verified; the timeout depends on the Vercel plan.
- **Files:** `.github/workflows/cron-jobs.yml:45-91` (steps at 50/56/62/68/74/80/86; no `continue-on-error`, `if: always()` or `--max-time`); no `maxDuration` export in `src/app/api/cron/*`; `vercel.json` is `{}`
- **Affected routes:** the daily job.
- **What is wrong:** payouts are 20 × (deposit release + transfer + 3–4 updates) in sequence, about 20–60 s. On a timeout (e.g. a 10–15 s default without Fluid compute) or a 500:
  - the in-flight row stays `processing`, which `claimForProcessing` never re-picks
  - no cron-history row is written
  - `curl --fail` makes GitHub skip service payouts, deposit monitoring, both stale detectors, review release and reminders for the day

  The stale detector runs only after this step, so it catches the row on a later successful day at the earliest.

- **Failure scenario:** one slow Stripe day skips all of the day's money work and its alerting.
- **Mitigating layers checked:** a later detector run alerts on the stuck row.
- **Real-world impact:** money work and alerting fail together.
- **Recommended fix:** export `maxDuration` on cron and money routes; use time-budgeted loops; make the steps independent (`if: always()`); add `curl --max-time`; run the stale detectors hourly.
- **Tests needed:** a workflow assertion that the steps are independent; a check that `maxDuration` is exported.
- **Related:** PERF-05, PERF-10.

### PERF-07: Chat sends and other mutations block on the Resend email call

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PERF-07

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `messages/conversations/[conversationId]/messages/route.ts:55-64`, `send-notification.ts:72-98`, `services/resend/index.ts:10`. The same pattern is in `service-booking-service.ts:147,632,689`, `rentals/[id]/{start,end,decline,instructions}`, `dispute-creation-service.ts:256` and `messages/conversations/route.ts:129`.
- **Affected routes:** the listed mutations; chat is the hottest.
- **Relevant code:**

```ts
64      await sendMessageReceivedNotification({
96    const allowEmail = await shouldSendEmail(userId, category);
98      const emailResult = await sendEmail(email);
```

- **What is wrong:** after the message writes, the sender waits on 2 user reads, the notification insert and its pre-check, 2 preference reads and a Resend call with no timeout set. Elsewhere, promises that are neither awaited nor in `after()` (`rental-service.ts:344`, push chains, `trackActivity`) can be dropped after the response.
- **Failure scenario:** +0.3–0.6 s on every chat message; a slow Resend stalls sends.
- **Mitigating layers checked:** errors are caught.
- **Real-world impact:** sluggish chat.
- **Recommended fix:** respond after the write; await notifications inside `after()`; reuse the users already loaded; add a Resend timeout.
- **Tests needed:** with `sendEmail` hanging, the POST still responds.
- **Related:** PERF-02, PERF-12.

### PERF-08: messages lacks a (conversation_id, created_at) index; the unread badge scans the user's whole message history

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PERF-08

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `src/db/schemas/messages.schema.ts:78-88`, `src/dal/messages.dal.ts:978-1025,539-545,658-664`
- **Affected routes:** badges, the thread, the inbox.
- **Relevant code:**

```ts
78    conversationIdIdx: index("messages_conversation_id_idx").on(
87    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
88    lastMessageAtIdx: index("messages_last_message_at_idx").on(table.createdAt),
```

- **What is wrong:** the unread count finds rows by `conversation_id` alone, then filters `created_at > lastReadAt` row by row, so it reads every message in every conversation. The thread window and the inbox's last-message lateral also sort whole histories. There are two identical `created_at` indexes.
- **Failure scenario:** 150 conversations × 100 messages = ~15k rows on every badge refresh.
- **Mitigating layers checked:** the scan is narrowed to the user's conversations.
- **Real-world impact:** badge cost grows with account age.
- **Recommended fix:** `CREATE INDEX CONCURRENTLY … ON messages (conversation_id, created_at DESC, id DESC)`; drop the duplicate; first filter to conversations with `last_message_at > coalesce(userN_last_read_at,'-infinity')` (every live insert updates it).
- **Tests needed:** EXPLAIN on 100k messages shows an index scan with rows ≈ the unread count.
- **Related:** PERF-11.

### PERF-09: Detail endpoints run long sequential query chains

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** PERF-09

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `src/dal/rentals.dal.ts:2210-2313`, `rentals/[id]/route.ts:103-170`, `src/dal/listing.dal.ts:318-399`, `rental-quote.ts:94`, `images/reorder/route.ts:50`
- **Affected routes:** `GET /api/rentals/[id]`, `GET /api/listings/[id]`, rental preview.
- **Relevant code:**

```ts
2291        const renterCompletedRentals = await this.db
2292          .select()
398          .set({ viewCount: sql`${listings.viewCount} + 1` })
```

- **What is wrong:**
  - **Rental detail:** 7 sequential DAL queries, then agreement (4–6) and dispute eligibility (~3). The completed-rentals count pulls full rows only to use `.length`.
  - **Listing detail:** 7 sequential reads plus an UPDATE on every GET, so each refetch counts as a view.
  - **Reuse:** the same heavy `getListingById` serves the quote and the reorder ownership check.
- **Failure scenario:** ~25 sequential round trips: 50–75 ms in-region, 0.4 s+ cross-region.
- **Mitigating layers checked:** all lookups are PK or indexed.
- **Real-world impact:** slow detail screens.
- **Recommended fix:** one joined query plus `count(*)`; `Promise.all` for agreement and dispute; move the view bump into `after()`; narrow selectors.
- **Tests needed:** ≤ 8 queries on rental detail.
- **Related:** PERF-03.

### PERF-10: The rental-reminders cron loops over an ever-growing set with no cap

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** PERF-10

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. It depends on how often rentals are never marked "started".
- **Files:** `src/app/api/cron/rental-reminders/route.ts:20-55`, `src/dal/rentals.dal.ts:1356-1372`
- **Affected routes:** daily rental-reminders.
- **Relevant code:**

```ts
1369            eq(rentalRequests.status, "approved"),
1370            lt(rentalRequests.startDate, day),
55        const result = await sendNotification({
```

- **What is wrong:** nothing moves a never-started approved rental out of `approved`, so both parties are re-notified every day. The loop runs 2 × backlog sends in sequence with no cap, no time budget and no dedupe (`hasRentalReminderBeenSent` is unused).
- **Failure scenario:** 1,000 stale approvals → 2,000 sequential sends (~20–60 s) a day, growing until the run times out.
- **Mitigating layers checked:** none.
- **Real-world impact:** reminder spam and a cron that keeps getting slower.
- **Recommended fix:** remind only for 1–3 days after a missed start; cap the loop and give it a time budget; dedupe; decide a policy for stale approvals.
- **Tests needed:** a re-run sends no duplicates.
- **Related:** PERF-06.

### PERF-11: The thread poll re-downloads the whole 50-message window every 20 s

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PERF-11

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High | **Files:** `hoador-mobile/src/features/messages/hooks/use-conversation.ts:13,20,62`, `messages.dal.ts:630-680`
- **What is wrong / fix:** 11 queries and ~15–20 KB per tick even when nothing changed. Add an `after=<lastMessageId>` delta or an ETag on `lastMessageAt`.

### PERF-12: Notification queries do avoidable work

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PERF-12

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High (90-day retention bounds rows per user) | **Files:** `badges/route.ts:31-35`, `notifications.dal.ts:69-71,131-156,356-359`, `notifications.schema.ts:40-42`
- **What is wrong / fix:**
  - Badges runs a `COUNT(*)` it never uses.
  - Each row is joined to the recipient's own user row, email included.
  - `create()` runs a user SELECT that the FK already covers.
  - The `is_read`/`type` indexes are low-selectivity; use `(user_id, created_at DESC)` plus a partial `WHERE NOT is_read` instead.
  - The cleanup `DELETE … RETURNING *` has no `created_at` index.

### PERF-13: The push-receipt cron updates up to 3,000 rows one at a time

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PERF-13

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High | **Files:** `expo-push-service.ts:201,258-270`
- **What is wrong / fix:** each receipt gets its own sequential UPDATE, up to 3,000 round trips. Use `UPDATE … WHERE id = ANY($1)`.

### PERF-14: Mobile list endpoints over-fetch and run avoidable sequential awaits

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PERF-14

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High | **Files:** `garage/pending-count/route.ts:16-21`, `garage/pending-review/route.ts:19-43`, `listing.dal.ts:1374-1381`, `rentals.dal.ts:503-514,3203-3235`, `get-payment-methods/route.ts:26,48`
- **What is wrong / fix:**
  - pending-count loads rows and images to return `.length`. Use `count(*)`.
  - pending-review re-reads rejection reasons it already has.
  - Image enrichment fetches every image to keep the first. Use `DISTINCT ON`.
  - `/api/schedule` runs 6 × 2 sequential queries.
  - get-payment-methods makes 2 sequential Stripe calls.
  - `countSharedListings` selects full rows just to count.

### PERF-15: Lookups on rarely used paths have no index

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PERF-15

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High | **Files:** `account-deletion.dal.ts:316`, `user.dal.ts:1235`, `payment-lifecycle.dal.ts:233`, `payment.dal.ts:562`, `rentals.dal.ts:1924`, `service-booking.dal.ts:224,412`
- **What is wrong / fix:** sequential scans on small tables or rare paths:
  - `session.user_id`, `account.user_id`, `verification.identifier`
  - `user.stripe_connected_account_id` (webhook)
  - the lifecycle transfer and charge ids
  - `service_bookings.listing_id`
  - hourly `payment_status='processing'` scans

  See the index inventory.

### PERF-16: getUserDisputes can't use any dispute index

**Severity:** LOW · **Confidence:** Medium · **Auditor source(s):** PERF-16

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** Medium | **Files:** `dispute.dal.ts:358-398`, `pulse-data.ts:76`
- **What is wrong / fix:** an OR of 4 correlated `EXISTS` subqueries makes both the COUNT and the page scan all of `disputes` on every Home load and `/api/disputes` call. Rewrite as `rental_id IN (SELECT id FROM rentals WHERE renter_id=$1 OR owner_id=$1) OR service_booking_id IN (…)`.

## Auditor summary (hot endpoints and query counts)

CRITICAL 0 · HIGH 3 · MEDIUM 7 · LOW 6.

The five hottest endpoints ("9 auth" is PERF-03):

| Endpoint                             | Why it's hot                                                           | Queries per request                                |
| ------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------- |
| GET /api/dashboard/badges            | header on every screen; refetched on foreground/mount when >30 s stale | 9 auth + 4 = 13 (11 sequential round trips)        |
| GET /api/messages/conversations/[id] | polled every 20 s while a thread is focused                            | 9 + 2 = 11 per tick                                |
| GET /api/dashboard/summary           | Home tab focus                                                         | 9 + 33–46                                          |
| GET /api/listings/search             | Explore, infinite scroll                                               | 9 + 5–6, and each page sorts every visible listing |
| GET /api/messages/conversations      | inbox                                                                  | 9 + 1 (one lateral subquery per row)               |

Also: /api/schedule 9 + 12; /api/rentals/[id] 9 + ~15 (sequential).

## Index inventory (performance auditor)

The base tables predate migration 0000.

| Table                            | Existing                                                                                                               | Recommended (query)                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| messages                         | conversation_id; sender_id; rental_id; listing_id; service_listing_id; created_at ×2 (dup)                             | **(conversation_id, created_at DESC, id DESC)**: unread count, thread, inbox (PERF-08); drop the dup |
| notifications                    | user_id; type; is_read                                                                                                 | (user_id, created_at DESC); partial WHERE NOT is_read; (created_at) for cleanup                      |
| listings                         | 10 btree: owner, community, category, status, rate, name, (community,status), approval, (status,approval), reviewed_at | pg_trgm GIN for search; (community_id, created_at DESC) partial (PERF-04)                            |
| user_addresses                   | user_id; (lat,lng)                                                                                                     | UNIQUE (user_id) WHERE is_primary                                                                    |
| listing_images                   | listing_id; (listing_id,order_index)                                                                                   | drop listing_id (prefix-redundant)                                                                   |
| rental_requests                  | listing, renter, owner, status, dates, (owner,status), (renter,status), partial pending                                | partial (updated_at) WHERE payment_status='processing'                                               |
| rental_payment_lifecycle         | rental_id uq; payout_status; deposit_hold_status                                                                       | stripe_transfer_id; rental_charge_id                                                                 |
| service_bookings                 | completed_at; provider_id; requester_id; partial pending                                                               | listing_id; partial processing                                                                       |
| service_payment_lifecycle        | booking_id uq; payout_status; owner_transfer_status                                                                    | stripe_transfer_id                                                                                   |
| session / account / verification | token uq / none / none                                                                                                 | user_id / user_id / identifier                                                                       |
| user                             | email uq; last_active_at                                                                                               | stripe_connected_account_id                                                                          |

Adequate as is: conversations, rentals, service_listings, payments, disputes and child tables, community tables, push tables, blind_reviews, review_events, audit_logs, user_activity_log, cron_run_history, neighborhood_needs, legal acceptances.

## Verified clean (performance auditor)

- Image lookups are batched (`listing.dal.ts:959-977,1374`; `rentals.dal.ts:559-566,959-969`); owner stats use GROUP BY (`listing.dal.ts:1325-1342`).
- The thread uses keyset paging and clamps; the inbox clamps (`messages.dal.ts:115-170,656-680`). `validatePagination` caps at 100 (`base.ts:69-77`), as do payments, earnings and reviews; schedule ranges are capped at 366 days.
- Deposit and payout crons are capped at 20 and FIFO (`payment-lifecycle.dal.ts:398,444-445,485`); partial indexes cover the pending, review-release and receipt queries.
- PDF generation, Meta CAPI and approval notifications run in `after()` or the internal route (`rental-service.ts:847-955`, `service-booking-service.ts:555`), off the approve/accept critical path.
- `sharp` handles one image of ≤10 MB and ≤2048 px per request (`lib/image/server.ts:14-44`).
- Within a handler, `getCurrentUser` is ALS-memoized after the first call. Cron and webhook requests carry no cookie, so auth costs them nothing.

## Auditor open questions — performance

- Vercel plan and Fluid setting (effective `maxDuration` for crons and `after()`); whether the Node proxy is a separate invocation; function region vs Neon.
- Neon compute size, `work_mem`, pooled vs direct `DATABASE_URL`.
- Real volumes behind PERF-02, 04, 05, 08 and 10.
- Whether the pre-migration-0000 base indexes exist in prod (`pg_indexes`).
- No migration creates PostGIS, yet search computes `ST_Distance`. Confirm the extension is installed in every environment.
