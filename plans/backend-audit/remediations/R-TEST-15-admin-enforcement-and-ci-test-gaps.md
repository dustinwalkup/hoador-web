# Plan R-TEST-15: Table-driven admin/cron/internal auth-gate tests, pinned scoping WHEREs, and `test:tz` in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> This is a **test-and-CI** plan with one small production fix: SEC-24 (the
> admin legal-document download route has no auth) gets its one-line
> `requireAdminResponse()` gate in Step 0, so the admin table test covers it
> as a plain `it` like every other admin route.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/app/api/legal-documents src/app/api/admin src/app/api/cron src/app/api/internal src/dal/listing.dal.ts src/dal/payment.dal.ts src/dal/dispute.dal.ts src/db/schemas/__tests__/services-phase1-schema.test.ts src/services/stripe/__tests__/webhook-handlers-chargeback.test.ts src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts package.json .github/workflows/ci.yml`
> On any change, re-read the affected file before writing that part's tests;
> a mismatch is a STOP condition for that part only — the parts are
> independent, keep going on the rest.

## Status

- **Priority**: P2 · **Effort**: L · **Risk**: LOW (tests/CI, plus a
  one-line admin gate on a route nothing calls) · **Depends on**: none to start
- **Category**: testing / CI
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: TEST-15, TEST-17, TEST-18, TEST-20, SEC-24 (Phase 2 step outline item 8;
  TEST-20 folded in per this plan's brief even though the roadmap's own
  outline lists it under Phase 3's "remaining LOW findings" — it is small
  and shares the admin/cron discovery mechanism this plan builds. SEC-24 is
  also a Phase 3 LOW, pulled forward because this plan's admin table test
  exercises exactly that route; **this plan owns it**, and R-LOW-SEC Part C
  becomes verify-only)

## Why this matters

- **TEST-15**: 15 of 33 admin route files (re-counted below; the audit's "21
  handlers" is stale) have zero test coverage of their admin gate. One of
  them — `admin/legal-documents/[documentId]/[version]/download` — has **no
  gate at all** (SEC-24, LOW): any authenticated-or-not caller can hit it
  today. Step 0 adds the gate. A regression in any of the other 14 (e.g. a copy-pasted route
  that forgets `requireAdminResponse()`) would ship silently, and a brand
  new admin route added next sprint would be just as silent unless someone
  remembers to write its test.
- **TEST-17**: three tests assert their own mocks instead of real behavior:
  an "idempotent" webhook test that actually proves the opposite, a schema
  test that only checks a default is non-`undefined`, and a whole "E2E
  workflow" file that mocks every real function it calls and then asserts on
  the mock. Separately, the community/approval visibility filter in listing
  search and the scoping WHEREs on a user's own payment history and dispute
  list have never been rendered to real SQL — a mocked-DAL test would stay
  green even if the `WHERE` clause were deleted.
- **TEST-18**: `build-schedule.test.ts` says in its own comments "CI runs
  [`test:tz`]" — it doesn't. `test:tz` exists, covers one directory and one
  timezone, and is wired into no workflow. The timezone bug class this
  guards against (local-midnight dates serializing to the wrong UTC day) is
  invisible in UTC and in every zone behind UTC, which is most of CI's
  world — a regression here would pass a green suite indefinitely.
- **TEST-20**: the 5 cron routes that share `verifyCronSecret` (real,
  already-tested helper) have no route-level test proving the gate is
  actually wired up on them specifically, and the two internal PDF routes'
  inline secret checks are completely untested.

## Current state

### TEST-15 — admin route inventory (re-counted at `29fe557`)

`find src/app/api/admin -name route.ts | wc -l` → **34** route files
(37 route-file × method pairs, counted by actually importing them). Of
those, `find … -name __tests__ ` shows **22** with no `__tests__` directory
next to the route file. Three of that 22 are in fact covered by tests that
live one level up, in `src/app/api/admin/payments/__tests__/` (not next to
their own route file, so the naive per-directory check misses them) —
confirmed by grepping each file's path string into those test files:

- `cron-history.test.ts` covers `payments/cron-history/route.ts` (401/403).
- `lifecycle.test.ts` covers `payments/lifecycle/route.ts`,
  `payments/lifecycle/[rentalId]/route.ts`, and `payments/metrics/route.ts`
  (401/403 each).
- `overrides.test.ts` covers `payments/lifecycle/[rentalId]/release-deposit`,
  `.../reset-payout-status`, `.../reset-transfer-status` (401/403 each).

That leaves **15 genuinely untested admin route files** (down from the
audit's 21 — some landed tests since, e.g. `admin/users/bulk-actions` and
`admin/rentals/[id]/no-show`):

| Route file                                                       | Method(s) | Guard mechanism        |
| ---------------------------------------------------------------- | --------- | ---------------------- |
| `admin/activity/route.ts`                                        | GET       | `requireAdminResponse` |
| `admin/activity/stats/route.ts`                                  | GET       | `requireAdminResponse` |
| `admin/badges/route.ts`                                          | GET       | `requireAdminResponse` |
| `admin/disputes/stats/route.ts`                                  | GET       | `requireAdminResponse` |
| `admin/legal-documents/[documentId]/[version]/download/route.ts` | GET       | **none — SEC-24**      |
| `admin/legal-documents/[documentId]/[version]/route.ts`          | DELETE    | `requireAdminResponse` |
| `admin/legal-documents/upload/route.ts`                          | POST      | `requireAdminResponse` |
| `admin/listings/[listingId]/reject/route.ts`                     | POST      | `requireAdminResponse` |
| `admin/listings/review/history/route.ts`                         | GET       | `requireAdminResponse` |
| `admin/listings/review/pending/route.ts`                         | GET       | `requireAdminResponse` |
| `admin/metrics/route.ts`                                         | GET       | `requireAdminResponse` |
| `admin/services/listings/[id]/reject/route.ts`                   | POST      | `requireAdminResponse` |
| `admin/services/listings/review/history/route.ts`                | GET       | `requireAdminResponse` |
| `admin/services/payment-metrics/route.ts`                        | GET       | `requireAdminResponse` |
| `admin/users/route.ts`                                           | GET       | `requireAdminResponse` |

Verified for every one of the 14 guarded files: `requireAdminResponse()` (or,
for `admin/disputes/[id]/chargeback-evidence/route.ts`, a direct
`getAuthenticatedUserResponse()` + `isAdmin` check — already tested, not in
this list) runs as the **first** statement in the handler, before `params`
is read or any body is parsed. `requireAdminResponse` (`route-helpers.ts:461`)
calls `requireAdmin` (`features/auth/utils/guards.ts:47`), which calls
`requireAuth` from `features/auth/utils/session.ts` — the same module every
existing admin route test (e.g. `admin/networks/__tests__/route.test.ts`)
mocks, per house rules. Routes that call `getAuthenticatedUserResponse()`
instead go through the same session module's `getAuthenticatedUser`.

`admin/legal-documents/[documentId]/[version]/download/route.ts:14-49` has
**no auth call of any kind** — it validates `documentId` against
`LEGAL_DOCUMENT_IDS`, fetches the version, and 302-redirects to the blob URL.
This is **SEC-24** (`01-security-findings.md:703`, LOW). Phase 3's
`R-LOW-SEC-security-privacy-sweep.md` Part C also plans it; this plan owns
it now (Step 0). Confirmed zero callers anywhere at `29fe557`:
`grep -rn "/download" src hoador-mobile/src --include=*.ts --include=*.tsx`
(outside tests) finds only the route's own comment and log label; the admin
web UI (`src/features/admin/hooks/use-admin-mutations.ts`) calls only
`/upload` and the `DELETE` on `[documentId]/[version]`; the web's public
legal documents and the mobile settings list read public blob `url`s from
`GET /api/legal-documents` (`src/app/api/legal-documents/route.ts:15`: "Never
the admin download route (SEC-24)"; mobile
`src/api/contract/legal-documents.contract.ts`); mobile has no `api/admin`
reference at all. So adding the admin gate breaks nothing.

**Module-load side effect every discovery test must handle.** Importing
the route modules directly (no per-route mocks) throws `STRIPE_SECRET_KEY is
not set` at import for 8 admin routes (`disputes/[id]/chargeback-evidence`,
the six `payments/lifecycle*`/`payments/metrics` routes,
`rentals/[id]/no-show`) and for several cron routes; one throw at top-level
`await` fails the whole test file with zero tests. Verified by running
Step 1's and Step 2's code against `29fe557` from a throwaway test file:
with `process.env.STRIPE_SECRET_KEY ??= "sk_test_..."` set before discovery,
all 34 admin files load (37 file × method pairs, all 401/403 correctly
except the SEC-24 route, which returns 400 on empty params), and all 14
cron + 2 internal routes pass Step 2's 50 cases. Vitest runs these under
`happy-dom` (the default config) with no problem, and `import.meta.dirname`
is defined.

### TEST-20 — cron/internal secret gates

`find src/app/api/cron -name route.ts | wc -l` → 14, all import
`verifyCronSecret` from `@/lib/api/verify-cron-secret.ts` and call it as
their **first** statement (`const auth = verifyCronSecret(request); if
(!auth.authorized) return auth.response;`) — confirmed for all 14, including
the 5 below. `verify-cron-secret.ts` itself has its own unit test (already
covers `verifyCronSecret` in isolation), but a route-level test proving each
route actually calls it (vs., say, a copy-paste that dropped the check) only
exists for 9 of the 14. The 5 with none:

- `cron/cleanup-cron-history/route.ts`
- `cron/cleanup-notifications/route.ts`
- `cron/detect-stale-service-processing/route.ts`
- `cron/release-reviews/route.ts`
- `cron/rental-reminders/route.ts`

`src/app/api/internal/generate-rental-agreement/route.ts:19-35` and
`generate-service-agreement/route.ts:22-38` each inline the same check
(`INTERNAL_API_SECRET` unset or still the placeholder value
`"your-internal-api-secret-here"` → 500; missing/wrong bearer → 401), and
neither has any test at all.

### TEST-17 — self-asserting tests and unpinned scoping WHEREs

**Tautologies (still present verbatim):**

- `src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts` —
  all 4 cases mock the exact function under test (`requireAuth`,
  `requireVerifiedUser`, `getAdminUser`, `requireAdmin`) and assert on the
  mock's own configured return/throw. Every one of these behaviors is
  already covered, for real, in `src/features/auth/utils/__tests__/session.test.ts`
  (`requireAuth`, `requireVerifiedUser`), `.../guards.test.ts` (`requireAdmin`),
  and `.../admin-session.test.ts` (`getAdminUser`) — confirmed by grep, all
  three files exercise the same throw/return paths against the real
  implementation. This file adds nothing; delete it.
- `src/services/stripe/__tests__/webhook-handlers-chargeback.test.ts:113`
  ("idempotent: call twice with same event, verify handleChargebackCreated
  called twice") — the assertion (`toHaveBeenCalledTimes(2)`) proves the
  **opposite** of what its name claims: the same event processed twice calls
  the handler twice, i.e. there is no dedupe (this is TEST-19's gap, LOW,
  separately tracked — not fixed here). The test itself is just mislabeled.
- `src/db/schemas/__tests__/services-phase1-schema.test.ts:15-27` — four
  `it()` blocks that only check `toBeDefined()` on a column property, so any
  default (including `undefined` if the assertion typo'd the wrong key)
  would pass as long as the property itself exists as a key. The test names
  claim specific values ("defaults to pending_approval") that are never
  checked.

**Unpinned scoping WHEREs (mocked-DAL tests only, confirmed via
`grep -n "PgDialect\|sqlToQuery" <file>` — no hits in any of these three
methods' test coverage):**

- `src/dal/listing.dal.ts:770` `searchListings(filters, pagination, userId,
visibleCommunityIds, isAdmin, skipDistance)` — `:823-838` builds
  `whereConditions` including the symmetric community-visibility filter
  (`:826` `inArray(listings.communityId, visibleCommunityIds)`, `:827`
  `eq(communityVisibility.isVisible, true)`) and, only when `!isAdmin`,
  `:837` `eq(listings.approvalStatus, "approved")`. Both the count query
  (`:911` `.where(and(...whereConditions))`) and the data query render the
  same array. `src/dal/__tests__/listing.dal.test.ts`'s existing
  `describe("searchListings", …)` (`:626+`) already has `buildCountChain`/
  `buildDataChain` helpers that expose `mockWhereCount`/`mockWhere` — no
  test today captures and renders what's actually passed to them. The
  file already imports `PgDialect` (used elsewhere, e.g. `:946-952`,
  `:1171-1176`, for unrelated methods) — same tool, new call sites.
  `src/features/listings/__tests__/integration/approval-visibility.test.ts`
  (the file TEST-17 names) mocks `listingDAL.searchListings` wholesale and
  asserts on canned return data — it never touches the real method, so it
  isn't actually pinning anything about the filter; leave it as an
  (accurately named, non-tautological) contract test on the route/service
  layer and add the real pin at the DAL level instead.
- `src/dal/payment.dal.ts:52` `getUserRentalPayments(userId, options)` —
  `:69` (count) and `:90` (data) both `.where(eq(payments.payerId, userId))`.
  `src/dal/__tests__/payment.dal.test.ts` has no `describe("getUserRentalPayments"`
  block that captures the `where` call at all today (only
  `getUserEarningsForMonth` is covered, per the file's current contents) —
  confirm this hasn't changed before writing Step 3.
- `src/dal/dispute.dal.ts:346` `getUserDisputes(userId, options)` —
  `:355-405` builds role-scoped conditions as raw `sql\`EXISTS (...)\``OR
clauses (renter:`r.renter_id = ${userId}`OR`sb.requester_id = ${userId}`; provider: the owner/provider mirrors; no
role: all four), then `:413-414`
`and(...conditions)`and`:420` `.where(whereClause)`(count),`:519` `.where(whereClause)`(data, via`db.query.disputes.findMany`).
`src/dal/**tests**/dispute.dal.test.ts`'s `describe("getUserDisputes", …)`
(`:225+`) mocks `db.select`/`db.query.disputes.findMany`and asserts only
that they were called — no rendered-SQL assertion of which rows the`EXISTS` clauses actually admit.

- `failed-auth-store` (`src/lib/auth/failed-auth-store.ts`) is fully tested
  but has **zero production callers** (`grep -rln "failed-auth-store" src
--include=*.ts | grep -v __tests__` → no hits) — genuinely dead code, not
  a test gap. Documented in Scope below; not touched by this plan (wiring it
  in is a rate-limiting feature change, ARCH-07-adjacent, not a test fix).

### TEST-18 — `test:tz`

`package.json:14`: `"test:tz": "TZ=Pacific/Kiritimati vitest run
src/features/schedule"` — one zone (14 hours ahead of UTC), one directory.
No workflow under `.github/workflows/` references `test:tz` or sets a
non-UTC `TZ` (`grep -rn "test:tz\|TZ=" .github/workflows` → no matches).
`src/features/schedule/lib/__tests__/build-schedule.test.ts:51-58` explains
_why_ mutating `process.env.TZ` inside a running vitest worker is a no-op
(the zone must be set at process start) and says "CI runs it" — false today.
The comment also explains the asymmetry that makes this dangerous: the bug
this guards (a local-midnight `Date` shifting a day when serialized) only
manifests in zones **ahead** of UTC; UTC and every Americas zone (behind
UTC) pass by accident. `test:tz` already picks an ahead-of-UTC zone
correctly; it has never been paired with a behind-UTC run, and never runs in
CI at all.

Other files with the same local-time-construction pattern, not currently
covered by `test:tz`, confirmed via `grep -n "new Date(20[0-9][0-9], [0-9]"`:

- `src/app/api/listings/[listingId]/availability/__tests__/route.test.ts:117`
  — "stores the exact calendar day asked for, from a non-UTC server" (the
  R-8.7 guard, explicit comment naming the same bug class) — runs in
  whatever zone the CI process happens to be in (UTC), so it currently
  proves nothing about non-UTC correctness.
- `src/app/api/rentals/[id]/__tests__/route.test.ts:52-53` — fixture dates
  built with `new Date(2026, 7, 22, 0, 0, 0)` and serialized with
  `toISOString()` (`:194` comment: "R-8.7 all over again").
- `src/features/services/lib/__tests__/booking-cancellation.test.ts` — the
  service-booking refund-timing calculator (service-side counterpart to the
  rental cancellation 24h-boundary tests), local-date arithmetic.

## Decisions for the maintainer

**1. Where `test:tz` runs in CI.** `.github/workflows/ci.yml` runs on every
push to `main`/`develop` and already gates `build` on `quality`+`test`
(plus a non-blocking `migrate-empty-db` tripwire). **Recommendation: a new
blocking job in `ci.yml`**, not `nightly.yml` — `test:tz` is 4 directories
of already-fast unit tests run twice (two zones), on the order of a few
seconds; nightly-only would mean a timezone regression rides on develop for
up to 24h before anyone notices, and TEST-18's whole point is that CI proves
nothing about this today. Steps below assume this; `pr-checks.yml` is left
alone (it only gates PR size + coverage, no type-check/lint either — a
separate, larger CI-topology gap this plan doesn't touch).

**2. `test:tz`'s target list.** Recommend the four paths named in "Current
state" (`schedule`, `availability`, `rentals/[id]`, `booking-cancellation`)
rather than every test file with a `new Date(year, month, day)` literal —
that would balloon the list and its maintenance burden for marginal gain;
these four are the ones with an explicit non-UTC-server comment or a named
audit item (R-8.7) attached. Steps below assume this list; if a future
timezone bug surfaces in a file not on it, add that file rather than
widening the run to `test:run`'s full breadth under two zones (slow, and
most of the suite has no local-date logic to protect).

## Commands

| Purpose                  | Command                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                | `bun run type-check`                                                                                                                         |
| Lint                     | `bun run lint`                                                                                                                               |
| Admin gate tests         | `bun run test:run src/app/api/admin`                                                                                                         |
| Cron/internal gate tests | `bun run test:run src/app/api/cron src/app/api/internal`                                                                                     |
| DAL rendered-SQL tests   | `bun run test:run src/dal/__tests__/listing.dal.test.ts src/dal/__tests__/payment.dal.test.ts src/dal/__tests__/dispute.dal.test.ts`         |
| Tautology cleanup        | `bun run test:run src/db/schemas/__tests__/services-phase1-schema.test.ts src/services/stripe/__tests__/webhook-handlers-chargeback.test.ts` |
| TZ suite (both zones)    | `bun run test:tz`                                                                                                                            |
| YAML syntax check        | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`                                                                 |
| Full suite               | `bun run test:run`                                                                                                                           |

## Scope

**In scope**: two new test files (`src/app/api/admin/__tests__/admin-route-enforcement.test.ts`,
`src/app/api/__tests__/secret-gate-enforcement.test.ts`); extensions to
`src/dal/__tests__/listing.dal.test.ts`, `payment.dal.test.ts`,
`dispute.dal.test.ts`; deleting
`src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts`;
edits to `services-phase1-schema.test.ts` and
`webhook-handlers-chargeback.test.ts`; `package.json` (`test:tz*` scripts);
`.github/workflows/ci.yml` (new job).

Plus one production file for SEC-24:
`src/app/api/admin/legal-documents/[documentId]/[version]/download/route.ts`
(Step 0) and its new `__tests__/route.test.ts`.

**Out of scope**: wiring or deleting `failed-auth-store.ts` (dead code, not a test gap —
leave to ARCH-07 or an opportunistic cleanup); TEST-19's actual webhook
dedupe (separately tracked, LOW); widening `pr-checks.yml` to run
type-check/lint (a different, larger CI gap — TEST-10/ARCH-06 territory);
any other change to `src/app/api/admin/**`, `cron/**`, `internal/**`,
`listing.dal.ts`, `payment.dal.ts`, or `dispute.dal.ts` production code.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted for
the maintainer to review and commit.

## Steps

### Step 0 (SEC-24): gate the admin legal-document download route

First re-confirm nothing but an admin could be calling it (Current state
lists what this found at `29fe557`):

```bash
grep -rn "/download" src ../hoador-mobile/src ../hoador-mobile/app --include=*.ts --include=*.tsx | grep -v "__tests__\|\.test\."
grep -rn "api/admin" ../hoador-mobile/src ../hoador-mobile/app --include=*.ts --include=*.tsx
```

Expect only the route file's own comment and `withRequestLogging` label
from the first, and nothing from the second. **STOP** if a web public page,
a non-admin component, an email template, or the mobile app links to
`/api/admin/legal-documents/.../download`: gating it would break that
consumer, so report it instead.

Then in `src/app/api/admin/legal-documents/[documentId]/[version]/download/route.ts`,
import `requireAdminResponse` from `@/lib/api/route-helpers` (next to the
existing `handleApiError` import) and make it the first statement inside
`getHandler`'s `try`, before `await params`, exactly as the sibling
`[version]/route.ts` DELETE does:

```ts
const adminError = await requireAdminResponse();
if (adminError) {
  return adminError;
}
```

Add `src/app/api/admin/legal-documents/[documentId]/[version]/download/__tests__/route.test.ts`
(mock `@/features/auth/utils/session`, per house rules; copy the mock shape
from `admin/networks/__tests__/route.test.ts`): unauthenticated → 401 and
`legalDocumentDAL.getVersion` not called; non-admin → 403, not called;
admin with a known version → 302 whose `Location` is the row's `url`;
admin with an unknown `documentId` → 400.

**Verify**: `bun run type-check` → exit 0; `bun run test:run
"src/app/api/admin/legal-documents"` → pass.

### Step 1 (TEST-15): table-driven admin auth-gate test

Create `src/app/api/admin/__tests__/admin-route-enforcement.test.ts`. It
discovers every `route.ts` under `src/app/api/admin` by **walking the
filesystem directly** with a recursive `readdirSync` and importing each file.
(`import.meta.glob("../**/route.ts")` would also work: the `[id]` brackets
are in the matched paths, not the pattern, so they don't act as a glob
character class. `readdirSync` just keeps discovery in plain Node with no
Vite transform in the way.) Set the Stripe key before discovery, or 8
modules throw at import and take the whole file down (Current state):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];
type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

// `import.meta.dirname` (Node 20.11+ / vite 8 passes it through as-is) is
// this repo's minimum (`engines.node` requires >=24). If it's ever
// `undefined` in a given runner, fall back to
// `path.dirname(fileURLToPath(import.meta.url))`.
const ADMIN_API_ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Every `route.ts` under `src/app/api/admin`, found by walking the real
 * filesystem (see file header for why not a glob). New admin routes are
 * picked up automatically the next time this file runs — no list to update.
 */
function findRouteFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findRouteFiles(full));
    else if (entry.isFile() && entry.name === "route.ts") found.push(full);
  }
  return found;
}

/** Relative label with forward slashes on every OS, for stable test names
 *  and for matching the one known-exception path below. */
function labelFor(file: string): string {
  return path.relative(ADMIN_API_ROOT, file).split(path.sep).join("/");
}

interface RouteCase {
  label: string;
  method: HttpMethod;
  handler: RouteHandler;
}

async function discoverRouteCases(): Promise<RouteCase[]> {
  const cases: RouteCase[] = [];
  for (const file of findRouteFiles(ADMIN_API_ROOT)) {
    const mod: Record<string, unknown> = await import(pathToFileURL(file).href);
    const label = labelFor(file);
    for (const method of HTTP_METHODS) {
      if (typeof mod[method] === "function") {
        cases.push({ label, method, handler: mod[method] as RouteHandler });
      }
    }
  }
  return cases;
}

// Mocked at the session layer, not route-helpers (house rule) — every admin
// route ultimately calls either `requireAdminResponse` (→ guards.ts →
// session.ts's `requireAuth`) or `getAuthenticatedUserResponse` (→
// session.ts's `getAuthenticatedUser` directly), so mocking both here covers
// every admin route regardless of which helper it uses.
const mockRequireAuth = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  getCurrentUserId: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

// A route whose handler ignores its request/params args (most GETs) still
// type-checks against this shape, so one request factory covers every case.
function makeRequest(method: HttpMethod): NextRequest {
  return new NextRequest("http://localhost/api/admin/__enforcement-probe__", {
    method,
  });
}
const dummyParams = () => ({ params: Promise.resolve({}) });

// Several routes build a Stripe client at import time and throw without a
// key. The value is never used: every case below stops at the auth gate.
process.env.STRIPE_SECRET_KEY ??= "sk_test_admin_route_enforcement";

// Every admin route, SEC-24's download route included (Step 0 gated it).
// No exclusions: a route that can't pass these two cases is a bug.
const allCases = await discoverRouteCases();

describe("Admin route auth enforcement (TEST-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovered at least the routes known at plan time", () => {
    // A floor, not a ceiling — new admin routes raise this number and are
    // covered automatically; a drop below it means discovery broke.
    expect(allCases.length).toBeGreaterThanOrEqual(37);
  });

  it("includes the SEC-24 download route", () => {
    expect(allCases.map((c) => c.label)).toContain(
      "legal-documents/[documentId]/[version]/download/route.ts",
    );
  });

  describe.each(allCases)(
    "$method /api/admin/$label",
    ({ method, handler }) => {
      it("401s an unauthenticated caller", async () => {
        mockRequireAuth.mockRejectedValue(new Error("Authentication required"));
        mockGetAuthenticatedUser.mockResolvedValue(null);

        const res = await handler(makeRequest(method), dummyParams());

        expect(res.status).toBe(401);
      });

      it("403s an authenticated non-admin", async () => {
        mockRequireAuth.mockResolvedValue({ id: "user-1", userType: "member" });
        mockGetAuthenticatedUser.mockResolvedValue({
          user: { id: "user-1", userType: "member" },
          userId: "user-1",
          isAdmin: false,
        });

        const res = await handler(makeRequest(method), dummyParams());

        expect(res.status).toBe(403);
      });
    },
  );
});
```

Set the floor to whatever the actual discovered count is when you run this
the first time (37 at `29fe557`: 34 files, some exporting more than one
method; log `allCases.length` and the per-file breakdown) — the point of the
floor is only to fail loudly if discovery silently stops matching most of
the tree (e.g. a future refactor renames `route.ts`), not to pin an exact
number that would need bumping every time a route is added.

**Verify**: `bun run test:run src/app/api/admin/__tests__/admin-route-enforcement.test.ts`
→ every discovered (file, method) pair passes both cases, the SEC-24
download route among them; the count and SEC-24-presence assertions pass.
Sanity-check the test bites: temporarily comment out Step 0's gate and
re-run; the download route's two cases must fail (it returns 400 on the
empty params). Restore the gate.

### Step 2 (TEST-20): table-driven cron/internal secret-gate test

Create `src/app/api/__tests__/secret-gate-enforcement.test.ts`. Same
filesystem-walk approach, rooted one level up so it covers both trees:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type RouteHandler = (req: NextRequest) => Promise<Response> | Response;

// See the admin enforcement test (Step 1) for the `import.meta.dirname` note.
const API_ROOT = path.resolve(import.meta.dirname, "..");

function findRouteFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findRouteFiles(full));
    else if (entry.isFile() && entry.name === "route.ts") found.push(full);
  }
  return found;
}

async function discoverIn(subdir: "cron" | "internal") {
  const root = path.join(API_ROOT, subdir);
  const cases: { label: string; get?: RouteHandler; post?: RouteHandler }[] =
    [];
  for (const file of findRouteFiles(root)) {
    const mod: Record<string, unknown> = await import(pathToFileURL(file).href);
    cases.push({
      label: `${subdir}/${path.relative(root, file).split(path.sep).join("/")}`,
      get:
        typeof mod.GET === "function" ? (mod.GET as RouteHandler) : undefined,
      post:
        typeof mod.POST === "function" ? (mod.POST as RouteHandler) : undefined,
    });
  }
  return cases;
}

function req(secret?: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest("http://localhost/api/__secret-gate-probe__", {
    method: body !== undefined ? "POST" : "GET",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Several cron routes build a Stripe client at import time (see Step 1).
process.env.STRIPE_SECRET_KEY ??= "sk_test_secret_gate_enforcement";

const cronCases = await discoverIn("cron");
const internalCases = await discoverIn("internal");

describe("Cron secret gate (TEST-20)", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("discovered all 14 cron routes", () => {
    expect(cronCases.length).toBe(14);
  });

  describe.each(cronCases)("GET /api/$label", ({ get }) => {
    it("401s with no Authorization header", async () => {
      const res = await get!(req());
      expect(res.status).toBe(401);
    });

    it("401s with the wrong secret", async () => {
      const res = await get!(req("wrong-secret"));
      expect(res.status).toBe(401);
    });

    it("500s when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;
      const res = await get!(req("test-cron-secret"));
      expect(res.status).toBe(500);
    });
  });
});

describe("Internal PDF-worker secret gate (TEST-20)", () => {
  const original = process.env.INTERNAL_API_SECRET;
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "test-internal-secret";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = original;
  });

  it("discovered both internal routes", () => {
    expect(internalCases.length).toBe(2);
  });

  describe.each(internalCases)("POST /api/$label", ({ post }) => {
    it("401s with no Authorization header", async () => {
      const res = await post!(req(undefined, {}));
      expect(res.status).toBe(401);
    });

    it("401s with the wrong secret", async () => {
      const res = await post!(req("wrong-secret", {}));
      expect(res.status).toBe(401);
    });

    it("500s when INTERNAL_API_SECRET is unset or still the placeholder", async () => {
      delete process.env.INTERNAL_API_SECRET;
      let res = await post!(req("test-internal-secret", {}));
      expect(res.status).toBe(500);

      process.env.INTERNAL_API_SECRET = "your-internal-api-secret-here";
      res = await post!(req("your-internal-api-secret-here", {}));
      expect(res.status).toBe(500);
    });
  });
});
```

Every cron/internal handler runs its secret check as the literal first
statement (confirmed for all 16 in "Current state"), so none of these
requests ever reaches a DAL or service call — no additional mocking needed
beyond the two env vars. The "discovered all N" assertions are exact (unlike
the admin file's floor) because this tree is small and stable; if a route is
added or removed, update the number as part of that change.

**Verify**: `bun run test:run src/app/api/__tests__/secret-gate-enforcement.test.ts`
→ all pass, including the previously-untested 5 cron routes and 2 internal
routes.

### Step 3 (TEST-17): rendered-SQL pins for scoping WHEREs

**3a — `listing.dal.ts` `searchListings`.** In
`src/dal/__tests__/listing.dal.test.ts`, inside `describe("searchListings",
…)`, reuse the file's existing `buildCountChain`/`buildDataChain` helpers and
its already-imported `PgDialect`. **First**, read the current
`buildCountChain`/`buildDataChain` bodies (around line 626) and change each
to also `return` the innermost `where` mock it already creates
(`mockWhereCount` in `buildCountChain`, `mockWhere` in `buildDataChain`)
alongside the `mockFromCount`/`mockFrom` they return today — every existing
call site of these two helpers destructures only the fields it needs, so
adding another key to each return object is additive and changes no
existing test. Then add:

```ts
it("scopes to approved listings and the viewer's visible communities (TEST-17)", async () => {
  vi.mocked(db.query.userAddresses.findFirst).mockResolvedValue(null as any);
  const { mockFromCount, mockWhereCount } = buildCountChain(0);
  const { mockFrom } = buildDataChain([]);
  vi.mocked(db.select).mockReturnValue({ from: mockFromCount } as any);
  vi.mocked(db.selectDistinct).mockReturnValue({ from: mockFrom } as any);

  await listingDAL.searchListings(
    {},
    { page: 1, limit: 12 },
    "user-1",
    ["community-1", "community-2"],
    /* isAdmin */ false,
    /* skipDistance */ true,
  );

  const dialect = new PgDialect();
  const { sql, params } = dialect.sqlToQuery(mockWhereCount.mock.calls[0][0]);

  expect(sql).toContain('"listings"."approval_status" = $');
  expect(params).toContain("approved");
  expect(sql).toContain('"listings"."community_id"');
  expect(params).toContain("community-1");
  expect(params).toContain("community-2");
});
```

**Cross-plan**: R-PERF-04 Part A changes the page query from
`selectDistinct` to `select` and runs it in a `Promise.all` with the count.
If that has landed, both queries come from `db.select`: mock it with a call
counter (first call → count chain, second → data chain, as 3b does) instead
of mocking `db.selectDistinct`. The assertion on `mockWhereCount` is the
same either way, since both queries get the same `whereConditions`.

Add a second case for `isAdmin: true` asserting the same rendered SQL does
**not** contain `"listings"."approval_status"` at all (the branch at
`listing.dal.ts:836-838` skips pushing that condition for admins) — this is
the half of the finding ("Admins can see all listings") that a mocked-return
test could never catch, since the mock doesn't know which conditions were
actually built.

**Verify**: `bun run test:run src/dal/__tests__/listing.dal.test.ts` → both
new cases pass; existing `searchListings` cases still pass unmodified.

**3b — `payment.dal.ts` `getUserRentalPayments`.** In
`src/dal/__tests__/payment.dal.test.ts`, add `import { PgDialect } from
"drizzle-orm/pg-core";` and a new `describe("getUserRentalPayments", …)`:

```ts
describe("getUserRentalPayments", () => {
  it("scopes both the count and the list to the caller as payer (TEST-17)", async () => {
    const mockWhereCount = vi.fn().mockResolvedValue([{ value: 0 }]);
    const mockInnerJoin2Count = vi
      .fn()
      .mockReturnValue({ where: mockWhereCount });
    const mockInnerJoin1Count = vi
      .fn()
      .mockReturnValue({ innerJoin: mockInnerJoin2Count });
    const mockFromCount = vi
      .fn()
      .mockReturnValue({ innerJoin: mockInnerJoin1Count });

    const mockOffset = vi.fn().mockResolvedValue([]);
    const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhereData = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockInnerJoin2Data = vi
      .fn()
      .mockReturnValue({ where: mockWhereData });
    const mockInnerJoin1Data = vi
      .fn()
      .mockReturnValue({ innerJoin: mockInnerJoin2Data });
    const mockFromData = vi
      .fn()
      .mockReturnValue({ innerJoin: mockInnerJoin1Data });

    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      call += 1;
      return { from: call === 1 ? mockFromCount : mockFromData } as any;
    });

    await paymentDAL.getUserRentalPayments("renter-1", { page: 1, limit: 10 });

    const dialect = new PgDialect();
    for (const mock of [mockWhereCount, mockWhereData]) {
      const { sql, params } = dialect.sqlToQuery(mock.mock.calls[0][0]);
      expect(sql).toContain('"payments"."payer_id" = $');
      expect(params).toEqual(["renter-1"]);
    }
  });
});
```

Import `paymentDAL` from `../index` at the top of the file (check whether
it's already imported — it likely isn't, since the file only currently uses
the raw `db` mock without going through the singleton for some tests;
confirm and add if missing).

**Verify**: `bun run test:run src/dal/__tests__/payment.dal.test.ts` → passes.

**3c — `dispute.dal.ts` `getUserDisputes`.** In
`src/dal/__tests__/dispute.dal.test.ts`, inside `describe("getUserDisputes",
…)`, add:

```ts
it("scopes to the caller via the role EXISTS clauses (TEST-17)", async () => {
  const mockWhereCount = vi.fn().mockResolvedValue([{ count: 0 }]);
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({ where: mockWhereCount }),
  } as any);
  vi.mocked(db.query.disputes.findMany).mockResolvedValue([]);

  await disputeDAL.getUserDisputes("user-123", {
    role: "renter",
    page: 1,
    limit: 12,
  });

  const dialect = new PgDialect();
  const { sql, params } = dialect.sqlToQuery(mockWhereCount.mock.calls[0][0]);

  expect(sql).toContain("r.renter_id = ");
  expect(sql).toContain("sb.requester_id = ");
  // The provider-side EXISTS clauses must not appear when role=renter.
  expect(sql).not.toContain("r.owner_id = ");
  expect(sql).not.toContain("sb.provider_id = ");
  expect(params.filter((p) => p === "user-123").length).toBeGreaterThanOrEqual(
    2,
  );
});
```

Add `import { PgDialect } from "drizzle-orm/pg-core";` to this file (not
currently imported). Add the mirror case for `role: "provider"` asserting
the opposite two clauses are present and the renter-side ones absent, and a
`role: undefined` case asserting all four are present — this is exactly the
branch structure at `dispute.dal.ts:355-405` and is the part a
calls-were-made-only assertion (the file's existing coverage) cannot
distinguish.

**Verify**: `bun run test:run src/dal/__tests__/dispute.dal.test.ts` → passes.

### Step 4 (TEST-17): delete/fix the tautologies

1. Delete `src/features/auth/__tests__/e2e/unauthorized-access-workflow.test.ts`
   entirely — every case it exercises is already covered, against the real
   implementation, in `session.test.ts` (`requireAuth`, `requireVerifiedUser`),
   `guards.test.ts` (`requireAdmin`), and `admin-session.test.ts`
   (`getAdminUser`). If the directory `src/features/auth/__tests__/e2e/` is
   now empty, remove it too.

2. In `src/services/stripe/__tests__/webhook-handlers-chargeback.test.ts:113`,
   rename the test and correct its framing (the assertion itself is already
   accurate about _today's_ behavior — only the name lied):

   ```ts
   // Renamed from "idempotent…": this proves the OPPOSITE — the same event
   // processed twice calls the handler twice. There is no event-id dedupe
   // yet (TEST-19, tracked separately). Do not add dedupe here.
   it("processes the same event twice with no dedupe (TEST-19 gap, not fixed here)", async () => {
   ```

   Leave the body (the two `toHaveBeenCalledTimes(2)`/`toHaveBeenNthCalledWith`
   assertions) unchanged — they're correct for current behavior.

3. In `src/db/schemas/__tests__/services-phase1-schema.test.ts:15-27`,
   replace the four `toBeDefined()` checks with the actual values the test
   names already claim:

   ```ts
   it("service_listings.status defaults to pending_approval", () => {
     expect(serviceListings.status.default).toBe("pending_approval");
   });

   it("service_bookings.status defaults to pending", () => {
     expect(serviceBookings.status.default).toBe("pending");
   });

   it("service_provider_profiles.aggregateRating allows null", () => {
     expect(serviceProviderProfiles.aggregateRating.notNull).toBe(false);
   });

   it("disputes table includes service_booking_id for service disputes", () => {
     expect(disputes.serviceBookingId.name).toBe("service_booking_id");
   });
   ```

   (R-DB-02 deletes this file's _other_ `describe`, the one that reads
   archived migration SQL by path. If it has landed, that block is already
   gone; leave the schema `describe` edits here as they are.)

   Read the actual current default/column values before writing these — if
   `.default` is a drizzle `SQL` object rather than a plain string for any of
   these columns (some drizzle defaults render as objects, not literals),
   assert on its rendered form instead (e.g. via the same `PgDialect`
   pattern) rather than forcing a plain-string comparison that would fail
   for the wrong reason.

**Verify**: `bun run test:run src/features/auth src/services/stripe/__tests__/webhook-handlers-chargeback.test.ts src/db/schemas/__tests__/services-phase1-schema.test.ts` → all pass; `git status` shows the one file deleted, two files modified.

### Step 5 (TEST-18): expand and wire up `test:tz`

In `package.json`, replace the single `test:tz` line with three scripts
(zone must be set at process start, per `build-schedule.test.ts`'s own
comment — two zones means two separate process invocations, chained):

```json
"test:tz": "bun run test:tz:ahead && bun run test:tz:behind",
"test:tz:ahead": "TZ=Pacific/Kiritimati vitest run src/features/schedule \"src/app/api/listings/[listingId]/availability\" \"src/app/api/rentals/[id]\" src/features/services/lib/__tests__/booking-cancellation.test.ts",
"test:tz:behind": "TZ=America/Chicago vitest run src/features/schedule \"src/app/api/listings/[listingId]/availability\" \"src/app/api/rentals/[id]\" src/features/services/lib/__tests__/booking-cancellation.test.ts",
```

Quote the bracketed paths — some shells (not bash's default, but be
defensive) treat `[id]` as a character class and could otherwise glob-expand
or error on no match.

In `.github/workflows/ci.yml`, add a new job alongside `quality`/`test` (same
style as the existing jobs — no Postgres service needed, this is pure unit
tests):

```yaml
# Job 2d: Timezone-sensitive date logic, run under two zones (TEST-18).
# `TZ` must be set at process start (mutating it inside a running vitest
# worker is a no-op — see build-schedule.test.ts), so this can't be folded
# into the main `test` job's single `vitest run` invocation.
timezone-tests:
  name: Timezone Tests (TEST-18)
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v6

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install

    - name: Run date-sensitive tests under two timezones
      run: bun run test:tz
```

Add `timezone-tests` to `build`'s `needs: [quality, test]` →
`needs: [quality, test, timezone-tests]`, making it blocking (unlike the
existing non-blocking `migrate-empty-db` tripwire — this one is cheap and
the whole point of TEST-18 is that it currently proves nothing, so a
non-blocking version would repeat the same mistake in a different form).

Also add `test:tz` to the local composite `bun run ci` script
(`package.json`'s `"ci"` entry) right after `test:ci`, so a local
pre-push run catches the same drift developers currently only find in
whichever zone their laptop happens to be set to.

**Verify**: `bun run test:tz` locally → both zone runs exit 0.
`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
→ no error. `grep -n "timezone-tests" .github/workflows/ci.yml` → appears in
both the new job definition and `build`'s `needs`.

## Test plan

- Step 1: `bun run test:run src/app/api/admin` — the new table-driven file
  plus every pre-existing admin route test file, all passing.
- Step 2: `bun run test:run src/app/api/cron src/app/api/internal` —
  pre-existing per-route cron tests plus the new combined secret-gate file.
- Step 3: `bun run test:run src/dal/__tests__/listing.dal.test.ts
src/dal/__tests__/payment.dal.test.ts src/dal/__tests__/dispute.dal.test.ts`.
- Step 4: `bun run test:run src/features/auth
src/services/stripe/__tests__/webhook-handlers-chargeback.test.ts
src/db/schemas/__tests__/services-phase1-schema.test.ts`.
- Step 5: `bun run test:tz` (both zones), then the YAML check.
- Full regression: `bun run test:run` and `bun run type-check && bun run lint`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including all new/changed files
- [ ] `bun run test:tz` → exit 0 (both zones)
- [ ] SEC-24: the download route calls `requireAdminResponse()` first; its
      route test covers 401/403/302/400; the Step 0 greps found no
      non-admin consumer
- [ ] Admin table-driven test discovers ≥37 (route file, method) pairs and
      401/403s every one of them, the download route included, with no
      exclusion list
- [ ] Cron table-driven test discovers exactly 14 routes, internal exactly 2;
      all 401/500 as specified, including the 5 previously-untested cron
      routes and both internal routes
- [ ] `listing.dal.ts`, `payment.dal.ts`, `dispute.dal.ts` each have at least
      one rendered-SQL (`PgDialect().sqlToQuery`) assertion on the scoping
      WHERE this plan targets
- [ ] `unauthorized-access-workflow.test.ts` deleted; the chargeback test is
      renamed and no longer claims idempotency; the schema test asserts real
      values, not `toBeDefined()`
- [ ] `.github/workflows/ci.yml` runs `test:tz` as a blocking job
- [ ] No production source file under `src/app/api/admin`, `cron`,
      `internal`, or the three DAL files is modified (`git status`), except
      the SEC-24 download route
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (also mark SEC-24 fixed here, so R-LOW-SEC Part C is verify-only)
      ("Execution order & status" and Phase 2 step outline item 8)

## STOP conditions

- Any "Current state" excerpt has drifted since `29fe557` in a way that
  changes the guard order, the WHERE-building logic, or the secret-check
  logic (not just formatting/comments) — re-read the live file and adjust
  that step only; the steps are independent.
- The admin discovery walk finds a route file whose guard mechanism is
  neither `requireAdminResponse` nor a direct `getAuthenticatedUserResponse`
  - `isAdmin` check (i.e. something this plan's mocking strategy doesn't
    cover) — report which file and its actual mechanism rather than forcing
    the generic test to pass.
- Step 0's greps find a non-admin consumer of the download route (a public
  web page, email template, or the mobile app).
- The download route already has a gate when you start (R-LOW-SEC Part C
  ran first): skip Step 0's code change, keep its route test if R-LOW-SEC
  didn't add one, and note it in your summary.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

One status change: `GET /api/admin/legal-documents/[documentId]/[version]/download`
now returns 401/403 to non-admins instead of redirecting to the blob. No
mobile or public-web caller exists (Step 0 greps; the public legal list uses
blob `url`s from `GET /api/legal-documents`). Everything else is tests,
CI and package.json.
Checked `hoador-mobile/src/api`: none of the admin, cron, or internal routes
have a mobile call site (`grep -rn "api/admin\|api/cron\|api/internal"
hoador-mobile/src` → no matches — these are web-admin-console and
server-to-server only). No mobile follow-up row needed.

## Production cutover

None. No schema or migration; the only runtime change (Step 0's admin
gate) ships with the normal deploy and needs no manual step.

## Maintenance notes

- The admin table-driven test's floor assertion
  (`toBeGreaterThanOrEqual(37)`) is intentionally loose — bump it upward
  (never downward without investigating) if the count legitimately grows,
  but don't chase an exact number the way the cron/internal test does; the
  admin tree changes far more often.
- **This plan owns SEC-24** (Step 0). Phase 3's
  `R-LOW-SEC-security-privacy-sweep.md` Part C plans the same one-line gate
  and test; when R-LOW-SEC runs, its Part C is verify-only (grep for
  `requireAdminResponse` in the download route and the route test) and must
  not re-add the gate. The coordinator should mark R-LOW-SEC Part C that way.
- A new admin route that throws at import (a new SDK client needing an env
  var) fails the whole discovery file, not one case. Set a dummy value next
  to `STRIPE_SECRET_KEY` rather than mocking the module, so the test keeps
  importing real route code.
- If a future admin route legitimately needs a _different_ guard (e.g.
  superadmin-only via `requireSuperAdmin`), the generic 403-for-non-admin
  case in Step 1 will still pass (a non-admin is also not a superadmin) but
  won't by itself prove the _stricter_ gate — add a route-specific test for
  that route the way `admin/users/[userId]/__tests__/route.test.ts` already
  does for the superadmin-demotion case (SEC-06).
- `test:tz`'s four-directory list (Decision 2) should grow the next time a
  local-date bug surfaces somewhere not already covered, rather than being
  widened preemptively.
