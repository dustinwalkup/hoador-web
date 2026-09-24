# Architecture findings

These are systemic root causes. Most individual defects in the other documents are instances of a handful of architectural gaps; fixing the instances without addressing the root cause means the same bug class will be reintroduced on the next feature (plans 009/011 fixed services, and the identical rental flows were missed — see ARCH-08).

Architecture findings are graded by the systemic risk they carry. Each lists the concrete findings it causes; those instances have their own severities and, where CRITICAL/HIGH, their own remediation plans. None of the ARCH items is graded HIGH on its own: the HIGH instances are already tracked and planned individually, and the architectural work is sequenced in `10-remediation-roadmap.md` (mostly Phases 2–3).

Written by the lead auditor from direct reads of `hoador-web` develop `21bdc61` (2026-09-23) plus the consolidated findings.

## Summary

| ID      | Severity | Root cause                                                                                                 | Instances                                                                            |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ARCH-01 | MEDIUM   | No shared claim/transition layer for money state; check-then-act everywhere except where a plan patched it | BIZ-01, BIZ-03, BIZ-05, CONC-01, CONC-02, CONC-03, CONC-04, CONC-05, CONC-09, BIZ-12 |
| ARCH-02 | MEDIUM   | Responses built by spreading DB rows; no response-DTO/allowlist layer                                      | PRIV-01 (CRITICAL), PRIV-03, PRIV-04, SEC-07, SEC-09, PRIV-10, SEC-16                |
| ARCH-03 | MEDIUM   | Authorization and account-state policy not centralized                                                     | SEC-01, SEC-08, BIZ-07, BIZ-08, SEC-10                                               |
| ARCH-04 | MEDIUM   | No durable job system or Stripe↔DB reconciliation                                                          | BIZ-06, BIZ-11, BIZ-12, BIZ-13, PERF-02, PERF-05, PERF-06, CONC-10                   |
| ARCH-05 | MEDIUM   | Error-handling contract broken end to end                                                                  | SEC-16, TEST-07                                                                      |
| ARCH-06 | MEDIUM   | Release safety for released mobile binaries and for deploys                                                | TEST-10; constrains every contract-changing fix                                      |
| ARCH-07 | MEDIUM   | No shared, durable rate-limiting/abuse layer                                                               | SEC-04, SEC-13, SEC-14, SEC-15, SEC-21, CONC-07, PRIV-02 (address churn)             |
| ARCH-08 | LOW      | Two divergent payment lifecycles (rental vs service)                                                       | CONC-02 vs plan 011; BIZ-01 vs plan 009                                              |
| ARCH-09 | LOW      | Configuration hygiene                                                                                      | —                                                                                    |
| ARCH-10 | LOW      | Retiring web UI still deployed with direct DAL access                                                      | SEC-23, PRIV-01 (web page variant)                                                   |

---

### ARCH-01: Money state transitions have no shared claim/transition layer

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `src/dal/rentals.dal.ts` (approve `:1957-2023`, decline `:2045-2082`, cancel pending `:1808-1848`, start `:2737-2806`, end `:2883+`); `src/features/rentals/services/cancellation-service.ts:105-340`; `src/dal/service-booking.dal.ts:175-201` (`updateIfStatus` — the one good pattern); `src/dal/payment-lifecycle.dal.ts` / `service-payment-lifecycle.dal.ts` (payout claims); `src/features/disputes/lib/state-machine.ts` (the only explicit state machine).
- **Relevant code:**
  ```ts
  // rentals.dal.ts — typical transition: read, check in JS, then UPDATE ... WHERE id only
  if (request.status !== "pending") { throw new Error("Only pending requests can be declined"); }
  await this.db.update(rentalRequests).set({ status: "denied", ... }).where(eq(rentalRequests.id, requestId));
  ```
- **What is wrong:** Every transition hand-rolls its own guard. Most are read-then-write with `WHERE id` only; a few (plans 005/009/011) added compare-and-swap claims, but only on the specific transitions that were reported. There are no row locks, no advisory locks, no exclusion constraints, and only three DAL files use transactions (`user.dal.ts`, `user-activity.dal.ts`, `account-deletion.dal.ts`), none on a money path. Side effects (Stripe) are frequently ordered _before_ the state write that should have claimed the transition. Status sub-machines (request status, `paymentStatus`, deposit/transfer/payout statuses, dispute status) are updated independently with no invariant checks, so they drift (see `12-booking-state-machine.md` §6).
- **How it fails:** Sequential and concurrent sequences produce illegal states that move money: charging cancelled requests (BIZ-01), refund+payout double spends (CONC-02, BIZ-03), payouts marked complete without a transfer (BIZ-05), overlapping approvals (CONC-01).
- **Real-world impact:** The majority of the audit's HIGH financial findings trace here.
- **Recommended fix:** Introduce one small transition utility in the DAL layer and use it for every status change that gates money:
  1. `transition(table, id, { from: [...], to, extraWhere?, set })` → `UPDATE … WHERE id = ? AND status IN (from) [AND extraWhere] RETURNING *`; returns the row or `null` (caller maps to 409). Generalizes `ServiceBookingDAL.updateIfStatus`.
  2. Rule: **claim first, then call Stripe, then finalize** (already the documented pattern for service accept/cancel). Persist Stripe object ids immediately after the call.
  3. Multi-row finalizations (request → rental row → payment → lifecycle) in one `db.transaction`.
  4. A declarative transition table per machine (like `disputes/lib/state-machine.ts`) that routes and crons consult, with a unit test that every writer uses it.
     Do this incrementally: the HIGH remediation plans (R-BIZ-01, R-CONC-02, R-BIZ-03, R-BIZ-05) each add the CAS they need; Phase 3 consolidates them behind the shared helper.
- **Tests needed:** A real-Postgres harness (R-TEST-HARNESS) with concurrent-call tests per transition; SQL-render tests pinning each WHERE clause.

### ARCH-02: API responses are built by spreading DB rows; there is no response-DTO / allowlist layer

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `src/app/api/rentals/[id]/route.ts:174-175` (`...data`), `src/app/api/services/listings/[id]/route.ts:76` (`{ ...listing, isProvider }`), `src/dal/service-booking.dal.ts:800-826` (`...row.booking`), `src/dal/community.dal.ts:848-862` (`.select()` of all columns), `src/dal/listing.dal.ts:995` (`...item.listing`).
- **What is wrong:** Most read routes return whatever the DAL selected, and many DAL reads select whole rows (`select()` / relational `with: { owner: true }`). Whether a field reaches a client depends on each DAL author remembering to omit it. The mobile app's narrow Zod contracts hide the over-exposure from its UI (they strip `email`, `joinCode`, etc. client-side), which is why it went unnoticed — but the bytes still leave the server. Where allowlists exist (service-booking detail after P-E9-3, listing detail, dispute participant view) they were added case by case.
- **How it fails:** PRIV-01 (CRITICAL), PRIV-03, PRIV-04, SEC-07's payment-method-id leak, SEC-09's join codes, PRIV-10's moderation internals.
- **Recommended fix:** Add explicit response mappers (`toXResponse(row, viewer)`) per resource, co-located with the route or feature, that construct objects field by field (no spreads), and make the DAL select only needed columns for cross-user reads. Add one contract test per route that serializes a fully populated fixture and asserts forbidden keys (`email`, `phone`, `stripe*`, `pm_`, `joinCode`, `adminNote`, `rejectionReason`, `password`, `token`) are absent for non-owner viewers. Consider a lint rule (or a codemod check in CI) that flags `NextResponse.json({ ...` in `src/app/api`.
- **Tests needed:** The forbidden-keys contract test above, run for every route that returns another user's data (inventory in `11-attack-surface-map.md`).

### ARCH-03: Authorization and account-state policy is not centralized

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `src/features/auth/utils/session.ts:120-132` (`getAuthenticatedUser` — no status check), `src/features/auth/utils/guards.ts:6-12` (`requireActiveUser`, zero callers), `src/proxy.ts:7-16,218-300` (four protected API prefixes; no suspended/inactive branch), DAL methods with unused ownership parameters: `src/dal/rentals.dal.ts:659,1810,1959,2049,2665,2739,2885`, `src/dal/dispute.dal.ts:735`.
- **What is wrong:** "Who may do what, in which account state" is decided ad hoc in each route or service. The one shared helper answers only "is there a session". The proxy covers a subset of API prefixes, so it is neither a reliable control nor clearly documented as defense-in-depth. Several DAL methods take `_ownerId` / `_userId` / `_renterId` parameters that they ignore — signatures that _look_ like ownership scoping and invite a future caller to skip the route-level check. Community membership/visibility (the tenant boundary) is enforced on reads, but the write that grants visibility is unchecked (SEC-08).
- **How it fails:** SEC-01 (suspended users keep access), SEC-08 (self-granted visibility), BIZ-07 (deleted users chargeable), BIZ-08 (no eligibility checks at booking).
- **Recommended fix:** (1) Make the shared auth helper return 403 for restricted account states with an explicit opt-in for the few routes that must allow them (R-SEC-01). (2) Add a small policy module (`canBook(user, listing)`, `canActOnBooking(user, booking, action)`) used by quote, approve/accept and cancel paths. (3) Remove the unused ownership parameters from DAL signatures (or make them real `WHERE` predicates) so signatures stop implying protection they don't provide. (4) Document the proxy as defense-in-depth only, or remove its API handling and rely on the helper (PERF-03 recommends skipping `/api/*` in the proxy for performance).
- **Tests needed:** A table-driven route test that walks every ID-bearing route with (stranger, party, admin, suspended) actors.

### ARCH-04: Background work has no durable job system or Stripe↔DB reconciliation

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `.github/workflows/cron-jobs.yml` (all jobs), `src/app/api/cron/*` (no `export const maxDuration` anywhere), `src/features/rentals/services/rental-service.ts` (`after()` for notifications/PDF), `src/features/neighborhood-needs/services/neighborhood-needs-service.ts:315-344` (`after()` fan-out), `src/features/notifications/lib/ops-alerts.ts` (email-only alerts), `src/services/stripe/webhook-handlers.ts:139-167` (unmatched charges only audit-logged).
- **What is wrong:**
  - Crons are sequential `curl --fail` steps in one GitHub Actions job: a single 500 skips every later step that day (payouts → service payouts → deposit-expiry monitor → stale detectors → review release → reminders). There is no `concurrency:` group, `workflow_dispatch` runs all three jobs at once, and the payout crons run **daily** with a batch cap of 20 — a hard throughput ceiling of 20 payouts/day per marketplace (PERF-05, contradicting specs that say hourly).
  - Post-response work runs in `after()`, which shares the function's time budget and has no retry.
  - There is no reconciliation between Stripe and the DB: a succeeded charge with no payment row, a transfer with no `stripeTransferId`, a refund recorded as full when partial, or a chargeback that failed to insert (BIZ-06) is either audit-logged or alerted by email, never repaired or re-driven.
- **How it fails:** Money work silently stops or duplicates under partial failures (BIZ-11, BIZ-12, BIZ-13), fan-outs saturate the pool (PERF-02), payouts back up as volume grows (PERF-05).
- **Recommended fix:** (1) Short term: split cron steps into independent jobs (or add `continue-on-error` per step with a final status check), add `concurrency: { group: cron-${{ github.job }} }`, set `maxDuration` on cron routes, and run payouts hourly as the specs say. (2) Medium term: a durable queue (e.g. Vercel Queues / Inngest / a Postgres-backed job table with `SELECT … FOR UPDATE SKIP LOCKED`) for fan-outs, PDF generation and payout batches. (3) A nightly reconciliation job that lists Stripe charges/transfers/refunds/disputes for the day and diffs them against `payments`, lifecycles and `disputes`, emitting a single actionable report.
- **Tests needed:** Reconciliation job unit tests with fixture Stripe lists; a CI assertion that each cron route exports `maxDuration`.

### ARCH-05: The error-handling contract is broken end to end

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `src/dal/base.ts:15-66`, `node_modules/drizzle-orm/errors.js:10-19`, `src/lib/api/route-helpers.ts:47-250`, `src/app/api/rentals/[id]/approve/route.ts:72-100` (string matching on messages).
- **What is wrong:** Three layers disagree. drizzle-orm 0.45 wraps driver errors (`DrizzleQueryError`, pg code on `.cause`), so `BaseDAL.handleError`'s constraint mapping never fires and wraps the SQL-bearing message into a 500 `DALError`. `handleApiError` returns `error.message` for `DALError` and generic `Error`s, and maps some errors by substring ("not found" → 404, "Unauthorized" → 401). Services throw plain `Error("Forbidden: …")` that routes then detect by `message.includes("Forbidden")`. The mobile app is required to branch on stable `code`s, but many failure paths never produce one.
- **How it fails:** SEC-16 (SQL and bound parameters in responses, logs and Sentry; expected 409s become 500s), fragile status codes, and duplicate-detection responses the mobile app cannot recognize.
- **Recommended fix:** Map `(error.cause ?? error).code`; never return DB or Stripe messages to clients (log them with a request id); replace substring matching with typed errors carrying a `code` and status; add a `ForbiddenError`-first convention in services. Pin with a real `DrizzleQueryError` fixture (R-TEST-HARNESS).
- **Tests needed:** Error-mapping unit tests with real error shapes; a route test asserting no response body ever contains `Failed query` or `params:`.

### ARCH-06: Release safety — released mobile binaries and the deploy pipeline

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `src/app/api/**` (unversioned paths), no min-version mechanism in either repo (`grep x-app-version|minimumVersion|forceUpdate` finds nothing), `.github/workflows/deploy.yml:5-10,49` (deploys main HEAD via `workflow_run`, checkout without `ref`), `.github/workflows/e2e-tests.yml` (not a deploy dependency), `.github/workflows/database.yml` (migrations manual; offers `push` to production).
- **What is wrong:** The API is unversioned and there is no server-driven "minimum supported app version" or kill switch, so a security fix that changes a response contract can't force old binaries off it — every fix must stay backward compatible with every shipped build indefinitely. On the server side, production deploys build main HEAD rather than the SHA CI passed, e2e never gates a deploy, and migrations are applied manually (DB-02).
- **How it fails:** Contract-changing fixes (e.g. removing `pickupAddress` from pending requests in R-PRIV-01, new 409 codes) risk breaking released apps; untested commits can reach production (TEST-10).
- **Recommended fix:** (1) Add an `x-app-version` header in the mobile API client and a server response code (e.g. 426 `APP_UPDATE_REQUIRED`) driven by a config value, plus the app-side handler — ship the app side first so the switch exists before it's needed. (2) Deploy the exact `workflow_run.head_sha`; make e2e and a "migrate empty DB + `drizzle-kit check`" job required for deploy. (3) Keep response changes additive and document removals with a deprecation window.
- **Tests needed:** A route test for the version gate; CI job assertions.

### ARCH-07: No shared, durable rate-limiting / abuse-control layer

- **Severity:** MEDIUM (systemic) · **Confidence:** High
- **Files:** `src/lib/api/ai-rate-limit.ts` (in-memory `Map`, per process), `src/lib/auth/failed-auth-store.ts` (in-memory, log-only), better-auth limiter (`storage: "memory"`, production only), `vercel.json` (`{}`), no WAF rules in the repo.
- **What is wrong:** Every limiter is per serverless instance and therefore ineffective at scale; most abuse-prone routes have none (custom auth email routes, signup, HOA inquiry, need posting, push test, SetupIntent minting, evidence uploads, dispute filing). Upload rate limiting was consciously deferred in `plans/README.md` pending an infra decision; the decision has not been made and the list of routes that need it has grown.
- **How it fails:** SEC-04 (email bombing), SEC-13 (push reflector), SEC-14 (OpenAI cost), SEC-15/PERF-02 (need spam fan-out), SEC-21 (card testing), CONC-07 (cap bypass), unlimited address changes feeding PRIV-02.
- **Recommended fix:** Pick one durable store (Upstash Redis via `@upstash/ratelimit`, or a Postgres table with a sliding window) and a single `rateLimit(key, limit, window)` helper; apply it to the routes above keyed by user id and IP; wire better-auth's `secondaryStorage` to the same store so its built-in limits become global.
- **Tests needed:** Helper unit tests; one route test per limited route asserting 429 after N calls.

### ARCH-08: Two divergent payment lifecycles

- **Severity:** LOW (systemic) · **Confidence:** High
- **Files:** `src/features/rentals/services/*` + `src/dal/rentals.dal.ts` + `src/dal/payment-lifecycle.dal.ts` vs `src/features/services/services/*` + `src/dal/service-booking.dal.ts` + `src/dal/service-payment-lifecycle.dal.ts`; `docs/payment-lifecycle-unification.md` (verdict GO-LATER).
- **What is wrong:** Rentals and service bookings implement the same money concepts (claim, charge, cancel with tiers, dispute freeze, payout) twice, with different guards and keys. Fixes land on one side: plan 009's claim guards status on services but not rentals (BIZ-01); plan 011's claim-first cancel exists for services but not rentals (CONC-02); service payout eligibility excludes `frozen`, rental eligibility doesn't (BIZ-05).
- **Recommended fix:** Until unification, require every money fix to include a "sibling check" section (the remediation plans do). Re-baseline `docs/payment-lifecycle-unification.md` after the Phase 0/1 fixes and extract shared primitives (claim, refund, transfer, freeze) into one module used by both. `rentals.dal.ts` (3,477 lines) should be split along the same seams once route-level tests exist.

### ARCH-09: Configuration hygiene

- **Severity:** LOW · **Confidence:** High
- **Files:** `process.env.*` read ad hoc across `src/` (e.g. `NEXT_PUBLIC_APP_URL` in 46 places, some with a hard-coded production fallback such as `src/features/rentals/services/cancellation-service.ts` `linkUrl`); `src/services/stripe/server.ts:9-17`; `next.config.ts` (CSP with `'unsafe-inline' 'unsafe-eval'`; unused `images.remotePatterns` hosts).
- **What is wrong:** There is no validated env schema, so missing or wrong config fails at use time. The Stripe client comment says calls use "the account's default version", but stripe-node 22.2 pins its own API version (`2026-05-27.dahlia`), so an SDK upgrade is an API-version upgrade for every charge/transfer/webhook path. Production CSP allows inline/eval scripts; unused remote image hosts leave `/_next/image` usable as a proxy for them.
- **Recommended fix:** A zod env schema loaded once at startup; correct the Stripe comment and pin `apiVersion` explicitly so upgrades are deliberate; tighten CSP when the web UI is retired; remove unused `remotePatterns`.

### ARCH-10: The retiring web UI is still deployed and still reads the DAL directly

- **Severity:** LOW · **Confidence:** High
- **Files:** `src/app/**/page.tsx` server components calling DALs (inventory in `11-attack-surface-map.md` → "Server pages and layouts that read data directly"), e.g. `/dashboard/listings/[id]/edit` (SEC-23) and the web rental detail page that renders `getRentalDetailsById` output (PRIV-01 variant).
- **What is wrong:** The web front end is being retired in favor of the mobile app, but its server pages remain deployed and bypass the API routes' authorization and response shaping. Every API-side fix (e.g. R-PRIV-01's allowlist) has to be duplicated in these pages or the web surface keeps the bug.
- **Recommended fix:** Decide the retirement date; until then, route web pages through the same response mappers (ARCH-02); afterwards remove the pages and their DAL-only code paths, shrinking the attack surface and the test burden.
