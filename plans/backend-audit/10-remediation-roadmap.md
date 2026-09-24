# Remediation roadmap

Sequenced plan for fixing the findings in this audit. The ranking comes from `09-priority-matrix.md`. Every CRITICAL/HIGH finding has an implementation-ready plan under `remediations/`. MEDIUM/LOW findings carry enough detail in their own documents ("Recommended fix", "Tests needed") to be planned when their phase starts.

**Conventions for executors.** These follow the repo's existing `plans/` workflow.

- Work directly on `develop`.
- Run `bun run type-check`, `bun run lint` and `bun run test:run`.
- Leave changes uncommitted for the maintainer to review and commit.
- Update this document's status table when a plan is done.
- Each plan has a drift check against `21bdc61`, the commit the audit was run against. Honor its STOP conditions.

**Mobile constraint.** Released mobile binaries can't be hot-fixed. Every plan has a "Mobile compatibility" section. Treat any response-shape removal or new error code as a contract change: ship it additive-first, and only after checking the app's contract in `hoador-mobile/src/api/contract/`.

---

## Phase 0 — Hotfix window (target: this week)

Goal: stop money and PII from leaking today. Everything here is P0. Most fixes are small (S) and independent, so they can land in parallel.

| #    | Plan                                                                        | Fixes                                  | Effort | Notes                                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | [R-PRIV-01](remediations/R-PRIV-01-rental-detail-contact-harvest.md)        | PRIV-01 (CRITICAL)                     | S      | Response allowlist on rental detail. Highest priority.                                                                                                                    |
| 0.2  | [R-PRIV-03](remediations/R-PRIV-03-provider-email-exposure.md)              | PRIV-03                                | S      | Drop `provider.email`.                                                                                                                                                    |
| 0.3  | [R-SEC-03](remediations/R-SEC-03-server-derived-setup-fee.md)               | SEC-03, TEST-02                        | S      | Price setup from the listing only.                                                                                                                                        |
| 0.4  | [R-SEC-02](remediations/R-SEC-02-email-change-prehijack.md)                 | SEC-02, TEST-08                        | S      | Refuse unverified email change.                                                                                                                                           |
| 0.5  | [R-SEC-01](remediations/R-SEC-01-enforce-account-status.md)                 | SEC-01, TEST-05                        | M      | Status gate in the auth helper, session revocation on suspension, onboarding CAS.                                                                                         |
| 0.6  | _(config)_                                                                  | SEC-05                                 | S      | Set `emailAndPassword.revokeSessionsOnPasswordReset: true` in `src/services/better-auth/build-auth-options.ts`. It's a one-line change plus a test, so it rides with 0.5. |
| 0.7  | [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md) | TEST-07 (enabler)                      | M      | Start immediately. The race tests in 0.8/0.9 and 1.1 need it. Their unit/SQL-render tests can land first.                                                                 |
| 0.8  | [R-BIZ-01](remediations/R-BIZ-01-approve-only-pending-requests.md)          | BIZ-01, TEST-01, CONC-03 (rental half) | M      | Approve charges only `pending`; cancel, decline and expire become CAS.                                                                                                    |
| 0.9  | [R-CONC-02](remediations/R-CONC-02-rental-cancel-claim-first.md)            | CONC-02, TEST-03                       | M      | Claim-first cancel; start/end CAS; payout skips refunded rentals.                                                                                                         |
| 0.10 | [R-BIZ-05](remediations/R-BIZ-05-dispute-resolve-via-state-route.md)        | BIZ-05, TEST-11                        | S      | Remove "Resolve" from the state route; the cron never completes a frozen/failed transfer.                                                                                 |
| 0.11 | [R-BIZ-03](remediations/R-BIZ-03-no-payout-after-dispute-refund.md)         | BIZ-03, TEST-04                        | S      | No payout re-arm after a `favor_renter` refund.                                                                                                                           |
| 0.12 | [R-BIZ-02](remediations/R-BIZ-02-block-early-service-completion.md)         | BIZ-02, TEST-04                        | S      | No completion before the service date.                                                                                                                                    |
| 0.13 | [R-BIZ-06](remediations/R-BIZ-06-chargeback-system-user-fk.md)              | BIZ-06, TEST-06                        | S      | System-user row plus alert-first. **Check production first** (see ops check 5).                                                                                           |
| 0.14 | [R-BIZ-07](remediations/R-BIZ-07-stop-charging-deleted-users.md)            | BIZ-07                                 | S      | Cancel pending outbound requests on deletion; detach cards from Stripe.                                                                                                   |

**Dependencies inside Phase 0**

- 0.9 (R-CONC-02) and 0.10 (R-BIZ-05) both edit rental payout eligibility (`findEligibleForPayout` in `src/dal/payment-lifecycle.dal.ts`) and the payout cron. Land 0.10 first (smaller), then rebase 0.9.
- 0.11 (R-BIZ-03) and 0.12 (R-BIZ-02) both edit `ServiceBookingService.completeBooking` and service payout eligibility. Land them together or back to back.
- 0.8 (R-BIZ-01) must land before 1.1 (R-CONC-01), because the overlap re-check lives in the approval claim step.
- 0.5 (R-SEC-01) introduces new 403 codes. Confirm the mobile app signs out cleanly on them (the plan's mobile section) before deploying.

### Ops checks to run now (no code)

Plans 0.8–0.14 fix the code paths but not state that is already wrong. Run these read-only queries against production (Neon console) and triage the results by hand in Stripe:

1. **Charged but not rented** (BIZ-01): rental requests with status `cancelled`/`denied` whose `payment_status` is `processing` or `succeeded`. Refund each charge in Stripe, and release any live deposit authorization.
2. **Refunded and still paid out** (CONC-02): rentals whose `payments.status = 'refunded'`, whose request status is not `cancelled`, and whose lifecycle has a `stripe_transfer_id`. Decide per case whether to reverse the transfer (`transfers.createReversal`).
3. **Paid out after a dispute refund** (BIZ-03): service bookings with a `favor_renter` dispute outcome and a service lifecycle that has a transfer id.
4. **Owners never paid** (BIZ-05, BIZ-12): rental lifecycles with `payout_status = 'completed'` but no `stripe_transfer_id` and a transfer status other than `completed`. Also approved rentals that have no lifecycle row or no payment row.
5. **Chargebacks never recorded** (BIZ-06): check whether a `user` row with `id = 'system'` exists. List `audit_logs` rows with `action = 'webhook.failed'` whose metadata `eventType` is `charge.dispute.created`, and compare against Stripe → Disputes. Resend the events once R-BIZ-06 is deployed.
6. **Captured deposits owed to owners** (BIZ-04): lifecycles with `deposit_hold_status = 'captured'`. The amount owed is the captured amount minus the platform fee, per the payments policy.
7. **Manipulated setup fees** (SEC-03): rental requests whose `setup_fee` is negative or differs from the listing's `setup_fee`.
8. **Deleted users charged** (BIZ-07): approved rentals or accepted bookings whose renter/requester has `anonymized_at` set earlier than the approval/accept time.
9. **Services paid before they happened** (BIZ-02): completed service bookings where `completed_at` is earlier than the scheduled service date.
10. **Email-change hijack exposure** (SEC-02): look for users who have both a credential account and a Google/Apple account linked, where the OAuth account was created _after_ the user row's email last changed. There is no audit trail of profile email changes, so this is a best-effort check. Add one in R-SEC-02.

Column names above are descriptive. Check each against `src/db/schemas/*.ts` before running.

---

## Phase 1 — Stabilization (target: weeks 1–3)

Goal: close the remaining HIGH findings and the MEDIUM items that are cheap, exploitable or blocking.

| #    | Item                                                                    | Fixes                                                 | Effort | Notes                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | [R-CONC-01](remediations/R-CONC-01-prevent-overlapping-approvals.md)    | CONC-01                                               | M      | Approve-time re-check under an advisory lock, plus an exclusion constraint. Run the overlap pre-check query first.                                                                                                            |
| 1.2  | [R-DB-01](remediations/R-DB-01-preserve-financial-records-on-delete.md) | DB-01                                                 | M      | Archive instead of delete; FKs to `RESTRICT`.                                                                                                                                                                                 |
| 1.3  | [R-BIZ-04](remediations/R-BIZ-04-transfer-captured-deposits.md)         | BIZ-04                                                | M      | Transfer captured deposits; backfill from ops check 6.                                                                                                                                                                        |
| 1.4  | [R-PRIV-02](remediations/R-PRIV-02-distance-oracle.md)                  | PRIV-02                                               | M      | Coarsen distances on the server.                                                                                                                                                                                              |
| 1.5  | [R-PERF-01](remediations/R-PERF-01-dashboard-summary-queries.md)        | PERF-01                                               | M      | Dashboard summary: fetch once, bounded queries.                                                                                                                                                                               |
| 1.6  | [R-PERF-02](remediations/R-PERF-02-need-notification-fanout.md)         | PERF-02, SEC-15                                       | M      | Set-based notification fan-out plus a posting throttle.                                                                                                                                                                       |
| 1.7  | Error contract                                                          | SEC-16, ARCH-05, TEST-07                              | S      | Map `(error.cause ?? error).code` in `BaseDAL.handleError`; never return DB/Stripe messages. Several plans' 409 mappings depend on this.                                                                                      |
| 1.8  | Durable rate limiting                                                   | ARCH-07, SEC-04, SEC-13, SEC-21                       | M      | Choose the store (Upstash or Postgres). Add a `rateLimit()` helper and point better-auth `secondaryStorage` at it. Apply to the auth email routes, push subscribe/test and SetupIntent minting.                               |
| 1.9  | Community isolation                                                     | SEC-08, SEC-09, BIZ-08                                | M      | Visibility writes limited to the caller's network. Project `joinCode` out of responses and send `Cache-Control: private`. Add quote/approve eligibility blockers (listing status, approval, visibility, counterparty active). |
| 1.10 | Moderation and uploads                                                  | SEC-10, SEC-11, SEC-22                                | S      | Status transitions require `approved`. `profileImageUrl` and `damagePhotos` accept only server-issued blob paths under the caller's prefix.                                                                                   |
| 1.11 | Injection and gating                                                    | SEC-12, SEC-17, SEC-06                                | S      | Escape every email interpolation and drop `decodeHtmlEntities` at write time. Gate the e2e plugin on `NODE_ENV !== 'production'`. Require superadmin to modify admins; zod-validate admin PATCH.                              |
| 1.12 | Payment-method and booking projections                                  | SEC-07, PRIV-04                                       | S      | Check ownership before `detach`; allowlist the booking list and payment-lifecycle responses.                                                                                                                                  |
| 1.13 | Telemetry PII                                                           | PRIV-06, PRIV-07                                      | S      | Remove verification URL/email logs; set Sentry `sendDefaultPii: false`, drop cookies/headers from request data, set user id only.                                                                                             |
| 1.14 | Auth hot path                                                           | PERF-03                                               | S      | Resolve the session once inside the request context; skip `/api/*` in the proxy.                                                                                                                                              |
| 1.15 | Cron reliability                                                        | PERF-05, PERF-06, CONC-10, ARCH-04 (short-term)       | S      | Independent jobs or `continue-on-error`, a `concurrency` group, `maxDuration` on cron routes, and hourly payouts as the specs say.                                                                                            |
| 1.16 | Booking hygiene                                                         | BIZ-09, BIZ-10, BIZ-12, CONC-03 (service half), DB-03 | M      | Expire and cancel `payment_failed` bookings; no approve/accept after the start time; transactional post-charge writes with alerts; CAS on service decline; per-user conversation delete.                                      |
| 1.17 | Release safety, part 1                                                  | ARCH-06, TEST-10                                      | M      | Deploy `workflow_run.head_sha`; gate deploys on e2e and a migrate-empty-DB job. Ship the mobile `x-app-version` header and a 426 handler so a server-side minimum-version switch exists before any contract removal.          |
| 1.18 | Test gaps                                                               | TEST-09, TEST-12, TEST-13, TEST-14, TEST-16           | M      | Negative/party/state tests for money routes and payment-method routes.                                                                                                                                                        |

---

## Phase 2 — Hardening (target: weeks 3–8)

| Item                                                                                                                                                               | Fixes                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Stripe↔DB reconciliation job and durable queue for fan-outs, PDFs and payout batches                                                                               | ARCH-04, BIZ-11, BIZ-13, BIZ-14 |
| Freeze-aware payout claims; dispute-aware service cancel; chargeback-after-payout handling                                                                         | CONC-04, CONC-05, BIZ-13        |
| Migration baseline: introspect prod, squash, journal or remove `0015_sturdy`, fix 0017's `when`, CI `migrate` + `drizzle-kit check`, remove the prod `push` option | DB-02                           |
| Dispute ledger enum and backfill; state-machine drift fixes                                                                                                        | DB-04, BIZ-18                   |
| Search, messaging, notification and detail-endpoint performance; missing indexes                                                                                   | PERF-04, PERF-07–PERF-10        |
| Privacy retention: private agreement blobs behind an authorized route; deletion scrub of blobs and fields; owner never sees decline reasons                        | PRIV-05, PRIV-08, PRIV-09       |
| OpenAI cost controls                                                                                                                                               | SEC-14                          |
| Admin enforcement and filter tests; `test:tz` in CI                                                                                                                | TEST-15, TEST-17, TEST-18       |
| Stripe customer/Connect get-or-create idempotency                                                                                                                  | CONC-06                         |

## Phase 3 — Structural and opportunistic

| Item                                                                                    | Fixes                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Shared transition/claim helper across all money machines; declarative transition tables | ARCH-01 (consolidates the Phase 0/1 CAS fixes)                                                    |
| Response-DTO layer on every cross-user route, plus the forbidden-keys contract test     | ARCH-02 (generalizes R-PRIV-01/R-PRIV-03)                                                         |
| Central policy module; remove misleading DAL ownership params                           | ARCH-03                                                                                           |
| Unify rental/service payment lifecycles                                                 | ARCH-08 (re-baseline `docs/payment-lifecycle-unification.md`)                                     |
| Env schema, explicit Stripe `apiVersion`, CSP and remote-image cleanup                  | ARCH-09                                                                                           |
| Retire web pages that read the DAL directly                                             | ARCH-10, SEC-23                                                                                   |
| Remaining LOW findings                                                                  | SEC-18–SEC-24, BIZ-15–BIZ-17, CONC-07–CONC-11, PERF-11–PERF-16, PRIV-10–PRIV-14, TEST-19, TEST-20 |

---

## Execution order & status (executors: update your row)

| Order | Plan                       | Priority | Effort | Depends on                                    | Status                                                                                              |
| ----- | -------------------------- | -------- | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1     | R-PRIV-01                  | P0       | S      | —                                             | DONE (2026-09-24, 53bfb56; `overdue` also unlocks addresses; own address always visible)            |
| 2     | R-PRIV-03                  | P0       | S      | —                                             | DONE (2026-09-24, 7e5ffe6; provider projection also allowlisted in the route helper)                |
| 3     | R-SEC-03                   | P0       | S      | —                                             | DONE (2026-09-24, da8c806; also touched rental-service.ts + web checkout, which forwarded setupFee) |
| 4     | R-SEC-02                   | P0       | S      | —                                             | DONE (2026-09-24, aeb9323; unused `email` const removed too)                                        |
| 5     | R-SEC-01 (+ SEC-05 config) | P0       | M      | —                                             | DONE (2026-09-24, uncommitted; SEC-05 flag set + tested end to end; 4 route tests re-mocked)        |
| 6     | R-TEST-HARNESS             | P0       | M      | —                                             | TODO                                                                                                |
| 7     | R-BIZ-05                   | P0       | S      | —                                             | TODO                                                                                                |
| 8     | R-BIZ-01                   | P0       | M      | R-TEST-HARNESS (race tests only)              | TODO                                                                                                |
| 9     | R-CONC-02                  | P0       | M      | R-BIZ-05 (shared payout code), R-TEST-HARNESS | TODO                                                                                                |
| 10    | R-BIZ-03                   | P0       | S      | —                                             | TODO                                                                                                |
| 11    | R-BIZ-02                   | P0       | S      | R-BIZ-03 (same function)                      | TODO                                                                                                |
| 12    | R-BIZ-06                   | P0       | S      | ops check 5                                   | TODO                                                                                                |
| 13    | R-BIZ-07                   | P0       | S      | —                                             | TODO                                                                                                |
| 14    | R-CONC-01                  | P1       | M      | R-BIZ-01                                      | TODO                                                                                                |
| 15    | R-DB-01                    | P1       | M      | —                                             | TODO                                                                                                |
| 16    | R-BIZ-04                   | P1       | M      | —                                             | TODO                                                                                                |
| 17    | R-PRIV-02                  | P1       | M      | —                                             | TODO                                                                                                |
| 18    | R-PERF-01                  | P1       | M      | —                                             | TODO                                                                                                |
| 19    | R-PERF-02                  | P1       | M      | —                                             | TODO                                                                                                |

Status values: TODO | IN PROGRESS | DONE | PARTIAL | BLOCKED (one-line reason) | REJECTED (one-line rationale).

## What "production-ready" means here

The backend can be called production-ready for the mobile launch once all of the following hold:

- **Phase 0 is DONE** and the ops checks have been run and triaged.
- **Phase 1 items 1.1–1.3 and 1.7–1.9 are DONE:** overlap protection, financial-record preservation, deposit transfers, the error contract, durable rate limiting and community isolation.
- **Race tests pass in CI** against a real Postgres (R-TEST-HARNESS) for approve, cancel, start/end, complete and payout.
