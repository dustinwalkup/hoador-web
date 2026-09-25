# Plan R-LOW-SEC: Low-severity security/privacy sweep — dispute notes, HOA inquiries, admin legal-document auth, unverified-signup squatting + enumeration, mobile cache encryption

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise. **This plan has five independently
> landable parts (A–E).** Land and verify one part at a time; a STOP or test
> failure in one part does not block the others.
>
> **Drift check (run first, from `hoador-web`)**:
> `git diff --stat 29fe557..HEAD -- src/app/api/disputes/[id]/notes/route.ts src/dal/dispute.dal.ts src/app/api/hoa-inquiries/route.ts src/constants/rate-limits.ts src/app/api/admin/legal-documents src/services/better-auth/build-auth-options.ts src/features/auth/services/auth-service.ts src/app/api/auth/signup/route.ts src/dal/user.dal.ts src/services/resend .github/workflows/cron-jobs.yml`
> and, from `hoador-mobile`:
> `git diff --stat -- src/state/mmkv.ts src/state/query-persister.ts src/state/query-provider.tsx app.config.ts package.json`
> (mobile has no baseline commit pin — diff against its own HEAD at pickup and
> compare "Current state" against live code first). On any change, compare
> "Current state" against live code first; a mismatch is a STOP condition.

## Status

- **Priority**: P3 · **Effort**: M (split A–E: A, B, C, E are S; D is M) ·
  **Risk**: LOW (Parts A, B, C, E), MED (Part D — changes better-auth signup
  config and adds a new cron that deletes rows)
- **Depends on**: none
- **Category**: security / privacy · **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: SEC-19, SEC-20, SEC-18, PRIV-12, PRIV-14 (SEC-24 is verify-only here; R-TEST-15 fixes it)

## Why this matters

Six independent LOW findings, bundled per the roadmap's "Remaining LOW
findings" step:

- **SEC-19** — an admin can overwrite a dispute-internal-note belonging to a
  _different_ dispute (the ownership check runs after the write).
- **SEC-20** — the public, unauthenticated HOA-inquiry form appends raw user
  input to Google Sheets with `USER_ENTERED`, so a value starting with `=` is
  evaluated as a formula (phishing links, or exfiltration via `IMPORTXML` if
  the sheet owner ever grants external-data consent); the route has no rate
  limit either.
- **SEC-24** — the only `/api/admin/*` route with no admin check.
- **SEC-18** — email/password signup never requires verification, so an
  attacker can squat `victim@example.com` and never verify it. When the real
  owner later tries **Google** sign-in with that email, better-auth's
  trusted-provider linking refuses to link to an unverified local account, and
  the victim can't self-register either (email taken) — a lockout only
  support can clear today.
- **PRIV-12** — the same signup route returns a distinguishable 409 for an
  existing email and 200 for a new one, letting an attacker enumerate
  registered emails.
- **PRIV-14** (mobile) — the React Query cache, which holds message content,
  payment-method summaries and profile data, is persisted to an unencrypted
  MMKV file on disk, readable from an Android backup by default (no
  `allowBackup: false`).

None of the five is HIGH-impact — that's why they're LOW/P3 — but SEC-18 and
PRIV-12 both live in `signUpEmail`'s error path and interact with each other
non-trivially (see Part D's CRITICAL INTERACTION below), which is why they're
one Part rather than two.

## Current state

### Part A — SEC-19: dispute internal note write-then-check

- `src/app/api/disputes/[id]/notes/route.ts` `putHandler` (~98-166): admin
  check at ~108-114 (`isAdmin` from `getAuthenticatedUserResponse()`), then
  ~142 `const updatedNote = await disputeDAL.updateInternalNote(noteId, content);`
  (writes to whatever `noteId` names, no `disputeId` in the WHERE), then
  ~145-150 checks `updatedNote.disputeId !== disputeId` and returns 400 — the
  wrong dispute's note is already overwritten by the time this fires.
- `dispute.dal.ts:1472-1494` `updateInternalNote(noteId, content)`:
  `UPDATE dispute_internal_notes SET content=... WHERE id = noteId RETURNING *`.
  `DELETE` in the same file (~180-251 in the route, DAL's `deleteInternalNote`
  at `:1500`) does it right today: it loads the note, confirms
  `disputeId` first, 404s, _then_ deletes — the pattern to mirror.
- One caller of `updateInternalNote` in non-test code (confirmed:
  `grep -rn "updateInternalNote(" src --include=*.ts` → the DAL definition and
  this one route).

### Part B — SEC-20: HOA-inquiry Sheets injection + no rate limit

- `src/app/api/hoa-inquiries/route.ts` postHandler: no auth (by design —
  public lead form), no `enforceRateLimit` anywhere in the file (confirmed:
  no import of `rate-limit` or `getClientIP`). `:53-73`
  `sheets.spreadsheets.values.append({ valueInputOption: "USER_ENTERED", ... })`
  with a 10-column `values` array: `timestamp` (server-generated, safe),
  `data.hoaName`, `data.city`, `data.state`, `data.name`, `data.email`,
  `formattedPhone`, `data.hoaContactName ?? ""`, `data.hoaContactEmail ?? ""`,
  `formattedHoaContactPhone` — 9 of the 10 columns are user-controlled.
- `src/features/hoa-inquiries/schema/hoa-inquiry.schema.ts`: no restriction on
  leading `=`/`+`/`-`/`@` in any string field.
- Rate-limit pattern to reuse: `src/app/api/auth/signup/route.ts` (~52-63)
  `getClientIP(request)` then
  `enforceRateLimit(\`auth:signup:ip:${ip}\`, RATE_LIMITS.SIGNUP_PER_IP.limit, RATE_LIMITS.SIGNUP_PER_IP.windowSeconds)`.
`RATE_LIMITS` (`src/constants/rate-limits.ts`) has no `HOA_INQUIRY_PER_IP`entry yet.`enforceRateLimit`is a no-op outside`NODE_ENV=production`
  (house rule) — safe to add without touching local/CI behavior.

### Part C — SEC-24: admin legal-document download has no auth

- `src/app/api/admin/legal-documents/[documentId]/[version]/download/route.ts`
  `getHandler` (14-49 in the finding, confirmed unchanged): validates
  `documentId`/`version`, loads the row, `NextResponse.redirect(documentVersion.url)`
  — no auth call at all. Pattern to reuse:
  `src/app/api/admin/metrics/route.ts` — `const adminError = await requireAdminResponse(); if (adminError) return adminError;` before any DAL call.
- No consumer besides the admin web UI: `grep -rn "admin/legal-documents" src/features src/app --include=*.tsx --include=*.ts | grep -v "route.ts\|__tests__"` →
  only `src/features/admin/hooks/use-admin-mutations.ts`. Mobile has zero
  references (`grep -rn "legal-documents" hoador-mobile/src` only matches the
  unrelated public `/api/legal-documents` route mobile actually calls, per
  `hoador-mobile/src/api/contract/legal-documents.contract.ts`).

### Part D — SEC-18 + PRIV-12: unverified-signup squatting and duplicate-email enumeration

**Read `src/services/better-auth/build-auth-options.ts` (~109-135, `emailAndPassword`
block), `src/features/auth/services/auth-service.ts` (`signUpWithEmail`,
~24-74), `src/app/api/auth/signup/route.ts` (full file), and
`node_modules/better-auth/dist/api/routes/{sign-up,sign-in,email-verification}.mjs`
before touching anything — this Part changes better-auth's own control flow,
verified directly against the installed `better-auth@1.6.23` source, not the
docs.**

- Today: `emailAndPassword: { enabled: true, autoSignIn: true, ... }`,
  `requireEmailVerification` unset (default `false`). `emailVerification` is
  already fully built: `sendOnSignUp: true`, `autoSignInAfterVerification: true`,
  `expiresIn: 24h`, `afterEmailVerification` advances
  `pending_verification → email_verified`.
- **better-auth's actual signup logic** (`sign-up.mjs:161-206`):
  ```js
  shouldReturnGenericDuplicateResponse =
    requireEmailVerification || autoSignIn === false;
  shouldSkipAutoSignIn =
    autoSignIn === false || shouldReturnGenericDuplicateResponse;
  ```
  If the email already has a row, and `shouldReturnGenericDuplicateResponse`
  is true, better-auth **hashes the submitted password anyway** (timing
  parity), calls `emailAndPassword.onExistingUserSignUp?.({user}, request)`
  if configured, and returns `{token: null, user: <synthetic, never-persisted
user with a freshly generated id>}` — a 200, not an error. If it's false
  (today's config), it throws `UNPROCESSABLE_ENTITY
USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (422) instead — the enumeration
  channel PRIV-12 flags.
  For a genuinely new email, account creation (`internalAdapter.createUser`)
  **always runs regardless of either flag** — verified by reading past the
  duplicate branch to line ~209 onward. If `shouldSkipAutoSignIn`, the new
  (real, persisted) user is returned the same shape, `{token: null, user:
createdUser}` — **indistinguishable in shape from the synthetic duplicate
  response**; the only difference is whether `user.id` exists as a row.
- **better-auth's sign-in logic** (`sign-in.mjs:230-242`): the
  `EMAIL_NOT_VERIFIED` 403 is gated **only** on `requireEmailVerification`,
  never on `autoSignIn`. So setting `autoSignIn: false` (without touching
  `requireEmailVerification`) changes signup's session-issuance and
  duplicate-detection behavior **without adding any new rejection to
  `signIn.email`** — sign-in for an already-existing unverified user keeps
  working exactly as today.
- **This matters because the mobile app depends on that today.**
  `hoador-mobile/src/features/auth/components/sign-in-form.tsx:19-22`: _"the
  backend does not enforce email verification on sign-in, an unverified user
  signs in fine and the gate lands them on verify-email — no
  EMAIL_NOT_VERIFIED handling needed."_ And
  `hoador-mobile/src/features/auth/components/sign-up-form.tsx:33-41` **always**
  calls `authClient.signIn.email(email, password)` right after
  `POST /api/auth/signup` succeeds, to persist the session cookie (the custom
  route's own session isn't relayed to the Expo client). **Setting
  `requireEmailVerification: true`, the fix the finding's prose suggests,
  would break both of these** — every mobile signup's second step would 403,
  and every returning unverified user's sign-in would 403 instead of landing
  on verify-email. **Verified this would NOT be additive-safe for mobile —
  it changes behavior on every existing unverified account, not just new
  ones — so this plan does not set it.**
- **Also verified: `requireEmailVerification: true` would not have fixed the
  squatting/lockout SEC-18 actually describes anyway.** `internalAdapter.createUser`
  runs unconditionally for a new email regardless of that flag — the row
  (and the email, `findUserByEmail`-checked on every future signup or Google
  link attempt) still gets created and stays unverified forever. The finding's
  proposed fix line ("do not create/occupy the email row... until verified")
  does not match this better-auth version's actual behavior. The only way to
  actually free a squatted email is a **TTL reap** — the finding's own
  alternative ("reap unverified accounts after a short TTL") — which this
  plan implements (Step D3).
- **CRITICAL INTERACTION (PRIV-12 × SEC-18):** if this plan sets
  `autoSignIn: false` (Step D1) to fix PRIV-12's enumeration, every duplicate
  signup now returns better-auth's synthetic `{token: null, user: {id:
<fresh, never-persisted>, ...}}` instead of throwing. `auth-service.ts`'s
  `signUpWithEmail` (~38-74) currently does:
  ```ts
  const { data: authResult, error: authError } = await tryCatch(
    auth.api.signUpEmail({ body: {...} }),
  );
  if (authError) {
    if (authError.message?.includes("already exists")) throw new ConflictError(...);
    throw new Error(...);
  }
  const userId = authResult.user.id;          // now sometimes a fake id
  if (legalDocumentsAccepted) {
    await this.recordLegalAcceptances(userId, ...);   // FK insert against a
  }                                                     // user row that doesn't exist
  ```
  `recordLegalAcceptances` (`~213-280`) inserts `legal_document_acceptances`
  rows keyed on `userId` — for the synthetic id this is an FK violation,
  caught by its own `catch` and rethrown as a generic
  `Error("Failed to record legal acceptances. Please try again.")`, which
  `handleApiError` maps to a **500**. A 500-only-for-existing-emails is a
  _new_, worse enumeration channel than the 409 it replaces. This plan closes
  it by detecting the synthetic case (Step D2) **before** calling
  `recordLegalAcceptances`, and returning the same `{redirect, userId}` shape
  either way — including the synthetic `userId` in the response is safe (it's
  an opaque UUID indistinguishable from a real one to a client; the danger
  was only ever _using_ it server-side against a nonexistent row).
- `src/app/api/auth/signup/route.ts:87-96`: `after(() => sendMetaCompleteRegistration({userId, ...}))`
  — this fires unconditionally today. For the synthetic-duplicate case it
  would report a conversion for a user that doesn't exist. This is a
  server-to-Meta call only (never serialized into the HTTP response), so
  suppressing it for the synthetic case costs nothing observable to the
  client and avoids inflating a marketing metric. `src/features/auth/hooks/use-auth-mutations.ts:56-64`
  (web) reads `response.userId` only for the client-side Meta pixel dedup
  key (`trackCompleteRegistration({eventID: response.userId})`) — this still
  fires for both real and duplicate signups after this plan (same response
  shape both times, which is the whole point); noted as an accepted,
  non-security side effect in Maintenance notes, not something to special-case
  (special-casing it would reopen the enumeration hole by making the two
  cases observably different again).
- **MOBILE VERIFIED**: `hoador-mobile/src/features/auth/components/sign-up-form.tsx:33-41`
  discards the `apiFetch('/api/auth/signup', ...)` response entirely (no
  `userId` read) — this plan's response-shape changes (none — see above) and
  the `autoSignIn: false` change are both fully transparent to it.
  `signInWithEmail(email, password)` (`sign-in.ts`) still succeeds for a
  brand-new unverified user after this plan, because `requireEmailVerification`
  stays `false` — verified above. No mobile code change, no contract change,
  no roadmap Mobile-follow-ups row for this Part.
- **Dead code, not touched by this plan**: `user.dal.ts createUserWithAddress`
  (~857) has zero non-test callers (`grep -rn "createUserWithAddress" src --include=*.ts`
  → only `src/dal/__tests__/user.dal.test.ts`). Left alone — out of scope,
  noted in Maintenance notes.
- **Account-deletion pipeline to reuse for the reap cron** (Step D3):
  `src/features/users/services/account-deletion-service.ts` `deleteOwnAccount(userId)`
  — checks 6 blocker classes (all necessarily zero for a `pending_verification`,
  never-progressed account), then `accountDeletionDAL.anonymizeUser(userId)`
  (`account-deletion.dal.ts:349-`), which rewrites `email` to a collision-free
  tombstone (`deleted+${userId}@deleted.hoador.invalid`), deletes `session`/`account`
  rows, and — critically for SEC-18 — **frees the original email** for a real
  signup or Google sign-in, then best-effort Stripe/Apple/blob cleanup
  (all no-ops for a fresh unverified signup) and an audit-log row with no PII.
  This is the exact "reap" the finding's alternative fix describes; no new
  deletion logic needs writing.

## Decisions for the maintainer

**1. `autoSignIn: false`, not `requireEmailVerification: true` (Part D).**
The finding's recommended fix names `requireEmailVerification: true`; verified
against the installed better-auth source that this would also 403 every
existing unverified user's sign-in (`sign-in.mjs:230`), breaking the mobile
sign-up flow's own follow-up sign-in call and the documented "unverified users
sign in fine" invariant, and would **not** actually stop the account
row/email from being squatted (creation is unconditional either way).
`autoSignIn: false` gets PRIV-12's fix (the same `shouldReturnGenericDuplicateResponse`
OR-condition) with none of that blast radius, and SEC-18's squatting/lockout
is closed separately by the reap cron (Decision 2). **Recommendation:
`autoSignIn: false`, plus the reap cron — proceed as written.**

**2. Reap TTL for unverified signups (Part D, Step D3).** Long enough that a
real user who doesn't check email for a few days isn't punished; short enough
that a squatted email doesn't lock out its real owner for long.
**Recommendation: 7 days** (the verification link itself expires in 24h, and
resend is available at any time from the app/web with no session required —
7 days is a full week of grace past that before assuming abandonment).
Capped at 200 rows reaped per run (same batch-and-log-overflow pattern as
R-PERF-04 Part E), matching this codebase's existing "cap + log if the cap
binds" style rather than an unbounded delete loop.

**3. PRIV-14 (Part E): new MMKV instance id, not an in-place encryption
migration.** Enabling `encryptionKey` on the existing `hoador-app` id would
try to decrypt already-written plaintext data, which is unsupported (MMKV's
encryption is chosen at file-open time; there is no "read plaintext, migrate
to encrypted" mode). **Recommendation: open the _old_ `hoador-app` id once
more (unencrypted, as it always has been), `clearAll()` it to scrub the
existing plaintext PII, then create the real store under a new id
(`hoador-app-v2`) with `encryptionKey` from SecureStore.** The persisted query
cache is designed to be disposable (24h `MAX_AGE`, rebuilt from the network on
a cache miss) — losing it once on this app update is the same user experience
as an ordinary cold start after 24h, not a regression.

## Commands

| Purpose                        | Command                                                                             | Expected                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Typecheck (web)                | `bun run type-check`                                                                | exit 0                                                |
| Lint (web)                     | `bun run lint`                                                                      | exit 0                                                |
| Tests (web, targeted per part) | `bun run test:run <paths>`                                                          | all pass                                              |
| Full tests (web)               | `bun run test:run`                                                                  | all pass                                              |
| YAML syntax check              | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"` | no error                                              |
| Typecheck (mobile)             | `npx tsc --noEmit` (from `hoador-mobile`)                                           | exit 0                                                |
| Lint (mobile)                  | `npm run lint` (from `hoador-mobile`)                                               | exit 0                                                |
| Tests (mobile)                 | `npm test` (from `hoador-mobile`, or a filtered path)                               | all pass                                              |
| Install `expo-crypto` (Part E) | `npx expo install expo-crypto` (from `hoador-mobile`)                               | added to `package.json` at the SDK-57-blessed version |

## Scope

**In scope**:

- Part A: `src/app/api/disputes/[id]/notes/route.ts`, `src/dal/dispute.dal.ts`
  (`updateInternalNote`), tests.
- Part B: `src/app/api/hoa-inquiries/route.ts`, `src/constants/rate-limits.ts`,
  tests.
- Part C: `src/app/api/admin/legal-documents/[documentId]/[version]/download/route.ts`,
  tests.
- Part D: `src/services/better-auth/build-auth-options.ts`,
  `src/features/auth/services/auth-service.ts`, `src/app/api/auth/signup/route.ts`,
  `src/dal/user.dal.ts` (new `userExists`, new `getStaleUnverifiedUserIds`),
  `src/services/resend/send-existing-user-signup-alert-email.ts` (new),
  `src/app/api/cron/reap-unverified-signups/route.ts` (new),
  `.github/workflows/cron-jobs.yml`, tests.
- Part E (mobile repo): `src/state/mmkv.ts`, `src/state/query-provider.tsx`,
  `app.config.ts`, `package.json` (+ lockfile), tests.

**Out of scope**: `createUserWithAddress` dead-code removal (Part D, noted
only); PRIV-05/PRIV-09/PRIV-11 (already DONE, different findings); extending
`query-persister.ts`'s `UNPERSISTED_QUERY_KEYS` further (Epic 15's own
follow-up per its existing comment — Part E's encryption fix is a broader,
complementary control, not a replacement); SEC-23 (web-UI-only, this plan's
scope is the two repos' APIs/native storage, and SEC-23 has its own line in
the roadmap); rewriting `account-deletion-service.ts` (reused as-is).

## Git workflow

hoador-web: work directly on `develop`. Do not commit — leave changes
uncommitted. hoador-mobile: no `develop` branch in this repo (per its
`AGENTS.md`) — work directly on the checked-out branch, do not commit unless
the maintainer says otherwise.

## Steps

### Part A — SEC-19: atomic ownership check on note update

**A1.** In `dispute.dal.ts`, change `updateInternalNote`'s signature to take
`disputeId`:

```ts
async updateInternalNote(
  disputeId: string,
  noteId: string,
  content: string,
): Promise<typeof disputeInternalNotes.$inferSelect> {
  try {
    const [updated] = await this.db
      .update(disputeInternalNotes)
      .set({ content, updatedAt: new Date() })
      .where(
        and(
          eq(disputeInternalNotes.id, noteId),
          eq(disputeInternalNotes.disputeId, disputeId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundError("Internal note", noteId);
    }

    return updated;
  } catch (error) {
    this.handleError(error, "updateInternalNote");
  }
}
```

`and`/`eq` are already imported in this file (confirm). This makes a
cross-dispute `noteId` a no-op write (the WHERE excludes it), not a write
followed by a check.

**A2.** In `notes/route.ts`'s `putHandler`, change the call to
`await disputeDAL.updateInternalNote(disputeId, noteId, content)` and delete
the now-redundant post-write check:

```ts
if (updatedNote.disputeId !== disputeId) {
  return NextResponse.json(
    { error: "Note does not belong to this dispute" },
    { status: 400 },
  );
}
```

`NotFoundError` thrown by the DAL is mapped to 404 by the existing
`handleApiError(error)` in this route's `catch` — confirm `NotFoundError` is
already in that mapping (it is, used elsewhere in this same file for the
dispute-not-found case).

**Verify**: `bun run type-check` → exit 0.

**A3. Tests.** Extend `dispute.dal.ts`'s existing test file (or add
`src/dal/__tests__/dispute.dal.test.ts` cases if none exist for this method):
a `noteId` belonging to a different `disputeId` → `NotFoundError`, and the
underlying row's `content` unchanged (assert via a second read, or via the
mocked query builder never resolving a row). Extend
`notes/__tests__/route.test.ts` (or create it): PUT with a cross-dispute
`noteId` → 404, not 400; PUT with a matching `noteId` → 200 with updated
content.

**Verify**: `bun run test:run src/dal/__tests__/dispute.dal.test.ts src/app/api/disputes` → all pass.

### Part B — SEC-20: stop formula injection, add a rate limit

**B1.** In `hoa-inquiries/route.ts`, add a sanitizer and switch
`valueInputOption`:

```ts
/** Defense in depth: neutralize a leading formula trigger even though RAW
 *  input isn't evaluated by Sheets — a future flip back to USER_ENTERED (or a
 *  CSV export/re-import elsewhere) shouldn't reopen this. */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);
function sanitizeSheetValue(value: string): string {
  return value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0])
    ? `'${value}`
    : value;
}
```

Wrap every user-controlled value in the `values` array (`data.hoaName`,
`data.city`, `data.state`, `data.name`, `data.email`, `formattedPhone`,
`data.hoaContactName ?? ""`, `data.hoaContactEmail ?? ""`,
`formattedHoaContactPhone` — **not** the server-generated `timestamp`) with
`sanitizeSheetValue(...)`, and change `valueInputOption: "USER_ENTERED"` to
`valueInputOption: "RAW"`.

**Verify**: `bun run type-check` → exit 0.

**B2.** Add the rate limit. In `src/constants/rate-limits.ts`, add:

```ts
HOA_INQUIRY_PER_IP: { limit: 5, windowSeconds: 60 * 60 },
```

In `hoa-inquiries/route.ts`, import `getClientIP` from
`@/lib/api/route-helpers` and `enforceRateLimit` from `@/lib/api/rate-limit`,
and add, right after parsing/validating the body:

```ts
const ipAddress = getClientIP(request);
if (ipAddress) {
  await enforceRateLimit(
    `hoa-inquiry:ip:${ipAddress}`,
    RATE_LIMITS.HOA_INQUIRY_PER_IP.limit,
    RATE_LIMITS.HOA_INQUIRY_PER_IP.windowSeconds,
  );
}
```

A thrown `RateLimitedError` is already mapped to 429 by `handleApiError`,
already used in this route's `catch`.

**Verify**: `bun run type-check` → exit 0.

**B3. Tests.** New/extended `src/app/api/hoa-inquiries/__tests__/route.test.ts`:
`hoaName: '=HYPERLINK(...)'` → the mocked `sheets.spreadsheets.values.append`
call's `requestBody.values` has that field prefixed with `'`, and
`valueInputOption: "RAW"`; a 6th request within the window from the same IP
(mock `enforceRateLimit`/`rateLimitDAL.consume` per this codebase's existing
rate-limit test pattern) → 429.

**Verify**: `bun run test:run src/app/api/hoa-inquiries` → all pass.

### Part C — SEC-24: verify only (owned by R-TEST-15)

SEC-24 moved to Phase 2: **R-TEST-15 Step 0** adds the `requireAdminResponse()`
gate to the download route, and its glob-driven admin test covers it. Don't
re-implement it here.

**C1.** Confirm the gate landed: `grep -n "requireAdminResponse" "src/app/api/admin/legal-documents/[documentId]/[version]/download/route.ts"`
→ one match at the top of `getHandler`. If it's missing, R-TEST-15 hasn't
landed yet. STOP and run that plan first rather than fixing it here.

**Verify**: `bun run test:run src/app/api/admin/__tests__` (R-TEST-15's admin
glob test) → passes and includes the download route.

### Part D — SEC-18 + PRIV-12: signup config, synthetic-response handling, reap cron

**D1. `autoSignIn: false` + notify the real owner on a duplicate attempt.** In
`build-auth-options.ts`'s `emailAndPassword` block:

```ts
emailAndPassword: {
  enabled: true,
  autoSignIn: false, // was true — SEC-18/PRIV-12, see Decision 1
  onExistingUserSignUp: async ({ user }) => {
    const { sendExistingUserSignUpAlertEmail } = await import(
      "@/services/resend/send-existing-user-signup-alert-email"
    );
    try {
      await sendExistingUserSignUpAlertEmail({ to: user.email, firstName: user.name });
    } catch (error) {
      console.error("Failed to send existing-user signup alert email:", error);
    }
  },
  sendResetPassword: async ({ user, url }) => { /* unchanged */ },
  revokeSessionsOnPasswordReset: true,
  onPasswordReset: async ({ user }) => { /* unchanged */ },
},
```

Create `src/services/resend/send-existing-user-signup-alert-email.ts`,
mirroring `send-verification-email.ts`'s structure (logo attachment, subject,
HTML body via `escapeHtml` on `firstName`): "We noticed a sign-up attempt
using your email at Hoador. If this was you trying to create a _second_
account, you already have one — use **Forgot password** to get back in. If
this wasn't you, no action is needed; your account is safe." No link to
click (this is a notice, not an action).

**STOP condition**: `auth.api.signUpEmail` is called from `signUpWithEmail`
without forwarding `ctx.request` — confirm `onExistingUserSignUp`'s handler
signature tolerates a `request` of `undefined` (it does; better-auth calls it
as `onExistingUserSignUp({user}, ctx.request?.clone())`, and this plan's
handler above doesn't read the second argument at all).

**Verify**: `bun run type-check` → exit 0.

**D2. Detect the synthetic-duplicate response before recording legal
acceptances.** Add a cheap existence check to `user.dal.ts`, near
`getStripeCustomerId`:

```ts
/** Row existence only — no join, no error on absence. For distinguishing a
 *  real user id from better-auth's synthetic duplicate-signup response
 *  (SEC-18/PRIV-12), which returns the same shape either way. */
async userExists(userId: string): Promise<boolean> {
  try {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    this.handleError(error, "userExists");
  }
}
```

In `auth-service.ts`'s `signUpWithEmail`, after `const userId = authResult.user.id;`:

```ts
const userId = authResult.user.id;
const isDuplicateSignUp = !(await userDAL.userExists(userId));

if (isDuplicateSignUp) {
  // better-auth detected an existing account for this email and returned a
  // synthetic, never-persisted user (autoSignIn: false ⇒
  // shouldReturnGenericDuplicateResponse, see Current state). Recording legal
  // acceptances against this id would FK-violate. Return the identical
  // success shape a real new signup gets — anti-enumeration is the point.
  return {
    redirect: `/verify-email?email=${encodeURIComponent(data.email)}`,
    userId,
  };
}

if (legalDocumentsAccepted) {
  await this.recordLegalAcceptances(userId, context, {
    acceptanceMethod: "email",
    useSignupVariant: true,
  });
} else {
  console.error("Legal documents not accepted, skipping recording");
}
```

Leave the existing `if (authError) { if (authError.message?.includes("already exists")) throw new ConflictError(...); ... }`
branch in place, unreachable under this config (documented as such — Maintenance
notes) but harmless if a future config change ever makes better-auth throw
again instead of returning the synthetic response.

**D3. Suppress the Meta CAPI event for the duplicate case (server-only, not
client-visible).** In `signup/route.ts`, `signUpWithEmail` needs to tell the
route this without putting it in the JSON body. Add an internal-only field to
its return type:

```ts
Promise<{ redirect: string; userId: string; isDuplicateSignUp?: boolean }>;
```

set it `true` on the early return in D2 (omitted/`false` otherwise), and in
the route:

```ts
const userId = result!.userId;
// ...
if (!result!.isDuplicateSignUp) {
  after(async () => {
    await sendMetaCompleteRegistration({ userId, ... });
  });
}

return NextResponse.json({
  success: true,
  redirect: result!.redirect,
  userId, // unchanged — see Current state on why this is safe to keep
});
```

`isDuplicateSignUp` must **not** be added to the `NextResponse.json(...)`
call — confirm the object literal there still only has
`success`/`redirect`/`userId` after this edit.

**Verify**: `bun run type-check` → exit 0.

**D4. Reap cron for squatted, never-verified accounts.** Add to
`user.dal.ts`:

```ts
/** Email/password signups that never verified, past the grace window
 *  (SEC-18) — candidates for `deleteOwnAccount`'s anonymize path, which
 *  frees the email. Capped; the route logs when the cap binds. */
async getStaleUnverifiedUserIds(
  olderThan: Date,
  limit: number,
): Promise<string[]> {
  try {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.status, "pending_verification"),
          eq(user.emailVerified, false),
          lt(user.createdAt, olderThan),
        ),
      )
      .limit(limit);
    return rows.map((r) => r.id);
  } catch (error) {
    this.handleError(error, "getStaleUnverifiedUserIds");
  }
}
```

(`lt` is already imported in this file — confirm.) Create
`src/app/api/cron/reap-unverified-signups/route.ts`, mirroring
`cleanup-notifications/route.ts`'s shape:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { userDAL } from "@/dal";
import { deleteOwnAccount } from "@/features/users/services/account-deletion-service";
import { getLogger } from "@/lib/logger"; // match this repo's actual logger import path

export const maxDuration = 60;

const REAP_AFTER_DAYS = 7; // Decision 2
const BATCH_LIMIT = 200;

async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const cutoff = new Date(Date.now() - REAP_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const staleUserIds = await userDAL.getStaleUnverifiedUserIds(
    cutoff,
    BATCH_LIMIT,
  );

  if (staleUserIds.length === BATCH_LIMIT) {
    getLogger().warn(
      { event: "reap_unverified_signups_capped", limit: BATCH_LIMIT },
      "[reap-unverified-signups] batch cap hit — backlog may exceed one run",
    );
  }

  let reaped = 0;
  for (const userId of staleUserIds) {
    try {
      await deleteOwnAccount(userId);
      reaped += 1;
    } catch (error) {
      // A real blocker should be impossible for a pending_verification
      // account (Current state), but never let one row's failure stop the
      // batch.
      getLogger().error(
        { err: error, userId, event: "reap_unverified_signups_failed" },
        "[reap-unverified-signups] failed to reap one account",
      );
    }
  }

  return NextResponse.json({
    success: true,
    candidates: staleUserIds.length,
    reaped,
  });
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/cron/reap-unverified-signups",
);
```

Confirm this repo's actual structured-logger import (`getLogger` is used
elsewhere in this plan's own Part D reap cron — check
`src/features/notifications/lib/expo-push-service.ts`'s import line and match
it exactly) before finalizing.

In `.github/workflows/cron-jobs.yml`'s `cleanup` job, add a third step after
"Cleanup cron history":

```yaml
- name: Reap unverified signups
  run: |
    curl --fail -s -X GET \
      -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/reap-unverified-signups
```

**Verify**: `bun run type-check` → exit 0;
`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"` → no error.

**D5. Tests.**

- `auth-service.test.ts` (extend): mock `auth.api.signUpEmail` to return a
  `{token: null, user: {id: "fake-id", ...}}` shape and `userDAL.userExists`
  to resolve `false` → `signUpWithEmail` returns `{redirect, userId: "fake-id"}`
  without calling `recordLegalAcceptances` (spy, assert not called); the
  normal new-user path (`userExists` → `true`) still calls it, unchanged.
- `signup/route.test.ts` (extend): `isDuplicateSignUp: true` from the service
  → `sendMetaCompleteRegistration`/`after()` not invoked (mock `after`, assert
  the callback passed is never registered, or that it is but
  `sendMetaCompleteRegistration` inside it isn't called if simpler to test at
  that level); response body has no `isDuplicateSignUp` key
  (`JSON.stringify(body)` doesn't contain the string).
- `user.dal.test.ts` (extend): `userExists` true/false cases;
  `getStaleUnverifiedUserIds` returns only `pending_verification` +
  `emailVerified: false` + old-enough rows (mock the query builder per this
  file's existing style).
- New `reap-unverified-signups/__tests__/route.test.ts`: mock
  `userDAL.getStaleUnverifiedUserIds` and `deleteOwnAccount`; one throwing
  `deleteOwnAccount` call doesn't stop the loop (assert `reaped` count and
  that a second candidate's `deleteOwnAccount` is still called).
- New real-DB test (optional but recommended, given this deletes rows):
  `src/dal/__tests__/user-reap.integration.test.ts` — seed one
  `pending_verification`/unverified user 8 days old and one 1 day old →
  `getStaleUnverifiedUserIds(cutoff=7d, limit)` returns only the 8-day-old id.

**Verify**: `bun run test:run src/features/auth src/app/api/auth/signup src/dal/__tests__/user.dal.test.ts src/app/api/cron/reap-unverified-signups` →
all pass.

### Part E — PRIV-14 (mobile): encrypt the persisted query cache

**E1. Install `expo-crypto`** (not currently a dependency —
`grep -n '"expo-crypto"' package.json` confirms absent):
`npx expo install expo-crypto` from `hoador-mobile`.

**E2. Generate/persist a device-local encryption key in SecureStore, scrub
the old plaintext store, open a new encrypted one.** Rewrite `src/state/mmkv.ts`:

```ts
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createMMKV, type MMKV } from "react-native-mmkv";

// App-wide key-value store for the React Query cache and device preferences.
// NEVER store session material here — the session cookie lives only in
// SecureStore via the better-auth Expo plugin (rule #5, gotcha #10).
//
// Encrypted at rest (PRIV-14): the cache holds message content, payment-method
// summaries and profile data, and Android backs up app data by default. The
// key lives only in SecureStore (Keychain / Keystore), never in the MMKV file
// itself or in source.
const ENCRYPTION_KEY_STORAGE_KEY = "hoador_mmkv_encryption_key";
const NEW_STORAGE_ID = "hoador-app-v2";
const LEGACY_UNENCRYPTED_STORAGE_ID = "hoador-app";

function getOrCreateEncryptionKey(): string {
  const existing = SecureStore.getItem(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) return existing;

  // 32 random bytes, base64-encoded — under AES-256's 32-byte key limit once
  // decoded on the native side; react-native-mmkv accepts a string key.
  const bytes = Crypto.getRandomBytes(32);
  const key = Buffer.from(bytes).toString("base64");
  SecureStore.setItem(ENCRYPTION_KEY_STORAGE_KEY, key);
  return key;
}

// One-time migration (this app version): the old plaintext store held PII in
// the clear. Open it with its original (unencrypted) config just long enough
// to wipe it — there is no supported "decrypt existing plaintext, re-encrypt"
// path in react-native-mmkv, and the cache is disposable by design (24h
// maxAge in query-provider.tsx). Cheap and idempotent: a second run opens an
// already-empty store.
createMMKV({ id: LEGACY_UNENCRYPTED_STORAGE_ID }).clearAll();

export const storage: MMKV = createMMKV({
  id: NEW_STORAGE_ID,
  encryptionKey: getOrCreateEncryptionKey(),
  encryptionType: "AES-256",
});
```

Verify `Crypto.getRandomBytes` (sync) exists on the installed `expo-crypto`
version (check `node_modules/expo-crypto`'s `.d.ts` after Step E1 — SDK 57's
`expo-crypto` exposes both `getRandomBytes` (sync) and `getRandomBytesAsync`;
prefer the sync one here since `storage` is initialized at module scope, not
inside an async function). If only the async variant exists at the installed
version, restructure `storage` as a lazily-initialized singleton instead
(`let storage: MMKV | undefined; export function getStorage(): MMKV {...}`)
and update every `storage.` call site (`query-persister.ts`,
`query-provider.tsx`) to go through it — report which shape is needed.

**Verify**: `npx tsc --noEmit` → exit 0.

**E3. `allowBackup: false` on Android (defense in depth).** In
`app.config.ts`, in the `android` block:

```ts
android: {
  package: bundleIdentifier,
  googleServicesFile,
  allowBackup: false, // PRIV-14 — no app data (incl. any MMKV file) in Android auto-backup
  adaptiveIcon: { ... },
  ...
```

**Verify**: `npx tsc --noEmit` → exit 0; a native rebuild is required for this
to take effect (Expo config plugin, not JS-only) — note in Done criteria.

**E4. Tests.** New `src/state/__tests__/mmkv.test.ts`: mock `expo-secure-store`
and `expo-crypto`; first call generates and stores a key
(`SecureStore.setItem` called once with a 44-char base64 string for 32 bytes);
second call (key already present) reuses it (`Crypto.getRandomBytes` not
called again); the legacy-id store's `clearAll` is called exactly once at
module init (mock `react-native-mmkv`'s `createMMKV` to return two distinct
mock instances keyed by `id`, assert the legacy one's `clearAll` fires and the
new one's does not).

**Verify**: `npm test -- src/state/__tests__/mmkv.test.ts` (or this repo's
equivalent filtered-test invocation) → pass.

## Test plan

Each part's own Steps end in a **Verify** line. Part D additionally gets one
real-DB integration test for the reap query (recommended, not required — the
finding is LOW and the query is simple, but it deletes rows in production
once cut over). Full regression: `bun run type-check && bun run lint && bun
run test:run` (web); `npx tsc --noEmit && npm run lint && npm test` (mobile).

## Done criteria

- [ ] Part A: `bun run type-check && bun run test:run src/dal/__tests__/dispute.dal.test.ts src/app/api/disputes` → exit 0; a cross-dispute `noteId` returns 404 and leaves the note unchanged (test)
- [ ] Part B: `valueInputOption` is `"RAW"`; a `=`-leading value is stored with a `'` prefix (test); a 6th request/hour/IP gets 429 (test)
- [ ] Part C: SEC-24 gate confirmed present (landed with R-TEST-15)
- [ ] Part D: `emailAndPassword.autoSignIn` is `false`; a duplicate-email signup returns the same `{success, redirect, userId}` 200 shape as a new signup (test), with no 500 and no `recordLegalAcceptances` call (test); `onExistingUserSignUp` sends the alert email (test); the reap cron exists, is wired into `cron-jobs.yml`'s `cleanup` job, and reaps only accounts past the 7-day cutoff (test)
- [ ] Part E: the persisted cache is opened under an encrypted MMKV instance with a SecureStore-backed key; the old plaintext instance is scrubbed; `android.allowBackup: false` is set (requires a native rebuild to take effect — record that this plan's change alone isn't sufficient until the next EAS build ships)
- [ ] No files outside Scope modified (`git status`, both repos)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` (note which parts landed if not all land together)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`
  web / current mobile HEAD) — re-read before editing that part.
- Part D: if a future config change or better-auth upgrade ever makes
  `emailAndPassword.requireEmailVerification` a soft/scoped flag (signup-only,
  not sign-in) — re-evaluate Decision 1 rather than assuming this plan's
  reasoning still holds; re-read `sign-in.mjs` at that version.
- Part D: `deleteOwnAccount` throws `AccountDeletionBlockedError` for a
  genuinely `pending_verification` candidate in testing — that would mean a
  never-progressed signup somehow accumulated a blocker (shouldn't be
  possible); stop and report rather than silently swallowing it as "expected."
- Part E: the installed `expo-crypto` exposes neither `getRandomBytes` nor
  `getRandomBytesAsync` in a form usable at module scope — report and propose
  the lazy-singleton restructure from Step E2 instead of guessing.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

- **Parts A, B, C**: no mobile call sites for any of the three routes
  (dispute internal notes and the HOA-inquiry/admin-legal-document routes are
  web/admin-only) — no contract impact, no Mobile follow-ups row.
- **Part D**: verified above (Current state) that mobile's signup flow is
  unaffected — it discards the signup response body, and its explicit
  post-signup `signIn.email()` call keeps succeeding for a brand-new
  unverified user because `requireEmailVerification` stays `false`. No
  contract change, no Mobile follow-ups row.
- **Part E**: native-only change (MMKV instance + SecureStore + `app.config.ts`),
  no API contract involved. Existing users lose their persisted query cache
  once (rebuilt from the network on first read, same as a >24h-stale cold
  start) — not a regression, and not something a Mobile follow-ups row
  applies to (that table is for hoador-web contract changes the mobile app
  parses).

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-LOW-SEC (Part D) — set CRON_SECRET-authorized
reap-unverified-signups on the cron schedule` | From: R-LOW-SEC Part D |
  dev: TODO | staging: TODO | prod: TODO (n/a until prod exists) — no
  migration; confirm the next `cleanup` cron run's log shows the new step.
- **New row**: `R-LOW-SEC (Part D) — confirm HOA_INQUIRY_PER_IP rate limiting
is live` | From: R-LOW-SEC Part B | prod: TODO (n/a until prod exists) —
  `enforceRateLimit` no-ops outside `NODE_ENV=production`; nothing to verify
  until a production deploy exists, then confirm a 6th submission/hour/IP
  gets 429.
- No data migration needed for Parts A/C/D's config changes. Part E is a
  mobile-native change shipped via the next EAS build, not a backend cutover
  row.

## Maintenance notes

- Part D's `authError.message?.includes("already exists")` branch in
  `signUpWithEmail` is now unreachable under `autoSignIn: false` (better-auth
  never throws for a duplicate anymore — it returns the synthetic response
  instead) — left in place as a defensive fallback rather than deleted, in
  case a future config change reintroduces the throwing path.
- `createUserWithAddress` (`user.dal.ts`, ~857) remains dead code (zero
  non-test callers) — a candidate for removal in a future cleanup pass, out
  of this plan's scope.
- The client-side Meta pixel (`trackCompleteRegistration`) still fires for a
  duplicate-email signup attempt after this plan (Decision/Current state) —
  a minor, accepted inflation of that conversion metric, not a security
  concern; do not "fix" it by making the response observably different
  between real and duplicate signups.
- Part E's encryption is a broader control than PRIV-14's originally-scoped
  per-key `UNPERSISTED_QUERY_KEYS` filter (`query-persister.ts`) — that filter
  stays as defense-in-depth (a sensitive query never touches disk even
  encrypted) and is Epic 15's to extend further per its own existing comment;
  this plan doesn't need to grow that list.
- If SEC-18's reap TTL (7 days) turns out too aggressive or too lax once
  there's real signup volume to observe, it's a one-line constant change in
  `reap-unverified-signups/route.ts` — no schema or architecture impact.
