# Disputes Feature - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Disputes feature. UAT validates that the dispute functionality works correctly from an end-user perspective, including dispute creation, evidence management, admin resolution, and financial operations. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Disputes Feature  
**Version**: 1.0  
**Date**: 2025  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Requirements: `specs/disputes/1-requirements.md`
- Design: `specs/disputes/2-design.md`
- Implementation Tasks: `specs/disputes/3-tasks.md`
- Test Plan: `specs/disputes/4-test-plan.md`

## Test Objectives

1. Verify that dispute creation works correctly with eligibility checks and time window validation
2. Validate that evidence uploads work with proper file validation and deadline enforcement
3. Confirm that dispute state transitions work smoothly through the workflow
4. Ensure that admin resolution with financial operations works correctly
5. Verify that rate limiting prevents abuse of the dispute system
6. Validate that notifications are sent correctly for all dispute events
7. Confirm that audit trails capture all dispute actions
8. Ensure that error handling provides clear, user-friendly feedback
9. Verify that performance meets requirements
10. Confirm that mobile experience is functional and responsive

## Test Scenarios

### Scenario 1: Create Dispute - Happy Path (Renter)

**User Story**: As a renter, I want to create a dispute for a rental so that I can seek resolution for issues that occurred during the rental period.

**Preconditions**:

- User is logged in and authenticated as a renter
- User has a completed rental that ended within the last 7 days
- No active dispute exists for this rental
- User has created fewer than 3 disputes this month
- User has created fewer than 10 disputes this year

**Test Steps**:

1. Navigate to rental details page for a completed rental
2. Verify "File Dispute" button is visible
3. Click "File Dispute" button
4. Verify dispute creation form appears
5. Select reason code: "DAMAGE"
6. Enter description: "Tool was returned with significant damage to the handle. The damage was not present when I received the tool."
7. Review time window information displayed
8. Submit dispute form
9. Wait for submission to complete
10. Verify success message appears

**Expected Results**:

- ✅ "File Dispute" button is visible on rental details page
- ✅ Dispute creation form loads correctly
- ✅ Reason code dropdown shows all available options (DAMAGE, NON_DELIVERY, QUALITY_ISSUE, CANCELLATION, PAYMENT_ISSUE, OTHER)
- ✅ Description field accepts text input
- ✅ Time window information is displayed clearly
- ✅ Form validation prevents submission with empty description
- ✅ Upon submission, user sees success message: "Dispute created successfully"
- ✅ User is redirected to dispute details page
- ✅ Dispute appears in "Disputes" list with status "OPEN"
- ✅ Dispute has evidence deadline set to 7 days from creation
- ✅ Both renter and provider receive notifications about dispute creation
- ✅ Dispute status badge appears on rental details page
- ✅ Audit log entry is created for dispute creation

**Test Data**:

- Completed rental with end date within last 7 days
- Valid reason code: DAMAGE
- Description: 50-1000 characters
- User with 2 disputes created this month

**Priority**: Critical  
**Requirement Reference**: Requirement 1 - Dispute Creation and Eligibility

---

### Scenario 2: Create Dispute - Happy Path (Provider)

**User Story**: As a provider, I want to create a dispute for a rental so that I can seek resolution for issues that occurred during the rental period.

**Preconditions**:

- User is logged in and authenticated as a provider (tool owner)
- User has a completed rental that ended within the last 7 days
- No active dispute exists for this rental
- User has created fewer than 3 disputes this month

**Test Steps**:

1. Navigate to rental details page for a completed rental (as owner)
2. Verify "File Dispute" button is visible
3. Click "File Dispute" button
4. Select reason code: "PAYMENT_ISSUE"
5. Enter description: "Payment was not processed correctly. I did not receive the full amount."
6. Submit dispute form
7. Verify success message appears

**Expected Results**:

- ✅ Provider can create disputes for their rentals
- ✅ Dispute is created with createdByRole set to "provider"
- ✅ All other results match Scenario 1

**Test Data**:

- Completed rental owned by provider
- Valid reason code: PAYMENT_ISSUE
- Description: 50-1000 characters

**Priority**: Critical  
**Requirement Reference**: Requirement 1 - Dispute Creation and Eligibility

---

### Scenario 3: Create Dispute - Active Dispute Exists

**User Story**: As a user, I want to see a clear error message when I try to create a dispute for a rental that already has an active dispute.

**Preconditions**:

- User is logged in
- User has a rental with an existing active dispute
- User navigates to rental details page

**Test Steps**:

1. Navigate to rental details page with existing active dispute
2. Verify "File Dispute" button is not visible (or disabled)
3. If button is visible, click "File Dispute"
4. Attempt to submit dispute form
5. Verify error message appears

**Expected Results**:

- ✅ "File Dispute" button is disabled or not visible when active dispute exists
- ✅ If form submission is attempted, error message appears: "Active dispute already exists for this rental"
- ✅ No new dispute is created
- ✅ HTTP status code is 400 (Bad Request)
- ✅ Error message is clear and actionable

**Test Data**:

- Rental with existing active dispute (status: OPEN, EVIDENCE_REQUESTED, or UNDER_REVIEW)

**Priority**: High  
**Requirement Reference**: Requirement 1.1, 1.2 - Active Dispute Prevention

---

### Scenario 4: Create Dispute - Time Window Expired

**User Story**: As a user, I want to see a clear error message when I try to create a dispute outside the allowed time window.

**Preconditions**:

- User is logged in
- User has a completed rental that ended 8 days ago (outside 7-day window for DAMAGE)
- No active dispute exists for this rental

**Test Steps**:

1. Navigate to rental details page for rental that ended 8 days ago
2. Click "File Dispute" button
3. Select reason code: "DAMAGE"
4. Enter description
5. Submit dispute form
6. Verify error message appears

**Expected Results**:

- ✅ Error message appears: "Time window has expired. Disputes for DAMAGE must be filed within 7 days after the rental end date."
- ✅ No dispute is created
- ✅ HTTP status code is 400 (Bad Request)
- ✅ Error message indicates the specific time window that applies
- ✅ Form remains accessible so user can see the error

**Test Data**:

- Completed rental with end date 8+ days ago
- Reason code: DAMAGE (7-day window after end date)

**Priority**: High  
**Requirement Reference**: Requirement 1.8, 1.9 - Time Window Validation

---

### Scenario 5: Create Dispute - Rate Limit Exceeded

**User Story**: As a user, I want to see a clear error message when I try to create a dispute but have exceeded the rate limit.

**Preconditions**:

- User is logged in
- User has created 3 disputes this month (monthly limit)
- User has a valid rental for dispute creation

**Test Steps**:

1. Navigate to rental details page
2. Click "File Dispute" button
3. Select reason code
4. Enter description
5. Submit dispute form
6. Verify error message appears

**Expected Results**:

- ✅ Error message appears: "Rate limit exceeded. You have created 3 disputes this month. Maximum allowed: 3 per month, 10 per year."
- ✅ No dispute is created
- ✅ HTTP status code is 429 (Too Many Requests)
- ✅ Error message shows current counts (monthly and yearly)
- ✅ Error message indicates when limits reset

**Test Data**:

- User with 3 disputes created in current month
- Valid rental for dispute creation

**Priority**: High  
**Requirement Reference**: Requirement 9 - Abuse Prevention and Rate Limiting

---

### Scenario 6: Create Dispute - Unauthorized User

**User Story**: As a system, I want to prevent users from creating disputes for rentals they are not involved in.

**Preconditions**:

- User A is logged in
- User A is not the renter or provider for a specific rental
- User A attempts to create a dispute for that rental

**Test Steps**:

1. Log in as User A (not involved in rental)
2. Navigate to rental details page for rental where User A is not renter or provider
3. Attempt to access dispute creation (if possible)
4. Verify error message appears

**Expected Results**:

- ✅ "File Dispute" button is not visible (or disabled)
- ✅ If API call is made, error message appears: "Unauthorized. You can only create disputes for rentals where you are the renter or provider."
- ✅ HTTP status code is 403 (Forbidden)
- ✅ No dispute is created

**Test Data**:

- User account not associated with rental
- Rental with different renter and provider

**Priority**: Critical  
**Requirement Reference**: Requirement 1.3, 1.4, 1.5 - Role-Based Eligibility

---

### Scenario 7: Upload Evidence - Image Upload

**User Story**: As a user, I want to upload image evidence to support my dispute so that I can provide documentation for my claim.

**Preconditions**:

- User is logged in
- User has a dispute with status "OPEN" or "EVIDENCE_REQUESTED"
- Evidence deadline has not expired
- User has image files ready (JPEG, PNG, WebP)

**Test Steps**:

1. Navigate to dispute details page
2. Verify evidence upload section is visible
3. Verify evidence deadline and time remaining are displayed
4. Drag and drop an image file (JPEG, 5MB) into upload area
5. Wait for upload to complete
6. Verify image appears in evidence list
7. Click on image thumbnail to view full size
8. Upload another image (PNG, 3MB)
9. Verify both images appear in evidence list

**Expected Results**:

- ✅ Evidence upload section is visible and functional
- ✅ Evidence deadline is displayed with time remaining (e.g., "5 days remaining")
- ✅ Drag-and-drop interface works correctly
- ✅ File input also works (click to browse)
- ✅ Upload shows progress indicator during upload
- ✅ Success message appears: "Evidence uploaded successfully"
- ✅ Image appears in evidence list with:
  - Thumbnail preview
  - Upload timestamp
  - User name and role (renter or provider)
  - Full-size view on click
- ✅ Images are ordered by upload timestamp (oldest first)
- ✅ Evidence count updates
- ✅ Audit log entry is created for evidence upload

**Test Data**:

- Dispute with status "OPEN"
- JPEG image file (5MB)
- PNG image file (3MB)
- Evidence deadline: 5 days remaining

**Priority**: Critical  
**Requirement Reference**: Requirement 4 - Evidence Management

---

### Scenario 8: Upload Evidence - Text Evidence

**User Story**: As a user, I want to upload text evidence to support my dispute so that I can provide written documentation for my claim.

**Preconditions**:

- User is logged in
- User has a dispute with status "OPEN" or "EVIDENCE_REQUESTED"
- Evidence deadline has not expired

**Test Steps**:

1. Navigate to dispute details page
2. Scroll to evidence upload section
3. Click "Add Text Evidence" button
4. Enter text: "I contacted the owner on [date] to report the issue. They responded on [date] saying they would investigate but I have not heard back since."
5. Click "Submit" button
6. Verify text appears in evidence list

**Expected Results**:

- ✅ Text evidence input field is available
- ✅ Text field accepts multi-line input
- ✅ Character count or limit is displayed (if applicable)
- ✅ Success message appears: "Text evidence added successfully"
- ✅ Text evidence appears in evidence list with:
  - Full text content
  - Upload timestamp
  - User name and role
- ✅ Text evidence is ordered by upload timestamp (oldest first)
- ✅ Evidence count updates
- ✅ Audit log entry is created

**Test Data**:

- Dispute with status "OPEN"
- Text content: 100-500 characters

**Priority**: High  
**Requirement Reference**: Requirement 4 - Evidence Management

---

### Scenario 9: Upload Evidence - Deadline Expired

**User Story**: As a user, I want to see a clear error message when I try to upload evidence after the deadline has expired.

**Preconditions**:

- User is logged in
- User has a dispute with status "EVIDENCE_REQUESTED"
- Evidence deadline expired 1 day ago

**Test Steps**:

1. Navigate to dispute details page
2. Verify evidence deadline shows "Expired" or "0 days remaining"
3. Attempt to upload an image
4. Verify error message appears
5. Attempt to add text evidence
6. Verify error message appears

**Expected Results**:

- ✅ Evidence deadline shows as expired
- ✅ Upload interface is disabled or shows "Deadline Expired" message
- ✅ Error message appears: "Evidence deadline has expired. Evidence can no longer be uploaded for this dispute."
- ✅ No evidence is uploaded
- ✅ HTTP status code is 400 (Bad Request)
- ✅ Dispute may have automatically transitioned to "UNDER_REVIEW" state

**Test Data**:

- Dispute with status "EVIDENCE_REQUESTED"
- Evidence deadline expired 1+ days ago

**Priority**: High  
**Requirement Reference**: Requirement 4.8, 4.9 - Evidence Deadline Enforcement

---

### Scenario 10: Upload Evidence - Invalid File Type

**User Story**: As a user, I want to see a clear error message when I try to upload an unsupported file type.

**Preconditions**:

- User is logged in
- User has a dispute with status "OPEN"
- Evidence deadline has not expired
- User has a PDF file (not supported)

**Test Steps**:

1. Navigate to dispute details page
2. Attempt to drag and drop a PDF file
3. Verify error message appears
4. Attempt to upload a video file
5. Verify error message appears

**Expected Results**:

- ✅ Error message appears: "Invalid file type. Only JPEG, PNG, and WebP images are supported."
- ✅ File is not uploaded
- ✅ Error message is clear and indicates supported file types
- ✅ Upload interface remains functional for valid file types

**Test Data**:

- PDF file
- Video file (MP4)
- Dispute with status "OPEN"

**Priority**: High  
**Requirement Reference**: Requirement 4.4 - File Type Validation

---

### Scenario 11: Upload Evidence - File Too Large

**User Story**: As a user, I want to see a clear error message when I try to upload a file that exceeds the size limit.

**Preconditions**:

- User is logged in
- User has a dispute with status "OPEN"
- Evidence deadline has not expired
- User has an image file larger than 10MB

**Test Steps**:

1. Navigate to dispute details page
2. Attempt to upload an image file (15MB)
3. Verify error message appears

**Expected Results**:

- ✅ Error message appears: "File size exceeds 10MB limit. Please compress the image or use a smaller file."
- ✅ File is not uploaded
- ✅ Error message indicates the size limit
- ✅ Upload interface remains functional for valid file sizes

**Test Data**:

- Image file (15MB)
- Dispute with status "OPEN"

**Priority**: High  
**Requirement Reference**: Requirement 4.4 - File Size Validation

---

### Scenario 12: Upload Evidence - Dispute Resolved

**User Story**: As a user, I want to see a clear message when I try to upload evidence for a resolved dispute.

**Preconditions**:

- User is logged in
- User has a dispute with status "RESOLVED" or "CLOSED"

**Test Steps**:

1. Navigate to dispute details page for resolved dispute
2. Verify evidence section is read-only
3. Attempt to upload evidence (if interface allows)
4. Verify error message appears

**Expected Results**:

- ✅ Evidence section is marked as "Read-only" or "Evidence uploads closed"
- ✅ Upload interface is disabled
- ✅ If upload is attempted, error message appears: "Evidence cannot be uploaded for resolved disputes"
- ✅ HTTP status code is 400 (Bad Request)
- ✅ Existing evidence remains visible

**Test Data**:

- Dispute with status "RESOLVED"
- Dispute with status "CLOSED"

**Priority**: Medium  
**Requirement Reference**: Requirement 4.2 - Evidence Upload Restrictions

---

### Scenario 13: Admin State Transition - Request Evidence

**User Story**: As an admin, I want to request additional evidence from users so that I can gather more information for dispute resolution.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "OPEN" or "UNDER_REVIEW"
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Verify admin action buttons are visible
3. Click "Request Evidence" button
4. Verify confirmation dialog appears
5. Enter optional reason: "Please provide photos of the damage from multiple angles"
6. Click "Confirm" button
7. Verify state transition occurs

**Expected Results**:

- ✅ "Request Evidence" button is visible to admins only
- ✅ Confirmation dialog appears with clear message
- ✅ Optional reason field is available
- ✅ Success message appears: "Evidence requested successfully"
- ✅ Dispute status changes to "EVIDENCE_REQUESTED"
- ✅ Additional evidence deadline is set to 3 days from request
- ✅ User (renter or provider) receives notification: "Additional evidence requested"
- ✅ Notification includes deadline information
- ✅ Audit log entry is created for state change
- ✅ Timeline shows state transition with admin name and timestamp

**Test Data**:

- Dispute with status "OPEN"
- Admin user account
- Optional reason text

**Priority**: High  
**Requirement Reference**: Requirement 3 - Dispute State Machine, Requirement 11 - Notifications

---

### Scenario 14: Admin State Transition - Move to Under Review

**User Story**: As an admin, I want to move a dispute to under review so that I can begin the resolution process.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "OPEN" or "EVIDENCE_REQUESTED"
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Click "Move to Under Review" button
3. Verify confirmation dialog appears
4. Enter optional reason: "All evidence has been submitted. Beginning review process."
5. Click "Confirm" button
6. Verify state transition occurs

**Expected Results**:

- ✅ "Move to Under Review" button is visible to admins only
- ✅ Confirmation dialog appears
- ✅ Optional reason field is available
- ✅ Success message appears: "Dispute moved to under review"
- ✅ Dispute status changes to "UNDER_REVIEW"
- ✅ Audit log entry is created
- ✅ Timeline shows state transition
- ✅ Both parties receive notification (if configured)

**Test Data**:

- Dispute with status "OPEN" or "EVIDENCE_REQUESTED"
- Admin user account

**Priority**: High  
**Requirement Reference**: Requirement 3 - Dispute State Machine

---

### Scenario 15: Admin Resolution - Favor Renter with Full Refund

**User Story**: As an admin, I want to resolve a dispute in favor of the renter with a full refund so that the renter is compensated for the issue.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "UNDER_REVIEW"
- Dispute has an associated payment with PaymentIntent ID
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Scroll to admin resolution panel
3. Select resolution outcome: "FAVOR_RENTER"
4. Enter resolution reason: "Tool was damaged beyond normal wear and tear. Full refund is appropriate."
5. Select financial operation: "Refund Full"
6. Review financial operation details
7. Click "Resolve Dispute" button
8. Verify confirmation dialog appears
9. Confirm resolution
10. Wait for resolution to complete (including Stripe operation)
11. Verify success message appears

**Expected Results**:

- ✅ Admin resolution panel is visible to admins only
- ✅ Resolution outcome dropdown shows all options (FAVOR_RENTER, FAVOR_PROVIDER, PARTIAL_RENTER, PARTIAL_PROVIDER, DISMISSED)
- ✅ Resolution reason field is required and accepts text
- ✅ Financial operations section shows available options
- ✅ "Refund Full" option is available when payment exists
- ✅ Confirmation dialog shows summary of resolution and financial operations
- ✅ Loading state appears during resolution: "Resolving dispute and processing refund..."
- ✅ Success message appears: "Dispute resolved successfully. Full refund has been processed."
- ✅ Dispute status changes to "RESOLVED"
- ✅ Resolution information is displayed:
  - Outcome: FAVOR_RENTER
  - Reason: [entered reason]
  - Resolved by: [admin name]
  - Resolved at: [timestamp]
  - Financial operations: Full refund [amount]
- ✅ Financial operation record is created with Stripe refund ID
- ✅ Both renter and provider receive notifications: "Dispute resolved"
- ✅ Notification includes resolution outcome
- ✅ Audit log entry is created for resolution
- ✅ Evidence uploads are now disabled
- ✅ Timeline shows resolution with all details

**Test Data**:

- Dispute with status "UNDER_REVIEW"
- Payment with PaymentIntent ID: $100.00
- Admin user account
- Resolution reason: 50-1000 characters

**Priority**: Critical  
**Requirement Reference**: Requirement 7 - Admin Resolution Actions, Requirement 6 - Stripe Financial Integration

---

### Scenario 16: Admin Resolution - Partial Refund

**User Story**: As an admin, I want to resolve a dispute with a partial refund so that both parties receive fair compensation.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "UNDER_REVIEW"
- Dispute has an associated payment: $100.00
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Select resolution outcome: "PARTIAL_RENTER"
3. Enter resolution reason: "Tool had minor damage. Partial refund of 50% is appropriate."
4. Select financial operation: "Refund Partial"
5. Enter refund amount: $50.00
6. Click "Resolve Dispute" button
7. Confirm resolution
8. Wait for resolution to complete
9. Verify success message appears

**Expected Results**:

- ✅ "Refund Partial" option allows amount input
- ✅ Amount input validates against payment total (cannot exceed)
- ✅ Amount input shows currency formatting
- ✅ Confirmation dialog shows partial refund amount
- ✅ Success message appears: "Dispute resolved successfully. Partial refund of $50.00 has been processed."
- ✅ Financial operation record shows partial refund amount
- ✅ Stripe refund is created for partial amount
- ✅ All other results match Scenario 15

**Test Data**:

- Dispute with status "UNDER_REVIEW"
- Payment: $100.00
- Partial refund amount: $50.00

**Priority**: High  
**Requirement Reference**: Requirement 7 - Admin Resolution Actions, Requirement 6 - Stripe Financial Integration

---

### Scenario 17: Admin Resolution - Hold Payout

**User Story**: As an admin, I want to hold a payout to the provider so that funds are not released until the dispute is resolved.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "UNDER_REVIEW"
- Dispute has an associated payment with pending payout
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Select resolution outcome: "FAVOR_RENTER"
3. Enter resolution reason
4. Select financial operation: "Hold Payout"
5. Click "Resolve Dispute" button
6. Confirm resolution
7. Verify success message appears

**Expected Results**:

- ✅ "Hold Payout" option is available
- ✅ Hold operation is recorded in financial operations
- ✅ Payout is prevented from being processed
- ✅ Financial operation record shows hold status
- ✅ Success message indicates payout is held
- ✅ All other results match Scenario 15

**Test Data**:

- Dispute with status "UNDER_REVIEW"
- Payment with pending payout
- Admin user account

**Priority**: High  
**Requirement Reference**: Requirement 6.6 - Hold Payout Operation

---

### Scenario 18: Admin Resolution - Capture Security Deposit

**User Story**: As an admin, I want to capture a security deposit when resolving a dispute in favor of the provider.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "UNDER_REVIEW"
- Rental has a security deposit authorization
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Select resolution outcome: "FAVOR_PROVIDER"
3. Enter resolution reason: "Tool was damaged. Security deposit will be captured to cover repair costs."
4. Select financial operation: "Capture Deposit"
5. Click "Resolve Dispute" button
6. Confirm resolution
7. Wait for resolution to complete
8. Verify success message appears

**Expected Results**:

- ✅ "Capture Deposit" option is available when security deposit authorization exists
- ✅ Confirmation dialog shows deposit amount
- ✅ Success message appears: "Dispute resolved successfully. Security deposit has been captured."
- ✅ Financial operation record shows deposit capture
- ✅ Stripe payment intent is captured
- ✅ All other results match Scenario 15

**Test Data**:

- Dispute with status "UNDER_REVIEW"
- Rental with security deposit authorization: $50.00
- Admin user account

**Priority**: High  
**Requirement Reference**: Requirement 6.7 - Capture Security Deposit

---

### Scenario 19: Admin Resolution - Stripe Operation Failure

**User Story**: As an admin, I want to see a clear error message when a Stripe financial operation fails during resolution.

**Preconditions**:

- Admin user is logged in
- Admin has a dispute with status "UNDER_REVIEW"
- Stripe API will return an error (simulated or test mode)

**Test Steps**:

1. Navigate to dispute details page as admin
2. Select resolution outcome: "FAVOR_RENTER"
3. Enter resolution reason
4. Select financial operation: "Refund Full"
5. Click "Resolve Dispute" button
6. Confirm resolution
7. Wait for resolution attempt
8. Verify error message appears

**Expected Results**:

- ✅ Error message appears: "Financial operation failed. The refund could not be processed. Please try again or contact support."
- ✅ Dispute status remains "UNDER_REVIEW" (not changed to RESOLVED)
- ✅ No resolution is recorded
- ✅ Financial operation record shows "failed" status with error message
- ✅ Error is logged for investigation
- ✅ Admin can retry resolution after fixing the issue
- ✅ HTTP status code is 500 (Internal Server Error) or appropriate error code

**Test Data**:

- Dispute with status "UNDER_REVIEW"
- Stripe API configured to return error (test mode)
- Admin user account

**Priority**: High  
**Requirement Reference**: Requirement 6.8 - Stripe Operation Error Handling

---

### Scenario 20: View Dispute Details - Renter

**User Story**: As a renter, I want to view complete dispute details including evidence, timeline, and resolution so that I can understand the dispute status.

**Preconditions**:

- Renter is logged in
- Renter has a dispute for one of their rentals
- Dispute has evidence, state transitions, and may be resolved

**Test Steps**:

1. Navigate to disputes list page
2. Click on a dispute
3. Verify dispute details page loads
4. Review all sections:
   - Dispute information (ID, rental info, reason, status, description)
   - Evidence section
   - Timeline section
   - Resolution section (if resolved)
   - Financial operations (if any)

**Expected Results**:

- ✅ Dispute details page loads correctly
- ✅ Dispute information section shows:
  - Dispute ID
  - Rental information (listing name, dates, amount)
  - Dispute type (reason code)
  - Current status with badge
  - Created date and time
  - Created by (renter or provider)
  - Description
- ✅ Evidence section shows:
  - All evidence (images and text) with upload timestamps
  - User attribution (name and role) for each evidence
  - Image thumbnails (clickable for full size)
  - Text content formatted
  - Evidence ordered by timestamp (oldest first)
- ✅ Timeline section shows:
  - All state transitions in chronological order
  - State change details
  - Timestamp for each transition
  - User who initiated (if applicable)
  - Reason (if provided)
- ✅ Resolution section (if resolved) shows:
  - Resolution outcome
  - Resolution reason
  - Resolved by (admin name)
  - Resolution timestamp
  - Financial operations performed
- ✅ Financial operations section (if any) shows:
  - Operation type
  - Amount
  - Status
  - Timestamp
- ✅ Internal notes section is NOT visible (admin only)
- ✅ Admin action buttons are NOT visible (admin only)
- ✅ Evidence upload is available if deadline not expired and dispute not resolved

**Test Data**:

- Dispute with multiple evidence entries
- Dispute with state transitions
- Dispute that may be resolved

**Priority**: Critical  
**Requirement Reference**: Requirement 12 - Dispute Details View

---

### Scenario 21: View Dispute Details - Admin

**User Story**: As an admin, I want to view complete dispute details including internal notes and admin actions so that I can manage and resolve disputes.

**Preconditions**:

- Admin user is logged in
- Admin is viewing any dispute (not necessarily their own)

**Test Steps**:

1. Navigate to disputes list page as admin
2. Click on any dispute
3. Verify dispute details page loads with admin features
4. Review all sections including admin-only sections

**Expected Results**:

- ✅ All results from Scenario 20 apply
- ✅ Internal notes section is visible and shows:
  - All internal notes (newest first)
  - Admin name and timestamp for each note
  - Ability to create, edit, and delete notes
- ✅ Admin action buttons are visible:
  - "Request Evidence" (if applicable)
  - "Move to Under Review" (if applicable)
  - "Resolve Dispute" (if applicable)
  - State transition buttons based on current state
- ✅ Admin resolution panel is visible (if dispute is not resolved)
- ✅ Financial operation controls are available

**Test Data**:

- Any dispute in the system
- Admin user account

**Priority**: Critical  
**Requirement Reference**: Requirement 12 - Dispute Details View, Requirement 5 - Internal Notes

---

### Scenario 22: Internal Notes - Create Note

**User Story**: As an admin, I want to add internal notes to disputes so that I can document my review process.

**Preconditions**:

- Admin user is logged in
- Admin is viewing a dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Scroll to internal notes section
3. Click "Add Note" button
4. Enter note content: "Reviewed evidence. Damage appears to be pre-existing based on timestamp analysis. Need to verify with provider."
5. Click "Save Note" button
6. Verify note appears in notes list

**Expected Results**:

- ✅ "Add Note" button is visible to admins only
- ✅ Note input field appears (textarea)
- ✅ Note content is required
- ✅ Success message appears: "Note added successfully"
- ✅ Note appears in notes list (newest first) with:
  - Note content
  - Admin name
  - Timestamp
- ✅ Audit log entry is created for note creation
- ✅ Note is only visible to admins (not to renter or provider)

**Test Data**:

- Dispute details page
- Admin user account
- Note content: 50-1000 characters

**Priority**: Medium  
**Requirement Reference**: Requirement 5 - Admin-Only Internal Notes

---

### Scenario 23: Internal Notes - Edit Note

**User Story**: As an admin, I want to edit my internal notes so that I can update my documentation.

**Preconditions**:

- Admin user is logged in
- Admin has created an internal note
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Find an internal note created by current admin
3. Click "Edit" button on the note
4. Update note content
5. Click "Save" button
6. Verify note is updated

**Expected Results**:

- ✅ "Edit" button is available on notes (for notes created by current admin)
- ✅ Edit form appears with current note content
- ✅ Note content can be updated
- ✅ Success message appears: "Note updated successfully"
- ✅ Updated note shows new content with updated timestamp
- ✅ Audit log entry is created for note update

**Test Data**:

- Internal note created by current admin
- Updated note content

**Priority**: Medium  
**Requirement Reference**: Requirement 5.8 - Internal Notes Editable

---

### Scenario 24: Internal Notes - Delete Note

**User Story**: As an admin, I want to delete internal notes so that I can remove incorrect or outdated information.

**Preconditions**:

- Admin user is logged in
- Admin has created an internal note
- Admin is viewing dispute details page

**Test Steps**:

1. Navigate to dispute details page as admin
2. Find an internal note created by current admin
3. Click "Delete" button on the note
4. Verify confirmation dialog appears
5. Confirm deletion
6. Verify note is removed

**Expected Results**:

- ✅ "Delete" button is available on notes (for notes created by current admin)
- ✅ Confirmation dialog appears: "Are you sure you want to delete this note? This action cannot be undone."
- ✅ Note is removed from list after confirmation
- ✅ Success message appears: "Note deleted successfully"
- ✅ Audit log entry is created for note deletion

**Test Data**:

- Internal note created by current admin

**Priority**: Medium  
**Requirement Reference**: Requirement 5.8 - Internal Notes Deletable

---

### Scenario 25: Disputes List - User View

**User Story**: As a user, I want to view all my disputes so that I can track their status and deadlines.

**Preconditions**:

- User is logged in
- User has multiple disputes (as renter and/or provider)
- User navigates to disputes list page

**Test Steps**:

1. Navigate to disputes list page (`/dashboard/disputes`)
2. Verify disputes list loads
3. Review dispute list items
4. Test filtering by status
5. Test sorting by date
6. Click on a dispute to view details

**Expected Results**:

- ✅ Disputes list page loads correctly
- ✅ All user's disputes are displayed (as renter and provider)
- ✅ Each dispute item shows:
  - Dispute ID (shortened or full)
  - Rental/booking information (listing name, dates)
  - Status badge (OPEN, UNDER_REVIEW, RESOLVED, etc.)
  - Created date
  - Last updated date
  - Deadline (if applicable) with time remaining
- ✅ Filter dropdown allows filtering by status (All, OPEN, UNDER_REVIEW, RESOLVED, CLOSED)
- ✅ Sort options allow sorting by date (newest first, oldest first)
- ✅ Pagination works correctly (if many disputes)
- ✅ Clicking on dispute navigates to dispute details page
- ✅ Disputes are ordered by last updated date (newest first) by default

**Test Data**:

- User with 5-10 disputes in various statuses
- Disputes as both renter and provider

**Priority**: High  
**Requirement Reference**: Requirement 11.7, 11.8 - Disputes List Page

---

### Scenario 26: Disputes List - Admin View

**User Story**: As an admin, I want to view all disputes in the system so that I can manage and resolve them.

**Preconditions**:

- Admin user is logged in
- System has multiple disputes from different users
- Admin navigates to disputes list page

**Test Steps**:

1. Navigate to disputes list page as admin
2. Verify all disputes are displayed
3. Test filtering by status
4. Test filtering by reason code
5. Test sorting options
6. Verify admin can access any dispute

**Expected Results**:

- ✅ All disputes in the system are displayed (not just admin's disputes)
- ✅ Filter options include:
  - Status filter (All, OPEN, UNDER_REVIEW, RESOLVED, CLOSED)
  - Reason code filter (DAMAGE, NON_DELIVERY, QUALITY_ISSUE, etc.)
- ✅ Sort options work correctly
- ✅ Admin can click on any dispute to view details
- ✅ Dispute list shows all relevant information
- ✅ Pagination works correctly

**Test Data**:

- System with 20+ disputes from various users
- Disputes in various statuses and reason codes
- Admin user account

**Priority**: High  
**Requirement Reference**: Requirement 11.7 - Admin Disputes List

---

### Scenario 27: Dispute Status Badge on Rental Page

**User Story**: As a user, I want to see dispute status on the rental details page so that I know if a dispute exists for this rental.

**Preconditions**:

- User is logged in
- User has a rental with an active dispute
- User navigates to rental details page

**Test Steps**:

1. Navigate to rental details page for rental with active dispute
2. Verify dispute status badge is visible
3. Click on dispute status badge or link
4. Verify navigation to dispute details page

**Expected Results**:

- ✅ Dispute status badge is visible on rental details page
- ✅ Badge shows current dispute status (OPEN, UNDER_REVIEW, RESOLVED, etc.)
- ✅ Badge uses appropriate color coding (e.g., yellow for OPEN, blue for UNDER_REVIEW, green for RESOLVED)
- ✅ Badge or link is clickable and navigates to dispute details page
- ✅ Deadline information is displayed if applicable (e.g., "Evidence deadline: 3 days remaining")
- ✅ "File Dispute" button is not visible (or disabled) when active dispute exists

**Test Data**:

- Rental with active dispute
- Rental with resolved dispute
- Rental without dispute

**Priority**: High  
**Requirement Reference**: Requirement 11.1, 11.2 - Rental UI Integration

---

### Scenario 28: Automatic State Transition - Evidence Deadline Expired

**User Story**: As a system, I want to automatically transition disputes from EVIDENCE_REQUESTED to UNDER_REVIEW when the evidence deadline expires.

**Preconditions**:

- System has a dispute with status "EVIDENCE_REQUESTED"
- Evidence deadline expired 1 day ago
- System performs on-demand deadline check (when dispute is accessed)

**Test Steps**:

1. Navigate to dispute details page for dispute with expired deadline
2. Verify automatic state transition occurs
3. Verify notification is sent
4. Verify audit log is created

**Expected Results**:

- ✅ Dispute status automatically changes from "EVIDENCE_REQUESTED" to "UNDER_REVIEW"
- ✅ State transition is logged in audit trail with reason: "Evidence deadline expired"
- ✅ Timeline shows automatic transition with system attribution
- ✅ User receives notification: "Evidence deadline expired. Dispute moved to under review."
- ✅ Evidence uploads are now disabled
- ✅ Transition occurs when dispute is accessed (on-demand enforcement)

**Test Data**:

- Dispute with status "EVIDENCE_REQUESTED"
- Evidence deadline expired 1+ days ago

**Priority**: High  
**Requirement Reference**: Requirement 4.9 - Automatic State Transition on Deadline Expiration

---

### Scenario 29: Time Window Validation - Different Reason Codes

**User Story**: As a user, I want to understand the time windows for different dispute types so that I know when I can file disputes.

**Preconditions**:

- User is logged in
- User has rentals with various end dates and scenarios

**Test Steps**:

1. Test DAMAGE dispute: Rental ended 6 days ago (within 7-day window)
2. Test DAMAGE dispute: Rental ended 8 days ago (outside 7-day window)
3. Test NON_DELIVERY dispute: Rental started 2 days ago (within 3-day window)
4. Test NON_DELIVERY dispute: Rental started 4 days ago (outside 3-day window)
5. Test PAYMENT_ISSUE dispute: Payment made 25 days ago (within 30-day window)
6. Test PAYMENT_ISSUE dispute: Payment made 35 days ago (outside 30-day window)
7. Test OTHER dispute: Rental ended 10 days ago (within 14-day window)
8. Test OTHER dispute: Rental ended 15 days ago (outside 14-day window)

**Expected Results**:

- ✅ DAMAGE: Allowed within 7 days after rental end date
- ✅ NON_DELIVERY: Allowed within 3 days after rental start date
- ✅ QUALITY_ISSUE: Allowed within 7 days after rental end date
- ✅ PAYMENT_ISSUE: Allowed within 30 days after payment
- ✅ OTHER: Allowed within 14 days after rental end date
- ✅ Each reason code enforces its specific time window
- ✅ Error messages indicate the specific time window for each reason code

**Test Data**:

- Rentals with various end dates
- Payments with various dates
- Different reason codes

**Priority**: High  
**Requirement Reference**: Requirement 1.8 - Time Window Validation

---

### Scenario 30: Rate Limiting - Monthly and Yearly Limits

**User Story**: As a system, I want to enforce rate limits to prevent abuse of the dispute system.

**Preconditions**:

- User is logged in
- User has created various numbers of disputes

**Test Steps**:

1. Test monthly limit: User has created 2 disputes this month (within limit)
2. Test monthly limit: User has created 3 disputes this month (at limit)
3. Test monthly limit: User attempts to create 4th dispute this month (exceeds limit)
4. Test yearly limit: User has created 9 disputes this year (within limit)
5. Test yearly limit: User has created 10 disputes this year (at limit)
6. Test yearly limit: User attempts to create 11th dispute this year (exceeds limit)
7. Test limit reset: User creates dispute on first day of new month (monthly limit resets)

**Expected Results**:

- ✅ Monthly limit: Maximum 3 disputes per month
- ✅ Yearly limit: Maximum 10 disputes per year
- ✅ Error message shows current counts: "You have created 3 disputes this month. Maximum allowed: 3 per month, 10 per year."
- ✅ Error message indicates when limits reset
- ✅ Monthly limit resets at start of each month
- ✅ Yearly limit resets at start of each year
- ✅ Rate limit check is performed on-the-fly (no dedicated tracking table for MVP)

**Test Data**:

- User with various dispute counts
- Disputes created in current month
- Disputes created in current year

**Priority**: High  
**Requirement Reference**: Requirement 9 - Abuse Prevention and Rate Limiting

---

### Scenario 31: Error Handling - Network Failure

**User Story**: As a user, I want to see clear error messages when network requests fail.

**Preconditions**:

- User is logged in
- Network can be disabled or API can be made unavailable

**Test Steps**:

1. Disable network connection (or simulate API failure)
2. Attempt to create a dispute
3. Attempt to upload evidence
4. Attempt to view dispute details
5. Observe error messages

**Expected Results**:

- ✅ Each failed action shows appropriate error message
- ✅ Error messages are user-friendly (not technical)
- ✅ Error messages appear as toast notifications
- ✅ User can retry the action after network is restored
- ✅ No console errors that expose technical details to users
- ✅ UI remains functional (not broken)
- ✅ Error messages indicate the action that failed

**Test Data**:

- Network failure simulation
- API error responses (500, 503, timeout, etc.)

**Priority**: High  
**Requirement Reference**: Non-Functional Requirements - Reliability

---

### Scenario 32: Error Handling - Validation Errors

**User Story**: As a user, I want to see validation errors when I provide invalid data.

**Preconditions**:

- User is logged in
- User is attempting to create a dispute or upload evidence

**Test Steps**:

1. Attempt to create dispute with empty description
2. Attempt to create dispute with description exceeding 1000 characters
3. Attempt to upload evidence with invalid file type
4. Attempt to upload evidence with file exceeding 10MB
5. Attempt to resolve dispute without selecting outcome
6. Observe validation errors

**Expected Results**:

- ✅ Empty description shows validation error: "Description is required"
- ✅ Description exceeding limit shows validation error: "Description must be less than 1000 characters"
- ✅ Invalid file type shows validation error: "Invalid file type. Only JPEG, PNG, and WebP images are supported."
- ✅ File too large shows validation error: "File size exceeds 10MB limit"
- ✅ Missing resolution outcome shows validation error: "Resolution outcome is required"
- ✅ Validation errors appear inline (near input field) or as toast
- ✅ Validation errors are clear and actionable
- ✅ User can correct errors and retry
- ✅ No API calls are made for invalid data

**Test Data**:

- Empty strings
- Text exceeding limits
- Invalid file types
- Files exceeding size limits
- Missing required fields

**Priority**: High  
**Requirement Reference**: Non-Functional Requirements - Usability

---

### Scenario 33: Performance - Dispute Creation

**User Story**: As a user, I want dispute creation to complete quickly so that I don't have to wait long.

**Preconditions**:

- User is logged in
- User has a valid rental for dispute creation
- Network conditions are normal

**Test Steps**:

1. Navigate to dispute creation form
2. Fill in dispute form
3. Submit dispute
4. Measure time from submission to success message
5. Verify performance meets requirements

**Expected Results**:

- ✅ Dispute creation completes within 2 seconds (95th percentile)
- ✅ Loading state is displayed during creation
- ✅ User receives feedback quickly
- ✅ No noticeable lag or freezing

**Test Data**:

- Valid dispute creation data
- Normal network conditions

**Priority**: Medium  
**Requirement Reference**: Non-Functional Requirements - Performance

---

### Scenario 34: Performance - Evidence Upload

**User Story**: As a user, I want evidence uploads to complete quickly so that I can submit my documentation efficiently.

**Preconditions**:

- User is logged in
- User has a dispute with status "OPEN"
- User has image files ready (various sizes)

**Test Steps**:

1. Navigate to dispute details page
2. Upload a 5MB image
3. Measure time from upload start to success message
4. Upload a 10MB image (maximum size)
5. Measure upload time
6. Verify performance meets requirements

**Expected Results**:

- ✅ 5MB image upload completes within 5 seconds (95th percentile)
- ✅ 10MB image upload completes within 5 seconds (95th percentile)
- ✅ Progress indicator shows upload progress
- ✅ Upload doesn't block UI interaction
- ✅ Multiple uploads can be queued

**Test Data**:

- Image files: 5MB, 10MB
- Normal network conditions

**Priority**: Medium  
**Requirement Reference**: Non-Functional Requirements - Performance

---

### Scenario 35: Performance - Dispute List Page

**User Story**: As a user, I want the disputes list page to load quickly even when I have many disputes.

**Preconditions**:

- User is logged in
- User has 20+ disputes in various statuses
- User navigates to disputes list page

**Test Steps**:

1. Navigate to disputes list page
2. Measure page load time
3. Test filtering performance
4. Test sorting performance
5. Test pagination performance
6. Verify performance meets requirements

**Expected Results**:

- ✅ Disputes list page loads within 2 seconds (95th percentile)
- ✅ Filtering completes within 1 second
- ✅ Sorting completes within 1 second
- ✅ Pagination works smoothly
- ✅ No noticeable lag or freezing

**Test Data**:

- User with 20-50 disputes
- Various statuses and filters

**Priority**: Medium  
**Requirement Reference**: Non-Functional Requirements - Performance

---

### Scenario 36: Mobile Responsiveness

**User Story**: As a mobile user, I want to use all dispute features on my mobile device.

**Preconditions**:

- User is logged in on mobile device
- User has disputes
- Mobile viewport is active

**Test Steps**:

1. Open disputes list page on mobile device (or resize browser to mobile width)
2. Verify layout is responsive
3. Test creating a dispute
4. Test uploading evidence
5. Test viewing dispute details
6. Test admin actions (if admin)
7. Test all interactions

**Expected Results**:

- ✅ Layout adapts to mobile screen size
- ✅ All buttons and actions are accessible
- ✅ Forms are usable on mobile
- ✅ Touch interactions work correctly
- ✅ Modals and dialogs are mobile-friendly
- ✅ Navigation works smoothly
- ✅ No horizontal scrolling required
- ✅ Text is readable without zooming
- ✅ Image uploads work on mobile
- ✅ File selection works on mobile

**Test Data**:

- Mobile device or mobile viewport (375px, 414px widths)
- Various screen sizes

**Priority**: Medium  
**Requirement Reference**: Non-Functional Requirements - Usability

---

### Scenario 37: Notification Delivery

**User Story**: As a user, I want to receive notifications for all dispute events so I stay informed about dispute status.

**Preconditions**:

- User has in-app notifications enabled
- Various dispute actions can be performed

**Test Steps**:

1. **Dispute Created**:
   - Create dispute as renter
   - Verify provider receives notification
   - Verify renter receives notification

2. **Evidence Requested**:
   - Admin requests evidence
   - Verify user receives notification

3. **Evidence Deadline Approaching**:
   - Wait for deadline to approach (24 hours before)
   - Verify notification is sent

4. **Evidence Deadline Expired**:
   - Deadline expires
   - Verify notification is sent

5. **Dispute Resolved**:
   - Admin resolves dispute
   - Verify both parties receive notifications

**Expected Results**:

- ✅ All dispute events trigger appropriate notifications
- ✅ In-app notifications appear immediately
- ✅ Notification content is accurate and includes relevant details
- ✅ Notification links navigate to correct pages (dispute details)
- ✅ Notification badges update correctly
- ✅ Notifications are not duplicated
- ✅ Notification delivery is non-blocking (doesn't delay action completion)

**Test Data**:

- User accounts with notifications enabled
- Various dispute statuses and actions

**Priority**: High  
**Requirement Reference**: Requirement 11.4 - Notifications

---

### Scenario 38: Audit Trail Verification

**User Story**: As a system, I want to maintain a complete audit trail of all dispute actions for compliance.

**Preconditions**:

- System has disputes with various actions performed
- Admin user is logged in

**Test Steps**:

1. Navigate to dispute details page
2. View audit logs/timeline
3. Verify all actions are logged:
   - Dispute creation
   - State transitions
   - Evidence uploads
   - Financial operations
   - Internal notes
   - Resolution

**Expected Results**:

- ✅ All dispute actions are logged in audit trail
- ✅ Audit logs include:
  - Action type
  - Timestamp
  - User ID (who performed action)
  - Previous state (for state changes)
  - New state (for state changes)
  - Details (JSON for action-specific data)
  - Reason (if provided)
- ✅ Audit logs are immutable (no updates or deletions)
- ✅ Audit logs are ordered chronologically
- ✅ Audit logs are queryable by dispute ID
- ✅ Policy version is stored with dispute

**Test Data**:

- Dispute with multiple actions performed
- Various action types

**Priority**: Medium  
**Requirement Reference**: Requirement 8 - Audit Trail and Compliance

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test data is prepared (rentals, disputes, users)
- [ ] Test user accounts are created (renters, providers, admins)
- [ ] Payment methods are configured (test cards)
- [ ] Stripe test mode is enabled
- [ ] Vercel Blob storage is configured
- [ ] Notification system is functional
- [ ] Database is seeded with test disputes
- [ ] Test disputes in various states are created

### Test Environment

- **Environment**: Staging/Production
- **Browser**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Database**: PostgreSQL with test data
- **Payment**: Stripe test mode
- **Storage**: Vercel Blob (test environment)

### Test Execution

- [ ] Execute all test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios
- [ ] Test on multiple browsers
- [ ] Test on mobile devices
- [ ] Test with various user roles (renter, provider, admin)
- [ ] Test edge cases and error conditions

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Verify performance metrics meet targets
- [ ] Verify security requirements are met
- [ ] Sign off on feature acceptance
- [ ] Prepare test summary report

## Acceptance Criteria Summary

The Disputes feature SHALL be considered accepted when:

1. ✅ Dispute creation works correctly with eligibility checks and time window validation
2. ✅ Only one active dispute exists per rental at a time
3. ✅ Role-based eligibility is enforced (renter or provider only)
4. ✅ Time-window enforcement prevents disputes outside allowed periods
5. ✅ Evidence can be uploaded with deadlines enforced
6. ✅ Disputes progress through state machine with validated transitions
7. ✅ Admins can resolve disputes with financial operations through Stripe
8. ✅ Audit trail captures all dispute actions and changes
9. ✅ Rate limiting prevents abuse of the dispute system
10. ✅ Users receive notifications for dispute events
11. ✅ Rental UI reflects dispute status
12. ✅ Evidence is retained permanently for compliance
13. ✅ Policy version is stored with each dispute
14. ✅ All MVP features (manual resolution, images/text only, no appeals) are functional
15. ✅ Performance meets requirements (dispute creation < 2s, evidence upload < 5s, etc.)
16. ✅ Mobile experience is functional and responsive
17. ✅ Error handling provides clear, user-friendly feedback
18. ✅ Security requirements are met (authentication, authorization, input validation)

## Known Issues and Limitations

_To be filled during test execution_

## Test Sign-Off

- **Test Executor**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Business Stakeholder**: **\*\*\***\_**\*\*\*** Date: **\_\_\_**
- **Product Owner**: **\*\*\***\_**\*\*\*** Date: **\_\_\_**
- **Technical Lead**: **\*\*\***\_**\*\*\*** Date: **\_\_\_**

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Next Review**: After test execution
