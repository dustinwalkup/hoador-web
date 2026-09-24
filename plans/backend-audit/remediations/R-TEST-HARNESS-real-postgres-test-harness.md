# R-TEST-HARNESS: Real-Postgres integration test harness

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- vitest.config.mjs compose.yaml src/db/db-e2e.ts scripts/e2e-setup.ts scripts/e2e-migrate.ts .github/workflows/e2e-tests.yml package.json`
> A mismatch against "Current state" below is a STOP condition.

## Status

- **Priority**: P0 (supporting) · **Effort**: M · **Risk**: LOW (additive —
  no existing test config is removed, only extended)
- **Depends on**: none — but `R-BIZ-01`, `R-CONC-01` and `R-CONC-02` each
  reference this plan for their real-DB race tests and should treat those
  as deferred until this lands
- **Category**: tests / dx · **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

Every DAL test mocks `db`; no test runs against a real Postgres. Worse, the
mocks fabricate a pg error shape (`{code:"23505"}` directly on the thrown
error) that drizzle-orm 0.45 never produces — it wraps every driver error in
`DrizzleQueryError` and puts the pg code on `.cause` (SEC-16). Concretely:
`blind-review.dal.test.ts` (~line 67) does
`Object.assign(new Error("dup"), {code:"23505"})`, and
`neighborhood-needs.dal.test.ts` (~line 565) rejects with a bare
`{code:"23505"}` object — both verified by direct read, neither shape
matches what drizzle actually throws. So `BaseDAL.handleError`'s `error.code`
checks (`base.ts:21-23,46-58`) pass in tests and fail in production, and
there is no way to write a real concurrency (CAS race) test today. Audit
finding TEST-07 (MEDIUM); it is the named prerequisite for the HIGH-severity
race tests in three other plans.

## Current state

- `compose.yaml` — `postgres:16`, port 5432, `pg_isready` healthcheck. Also
  used by e2e.
- `src/db/db-e2e.ts` — a ready-to-import Drizzle instance:
  `drizzle-orm/node-postgres` over a `pg.Pool`, requires `DATABASE_URL`
  (throws if unset), SSL disabled for `localhost`. Not gated by `E2E_TEST`.
- `scripts/e2e-setup.ts` — loads `.env.test`, runs `bun run db:push:e2e`
  (schema push, **not** migrate — sidesteps DB-02's broken migration
  history), then `runE2EReset()` (imported from `./e2e-reset`, truncates),
  then seeds via `src/db/seeds/e2e.seed.ts`.
- `scripts/e2e-migrate.ts` — runs `npx drizzle-kit migrate` against
  `DATABASE_URL` from `.env.test`; exists but the e2e setup above does not
  use it (uses push instead).
- `.env.test.example` — template: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres`, `E2E_TEST=1`, plus auth/email placeholders.
- `vitest.config.mjs` — one project, `environment:"happy-dom"`,
  `exclude:["e2e/**","**/node_modules/**"]`. No pattern currently excludes
  or includes an "integration" test file glob — a new `*.integration.test.ts`
  file would otherwise be picked up (and fail, no DB) by the regular
  `bun run test:run`/CI `test:ci`.
- `.github/workflows/e2e-tests.yml:16-29` — the CI postgres **service
  container** pattern to mirror exactly:
  ```yaml
  services:
    postgres:
      image: postgres:16
      env: { POSTGRES_PASSWORD: postgres }
      ports: ["5432:5432"]
      options: >-
        --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5
  ```
- `src/dal/__tests__/rentals.dal.test.ts:45-46` — the `renderWhere` SQL-
  rendering technique already used across several DAL test files
  (`const renderWhere = (where) => new PgDialect().sqlToQuery(where)`,
  `PgDialect` from `drizzle-orm/pg-core`, `SQL` type from `drizzle-orm`).
  Keep using this for WHERE-clause assertions; this plan is only for tests
  that need a _real_ constraint or a _real_ two-connection race.

**Conventions**: `bun` only. Do not read `.env.test`/`.env.local` contents —
only their documented shape (`.env.test.example`).

## Commands

| Purpose                   | Command                                     | Expected                                            |
| ------------------------- | ------------------------------------------- | --------------------------------------------------- |
| Typecheck                 | `bun run type-check`                        | exit 0                                              |
| Local DB                  | `docker compose up -d`                      | postgres healthy                                    |
| Schema                    | `bun run db:push:e2e` (against `.env.test`) | pushes current schema                               |
| New integration run       | `bun run test:integration`                  | all pass, serially                                  |
| Existing suite unaffected | `bun run test:run`                          | still all pass, no `.integration.test.ts` picked up |

## Scope

**In scope**: `vitest.integration.config.mjs` (new), `vitest.config.mjs`
(add one `exclude` entry), `package.json` (`test:integration` script), a
new `src/test/integration/` helpers directory (seed factories, Stripe-mock
barrier, concurrency runner), one proof-of-concept test, `.github/workflows/ci.yml`
(new job).

**Out of scope**: fixing DB-02 (migration history); rewriting the existing
e2e Playwright suite; the actual race tests for BIZ-01/CONC-01/CONC-02
(those plans own their own test files and import this harness).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Exclude integration tests from the regular suite

In `vitest.config.mjs`, add `"**/*.integration.test.ts"` to `test.exclude`
(alongside `"e2e/**"`). **Verify**: `bun run test:run` → unchanged pass
count (nothing new picked up yet, since no such file exists).

### Step 2: `vitest.integration.config.mjs`

New file, modeled on `vitest.config.mjs` but: `environment: "node"`,
`include: ["src/**/*.integration.test.ts"]`, `fileParallelism: false` (serial
across files — shared DB state), `setupFiles: ["./src/test/integration/setup.ts"]`,
`testTimeout: 20000`. No `happy-dom`, no coverage block (this suite is
correctness-only). Add `"test:integration": "vitest run --config vitest.integration.config.mjs"`
to `package.json` scripts.

**Verify**: `bun run type-check` → exit 0 (config file only, no tests yet).

### Step 3: Setup/teardown and seed factories

`src/test/integration/setup.ts` — `beforeEach`: truncate all app tables
(reuse `runE2EReset` from `scripts/e2e-reset.ts` if its granularity fits a
per-test call; otherwise write a narrower truncate scoped to the tables
these tests touch — `user`, `listings`, `rental_requests`, `rentals`,
`service_bookings`, `payments`, `rental_payment_lifecycle`). Import the DB
instance from `src/db/db-e2e.ts` (already gated on `DATABASE_URL`; do not
create a second connection module).

`src/test/integration/factories.ts` — minimal insert helpers returning the
created row: `createUser(overrides?)`, `createListing(ownerId, overrides?)`,
`createRentalRequest(listingId, renterId, ownerId, overrides?)`,
`createServiceBooking(...)`. Keep them thin wrappers over `db.insert(...).values({...defaults, ...overrides}).returning()`.

`src/test/integration/stripe-barrier.ts` — a controllable async gate:

```ts
export function createBarrier() {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { wait: () => gate, release };
}
```

Used to `vi.mock` a Stripe helper (e.g. `chargeRentalPayment`) so its
implementation `await`s the barrier before resolving, letting a test start
two concurrent calls and control which one "finishes" first.

`src/test/integration/run-concurrently.ts` — `async function raceTwo<T>(a: () => Promise<T>, b: () => Promise<T>): Promise<{results: PromiseSettledResult<T>[]}>`
wrapping `Promise.allSettled([a(), b()])`, plus an assertion helper
`expectExactlyOneFulfilled(results)`.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Proof-of-concept test — pin the real `DrizzleQueryError` shape

`src/dal/__tests__/base.integration.test.ts` (or similar): insert the same
unique value twice through a real DAL call that hits a known unique
constraint (e.g. two rentals with the same `rentals.request_id`, or a
simpler direct duplicate insert against any uniquely-constrained table) and
assert the caught error, before `handleError` runs, has
`(error as {cause?:{code?:string}}).cause?.code === "23505"` — pinning the
exact shape SEC-16 describes, on a real driver error rather than a mock.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration` → this test passes.

### Step 5: CI job

In `.github/workflows/ci.yml`, add a new job (mirror the `postgres:`
services block from `.github/workflows/e2e-tests.yml:16-29` verbatim):

```yaml
integration:
  name: Integration Tests (real Postgres)
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env: { POSTGRES_PASSWORD: postgres }
      ports: ["5432:5432"]
      options: >-
        --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5
  steps:
    - uses: actions/checkout@v6
    - uses: oven-sh/setup-bun@v2
      with: { bun-version: latest }
    - run: bun install
    - run: bun run db:push:e2e
      env:
        { DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres }
    - run: bun run test:integration
      env:
        { DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres }
```

Do not add this job to `quality`/`test`/`build`'s `needs:` chain in this
plan — wiring it into required-checks / branch protection is a repo-admin
action outside a code change's scope; leave it running independently.

**Verify**: workflow YAML is valid (`bun run lint` won't catch YAML — visually
diff against `e2e-tests.yml`'s structure); cannot execute GitHub Actions
from this environment.

## Test plan

- Step 4's proof-of-concept IS the primary deliverable test for this plan.
- Add one more real-constraint test once R-CONC-01 lands: inserting two
  overlapping `approved` rental requests for one listing throws with
  `cause.code === "23P01"` — write it in R-CONC-01's own test file, not here,
  once that migration exists (this plan does not depend on R-CONC-01).

**Verify**: `bun run test:integration` → all pass. `bun run test:run` → unaffected.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:integration` → exit 0, includes the Step 4 test
- [ ] `bun run test:run` → same pass count as before this plan (no
      `.integration.test.ts` leaks into the default run)
- [ ] `.github/workflows/ci.yml` has a new `integration` job with a
      `postgres` service container
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Live code doesn't match "Current state" (drift since `21bdc61`).
- `runE2EReset` truncates more than this suite needs (e.g. drops seed data
  another workflow depends on) in a way that isn't safely reusable per-test —
  fall back to a narrower hand-written truncate list and report which
  tables you scoped it to.
- `vitest`'s `fileParallelism: false` option isn't available in the pinned
  `vitest@^4.1.8` — fall back to `poolOptions.threads.singleThread: true` (or
  the pool-equivalent for whichever pool `vitest.config.mjs` inherits) and
  report which option worked.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

None — this plan adds no application code paths, only test infrastructure.
No API response shape, status code or error code changes. Not applicable.

## Maintenance notes

- `db:push:e2e` cannot apply a migration-only change that has no TS schema
  representation (e.g. `R-CONC-01`'s GIST exclusion constraint). If a race
  test needs such a constraint present, apply that one migration's SQL file
  directly against the integration DB as an extra setup step (e.g. `psql -f
src/db/migrations/00NN_*.sql`) rather than switching this harness to full
  `drizzle-kit migrate` — DB-02 documents that migration history doesn't
  cleanly rebuild a schema today, and this plan deliberately avoids that
  landmine by using push.
- Keep integration tests to money/concurrency correctness only (per the
  audit's own framing) — this is not a place to move ordinary unit-testable
  logic; the mocked-DAL suite remains the default for everything else.
- Serial execution (`fileParallelism:false`) keeps this suite slow by
  design; do not parallelize without also fixing per-test isolation (shared
  DB, truncate-between-tests).
