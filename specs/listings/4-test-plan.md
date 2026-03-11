# Test Plan: Listings

## Requirements Traceability

This test plan covers tool listing management including creation, updates, deletion, status management, image handling, favorites, garage page functionality, and explore page features. Tests verify business logic, authorization, and user experience requirements.

### Core Listing Requirements

**Test Coverage**:

- Unit tests: ListingDAL methods, server actions, form validation, image handling
- Integration tests: Create/update/delete flows, status management, image upload flows
- E2E tests: Complete listing management workflows from UI to database
- BDD scenarios: Listing creation, update, and management acceptance criteria

## Test Types

### Unit Tests

#### DAL Methods

- [x] `ListingDAL.createListing` - Create listing with authentication
  - Happy path: Valid data, authenticated user, creates listing
  - Error: Unauthenticated user throws UnauthorizedError
  - Error: Invalid data throws ValidationError
  - Edge case: Empty description (if allowed)
  - Edge case: Very long name/description
  - Edge case: Price validation (daily, weekly, monthly rates)

- [x] `ListingDAL.updateListing` - Update listing with authorization
  - Happy path: Owner updates their listing
  - Error: Non-owner cannot update (throws UnauthorizedError)
  - Error: Listing not found (throws NotFoundError)
  - Edge case: Partial updates (only some fields)
  - Edge case: Status changes during active rentals

- [x] `ListingDAL.deleteListing` - Delete listing with authorization
  - Happy path: Owner deletes their listing
  - Error: Non-owner cannot delete (throws UnauthorizedError)
  - Error: Listing not found (throws NotFoundError)
  - Edge case: Listing with active rentals (should prevent deletion)
  - Edge case: Soft delete vs hard delete

- [x] `ListingDAL.getById` - Retrieve single listing
  - Happy path: Returns listing by ID with images
  - Error: Listing not found returns null
  - Edge case: Deleted/archived listing handling
  - Edge case: Includes user favorites status

- [x] `ListingDAL.getAll` - Retrieve all listings with pagination
  - Happy path: Returns paginated listings
  - Edge case: Empty result set
  - Edge case: Pagination boundaries
  - Edge case: Filtering by category, status, price range

- [x] `ListingDAL.updateListingStatus` - Update listing status
  - Happy path: Owner updates status (available, rented, maintenance, inactive)
  - Error: Non-owner cannot update status
  - Edge case: Status transitions validation
  - Edge case: Status change during active rental

- [x] `ListingDAL.searchListings` - Search listings with filters
  - Happy path: Returns filtered search results
  - Edge case: Empty search query
  - Edge case: Multiple filter combinations
  - Edge case: Sorting options (price, rating, distance, newest)

#### Server Actions

- [x] `createListing` - Create listing via form submission
  - Happy path: Valid FormData creates listing and revalidates path
  - Error: Invalid FormData returns error result
  - Error: DAL error returns user-friendly error message
  - Integration: Verifies revalidatePath called
  - Edge case: Image upload handling

- [x] `updateListing` - Update listing via form submission
  - Happy path: Valid FormData updates listing
  - Error: Unauthorized access returns error
  - Error: Validation errors returned to user
  - Integration: Verifies revalidatePath called

- [x] `deleteListing` - Delete listing via server action
  - Happy path: Owner deletes listing successfully
  - Error: Unauthorized access returns error
  - Error: Listing with active rentals prevents deletion
  - Integration: Verifies revalidatePath called

- [x] `updateListingStatus` - Update listing status via server action
  - Happy path: Owner updates status successfully
  - Error: Unauthorized access returns error
  - Error: Invalid status transition returns error
  - Integration: Verifies revalidatePath called

- [x] `analyzeToolImage` - AI image analysis for tool detection
  - Happy path: Valid image analyzed, tool detected
  - Error: Invalid image format returns error
  - Error: No tool detected returns appropriate message
  - Edge case: Multiple tools in image
  - Edge case: Image processing failures

- [x] `uploadListingImage` - Upload listing image to blob storage
  - Happy path: Image uploaded successfully, saved to database
  - Error: Invalid file type returns error
  - Error: File too large returns error
  - Error: Upload service failure handled gracefully
  - Edge case: Image ordering (orderIndex)

#### Components

- [x] `AddListingForm` - Form for creating listings
  - Rendering: All form sections visible (basic info, pricing, photos, pickup/delivery, additional details)
  - User interaction: Form submission triggers createListing action
  - Validation: Shows error messages for invalid inputs
  - Loading state: Shows loading indicator during submission
  - Success state: Shows success message and redirects
  - Multi-step form: Navigation between sections
  - Image upload: Handles image selection and preview

- [x] `BasicInformationSection` - Basic listing information form section
  - Rendering: Name, description, category, condition fields
  - Validation: Required field validation
  - User interaction: Form field updates

- [x] `PricingSection` - Pricing information form section
  - Rendering: Daily rate field (required), security deposit field, minimum/maximum rental period fields. Note: Weekly and monthly rate fields are currently disabled (commented out in the UI component). The schema still supports them but they are not user-facing.
  - Validation: Price validation (positive numbers, reasonable ranges)
  - User interaction: Price input updates

- [x] `PhotosSection` - Image upload form section
  - Rendering: Image upload area, preview thumbnails
  - User interaction: Image selection, removal, reordering
  - Validation: Image count limits, file type validation
  - Loading state: Upload progress indicators

- [x] `PickupDeliverySection` - Pickup and delivery options form section
  - Rendering: Delivery mode Select dropdown (pickup_only/delivery_only/both_available). Conditionally shows delivery fee input, delivery radius input, setup service checkbox, and setup fee input when delivery mode is delivery_only or both_available. Setup fee only appears when setupAvailable checkbox is checked.
  - User interaction: Delivery mode selection conditionally shows/hides delivery and setup fields
  - Validation: Delivery radius required when delivery available, setup requires delivery mode

- [x] `AdditionalDetailsSection` - Additional listing details form section
  - Rendering: Custom specifications (key-value pairs with add/remove), usage instructions textarea, safety notes textarea
  - User interaction: Add specification via key/value inputs with Plus button (disabled when empty), remove specification via X button, text input for instructions and safety notes

- [x] `LegalDocumentAcknowledgments` - Owner policy acknowledgment section
  - Rendering: Owner Policies header, document list with modal previews (Safety & Liability Package, Prohibited Items and Listing Content Policy), single acknowledgment checkbox
  - User interaction: Document name buttons open Dialog modals with summary and PDF link; checkbox toggles acknowledgment
  - Validation: Checkbox must be true to submit form
  - Tested in: `listing-form/__tests__/legal-document-acknowledgments.test.tsx`

- [x] `ListingDetailView` - Full listing details display
  - Rendering: Shows all listing information, images, owner info
  - User interaction: Edit button (if owner), favorite button, rent button
  - Edge case: Non-existent listing shows 404
  - Edge case: Missing images shows placeholder
  - Accessibility: Proper semantic HTML, ARIA labels

- [x] `StatusIconWithTooltip` - Status indicator with tooltip
  - Rendering: Correct icon for each status (available, rented, maintenance, inactive)
  - User interaction: Tooltip on hover
  - Accessibility: Proper ARIA attributes
  - Edge case: Unknown status handling

- [x] `ImageCarousel` - Image carousel for listing photos
  - Rendering: Displays listing images
  - User interaction: Navigation arrows, thumbnail selection
  - Edge case: Single image handling
  - Edge case: No images shows placeholder
  - Accessibility: Keyboard navigation

- [x] `FavoritesButton` - Add/remove listing from favorites
  - Rendering: Shows favorite state (filled/outline heart icon)
  - User interaction: Click toggles favorite status
  - Loading state: Shows loading during API call
  - Error handling: Displays error on failure
  - Optimistic updates: UI updates immediately

- [x] `GarageClient` - Garage page main component
  - Rendering: Garage tabs, filters, listings grid
  - User interaction: Tab switching, filter changes
  - Loading state: Shows skeleton during data fetch
  - Error state: Shows error message on failure

- [x] `GarageTabsClient` - Garage tabs (Active, Inactive, Pending Review)
  - Rendering: Tab buttons for each status. Note: Archived tab is currently commented out. Includes PendingReviewListings component with count badge (yellow) when pendingCount > 0.
  - User interaction: Tab switching updates displayed listings and URL params (?tab=inactive, ?tab=pending_review). Clears rentalStatus filter for non-active tabs.
  - Active state: Highlights active tab

- [x] `ActiveListings` - Active listings display
  - Rendering: Grid of active listings
  - User interaction: Listing card interactions
  - Empty state: Shows message when no active listings

- [x] `InactiveListings` - Inactive listings display
  - Rendering: Grid of inactive listings
  - Empty state: Shows message when no inactive listings

- [x] `ArchivedListings` - Archived listings display
  - Rendering: Grid of archived listings
  - Empty state: Shows message when no archived listings

- [x] `GarageFiltersClient` - Garage page filters
  - Rendering: Search input, category filter, status filter
  - User interaction: Filter changes update displayed listings
  - URL state: Filters synced with URL parameters

- [x] `ExplorePageClient` - Explore page main component
  - Rendering: Filters, listings grid, pagination/infinite scroll
  - User interaction: Filter changes, listing selection
  - Loading state: Shows skeleton during data fetch
  - Error state: Shows error message on failure

- [x] `ExplorePageContent` - Explore page content area
  - Rendering: Listings grid with filters
  - User interaction: Listing card clicks navigate to detail page
  - Infinite scroll: Loads more listings on scroll

- [x] `ExplorePageFilters` - Explore page filter controls
  - Rendering: Search, category, price range, condition filters
  - User interaction: Filter changes update results
  - URL state: Filters synced with URL parameters
  - Debouncing: Search input debounced to avoid API spam

- [x] `ExplorePageSkeleton` - Loading skeleton for explore page
  - Rendering: Skeleton placeholders for listings grid

#### Hooks

- [x] `useListings` - Fetch listings with React Query
  - Data fetching: Fetches listings on mount
  - Loading state: Returns loading boolean
  - Error state: Returns error object
  - Cache management: Proper cache key usage
  - Refetching: Manual refetch capability

- [x] `useGarage` - Fetch user's garage listings
  - Data fetching: Fetches user's listings
  - Filtering: Filters by status (active, inactive, archived)
  - Loading state: Returns loading boolean
  - Error state: Returns error object
  - Cache invalidation: Invalidates on create/update/delete

- [x] `useListingForm` - Form state management for listing form
  - Form state: Manages multi-step form state
  - Validation: Client-side validation
  - Submission: Handles form submission
  - Error handling: Displays validation errors

- [x] `useListingImages` - Image management for listing form
  - Image state: Manages selected images
  - Upload: Handles image upload
  - Removal: Handles image removal
  - Reordering: Handles image order changes

- [x] `useURLState` - URL state management for filters
  - URL parsing: Parses filter state from URL
  - URL updates: Updates URL when filters change
  - Browser navigation: Supports back/forward navigation
  - Debouncing: Debounces URL updates for search

#### Utilities

- [x] `listing.schema.ts` - Zod validation schema
  - Valid: Accepts valid listing data
  - Invalid: Rejects invalid data with specific error messages
  - Edge cases: Boundary values (min/max lengths, prices)
  - Server schema: Separate server-side validation schema

### Integration Tests

- [ ] **Form → Server Action → DAL Flow**
  - Complete flow: User submits form → action validates → DAL creates listing → database stores listing
  - Error propagation: DAL error → action error → form error display
  - Authentication: Unauthenticated user → error at DAL level
  - Image upload: Image uploaded → blob storage → database record created

- [ ] **Component → Hook → API Flow**
  - Data fetching: Component uses hook → hook fetches from API → data displayed
  - Loading states: Hook loading state → component shows loading UI
  - Error states: API error → hook error state → component shows error
  - Cache invalidation: After create/update, cache refreshes

- [ ] **React Query Cache Management**
  - Cache invalidation: After create/update/delete, cache refreshes
  - Optimistic updates: UI updates immediately, then syncs with server
  - URL state sync: Filter changes update URL and trigger refetch

- [ ] **Image Upload Flow**
  - Complete flow: User selects image → uploads → blob storage → database record
  - Error handling: Upload failure → error displayed → user can retry
  - Multiple images: Handles multiple image uploads correctly

- [ ] **Status Management Flow**
  - Complete flow: Owner changes status → action validates → DAL updates → cache invalidates
  - Authorization: Non-owner cannot change status
  - Validation: Invalid status transitions prevented

### E2E Tests

- [ ] **Complete Listing Creation Workflow**
  - User logs in
  - Navigates to "Create Listing" page
  - Fills out all form sections with valid data
  - Uploads images
  - Submits form
  - Verifies listing appears in "My Listings" page
  - Verifies listing details are correct
  - Verifies images display correctly

- [ ] **Listing Update Workflow**
  - User views their listing
  - Clicks "Edit" button
  - Modifies listing details
  - Updates images
  - Submits changes
  - Verifies updated information displays correctly

- [ ] **Listing Deletion Workflow**
  - User views their listing
  - Clicks "Delete" button
  - Confirms deletion
  - Verifies listing removed from garage
  - Verifies listing no longer accessible

- [ ] **Status Management Workflow**
  - User views their active listing
  - Changes status to "inactive"
  - Verifies status updated in UI
  - Verifies listing moved to inactive tab

- [ ] **Favorites Workflow**
  - User views a listing
  - Clicks favorite button
  - Verifies listing added to favorites
  - Clicks favorite button again
  - Verifies listing removed from favorites

- [ ] **Explore Page Filtering Workflow**
  - User navigates to explore page
  - Applies category filter
  - Applies price range filter
  - Verifies filtered results display
  - Verifies URL updates with filters
  - Uses browser back button
  - Verifies filters reset correctly

- [ ] **Unauthorized Access Prevention**
  - User attempts to edit another user's listing
  - Verifies error message displayed
  - Verifies listing not modified

### BDD Scenarios

```gherkin
Feature: Create Tool Listing
  As a tool owner
  I want to create a listing for my tool
  So that others can rent it from me

  Background:
    Given I am logged in as a tool owner

  Scenario: Successfully create a listing
    Given I am on the "Create Listing" page
    When I fill in the form with:
      | Field      | Value           |
      | Name       | Power Drill     |
      | Description| Heavy-duty drill|
      | Daily Rate | 15.00           |
    And I upload listing images
    And I submit the form
    Then the listing should be created successfully
    And I should see a success message
    And the listing should appear in "My Listings"
    And I should be redirected to the listing detail page

  Scenario: Create listing fails with invalid data
    Given I am on the "Create Listing" page
    When I fill in the form with invalid data:
      | Field | Value |
      | Name  |       |
    And I submit the form
    Then I should see validation errors
    And the listing should not be created
    And I should remain on the form page

  Scenario: Cannot create listing when not authenticated
    Given I am not logged in
    When I navigate to the "Create Listing" page
    Then I should be redirected to the login page
    And I should see a message prompting me to log in

Feature: Update Tool Listing
  As a tool owner
  I want to update my listing details
  So that I can keep information current

  Background:
    Given I am logged in as a tool owner
    And I have an existing listing

  Scenario: Successfully update listing
    Given I am viewing my listing detail page
    When I click the "Edit" button
    And I modify the description to "Updated description"
    And I submit the form
    Then the listing should be updated
    And I should see the updated description
    And I should see a success message

  Scenario: Cannot update another user's listing
    Given I am logged in as a different user
    When I attempt to edit another user's listing
    Then I should see an error message
    And the listing should not be modified

Feature: Manage Listing Status
  As a tool owner
  I want to change my listing status
  So that I can control availability

  Background:
    Given I am logged in as a tool owner
    And I have an active listing

  Scenario: Successfully change listing status
    Given I am viewing my garage page
    When I change the listing status to "inactive"
    Then the listing status should be updated
    And the listing should appear in the inactive tab
    And I should see a success message

Feature: Add Listing to Favorites
  As a user
  I want to add listings to my favorites
  So that I can easily find them later

  Background:
    Given I am logged in as a user

  Scenario: Successfully add listing to favorites
    Given I am viewing a listing
    When I click the favorite button
    Then the listing should be added to my favorites
    And the favorite button should show as active

  Scenario: Remove listing from favorites
    Given I have a listing in my favorites
    When I view the listing
    And I click the favorite button
    Then the listing should be removed from my favorites
    And the favorite button should show as inactive
```

## Test Data Requirements

### Test Fixtures

**Location**: `src/test/fixtures/listings.ts` (needs to be created or exists)

**Required Fixtures**:

- `mockListing` - Complete listing object with all fields
- `mockListingMinimal` - Listing with only required fields
- `mockListingInvalid` - Listing with invalid data for error testing
- `mockListingWithImages` - Listing with image URLs
- `mockListingActive` - Active status listing
- `mockListingInactive` - Inactive status listing
- `mockListingArchived` - Archived listing
- `mockOwner` - Owner user for authorization testing
- `mockRenter` - Non-owner user for authorization testing
- `mockListingImages` - Image data for testing

### Test Database Seeding

**For Integration/E2E Tests**:

- Seed script: `src/test/seed.ts`
- Create test users (owner, renter)
- Create test listings (various statuses, categories, prices)
- Create test images for listings
- Reset database before test suite execution

## Coverage Goals

### Feature-Specific Targets

- **DAL Methods**: 70%+ (exceeds 50% threshold, critical business logic)
  - `ListingDAL.createListing`: 90%+ (all branches covered)
  - `ListingDAL.updateListing`: 90%+ (all branches covered)
  - `ListingDAL.deleteListing`: 85%+
  - `ListingDAL.getById`: 85%+
  - `ListingDAL.getAll`: 80%+
  - `ListingDAL.updateListingStatus`: 85%+
  - `ListingDAL.searchListings`: 80%+

- **Server Actions**: 85%+ (user-facing mutations)
  - `createListing`: 90%+
  - `updateListing`: 90%+
  - `deleteListing`: 85%+
  - `updateListingStatus`: 85%+
  - `analyzeToolImage`: 80%+
  - `uploadListingImage`: 85%+

- **React Components**: 80%+ (exceeds 75% threshold)
  - `AddListingForm`: 85%+
  - `ListingDetailView`: 85%+
  - `StatusIconWithTooltip`: 90%+ (already well tested)
  - `ImageCarousel`: 85%+
  - `FavoritesButton`: 90%+ (already well tested)
  - `GarageClient`: 80%+
  - `ExplorePageClient`: 80%+
  - Form sections: 80%+ each

- **Hooks**: 85%+ (data fetching logic)
  - `useListings`: 90%+
  - `useGarage`: 90%+
  - `useListingForm`: 85%+
  - `useListingImages`: 85%+
  - `useURLState`: 90%+

- **Utilities**: 90%+ (reusable functions)
  - `listing.schema.ts`: 100% (all validation paths)

### Overall Feature Coverage

- **Statements**: > 85%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 85% (meets 80% threshold for features)

## Test Execution

### Unit Tests

- Execute: `bun test:run --grep "listing"`
- Watch mode: `bun test:watch --grep "listing"`
- Coverage: `bun test:coverage --grep "listing"`

### Integration Tests

- Tagged with `@integration` or in `src/features/listings/__tests__/integration/`
- Execute: `bun test:run --grep "integration.*listing"`

### E2E Tests

- Execute: `bun test:e2e --grep "listing"`
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
- Test authorization checks (owner vs non-owner)

### Image Upload Testing

- Mock Vercel Blob upload for unit/integration tests
- Use test image files for E2E tests
- Test image validation (file type, size limits)
- Test image ordering and removal

### Form Validation Testing

- Test Zod schema validation independently
- Test form-level validation in component tests
- Test server-side validation in server action tests
- Test multi-step form navigation

### React Query Testing

- Test cache invalidation after mutations
- Test optimistic updates
- Test URL state synchronization
- Test infinite scroll pagination

### AI Image Analysis Testing

- Mock OpenAI API for unit/integration tests
- Test tool detection accuracy
- Test error handling for API failures
- Test edge cases (no tool detected, multiple tools)

## Test Maintenance

### When to Update Tests

- Requirements change → Update test scenarios and BDD features
- Schema changes → Update fixtures and validation tests
- UI changes → Update component tests
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

- `ListingDAL` - Comprehensive tests in `src/dal/__tests__/listing.dal.test.ts`
- **Server Actions** (All complete):
  - `createListing` action - Tests in `src/features/listings/actions/__tests__/create-listing.test.ts`
  - `updateListing` action - Tests in `src/features/listings/actions/__tests__/update-listing.test.ts`
  - `updateListingStatus` action - Tests in `src/features/listings/actions/__tests__/update-listing-status.test.ts`
  - `deleteListing` action - Tests in `src/features/listings/actions/__tests__/delete-listing.test.ts`
  - `analyzeToolImage` action - Tests in `src/features/listings/actions/__tests__/analyze-tool-image.test.ts`
  - `uploadListingImage` action - Tests in `src/features/listings/actions/__tests__/upload-listing-image.test.ts`
- **Form Components** (All complete):
  - `AddListingForm` component - Tests in `src/features/listings/components/__tests__/add-listing-form.test.tsx`
  - `BasicInformationSection` - Tests in `src/features/listings/components/listing-form/__tests__/basic-information-section.test.tsx`
  - `PricingSection` - Tests in `src/features/listings/components/listing-form/__tests__/pricing-section.test.tsx`
  - `PhotosSection` - Tests in `src/features/listings/components/listing-form/__tests__/photos-section.test.tsx`
  - `PickupDeliverySection` - Tests in `src/features/listings/components/listing-form/__tests__/pickup-delivery-section.test.tsx`
  - `AdditionalDetailsSection` - Tests in `src/features/listings/components/listing-form/__tests__/additional-details-section.test.tsx`
- **Display Components**:
  - `StatusIconWithTooltip` component - Comprehensive tests (30 tests)
  - `FavoritesButton` component - Comprehensive tests
  - `ImageCarousel` component - Tests in `src/features/listings/components/__tests__/image-carousel.test.tsx`
  - `ListingDetailView` component - Tests in `src/features/listings/components/__tests__/listing-detail-view.test.tsx`
- **Utilities**:
  - `listing.schema.ts` - Comprehensive tests in `src/features/listings/form-schema/__tests__/listing.schema.test.ts`

### Missing Test Coverage

- Integration tests (none exist)
- E2E tests (none exist)

### Recently Added Test Coverage

- **Garage Components**: `GarageClient`, `GarageTabsClient`, `ActiveListings`, `InactiveListings`, `ArchivedListings`, `GarageFiltersClient` - Tests in `src/features/listings/components/garage-page/__tests__/`
- **Explore Components**: `ExplorePageClient`, `ExplorePageContent`, `ExplorePageFilters`, `ExplorePageSkeleton` - Tests in `src/features/listings/components/explore-page/__tests__/`
- **Hooks**: `useListings`, `useGarage`, `useListingForm`, `useListingImages`, `useURLState`, `useListingMutations` - Tests in `src/features/listings/hooks/__tests__/`

## References

- **Test Plan Template**: `docs/AI-test-plan-template.md`
- **EARS Methodology**: `.ai/AI-ears-methodology.md`
- **BDD Methodology**: `.ai/AI-bdd-methodology.md`
- **TDD Methodology**: `.ai/AI-tdd-methodology.md`
- **Example Component Test**: `src/features/listings/components/__tests__/status-icon-with-tooltip.test.tsx`
- **Existing DAL Test**: `src/dal/__tests__/listing.dal.test.ts`
- **Existing Action Tests**: `src/features/listings/actions/__tests__/`
