# Rentals API Routes Migration - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Rentals API Routes Migration (Phase 3). UAT validates that the rental functionality works correctly after migrating from server actions to API routes with React Query. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Rentals API Routes Migration (Phase 3)  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Migration Plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Requirements: `specs/rentals/1-requirements.md`
- Design: `specs/rentals/2-design.md`
- Implementation Tasks: `specs/rentals/3-tasks.md`

## Test Objectives

1. Verify that rental request creation works correctly with legal document tracking
2. Validate that rental approval process handles payments correctly
3. Confirm that rental status transitions work smoothly (pending → approved → active → completed)
4. Ensure that notifications are sent correctly for all rental actions
5. Verify that React Query caching provides instant navigation and updates
6. Validate that error handling provides clear user feedback
7. Confirm that all rental actions maintain existing functionality

## Test Scenarios

### Scenario 1: Create Rental Request - Happy Path

**User Story**: As a renter, I want to create a rental request for a tool so that I can borrow it from the owner.

**Preconditions**:

- User is logged in and authenticated
- User has a valid payment method on file
- User is viewing an available listing
- Listing owner has completed Stripe onboarding

**Test Steps**:

1. Navigate to a listing detail page
2. Click "Rent This Tool" button
3. Select rental dates (start and end date)
4. Choose delivery method (pickup or delivery)
5. If delivery selected, enter delivery address
6. Optionally request setup service
7. Enter optional message to owner
8. Review pricing breakdown
9. Accept legal documents (Rental Agreement, Safety & Liability Package, Payments & Payouts)
10. Select payment method
11. Submit rental request

**Expected Results**:

- ✅ Rental request form loads correctly
- ✅ Date selection works and validates date ranges
- ✅ Pricing calculates correctly (daily rate, delivery fee, setup fee, security deposit)
- ✅ Legal document checkboxes are required and functional
- ✅ Payment method selection works
- ✅ Form validation prevents submission with invalid data
- ✅ Upon submission, user sees success message: "Rental request submitted successfully!"
- ✅ User is redirected to rental detail page (`/dashboard/rental/{requestId}`)
- ✅ Rental request appears in "Renting" → "Requests" tab
- ✅ Listing owner receives notification (in-app and email)
- ✅ Legal document acceptances are recorded with IP and user agent
- ✅ Rental request status is "pending"

**Test Data**:

- Available listing with valid pricing
- Valid date range (within listing's min/max rental period)
- Complete delivery address (if delivery selected)
- Valid payment method

**Priority**: Critical  
**Requirement Reference**: Phase 3 - Create Rental Request

---

### Scenario 2: Create Rental Request - Validation Errors

**User Story**: As a renter, I want clear validation errors when I submit invalid rental request data.

**Preconditions**:

- User is logged in
- User is on rental request form

**Test Steps**:

1. Navigate to rental request form
2. Attempt to submit without selecting dates
3. Attempt to submit with end date before start date
4. Attempt to submit with dates outside listing's rental period
5. Select delivery but leave address fields empty
6. Request setup service without selecting delivery
7. Submit without accepting legal documents
8. Submit without selecting payment method

**Expected Results**:

- ✅ Form prevents submission with missing dates
- ✅ Error message: "End date must be after start date"
- ✅ Error message for dates outside rental period
- ✅ Error message: "Delivery address is required when delivery is requested"
- ✅ Error message: "Setup service requires delivery to be selected"
- ✅ Error message: "You must accept the Rental Agreement and all policies to continue"
- ✅ Error message for missing payment method
- ✅ Error messages are clear and actionable
- ✅ Error messages appear near the relevant fields

**Test Data**:

- Invalid date combinations
- Incomplete form data
- Missing required fields

**Priority**: High  
**Requirement Reference**: Phase 3 - Create Rental Request Validation

---

### Scenario 3: Approve Rental Request - Successful Payment

**User Story**: As a tool owner, I want to approve rental requests and process payment so that renters can use my tools.

**Preconditions**:

- Owner is logged in
- Owner has at least one pending rental request
- Renter has valid payment method on file
- Owner has completed Stripe onboarding

**Test Steps**:

1. Log in as listing owner
2. Navigate to "Lending" → "Incoming" tab
3. View pending rental request
4. Click "Approve" button
5. Enter optional pickup instructions (if not delivery)
6. Enter optional return instructions (if not delivery)
7. Click "Approve & Charge Payment" button
8. Wait for payment processing
9. Verify success message

**Expected Results**:

- ✅ Pending rental requests are visible in "Incoming" tab
- ✅ Approve button is functional
- ✅ Instructions fields are optional and work correctly
- ✅ Payment processing shows loading state: "Processing Payment..."
- ✅ Success message: "Request approved successfully! Payment has been processed."
- ✅ Rental request status changes to "approved"
- ✅ Renter receives payment success notification (in-app and email)
- ✅ Owner receives payment success notification (in-app and email)
- ✅ Renter receives rental approved notification
- ✅ Security deposit is authorized (if applicable)
- ✅ Rental appears in "Lending" → "Approved" tab
- ✅ Rental appears in renter's "Renting" → "Approved" tab
- ✅ Listing availability is updated

**Test Data**:

- Pending rental request
- Valid payment method on renter's account
- Owner with completed Stripe onboarding
- Optional pickup/return instructions

**Priority**: Critical  
**Requirement Reference**: Phase 3 - Approve Rental Request

---

### Scenario 4: Approve Rental Request - Payment Failure

**User Story**: As a tool owner, I want to see clear error messages when payment processing fails so I understand what went wrong.

**Preconditions**:

- Owner is logged in
- Owner has a pending rental request
- Renter's payment method will fail (insufficient funds, expired card, etc.)

**Test Steps**:

1. Log in as listing owner
2. Navigate to "Lending" → "Incoming" tab
3. View pending rental request with failing payment method
4. Click "Approve" button
5. Enter instructions (optional)
6. Click "Approve & Charge Payment" button
7. Wait for payment processing
8. Verify error message appears

**Expected Results**:

- ✅ Payment processing shows loading state
- ✅ Error message appears: "Payment Failed" with descriptive reason
- ✅ Error message includes: "The renter has been notified to update their payment method."
- ✅ Error message duration is longer (10 seconds) for important message
- ✅ Dialog remains open so owner can see instructions
- ✅ Rental request status remains "pending"
- ✅ Payment status is updated to "failed" with failure reason
- ✅ Renter receives payment failure notification (in-app and email)
- ✅ Owner receives payment failure notification (in-app and email)
- ✅ Renter can update payment method and owner can retry approval

**Test Data**:

- Pending rental request
- Payment method that will fail (test card, insufficient funds, etc.)
- Owner account

**Priority**: High  
**Requirement Reference**: Phase 3 - Approve Rental Request Payment Failure

---

### Scenario 5: Decline Rental Request

**User Story**: As a tool owner, I want to decline rental requests with a reason so that renters understand why their request was not approved.

**Preconditions**:

- Owner is logged in
- Owner has at least one pending rental request

**Test Steps**:

1. Log in as listing owner
2. Navigate to "Lending" → "Incoming" tab
3. View pending rental request
4. Click "Decline Request" button
5. Verify decline dialog appears
6. Attempt to submit without reason (should fail)
7. Enter denial reason: "Tool is already booked for those dates. Please select different dates."
8. Click "Decline Request" button
9. Verify success message

**Expected Results**:

- ✅ Decline button is functional
- ✅ Decline dialog appears with reason field
- ✅ Reason field is required (validation prevents empty submission)
- ✅ Reason field accepts minimum length (e.g., 10 characters)
- ✅ Success message: "Rental request declined"
- ✅ Rental request status changes to "denied"
- ✅ Rental appears in "Lending" → "Denied" tab
- ✅ Rental appears in renter's "Renting" → "Denied" tab
- ✅ Renter receives denial notification with reason (in-app and email)
- ✅ Denial reason is visible to renter on rental detail page

**Test Data**:

- Pending rental request
- Valid denial reason (minimum 10 characters)
- Owner account

**Priority**: High  
**Requirement Reference**: Phase 3 - Decline Rental Request

---

### Scenario 6: Cancel Rental Request (Renter)

**User Story**: As a renter, I want to cancel my pending rental request if my plans change.

**Preconditions**:

- Renter is logged in
- Renter has at least one pending rental request

**Test Steps**:

1. Log in as renter
2. Navigate to "Renting" → "Requests" tab
3. View pending rental request
4. Click "Cancel Request" button
5. Verify cancellation confirmation dialog appears
6. Confirm cancellation
7. Verify success message

**Expected Results**:

- ✅ Cancel button is visible on pending requests
- ✅ Cancellation confirmation dialog appears
- ✅ Confirmation dialog shows listing name and clear message
- ✅ User can cancel the cancellation action
- ✅ Success message: "Rental request cancelled"
- ✅ Rental request is removed from "Requests" tab
- ✅ Rental request status changes to "cancelled"
- ✅ Listing owner receives cancellation notification (in-app and email)
- ✅ Rental no longer appears in owner's "Incoming" tab

**Test Data**:

- Pending rental request owned by test renter
- Renter account

**Priority**: Medium  
**Requirement Reference**: Phase 3 - Cancel Rental Request

---

### Scenario 7: Start Rental (Owner)

**User Story**: As a tool owner, I want to start a rental when the rental period begins so that the renter can pick up the tool.

**Preconditions**:

- Owner is logged in
- Owner has an approved rental request
- Rental start date has been reached

**Test Steps**:

1. Log in as listing owner
2. Navigate to "Lending" → "Approved" tab
3. View approved rental request
4. Verify start date has been reached
5. Click "Start Rental" button
6. Verify confirmation dialog appears
7. Review what happens next information
8. Confirm start rental action
9. Verify success message

**Expected Results**:

- ✅ "Start Rental" button is visible when start date is reached
- ✅ Button is disabled before start date
- ✅ Confirmation dialog shows listing name and renter name
- ✅ Confirmation dialog explains what happens next
- ✅ Success message: "Rental started successfully"
- ✅ Rental status changes from "approved" to "active"
- ✅ Rental appears in "Lending" → "Active" tab
- ✅ Rental appears in renter's "Renting" → "Active" tab
- ✅ Renter receives rental started notification (in-app and email)
- ✅ Rental detail page shows updated status

**Test Data**:

- Approved rental request with start date reached
- Owner account
- Renter account for notification verification

**Priority**: High  
**Requirement Reference**: Phase 3 - Start Rental

---

### Scenario 8: End Rental (Owner)

**User Story**: As a tool owner, I want to end a rental when the tool is returned so that both parties can leave reviews.

**Preconditions**:

- Owner is logged in
- Owner has an active rental
- Tool has been returned

**Test Steps**:

1. Log in as listing owner
2. Navigate to "Lending" → "Active" tab
3. View active rental
4. Click "End Rental" button
5. Verify confirmation dialog appears
6. Review what happens next information
7. Review before ending checklist
8. Confirm end rental action
9. Verify success message

**Expected Results**:

- ✅ "End Rental" button is visible on active rentals
- ✅ Confirmation dialog shows listing name and renter name
- ✅ Confirmation dialog explains what happens next
- ✅ Confirmation dialog shows before ending checklist
- ✅ Success message: "Rental ended successfully"
- ✅ Rental status changes from "active" to "completed"
- ✅ Rental appears in "Lending" → "Completed" tab
- ✅ Rental appears in renter's "Renting" → "Completed" tab
- ✅ Renter receives rental ended notification (in-app and email)
- ✅ Both parties can now leave reviews
- ✅ Security deposit processing can begin

**Test Data**:

- Active rental
- Owner account
- Renter account for notification verification

**Priority**: High  
**Requirement Reference**: Phase 3 - End Rental

---

### Scenario 9: Update Rental Instructions

**User Story**: As a tool owner, I want to update pickup and return instructions for an active rental so that the renter has the latest information.

**Preconditions**:

- Owner is logged in
- Owner has an approved or active rental
- Rental is not delivery-based

**Test Steps**:

1. Log in as listing owner
2. Navigate to rental detail page (approved or active rental)
3. Click "Update Instructions" button
4. Verify update instructions dialog appears
5. Update pickup instructions: "Pick up at front door. Ring doorbell twice."
6. Update return instructions: "Return to same location. Leave in front door area."
7. Click "Update Instructions" button
8. Verify success message

**Expected Results**:

- ✅ "Update Instructions" button is visible on approved/active rentals
- ✅ Update instructions dialog appears with current instructions pre-filled
- ✅ Pickup instructions field is editable
- ✅ Return instructions field is editable
- ✅ Both fields are optional
- ✅ Success message: "Instructions updated successfully"
- ✅ Updated instructions are saved and displayed on rental detail page
- ✅ Renter receives instructions updated notification (in-app and email)
- ✅ Instructions are visible to renter on rental detail page

**Test Data**:

- Approved or active rental (non-delivery)
- Owner account
- Renter account for notification verification

**Priority**: Medium  
**Requirement Reference**: Phase 3 - Update Rental Instructions

---

### Scenario 10: React Query Caching and Instant Navigation

**User Story**: As a user, I want instant navigation between rental pages so that the app feels fast and responsive.

**Preconditions**:

- User is logged in
- User has viewed rental data previously (cache exists)

**Test Steps**:

1. Log in as user with rental history
2. Navigate to "Renting" → "Requests" tab
3. Wait for data to load (first load)
4. Navigate to "Renting" → "Approved" tab
5. Navigate back to "Renting" → "Requests" tab
6. Navigate to a rental detail page
7. Navigate back to "Renting" → "Requests" tab
8. Create a new rental request
9. Navigate to "Renting" → "Requests" tab
10. Verify new request appears immediately

**Expected Results**:

- ✅ First load shows loading state appropriately
- ✅ Subsequent navigation to same tab shows cached data instantly (no loading spinner)
- ✅ Background refetch updates data without blocking UI
- ✅ New rental request appears immediately after creation (optimistic update)
- ✅ Tab switching is instant with cached data
- ✅ Rental detail pages load instantly from cache
- ✅ Data refreshes in background to ensure freshness
- ✅ No flickering or loading states on cached data

**Test Data**:

- User with existing rental history
- Multiple rental requests in different statuses

**Priority**: High  
**Requirement Reference**: Phase 3 - React Query Performance

---

### Scenario 11: Error Handling and User Feedback

**User Story**: As a user, I want clear error messages when rental actions fail so I understand what went wrong and how to fix it.

**Preconditions**:

- User is logged in
- Various error conditions can be triggered

**Test Steps**:

1. **Network Error**:
   - Disconnect network
   - Attempt to create rental request
   - Verify error message

2. **API Error**:
   - Attempt to approve rental with invalid data
   - Verify error message

3. **Validation Error**:
   - Attempt to decline rental without reason
   - Verify validation error

4. **Authorization Error**:
   - Attempt to cancel rental request as non-renter
   - Verify error message

5. **Payment Error**:
   - Attempt to approve rental with failing payment
   - Verify payment-specific error message

**Expected Results**:

- ✅ Network errors show: "Network error" or "Failed to connect"
- ✅ API errors show specific error message from server
- ✅ Validation errors show field-specific messages
- ✅ Authorization errors show: "Unauthorized" or "You don't have permission"
- ✅ Payment errors show payment-specific message with guidance
- ✅ All errors appear as toast notifications
- ✅ Error messages are user-friendly (not technical)
- ✅ Error messages include actionable guidance when possible
- ✅ Error toast duration is appropriate (5 seconds for errors)

**Test Data**:

- Various error conditions
- Invalid data
- Network disconnection
- Authorization failures

**Priority**: High  
**Requirement Reference**: Phase 3 - Error Handling

---

### Scenario 12: Legal Document Acceptance Tracking

**User Story**: As a system, I want to track legal document acceptances with IP and user agent for legal compliance.

**Preconditions**:

- User is creating a rental request
- Legal documents are available

**Test Steps**:

1. Create a rental request
2. Accept all legal documents (Rental Agreement, Safety & Liability Package, Payments & Payouts)
3. Submit rental request
4. Verify rental request is created
5. Check database/logs for legal document acceptance records
6. Verify IP address is recorded
7. Verify user agent is recorded
8. Verify rental request ID is linked to acceptances

**Expected Results**:

- ✅ Legal document acceptances are recorded in database
- ✅ IP address is captured and stored
- ✅ User agent is captured and stored
- ✅ Rental request ID is linked to each acceptance
- ✅ Acceptance context is "rental_checkout"
- ✅ Document versions are recorded correctly
- ✅ Acceptance timestamps are accurate
- ✅ All three documents (if accepted) are recorded separately

**Test Data**:

- Rental request with all legal documents accepted
- Valid IP address and user agent from request headers

**Priority**: Medium  
**Requirement Reference**: Phase 3 - Legal Document Tracking

---

### Scenario 13: Notification Delivery for All Actions

**User Story**: As a user, I want to receive notifications for all rental actions so I stay informed about rental status changes.

**Preconditions**:

- User has email notifications enabled
- User has in-app notifications enabled
- Various rental actions can be performed

**Test Steps**:

1. **Rental Request Created**:
   - Create rental request as renter
   - Verify owner receives notification

2. **Rental Approved**:
   - Approve rental as owner
   - Verify renter receives notifications (payment success + approval)

3. **Rental Declined**:
   - Decline rental as owner
   - Verify renter receives notification with reason

4. **Rental Cancelled**:
   - Cancel rental as renter
   - Verify owner receives notification

5. **Rental Started**:
   - Start rental as owner
   - Verify renter receives notification

6. **Rental Ended**:
   - End rental as owner
   - Verify renter receives notification

7. **Instructions Updated**:
   - Update instructions as owner
   - Verify renter receives notification

**Expected Results**:

- ✅ All rental actions trigger appropriate notifications
- ✅ In-app notifications appear immediately
- ✅ Email notifications are sent within reasonable time (< 1 minute)
- ✅ Notification content is accurate and includes relevant details
- ✅ Notification links navigate to correct pages
- ✅ Notification badges update correctly
- ✅ Notifications are not duplicated
- ✅ Notification delivery is non-blocking (doesn't delay action completion)

**Test Data**:

- User accounts with email and in-app notifications enabled
- Various rental statuses and actions

**Priority**: High  
**Requirement Reference**: Phase 3 - Notifications

---

### Scenario 14: Concurrent Actions and Race Conditions

**User Story**: As a system, I want to handle concurrent rental actions correctly to prevent conflicts and data inconsistencies.

**Preconditions**:

- Multiple users can access the same rental
- Multiple actions can be attempted simultaneously

**Test Steps**:

1. **Concurrent Approvals**:
   - Owner A and Owner B both view same rental request
   - Owner A approves rental
   - Owner B attempts to approve same rental
   - Verify system handles correctly

2. **Concurrent Status Changes**:
   - Owner starts rental
   - Renter views rental detail page simultaneously
   - Verify both see updated status

3. **Concurrent Cancellations**:
   - Renter cancels rental request
   - Owner attempts to approve same request
   - Verify system handles correctly

**Expected Results**:

- ✅ First action succeeds
- ✅ Second action shows appropriate error or updated state
- ✅ No duplicate actions occur
- ✅ Data remains consistent
- ✅ UI updates reflect current state
- ✅ Error messages are clear when actions conflict
- ✅ No data corruption or inconsistent states

**Test Data**:

- Multiple user sessions
- Same rental request/rental
- Concurrent action attempts

**Priority**: Medium  
**Requirement Reference**: Phase 3 - Concurrency Handling

---

### Scenario 15: Mobile Responsiveness

**User Story**: As a mobile user, I want rental functionality to work correctly on mobile devices.

**Preconditions**:

- User is on mobile device or mobile browser view
- User is logged in

**Test Steps**:

1. Open app on mobile device
2. Navigate to rental request form
3. Create rental request
4. View rental detail page
5. Approve/decline rental (as owner)
6. Start/end rental (as owner)
7. Update instructions
8. Cancel rental (as renter)
9. Verify all actions work correctly
10. Verify UI is responsive and usable

**Expected Results**:

- ✅ All rental forms are mobile-responsive
- ✅ Buttons are appropriately sized for touch
- ✅ Text is readable without zooming
- ✅ Forms are easy to fill on mobile
- ✅ Dialogs are properly sized for mobile screens
- ✅ Navigation works correctly on mobile
- ✅ Toast notifications are visible on mobile
- ✅ No horizontal scrolling required
- ✅ Touch targets are at least 44x44 pixels

**Test Data**:

- Mobile device (iOS/Android)
- Mobile browser view (Chrome DevTools)

**Priority**: Medium  
**Requirement Reference**: Phase 3 - Mobile Support

---

### Scenario 16: Performance with Large Datasets

**User Story**: As a user, I want rental pages to load quickly even when I have many rentals.

**Preconditions**:

- User has 50+ rental requests in various statuses
- User is logged in

**Test Steps**:

1. Log in as user with many rentals
2. Navigate to "Renting" → "Requests" tab
3. Measure page load time
4. Navigate to "Renting" → "Approved" tab
5. Measure page load time
6. Navigate to "Lending" → "Incoming" tab
7. Measure page load time
8. Perform rental actions (approve, decline, etc.)
9. Verify actions complete within acceptable time

**Expected Results**:

- ✅ Pages load within 2 seconds with 50+ rentals
- ✅ Rental lists render quickly
- ✅ Actions complete within 1 second
- ✅ No noticeable lag or freezing
- ✅ Pagination works correctly (if implemented)
- ✅ Infinite scroll works smoothly (if implemented)
- ✅ Cache provides instant navigation
- ✅ Background refetch doesn't block UI

**Test Data**:

- User with 50-100 rental requests
- Various rental statuses
- Performance monitoring tools

**Priority**: Medium  
**Requirement Reference**: Phase 3 - Performance

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test data is prepared (listings, rental requests, users)
- [ ] Test user accounts are created (renters, owners, admins)
- [ ] Payment methods are configured (test cards)
- [ ] Stripe test mode is enabled
- [ ] Email service is configured and testable
- [ ] Notification system is functional
- [ ] Legal documents are available in system

### Test Environment

- **Environment**: Staging/Production
- **Browser**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Database**: PostgreSQL with test data
- **Payment**: Stripe test mode

### Test Execution

- [ ] Execute all test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios
- [ ] Test on multiple browsers
- [ ] Test on mobile devices

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Sign off on feature acceptance
- [ ] Prepare test summary report
- [ ] Verify performance metrics meet targets

## Acceptance Criteria Summary

The Phase 3 migration SHALL be considered accepted when:

1. ✅ All rental request creation works correctly with legal document tracking
2. ✅ Rental approval process handles payments correctly (success and failure cases)
3. ✅ All rental status transitions work smoothly
4. ✅ All notifications are sent correctly for rental actions
5. ✅ React Query provides instant navigation and cached data
6. ✅ Error handling provides clear, user-friendly feedback
7. ✅ All rental actions maintain existing functionality
8. ✅ Performance is acceptable with expected load
9. ✅ Mobile experience is functional and responsive
10. ✅ Concurrent actions are handled correctly
11. ✅ Legal document acceptances are tracked with IP/user agent
12. ✅ No regression in existing rental functionality

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
