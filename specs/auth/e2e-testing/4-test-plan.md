# Test Plan: Auth E2E Testing

This test plan defines how to verify the Auth E2E testing feature implemented per [1-requirements.md](./1-requirements.md) and [2-design.md](./2-design.md). It covers only **E2E tests** executed with Playwright against the running Next.js application and test database. Unit and integration tests for auth remain under the existing [specs/auth/4-test-plan.md](../4-test-plan.md).

## Requirements Traceability

Every requirement from [1-requirements.md](./1-requirements.md) is covered by at least one E2E test or by infrastructure verification (e.g. test-only route returns 404 when not in E2E mode).

| Req ID | Requirement Summary                                                  | Test Coverage                                                                   |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1      | Test database infrastructure (Docker, node-postgres, reset, migrate) | globalSetup / CI steps; tests fail fast if DB unavailable                       |
| 2      | Test application server (port, baseURL, test DB)                     | Playwright baseURL and webServer; tests run against app                         |
| 3      | Email transport mocking (capture, no Resend, test API)               | Tests that use GET /api/test/last-email; infra test for 404 when E2E_TEST unset |
| 4      | OAuth (Google) mocking                                               | Google OAuth E2E test (mocked callback)                                         |
| 5      | Signup flow (create user, legal docs, duplicate email)               | Signup funnel test; optional duplicate-email test                               |
| 6      | Email verification (valid/invalid token, redirect)                   | Signup funnel (valid); invalid-token test                                       |
| 7      | Community join code (valid/invalid)                                  | Signup funnel (valid); optional invalid join-code test                          |
| 8      | Profile onboarding (form, redirect, status)                          | Signup funnel; status-based redirect tests                                      |
| 9      | Login (active, invalid, unverified, status-based redirect)           | Login success/failure tests; re-login redirect tests                            |
| 10     | Password reset (request, capture URL, reset, login)                  | Password reset E2E test; invalid-token test                                     |
| 11     | Session and protected routes (access, redirect, expired)             | Unauthenticated redirect; status redirect; optional expired-session test        |
| 12     | Logout (invalidate, deny after)                                      | Logout E2E test                                                                 |
| 13     | Test data seeding (communities, legal docs, users)                   | All tests depend on seeded data; seed run in globalSetup/CI                     |
| 14     | CI/CD (run on PR, fail job, artifacts)                               | CI job definition; artifact upload on failure                                   |

## Test Types

### E2E Tests (Playwright)

All tests in this plan are **end-to-end**: they run in a real browser (Chromium by default), drive the Next.js app via the configured `baseURL`, and assert on redirects, content, and (where applicable) the test-only API for captured email URLs. The app uses the test database and E2E mocks (email capture, optional OAuth bypass).

- **Framework:** `@playwright/test`
- **Config:** `playwright.config.ts` (baseURL, timeouts, 1 worker for auth project, artifacts on failure)
- **Location:** `e2e/auth/*.spec.ts` (or path configured in Playwright project)

### Infrastructure / Guard Verification (Optional)

- **Test-only route guard:** A small test or manual check that when `E2E_TEST` is not set, `GET /api/test/last-email` returns 404. Can be implemented as a unit test or a separate Playwright run without E2E env (expect 404).

## Test Environment

- **Database:** PostgreSQL in Docker (or CI service container); URL from `.env.test` or CI env.
- **Application:** Next.js started with `E2E_TEST=1` and `.env.test` (or CI env) on a dedicated port (e.g. 3001).
- **Migrations:** Applied once before tests (globalSetup or CI step).
- **Seed:** E2E seed (truncate + e2e.seed) run before tests (globalSetup or CI step). Same seed used for full suite; tests use distinct seeded users or unique emails for signup to avoid collisions.
- **Workers:** 1 worker for the auth E2E project to avoid shared in-memory email store and DB state issues.
- **Retries:** 0 in CI; optional 1 locally to reduce flakiness from transient issues.

## Test Data Requirements

### Seeded Data (from E2E seed)

- **Community:** At least one community with join code `E2E-JOIN-CODE`.
- **Legal documents:** TOS, Privacy Policy, Community Guidelines (as required by signup).
- **Users (known password, e.g. `E2E_PASSWORD`):**
  - `active@e2e.test` — status `active` (login, logout, protected route access).
  - `email_verified@e2e.test` — status `email_verified` (re-login → join-code, navigate → join-code).
  - `incomplete@e2e.test` — status `incomplete_profile` (re-login → onboarding, navigate → onboarding).
  - `unverified@e2e.test` — status `pending_verification`, `emailVerified: false` (login denied or verify-email redirect).
  - `reset@e2e.test` — status `active` (password reset flow).
  - `admin@e2e.test` — status `active`, `userType: 'admin'` (future admin E2E).

### Dynamic Data in Tests

- **Signup tests:** Use a unique email per run (e.g. `e2e-${Date.now()}@e2e.test`) to avoid duplicate-email errors when reusing the same DB.

### Email Capture Semantics

- **Last-wins:** The test API returns the most recently captured URL per type (`verification` | `reset`). If no email was sent yet, return `{ url: null }` or 404 as documented; tests should trigger the relevant flow before calling the test API.

## E2E Test Cases

Each test case maps to requirements and (where applicable) to the BDD scenarios in [1-requirements.md](./1-requirements.md).

### 1. Signup-to-dashboard funnel (email/password)

- **File:** e.g. `e2e/auth/signup-funnel.spec.ts`
- **Requirements:** 5, 6, 7, 8
- **BDD scenario:** Complete signup-to-dashboard funnel (email/password)

**Steps and assertions:**

1. Navigate to signup page.
2. Fill email (unique), password, first name, last name; accept all required legal documents; submit.
3. Assert redirect to verify-email page (or equivalent).
4. GET `/api/test/last-email?type=verification`, assert `url` is present; navigate to `url`.
5. Assert redirect to join-code page; assert user status is `email_verified` (if querying DB in test) or infer from next step.
6. Submit join code `E2E-JOIN-CODE`.
7. Assert redirect to onboarding page; assert status `incomplete_profile` if applicable.
8. Complete onboarding form (required fields) and submit.
9. Assert redirect to dashboard; assert status `active` if applicable.
10. Navigate to a protected route (e.g. `/dashboard`); assert 200 or expected content.

**Test data:** Unique email for signup. Rely on seeded community and legal documents.

---

### 2. Login success (active user)

- **Requirements:** 9.1
- **BDD scenario:** Login with valid credentials (active user)

**Steps and assertions:**

1. Navigate to login page.
2. Submit `active@e2e.test` and the seeded E2E password.
3. Assert redirect to dashboard (or `callbackUrl` if set).
4. Optionally request `/dashboard` and assert expected content or 200.

---

### 3. Login failure (invalid credentials)

- **Requirements:** 9.2
- **BDD scenario:** Login with invalid credentials

**Steps and assertions:**

1. Navigate to login page.
2. Submit wrong password or non-existent email.
3. Assert error message is displayed; assert no redirect to dashboard; assert user remains on login page (or equivalent).

---

### 4. Login with unverified user (pending_verification)

- **Requirements:** 9.3

**Steps and assertions:**

1. Navigate to login page.
2. Submit `unverified@e2e.test` and the seeded E2E password.
3. Assert access is denied or user is redirected to verify-email (per application behavior).

---

### 5. Status-based redirect: login as email_verified user

- **Requirements:** 9.4, 11.4
- **BDD scenario:** Re-login during onboarding funnel (status-based redirect)

**Steps and assertions:**

1. Navigate to login page.
2. Submit `email_verified@e2e.test` and the seeded E2E password.
3. Assert redirect to **join-code** page (not dashboard).
4. Optionally submit join code and assert redirect to onboarding.

---

### 6. Status-based redirect: login as incomplete_profile user

- **Requirements:** 9.5, 11.5
- **BDD scenario:** Re-login during onboarding funnel (status-based redirect)

**Steps and assertions:**

1. Navigate to login page.
2. Submit `incomplete@e2e.test` and the seeded E2E password.
3. Assert redirect to **onboarding** page (not dashboard).
4. Optionally complete onboarding and assert redirect to dashboard.

---

### 7. Status-based redirect: navigate to /dashboard as email_verified

- **Requirements:** 11.4

**Steps and assertions:**

1. Log in as `email_verified@e2e.test`.
2. Navigate to `/dashboard` or `/`.
3. Assert redirect to **join-code** page.

---

### 8. Status-based redirect: navigate to /dashboard as incomplete_profile

- **Requirements:** 11.5

**Steps and assertions:**

1. Log in as `incomplete@e2e.test`.
2. Navigate to `/dashboard` or `/`.
3. Assert redirect to **onboarding** page.

---

### 9. Unauthenticated access to protected route

- **Requirements:** 11.2
- **BDD scenario:** Unauthenticated access to protected route

**Steps and assertions:**

1. Ensure no session (clean context or after logout).
2. Navigate to `/dashboard`.
3. Assert redirect to `/login`; optionally assert `callbackUrl` is set.

---

### 10. Password reset flow

- **Requirements:** 10.1, 10.2
- **BDD scenario:** Password reset flow

**Steps and assertions:**

1. Navigate to forgot-password page.
2. Submit `reset@e2e.test`.
3. Assert success or confirmation message.
4. GET `/api/test/last-email?type=reset`, assert `url` is present; navigate to `url`.
5. Submit new password (and confirm) that meets app rules.
6. Assert success or redirect to login.
7. Log in with `reset@e2e.test` and the new password.
8. Assert session created and redirect to dashboard.

**Note:** Seed may need to reset this user’s password back to `E2E_PASSWORD` between runs, or use a dedicated user for reset tests.

---

### 11. Password reset: invalid or expired token

- **Requirements:** 10.3

**Steps and assertions:**

1. Navigate to the app’s reset-password page with an invalid or expired token in the URL (or use a known-bad token).
2. Submit a new password.
3. Assert error is displayed and password is not changed (verify by logging in with old password if applicable).

---

### 12. Email verification: invalid or expired token

- **Requirements:** 6.2

**Steps and assertions:**

1. Navigate to the app’s email verification URL with an invalid or expired token.
2. Assert error state is displayed and user is not verified (no redirect to join-code).

---

### 13. Logout and subsequent access

- **Requirements:** 12.1, 12.2
- **BDD scenario:** Logout and subsequent access

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Trigger logout (e.g. click logout or call sign-out).
3. Navigate to `/dashboard`.
4. Assert redirect to login.

---

### 14. Google OAuth sign-in (mocked)

- **Requirements:** 4.1–4.4
- **BDD scenario:** Google OAuth sign-in (mocked)

**Steps and assertions:**

1. Intercept navigation to Google’s authorize URL; redirect browser to app’s callback with `?code=e2e-test-google&state=...` (and valid state if required).
2. Assert user is created or linked in the test database and session is created.
3. Assert redirect to the correct step (dashboard, join-code, or onboarding) per user status.

**Note:** Depends on app implementing the test-only OAuth branch (task 7.1).

---

### 15. Duplicate email on signup (optional)

- **Requirements:** 5.3

**Steps and assertions:**

1. Navigate to signup page.
2. Submit email that already exists (e.g. `active@e2e.test`) with valid password and legal acceptance.
3. Assert validation or conflict error and no new user created.

---

### 16. Invalid join code (optional)

- **Requirements:** 7.2

**Steps and assertions:**

1. Log in as `email_verified@e2e.test` (or complete verification in same test).
2. On join-code page, submit an invalid code (e.g. `INVALID-CODE`).
3. Assert error is displayed and user status remains `email_verified`.

---

## Test Execution

### Local

1. Start Docker Postgres (or ensure it is running).
2. Copy `.env.test.example` to `.env.test` and set `DATABASE_URL` and other required vars.
3. Run globalSetup (migrate, truncate, seed) or run a single script that does this.
4. Start the Next.js app with `E2E_TEST=1` and `.env.test` on the configured port (e.g. 3001).
5. Run: `bun run test:e2e` (or `npx playwright test e2e/auth`).
6. Optionally: `bun run test:e2e:ui` for UI mode.

### CI

1. Checkout; install dependencies.
2. Start PostgreSQL service container; set `DATABASE_URL`.
3. Set E2E env vars (from `.env.test.example` or workflow env); include `BETTER_AUTH_SECRET` from secrets.
4. Run migrations; run E2E seed (truncate + seed).
5. Build app; start app on chosen port; wait for readiness.
6. Install Playwright browsers (e.g. Chromium); run `npx playwright test e2e/auth`.
7. On failure, upload `playwright-report/` and `test-results/` (traces, screenshots, video).

### Order and isolation

- Tests may run in a single worker; order is not guaranteed unless configured.
- Each test that creates a new user (e.g. signup funnel) uses a unique email to avoid conflicts.
- Email capture is last-wins per type; tests that depend on a specific captured URL should trigger that email in the same test before calling the test API.
- Database is reset and seeded once per run (globalSetup or CI); tests do not reset between tests unless a different strategy is adopted later.

## Coverage Goals

- **Requirements:** Every requirement 1–14 is covered by at least one test or by infrastructure (seed, globalSetup, CI job).
- **BDD scenarios:** All BDD scenarios in 1-requirements.md have a corresponding E2E test (or test steps).
- **Success criteria:** All 10 success criteria in 1-requirements.md are demonstrably met when the above tests pass and CI is configured as in the design.

## Edge Cases and Special Considerations

- **Multiple emails in one test:** If a test triggers both verification and reset, or multiple verifications, use `type=verification` or `type=reset` when calling the test API; last-wins per type applies.
- **No URL captured yet:** Tests that call `/api/test/last-email` before triggering the email should first trigger the flow (e.g. signup or forgot-password), then call the API.
- **Parallel workers:** Auth E2E uses 1 worker; no cross-test isolation for in-memory email store is required.
- **Join code casing:** Use the exact join code from seed (`E2E-JOIN-CODE`) unless the app documents case-insensitive behavior; then match app behavior.
- **Session and cookies:** Tests use the same origin as the app (baseURL); logout and redirect assertions assume cookie scope is the same.

## Security and Isolation

- **Test-only route:** When `E2E_TEST !== '1'`, `/api/test/last-email` returns 404. Verified by deployment config (E2E_TEST not set in production) or by an optional infra test.
- **Test database:** Only the test database (Docker or CI service) is used; production and staging URLs are never used in E2E.
- **Seeded passwords:** E2E password is used only in test config and in E2E seed; never logged or exposed in production.

## References

- Requirements: [specs/auth/e2e-testing/1-requirements.md](./1-requirements.md)
- Design: [specs/auth/e2e-testing/2-design.md](./2-design.md)
- Tasks: [specs/auth/e2e-testing/3-tasks.md](./3-tasks.md)
- General auth test plan (unit/integration): [specs/auth/4-test-plan.md](../4-test-plan.md)
