# Profile API Routes Migration - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Profile API Routes Migration (Phase 6). UAT validates that the profile update functionality works correctly after migrating from server actions to API routes with React Query. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Profile API Routes Migration (Phase 6)  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Migration Plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Requirements: `specs/users/1-requirements.md` (if exists)
- Design: `specs/users/2-design.md` (if exists)
- Implementation Tasks: `specs/users/3-tasks.md` (if exists)

## Test Objectives

1. Verify that profile update works correctly with API routes and React Query
2. Validate that profile form validation prevents invalid submissions
3. Confirm that profile updates appear immediately after submission (optimistic updates)
4. Ensure that React Query caching provides instant navigation and updates
5. Verify that error handling provides clear user feedback
6. Validate that both user profile and address are updated correctly
7. Confirm that optional fields (phone, bio) work correctly
8. Ensure that edit mode toggle works smoothly
9. Verify that form reset/cancel functionality works correctly
10. Ensure that all profile functionality maintains existing behavior

## Test Scenarios

### Scenario 1: Update Profile - Happy Path (All Fields)

**User Story**: As a user, I want to update my profile information and address so that my account information is current and accurate.

**Preconditions**:

- User is logged in and authenticated
- User navigates to Profile page (`/dashboard/profile` or `/profile`)
- User has existing profile data

**Test Steps**:

1. Log in as user
2. Navigate to Profile page
3. Verify profile form displays current user information
4. Click "Edit" button (pencil icon)
5. Verify form enters edit mode
6. Update first name: "John" → "Jonathan"
7. Update last name: "Doe" → "Smith"
8. Update email: "john@example.com" → "jonathan@example.com"
9. Update phone: "1234567890" → "9876543210"
10. Update bio: "I love tools!" → "I'm a professional contractor who loves sharing quality tools with the community."
11. Update address:
    - Street: "123 Main St" → "456 Oak Avenue"
    - City: "Springfield" → "Riverside"
    - State: "IL" → "CA"
    - Zip Code: "62701" → "92501"
12. Click "Save" button
13. Verify success message appears
14. Verify form exits edit mode
15. Verify updated information is displayed immediately

**Expected Results**:

- ✅ Profile form displays current user data correctly
- ✅ Edit button toggles form to edit mode
- ✅ All form fields are editable in edit mode
- ✅ Phone number formatting works correctly (displays as (123) 456-7890)
- ✅ Form validation allows valid data submission
- ✅ Upon submission, user sees success toast notification: "Profile updated successfully"
- ✅ Form exits edit mode automatically after successful submission
- ✅ Updated information appears immediately (optimistic update)
- ✅ Profile data is persisted correctly in database
- ✅ Address is updated correctly
- ✅ All fields reflect the new values

**Test Data**:

- Valid first name and last name
- Valid email address
- Valid phone number (10 digits)
- Valid bio (under 500 characters)
- Valid address (street, city, state, zip code)

**Priority**: Critical  
**Requirement Reference**: Phase 6 - Update Profile

---

### Scenario 2: Update Profile - Required Field Validation

**User Story**: As a user, I want clear validation errors when I submit invalid profile data so I understand what needs to be fixed.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode

**Test Steps**:

1. Enter edit mode
2. Clear first name field
3. Attempt to save
4. Verify validation error appears
5. Clear last name field
6. Attempt to save
7. Verify validation error appears
8. Enter invalid email: "notanemail"
9. Attempt to save
10. Verify validation error appears
11. Clear street address field
12. Attempt to save
13. Verify validation error appears
14. Clear city field
15. Attempt to save
16. Verify validation error appears
17. Clear state field
18. Attempt to save
19. Verify validation error appears
20. Enter invalid zip code: "12" (too short)
21. Attempt to save
22. Verify validation error appears
23. Enter invalid zip code: "12345678901" (too long)
24. Attempt to save
25. Verify validation error appears

**Expected Results**:

- ✅ Error message for empty first name: "First name is required"
- ✅ Error message for empty last name: "Last name is required"
- ✅ Error message for invalid email: "Please enter a valid email"
- ✅ Error message for empty street: "Street address is required"
- ✅ Error message for empty city: "City is required"
- ✅ Error message for empty state: "State is required"
- ✅ Error message for zip code too short: "Zip code must be at least 4 characters"
- ✅ Error message for zip code too long: "Zip code must be 10 characters or less"
- ✅ Error messages appear near the relevant fields
- ✅ Error messages are clear and actionable
- ✅ Form prevents submission with invalid data

**Test Data**:

- Empty required fields
- Invalid email format
- Invalid zip code lengths

**Priority**: High  
**Requirement Reference**: Phase 6 - Profile Validation

---

### Scenario 3: Update Profile - Optional Fields

**User Story**: As a user, I want to optionally provide phone number and bio without being required to fill them.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode
- User has existing phone and bio data

**Test Steps**:

1. Enter edit mode
2. Clear phone field (remove existing phone)
3. Clear bio field (remove existing bio)
4. Update required fields with valid data
5. Save profile
6. Verify profile saves successfully
7. Verify phone displays as "Not provided"
8. Verify bio field is empty
9. Enter edit mode again
10. Add phone: "5551234567"
11. Add bio: "I'm a DIY enthusiast"
12. Save profile
13. Verify phone and bio are saved
14. Verify phone displays formatted: "(555) 123-4567"
15. Verify bio displays correctly

**Expected Results**:

- ✅ Profile can be saved without phone number
- ✅ Profile can be saved without bio
- ✅ Phone field is truly optional
- ✅ Bio field is truly optional
- ✅ Empty phone displays as "Not provided"
- ✅ Empty bio displays as empty (or placeholder)
- ✅ Phone and bio can be added later
- ✅ Phone formatting works when provided
- ✅ Bio character limit (500) is enforced when provided

**Test Data**:

- Profile with no phone/bio
- Profile with phone/bio
- Valid phone number (10 digits)
- Valid bio (under 500 characters)

**Priority**: Medium  
**Requirement Reference**: Phase 6 - Optional Fields

---

### Scenario 4: Update Profile - Phone Number Formatting

**User Story**: As a user, I want my phone number to be automatically formatted for better readability.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode

**Test Steps**:

1. Enter edit mode
2. Enter phone number: "5551234567" (10 digits, no formatting)
3. Verify phone number formats automatically as user types: "(555) 123-4567"
4. Save profile
5. Verify phone displays formatted: "(555) 123-4567"
6. Enter edit mode again
7. Verify phone field shows formatted value
8. Clear phone field
9. Enter phone with formatting: "(555) 123-4567"
10. Verify formatting is maintained
11. Save profile
12. Verify phone saves correctly

**Expected Results**:

- ✅ Phone number formats automatically as user types
- ✅ Format: (XXX) XXX-XXXX
- ✅ Phone displays formatted in view mode
- ✅ Phone field accepts formatted input
- ✅ Phone formatting works for 10-digit numbers
- ✅ Invalid phone formats are rejected or corrected
- ✅ Phone formatting is consistent across view/edit modes

**Test Data**:

- 10-digit phone numbers
- Phone numbers with formatting
- Phone numbers without formatting

**Priority**: Medium  
**Requirement Reference**: Phase 6 - Phone Formatting

---

### Scenario 5: Update Profile - Bio Character Limit

**User Story**: As a user, I want to know the character limit for my bio so I can write an appropriate description.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode

**Test Steps**:

1. Enter edit mode
2. Verify bio field is visible
3. Enter bio with exactly 500 characters
4. Verify validation allows submission
5. Attempt to enter 501st character
6. Verify character limit is enforced
7. Save profile with 500-character bio
8. Verify bio saves successfully
9. Verify bio displays correctly (all 500 characters)
10. Enter edit mode again
11. Verify bio field shows full 500-character bio
12. Verify character count indicator (if implemented)

**Expected Results**:

- ✅ Bio field enforces maximum 500 characters
- ✅ Character count indicator is visible (if implemented)
- ✅ Character count updates in real-time (if implemented)
- ✅ Validation prevents submission with bio exceeding 500 characters
- ✅ Bio with exactly 500 characters is accepted
- ✅ Bio displays correctly with all characters
- ✅ Long bio is handled gracefully in view mode (scrollable or truncated)

**Test Data**:

- Bio with 500 characters (maximum)
- Bio with 501+ characters (should be rejected)
- Bio with various lengths

**Priority**: Medium  
**Requirement Reference**: Phase 6 - Bio Character Limit

---

### Scenario 6: Update Profile - Edit Mode Toggle

**User Story**: As a user, I want to easily switch between viewing and editing my profile so I can make updates when needed.

**Preconditions**:

- User is logged in
- User is on Profile page

**Test Steps**:

1. Navigate to Profile page
2. Verify profile is in view mode (not editable)
3. Verify "Edit" button (pencil icon) is visible
4. Click "Edit" button
5. Verify form enters edit mode
6. Verify "Edit" button is replaced with "Save" and "Cancel" buttons
7. Verify form fields become editable
8. Verify card styling changes (border/background indicates edit mode)
9. Click "Cancel" button
10. Verify form exits edit mode
11. Verify changes are discarded
12. Verify original values are restored
13. Click "Edit" button again
14. Make changes and click "Save"
15. Verify form exits edit mode after successful save

**Expected Results**:

- ✅ Profile starts in view mode
- ✅ Edit button is visible and functional
- ✅ Clicking Edit enters edit mode
- ✅ Save and Cancel buttons appear in edit mode
- ✅ Form fields become editable in edit mode
- ✅ Visual indicator shows edit mode (border/background change)
- ✅ Cancel button exits edit mode and discards changes
- ✅ Save button exits edit mode and saves changes
- ✅ Edit mode toggle is smooth and responsive

**Test Data**:

- Profile with existing data
- Profile with changes made in edit mode

**Priority**: High  
**Requirement Reference**: Phase 6 - Edit Mode

---

### Scenario 7: Update Profile - Cancel and Form Reset

**User Story**: As a user, I want to cancel my profile edits and restore original values so I don't accidentally save unwanted changes.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode
- User has made changes to form fields

**Test Steps**:

1. Enter edit mode
2. Make changes to multiple fields:
   - Change first name
   - Change last name
   - Change email
   - Change phone
   - Change bio
   - Change address fields
3. Click "Cancel" button
4. Verify form exits edit mode
5. Verify all changes are discarded
6. Verify original values are restored
7. Verify no API call is made
8. Enter edit mode again
9. Verify form shows original values (not the discarded changes)
10. Make changes and save
11. Verify changes are saved
12. Enter edit mode again
13. Make changes and click Cancel
14. Verify form resets to last saved values (not original values)

**Expected Results**:

- ✅ Cancel button discards all unsaved changes
- ✅ Original values are restored after cancel
- ✅ No API call is made when canceling
- ✅ Form resets to last saved values (not original values before last save)
- ✅ Cancel works for all field types
- ✅ User can re-enter edit mode after canceling
- ✅ Cancel is immediate (no loading state)

**Test Data**:

- Profile with existing data
- Multiple field changes
- Saved vs unsaved changes

**Priority**: High  
**Requirement Reference**: Phase 6 - Form Reset

---

### Scenario 8: Update Profile - Partial Updates

**User Story**: As a user, I want to update only specific profile fields without changing everything.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode

**Test Steps**:

1. Enter edit mode
2. Update only first name (leave all other fields unchanged)
3. Save profile
4. Verify only first name is updated
5. Verify all other fields remain unchanged
6. Enter edit mode again
7. Update only address (street, city, state, zip)
8. Leave all other fields unchanged
9. Save profile
10. Verify only address is updated
11. Verify all other fields remain unchanged
12. Enter edit mode again
13. Update only bio
14. Save profile
15. Verify only bio is updated

**Expected Results**:

- ✅ User can update only specific fields
- ✅ Unchanged fields remain as they were
- ✅ Partial updates work correctly
- ✅ Only changed fields are sent to API
- ✅ All fields display correctly after partial update
- ✅ No data loss occurs with partial updates

**Test Data**:

- Profile with existing data
- Single field changes
- Multiple field changes
- Address-only changes

**Priority**: High  
**Requirement Reference**: Phase 6 - Partial Updates

---

### Scenario 9: React Query Caching and Instant Updates

**User Story**: As a user, I want instant navigation and updates when viewing my profile so that the app feels fast and responsive.

**Preconditions**:

- User is logged in
- User has viewed profile page previously (cache exists)
- User has updated profile previously

**Test Steps**:

1. Log in as user
2. Navigate to Profile page
3. Wait for data to load (first load)
4. Navigate away from Profile page
5. Navigate back to Profile page
6. Verify data loads instantly from cache
7. Update profile information
8. Verify changes appear immediately (optimistic update)
9. Navigate away and back
10. Verify updated data is still visible (persisted)
11. Navigate to another page that displays user info
12. Verify user info is updated there too (cache invalidation)
13. Navigate back to Profile page
14. Verify data loads instantly from cache

**Expected Results**:

- ✅ First load shows loading state appropriately
- ✅ Subsequent navigation to Profile page shows cached data instantly (no loading spinner)
- ✅ Background refetch updates data without blocking UI
- ✅ Profile updates appear immediately after submission (optimistic update)
- ✅ Updated data persists after navigation (not just optimistic)
- ✅ Cache invalidation updates related queries
- ✅ User info is updated across all pages that display it
- ✅ No flickering or loading states on cached data

**Test Data**:

- User with existing profile
- Profile updates
- Multiple pages displaying user info

**Priority**: High  
**Requirement Reference**: Phase 6 - React Query Performance

---

### Scenario 10: Error Handling and User Feedback

**User Story**: As a user, I want clear error messages when profile update fails so I understand what went wrong and can try again.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode
- Various error conditions can be triggered

**Test Steps**:

1. **Network Error**:
   - Disconnect network
   - Make profile changes
   - Attempt to save
   - Verify error message

2. **API Error**:
   - Submit profile with invalid data that passes client validation
   - Verify server error message

3. **Validation Error**:
   - Attempt to submit with invalid email
   - Verify validation error

4. **Authorization Error**:
   - Attempt to update profile when session expires
   - Verify error message

5. **Server Error**:
   - Trigger server error (if possible)
   - Verify error message

**Expected Results**:

- ✅ Network errors show: "Network error" or "Failed to connect. Please check your internet connection."
- ✅ API errors show specific error message from server
- ✅ Validation errors show field-specific messages
- ✅ Authorization errors show: "Unauthorized" or "Your session has expired. Please log in again."
- ✅ Server errors show: "An error occurred. Please try again."
- ✅ All errors appear as toast notifications
- ✅ Error messages are user-friendly (not technical)
- ✅ Error messages include actionable guidance when possible
- ✅ Error toast duration is appropriate (5 seconds for errors)
- ✅ Form remains in edit mode on error so user can fix and retry

**Test Data**:

- Various error conditions
- Invalid data
- Network disconnection
- Authorization failures
- Server errors

**Priority**: High  
**Requirement Reference**: Phase 6 - Error Handling

---

### Scenario 11: Profile Update Loading States

**User Story**: As a user, I want to see clear loading feedback when updating my profile so I know the action is processing.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode
- User has made profile changes

**Test Steps**:

1. Enter edit mode
2. Make profile changes
3. Click "Save" button
4. Verify loading state appears immediately
5. Verify Save button shows loading indicator (spinner or "Saving..." text)
6. Verify Save button is disabled during submission
7. Verify Cancel button is disabled during submission (optional)
8. Wait for submission to complete
9. Verify loading state disappears
10. Verify success message appears

**Expected Results**:

- ✅ Loading state appears immediately on save click
- ✅ Save button shows loading indicator (spinner or "Saving..." text)
- ✅ Save button is disabled during submission
- ✅ Cancel button behavior during submission (disabled or still functional)
- ✅ Form fields are disabled or read-only during submission (optional)
- ✅ Loading state is clear and visible
- ✅ Loading state disappears after successful submission
- ✅ Success message appears after loading completes
- ✅ If error occurs, loading state disappears and error is shown

**Test Data**:

- Profile changes
- Normal and slow network conditions

**Priority**: Medium  
**Requirement Reference**: Phase 6 - Loading States

---

### Scenario 12: Profile Cache Invalidation

**User Story**: As a system, I want to invalidate profile-related caches when profile is updated so users see updated data everywhere.

**Preconditions**:

- User is logged in
- User has viewed profile and other pages (cache exists)
- User updates profile

**Test Steps**:

1. Navigate to Profile page
2. Verify current profile data is displayed
3. Update profile information
4. Verify changes appear immediately (optimistic update)
5. Navigate to Dashboard page
6. Verify user info on Dashboard is updated
7. Navigate to Garage page
8. Verify user info on Garage is updated (if displayed)
9. Navigate to any page displaying user name/email
10. Verify user info is updated everywhere
11. Navigate back to Profile page
12. Verify updated data is still visible (persisted)

**Expected Results**:

- ✅ Profile update triggers cache invalidation
- ✅ Changes appear immediately after update
- ✅ Changes persist after navigation (not just optimistic)
- ✅ Related queries are invalidated (profile, user, dashboard)
- ✅ User info is updated across all pages
- ✅ Cache updates reflect new profile data
- ✅ No stale data is displayed
- ✅ Background refetch ensures data freshness

**Test Data**:

- Profile with existing data
- Profile updates
- Multiple pages displaying user info

**Priority**: High  
**Requirement Reference**: Phase 6 - Cache Invalidation

---

### Scenario 13: Address Validation

**User Story**: As a user, I want address validation to ensure I provide a complete and valid address.

**Preconditions**:

- User is logged in
- User is on Profile page in edit mode

**Test Steps**:

1. Enter edit mode
2. Clear street address
3. Attempt to save
4. Verify validation error
5. Enter valid street: "123 Main Street"
6. Clear city
7. Attempt to save
8. Verify validation error
9. Enter valid city: "Springfield"
10. Clear state
11. Attempt to save
12. Verify validation error
13. Select valid state from dropdown
14. Clear zip code
15. Attempt to save
16. Verify validation error
17. Enter zip code too short: "12"
18. Attempt to save
19. Verify validation error
20. Enter zip code too long: "12345678901"
21. Attempt to save
22. Verify validation error
23. Enter valid zip code: "62701"
24. Save profile
25. Verify address saves successfully

**Expected Results**:

- ✅ Street address is required
- ✅ City is required
- ✅ State is required
- ✅ Zip code is required
- ✅ Zip code must be 4-10 characters
- ✅ State dropdown works correctly
- ✅ All address fields validate correctly
- ✅ Valid address saves successfully
- ✅ Address displays correctly after save

**Test Data**:

- Empty address fields
- Invalid zip code lengths
- Valid address components

**Priority**: High  
**Requirement Reference**: Phase 6 - Address Validation

---

### Scenario 14: Mobile Responsiveness

**User Story**: As a mobile user, I want profile functionality to work correctly on mobile devices.

**Preconditions**:

- User is on mobile device or mobile browser view
- User is logged in
- User navigates to Profile page

**Test Steps**:

1. Open app on mobile device
2. Navigate to Profile page
3. Verify profile form displays correctly
4. Click "Edit" button
5. Verify edit mode works on mobile
6. Fill out form fields on mobile
7. Verify phone number input works on mobile keyboard
8. Verify address fields are usable on mobile
9. Verify bio textarea is usable on mobile
10. Save profile
11. Verify success message appears
12. Verify profile displays correctly on mobile

**Expected Results**:

- ✅ Profile form is mobile-responsive
- ✅ Form fits within mobile screen without horizontal scrolling
- ✅ Input fields are appropriately sized for mobile
- ✅ Phone number input triggers numeric keyboard on mobile
- ✅ Textarea (bio) is usable on mobile
- ✅ Buttons are easily tappable (at least 44x44 pixels)
- ✅ Text is readable without zooming
- ✅ Edit mode works correctly on mobile
- ✅ No UI elements are cut off or inaccessible
- ✅ Touch targets meet accessibility standards

**Test Data**:

- Mobile device (iOS/Android)
- Mobile browser view (Chrome DevTools)

**Priority**: Medium  
**Requirement Reference**: Phase 6 - Mobile Support

---

### Scenario 15: Concurrent Profile Updates

**User Story**: As a system, I want to handle concurrent profile update attempts correctly to prevent conflicts.

**Preconditions**:

- User is logged in
- User has profile page open in multiple tabs/windows

**Test Steps**:

1. Open Profile page in Tab 1
2. Open Profile page in Tab 2 (same user)
3. In Tab 1, enter edit mode and update first name
4. Save profile in Tab 1
5. In Tab 2, enter edit mode (before Tab 1 save completes)
6. Update last name in Tab 2
7. Save profile in Tab 2
8. Verify both updates are handled correctly
9. Refresh both tabs
10. Verify final profile state is correct

**Expected Results**:

- ✅ System handles concurrent updates correctly
- ✅ Last update wins or updates are merged correctly
- ✅ No data loss occurs
- ✅ No conflicts or errors from concurrent updates
- ✅ Profile state is consistent across tabs after refresh
- ✅ Cache invalidation works correctly for concurrent updates

**Test Data**:

- Multiple browser tabs
- Concurrent profile updates
- Different field updates

**Priority**: Low  
**Requirement Reference**: Phase 6 - Concurrency Handling

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test user accounts are created with various profile states
- [ ] API routes are deployed and functional
- [ ] React Query hooks are implemented and working
- [ ] Database is accessible and can be reset if needed

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

The Phase 6 migration SHALL be considered accepted when:

1. ✅ Profile update works correctly with API routes and React Query
2. ✅ Profile form validation prevents invalid submissions with clear error messages
3. ✅ Profile updates appear immediately after submission (optimistic updates)
4. ✅ React Query provides instant navigation and cached data
5. ✅ Error handling provides clear, user-friendly feedback
6. ✅ Both user profile and address are updated correctly
7. ✅ Optional fields (phone, bio) work correctly
8. ✅ Edit mode toggle works smoothly
9. ✅ Form reset/cancel functionality works correctly
10. ✅ All profile functionality maintains existing behavior
11. ✅ Performance is acceptable with expected load
12. ✅ Mobile experience is functional and responsive
13. ✅ Cache invalidation works correctly after profile updates
14. ✅ No regression in existing profile functionality

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
