# Test Plan: Example Feature - Tool Listing Management

## Requirements Traceability

This test plan maps to requirements from `specs/example-feature/1-requirements.md`. Each test verifies specific acceptance criteria.

### Requirement 1: Create Tool Listing

**Requirement Reference**: `specs/example-feature/1-requirements.md` - Requirement 1.1, 1.2, 1.3

**Test Coverage**:

- Unit tests: ListingDAL.create method, form validation schema
- Integration tests: createListingAction → ListingDAL.create flow
- E2E tests: Complete listing creation workflow from form submission
- BDD scenarios: User creates listing acceptance criteria

### Requirement 2: Update Tool Listing

**Requirement Reference**: `specs/example-feature/1-requirements.md` - Requirement 2.1, 2.2

**Test Coverage**:

- Unit tests: ListingDAL.update method, authorization checks
- Integration tests: updateListingAction → ListingDAL.update flow
- E2E tests: Edit listing workflow
- BDD scenarios: Owner updates their listing

### Requirement 3: View Tool Listings

**Requirement Reference**: `specs/example-feature/1-requirements.md` - Requirement 3.1, 3.2

**Test Coverage**:

- Unit tests: ListingDAL.getById, ListingDAL.getAll methods
- Integration tests: React Query hooks fetching listings
- E2E tests: Browse listings page, view listing details
- BDD scenarios: User views available tools

## Test Types

### Unit Tests

#### DAL Methods

- [ ] `ListingDAL.create` - Create listing with authentication
  - Happy path: Valid data, authenticated user
  - Error: Unauthenticated user throws UnauthorizedError
  - Error: Invalid data throws ValidationError
  - Edge case: Empty description (if allowed)
  - Edge case: Very long name/description

- [ ] `ListingDAL.update` - Update listing with authorization
  - Happy path: Owner updates their listing
  - Error: Non-owner cannot update (throws UnauthorizedError)
  - Error: Listing not found (throws NotFoundError)
  - Edge case: Partial updates (only some fields)

- [ ] `ListingDAL.getById` - Retrieve single listing
  - Happy path: Returns listing by ID
  - Error: Listing not found returns null
  - Edge case: Deleted/archived listing handling

- [ ] `ListingDAL.getAll` - Retrieve all listings
  - Happy path: Returns paginated listings
  - Edge case: Empty result set
  - Edge case: Pagination boundaries

#### Server Actions

- [ ] `createListingAction` - Create listing via form submission
  - Happy path: Valid FormData creates listing and revalidates path
  - Error: Invalid FormData returns error result
  - Error: DAL error returns user-friendly error message
  - Integration: Verifies revalidatePath called

- [ ] `updateListingAction` - Update listing via form submission
  - Happy path: Valid FormData updates listing
  - Error: Unauthorized access returns error
  - Error: Validation errors returned to user

#### Components

- [ ] `ListingForm` - Form for creating/editing listings
  - Rendering: All form fields visible
  - User interaction: Form submission triggers action
  - Validation: Shows error messages for invalid inputs
  - Loading state: Shows loading indicator during submission
  - Success state: Shows success message after submission

- [ ] `ListingCard` - Display listing information
  - Rendering: Shows listing name, description, price
  - User interaction: Click navigates to detail page
  - Edge case: Missing image shows placeholder

- [ ] `ListingDetailView` - Full listing details
  - Rendering: Shows all listing information
  - User interaction: Edit button (if owner)
  - Edge case: Non-existent listing shows 404

#### Utilities

- [ ] `listing.schema.ts` - Zod validation schema
  - Valid: Accepts valid listing data
  - Invalid: Rejects invalid data with specific error messages
  - Edge cases: Boundary values (min/max lengths, prices)

### Integration Tests

- [ ] **Form → Server Action → DAL Flow**
  - Complete flow: User submits form → action processes → DAL creates listing
  - Error propagation: DAL error → action error → form error display
  - Authentication: Unauthenticated user → error at DAL level

- [ ] **Component → Hook → API Flow**
  - Data fetching: Component uses hook → hook fetches from API → data displayed
  - Loading states: Hook loading state → component shows loading UI
  - Error states: API error → hook error state → component shows error

- [ ] **React Query Cache Management**
  - Cache invalidation: After create/update, cache refreshes
  - Optimistic updates: UI updates immediately, then syncs with server

### E2E Tests

- [ ] **Complete Listing Creation Workflow**
  - User logs in
  - Navigates to "Create Listing" page
  - Fills out form with valid data
  - Submits form
  - Verifies listing appears in "My Listings" page
  - Verifies listing details are correct

- [ ] **Listing Update Workflow**
  - User views their listing
  - Clicks "Edit" button
  - Modifies listing details
  - Submits changes
  - Verifies updated information displays correctly

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
```

## Test Data Requirements

### Test Fixtures

**Location**: `src/test/fixtures/listings.ts`

**Required Fixtures**:

- `mockListing` - Complete listing object with all fields
- `mockListingMinimal` - Listing with only required fields
- `mockListingInvalid` - Listing with invalid data for error testing
- `mockUser` - User object for authentication testing
- `mockOwner` - Owner user for authorization testing
- `mockRenter` - Non-owner user for authorization testing

### Test Database Seeding

**For Integration/E2E Tests**:

- Seed script: `src/test/seed.ts`
- Create test users (owner, renter, admin)
- Create test listings (owned by test users)
- Reset database before test suite execution

## Coverage Goals

### Feature-Specific Targets

- **DAL Methods**: 95%+ (critical business logic)
  - `ListingDAL.create`: 100% (all branches covered)
  - `ListingDAL.update`: 100% (all branches covered)
  - `ListingDAL.getById`: 90%+
  - `ListingDAL.getAll`: 85%+

- **Server Actions**: 90%+
  - `createListingAction`: 100%
  - `updateListingAction`: 100%

- **React Components**: 80%+
  - `ListingForm`: 85%+
  - `ListingCard`: 80%+
  - `ListingDetailView`: 80%+

- **Utilities**: 90%+
  - `listing.schema.ts`: 100% (all validation paths)

### Overall Feature Coverage

- **Statements**: > 85%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 85%

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

### Image Upload Testing

- Mock Vercel Blob upload for unit/integration tests
- Use test image files for E2E tests

### Form Validation Testing

- Test Zod schema validation independently
- Test form-level validation in component tests
- Test server-side validation in server action tests

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

## References

- **Test Plan Template**: `docs/AI-test-plan-template.md`
- **EARS Methodology**: `.ai/AI-ears-methodology.md`
- **BDD Methodology**: `.ai/AI-bdd-methodology.md`
- **TDD Methodology**: `.ai/AI-tdd-methodology.md`
- **Example Component Test**: `src/features/listings/components/__tests__/status-icon-with-tooltip.test.tsx`
