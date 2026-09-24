# Hoador backend production-readiness audit: executive summary

**Scope.** `hoador-web` is the Next.js API that serves both the Expo mobile app and the retiring web UI. It was audited at `develop` `21bdc61` on 2026-09-23. `hoador-mobile` was treated as an untrusted client and read only to check what the server must enforce. The audit was **read-only**: no application code was changed and no request was sent to any environment.

**Size of what was audited.**

- 162 API route files (191 route × method handlers).
- The `src/proxy.ts` middleware.
- 27 DAL files (~19.8k lines).
- ~10.3k lines of feature services and ~4.1k lines of infrastructure services (Stripe, better-auth, Resend, Blob, OpenAI, PDF).
- 49 tables (the project docs say 21) and 70 migrations.
- Crons, the Stripe webhook, and the test and CI setup.

**Method.**

1. **First pass.** Eleven independent auditors each reviewed one area: authentication and authorization, API/OWASP, business logic, Stripe/payments, database/DAL, concurrency, privacy, performance, trust boundaries, testing, and the route inventory. Every finding had to be traced from the route through to the SQL or Stripe call.
2. **Adversarial pass.** The lead auditor re-verified every CRITICAL and HIGH finding against the source. That meant reading library code where behaviour depended on it (better-auth 1.6.23, drizzle-orm 0.45.2) and checking Stripe's documentation for the one question that code could not answer.
3. **Consolidation.** The auditors reported 154 findings. Merging duplicates left 107, plus 10 systemic architecture findings from the lead auditor. Severities were challenged, and false positives were dropped.

## Verdict

**Not production-ready for money and personal data in its current state.**

Authentication plumbing, object-level authorization on individual records, webhook signatures and cron secrets are solid. The problems cluster in three places:

1. **Money state transitions.** A charge, refund or payout can run when the booking is already in the wrong state, or twice.
2. **Response shaping.** Whole database rows are returned to other users.
3. **Account lifecycle.** Suspension, email changes and deletion are either not enforced or are bypassable.

About a week of Phase 0 work (see `10-remediation-roadmap.md`) closes the exploitable and money-losing paths.

| Severity  | Count   | Notes                                                                                               |
| --------- | ------- | --------------------------------------------------------------------------------------------------- |
| CRITICAL  | 1       | PRIV-01                                                                                             |
| HIGH      | 24      | 17 defects, plus 7 test gaps that sit behind them. Each gap is remediated inside its defect's plan. |
| MEDIUM    | 58      | Includes 7 architecture findings                                                                    |
| LOW       | 34      | Includes 3 architecture findings                                                                    |
| **Total** | **117** | 19 remediation plans (18 defects + the test harness)                                                |

## The findings that matter most

| ID                    | Severity | What happens                                                                                                                                                                                                                                                                                     | Who can trigger                         |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **PRIV-01**           | CRITICAL | Rental detail returns the other party's **email and phone, and the owner's home street address**, at every status. Anyone can request a listing, read the detail and cancel, at no cost, and so harvest the contact details and address of every lister.                                         | Any verified account                    |
| **CONC-02**           | HIGH     | Approved-rental cancel issues the refund _before_ it claims the booking, and `start` isn't guarded. An owner who fires cancel and start in parallel gets the renter **fully refunded while the owner still gets paid** from platform funds. Stripe does not stop this. The attack is repeatable. | An owner plus a colluding renter        |
| **BIZ-01**            | HIGH     | An owner can **charge a renter for a request the renter already cancelled**, or that was declined or had expired. It can also happen by accident from a stale screen.                                                                                                                            | Any owner                               |
| **SEC-03**            | HIGH     | The renter's request sets the **setup fee, including negative values**. The server charges that total and pays the owner out from it.                                                                                                                                                            | Any renter                              |
| **SEC-02**            | HIGH     | `PATCH /api/profile` changes the login email without verification. Google or Apple sign-in then **links a new victim into the attacker's account**.                                                                                                                                              | Any account, against a specific victim  |
| **SEC-01**            | HIGH     | **Suspension does nothing.** Sessions stay valid, no route checks status, and `POST /api/onboarding` lets a suspended user reactivate themselves.                                                                                                                                                | Any suspended user                      |
| **BIZ-03**            | HIGH     | After a full refund in the requester's favour, the provider marks the job complete and **the payout runs anyway**.                                                                                                                                                                               | A provider (plus a colluding requester) |
| **BIZ-02**            | HIGH     | A provider can mark a job complete **before the service date**. They are paid 24h later, and the requester's dispute window is empty.                                                                                                                                                            | Any provider                            |
| **BIZ-05**            | HIGH     | The admin "Resolve" button calls the wrong endpoint. The payout cron then **records the owner as paid without paying them**, and releases the deposit without a decision.                                                                                                                        | An admin, in normal use                 |
| **BIZ-06**            | HIGH     | Chargeback webhooks insert `created_by = 'system'`, which violates a foreign key. No dispute is created, the payout is never frozen and **ops is never alerted**. This depends on production data; see ops check 5.                                                                              | Every chargeback                        |
| **BIZ-07**            | HIGH     | **Self-deleted users can still be charged.** Their pending requests stay approvable and their cards are never detached.                                                                                                                                                                          | Normal use                              |
| **BIZ-04**            | HIGH     | A **captured security deposit is never paid to the owner**, contrary to the spec. The platform keeps it.                                                                                                                                                                                         | Every damage capture                    |
| **CONC-01**           | HIGH     | Two overlapping requests can both be approved, so **one item is double-booked and both renters are charged**.                                                                                                                                                                                    | Normal owner behaviour                  |
| **DB-01**             | HIGH     | Deleting a listing **cascade-deletes completed rentals' payments, payout lifecycle and agreements**. It also lets an owner erase a rental before the renter can dispute it.                                                                                                                      | Any owner                               |
| **PRIV-02**           | HIGH     | Distances are returned unrounded. By moving their own address, a member can **trilaterate the home of every lister and need-poster**.                                                                                                                                                            | Any member                              |
| **PRIV-03**           | HIGH     | Service listing detail sends **the provider's email to every viewer**.                                                                                                                                                                                                                           | Any member                              |
| **PERF-01 / PERF-02** | HIGH     | The Home dashboard runs 33–46 queries with unbounded, repeated reads. Posting a need fans out about 4 queries per network member inside the request's instance.                                                                                                                                  | Normal use; need spam                   |

## Chained attack paths

Individually moderate findings combine into worse outcomes:

1. **Outsider harvests a whole neighbourhood** (CRITICAL impact):
   - SEC-09: any logged-in user can read every community's `joinCode`, the residency proof.
   - SEC-08: anyone can make any community visible to themselves.
   - BIZ-08: bookings don't check listing eligibility or visibility.
   - PRIV-01 and PRIV-02: then harvest contact details and home coordinates.

   The product's core promise, "neighbours only", can be bypassed end to end.

2. **Silent account capture:**
   - SEC-02: plant a verified account under the victim's email.
   - SEC-05: the attacker's sessions survive the victim's password reset.
   - SEC-01: suspending the attacker's account doesn't cut them off.
   - SEC-16: probing email addresses returns the email in the error body, which works as an existence oracle.
3. **Provider paid for work never done, and the platform absorbs it:**
   - BIZ-02: early completion empties the dispute window.
   - The requester's only recourse is a chargeback, and BIZ-06 means the chargeback never creates a dispute or alerts ops.
   - BIZ-13: nothing claws back a payout after a chargeback.
4. **Repeatable platform-funded payouts:**
   - CONC-02 or BIZ-03 produce a refunded booking.
   - Payout eligibility ignores refunds, and Stripe `source_transaction` transfers are not reduced by refunds.
   - The platform pays out from its own balance.
5. **Operational blind spots:**
   - PERF-05: payouts run daily with a hard cap of 20 per marketplace.
   - PERF-06: one failing cron step skips everything after it that day.
   - ARCH-04: there is no Stripe↔DB reconciliation.
   - Together these mean money problems surface as customer complaints, not alerts.

## What the adversarial review changed

- **Upgraded:**
  - SEC-02 (MEDIUM→HIGH). The better-auth linking path was traced, confirming account pre-hijacking.
  - SEC-03 (→HIGH). An owner glancing at the amount is not a control.
  - BIZ-05 (→HIGH). The UI exposes the broken endpoint.
  - CONC-01 (→HIGH). It needs no race.
  - DB-01 (→HIGH).
  - SEC-09 and SEC-16 (LOW→MEDIUM).
  - PRIV-01 confirmed CRITICAL. One auditor rated it MEDIUM because they didn't consider the request→read→cancel loop.
- **Downgraded:**
  - PERF-03 (HIGH→MEDIUM). The session is resolved about 3× per request, but that isn't user-visible at this scale.
  - TEST-09 and TEST-10 (HIGH→MEDIUM). A test gap is capped at the severity of the defect it would catch.
  - SEC-07 and SEC-08 settled at MEDIUM. The auditors ranged from LOW to HIGH.
  - CONC-06 → LOW.
- **Resolved with external evidence.** Stripe's Connect documentation shows that refunds don't limit later `source_transaction` transfers; the only cap is `sum(transfers) ≤ charge`. That raises confidence in BIZ-03 and CONC-02, and bounds the transfer-duplication variant of BIZ-11.
- **New during review:**
  - The chargeback `created_by='system'` FK violation (BIZ-06). Found independently by the lead and the database auditor.
  - Onboarding self-reactivation (added to SEC-01).
  - drizzle 0.45 error wrapping makes every constraint-code mapping dead code (SEC-16). This is confirmed in library source, and it also invalidates the "duplicate filing → 409" assumptions in earlier plans.
- **Rejected or verified clean** (details in each document's "Verified clean" section):
  - Account pre-hijacking via an _unverified_ local account is blocked by better-auth's `requireLocalEmailVerified`.
  - A client-supplied PaymentMethod cannot charge another customer's card; Stripe enforces customer match.
  - Agreement-PDF HTML/SSRF is not possible; every field is escaped and loaded with `setContent`.
  - No SQL injection was found.
  - The object-level authorization sweep across every ID-bearing route was clean.
  - Cron and internal secrets are compared in constant time and fail closed.
  - Uploads are re-encoded by sharp, which strips EXIF data.
  - Service accept, complete and cancel are CAS-guarded (plans 009/011).
  - Refund totals are capped by Stripe.

## Root causes (see `08-architecture-findings.md`)

| ID               | Root cause                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ARCH-01          | No shared claim/transition layer. Rentals never got the claim-first pattern that plans 009/011 gave services (ARCH-08). |
| ARCH-02          | Responses are built by spreading DB rows, with no response allowlists. The mobile contracts hid the over-exposure.      |
| ARCH-03          | Authorization and account-state policy is decentralized. DAL signatures take ownership parameters they ignore.          |
| ARCH-04, ARCH-07 | No durable jobs, no reconciliation and no durable rate limiting.                                                        |
| ARCH-05          | The error contract is broken by drizzle's error wrapping.                                                               |
| ARCH-06          | No way to force released mobile binaries to upgrade, and deploys don't pin the SHA that CI passed.                      |

## Not covered by this audit

- **Production data and configuration.** Env vars, Stripe Dashboard webhook endpoints and enabled events, Sentry scrubbing, Neon settings, and whether a `system` user exists. Ops checks in the roadmap cover the money-relevant ones.
- **Dynamic testing.** No load tests, penetration requests or live Stripe calls.
- **Mobile internals** beyond the trust boundary, device storage and deep links.
- **The web UI's client-side code**, which is being retired.
- **Dependency CVE scanning.** `bun audit` runs in CI with `|| true`, so it never fails a build.
- **Vercel and DNS infrastructure.**
- **Contract fixtures.** Whether the mobile contract fixtures were captured from staging or hand-written is unverified (`07-testing-gaps.md`).

## Document index

| File                            | Contents                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `01-security-findings.md`       | Auth, authorization, API/OWASP, trust boundaries (SEC-01…24)                                 |
| `02-business-logic-findings.md` | Rentals, services, disputes, Stripe money flows (BIZ-01…18); money-flow map                  |
| `03-database-findings.md`       | Schema, cascades, migrations (DB-01…04)                                                      |
| `04-performance-findings.md`    | Query counts, fan-outs, indexes, crons (PERF-01…16); index inventory                         |
| `05-concurrency-findings.md`    | Races, TOCTOU, idempotency (CONC-01…11)                                                      |
| `06-privacy-findings.md`        | Data exposure, logs, deletion (PRIV-01…14); data exposure matrix                             |
| `07-testing-gaps.md`            | Coverage map, untested routes, CI gating (TEST-01…20)                                        |
| `08-architecture-findings.md`   | Systemic root causes (ARCH-01…10)                                                            |
| `09-priority-matrix.md`         | All 117 findings ranked by the requested priority order                                      |
| `10-remediation-roadmap.md`     | Phases 0–3, ops data-repair checks, execution/status table                                   |
| `11-attack-surface-map.md`      | Auth mechanisms, highest-risk surfaces, client-controlled inputs, full route inventory       |
| `12-booking-state-machine.md`   | Rental, service, payment-lifecycle and dispute state machines with diagrams and drift points |
| `remediations/`                 | One implementation-ready plan per CRITICAL/HIGH finding, plus `R-TEST-HARNESS`               |
