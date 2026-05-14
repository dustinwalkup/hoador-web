# Test Plan: Authentication

## Requirements Traceability

This test plan covers authentication functionality including user signup, login, password management, email verification, admin authentication, legal document acceptance, and post-verification community selection. Tests verify security, validation, and user experience requirements.

> **Cross-spec note:** The post-verification step changed with the
> [Multi-Community Marketplace](../multi-community-marketplace/1-requirements.md)
> spec. `email_verified` users now land on **`/community-select`** (a list of
> the metro network's communities), not `/join-code`. The legacy `/join-code`
> route + `joinCommunity` service path are **preserved** for private invites
> (R1.5) and now create a pre-verified primary membership. The membership
> data model, visibility, and admin verification queue are owned by
> [multi-community-marketplace/4-test-plan.md](../multi-community-marketplace/4-test-plan.md)
> and [specs/community/4-test-plan.md](../community/4-test-plan.md); the
> auth-local view of that flow is below.

### Core Authentication Requirements

**Test Coverage**:

- Unit tests: Auth schemas, password validation, session utilities, guards
- Integration tests: Signup flow, login flow, password reset flow, email verification flow
- E2E tests: Complete authentication workflows from UI to database
- BDD scenarios: User authentication acceptance criteria

## Test Types

### Unit Tests

#### Server Actions

- [ ] `signupAction` - User registration with email and password
  - Happy path: Valid data creates user, accepts legal documents, sends verification email
  - Error: Invalid email format returns validation error
  - Error: Weak password returns validation error
  - Error: Missing required fields returns error
  - Error: Duplicate email returns conflict error
  - Edge case: Legal documents acceptance (both formats supported)
  - Edge case: Email normalization (lowercase, trim)

- [ ] `adminLoginAction` - Admin authentication
  - Happy path: Valid admin credentials authenticate successfully
  - Error: Invalid credentials return error
  - Error: Non-admin user cannot access admin login
  - Error: Missing credentials return validation error

- [ ] `forgotPasswordAction` - Password reset request
  - Happy path: Valid email sends reset token
  - Error: Invalid email format returns error
  - Error: Non-existent email returns generic success (security)
  - Edge case: Rate limiting for password reset requests

- [ ] `resetPasswordAction` - Password reset completion
  - Happy path: Valid token and password reset successfully
  - Error: Invalid token returns error
  - Error: Expired token returns error
  - Error: Weak password returns validation error
  - Error: Password mismatch returns error

- [ ] `verifyEmailAction` - Email verification
  - Happy path: Valid token verifies email
  - Error: Invalid token returns error
  - Error: Expired token returns error
  - Error: Already verified email handles gracefully

- [ ] `emailAction` - Email sending utilities
  - Happy path: Verification email sent successfully
  - Happy path: Password reset email sent successfully
  - Error: Invalid email address returns error
  - Error: Email service failure handled gracefully

- [ ] `joinCommunityAction` / `AuthService.joinCommunity` — **legacy** private-invite join (retained per R1.5)
  - Happy path: Valid join code accepts user
  - Behavior change: the created membership is now `is_primary=true` and `verification_status='verified'` (code-based joins are pre-trusted)
  - Error: Invalid join code returns error
  - Error: Expired join code returns error
  - Edge case: Case-insensitive join code matching

- [ ] `AuthService.selectPrimaryCommunity` — canonical post-verification community pick
  - Happy path: creates a primary `community_memberships` row (`verification_status='pending'`), resolves the community's `networkId` and initializes the user's `community_visibility` rows, sets user status to `incomplete_profile`, returns `{ redirect: "/onboarding" }`
  - Error: user already has a primary membership → `ConflictError` (→ 409)
  - Error: community is inactive → `ValidationError` (→ 400)
  - Standalone community (`network_id` null) → visibility init is skipped
  - Ordering: status update happens only after the membership is created

- [ ] `acceptLegalDocumentsAction` - Legal document acceptance
  - Happy path: User accepts all required legal documents
  - Error: Missing required documents returns error
  - Error: Invalid document IDs returns error
  - Edge case: Already accepted documents handled gracefully

#### Components

- [ ] `SignupForm` - User registration form
  - Rendering: All form fields visible (email, password, firstName, lastName, legal checkboxes)
  - User interaction: Form submission triggers signupAction
  - Validation: Shows error messages for invalid inputs
  - Loading state: Shows loading indicator during submission
  - Success state: Redirects to verification page
  - Accessibility: Proper labels, ARIA attributes, keyboard navigation

- [ ] `LoginForm` - User login form
  - Rendering: Email and password fields visible
  - User interaction: Form submission triggers login
  - Validation: Shows error messages for invalid credentials
  - Loading state: Shows loading indicator during authentication
  - Error state: Displays authentication errors
  - Accessibility: Proper form structure and error announcements

- [ ] `ForgotPasswordForm` - Password reset request form
  - Rendering: Email input field visible
  - User interaction: Form submission triggers forgotPasswordAction
  - Validation: Shows error for invalid email
  - Success state: Shows success message
  - Loading state: Shows loading indicator

- [ ] `ResetPasswordForm` - Password reset completion form
  - Rendering: Password and confirm password fields visible
  - User interaction: Form submission triggers resetPasswordAction
  - Validation: Shows error for password mismatch
  - Validation: Shows error for weak password
  - Loading state: Shows loading indicator
  - Success state: Redirects to login

- [ ] `VerifyEmailForm` - Email verification form
  - Rendering: Token input field visible
  - User interaction: Form submission triggers verifyEmailAction
  - Validation: Shows error for invalid token
  - Loading state: Shows loading indicator
  - Success state: Shows success message and redirects

- [ ] `AdminLoginForm` - Admin authentication form
  - Rendering: Admin-specific login fields
  - User interaction: Form submission triggers adminLoginAction
  - Validation: Shows error for invalid admin credentials
  - Loading state: Shows loading indicator
  - Security: Prevents non-admin access

- [ ] `CommunitySelectForm` - Community selection (canonical post-verification step)
  - Rendering: shadcn `Select` populated from `GET /api/communities?networkSlug=kansas-city-metro`
  - User interaction: selecting a community + Continue calls `useSelectCommunity()`; on success router-pushes to `/onboarding`
  - "Don't see yours?" opens the existing `RequestHoadorModal`
  - "Have a private invite code?" links to `/join-code`
  - Validation: cannot submit without selecting a community
  - Loading state: Continue shows loading during the mutation
  - Error state: surfaces conflict (already-has-primary) / inactive-community errors

- [ ] `JoinCodeForm` - Community join code form (**legacy**, retained per R1.5)
  - Rendering: Join code input field visible
  - User interaction: Form submission triggers the legacy join-community path
  - Validation: Shows error for invalid join code
  - Loading state: Shows loading indicator
  - Success state: Proceeds to onboarding (membership created pre-verified)

- [ ] `LegalDocumentsAcceptanceScreen` - Legal document acceptance UI
  - Rendering: All required legal documents displayed
  - User interaction: Checkbox selection updates state
  - Validation: Prevents submission without acceptance
  - Loading state: Shows loading during submission
  - Success state: Proceeds after acceptance

- [ ] `AuthLayoutWrapper` - Authentication layout component
  - Rendering: Wraps auth pages with consistent layout
  - Navigation: Handles redirects for authenticated users
  - Loading state: Shows loading during session check

- [ ] `SuccessMessage` - Success message display
  - Rendering: Displays success message
  - User interaction: Dismissible or auto-dismiss
  - Accessibility: Proper ARIA live region

#### Utilities

- [ ] `session.ts` - Session management utilities
  - `getCurrentUser`: Returns current user or null
  - `requireAuth`: Throws error if not authenticated
  - `getCurrentUserId`: Returns user ID or null
  - `requireVerifiedUser`: Requires verified email
  - `getSession`: Retrieves session from headers
  - Error handling: Unauthenticated scenarios

- [ ] `admin-session.ts` - Admin session utilities
  - `getAdminUser`: Returns admin user or null
  - `getSuperAdminUser`: Returns super admin or null
  - Error handling: Non-admin scenarios

- [ ] `guards.ts` - Authorization guards
  - `requireActiveUser`: Requires active user account
  - `isAdmin`: Checks admin status
  - `isSuperAdmin`: Checks super admin status
  - `requireAdmin`: Throws if not admin
  - `requireSuperAdmin`: Throws if not super admin
  - Error handling: Unauthorized scenarios

- [ ] `forgot-password.ts` - Password reset utilities
  - `forgotPassword`: Sends password reset email
  - Error handling: Invalid email, service failures
  - Rate limiting: Prevents abuse

- [ ] `index.ts` - Auth utility exports
  - `signOut`: Handles user sign out
  - `signInEmail`: Email-based sign in
  - `signInSocial`: Social provider sign in
  - Error handling: Authentication failures

#### Schemas

- [ ] `auth-schemas.ts` - Zod validation schemas
  - `emailSchema`: Email validation (format, length, normalization)
  - `passwordSchema`: Password strength validation
  - `nameSchema`: Name validation (length, trim)
  - `phoneSchema`: Phone number validation and formatting
  - `addressSchema`: Address validation
  - `emailSignupSchema`: Complete signup validation
  - `emailLoginSchema`: Login validation
  - `forgotPasswordSchema`: Password reset request validation
  - `resetPasswordSchema`: Password reset completion validation
  - Edge cases: Boundary values, special characters, empty strings

- [ ] `password.ts` - Password-specific schemas
  - Password strength requirements
  - Password confirmation matching
  - Password change validation
  - Edge cases: Special characters, length limits

#### Hooks

- [ ] `useSelectCommunity` (in `use-auth-mutations.ts`)
  - Posts to `/api/auth/select-community`
  - On success: invalidates `["currentUser"]` (and related) queries
  - Surfaces server errors to the caller

#### API Routes

- [ ] `POST /api/auth/select-community`
  - Authenticated only; body `{ communityId: string }`
  - Happy path: delegates to `AuthService.selectPrimaryCommunity`, returns `{ redirect: string }`
  - Maps DAL/service errors: `ConflictError` → 409, `ValidationError` → 400
  - Validation: empty/missing `communityId` → 400

- [ ] `GET /api/communities`
  - Query params `?networkSlug=...&active=true`; returns `Community[]` for the community-select dropdown
  - Sends `Cache-Control: public, max-age=60`

### Integration Tests

- [ ] **Signup Flow: Form → Action → DAL → Database**
  - Complete flow: User submits signup form → action validates → DAL creates user → database stores user
  - Legal documents: Action accepts legal documents → DAL records acceptance
  - Email verification: User created → verification email sent
  - Error propagation: Validation error → action error → form error display

- [ ] **Login Flow: Form → Action → Session → Redirect**
  - Complete flow: User submits login → action authenticates → session created → redirect
  - Error handling: Invalid credentials → error message displayed
  - Session management: Session stored correctly

- [ ] **Password Reset Flow: Request → Email → Reset → Login**
  - Complete flow: Request reset → email sent → token used → password reset → login works
  - Token validation: Expired tokens rejected
  - Security: Invalid tokens don't reveal user existence

- [ ] **Email Verification Flow: Signup → Email → Verification → Community Select**
  - Complete flow: User signs up → email sent → user verifies → routed to `/community-select`
  - Token validation: Invalid tokens rejected
  - Already verified: Handles gracefully

- [ ] **Community Selection Flow: Form → Hook → API → Service → DAL → DB**
  - Complete flow: `email_verified` user picks a community → `useSelectCommunity` → `POST /api/auth/select-community` → `AuthService.selectPrimaryCommunity` → primary membership + visibility rows created, status → `incomplete_profile` → redirect to `/onboarding`
  - Error propagation: existing-primary → 409 surfaced in the form; inactive community → 400
  - Legacy path: `email_verified` user reaches `/join-code` directly, submits a valid code → membership created (pre-verified) → routed to `/onboarding`

- [ ] **Admin Authentication Flow: Admin Login → Session → Admin Access**
  - Complete flow: Admin logs in → admin session created → admin routes accessible
  - Authorization: Non-admin users cannot access admin routes
  - Session management: Admin session stored correctly

- [ ] **Legal Documents Flow: Signup → Acceptance → Recorded**
  - Complete flow: User signs up → accepts documents → acceptance recorded
  - Validation: Required documents must be accepted
  - Edge cases: Both acceptance formats supported

- [ ] **Component → Hook → API Flow (if using React Query)**
  - Data fetching: Component uses hook → hook fetches from API → data displayed
  - Loading states: Hook loading state → component shows loading UI
  - Error states: API error → hook error state → component shows error

### E2E Tests

- [ ] **Complete User Signup Workflow** ([e2e/auth/signup-funnel.spec.ts](e2e/auth/signup-funnel.spec.ts))
  - User navigates to signup page
  - Fills out signup form with valid data
  - Accepts legal documents
  - Submits form
  - Verifies email sent notification
  - Verifies email with token
  - Lands on `/community-select`, picks a community, clicks Continue
  - Lands on `/onboarding`, completes it, lands on `/dashboard`

- [ ] **Community Selection Workflow** ([e2e/auth/community-select.spec.ts](e2e/auth/community-select.spec.ts))
  - `email_verified` user lands on `/community-select`
  - Dropdown is populated with the network's communities
  - "Request your community" opens the inquiry modal (cancellable)
  - Selecting a community persists it and redirects to `/onboarding`; re-visiting `/community-select` bounces forward
  - "Enter it here" links to `/join-code`

- [ ] **Legacy Join-Code Workflow** ([e2e/auth/join-code-legacy.spec.ts](e2e/auth/join-code-legacy.spec.ts))
  - A freshly verified user reaches `/join-code` by direct URL
  - Submits `E2E_JOIN_CODE`; the legacy code-based grant routes to `/onboarding`

- [ ] **Complete Login Workflow**
  - User navigates to login page
  - Enters valid credentials
  - Submits form
  - Verifies redirect to dashboard
  - Verifies session persists

- [ ] **Complete Password Reset Workflow**
  - User navigates to forgot password page
  - Enters email address
  - Receives password reset email
  - Clicks reset link
  - Enters new password
  - Verifies can login with new password

- [ ] **Admin Login Workflow**
  - Admin navigates to admin login page
  - Enters admin credentials
  - Verifies admin dashboard access
  - Verifies non-admin cannot access

- [ ] **Email Verification Workflow**
  - User signs up
  - Receives verification email
  - Enters verification token
  - Verifies email verified status
  - Verifies can access protected routes

- [ ] **Unauthorized Access Prevention** ([e2e/auth/status-redirect.spec.ts](e2e/auth/status-redirect.spec.ts))
  - Unauthenticated user attempts to access protected route → redirect to login
  - Unverified user attempts to access protected route → redirect to verification page
  - `email_verified` user (no primary community) attempts to access `/dashboard` → redirect to `/community-select`
  - `email_verified` user can still reach `/join-code` by direct URL (legacy path, R1.5)

### BDD Scenarios

```gherkin
Feature: User Signup
  As a new user
  I want to create an account
  So that I can access the platform

  Background:
    Given the signup page is accessible

  Scenario: Successfully sign up with valid data
    Given I am on the signup page
    When I fill in the form with:
      | Field      | Value                |
      | Email      | newuser@example.com  |
      | Password   | SecurePass123!       |
      | First Name | John                 |
      | Last Name  | Doe                  |
    And I accept the legal documents
    And I submit the form
    Then my account should be created
    And I should receive a verification email
    And I should be redirected to the verification page

  Scenario: Signup fails with invalid email
    Given I am on the signup page
    When I fill in the form with an invalid email
    And I submit the form
    Then I should see an email validation error
    And my account should not be created

  Scenario: Signup fails with weak password
    Given I am on the signup page
    When I fill in the form with a weak password
    And I submit the form
    Then I should see a password strength error
    And my account should not be created

  Scenario: Signup fails without legal document acceptance
    Given I am on the signup page
    When I fill in the form with valid data
    But I do not accept the legal documents
    And I submit the form
    Then I should see a legal documents acceptance error
    And my account should not be created

Feature: User Login
  As a registered user
  I want to log in to my account
  So that I can access my dashboard

  Background:
    Given I have a registered account

  Scenario: Successfully log in with valid credentials
    Given I am on the login page
    When I enter my email and password
    And I submit the form
    Then I should be authenticated
    And I should be redirected to my dashboard
    And my session should be active

  Scenario: Login fails with invalid credentials
    Given I am on the login page
    When I enter incorrect credentials
    And I submit the form
    Then I should see an authentication error
    And I should not be logged in
    And I should remain on the login page

Feature: Password Reset
  As a user who forgot my password
  I want to reset my password
  So that I can regain access to my account

  Background:
    Given I have a registered account

  Scenario: Successfully request password reset
    Given I am on the forgot password page
    When I enter my email address
    And I submit the form
    Then I should receive a password reset email
    And I should see a success message

  Scenario: Successfully reset password
    Given I have received a password reset email
    When I click the reset link
    And I enter a new password
    And I confirm the new password
    And I submit the form
    Then my password should be reset
    And I should be able to log in with the new password

Feature: Email Verification
  As a newly registered user
  I want to verify my email address
  So that I can access all platform features

  Background:
    Given I have signed up for an account

  Scenario: Successfully verify email
    Given I have received a verification email
    When I enter the verification token
    And I submit the form
    Then my email should be verified
    And I should have access to protected routes

  Scenario: Verification fails with invalid token
    Given I have received a verification email
    When I enter an invalid token
    And I submit the form
    Then I should see a verification error
    And my email should not be verified

Feature: Post-verification community selection
  As a newly verified user
  I want to pick my community from the metro list
  So that I can onboard without a private invite code

  Background:
    Given I have verified my email
    And I do not yet have a primary community

  Scenario: Verified user is routed to community select
    When I navigate to the dashboard
    Then I should be redirected to the community-select page

  Scenario: Select a community and continue
    Given I am on the community-select page
    When I choose a community from the list
    And I continue
    Then a primary membership is created with verification status "pending"
    And I should be redirected to onboarding

  Scenario: Legacy private-invite code path still works
    Given I navigate directly to the join-code page
    When I submit a valid join code
    Then a primary membership is created with verification status "verified"
    And I should be redirected to onboarding
```

## Test Data Requirements

### Test Fixtures

**Location**: `src/test/fixtures/auth.ts` (already exists)

**Required Fixtures**:

- `mockSession` - Active user session
- `mockAdminSession` - Admin user session
- `mockSignupData` - Valid signup data
- `mockSignupDataInvalid` - Invalid signup data for error testing
- `mockLoginData` - Valid login credentials
- `mockForgotPasswordData` - Password reset request data
- `mockResetPasswordData` - Password reset completion data
- `mockJoinCode` - Valid community join code (legacy private-invite path)
- `mockJoinCodeInvalid` - Invalid join code
- `mockSelectCommunityData` - Valid community-selection payload (`/api/auth/select-community`)

**Additional Fixtures Needed**:

- `mockVerifiedUser` - User with verified email
- `mockUnverifiedUser` - User with unverified email
- `mockLegalDocuments` - Legal document data
- `mockEmailToken` - Valid email verification token
- `mockResetToken` - Valid password reset token
- `mockExpiredToken` - Expired token for error testing

### Test Database Seeding

**For Integration/E2E Tests**:

- Seed script: `src/test/seed.ts`
- Create test users (verified, unverified, admin, regular)
- Create test sessions
- Create test tokens (valid, expired)
- Reset database before test suite execution

## Coverage Goals

### Feature-Specific Targets

- **Server Actions**: 85%+ (user-facing mutations)
  - `signupAction`: 90%+ (critical path)
  - `adminLoginAction`: 85%+
  - `forgotPasswordAction`: 85%+
  - `resetPasswordAction`: 90%+ (security critical)
  - `verifyEmailAction`: 85%+
  - `emailAction`: 80%+
  - `joinCommunityAction` / `AuthService.joinCommunity` (legacy): 85%+
  - `AuthService.selectPrimaryCommunity`: 90%+ (multi-branch orchestration)
  - `POST /api/auth/select-community`: 85%+
  - `acceptLegalDocumentsAction`: 85%+

- **React Components**: 80%+ (exceeds 75% threshold)
  - `SignupForm`: 85%+
  - `LoginForm`: 85%+
  - `ForgotPasswordForm`: 80%+
  - `ResetPasswordForm`: 85%+
  - `VerifyEmailForm`: 80%+
  - `AdminLoginForm`: 85%+
  - `CommunitySelectForm`: 85%+
  - `JoinCodeForm` (legacy): 80%+
  - `LegalDocumentsAcceptanceScreen`: 85%+
  - `AuthLayoutWrapper`: 80%+
  - `SuccessMessage`: 80%+

- **Utilities**: 90%+ (reusable functions)
  - `session.ts`: 95%+ (critical authentication logic)
  - `admin-session.ts`: 90%+
  - `guards.ts`: 95%+ (authorization critical)
  - `forgot-password.ts`: 85%+
  - `index.ts`: 85%+

- **Schemas**: 100% (validation logic)
  - `auth-schemas.ts`: 100% (all validation paths)
  - `password.ts`: 100% (all validation paths)

### Overall Feature Coverage

- **Statements**: > 85%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 85% (meets 80% threshold for features)

## Test Execution

### Unit Tests

- Execute: `bun test:run --grep "auth"`
- Watch mode: `bun test:watch --grep "auth"`
- Coverage: `bun test:coverage --grep "auth"`

### Integration Tests

- Tagged with `@integration` or in `src/features/auth/__tests__/integration/`
- Execute: `bun test:run --grep "integration.*auth"`

### E2E Tests

- Execute: `bun test:e2e --grep "auth"`
- Run against test database with seeded data
- Screenshots on failure enabled

### Test Execution Order

1. Unit tests (fastest feedback)
2. Integration tests (after unit tests pass)
3. E2E tests (in CI/CD pipeline)

## Special Considerations

### Authentication Testing

- Mock `getCurrentUserId()` or `requireAuth()` for unit/integration tests
- Use test authentication helpers for E2E tests
- Test session persistence across requests
- Test token expiration handling

### Security Testing

- Test password strength requirements
- Test rate limiting for password reset requests
- Test token expiration and invalidation
- Test SQL injection prevention in queries
- Test XSS prevention in user inputs

### Email Testing

- Mock email service for unit/integration tests
- Test email template rendering
- Test email delivery failures
- Use test email addresses for E2E tests

### Form Validation Testing

- Test Zod schema validation independently
- Test form-level validation in component tests
- Test server-side validation in server action tests
- Test client-side and server-side validation consistency

### Legal Documents Testing

- Test both acceptance formats (new and legacy)
- Test required document validation
- Test document version tracking
- Test acceptance timestamp recording

## Test Maintenance

### When to Update Tests

- Requirements change → Update test scenarios and BDD features
- Schema changes → Update fixtures and validation tests
- UI changes → Update component tests
- Security updates → Add security regression tests
- Bug fixes → Add regression tests

### Test Quality Checklist

- [x] Tests map to requirements/acceptance criteria
- [x] All test types covered (unit, integration, E2E)
- [x] Happy paths tested
- [x] Edge cases tested
- [x] Error conditions tested
- [x] BDD scenarios written for critical workflows
- [ ] Tests are independent (no dependencies)
- [ ] Tests are fast (< 1s for unit tests)
- [ ] Tests use AAA pattern
- [ ] Test names describe behavior, not implementation
- [ ] Coverage goals met

## Existing Test Coverage

### Currently Tested

- `signupAction` - Partial coverage in `src/features/auth/actions/__tests__/signup.test.ts`
- `AuthService.selectPrimaryCommunity` - `src/features/auth/services/auth-service.test.ts`
- `POST /api/auth/select-community` - `src/app/api/auth/select-community/__tests__/route.test.ts`
- `GET /api/communities` - `src/app/api/communities/__tests__/route.test.ts`
- `CommunitySelectForm` + `useSelectCommunity` - `src/features/auth/components/__tests__/community-select-form.test.tsx`
- Community-select / legacy-join-code / status-redirect E2E - `e2e/auth/*.spec.ts` (community-select, join-code-legacy, signup-funnel, status-redirect)

### Missing Test Coverage

- Other server actions (admin-login, forgot-password, reset-password, verify-email, email, accept-legal-documents)
- Most components (the auth forms other than signup/community-select)
- Several utilities and the two schema files
- Broader integration coverage beyond the signup/community-select paths

## References

- **Test Plan Template**: `docs/AI-test-plan-template.md`
- **EARS Methodology**: `.ai/AI-ears-methodology.md`
- **BDD Methodology**: `.ai/AI-bdd-methodology.md`
- **TDD Methodology**: `.ai/AI-tdd-methodology.md`
- **Example Component Test**: `src/features/listings/components/__tests__/status-icon-with-tooltip.test.tsx`
- **Existing Auth Test**: `src/features/auth/actions/__tests__/signup.test.ts`
- **Auth Fixtures**: `src/test/fixtures/auth.ts`
