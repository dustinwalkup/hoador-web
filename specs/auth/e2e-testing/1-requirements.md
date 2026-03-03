# Auth E2E Testing - Requirements Document

## Introduction

The Auth E2E Testing feature establishes an automated end-to-end test suite for the HOADOR authentication and onboarding flows using Playwright against a real browser and a dedicated test database. The system under test is the HOADOR application stack: Next.js, Better Auth, Drizzle ORM, PostgreSQL, and Resend for email.

The goal is to verify the complete user journey from signup through email verification, community join code, profile onboarding, login, password reset, session handling, and logout—without sending real emails or calling real OAuth providers. Tests run in isolation against a Docker Postgres instance, with email and OAuth behavior mocked so that verification and reset URLs are capturable by tests and Google login can be simulated.

This document defines requirements for the test infrastructure (database, server, mocks), the observable behavior that E2E tests must assert, and CI/CD integration. It does not define requirements for the application’s auth behavior itself; it defines what the E2E testing system shall do so that application auth behavior can be validated reliably and repeatedly.

## Requirements

### Requirement 1: Test Database Infrastructure

**User Story:** As a developer or CI pipeline, I need the E2E suite to run against a dedicated test database so that tests are isolated from development and production data and produce deterministic results.

#### Acceptance Criteria

1. WHEN the E2E test suite is executed THEN the system SHALL connect to a local PostgreSQL instance running in a Docker container (not Neon serverless).
2. WHEN connecting to the test database THEN the system SHALL use the `node-postgres` (`pg.Pool`) driver, via a dedicated module (e.g. `src/db/db-e2e.ts`), following the connection pattern used in `src/db/db-seed.ts`.
3. WHEN the application runs in a context where E2E tests are executed THEN the system SHALL use the test database connection for all server-side database operations invoked during those tests; the Neon HTTP driver SHALL NOT be used for the test database.
4. WHEN the test suite initializes THEN the system SHALL reset the test database to a known clean state by truncating all tables (with CASCADE) in a defined order, consistent with the reset approach in `src/db/seeds/seed.ts`.
5. WHEN migrations are required for the test database THEN the system SHALL apply all Drizzle migrations from `src/db/migrations/` to the Docker Postgres instance before test execution (e.g. via `drizzle-kit migrate` or equivalent programmatic migration).
6. WHEN the test suite completes THEN the system SHALL leave the test database in a disposable state; the Docker container MAY remain running for debugging but SHALL be stoppable/removable via an explicit cleanup command or CI teardown.
7. WHEN environment variables are loaded for E2E execution THEN the system SHALL use a test-specific env source (e.g. `.env.test`) that provides `DATABASE_URL` pointing to the Docker Postgres instance; production and staging database URLs SHALL NOT be used.

### Requirement 2: Test Application Server

**User Story:** As an E2E test, I need the application to be served on a known base URL configured to use the test database so that Playwright can drive real browser flows against the running app.

#### Acceptance Criteria

1. WHEN the E2E test suite runs THEN the system SHALL start the Next.js application (dev server or production build) on a dedicated port.
2. WHEN the application serves requests during E2E runs THEN the system SHALL use the test database connection (as defined in Requirement 1) for all database access.
3. WHEN the application is started for E2E THEN the system SHALL set or load environment variables (e.g. from `.env.test`) such that `NODE_ENV` and `DATABASE_URL` (and any other required vars) are appropriate for test mode.
4. WHEN Playwright tests execute THEN the system SHALL have a stable base URL (e.g. `baseURL` in Playwright config) pointing to the running application so that tests do not hardcode host/port.

### Requirement 3: Email Transport Mocking

**User Story:** As an E2E test, I need verification and password-reset emails to be captured in memory and their URLs to be retrievable so that I can drive verification and reset flows without sending real email.

#### Acceptance Criteria

1. WHEN the system runs in test mode (E2E context) THEN the system SHALL intercept all outbound email sending used for verification and password reset (i.e. the code paths invoked by Better Auth’s `sendVerificationEmail` and `sendResetPassword` hooks) and SHALL NOT call the Resend API.
2. WHEN a verification email is triggered in test mode THEN the system SHALL capture the verification callback URL (the link the user would click) in an in-memory store.
3. WHEN a password-reset email is triggered in test mode THEN the system SHALL capture the reset callback URL in the same (or equivalent) in-memory store.
4. WHEN a Playwright test needs the verification or reset URL THEN the system SHALL provide a test-only mechanism to retrieve the captured URL (e.g. a test-only API route such as `GET /api/test/last-email` or equivalent) so that the test can navigate to that URL.
5. The system SHALL ensure the test-only URL retrieval mechanism is not exposed or enabled in production builds.
6. WHERE multiple emails could be sent in a single test THEN the system SHALL define unambiguous behavior (e.g. last-wins, or queue) so that tests can reliably obtain the correct URL.

### Requirement 4: OAuth Provider Mocking (Google)

**User Story:** As an E2E test, I need Google sign-in to be simulated without calling Google’s servers so that OAuth-based signup and login can be tested in CI and offline.

#### Acceptance Criteria

1. WHEN a Playwright E2E test exercises the Google login flow THEN the system SHALL use Playwright’s network interception (e.g. `page.route()`) to intercept requests to Google OAuth endpoints (e.g. `accounts.google.com`, `oauth2.googleapis.com`) and SHALL simulate a successful OAuth callback with a configurable test user profile (email, name, picture as applicable).
2. WHEN the mock OAuth callback is executed THEN the system SHALL provide Better Auth with a valid-looking Google user payload so that account creation or account linking proceeds as in production, and the user record and session are created in the test database.
3. The system SHALL NOT perform real HTTP requests to Google during E2E test execution.
4. WHERE tests require different Google identities THEN the system SHALL support supplying different test user profiles (e.g. different email) so that multiple OAuth users can be tested.

### Requirement 5: Signup Flow (Email/Password)

**User Story:** As an E2E test, I need to assert that a new user can sign up with email and password, accept legal documents, and be created with the correct status so that the signup contract is regression-tested.

#### Acceptance Criteria

1. WHEN a new user submits valid signup credentials (email, password, first name, last name) and accepts all required legal documents (Terms of Service, Privacy Policy, Community Guidelines) THEN the system SHALL create a user record in the test database with status `pending_verification` and SHALL trigger the verification email flow (captured by the email mock per Requirement 3).
2. WHEN a user signs up THEN the system SHALL require acceptance of all required legal documents before completing account creation; IF any required acceptance is missing THEN the system SHALL return a validation error and SHALL NOT create the user.
3. WHEN a user signs up with an email that already exists in the test database THEN the system SHALL return a validation or conflict error and SHALL NOT create a duplicate user record.
4. WHEN signup completes successfully THEN the system SHALL redirect the user to the verify-email page (or equivalent) and the captured verification URL SHALL be retrievable by the test.
5. WHEN the E2E test drives the signup form THEN the test SHALL be able to fill all required fields (email, password, first name, last name, legal checkboxes) and submit the form and SHALL be able to assert on redirect and on the presence of the user in the database with status `pending_verification`.

### Requirement 6: Email Verification

**User Story:** As an E2E test, I need to assert that visiting the verification link marks the user verified and advances them to the next step so that the verification contract is regression-tested.

#### Acceptance Criteria

1. WHEN a user visits a valid verification URL (obtained from the email mock after signup) THEN the system SHALL mark the user as verified (`emailVerified: true`) and SHALL update the user status to `email_verified`.
2. WHEN a user visits an invalid or expired verification token URL THEN the system SHALL display an error state and SHALL NOT set `emailVerified` to true nor update status to `email_verified`.
3. WHEN email verification succeeds THEN the system SHALL redirect the user to the configured post-verification path (e.g. `/signup/email/callback` and then to `/join-code`) so that the test can assert on the final destination (e.g. join-code page).
4. WHEN the E2E test drives the verification flow THEN the test SHALL be able to obtain the verification URL from the test-only mechanism, navigate to it, and assert that the user is redirected to the join-code page and that the user record has status `email_verified`.

### Requirement 7: Community Join Code

**User Story:** As an E2E test, I need to assert that a verified user can submit a valid join code and advance to onboarding so that the join-code step is regression-tested.

#### Acceptance Criteria

1. WHEN a user with status `email_verified` submits a valid community join code (for a community seeded in the test database) THEN the system SHALL associate the user with that community and SHALL update the user status to `incomplete_profile`.
2. WHEN a user submits an invalid or unknown join code THEN the system SHALL display an error and SHALL NOT update the user status to `incomplete_profile`.
3. WHEN the join code is accepted THEN the system SHALL redirect the user to the onboarding page (e.g. `/onboarding`) so that the test can assert on the redirect.
4. WHEN the E2E test drives the join-code flow THEN the test SHALL be able to use a known seeded join code, submit it, and assert that the user lands on onboarding and has status `incomplete_profile`.

### Requirement 8: Profile Onboarding

**User Story:** As an E2E test, I need to assert that a user with status `incomplete_profile` can complete onboarding and become active so that the full funnel to dashboard is testable.

#### Acceptance Criteria

1. WHEN a user with status `incomplete_profile` accesses the onboarding page THEN the system SHALL display the profile completion form (e.g. address, bio, or other required fields as defined by the application).
2. WHEN the user submits the onboarding form with valid required data THEN the system SHALL update the user status to `active` and SHALL redirect to the dashboard (e.g. `/dashboard`).
3. WHEN a user with status `incomplete_profile` attempts to access a protected route such as `/dashboard` (without completing onboarding) THEN the application middleware SHALL redirect them to the onboarding page so that the test can assert on this redirect.
4. WHEN the E2E test drives the onboarding flow THEN the test SHALL be able to fill the required fields, submit the form, and assert that the user is redirected to the dashboard and has status `active`.

### Requirement 9: Login Flow

**User Story:** As an E2E test, I need to assert that an active user can log in and that invalid or unverified users are handled correctly so that login behavior is regression-tested.

#### Acceptance Criteria

1. WHEN a user with status `active` submits valid email and password credentials THEN the system SHALL create an authenticated session and SHALL redirect the user to the dashboard (or to the `callbackUrl` when provided).
2. WHEN a user submits invalid credentials (wrong password or unknown email) THEN the system SHALL deny access and SHALL display an error message; the system SHALL NOT create a session.
3. WHEN a user with status `pending_verification` (email not yet verified) attempts to log in THEN the system SHALL deny access or redirect to the verification flow as defined by the application; the test SHALL be able to assert the expected behavior.
4. WHEN a user with status `email_verified` logs in with valid credentials THEN the system SHALL create a session and SHALL redirect the user to the join-code page (not the dashboard), so that interrupted users resume at the correct step.
5. WHEN a user with status `incomplete_profile` logs in with valid credentials THEN the system SHALL create a session and SHALL redirect the user to the onboarding page (not the dashboard), so that interrupted users resume at the correct step.
6. WHEN the E2E test drives login for users at each status (active, email_verified, incomplete_profile, pending_verification) THEN the test SHALL be able to assert that the post-login redirect destination matches the user’s current step in the funnel (dashboard, join-code, onboarding, or verify-email respectively).
7. WHEN the E2E test drives the login form THEN the test SHALL be able to assert successful login and redirect to dashboard for valid active users, and assert error or redirect for invalid or unverified users.

### Requirement 10: Password Reset Flow

**User Story:** As an E2E test, I need to assert that a user can request a password reset, receive a reset link (via the email mock), and complete the reset so that the forgot-password and reset-password flows are regression-tested.

#### Acceptance Criteria

1. WHEN a user requests a password reset with a valid email (for an existing user in the test database) THEN the system SHALL trigger the password-reset email flow (captured by the email mock per Requirement 3) and SHALL display a success or confirmation message to the user.
2. WHEN a user visits the captured password-reset URL and submits a new password that meets the application’s rules THEN the system SHALL update the password and SHALL allow the user to log in with the new credentials.
3. WHEN a user visits an invalid or expired reset token URL THEN the system SHALL display an error and SHALL NOT change the user’s password.
4. WHEN the E2E test drives the password-reset flow THEN the test SHALL be able to request reset, retrieve the reset URL from the test-only mechanism, navigate to it, submit a new password, and assert that login with the new password succeeds.

### Requirement 11: Session and Protected Routes

**User Story:** As an E2E test, I need to assert that protected routes are accessible when the user is authenticated and active, and that unauthenticated or expired sessions are redirected to login so that authorization and middleware behavior are regression-tested.

#### Acceptance Criteria

1. WHEN an authenticated user with status `active` accesses a protected route (e.g. `/dashboard` or a route under `/dashboard`) THEN the system SHALL grant access and SHALL render the protected content (or a representative page) so that the test can assert on the response (e.g. status 200, or presence of expected content).
2. WHEN an unauthenticated user accesses a protected route THEN the application middleware SHALL redirect to the login page (e.g. `/login`), optionally with a `callbackUrl` parameter preserving the intended destination; the test SHALL be able to assert on redirect and target URL.
3. WHEN a user’s session is invalid or expired (e.g. session record removed or expired in the database) and the user accesses a protected route THEN the system SHALL require reauthentication (e.g. redirect to login); the test SHALL be able to simulate expired session and assert on redirect.
4. WHEN an authenticated user with status `email_verified` accesses the application (e.g. by navigating to `/`, `/dashboard`, or any protected route) THEN the application middleware SHALL redirect them to the join-code page so that the test can assert on this status-based redirect (interrupted funnel behavior).
5. WHEN an authenticated user with status `incomplete_profile` accesses the application (e.g. by navigating to `/`, `/dashboard`, or any protected route other than `/onboarding`) THEN the application middleware SHALL redirect them to the onboarding page so that the test can assert on this status-based redirect (interrupted funnel behavior).
6. WHEN the E2E test simulates an interrupted onboarding flow (user at `email_verified` or `incomplete_profile` logs out or starts a fresh session, then logs back in or navigates to a protected URL) THEN the test SHALL be able to assert that the user is redirected to the correct step (join-code or onboarding) and NOT to the dashboard until the user has status `active`.
7. WHEN the E2E test drives navigation to protected routes THEN the test SHALL be able to assert access granted for authenticated active users and redirect to login for unauthenticated or invalid sessions.

### Requirement 12: Logout

**User Story:** As an E2E test, I need to assert that logout invalidates the session and that subsequent access to protected routes is denied so that logout behavior is regression-tested.

#### Acceptance Criteria

1. WHEN an authenticated user triggers logout THEN the system SHALL invalidate the session (e.g. remove or invalidate the session record and clear the session cookie) so that subsequent requests are unauthenticated.
2. WHEN a logged-out user attempts to access a protected route THEN the system SHALL redirect to the login page (per Requirement 11).
3. WHEN the E2E test drives logout THEN the test SHALL be able to assert that after logout, accessing a protected route results in redirect to login.

### Requirement 13: Test Data Seeding

**User Story:** As an E2E test, I need the test database to be seeded with known communities, legal documents, and baseline users so that tests can rely on deterministic data without touching production or staging.

#### Acceptance Criteria

1. WHEN the E2E test suite starts (or a before-all hook runs) THEN the system SHALL seed the test database with at least: (a) one or more communities with known join codes, (b) the legal documents required at signup (e.g. TOS, Privacy Policy, Community Guidelines) as required by the application, (c) baseline users at defined statuses (e.g. one active standard user, one active admin user, one unverified user, one `email_verified` user, one `incomplete_profile` user) with known credentials where login is required.
2. WHEN tests run THEN the system SHALL ensure all test data is confined to the test database (Docker Postgres); the seeding and test execution SHALL NOT read from or write to production or staging databases.
3. WHEN the database is reset (per Requirement 1) THEN the system SHALL re-run the seed step so that each test run starts from a defined baseline.
4. WHERE tests create new users or data THEN the system SHALL use the reset/seed strategy so that test order and parallelization do not cause cross-test pollution; the requirements for parallelization (e.g. isolated data per worker) are left to the test plan and design.

### Requirement 14: CI/CD Integration

**User Story:** As a developer, I need the E2E auth test suite to run on every pull request targeting the protected branch and to block merge on failure so that regressions are caught before merge.

#### Acceptance Criteria

1. WHEN a pull request is opened or updated against the protected branch (e.g. `develop`) THEN the existing PR checks workflow (e.g. `.github/workflows/pr-checks.yml`) SHALL execute the full Playwright E2E authentication test suite.
2. WHEN the E2E test suite runs in CI THEN the system SHALL use a PostgreSQL service container (or equivalent) so that the test database is available; the workflow SHALL start the application and run Playwright against it with the test database and mocks enabled.
3. WHEN any E2E authentication test fails in CI THEN the workflow SHALL fail the job and SHALL block merge (as per the branch protection rules).
4. WHEN E2E tests fail in CI THEN the system SHALL retain and publish Playwright artifacts (e.g. traces, screenshots, video) so that failures can be diagnosed without re-running locally.
5. The system SHALL document or configure the required CI secrets and environment variables (e.g. for `BETTER_AUTH_SECRET`, test `DATABASE_URL` derivation, or other non-production secrets) so that the E2E job can run in the CI environment.

## Non-Functional Requirements

### Reliability and Determinism

1. E2E tests SHALL be deterministic: repeated runs with the same reset and seed SHALL produce the same pass/fail results for the same application code.
2. WHEN the test database is reset and seeded THEN the system SHALL apply migrations and seed in a consistent order so that schema and data are predictable.
3. WHERE tests depend on email or OAuth mocks THEN the system SHALL clear or reset captured state (e.g. last verification URL) between tests or define clear semantics (e.g. last-wins) so that tests do not observe state from other tests.
4. WHEN the application or database is unavailable or misconfigured THEN the E2E suite SHALL fail fast with a clear error rather than producing flaky or misleading results.

### Performance

1. The E2E test suite SHALL complete within a reasonable duration (e.g. under 10 minutes for the auth subset) so that PR feedback remains timely; specific targets may be set in the test plan.
2. WHEN starting the application for E2E THEN the system SHALL wait until the server is ready (e.g. health check or URL responds) before running tests so that transient startup failures do not cause flakiness.
3. WHEN using a single shared application instance for multiple tests THEN the system SHALL account for test isolation (e.g. unique users per test or reset between tests) so that parallel or sequential execution does not cause cross-test interference.

### Security and Isolation

1. Test-only endpoints (e.g. URL retrieval for captured emails) SHALL be disabled or unreachable in production builds and SHALL NOT be deployed to production.
2. The test database SHALL use credentials and URLs that are separate from production and staging; CI secrets for E2E SHALL NOT be production credentials.
3. WHERE the test suite seeds users with known passwords THEN those passwords SHALL be used only in test configuration and SHALL NOT appear in production configuration or logs.

### Maintainability

1. The E2E test code and infrastructure SHALL be organized so that adding new auth flows or assertions is straightforward and follows the same patterns (e.g. Page Object Model or shared helpers).
2. Requirements in this document SHALL be traceable to test cases in the test plan (e.g. via requirement IDs or tags) so that coverage and gaps are visible.

## BDD Scenarios

### Scenario: Complete signup-to-dashboard funnel (email/password)

- **Given** the test database is reset and seeded with a community with join code `E2E-JOIN-CODE` and legal documents are available
- **When** the user opens the signup page and submits valid email, password, first name, last name and accepts all legal documents
- **Then** the system SHALL create a user with status `pending_verification`
- **And** the system SHALL redirect to the verify-email page
- **And** the verification URL SHALL be available from the test email capture
- **When** the user navigates to the captured verification URL
- **Then** the user SHALL be marked verified and redirected to the join-code page
- **When** the user submits the join code `E2E-JOIN-CODE`
- **Then** the user status SHALL be `incomplete_profile` and the user SHALL be redirected to onboarding
- **When** the user completes the onboarding form with required data and submits
- **Then** the user status SHALL be `active` and the user SHALL be redirected to the dashboard
- **And** the user SHALL be able to access protected dashboard routes

### Scenario: Login with valid credentials (active user)

- **Given** the test database is seeded with an active user with email `active@e2e.test` and a known password
- **When** the user opens the login page and submits `active@e2e.test` and the known password
- **Then** the system SHALL create a session and redirect to the dashboard
- **And** a request to `/dashboard` SHALL return the dashboard content (or expected page)

### Scenario: Login with invalid credentials

- **Given** the test database is seeded (with or without the attempted email)
- **When** the user opens the login page and submits an invalid email or wrong password
- **Then** the system SHALL NOT create a session
- **And** the system SHALL display an error message
- **And** the user SHALL remain on the login page (or equivalent)

### Scenario: Unauthenticated access to protected route

- **Given** no user is logged in (clean browser context or after logout)
- **When** the user navigates to a protected route (e.g. `/dashboard`)
- **Then** the system SHALL redirect to the login page
- **And** the redirect URL SHALL preserve the intended destination (e.g. via `callbackUrl`) where applicable

### Scenario: Password reset flow

- **Given** the test database is seeded with a user with email `reset@e2e.test`
- **When** the user requests a password reset for `reset@e2e.test`
- **Then** the system SHALL show a success or confirmation message
- **And** the reset URL SHALL be available from the test email capture
- **When** the user navigates to the captured reset URL and submits a new valid password
- **Then** the system SHALL update the password
- **When** the user logs in with `reset@e2e.test` and the new password
- **Then** the system SHALL create a session and redirect to the dashboard

### Scenario: Google OAuth sign-in (mocked)

- **Given** the E2E environment has Google OAuth mocked and the test database is reset and seeded
- **When** the user clicks the Google sign-in button and the mock returns a successful callback with a test Google user (e.g. `google@e2e.test`)
- **Then** the system SHALL create or link the user in the test database
- **And** the system SHALL create a session and redirect according to the application’s post-OAuth flow (e.g. to dashboard, join-code, or onboarding as per user status)

### Scenario: Logout and subsequent access

- **Given** the user is logged in as an active user
- **When** the user triggers logout
- **Then** the session SHALL be invalidated
- **When** the user navigates to `/dashboard`
- **Then** the system SHALL redirect to the login page

### Scenario: Re-login during onboarding funnel (status-based redirect)

- **Given** the test database is seeded with a user with status `email_verified` and a known password
- **When** the user logs in with valid credentials
- **Then** the system SHALL redirect to the join-code page (not the dashboard)
- **And** the user SHALL be able to complete the join-code step and proceed to onboarding
- **Given** the test database is seeded with a user with status `incomplete_profile` and a known password
- **When** the user logs in with valid credentials
- **Then** the system SHALL redirect to the onboarding page (not the dashboard)
- **And** the user SHALL be able to complete onboarding and reach the dashboard
- **When** an authenticated user with status `email_verified` navigates to `/dashboard` or `/`
- **Then** the system SHALL redirect to the join-code page
- **When** an authenticated user with status `incomplete_profile` navigates to `/dashboard` or `/`
- **Then** the system SHALL redirect to the onboarding page

## Assumptions

1. The application’s auth and onboarding behavior (Better Auth, middleware in `src/proxy.ts`, user status enum, legal document IDs, community join flow) remains as implemented at the time of this spec; changes to that behavior may require updates to these requirements and to the tests.
2. Docker (or an equivalent container runtime) is available in local and CI environments for running PostgreSQL.
3. The protected branch for which E2E runs and blocks merge is configured in the repository (e.g. `develop`); the exact branch name is a configuration detail.
4. Playwright and `@playwright/test` are added as dev dependencies and browsers are installed (e.g. via `npx playwright install`) where tests run.
5. The Next.js application can be configured to use a different database connection (e.g. via `DATABASE_URL` from `.env.test`) when started for E2E, or a dedicated E2E entry/config is used so that the app uses the test DB during E2E runs.
6. Better Auth’s email and password-reset hooks can be conditional on environment (e.g. test mode) so that in test mode they write to the in-memory store and do not call Resend.
7. Legal document IDs and required document list are defined elsewhere; the seed only needs to provide the documents the application expects at signup.

## Constraints

1. The production application uses the Neon serverless HTTP driver for PostgreSQL; the E2E test database SHALL use a TCP-compatible driver (`node-postgres`) and thus a separate connection module or configuration for E2E.
2. Resend’s client is initialized at module load with `RESEND_API_KEY`; test mode SHALL either provide a dummy key and intercept at the transport/hook layer or use a test-only code path that does not load the real Resend client for sending.
3. Google OAuth SHALL be mocked at the network level (e.g. Playwright route interception); the application code SHALL NOT be modified to “detect” test mode for OAuth, unless such a switch is explicitly designed and secured for test-only use.
4. E2E tests SHALL NOT run against production or staging databases or send real email or call real OAuth providers.
5. The test-only API or mechanism for retrieving captured URLs SHALL be excluded from production builds (e.g. conditional export, or not registered in production).

## Edge Cases

1. **Multiple verification emails in one test**: If signup and resend-verification are both used, the capture semantics (e.g. last verification URL wins) SHALL be defined and documented so that tests that need the first or last URL can assert correctly.
2. **Reset and verification token expiry**: Tests that assert on invalid/expired tokens SHALL use tokens that are actually expired or invalid (e.g. by time travel or by using a token that was already consumed or never existed).
3. **Parallel test workers**: If Playwright runs with multiple workers, shared application state (e.g. single in-memory email store) may require per-worker isolation or a single-worker E2E auth suite; the design SHALL specify the chosen approach.
4. **Database reset mid-run**: If a test or hook resets the database while another test is running, results may be flaky; the design SHALL define when reset runs (e.g. before all, before each, or per-worker) to avoid this.
5. **Application crash or hang**: E2E infrastructure SHALL define timeouts and health checks so that a hung or crashed server does not cause the suite to hang indefinitely.
6. **Join code case sensitivity**: If the application treats join codes as case-insensitive, tests SHALL use the same rule when seeding and submitting; otherwise tests SHALL use exact casing as required by the app.
7. **Session cookie scope**: Tests that assert on logout or session expiry SHALL use the same origin and cookie scope as the application so that cookie clearing and redirect behavior are observable.

## Out of Scope

1. **Unit or integration tests**: This document does not define requirements for Vitest-based unit or integration tests; those remain covered by the existing auth test plan and codebase.
2. **Admin-only flows**: E2E requirements for admin login (`/admin/dashboard`) and admin-only routes are out of scope for this document; they may be added in a later requirement set.
3. **Performance or load testing**: No requirements for load, stress, or performance benchmarks of the auth flows; only functional E2E behavior is in scope.
4. **Third-party provider testing**: No requirements for testing real Resend or real Google OAuth; only mocked behavior is in scope.
5. **Accessibility testing**: Accessibility of auth pages is not specified here; it may be covered by other specs or tools (e.g. axe in Playwright) separately.
6. **Mobile or viewport-specific E2E**: Layout and viewport-specific assertions (e.g. mobile breakpoints) are not required by this document unless they affect the defined auth flows (e.g. redirects or form submission).

## Success Criteria

1. A developer can run the Playwright E2E auth suite locally against Docker Postgres and get deterministic pass/fail results.
2. The full email/password signup-to-dashboard funnel (signup → verify → join code → onboarding → dashboard) is covered by at least one E2E test that passes when the application behaves as specified.
3. Login (success and failure), logout, and protected-route redirect are covered by E2E tests that pass when the application behaves as specified.
4. Status-based redirects during the onboarding flow are covered: when a user logs in or navigates at status `email_verified` or `incomplete_profile`, the test suite SHALL assert redirect to join-code or onboarding (not dashboard) until the user reaches status `active`.
5. Password reset (request → capture URL → reset → login with new password) is covered by at least one E2E test that passes when the application behaves as specified.
6. Google OAuth login is covered by at least one E2E test using a mocked OAuth callback, and the test passes when the application creates/links the user and session correctly.
7. No real email is sent and no real Google OAuth calls are made during the E2E suite.
8. The E2E auth suite runs in CI on pull requests to the protected branch and fails the job (and blocks merge when branch protection is enabled) when any of the defined auth E2E tests fail.
9. When E2E tests fail in CI, Playwright artifacts (traces, screenshots, or video) are available for debugging.
10. Test data and test-only endpoints are isolated from production and are not deployed or exposed in production.
