# Auth API Routes Migration - User Acceptance Test Plan

## Overview

This document defines the user acceptance tests (UAT) for the Auth API Routes Migration (Phase 7). Each test is written from the end-user perspective and verifiable by a QA tester or stakeholder with access to a staging environment. Tests are grouped by feature area and traced back to Phase 7 requirements.

**Prerequisites for all tests:**

- Staging (or production) environment with API routes and React Query auth flows deployed
- Test user accounts (regular users, admin users)
- Test email service configured and observable (e.g., Resend)
- Valid join codes available for join-community flow
- Modern browser: Chrome, Firefox, Edge, or Safari (latest)
- For Google OAuth tests (UAT-5.3–5.6): Google account (test or personal) and OAuth configured in environment
- Optional: mobile device or emulation for UAT-12.1

**Reference documents:**

- Migration plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Test plan: `specs/auth/4-test-plan.md`

---

## UAT-1: Signup – Happy Path

**Requirements:** Phase 7 - Signup

### UAT-1.1: Signup with valid data and legal acceptance

| Field               | Value                                                                                                                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is not logged in; user has a valid email not already registered                                                                                                                                                                                                                                     |
| **Steps**           | 1. Navigate to `/signup`<br>2. Enter first name, last name, email, password, confirm password<br>3. Accept Terms of Service and Privacy Policy<br>4. Click "Sign Up"<br>5. Wait for success                                                                                                              |
| **Expected Result** | Signup form displays all required fields. On submit, loading state appears; user is redirected to `/verify-email?email=...`. Verification email is sent; user status is `pending_verification`; legal acceptances recorded with IP and user agent. User cannot access dashboard until email is verified. |

---

## UAT-2: Signup – Validation Errors

**Requirements:** Phase 7 - Signup Validation

### UAT-2.1: Signup validation errors for invalid or missing data

| Field               | Value                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on signup page; form not yet submitted                                                                                                                                                                                                                                                                                                                                            |
| **Steps**           | 1. Submit with empty first name → verify error<br>2. Submit with empty last name → verify error<br>3. Submit with invalid email (e.g. "notanemail") → verify error<br>4. Submit with existing email → verify error<br>5. Submit with weak password (e.g. "123") → verify error<br>6. Submit with mismatched passwords → verify error<br>7. Submit without legal checkboxes → verify error |
| **Expected Result** | Clear, field-specific errors: "First name is required", "Last name is required", "Please enter a valid email address", "An account with this email already exists. Please sign in instead.", "Password must meet requirements", "Passwords do not match", "You must accept the Terms of Service and Privacy Policy". Form blocks submission until valid.                                  |

---

## UAT-3: Resend Verification Email

**Requirements:** Phase 7 - Resend Verification, Phase 7 - Rate Limiting

### UAT-3.1: Resend verification email – happy path

| Field               | Value                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | User has signed up but not verified email; user is on `/verify-email`; email is displayed                                                                                                                                            |
| **Steps**           | 1. Navigate to verify email page (after signup or directly)<br>2. Confirm "Resend Verification Email" button is visible<br>3. Click "Resend Verification Email"<br>4. Wait for response<br>5. Check inbox for new verification email |
| **Expected Result** | Loading state on click. Success message (e.g. "Verification email sent! Please check your inbox."). New verification email received with valid link. Resend button remains usable after rate limit window.                           |

### UAT-3.2: Resend verification email – rate limiting

| Field               | Value                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on verify email page; user has just requested a verification email successfully                                                                                                            |
| **Steps**           | 1. Immediately click "Resend Verification Email" again<br>2. Observe response<br>3. Wait for rate limit period to expire<br>4. Click "Resend Verification Email" again<br>5. Confirm email is sent |
| **Expected Result** | Immediate resend returns rate limit response (e.g. 429) with message such as "Please wait before requesting another verification email." After wait, resend succeeds and email is sent.            |

---

## UAT-4: Join Community

**Requirements:** Phase 7 - Join Community, Phase 7 - Join Community Validation

### UAT-4.1: Join community with valid join code

| Field               | Value                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has verified email (status `email_verified`); user is on `/join-code`; user has a valid join code                                                                                                                                                                                    |
| **Steps**           | 1. Navigate to join code page (after email verification)<br>2. Enter valid join code (e.g. "COMMUNITY2024")<br>3. Click "Join Community"<br>4. Wait for success                                                                                                                           |
| **Expected Result** | Join code form displays and accepts input. Validation is case-insensitive. On submit, loading state appears; user is redirected to `/onboarding`. User status becomes `incomplete_profile`; user is associated with community. User cannot access dashboard until onboarding is complete. |

### UAT-4.2: Join community – invalid, empty, or expired join code

| Field               | Value                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | User is on join code page; user has verified email                                                                                                                                                                                                                       |
| **Steps**           | 1. Enter invalid join code (e.g. "INVALID123") and submit → verify error<br>2. Enter empty join code and submit → verify validation error<br>3. If applicable, enter expired join code and submit → verify error<br>4. Enter valid join code and submit → verify success |
| **Expected Result** | Invalid code: clear error (e.g. "Invalid join code. Please check and try again."). Empty: "Join code is required". Expired: "This join code has expired" (if supported). User can retry with correct code.                                                               |

---

## UAT-5: Legal Documents (OAuth Flow)

**Requirements:** Phase 7 - Accept Legal Documents, Phase 7 - Legal Documents Validation

### UAT-5.1: Accept legal documents after OAuth signup – happy path

| Field               | Value                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has signed up via OAuth (e.g. Google); user is on legal documents acceptance page; user has not yet accepted legal documents                                                                                                                 |
| **Steps**           | 1. Complete OAuth signup and land on legal acceptance page<br>2. Confirm Terms of Service and Privacy Policy checkboxes and links are visible and functional<br>3. Check both checkboxes<br>4. Click "Accept and Continue"<br>5. Wait for success |
| **Expected Result** | Legal acceptance page shows after OAuth signup. Both checkboxes required. On submit, loading state; redirect to `/join-code`. Legal document acceptances recorded in database with IP and user agent. User status updated appropriately.          |

### UAT-5.2: Accept legal documents – validation when not both accepted

| Field               | Value                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on legal documents acceptance page; user has not accepted both documents                                                                                                                                       |
| **Steps**           | 1. Submit with no checkboxes checked → verify error<br>2. Check only Terms of Service and submit → verify error<br>3. Check only Privacy Policy and submit → verify error<br>4. Check both and submit → verify success |
| **Expected Result** | Errors as appropriate: "You must accept both Terms of Service and Privacy Policy" (or equivalent for missing TOS or Privacy). Form blocks submission until both are checked. User can proceed after accepting both.    |

### UAT-5.3: Google signup – new user end-to-end

| Field               | Value                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | User is not logged in; user has a Google account not yet registered in the app                                                                                                                                                                                                                                                             |
| **Steps**           | 1. Navigate to `/signup`<br>2. Click "Continue with Google"<br>3. Complete Google consent (sign in with Google if prompted)<br>4. After redirect to app, confirm landing on `/signup/google/legal-acceptance`<br>5. Check Terms of Service and Privacy Policy; click "Accept and Continue"<br>6. Wait for redirect                         |
| **Expected Result** | "Continue with Google" is visible and triggers redirect to Google. After Google auth, user is redirected to `/signup/google/callback` then to `/signup/google/legal-acceptance` (legal not yet accepted). After accepting, user is redirected to `/join-code`. User status is `email_verified`; profile photo set from Google if provided. |

### UAT-5.4: Google login – existing active user

| Field               | Value                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User already has an account (created via Google or email) with status `active`                                                                                                                                        |
| **Steps**           | 1. Navigate to `/login`<br>2. Click "Continue with Google"<br>3. Complete Google sign-in if prompted<br>4. After redirect to app, confirm destination                                                                 |
| **Expected Result** | "Continue with Google" is visible and triggers redirect to Google. After Google auth, user is redirected to `/dashboard` (or callbackUrl when provided). Session is established; user can access authenticated areas. |

### UAT-5.5: Google callback – status-based redirect (existing user)

| Field               | Value                                                                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has an existing account with status `active` or `incomplete_profile`; user starts Google sign-in from signup page (e.g. "Continue with Google" on `/signup`)                                                                                                                       |
| **Steps**           | 1. From `/signup`, click "Continue with Google" and complete Google auth<br>2. Observe redirect after callback<br>3. If user already had legal accepted and status `active`, confirm redirect to `/dashboard`<br>4. If user had `incomplete_profile`, confirm redirect to `/onboarding` |
| **Expected Result** | Callback `/signup/google/callback` routes by status: `active` → `/dashboard`; `incomplete_profile` → `/onboarding`; otherwise (e.g. `email_verified`) → `/join-code`. No duplicate legal-acceptance step if already accepted.                                                           |

### UAT-5.6: Google signup – user cancels or error

| Field               | Value                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on signup page; user may cancel at Google or an error may occur                                                                                                                               |
| **Steps**           | 1. Navigate to `/signup`<br>2. Click "Continue with Google"<br>3. Cancel at Google consent screen (or simulate error/denied)<br>4. Return to app and observe URL and any message                      |
| **Expected Result** | User returns to app; redirect to `/signup?error=...` (e.g. `signup_failed`) or login with no session. No crash; user can retry with Google or use email signup. Error state is clear where supported. |

---

## UAT-6: Forgot Password

**Requirements:** Phase 7 - Forgot Password, Phase 7 - Security

### UAT-6.1: Forgot password – happy path

| Field               | Value                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is not logged in; user navigates to `/forgot-password`; user has a registered email address                                                                                                                                                                                      |
| **Steps**           | 1. Navigate to forgot password page<br>2. Enter registered email address<br>3. Click "Send Reset Link" (or equivalent)<br>4. Wait for response<br>5. Check email inbox for password reset email<br>6. Confirm email contains reset link with token                                    |
| **Expected Result** | Form accepts email. On submit, loading state. Success message (e.g. "If an account exists with this email, a password reset link has been sent."). Registered user receives email with valid reset link and secure token. Same message shown for non-existent email (no enumeration). |

### UAT-6.2: Forgot password – email enumeration prevention

| Field               | Value                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on forgot password page                                                                                                                                                                                               |
| **Steps**           | 1. Submit with registered email → note success message<br>2. Submit with non-existent email → note success message<br>3. Confirm no indication that email does not exist<br>4. Confirm email only sent for registered address |
| **Expected Result** | Same success message for both registered and non-existent emails. No indication whether email exists. Email sent only when account exists. Response timing similar to avoid timing-based enumeration.                         |

---

## UAT-7: Reset Password

**Requirements:** Phase 7 - Reset Password, Phase 7 - Reset Password Validation, Phase 7 - Token Validation

### UAT-7.1: Reset password – happy path

| Field               | Value                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | User has requested password reset and received reset email; user has valid reset token (e.g. from link)                                                                                                                                                                                                |
| **Steps**           | 1. Open password reset link from email<br>2. Confirm reset password form is displayed with token in URL<br>3. Enter new password and confirm password (meeting strength requirements)<br>4. Click "Reset Password"<br>5. Wait for success<br>6. Confirm redirect to login and log in with new password |
| **Expected Result** | Reset page loads with token. Form enforces password strength. On submit, loading state; redirect to `/login?message=password-reset-success`. Success message on login page. User can log in with new password; old password no longer works. Token invalidated after use.                              |

### UAT-7.2: Reset password – validation errors

| Field               | Value                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | User is on reset password page with valid token                                                                                                                                                                                            |
| **Steps**           | 1. Submit with empty password → verify error<br>2. Submit with weak password (e.g. "123") → verify error<br>3. Enter valid password and mismatched confirm → verify error<br>4. Enter matching valid passwords and submit → verify success |
| **Expected Result** | Errors: "Password is required", weak password message, "Passwords do not match". Form blocks submission until valid matching passwords meeting requirements.                                                                               |

### UAT-7.3: Reset password – invalid or expired token

| Field               | Value                                                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has reset link; token may be invalid or expired                                                                                                                                                                                                                                     |
| **Steps**           | 1. Open reset page with invalid token → verify error<br>2. Attempt to submit new password → verify submission prevented or error<br>3. Open reset page with expired token → verify error<br>4. Request new reset email; use new token → verify reset succeeds; old token no longer works |
| **Expected Result** | Invalid/expired token shows clear error (e.g. "Invalid or expired reset link. Please request a new password reset."). Form disabled or error state; link to request new reset provided. New token works; old token invalid.                                                              |

---

## UAT-8: Admin Login

**Requirements:** Phase 7 - Admin Login, Phase 7 - Admin Login Security

### UAT-8.1: Admin login – happy path

| Field               | Value                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Admin user exists with admin privileges; admin navigates to admin login page (`/admin`); admin has valid credentials                                                                                                                      |
| **Steps**           | 1. Navigate to admin login page<br>2. Enter admin email and password<br>3. Click "Sign In"<br>4. Wait for success<br>5. Confirm redirect to admin dashboard<br>6. Confirm admin can access admin-only features                            |
| **Expected Result** | Admin login form displays and accepts credentials. On submit, loading state; redirect to admin dashboard. Admin session established; admin privileges active; admin can access admin-only features. Regular users cannot use admin login. |

### UAT-8.2: Admin login – invalid credentials and non-admin user

| Field               | Value                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on admin login page                                                                                                                                                                  |
| **Steps**           | 1. Submit invalid email/password → verify error<br>2. Submit valid email but wrong password → verify error<br>3. Submit regular (non-admin) user credentials → verify error                  |
| **Expected Result** | Generic errors (e.g. "Invalid email or password", "You do not have admin privileges"). No indication whether email exists. Admin session not established; user cannot access admin features. |

---

## UAT-9: Redirect Handling

**Requirements:** Phase 7 - Redirect Handling

### UAT-9.1: Redirect handling – signup flow

| Field               | Value                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is completing full signup flow; API routes return redirect URLs                                                                                                                                                                                                            |
| **Steps**           | 1. Complete signup → verify redirect to `/verify-email?email=...`<br>2. Complete email verification (e.g. click link) → verify redirect to `/join-code`<br>3. Complete join code → verify redirect to `/onboarding`<br>4. Complete onboarding → verify redirect to `/dashboard` |
| **Expected Result** | Redirects occur automatically after each step. URLs and query params correct (e.g. email in verify-email). User cannot skip steps. Redirects smooth; browser history and back button behave appropriately.                                                                      |

### UAT-9.2: Redirect handling – password reset flow

| Field               | Value                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has completed password reset; API returns redirect URL                                                                                                                              |
| **Steps**           | 1. Submit reset password form<br>2. Verify redirect to `/login?message=password-reset-success`<br>3. Verify success message on login page<br>4. Verify user can log in with new password |
| **Expected Result** | Redirect after reset to login with message param. Success message displayed and parsed correctly. User can proceed to login; redirect is smooth.                                         |

---

## UAT-10: React Query and Error Handling

**Requirements:** Phase 7 - React Query Performance, Phase 7 - Error Handling

### UAT-10.1: React Query caching and updates during auth

| Field               | Value                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is completing auth flows; React Query is configured                                                                                                                                              |
| **Steps**           | 1. Submit signup (or other auth action) and observe loading/success state<br>2. Navigate between auth pages<br>3. Observe loading and cached behavior                                                 |
| **Expected Result** | Loading states appear on submission; success state after completion. Navigation between auth pages smooth; cached data loads instantly where applicable; no unnecessary flicker or duplicate loading. |

### UAT-10.2: Error handling – network errors

| Field               | Value                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | User is on an auth page; network can be disconnected                                                                                                                                 |
| **Steps**           | 1. Fill out signup (or other) form<br>2. Disconnect network<br>3. Submit form<br>4. Verify error message<br>5. Reconnect network and submit again<br>6. Verify submission succeeds   |
| **Expected Result** | User-friendly network error (e.g. "Network error. Please check your internet connection and try again."). User can retry after network restored. Form data preserved where possible. |

### UAT-10.3: Error handling – API errors

| Field               | Value                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User can trigger various API errors (existing email, invalid join code, invalid reset token, server error)                                                                                                              |
| **Steps**           | 1. Signup with existing email → verify specific error<br>2. Submit invalid join code → verify error<br>3. Submit reset with invalid token → verify error<br>4. If possible, trigger server error → verify error message |
| **Expected Result** | Specific, user-friendly messages per error type with actionable guidance. Errors shown as toast or inline. Toast duration appropriate (e.g. 5 seconds). User can retry after fixing issues.                             |

---

## UAT-11: Legal Document Tracking and User Status

**Requirements:** Phase 7 - Legal Document Tracking, Phase 7 - User Status Transitions

### UAT-11.1: Legal document tracking (IP, user agent, versions)

| Field               | Value                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is completing signup or OAuth flow with legal document acceptance                                                                                                                                                                                               |
| **Steps**           | 1. Complete signup with legal acceptance; verify signup succeeds<br>2. Check database/logs for legal acceptance records<br>3. Verify IP, user agent, user ID, document versions, timestamps<br>4. Complete OAuth flow with legal acceptance and verify same tracking |
| **Expected Result** | Legal acceptances recorded in database. IP address and user agent captured and stored. User ID linked; document versions and timestamps accurate. Tracking works for both email signup and OAuth.                                                                    |

### UAT-11.2: User status transitions through auth flow

| Field               | Value                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is completing full auth flow; status changes at each step                                                                                                                                                                                                                                                                                  |
| **Steps**           | 1. Complete signup → verify status `pending_verification` and no dashboard access<br>2. Complete email verification → verify status `email_verified` and no dashboard access<br>3. Complete join community → verify status `incomplete_profile` and no dashboard access<br>4. Complete onboarding → verify status `active` and dashboard access |
| **Expected Result** | Status transitions: `pending_verification` → `email_verified` → `incomplete_profile` → `active`. Each transition at correct step; user cannot skip steps or access dashboard until `active`. Middleware enforces status-based routing.                                                                                                          |

---

## UAT-12: Mobile and Concurrency

**Requirements:** Phase 7 - Mobile Support, Phase 7 - Concurrency Handling

### UAT-12.1: Mobile responsiveness of auth forms

| Field               | Value                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is on mobile device or mobile browser view                                                                                                                                                           |
| **Steps**           | 1. Open app and navigate to signup, login, forgot password, reset password<br>2. Complete each form on mobile<br>3. Verify layout, touch targets, and keyboard behavior                                   |
| **Expected Result** | All auth forms mobile-responsive; no horizontal scroll; inputs and buttons appropriately sized; buttons at least 44x44px; text readable; appropriate keyboard types; no cut-off or inaccessible elements. |

### UAT-12.2: Concurrent auth actions (same email or token)

| Field               | Value                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User can open multiple tabs and attempt overlapping auth actions                                                                                                                                                                                                    |
| **Steps**           | 1. Open signup in two tabs; submit same email in both → verify first succeeds, second gets appropriate error or state<br>2. Open reset password with same token in two tabs; submit in first then second → verify second handled correctly (error or updated state) |
| **Expected Result** | First action succeeds; second shows appropriate error or updated state. No duplicate accounts or duplicate resets. Data consistent; clear messages on conflict; no corruption or inconsistent state.                                                                |

---

## Test Execution Checklist

Use this checklist to track UAT progress during testing rounds.

| Test ID  | Description                                    | Status | Tester | Date | Notes |
| -------- | ---------------------------------------------- | ------ | ------ | ---- | ----- |
| UAT-1.1  | Signup with valid data and legal acceptance    |        |        |      |       |
| UAT-2.1  | Signup validation errors                       |        |        |      |       |
| UAT-3.1  | Resend verification – happy path               |        |        |      |       |
| UAT-3.2  | Resend verification – rate limiting            |        |        |      |       |
| UAT-4.1  | Join community with valid code                 |        |        |      |       |
| UAT-4.2  | Join community – invalid/empty/expired code    |        |        |      |       |
| UAT-5.1  | Accept legal documents (OAuth) – happy path    |        |        |      |       |
| UAT-5.2  | Accept legal documents – validation            |        |        |      |       |
| UAT-5.3  | Google signup – new user end-to-end            |        |        |      |       |
| UAT-5.4  | Google login – existing active user            |        |        |      |       |
| UAT-5.5  | Google callback – status-based redirect        |        |        |      |       |
| UAT-5.6  | Google signup – user cancels or error          |        |        |      |       |
| UAT-6.1  | Forgot password – happy path                   |        |        |      |       |
| UAT-6.2  | Forgot password – email enumeration prevention |        |        |      |       |
| UAT-7.1  | Reset password – happy path                    |        |        |      |       |
| UAT-7.2  | Reset password – validation errors             |        |        |      |       |
| UAT-7.3  | Reset password – invalid/expired token         |        |        |      |       |
| UAT-8.1  | Admin login – happy path                       |        |        |      |       |
| UAT-8.2  | Admin login – invalid/non-admin                |        |        |      |       |
| UAT-9.1  | Redirect handling – signup flow                |        |        |      |       |
| UAT-9.2  | Redirect handling – password reset             |        |        |      |       |
| UAT-10.1 | React Query caching and updates                |        |        |      |       |
| UAT-10.2 | Error handling – network errors                |        |        |      |       |
| UAT-10.3 | Error handling – API errors                    |        |        |      |       |
| UAT-11.1 | Legal document tracking                        |        |        |      |       |
| UAT-11.2 | User status transitions                        |        |        |      |       |
| UAT-12.1 | Mobile responsiveness                          |        |        |      |       |
| UAT-12.2 | Concurrent auth actions                        |        |        |      |       |

---

## Acceptance Criteria Summary

The Phase 7 migration SHALL be considered accepted when:

- Signup works with API routes and React Query (email and Google); email verification and resend work correctly
- Join community flow works with redirect handling; legal document acceptance (OAuth) and Google signup/login flows work correctly
- Forgot password and reset password flows work correctly; admin login works with proper authorization
- Redirect handling is correct for all auth flows; React Query provides appropriate caching and updates
- Error handling gives clear user feedback; all user status transitions and legal document tracking work correctly
- Security measures in place (rate limiting, email enumeration prevention); mobile experience is functional and responsive

## Known Issues and Limitations

_To be filled during test execution_

## Test Sign-Off

- **Test Executor**: \_\_\_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_
- **Business Stakeholder**: \_\_\_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_
- **Product Owner**: \_\_\_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_
- **Technical Lead**: \_\_\_\_\_\_\_\_\_\_\_\_ Date: \_\_\_\_

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Next Review**: After test execution
