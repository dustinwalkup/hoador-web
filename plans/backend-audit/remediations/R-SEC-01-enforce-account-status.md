# Plan R-SEC-01: Enforce suspended/inactive account status at the API auth layer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/lib/api/route-helpers.ts src/dal/user.dal.ts src/app/api/onboarding/route.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED · **Depends on**: none
- **Category**: security
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

Admin suspension is the platform's primary abuse control, and today it does
nothing against the API: no route helper checks `user.status`, suspension
never revokes sessions, and `POST /api/onboarding` unconditionally writes
`status: "active"`, letting a suspended user reactivate themselves. A
suspended fraud account keeps a working session (7-day default, refreshed on
every use) and can keep requesting rentals, accepting bookings, messaging and
filing disputes indefinitely. This plan enforces status at the one place all
client requests already pass through: the shared route helpers.

## Current state

- `src/lib/api/route-helpers.ts:392-408` (`getAuthenticatedUserResponse`)
  calls `getAuthenticatedUser()`, checks only whether it returned `null`, and
  returns the result — never inspects `.user.status`. `:264-275`
  (`requireAuthResponse`) checks auth via `getCurrentUserId()`, which never
  loads `status` at all — it must be changed to call `getAuthenticatedUser()`
  instead (from `@/features/auth/utils/session`) to have `.status` in scope.
- `src/features/auth/utils/guards.ts:6-12` (`requireActiveUser`) is the only
  existing status check in the codebase and has zero callers — not reused
  here; the fix lives in the two functions above per the decided strategy.
- `src/dal/user.dal.ts:475-491` (`adminUpdateUser`) writes `status` via
  `updateUserStatus` but never touches the `session` table. `account-deletion.dal.ts:316`
  already does this kind of revocation for self-deletion —
  `await tx.delete(session).where(eq(session.userId, userId));`, `session`
  imported from `@/db/schemas/user.schema` (`:6,10`) — the pattern to mirror.
  `src/app/api/admin/users/bulk-actions/route.ts:81-110` loops `userIds` and
  calls this same `adminUpdateUser`, so fixing the DAL method covers both the
  single-user PATCH route and bulk actions.
- `src/app/api/onboarding/route.ts:56-61` always sets `status: "active"` via
  `userDAL.updateUser(userId, { ...profileData, status: "active" as const })`,
  with no check of the current status.
- **Load-bearing mobile finding**: the shipped app's entire suspended/
  inactive UX depends on `GET /api/profile` staying reachable and returning
  `200 {status: "suspended", ...}` — see Mobile compatibility. This route
  must explicitly opt out of the new gate, or the fix breaks the app's own
  suspension handling. The audit's suggested example route,
  `GET /api/users/me`, is **not** what mobile actually calls — corrected here
  from reading the mobile source directly.

## Commands you will need

| Purpose   | Command                                        |
| --------- | ---------------------------------------------- |
| Install   | `bun install`                                  |
| Typecheck | `bun run type-check`                           |
| Lint      | `bun run lint`                                 |
| Tests     | `bun run test:run <path>` / `bun run test:run` |

## Scope

**In scope**: `src/lib/api/route-helpers.ts` (gate + `allowRestricted` opt-in
on both helpers); `src/app/api/profile/route.ts` GET (opt in);
`src/app/api/push/subscribe/route.ts` DELETE (opt in); `src/dal/user.dal.ts`
(`adminUpdateUser` session revocation; new `completeOnboarding` method);
`src/app/api/onboarding/route.ts` (use the new method);
`src/app/api/garage/{active,inactive,archived,categories}/route.ts` (switch to
the helper, Step 1b); tests for all above.

**Out of scope**: `src/proxy.ts` (web-page status branches — optional per the
audit); `session.ts`'s `getAuthenticatedUser`/`getCurrentUser` (stay ungated
— server pages using them directly are a known gap, see Maintenance notes);
active-only gating for `email_verified`/`incomplete_profile` — onboarding-in-
progress statuses that must keep working as today (BIZ-08 territory).

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes uncommitted
for the maintainer to review and commit.

## Steps

### Step 1: Add the status gate to the route helpers

In `src/lib/api/route-helpers.ts`, add a small helper and thread an options
parameter through both functions:

```ts
function restrictedStatusCode(user: {
  status: string;
}): "ACCOUNT_SUSPENDED" | "ACCOUNT_INACTIVE" | null {
  if (user.status === "suspended") return "ACCOUNT_SUSPENDED";
  if (user.status === "inactive") return "ACCOUNT_INACTIVE";
  return null; // pending_verification / email_verified / incomplete_profile / active: unrestricted here
}

export async function getAuthenticatedUserResponse(
  options: { allowRestricted?: boolean } = {},
) {
  const result = await getAuthenticatedUser();
  if (!result)
    return NextResponse.json(
      { error: SESSION_EXPIRED_MESSAGE },
      { status: 401 },
    );
  const code = !options.allowRestricted && restrictedStatusCode(result.user);
  if (code)
    return NextResponse.json(
      { error: "This account is no longer active.", code },
      { status: 403 },
    );
  return result;
}
```

Change `requireAuthResponse` to accept the same `{allowRestricted?}` option
and call `getAuthenticatedUser()` instead of `getCurrentUserId()` so
`.status` is available, applying the identical check before returning `null`.

Do **not** check `anonymizedAt` — self-deletion already sets
`status: "inactive"` in the same write that sets `anonymizedAt`
(`account-deletion.dal.ts:300-301`), so `status` alone covers anonymized
accounts too.

**Verify**: `bun run type-check` → exit 0; every existing no-argument call
site still compiles (the new parameter is optional).

### Step 1b: Close the routes that bypass the helpers

A few routes authenticate by calling `getCurrentUserId()` / `getCurrentUser()`
directly instead of using the route helpers. The lead auditor's inventory at
`21bdc61` found `src/app/api/garage/{active,inactive,archived,categories}/route.ts`
and `src/app/api/onboarding/route.ts`. The `/api/auth/*` custom routes and
`/api/hoa-inquiries` are intentionally unauthenticated. Re-list them with:

```bash
grep -rL "getAuthenticatedUserResponse\|requireAuthResponse\|requireAdminResponse\|verifyCronSecret\|INTERNAL_API_SECRET\|constructEvent\|E2E_TEST" src/app/api --include=route.ts
```

For every listed route that is meant to require a session, switch it to
`getAuthenticatedUserResponse()`. The exception is `onboarding`: it gets the
status CAS in Step 4 and may keep its own auth call.

**Verify**: re-run the grep. Only the unauthenticated routes above, the public
`listings/categories` route and the legal-document download remain.

### Step 2: Opt the two mobile-critical routes out of the gate

In `src/app/api/profile/route.ts`, change the `GET` handler's
`await getAuthenticatedUserResponse();` to
`await getAuthenticatedUserResponse({ allowRestricted: true });`. Leave the
`PATCH` handler gated (default, no option) — a suspended user should not be
able to edit their profile, only read their own status.

In `src/app/api/push/subscribe/route.ts`, find the `DELETE` handler's auth
call and add the same option — it must keep working while `signOut()` runs on
the mobile terminal screen, before the session is revoked (Mobile compatibility).

**Verify**: `bun run type-check` → exit 0.

### Step 3: Revoke sessions on admin suspend/deactivate

In `src/dal/user.dal.ts`, import `session` from `@/db/schemas/user.schema`
(add to the existing import from that module) and change `adminUpdateUser`:

```ts
if (updates.status !== undefined) {
  await this.updateUserStatus(userId, updates.status);
  if (updates.status === "suspended" || updates.status === "inactive") {
    await this.db.delete(session).where(eq(session.userId, userId));
  }
}
```

This single change covers both `PATCH /api/admin/users/[userId]` and
`POST /api/admin/users/bulk-actions`, which both call `adminUpdateUser`.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Make onboarding a one-way, status-gated transition

In `src/dal/user.dal.ts`, add a new method near `updateUser`:

```ts
async completeOnboarding(
  userId: string,
  profileData: Pick<UpdateUserDTO, "firstName" | "lastName" | "phone" | "bio" | "profileImageUrl">,
): Promise<UserProfile> {
  try {
    const [updated] = await this.db.update(user)
      .set({ ...profileData, status: "active", updatedAt: new Date() })
      .where(and(eq(user.id, userId), eq(user.status, "incomplete_profile")))
      .returning();
    if (!updated) {
      throw new ConflictError("Onboarding cannot be completed from the current account status.");
    }
    return this.getUserById(userId);
  } catch (error) {
    this.handleError(error, "completeOnboarding");
  }
}
```

Import `and` from `drizzle-orm` and `ConflictError` from `./errors` if not
already imported in this file. In `src/app/api/onboarding/route.ts`, replace
the `userDAL.updateUser(userId, { ...profileData, status: "active" as const })`
call with `userDAL.completeOnboarding(userId, profileData)` — no other change
to the route; its existing `handleApiError(userError)` fallback already maps
`ConflictError` to a 409 response.

**Verify**: `bun run type-check` → exit 0.

### Step 5: Tests — see Test plan below

**Verify**: `bun run test:run` → all pass.

## Test plan

- `route-helpers.test.ts` (create if absent, else extend): mock
  `getAuthenticatedUser` to return `suspended`/`inactive` users — assert
  `getAuthenticatedUserResponse()` returns 403 with the matching `code`, and
  `{allowRestricted: true}` returns the user. Repeat for `requireAuthResponse`.
  Assert `active` and `email_verified` users both pass through unrestricted
  (regression guard for "no onboarding gating").
- Extend one representative money-route test already mocking
  `getAuthenticatedUser` (e.g. under `src/app/api/rentals/`): a `suspended`
  user gets 403.
- `src/dal/__tests__/user.dal.test.ts`: `adminUpdateUser` with
  `status: "suspended"` deletes session rows; `status: "active"` does not.
  `completeOnboarding` succeeds from `incomplete_profile`, throws
  `ConflictError` from `active`/`suspended`.
- New `src/app/api/onboarding/__tests__/route.test.ts` (none exists today —
  model session mocking on `rentals/[id]/__tests__/route.test.ts`): a
  suspended user's onboarding POST leaves `status` unchanged (409).
- Verification: `bun run test:run` → all pass, including every new/extended case.

## Done criteria

- [ ] `bun run type-check` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run test:run` exits 0
- [ ] A suspended user with a valid session gets 403 with `code: "ACCOUNT_SUSPENDED"` on a representative money route
- [ ] `GET /api/profile` and `DELETE /api/push/subscribe` still return 200/2xx for a suspended user (verified by test, not just inspection)
- [ ] `adminUpdateUser` deletes session rows when status becomes suspended/inactive (verified by test)
- [ ] Onboarding by a suspended/active user leaves `status` unchanged (verified by test)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` ("Execution order & status")

## STOP conditions

- `getAuthenticatedUser`'s returned user object doesn't carry `status` by the
  time it reaches `route-helpers.ts` — re-check `user.dal.ts:891-921`
  (`getUserForAuth`) before Step 1.
- `session`'s schema module or column name differs from
  `account-deletion.dal.ts:6,10,316` — re-verify before Step 3.
- Onboarding's `profileData` shape differs from
  `{firstName, lastName, phone, bio, profileImageUrl}` — re-check
  `onboarding/route.ts:28-40` before Step 4.
- An existing test mocks `getAuthenticatedUser` with no `status` field and
  starts failing — confirm the new check treats `undefined` as unrestricted
  (by design) rather than loosening the gate further; do not just delete the test.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

The shipped app's **entire** suspended-account UX is built on
`GET /api/profile` staying a plain `200` for a suspended user:
`hoador-mobile/src/features/auth/hooks/use-me.ts` fetches `/api/profile` as
the sole source of auth truth, and `auth-provider.tsx`'s own comment states
"A 401 is handled by apiFetch's `onUnauthorized`... no auth-error retry.
Non-auth errors keep the app in a loading state." A `403` here would **not**
trigger the sign-out path (only 401 does) — it would fall into the generic
error branch and show an endless retry screen instead of the "Your account
isn't active" terminal screen the app already ships (`funnel-router.ts:68-70`
routes `suspended`/`inactive` to `ROUTES.accountStatus`, which calls
`signOut()`). This is why Step 2 makes `GET /api/profile` `allowRestricted`
— without it, this plan regresses an already-working mobile flow.

`signOut()` (`sign-out.ts:53-75`) also calls a push-deactivate hook
**before** clearing the session, "because the API call needs the cookie" —
that reaches `DELETE /api/push/subscribe`. Step 2 opts this route out too so
a just-suspended user's device can still be unsubscribed during the forced
sign-out. No mobile code change is required; both routes the app depends on
keep their current behavior for a restricted user.

## Maintenance notes

- Web server _pages_ (`getAuthenticatedUser`/`getCurrentUser`, used directly
  by App Router pages) and `src/proxy.ts` are **not** covered — only API
  routes through `route-helpers.ts` are gated. A suspended user can still
  load web dashboard pages fetching via DAL directly; closing that is a
  deliberately deferred follow-up (the audit marked proxy changes optional).
- If a future route needs `allowRestricted: true`, verify it against the
  actual caller's code, not assumption — the audit's own example
  (`GET /api/users/me`) turned out not to be what mobile calls.
- `requireActiveUser` (`guards.ts:6-12`) remains unused after this plan;
  redundant with the new gate, deletable in a follow-up cleanup.
