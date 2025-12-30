# Test Plan: Rentals

## Requirements Traceability

This test plan covers rental request management including creation, approval, cancellation, status management, instructions updates, payment integration, and rental lifecycle management. Tests verify business logic, authorization, payment processing, and user experience requirements.

### Core Rental Requirements

**Test Coverage**:

- Unit tests: RentalDAL methods, server actions, form validation, payment processing
- Integration tests: Rental request flow, approval flow, cancellation flow, payment flow
- E2E tests: Complete rental workflows from request to completion
- BDD scenarios: Rental request, approval, and management acceptance criteria

## Test Types

### Unit Tests

#### DAL Methods

- [ ] `RentalDAL.createRentalRequest` - Create rental request with validation
  - Happy path: Valid data, authenticated user, available dates, creates request
  - Error: Unauthenticated user throws UnauthorizedError
  - Error: Invalid data throws ValidationError
  - Error: Dates in past throws ValidationError
  - Error: End date before start date throws ValidationError
  - Error: Listing not available for dates throws ValidationError
  - Error: Listing belongs to requester throws ValidationError
  - Edge case: Date availability checking
  - Edge case: Delivery and setup fee calculation

- [ ] `RentalDAL.approveRentalRequest` - Approve rental request with authorization
  - Happy path: Owner approves request, creates rental, updates availability
  - Error: Non-owner cannot approve (throws UnauthorizedError)
  - Error: Request not found (throws NotFoundError)
  - Error: Request already processed throws ValidationError
  - Error: Dates no longer available throws ValidationError
  - Edge case: Payment processing integration
  - Edge case: Conversation creation

- [ ] `RentalDAL.declineRentalRequest` - Decline rental request with authorization
  - Happy path: Owner declines request with reason
  - Error: Non-owner cannot decline (throws UnauthorizedError)
  - Error: Request not found (throws NotFoundError)
  - Error: Request already processed throws ValidationError
  - Edge case: Denial reason recording

- [ ] `RentalDAL.cancelRentalRequest` - Cancel rental request (renter)
  - Happy path: Renter cancels their request
  - Error: Non-renter cannot cancel (throws UnauthorizedError)
  - Error: Request not found (throws NotFoundError)
  - Error: Request already processed throws ValidationError
  - Edge case: Refund processing if payment made

- [ ] `RentalDAL.startRental` - Start rental (mark as active)
  - Happy path: Owner starts rental on start date
  - Error: Non-owner cannot start (throws UnauthorizedError)
  - Error: Rental not found (throws NotFoundError)
  - Error: Start date not reached throws ValidationError
  - Edge case: Status transition validation

- [ ] `RentalDAL.endRental` - End rental (mark as completed)
  - Happy path: Owner ends rental, makes available for review
  - Error: Non-owner cannot end (throws UnauthorizedError)
  - Error: Rental not found (throws NotFoundError)
  - Error: Rental not started throws ValidationError
  - Edge case: Review eligibility after completion

- [ ] `RentalDAL.updateRentalInstructions` - Update rental instructions
  - Happy path: Owner updates instructions for active rental
  - Error: Non-owner cannot update (throws UnauthorizedError)
  - Error: Rental not found (throws NotFoundError)
  - Error: Rental not active throws ValidationError
  - Edge case: Instruction history tracking

- [ ] `RentalDAL.getRentalById` - Retrieve single rental
  - Happy path: Returns rental by ID with all details
  - Error: Rental not found returns null
  - Edge case: Includes conversation, review eligibility

- [ ] `RentalDAL.getBorrowedListings` - Get user's borrowed listings
  - Happy path: Returns current and upcoming rentals
  - Edge case: Empty result set
  - Edge case: Filtering by status

- [ ] `RentalDAL.getLendingRequests` - Get owner's rental requests
  - Happy path: Returns pending, approved, declined requests
  - Edge case: Empty result set
  - Edge case: Filtering by status

- [ ] `RentalDAL.getRentalDetails` - Get comprehensive rental details
  - Happy path: Returns full rental details with related data
  - Error: Rental not found returns null
  - Edge case: Includes listing, users, conversation, reviews

#### Server Actions

- [ ] `createRentalRequest` - Create rental request via form submission
  - Happy path: Valid FormData creates request and revalidates path
  - Error: Invalid FormData returns error result
  - Error: DAL error returns user-friendly error message
  - Error: Date conflicts return appropriate error
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent

- [ ] `approveRentalRequest` - Approve rental request via server action
  - Happy path: Owner approves request, payment processed, rental created
  - Error: Unauthorized access returns error
  - Error: Payment failure returns error
  - Error: Dates no longer available returns error
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent

- [ ] `declineRentalRequest` - Decline rental request via server action
  - Happy path: Owner declines with reason
  - Error: Unauthorized access returns error
  - Error: Validation errors returned to user
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent

- [ ] `cancelRentalRequest` - Cancel rental request via server action
  - Happy path: Renter cancels request
  - Error: Unauthorized access returns error
  - Error: Request already processed returns error
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent
  - Integration: Verifies refund processed if payment made

- [ ] `startRental` - Start rental via server action
  - Happy path: Owner starts rental on start date
  - Error: Unauthorized access returns error
  - Error: Start date not reached returns error
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent

- [ ] `endRental` - End rental via server action
  - Happy path: Owner ends rental
  - Error: Unauthorized access returns error
  - Error: Rental not started returns error
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent
  - Integration: Verifies review eligibility

- [ ] `updateRentalInstructions` - Update instructions via server action
  - Happy path: Owner updates instructions
  - Error: Unauthorized access returns error
  - Error: Rental not active returns error
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent

#### Components

- [ ] `RentalsClient` - Main rentals page component
  - Rendering: Tabs for renting/lending, filters
  - User interaction: Tab switching, filter changes
  - Loading state: Shows skeleton during data fetch
  - Error state: Shows error message on failure

- [ ] `RentalList` - List of user's rentals (borrowed)
  - Rendering: Grid/list of rental cards
  - User interaction: Rental card clicks navigate to detail
  - Empty state: Shows message when no rentals
  - Filtering: Filters by status (current, upcoming, past)

- [ ] `RentalCard` - Individual rental card display
  - Rendering: Shows rental details, listing info, dates, status
  - User interaction: Click navigates to detail page
  - Status display: Shows correct status badge
  - Edge case: Missing listing image shows placeholder

- [ ] `LendingList` - List of owner's rental requests
  - Rendering: Grid/list of request cards
  - User interaction: Request card clicks navigate to detail
  - Empty state: Shows message when no requests
  - Filtering: Filters by status (pending, approved, declined)

- [ ] `LendingCard` - Individual rental request card display
  - Rendering: Shows request details, renter info, dates, status
  - User interaction: Click navigates to detail page
  - Action buttons: Approve, decline buttons (if pending)
  - Status display: Shows correct status badge

- [ ] `ApproveRequestDialog` - Dialog for approving rental request
  - Rendering: Confirmation dialog with request details
  - User interaction: Confirm approval triggers action
  - Loading state: Shows loading during approval
  - Error handling: Displays errors on failure
  - Payment display: Shows payment amount

- [ ] `DeclineRequestDialog` - Dialog for declining rental request
  - Rendering: Dialog with reason input
  - User interaction: Enter reason and confirm decline
  - Validation: Requires reason for decline
  - Loading state: Shows loading during decline

- [ ] `CancelRequestDialog` - Dialog for canceling rental request
  - Rendering: Confirmation dialog
  - User interaction: Confirm cancellation triggers action
  - Loading state: Shows loading during cancellation
  - Refund display: Shows refund amount if applicable

- [ ] `StartRentalDialog` - Dialog for starting rental
  - Rendering: Confirmation dialog
  - User interaction: Confirm start triggers action
  - Validation: Checks start date reached
  - Loading state: Shows loading during start

- [ ] `EndRentalDialog` - Dialog for ending rental
  - Rendering: Confirmation dialog
  - User interaction: Confirm end triggers action
  - Validation: Checks rental started
  - Loading state: Shows loading during end

- [ ] `UpdateInstructionsDialog` - Dialog for updating instructions
  - Rendering: Form with instruction input
  - User interaction: Update instructions triggers action
  - Loading state: Shows loading during update

- [ ] `RentalLayout` - Rental detail page layout
  - Rendering: Wraps rental detail components
  - Navigation: Handles back navigation
  - Loading state: Shows skeleton during data fetch

- [ ] `RentalHeader` - Rental detail page header
  - Rendering: Rental title, status badge
  - User interaction: Action buttons based on status

- [ ] `RentalStatusCard` - Rental status display card
  - Rendering: Current status, dates, timeline
  - Status transitions: Shows status history
  - Edge case: Different statuses display correctly

- [ ] `RentalDetailsCard` - Rental details display card
  - Rendering: Rental information, dates, amounts
  - User interaction: Edit buttons (if owner)

- [ ] `RentalListingInfo` - Listing information card
  - Rendering: Listing details, images, description
  - User interaction: Click navigates to listing

- [ ] `RentalUserInfo` - User information card
  - Rendering: Renter/owner profile, rating, reviews
  - User interaction: Click navigates to user profile

- [ ] `RentalActions` - Rental action buttons
  - Rendering: Action buttons based on status and user role
  - User interaction: Buttons trigger appropriate actions
  - Authorization: Shows correct actions for owner vs renter

- [ ] `RentalMessagesCard` - Messages/conversation card
  - Rendering: Conversation preview, message count
  - User interaction: Click opens conversation

- [ ] `RentalReviewsCard` - Reviews card
  - Rendering: Review eligibility, existing reviews
  - User interaction: Leave review button (if eligible)

- [ ] `RentalProtection` - Rental protection information
  - Rendering: Protection details, terms
  - Information display: Shows protection coverage

- [ ] `RentalContent` - Main rental content area
  - Rendering: All rental detail cards
  - Layout: Responsive layout

#### Hooks

- [ ] `useRentals` - Fetch rentals with React Query
  - Data fetching: Fetches user's rentals (borrowed/lending)
  - Filtering: Filters by status
  - Loading state: Returns loading boolean
  - Error state: Returns error object
  - Cache management: Proper cache key usage
  - Cache invalidation: Invalidates on mutations

#### Utilities

- [ ] `rental-form.schema.ts` - Zod validation schema
  - Valid: Accepts valid rental request data
  - Invalid: Rejects invalid data with specific error messages
  - Date validation: Start date, end date, date range
  - Edge cases: Boundary values, date conflicts

- [ ] `utils.ts` - Rental utility functions
  - Date calculations: Rental duration, days calculation
  - Amount calculations: Total amount, fees, deposits
  - Status helpers: Status checks, transitions

- [ ] `constants.ts` - Rental constants
  - Status constants: All rental statuses
  - Fee constants: Delivery fees, setup fees

### Integration Tests

- [ ] **Rental Request Flow: Form → Action → DAL → Database**
  - Complete flow: User submits request → action validates → DAL creates request → database stores request
  - Date validation: Checks availability before creating
  - Error propagation: DAL error → action error → form error display
  - Notification: Request created → notification sent

- [ ] **Approval Flow: Action → DAL → Payment → Rental Creation**
  - Complete flow: Owner approves → payment processed → rental created → availability updated
  - Payment integration: Payment success → rental created
  - Payment failure: Payment fails → error returned → request remains pending
  - Notification: Request approved → notifications sent

- [ ] **Cancellation Flow: Action → DAL → Refund → Status Update**
  - Complete flow: Renter cancels → refund processed → request cancelled
  - Refund integration: Refund success → request cancelled
  - Refund failure: Handled gracefully
  - Notification: Request cancelled → notifications sent

- [ ] **Rental Lifecycle: Start → Active → End**
  - Complete flow: Start rental → active status → end rental → completed status
  - Status transitions: Valid transitions only
  - Notification: Status changes → notifications sent

- [ ] **Component → Hook → API Flow**
  - Data fetching: Component uses hook → hook fetches from API → data displayed
  - Loading states: Hook loading state → component shows loading UI
  - Error states: API error → hook error state → component shows error
  - Cache invalidation: After mutations, cache refreshes

- [ ] **Payment Integration Flow**
  - Payment processing: Stripe integration → payment success/failure
  - Refund processing: Refund creation → refund success/failure
  - Payment status: Payment status tracked correctly

### E2E Tests

- [ ] **Complete Rental Request Workflow**
  - User views listing
  - Clicks "Rent" button
  - Selects rental dates
  - Fills out rental form
  - Submits request
  - Verifies request created
  - Verifies owner notified

- [ ] **Complete Rental Approval Workflow**
  - Owner views rental request
  - Reviews request details
  - Clicks "Approve" button
  - Confirms approval
  - Verifies payment processed
  - Verifies rental created
  - Verifies renter notified

- [ ] **Complete Rental Cancellation Workflow**
  - Renter views their request
  - Clicks "Cancel" button
  - Confirms cancellation
  - Verifies refund processed (if payment made)
  - Verifies request cancelled
  - Verifies owner notified

- [ ] **Complete Rental Lifecycle Workflow**
  - Rental approved
  - Start date reached
  - Owner starts rental
  - Rental active
  - End date reached
  - Owner ends rental
  - Verifies rental completed
  - Verifies review eligibility

- [ ] **Payment Failure Handling**
  - Owner attempts to approve request
  - Payment fails
  - Verifies error message displayed
  - Verifies request remains pending
  - Verifies no rental created

### BDD Scenarios

```gherkin
Feature: Create Rental Request
  As a renter
  I want to request a tool rental
  So that I can borrow tools from other users

  Background:
    Given I am logged in as a renter
    And there is an available tool listing

  Scenario: Successfully create rental request
    Given I am viewing a tool listing
    When I click the "Rent" button
    And I select rental dates
    And I fill in the rental form
    And I submit the request
    Then the rental request should be created
    And the tool owner should receive a notification
    And I should see a confirmation message

  Scenario: Create request fails with invalid dates
    Given I am viewing a tool listing
    When I select dates in the past
    And I submit the request
    Then I should see a date validation error
    And the request should not be created

  Scenario: Create request fails when dates unavailable
    Given I am viewing a tool listing
    And the dates are already booked
    When I select those dates
    And I submit the request
    Then I should see an availability error
    And the request should not be created

Feature: Approve Rental Request
  As a tool owner
  I want to approve rental requests
  So that renters can use my tools

  Background:
    Given I am logged in as a tool owner
    And I have received a rental request

  Scenario: Successfully approve rental request
    Given I am viewing the rental request
    When I click the "Approve" button
    And I confirm the approval
    Then the payment should be processed
    And the rental should be created
    And the renter should receive a notification
    And I should see a success message

  Scenario: Approval fails when dates unavailable
    Given I am viewing a rental request
    And the dates are no longer available
    When I attempt to approve
    Then I should see an availability error
    And the request should not be approved

Feature: Cancel Rental Request
  As a renter
  I want to cancel my rental request
  So that I can change my plans

  Background:
    Given I am logged in as a renter
    And I have created a rental request

  Scenario: Successfully cancel rental request
    Given I am viewing my rental request
    When I click the "Cancel" button
    And I confirm the cancellation
    Then the request should be cancelled
    And I should receive a refund if payment was made
    And the owner should receive a notification
```

## Test Data Requirements

### Test Fixtures

**Location**: `src/test/fixtures/rentals.ts` (needs to be created)

**Required Fixtures**:

- `mockRentalRequest` - Complete rental request object
- `mockRental` - Complete rental object
- `mockRentalRequestPending` - Pending status request
- `mockRentalRequestApproved` - Approved request
- `mockRentalRequestDeclined` - Declined request
- `mockRentalActive` - Active rental
- `mockRentalCompleted` - Completed rental
- `mockRentalDetails` - Full rental details
- `mockBorrowedListing` - Borrowed listing data
- `mockLendingRequest` - Lending request data

### Test Database Seeding

**For Integration/E2E Tests**:

- Seed script: `src/test/seed.ts`
- Create test users (owner, renter)
- Create test listings (various statuses)
- Create test rental requests (various statuses)
- Create test rentals (various statuses)
- Reset database before test suite execution

## Coverage Goals

### Feature-Specific Targets

- **DAL Methods**: 70%+ (exceeds 50% threshold, critical business logic)
  - `RentalDAL.createRentalRequest`: 90%+ (all branches covered)
  - `RentalDAL.approveRentalRequest`: 90%+ (all branches covered)
  - `RentalDAL.declineRentalRequest`: 85%+
  - `RentalDAL.cancelRentalRequest`: 85%+
  - `RentalDAL.startRental`: 85%+
  - `RentalDAL.endRental`: 85%+
  - `RentalDAL.updateRentalInstructions`: 85%+
  - `RentalDAL.getRentalById`: 85%+
  - `RentalDAL.getBorrowedListings`: 80%+
  - `RentalDAL.getLendingRequests`: 80%+

- **Server Actions**: 85%+ (user-facing mutations)
  - `createRentalRequest`: 90%+
  - `approveRentalRequest`: 90%+
  - `declineRentalRequest`: 85%+
  - `cancelRentalRequest`: 85%+
  - `startRental`: 85%+
  - `endRental`: 85%+
  - `updateRentalInstructions`: 85%+

- **React Components**: 80%+ (exceeds 75% threshold)
  - `RentalsClient`: 80%+
  - `RentalList`: 80%+
  - `RentalCard`: 85%+
  - `LendingList`: 80%+
  - `LendingCard`: 85%+
  - Dialog components: 85%+ each
  - Detail page components: 80%+ each

- **Hooks**: 85%+ (data fetching logic)
  - `useRentals`: 90%+

- **Utilities**: 90%+ (reusable functions)
  - `rental-form.schema.ts`: 100% (all validation paths)
  - `utils.ts`: 90%+
  - `constants.ts`: 100%

### Overall Feature Coverage

- **Statements**: > 85%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 85% (meets 80% threshold for features)

## Test Execution

### Unit Tests

- Execute: `bun test:run --grep "rental"`
- Watch mode: `bun test:watch --grep "rental"`
- Coverage: `bun test:coverage --grep "rental"`

### Integration Tests

- Tagged with `@integration` or in `src/features/rentals/__tests__/integration/`
- Execute: `bun test:run --grep "integration.*rental"`

### E2E Tests

- Execute: `bun test:e2e --grep "rental"`
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
- Test authorization checks (owner vs renter)

### Payment Testing

- Mock Stripe API for unit/integration tests
- Use test Stripe keys for E2E tests
- Test payment success and failure scenarios
- Test refund processing
- Test payment status tracking

### Date Validation Testing

- Test date availability checking
- Test date range validation
- Test timezone handling
- Test edge cases (same day, overlapping dates)

### Status Transition Testing

- Test valid status transitions
- Test invalid status transitions prevented
- Test status-based authorization

### Notification Testing

- Mock notification service for unit/integration tests
- Test notification sending on events
- Test notification content

## Test Maintenance

### When to Update Tests

- Requirements change → Update test scenarios and BDD features
- Schema changes → Update fixtures and validation tests
- UI changes → Update component tests
- Payment changes → Update payment integration tests
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

- `RentalDAL` - Comprehensive tests in `src/dal/__tests__/rentals.dal.test.ts`
- `createRentalRequest` action - Tests in `src/features/rentals/actions/__tests__/create-rental-request.test.ts`
- `approveRentalRequest` action - Tests in `src/features/rentals/actions/__tests__/approve-rental-request.test.ts`

### Missing Test Coverage

- `declineRentalRequest` action (no tests)
- `cancelRentalRequest` action (no tests)
- `startRental` action (no tests)
- `endRental` action (no tests)
- `updateRentalInstructions` action (no tests)
- All components (no tests)
- `useRentals` hook (no tests)
- Integration tests (none exist)
- E2E tests (none exist)

## References

- **Test Plan Template**: `docs/AI-test-plan-template.md`
- **EARS Methodology**: `.ai/AI-ears-methodology.md`
- **BDD Methodology**: `.ai/AI-bdd-methodology.md`
- **TDD Methodology**: `.ai/AI-tdd-methodology.md`
- **Existing DAL Test**: `src/dal/__tests__/rentals.dal.test.ts`
- **Existing Action Tests**: `src/features/rentals/actions/__tests__/`
