# Plan R-SEC-02: Stop PATCH /api/profile from changing the login email

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/users/lib/profile.schema.ts src/app/api/profile/route.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 · **Effort**: S · **Risk**: MED · **Depends on**: none
- **Category**: security
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`PATCH /api/profile` accepts an `email` field and writes it straight to the
user row, leaving `emailVerified` set to `true`. better-auth trusts Google
and Apple as providers (`trustedProviders: ["google", "apple"]`) and links a
new OAuth sign-in onto any existing account whose _local_ email is marked
verified — which it still is after this unverified change. An attacker can
therefore claim a victim's email on a throwaway account today, and silently
take over the victim's account the day they first sign up with Google or
Apple. This is a pre-hijack, not a same-day exploit, which is exactly why it
is easy to miss and important to close now.

## Current state

- `src/features/users/lib/profile.schema.ts:14,43-51` — `updateProfileApiSchema`
  includes `email: email.optional()` (line 46), where `email` is
  `z.string().email(...)` (line 14). The client-side `editProfileFormSchema`
  (lines 32-38) does **not** include `email` — only the API schema does.
- `src/app/api/profile/route.ts:83-86` spreads validated data straight into
  the DAL with no email-specific handling:
  `const { address, ...userFields } = validationResult.data; await userDAL.updateUser(userId, userFields);`.
  `updateUser` (`src/dal/user.dal.ts:196-227`) writes whatever it's given,
  including `email`, and never touches `emailVerified`.
- `node_modules/better-auth/dist/oauth2/link-account.mjs:9-23` — for a
  trusted provider, linking is refused only when
  `requireLocalEmailVerified && !dbUser.user.emailVerified`. Since this route
  never flips `emailVerified` to `false`, a changed-but-never-reverified
  email still reads as verified, so the guard that is supposed to block this
  exact scenario (confirmed working correctly in the audit's "Verified
  clean" section for the _normal_ unverified-signup case) is bypassed.
- `POST /api/onboarding` (`src/app/api/onboarding/route.ts:28-40`) does
  **not** read or accept `email` from its body at all — already clean,
  nothing to change there.
- `src/app/api/profile/__tests__/route.test.ts` exists — model the new mass-
  assignment/email tests on its structure.
- Mobile: no profile-edit screen or mutation exists in `hoador-mobile` yet —
  `find "hoador-mobile/src/app/(app)/profile"` shows only `reviews.tsx`, and
  no `PATCH`-to-`/api/profile` call site exists anywhere in
  `hoador-mobile/src/features`. There is nothing to break.

## Commands you will need

| Purpose   | Command                                        |
| --------- | ---------------------------------------------- |
| Install   | `bun install`                                  |
| Typecheck | `bun run type-check`                           |
| Lint      | `bun run lint`                                 |
| Tests     | `bun run test:run <path>` / `bun run test:run` |

## Scope

**In scope**: `src/features/users/lib/profile.schema.ts` (remove `email`);
`src/app/api/profile/route.ts` PATCH handler (reject a real email change);
`src/app/api/profile/__tests__/route.test.ts` (extend).

**Out of scope**: better-auth `changeEmail` (verified email-change flow) —
optional hardening, not implemented here; `POST /api/onboarding` — already
clean, no change needed; any change to `trustedProviders` or
`requireLocalEmailVerified` in `build-auth-options.ts` — that guard is
correct today and this plan fixes the thing that bypasses it, not the guard
itself.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes uncommitted
for the maintainer to review and commit.

## Steps

### Step 1: Remove `email` from the API schema

In `src/features/users/lib/profile.schema.ts`, delete line 46
(`email: email.optional(),`) from `updateProfileApiSchema`. Leave the
module-level `const email = ...` definition alone if anything else in the
file still uses it; if `updateProfileApiSchema` was its only user, it's fine
to leave the unused const (do not go hunting for other removals beyond this
one field).

**Verify**: `bun run type-check` → exit 0.

### Step 2: Refuse a real email change in the route

In `src/app/api/profile/route.ts`, in `patchHandler`, after parsing `body`
via `parseFormData` and before `updateProfileApiSchema.safeParse(body)`, add:

```ts
if (typeof body.email === "string") {
  const current = await userDAL.getUserById(userId);
  if (body.email.trim().toLowerCase() !== current.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Email cannot be changed here.",
        code: "EMAIL_CHANGE_NOT_SUPPORTED",
      },
      { status: 400 },
    );
  }
  // Same email, case-insensitively: fall through. Zod will drop the field
  // from `validationResult.data` since it's no longer in the schema, so it
  // never reaches `userDAL.updateUser` either way.
}
```

This reads the raw `body` (not the parsed/validated result) because Step 1
makes Zod silently strip `email` before the route ever sees it — the only
way to distinguish "client sent no email" from "client sent the same email"
from "client tried to change it" is to look at the raw payload first.

**Verify**: `bun run type-check` → exit 0.

### Step 3: Tests

Extend `src/app/api/profile/__tests__/route.test.ts`:

- PATCH with `{email: "attacker-controlled@evil.example"}` (differing from
  the mocked current user's email) → 400, `code: "EMAIL_CHANGE_NOT_SUPPORTED"`,
  and `userDAL.updateUser` is never called.
- PATCH with `{email: "<current email, different case>", firstName: "New"}`
  → 200, `updateUser` called with `firstName` but no `email` key at all.
- Mass-assignment regression test: PATCH with
  `{status: "active", userType: "admin", firstName: "New"}` → the call to
  `userDAL.updateUser` receives only `firstName` (proves `status`/`userType`
  were never in the schema to begin with, per repo convention of testing the
  contract, not just the happy path).

**Verify**: `bun run test:run src/app/api/profile/__tests__/route.test.ts` → all pass.

## Test plan

Covered by Step 3: three new cases in the existing `route.test.ts` (differing
email rejected, same email ignored, mass-assignment guard). Verification:
`bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run test:run` exits 0
- [ ] `grep -n "email:" src/features/users/lib/profile.schema.ts` shows `email`
      only in the removed-from-API-schema context (the base `const email`
      definition, not inside `updateProfileApiSchema`)
- [ ] A PATCH with a different email returns 400 and the row is unchanged (test)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` ("Execution order & status")

## STOP conditions

- `updateProfileApiSchema` or `patchHandler` have already been restructured
  (e.g. schema moved, `parseFormData` replaced) such that the excerpts above
  no longer match — re-read the live files before editing.
- `userDAL.getUserById` throws for a valid, authenticated `userId` (it
  shouldn't — the caller is already authenticated) — if it does, investigate
  rather than swallowing the error.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

The mobile app has no profile-edit feature yet: `hoador-mobile/src/app/(app)/profile`
contains only `reviews.tsx`, and no file under `hoador-mobile/src/features`
issues a `PATCH` to `/api/profile` (confirmed by
`grep -rn "method: 'PATCH'" hoador-mobile/src` — six hits, none for the
profile route). Removing `email` from the schema and rejecting real changes
is fully backward compatible with the shipped app: it never sent `email` in
this body and never will until a future profile-edit feature is built —
which should use the ops-query section below to confirm no legacy account is
already mid-hijack before shipping, and should route an intentional email
change through the optional `changeEmail` hardening noted below, not this field.

## Maintenance notes

- **Ops query to find at-risk accounts (read-only, hand to the maintainer —
  do not run automatically as part of this plan):** there is no email-change
  history table, and the route's own activity-log call
  (`trackActivity(userId, "profile_updated")`, no metadata) does not record
  which field changed, so a **definitive** list of accounts hijacked this way
  is not derivable from current data. The best available heuristic —
  candidates for manual review, not a confirmed list — is:
  ```sql
  select u.id, u.email, u.email_verified, u.created_at
  from "user" u
  join account a on a.user_id = u.id and a.provider_id = 'credential'
  where u.email_verified = true
    and exists (
      select 1 from user_activity_log l
      where l.user_id = u.id and l.activity_type = 'profile_updated'
        and l.created_at > a.created_at
    );
  ```
  This over-includes any account that changed name/phone/bio after signup
  (the activity log can't distinguish the field); it is a starting point for
  manual review, not proof of compromise.
- Optional, not implemented here: enable better-auth's `changeEmail` with
  verification so a legitimate email-change feature has a real, verified path
  when one is eventually built, instead of a route accepting the field again.
