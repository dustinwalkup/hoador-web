# Plan 006: Add API-route tests that exercise real auth rejection (money + admin + cron routes)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- src/lib/api/route-helpers.ts src/features/auth/utils "src/app/api/rentals/[id]/approve" "src/app/api/admin/rentals/[id]/no-show" src/app/api/cron/process-payouts "src/app/api/(payments)/create-payment-intent"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only; no production code changes)
- **Depends on**: 002 (for the create-payment-intent tests — skip that file if 002 hasn't landed)
- **Category**: tests
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

Only 26 of 142 `route.ts` files under `src/app/api` have tests, and the route tests that exist mostly mock `@/lib/api/route-helpers` wholesale — e.g. the admin no-show test stubs `requireAdminResponse` to always return `null` (authorized). That means a commit that _removes_ an auth check, or a regression inside the helpers themselves, fails zero tests. This plan establishes the pattern — **mock the session layer, run the real helpers** — and applies it to the highest-value routes: rental approval (money), two admin routes, a cron route (secret check), and the hardened create-payment-intent.

## Current state

- Auth chain (all verified at `5c32982`):
  - `src/lib/api/route-helpers.ts` — `requireAuthResponse()` calls `getCurrentUserId()` (from `@/features/auth/utils/session`) → 401 JSON `{ error: "Authentication required" }` when null. `requireAdminResponse()` calls `requireAdmin()` (from `@/features/auth/utils/guards`); maps an error whose message includes "Admin" to 403 `{ error: "Admin privileges required" }`, any other auth error to 401. `getAuthenticatedUserResponse()` calls `getAuthenticatedUser()` (session module) → 401 with `SESSION_EXPIRED_MESSAGE` when null, else `{ user, userId, isAdmin }`.
  - `src/features/auth/utils/guards.ts:47-53` — `requireAdmin()` = `requireAuth()` then `if (user.userType !== "admin" && user.userType !== "superadmin") throw new Error("Admin privileges required")`. `requireAuth` is imported from the session module.
  - So: **mocking `@/features/auth/utils/session` is sufficient** to drive every helper through its real logic.
- Exemplar of the _current_ (helper-mocking) anti-pattern: `src/app/api/admin/rentals/[id]/no-show/__tests__/route.test.ts` — `vi.mock("@/lib/api/route-helpers", …)` with `requireAdminResponse: vi.fn().mockResolvedValue(null)`.
- Exemplar of good route-test mechanics (request construction, `withRequestLogging` passthrough mock, dynamic `await import("../route")`): `src/app/api/stripe/webhooks/__tests__/route.test.ts`.
- Target routes:
  - `src/app/api/rentals/[id]/approve/route.ts` — `requireAuthResponse()` then Zod (`approveRequestSchema`), then `getCurrentUserId()` again, then `RentalService.approveRentalRequest`. Body arrives via `parseFormData` (accepts JSON or form-data).
  - `src/app/api/admin/rentals/[id]/no-show/route.ts` — admin route with an existing test to rewrite.
  - One more admin route of your choice under `src/app/api/admin/` that has NO test yet (pick one whose service dependency is easy to mock; state your choice in the report).
  - `src/app/api/cron/process-payouts/route.ts` — uses `verifyCronSecret(request)` (real logic: `src/lib/api/verify-cron-secret.ts`; reads `process.env.CRON_SECRET`, compares `Authorization` header).
  - ~~`src/app/api/(payments)/create-payment-intent/route.ts` — after plan 002: `requireAdminResponse()` + Zod amount validation.~~ **Route deleted 2026-06-10 as dead code (zero callers); Step 4 is N/A.**
- Test conventions: vitest + happy-dom, tests in sibling `__tests__/`, `vi.clearAllMocks()` in `beforeEach`. Run via `bun run test:run <path>`.

## Commands you will need

| Purpose        | Command                        | Expected on success |
| -------------- | ------------------------------ | ------------------- |
| Typecheck      | `bun run type-check`           | exit 0              |
| Lint           | `bun run lint`                 | exit 0              |
| Targeted tests | `bun run test:run src/app/api` | all pass            |
| Full tests     | `bun run test:run`             | all pass            |

## Scope

**In scope** (tests only):

- `src/app/api/rentals/[id]/approve/__tests__/route.test.ts` (create)
- `src/app/api/admin/rentals/[id]/no-show/__tests__/route.test.ts` (rewrite the auth mocking)
- One additional `src/app/api/admin/<route>/__tests__/route.test.ts` (create)
- `src/app/api/cron/process-payouts/__tests__/route.test.ts` (create or extend if exists under `src/app/api/cron/__tests__`)
- ~~`src/app/api/(payments)/create-payment-intent/__tests__/route.test.ts` (create; only if plan 002 landed)~~ **N/A — route deleted as dead code (see Step 4).**

**Out of scope**:

- ANY production code change. If a test exposes a real bug, STOP and report — do not fix the route in this plan.
- Adding tests to all 116 untested routes — this plan establishes the pattern on 5; broad rollout is follow-up work.
- E2E/Playwright tests.

## Git workflow

- Branch: `advisor/006-route-auth-tests` off `develop`
- Commit per route-test file; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish the session-mock pattern on the approve route

Create `src/app/api/rentals/[id]/approve/__tests__/route.test.ts`. Mock **only**:

- `@/features/auth/utils/session` — exporting `vi.fn()`s for `getCurrentUserId`, `getCurrentUser`, `getAuthenticatedUser`, `requireAuth` (export every symbol the module exports that the chain touches; check its export list first with `grep -n "export" src/features/auth/utils/session.ts`).
- `@/features/rentals/services/rental-service` — `RentalService.approveRentalRequest` as a `vi.fn()` (preserve the `ApproveRentalRequestInput` type export via `importOriginal` if the route imports it: `vi.mock` with `async (importOriginal) => ({ ...(await importOriginal()), RentalService: { approveRentalRequest: mockApprove } })` — note type-only imports vanish at runtime, so exporting just `RentalService` usually suffices).
- `@/lib/api/with-request-logging` — passthrough, copied from the webhooks test.

Do **NOT** mock `@/lib/api/route-helpers`.

Cases:

1. `getCurrentUserId` → `null`: POST returns **401** with `{ error: "Authentication required" }`, and `approveRentalRequest` not called.
2. authenticated (`getCurrentUserId` → `"user-1"`), valid JSON body `{}`: service called with `(rentalId, "user-1", {…}, {…})`; mock resolves `{ success: true }` → 200.
3. authenticated, service resolves `{ success: false, paymentFailed: true, error: "card declined" }` → assert the route's mapped status/body (read the route's result-handling tail past line 70 first and assert what it actually does — do not guess).

**Verify**: `bun run test:run "src/app/api/rentals/[id]/approve"` → all pass.

### Step 2: Rewrite the no-show admin test to use real helpers

In `src/app/api/admin/rentals/[id]/no-show/__tests__/route.test.ts`, remove the `vi.mock("@/lib/api/route-helpers", …)` block (keep `handleApiError` REAL too — it maps `@/dal/errors` types; the existing assertions on 404/400 from `NotFoundError`/`ValidationError` should still hold, fix expectations if the real mapper differs from the old mock's 500-for-everything stub). Mock the session module instead:

- unauthenticated: `requireAuth` (used by `requireAdmin`) throws / `getCurrentUser` returns null — read `src/features/auth/utils/session.ts` to see what `requireAuth` does when unauthenticated and mock accordingly → expect **401**.
- authenticated non-admin: `requireAuth` resolves `{ id: "u1", userType: "member", … }` → expect **403** `{ error: "Admin privileges required" }`.
- admin: `userType: "admin"` → handler proceeds (service mock called).

**Verify**: `bun run test:run "src/app/api/admin/rentals/[id]/no-show"` → all pass. `grep -n 'vi.mock("@/lib/api/route-helpers"' "src/app/api/admin/rentals/[id]/no-show/__tests__/route.test.ts"` → no output.

### Step 3: Second admin route + cron route

- Pick an untested admin route (suggestion: something under `src/app/api/admin/` whose handler calls one service method). Apply the Step 2 pattern: 401 / 403 / success.
- Cron: test `src/app/api/cron/process-payouts/route.ts` with the REAL `verifyCronSecret`. Mock the payout service it calls (read the route first to find the exact import). Cases: no `Authorization` header → 401; wrong secret → 401; `process.env.CRON_SECRET` unset → 500; correct `Bearer` secret → service invoked. Set/restore `CRON_SECRET` in `beforeEach`/`afterEach`. (If plan 002 landed, the comparison is `timingSafeEqualStrings` — behavior identical.)

**Verify**: `bun run test:run src/app/api/admin src/app/api/cron` → all pass.

### Step 4: create-payment-intent — ~~N/A (route deleted 2026-06-10)~~

The `create-payment-intent` route was deleted as dead code (zero callers found
anywhere in the repo) after plan 002 hardened it. There is nothing to test;
**skip this step entirely.** (Originally: assert 401/403/400-cap/200 against the
admin-gated route.)

## Test plan

This plan IS the test plan. Final gate: `bun run test:run` → full suite green; `bun run type-check` and `bun run lint` → exit 0.

## Done criteria

- [ ] 4-5 route test files exist/rewritten per Steps 1-4, all passing
- [ ] None of the new/rewritten files mock `@/lib/api/route-helpers`: `grep -rln 'vi.mock("@/lib/api/route-helpers"' src/app/api/rentals/[id]/approve src/app/api/admin/rentals/[id]/no-show src/app/api/cron/process-payouts` → no output
- [ ] Each tested protected route has at least one test asserting a 401 and (for admin) a 403 produced by the REAL helper logic
- [ ] `bun run test:run`, `bun run type-check`, `bun run lint` exit 0
- [ ] No production files modified (`git status` shows only test files and plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A test exposes an actual missing/incorrect auth check in a route — STOP, report the route and evidence; the fix is a separate change.
- `src/features/auth/utils/session.ts` has side-effectful module initialization that breaks under `vi.mock` (e.g. db imports at module scope that happy-dom can't satisfy) — report what blocks the pattern instead of falling back to mocking route-helpers.
- The approve route's result-mapping tail (post line 70) contradicts what Step 1 case 3 assumes — write the assertion to match reality; if reality looks like a bug (e.g. 200 on payment failure), note it in the report.
- Plan 002 not landed when you reach Step 4 — skip Step 4, note it in the index row ("Step 4 deferred pending 002").

## Maintenance notes

- The pattern ("mock session, run real helpers") should be the documented default for new route tests — plan 001's CLAUDE.md already states it; keep them consistent.
- Follow-up (not this plan): apply the pattern to the remaining untested money routes (`/api/rentals/[id]/cancel`, `/api/services/bookings/[id]/*`, `/api/stripe/*` siblings), and consider an ESLint rule or CI grep flagging new `vi.mock("@/lib/api/route-helpers")` in route tests.
- When better-auth or the session utils change shape, these tests fail loudly — that's their job; update the session mocks, not the helper mocks.
