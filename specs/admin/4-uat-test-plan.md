# Admin API Migration - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for Phase 9 of the Server Actions to API Routes Migration - Admin feature. UAT validates that the migration from server actions to API routes with React Query maintains all existing admin functionality including listing approval/rejection, legal document management, notifications, and error handling.

**Feature**: Admin API Route Migration  
**Phase**: Phase 9  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Migration Plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Test Plan: `specs/admin/4-test-plan.md`
- Listing Review UAT: `specs/listing-review/4-uat-test-plan.md`

## Test Objectives

1. Verify that admin API routes correctly process listing approval and rejection
2. Validate that legal document version deletion works correctly via API route
3. Confirm that React Query hooks provide proper loading states and error handling
4. Ensure that admin authentication is properly enforced in API routes
5. Verify that notifications are sent correctly after admin actions
6. Validate that cache invalidation works correctly after admin mutations
7. Confirm that the migration maintains backward compatibility with existing admin functionality
8. Verify that non-admin users cannot access admin API routes

## Test Scenarios

### Scenario 1: Approve Listing via API Route - Success Flow

**User Story**: As an admin, I want to approve a pending listing via the new API route so that it becomes visible to users.

**Preconditions**:

- Admin user is logged in
- At least one listing exists with `approvalStatus: pending_review`
- Admin is on Listing Review page
- API route `POST /api/admin/listings/[listingId]/approve` is implemented

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard → Listing Review page
3. Click on "Pending Review" tab
4. Select a pending listing to review
5. Click "Approve" button
6. Observe loading state on button
7. Wait for API response
8. Verify listing is removed from pending queue
9. Check that listing owner receives notification

**Expected Results**:

- ✅ Approve button shows loading state immediately ("Approving..." or spinner)
- ✅ Button is disabled during submission
- ✅ API call is made to `POST /api/admin/listings/[listingId]/approve`
- ✅ Request includes proper authentication headers
- ✅ API returns success response: `{ success: true }`
- ✅ Listing approval status is updated to `"approved"` in database
- ✅ Listing status is set to `"available"` if it was `"inactive"`
- ✅ `reviewedBy` and `reviewedAt` fields are set correctly
- ✅ Listing is removed from pending queue immediately
- ✅ Listing appears in Review History with "Approved" status
- ✅ Listing owner receives in-app notification
- ✅ Listing owner receives email notification
- ✅ React Query cache is invalidated (`["admin", "pending-reviews"]`, `["admin", "review-history"]`)
- ✅ Success toast notification appears
- ✅ No console errors occur

**Test Data**:

- Admin user account
- Pending listing with `approvalStatus: pending_review`
- Listing owner account for notification verification

**Priority**: Critical  
**Requirement Reference**: Phase 9.1, Phase 9.2

---

### Scenario 2: Reject Listing via API Route - Success Flow

**User Story**: As an admin, I want to reject a pending listing with a reason via the new API route so that the owner can fix issues.

**Preconditions**:

- Admin user is logged in
- At least one listing exists with `approvalStatus: pending_review`
- Admin is on Listing Review page
- API route `POST /api/admin/listings/[listingId]/reject` is implemented

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard → Listing Review page
3. Click on "Pending Review" tab
4. Select a pending listing to review
5. Click "Reject" button
6. Enter rejection reason: "Listing photos are unclear. Please upload higher quality images showing the tool from multiple angles."
7. Click "Confirm Rejection" or submit
8. Observe loading state
9. Wait for API response
10. Verify listing is removed from pending queue
11. Check that listing owner receives notification with reason

**Expected Results**:

- ✅ Reject button opens rejection dialog/form
- ✅ Rejection reason input is required
- ✅ Validation prevents submission with reason less than 10 characters
- ✅ Submit button shows loading state during submission
- ✅ API call is made to `POST /api/admin/listings/[listingId]/reject`
- ✅ Request body includes `{ rejectionReason: string }`
- ✅ API returns success response: `{ success: true }`
- ✅ Listing approval status is updated to `"rejected"` in database
- ✅ `rejectionReason`, `reviewedBy`, and `reviewedAt` fields are set correctly
- ✅ Listing is removed from pending queue immediately
- ✅ Listing appears in Review History with "Rejected" status and reason
- ✅ Listing owner receives in-app notification with rejection reason
- ✅ Listing owner receives email notification with rejection reason
- ✅ React Query cache is invalidated
- ✅ Success toast notification appears
- ✅ No console errors occur

**Test Data**:

- Admin user account
- Pending listing with `approvalStatus: pending_review`
- Valid rejection reason (minimum 10 characters)
- Listing owner account for notification verification

**Priority**: Critical  
**Requirement Reference**: Phase 9.1, Phase 9.2

---

### Scenario 3: Delete Legal Document Version via API Route - Success Flow

**User Story**: As an admin, I want to delete an old legal document version via the new API route so I can manage document history.

**Preconditions**:

- Admin user is logged in
- Legal document has multiple versions (at least 2)
- Current version is NOT the one being deleted
- Admin is on Legal Documents management page
- API route `DELETE /api/admin/legal-documents/[documentId]/[version]` is implemented

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard → Legal Documents page
3. Select a legal document (e.g., Terms of Service)
4. View document history/versions
5. Select a non-current version to delete
6. Click "Delete" button on version
7. Confirm deletion in dialog
8. Observe loading state
9. Wait for API response
10. Verify version is removed from history

**Expected Results**:

- ✅ Delete button is visible for non-current versions
- ✅ Delete button opens confirmation dialog
- ✅ Confirmation dialog shows version number and warning
- ✅ Submit button shows loading state during deletion
- ✅ API call is made to `DELETE /api/admin/legal-documents/[documentId]/[version]`
- ✅ Request includes document ID and version in URL path
- ✅ API returns success response: `{ success: true }`
- ✅ Version is deleted from database
- ✅ Version file is deleted from blob storage
- ✅ Version is removed from history list immediately
- ✅ Success toast notification appears
- ✅ No console errors occur

**Test Data**:

- Admin user account
- Legal document with multiple versions
- Non-current version to delete
- Current version (should not be deletable)

**Priority**: High  
**Requirement Reference**: Phase 9.1, Phase 9.2

---

### Scenario 4: Admin Authentication Enforcement - Unauthorized Access

**User Story**: As a system, I want to prevent non-admin users from accessing admin API routes.

**Preconditions**:

- Regular user (non-admin) is logged in
- Admin API routes are implemented
- User attempts to access admin functionality

**Test Steps**:

1. Log in as regular user (non-admin)
2. Attempt to navigate to admin dashboard (should be blocked)
3. If able to access, attempt to approve a listing
4. Alternatively, make direct API call to `POST /api/admin/listings/[listingId]/approve` without admin privileges
5. Observe error response

**Expected Results**:

- ✅ Non-admin users cannot access admin dashboard (redirected or blocked)
- ✅ Direct API call to admin routes without admin privileges returns 401 Unauthorized or 403 Forbidden
- ✅ Error response: `{ error: "Admin privileges required" }` or similar
- ✅ No admin actions are executed
- ✅ No data is modified
- ✅ User receives appropriate error message

**Test Data**:

- Regular user account (non-admin)
- Admin API route endpoints
- Test listing ID

**Priority**: Critical  
**Requirement Reference**: Phase 9.1

---

### Scenario 5: Approve Listing - Validation Error (Already Reviewed)

**User Story**: As a system, I want to prevent approving a listing that has already been reviewed.

**Preconditions**:

- Admin user is logged in
- Listing exists with `approvalStatus: approved` or `"rejected"` (not pending)
- Admin attempts to approve already-reviewed listing

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard → Listing Review page
3. Find a listing that is already approved or rejected
4. Attempt to approve the listing (if UI allows)
5. Alternatively, make direct API call to approve an already-reviewed listing
6. Observe error response

**Expected Results**:

- ✅ API call to approve already-reviewed listing returns error
- ✅ Error response: `{ error: "Listing has already been reviewed" }` or similar
- ✅ HTTP status code: 400 Bad Request
- ✅ Listing status is not changed
- ✅ Error toast notification appears
- ✅ No notifications are sent
- ✅ User receives clear error message

**Test Data**:

- Admin user account
- Listing with `approvalStatus: approved`
- Listing with `approvalStatus: rejected`

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

### Scenario 6: Reject Listing - Validation Error (Missing Reason)

**User Story**: As a system, I want to require a rejection reason when rejecting a listing.

**Preconditions**:

- Admin user is logged in
- Pending listing exists
- Admin attempts to reject without providing reason

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard → Listing Review page
3. Select a pending listing
4. Click "Reject" button
5. Attempt to submit without entering rejection reason
6. Observe validation error
7. Enter rejection reason less than 10 characters
8. Attempt to submit
9. Observe validation error

**Expected Results**:

- ✅ Form validation prevents submission without rejection reason
- ✅ Form validation prevents submission with reason less than 10 characters
- ✅ Validation error messages are clear:
  - "Rejection reason is required"
  - "Rejection reason must be at least 10 characters"
- ✅ API call is not made until validation passes
- ✅ User can correct the error and retry

**Test Data**:

- Admin user account
- Pending listing
- Empty rejection reason
- Rejection reason with 5 characters (too short)

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

### Scenario 7: Delete Legal Document Version - Validation Error (Current Version)

**User Story**: As a system, I want to prevent deletion of the current legal document version.

**Preconditions**:

- Admin user is logged in
- Legal document has a current version
- Admin attempts to delete the current version

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard → Legal Documents page
3. Select a legal document
4. View document history
5. Attempt to delete the current version
6. Observe error response

**Expected Results**:

- ✅ Delete button is disabled or hidden for current version
- ✅ If API call is made, it returns error: `{ error: "Cannot delete the current version. Upload a new version first." }`
- ✅ HTTP status code: 400 Bad Request
- ✅ Current version is not deleted
- ✅ Error toast notification appears
- ✅ User receives clear error message

**Test Data**:

- Admin user account
- Legal document with current version
- Current version number

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

### Scenario 8: React Query Loading States - Approve Listing

**User Story**: As an admin, I want to see immediate feedback when I approve a listing so I know the system is processing my request.

**Preconditions**:

- Admin user is logged in
- Pending listing exists
- React Query hook `useApproveListing()` is implemented
- Admin is on Listing Review page

**Test Steps**:

1. Navigate to Listing Review page
2. Select a pending listing
3. Click "Approve" button
4. Observe loading states immediately
5. Wait for API response
6. Observe success state

**Expected Results**:

- ✅ Approve button shows loading state immediately on click
- ✅ Button text changes to "Approving..." or shows spinner
- ✅ Button is disabled during submission
- ✅ Dialog/form is disabled during submission (if applicable)
- ✅ Loading indicator is visible and clear
- ✅ No flickering or delayed loading state
- ✅ After success, UI updates smoothly
- ✅ React Query mutation state is properly managed

**Test Data**:

- Admin user account
- Pending listing
- Normal network conditions

**Priority**: High  
**Requirement Reference**: Phase 9.2

---

### Scenario 9: React Query Error Handling with Toast Notifications

**User Story**: As an admin, I want to see clear error notifications when admin actions fail so I understand what went wrong.

**Preconditions**:

- Admin user is logged in
- Admin attempts to perform an action that fails
- Toast notification system is configured

**Test Steps**:

1. Log in as admin user
2. Attempt to approve a listing that doesn't exist (invalid ID)
3. Observe error handling
4. Attempt to reject a listing without reason
5. Observe error handling
6. Attempt to delete a non-existent document version
7. Observe error handling

**Expected Results**:

- ✅ Error is caught by React Query mutation
- ✅ Toast notification appears with error message:
  - Title: "Error" or "Action Failed"
  - Description: User-friendly error message
  - Variant: "destructive" (red styling)
- ✅ Toast is dismissible
- ✅ Error message is clear and actionable
- ✅ Admin can retry after seeing error
- ✅ No technical error details are exposed

**Test Data**:

- Admin user account
- Invalid listing ID
- Missing rejection reason
- Invalid document version

**Priority**: High  
**Requirement Reference**: Phase 9.2

---

### Scenario 10: React Query Cache Invalidation After Admin Actions

**User Story**: As a system, I want to invalidate admin queries after admin actions so the UI shows updated data immediately.

**Preconditions**:

- Admin user is logged in
- Admin queries are cached in React Query
- Admin performs an action (approve/reject/delete)

**Test Steps**:

1. Navigate to Listing Review page
2. Verify pending listings are displayed (cached)
3. Approve a listing
4. Wait for success
5. Verify pending queue updates immediately
6. Navigate to Review History tab
7. Verify history shows updated data
8. Navigate to Legal Documents page
9. Delete a document version
10. Verify version list updates immediately

**Expected Results**:

- ✅ React Query invalidates `["admin", "pending-reviews"]` queries on approve/reject
- ✅ React Query invalidates `["admin", "review-history"]` queries on approve/reject
- ✅ React Query invalidates `["admin", "pending-review-count"]` queries on approve/reject
- ✅ React Query invalidates legal document queries on delete
- ✅ Pending queue updates immediately after action
- ✅ Review history updates immediately after action
- ✅ Document version list updates immediately after delete
- ✅ No stale data is displayed
- ✅ Cache invalidation happens automatically

**Test Data**:

- Admin user account
- Cached admin queries
- Pending listings
- Document versions

**Priority**: High  
**Requirement Reference**: Phase 9.2

---

### Scenario 11: Notification Delivery - Listing Approval

**User Story**: As a listing owner, I want to be notified when my listing is approved so I know it's now live.

**Preconditions**:

- Admin user is logged in
- Listing owner account exists
- Pending listing exists
- Notification system is functional

**Test Steps**:

1. Log in as admin user
2. Navigate to Listing Review page
3. Approve a pending listing
4. Wait for approval to complete
5. Log in as listing owner (separate browser/session)
6. Check in-app notifications
7. Check email inbox for approval notification

**Expected Results**:

- ✅ In-app notification is created immediately upon approval
- ✅ Email notification is sent to owner's email address
- ✅ Notification includes listing name
- ✅ Notification includes clear approval message
- ✅ Notification includes link to Garage page
- ✅ Email subject line is clear and informative
- ✅ Email content is well-formatted (HTML and plain text)
- ✅ Notification link navigates to correct location
- ✅ Owner can see listing in "Active" tab after approval

**Test Data**:

- Admin user account
- Listing owner account with valid email
- Pending listing ready for approval

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

### Scenario 12: Notification Delivery - Listing Rejection

**User Story**: As a listing owner, I want to be notified when my listing is rejected with a clear reason so I can fix the issues.

**Preconditions**:

- Admin user is logged in
- Listing owner account exists
- Pending listing exists
- Notification system is functional

**Test Steps**:

1. Log in as admin user
2. Navigate to Listing Review page
3. Reject a pending listing with reason: "Photos need improvement. Please upload clear, well-lit images showing all angles of the tool."
4. Wait for rejection to complete
5. Log in as listing owner (separate browser/session)
6. Check in-app notifications
7. Check email inbox for rejection notification

**Expected Results**:

- ✅ In-app notification is created immediately upon rejection
- ✅ Email notification is sent to owner's email address
- ✅ Notification includes listing name
- ✅ Notification includes clear rejection message
- ✅ Notification includes the rejection reason
- ✅ Email subject line indicates action needed
- ✅ Email content includes rejection reason clearly
- ✅ Email content is well-formatted (HTML and plain text)
- ✅ Notification link navigates to correct location
- ✅ Owner can see rejected listing in "Pending Review" tab with reason

**Test Data**:

- Admin user account
- Listing owner account with valid email
- Pending listing ready for rejection
- Valid rejection reason (minimum 10 characters)

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

### Scenario 13: Concurrent Admin Actions Prevention

**User Story**: As a system, I want to prevent two admins from reviewing the same listing simultaneously to avoid conflicts.

**Preconditions**:

- At least two admin users exist
- At least one listing in pending_review status
- Both admins have access to Listing Review page

**Test Steps**:

1. Admin User A logs in and navigates to Listing Review page
2. Admin User B logs in (separate browser/session) and navigates to Listing Review page
3. Both admins view the same pending listing
4. Admin User A clicks "Approve" and completes the action
5. Admin User B attempts to approve/reject the same listing
6. Observe behavior

**Expected Results**:

- ✅ First admin's action (approve/reject) succeeds
- ✅ Second admin sees updated state (listing no longer pending)
- ✅ Second admin receives appropriate feedback (error message or updated UI)
- ✅ Listing is only reviewed once
- ✅ Review metadata (reviewedBy, reviewedAt) reflects the first admin's action
- ✅ No duplicate approvals or conflicting states occur
- ✅ Optimistic locking prevents race conditions

**Test Data**:

- Two admin user accounts
- One pending listing
- Two separate browser sessions or devices

**Priority**: Medium  
**Requirement Reference**: Phase 9.1

---

### Scenario 14: Form Submission with React Query Mutation (Not Server Actions)

**User Story**: As a developer, I want to verify that admin components use React Query mutations instead of server actions.

**Preconditions**:

- Admin user is logged in
- Components have been migrated to use React Query
- Admin is on Listing Review or Legal Documents page

**Test Steps**:

1. Open browser developer tools
2. Navigate to Listing Review page
3. Inspect approve/reject button handlers
4. Approve a listing
5. Observe network requests
6. Check React Query DevTools (if available)
7. Navigate to Legal Documents page
8. Delete a document version
9. Observe network requests

**Expected Results**:

- ✅ Components do NOT use server actions (`useActionState` or direct server action calls)
- ✅ Components use React Query hooks: `useApproveListing()`, `useRejectListing()`, `useDeleteDocumentVersion()`
- ✅ Form submissions make HTTP requests to API routes:
  - `POST /api/admin/listings/[listingId]/approve`
  - `POST /api/admin/listings/[listingId]/reject`
  - `DELETE /api/admin/legal-documents/[documentId]/[version]`
- ✅ Requests include proper headers and authentication
- ✅ React Query DevTools shows mutations in progress
- ✅ Mutation state is tracked correctly (loading, success, error)
- ✅ No server action calls are made

**Test Data**:

- Admin user account
- Browser developer tools open
- React Query DevTools enabled (optional)
- Pending listings
- Document versions

**Priority**: High  
**Requirement Reference**: Phase 9.2, Phase 9.3

---

### Scenario 15: API Route Response Format Validation

**User Story**: As a developer, I want to verify that admin API routes return consistent response formats for success and error cases.

**Preconditions**:

- Admin API routes are implemented
- Admin user is logged in

**Test Steps**:

1. Make successful API call to approve listing
2. Inspect response format
3. Make API call with invalid data (already reviewed listing)
4. Inspect error response format
5. Make API call without authentication
6. Inspect unauthorized response format
7. Make successful API call to reject listing
8. Inspect response format
9. Make successful API call to delete document version
10. Inspect response format

**Expected Results**:

- ✅ Success response format: `{ success: true }`
- ✅ Error response format: `{ error: "Error message" }` or `{ success: false, error: "Error message" }`
- ✅ Validation error format: `{ error: "Validation failed", details?: ValidationError }`
- ✅ Unauthorized response: `{ error: "Admin privileges required" }` with 401/403 status
- ✅ All responses are valid JSON
- ✅ HTTP status codes are correct:
  - 200 for success
  - 400 for validation errors
  - 401/403 for authorization errors
  - 404 for not found
  - 500 for server errors

**Test Data**:

- Valid admin actions (success cases)
- Invalid data (validation errors)
- No authentication (unauthorized)
- Non-existent resources (not found)

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

### Scenario 16: Network Error Handling

**User Story**: As an admin, I want to see a clear error message if my network connection fails during admin actions.

**Preconditions**:

- Admin user is logged in
- Admin is on Listing Review or Legal Documents page
- Network connection is unstable or fails

**Test Steps**:

1. Navigate to Listing Review page
2. Select a pending listing
3. Disconnect network or simulate network failure
4. Click "Approve" button
5. Observe error handling
6. Reconnect network
7. Retry the action

**Expected Results**:

- ✅ Network error is caught and handled
- ✅ User-friendly error message is displayed:
  - "Network error. Please check your connection and try again."
- ✅ Error toast notification appears
- ✅ Admin can retry action after reconnecting
- ✅ No data is partially updated
- ✅ No technical error details are exposed

**Test Data**:

- Admin user account
- Pending listing
- Simulated network failure
- Actual network disconnection

**Priority**: Medium  
**Requirement Reference**: Phase 9.2

---

### Scenario 17: Server Error Handling (500 Errors)

**User Story**: As an admin, I want to see a helpful error message if the server encounters an unexpected error during admin actions.

**Preconditions**:

- Admin user is logged in
- Admin is on Listing Review or Legal Documents page
- Server error occurs (database down, service unavailable)

**Test Steps**:

1. Navigate to Listing Review page
2. Select a pending listing
3. Simulate server error (or wait for actual error)
4. Click "Approve" button
5. Observe error handling

**Expected Results**:

- ✅ Server error (500) is caught and handled
- ✅ User-friendly error message is displayed:
  - "Something went wrong. Please try again later."
- ✅ Error toast notification appears
- ✅ Admin can retry action
- ✅ Error is logged on server for debugging
- ✅ No technical error details are exposed to admin

**Test Data**:

- Admin user account
- Pending listing
- Simulated server error
- Actual server error

**Priority**: High  
**Requirement Reference**: Phase 9.1, Phase 9.2

---

### Scenario 18: Migration Backward Compatibility

**User Story**: As an admin, I want the admin functionality to work exactly as before the migration, with no breaking changes.

**Preconditions**:

- Migration has been completed
- Admin user is logged in
- Admin is on admin dashboard

**Test Steps**:

1. Navigate to Listing Review page
2. Verify all functionality is present and functional
3. Approve a listing exactly as before migration
4. Reject a listing exactly as before migration
5. Navigate to Legal Documents page
6. Delete a document version exactly as before migration
7. Compare behavior with pre-migration version

**Expected Results**:

- ✅ All admin functionality is present and functional
- ✅ Approval flow works identically to pre-migration
- ✅ Rejection flow works identically to pre-migration
- ✅ Document deletion flow works identically to pre-migration
- ✅ Error messages are identical or improved
- ✅ Success flow works identically
- ✅ Notification delivery works identically
- ✅ User experience is identical or improved
- ✅ No breaking changes in functionality
- ✅ Performance is equal or better

**Test Data**:

- Same test data as pre-migration tests
- Comparison with pre-migration behavior

**Priority**: Critical  
**Requirement Reference**: Phase 9.3

---

### Scenario 19: Delete Legal Document Version - Blob Storage Cleanup

**User Story**: As a system, I want to ensure that document files are deleted from blob storage when a version is deleted.

**Preconditions**:

- Admin user is logged in
- Legal document version exists with blob storage file
- Admin deletes the version

**Test Steps**:

1. Log in as admin user
2. Navigate to Legal Documents page
3. Select a legal document with versions
4. Note the blob storage URL/pathname for a non-current version
5. Delete the version
6. Wait for deletion to complete
7. Verify blob storage file is deleted (check blob storage directly or via API)

**Expected Results**:

- ✅ Version is deleted from database
- ✅ Blob storage file is deleted successfully
- ✅ File is no longer accessible via URL
- ✅ If blob deletion fails, database deletion still succeeds (non-blocking)
- ✅ Warning is logged if blob deletion fails
- ✅ Version is removed from UI immediately

**Test Data**:

- Admin user account
- Legal document version with blob storage file
- Blob storage pathname/URL

**Priority**: Medium  
**Requirement Reference**: Phase 9.1

---

### Scenario 20: Approve Listing - Status Update Logic

**User Story**: As a system, I want to ensure that approved listings have the correct status based on their previous status.

**Preconditions**:

- Admin user is logged in
- Listings exist with different statuses:
  - Listing A: `status: "inactive"`, `approvalStatus: "pending_review"`
  - Listing B: `status: "maintenance"`, `approvalStatus: "pending_review"`
- Admin approves both listings

**Test Steps**:

1. Log in as admin user
2. Navigate to Listing Review page
3. Approve Listing A (status: "inactive")
4. Verify status after approval
5. Approve Listing B (status: "maintenance")
6. Verify status after approval

**Expected Results**:

- ✅ Listing A: Status changes from `"inactive"` to `"available"` upon approval
- ✅ Listing B: Status remains `"maintenance"` (not changed to "available")
- ✅ Approval status is set to `"approved"` for both
- ✅ `reviewedBy` and `reviewedAt` are set correctly
- ✅ Listings appear in owner's "Active" tab if status is "available"

**Test Data**:

- Admin user account
- Listing with `status: "inactive"`, `approvalStatus: "pending_review"`
- Listing with `status: "maintenance"`, `approvalStatus: "pending_review"`

**Priority**: High  
**Requirement Reference**: Phase 9.1

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] API routes are deployed and functional:
  - `POST /api/admin/listings/[listingId]/approve`
  - `POST /api/admin/listings/[listingId]/reject`
  - `DELETE /api/admin/legal-documents/[documentId]/[version]`
- [ ] React Query hooks are implemented:
  - `useApproveListing()`
  - `useRejectListing()`
  - `useDeleteDocumentVersion()`
- [ ] Admin components are migrated to use React Query
- [ ] Test admin user accounts are created
- [ ] Test listings with various approval statuses are created
- [ ] Test legal documents with multiple versions are created
- [ ] Database is set up with test data
- [ ] Toast notification system is configured
- [ ] Email service is configured and testable
- [ ] Notification system is functional
- [ ] React Query DevTools is available (optional)

### Test Environment

- **Environment**: Staging/Production
- **Browser**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Database**: PostgreSQL with test data
- **Network**: Normal and simulated failure conditions

### Test Execution

- [ ] Execute all test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios
- [ ] Test on multiple browsers and devices
- [ ] Test with various network conditions
- [ ] Test concurrent admin actions

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Sign off on migration acceptance
- [ ] Prepare test summary report
- [ ] Update migration plan with completion status

## Acceptance Criteria Summary

The migration SHALL be considered accepted when:

1. ✅ Admin API routes are functional and return correct responses
2. ✅ React Query hooks provide proper loading states and error handling
3. ✅ Admin authentication is properly enforced in API routes
4. ✅ Listing approval and rejection work correctly via API routes
5. ✅ Legal document version deletion works correctly via API route
6. ✅ Notifications are sent correctly after admin actions
7. ✅ Cache invalidation works correctly after admin mutations
8. ✅ Form submissions use React Query mutations instead of server actions
9. ✅ Error handling with toast notifications works correctly
10. ✅ Network and server errors are handled gracefully
11. ✅ All existing admin functionality is maintained (backward compatible)
12. ✅ Non-admin users cannot access admin API routes
13. ✅ Concurrent admin actions are handled correctly
14. ✅ Performance is equal or better than pre-migration

## Known Issues and Limitations

_To be filled during test execution_

## Test Sign-Off

- **Test Executor**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Business Stakeholder**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Product Owner**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Technical Lead**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Next Review**: After test execution
