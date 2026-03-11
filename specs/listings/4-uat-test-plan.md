# Listings Management - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Listings Management feature. UAT validates that listing creation, editing, deletion, status management, image handling, and browsing functionality works correctly from an end-user perspective. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Listings Management
**Version**: 1.0
**Date**: 2026
**Test Environment**: Staging/Production
**Reference Documents**:

- Test Plan: `specs/listings/4-test-plan.md`
- Form Schema: `src/features/listings/form-schema/listing.schema.ts`
- Form Component: `src/features/listings/components/listing-form/add-listing-form.tsx`

## Test Objectives

1. Verify that listing creation works correctly with all form sections, image upload, and legal acknowledgment
2. Validate that listing editing preserves existing data and handles image add/remove/reorder
3. Confirm that soft delete (status change to "inactive") works with confirmation dialog
4. Ensure status management transitions work correctly (available/maintenance/inactive)
5. Verify AI image analysis detects tool info and can populate form fields
6. Validate Explore page search, filtering, sorting, and infinite scroll
7. Confirm Garage page tabs (Active/Inactive/Pending Review), filters, and empty states
8. Verify favorites system with optimistic updates
9. Ensure authorization prevents non-owner access to edit/delete/status endpoints
10. Validate mobile-specific behaviors (keyboard types, iOS zoom prevention, responsive layout, touch targets)

## Test Scenarios

### Scenario 1: Create New Listing - Happy Path

**User Story**: As a tool owner, I want to create a listing for my tool so that others can rent it from me.

**Preconditions**:

- User is logged in and authenticated
- User is a member of a community
- User has completed Stripe onboarding
- Owner policy documents are available in the system

**Test Steps**:

1. Navigate to `/dashboard/listings/add`
2. Fill in Basic Information:
   - Name: "DeWalt 20V MAX Circular Saw"
   - Description: detailed description (under 2000 characters)
   - Category: select from dropdown (should show emoji icon + name)
   - Brand: "DeWalt" (optional)
   - Model: "DCS391B" (optional)
   - Condition: select "Good" from dropdown
3. Fill in Pricing:
   - Daily Rate: 25.00
   - Security Deposit: 50.00
   - Minimum Rental Period: 1 day
   - Maximum Rental Period: 14 days
4. Upload at least 1 photo (click upload area or drag-and-drop)
5. Set Pickup & Delivery:
   - Select "Both Available" from delivery mode dropdown
   - Enter delivery fee: 10.00
   - Enter delivery radius: 15 miles
   - Optionally check "Setup Available" and enter setup fee
6. Add Additional Details:
   - Add custom specification (e.g., Key: "Power", Value: "1200W")
   - Enter usage instructions
   - Enter safety notes
7. Review Owner Policies section:
   - Click document names to open summary modals
   - Check "I acknowledge and agree to the Owner Policies" checkbox
8. Verify review notice alert: "Your listing will be reviewed by an admin before being published"
9. Click "Add Listing" button

**Expected Results**:

- ✅ All form sections render correctly in a 2-column grid (Basic Info + Pricing top, Pickup/Delivery + Additional Details bottom, Photos full-width middle)
- ✅ Category dropdown shows emoji icons with category names
- ✅ Condition dropdown shows descriptive labels
- ✅ Photo upload shows preview with "Main" badge on first image
- ✅ Delivery fee, radius, and setup fields appear conditionally when delivery mode is "delivery_only" or "both_available"
- ✅ Owner Policies checkbox is required; document modals open with summaries and PDF links
- ✅ Review notice alert appears only for new listings (not edit mode)
- ✅ Submit button shows "Adding Listing..." during submission
- ✅ Toast: "Listing and images uploaded successfully!"
- ✅ User redirected to `/dashboard/garage`
- ✅ Listing appears in "Pending Review" tab with count badge
- ✅ React Query cache invalidated for listings, garage, listing-details, and explore queries

**Test Data**:

- Name: under 255 characters
- Description: 100-2000 characters
- Daily Rate: 25.00 (must be > 0)
- Security Deposit: 50.00 (>= 0)
- Min Rental: 1 day (>= 1), Max Rental: 14 days (>= 1)
- Image: JPEG under 10MB
- Specifications: key-value pairs like `{ "Power": "1200W", "Blade Size": "7-1/4 inch" }`

**Priority**: Critical
**Requirement Reference**: Listing Creation

---

### Scenario 2: Create Listing - Validation Errors

**User Story**: As a tool owner, I want clear validation errors when I submit invalid listing data so I can correct mistakes.

**Preconditions**:

- User is logged in
- User is on the Add Listing form

**Test Steps**:

1. Submit form with empty name field
2. Submit form with empty description field
3. Submit form with no category selected
4. Submit form with daily rate set to 0
5. Submit form with negative security deposit
6. Submit form with no images uploaded
7. Submit form without checking owner policies acknowledgment
8. Select "delivery_only" mode with delivery radius set to 0
9. Check "Setup Available" while delivery mode is "pickup_only"
10. Enter negative delivery fee
11. Enter negative setup fee
12. Upload file larger than 10MB
13. Upload non-image file

**Expected Results**:

- ✅ "Listing name is required" for empty name
- ✅ "Description is required" for empty description
- ✅ "Category is required" for missing category
- ✅ "Daily rate must be greater than 0" for zero/negative daily rate
- ✅ "Security deposit cannot be negative" for negative deposit
- ✅ Toast: "Please add at least one image." for no images
- ✅ "You must acknowledge the Owner Policies to create a listing." for unchecked policies
- ✅ "Delivery radius is required when delivery is available" for zero radius with delivery
- ✅ "Setup service requires delivery to be available" for setup with pickup_only
- ✅ "Delivery fee cannot be negative" for negative delivery fee
- ✅ "Setup fee cannot be negative" for negative setup fee
- ✅ Toast error for oversized file from image validation
- ✅ Toast error for invalid file type from image validation
- ✅ Error messages appear near the relevant fields
- ✅ Form remains usable; submit button re-enables after error

**Test Data**:

- Empty strings, zero values, negative numbers
- Oversized image (>10MB)
- Non-image file (e.g., .pdf, .txt)

**Priority**: High
**Requirement Reference**: Listing Form Validation

---

### Scenario 3: Edit Listing - Happy Path

**User Story**: As a tool owner, I want to edit my listing details so I can keep information current.

**Preconditions**:

- User is logged in as listing owner
- User has an existing listing (approved or pending review)

**Test Steps**:

1. Navigate to `/dashboard/listings/[id]/edit`
2. Verify all existing values are pre-populated in the form
3. Verify existing images load (loading skeleton shown during fetch)
4. Modify description, daily rate, and condition
5. Click "Save Changes" button

**Expected Results**:

- ✅ Form pre-fills all existing data (name, description, category, brand, model, condition, pricing, delivery settings, specifications, instructions, safety notes)
- ✅ Existing images load with loading skeleton then display with "Main" badge on first
- ✅ Owner Policies checkbox pre-checked (already acknowledged)
- ✅ Review notice alert does NOT appear in edit mode
- ✅ Submit button shows "Saving..." during update
- ✅ PATCH `/api/listings/[listingId]` called with updated data
- ✅ Toast: "Listing updated successfully!" (or "Listing and images updated successfully!" if images changed)
- ✅ User redirected to `/dashboard/garage`
- ✅ React Query cache invalidated for specific listing-details key

**Test Data**:

- Existing listing with all fields populated
- Modified description, daily rate, condition

**Priority**: High
**Requirement Reference**: Listing Update

---

### Scenario 4: Edit Listing - Image Management

**User Story**: As a tool owner, I want to add, remove, and reorder images on my listing to showcase my tool effectively.

**Preconditions**:

- User is logged in as listing owner
- Listing has 2+ existing images

**Test Steps**:

1. Navigate to edit form for listing with multiple images
2. Verify existing images display with "Main" badge on first image
3. Hover over an existing image to reveal remove button (X icon)
4. Click remove button on an existing image
5. Verify image is removed from the form
6. Click upload area to add a new image via file picker
7. Verify new image appears in the preview grid
8. Hover over images to verify drag handle appears for reordering
9. Click "Save Changes"

**Expected Results**:

- ✅ Existing images load from API (skeleton shown during `isLoadingImages`)
- ✅ Remove button appears on hover (opacity transition)
- ✅ Removed existing images are deleted via DELETE `/api/listings/[listingId]/images/[imageId]`
- ✅ New images are uploaded via POST to `/api/listings/[listingId]`
- ✅ Image reorder calls PATCH `/api/listings/[listingId]/images/reorder` when order changes
- ✅ At least 1 image must remain; toast "Please add at least one image." if all removed
- ✅ "Main" badge always appears on the first image in the grid
- ✅ Submit is disabled while images are loading (`isLoadingImages`)

**Test Data**:

- Listing with 3+ existing images
- New JPEG image under 10MB
- Attempt to remove all images (should show error)

**Priority**: High
**Requirement Reference**: Listing Image Management

---

### Scenario 5: Delete Listing (Soft Delete)

**User Story**: As a tool owner, I want to delete my listing when I no longer want to rent out my tool.

**Preconditions**:

- User is logged in as listing owner
- Listing exists and is not currently rented

**Test Steps**:

1. Navigate to garage page or listing detail page
2. Click "Delete" button on the listing
3. Verify confirmation dialog appears
4. Confirm deletion
5. Verify listing is removed from active view

**Expected Results**:

- ✅ Confirmation dialog appears before deletion
- ✅ User can cancel the deletion action
- ✅ DELETE `/api/listings/[listingId]` sets status to "inactive" (soft delete)
- ✅ Toast: success confirmation message
- ✅ Listing moves from active tab to inactive tab in garage
- ✅ Listing no longer appears in explore/search results
- ✅ React Query cache invalidated for listings, garage, listing-details, explore
- ✅ Listing with active rentals cannot be deleted (error message shown)

**Test Data**:

- Active listing with no active rentals
- Active listing with active rental (should fail gracefully)

**Priority**: High
**Requirement Reference**: Listing Deletion

---

### Scenario 6: Status Management

**User Story**: As a tool owner, I want to change my listing status so I can control when my tool is available for rent.

**Preconditions**:

- User is logged in as listing owner
- Listing exists in "available" status

**Test Steps**:

1. Navigate to garage page
2. Find an active listing
3. Change status to "maintenance" (temporarily unavailable)
4. Verify status updates in UI
5. Change status to "inactive"
6. Verify listing moves to inactive tab
7. Change status back to "available"
8. Verify listing moves to active tab

**Expected Results**:

- ✅ PATCH `/api/listings/[listingId]/status` called with new status
- ✅ Status change reflected immediately in UI
- ✅ Listing moves between garage tabs based on status
- ✅ "rented" status cannot be manually set (only system-controlled)
- ✅ Toast: "Listing status updated successfully"
- ✅ React Query cache invalidated including explore query key
- ✅ StatusIconWithTooltip shows correct icon for each status

**Test Data**:

- Listing in "available" status
- Status transitions: available → maintenance → inactive → available

**Priority**: High
**Requirement Reference**: Listing Status Management

---

### Scenario 7: AI Image Analysis

**User Story**: As a tool owner, I want the system to analyze my tool image and auto-detect tool information to save time.

**Preconditions**:

- User is on the Add Listing form
- OpenAI API is accessible

**Test Steps**:

1. Upload an image of a recognizable tool (e.g., a power drill)
2. Observe AI analysis trigger
3. Wait for analysis to complete
4. Check if form fields are auto-populated with detected tool info

**Expected Results**:

- ✅ AI analysis runs after image upload without blocking form interaction
- ✅ No success toast displayed for analysis (by design - `successMessage: undefined`)
- ✅ Detected tool info populates relevant form fields (name, brand, model, category, condition)
- ✅ Graceful handling if no tool detected (no error shown, fields remain empty)
- ✅ Graceful handling if OpenAI API fails (error logged, user not disrupted)
- ✅ User can override any auto-populated values

**Test Data**:

- Clear image of a common power tool
- Blurry/unclear image (should fail gracefully)
- Image with no tool (e.g., landscape photo)

**Priority**: Medium
**Requirement Reference**: AI Image Analysis

---

### Scenario 8: Listing Detail View

**User Story**: As a user, I want to view complete listing details so I can decide whether to rent the tool.

**Preconditions**:

- User is logged in
- At least one approved listing exists

**Test Steps**:

1. Navigate to `/dashboard/listings/[id]`
2. Verify all listing information displays
3. Test image carousel navigation (arrows, thumbnails)
4. As owner: verify Edit button is visible
5. As non-owner: verify Favorite button and Rent button are visible
6. Navigate to non-existent listing ID

**Expected Results**:

- ✅ All listing info displays: name, description, category, condition, brand, model
- ✅ Pricing info displays: daily rate, security deposit, min/max rental period
- ✅ Image carousel navigates between photos with arrows and thumbnail selection
- ✅ Single image: no navigation arrows shown
- ✅ No images: placeholder image displayed
- ✅ Pickup/delivery mode and delivery details displayed
- ✅ Specifications, instructions, safety notes displayed (when present)
- ✅ Owner view: Edit button navigates to `/dashboard/listings/[id]/edit`
- ✅ Non-owner view: Favorite button (heart icon) and Rent button visible
- ✅ Non-existent listing: 404 page displayed
- ✅ Image carousel supports keyboard navigation (accessibility)

**Test Data**:

- Listing with all fields populated and multiple images
- Listing with only required fields and single image
- Non-existent listing ID

**Priority**: High
**Requirement Reference**: Listing Detail View

---

### Scenario 9: Garage Page

**User Story**: As a tool owner, I want to manage all my listings from a central garage page with tabs for different statuses.

**Preconditions**:

- User is logged in
- User has listings in various statuses

**Test Steps**:

1. Navigate to `/dashboard/garage`
2. Verify tabs: Active, Inactive, Pending Review
3. Click "Pending Review" tab - verify count badge (yellow) when `pendingCount > 0`
4. Switch between tabs and observe URL changes
5. Verify empty states when a tab has no listings
6. Click "Add New Listing" button
7. Use garage filters (search, category, status)

**Expected Results**:

- ✅ Tabs render: Active, Inactive, Pending Review (Archived tab is currently disabled)
- ✅ Pending Review tab shows count badge when pending listings exist
- ✅ Active tab has no `?tab=` URL param; Inactive uses `?tab=inactive`; Pending Review uses `?tab=pending_review`
- ✅ Tab switching clears `rentalStatus` filter for non-active tabs
- ✅ Empty state message shown when no listings in a tab
- ✅ Loading skeletons displayed during data fetch
- ✅ "Add New Listing" button navigates to `/dashboard/listings/add`
- ✅ GarageFiltersClient renders per-tab filters
- ✅ Listing cards show status icon, name, daily rate, image thumbnail

**Test Data**:

- Listings in each status: available, inactive, pending_review
- User with no listings (all empty states)

**Priority**: High
**Requirement Reference**: Garage Page Management

---

### Scenario 10: Explore Page

**User Story**: As a user, I want to browse and search available listings so I can find tools to rent.

**Preconditions**:

- User is logged in
- Multiple approved listings exist in different categories

**Test Steps**:

1. Navigate to `/dashboard/explore`
2. On desktop: verify CategoryButton row displays horizontally
3. On mobile: verify Category is a Select dropdown
4. Type in search input and observe debounced behavior (300ms delay)
5. Click the X button to clear search
6. Open Filters sheet (right-side drawer)
7. Set filters: price range (min/max), condition checkboxes, delivery method, setup available, available now
8. Verify filter badge count shows active filter count
9. Click "Apply Filters" / "Reset Filters" / "Cancel"
10. Open sort popover and select different sort options
11. Scroll down to trigger infinite scroll loading

**Expected Results**:

- ✅ Desktop: CategoryButton row (`hidden md:flex`)
- ✅ Mobile: Category Select dropdown (`md:hidden`)
- ✅ Search input debounced at 300ms with X clear button
- ✅ Filters sheet includes: price range (min/max inputs), condition checkboxes (excellent/good/fair/poor), delivery method select, setup available checkbox, available now checkbox
- ✅ Filter badge count shows number of active filters
- ✅ Apply/Reset/Cancel buttons in sheet footer
- ✅ Sort popover with options: recently added, price low to high, price high to low, highest rated, distance
- ✅ Infinite scroll loads more listings at 500px threshold (`useInfiniteScroll` hook)
- ✅ Loading skeletons (8 `ListingCardSkeleton`) during initial load
- ✅ "Updating results..." overlay during refetch
- ✅ Deduplication logic prevents duplicate listing cards
- ✅ Error state with "Failed to load listings" message and "Try Again" button
- ✅ All filters synced to URL parameters

**Test Data**:

- Listings across multiple categories, price ranges, conditions
- 20+ listings to test infinite scroll
- Search term that matches some but not all listings

**Priority**: High
**Requirement Reference**: Explore Page

---

### Scenario 11: Favorites

**User Story**: As a user, I want to add listings to my favorites so I can easily find them later.

**Preconditions**:

- User is logged in
- User is viewing a listing (not their own)

**Test Steps**:

1. View a listing detail page
2. Click the favorite button (heart icon)
3. Verify heart icon fills (active state)
4. Click the favorite button again
5. Verify heart icon unfills (inactive state)
6. Navigate to favorites page and verify listing appears/disappears

**Expected Results**:

- ✅ Heart icon toggles between filled (favorited) and outline (not favorited) on click
- ✅ Optimistic UI update: icon changes immediately before API response
- ✅ Loading state shown during API call
- ✅ Error handling with toast on failure; optimistic update reverted
- ✅ React Query cache invalidation updates relevant queries
- ✅ Favorite state persists after page refresh

**Test Data**:

- Listing owned by another user
- Network failure simulation for error handling

**Priority**: Medium
**Requirement Reference**: Favorites System

---

### Scenario 12: Authorization & Security

**User Story**: As a system, I want to prevent unauthorized access to listing management actions to protect user data.

**Preconditions**:

- Multiple user accounts exist
- Listings exist owned by different users

**Test Steps**:

1. As User B, attempt to navigate to `/dashboard/listings/[id]/edit` for User A's listing
2. As User B, attempt PATCH `/api/listings/[listingId]` for User A's listing
3. As User B, attempt DELETE `/api/listings/[listingId]` for User A's listing
4. As User B, attempt PATCH `/api/listings/[listingId]/status` for User A's listing
5. As a user without Stripe onboarding, attempt to create a listing
6. As a user not in any community, attempt to create a listing
7. Enter `<script>alert('xss')</script>` in listing name field

**Expected Results**:

- ✅ Non-owner receives UnauthorizedError for edit/delete/status operations
- ✅ Non-owner cannot modify another user's listing data
- ✅ NotFoundError returned for non-existent listing IDs
- ✅ Stripe onboarding check prevents listing creation (clear error message)
- ✅ Community membership check prevents listing creation (clear error message)
- ✅ Text sanitization strips XSS attempts from name, description, brand, model, instructions, safety notes
- ✅ No sensitive data leaked in error responses

**Test Data**:

- Two user accounts (owner and non-owner)
- User without Stripe onboarding
- User not in a community
- XSS payloads in text fields

**Priority**: Critical
**Requirement Reference**: Authorization & Security

---

### Scenario 13: React Query Caching & Instant Navigation

**User Story**: As a user, I want instant navigation between listing pages so the app feels fast and responsive.

**Preconditions**:

- User is logged in
- User has viewed listing data previously (cache exists)

**Test Steps**:

1. Navigate to garage page (first load - observe loading skeletons)
2. Navigate to explore page
3. Navigate back to garage page (should be instant from cache)
4. Create a new listing
5. Navigate to garage page
6. Verify new listing appears immediately
7. Edit a listing
8. Navigate to listing detail page
9. Verify updated data shows immediately

**Expected Results**:

- ✅ First load shows loading skeletons; subsequent navigation instant from cache
- ✅ After create: `["listings"]`, `["garage"]`, `["listing-details"]` cache keys invalidated
- ✅ After update: same keys plus specific `["listing-details", listingId]`
- ✅ After status change: same keys plus `["explore"]`
- ✅ Background refetch doesn't block UI
- ✅ No stale data appears after mutations
- ✅ No flickering or unnecessary loading states on cached data

**Test Data**:

- User with existing listings
- Create/edit/delete actions to trigger cache invalidation

**Priority**: High
**Requirement Reference**: React Query Performance

---

### Scenario 14: Error Handling

**User Story**: As a user, I want clear error messages when listing actions fail so I understand what went wrong.

**Preconditions**:

- User is logged in
- Various error conditions can be triggered

**Test Steps**:

1. **Network Error**: Disconnect network and attempt to create a listing
2. **API Error**: Trigger server 500 error during listing creation
3. **Partial Upload Failure**: Create listing successfully but image upload fails
4. **Validation Error**: Submit form with invalid data (covered in Scenario 2)

**Expected Results**:

- ✅ Network errors show user-friendly error message via toast
- ✅ API errors handled by mutation hook's `onError` callback with toast
- ✅ Partial image upload failure: listing is created but toast shows "Error uploading one or more images."
- ✅ Unknown errors: toast "An unexpected error occurred. Please try again."
- ✅ Form remains usable after error; submit button re-enables (`setIsSubmitting(false)` in finally block)
- ✅ Console errors logged for debugging but not exposed to user
- ✅ Error toasts auto-dismiss after default duration

**Test Data**:

- Network failure simulation
- Server error responses (500, 400, 403)
- Image upload failure during listing creation

**Priority**: High
**Requirement Reference**: Error Handling

---

### Scenario 15: Mobile Responsiveness - Layout & Grid

**User Story**: As a mobile user, I want the listing form and pages to be usable on my phone screen.

**Preconditions**:

- User is on a mobile device or mobile viewport (375px, 414px widths)
- User is logged in

**Test Steps**:

1. Open listing creation form on mobile
2. Verify form layout at widths below 640px (sm breakpoint)
3. Verify form layout at widths 640px-768px (sm to md)
4. Open garage page on mobile
5. Open explore page on mobile
6. Open listing detail page on mobile

**Expected Results**:

- ✅ Form sections stack single-column below 640px: `grid grid-cols-1` (Basic Info and Pricing stack vertically; Pickup/Delivery and Additional Details stack vertically)
- ✅ At 640px+ (sm): sections display side-by-side in 2-column grid
- ✅ Photos section is always full-width
- ✅ Submit button full-width on mobile: `w-full sm:w-auto`
- ✅ Category and Condition selects full-width on mobile: `w-full text-base md:w-fit`
- ✅ Image grid: `grid-cols-2` on mobile, `sm:grid-cols-3`, `lg:grid-cols-4`
- ✅ Delivery fields: `grid-cols-1` on mobile, `sm:grid-cols-2`
- ✅ Min/Max rental period fields: `grid-cols-1` on mobile, `sm:grid-cols-2`
- ✅ No horizontal scrolling on any page
- ✅ Text is readable without zooming
- ✅ All modals/dialogs properly sized for mobile screens
- ✅ Garage page: TabsList constrained to `max-w-96`; "Add New Listing" button `size="sm" h-9`

**Test Data**:

- Mobile viewports: 375px (iPhone SE), 414px (iPhone 14), 390px (iPhone 14 Pro)
- Tablet viewport: 768px (iPad)

**Priority**: Critical
**Requirement Reference**: Mobile Responsiveness

---

### Scenario 16: Mobile-Specific Form Input Behavior

**User Story**: As a mobile user, I want form inputs to show the correct keyboard type and not cause unexpected page zooming.

**Preconditions**:

- User is on iOS or Android mobile device
- User is on the listing creation/edit form

**Test Steps**:

1. Tap the Daily Rate input field on iOS and Android
2. Tap the Security Deposit input field
3. Tap the Delivery Fee input field
4. Tap the Setup Fee input field
5. Tap the Minimum Rental Period input field
6. Tap the Maximum Rental Period input field
7. Tap the Delivery Radius input field
8. Tap the Name text input field
9. Tap the Description textarea field
10. Verify page does NOT zoom in when tapping any input on iOS Safari

**Expected Results**:

- ✅ `inputMode="decimal"` on monetary fields (daily rate, security deposit, delivery fee, setup fee) triggers decimal number keyboard with period/comma
- ✅ `inputMode="numeric"` on integer fields (min rental, max rental, delivery radius) triggers number keyboard without decimal
- ✅ Default keyboard on text fields (name, description, brand, model, instructions, safety notes)
- ✅ **iOS zoom prevention**: All inputs use `text-base` class (16px font-size). iOS Safari auto-zooms when input font-size < 16px — this must NOT happen on any field
- ✅ `resize-none` on textareas prevents resize handle on mobile
- ✅ Delivery mode select descriptions hidden on mobile: `hidden text-xs md:block` (only visible on md+ screens)
- ✅ Touch targets on specification add/remove buttons are adequately sized

**Test Data**:

- iOS device (Safari): iPhone 12+, iPad
- Android device (Chrome): Various screen sizes
- Tap each input field and verify keyboard type

**Priority**: Critical
**Requirement Reference**: Mobile Input Optimization

---

### Scenario 17: Mobile-Specific Image Upload & Management

**User Story**: As a mobile user, I want to easily upload photos from my camera or gallery and manage them on my phone.

**Preconditions**:

- User is on a mobile device
- User is on the listing creation/edit form

**Test Steps**:

1. Tap the image upload area
2. Verify file picker offers camera capture option
3. Take a photo or select from gallery
4. Verify image preview appears in grid
5. Attempt to reorder images on touch device
6. Tap to remove an image

**Expected Results**:

- ✅ `accept="image/*"` on file input enables camera capture option on mobile devices
- ✅ Upload area has `min-h-[120px]` for adequate touch target
- ✅ Image responsive sizing: `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"`
- ✅ Upload text responsive: `text-xs sm:text-sm`
- ✅ Image preview grid: 2 columns on mobile (`grid-cols-2`), 3 on sm, 4 on lg
- ✅ GripVertical drag handle and X remove button appear on group-hover (may require long-press on touch devices)
- ✅ Remove button (X icon) is accessible via touch with adequate target size
- ✅ Camera-captured images are processed to 2048x2048px, 85% JPEG quality

**Test Data**:

- Photo captured directly from mobile camera
- Image selected from photo gallery
- Multiple images to test grid layout on mobile

**Priority**: High
**Requirement Reference**: Mobile Image Management

---

### Scenario 18: Mobile-Specific Navigation & Explore/Garage

**User Story**: As a mobile user, I want to browse and filter listings effectively on my phone.

**Preconditions**:

- User is on a mobile device or mobile viewport
- User is logged in with listings available

**Test Steps**:

1. Navigate to Explore page on mobile
2. Verify category filter renders as Select dropdown (not CategoryButton row)
3. Verify search + filter row stacks vertically
4. Open Filters sheet and verify it's usable on small screen
5. Navigate to Garage page on mobile
6. Switch between tabs
7. Verify "Add New Listing" button is accessible

**Expected Results**:

- ✅ Explore: Category filter is `Select` dropdown on mobile (`md:hidden`), `CategoryButton` horizontal row on desktop (`hidden md:flex`)
- ✅ Explore: Search and filter controls stack vertically on mobile: `flex-col gap-6 sm:flex-row`
- ✅ Explore: Filters open in Sheet (right-side drawer) — appropriate for mobile
- ✅ Explore: Sort popover is accessible on mobile
- ✅ Explore: Infinite scroll works with touch scrolling
- ✅ Explore: Listing cards are appropriately sized for mobile viewport
- ✅ Garage: Container has adequate padding (`pb-6`)
- ✅ Garage: Tab names readable on small screens; TabsList `max-w-96`
- ✅ Garage: "Add New Listing" button properly sized (`size="sm" h-9`)
- ✅ All toast notifications visible and readable on mobile

**Test Data**:

- Mobile viewport: 375px, 414px widths
- 20+ listings for infinite scroll testing
- Multiple categories for filter testing

**Priority**: High
**Requirement Reference**: Mobile Navigation & Browsing

---

### Scenario 19: Performance with Many Listings

**User Story**: As a user, I want listing pages to load quickly even when there are many listings.

**Preconditions**:

- User is logged in
- 50+ listings exist in the system
- User owns 20+ listings

**Test Steps**:

1. Navigate to explore page with 50+ listings
2. Measure initial page load time
3. Scroll to trigger infinite scroll multiple times
4. Navigate to garage page with 20+ listings
5. Switch between tabs
6. Perform listing actions (create, edit, status change)
7. Verify actions complete within acceptable time

**Expected Results**:

- ✅ Explore page initial load within 2 seconds
- ✅ Infinite scroll loads additional pages smoothly (500px threshold)
- ✅ Deduplication prevents DOM bloat from duplicate listing cards
- ✅ Loading skeletons provide perceived performance during fetches
- ✅ Garage tabs load only their own data
- ✅ Listing actions (create/edit/delete/status) complete within 1 second
- ✅ React Query cache provides instant navigation after first load
- ✅ Background refetch doesn't block UI
- ✅ No memory leaks or performance degradation during extended use

**Test Data**:

- 50-100 listings across categories
- User with 20+ owned listings
- Performance monitoring tools (browser DevTools, Lighthouse)

**Priority**: Medium
**Requirement Reference**: Performance

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test user accounts created:
  - Owner with completed Stripe onboarding and community membership
  - Owner without Stripe onboarding (for auth testing)
  - Non-owner user (for authorization testing)
  - User not in any community (for membership testing)
- [ ] Test categories seeded in database
- [ ] Test listings created in various statuses (available, rented, maintenance, inactive, pending_review)
- [ ] Image files prepared:
  - Valid JPEG under 10MB
  - Oversized image (>10MB)
  - Non-image file (.pdf, .txt)
  - Clear tool photo (for AI analysis)
- [ ] Owner policy documents available in system
- [ ] Stripe test mode enabled
- [ ] OpenAI API accessible (for AI image analysis)

### Test Environment

- **Environment**: Staging/Production
- **Browsers**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
  - iOS: iPhone 12+ (Safari)
  - Android: Various (Chrome)
  - Tablet: iPad (Safari)
- **Database**: PostgreSQL with test data
- **Payment**: Stripe test mode

### Test Execution

- [ ] Execute all 19 test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Verify all mobile-specific scenarios (15-18) on real devices
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed (Scenarios 1, 12, 15, 16)
- [ ] Document any known issues or limitations
- [ ] Verify performance metrics meet targets
- [ ] Sign off on feature acceptance
- [ ] Prepare test summary report

## Acceptance Criteria Summary

The Listings Management feature SHALL be considered accepted when:

1. ✅ Listing creation works with all form sections, image upload, and legal acknowledgment
2. ✅ Listing editing preserves data and handles image add/remove correctly
3. ✅ Soft delete works with confirmation and status change to "inactive"
4. ✅ Status transitions work correctly (available/maintenance/inactive)
5. ✅ AI image analysis functions without disrupting user workflow
6. ✅ Explore page search, filtering, sorting, and infinite scroll work correctly
7. ✅ Garage page tabs, filters, and empty states render correctly
8. ✅ Favorites toggle with optimistic updates
9. ✅ Authorization prevents non-owner access to edit/delete/status
10. ✅ Mobile layout is responsive across all breakpoints (375px - 1440px+)
11. ✅ Mobile inputs use correct keyboard types and prevent iOS zoom
12. ✅ Performance is acceptable with expected data volume
13. ✅ Error handling provides clear, user-friendly feedback
14. ✅ No regression in existing listing functionality

## Known Issues and Limitations

- **Weekly/monthly rates**: Currently disabled (commented out in PricingSection UI); schema supports them but they are not user-facing
- **Archived tab**: Currently disabled (commented out in GarageTabsClient); only Active, Inactive, and Pending Review tabs are functional
- **Image drag-and-drop reorder**: Uses hover-based UI (`group-hover`) which may require long-press adaptation for touch devices
- **AI image analysis**: Accuracy depends on OpenAI API quality; no guarantee of correct tool detection
- **Image reorder on mobile**: GripVertical drag handle appears on hover — touch interaction may need testing/refinement

_Additional issues to be filled during test execution_

## Test Sign-Off

- **Test Executor**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_
- **Business Stakeholder**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_
- **Product Owner**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_
- **Technical Lead**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_

---

**Document Version**: 1.0
**Last Updated**: 2026
**Next Review**: After test execution
