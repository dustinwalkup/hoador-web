# Testing gaps

A coverage gap is graded no higher than the defect it would catch. The seven HIGH gaps each sit behind a verified HIGH defect; they are remediated inside that defect's plan (tests are part of every plan), with shared infrastructure in `R-TEST-HARNESS`.

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 0 · HIGH 7 · MEDIUM 11 · LOW 2.

| ID      | Severity | Confidence | Finding                                                                                                                         | Plan                                                                                                                                                                                                                   |
| ------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEST-01 | HIGH     | High       | No test proves a non-pending rental request cannot be charged; the approve claim's SQL is unpinned                              | [R-BIZ-01](remediations/R-BIZ-01-approve-only-pending-requests.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)                                                                       |
| TEST-02 | HIGH     | High       | pricing.test.ts asserts the client setupFee override as intended behaviour                                                      | [R-SEC-03](remediations/R-SEC-03-server-derived-setup-fee.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)                                                                            |
| TEST-03 | HIGH     | High       | No test proves approved-rental cancel loses to a concurrent start or second cancel without moving money                         | [R-CONC-02](remediations/R-CONC-02-rental-cancel-claim-first.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)                                                                         |
| TEST-04 | HIGH     | High       | No tests for service complete after a favor_renter refund or before the service date                                            | [R-BIZ-02](remediations/R-BIZ-02-block-early-service-completion.md), [R-BIZ-03](remediations/R-BIZ-03-no-payout-after-dispute-refund.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md) |
| TEST-05 | HIGH     | High       | No test exercises the suspended status; onboarding's unconditional re-activation is unpinned                                    | [R-SEC-01](remediations/R-SEC-01-enforce-account-status.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)                                                                              |
| TEST-06 | HIGH     | High       | The chargeback auto-dispute FK violation is hidden by a mocked DAL                                                              | [R-BIZ-06](remediations/R-BIZ-06-chargeback-system-user-fk.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)                                                                           |
| TEST-08 | HIGH     | High       | PATCH /api/profile has no tests (unverified email change, mass-assignment protection)                                           | [R-SEC-02](remediations/R-SEC-02-email-change-prehijack.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)                                                                              |
| TEST-07 | MEDIUM   | High       | DAL tests mock a pg error shape drizzle never produces; there are no real-Postgres DAL tests                                    | —                                                                                                                                                                                                                      |
| TEST-09 | MEDIUM   | High       | Service-listing moderation bypass is untested, and one test pins its first step as correct                                      | —                                                                                                                                                                                                                      |
| TEST-10 | MEDIUM   | High       | CI does not gate deploys on e2e or migrations; the production deploy builds main HEAD, not the CI-passed SHA                    | —                                                                                                                                                                                                                      |
| TEST-11 | MEDIUM   | High       | Rental payout DAL guards are unpinned; a frozen lifecycle is closed out as paid                                                 | —                                                                                                                                                                                                                      |
| TEST-12 | MEDIUM   | High       | Money-moving rental and service routes have no non-party or wrong-state negative tests; 5 service-booking route files have none | —                                                                                                                                                                                                                      |
| TEST-13 | MEDIUM   | High       | delete-payment-method IDOR and the Stripe payment-method routes are untested                                                    | —                                                                                                                                                                                                                      |
| TEST-14 | MEDIUM   | High       | Service-booking dispute refund and filing paths are untested                                                                    | —                                                                                                                                                                                                                      |
| TEST-15 | MEDIUM   | High       | Admin enforcement is untested on 21 admin handlers                                                                              | —                                                                                                                                                                                                                      |
| TEST-16 | MEDIUM   | High       | The e2e auth stub's gating is untested and weaker than documented                                                               | —                                                                                                                                                                                                                      |
| TEST-17 | MEDIUM   | High       | Tests that assert their own mocks; search approval/community filters and user-scoping WHERE clauses are unpinned                | —                                                                                                                                                                                                                      |
| TEST-18 | MEDIUM   | High       | Timezone guards pass trivially in CI because test:tz never runs                                                                 | —                                                                                                                                                                                                                      |
| TEST-19 | LOW      | High       | No tests for out-of-order or duplicate webhook events                                                                           | —                                                                                                                                                                                                                      |
| TEST-20 | LOW      | High       | Secret gates on the internal PDF routes and 5 cron routes are untested                                                          | —                                                                                                                                                                                                                      |

## Findings

### TEST-01: No test proves a non-pending rental request cannot be charged; the approve claim's SQL is unpinned

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-01
**Remediation plan:** [R-BIZ-01](remediations/R-BIZ-01-approve-only-pending-requests.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH as the coverage gap behind BIZ-01. Remediated inside R-BIZ-01, using the harness from R-TEST-HARNESS.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `rental-service.ts:389,457,482,675-686`; `dal/rentals.dal.ts:1884-1902` (WHERE is on paymentStatus only), `:1980` (status check after the charge), `:2063` (decline is read-then-write). Tests: `rental-service.approve.test.ts:164,184,217`; `rentals.dal.test.ts:2259-2306`.
- **Affected routes:** POST /api/rentals/[id]/approve
- **What is missing:** The claim tests assert `mockWhere` was called once and return canned rows. `renderWhere`, already used in the same file, is never applied to the claim. There are 3 service tests. None covers a non-pending request, a non-owner, a declined card, retry or a failure after the charge.
- **Risk left unguarded:** Decline, cancel and expire all leave `paymentStatus='pending'`. A later approve (a stale mobile screen, or the hourly expiry) wins the claim, charges the renter and then fails at `:1980`: the renter is charged and there is no rental. plans/README lists only the concurrent variant.
- **Recommended tests:**
  - DAL: `renderWhere(claim)` contains `"rental_requests"."status" = $` bound to `pending`. This is red until fixed.
  - Service: `{status:'denied', paymentStatus:'pending'}` → `chargeRentalPayment` not called.
  - Service: caller `renter-1` → Forbidden, with no claim.
  - Service: charge rejects → paymentStatus `failed` and no approve.
  - Real-DB: 2 concurrent approves → 1 charge.

### TEST-02: pricing.test.ts asserts the client setupFee override as intended behaviour

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-02
**Remediation plan:** [R-SEC-03](remediations/R-SEC-03-server-derived-setup-fee.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH (gap behind SEC-03). Remediated inside R-SEC-03: the existing assertion must be inverted, not merely supplemented.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `rentals/lib/pricing.ts:85-87` (`input.setupFee ?? listing.setupFee`); `rentals/lib/form-schema.ts:16` (`z.number().default(0)`, negatives allowed); `rentals/preview/route.ts:19`. Test: `pricing.test.ts:99` "uses input.setupFee override when provided".
- **Affected routes:** POST /api/rentals, /api/rentals/preview
- **What is missing:** No test sends a negative or mismatched fee. `.default(0)` means the listing's fee is never used. Both clients send the listing's value, so only a direct API call exploits this.
- **Risk left unguarded:** `setupRequested:true, setupFee:-140` cuts `totalAmount` and `ownerPayout`. The only guard left at approve is the $0.50 minimum.
- **Recommended tests:** Invert `pricing.test.ts:99`: the client value is ignored. `createRentalRequest` with `setupFee:-100` → the insert payload equals the listing-derived totals. The route: a negative fee → 400.

### TEST-03: No test proves approved-rental cancel loses to a concurrent start or second cancel without moving money

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-03
**Remediation plan:** [R-CONC-02](remediations/R-CONC-02-rental-cancel-claim-first.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH (gap behind CONC-02). Remediated inside R-CONC-02 with the real-DB harness from R-TEST-HARNESS.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `rentals/services/cancellation-service.ts:105-260` (refund, deposit release and transfer run before `rentalDAL.cancelApprovedRental`); `rentals.dal.ts:3451-3470` (guard untested). Test: `cancellation-service-handlers.test.ts`, which contains no owner-cancel case.
- **Affected routes:** POST /api/rentals/[id]/cancel. The route test mocks `cancelRental`.
- **What is missing:** No test shows a second caller moving no money, no test pins the order, and there is no DAL guard test. The service equivalent (plan 011) is pinned.
- **Risk left unguarded:** A concurrent renter and owner cancel, or a cancel racing start or end, refunds and transfers twice. The amounts differ, so the idempotency keys differ.
- **Recommended tests:** The conditional cancel returns 0 rows → no `processRefund` or `createOwnerTransfer`. `invocationCallOrder` shows the claim before the refund. `renderWhere` shows `status='approved'`. An owner cancel refunds 100% of the charge with no transfer.

### TEST-04: No tests for service complete after a favor_renter refund or before the service date

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-04
**Remediation plan:** [R-BIZ-02](remediations/R-BIZ-02-block-early-service-completion.md), [R-BIZ-03](remediations/R-BIZ-03-no-payout-after-dispute-refund.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH (gaps behind BIZ-02 and BIZ-03). Remediated inside R-BIZ-02 and R-BIZ-03.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `service-booking-service.ts:640-695` checks only the provider and `accepted`, then calls `updatePayoutStatus(id,'pending')`. `service-payment-lifecycle.dal.ts:211-226` has a WHERE on id only; `:396-410` `markRefundedAfterDispute` sets completed/completed; `:231-266` eligibility requires a pending payout and a transfer that is not frozen. `serviceInstant` is used only by cancel (`:738`).
- **Affected routes:** POST /api/services/bookings/[id]/complete
- **What is missing:** Only 2 complete tests (happy path and CAS loss). There is no test for a non-provider, a pending booking, a refunded lifecycle or a future `proposedDate`, and no pin on the `updatePayoutStatus` WHERE.
- **Risk left unguarded:** A client refunded in full, then a provider who completes and is paid by the payout cron: the platform pays twice. Completion before the job starts the payout window early.
- **Recommended tests:**
  - Lifecycle `{payoutStatus:'completed', ownerTransferStatus:'completed'}` → complete does not reset the payout.
  - `whereSql(updatePayoutStatus)` restricts the prior status.
  - Future `proposedDate` in the market zone → ValidationError with no CAS.
  - `prov-2` → Forbidden.
  - Real-DB: favor_renter then complete → `findEligibleForPayout` is empty.

### TEST-05: No test exercises the suspended status; onboarding's unconditional re-activation is unpinned

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-05
**Remediation plan:** [R-SEC-01](remediations/R-SEC-01-enforce-account-status.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH (gap behind SEC-01). Remediated inside R-SEC-01.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `auth/utils/session.ts:35-67` has no status check; `proxy.ts` allows suspended users through; `user.dal.ts:476-494` does not revoke sessions; `onboarding/route.ts:58-61` sets `status:'active'` for any caller. The admin UI offers Suspend.
- **Affected routes:** every authenticated route, and POST /api/onboarding
- **What is missing:** Zero tests use `status:"suspended"`, and onboarding has no route test.
- **Risk left unguarded:** Suspension does nothing, and a suspended user can re-activate themselves.
- **Recommended tests:**
  - `route-helpers.test`: a suspended user → 403.
  - `proxy.test`: a suspended user on /api/rentals → 403.
  - Onboarding: status suspended or email_verified → 403/409 and no `status:'active'` write.
  - e2e: suspend `active@e2e.test` → the old cookie gets 403 on /api/profile.

### TEST-06: The chargeback auto-dispute FK violation is hidden by a mocked DAL

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-06
**Remediation plan:** [R-BIZ-06](remediations/R-BIZ-06-chargeback-system-user-fk.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH (gap behind BIZ-06). Remediated inside R-BIZ-06; needs a real-DB insert test (R-TEST-HARNESS).

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `services/stripe/chargeback-service.ts:35-223` (both branches call `disputeDAL.create({createdBy:"system"})`); `disputes.schema.ts:42-44` (NOT NULL, references `user.id`). Test: `chargeback-service.test.ts:33` (`create: vi.fn()`); 37.2 (`:118`) pins `createdBy:"system"`.
- **Affected routes:** POST /api/stripe/webhooks (charge.dispute.created)
- **Risk left unguarded:** 23503 → the webhook returns 500 → Stripe retries until it gives up. `freezeForDispute` runs after the insert, so the payout of money being clawed back is never frozen.
- **Recommended tests:** A real-DB `disputeDAL.create({createdBy:'system'})` must succeed or be rejected by design. A webhook test: no existing dispute → 200, a dispute row, lifecycle frozen. Change 37.2 to assert a valid actor.

### TEST-08: PATCH /api/profile has no tests (unverified email change, mass-assignment protection)

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** TEST-08
**Remediation plan:** [R-SEC-02](remediations/R-SEC-02-email-change-prehijack.md) + [R-TEST-HARNESS](remediations/R-TEST-HARNESS-real-postgres-test-harness.md)

> **Adversarial review (lead auditor):** Kept HIGH (gap behind SEC-02). Remediated inside R-SEC-02.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `users/lib/profile.schema.ts` (`updateProfileApiSchema.email`); `profile/route.ts:67-86`; `user.dal.ts:216-219` spreads the input into `.set()` and never touches `emailVerified`. The route test covers only GET.
- **Risk left unguarded:** A new address still counts as verified; better-auth trusts google and apple for linking; and a stolen session can take the account permanently. Zod key-stripping is the only mass-assignment barrier, and nothing pins it.
- **Recommended tests:** `{email}` → 400, or a verification flow with `emailVerified:false`, and no email write. `{userType:'admin', status, stripeConnectedAccountId, emailVerified}` → `updateUser` receives none of those keys.

### TEST-07: DAL tests mock a pg error shape drizzle never produces; there are no real-Postgres DAL tests

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-07

> **Adversarial review (lead auditor):** Kept MEDIUM. Root of why SEC-16 shipped. The real-Postgres harness is R-TEST-HARNESS.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `dal/base.ts:21,46`, `blind-review.dal.ts:71` and `neighborhood-needs.dal.ts:682` read `error.code`. drizzle 0.45.2 `pg-core/session.js:41-66` wraps driver errors in `DrizzleQueryError`, with `code` on `.cause`. Tests `blind-review.dal.test.ts:68` and `neighborhood-needs.dal.test.ts:566` throw a top-level `code:"23505"`.
- **Risk left unguarded:** Duplicates return 500 instead of 409, and the `linkListingToNeed` conflict-swallow re-throws. All constraint errors (TEST-06) stay invisible to the suite.
- **Recommended tests:** `handleError(new DrizzleQueryError(q,[],{code:'23505'}))` → ConflictError. Switch the fixtures to the wrapped shape. Add a real-Postgres DAL harness using the e2e DB (`db-e2e.ts`) for constraint tests and 2-caller CAS tests.

### TEST-09: Service-listing moderation bypass is untested, and one test pins its first step as correct

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-09

> **Adversarial review (lead auditor):** Downgraded HIGH→MEDIUM: a coverage gap is capped at the severity of the defect it would catch (SEC-10 is MEDIUM).

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `service-listing-service.ts:353-373` (no status guard), `:378-404` (inactive → active). Test: `features/services/__tests__/service-listing-service.test.ts:368` deactivates the `pending_approval` fixture (`:90`). Reactivate has no test.
- **Risk left unguarded:** A pending or denied listing goes live without review, in 2 API calls.
- **Recommended tests:** Deactivating a pending_approval or denied listing → ValidationError. Reactivate only from inactive, and only if the listing was previously approved. Add route tests for both.

### TEST-10: CI does not gate deploys on e2e or migrations; the production deploy builds main HEAD, not the CI-passed SHA

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-10

> **Adversarial review (lead auditor):** Downgraded HIGH→MEDIUM after verification: `.github/workflows/deploy.yml` is triggered by `workflow_run` and checks out without `ref` (line 49), so it deploys main HEAD rather than `workflow_run.head_sha`; `workflow_dispatch` skips CI; e2e and migrations never gate a deploy. A release-integrity weakness rather than an exploitable defect; tracked as ARCH-06 in the roadmap.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** the workflows above; `playwright.config.ts:49-70`; `vitest.config.mjs:53,78`.
- **Risk left unguarded:** Regressions that e2e or migrations would catch ship to production (see CI gating analysis).
- **Recommended tests:**
  - Make e2e a `needs:` of both deploys.
  - Run pr-checks on main PRs, with lint and type-check.
  - Check out `workflow_run.head_sha` in `deploy.yml`.
  - Run `drizzle-kit migrate` on an empty Postgres, then `check`.
  - Add a `needs` project to Playwright.
  - Measure `src/app/api/**` and set thresholds.

### TEST-11: Rental payout DAL guards are unpinned; a frozen lifecycle is closed out as paid

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-11

> **Adversarial review (lead auditor):** Kept MEDIUM (gap behind BIZ-05; fixed inside R-BIZ-05).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `payment-lifecycle.dal.ts:246-266` (claim), `:358-411` (eligibility), `:546-609` (freeze and unfreeze): all untested. `payment-lifecycle-service.ts:97-177` transfers only when the status is `pending`, yet releases the deposit and marks `completed` for a frozen transfer.
- **Recommended tests:** `whereSql` pins: claim `payout_status='pending'`, eligibility open-dispute join, unfreeze `frozen`. processPayouts on a frozen lifecycle → no release and no completed status.

### TEST-12: Money-moving rental and service routes have no non-party or wrong-state negative tests; 5 service-booking route files have none

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-12

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:**
  - `rentals/[id]/end/__tests__/route.test.ts`: no 401, 403 or 404 tests, although the owner check is in the route at `end/route.ts:106`.
  - start, decline and instructions: untested.
  - Service complete and decline: no non-provider test; no decline-of-accepted test (`:611`).
  - The 5 services/bookings/[id] route files: no tests.
- **Risk left unguarded:** If these regressed, a stranger could end a rental (releasing the deposit) or decline a charged booking without a refund.
- **Recommended tests:** Per route: a stranger → 403 with no mutation; a wrong status → 400/409. Use the mocked-session pattern.

### TEST-13: delete-payment-method IDOR and the Stripe payment-method routes are untested

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-13

> **Adversarial review (lead auditor):** Kept MEDIUM (gap behind SEC-07).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `stripe/delete-payment-method/route.ts:32` → `services/stripe/payment-method.ts:160-164` with no ownership check. None of the Stripe payment-method routes has a test.
- **Recommended tests:** PM customer ≠ caller's `stripeCustomerId` → 403 and no `detach`.

### TEST-14: Service-booking dispute refund and filing paths are untested

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-14

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `dispute-resolution-service.ts:282-437` and `:444-511` (refund, cap, payout reduction); `dispute-creation-service.ts:291-420` (party check, freeze). No service-booking test cases.
- **Recommended tests:** favor_renter → full refund, key `service-refund-{id}`, `markRefundedAfterDispute`. Partial above `providerPayout` → ValidationError. Partial $30 → 3000 cents and the payout reduced by 30. A refund failure → not resolved. A stranger filing → Forbidden with no freeze.

### TEST-15: Admin enforcement is untested on 21 admin handlers

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-15

> **Adversarial review (lead auditor):** Kept MEDIUM (gap behind SEC-06).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `admin/users/[userId]/route.ts:90-122` has no Zod and checks only elevation, so an admin can demote a superadmin. Also untested: bulk-actions; `release-deposit` and `reset-transfer-status` (no 401/403); the legal-document download, which has no guard; reject routes and metrics.
- **Recommended tests:** Apply the real-guard pattern of `admin/networks` to each. An admin setting a superadmin to `user` → 403.

### TEST-16: The e2e auth stub's gating is untested and weaker than documented

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-16

> **Adversarial review (lead auditor):** Kept MEDIUM (gap behind SEC-17).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `better-auth/build-auth-options.ts:239` registers `e2eGoogleCallbackPlugin` unconditionally. `e2e-google-plugin.ts:28` checks only `E2E_TEST` and logs in, or creates, any `e2e_user`. `/api/test/*` and `auth/[...all]/route.ts:15-19` also check `NODE_ENV`. `vitest.config.mjs:81` excludes the plugin from coverage.
- **Recommended tests:** With `NODE_ENV=production` and `E2E_TEST=1`, `/api/auth/e2e-callback` and each `/api/test/*` → 404, and the plugin is not registered.

### TEST-17: Tests that assert their own mocks; search approval/community filters and user-scoping WHERE clauses are unpinned

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-17

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:**
  - `listings/__tests__/integration/approval-visibility.test.ts` calls the mocked `searchListings`; the real filters at `listing.dal.ts:767-780` are unpinned.
  - `auth/__tests__/e2e/unauthorized-access-workflow.test.ts:66-90` asserts its own mocks.
  - `webhook-handlers-chargeback.test.ts:113` "idempotent" asserts 2 calls.
  - `services-phase1-schema.test.ts:15-21` checks only that a default is `toBeDefined`.
  - `failed-auth-store` is unused.
  - The scoping WHEREs for payment history and the dispute list are unpinned.
- **Recommended tests:** `whereSql` pins for `approval_status='approved'`, `community_id in` and `payer_id=$`. Delete the tautologies.

### TEST-18: Timezone guards pass trivially in CI because test:tz never runs

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TEST-18

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `build-schedule.test.ts:56` claims "CI runs it" about `test:tz` (`package.json:14`); no workflow does. `availability/__tests__/route.test.ts:117` says "non-UTC server" but runs in UTC.
- **Recommended tests:** CI steps with `TZ=Pacific/Kiritimati` and `TZ=America/Chicago` over schedule, availability, rentals/[id] and service cancellation.

### TEST-19: No tests for out-of-order or duplicate webhook events

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** TEST-19

> **Adversarial review (lead auditor):** Kept LOW (gap behind BIZ-14).

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `webhook-handlers.ts:177-203` turns a `succeeded` payment into `failed` and notifies the payer. There is no event-id dedupe. Chargeback closed and updated are untested.
- **Recommended tests:** `payment_failed` after `succeeded` → no change. The same event id twice → processed once.

### TEST-20: Secret gates on the internal PDF routes and 5 cron routes are untested

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** TEST-20

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `internal/generate-{rental,service}-agreement/route.ts:21-38` (inline checks); release-reviews, rental-reminders, cleanup-notifications, cleanup-cron-history, detect-stale-service-processing (these use the tested `verifyCronSecret`).
- **Recommended tests:** Missing or wrong bearer → 401; placeholder secret → 500. Use the process-payouts cron test as the template.

## Test architecture summary (testing auditor)

**20 findings: 9 HIGH, 9 MEDIUM, 2 LOW.** I verified all 9 coordinator-listed defects in the code and their tests (TEST-01…08). Each one is live in code that has tests, which pass because they mock the layer that contains the bug or because they pin the buggy behaviour.

Test architecture in 5 lines:

1. There are 379 vitest files. About 149 test web UI that is being retired. There are 80 route test files, 21 DAL test files and about 38 service test files.
2. Every DAL test mocks `db`. No DAL, constraint or concurrency test runs against a real Postgres. Stripe only appears as `vi.mock("@/services/stripe/server")`.
3. Route tests mostly mock the DAL and service, so an authz check that lives in a lower layer is covered only if that layer has its own test. 30 route test files still mock `route-helpers` wholesale; `plans/README` lists only 2.
4. 85 of 162 route files are imported by some test. 77 are imported by none.
5. Playwright runs 20 specs against `next dev` on a `db push` Postgres. None of them charges, refunds or pays out. E2E never gates a deploy.

`src/app/**/*.ts` is excluded from coverage, so route coverage is never measured.

## Coverage map

| Behavior                                 | Risk  | Covered by (file::test)                                                                                                                                                                                                                                                                                                                              | Gap                                                                                                                  |
| ---------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 401                                      | authz | `proxy.test.ts`::"401s (not redirects) for %s"; `route-helpers.test.ts` 401; e2e `mobile-cookie-transport.spec.ts`                                                                                                                                                                                                                                   | stripe/_, (payments)/_, onboarding, reviews and services/bookings are not proxy-protected and have no route 401 test |
| Non-party 403/404                        | authz | Real check runs in: `rentals/[id]`::"403s a non-party…", `damage-photos`::"403s the renter…", both cancellation-previews, `services/bookings/[id]`::"403s a non-party", listing images/availability::"403s a non-owner…", disputes (plan 015), `messages.dal`::"throws ForbiddenError for a non-participant", needs/listing/service-listing services | approve, end, start, decline, instructions; service complete, decline, cancel; payment-lifecycle (TEST-12)           |
| Admin-only                               | authz | 16 handlers, e.g. `admin/networks`::"returns 403 (via the real guard)…", `admin/payments/__tests__/*`::"returns 403 when non-admin"                                                                                                                                                                                                                  | 21 handlers (TEST-15)                                                                                                |
| Cron secret                              | ops   | `verify-cron-secret.test.ts`, 8 route tests, e2e `uat-api-cron.spec.ts`                                                                                                                                                                                                                                                                              | 5 routes (TEST-20)                                                                                                   |
| /api/internal, /api/test, E2E stub       | authz | none                                                                                                                                                                                                                                                                                                                                                 | TEST-16, TEST-20                                                                                                     |
| Webhook signature                        | money | `webhooks/__tests__/route.test.ts`::"returns 400 on signature verification failure…", "…signature is missing"                                                                                                                                                                                                                                        | OK (SDK mocked)                                                                                                      |
| Webhook replay                           | money | `webhook-handlers.test.ts`::"is idempotent — no-op if already succeeded"                                                                                                                                                                                                                                                                             | No event-id dedupe and no out-of-order test (TEST-19)                                                                |
| Rental approve charge                    | money | `rental-service.approve.test.ts` (3 tests)                                                                                                                                                                                                                                                                                                           | TEST-01                                                                                                              |
| Deposit hold place/release/capture/retry | money | `payment-lifecycle-service.test.ts` (incl. "returns error when user is not the renter"), `dispute-financial.test.ts`                                                                                                                                                                                                                                 | Approve-time 48h boundary                                                                                            |
| Cancellation refunds                     | money | `cancellation-service.test.ts` (incl. "exactly 24h boundary"); `booking-cancellation.test.ts`                                                                                                                                                                                                                                                        | Owner-cancel handler; CAS (TEST-03)                                                                                  |
| Payouts                                  | money | `payment-lifecycle-service.test`::processPayouts; service lifecycle (plan 012)                                                                                                                                                                                                                                                                       | Rental DAL guards (TEST-11)                                                                                          |
| Service accept/complete/cancel           | money | accept (20 tests incl. claim); cancel::"claims the cancellation before any money moves"                                                                                                                                                                                                                                                              | complete (TEST-04)                                                                                                   |
| Dispute resolution                       | money | `dispute-resolution-service.test.ts` 35.1–35.7 (rental only)                                                                                                                                                                                                                                                                                         | TEST-14                                                                                                              |
| Chargebacks                              | money | `chargeback-service.test.ts` 37.x (DAL mocked)                                                                                                                                                                                                                                                                                                       | TEST-06                                                                                                              |
| Concurrency                              | money | `service-booking.dal.test`::"claimForAcceptance…" (WHERE rendered)                                                                                                                                                                                                                                                                                   | Rental approve, cancel and payout; no real-DB race test anywhere                                                     |
| Mass assignment                          | authz | Zod 400s in the evidence, photos and cancel routes                                                                                                                                                                                                                                                                                                   | TEST-08                                                                                                              |
| Uploads                                  | abuse | `lib/image/__tests__/server.test.ts` (type, size, magic bytes); `damage-photos`::"rejects a file the image validator refuses"                                                                                                                                                                                                                        | Other routes mock the validator; legal PDFs have no magic-byte check                                                 |
| Rate limits                              | abuse | `ai-rate-limit.test.ts`, forgot-password "returns 429…", dispute 34.5                                                                                                                                                                                                                                                                                | better-auth in-memory limiter untested; `failed-auth-store` tested but unused                                        |
| Account status                           | authz | none                                                                                                                                                                                                                                                                                                                                                 | TEST-05                                                                                                              |
| TZ                                       | money | `build-schedule.test.ts`                                                                                                                                                                                                                                                                                                                             | Vacuous in CI (TEST-18)                                                                                              |

## Untested routes ranked by risk

| #   | Route(s)                                                                            | Class         | Elsewhere                                            | Note                       |
| --- | ----------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------- | -------------------------- |
| 1   | POST /api/rentals                                                                   | money         | service tests, plus a pricing test that pins the bug | TEST-02                    |
| 2   | POST services/bookings/[id]/complete                                                | money         | partial service tests                                | TEST-04                    |
| 3   | DELETE stripe/delete-payment-method                                                 | money/authz   | none                                                 | TEST-13                    |
| 4   | POST services/bookings/[id]/cancel, /decline                                        | money         | service tier tests                                   | TEST-12                    |
| 5   | admin/users/[userId], bulk-actions, users                                           | authz/PII     | none                                                 | TEST-15                    |
| 6   | services/listings/[id]/deactivate, /reactivate                                      | authz         | test pins the bug                                    | TEST-09                    |
| 7   | POST /api/onboarding                                                                | authz         | e2e happy path                                       | TEST-05                    |
| 8   | rentals/[id]/start, /decline, /instructions                                         | authz/state   | DAL status tests                                     | Route owner check untested |
| 9   | services/bookings/[id]/accept; rentals/[id]/retry-deposit                           | money         | service well tested                                  | Wiring only                |
| 10  | stripe attach/set-default/portal/login-link/update-onboarding-status; (payments)/\* | money         | none                                                 | Session-derived            |
| 11  | services/bookings/[id]/payment-lifecycle                                            | financial PII | none                                                 | Route party check          |
| 12  | auth/[...all] E2E branch; /api/test/\* (5)                                          | authz         | e2e uses them                                        | TEST-16                    |
| 13  | internal/generate-\*-agreement                                                      | PII           | none                                                 | TEST-20                    |
| 14  | 15 admin read/reject/legal-doc routes (download has no guard)                       | admin/PII     | none                                                 | TEST-15                    |
| 15  | rentals lending/renting (6), services/bookings GET, listings/my                     | PII           | proxy 401 only                                       | Scoping WHERE unpinned     |
| 16  | 5 crons; auth signup/reset/join/resend/legal                                        | ops/auth      | helper unit tests / e2e                              | Low                        |
| 17  | reviews, garage (6), notifications (3), unread-count, badges, push/test             | low           | services tested                                      | Shapes unpinned            |

## CI gating analysis

- **PRs:** `pr-checks.yml` runs only on `pull_request: [develop]`: PR size, `test:coverage` and `build`. There is no lint or type-check step beyond `next build`.
- Develop is committed to directly: the first-parent log 7f49271…21bdc61 has no merges. Promotion is via develop→main PRs, which trigger neither pr-checks nor preview.
- **Push:** `ci.yml` runs type-check, lint, format, tests and build. `bun audit || true` never fails. There are no coverage thresholds (`vitest.config.mjs:53` is commented out) and Codecov never fails the build.
- **E2E:** runs on push only, against `next dev`. Neither deploy depends on it, so **failing e2e never blocks staging or production**, and it never runs on PRs.
- `e2e/needs/needs.spec.ts` matches no project in `playwright.config.ts:49-70`, so the only e2e community-isolation negatives never run.
- **Deploys:** `deploy.yml:49` checks out without `ref`, so it deploys main HEAD, not the SHA that CI passed. `deploy-staging.yml:60` gets this right. `workflow_dispatch` skips CI in both.
- **Migrations:** 70 SQL files are applied only by manual `database.yml`. E2E uses `db push` (`scripts/e2e-setup.ts`), so migrations are never applied or diffed in CI.
- `test:tz` runs in no workflow. In e2e, cron and webhook coverage is 401s plus one empty-DB 200.

**E2E specs (20):**

- auth (14): admin-verification-queue, community-select, google-oauth, invalid-tokens, join-code-legacy, login, logout, mobile-cookie-transport, password-reset, profile-update, protected-route, signup-funnel, status-redirect, visibility-settings.
- listings-ai (2): ai-flow and recovery. OpenAI and uploads are stubbed.
- needs (1): never runs.
- payments (1): stripe-connect-gating. State is faked via `/api/test/set-stripe-connect-state`; there are no Stripe calls.
- services (2): uat-api-cron and uat-smoke.
- The seed has no rentals or bookings.

## Verified clean (testing auditor)

- Service accept (claim, retry key, F12 card guard, Connect gating).
- Service cancel (tiers, claim order).
- Service payouts and lifecycle (plan 012).
- Dispute routes (plan 015: real helpers and the real state machine).
- Rental deposit lifecycle, including retry by a non-renter.
- Refund calculators, including the 24h boundary.
- Stripe wrappers' amounts and idempotency keys (`refund.test.ts`, `payout.test.ts`).
- Webhook signature path.
- Auth helpers and proxy 401 behaviour.
- Messages participant guards in the DAL.
- Image validation.
- Ownership in the needs, listing and service-listing services.
- rentals/[id] GET party check.
- Mobile cookie transport.

## Auditor open questions — testing

1. Mobile ↔ server contract drift. The mobile sub-agent was interrupted, so this is unverified: I did not establish whether the `hoador-mobile` MSW fixtures were captured from staging or written by hand. On the server, no test pins the response shapes mobile depends on beyond a few serialization tests. `/api/dashboard/badges` returns a nested `PaginatedResult` and has no test. A schema-parity test using mobile's zod schemas would close this.
2. Branch protection and required checks. I could not query GitHub.
3. Is `E2E_TEST` set in any Vercel environment?
4. Are the repo-level `STRIPE_SECRET_KEY` and `DATABASE_URL` used by the CI builds test-mode and non-production?
5. Is better-auth's default in-memory rate limiter acceptable on serverless?
