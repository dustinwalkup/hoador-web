# Auth E2E Testing - Design Document

## Overview

This design document describes the technical architecture for the Auth E2E test suite: a Playwright-based end-to-end test system that runs against a real Next.js application and a dedicated PostgreSQL test database, with email and Google OAuth behavior mocked so that verification/reset URLs are capturable and OAuth flows are testable without real external services.

The design satisfies Requirements 1–14 from [1-requirements.md](./1-requirements.md) by introducing: (1) a test database connection and lifecycle (Docker Postgres, migrations, reset, seed), (2) conditional application behavior in test mode (database driver selection, email capture, optional OAuth bypass), (3) test-only API surfaces for URL retrieval, (4) Playwright configuration and test layout, and (5) CI integration with the existing PR workflow.

## Architecture

### High-Level Architecture

The E2E system has three main parts: the **test runner** (Playwright), the **application under test** (Next.js configured for E2E), and the **test database** (Docker Postgres). Mocks are implemented inside the app (email) and optionally at the network or app layer (OAuth).

```mermaid
flowchart TB
  subgraph runner [Test Runner]
    Playwright[Playwright Test]
    Config[playwright.config.ts]
    Tests[Auth E2E Tests]
    Playwright --> Config
    Playwright --> Tests
  end

  subgraph app [Application Under Test]
    NextApp[Next.js App]
    Middleware[proxy.ts]
    BetterAuth[Better Auth]
    DBAdapter[DB Adapter]
    EmailHook[Email Hook]
    TestAPI["/api/test/*"]
    NextApp --> Middleware
    NextApp --> BetterAuth
    BetterAuth --> DBAdapter
    BetterAuth --> EmailHook
    NextApp --> TestAPI
  end

  subgraph data [Data and Mocks]
    TestDB[(Docker Postgres)]
    EmailStore[(In-Memory Email Store)]
    DBAdapter --> TestDB
    EmailHook --> EmailStore
    TestAPI --> EmailStore
  end

  Tests --> NextApp
  Tests --> TestAPI
```

### E2E Execution Flow

```mermaid
sequenceDiagram
  participant Dev as Developer/CI
  participant Docker as Docker
  participant DB as Test DB
  participant App as Next.js App
  participant PW as Playwright

  Dev->>Docker: Start Postgres container
  Dev->>DB: Run migrations (drizzle-kit migrate)
  Dev->>DB: Reset + seed (truncate, then seed script)
  Dev->>App: Start app (env from .env.test, PORT=3xxx)
  App->>DB: Connect via node-postgres (db-e2e)
  Dev->>PW: npx playwright test e2e/auth
  PW->>App: GET baseURL (wait until ready)
  loop Test cases
    PW->>App: Drive browser (signup, login, etc.)
    App->>DB: Read/write via db-e2e
    App->>EmailStore: Capture URL (verification/reset)
    PW->>App: GET /api/test/last-email
    App-->>PW: { url }
    PW->>App: Navigate to url, assert redirects
  end
  PW-->>Dev: Pass/fail + artifacts on failure
```

### Requirements Traceability (Architecture)

| Requirement           | Design Element                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Req 1 (Test DB)       | Docker Postgres; `src/db/db-e2e.ts` with `pg.Pool`; reset/seed in globalSetup or beforeAll; migrations before run    |
| Req 2 (App Server)    | Next.js started on dedicated port; `baseURL` in Playwright config; app uses test DB when `E2E_TEST=1`                |
| Req 3 (Email Mock)    | Better Auth hooks branch on `E2E_TEST`; in-memory store; `/api/test/last-email`                                      |
| Req 4 (OAuth Mock)    | Playwright route interception and/or test-only OAuth bypass (see Components)                                         |
| Req 5–12 (Auth Flows) | Covered by test specs and app behavior; no new app tables                                                            |
| Req 13 (Seed)         | E2E seed script: communities, legal docs, baseline users by status                                                   |
| Req 14 (CI)           | New job in `.github/workflows/pr-checks.yml`: service container, migrate, seed, start app, run Playwright, artifacts |

## Components and Interfaces

### 1. Test Database Connection (`src/db/db-e2e.ts`)

**Purpose:** Provide a Drizzle instance that uses `node-postgres` (`pg.Pool`) for compatibility with local/Docker Postgres. The production app uses `neon()` (Neon serverless driver), which is not suitable for a TCP Postgres instance.

**Interface:**

- Export a single `db` instance (same shape as `src/db/db.ts`: `drizzle(sql, { schema, logger: false })`).
- Connection: `new Pool({ connectionString: process.env.DATABASE_URL, ssl: ... })`. For local Docker, `ssl` can be `false` or omitted; for Neon-style URLs (if ever used in E2E), keep `ssl: { rejectUnauthorized: false }` as in `db-seed.ts`.
- Throw at module load if `DATABASE_URL` is missing when this module is imported (so E2E never accidentally runs without a DB).

**Usage:** The main app database reference used by Better Auth and DALs must resolve to this connection when running in E2E mode. See §2 (Database Selection in App).

**Requirements:** 1.1, 1.2, 1.3.

### 2. Database Selection in Application

**Problem:** `src/db/db.ts` currently uses `neon(DATABASE_URL)` and is imported by `src/services/better-auth/index.ts` and elsewhere. Neon’s HTTP driver does not work against a standard Postgres server (e.g. Docker).

**Options:**

- **A) Conditional export in `db.ts`:** If `process.env.E2E_TEST === '1'` (or a dedicated `DATABASE_URL` pattern), re-export `db` from `db-e2e.ts`; otherwise use existing Neon setup. Single import path for the rest of the app.
- **B) Separate entry point for E2E:** Build/start the app with a different entry or env that replaces `db` with the E2E connection. More invasive.

**Decision:** Use **Option A**. In `src/db/db.ts`: when `E2E_TEST === '1'`, import and re-export `db` from `./db-e2e`; otherwise keep current Neon-based `db`. No changes to Better Auth or DAL imports. `.env.test` sets `E2E_TEST=1` and `DATABASE_URL` to the Docker Postgres URL.

**Requirements:** 1.3, 2.2.

### 3. Database Reset and Migrations

**Reset:** Reuse the truncation list and order from `src/db/seeds/seed.ts` (TRUNCATE ... RESTART IDENTITY CASCADE). Invoke from a Node script or from Playwright’s `globalSetup` / test `beforeAll` using the same `db` instance (from `db-e2e`) so that the app and the reset script share the same DB.

**Migrations:** Run `drizzle-kit migrate` (or equivalent programmatic migration) with `DATABASE_URL` from `.env.test` before starting the app or tests. Can be part of CI job steps or a single E2E setup script.

**Seed:** After reset, run the E2E seed (see §7). Order: truncate → migrate (if not already applied) → seed.

**Requirements:** 1.4, 1.5, 13.3.

### 4. Environment and Application Startup for E2E

**`.env.test`:** Provide at least: `DATABASE_URL`, `E2E_TEST=1`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000` or the chosen port), `RESEND_API_KEY` (dummy value so Resend module does not throw), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`. Do not commit real secrets; use placeholders or CI secrets.

**Starting the app:** From the repo root, load `.env.test` and start Next.js on a dedicated port (e.g. `3001`): `PORT=3001 node .next/standalone/server.js` or `next dev -p 3001` with env loaded. Playwright `baseURL` is `http://localhost:3001` (or the chosen port). Use a readiness check (e.g. poll `GET baseURL/` or a health route) before running tests.

**Requirements:** 1.7, 2.1, 2.3, 2.4.

### 5. Email Transport Mock (In-Memory Store + Test API)

**Behavior in test mode:** When `E2E_TEST === '1'`, the Better Auth hooks that send verification and password-reset emails must not call Resend. Instead they call a test helper that appends the callback URL to an in-memory store (e.g. a module-level array or Map keyed by type `verification` | `reset`). Last-wins semantics: each new email overwrites the stored URL for that type (or append and take last); document the chosen semantics for tests.

**Implementation options:**

- **A) Branch in Better Auth config:** In `src/services/better-auth/index.ts`, inside `sendVerificationEmail` and `sendResetPassword`, if `process.env.E2E_TEST === '1'`, call `testCaptureEmail('verification', url)` or similar, then return without calling Resend.
- **B) Stub Resend in test:** Less preferred because the app uses dynamic import for Resend; stubbing would require either a test-specific module resolution or patching the import.

**Decision:** **Option A.** Introduce a small module `src/test/e2e/email-capture.ts` (or under `src/lib` with a name that makes clear it is test-only): it exports `captureEmail(type, url)` and `getLastCapturedUrl(type)`. It is only imported from Better Auth when `E2E_TEST === '1'`. The module holds an in-memory store (e.g. `Map<string, string>`). Better Auth hooks in test mode call `captureEmail` and return without calling Resend.

**Test-only API route:** Add `src/app/api/test/last-email/route.ts`. On `GET`, if `E2E_TEST !== '1'`, return 404. Otherwise read `getLastCapturedUrl(query.type)` (e.g. `type=verification` or `type=reset`) and return JSON `{ url: string }`. Query param `type` defaults to `verification` if not specified. This route is only registered in the app; it is not deployed to production if `E2E_TEST` is never set there.

**Requirements:** 3.1–3.6.

### 6. OAuth (Google) Mocking

**Challenge:** After the user “clicks” Google sign-in, the browser is redirected to Google; the app then exchanges the code for tokens and userinfo on the **server**. Playwright can intercept browser requests but not the server’s outbound HTTPS calls to Google.

**Options:**

- **A) Mock OAuth server:** Run a small HTTP server that implements Google’s authorize redirect, token endpoint, and userinfo endpoint. Set `.env.test` so that the app thinks Google’s host is the mock (e.g. via proxy or custom redirect URIs). No app code branch; app just uses different env. Downside: need to match Better Auth’s expected query params and response shapes.
- **B) Test-only branch in app:** When `E2E_TEST === '1'` and the OAuth callback receives a well-known test `code` (e.g. `code=e2e-test-google`), skip the real token/userinfo calls and create or look up a test user and session directly. Small, guarded change in the auth callback or in a wrapper around the Google provider. No mock server.

**Decision:** Prefer **Option B** for first implementation: minimal surface, no extra process. Document the exact guard (e.g. `E2E_TEST === '1' && code === 'e2e-test-google'`). In the test, intercept the navigation to Google’s authorize URL and redirect the browser directly to the app’s callback with `?code=e2e-test-google&state=...` so that the server runs the test-only branch. Support multiple test users by allowing a query param or cookie to select which seeded Google user to use (e.g. `e2e-test-google:user1`). If the team later prefers no app branching, Option A can be implemented (mock server + env).

**Requirements:** 4.1–4.4.

### 7. E2E Seed Data

**Content:** Seed script (or reuse/adapt `src/db/seeds/seed.ts` with an E2E-specific list) must create:

- **Communities:** At least one community with a known join code (e.g. `E2E-JOIN-CODE`) for use in BDD scenarios.
- **Legal documents:** Records in `legal_documents` (and any related tables) required at signup (TOS, Privacy, Community Guidelines) so that signup form validation and acceptance succeed.
- **Baseline users:** One user per status with known credentials where login is needed:
  - `active`: e.g. `active@e2e.test` / known password (for login and logout tests).
  - `email_verified`: e.g. `email_verified@e2e.test` (for status-based redirect to join-code).
  - `incomplete_profile`: e.g. `incomplete@e2e.test` (for status-based redirect to onboarding).
  - `pending_verification`: e.g. `unverified@e2e.test` (for login-denied or verify-email redirect).
  - `admin`: e.g. `admin@e2e.test` with `userType: 'admin'` if admin E2E is added later.

Passwords hashed with the same algorithm as production (e.g. Better Auth’s `hashPassword`). Use a single shared E2E password constant (e.g. `E2E_PASSWORD`) for all seeded users; document it in the test plan.

**Execution:** Run after truncate, using the same `db-e2e` connection. Can be a dedicated `src/db/seeds/e2e.seed.ts` or a mode of the existing seed (e.g. `seed.ts --e2e`).

**Requirements:** 13.1, 13.2.

### 8. Playwright Configuration

**File:** `playwright.config.ts` at repo root (new). Add devDependency `@playwright/test` if not present.

**Key settings:**

- **baseURL:** `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001'` (or the port used when starting the app).
- **timeout:** e.g. `testTimeout: 30_000`; `expect` timeout 10s.
- **workers:** Use 1 worker for the auth E2E suite to avoid shared in-memory email store and DB state conflicts (Req 3, edge case “Parallel test workers”). Alternatively, run auth tests in a single project with `workers: 1`.
- **retries:** 0 in CI (so failures are deterministic); optional 1 retry locally.
- **reporter:** List + HTML; in CI add GitHub Actions reporter or JUnit for integration.
- **outputDir:** `test-results/`; **artifacts on failure:** `trace: 'on-first-retry'` or `'on'`, `screenshot: 'only-on-failure'`, `video: 'on-first-retry'` or `'on'` so that traces, screenshots, and video are available when tests fail (Req 14.4).
- **projects:** Optional separate project for auth (e.g. `e2e/auth`) so that `workers: 1` and `dependency` (e.g. globalSetup) apply only to auth.

**Global setup:** Use Playwright `globalSetup` to start Docker Postgres (if not already running), run migrations, run reset + seed, and optionally start the Next.js app. Alternatively, start the app in CI via a job step and only use globalSetup for DB init; then in config, `webServer: { command: '...', url: baseURL, reuseExistingServer: !process.env.CI }` can start the app and wait for readiness.

**Requirements:** 2.4, 14.4.

### 9. Test-Only Route Guard

All routes under `src/app/api/test/` must return 404 when `E2E_TEST !== '1'`. Implement with a shared check at the top of each route handler or via a small wrapper. Do not register test routes in production builds if the build env never sets `E2E_TEST`; as an extra safeguard, the runtime check ensures no production request can read captured emails or trigger test OAuth.

**Requirements:** 3.5, Security (non-functional).

### 10. CI/CD Job (PR Checks)

**File:** `.github/workflows/pr-checks.yml`.

**New job:** e.g. `e2e-auth`. Runs on `pull_request` to `develop` (same as existing jobs). Steps:

1. Checkout.
2. Setup Node/Bun and install dependencies.
3. Start PostgreSQL service container (e.g. `postgres:16` with env `POSTGRES_PASSWORD=postgres` and health check). Set `DATABASE_URL` to point to the service (e.g. `postgresql://postgres:postgres@localhost:5432/postgres`).
4. Load or set E2E env (e.g. copy `.env.test.example` to `.env.test` and substitute `DATABASE_URL` from step 3; set `E2E_TEST=1`, `BETTER_AUTH_SECRET` from secrets, etc.).
5. Run migrations: `drizzle-kit migrate` (or `bun run db:migrate`) with `DATABASE_URL`.
6. Run seed: `tsx src/db/seeds/seed.ts` or the E2E seed script, with `DATABASE_URL` and `E2E_TEST=1`.
7. Build the app (if not using `next dev`): `bun run build`. Optionally use `next start -p 3001` or the framework’s production server.
8. Start the app (if not using `webServer` in Playwright): e.g. `next start -p 3001` in background with env from `.env.test`.
9. Wait for readiness: e.g. `curl -f $baseURL` or use Playwright’s `webServer.url` wait.
10. Install Playwright browsers if not cached: `npx playwright install --with-deps chromium`.
11. Run tests: `npx playwright test e2e/auth` (or the configured project path) with `PLAYWRIGHT_BASE_URL` and any required env.
12. On failure, upload artifacts: `playwright-report/`, `test-results/` (traces, screenshots, video). Use `actions/upload-artifact` with `if: failure()`.

**Secrets:** Document that the job needs at least `BETTER_AUTH_SECRET` (and optionally `NEXT_PUBLIC_APP_URL`). Do not use production DB or production secrets.

**Requirements:** 14.1, 14.2, 14.3, 14.4, 14.5.

## Data Models

No new application database tables are introduced. The following are test-infrastructure concepts.

### In-Memory Email Store

- **Shape:** `Map<'verification' | 'reset', string>` (or two variables) holding the last captured URL per type.
- **Lifecycle:** Cleared between tests if tests run sequentially and isolation is required; or last-wins per type and tests are written to trigger the email they need (e.g. one verification per test). Design decision: document “last-wins” and optional reset in `beforeEach` in the test plan.

### E2E Seed User (Logical)

- **active:** `{ email, password, status: 'active', userType: 'standard' }` — for login success and dashboard access.
- **email_verified:** `{ email, password, status: 'email_verified' }` — for join-code redirect and re-login scenario.
- **incomplete_profile:** `{ email, password, status: 'incomplete_profile' }` — for onboarding redirect and re-login scenario.
- **pending_verification:** `{ email, password, status: 'pending_verification', emailVerified: false }` — for login denied or verify-email redirect.
- **admin:** `{ email, password, status: 'active', userType: 'admin' }` — for future admin E2E.

All use the same schema as production (`user`, `session`, `account`, etc.); only the seed data and join codes (e.g. `E2E-JOIN-CODE`) are fixed for tests.

## Error Handling

### Test Infrastructure

- **DB connection failure:** If `db-e2e` or migration fails (e.g. Docker not running, wrong `DATABASE_URL`), fail the suite at startup with a clear message (e.g. “E2E database unavailable: …”). Do not run tests against a wrong or missing DB.
- **App not ready:** Playwright (or CI script) SHALL wait for the app with a timeout (e.g. 60s). On timeout, fail with “Application did not become ready at baseURL”.
- **Missing env:** If required env vars for E2E are missing (e.g. `E2E_TEST`, `DATABASE_URL`), fail fast in globalSetup or in the first test with a descriptive error.

### Test-Only Routes

- **Production access:** If `E2E_TEST !== '1'`, return 404 for `/api/test/*` without leaking that the route exists.
- **No URL captured yet:** If a test calls `GET /api/test/last-email` before any email was sent, return a deterministic response (e.g. `{ url: null }` or 404) and document so tests can assert accordingly.

### Flakiness and Retries

- In CI, run with retries 0 so that failures are not masked. Locally, optional retry 1 to reduce noise from transient issues. Rely on deterministic reset/seed and single worker for auth to avoid cross-test interference.

## Testing Strategy

- **Unit tests:** Not in scope for this design; existing Vitest tests for auth remain unchanged.
- **E2E coverage:** Playwright tests implement the BDD scenarios and acceptance criteria from 1-requirements.md. Each major flow (signup-to-dashboard, login success/failure, status-based redirect, password reset, logout, unauthenticated redirect) has at least one test. Traceability: tag or name tests by requirement ID (e.g. `Req 9`, `Req 11`) in the test plan.
- **Test isolation:** Single worker for auth suite; reset DB (truncate + seed) in globalSetup or beforeAll so that each run starts from a clean state. Tests that create new users (e.g. signup) use unique emails (e.g. `e2e-${Date.now()}@e2e.test`) to avoid collisions when running in sequence.
- **Artifacts:** On failure, collect Playwright trace, screenshot, and video so that CI failures can be diagnosed without re-running locally (Req 14.4).

## Design Decisions Summary

| Decision           | Options Considered                         | Choice                               | Rationale                                                                                  |
| ------------------ | ------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| DB driver for E2E  | Neon HTTP vs node-postgres                 | node-postgres (`db-e2e.ts`)          | Neon driver does not work with Docker Postgres; db-seed already uses pg.Pool.              |
| App DB selection   | Separate entry vs conditional in db.ts     | Conditional in `db.ts` on `E2E_TEST` | Single code path; no duplicate imports; minimal change.                                    |
| Email mock         | Stub Resend vs branch in Better Auth hooks | Branch in hooks + in-memory store    | Resend is dynamically imported; branching in hooks is explicit and avoids module patching. |
| OAuth mock         | Mock server vs test-only app branch        | Test-only branch for first version   | No extra process; small, guarded code path; mock server possible later.                    |
| Playwright workers | Multiple vs one                            | One worker for auth suite            | Avoids shared email store and DB state; deterministic.                                     |
| Test-only API      | Separate server vs Next.js route           | Next.js route under `/api/test/`     | Same origin as app; no CORS; guarded by `E2E_TEST`.                                        |

## References

- Requirements: [specs/auth/e2e-testing/1-requirements.md](./1-requirements.md)
- Existing DB seed pattern: [src/db/db-seed.ts](../../src/db/db-seed.ts)
- Existing truncate/seed order: [src/db/seeds/seed.ts](../../src/db/seeds/seed.ts)
- Better Auth email hooks: [src/services/better-auth/index.ts](../../src/services/better-auth/index.ts)
- Middleware (protected routes, status redirects): [src/proxy.ts](../../src/proxy.ts)
- PR workflow: [.github/workflows/pr-checks.yml](../../.github/workflows/pr-checks.yml)
