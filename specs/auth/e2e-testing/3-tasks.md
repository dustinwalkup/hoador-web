# Auth E2E Testing - Implementation Tasks

This task list converts the [design document](./2-design.md) into actionable implementation steps. Tasks are ordered by dependency. Each task is testable and references requirements from [1-requirements.md](./1-requirements.md).

**Complexity:** S = small (~≤1 hour), M = medium (1–2 hours), L = large (2+ hours).

---

## 1. Environment and dependency setup

- [ ] 1.1 Add Playwright test dependency and create `.env.test.example`
  - Add `@playwright/test` as a devDependency (keep existing `playwright` for PDF generation).
  - Create `.env.test.example` with placeholders: `DATABASE_URL`, `E2E_TEST=1`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`; add short comments for each.
  - Add `test:e2e` and `test:e2e:ui` scripts to `package.json` (e.g. `playwright test e2e/auth`, `playwright test e2e/auth --ui`).
  - _Requirements: 1.7, 2.3_

- [ ] 1.2 Add E2E database and app port to tooling
  - Document or add a small script that runs `drizzle-kit migrate` with `DATABASE_URL` from env (for use in globalSetup and CI).
  - Choose and document the E2E app port (e.g. `3001`) and ensure it does not conflict with dev.
  - _Requirements: 1.5, 2.1_

---

## 2. Test database connection and app DB selection

- [ ] 2.1 Implement `src/db/db-e2e.ts`
  - Create module that loads `DATABASE_URL` from env, instantiates `pg.Pool` with it (and SSL config for non-local URLs if needed, mirroring `db-seed.ts`), and exports `db` as `drizzle(pool, { schema, logger: false })` using the same `schema` as `src/db/db.ts`.
  - Throw a clear error at module load if `DATABASE_URL` is missing.
  - Do not use `neon()` or Neon HTTP driver.
  - _Requirements: 1.1, 1.2_

- [ ] 2.2 Make app use E2E database when `E2E_TEST=1`
  - In `src/db/db.ts`, when `process.env.E2E_TEST === '1'`, export `db` from `./db-e2e`; otherwise keep existing Neon-based `db`. Use a conditional require/import so that `db-e2e` is only loaded in E2E mode.
  - Ensure no duplicate or circular imports; all existing imports of `@/db/db` continue to work without change.
  - _Requirements: 1.3, 2.2_

---

## 3. Email capture and test-only API

- [ ] 3.1 Implement in-memory email capture module
  - Create `src/test/e2e/email-capture.ts` (or equivalent path) that exports `captureEmail(type: 'verification' | 'reset', url: string): void` and `getLastCapturedUrl(type: 'verification' | 'reset'): string | null`.
  - Use a module-level `Map` or two variables; last-wins semantics per type.
  - Optionally export `clearCapturedEmails()` for test isolation if needed later.
  - _Requirements: 3.1, 3.2, 3.6_

- [ ] 3.2 Branch Better Auth email hooks in test mode
  - In `src/services/better-auth/index.ts`, at the start of `sendVerificationEmail` and `sendResetPassword` callbacks, if `process.env.E2E_TEST === '1'`, call the email capture helper with the appropriate type and URL, then return without calling Resend.
  - Keep existing Resend logic unchanged when not in E2E mode.
  - _Requirements: 3.1, 3.4_

- [ ] 3.3 Add test-only route `GET /api/test/last-email`
  - Create `src/app/api/test/last-email/route.ts`. If `process.env.E2E_TEST !== '1'`, return 404 with no body.
  - Otherwise, read `type` from query (default `verification`), call `getLastCapturedUrl(type)`, return JSON `{ url: string | null }`. Document behavior when no URL has been captured yet.
  - _Requirements: 3.3, 3.5, 9 (test-only guard)_

---

## 4. E2E seed and reset

- [ ] 4.1 Implement E2E seed script
  - Create `src/db/seeds/e2e.seed.ts` (or add an E2E mode to existing seed) that uses the same `db` as the E2E context (e.g. import from a module that uses `db-e2e` when run with E2E env).
  - Seed one community with join code `E2E-JOIN-CODE` (or a constant defined in the seed).
  - Seed legal documents required at signup (TOS, Privacy, Community Guidelines) per `src/constants/legal-documents.ts` and existing legal_documents schema.
  - Seed baseline users with a single E2E password constant (hashed with Better Auth’s `hashPassword`): one user each with status `active`, `email_verified`, `incomplete_profile`, `pending_verification`, and one admin (`userType: 'admin'`, status `active`). Use stable emails (e.g. `active@e2e.test`, `email_verified@e2e.test`, `incomplete@e2e.test`, `unverified@e2e.test`, `admin@e2e.test`) and create necessary related rows (e.g. `user_addresses`, `user_preferences`, `community_memberships` for users that need a community).
  - Export a `main()` (or equivalent) so the seed can be run via `tsx src/db/seeds/e2e.seed.ts` or from globalSetup.
  - _Requirements: 13.1, 13.2_

- [ ] 4.2 Implement E2E database reset (truncate)
  - Create a small script or exported function that runs the same TRUNCATE list and order as `src/db/seeds/seed.ts` (all tables from dispute\_\* through `"user"` with RESTART IDENTITY CASCADE), using the E2E db connection (e.g. from `db-e2e` when DATABASE_URL is set).
  - Invoke this from E2E globalSetup (or a dedicated setup script) before seed. Do not change the production seed file’s truncate list; reuse the list by reference or copy.
  - _Requirements: 1.4, 13.3_

- [ ] 4.3 Wire E2E setup: migrate, reset, seed
  - Ensure migrations run once before reset+seed (e.g. in globalSetup or CI step) using `DATABASE_URL` from `.env.test`.
  - Ensure order: migrate → truncate → run E2E seed. Add a single script or globalSetup that does this so local and CI can share the same flow.
  - _Requirements: 1.4, 1.5, 13.3_

---

## 5. Playwright configuration and global setup

- [ ] 5.1 Create `playwright.config.ts`
  - Add `playwright.config.ts` at repo root. Set `baseURL` from `process.env.PLAYWRIGHT_BASE_URL` or default `http://localhost:3001`. Set `testTimeout` (e.g. 30s) and `expect` timeout (e.g. 10s).
  - Configure one project for auth E2E (e.g. `e2e/auth`) with `workers: 1`. Set `retries: process.env.CI ? 0 : 1`. Set `reporter`: list + HTML; in CI optionally add GitHub reporter.
  - Set `outputDir: 'test-results'`; enable `trace: 'on-first-retry'` or `'on'`, `screenshot: 'only-on-failure'`, `video: 'on-first-retry'` or `'on'` for artifact collection on failure.
  - _Requirements: 2.4, 14.4_

- [ ] 5.2 Implement globalSetup for E2E
  - In globalSetup, load `.env.test` (or require env to be set by CI). Verify `DATABASE_URL` and `E2E_TEST` are set; exit with a clear message if not.
  - Run migrations (e.g. spawn `drizzle-kit migrate` or use programmatic migration with E2E db).
  - Run truncate then E2E seed using the same E2E db. On failure, exit with a clear error (e.g. “E2E database reset/seed failed”).
  - Do not start the Next.js app in globalSetup if the app will be started by CI or `webServer`; document that the app must be started separately with `.env.test` and the chosen port.
  - _Requirements: 1.4, 1.5, 2.3, 13.3_

- [ ] 5.3 Configure webServer or document app startup
  - Either add `webServer` in `playwright.config.ts` to run `next dev -p 3001` (or `next start -p 3001` after build) with env from `.env.test`, and set `reuseExistingServer: !process.env.CI`, or document that the developer/CI must start the app on the baseURL port before running tests. Ensure readiness is waited for (e.g. `webServer.url` or polling GET baseURL).
  - _Requirements: 2.1, 2.4_

---

## 6. E2E test specs (auth flows)

- [ ] 6.1 Test: full signup-to-dashboard funnel (email/password)
  - Create a test file (e.g. `e2e/auth/signup-funnel.spec.ts`) that implements the BDD scenario “Complete signup-to-dashboard funnel”: open signup, fill email/password/name, accept legal docs, submit; assert redirect to verify-email and that verification URL is available from GET `/api/test/last-email`; navigate to that URL; assert redirect to join-code; submit `E2E-JOIN-CODE`; assert redirect to onboarding; complete onboarding form and submit; assert redirect to dashboard and ability to access a protected route.
  - Use unique email per run (e.g. `e2e-${Date.now()}@e2e.test`) if the same DB is reused to avoid duplicate-email errors.
  - _Requirements: 5, 6, 7, 8_

- [ ] 6.2 Test: login success and failure
  - Add tests for login with valid credentials (seeded active user) → redirect to dashboard; and for invalid credentials → error message, no redirect to dashboard.
  - Add test for unverified user (pending_verification) attempting login → assert denied or redirect to verify-email as per app behavior.
  - _Requirements: 9_

- [ ] 6.3 Test: status-based redirect (re-login and navigation)
  - Add test: log in as seeded `email_verified` user → assert redirect to join-code (not dashboard). Optionally complete join-code and assert redirect to onboarding.
  - Add test: log in as seeded `incomplete_profile` user → assert redirect to onboarding (not dashboard). Optionally complete onboarding and assert redirect to dashboard.
  - Add test: authenticated user with status `email_verified` navigates to `/dashboard` or `/` → assert redirect to join-code.
  - Add test: authenticated user with status `incomplete_profile` navigates to `/dashboard` or `/` → assert redirect to onboarding.
  - _Requirements: 9.4–9.6, 11.4–11.6_

- [ ] 6.4 Test: unauthenticated access to protected route
  - Add test: without logging in, navigate to `/dashboard` → assert redirect to `/login` and optionally that `callbackUrl` is set.
  - _Requirements: 11.2_

- [ ] 6.5 Test: password reset flow
  - Add test: request password reset for a seeded user’s email; assert success message; GET `/api/test/last-email?type=reset` and navigate to URL; submit new password; assert redirect or success; log in with new password and assert redirect to dashboard.
  - _Requirements: 10_

- [ ] 6.6 Test: logout and subsequent access
  - Add test: log in as active user, trigger logout, then navigate to `/dashboard` → assert redirect to login.
  - _Requirements: 12_

- [ ] 6.7 Test: invalid or expired verification/reset tokens (optional but recommended)
  - Add test: visit a verification URL with an invalid or expired token → assert error state and no verification.
  - Add test: visit a reset URL with invalid/expired token → assert error and no password change.
  - _Requirements: 6.2, 10.3_

---

## 7. Google OAuth mock (test-only branch)

- [ ] 7.1 Implement test-only OAuth callback branch
  - In the code path that handles the Google OAuth callback (e.g. Better Auth’s callback or the app’s handler that exchanges `code` for tokens), add a guarded branch: when `process.env.E2E_TEST === '1'` and the request has `code=e2e-test-google` (or a documented constant), skip the real Google token/userinfo calls. Instead, find or create a test user (e.g. by email from query or a fixed seed user), create or update session, and redirect as on successful Google login.
  - Document the exact guard and how to pass a specific test user (e.g. query param `e2e_user=google@e2e.test`) if multiple Google test users are needed.
  - _Requirements: 4.1–4.4_

- [ ] 7.2 E2E test: Google OAuth sign-in (mocked)
  - Add test: intercept navigation to Google’s authorize URL and redirect the browser to the app’s callback with `?code=e2e-test-google&state=...` (and state matching what the app expects if required). Assert that the user is created or linked and redirected (e.g. to join-code, onboarding, or dashboard depending on seeded state).
  - _Requirements: 4_

---

## 8. CI/CD integration

- [ ] 8.1 Add E2E auth job to PR workflow
  - In `.github/workflows/pr-checks.yml`, add a job (e.g. `e2e-auth`) that runs on the same `pull_request` triggers as existing jobs.
  - Steps: checkout; setup Node/Bun; install deps; start PostgreSQL service container (e.g. `postgres:16`) with health check; set `DATABASE_URL` to the service; create or copy `.env.test` with `E2E_TEST=1`, `DATABASE_URL`, `BETTER_AUTH_SECRET` (from secrets), and other required vars; run migrations; run E2E seed; build the app; start the app on the chosen port (e.g. 3001) in background; wait for readiness (e.g. `curl -f $baseURL` or equivalent); install Playwright browsers (e.g. `npx playwright install --with-deps chromium`); run `npx playwright test e2e/auth` with `PLAYWRIGHT_BASE_URL` set.
  - On job failure, upload artifacts: `playwright-report/`, `test-results/` (traces, screenshots, video) using `actions/upload-artifact` with `if: failure()`.
  - Document required secrets (e.g. `BETTER_AUTH_SECRET`) in the workflow file or a short README section.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

---

## 9. Documentation and scripts

- [x] 9.1 Document E2E setup and run instructions
  - Add a short section to the repo README or `docs/e2e-auth.md`: how to run Docker Postgres locally, copy `.env.test.example` to `.env.test`, run migrations and seed, start the app, run `bun run test:e2e` (or equivalent). List required env vars and that `E2E_TEST=1` must be set when running the app for E2E.
  - _Requirements: 14.5_

---

## Task summary and requirement coverage

| Req                                 | Tasks                   |
| ----------------------------------- | ----------------------- |
| 1 (Test DB)                         | 2.1, 2.2, 4.2, 4.3, 5.2 |
| 2 (App Server)                      | 1.2, 2.2, 5.1, 5.3, 8.1 |
| 3 (Email Mock)                      | 3.1, 3.2, 3.3           |
| 4 (OAuth Mock)                      | 7.1, 7.2                |
| 5–8 (Signup, Verify, Join, Onboard) | 4.1, 6.1                |
| 9 (Login)                           | 6.2, 6.3                |
| 10 (Password Reset)                 | 6.5, 6.7                |
| 11 (Session/Protected)              | 6.3, 6.4                |
| 12 (Logout)                         | 6.6                     |
| 13 (Seed)                           | 4.1, 4.2, 4.3, 5.2, 8.1 |
| 14 (CI)                             | 5.1, 8.1, 9.1           |

All 14 requirements are covered by at least one implementation task. No task is purely non-coding (e.g. UAT or deployment); each can be completed by writing or modifying code and tests.
