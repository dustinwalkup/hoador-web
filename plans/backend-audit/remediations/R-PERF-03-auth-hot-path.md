# Plan R-PERF-03: Resolve the session once per request; stop authenticating `/api/*` in the proxy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first, from `hoador-web`)**:
> `git diff --stat 25e2233..HEAD -- src/lib/api/with-request-logging.ts src/proxy.ts src/features/auth/utils/session.ts src/lib/api/route-helpers.ts src/lib/logger/request-context.ts src/__tests__/proxy.test.ts src/lib/api/__tests__/with-request-logging.test.ts`
> On any change, compare "Current state" against the live files before
> proceeding; a mismatch is a STOP condition. **If the diff touches
> `src/proxy.ts` and adds a `checkMinAppVersion`/`MIN_APP_VERSION` reference,
> R-ARCH-06 has already landed** — read "Coordination with R-ARCH-06" below
> before writing Step 2; the snippet there changes slightly.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: performance
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: PERF-03

## Why this matters

Every authenticated API request resolves the session **three times**, each
resolution costing 3 sequential queries (session-by-token, user-by-id inside
`auth.api.getSession`, then `getUserForAuth`'s own row read — joins are off
and there's no `cookieCache`): once in `withRequestLogging` (thrown away,
because it runs before the AsyncLocalStorage context exists to cache into),
once in the route handler (a real cache miss, since React's `cache()` does
not dedupe across a route handler's call sites), and once again in
`proxy.ts` for every non-skipped `/api/*` request. That's up to 9 queries of
pure auth overhead per request, 6-7 of them redundant. On the polled
endpoints (dashboard badges, thread polling) auth queries are a majority of
total query volume. None of this is attacker-exploitable; it's a straight
tax on every authenticated call, worst on cross-region latency and DB
connection pressure.

## Current state

- `src/lib/api/with-request-logging.ts:47-54` — `wrappedHandler` calls
  `getCurrentUserId()` **before** `runWithRequestContext` starts (line 54),
  so `getRequestContext()` returns `undefined` during that call and the ALS
  fast path in `session.ts:39` (`if (ctx && "user" in ctx ...)`) has nothing
  to seed. The result is used only for the log/Sentry `userId` and otherwise
  discarded. Full resolution #1.
- `src/features/auth/utils/session.ts:35-67` (`getCurrentUser`) — the fast
  path itself is correct and unchanged by this plan; it just never gets a
  chance to hit, since nothing seeds `ctx.user` before the handler's first
  call. The handler's call (via `getAuthenticatedUser`/`requireAuthResponse`
  in `route-helpers.ts`) is therefore a real cache miss that re-runs the full
  chain and seeds `ctx.user` too late to help itself (line 60). Full
  resolution #2. (Since R-SEC-01, `getAuthenticatedUser` needs the whole user
  row to read `status` for the suspended/inactive gate at
  `route-helpers.ts:324-330` — not new query work, just why it can't resolve
  a bare `userId` instead.)
- `src/proxy.ts:218` (`proxyAuth`) — calls `getCurrentUser()` again, in its
  own invocation with its own DB pool, for every `/api/*` path except
  `/api/auth*`/`/api/profile*`. Full resolution #3, pure overhead: every
  route under the four proxy-protected prefixes already calls
  `requireAuthResponse`/`getAuthenticatedUserResponse`
  (`route-helpers.ts:344-359`, `:477-497`) and independently returns
  401/403 — confirmed by grep, **except**
  `src/app/api/listings/categories/route.ts`, which has no auth check by
  design (a static, non-sensitive category list — see Decisions).
- `src/__tests__/proxy.test.ts:101-129` (`describe("proxy.ts —
unauthenticated refusals")`) pins the proxy's own 401 for
  `/api/listings/*`, `/api/rentals/*`, `/api/messages/*`, `/api/garage/*`
  when unauthenticated. These assertions become false and must be rewritten
  (Step 4).
- **Query count today**, one authenticated request: 3 (wrapper, discarded) +
  3 (handler, cached in ALS) + 3 (proxy) = **9**, 6 redundant. **After this
  plan**: 3 (wrapper, now cached and reused by the handler) + 0 (handler
  fast path) + 0 (proxy skips `/api/*`) = **3**.

## Decisions for the maintainer

**1. `/api/listings/categories` becomes reachable without a session.** Today
the proxy 401s it only as a side effect of `/api/listings` being in
`PROTECTED_ROUTES`; the route itself has no auth check and returns only
category names/icons/emoji. **Recommendation: accept this as a bugfix** (it
was over-blocking public data, not under-protecting anything). If the
maintainer disagrees, add `requireAuthResponse()` to that one file instead —
not part of this plan either way. Steps assume the recommendation.

**2. Dead code cleanup.** Skipping the proxy for all of `/api/*` makes
`PUBLIC_API_ROUTES`/`isPublicApiRoute`, the four API entries in
`PROTECTED_ROUTES`, and the API branches inside `refuseUnauthenticated` and
two status-check blocks unreachable. **Recommendation: delete them** (Step 2) rather than leave dead branches whose premise is now false. Steps assume
this.

## Commands you will need

| Purpose   | Command                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install   | `bun install`                                                                                                                                       |
| Typecheck | `bun run type-check`                                                                                                                                |
| Lint      | `bun run lint`                                                                                                                                      |
| Targeted  | `bun run test:run src/__tests__/proxy.test.ts src/lib/api/__tests__/with-request-logging.test.ts src/features/auth/utils/__tests__/session.test.ts` |
| Full      | `bun run test:run`                                                                                                                                  |

## Scope

**In scope**: `src/lib/api/with-request-logging.ts` (move resolution inside
`runWithRequestContext`); `src/proxy.ts` (skip `/api/*` entirely, plus the
dead-code cleanup in Decision 2); `src/__tests__/proxy.test.ts` (rewrite the
now-false assertions); `src/lib/api/__tests__/with-request-logging.test.ts`
(fix the assertion order, add coverage for the new wiring);
`src/features/auth/utils/__tests__/session.test.ts` (new test proving the
ALS fast path saves the two downstream queries).

**Out of scope**: the `getUserForAuth` double-read inside a single
resolution (session → user, then `getUserForAuth` re-reads the same row) —
the finding's optional fix #3 (`cookieCache` or a joined query). Not
attempted here: it changes better-auth config and DAL query shape for a
further ~1 query/request, independent of and lower-leverage than the 9→3
fix. Leave a maintenance note (below) instead.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes
uncommitted for the maintainer.

## Steps

### Step 1: Resolve the session inside the ALS context, once

In `src/lib/api/with-request-logging.ts`, add `getRequestContext` to the
existing `@/lib/logger` import (line 4-8), and replace lines 47-54:

```ts
    let userId: string | null = null;
    try {
      userId = await getCurrentUserId();
    } catch {
      // Leave userId null if auth fails (e.g. no session)
    }

    return runWithRequestContext(
      {
        requestId,
        userId,
        ipAddress,
        userAgent,
        route,
      },
```

with:

```ts
    return runWithRequestContext(
      {
        requestId,
        userId: null,
        ipAddress,
        userAgent,
        route,
      },
      async () => {
        const ctx = getRequestContext();
        let userId: string | null = null;
        try {
          // Resolves via getCurrentUser() (session.ts), which seeds
          // ctx.user as a side effect now that ctx exists — every later
          // call in this request (route-helpers, services) hits the ALS
          // fast path in session.ts:39 instead of re-querying (PERF-03).
          userId = await getCurrentUserId();
        } catch {
          // Leave userId null if auth fails (e.g. no session)
        }
        if (ctx) ctx.userId = userId;

        return runWithQueryCounter(route, async () => {
```

Then close the one extra `async () => {` you just opened: find the matching
end of the _old_ `runWithQueryCounter(route, async () => { ... })` call
(currently closed by `}),` right before the final `);` at the end of the
function) and add one more closing `}` before that `);` — the callback
passed to `runWithRequestContext` must wrap the existing
`runWithQueryCounter(...)` call, not replace it. Everything between
`const log = getLogger();` and the original end of the function (log lines,
try/catch, `Sentry.captureException`) is unchanged — only its indentation
level and its two enclosing function signatures move.

**Verify**: `bun run type-check` → exit 0 (a mismatched brace fails this
immediately).

### Step 2: Skip `/api/*` entirely in the proxy

In `src/proxy.ts`:

**2a.** Remove the now-dead `PUBLIC_API_ROUTES` constant (line 39) and
`isPublicApiRoute` function (lines 95-100). Remove the four API prefixes
from `PROTECTED_ROUTES` (lines 7-16), leaving only the page routes:

```ts
const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding",
  "/community-select",
  "/join-code",
];
```

**2b.** Simplify `refuseUnauthenticated` (lines 57-79) — it is now only ever
called with a page pathname, since no `/api/*` path reaches it:

```ts
/**
 * Refuse an unauthenticated request to a protected PAGE by redirecting to
 * /login. API routes are no longer reached here (see the /api/* skip in
 * proxyAuth) — they self-authenticate via requireAuthResponse /
 * getAuthenticatedUserResponse (route-helpers.ts).
 */
function refuseUnauthenticated(request: NextRequest) {
  return NextResponse.redirect(createRedirectUrl(request));
}
```

Update its two call sites (originally lines 309 and 315) to
`refuseUnauthenticated(request)` (drop the `pathname` argument). Remove the
now-unused `SESSION_EXPIRED_MESSAGE` import (line 4) — confirm nothing else
in this file uses it before deleting.

**2c.** In `proxyAuth`, insert the API skip right after the
`shouldSkipMiddleware` early return and delete the old
`isPublicApiRoute` block that followed it:

```ts
if (shouldSkipMiddleware(pathname)) {
  return NextResponse.next();
}

// PERF-03: every /api/* route self-authenticates (route-helpers.ts) and
// already returns its own 401/403 — resolving the session again here
// duplicated that on every API call. The one route with no handler-level
// check, GET /api/listings/categories, returns only public category
// metadata by design (see this plan's Decisions).
if (pathname.startsWith("/api/")) {
  return NextResponse.next();
}
```

**2d.** Remove the two now-dead `if (pathname.startsWith("/api/")) return
NextResponse.next();` lines inside the `email_verified` and
`incomplete_profile` branches (originally around lines 264 and 278) — `/api/*`
never reaches this far anymore, so these are unreachable. Leave the rest of
each branch (the dashboard/page handling) unchanged.

**2e.** In the E2E-only passthrough block (originally lines 194-202), no
code change is needed — it still reads `isProtectedRoute(pathname)`, which
after 2a only ever matches page routes, so its comment ("Let protected
routes through so dashboard layout does auth") is now accurate without
qualification.

**Verify**: `bun run type-check` → exit 0.

### Coordination with R-ARCH-06 (release safety, roadmap 1.17)

R-ARCH-06 inserts a minimum-app-version check (`checkMinAppVersion` → 426
`APP_UPDATE_REQUIRED`) that must run for every `/api/*` request. Both plans
touch the same spot in `proxyAuth`, right after `shouldSkipMiddleware`, and
compose by sharing **one** `if (pathname.startsWith("/api/"))` block — never
two separate ones (the second becomes dead code with no way to tell which is
authoritative):

- **This plan lands first (expected — earlier in the roadmap phase table)**:
  Step 2c's block is just `{ return NextResponse.next(); }`. R-ARCH-06's
  executor must then insert its version-gate check **inside that block,
  before the return** (not as a standalone block before `isPublicApiRoute`,
  which this plan deletes):
  ```ts
  if (pathname.startsWith("/api/")) {
    const versionGateResponse = checkMinAppVersion(request);
    if (versionGateResponse) return versionGateResponse;
    return NextResponse.next(); // PERF-03
  }
  ```
  Hand this exact snippet to R-ARCH-06's executor (or amend that plan file
  with it) if this plan lands first.
- **R-ARCH-06 lands first**: its version-gate block already exists, falling
  through to `isPublicApiRoute` afterward. This plan's Step 2c then adds
  `return NextResponse.next();` as the last line **inside that existing
  block** (after the version check, not before — a too-old client must still
  get 426), then does 2a/2b/2d unchanged.

Either order reaches the same final code.

### Step 3: Prove the fast path saves the queries

Add to `src/features/auth/utils/__tests__/session.test.ts` (this file
already mocks `auth.api.getSession` and `userDAL.getUserForAuth` — reuse
those mocks):

```ts
vi.mock("@/lib/logger", () => ({
  getRequestContext: () => mockGetRequestContext(),
}));
```

with `const mockGetRequestContext = vi.fn();` declared alongside the file's
other mocks. New `describe("getCurrentUser — ALS fast path (PERF-03)")`:

- `mockGetRequestContext.mockReturnValue({})` (a fresh, mutable context
  object, like the real `RequestContext`); mock `getSession` and
  `getUserForAuth` to resolve normally; call `getCurrentUser()` twice; assert
  `auth.api.getSession` and `userDAL.getUserForAuth` were each called
  **exactly once** (the second call must hit the fast path).
- `mockGetRequestContext.mockReturnValue(undefined)` (no ALS context, e.g. an
  RSC render outside a route handler); call `getCurrentUser()` twice; assert
  both calls hit `getSession` (no context to cache into — same as today).

**Verify**: `bun run test:run src/features/auth/utils/__tests__/session.test.ts` → all pass.

### Step 4: Update `with-request-logging.test.ts` and `proxy.test.ts`

In `src/lib/api/__tests__/with-request-logging.test.ts`:

- The first test's assertion that `runWithRequestContext` is called with
  `userId: "user-123"` is now false — it's called with `userId: null`. Fix
  that assertion, and add one asserting `mockGetCurrentUserId` was still
  called (resolution still happens, just later).
- Add `getRequestContext: () => mockGetRequestContext()` to the
  `@/lib/logger` mock. Make `mockRunWithRequestContext` capture its `ctx`
  argument (`let capturedCtx; const mockRunWithRequestContext = vi.fn((ctx, fn) => { capturedCtx = ctx; return fn(); });`)
  and `mockGetRequestContext = vi.fn(() => capturedCtx);`. Add a test
  asserting `capturedCtx.userId === "user-123"` after `await
wrapped(request)` — proves the mutation lands on the real context object.

In `src/__tests__/proxy.test.ts`:

- Delete the `describe("proxy.ts — unauthenticated refusals")` block's
  `it.each` 401 test, the "leaves unprotected API routes alone" test, and
  the "401s an API route when the auth check itself throws" test — no
  `/api/*` path reaches the proxy's `try`/`catch` anymore, so there's
  nothing left to assert here (each route's own tests already cover its
  401/403).
- Replace with one test: `it.each([...six paths, including
"/api/listings/categories"])("passes every /api/* path through without
calling getCurrentUser (%s)", async (pathname) => { const res = await
proxy(makeRequest(pathname)); expect(isNextResponse(res)).toBe(true);
expect(getCurrentUser).not.toHaveBeenCalled(); });` — this pins PERF-03's
  fix at the proxy layer.
- Keep the two protected-PAGE redirect tests unchanged.

**Verify**: `bun run test:run src/__tests__/proxy.test.ts src/lib/api/__tests__/with-request-logging.test.ts` → all pass.

## Test plan

Step 3 pins the ALS fast path directly (2 resolutions → 1 for two calls in
the same context). Step 4 pins that the proxy never calls `getCurrentUser`
for any `/api/*` path, and that page-routing behavior is untouched. Full
regression: `bun run test:run`. There is no query-count harness that spans
wrapper + handler + proxy in one process (the proxy runs as a separate
Edge/Node invocation in production), so the "9 → 3" arithmetic in "Current
state" is verified by code reading plus these two unit-level pins, not by a
single end-to-end counter.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `grep -n "PUBLIC_API_ROUTES\|isPublicApiRoute" src/proxy.ts` → no matches
- [ ] `grep -n "getCurrentUser" src/proxy.ts` shows exactly one call, inside
      the admin-route branch only (`isAdminRoute` path uses `getAdminUser`,
      unaffected) — i.e. no unconditional call remains for `/api/*`
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
- [ ] The "Coordination with R-ARCH-06" note above has been relayed to
      whichever plan lands second (add a line to the roadmap's Execution
      order table pointing at this section if R-ARCH-06 hasn't landed yet)

## STOP conditions

- Excerpts above don't match the live files — re-read before editing.
- `src/proxy.ts` already contains `checkMinAppVersion` — do not skip reading
  "Coordination with R-ARCH-06"; the Step 2c snippet changes shape.
- A test fails twice after a reasonable fix attempt.
- Any route under `/api/garage`, `/api/listings`, `/api/rentals`, or
  `/api/messages` other than `categories` is found to lack a
  `requireAuthResponse`/`getAuthenticatedUserResponse` call when you grep —
  re-verify Decision 1's premise before proceeding; if one exists, add the
  missing auth check to that route in the same change (it would otherwise
  become unauthenticated the moment this plan lands).

## Mobile compatibility

No response shape, status code, or error code changes. The only externally
visible effect is `GET /api/listings/categories` no longer requiring a
session; the mobile app already calls it both logged-in and logged-out
(`hoador-mobile/src/features/listings/hooks/use-listing-categories.ts:28`)
and never depended on the 401 (it always sent a cookie when one existed, and
the route itself never checked for one). No contract change; no roadmap
"Mobile client follow-ups" row needed.

## Maintenance notes

- The remaining 3 queries per resolution are the finding's optional fix #3 —
  collapsing `auth.api.getSession`'s user read and `getUserForAuth`'s into
  one via `experimental.joins` or a `cookieCache`. Not attempted here: it
  touches better-auth config and needs its own verification against
  revocation/`emailVerified` edge cases.
- Code that resolves the user _outside_ `withRequestLogging` (a server
  action, a cron route, a background job) gets no benefit from this fix —
  the ALS context only exists inside `runWithRequestContext`. Already true
  today; unchanged by this plan.
