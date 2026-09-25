# Plan R-ARCH-06: Pin deploys to the CI-passed commit, gate them on e2e, and ship the mobile version kill switch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first, from `hoador-web`)**:
> `git diff --stat 25e2233..HEAD -- .github/workflows/deploy.yml .github/workflows/deploy-staging.yml .github/workflows/ci.yml vercel.json src/proxy.ts .env.example`
> On any change, compare "Current state" against live files before
> proceeding; a mismatch is a STOP condition. `hoador-mobile` is a separate
> git repo with no equivalent drift check — re-read `src/api/client.ts` and
> `src/config/build-info.ts` there directly before editing.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: LOW · **Depends on**: none
- **Category**: architecture / release engineering
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: ARCH-06, TEST-10

## Why this matters

Two gaps compound. First, the production deploy doesn't necessarily deploy
what CI tested: `deploy.yml` triggers on `workflow_run` for `CI/CD Pipeline`
but checks out `github.sha` (no `ref:`), which for that event type is the
tip of `main` at trigger time, not `workflow_run.head_sha` — the commit CI
actually ran. If a second commit lands on `main` while the first's CI run is
still in flight, that run's completion deploys the second commit, untested.
`e2e-tests.yml` runs as a wholly separate workflow on the same push and is
never consulted before a deploy; `workflow_dispatch` bypasses the CI check
entirely.

Second, there's no way to force old mobile binaries off a contract before
removing it — no route reads a version header, no config value rejects old
clients. **The mobile app hasn't shipped to a store yet — this is the last
moment the header can be added by simply writing it into the client.** Once
a binary is in the App Store/Play Store without it, any device that never
updates again can never be reached by a future kill switch.

Neither is attacker-exploitable today; both are release-integrity gaps that
turn a bad commit or a breaking mobile change into an incident with no
server-side way to contain it.

## Current state

- `.github/workflows/deploy.yml`: trigger (`5-11`) is `workflow_run` on
  `["CI/CD Pipeline"]` + `workflow_dispatch`; `check-ci` (`19-32`) only reads
  `workflow_run.conclusion`, never `E2E Tests`; `deploy-vercel`'s checkout
  (`45-46`) has no `ref:` (defaults to `github.sha`); the `vercel deploy`
  metadata tag (`73`) also uses `${{ github.sha }}`.
- `.github/workflows/deploy-staging.yml` already has half the fix: its
  checkout (`52-56`) and deploy metadata (`75`) use
  `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`. It still
  doesn't check `E2E Tests`.
- `.github/workflows/e2e-tests.yml` (`5-8`) triggers independently on
  `push: [develop, main]`, in parallel with `CI/CD Pipeline` — nothing reads
  its result downstream.
- `.github/workflows/ci.yml`'s `integration` job (`64-89`) already runs
  against a real `postgres:16` service via `bun run db:push:e2e` (schema
  `push`, not `migrate`) and is deliberately **not** in `build`'s `needs`
  (its own comment, `62-63`) — this plan's new job follows that precedent.
- **`drizzle-kit migrate` cannot rebuild the schema from an empty Postgres
  today (DB-02), confirmed by reading the migrations, not by running them**
  (see STOP conditions): `src/db/migrations/0000_setup_fields.sql` is a
  no-op guarded by `IF EXISTS (... table_name = 'listings')` — on an empty
  DB `listings` doesn't exist, so it does nothing, and no later migration
  creates the base tables (`user`, `listings`, `rentals`, `payments`, …).
  Separately, `meta/_journal.json` never journals
  `0015_sturdy_phantom_reporter.sql` (idx 15 is only
  `0015_hesitant_obadiah_stane`), and `0017_add_dispute_reference_number.sql`'s
  journal `"when"` (`1737878400000`) is earlier than `0016`'s
  (`1769375611862`), so drizzle-kit's migrator (`dialect.js:56-62`, which
  only applies a migration whose `when` is after the last one applied) skips
  it. `0072_rental_requests_no_overlap.sql`'s
  `CREATE EXTENSION IF NOT EXISTS btree_gist;` is **not** the blocker — it
  works fine on `postgres:16`'s bundled contrib extension; the batch fails
  earlier, on the missing base tables. DB-02's fix (introspect prod, squash
  to a baseline, fix/remove `0015_sturdy`/`0017`) is Phase 2
  (`10-remediation-roadmap.md:100`) — out of scope here, so this plan's
  empty-DB job is **non-blocking** (`continue-on-error: true`).
- `vercel.json` is `{}` — confirmed empty. The repo gives no signal on
  whether the Vercel project's native Git integration is _also_ connected
  and auto-deploying on push (that's a dashboard setting). See Decision 1.
- No version header or gate exists anywhere:
  `grep -rn "x-app-version\|APP_UPDATE_REQUIRED\|MIN_APP_VERSION" src .github hoador-mobile/src`
  (from `/Users/dustinwalkup/personal/hoador`) returns nothing but what this
  plan adds.
- `src/proxy.ts` (Next 16's renamed `middleware.ts` — confirmed the only
  file of that role) runs in the Edge runtime; `proxyAuth` (`181-319`)
  already reads `request.headers`/`process.env` freely, so a header/env-var
  comparison needs no runtime change or DB access.
- `hoador-mobile/src/api/client.ts`'s `apiFetch` (`95-154`) is the single
  choke point for all JSON calls; it already builds one `headers: {...}`
  object (`115-119`).
- `hoador-mobile/src/config/build-info.ts:15` already computes
  `export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'` via
  `expo-constants` (already a dependency — `expo-application` is not
  installed and isn't needed). This is the app-store version from
  `app.config.ts`'s `version: '1.0.0'` field, already used for the
  Profile-tab build-info line.
- `hoador-mobile/src/api/errors.ts`'s `classify()` (`80-95`) has no branch
  for HTTP 426 — falls through to `'unknown'`. The mobile-side blocking
  screen is a separate task (see "Mobile compatibility"); this plan ships
  only the header that makes the switch possible.

## Decisions for the maintainer

**1. Is Vercel's native Git integration also deploying on push, independent
of these workflows?** Can't be confirmed from the repo. **Recommendation:
add the `git.deploymentEnabled` kill switch to `vercel.json` regardless**
(Step 7) — a no-op if the integration was already off (plausible: every
existing deploy path here is already CLI-driven, and a duplicate-deploying
integration would likely have been noticed), and it closes the gap if it
wasn't. Verify the actual dashboard state as a production cutover step,
since that can't be done from the repo. Steps below assume this.

**2. What should `MIN_APP_VERSION` be set to right now?** The mobile app
hasn't shipped yet — this plan ships the _plumbing_, not a live gate.
**Recommendation: leave it unset in every environment.** A future plan that
removes a mobile-facing contract is the one that sets it. Steps assume this.

**3. Gating deploys on e2e makes e2e flakiness block releases.** That's the
point of the roadmap item, but if `E2E Tests` is flaky today, fix or
quarantine the flaky specs first; don't weaken the gate.
`workflow_dispatch` stays as the manual override (it skips both checks).

**4. Should the empty-DB migrate job block CI while DB-02 is open?** No real
choice: it fails today (see "Current state") and DB-02 is already Phase 2.
**Step 5 adds it as `continue-on-error: true`, informational only** — DB-02's
plan should remove that flag later.

## Commands you will need

| Purpose           | Command                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Install           | `bun install`                                                                                |
| Typecheck         | `bun run type-check`                                                                         |
| Lint              | `bun run lint`                                                                               |
| Targeted tests    | `bun run test:run src/__tests__/proxy.test.ts src/lib/api/__tests__/min-app-version.test.ts` |
| Full tests        | `bun run test:run`                                                                           |
| YAML syntax check | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/<file>.yml'))"`             |
| Mobile typecheck  | `cd ../hoador-mobile && bun run type-check`                                                  |
| Mobile tests      | `cd ../hoador-mobile && bun run test src/api/__tests__/client.test.ts`                       |

## Scope

**In scope**: `hoador-web`: `.github/workflows/ci.yml` (new non-blocking
job), `.github/workflows/deploy.yml` + `deploy-staging.yml` (head-SHA pin +
two-workflow CI/E2E gate), `vercel.json`, `.env.example`, a new
`src/lib/api/min-app-version.ts` + test, `src/proxy.ts`, and
`src/__tests__/proxy.test.ts`. `hoador-mobile` (one file, tiny):
`src/api/client.ts` — add the `x-app-version` header, sourced from the
existing `APP_VERSION`.

**Out of scope**: DB-02's migration baseline (Phase 2); the mobile-side
blocking "update required" screen and the `426` → `classify()` branch in
`hoador-mobile/src/api/errors.ts` (a real UI feature — see Mobile
compatibility); setting `MIN_APP_VERSION` to a real value anywhere;
`pr-checks.yml`; Vercel preview deploys (`vercel-preview.yml`, already
CLI-driven per PR, not a production-safety concern).

## Git workflow

Work directly on `develop` in `hoador-web`. For the one mobile file, work on
`hoador-mobile`'s current branch (that repo has no develop/main split — see
its `AGENTS.md`). Do not commit or push in either repo — leave changes
uncommitted for the maintainer.

## Steps

### Step 1: Mobile — send `x-app-version` on every request (tiny, do first)

In `hoador-mobile/src/api/client.ts`, add:

```ts
import { appConfig } from "@/config/app-config";
import { APP_VERSION } from "@/config/build-info";

import { ApiError } from "./errors";
```

and in `apiFetch`'s `fetch(...)` call:

```ts
      headers: {
        'Content-Type': 'application/json',
        Cookie: sentCookie,
        'x-app-version': APP_VERSION,
        ...headers,
      },
```

One import, one header line, reusing the version string `build-info.ts`
already computes — no new dependency. `...headers` still comes after it, so
a caller can override (none currently do or need to).

**Verify** (from `hoador-mobile`): `bun run type-check` → exit 0;
`bun run test src/api/__tests__/client.test.ts` → all pass (existing tests
assert specific header values, not the full header map, so this is safe).

### Step 2: hoador-web — the version-compare helper

Create `src/lib/api/min-app-version.ts`:

```ts
/**
 * Server-side minimum-app-version gate (ARCH-06 / TEST-10). Disabled unless
 * MIN_APP_VERSION is set. A request with no x-app-version header (web, or a
 * binary shipped before this plan) is never gated — fail-open by design.
 */

/** "1.2.3" -> [1,2,3]; anything else -> null. */
function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * True only when both parse AND appVersion < minVersion. A misconfigured
 * MIN_APP_VERSION or an unparsable client header both fail OPEN (false) —
 * a typo in the env var must never lock every client out.
 */
export function isAppVersionBelowMinimum(
  appVersion: string,
  minVersion: string,
): boolean {
  const parsedMin = parseSemver(minVersion);
  if (!parsedMin) return false;
  const parsedApp = parseSemver(appVersion);
  if (!parsedApp) return false;
  for (let i = 0; i < 3; i++) {
    if (parsedApp[i] !== parsedMin[i]) return parsedApp[i] < parsedMin[i];
  }
  return false;
}
```

Add to `.env.example` after the `# App URL` block (after line 52):

```
# Minimum supported mobile app version (ARCH-06 kill switch). Unset = gate
# disabled — correct until a contract removal needs to force old binaries
# off the API. Format "MAJOR.MINOR.PATCH", e.g. "1.2.0".
# MIN_APP_VERSION=
```

**Verify**: `bun run type-check` → exit 0.

### Step 3: hoador-web — wire the gate into `proxy.ts`

> **Coordinate with R-PERF-03 (roadmap 1.14) first.** That plan makes the
> proxy skip `/api/*` with its own `if (pathname.startsWith("/api/"))` block
> right after `shouldSkipMiddleware`, and it deletes the `isPublicApiRoute`
> skip below. The two plans share **one** block. Check the roadmap status of
> 1.14:
>
> - **1.14 DONE:** don't add a second block. Put the two version-gate
>   lines inside its block, before its `return NextResponse.next();`:
>   ```ts
>   if (pathname.startsWith("/api/")) {
>     const versionGateResponse = checkMinAppVersion(request);
>     if (versionGateResponse) return versionGateResponse;
>     return NextResponse.next(); // PERF-03
>   }
>   ```
> - **1.14 not done:** apply the snippet below as written. 1.14's executor
>   will add the `return` inside this block later (its plan says how).
>
> Either way, Step 4's `/api/auth/session` test is what proves the gate runs
> for auth routes.

Add the import and a helper near the top-level functions:

```ts
import { isAppVersionBelowMinimum } from "@/lib/api/min-app-version";

const APP_UPDATE_REQUIRED_BODY = {
  error: "Please update the app to continue.",
  code: "APP_UPDATE_REQUIRED",
} as const;

/**
 * ARCH-06 kill switch. Gates every /api/* request, including auth, so a
 * too-old binary can't even sign in. Fails open when MIN_APP_VERSION is
 * unset or the caller sends no x-app-version header.
 */
function checkMinAppVersion(request: NextRequest): NextResponse | null {
  const minVersion = process.env.MIN_APP_VERSION;
  if (!minVersion) return null;
  const appVersion = request.headers.get("x-app-version");
  if (!appVersion) return null;
  if (!isAppVersionBelowMinimum(appVersion, minVersion)) return null;
  return NextResponse.json(APP_UPDATE_REQUIRED_BODY, { status: 426 });
}
```

Call it in `proxyAuth`, right after `shouldSkipMiddleware`'s early return and
before the public-API-route skip (so it also covers `/api/auth`,
`/api/profile`):

```ts
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const versionGateResponse = checkMinAppVersion(request);
    if (versionGateResponse) return versionGateResponse;
  }

  // Skip middleware for public API routes
  if (isPublicApiRoute(pathname)) {
```

**Verify**: `bun run type-check` → exit 0.

### Step 4: hoador-web — tests for the gate

`src/lib/api/__tests__/min-app-version.test.ts`: below/equal/above cases for
`isAppVersionBelowMinimum`, plus both fail-open cases (unparsable app
version, unparsable min version).

`src/__tests__/proxy.test.ts`, new `describe("proxy.ts — minimum app version
gate")` (extend the file's `makeRequest` helper to accept an optional
headers arg, or build a `NextRequest` inline with a `headers` init):

- `MIN_APP_VERSION` unset (default) → any header value passes through.
- `vi.stubEnv("MIN_APP_VERSION", "2.0.0")`, no header on `/api/listings` →
  passes through (not 426).
- Same stub, `x-app-version: "1.0.0"` on `/api/rentals` → `426`,
  `{error, code: "APP_UPDATE_REQUIRED"}`.
- Same stub, `x-app-version: "2.0.0"` → not 426.
- Same stub, `x-app-version: "1.0.0"` on `/api/auth/session` → also `426`
  (proves the gate runs before the public-API-route skip).
- Unstub the env var after each test.

**Verify**: `bun run test:run src/__tests__/proxy.test.ts src/lib/api/__tests__/min-app-version.test.ts` → all pass.

### Step 5: hoador-web CI — non-blocking empty-DB migrate job

In `.github/workflows/ci.yml`, add a job alongside `integration` (before
`build`), mirroring its `services`/`env` pattern:

```yaml
# DB-02 tripwire: migrate can't yet rebuild the schema from empty Postgres
# (0000 is a no-op; base tables are never created; 0015_sturdy/0017 have
# journal bugs — Phase 2). continue-on-error so this reports the gap
# without blocking deploys. Remove the flag once DB-02 lands.
migrate-empty-db:
  name: Migrate Empty DB (non-blocking — DB-02, Phase 2)
  runs-on: ubuntu-latest
  continue-on-error: true
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_PASSWORD: postgres
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 5s
        --health-timeout 5s
        --health-retries 5
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
  steps:
    - uses: actions/checkout@v6
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}
    - run: bun install
    - name: Migrate an empty database
      run: bun run db:migrate
    - name: Check migration/schema consistency
      run: bunx drizzle-kit check
```

Deliberately not in `build`'s `needs` — same reasoning as `integration`'s
existing comment.

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` → no error. Do not run this job locally against a real database — see STOP conditions.

### Step 6: hoador-web CI — pin and gate the production deploy

In `.github/workflows/deploy.yml`:

**6a.** Widen the trigger:

```yaml
on:
  workflow_run:
    workflows: ["CI/CD Pipeline", "E2E Tests"]
    types:
      - completed
    branches: [main]
  workflow_dispatch:
```

**6b.** Replace `check-ci` with a job that resolves the commit once and
confirms both workflows succeeded _for that commit_ — either workflow
finishing second is what fires this trigger, so the check has to look both
up by SHA, not just trust the one that fired it:

```yaml
jobs:
  check-ci:
    name: Check CI Status
    runs-on: ubuntu-latest
    permissions:
      actions: read
    outputs:
      should-deploy: ${{ steps.check.outputs.should-deploy }}
      head-sha: ${{ steps.check.outputs.head-sha }}
    steps:
      - name: Resolve commit and confirm CI + E2E passed on it
        id: check
        uses: actions/github-script@v8
        with:
          script: |
            const isDispatch = context.eventName === "workflow_dispatch";
            const headSha = isDispatch ? context.sha : context.payload.workflow_run.head_sha;
            core.setOutput("head-sha", headSha);
            if (isDispatch) {
              core.setOutput("should-deploy", "true");
              return;
            }
            for (const workflowName of ["CI/CD Pipeline", "E2E Tests"]) {
              const { data } = await github.rest.actions.listWorkflowRunsForRepo({
                owner: context.repo.owner,
                repo: context.repo.repo,
                head_sha: headSha,
                event: "push",
              });
              const run = data.workflow_runs.find((r) => r.name === workflowName);
              if (!run || run.status !== "completed" || run.conclusion !== "success") {
                core.info(`"${workflowName}" for ${headSha}: not yet successful — skipping this trigger.`);
                core.setOutput("should-deploy", "false");
                return;
              }
            }
            core.setOutput("should-deploy", "true");
```

No `core.setFailed` when the other workflow isn't done yet: whichever of the
two finishes first no-ops here; whichever finishes second deploys. That's
steady-state, not a failure — don't flag it as one.

**6c.** Point `deploy-vercel` at the resolved SHA:

```yaml
deploy-vercel:
  needs: check-ci
  if: needs.check-ci.outputs.should-deploy == 'true'
  environment: production
  steps:
    - uses: actions/checkout@v6
      with:
        ref: ${{ needs.check-ci.outputs.head-sha }}
```

...and change `-m githubCommitSha=${{ github.sha }}` to
`-m githubCommitSha=${{ needs.check-ci.outputs.head-sha }}`.

**6d.** Set the workflow's existing `concurrency` block (`14-16`, group
`deploy-${{ github.ref }}`) to `cancel-in-progress: false`. Once this
workflow fires twice per commit (once per upstream workflow), leaving it at
`true` means the no-op run for commit B can cancel a deploy of commit A that
is still in flight. If B then fails CI, production is left on the commit
before A. With `false`, runs queue instead: a deploy is never killed halfway,
and a newer pending run still replaces an older pending one. The cost is
rare: if CI and E2E finish within seconds of each other, both runs may see
both successes and deploy the same SHA twice, one after the other, which
does no harm.

**Verify**: YAML syntax check on `deploy.yml`. There's no local way to
exercise `workflow_run`; real verification is the first `main` push after
this lands (see Done criteria).

### Step 7: hoador-web CI — same pin + gate for staging

Apply 6a-6d to `.github/workflows/deploy-staging.yml` (`branches: [develop]`):
widen `workflows:` to `["CI/CD Pipeline", "E2E Tests"]`; in the replacement
`check-ci` script, keep its existing PR-run skip (a `workflow_run` whose
`event` was `pull_request` must still be skipped) as an early check before
the loop, using `context.payload.workflow_run.event === "pull_request"`;
point `deploy-vercel`'s checkout `ref:` and the `githubCommitSha` metadata at
`needs.check-ci.outputs.head-sha` (the `githubCommitRef` tag can keep its
current `head_branch || 'develop'` expression — that part isn't broken).

**Verify**: YAML syntax check on `deploy-staging.yml`.

### Step 8: hoador-web — disable Vercel's Git auto-deploy (Decision 1)

Replace `vercel.json`'s `{}` with:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": false,
      "develop": false
    }
  }
}
```

Preview deploys for other branches/PRs are untouched (already CLI-driven);
this only disables the native Git integration's auto-deploy for the two
branches these gated workflows own.

**Verify**: `python3 -c "import json; json.load(open('vercel.json'))"` → no error.

## Test plan

Step 4's cases (the version-compare helper and the `proxy.ts` gate,
including both fail-open paths), plus a full `bun run test:run` for
regressions, plus mobile's existing `client.test.ts`/`msw-smoke.test.ts`
with the new header. No automated test can exercise `workflow_run` behavior
locally — the YAML syntax checks in Steps 5-8 are the available signal;
real verification is the next `main`/`develop` push (Done criteria).

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0 (hoador-web)
- [ ] `bun run test:run` → exit 0, new tests from Step 4 included
- [ ] `ci.yml`, `deploy.yml`, `deploy-staging.yml` all parse as YAML
- [ ] `vercel.json` parses as JSON and contains the `git.deploymentEnabled` block
- [ ] Mobile: `bun run type-check` and existing client tests pass with the new header (Step 1)
- [ ] `grep -n "x-app-version" hoador-mobile/src/api/client.ts` shows the new header line
- [ ] No files outside Scope modified in either repo (`git status` in both)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` (the `1.17` row gets the plan link; add a row to "Execution order & status")
- [ ] Row added to the roadmap's **Mobile client follow-ups** table for the future 426 handler (see Mobile compatibility)
- [ ] Rows added to `13-production-cutover.md` per "Production cutover" below
- [ ] **Post-merge, manual**: the next push to `main` produces exactly one production deploy, and its `githubCommitSha` metadata matches the pushed commit, not a later one — record the result in the roadmap status row

## STOP conditions

- Excerpts above don't match the live files — re-read before editing.
- Do **not** run `bun run db:migrate` or any `db:*` script against any real database (dev, staging, the e2e DB, or a scratch container) to verify Step 5 or the DB-02 analysis — the "Current state" conclusion is drawn from reading the migration files, which is sufficient without writing to a database.
- If `actions/github-script@v8` can't read workflow runs with the default `GITHUB_TOKEN` (a permissions/org-policy issue) — report it; don't broaden token permissions beyond `actions: read` without asking.
- If a test fails twice after a reasonable fix attempt.
- If `vercel.json`'s `git.deploymentEnabled` shape is wrong for this project (e.g. the dashboard shows the integration was never connected, or this key errors on deploy) — flag as a STOP; needs the maintainer to check the Vercel dashboard directly (Decision 1).

## Mobile compatibility

- **Step 1 (in scope here)**: every mobile request now sends
  `x-app-version: <the binary's app.config.ts version>`. Purely additive —
  no route reads it yet outside the new (inert) gate, and no existing call
  site changes behavior. `hoador-mobile/src/api/contract/` needs no change —
  this is a request header, not a response shape.
- **426 handling is explicitly not built here** — a blocking "please update"
  screen that locks navigation, reads the error body's `code`, and
  deep-links to the store listing is a real feature, not a tiny tweak, and
  the app isn't live yet. Add this row to the roadmap's Mobile client
  follow-ups table:

  | Fix       | Contract change                                                                                                                   | Where the app sees it    | Mobile task | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | R-ARCH-06 | New possible response: `426 {error, code: "APP_UPDATE_REQUIRED"}` on any `/api/*` call, once a future plan sets `MIN_APP_VERSION` | every API call, globally | — (new)     | TODO — needs a new `'update-required'` `ApiErrorKind` in `errors.ts`'s `classify()` for `status === 426`; a global handler wired the same way `onUnauthorized`/`onAccountRestricted` are configured in `configureApiClient`; a blocking (non-dismissible) screen with a store-listing deep link. Not urgent until a future plan sets `MIN_APP_VERSION`, but should exist before that happens — today's `classify()` would bucket an unhandled 426 as `'unknown'`. |

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-ARCH-06 — verify Vercel Git integration state` | From:
  R-ARCH-06 | dev: n/a | staging: n/a | prod: TODO. Before the first
  production deploy under this gate, open Vercel dashboard → Project →
  Settings → Git and confirm automatic deploys for `main` are off (either
  never connected, or honoring the new `vercel.json` setting) — confirm by
  checking a direct push to `main` produces no deployment other than
  `deploy.yml`'s explicit `vercel deploy --prod` call.
- **New row**: `R-ARCH-06 — confirm exactly one pinned prod deploy per main
push` | From: R-ARCH-06 | prod: TODO — the Done-criteria manual check
  above, repeated here since it affects real traffic.
- No migration, data cleanup, or Stripe step is needed — no schema change, no new external integration call.

## Maintenance notes

- When DB-02's Phase 2 plan lands, remove `continue-on-error: true` from
  `migrate-empty-db` and add it to `build`'s `needs`. Until then, a
  red/orange `migrate-empty-db` job on every CI run is expected.
- `MIN_APP_VERSION` stays unset after this plan. The plan that removes a
  mobile-facing contract should set it — and only after confirming the
  mobile blocking-screen follow-up above has shipped in a released binary,
  or users hit a 426 with no UI explaining why.
- `pr-checks.yml` runs on PRs into `develop` only (the repo goes
  develop→main via a reset-hard merge, not a PR). TEST-10 flagged running it
  on `main` PRs too — a separate, smaller decision about the branch
  workflow itself, not part of this deploy-gating fix.
