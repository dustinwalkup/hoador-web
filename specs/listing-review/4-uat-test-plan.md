# Listing Review - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Listing Review feature. UAT validates that the feature meets business requirements and works as expected from an end-user perspective. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Listing Review Process  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Requirements: `specs/listing-review/1-requirements.md`
- Design: `specs/listing-review/2-design.md`
- Implementation Tasks: `specs/listing-review/3-tasks.md`

## Test Objectives

1. Verify that new listings require admin approval before appearing in public search
2. Validate that admins can efficiently review pending listings with full context
3. Confirm that listing owners receive timely notifications when listings are approved or rejected
4. Ensure that listing owners can see approval status and take action on rejected listings
5. Verify that significant edits trigger re-review process
6. Validate that existing listings continue to function normally (grandfathered as approved)

## Test Scenarios

### Scenario 1: New Listing Creation and Initial Status

**User Story**: As a listing owner, I want to create a new listing and understand that it requires admin review before being published.

**Preconditions**:

- User is logged in and authenticated
- User has completed onboarding (if required)
- User is on the listing creation form

**Test Steps**:

1. Navigate to listing creation form (`/dashboard/listings/add`)
2. Fill out the listing form with valid data:
   - Name: "Professional Power Drill"
   - Description: "Heavy-duty power drill for construction work"
   - Category: Power Tools
   - Condition: Excellent
   - Daily Rate: $25.00
   - Upload at least one image
3. Review the informational notice about admin review
4. Submit the listing form

**Expected Results**:

- ✅ Listing form displays an informational notice/alert near the submit button stating: "Your listing will be reviewed by an admin before being published. You'll receive a notification once it's approved."
- ✅ Listing is created successfully and user is redirected to Garage page
- ✅ Listing appears in the "Pending Review" tab of the Garage page
- ✅ Listing shows "Pending Review" status badge
- ✅ Listing is NOT visible in public search results or explore pages
- ✅ Listing is NOT visible in "Active" or "Inactive" tabs until approved

**Test Data**:

- Valid listing name, description, pricing, images
- Complete form data meeting all validation requirements

**Priority**: High  
**Requirement Reference**: Req 1.3, Req 3.8, Req 4.1, Req 4.5

---

### Scenario 2: Admin Reviews Pending Listing - Approval Flow

**User Story**: As an admin, I want to review pending listings and approve them so that quality listings are published to the platform.

**Preconditions**:

- Admin user is logged in
- At least one listing exists with `approvalStatus: pending_review`
- Admin navigates to Listing Review page

**Test Steps**:

1. Log in as admin user
2. Navigate to admin dashboard
3. Click on "Listing Review" in the admin sidebar
4. Verify the pending review count badge shows the correct number
5. Click on "Pending Review" tab
6. Verify pending listings are displayed, ordered by creation date (oldest first)
7. Click on a pending listing to view details
8. Review listing information:
   - Listing details (name, description, category, condition, pricing)
   - All listing images in order
   - Owner profile information (name, email, verification status, join date)
   - Owner's other listings count
   - Owner's rental history (total rentals, average rating)
9. Click "Approve" button
10. Confirm the approval action (if confirmation dialog appears)
11. Verify the listing is removed from pending queue
12. Navigate to Review History tab
13. Verify the listing appears in history with "Approved" status

**Expected Results**:

- ✅ Admin can access Listing Review page (non-admins cannot)
- ✅ Pending review count badge displays correct number in sidebar
- ✅ Pending listings are displayed with all required context information
- ✅ Listings are ordered by creation date (oldest first)
- ✅ Approve button is visible and functional
- ✅ Upon approval, listing is removed from pending queue immediately
- ✅ Listing appears in Review History with correct metadata (reviewer, timestamp)
- ✅ Listing owner receives in-app notification about approval
- ✅ Listing owner receives email notification about approval
- ✅ Listing becomes visible in public search results
- ✅ Listing appears in owner's "Active" tab in Garage (if status is "available")

**Test Data**:

- At least 1-2 pending listings with complete information
- Admin user with proper permissions
- Owner user account for notification verification

**Priority**: Critical  
**Requirement Reference**: Req 2.1, Req 2.2, Req 2.5, Req 2.9, Req 7.1, Req 7.2

---

### Scenario 3: Admin Reviews Pending Listing - Rejection Flow

**User Story**: As an admin, I want to reject listings that don't meet quality standards and provide clear feedback to the owner.

**Preconditions**:

- Admin user is logged in
- At least one listing exists with `approvalStatus: pending_review`
- Admin is on the Listing Review page viewing a pending listing

**Test Steps**:

1. Log in as admin user
2. Navigate to Listing Review page
3. Click on "Pending Review" tab
4. Click on a pending listing to view details
5. Review listing information
6. Click "Reject" button
7. Verify rejection dialog/form appears
8. Enter rejection reason: "Listing photos are unclear. Please upload higher quality images showing the tool from multiple angles."
9. Attempt to submit with reason less than 10 characters (should fail)
10. Enter valid rejection reason (minimum 10 characters)
11. Submit rejection
12. Verify listing is removed from pending queue
13. Navigate to Review History tab
14. Verify listing appears in history with "Rejected" status and reason
15. Log in as listing owner
16. Navigate to Garage page
17. Click on "Pending Review" tab
18. Verify rejected listing appears with rejection reason displayed

**Expected Results**:

- ✅ Reject button is visible and functional
- ✅ Rejection dialog requires a rejection reason
- ✅ Validation prevents submission with reason less than 10 characters
- ✅ Validation prevents submission with empty/whitespace-only reason
- ✅ Upon rejection, listing is removed from pending queue
- ✅ Listing appears in Review History with rejection reason
- ✅ Listing owner receives in-app notification with rejection reason
- ✅ Listing owner receives email notification with rejection reason
- ✅ Listing remains hidden from public search
- ✅ Rejected listing appears in owner's "Pending Review" tab
- ✅ Rejection reason is clearly displayed to the owner
- ✅ Owner can see rejection reason and take action (edit or delete)

**Test Data**:

- Pending listing that doesn't meet quality standards
- Valid rejection reason (minimum 10 characters)
- Invalid rejection reason (less than 10 characters or empty)

**Priority**: Critical  
**Requirement Reference**: Req 2.10, Req 6.1, Req 7.3, Req 7.4, Req 4.4

---

### Scenario 4: Listing Owner Views Pending Review Status

**User Story**: As a listing owner, I want to see which of my listings are pending review so I know when they'll be published.

**Preconditions**:

- User has at least one listing with `approvalStatus: pending_review`
- User is logged in and navigates to Garage page

**Test Steps**:

1. Log in as listing owner
2. Navigate to Garage page (`/dashboard/garage`)
3. Verify "Pending Review" tab is visible in the tab list
4. Click on "Pending Review" tab
5. Verify pending listings are displayed
6. Verify each listing shows "Pending Review" status badge
7. Verify listings are ordered by creation date (most recent first)
8. Verify listing cards show:
   - Listing name and image
   - Approval status badge
   - Price information
   - Edit and Manage buttons are functional
9. Navigate to main Dashboard page
10. Verify pending listings count widget appears (if count > 0)
11. Click on widget link to navigate to Garage Pending Review tab

**Expected Results**:

- ✅ "Pending Review" tab is visible in Garage page tabs
- ✅ Tab shows badge count if there are pending listings
- ✅ Pending listings are displayed in the tab
- ✅ Each listing shows "Pending Review" status badge with appropriate styling (yellow/amber)
- ✅ Listings are ordered correctly (newest first for user's own listings)
- ✅ Listing cards are functional and allow edit/manage actions
- ✅ Dashboard widget displays when user has pending listings
- ✅ Dashboard widget shows correct count
- ✅ Widget link navigates to correct tab

**Test Data**:

- User with 1-3 pending listings
- User with no pending listings (to test empty state)
- User with both pending and approved listings

**Priority**: High  
**Requirement Reference**: Req 4.1, Req 4.2, Req 4.5, Req 4.6, Req 4.7

---

### Scenario 5: Listing Owner Views Rejected Listing and Reason

**User Story**: As a listing owner, I want to see why my listing was rejected so I can fix the issues and resubmit.

**Preconditions**:

- User has at least one listing with `approvalStatus: rejected`
- User has received rejection notification
- User is logged in

**Test Steps**:

1. Log in as listing owner
2. Navigate to Garage page
3. Click on "Pending Review" tab
4. Verify rejected listing appears in the list
5. Verify rejected listing shows "Rejected" status badge (red styling)
6. Verify rejection reason is displayed below the listing card or in a visible location
7. Verify rejection reason text is clearly readable and properly formatted
8. Verify listing card allows edit action
9. Verify listing card allows delete action
10. Click on notification bell (if available)
11. Verify rejection notification is visible with rejection reason

**Expected Results**:

- ✅ Rejected listing appears in "Pending Review" tab
- ✅ Listing shows "Rejected" status badge with red styling and X icon
- ✅ Rejection reason is prominently displayed and easy to read
- ✅ Rejection reason is properly formatted (no HTML tags visible, proper line breaks)
- ✅ Edit button is functional and allows owner to modify listing
- ✅ Delete button is functional and allows owner to remove listing
- ✅ Rejection notification is visible in notifications with reason included
- ✅ Listing remains hidden from public search

**Test Data**:

- Listing with `approvalStatus: rejected`
- Rejection reason with reasonable length (20-200 characters)
- Listing owner account

**Priority**: High  
**Requirement Reference**: Req 4.4, Req 4.8, Req 6.1, Req 6.2

---

### Scenario 6: Owner Edits Rejected Listing and Resubmits

**User Story**: As a listing owner, I want to fix issues in my rejected listing and resubmit it for review.

**Preconditions**:

- User has a rejected listing
- User is logged in and viewing the rejected listing in Garage

**Test Steps**:

1. Log in as listing owner
2. Navigate to Garage page → "Pending Review" tab
3. Find rejected listing with rejection reason visible
4. Click "Edit" button on rejected listing
5. Make changes based on rejection reason (e.g., upload better quality images)
6. Update listing name or description (significant change)
7. Save the changes
8. Navigate back to Garage page → "Pending Review" tab
9. Verify listing status changed from "Rejected" to "Pending Review"
10. Verify rejection reason is cleared/removed
11. Verify listing appears in pending review queue (if admin view accessible)

**Expected Results**:

- ✅ Edit functionality works on rejected listings
- ✅ Owner can modify listing based on rejection feedback
- ✅ After saving changes, listing status changes to "Pending Review"
- ✅ Rejection reason is cleared after edit and resubmission
- ✅ Listing appears in admin's pending review queue again
- ✅ Listing shows "Pending Review" badge instead of "Rejected"
- ✅ Owner can see updated status immediately

**Test Data**:

- Rejected listing with known issues
- Rejection reason providing actionable feedback
- Owner account with edit permissions

**Priority**: High  
**Requirement Reference**: Req 6.3, Req 6.5, Req 6.6

---

### Scenario 7: Significant Edit Triggers Re-Review on Approved Listing

**User Story**: As a system, I want to ensure significant changes to approved listings require re-review to maintain content quality.

**Preconditions**:

- User has an approved listing visible in public search
- User is logged in and viewing the approved listing

**Test Steps**:

1. Log in as listing owner
2. Navigate to Garage page → "Active" tab
3. Find an approved listing (should have "Approved" badge or no badge)
4. Verify listing is visible in public search (check Explore page as non-owner)
5. Click "Edit" on the approved listing
6. Make a significant change:
   - Change listing name from "Power Drill" to "Heavy-Duty Industrial Power Drill"
7. Save the changes
8. Navigate back to Garage page
9. Verify listing moves from "Active" to "Pending Review" tab
10. Verify listing shows "Pending Review" status badge
11. Verify listing is no longer visible in public search
12. As admin, verify listing appears in pending review queue

**Test Cases for Significant Changes**:

- ✅ Change listing name
- ✅ Change description
- ✅ Change category
- ✅ Change condition
- ✅ Change daily rate
- ✅ Change weekly/monthly rates
- ✅ Add/remove/reorder images

**Expected Results**:

- ✅ Significant edits change approval status to "Pending Review"
- ✅ Listing is removed from "Active" tab
- ✅ Listing appears in "Pending Review" tab with badge
- ✅ Listing becomes hidden from public search immediately
- ✅ Listing appears in admin's pending review queue
- ✅ Review metadata (reviewedBy, reviewedAt) is cleared

**Test Data**:

- Approved listing in "Active" status
- Various significant field changes
- Owner account with edit permissions

**Priority**: High  
**Requirement Reference**: Req 5.1, Req 5.2, Req 5.5, Req 5.6

---

### Scenario 8: Non-Significant Edit Does Not Trigger Re-Review

**User Story**: As a listing owner, I want to make minor updates to my approved listing without triggering re-review.

**Preconditions**:

- User has an approved listing visible in public search
- User is logged in

**Test Steps**:

1. Log in as listing owner
2. Navigate to Garage page → "Active" tab
3. Find an approved listing
4. Verify listing is visible in public search
5. Click "Edit" on the approved listing
6. Make a non-significant change:
   - Update "Instructions" field: "Handle with care" → "Please handle with care and return clean"
   - Update "Safety Notes" field
7. Save the changes
8. Navigate back to Garage page
9. Verify listing remains in "Active" tab
10. Verify listing retains "Approved" status (no badge change)
11. Verify listing remains visible in public search
12. Verify listing does NOT appear in admin's pending review queue

**Test Cases for Non-Significant Changes**:

- ✅ Update instructions text
- ✅ Update safety notes
- ✅ Update availability calendar
- ✅ Change listing status (available/rented/maintenance/inactive)
- ✅ Update delivery radius (within reasonable limits)
- ✅ Toggle setup availability

**Expected Results**:

- ✅ Non-significant edits do NOT change approval status
- ✅ Listing remains in "Active" tab
- ✅ Listing retains "Approved" status
- ✅ Listing remains visible in public search
- ✅ Listing does NOT appear in pending review queue
- ✅ Changes are saved successfully

**Test Data**:

- Approved listing
- Non-significant field changes only
- Owner account

**Priority**: Medium  
**Requirement Reference**: Req 5.3, Req 5.4

---

### Scenario 9: Public Search Visibility Filtering

**User Story**: As a platform user, I want to only see approved listings in search results, so that I don't see incomplete or unapproved content.

**Preconditions**:

- Multiple listings exist with different approval statuses:
  - At least 1 approved listing
  - At least 1 pending listing
  - At least 1 rejected listing
- User is NOT logged in (public access) or logged in as non-owner, non-admin user

**Test Steps**:

1. Navigate to Explore page or Search page (as public user or non-owner)
2. Perform a search that would match all listings
3. Verify search results
4. Check results for pending listings
5. Check results for rejected listings
6. Check results for approved listings
7. Log in as listing owner
8. Perform same search
9. Verify owner can see their own listings regardless of approval status
10. Log in as admin
11. Perform same search
12. Verify admin can see all listings regardless of approval status

**Expected Results**:

- ✅ Public search shows ONLY approved listings
- ✅ Pending listings do NOT appear in public search
- ✅ Rejected listings do NOT appear in public search
- ✅ Approved listings appear in public search correctly
- ✅ Listing owner can see their own listings in search regardless of approval status
- ✅ Admin can see all listings in search regardless of approval status
- ✅ Search filtering works correctly with approval status filter applied

**Test Data**:

- Listings with all three approval statuses (approved, pending_review, rejected)
- Public user account (or logged out)
- Listing owner account
- Admin user account

**Priority**: Critical  
**Requirement Reference**: Req 3.1, Req 3.2, Req 3.3, Req 3.5, Req 3.6, Req 3.7

---

### Scenario 10: Notification Delivery - Approval

**User Story**: As a listing owner, I want to be notified when my listing is approved so I know it's now live on the platform.

**Preconditions**:

- User has a pending listing
- Admin approves the listing
- User has access to email and in-app notifications

**Test Steps**:

1. Log in as listing owner
2. Create a new listing (goes to pending_review)
3. Log in as admin in separate browser/session
4. Navigate to Listing Review page
5. Approve the listing created in step 2
6. Log back in as listing owner
7. Check in-app notifications (notification bell)
8. Check email inbox for approval notification
9. Verify notification content includes:
   - Listing name
   - Approval message
   - Link to Garage page
10. Click notification link (if applicable)
11. Verify it navigates to Garage page showing the approved listing

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

- Listing owner account with valid email
- Admin account for approval action
- Pending listing ready for approval

**Priority**: High  
**Requirement Reference**: Req 7.1, Req 7.2, Req 7.6, Req 7.8

---

### Scenario 11: Notification Delivery - Rejection

**User Story**: As a listing owner, I want to be notified when my listing is rejected with a clear reason so I can fix the issues.

**Preconditions**:

- User has a pending listing
- Admin rejects the listing with a reason
- User has access to email and in-app notifications

**Test Steps**:

1. Log in as listing owner
2. Create a new listing (goes to pending_review)
3. Log in as admin in separate browser/session
4. Navigate to Listing Review page
5. Reject the listing with reason: "Photos need improvement. Please upload clear, well-lit images showing all angles of the tool."
6. Log back in as listing owner
7. Check in-app notifications (notification bell)
8. Check email inbox for rejection notification
9. Verify notification content includes:
   - Listing name
   - Rejection message indicating action needed
   - Rejection reason
   - Link to Garage page
10. Click notification link (if applicable)
11. Verify it navigates to Garage page showing the rejected listing with reason

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

- Listing owner account with valid email
- Admin account for rejection action
- Pending listing ready for rejection
- Valid rejection reason (minimum 10 characters)

**Priority**: High  
**Requirement Reference**: Req 7.3, Req 7.4, Req 7.6, Req 7.7

---

### Scenario 12: Admin Access Control

**User Story**: As a system, I want to ensure only admins can access the review functionality and approve/reject listings.

**Preconditions**:

- Admin user account exists
- Regular user account exists
- Non-authenticated user (public access)

**Test Steps**:

1. **As Non-Admin User**:
   - Log in as regular user
   - Attempt to navigate to `/admin/dashboard/listings/review` directly via URL
   - Verify access is denied or redirected
   - Attempt to access admin sidebar (if visible)
   - Verify "Listing Review" item is not visible

2. **As Non-Authenticated User**:
   - Log out or use incognito window
   - Attempt to navigate to `/admin/dashboard/listings/review` directly via URL
   - Verify redirect to login or unauthorized page

3. **As Admin User**:
   - Log in as admin
   - Verify admin sidebar shows "Listing Review" navigation item
   - Click on "Listing Review" navigation item
   - Verify access is granted and page loads
   - Verify admin can view pending reviews
   - Verify admin can approve/reject listings

**Expected Results**:

- ✅ Non-admin users cannot access Listing Review page
- ✅ Non-admin users are redirected or see unauthorized message
- ✅ Non-admin users cannot see "Listing Review" in navigation
- ✅ Non-authenticated users cannot access Listing Review page
- ✅ Non-authenticated users are redirected to login
- ✅ Admin users can access Listing Review page
- ✅ Admin users can see "Listing Review" in sidebar
- ✅ Admin users can perform approval/rejection actions
- ✅ Pending review count badge is visible to admins only

**Test Data**:

- Admin user account (`userType: admin` or `superadmin`)
- Regular user account (`userType: user` or standard)
- Test listing in pending_review status

**Priority**: Critical  
**Requirement Reference**: Req 8.1, Req 8.2, Req 8.3, Req 8.4

---

### Scenario 13: Concurrent Review Prevention

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
5. Admin User B attempts to approve/reject the same listing (should see updated state)
6. Admin User B attempts action again
7. Verify the system handles concurrent attempts correctly

**Expected Results**:

- ✅ First admin's action (approve/reject) succeeds
- ✅ Second admin sees updated state (listing no longer pending)
- ✅ Second admin receives appropriate feedback (error message or updated UI)
- ✅ Listing is only reviewed once
- ✅ Review metadata (reviewedBy, reviewedAt) reflects the first admin's action
- ✅ No duplicate approvals or conflicting states occur

**Test Data**:

- Two admin user accounts
- One pending listing
- Two separate browser sessions or devices

**Priority**: Medium  
**Requirement Reference**: Reliability.3, Req 2.9, Req 2.10

---

### Scenario 14: Empty State Handling

**User Story**: As an admin, I want to see a clear message when there are no pending listings to review, so I know the queue is empty.

**Preconditions**:

- Admin user is logged in
- No listings exist with `approvalStatus: pending_review`
- Admin navigates to Listing Review page

**Test Steps**:

1. Log in as admin
2. Navigate to Listing Review page
3. Click on "Pending Review" tab
4. Verify empty state is displayed
5. Verify empty state message is clear and helpful
6. Verify admin sidebar badge shows "0" or no badge
7. Navigate to Review History tab
8. Verify empty state if no history exists, or verify history displays correctly

**Expected Results**:

- ✅ Empty state is displayed when no pending listings exist
- ✅ Empty state message is clear: "No listings pending review" or similar
- ✅ Empty state includes helpful information or next steps
- ✅ Admin sidebar badge shows "0" or doesn't display badge when count is 0
- ✅ Empty state doesn't show errors or broken UI
- ✅ Empty state allows navigation to other tabs

**Test Data**:

- Admin user account
- Database with zero pending listings
- Optionally: Database with only approved/rejected listings (for history tab)

**Priority**: Low  
**Requirement Reference**: Req 2.12

---

### Scenario 15: Review History Display and Filtering

**User Story**: As an admin, I want to view past review decisions and filter by status to track review activity.

**Preconditions**:

- Admin user is logged in
- Review history exists (approved and rejected listings)
- Admin navigates to Listing Review page

**Test Steps**:

1. Log in as admin
2. Navigate to Listing Review page
3. Click on "Review History" tab
4. Verify review history displays correctly
5. Verify listings are ordered by review date (most recent first)
6. Verify each listing shows:
   - Review decision (Approved/Rejected badge)
   - Reviewer information (name or ID)
   - Review timestamp
   - Rejection reason (if rejected)
   - Current listing status
7. Apply filter for "Approved" status only
8. Verify only approved listings are displayed
9. Apply filter for "Rejected" status only
10. Verify only rejected listings are displayed
11. Apply filter for "All" status
12. Verify all reviewed listings are displayed

**Expected Results**:

- ✅ Review History tab displays past reviews correctly
- ✅ Listings are ordered by review date (most recent first)
- ✅ Approved listings show "Approved" badge and reviewer info
- ✅ Rejected listings show "Rejected" badge, reviewer info, and reason
- ✅ Review timestamps are accurate and properly formatted
- ✅ Filter controls work correctly (Approved/Rejected/All)
- ✅ Filtered results match selected status
- ✅ Pagination works correctly if many history items exist

**Test Data**:

- Admin user account
- Multiple reviewed listings (approved and rejected)
- Review history with different timestamps

**Priority**: Medium  
**Requirement Reference**: Req 2.4, Req 2.6

---

### Scenario 16: Dashboard Widget Display

**User Story**: As a listing owner, I want to see how many of my listings are pending review on my dashboard, so I can track review status at a glance.

**Preconditions**:

- User has at least one listing with `approvalStatus: pending_review` or `rejected`
- User is logged in and navigates to Dashboard page

**Test Steps**:

1. Log in as listing owner with pending listings
2. Navigate to Dashboard page (`/dashboard`)
3. Verify pending review widget appears
4. Verify widget shows correct count of pending listings
5. Verify widget includes helpful text/message
6. Verify widget has link to Garage page with pending_review tab
7. Click on widget link
8. Verify navigation to Garage Pending Review tab
9. Log in as user with NO pending listings
10. Navigate to Dashboard page
11. Verify pending review widget does NOT appear

**Expected Results**:

- ✅ Widget appears when user has pending listings (count > 0)
- ✅ Widget shows accurate count of pending + rejected listings
- ✅ Widget displays helpful message encouraging user to check status
- ✅ Widget includes working link to Garage Pending Review tab
- ✅ Widget styling matches other dashboard cards
- ✅ Widget does NOT appear when user has zero pending listings
- ✅ Widget updates correctly after listings are approved/rejected

**Test Data**:

- User account with 1-3 pending listings
- User account with zero pending listings
- Mix of pending_review and rejected listings

**Priority**: Medium  
**Requirement Reference**: Req 4.6, Req 4.7

---

### Scenario 17: Review Reason Validation

**User Story**: As an admin, I want to provide helpful rejection reasons that meet minimum quality standards.

**Preconditions**:

- Admin is logged in and viewing a pending listing
- Admin clicks "Reject" button

**Test Steps**:

1. Log in as admin
2. Navigate to Listing Review page → Pending Review tab
3. Click "Reject" on a pending listing
4. Attempt to submit rejection with empty reason
5. Attempt to submit with whitespace-only reason (e.g., " ")
6. Attempt to submit with reason less than 10 characters (e.g., "Bad photos")
7. Enter valid reason with exactly 10 characters
8. Verify submission succeeds
9. Enter valid reason with 1000 characters (maximum)
10. Verify submission succeeds
11. Attempt to enter reason longer than 1000 characters
12. Verify validation prevents submission

**Expected Results**:

- ✅ Empty rejection reason is not accepted
- ✅ Whitespace-only reason is not accepted
- ✅ Reason less than 10 characters shows validation error
- ✅ Reason with exactly 10 characters is accepted
- ✅ Reason with up to 1000 characters is accepted
- ✅ Reason longer than 1000 characters shows validation error
- ✅ Validation messages are clear and helpful
- ✅ Valid reasons are accepted and stored correctly

**Test Data**:

- Empty string
- Whitespace-only string (" ")
- Short reason ("Bad") - 3 characters
- Minimum valid reason ("Please fix") - 10 characters
- Long valid reason - 1000 characters
- Too long reason - 1001+ characters

**Priority**: Medium  
**Requirement Reference**: Req 6.1, Usability.2

---

### Scenario 18: Existing Listings Grandfathered as Approved

**User Story**: As a system, I want existing listings to remain approved so that the review process only applies to new listings going forward.

**Preconditions**:

- Database contains listings created before the review feature was implemented
- Migration has been run to add approval status fields

**Test Steps**:

1. Query database to verify all existing listings have `approvalStatus: approved`
2. Verify no existing listings have null approval status
3. Verify existing listings are visible in public search
4. Verify existing listings appear in owner's Garage "Active" tab
5. Verify existing listings function normally (no errors)
6. Verify existing listings can be edited without issues
7. Verify significant edits on existing listings trigger re-review correctly

**Expected Results**:

- ✅ All existing listings are marked as `approvalStatus: approved`
- ✅ No existing listings have null approval status
- ✅ Existing listings are visible in public search
- ✅ Existing listings function normally (no breaking changes)
- ✅ Existing listings can be edited successfully
- ✅ Significant edits on existing listings trigger re-review as expected
- ✅ No errors occur when accessing existing listings

**Test Data**:

- Listings created before feature implementation
- Mix of listing statuses (available, rented, maintenance, inactive)
- Various listing owners

**Priority**: High  
**Requirement Reference**: Req 9.1, Req 9.2, Req 9.5

---

### Scenario 19: Owner Deletes Rejected Listing

**User Story**: As a listing owner, I want to delete a rejected listing if I don't want to fix it.

**Preconditions**:

- User has a rejected listing
- User is logged in and viewing the rejected listing in Garage

**Test Steps**:

1. Log in as listing owner
2. Navigate to Garage page → "Pending Review" tab
3. Find rejected listing
4. Click "Manage" or "Delete" button
5. Confirm deletion action
6. Verify listing is removed from Garage
7. Verify listing is deleted from database (if hard delete)
8. Verify listing no longer appears in any tab
9. Verify listing is removed from admin's review history (if applicable)

**Expected Results**:

- ✅ Owner can delete rejected listing
- ✅ Deletion confirmation prevents accidental deletion
- ✅ Listing is removed from Garage immediately
- ✅ Listing is removed from database
- ✅ Listing no longer appears in any Garage tab
- ✅ Listing is removed from pending review count
- ✅ Dashboard widget updates if listing was the last pending one

**Test Data**:

- Rejected listing owned by test user
- Owner account with delete permissions

**Priority**: Medium  
**Requirement Reference**: Req 6.4

---

### Scenario 20: Performance and Load Testing

**User Story**: As a system, I want the review process to perform well even with many pending listings.

**Preconditions**:

- Database contains 100+ listings with pending_review status
- Admin user is logged in

**Test Steps**:

1. Create 100+ pending listings (or seed database)
2. Log in as admin
3. Navigate to Listing Review page
4. Measure page load time
5. Click on "Pending Review" tab
6. Measure time to display all listings (or first page)
7. Scroll through paginated results
8. Verify pagination works correctly
9. Verify performance remains acceptable with large dataset
10. Test approval action on listing from large queue
11. Verify action completes within acceptable time

**Expected Results**:

- ✅ Page loads within 2 seconds with 100 pending listings
- ✅ Listing queue displays within acceptable time (< 3 seconds)
- ✅ Pagination works correctly with large datasets
- ✅ Approval/rejection actions complete within 1 second
- ✅ No noticeable performance degradation
- ✅ Database queries are optimized with indexes
- ✅ User experience remains smooth

**Test Data**:

- 100-200 pending listings in database
- Admin account for performance testing
- Performance monitoring tools (optional)

**Priority**: Medium  
**Requirement Reference**: Performance.1, Performance.2, Performance.4

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test data is prepared (listings with various approval statuses)
- [ ] Test user accounts are created (owners, admins, regular users)
- [ ] Database migration has been run successfully
- [ ] Email service is configured and testable
- [ ] Notification system is functional

### Test Environment

- **Environment**: Staging/Production
- **Browser**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Database**: PostgreSQL with test data

### Test Execution

- [ ] Execute all test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Sign off on feature acceptance
- [ ] Prepare test summary report

## Acceptance Criteria Summary

The feature SHALL be considered accepted when:

1. ✅ All new listings require admin approval before appearing in public search
2. ✅ Admins can efficiently review pending listings with full context
3. ✅ Listing owners receive timely notifications when listings are approved or rejected
4. ✅ Listing owners can clearly see approval status of their listings
5. ✅ Rejected listings show rejection reasons clearly
6. ✅ Owners can edit and resubmit rejected listings
7. ✅ Significant edits trigger re-review process
8. ✅ Non-significant edits do not trigger re-review
9. ✅ Existing listings continue to function normally (grandfathered as approved)
10. ✅ Admin access is properly restricted
11. ✅ Public search only shows approved listings
12. ✅ Performance is acceptable with expected load

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
