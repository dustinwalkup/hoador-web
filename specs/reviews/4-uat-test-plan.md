# Reviews API Routes Migration - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Reviews API Routes Migration (Phase 5). UAT validates that the review functionality works correctly after migrating from server actions to API routes with React Query. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Reviews API Routes Migration (Phase 5)  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Migration Plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Requirements: `specs/reviews/1-requirements.md` (if exists)
- Design: `specs/reviews/2-design.md` (if exists)
- Implementation Tasks: `specs/reviews/3-tasks.md` (if exists)

## Test Objectives

1. Verify that review creation works correctly with API routes and React Query
2. Validate that review form validation prevents invalid submissions
3. Confirm that reviews appear immediately after creation (optimistic updates)
4. Ensure that React Query caching provides instant navigation and updates
5. Verify that error handling provides clear user feedback
6. Validate that reviews are correctly associated with rentals or rental requests
7. Confirm that optional rating fields work correctly
8. Ensure that all review functionality maintains existing behavior

## Test Scenarios

### Scenario 1: Create Review - Happy Path (Renter Review)

**User Story**: As a renter, I want to leave a review for a completed rental so that I can share my experience with the tool and owner.

**Preconditions**:

- User is logged in and authenticated
- User has a completed rental in "Renting" → "Completed" tab
- Rental is eligible for review (not already reviewed)
- User navigates to rental detail page

**Test Steps**:

1. Log in as renter
2. Navigate to "Renting" → "Completed" tab
3. Click on a completed rental to view details
4. Verify "Leave a Review" button is visible
5. Click "Leave a Review" button
6. Verify review modal opens
7. Select overall rating: 5 stars
8. Enter comment: "Excellent tool! Very well maintained and exactly as described. Owner was responsive and helpful throughout the rental period."
9. Optionally select accuracy rating: 5 stars
10. Optionally select listing condition rating: 5 stars
11. Optionally select owner communication rating: 5 stars
12. Click "Submit Review" button
13. Verify success message appears
14. Verify modal closes automatically
15. Verify review appears on rental detail page immediately

**Expected Results**:

- ✅ Review modal opens correctly
- ✅ All rating fields are functional (overall rating is required)
- ✅ Comment field accepts text (minimum 10 characters)
- ✅ Optional rating fields (accuracy, condition, communication) work correctly
- ✅ Form validation prevents submission with invalid data
- ✅ Upon submission, user sees success toast notification: "Review submitted successfully"
- ✅ Modal closes automatically after successful submission
- ✅ Review appears on rental detail page immediately (optimistic update)
- ✅ Review is visible to listing owner
- ✅ Review appears in rental reviews section
- ✅ Review data is persisted correctly in database
- ✅ Review cannot be edited or deleted after submission

**Test Data**:

- Completed rental eligible for review
- Valid review data (rating 1-5, comment 10-2000 characters)
- Optional ratings (1-5 stars each)

**Priority**: Critical  
**Requirement Reference**: Phase 5 - Create Review

---

### Scenario 2: Create Review - Owner Review

**User Story**: As a tool owner, I want to leave a review for a renter after a completed rental so that I can share my experience.

**Preconditions**:

- Owner is logged in and authenticated
- Owner has a completed rental in "Lending" → "Completed" tab
- Rental is eligible for review (not already reviewed)
- Owner navigates to rental detail page

**Test Steps**:

1. Log in as listing owner
2. Navigate to "Lending" → "Completed" tab
3. Click on a completed rental to view details
4. Verify "Leave a Review" button is visible
5. Click "Leave a Review" button
6. Verify review modal opens
7. Select overall rating: 4 stars
8. Enter comment: "Renter took good care of the tool and returned it on time. Would rent to again."
9. Optionally select accuracy rating: 4 stars
10. Optionally select listing condition rating: 5 stars
11. Optionally select owner communication rating: 4 stars
12. Click "Submit Review" button
13. Verify success message appears
14. Verify modal closes automatically
15. Verify review appears on rental detail page immediately

**Expected Results**:

- ✅ Review modal opens correctly for owner
- ✅ All rating fields work the same as renter reviews
- ✅ Review is submitted successfully
- ✅ Review appears immediately on rental detail page
- ✅ Review is visible to renter
- ✅ Review data is persisted correctly
- ✅ Owner and renter reviews are both visible on the rental detail page

**Test Data**:

- Completed rental eligible for review
- Valid review data from owner perspective

**Priority**: Critical  
**Requirement Reference**: Phase 5 - Create Review (Owner)

---

### Scenario 3: Create Review - Validation Errors

**User Story**: As a user, I want clear validation errors when I submit invalid review data so I understand what needs to be fixed.

**Preconditions**:

- User is logged in
- User has a completed rental eligible for review
- User opens review modal

**Test Steps**:

1. Open review modal for completed rental
2. Attempt to submit without selecting overall rating
3. Attempt to submit with comment less than 10 characters: "Good"
4. Attempt to submit with comment exceeding 2000 characters (very long text)
5. Select overall rating: 5 stars
6. Enter valid comment: "Great experience overall!"
7. Attempt to submit with invalid optional rating (e.g., 0 or 6 stars if UI allows)
8. Submit with all valid data
9. Verify submission succeeds

**Expected Results**:

- ✅ Form prevents submission without overall rating
- ✅ Error message: "Please select an overall rating"
- ✅ Error message for comment less than 10 characters: "Comment must be at least 10 characters"
- ✅ Error message for comment exceeding 2000 characters: "Comment must be less than 2000 characters"
- ✅ Optional rating fields validate range (1-5) if values are provided
- ✅ Error messages appear near the relevant fields
- ✅ Error messages are clear and actionable
- ✅ Form allows submission with valid data

**Test Data**:

- Invalid rating (missing)
- Invalid comment (too short: "Good")
- Invalid comment (too long: 2001+ characters)
- Valid review data for comparison

**Priority**: High  
**Requirement Reference**: Phase 5 - Review Validation

---

### Scenario 4: Create Review - Optional Rating Fields

**User Story**: As a user, I want to optionally provide detailed ratings for accuracy, condition, and communication without being required to fill them all.

**Preconditions**:

- User is logged in
- User has a completed rental eligible for review
- User opens review modal

**Test Steps**:

1. Open review modal
2. Select overall rating: 4 stars
3. Enter comment: "Good rental experience overall."
4. Leave all optional ratings (accuracy, condition, communication) unselected
5. Submit review
6. Verify review is created successfully
7. Open review modal again for another rental
8. Select overall rating: 5 stars
9. Enter comment: "Excellent experience in all aspects."
10. Select only accuracy rating: 5 stars
11. Leave condition and communication ratings unselected
12. Submit review
13. Verify review is created successfully
14. Open review modal for third rental
15. Select overall rating: 3 stars
16. Enter comment: "Average experience with some issues."
17. Select all optional ratings: accuracy (3), condition (4), communication (3)
18. Submit review
19. Verify review is created successfully

**Expected Results**:

- ✅ Review can be submitted with only overall rating and comment
- ✅ Review can be submitted with some optional ratings selected
- ✅ Review can be submitted with all optional ratings selected
- ✅ Optional ratings are truly optional (not required)
- ✅ Selected optional ratings are saved correctly
- ✅ Unselected optional ratings are stored as null/undefined
- ✅ All review variations are displayed correctly on rental detail page

**Test Data**:

- Review with no optional ratings
- Review with partial optional ratings
- Review with all optional ratings

**Priority**: Medium  
**Requirement Reference**: Phase 5 - Optional Rating Fields

---

### Scenario 5: Create Review - Rental Request vs Rental ID

**User Story**: As a system, I want to correctly associate reviews with either rental requests or completed rentals.

**Preconditions**:

- User is logged in
- User has both rental requests and completed rentals eligible for review
- System supports both rentalId and requestId for reviews

**Test Steps**:

1. Navigate to a completed rental (uses rentalId)
2. Open review modal
3. Submit review with valid data
4. Verify review is associated with correct rental
5. Navigate to a rental request (uses requestId)
6. Open review modal
7. Submit review with valid data
8. Verify review is associated with correct rental request
9. Verify both reviews appear in correct locations
10. Verify reviews are linked to correct rental/request records

**Expected Results**:

- ✅ Reviews can be created for rentals (rentalId)
- ✅ Reviews can be created for rental requests (requestId)
- ✅ Reviews are correctly associated with the right rental/request
- ✅ Review appears on correct rental detail page
- ✅ Review data includes correct rental/request reference
- ✅ System handles both rentalId and requestId correctly

**Test Data**:

- Completed rental with rentalId
- Rental request with requestId
- Valid review data for both

**Priority**: High  
**Requirement Reference**: Phase 5 - Review Association

---

### Scenario 6: React Query Caching and Instant Updates

**User Story**: As a user, I want instant navigation and updates when viewing reviews so that the app feels fast and responsive.

**Preconditions**:

- User is logged in
- User has viewed rental detail pages previously (cache exists)
- User has created reviews previously

**Test Steps**:

1. Log in as user with completed rentals
2. Navigate to "Renting" → "Completed" tab
3. Wait for data to load (first load)
4. Click on a rental to view details
5. Wait for rental details to load (first load)
6. Navigate back to "Completed" tab
7. Navigate to same rental detail page again
8. Verify data loads instantly from cache
9. Create a new review
10. Verify review appears immediately (optimistic update)
11. Navigate away and back to rental detail page
12. Verify review is still visible (persisted)
13. Navigate to another rental detail page
14. Navigate back to first rental
15. Verify data loads instantly from cache

**Expected Results**:

- ✅ First load shows loading state appropriately
- ✅ Subsequent navigation to same rental shows cached data instantly (no loading spinner)
- ✅ Background refetch updates data without blocking UI
- ✅ New review appears immediately after creation (optimistic update)
- ✅ Review persists after navigation (not just optimistic)
- ✅ Tab switching is instant with cached data
- ✅ Rental detail pages load instantly from cache
- ✅ Data refreshes in background to ensure freshness
- ✅ No flickering or loading states on cached data

**Test Data**:

- User with multiple completed rentals
- Multiple reviews on different rentals

**Priority**: High  
**Requirement Reference**: Phase 5 - React Query Performance

---

### Scenario 7: Error Handling and User Feedback

**User Story**: As a user, I want clear error messages when review submission fails so I understand what went wrong and can try again.

**Preconditions**:

- User is logged in
- User has a completed rental eligible for review
- Various error conditions can be triggered

**Test Steps**:

1. **Network Error**:
   - Disconnect network
   - Open review modal
   - Fill out review form
   - Attempt to submit
   - Verify error message

2. **API Error**:
   - Submit review with invalid rentalId/requestId
   - Verify error message

3. **Validation Error**:
   - Attempt to submit with comment less than 10 characters
   - Verify validation error

4. **Authorization Error**:
   - Attempt to submit review for rental user doesn't have access to
   - Verify error message

5. **Duplicate Review Error**:
   - Submit review for rental already reviewed
   - Verify error message

**Expected Results**:

- ✅ Network errors show: "Network error" or "Failed to connect. Please check your internet connection."
- ✅ API errors show specific error message from server
- ✅ Validation errors show field-specific messages
- ✅ Authorization errors show: "Unauthorized" or "You don't have permission to review this rental"
- ✅ Duplicate review errors show: "You have already submitted a review for this rental"
- ✅ All errors appear as toast notifications
- ✅ Error messages are user-friendly (not technical)
- ✅ Error messages include actionable guidance when possible
- ✅ Error toast duration is appropriate (5 seconds for errors)
- ✅ Form remains open on error so user can fix and retry

**Test Data**:

- Various error conditions
- Invalid data
- Network disconnection
- Authorization failures
- Duplicate review attempts

**Priority**: High  
**Requirement Reference**: Phase 5 - Error Handling

---

### Scenario 8: Review Display and Visibility

**User Story**: As a user, I want to see reviews clearly displayed on rental detail pages so I can understand the rental experience.

**Preconditions**:

- User is logged in
- Rental has reviews from both renter and owner
- User navigates to rental detail page

**Test Steps**:

1. Navigate to rental detail page with reviews
2. Verify reviews section is visible
3. Verify both renter and owner reviews are displayed
4. Verify review displays include:
   - Overall rating (stars)
   - Comment text
   - Optional ratings (if provided)
   - Reviewer name/role
   - Review date
5. Verify reviews are ordered by date (newest first or oldest first)
6. Verify review formatting is readable
7. Verify long comments are displayed fully or with expand/collapse
8. Verify optional ratings are only shown if provided

**Expected Results**:

- ✅ Reviews section is visible on rental detail page
- ✅ Both renter and owner reviews are displayed
- ✅ Overall rating is displayed as stars (visual representation)
- ✅ Comment text is fully readable
- ✅ Optional ratings are displayed only if provided
- ✅ Reviewer information is shown (name, role)
- ✅ Review date is shown and formatted correctly
- ✅ Reviews are properly ordered
- ✅ Long comments are handled gracefully (truncated with expand or scrollable)
- ✅ Review formatting is consistent and professional

**Test Data**:

- Rental with multiple reviews
- Reviews with and without optional ratings
- Reviews with long and short comments

**Priority**: High  
**Requirement Reference**: Phase 5 - Review Display

---

### Scenario 9: Review Policy Link and Information

**User Story**: As a user, I want to access review policy information so I understand the review guidelines.

**Preconditions**:

- User is logged in
- User opens review modal
- Review policy URL is configured

**Test Steps**:

1. Open review modal
2. Verify review policy link is visible (if configured)
3. Click on review policy link
4. Verify policy page opens in new tab or modal
5. Verify policy information is accessible
6. Close policy page/modal
7. Verify review modal is still open
8. Complete and submit review

**Expected Results**:

- ✅ Review policy link is visible in review modal (if configured)
- ✅ Policy link opens in new tab or accessible modal
- ✅ Policy information is readable and helpful
- ✅ Closing policy doesn't close review modal
- ✅ User can return to review form after viewing policy
- ✅ Review submission works normally after viewing policy

**Test Data**:

- Review policy URL configured
- Review modal with policy link

**Priority**: Low  
**Requirement Reference**: Phase 5 - Review Policy

---

### Scenario 10: Mobile Responsiveness

**User Story**: As a mobile user, I want review functionality to work correctly on mobile devices.

**Preconditions**:

- User is on mobile device or mobile browser view
- User is logged in
- User has completed rentals

**Test Steps**:

1. Open app on mobile device
2. Navigate to "Renting" → "Completed" tab
3. Click on a completed rental
4. Click "Leave a Review" button
5. Verify review modal opens and is properly sized
6. Fill out review form on mobile
7. Select ratings using touch interface
8. Enter comment using mobile keyboard
9. Submit review
10. Verify review appears correctly on mobile
11. Verify all review display elements are readable on mobile

**Expected Results**:

- ✅ Review modal is mobile-responsive
- ✅ Modal fits within mobile screen without horizontal scrolling
- ✅ Rating stars are appropriately sized for touch (at least 44x44 pixels)
- ✅ Comment textarea is usable on mobile
- ✅ Submit button is easily tappable
- ✅ Text is readable without zooming
- ✅ Review display on rental detail page is mobile-friendly
- ✅ No UI elements are cut off or inaccessible
- ✅ Touch targets meet accessibility standards

**Test Data**:

- Mobile device (iOS/Android)
- Mobile browser view (Chrome DevTools)

**Priority**: Medium  
**Requirement Reference**: Phase 5 - Mobile Support

---

### Scenario 11: Concurrent Review Submissions

**User Story**: As a system, I want to handle concurrent review submissions correctly to prevent duplicate reviews.

**Preconditions**:

- User has a completed rental eligible for review
- User opens review modal

**Test Steps**:

1. Open review modal
2. Fill out review form
3. Click "Submit Review" button multiple times rapidly
4. Verify system handles multiple clicks correctly
5. Verify only one review is created
6. Verify loading state prevents duplicate submissions
7. Verify success message appears once

**Expected Results**:

- ✅ Multiple rapid clicks on submit button are handled correctly
- ✅ Submit button is disabled during submission (loading state)
- ✅ Only one review is created
- ✅ Success message appears once
- ✅ No duplicate reviews in database
- ✅ UI updates correctly after single submission
- ✅ Loading state prevents accidental duplicate submissions

**Test Data**:

- Completed rental eligible for review
- Rapid multiple clicks on submit button

**Priority**: Medium  
**Requirement Reference**: Phase 5 - Concurrency Handling

---

### Scenario 12: Review Form Reset After Submission

**User Story**: As a user, I want the review form to reset after successful submission so I can leave another review if needed.

**Preconditions**:

- User is logged in
- User has multiple completed rentals
- User opens review modal

**Test Steps**:

1. Open review modal for first rental
2. Fill out review form completely
3. Submit review successfully
4. Verify modal closes
5. Open review modal for second rental
6. Verify form is empty/reset (no previous data)
7. Fill out and submit second review
8. Verify both reviews are created correctly

**Expected Results**:

- ✅ Review form resets after successful submission
- ✅ All fields are cleared (rating, comment, optional ratings)
- ✅ Opening modal for new rental shows empty form
- ✅ Previous review data doesn't persist in form
- ✅ Each review submission is independent
- ✅ Multiple reviews can be created in sequence

**Test Data**:

- Multiple completed rentals
- Sequential review submissions

**Priority**: Low  
**Requirement Reference**: Phase 5 - Form Reset

---

### Scenario 13: Review Submission Loading States

**User Story**: As a user, I want to see clear loading feedback when submitting a review so I know the action is processing.

**Preconditions**:

- User is logged in
- User has a completed rental eligible for review
- User opens review modal

**Test Steps**:

1. Open review modal
2. Fill out review form
3. Click "Submit Review" button
4. Verify loading state appears immediately
5. Verify submit button shows loading indicator
6. Verify submit button is disabled during submission
7. Wait for submission to complete
8. Verify loading state disappears
9. Verify success message appears

**Expected Results**:

- ✅ Loading state appears immediately on submit click
- ✅ Submit button shows loading indicator (spinner or "Submitting..." text)
- ✅ Submit button is disabled during submission
- ✅ Form fields are disabled or read-only during submission
- ✅ Loading state is clear and visible
- ✅ Loading state disappears after successful submission
- ✅ Success message appears after loading completes
- ✅ If error occurs, loading state disappears and error is shown

**Test Data**:

- Completed rental eligible for review
- Normal and slow network conditions

**Priority**: Medium  
**Requirement Reference**: Phase 5 - Loading States

---

### Scenario 14: Review Cache Invalidation

**User Story**: As a system, I want to invalidate review-related caches when new reviews are created so users see updated data.

**Preconditions**:

- User is logged in
- User has viewed rental detail pages (cache exists)
- User creates a new review

**Test Steps**:

1. Navigate to rental detail page
2. Verify current reviews are displayed
3. Create a new review
4. Verify review appears immediately (optimistic update)
5. Navigate away from rental detail page
6. Navigate back to rental detail page
7. Verify new review is still visible (cache updated)
8. Navigate to "Renting" → "Completed" tab
9. Verify rental list shows updated review count (if displayed)
10. Verify cache invalidation works correctly

**Expected Results**:

- ✅ New review triggers cache invalidation
- ✅ Review appears immediately after creation
- ✅ Review persists after navigation (not just optimistic)
- ✅ Related queries are invalidated (rental details, rental lists)
- ✅ Cache updates reflect new review data
- ✅ No stale data is displayed
- ✅ Background refetch ensures data freshness

**Test Data**:

- Rental with existing reviews
- New review creation
- Multiple cached queries

**Priority**: High  
**Requirement Reference**: Phase 5 - Cache Invalidation

---

### Scenario 15: Review Character Limits and Formatting

**User Story**: As a user, I want to know character limits for review comments so I can write appropriate reviews.

**Preconditions**:

- User is logged in
- User opens review modal

**Test Steps**:

1. Open review modal
2. Verify comment field shows character count (if implemented)
3. Enter comment with exactly 10 characters (minimum)
4. Verify validation allows submission
5. Enter comment with exactly 2000 characters (maximum)
6. Verify validation allows submission
7. Enter comment with 2001 characters
8. Verify validation prevents submission
9. Verify character count updates as user types (if implemented)
10. Verify long comments are displayed correctly on rental detail page

**Expected Results**:

- ✅ Comment field enforces minimum 10 characters
- ✅ Comment field enforces maximum 2000 characters
- ✅ Character count indicator is visible (if implemented)
- ✅ Character count updates in real-time (if implemented)
- ✅ Validation messages are clear
- ✅ Long comments are displayed correctly (truncated or scrollable)
- ✅ Comment formatting is preserved (line breaks, etc.)

**Test Data**:

- Comment with 10 characters (minimum)
- Comment with 2000 characters (maximum)
- Comment with 2001+ characters (should fail)
- Comment with various formatting

**Priority**: Medium  
**Requirement Reference**: Phase 5 - Character Limits

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test data is prepared (completed rentals, rental requests)
- [ ] Test user accounts are created (renters, owners)
- [ ] Review policy URL is configured (if applicable)
- [ ] API routes are deployed and functional
- [ ] React Query hooks are implemented and working

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

The Phase 5 migration SHALL be considered accepted when:

1. ✅ Review creation works correctly with API routes and React Query
2. ✅ Review form validation prevents invalid submissions with clear error messages
3. ✅ Reviews appear immediately after creation (optimistic updates)
4. ✅ React Query provides instant navigation and cached data
5. ✅ Error handling provides clear, user-friendly feedback
6. ✅ Reviews are correctly associated with rentals or rental requests
7. ✅ Optional rating fields work correctly (truly optional)
8. ✅ All review functionality maintains existing behavior
9. ✅ Performance is acceptable with expected load
10. ✅ Mobile experience is functional and responsive
11. ✅ Cache invalidation works correctly after review creation
12. ✅ No regression in existing review functionality

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
