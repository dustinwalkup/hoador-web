# Auth E2E Testing

## Setup and run (quick reference)

1. **Start Postgres** (from repo root):

   ```bash
   docker compose up -d
   ```

   The project’s [compose.yaml](compose.yaml) runs Postgres 16 on port 5432. With this setup, use `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres` in `.env.test`.

   Alternatively, run a one-off container:

   ```bash
   docker run -d --name hoador-e2e -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
   ```

   Then use the default DB `postgres` or create one (e.g. `createdb -U postgres hoador_e2e`).

2. **Copy env and set required vars:**

   ```bash
   cp .env.test.example .env.test
   ```

   With the provided Compose, `.env.test.example` already has the correct `DATABASE_URL`. Edit `.env.test` and set at least:
   - **DATABASE_URL** – `postgresql://postgres:postgres@localhost:5432/postgres` when using [compose.yaml](compose.yaml).
   - **BETTER_AUTH_SECRET** – Any non-empty secret for test (e.g. `e2e-secret`).
   - **NEXT_PUBLIC_APP_URL** – `http://localhost:3001`.
   - **E2E_TEST** – Must be `1` when running the app for E2E (enables test DB and email capture). Optional in `.env.test` if you set it when starting the app.

3. **Push schema and seed** (once, or before each test run if you want a clean DB):

   ```bash
   bun run e2e:setup
   ```

   This pushes the current Drizzle schema to the E2E DB (no migration history), then resets and seeds.

4. **First-time setup:** Install Playwright browsers (once per machine):

   ```bash
   npx playwright install chromium
   ```

5. **Run E2E tests:**

   ```bash
   bun run test:e2e
   ```

   This runs globalSetup (push schema → reset → seed), starts the app on port 3001 with `E2E_TEST=1` (unless one is already running), and runs auth specs. For UI mode: `bun run test:e2e:ui`.

   **Important:** The app must run with `E2E_TEST=1` when executing E2E tests (Playwright’s webServer does this automatically; if you start the app manually, use `E2E_TEST=1 NEXT_PUBLIC_APP_URL=http://localhost:3001 bun run dev -- -p 3001`).

   **Convenience:** Start or stop the E2E database with `bun run e2e:db:up` and `bun run e2e:db:down`.

---

## Environment and tooling

- **E2E app port:** `3001` (so it does not conflict with dev on `3000`). Set `NEXT_PUBLIC_APP_URL` and any callback URLs to `http://localhost:3001` in `.env.test`.
- **Test database:** Use a dedicated Postgres instance (e.g. Docker). Set `DATABASE_URL` in `.env.test`.

## Schema for E2E (push, not migrate)

E2E uses **`drizzle-kit push`** so the test database matches the current schema without relying on migration order. That avoids failures when migrations are incremental (e.g. schema was evolved with `db push` and there is no single “from scratch” migration).

- **Push schema** (uses `DATABASE_URL` from `.env.test`): `bun run db:push:e2e`
- **Migrate** (if you ever need migration-based E2E): `bun run db:migrate:e2e`

## E2E database setup (push → reset → seed)

Run once before E2E tests (local or CI). Uses `DATABASE_URL` from `.env.test`:

```bash
bun run e2e:setup
```

This runs, in order: schema push (`db:push:e2e`), truncate of all app/auth tables, then E2E seed (community `E2E-JOIN-CODE`, legal docs, baseline users). To run only the seed (DB already has schema and is truncated):

```bash
bun run e2e:seed
```

## Playwright and app startup

- **globalSetup** runs once before any tests: loads `.env.test`, verifies `DATABASE_URL` and `E2E_TEST`, then runs push → truncate → seed (`bun run e2e:setup`). It does **not** start the Next.js app.
- **webServer** (in `playwright.config.ts`) starts the app on port 3001 with env from `.env.test` and `E2E_TEST=1`, and waits for readiness. Locally, `reuseExistingServer: true` is used so an already-running app on 3001 is reused.
- In CI, either let Playwright start the app via webServer, or start the app yourself on the baseURL port with `.env.test` and `E2E_TEST=1` before running tests.

## Local setup

1. Copy `.env.test.example` to `.env.test` and fill in values (at least `DATABASE_URL`, `BETTER_AUTH_SECRET`). With the repo’s [compose.yaml](compose.yaml), `DATABASE_URL` is already correct in the example.
2. Start Postgres: `docker compose up -d` (or `bun run e2e:db:up`).
3. Run tests: `bun run test:e2e` (or `bun run test:e2e:ui`). This runs globalSetup (DB push/reset/seed), then starts the app on 3001 via webServer if not already running, then runs auth E2E specs.
4. To run DB setup only: `bun run e2e:setup`. To start the app manually: `E2E_TEST=1 NEXT_PUBLIC_APP_URL=http://localhost:3001 bun run dev -- -p 3001`. To stop the E2E DB: `bun run e2e:db:down`.

## CI (GitHub Actions)

The **E2E Auth** job in `.github/workflows/pr-checks.yml` runs on pull requests. It uses a Postgres 16 service, creates `.env.test`, runs push → reset → seed, builds the app, then runs Playwright auth E2E tests (the app is started by Playwright’s webServer).

**Required secret:** `BETTER_AUTH_SECRET` must be set in the repo (Settings → Secrets and variables → Actions). Other secrets used by the build step (e.g. `STRIPE_SECRET_KEY`, `RESEND_API_KEY`) follow the same as the Performance Check job.

On failure, the workflow uploads `playwright-report/` and `test-results/` as artifacts (traces, screenshots, video).

## E2E Google OAuth mock

When `E2E_TEST=1`, the app handles a test-only Google callback so tests do not hit Google:

- **Guard:** Request must be `GET /api/auth/callback/google` with query `code=e2e-test-google`.
- **Behavior:** Skip real Google token exchange. Find or create user by email, create session, set cookie, redirect (to `state` path if it starts with `/`, else `/dashboard`).
- **Query params:** `e2e_user` (optional) — email for the test user (default `google@e2e.test`). Use a seeded user email (e.g. `email_verified@e2e.test`) to assert status-based redirects (join-code, onboarding).
- **E2E tests:** In `e2e/auth/google-oauth.spec.ts`, navigation to `accounts.google.com` is intercepted and replaced with a redirect to the app callback with `code=e2e-test-google` (and optional `e2e_user`).
