# Auth API Routes Migration - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Auth API Routes Migration (Phase 7). UAT validates that all authentication functionality works correctly after migrating from server actions to API routes with React Query. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Auth API Routes Migration (Phase 7)  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Migration Plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Requirements: `specs/auth/1-requirements.md` (if exists)
- Design: `specs/auth/2-design.md` (if exists)
- Implementation Tasks: `specs/auth/3-tasks.md` (if exists)

## Test Objectives

1. Verify that signup works correctly with API routes and React Query
2. Validate that email verification and resend functionality works correctly
3. Confirm that join community flow works with redirect handling
4. Ensure that legal document acceptance (OAuth flow) works correctly
5. Verify that forgot password and reset password flows work correctly
6. Validate that admin login works with proper authorization
7. Confirm that redirect handling works correctly for all auth flows
8. Ensure that React Query provides proper caching and updates
9. Verify that error handling provides clear user feedback
10. Validate that all user status transitions work correctly
11. Ensure that legal document tracking works correctly
12. Confirm that all auth functionality maintains existing behavior

## Test Scenarios

### Scenario 1: Signup - Happy Path

**User Story**: As a new user, I want to create an account so that I can access the platform.

**Preconditions**:

- User is not logged in
- User navigates to signup page (`/signup`)
- User has a valid email address not already registered

**Test Steps**:

1. Navigate to signup page
2. Verify signup form is displayed
3. Enter first name: "John"
4. Enter last name: "Doe"
5. Enter email: "john.doe@example.com"
6. Enter password: "SecurePassword123!"
7. Confirm password: "SecurePassword123!"
8. Accept Terms of Service checkbox
9. Accept Privacy Policy checkbox
10. Click "Sign Up" button
11. Verify loading state appears
12. Verify success message or redirect occurs
13. Verify redirect to `/verify-email?email=john.doe@example.com`
14. Check email inbox for verification email
15. Verify user status is `pending_verification`

**Expected Results**:

- ✅ Signup form displays all required fields
- ✅ Form validation allows valid data submission
- ✅ Legal document checkboxes are required and functional
- ✅ Password and confirm password must match
- ✅ Upon submission, user sees loading state
- ✅ Success message appears or redirect occurs
- ✅ User is redirected to `/verify-email?email=john.doe@example.com`
- ✅ Verification email is sent to user's email address
- ✅ User account is created with status `pending_verification`
- ✅ Legal document acceptances are recorded with IP and user agent
- ✅ User cannot access dashboard until email is verified

**Test Data**:

- Valid first name and last name
- Valid email address (not already registered)
- Strong password (meets requirements)
- Matching password confirmation
- Legal documents accepted

**Priority**: Critical  
**Requirement Reference**: Phase 7 - Signup

---

### Scenario 2: Signup - Validation Errors

**User Story**: As a user, I want clear validation errors when I submit invalid signup data so I understand what needs to be fixed.

**Preconditions**:

- User is on signup page
- User has not submitted form yet

**Test Steps**:

1. Navigate to signup page
2. Attempt to submit with empty first name
3. Verify validation error
4. Attempt to submit with empty last name
5. Verify validation error
6. Attempt to submit with invalid email: "notanemail"
7. Verify validation error
8. Attempt to submit with existing email
9. Verify validation error
10. Attempt to submit with weak password: "123"
11. Verify validation error
12. Attempt to submit with mismatched passwords
13. Verify validation error
14. Attempt to submit without accepting legal documents
15. Verify validation error

**Expected Results**:

- ✅ Error message for empty first name: "First name is required"
- ✅ Error message for empty last name: "Last name is required"
- ✅ Error message for invalid email: "Please enter a valid email address"
- ✅ Error message for existing email: "An account with this email already exists. Please sign in instead."
- ✅ Error message for weak password: "Password must meet requirements"
- ✅ Error message for mismatched passwords: "Passwords do not match"
- ✅ Error message for missing legal acceptance: "You must accept the Terms of Service and Privacy Policy"
- ✅ Error messages appear near the relevant fields
- ✅ Error messages are clear and actionable
- ✅ Form prevents submission with invalid data

**Test Data**:

- Empty required fields
- Invalid email format
- Existing email address
- Weak passwords
- Mismatched passwords
- Missing legal document acceptance

**Priority**: High  
**Requirement Reference**: Phase 7 - Signup Validation

---

### Scenario 3: Resend Verification Email - Happy Path

**User Story**: As a user, I want to resend my verification email if I didn't receive it or it expired.

**Preconditions**:

- User has signed up but not verified email
- User is on verify email page (`/verify-email`)
- User's email is displayed on the page

**Test Steps**:

1. Navigate to verify email page (after signup or directly)
2. Verify email address is displayed
3. Verify "Resend Verification Email" button is visible
4. Click "Resend Verification Email" button
5. Verify loading state appears
6. Verify success message appears
7. Check email inbox for new verification email
8. Verify email contains verification link or code
9. Wait for rate limit period (if applicable)
10. Attempt to resend again
11. Verify rate limiting message (if applicable)

**Expected Results**:

- ✅ Verify email page displays user's email address
- ✅ Resend button is visible and functional
- ✅ Loading state appears when resending
- ✅ Success message: "Verification email sent. Please check your inbox."
- ✅ New verification email is sent to user's email
- ✅ Email contains valid verification link or code
- ✅ Rate limiting prevents spam (if implemented)
- ✅ Rate limit message is clear (if applicable)
- ✅ User can resend after rate limit period

**Test Data**:

- User with unverified email
- Valid email address
- Rate limit configuration (if applicable)

**Priority**: High  
**Requirement Reference**: Phase 7 - Resend Verification

---

### Scenario 4: Resend Verification Email - Rate Limiting

**User Story**: As a system, I want to prevent spam by rate limiting verification email resends.

**Preconditions**:

- User is on verify email page
- User has already requested verification email

**Test Steps**:

1. Navigate to verify email page
2. Click "Resend Verification Email" button
3. Wait for success message
4. Immediately click "Resend Verification Email" button again
5. Verify rate limit message appears
6. Wait for rate limit period to expire
7. Click "Resend Verification Email" button again
8. Verify email is sent successfully

**Expected Results**:

- ✅ Rate limiting prevents immediate resend
- ✅ Rate limit message is clear: "Please wait before requesting another email"
- ✅ Rate limit period is reasonable (e.g., 60 seconds)
- ✅ User can resend after rate limit period expires
- ✅ Rate limit applies per email address
- ✅ Rate limit message includes wait time (if applicable)

**Test Data**:

- User with unverified email
- Rate limit configuration
- Timer for rate limit period

**Priority**: Medium  
**Requirement Reference**: Phase 7 - Rate Limiting

---

### Scenario 5: Join Community - Happy Path

**User Story**: As a user, I want to join the community with a valid join code so I can proceed to onboarding.

**Preconditions**:

- User has verified email (status: `email_verified`)
- User is on join code page (`/join-code`)
- User has a valid join code

**Test Steps**:

1. Navigate to join code page (after email verification)
2. Verify join code form is displayed
3. Enter valid join code: "COMMUNITY2024"
4. Click "Join Community" button
5. Verify loading state appears
6. Verify success message or redirect occurs
7. Verify redirect to `/onboarding`
8. Verify user status is updated to `incomplete_profile`
9. Verify user is associated with community

**Expected Results**:

- ✅ Join code form displays correctly
- ✅ Form accepts join code input
- ✅ Join code validation works (case-insensitive)
- ✅ Upon submission, user sees loading state
- ✅ Success message appears or redirect occurs
- ✅ User is redirected to `/onboarding`
- ✅ User status is updated to `incomplete_profile`
- ✅ User is associated with the community
- ✅ User cannot access dashboard until onboarding is complete

**Test Data**:

- Valid join code (case-insensitive)
- User with `email_verified` status

**Priority**: Critical  
**Requirement Reference**: Phase 7 - Join Community

---

### Scenario 6: Join Community - Invalid Join Code

**User Story**: As a user, I want clear error messages when I enter an invalid join code.

**Preconditions**:

- User is on join code page
- User has verified email

**Test Steps**:

1. Navigate to join code page
2. Enter invalid join code: "INVALID123"
3. Click "Join Community" button
4. Verify error message appears
5. Enter empty join code
6. Click "Join Community" button
7. Verify validation error
8. Enter expired join code (if applicable)
9. Click "Join Community" button
10. Verify error message

**Expected Results**:

- ✅ Error message for invalid join code: "Invalid join code. Please check and try again."
- ✅ Error message for empty join code: "Join code is required"
- ✅ Error message for expired join code: "This join code has expired"
- ✅ Error messages are clear and actionable
- ✅ Form prevents submission with invalid join code
- ✅ User can retry with correct join code

**Test Data**:

- Invalid join codes
- Empty join code
- Expired join code (if applicable)

**Priority**: High  
**Requirement Reference**: Phase 7 - Join Community Validation

---

### Scenario 7: Accept Legal Documents (OAuth Flow) - Happy Path

**User Story**: As a user signing up with OAuth, I want to accept legal documents so I can complete my account setup.

**Preconditions**:

- User has signed up via OAuth (Google, etc.)
- User is on legal documents acceptance page
- User has not yet accepted legal documents

**Test Steps**:

1. Complete OAuth signup (Google, etc.)
2. Verify redirect to legal documents acceptance page
3. Verify Terms of Service checkbox is visible
4. Verify Privacy Policy checkbox is visible
5. Verify links to legal documents are functional
6. Check Terms of Service checkbox
7. Check Privacy Policy checkbox
8. Click "Accept and Continue" button
9. Verify loading state appears
10. Verify success message or redirect occurs
11. Verify redirect to `/join-code`
12. Verify legal document acceptances are recorded
13. Verify IP address and user agent are tracked

**Expected Results**:

- ✅ Legal documents acceptance page displays after OAuth signup
- ✅ Both checkboxes (TOS and Privacy) are visible
- ✅ Links to legal documents open correctly
- ✅ Both checkboxes must be checked to proceed
- ✅ Upon submission, user sees loading state
- ✅ Success message appears or redirect occurs
- ✅ User is redirected to `/join-code`
- ✅ Legal document acceptances are recorded in database
- ✅ IP address and user agent are tracked for compliance
- ✅ User status is updated appropriately

**Test Data**:

- OAuth provider (Google, etc.)
- Legal document URLs
- Valid IP address and user agent

**Priority**: High  
**Requirement Reference**: Phase 7 - Accept Legal Documents

---

### Scenario 8: Accept Legal Documents - Validation Errors

**User Story**: As a user, I want clear validation when I haven't accepted required legal documents.

**Preconditions**:

- User is on legal documents acceptance page
- User has not accepted legal documents

**Test Steps**:

1. Navigate to legal documents acceptance page
2. Attempt to submit without checking any checkboxes
3. Verify validation error
4. Check only Terms of Service checkbox
5. Attempt to submit
6. Verify validation error
7. Check only Privacy Policy checkbox
8. Attempt to submit
9. Verify validation error
10. Check both checkboxes
11. Submit successfully

**Expected Results**:

- ✅ Error message when no checkboxes checked: "You must accept both Terms of Service and Privacy Policy"
- ✅ Error message when only TOS checked: "You must accept the Privacy Policy"
- ✅ Error message when only Privacy checked: "You must accept the Terms of Service"
- ✅ Form prevents submission until both are checked
- ✅ Error messages are clear and actionable
- ✅ User can proceed after accepting both documents

**Test Data**:

- Legal documents acceptance page
- Various checkbox combinations

**Priority**: Medium  
**Requirement Reference**: Phase 7 - Legal Documents Validation

---

### Scenario 9: Forgot Password - Happy Path

**User Story**: As a user, I want to request a password reset email so I can reset my forgotten password.

**Preconditions**:

- User is not logged in
- User navigates to forgot password page (`/forgot-password`)
- User has a registered email address

**Test Steps**:

1. Navigate to forgot password page
2. Verify forgot password form is displayed
3. Enter registered email address: "user@example.com"
4. Click "Send Reset Link" button
5. Verify loading state appears
6. Verify success message appears
7. Check email inbox for password reset email
8. Verify email contains password reset link
9. Verify link includes reset token

**Expected Results**:

- ✅ Forgot password form displays correctly
- ✅ Form accepts email input
- ✅ Upon submission, user sees loading state
- ✅ Success message: "If an account exists with this email, a password reset link has been sent."
- ✅ Email is sent to registered email address (if account exists)
- ✅ Password reset email contains valid reset link
- ✅ Reset link includes secure token
- ✅ Email provides clear instructions
- ✅ Security: Same message shown for non-existent emails (prevents email enumeration)

**Test Data**:

- Registered email address
- Non-existent email address (for security testing)

**Priority**: High  
**Requirement Reference**: Phase 7 - Forgot Password

---

### Scenario 10: Forgot Password - Email Enumeration Prevention

**User Story**: As a system, I want to prevent email enumeration by showing the same message for all email addresses.

**Preconditions**:

- User is on forgot password page
- System has security measures in place

**Test Steps**:

1. Navigate to forgot password page
2. Enter registered email address: "user@example.com"
3. Submit form
4. Verify success message
5. Enter non-existent email address: "nonexistent@example.com"
6. Submit form
7. Verify same success message appears
8. Verify no indication that email doesn't exist
9. Check email inbox for registered email
10. Verify no email sent for non-existent email

**Expected Results**:

- ✅ Same success message shown for all email addresses
- ✅ No indication whether email exists or not
- ✅ Email is only sent if account exists
- ✅ Response time is similar for both cases (prevents timing attacks)
- ✅ Security best practice is followed

**Test Data**:

- Registered email address
- Non-existent email address

**Priority**: High  
**Requirement Reference**: Phase 7 - Security

---

### Scenario 11: Reset Password - Happy Path

**User Story**: As a user, I want to reset my password using the link from my email so I can regain access to my account.

**Preconditions**:

- User has requested password reset
- User has received password reset email
- User has valid reset token

**Test Steps**:

1. Click password reset link from email
2. Verify redirect to reset password page with token
3. Verify reset password form is displayed
4. Enter new password: "NewSecurePassword123!"
5. Confirm new password: "NewSecurePassword123!"
6. Click "Reset Password" button
7. Verify loading state appears
8. Verify success message appears
9. Verify redirect to `/login?message=password-reset-success`
10. Verify success message on login page
11. Attempt to login with new password
12. Verify login succeeds

**Expected Results**:

- ✅ Reset password page loads with token from URL
- ✅ Form displays password and confirm password fields
- ✅ Password strength requirements are enforced
- ✅ Upon submission, user sees loading state
- ✅ Success message appears
- ✅ User is redirected to login page with success message
- ✅ Success message on login page: "Your password has been reset successfully. Please log in with your new password."
- ✅ User can login with new password
- ✅ Old password no longer works
- ✅ Reset token is invalidated after use

**Test Data**:

- Valid password reset token
- Strong new password
- Matching password confirmation

**Priority**: Critical  
**Requirement Reference**: Phase 7 - Reset Password

---

### Scenario 12: Reset Password - Validation Errors

**User Story**: As a user, I want clear validation errors when I submit invalid password reset data.

**Preconditions**:

- User is on reset password page with valid token

**Test Steps**:

1. Navigate to reset password page with token
2. Attempt to submit with empty password
3. Verify validation error
4. Enter weak password: "123"
5. Attempt to submit
6. Verify validation error
7. Enter password: "SecurePassword123!"
8. Enter mismatched confirm password: "DifferentPassword123!"
9. Attempt to submit
10. Verify validation error
11. Enter matching passwords
12. Submit successfully

**Expected Results**:

- ✅ Error message for empty password: "Password is required"
- ✅ Error message for weak password: "Password must meet requirements (min length, complexity)"
- ✅ Error message for mismatched passwords: "Passwords do not match"
- ✅ Error messages are clear and actionable
- ✅ Form prevents submission with invalid data
- ✅ User can proceed after entering valid matching passwords

**Test Data**:

- Empty password
- Weak passwords
- Mismatched passwords
- Valid matching passwords

**Priority**: High  
**Requirement Reference**: Phase 7 - Reset Password Validation

---

### Scenario 13: Reset Password - Invalid/Expired Token

**User Story**: As a user, I want clear error messages when my password reset token is invalid or expired.

**Preconditions**:

- User has password reset link
- Token may be invalid or expired

**Test Steps**:

1. Navigate to reset password page with invalid token
2. Verify error message appears
3. Attempt to submit new password
4. Verify submission is prevented
5. Navigate to reset password page with expired token
6. Verify error message appears
7. Request new password reset email
8. Use new token
9. Verify reset works with new token

**Expected Results**:

- ✅ Error message for invalid token: "Invalid or expired reset link. Please request a new password reset."
- ✅ Error message for expired token: "This reset link has expired. Please request a new password reset."
- ✅ Form is disabled or shows error state
- ✅ Link to request new reset email is provided
- ✅ User can request new reset email
- ✅ New token works correctly
- ✅ Old token is no longer valid

**Test Data**:

- Invalid reset token
- Expired reset token
- Valid reset token

**Priority**: High  
**Requirement Reference**: Phase 7 - Token Validation

---

### Scenario 14: Admin Login - Happy Path

**User Story**: As an admin, I want to log in with my admin credentials so I can access admin features.

**Preconditions**:

- Admin user exists with admin privileges
- Admin navigates to admin login page
- Admin has valid credentials

**Test Steps**:

1. Navigate to admin login page
2. Verify admin login form is displayed
3. Enter admin email: "admin@example.com"
4. Enter admin password: "AdminPassword123!"
5. Click "Sign In" button
6. Verify loading state appears
7. Verify success message or redirect occurs
8. Verify redirect to admin dashboard
9. Verify admin privileges are active
10. Verify admin can access admin-only features

**Expected Results**:

- ✅ Admin login form displays correctly
- ✅ Form accepts email and password
- ✅ Upon submission, user sees loading state
- ✅ Success message appears or redirect occurs
- ✅ Admin is redirected to admin dashboard
- ✅ Admin session is established
- ✅ Admin privileges are active
- ✅ Admin can access admin-only features
- ✅ Regular users cannot access admin login

**Test Data**:

- Valid admin email and password
- Admin user with proper privileges

**Priority**: Critical  
**Requirement Reference**: Phase 7 - Admin Login

---

### Scenario 15: Admin Login - Invalid Credentials

**User Story**: As a system, I want to prevent unauthorized access by rejecting invalid admin credentials.

**Preconditions**:

- User is on admin login page
- User may or may not be an admin

**Test Steps**:

1. Navigate to admin login page
2. Enter invalid email: "wrong@example.com"
3. Enter password: "WrongPassword123!"
4. Click "Sign In" button
5. Verify error message appears
6. Enter valid email but wrong password
7. Click "Sign In" button
8. Verify error message appears
9. Enter regular user email (non-admin)
10. Enter correct password
11. Click "Sign In" button
12. Verify error message appears

**Expected Results**:

- ✅ Error message for invalid credentials: "Invalid email or password"
- ✅ Error message for non-admin user: "You do not have admin privileges"
- ✅ Error messages are generic (don't reveal if email exists)
- ✅ Form prevents access with invalid credentials
- ✅ Admin session is not established
- ✅ User cannot access admin features

**Test Data**:

- Invalid email/password combinations
- Regular user credentials
- Admin credentials

**Priority**: High  
**Requirement Reference**: Phase 7 - Admin Login Security

---

### Scenario 16: Redirect Handling - Signup Flow

**User Story**: As a user, I want to be automatically redirected to the next step after completing each auth action.

**Preconditions**:

- User is completing signup flow
- API routes return redirect URLs

**Test Steps**:

1. Complete signup form
2. Submit signup
3. Verify redirect to `/verify-email?email=...`
4. Verify email is pre-filled in URL
5. Complete email verification
6. Verify redirect to `/join-code`
7. Complete join code
8. Verify redirect to `/onboarding`
9. Complete onboarding
10. Verify redirect to `/dashboard`

**Expected Results**:

- ✅ Redirects occur automatically after each step
- ✅ Redirect URLs are correct for each step
- ✅ Query parameters are preserved (e.g., email in verify-email URL)
- ✅ User cannot skip steps
- ✅ Redirects are smooth (no page flash)
- ✅ Browser history is maintained correctly
- ✅ Back button works appropriately

**Test Data**:

- Complete signup flow
- All redirect URLs

**Priority**: High  
**Requirement Reference**: Phase 7 - Redirect Handling

---

### Scenario 17: Redirect Handling - Password Reset Flow

**User Story**: As a user, I want to be redirected to login after successfully resetting my password.

**Preconditions**:

- User has reset password
- API route returns redirect URL

**Test Steps**:

1. Complete password reset form
2. Submit reset password
3. Verify redirect to `/login?message=password-reset-success`
4. Verify success message appears on login page
5. Verify message parameter is displayed correctly
6. Verify user can login with new password

**Expected Results**:

- ✅ Redirect occurs automatically after password reset
- ✅ Redirect URL includes success message parameter
- ✅ Success message is displayed on login page
- ✅ Message parameter is parsed and displayed correctly
- ✅ User can proceed to login
- ✅ Redirect is smooth (no page flash)

**Test Data**:

- Password reset completion
- Redirect URL with message parameter

**Priority**: High  
**Requirement Reference**: Phase 7 - Redirect Handling

---

### Scenario 18: React Query Caching and Updates

**User Story**: As a user, I want instant feedback and smooth navigation during auth flows.

**Preconditions**:

- User is completing auth flows
- React Query is configured

**Test Steps**:

1. Complete signup form
2. Submit signup
3. Verify optimistic update (if applicable)
4. Verify loading state during submission
5. Verify success state after completion
6. Navigate between auth pages
7. Verify cached data loads instantly (if applicable)
8. Verify background refetch works correctly

**Expected Results**:

- ✅ Loading states appear immediately on submission
- ✅ Optimistic updates provide instant feedback (if implemented)
- ✅ Success states appear after completion
- ✅ Navigation is smooth between auth pages
- ✅ Cached data loads instantly (if applicable)
- ✅ Background refetch ensures data freshness
- ✅ No flickering or loading states on cached data

**Test Data**:

- Complete auth flows
- Multiple page navigations

**Priority**: Medium  
**Requirement Reference**: Phase 7 - React Query Performance

---

### Scenario 19: Error Handling - Network Errors

**User Story**: As a user, I want clear error messages when network issues prevent auth actions.

**Preconditions**:

- User is on any auth page
- Network can be disconnected

**Test Steps**:

1. Navigate to signup page
2. Fill out signup form
3. Disconnect network
4. Submit form
5. Verify error message appears
6. Reconnect network
7. Submit form again
8. Verify submission succeeds

**Expected Results**:

- ✅ Network error message: "Network error. Please check your internet connection and try again."
- ✅ Error message is user-friendly
- ✅ User can retry after network is restored
- ✅ Form data is preserved (if possible)
- ✅ Error handling works for all auth actions

**Test Data**:

- Network disconnection
- Various auth actions

**Priority**: High  
**Requirement Reference**: Phase 7 - Error Handling

---

### Scenario 20: Error Handling - API Errors

**User Story**: As a user, I want clear error messages when API errors occur during auth actions.

**Preconditions**:

- User is completing auth actions
- Various API errors can occur

**Test Steps**:

1. **Signup with existing email**:
   - Enter existing email
   - Submit signup
   - Verify specific error message

2. **Invalid join code**:
   - Enter invalid join code
   - Submit
   - Verify error message

3. **Invalid reset token**:
   - Use invalid reset token
   - Submit reset
   - Verify error message

4. **Server error**:
   - Trigger server error (if possible)
   - Verify error message

**Expected Results**:

- ✅ Specific error messages for each error type
- ✅ Error messages are user-friendly (not technical)
- ✅ Error messages include actionable guidance
- ✅ All errors appear as toast notifications or inline messages
- ✅ Error toast duration is appropriate (5 seconds)
- ✅ User can retry after fixing issues

**Test Data**:

- Various error conditions
- Invalid data
- Server errors

**Priority**: High  
**Requirement Reference**: Phase 7 - Error Handling

---

### Scenario 21: Legal Document Tracking

**User Story**: As a system, I want to track legal document acceptances with IP and user agent for legal compliance.

**Preconditions**:

- User is completing signup or OAuth flow
- Legal documents need to be accepted

**Test Steps**:

1. Complete signup with legal document acceptance
2. Verify signup succeeds
3. Check database/logs for legal document acceptance records
4. Verify IP address is recorded
5. Verify user agent is recorded
6. Verify user ID is linked to acceptances
7. Verify document versions are recorded
8. Verify acceptance timestamps are accurate
9. Complete OAuth flow with legal document acceptance
10. Verify same tracking occurs

**Expected Results**:

- ✅ Legal document acceptances are recorded in database
- ✅ IP address is captured and stored
- ✅ User agent is captured and stored
- ✅ User ID is linked to each acceptance
- ✅ Document versions are recorded correctly
- ✅ Acceptance timestamps are accurate
- ✅ All required documents are tracked separately
- ✅ Tracking works for both email signup and OAuth flows

**Test Data**:

- Signup with legal documents
- OAuth flow with legal documents
- Valid IP address and user agent

**Priority**: Medium  
**Requirement Reference**: Phase 7 - Legal Document Tracking

---

### Scenario 22: User Status Transitions

**User Story**: As a system, I want user status to transition correctly through the auth flow.

**Preconditions**:

- User is completing auth flow
- User status changes at each step

**Test Steps**:

1. Complete signup
2. Verify user status is `pending_verification`
3. Verify user cannot access dashboard
4. Complete email verification
5. Verify user status is `email_verified`
6. Verify user cannot access dashboard
7. Complete join community
8. Verify user status is `incomplete_profile`
9. Verify user cannot access dashboard
10. Complete onboarding
11. Verify user status is `active`
12. Verify user can access dashboard

**Expected Results**:

- ✅ User status transitions correctly: `pending_verification` → `email_verified` → `incomplete_profile` → `active`
- ✅ Each status transition occurs at the correct step
- ✅ User cannot skip steps
- ✅ User cannot access dashboard until status is `active`
- ✅ Status transitions are recorded in database
- ✅ Middleware enforces status-based routing

**Test Data**:

- Complete auth flow
- User status at each step

**Priority**: Critical  
**Requirement Reference**: Phase 7 - User Status Transitions

---

### Scenario 23: Mobile Responsiveness

**User Story**: As a mobile user, I want auth functionality to work correctly on mobile devices.

**Preconditions**:

- User is on mobile device or mobile browser view
- User is completing auth flows

**Test Steps**:

1. Open app on mobile device
2. Navigate to signup page
3. Complete signup form on mobile
4. Verify form is usable on mobile
5. Navigate to login page
6. Complete login form on mobile
7. Navigate to forgot password page
8. Complete forgot password form on mobile
9. Navigate to reset password page
10. Complete reset password form on mobile
11. Verify all forms work correctly on mobile

**Expected Results**:

- ✅ All auth forms are mobile-responsive
- ✅ Forms fit within mobile screen without horizontal scrolling
- ✅ Input fields are appropriately sized for mobile
- ✅ Buttons are easily tappable (at least 44x44 pixels)
- ✅ Text is readable without zooming
- ✅ Keyboard types are appropriate (email, password, etc.)
- ✅ No UI elements are cut off or inaccessible
- ✅ Touch targets meet accessibility standards

**Test Data**:

- Mobile device (iOS/Android)
- Mobile browser view (Chrome DevTools)
- All auth forms

**Priority**: Medium  
**Requirement Reference**: Phase 7 - Mobile Support

---

### Scenario 24: Concurrent Auth Actions

**User Story**: As a system, I want to handle concurrent auth actions correctly to prevent conflicts.

**Preconditions**:

- User can attempt multiple auth actions simultaneously

**Test Steps**:

1. Open signup page in Tab 1
2. Open signup page in Tab 2
3. Submit signup in Tab 1 with email: "user1@example.com"
4. Submit signup in Tab 2 with same email: "user1@example.com"
5. Verify system handles correctly
6. Open reset password page with token in Tab 1
7. Open reset password page with same token in Tab 2
8. Submit reset in Tab 1
9. Attempt to submit reset in Tab 2
10. Verify system handles correctly

**Expected Results**:

- ✅ First action succeeds
- ✅ Second action shows appropriate error or updated state
- ✅ No duplicate accounts created
- ✅ No duplicate password resets
- ✅ Data remains consistent
- ✅ Error messages are clear when actions conflict
- ✅ No data corruption or inconsistent states

**Test Data**:

- Multiple browser tabs
- Same email addresses
- Same reset tokens

**Priority**: Low  
**Requirement Reference**: Phase 7 - Concurrency Handling

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test user accounts are created (regular users, admins)
- [ ] Test email service is configured and testable
- [ ] Test join codes are available
- [ ] API routes are deployed and functional
- [ ] React Query hooks are implemented and working
- [ ] Redirect handler utility is implemented
- [ ] Legal documents are available in system
- [ ] Better Auth is configured correctly

### Test Environment

- **Environment**: Staging/Production
- **Browser**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Database**: PostgreSQL with test data
- **Email**: Test email service (Resend, etc.)

### Test Execution

- [ ] Execute all test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios
- [ ] Test on multiple browsers
- [ ] Test on mobile devices
- [ ] Test email delivery
- [ ] Test redirect handling

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Sign off on feature acceptance
- [ ] Prepare test summary report
- [ ] Verify performance metrics meet targets
- [ ] Verify security measures are in place

## Acceptance Criteria Summary

The Phase 7 migration SHALL be considered accepted when:

1. ✅ Signup works correctly with API routes and React Query
2. ✅ Email verification and resend functionality works correctly
3. ✅ Join community flow works with redirect handling
4. ✅ Legal document acceptance (OAuth flow) works correctly
5. ✅ Forgot password and reset password flows work correctly
6. ✅ Admin login works with proper authorization
7. ✅ Redirect handling works correctly for all auth flows
8. ✅ React Query provides proper caching and updates
9. ✅ Error handling provides clear user feedback
10. ✅ All user status transitions work correctly
11. ✅ Legal document tracking works correctly
12. ✅ All auth functionality maintains existing behavior
13. ✅ Security measures are in place (rate limiting, email enumeration prevention)
14. ✅ Performance is acceptable with expected load
15. ✅ Mobile experience is functional and responsive

## Known Issues and Limitations

_To be filled during test execution_

## Test Sign-Off

- **Test Executor**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Business Stakeholder**: **\*\*\***\_**\*\*\*** Date: **\_\_\_**
- **Product Owner**: **\*\*\***\_**\*\*\*** Date: **\_\_\_**
- **Technical Lead**: **\*\*\***\_**\*\*\*** Date: **\_\_\_**

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Next Review**: After test execution
