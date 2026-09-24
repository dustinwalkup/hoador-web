# Security findings: authentication, authorization, API/OWASP, trust boundaries

Covers authentication and account lifecycle, admin and object-level authorization, OWASP-class API issues (mass assignment, injection, SSRF, uploads, error leakage, abuse/rate limiting), and web/mobile trust boundaries. Payment-flow correctness lives in `02-business-logic-findings.md`; data exposure lives in `06-privacy-findings.md`.

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 0 · HIGH 3 · MEDIUM 14 · LOW 7.

| ID     | Severity | Confidence | Finding                                                                                                                                                             | Plan                                                          |
| ------ | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| SEC-01 | HIGH     | High       | Suspended and inactive accounts keep full API and money access; suspension never revokes sessions; POST /api/onboarding lets a suspended user reactivate themselves | [R-SEC-01](remediations/R-SEC-01-enforce-account-status.md)   |
| SEC-02 | HIGH     | High       | PATCH /api/profile changes the login email without re-verification, enabling Google/Apple account pre-hijacking                                                     | [R-SEC-02](remediations/R-SEC-02-email-change-prehijack.md)   |
| SEC-03 | HIGH     | High       | The renter-supplied setupFee (unbounded, may be negative) overrides the listing's fee and sets the charged total, platform fee and owner payout                     | [R-SEC-03](remediations/R-SEC-03-server-derived-setup-fee.md) |
| SEC-04 | MEDIUM   | High       | Custom auth routes (signup, forgot-password, resend-verification, reset) bypass better-auth's rate limiter; the built-in limiter is per-instance memory             | —                                                             |
| SEC-05 | MEDIUM   | High       | Password reset and change do not revoke existing sessions                                                                                                           | —                                                             |
| SEC-06 | MEDIUM   | High       | Any admin can demote admins and superadmins and change their status; admin user PATCH is not schema-validated                                                       | —                                                             |
| SEC-07 | MEDIUM   | High       | Any user can detach any Stripe PaymentMethod, and the provider booking list leaks requesters' PaymentMethod ids                                                     | —                                                             |
| SEC-08 | MEDIUM   | High       | PATCH /api/users/me/visibility accepts any communityId, so a user can make any community's listings, services and needs visible to themselves                       | —                                                             |
| SEC-09 | MEDIUM   | High       | GET /api/communities (and /api/users/me/visibility) return every community's joinCode, the residency proof, to any logged-in user                                   | —                                                             |
| SEC-10 | MEDIUM   | High       | Owners and providers can publish unmoderated or rejected listings (rental status self-service; service deactivate→reactivate)                                       | —                                                             |
| SEC-11 | MEDIUM   | High       | profileImageUrl is client-settable, which bypasses plan 010's profile-image ownership fix and lets anyone delete other users' avatar blobs                          | —                                                             |
| SEC-12 | MEDIUM   | High       | User content is interpolated into email HTML unescaped, and the storage sanitizer decodes entities back into live markup                                            | —                                                             |
| SEC-13 | MEDIUM   | High       | Web-push endpoints accept any string and subscriptions are unbounded, so /api/push/test amplifies outbound HTTPS requests                                           | —                                                             |
| SEC-14 | MEDIUM   | Medium     | POST /api/listings/analyze-image has no image cap, refunds failed calls and limits per process, amplifying OpenAI cost                                              | —                                                             |
| SEC-15 | MEDIUM   | High       | Posting a neighborhood need notifies the whole community/network with no throttle                                                                                   | —                                                             |
| SEC-16 | MEDIUM   | High       | drizzle-orm 0.45 wraps every DB error, so all 23505/23503/23514 mappings are dead and the full SQL plus bound parameters are returned to clients                    | —                                                             |
| SEC-17 | MEDIUM   | High       | The e2e 'sign in as any email' better-auth endpoint ships in every build and is guarded only by E2E_TEST (no NODE_ENV check)                                        | —                                                             |
| SEC-18 | LOW      | High       | Open unverified email/password signup allows account squatting and Google-sign-in lockout for a targeted email                                                      | —                                                             |
| SEC-19 | LOW      | High       | PUT /api/disputes/[id]/notes updates the note before checking it belongs to the dispute (admin-only)                                                                | —                                                             |
| SEC-20 | LOW      | High       | HOA inquiries are appended to Google Sheets with USER_ENTERED (formula injection, unauthenticated)                                                                  | —                                                             |
| SEC-21 | LOW      | High       | SetupIntent / ephemeral-key minting is unthrottled (card-testing surface)                                                                                           | —                                                             |
| SEC-22 | LOW      | High       | Rental end accepts arbitrary external damagePhotos URLs                                                                                                             | —                                                             |
| SEC-23 | LOW      | High       | The web /dashboard/listings/[id]/edit page renders any listing without an ownership check                                                                           | —                                                             |
| SEC-24 | LOW      | High       | Admin-namespace legal-document download route has no auth check                                                                                                     | —                                                             |

## Findings

### SEC-01: Suspended and inactive accounts keep full API and money access; suspension never revokes sessions; POST /api/onboarding lets a suspended user reactivate themselves

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** AUTH-01, SURF-09
**Remediation plan:** [R-SEC-01](remediations/R-SEC-01-enforce-account-status.md)

> **Adversarial review (lead auditor):** Verified independently: `requireActiveUser` / `requireVerifiedUser` have zero callers; no route, service or DAL checks `suspended`/`inactive`; `UserDAL.adminUpdateUser` (`src/dal/user.dal.ts:476-494`) never deletes sessions; `src/proxy.ts` falls through to allow for these statuses. Additional evidence found during review: `POST /api/onboarding` unconditionally writes `status: "active"` (`src/app/api/onboarding/route.ts:56-61`), so even after the auth helper is fixed a suspended user could reactivate themselves - the remediation must cover that route.

- _Auditor's original grading:_ HIGH | **Confidence:** High (traced end-to-end; no mitigating layer for API routes; sessions confirmed not revoked on suspension and auto-refresh)
- **Files:** `src/features/auth/utils/session.ts:35-67` (`getCurrentUser` — loads row, no status check), `src/features/auth/utils/session.ts:120-132` (`getAuthenticatedUser` — returns `{user,userId,isAdmin}`, no status check), `src/lib/api/route-helpers.ts:392-408` (`getAuthenticatedUserResponse` — 401 only on missing session), `src/proxy.ts:218-300` (status branches: only `pending_verification`/`email_verified`/`incomplete_profile`; no `suspended`/`inactive`/`anonymizedAt` branch), `src/features/auth/utils/guards.ts:6-12` (`requireActiveUser` — the only status gate, and it is unused), `src/dal/user.dal.ts:476-494` (`adminUpdateUser` — writes status, no session revocation), `src/services/better-auth/build-auth-options.ts:88-307` (no `session` config → default `expiresIn` 7d, `updateAge` 1d auto-refresh; `create-context.mjs:145-149`)
- **Affected routes:** every self-authenticating money/marketplace route, e.g. `POST /api/rentals`, `POST /api/rentals/[id]/approve`, `POST /api/services/bookings`, `POST /api/services/bookings/[id]/accept`, `POST /api/disputes`, `POST /api/messages/conversations`, `PATCH /api/profile`, `POST /api/listings`.
- **Relevant code:**

```ts
// src/features/auth/utils/session.ts:120
export async function getAuthenticatedUser(): Promise<{
  user;
  userId;
  isAdmin;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.userType === "admin" || user.userType === "superadmin";
  return { user, userId: user.id, isAdmin }; // no user.status gate
}
// src/features/auth/utils/guards.ts:6  (defined, but grep shows ZERO callers)
export const requireActiveUser = async () => {
  const user = await requireAuth();
  if (user.status !== "active")
    throw new Error(`User status is ${user.status}, active status required`);
  return user;
};
// src/dal/user.dal.ts:481 (adminUpdateUser) — sets status, no deleteUserSessions
if (updates.status !== undefined) {
  await this.updateUserStatus(userId, updates.status);
}
```

- **What is wrong:** Statuses `suspended` (admin action) and `inactive` (admin deactivation) are enforced **only by the untrusted clients** (mobile Req 3.5.3: the app signs the user out). The server's API auth chain (`getAuthenticatedUserResponse`/`getCurrentUser`) checks that a session exists and loads the row, but never inspects `user.status`. `proxy.ts` has no branch for these statuses (and self-authenticating API routes skip the proxy anyway). Admin suspension via `PATCH /api/admin/users/[userId]` / `bulk-actions` calls `adminUpdateUser` which flips the column but does **not** delete the user's `session` rows, and better-auth is configured with no `session` block so the default 7-day session auto-refreshes on use (`updateAge` 1d) — effectively never expiring for an active bad actor.
- **Exploit / failure scenario:** (1) Admin suspends a fraudulent user for chargebacks. (2) The user's app signs itself out, but the attacker keeps the session cookie (mobile sends it manually as a `Cookie:` header — `hoador-mobile/src/api/client.ts`). (3) The attacker continues to call every marketplace/money route directly: request rentals, get bookings accepted and charged, receive payouts, message neighbors, file disputes — indefinitely, because the session refreshes on each call. Suspension is a no-op against anyone who ignores the client-side sign-out.
- **Mitigating layers checked:** proxy.ts (no suspended/inactive branch); route helpers (none check status); `requireActiveUser` exists but is called by zero routes/pages; self-deletion (`AccountDeletionDAL.anonymizeUser`, `account-deletion.dal.ts:330`) DOES `tx.delete(session)`, so anonymized accounts cannot reuse old sessions — that path is fine; admin suspension has no equivalent.
- **Real-world impact:** An admin's primary abuse control (suspend/deactivate) does not actually cut off the account's API access or money movement. Directly contradicts mobile Req 3.5.3 ("SHALL NOT allow marketplace actions").
- **Recommended fix:** Enforce status in the shared API auth helper: in `getAuthenticatedUser`/`getAuthenticatedUserResponse`, reject `suspended`/`inactive`/`anonymizedAt != null` with 403 (allow the narrow read paths a suspended user legitimately needs, e.g. account/appeal). And on `adminUpdateUser`, when transitioning to `suspended`/`inactive`, delete the user's sessions (`internalAdapter.deleteUserSessions(userId)` or a direct `session` delete) so revocation is immediate.
- **Tests needed:** suspended user with a valid session → 403 on `POST /api/rentals`, `/services/bookings/[id]/accept`, `/messages/...`, `/disputes`; admin suspend → subsequent request with the pre-suspension cookie is rejected; anonymized user path already covered.
- **Related:** chains with SEC-05 (reset doesn't revoke sessions) and SEC-02 (email change) into full account capture.

### SEC-02: PATCH /api/profile changes the login email without re-verification, enabling Google/Apple account pre-hijacking

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** API-02, AUTH-04, SURF-03
**Remediation plan:** [R-SEC-02](remediations/R-SEC-02-email-change-prehijack.md)

> **Adversarial review (lead auditor):** Upgraded from the auth auditor's MEDIUM after tracing better-auth 1.6.23 myself: `handleOAuthUserInfo` (`node_modules/better-auth/dist/oauth2/link-account.mjs:11-50`) looks the user up by email and, for a trusted provider (google/apple are in `trustedProviders`), links whenever the _local_ `emailVerified` is true - which it still is after the unverified PATCH. `applyUpdateUserInfoOnLink` then copies the victim's Google name and photo onto the attacker's account (`updateUserInfoOnLink: true`), and the attacker's password credential and sessions remain valid (SEC-05). Precondition: the victim has no Hoador account yet and signs up with Google or Apple. Found independently by three auditors.

- _Auditor's original grading:_ HIGH | **Confidence:** High. The result is an account takeover, with one realistic precondition: the target signs up later with Google or Apple.
- **Files:** `src/features/users/lib/profile.schema.ts:14,46`, `src/app/api/profile/route.ts:83-86`, `src/dal/user.dal.ts:218`, `src/services/better-auth/build-auth-options.ts:138-143`, `node_modules/better-auth/dist/oauth2/link-account.mjs:21-23,30-41`, `node_modules/better-auth/dist/api/routes/update-user.mjs:51`
- **Affected routes:** `PATCH /api/profile`; the Google/Apple callbacks and native idToken sign-in under `/api/auth/*`
- **Relevant code:**
  - `profile.schema.ts:46`: `email: email.optional(),`
  - `user.dal.ts:218`: `.set({ ...sanitizedUpdates, updatedAt: new Date() })`
  - `build-auth-options.ts:141`: `trustedProviders: ["google", "apple"],`
  - `link-account.mjs:23`: `if (!isTrustedProvider && !userInfo.emailVerified || requireLocalEmailVerified && !dbUser.user.emailVerified || …) return { error: "account not linked" }`
- **What is wrong:**
  - The API schema accepts `email` and writes it directly to the row.
  - `emailVerified` stays `true` after the change.
  - better-auth's own `/update-user` refuses to change the email (`update-user.mjs:51`), and `changeEmail` is not enabled. This route bypasses both.
- **Exploit / failure scenario:**
  1. The attacker signs up with `a@x.com` and verifies it.
  2. The attacker sends `PATCH /api/profile {"email":"victim@gmail.com"}` (lowercase).
  3. Later the victim taps "Sign in with Google". `findOAuthUser` finds the attacker's row by email, the provider is trusted and the local email is "verified", so better-auth links the Google account to the attacker's user and creates a session for it.
  4. The victim now uses an account whose password and existing sessions the attacker still holds. The attacker sees the victim's address, messages and Connect status, and can book with the victim's saved card.
- **Mitigating layers checked:**
  - A unique index stops the attacker taking an email that is already registered. The 409/500 on that collision is also a user-enumeration signal.
  - The proxy does not look at `/api/profile`.
  - `requireLocalEmailVerified` does not help, because the flag is carried over from the old address.
- **Real-world impact:** Pre-hijack of neighbors who have not joined yet, including their payment methods and home address.
- **Recommended fix:**
  - Remove `email` from `updateProfileApiSchema`.
  - Offer email change only through better-auth `changeEmail` with verification.
  - If a local change is kept, set `emailVerified=false` and revoke sessions.
- **Tests needed:**
  - A PATCH containing `email` does not change the email (400, or the field is ignored).
  - A linking test: an OAuth sign-in for an email that was changed but never verified must not link.

### SEC-03: The renter-supplied setupFee (unbounded, may be negative) overrides the listing's fee and sets the charged total, platform fee and owner payout

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** API-01, PAY-03, BIZ-04, TRUST-01, SURF-07
**Remediation plan:** [R-SEC-03](remediations/R-SEC-03-server-derived-setup-fee.md)

> **Adversarial review (lead auditor):** Verified: `setupFee: z.number().default(0)` (`src/features/rentals/lib/form-schema.ts:16`) and `Number(input.setupFee ?? listing.setupFee ?? 0)` (`src/features/rentals/lib/pricing.ts:85-87`); because the zod default is 0 the listing's own fee is never used. Graded HIGH (the payments auditor had MEDIUM): the owner's glance at the payout is a human check, not a control, and a modest discount is easy to miss. Reported by five of the eleven auditors.

- _Auditor's original grading:_ HIGH | **Confidence:** High. The attack moves money and needs only one precondition: the owner has to approve a request whose total is visible to them.
- **Files:** `src/features/rentals/lib/form-schema.ts:16`, `src/features/rentals/services/rental-service.ts:165,205,441`, `src/features/rentals/services/rental-quote.ts:63-64,94,177`, `src/features/rentals/lib/pricing.ts:85-88`
- **Affected routes:** `POST /api/rentals`
- **Relevant code:**
  - `form-schema.ts:16`: `setupFee: z.number().default(0),`
  - `pricing.ts:85-88`: `const setupFeeAmount = setupRequested ? Number(input.setupFee ?? listing.setupFee ?? 0) : 0;` followed by `const rentalPriceBeforeServiceFee = subtotal + deliveryFee + setupFeeAmount;`
- **What is wrong:**
  - The body's `setupFee` has no minimum or maximum, and `quoteRentalRequest` passes it straight into the pricing calculation (`rental-quote.ts:177`).
  - The schema defaults the value to 0, so the listing's own `setupFee` is never used.
  - Nothing checks `listing.setupAvailable` or `deliveryMode` before accepting `setupRequested` or `deliveryRequested`.
  - The totals are stored when the request is created (`:205`), and approval charges the stored `totalAmount` (`:441`).
  - The mobile code comment is wrong: it says the fee is "an echo, not an input to any arithmetic" (`hoador-mobile/src/features/rentals/lib/checkout-state.ts:189-192`).
- **Exploit / failure scenario:**
  1. The listing is $100/day for 5 days, a $500 subtotal.
  2. The renter sends `{deliveryRequested:true, deliveryAddress:"x", setupRequested:true, setupFee:-499.5, …}`.
  3. The stored figures become: price $0.50, service fee $0.32, total $0.82 (above Stripe's $0.50 floor), owner payout $0.40.
  4. If the owner approves, the renter is charged $0.82.
  - A subtler variant sends `setupFee:0`, which silently drops the owner's real setup fee.
- **Mitigating layers checked:**
  - The owner sees the total and the earnings preview before approving. That is the only barrier.
  - There is no DB CHECK constraint on `setup_fee` or `total_amount`.
  - Stripe's floor only stops totals below $0.50.
- **Real-world impact:** The owner loses almost the whole rental fee and the platform loses its commission. The loss is repeatable, and it is easy to miss when the discount is small.
- **Recommended fix:**
  - Remove `setupFee` from the request schema and always price from `listing.setupFee`.
  - Refuse `setupRequested` unless `listing.setupAvailable` is set, and refuse `deliveryRequested` on `pickup_only` listings.
  - Add a DB CHECK constraint so fee columns are ≥ 0.
- **Tests needed:**
  - A negative or zero `setupFee` does not change the quote.
  - A quote with setup uses the listing's fee.
  - `setupRequested` on a listing without setup returns a blocker.
- **Related:** SEC-10, which also exposes unapproved listings to the quote.

### SEC-04: Custom auth routes (signup, forgot-password, resend-verification, reset) bypass better-auth's rate limiter; the built-in limiter is per-instance memory

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** AUTH-02, API-07, SURF-14

> **Adversarial review (lead auditor):** Kept MEDIUM (email bombing, signup spam, Resend reputation).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High (rate limiter runs only in the HTTP router's `onRequest`; the custom routes invoke `auth.api.*` server-side, which does not pass through it)
- **Files:** `src/app/api/auth/forgot-password/route.ts:25-32` (`auth.api.requestPasswordReset`), `src/app/api/auth/resend-verification/route.ts:20-27` (`auth.api.sendVerificationEmail`), `src/app/api/auth/signup/route.ts:53-59` → `src/features/auth/services/auth-service.ts:37-45` (`auth.api.signUpEmail`), `src/app/api/auth/reset-password/route.ts:26-33`; library: `node_modules/better-auth/dist/api/index.mjs:167-169` (rate limit only inside `router.onRequest`), `node_modules/better-auth/dist/api/rate-limiter/index.mjs:332-384` (`onRequestRateLimit`, special rules), `node_modules/better-auth/dist/context/create-context.mjs:169-174` (`storage: "memory"`, `enabled: isProduction`)
- **Affected routes:** `POST /api/auth/forgot-password`, `POST /api/auth/resend-verification`, `POST /api/auth/signup`, `POST /api/auth/reset-password`
- **Relevant code:**

```ts
// forgot-password/route.ts:25 — direct server-side API call, not an HTTP hit on /api/auth/[...all]
const { error } = await tryCatch(
  auth.api.requestPasswordReset({
    body: {
      email: validation.data.email,
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    },
  }),
);
// forgot-password/route.ts:36 — the route even scans for a "rate limit" error string,
// expecting better-auth to throttle. It never will on this path.
```

```js
// better-auth/dist/api/index.mjs:166  (router.onRequest — the ONLY rate-limit call site)
async onRequest(req) { ... const rateLimitResponse = await onRequestRateLimit(currentRequest, ctx);
                       if (rateLimitResponse) return rateLimitResponse; ... }
```

- **What is wrong:** better-auth's built-in limiter (`/sign-in|/sign-up|/change-password` → 3 per 10s; `/request-password-reset|/send-verification-email` → 3 per 60s) fires only when a request goes through the better-auth HTTP router (`/api/auth/[...all]`). The app's own auth routes are separate Next handlers that call `auth.api.requestPasswordReset` / `sendVerificationEmail` / `signUpEmail` **as server-side functions**, which never execute the router's `onRequest`. Those routes add no throttling of their own. Result: unlimited password-reset and verification emails to any address, and unlimited account creation.
- **Exploit / failure scenario:** Loop `POST /api/auth/forgot-password {email: victim@x.com}` or `POST /api/auth/resend-verification {email: <known-unverified>@x.com}` → Resend sends one email per call, unbounded → inbox flooding of a target + Resend cost/deliverability-reputation burn. `POST /api/auth/signup` in a loop creates unbounded pending user rows.
- **Mitigating layers checked:** No `rateLimit.customRules` in `build-auth-options.ts`; no upstash/Redis limiter on these routes (the only app limiter is `src/lib/api/ai-rate-limit.ts`, in-memory, used solely by `/api/listings/analyze-image`). Even the native better-auth endpoints that ARE throttled use `storage: "memory"` → per-serverless-instance buckets on Vercel, so the 3/10s login limit multiplies by the number of live instances (defense-in-depth weakening, aggravating any credential-stuffing attempt against `/api/auth/[...all]/sign-in/email`).
- **Real-world impact:** Email-bombing of arbitrary addresses, verification-email bombing of known users, signup spam; degraded Resend reputation; weak brute-force resistance on the throttled paths too.
- **Recommended fix:** Put a shared limiter (IP + email keyed) in front of the custom auth routes, or route them through better-auth so the built-in limiter applies, and move rate-limit storage to `secondaryStorage`/Redis so it is global rather than per-instance.
- **Tests needed:** N+1 rapid calls to forgot-password/resend/signup → 429 after the threshold; assert only ≤N emails were sent.
- **Related:** enumeration is NOT possible here (forgot-password returns a constant message; `sendVerificationEmail` with no session returns `status:true` for missing/verified users via `email-verification.mjs:95-117`, so the route's "already verified"/"not found" branches are dead code) — this is throughput abuse, not enumeration.

### SEC-05: Password reset and change do not revoke existing sessions

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** AUTH-03

> **Adversarial review (lead auditor):** Kept MEDIUM. Aggravates SEC-01 and SEC-02: an attacker's session survives the victim's recovery.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High (config omits the flag; library gates revocation on it)
- **Files:** `src/services/better-auth/build-auth-options.ts:108-135` (`emailAndPassword` block has `sendResetPassword`/`onPasswordReset` but no `revokeSessionsOnPasswordReset`), `node_modules/better-auth/dist/api/routes/password.mjs:159-164` (revocation only `if (...revokeSessionsOnPasswordReset)`)
- **Affected routes:** `POST /api/auth/reset-password` → `auth.api.resetPassword`; `/api/auth/[...all]/change-password` (client-driven `revokeOtherSessions` optional, defaults off)
- **Relevant code:**

```js
// better-auth/dist/api/routes/password.mjs:159
if (ctx.context.options.emailAndPassword?.onPasswordReset) { const user = ...; await onPasswordReset({user}, ctx.request); }
if (ctx.context.options.emailAndPassword?.revokeSessionsOnPasswordReset) await ctx.context.internalAdapter.deleteUserSessions(userId);
// build-auth-options.ts:131 — onPasswordReset only console.logs; revokeSessionsOnPasswordReset is absent (=> falsy)
onPasswordReset: async ({ user }) => { console.log(`Password for user ${user.email} has been reset.`); },
```

- **What is wrong:** When a user resets (or changes) their password — often precisely because they suspect compromise — better-auth leaves all other active sessions valid, because `revokeSessionsOnPasswordReset` is not set and the app never calls `deleteUserSessions`.
- **Exploit / failure scenario:** Attacker obtains a session (stolen cookie / shared device). Victim resets their password to recover. Attacker's session persists and continues to work (auto-refreshing, per SEC-01's default session config). Recovery does not evict the attacker.
- **Mitigating layers checked:** `onPasswordReset` hook does not revoke; no custom session-cleanup on the reset route; `change-password` supports `revokeOtherSessions` but it is an optional client-supplied boolean, not enforced.
- **Real-world impact:** Standard account-recovery does not lock out an attacker; combined with SEC-02 an attacker can also swap the recovery email.
- **Recommended fix:** Set `emailAndPassword.revokeSessionsOnPasswordReset: true` (and default `change-password` to revoke other sessions server-side).
- **Tests needed:** two sessions for one user; reset password via `/api/auth/reset-password`; the other session's next authenticated call is rejected.
- **Related:** SEC-01, SEC-02 (account-capture chain).

### SEC-06: Any admin can demote admins and superadmins and change their status; admin user PATCH is not schema-validated

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** AUTH-05, API-15, SURF-13

> **Adversarial review (lead auditor):** Kept MEDIUM (escalation is blocked; sabotage is not).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High (the superadmin gate triggers only when setting userType TO admin/superadmin; demotion and status changes are ungated)
- **Files:** `src/app/api/admin/users/[userId]/route.ts:97-123` (PATCH), `src/app/api/admin/users/bulk-actions/route.ts:71-110` (bulk status), `src/dal/user.dal.ts:476-494` (`adminUpdateUser`)
- **Affected routes:** `PATCH /api/admin/users/[userId]`, `POST /api/admin/users/bulk-actions`
- **Relevant code:**

```ts
// admin/users/[userId]/route.ts:105 — gate fires ONLY for promotions
if (
  userType !== undefined &&
  (userType === "admin" || userType === "superadmin")
) {
  const superAdmin = await isSuperAdmin();
  if (!superAdmin)
    return NextResponse.json(
      { error: "Only superadmin can set admin or superadmin role" },
      { status: 403 },
    );
}
// setting userType = "standard" on a superadmin is NOT gated; status changes on a superadmin are NOT gated
const updated = await userDAL.adminUpdateUser(userId, updates);
```

- **What is wrong:** The role-change guard is asymmetric. Escalation is correctly blocked (a plain admin cannot make anyone admin/superadmin). But **demotion** is not: a plain admin can `PATCH {userType:"standard"}` on any superadmin or admin, stripping their privileges; and an admin can set any `status` (e.g. `suspended`) on a superadmin. There is no "you cannot modify an account of equal/higher privilege" rule.
- **Exploit / failure scenario:** A compromised or rogue admin demotes every superadmin to `standard`, removing the only accounts that could delete users or re-grant admin — a denial-of-control / governance sabotage. (They still cannot promote themselves, so it is sabotage, not escalation.)
- **Mitigating layers checked:** promotion gate holds; `DELETE /api/admin/users/[userId]` is correctly superadmin-only (`route.ts:175-181`); role/status changes are audit-logged (`route.ts:126-150`), which aids forensics but does not prevent the action. Status changes are moot for enforcement today because of SEC-01, but demotion is not moot.
- **Real-world impact:** One admin can neutralize peers and superadmins.
- **Recommended fix:** Require superadmin to modify (userType or status) any account whose current `userType` is admin/superadmin, and block self-demotion of the last superadmin; gate `userType:"standard"` demotions the same way promotions are gated.
- **Tests needed:** admin demoting a superadmin → 403; admin suspending a superadmin → 403; superadmin retains the ability.
- **Related:** SEC-01 (status enforcement).

### SEC-07: Any user can detach any Stripe PaymentMethod, and the provider booking list leaks requesters' PaymentMethod ids

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PAY-04, API-14, SURF-01

> **Adversarial review (lead auditor):** Verified the leak source: `findByProviderForDashboard` spreads the whole `service_bookings` row (`src/dal/service-booking.dal.ts:800-826`), including `selectedPaymentMethodId`. Graded MEDIUM (auditors ranged LOW-HIGH): it sabotages a counterparty's saved card but cannot steal (Stripe blocks re-attaching and cross-customer charges).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `src/app/api/stripe/delete-payment-method/route.ts:17-32`; `src/services/stripe/payment-method.ts:160-164`; `src/dal/service-booking.dal.ts:796-829`; `src/app/api/services/bookings/route.ts:41-51`
- **Affected routes:** `DELETE /api/stripe/delete-payment-method?id=`, `GET /api/services/bookings?role=provider`
- **Relevant code:**

```ts
const { error } = await tryCatch(detachPaymentMethod(paymentMethodId)); // route.ts:32 — no ownership check
return rows.map((row) => ({ ...row.booking, ...                         // service-booking.dal.ts:825 — full row
```

- **What is wrong:** `paymentMethods.detach` runs with the platform key on any `pm_`. The route never checks that `pm.customer === user.stripeCustomerId`. The provider list spreads the whole `serviceBookings` row: `selectedPaymentMethodId`, `stripePaymentIntentId`, `stripeChargeId`, `stripeRefundId`, plus the counterparty's email. The detail route was allow-listed in P-E9-3; the list route was missed.
- **Exploit scenario:** A provider lists their bookings, reads a requester's `selectedPaymentMethodId`, and calls DELETE. The card is detached for good: Stripe documents that detached PMs can't be reused or re-attached (`node_modules/stripe/cjs/resources/PaymentMethods.d.ts:43`). The requester's other bookings, rental approvals and deposit holds then fail.
- **Mitigating layers checked:** The detach can't become theft. Re-attach is impossible, and a PaymentIntent requires the PM's customer to match (`PaymentIntents.d.ts:2631`). PM IDs are unguessable, but this list leaks them.
- **Real-world impact:** Sabotage of other users' payment methods and payments. No direct theft.
- **Recommended fix:** Retrieve the PM and return 404 unless `pm.customer === user.stripeCustomerId`. Allow-list the dashboard list fields and drop the Stripe IDs, PM ID and email.
- **Tests needed:** Deleting another customer's PM returns 404 and never calls detach. The list response has no `selectedPaymentMethodId` or `stripe*` keys.
- **Related:** P-E9-3 (detail route already fixed).

### SEC-08: PATCH /api/users/me/visibility accepts any communityId, so a user can make any community's listings, services and needs visible to themselves

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** TRUST-02, API-06, PRIV-06, SURF-02

> **Adversarial review (lead auditor):** Kept MEDIUM (auditors ranged MEDIUM-HIGH). The missing check is certain, but today's deployment is essentially one network, which bounds the cross-tenant exposure. It becomes HIGH once a second network or a standalone HOA exists. Chains with SEC-09 and BIZ-08 into a complete community-isolation bypass (see the executive summary).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High on the missing check; impact bounded by today's single-network deployment
- **Files:** `src/app/api/users/me/visibility/route.ts:41-93`, `src/dal/community.dal.ts:1074-1128` (writer), `src/dal/community.dal.ts:986-1001` (`getVisibleCommunityIds`), `src/dal/community.dal.ts:1010-1029` (`isVisibleInCommunity`), consumers `src/app/api/listings/search/route.ts:22,62-74`, `src/app/api/services/listings/route.ts:50-57`, `src/app/api/listings/[listingId]/route.ts:88-113`
- **Affected routes:** `PATCH /api/users/me/visibility` (write); read amplification via listings/services/needs search and listing detail.
- **Relevant code:**

```
// src/dal/community.dal.ts:1092-1121 — only the primary-hide case is guarded…
if (hidingPrimary) throw new ValidationError("Cannot hide your home community");
...
await this.db.insert(communityVisibility)
  .values({ userId, communityId: u.communityId, isVisible: u.isVisible })   // any communityId
  .onConflictDoUpdate({ ... set: { isVisible: u.isVisible } });
```

```
// src/dal/community.dal.ts:988-996 — read set has NO membership/network join
.select({ communityId: communityVisibility.communityId })
.from(communityVisibility)
.where(and(eq(communityVisibility.userId, userId), eq(communityVisibility.isVisible, true)));
```

- **What is wrong:** Visibility rows are meant to be initialized only for communities in the
  user's network (`initializeUserVisibility(userId, networkId)`, community.dal.ts:932-958).
  `bulkSetVisibility` never checks that `communityId` belongs to the caller's network (or
  that the caller is a member); it upserts a row for whatever id is sent. `getVisibleCommunityIds`
  then returns every `isVisible=true` row with no membership join, and the listings/services/needs
  search uses that set directly (viewer side of the symmetric R5 rule). `isVisibleInCommunity`
  (listing-detail authz) reads the same table, so an injected row also flips the viewer-side gate.
- **Exploit / failure scenario:** Any authenticated user enumerates community ids via
  `GET /api/communities`, then `PATCH /api/users/me/visibility` with
  `{updates:[{communityId:"<foreign community>",isVisible:true}]}`. `getVisibleCommunityIds`
  now includes it, so `GET /api/listings/search` and `GET /api/services/listings` return that
  community's listings (owner is a member, hence owner-side visible), and
  `GET /api/listings/[listingId]` passes the both-parties-visible gate for that community's
  listings. A standalone-community user (who gets no initialized rows) can use this to browse
  any other community.
- **Mitigating layers checked:** None between the route and the DB — `bulkSetVisibility` is
  the sole writer and applies no network filter. The owner-side `INNER JOIN` in
  `searchListings` does not help: owners are visible in their own community.
- **Real-world impact:** Cross-community (and, under the multi-network model the schema
  supports, cross-network) read of listings, service listings, needs, and listing detail —
  bypassing the product's core community-isolation rule. Practically bounded today because
  production is single-network (`kansas-city-metro`), where a user can already toggle
  visibility across the one network; the new capability is reaching communities outside the
  user's network / standalone communities.
- **Recommended fix:** In `bulkSetVisibility`, reject any `communityId` not in the caller's
  network (or without an existing initialized visibility row). Alternatively join
  `getVisibleCommunityIds` to network membership.
- **Mobile compat:** additive server-side rejection; the app only ever toggles ids returned
  by `GET /api/users/me/visibility` (network-scoped), so no app change.
- **Tests needed:** PATCH with a foreign/standalone `communityId` → 400/403 and no row
  written; search unaffected by injected rows.
- **Related:** rejected-findings note "strict community isolation is not a stated invariant"
  was about **dispute evidence**; for listings the symmetric visibility rule _is_ the
  isolation mechanism, so this is new evidence.

### SEC-09: GET /api/communities (and /api/users/me/visibility) return every community's joinCode, the residency proof, to any logged-in user

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-12, PRIV-05

> **Adversarial review (lead auditor):** Upgraded LOW→MEDIUM. Verified: the route is authentication-only and `listCommunitiesByNetwork` runs `.select().from(communities)` (`src/dal/community.dal.ts:848-862`), so every join code reaches any logged-in user - including accounts not yet in a community - and the response is marked `Cache-Control: public, max-age=60`.

- _Auditor's original grading:_ LOW | **Confidence:** High. Admin residency review can be skipped; low because verification currently gates nothing.
- **Files:** `src/app/api/communities/route.ts:34-44`, `src/dal/community.dal.ts:858-862,102-117,656-659`, `src/db/schemas/communities.schema.ts:49`
- **Affected routes:** `GET /api/communities`, `POST /api/auth/join-community`
- **Relevant code:** `community.dal.ts:858-859`: `.select().from(communities)`, which returns every column including `joinCode`. The join path then creates `verificationStatus: "verified"` (`:658`).
- **What is wrong:** Any logged-in user, even one with no community yet, can read every join code with `active=false`. Joining with a code also skips the `isActive` check.
- **Exploit / failure scenario:** Read the join codes, then join any community as a "verified" resident without admin review, including inactive communities.
- **Mitigating layers checked:** `verificationStatus` gates nothing today (see Open questions).
- **Real-world impact:** The attacker appears verified and never enters the admin queue.
- **Recommended fix:** Project columns explicitly without `joinCode`, and check `isActive` in `validateJoinCodeForSignup`.
- **Tests needed:** The response has no `joinCode`, and joining an inactive community returns 400.

### SEC-10: Owners and providers can publish unmoderated or rejected listings (rental status self-service; service deactivate→reactivate)

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-05, SURF-05, SURF-06

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. Listing moderation can be bypassed; impact is bounded to the community.
- **Files:** `src/app/api/listings/[listingId]/status/route.ts:12-14,74-76`, `src/app/api/listings/[listingId]/route.ts:25,91-93`, `src/features/rentals/services/rental-quote.ts:94-95`, `src/features/services/services/service-listing-service.ts:363,387-394`, `src/dal/service-listing.dal.ts:293`
- **Affected routes:** `PATCH /api/listings/[id]/status`, `POST /api/services/listings/[id]/deactivate`, `POST /api/services/listings/[id]/reactivate`
- **Relevant code:**
  - `status/route.ts:13`: `status: z.enum(["available", "maintenance", "inactive"]),`. There is no `approvalStatus` check.
  - `service-listing-service.ts:363`: `await serviceListingDAL.update(listingId, { status: "inactive" });`. This runs from any status.
- **What is wrong:**
  - **Rentals:** an owner can set a `pending_review` or `rejected` listing to `available`.
    - The detail GET for non-owners checks `status` only.
    - `quoteRentalRequest` checks neither status nor approval, so the listing can be viewed by direct link and rented.
  - **Services:** a `pending_approval` or `denied` listing can go deactivate → `inactive` → reactivate → `active`.
    - It then appears in browse (`service-listing.dal.ts:293`).
    - It also leaves the admin review queue.
- **Exploit / failure scenario:** A provider whose listing was denied calls deactivate and then reactivate, and the listing is live to the whole community without review.
- **Mitigating layers checked:**
  - Rental search filters on `approvalStatus`, but direct links do not.
  - Nothing mitigates the service case.
- **Real-world impact:** Prohibited items and services reach residents, with the platform-liability exposure the moderation step exists to prevent.
- **Recommended fix:**
  - Refuse `available` unless `approvalStatus==="approved"`.
  - Allow deactivate only from `active`, and let reactivate return only listings that were previously approved.
  - Check approval in the rental detail GET and in the quote.
- **Tests needed:** Each transition from pending or rejected is refused, and the quote on an unapproved listing returns a blocker.

### SEC-11: profileImageUrl is client-settable, which bypasses plan 010's profile-image ownership fix and lets anyone delete other users' avatar blobs

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-03, SURF-10

> **Adversarial review (lead auditor):** Kept MEDIUM. Also: `POST /api/onboarding` takes `profileImageUrl` from the body (`src/app/api/onboarding/route.ts:33`).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. Any user can delete another user's data, but the only data exposed is `profiles/*` avatars.
- **Files:** `src/features/users/lib/profile.schema.ts:19,49`, `src/features/onboarding/schemas/validation.ts:40-44`, `src/app/api/profile/upload/route.ts:80-94,165-167`
- **Affected routes:** `PATCH /api/profile`, `POST /api/onboarding`, `POST` and `DELETE /api/profile/upload`
- **Relevant code:**
  - `profile.schema.ts:19`: `const profileImageUrl = z.string().url();`. I confirmed that Zod 4 also accepts `javascript:` and `file:` URLs here.
  - `upload/route.ts:165-167`: `pathname.startsWith(\`profiles/${userId}/\`) || (currentImagePathname !== null && pathname === currentImagePathname)`
- **What is wrong:** The DELETE ownership check and the POST "delete old image" cleanup (`:82-87`) both trust `user.profileImageUrl`, and the user can set that field to any URL.
- **Exploit / failure scenario:**
  1. The attacker reads the victim's public avatar URL, `…/profiles/<victimId>/<ts>-a.jpg`.
  2. The attacker PATCHes their own `profileImageUrl` to `https://x.invalid/profiles/<victimId>/<ts>-a.jpg`.
  3. `DELETE /api/profile/upload?pathname=profiles/<victimId>/<ts>-a.jpg` returns 200 and the blob is deleted. Uploading any new image deletes it too, through the cleanup at `:85-87`.
- **Mitigating layers checked:**
  - Deletion is limited to the `profiles/` prefix.
  - Avatars on web are covered by CSP `img-src`. Mobile has no CSP, so mobile viewers load an arbitrary attacker URL, which leaks their IP and user agent.
- **Real-world impact:** Other users' photos can be vandalized. This is a sibling path that plan 010 did not close.
- **Recommended fix:**
  - Drop `profileImageUrl` from both client schemas and set it only from the upload result on the server.
  - In cleanup and DELETE, allow only paths under `profiles/${userId}/`.
  - Validate the host of the better-auth `image` value that `acceptLegalDocuments` copies (`auth-service.ts:103-106`).
- **Tests needed:**
  - A PATCH with `profileImageUrl` is ignored.
  - DELETE on another user's prefix returns 403, even when `profileImageUrl` points at it.
  - Upload cleanup never deletes a blob outside the caller's prefix.

### SEC-12: User content is interpolated into email HTML unescaped, and the storage sanitizer decodes entities back into live markup

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-04

> **Adversarial review (lead auditor):** Kept MEDIUM (credible phishing from Hoador's own DKIM-signed domain). Not re-verified by the lead beyond the auditor's run of the installed sanitize-html.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. This is HTML injection into DKIM-signed mail from noreply@hoador.com that reaches other users and admins.
- **Files:**
  - Sanitizer: `src/lib/utils/sanitize.ts:13-24,52-59`
  - Sinks: `src/features/messages/notifications/message-received.ts:59`, `src/features/rentals/notifications/rental-request-created.ts:65,69`, `…/rental-denied.ts:71`, `src/app/api/rentals/[id]/decline/route.ts:18`, `src/features/disputes/notifications/dispute-notifications.ts:54,195,401`, `src/app/api/disputes/route.ts:101-103`, `src/features/notifications/lib/ops-alerts.ts:67`
- **Affected routes:** `POST /api/messages/conversations`, `POST /api/messages/conversations/[id]/messages`, `POST /api/rentals`, `POST /api/rentals/[id]/decline`, `POST /api/disputes`, and the other rental notification senders
- **Relevant code:**
  - `sanitize.ts:58`: `return decodeHtmlEntities(sanitized);`. I ran the installed sanitize-html: `&lt;a href="https://evil.example/x"&gt;Click&lt;/a&gt;` comes out as `<a href="https://evil.example/x">Click</a>`.
  - `message-received.ts:59`: `${senderName} sent you a message.`
  - `dispute-notifications.ts:54`: `<strong>Description:</strong> ${dispute.description}`
  - `rental-denied.ts:71`: `${denialReason}`. The field has no sanitizing and no maximum length.
- **What is wrong:** Rental, message and dispute templates interpolate names, listing names, `denialReason` and dispute `description` without escaping. The service and listing-pending templates do escape.
- **Exploit / failure scenario:**
  1. The attacker PATCHes their `firstName` to an entity-encoded `<a href=phish>Verify your payout account</a>`.
  2. The attacker messages any user whose ID appears on a listing or need.
  3. The victim receives a real Hoador email with the attacker's link.
  - A dispute party can file a raw-HTML `description`, which reaches every admin and the counterparty.
- **Mitigating layers checked:**
  - Email clients do not run JavaScript, but links, forms, CSS spoofing and tracking images all work.
  - The web UI escapes these fields because React does. No `dangerouslySetInnerHTML` sink uses user data.
- **Real-world impact:** Credible phishing of users and admins from the platform's own sending domain.
- **Recommended fix:**
  - Escape every interpolation with `escapeHtml`, ideally through one template helper.
  - Store plain text, drop `decodeHtmlEntities` at write time, and escape at each sink.
  - Cap `denialReason` and dispute `description`.
- **Tests needed:** For each template, `<a>` and `&lt;a&gt;` inputs render inert.

### SEC-13: Web-push endpoints accept any string and subscriptions are unbounded, so /api/push/test amplifies outbound HTTPS requests

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-08, TRUST-04

> **Adversarial review (lead auditor):** Kept MEDIUM (blind reflector; no internal SSRF on Vercel).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. This is blind, HTTPS-only request amplification, not metadata SSRF.
- **Files:** `src/features/notifications/lib/validators.ts:18-25`, `src/dal/notifications.dal.ts:557-617`, `src/features/notifications/lib/push-service.ts:119,161-166`, `src/app/api/push/test/route.ts:32,57`, `node_modules/web-push/src/web-push-lib.js:369`
- **Affected routes:** `POST /api/push/subscribe`, `POST /api/push/test`, and every notification send
- **Relevant code:** `validators.ts:19`: `endpoint: z.string().min(1),`
- **What is wrong:**
  - web-push sends an `https.request` to the endpoint's host, port and path.
  - Each new endpoint string adds a row, with no per-user limit.
  - `/api/push/test` sends to every row, retries once on a 5xx, writes an audit row per attempt and has no throttle.
- **Exploit / failure scenario:** Register 10,000 endpoints pointing at a target host, then loop `/api/push/test`. Each call makes 10,000 or more POSTs from Hoador's egress IPs and 10,000 or more DB writes.
- **Mitigating layers checked:**
  - Requests are TLS-only.
  - Vercel functions have no private network, so the attacker cannot reach cloud metadata.
  - The attacker never sees the responses.
- **Real-world impact:** Hoador can be used as a DDoS reflector, and its own DB and function time are consumed.
- **Recommended fix:**
  - Require `https:` and an allow-list of push-service hosts (FCM, Mozilla, Apple, WNS).
  - Cap subscriptions per user.
  - Rate-limit `/api/push/test`.
  - Pass a `timeout` to web-push.
- **Tests needed:** A non-push-service endpoint returns 400, and the 11th subscription is refused.

### SEC-14: POST /api/listings/analyze-image has no image cap, refunds failed calls and limits per process, amplifying OpenAI cost

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** API-09

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. The code paths are verified. I could not verify how reliably an attacker can make the model refuse.
- **Files:** `src/app/api/listings/analyze-image/route.ts:18-20,56-62,93-124`, `src/lib/api/ai-rate-limit.ts:27`, `src/services/openai/analyze-listing-image.ts:90-93`
- **Affected routes:** `POST /api/listings/analyze-image`
- **Relevant code:** `route.ts:19`: `imageUrls: z.union([z.string(), z.array(z.string())]),`. There is no maximum count and no URL constraint.
- **What is wrong:**
  - Every string becomes a gpt-4o `image_url` part.
  - The limiter is a `Map` held in each process's memory, so each instance has its own budget.
  - `refund()` runs on `refused`, `low_confidence` and errors, so a request the model rejects costs the attacker nothing.
- **Exploit / failure scenario:** Send many large public image URLs per request, from several accounts and instances, or send images that trigger a refusal so the quota is never spent.
- **Mitigating layers checked:**
  - OpenAI fetches the images, not Hoador, so there is no internal SSRF.
  - OpenAI's organization spend cap is the only backstop, and it is not visible in the repo.
- **Real-world impact:** The OpenAI bill can be run up, or the feature taken down once the cap is reached.
- **Recommended fix:**
  - Cap the array at 10 and accept only Hoador blob hosts, or `data:` with a size cap.
  - Use a durable per-user quota.
  - Do not refund refused or low-confidence results.
  - Use `detail:"low"`.
- **Tests needed:** 11 URLs return 400, a foreign host returns 400, and a refused result still consumes quota.

### SEC-15: Posting a neighborhood need notifies the whole community/network with no throttle

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-10

> **Adversarial review (lead auditor):** Kept MEDIUM; the performance side is PERF-02.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. One authenticated user can spam every member of a community.
- **Files:** `src/app/api/needs/route.ts:21,51`, `src/features/neighborhood-needs/services/neighborhood-needs-service.ts:315-344`
- **Affected routes:** `POST /api/needs`
- **Relevant code:** `…-service.ts:315`: `const recipientIds = await communityDAL.getUserIdsVisibleInCommunity(need.communityId);`. This is followed by one `sendNotification` per recipient: an in-app row, plus push if the user opted in.
- **What is wrong:** There is no rate limit, no cap on how many open needs a user can have, and no limit on the length of `description` (`:21`).
- **Exploit / failure scenario:** Loop `POST /api/needs`. Each call writes N notification rows and sends N pushes, where N is the number of members in the community.
- **Mitigating layers checked:** Email is disabled for this fan-out, and push is opt-in.
- **Real-world impact:** Every member's notification center is flooded, and DB writes grow at N per request.
- **Recommended fix:** A per-user rate limit and a cap on open needs, a maximum length for `description`, and deduplication of identical titles.
- **Tests needed:** The (k+1)th need within the window returns 429.

### SEC-16: drizzle-orm 0.45 wraps every DB error, so all 23505/23503/23514 mappings are dead and the full SQL plus bound parameters are returned to clients

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** API-11, PRIV-10

> **Adversarial review (lead auditor):** Upgraded LOW→MEDIUM. Verified: `DrizzleQueryError` builds `Failed query: <sql>\nparams: <params>` and keeps the pg error on `.cause` (`node_modules/drizzle-orm/errors.js:10-19`; thrown from `pg-core/session.js:41`), while `BaseDAL.handleError` tests `error.code` (`src/dal/base.ts:46-66`) and `handleApiError` returns `DALError` messages verbatim. So bound parameters (emails, phones, message text) leak to the client, logs and Sentry, and every expected 409/400 becomes a 500 - which also breaks the mobile app's error-code branching.

- _Auditor's original grading:_ LOW | **Confidence:** High. Schema and query structure leak, and 409/400 responses become 500.
- **Files:** `node_modules/drizzle-orm/errors.js:10-13`, `node_modules/drizzle-orm/pg-core/session.js:41`, `src/dal/base.ts:46-66`, `src/lib/api/route-helpers.ts:200-204,222`, `src/dal/blind-review.dal.ts:71`, `src/features/disputes/services/dispute-creation-service.ts:230`
- **Affected routes:** Every route whose DB call can fail on client input. Examples: `GET /api/listings/not-a-uuid`; `PATCH /api/profile` with an existing email; raw `db` inserts in `availability/route.ts`.
- **Relevant code:**
  - `errors.js:12-13`: ``super(`Failed query: ${query}\nparams: ${params}`)``. The pg error code sits on `.cause`.
  - `base.ts:46`: `if (error.code === "23505")`. This never matches.
  - `base.ts:62-63`: `` `Database operation failed: ${error.message}` ``, which is returned to the client at `route-helpers.ts:200-204`.
- **What is wrong:** drizzle 0.45 wraps every driver error, so the check for 23505/23503/23514 always fails. The tests pass only because they mock a top-level `code` (`blind-review.dal.test.ts:68`).
- **Exploit / failure scenario:** Any malformed UUID or enum value returns the SELECT or UPDATE text and its bound values. The "already exists" 409s for duplicate reviews and disputes surface as 500s instead.
- **Mitigating layers checked:** No SQL injection was found, so what leaks is information only.
- **Real-world impact:** The schema is disclosed. Error codes the mobile client branches on are lost, and Sentry fills with noise.
- **Recommended fix:** Map `error.cause?.code ?? error.code`, and return a generic 500 with a `requestId`. Never return a DB message to the client.
- **Tests needed:** Use a real `DrizzleQueryError` with `cause.code='23505'` and expect a 409 with no SQL in the body.

### SEC-17: The e2e 'sign in as any email' better-auth endpoint ships in every build and is guarded only by E2E_TEST (no NODE_ENV check)

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** SURF-11

> **Adversarial review (lead auditor):** Verified: registered unconditionally (`plugins: [e2eGoogleCallbackPlugin(), …]` in `src/services/better-auth/build-auth-options.ts`), guarded only by `process.env.E2E_TEST !== "1"` (`src/services/better-auth/e2e-google-plugin.ts:23-34`). `E2E_TEST` is set only in `.github/workflows/e2e-tests.yml:66`. Defense-in-depth: a single env var separates any deployment from a sign-in-as-anyone primitive.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High for the code. Exploitability depends on each deployment's environment variables, which I could not verify.
- **Files:**
  - `src/services/better-auth/e2e-google-plugin.ts:28-35, 119`
  - `src/services/better-auth/build-auth-options.ts:239`
  - For contrast: `src/app/api/auth/[...all]/route.ts:15-19` and `src/app/api/test/*` (NODE_ENV guard)
- **Affected routes:** GET /api/auth/e2e-callback (served through `[...all]`)
- **Relevant code:**

```
28  if (process.env.E2E_TEST !== "1") {
35    url.searchParams.get("e2e_user") || DEFAULT_E2E_GOOGLE_EMAIL;
119 const session = await internalAdapter.createSession(user.id);
239 plugins: [e2eGoogleCallbackPlugin(), expo(), nextCookies()],
```

- **What is wrong:** The `/api/test/*` routes require both `NODE_ENV !== "production"` and `E2E_TEST=1`. This endpoint mints a session for any email with only the E2E_TEST check. Vercel builds, previews included, run with `NODE_ENV=production`, so the guard that makes the accepted test-route risk fail closed is absent here. The accepted-risk note explicitly considers preview deploys with `E2E_TEST=1`.
- **Exploit / failure scenario:** On any deployment with `E2E_TEST=1`, calling `GET /api/auth/e2e-callback?e2e_user=admin@…` returns an admin session.
- **Mitigating layers checked:** Only the E2E_TEST environment variable.
- **Real-world impact:** Takeover of any account, including admins, on that deployment's database.
- **Recommended fix:** Add the NODE_ENV check to the handler, and register the plugin only in non-production E2E runs.
- **Tests needed:** With `NODE_ENV=production` and `E2E_TEST=1`, the endpoint returns 404.

### SEC-18: Open unverified email/password signup allows account squatting and Google-sign-in lockout for a targeted email

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** AUTH-06

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High (mechanism traced; impact bounded to a known-email target and is DoS, not takeover)
- **Files:** `src/services/better-auth/build-auth-options.ts:109-135` (no `emailAndPassword.requireEmailVerification`; `autoSignIn: true`), `src/app/api/auth/[...all]/route.ts:30` (exposes better-auth's `/sign-up/email` directly), `node_modules/better-auth/dist/oauth2/link-account.mjs:22-29` (trusted-provider link refused when local email unverified)
- **Affected routes:** `POST /api/auth/sign-up/email` (via `/api/auth/[...all]`), then victim's `GET /api/auth/callback/google`
- **What is wrong:** Because email/password signup is directly reachable and does not require verification, an attacker can create an unverified account holding `victim@example.com`. When the victim later tries Google sign-in with that email, better-auth finds the existing (unverified) local user and, because trusted-provider linking requires the local email be verified (`requireLocalEmailVerified` default `true`), **refuses to link** and returns "account not linked". The victim also cannot self-register (email is taken). They are locked out of Google sign-in for that email until support intervenes.
- **Exploit / failure scenario:** Attacker who knows a target's email pre-registers it (never verifies). Target cannot onboard via Google and cannot register. Bounded: requires knowing the email; no funds or data at risk; recoverable by an admin.
- **Mitigating layers checked:** This same default (`requireLocalEmailVerified`) is what _blocks_ the more serious pre-hijacking takeover (see Verified clean). The residual is squatting/lockout only.
- **Recommended fix:** Set `emailAndPassword.requireEmailVerification: true` (do not create/occupy the email row, or block sign-in, until verified), or reap unverified accounts after a short TTL so a squatted email frees up.
- **Tests needed:** register-but-don't-verify `victim@x`; attempt Google sign-in as victim → assert graceful outcome (auto-reap or clear recovery), not a permanent "account not linked".
- **Related:** SEC-04 (signup is also unthrottled, making mass squatting cheap).

### SEC-19: PUT /api/disputes/[id]/notes updates the note before checking it belongs to the dispute (admin-only)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** AUTH-07

> **Adversarial review (lead auditor):** Kept LOW (known follow-up in plans/README.md).

- _Auditor's original grading:_ LOW | **Confidence:** High | **Known: plans/README.md follow-up (015)**
- **Files:** `src/app/api/disputes/[id]/notes/route.ts:141-150`
- **Relevant code:**

```ts
const updatedNote = await disputeDAL.updateInternalNote(noteId, content); // writes first
if (updatedNote.disputeId !== disputeId)
  return NextResponse.json(
    { error: "Note does not belong to this dispute" },
    { status: 400 },
  ); // checks after
```

- **What is wrong:** The membership check happens after the write, so an admin can edit an internal note belonging to a _different_ dispute (by supplying that note's id under any dispute id) and still receive a 400. Admin-only surface; integrity only.
- **Mitigating layers checked:** route is admin-gated (`notes/route.ts:108-114`); DELETE in the same file checks membership first — the fix is to mirror it.
- **Recommended fix:** Load the note, verify `disputeId` matches, then update (as DELETE does). Verified still present as of this audit; plan 015's notes test pins today's behavior.

### SEC-20: HOA inquiries are appended to Google Sheets with USER_ENTERED (formula injection, unauthenticated)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** API-13, SURF-15

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High for the injection itself. The exfiltration variant depends on Google asking the sheet owner for consent.
- **Files:** `src/app/api/hoa-inquiries/route.ts:53-73`
- **Affected routes:** `POST /api/hoa-inquiries`
- **Relevant code:** `:56`: `valueInputOption: "USER_ENTERED",`. The appended values include raw `data.hoaName`, `data.name` and other fields.
- **What is wrong:** A value starting with `=` is evaluated as a formula in the ops sheet. This is a different issue from the rejected "PII in ops email" item.
- **Exploit / failure scenario:** `hoaName: '=HYPERLINK("https://evil.example","Approve")'` turns into a phishing link. `=IMPORTXML(...)` can exfiltrate earlier inquiries once the sheet owner allows external data. The route has no throttle either.
- **Mitigating layers checked:** Google warns before sending data to external parties. It does not warn about HYPERLINK or IMAGE.
- **Real-world impact:** Phishing of ops staff, and a possible leak of prospect PII.
- **Recommended fix:** Use `valueInputOption: "RAW"` or prefix values with `'`. Add a rate limit or CAPTCHA.
- **Tests needed:** A value starting with `=` is stored literally.

### SEC-21: SetupIntent / ephemeral-key minting is unthrottled (card-testing surface)

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PAY-12

> **Adversarial review (lead auditor):** Kept LOW (Stripe Radar is the backstop).

- _Auditor's original grading:_ LOW | **Confidence:** High for the missing limit; the impact depends on Radar.
- **Files:** `src/app/api/(payments)/create-setup-intent/route.ts:36-43`; `src/app/api/stripe/payment-sheet-params/route.ts:69-94`
- **Affected routes:** the two routes above
- **What is wrong:** Any account can mint unlimited SetupIntents and ephemeral keys and confirm them client-side against arbitrary cards. The only protection is Stripe Radar.
- **Recommended fix:** Add a per-user rate limit and Radar rules for SetupIntents. Rate-limiting infrastructure was deferred (plans/README.md, uploads).
- **Tests needed:** The limiter returns 429.
- **Related:** —

### SEC-22: Rental end accepts arbitrary external damagePhotos URLs

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** TRUST-05

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High
- **Files:** `src/app/api/rentals/[id]/end/route.ts:31-41`, `src/dal/rentals.dal.ts:2952-2954`
- **Affected routes:** `POST /api/rentals/[id]/end`
- **Relevant code:** `damagePhotos: z.array(z.string().url()).max(MAX_DAMAGE_PHOTOS).optional()`
- **What is wrong:** Unlike the dispute-evidence and damage-photo _upload_ routes (which
  return server-generated blob URLs), `end` stores whatever URLs the owner sends. An owner
  can attach arbitrary external URLs (or another user's blob URL) as "damage photos."
- **Exploit / failure scenario:** Owner ends a rental with
  `damagePhotos:["https://attacker.example/track.png"]`; the renter/dispute reviewer renders
  it (view-time tracking / misleading evidence).
- **Mitigating layers checked:** URLs are stored/displayed only — not fetched server-side
  (the rental-agreement PDF template does not include them), so no server SSRF.
- **Real-world impact:** Low — the owner is attaching content to their own damage report;
  worst case is a tracking pixel or misleading image against their counterparty.
- **Recommended fix:** Accept only blob URLs under this rental's `rentals/<id>/damage/` prefix
  (the upload route already writes there), mirroring the profile-upload prefix guard (plan 010).
- **Mobile compat:** the app uploads via `POST /api/rentals/[id]/damage-photos` then passes
  the returned urls, so a prefix check is transparent to it.

### SEC-23: The web /dashboard/listings/[id]/edit page renders any listing without an ownership check

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** SURF-12

> **Adversarial review (lead auditor):** Kept LOW (web UI retiring).

- _Auditor's original grading:_ LOW | **Confidence:** High. An attacker needs the listing's UUID, and saving is protected by the service's ownership check.
- **Files:** `src/app/dashboard/listings/[id]/edit/page.tsx:54-64, 88-89`
- **Affected routes:** page `/dashboard/listings/[id]/edit`
- **Relevant code:**

```
54  const currentUser = await getCurrentUser();
59    listingDAL.getListingById(id, currentUser.id),
64  if (!listing) return notFound();
89    <RevisionsRequestedBanner rejectionReason={listing.rejectionReason} />
```

- **What is wrong:** Any session user can load any listing into the edit form: pending, rejected, inactive, or in another community. The page also shows the admin's `rejectionReason`, which the API deliberately withholds from non-owners.
- **Exploit / failure scenario:** A user who has a listing's id views that listing's hidden details and moderation notes.
- **Mitigating layers checked:** `PATCH` enforces ownership through `verifyOwnership`, so the listing cannot be modified.
- **Real-world impact:** Disclosure of hidden listings and admin moderation notes.
- **Recommended fix:** Return `notFound()` unless the caller is the owner.
- **Tests needed:** A non-owner requesting the page gets 404.

### SEC-24: Admin-namespace legal-document download route has no auth check

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** SURF-16

> **Adversarial review (lead auditor):** Kept LOW (the documents are public by design).

- _Auditor's original grading:_ LOW | **Confidence:** High. The documents are public PDFs.
- **Files:** `src/app/api/admin/legal-documents/[documentId]/[version]/download/route.ts:14-45`
- **Affected routes:** GET /api/admin/legal-documents/[documentId]/[version]/download
- **Relevant code:**

```
14 async function getHandler(
19     const { documentId, version } = await params;
32     const documentVersion = await legalDocumentDAL.getVersion(
45     return NextResponse.redirect(documentVersion.url);
```

- **What is wrong:** This is the only `/api/admin` route with no admin gate, and the proxy does not cover `/api/admin`. No UI calls it.
- **Exploit / failure scenario:** An anonymous caller can list any version of any legal document, including superseded ones.
- **Mitigating layers checked:** The content is public.
- **Real-world impact:** Minimal. This is a hardening and consistency gap.
- **Recommended fix:** Add `requireAdminResponse()` or delete the route.
- **Tests needed:** An anonymous request gets 401.

## Verified clean — authentication & authorization (auth auditor)

- **Account pre-hijacking does NOT work (scope 1a).** `handleOAuthUserInfo` (`node_modules/better-auth/dist/oauth2/link-account.mjs:20-29`): `requireLocalEmailVerified = accountLinking?.requireLocalEmailVerified ?? true`; the link is refused when `requireLocalEmailVerified && !dbUser.user.emailVerified`. The app does not set `requireLocalEmailVerified`, so it is `true`. An attacker's unverified local account (created with a victim's email) therefore will NOT be linked to the victim's Google/Apple login, and the victim is never signed into the attacker's account. The attacker's password never becomes valid for the victim. (Residual is the SEC-18 lockout, not takeover.)
- **Privileged fields cannot be set via better-auth endpoints (scope 1b).** No `user.additionalFields` are configured (`build-auth-options.ts`), so `getFields(...,"user","input")` yields only core fields; `parseUserInput`/`parseInputData` (`node_modules/better-auth/dist/db/schema.mjs:59-115`) drop everything else. `/sign-up/email` (`sign-up.mjs:148`) destructures `{name,email,password,image,callbackURL,rememberMe,...rest}` and passes only parsed additional fields (none). `userType`/`status`/`emailVerified`/`stripeConnectedAccountId` cannot be injected through `/sign-up/email` or `/update-user`; `/update-user` also hard-blocks `email` (`update-user.mjs:49`).
- **OAuth callback CSRF / expo-origin (scope 1e).** `@better-auth/expo` `onRequest` (`node_modules/@better-auth/expo/dist/index.js:45-61`) applies `expo-origin` only when the request has **no** `origin` header; every browser request carries a browser-set (unspoofable) Origin, so the override never fires for a browser attacker. OAuth `state` is signed/encrypted and checked (`state.mjs:74-131`); session cookie is httpOnly + SameSite=Lax + secure-in-prod (`nextCookies()` defaults). Matches the prior "Missing CSRF" rejection with fresh confirmation.
- **Cron secret (scope 7).** `verifyCronSecret` (`src/lib/api/verify-cron-secret.ts`) fails closed when `CRON_SECRET` is unset (500) and uses `timingSafeEqualStrings` (`src/lib/api/timing-safe-equal.ts`, length-check then `crypto.timingSafeEqual`). All 13 `/api/cron/*` routes call it first (verified each). `/api/internal/*` both use the same constant-time compare against `INTERNAL_API_SECRET` and reject the placeholder value.
- **Test routes (scope 7).** All five `/api/test/*` fail closed: `NODE_ENV === "production" || E2E_TEST !== "1"` → 404 (verified each file). `E2E_TEST` is set only in `playwright.config.ts`, `e2e-tests.yml`, `.env.test`; not in `deploy.yml`/`deploy-staging.yml`/`vercel-preview.yml`. Residual preview-deploy risk matches the accepted prior rejection. `/api/push/test` is auth-gated and only messages the caller's own devices.
- **IDOR sweep — money & bookings.** Rental detail/actions check owner|renter|admin before side effects: `GET /api/rentals/[id]` (`route.ts:118`), approve/decline/end/start/instructions/damage-photos/retry-deposit all verify `ownerId`/`renterId` in route or service (`rental-service.ts:389`, `cancellation-service.ts:520-529`, `payment-lifecycle-service.ts:495`). Service bookings check requester|provider (`services/bookings/[id]/route.ts:287`, `/accept|/complete|/decline` provider-only in `service-booking-service.ts:276,609,649`, `/payment-lifecycle:45`, `/cancellation-preview:87`). List routes scope by `renterId`/`ownerId`/`requesterId`/`providerId` in the DAL WHERE (`rentals.dal.ts` getters; `service-booking.dal` dashboard getters).
- **IDOR sweep — content.** Listing images/availability/status/update/delete verify `listing.owner.id === userId` (or `ForbiddenError` in `ListingService.verifyOwnership`), and image/availability sub-deletes also pin `listingId` in the WHERE (`images/[imageId]/route.ts:35-38`, `availability/[blockId]`). Service listing edit/photos/deactivate/reactivate/delete verify `providerId` (`service-listing-service.ts:159,241,311,359,385,415`); `setPhotos` restricts to URLs the listing already owns. Conversations enforce participant membership in the DAL (`requireParticipant`, `getConversationDetails:641-648`); notifications mark-read scope `userId` in WHERE (`notifications.dal.ts`); push unsubscribe checks `existing.userId === userId`; reviews check participant (`blind-review-service.ts:46-51`); provider-profile PATCH is self-only. `needs/[id]` edit/close/delete check `createdByUserId`/admin.
- **Cross-community invariant (scope 6).** The stated symmetric-visibility rule (multi-community R5/R8, requiring BOTH viewer and owner `community_visibility(X).is_visible`) is enforced on search (`listing.dal.ts:713-899` inner-join to `community_visibility`, fail-closed on empty set), service browse (`service-listing.dal.ts:273-326`), rental listing detail (`listings/[listingId]/route.ts:96-105`), service listing detail (`services/listings/[id]/route.ts:52-63`), needs feed/detail (`needs/route.ts:79-121`, `needs/[id]/route.ts:44-59`), and provider profile (`services/providers/[userId]/route.ts:27-50`, listings scoped to shared visible set). Rental/service booking creation derives community server-side and blocks own-listing; approval charges only the owner-approved request.
- **Admin authz (scope 4).** Every `/api/admin/**` route calls `requireAdminResponse()` (or an inline `isAdmin` 403) before data access (verified all 34). Non-admin admin-branches (`disputes` resolve/state/notes/audit/chargeback-evidence) each gate on `isAdmin`; dispute state transitions are admin-only for all reachable targets (`state-machine.ts:18-23` — every target in `VALID_TRANSITIONS` is in `ADMIN_ONLY_STATES`), so the missing party-check noted in plans/README is not exploitable by a non-admin. Verify/deny membership and role/status changes are audit-logged.
- **PII on the wire.** `GET /api/disputes/[id]` returns the participant view (no internal notes / Stripe ids / emails) to non-admins; `GET /api/services/bookings/[id]` and the disputes list explicitly strip counterparty email; payment-history selects `counterpartyName` only. Payment-method ids are not serialized to the counterparty on booking/rental detail.

## Verified clean — API/OWASP (API auditor)

- **SQL injection:** none found.
  - `sql.raw` appears only in seeds.
  - The needs feed binds every value (`neighborhood-needs.dal.ts:256-285`).
  - Search sort goes through a switch (`listing.dal.ts:190-224`).
  - Message search escapes `%`, `_` and `\` (`messages.dal.ts:181-183`).
  - Search `ilike` is scoped by community, and the query is capped at 200 characters.
- **PDF agreements:** every field goes through `escapeHtml` (`generate-*-agreements/template.ts:57-69 / 52-63`). The page is loaded with `setContent`, the only image is a `data:` logo and no URL comes from a user. The internal routes are gated by `INTERNAL_API_SECRET` compared in constant time.
- **XSS on the web:** `dangerouslySetInnerHTML` appears only with static data (`app/page.tsx:120`, `meta-pixel.tsx:42`), and React escapes everything else.
- **Upload handling:**
  - All image uploads are re-encoded to JPEG by sharp.
  - Blob paths come from server-chosen prefixes, and names are reduced to `[a-zA-Z0-9.-]`.
  - Blobs cannot be overwritten, because `allowOverwrite` is false.
  - No SVG or HTML is ever stored.
  - Legal documents are admin-only.
- **Upload deletion:** listing-image delete and reorder are scoped by listing ID (`images/[imageId]/route.ts:32-40`, `reorder/route.ts:86-97`). Service photos use a subset check (`service-listing-service.ts:315-322`). Availability-block delete is scoped (`availability/[blockId]`).
- **Mass assignment elsewhere:** Listing create and update use whitelisted Zod input with a server-set `ownerId`, `communityId` and approval fields (`listing.dal.ts:262-303`). Service listings check that `communityId` matches the caller's membership (`services/listings/route.ts:98-104`). Needs and bookings take community and owner from the server. Reviews take `userId` from the session. Admin community PATCH uses a field whitelist.
- **Redirects:**
  - Stripe account-link and portal return URLs are built on the server.
  - The login `callbackUrl` payloads `/\evil.com` and `/%09/evil.com` get past `getSafeCallbackUrl`, but better-auth's originCheck regex rejects them at `trusted-origins.mjs:14`, so sign-in fails and no redirect happens.
- **SSRF:** Geocoding calls a fixed host with encoded input (`geocoding/index.ts:26-32`). OpenAI fetches image URLs on OpenAI's side. `remotePatterns` has no wildcards.
- **Secrets and admin routes:** Cron and internal secrets are compared in constant time, and every cron route calls `verifyCronSecret`. Every admin route checks for an admin, except the public legal-document download.
- **Data exposure:** The dispute participant projection strips emails, internal notes and Stripe ids (`participant-view.ts`). Notifications are scoped by `userId`. Pagination is clamped for messages, needs, reviews and schedule.
- **Headers:** HSTS preload, `frame-ancestors 'none'`/XFO DENY, nosniff and Referrer-Policy are set. No CORS headers are sent.

## Verified clean — trust boundaries (trust auditor)

- **Reviews** `POST/GET /api/reviews`: reviewee + role derived, participant + completion +
  window enforced server-side; rating `z.int().min(1).max(5)`; duplicate via DAL conflict.
  `reviews/services/blind-review-service.ts:47-70,300-312,340-366`; schema
  `reviews/schemas/blind-review-schema.ts:3-15`.
- **Dispute create** `POST /api/disputes`: body carries only ids/reason/description — no
  amounts/roles/outcomes; role derived, party/one-active/prior-resolved/filing-window/
  rate-limit all server-side. `disputes/route.ts:96-146`, `dispute-creation-service.ts:158-210,303-411`.
- **Dispute evidence** `POST /api/disputes/[id]/evidence`: party + status + deadline + per-user
  limit checked; image URL is server-generated blob (no client URL). `.../evidence/route.ts:47-166`.
- **Service listing create** `POST /api/services/listings`: client `communityId` validated
  against the caller's membership. `services/listings/route.ts:99-104`.
- **Service booking create/accept**: price = listing rate × hours server-side; accept is
  provider-only + atomic claim + Connect-gated + amount from stored row.
  `service-booking-service.ts:64-124,267-337`; `service-booking.dal.ts:241-261`.
- **Provider profile PATCH** `/api/services/providers/[userId]`: `sessionUserId !== targetUserId`
  → Forbidden; only `bio` writable. `providers/[userId]/route.ts` patchHandler.
- **Visibility primary-lock**: hiding the primary community is rejected server-side.
  `src/dal/community.dal.ts:1092-1099`. (Scoping gap is SEC-08.)
- **retry-deposit**: renter-only, requires `depositHoldStatus==='failed'` and rental not
  started. `payment-lifecycle-service.ts:495-511`.
- **Rental approve**: ownership (`rental-service.ts:389`), atomic `pending|failed→processing`
  claim (`:457`; `src/dal/rentals.dal.ts:1884-1896`), Connect gating, amounts from stored row.
- **Rental start/end/decline/cancel**: ownership + status guards in the DAL
  (`rentals.dal.ts:1981,2774,2919`); refund tiers server-computed
  (`cancellation-service.ts:126-158`, `refund-calculations.ts`).
- **Listing detail** `GET /api/listings/[listingId]`: browseable-status + both-parties-visible,
  404 (not 403), `approvalStatus`/`rejectionReason` stripped for non-owners.
  `listings/[listingId]/route.ts:88-113`.
- **Listing image upload / reorder**: upload is a file → server-generated blob URL
  (`listing-service.ts:80-158`); reorder takes an array of image **UUIDs**, owner-checked
  (`.../images/reorder/route.ts:27,55`); create/edit do not persist client image URLs.
- **accept-legal-documents / signup**: server resolves the current TOS/Privacy versions;
  client cannot assert a version. `auth-service.ts:227-278`.
- **Stripe return/refresh URLs**: built server-side from `NEXT_PUBLIC_APP_URL` + fixed paths,
  never from the body (`create-account-link/route.ts:23-61`); `create-account-session` takes
  only a `mode` query, no client URL.
- **update-onboarding-status**: readiness pulled live from Stripe, `fromJitAccept` only tags
  a log event. `stripe/update-onboarding-status/route.ts:30-72`.
- **Push subscribe/unsubscribe**: native token format-validated; DELETE checks
  `existing.userId === userId` before deactivating (can't silence another user's device).
  `validators.ts:34-39`, `push/subscribe/route.ts:154-173`.
- **better-auth Expo/reset boundary**: `trustedOrigins` includes `hoador://`, `hoador://*`,
  Apple, dev `exp://` only in development (`build-auth-options.ts:22,94-100`). OAuth `state`
  is server-signed/DB-verified and the Expo plugin only appends the cookie to a redirect that
  is already an origin-validated `trustedOrigin` (`node_modules/@better-auth/expo/dist/index.js:62-84`;
  `node_modules/better-auth/dist/api/middlewares/origin-check.mjs:42-68`). Password-reset
  `redirectTo` is a fixed server-built `${NEXT_PUBLIC_APP_URL}/reset-password`
  (`auth/forgot-password/route.ts:29`), not client-chosen.
- **Header/URL metadata**: URL building uses `NEXT_PUBLIC_APP_URL` (trusted env, per
  README rejected-findings), never `Host`/`X-Forwarded-Host`; `x-forwarded-for`/`x-real-ip`
  used only for audit/legal records, not authz (`src/lib/utils/request-context.ts:7-27`).
- **Mobile hygiene**: session only in SecureStore, `credentials:'omit'` + manual `Cookie`
  (`src/api/client.ts:100-113`); cleartext ATS allowed only outside production
  (`app.config.ts:75-77`); only publishable Stripe key / public Firebase config embedded.

## Auditor open questions — authentication & authorization

- **Rate-limit storage at runtime.** better-auth uses in-memory rate-limit storage (`create-context.mjs:174`, no `secondaryStorage`), so even the throttled native endpoints are per-serverless-instance on Vercel — I can confirm the config but not the deployed instance count / concurrency, which sets the real brute-force ceiling. (SEC-04.)
- **Trusted-proxy / client IP.** `getIp` (`@better-auth/core/dist/utils/ip.mjs:196-220`) trusts `x-forwarded-for` with no `trustedProxies` configured; on Vercel the platform sets XFF, but if any route/limiter keys on client IP, spoofability depends on the edge stripping inbound XFF — infra-dependent, not verifiable from code.
- **Session `expiresIn`/`updateAge` in prod.** No `session` block is configured, so library defaults (7d / 1d refresh) apply unless overridden by env/runtime I cannot see; this sets how long an un-revoked session (SEC-01/03) survives.

## Auditor open questions — API/OWASP

- **Sharp decompression bombs:** `limitInputPixels` is left at its default of about 268 MP, uploads are capped at 10 MB, and the pipeline calls `.rotate()`. I could not measure memory use. Consider an explicit limit of around 100 MP.
- **Suspension is never enforced:**
  - Neither `getCurrentUser` nor the proxy checks `status`.
  - `POST /api/onboarding` sets `status:"active"` unconditionally (`onboarding/route.ts:58-61`).
  - For the auth auditor.
- **Community `verificationStatus` gates nothing:** `pending` and `denied` members can still transact (`community.dal.ts:789-802`). Is that intended?
- **Distance oracle:** Needs `distanceMiles` (a raw haversine float) and the search's `calculatedDistance` (raw) could combine with re-geocoding your own address to trilaterate a requester's or owner's home coordinates. Not measured.
- **Stored payload bloat:**
  - Some fields have no size limit: need `description` (text), listing `specifications` (jsonb, editable after approval without re-review), dispute `description` and `denialReason`.
  - These could push the feed or search pages over Vercel's 4.5 MB response limit.
  - Not verified.
- **Geocoding quota:** `PATCH /api/profile` with an address calls OpenCage every time, with no throttle. Exhausting the quota would break the onboarding address step. Plan limits are unknown.
- **Image optimizer:** `remotePatterns` includes `cdn.jsdelivr.net` and `avatars.githubusercontent.com` (`next.config.ts:39,45`), and nothing uses either host. That leaves an unauthenticated `/_next/image` proxy for arbitrary npm and GitHub images, with billing exposure. Separately, the CSP allows `'unsafe-inline' 'unsafe-eval'` in production (`:103`).
- **Agreement PDFs:** They are public at predictable `rental-agreements/<requestId>.pdf` / `service-agreements/<bookingId>.pdf` paths, because `addRandomSuffix` defaults to false in @vercel/blob 2.4. The UUID is the only capability, and the mobile code calls these URLs "pre-signed", which they are not.
- **Push subscription reassignment:** `POST /api/push/subscribe` with an existing endpoint or token moves that row to the caller (`notifications.dal.ts:578-592`, `697-709`). Exploiting it needs the victim's secret endpoint or token.

## Auditor open questions — trust boundaries

- **Rental dispute filing window is a unified "≤24h after return confirmed" rule**
  (`src/dal/dispute.dal.ts:920-962`), but mobile Appendix C / Req 19.1.2 tells the app to display
  reason-specific windows (damage 7d post-end, payment 30d, etc.). The server _is_
  authoritative (it rejects), so this is not a client-only-enforcement bypass; it is a
  likely display/UX mismatch where the app may offer "File a dispute" for windows the server
  will refuse (service side uses reason-specific `validateServiceFilingWindow`, rentals do not).
  Worth confirming which behavior is intended before treating as a defect.
- **Cross-user messaging**: `POST /api/messages/conversations` accepts any `recipientId` with
  a free-text `listingName` and optional listing id; self-message is blocked
  (`messages.dal.ts:263`) but there is no community-co-membership or listing-ownership check,
  so any authenticated user can open a thread with any user id. Bounded (a message to a real
  user), likely intended given "Message owner/provider" entry points, but not enforced
  server-side. Flagging rather than asserting a vulnerability.
