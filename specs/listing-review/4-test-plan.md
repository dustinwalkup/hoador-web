# Listing Review Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/listing-review/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Database Schema Extensions

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 1

**Test Coverage**:

- Integration tests: Migration execution and rollback
- Unit tests: Schema validation and enum types
- Integration tests: Default values on listing creation
- Integration tests: Existing listings grandfathered as approved

### Requirement 2: Admin Review Panel

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 2

**Test Coverage**:

- Unit tests: DAL methods for fetching pending reviews and history
- Integration tests: Review queue display and ordering
- Integration tests: Review history display with metadata
- E2E tests: Admin review workflow (view, approve, reject)
- Unit tests: Admin authentication and authorization
- Integration tests: Pending review count calculation

### Requirement 3: Listing Visibility Control

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 3

**Test Coverage**:

- Integration tests: Pending listings hidden from public search
- Integration tests: Rejected listings hidden from public search
- Integration tests: Approved listings visible in search
- Integration tests: Owner can see own listings regardless of status
- Integration tests: Admin can see all listings
- Unit tests: Listing form review notice display

### Requirement 4: User-Facing Listing Status Visibility

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 4

**Test Coverage**:

- Integration tests: Pending Review tab in Garage page
- Unit tests: Approval status badge component
- Integration tests: Rejected listings display with reason
- Integration tests: Dashboard widget for pending count
- E2E tests: User experience flow for viewing status

### Requirement 5: Listing Edit Re-Review Process

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: Significant change detection logic
- Integration tests: Significant edits trigger re-review
- Integration tests: Non-significant edits don't trigger re-review
- Integration tests: Re-review clears review metadata

### Requirement 6: Rejection and Resubmission Workflow

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 6

**Test Coverage**:

- Integration tests: Rejection reason required and displayed
- Integration tests: Owner can edit rejected listing
- Integration tests: Owner can delete rejected listing
- Integration tests: Editing rejected listing triggers re-review
- Integration tests: Rejection reason cleared on resubmission

### Requirement 7: Approval and Rejection Notifications

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 7

**Test Coverage**:

- Integration tests: Approval notification sent (in-app and email)
- Integration tests: Rejection notification sent with reason
- Unit tests: Email template generation
- Integration tests: Notification data includes required fields
- Integration tests: Graceful degradation if email fails

### Requirement 8: Admin Access and Permissions

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: Admin authentication guards
- Integration tests: Non-admin access attempts blocked
- Unit tests: Admin-only DAL method access
- Integration tests: Audit trail for review actions

### Requirement 9: Data Migration for Existing Listings

**Requirement Reference**: `specs/listing-review/1-requirements.md` - Requirement 9

**Test Coverage**:

- Integration tests: Migration adds columns correctly
- Integration tests: Existing listings set to approved
- Integration tests: Migration rollback works
- Integration tests: Backward compatibility with null values

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and components in isolation.

**When to Use**:

- DAL methods (data access logic)
- Server action validation and business logic
- Component rendering and interactions
- Helper functions (significant change detection)
- Status badge component logic
- Email template generation

**Coverage Goals**: 85%+ for DAL methods, 80%+ for server actions, 75%+ for components

**Framework**: Vitest with React Testing Library for components

**Test Structure** (AAA Pattern):

```typescript
describe("ListingDAL.getPendingReviews", () => {
  it("should return pending listings ordered by createdAt ascending", async () => {
    // Arrange
    const mockListings = createMockPendingListings();
    vi.mocked(listingDAL.getPendingReviews).mockResolvedValue({
      data: mockListings,
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    // Act
    const result = await listingDAL.getPendingReviews({ page: 1, limit: 20 });

    // Assert
    expect(result.data).toHaveLength(2);
    expect(result.data[0].createdAt.getTime()).toBeLessThan(
      result.data[1].createdAt.getTime(),
    );
  });
});
```

**Areas to Test**:

- **DAL Methods** (`src/dal/listing.dal.ts`):
  - `getPendingReviews()` - Returns correct data structure, ordering, pagination
  - `getReviewHistory()` - Filters by status, includes review metadata
  - `updateApprovalStatus()` - Updates all fields, handles concurrent reviews
  - `countPendingReviews()` - Returns accurate count
  - `hasSignificantChanges()` - Detects changes in significant fields
  - `getUserListingsByApprovalStatus()` - Filters by status correctly
  - Enhanced `searchListings()` - Filters by approval status
  - Enhanced `createListing()` - Sets default approval status
  - Enhanced `updateListing()` - Triggers re-review on significant changes
  - Admin authentication requirements
  - Error handling (unauthorized, not found, validation)

- **Server Actions** (`src/features/admin/actions/listing-review.ts`):
  - `approveListingAction()` - Success flow, notification sending
  - `rejectListingAction()` - Validation, success flow, notification sending
  - Admin authentication checks
  - Error handling and state returns
  - Path revalidation

- **Components**:
  - `ApprovalStatusBadge` - Renders correct badge for each status
  - `ListingReviewCard` - Displays listing and owner context
  - `ApproveRejectDialog` - Validation, form submission
  - `PendingReviewQueue` - Data fetching, empty states
  - Form review notice display

- **Helpers and Utils**:
  - Significant change detection logic
  - Rejection reason validation
  - Email template generation

### Integration Tests

**Purpose**: Test component interactions, data flow between layers, and database operations.

**When to Use**:

- DAL methods with actual database (test database)
- Server actions calling DAL methods
- API routes with database operations
- Component integration with hooks and data fetching
- Full workflows (create listing → appears in queue → approve → visible)

**Coverage Goals**: Critical user flows, 80%+ for integration points

**Framework**: Vitest with test database setup

**Test Structure**:

```typescript
describe("Listing Review Workflow Integration", () => {
  it("should create listing and appear in pending queue", async () => {
    // Arrange
    const user = await createTestUser();
    const listingData = createTestListingData();

    // Act
    const listing = await listingDAL.createListing({
      ...listingData,
      ownerId: user.id,
    });
    const pendingReviews = await listingDAL.getPendingReviews({
      page: 1,
      limit: 20,
    });

    // Assert
    expect(listing.approvalStatus).toBe("pending_review");
    expect(pendingReviews.data).toContainEqual(
      expect.objectContaining({ id: listing.id }),
    );
  });
});
```

**Areas to Test**:

- **Review Workflow**:
  - Create listing → appears in pending queue
  - Admin approves → listing visible in search, owner notified
  - Admin rejects → listing hidden, owner notified with reason
  - Owner edits rejected listing → status returns to pending_review

- **Edit Re-Review**:
  - Significant edit on approved listing → triggers re-review
  - Non-significant edit → no re-review
  - Edit on pending listing → stays pending
  - Edit clears review metadata appropriately

- **Visibility Filtering**:
  - Pending listings not in public search
  - Rejected listings not in public search
  - Approved listings in public search
  - Owner sees own listings regardless of status
  - Admin sees all listings

- **Notification Integration**:
  - Approval notification created and sent
  - Rejection notification created with reason
  - Email sending (mocked)
  - Graceful degradation if email fails

- **API Routes**:
  - Pending reviews endpoint returns correct data
  - Review history endpoint filters correctly
  - Count endpoint returns accurate number
  - Admin authentication enforced

### End-to-End (E2E) Tests

**Purpose**: Test complete user workflows from browser perspective.

**When to Use**:

- Complete admin review workflow
- User experience flow (create → view status → receive notification)
- UI interactions and navigation
- Cross-component integration
- Real browser environment testing

**Coverage Goals**: All critical user paths, happy paths + major error paths

**Framework**: Vitest with React Testing Library (or Playwright if available)

**Example E2E Scenario**:

```typescript
describe("Admin Review E2E", () => {
  it("should allow admin to review and approve listing", async () => {
    // Setup: Create test listing as regular user
    const listing = await createTestListing({
      approvalStatus: "pending_review",
    });

    // Admin logs in and navigates to review page
    await adminLogin();
    await navigateTo("/admin/dashboard/listings/review");

    // Verify listing appears in queue
    expect(await screen.findByText(listing.name)).toBeInTheDocument();

    // Admin clicks approve
    const approveButton = await screen.findByRole("button", {
      name: /approve/i,
    });
    await userEvent.click(approveButton);

    // Verify success and listing removed from queue
    await waitFor(() => {
      expect(screen.queryByText(listing.name)).not.toBeInTheDocument();
    });

    // Verify listing now visible in public search
    await navigateTo("/explore");
    expect(await screen.findByText(listing.name)).toBeInTheDocument();
  });
});
```

**Areas to Test**:

- **Admin Review Flow**:
  - Admin logs in and navigates to review page
  - Admin views pending review queue
  - Admin views full listing context (details, images, owner info)
  - Admin approves listing successfully
  - Admin rejects listing with reason
  - Queue updates after approval/rejection
  - Review history shows reviewed listings

- **User Experience Flow**:
  - User creates listing
  - Listing appears in "Pending Review" tab
  - User sees status badge
  - User receives approval notification
  - Listing appears in Active tab after approval
  - User receives rejection notification with reason
  - User can edit and resubmit rejected listing
  - Dashboard shows pending count

### Manual Testing Scenarios

**Purpose**: Verify functionality in real browser environment and catch edge cases.

**Scenarios**:

1. **Admin Review Interface**:
   - Navigate through review queue
   - View listing details and owner context
   - Test approve/reject actions
   - Verify empty states
   - Test pagination
   - Verify pending count badge updates

2. **User Interface**:
   - Create new listing
   - View "Pending Review" tab
   - See status badges on listing cards
   - Receive and view notifications
   - Edit rejected listing
   - View rejection reason
   - Dashboard widget display

3. **Visibility Testing**:
   - Create pending listing as user A
   - Search as user B (should not see)
   - Search as user A (should see in own view)
   - Admin approves
   - Search as user B (should see)
   - Admin rejects
   - Search as user B (should not see)

4. **Edit Re-Review Testing**:
   - Edit significant field (name, price, images)
   - Verify re-review triggered
   - Edit non-significant field (instructions)
   - Verify no re-review

5. **Notification Testing**:
   - Check in-app notifications
   - Check email notifications
   - Verify notification content
   - Test with email service down

6. **Concurrent Review Testing**:
   - Two admins try to review same listing
   - Verify first succeeds, second gets error

## Test Framework Configuration

### Unit Testing Setup

**Framework**: Vitest (already configured)

**Environment**: happy-dom for React components, Node.js for utilities

**Setup File**: `src/test/setup.ts` (already exists)

**Mocking Strategy**:

- **Database**: Mock Drizzle queries using vi.mock
- **Auth**: Mock `requireAdmin()` and `getCurrentUserId()` functions
- **Notifications**: Mock `sendNotification()` utility
- **React Query**: Use QueryClient wrapper in tests
- **Next.js**: Mock `revalidatePath()` and `redirect()`

**Example Mock Setup**:

```typescript
import { vi } from "vitest";

// Mock auth guards
vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

// Mock DAL
vi.mock("@/dal", () => ({
  listingDAL: {
    getPendingReviews: vi.fn(),
    updateApprovalStatus: vi.fn(),
    // ... other methods
  },
}));

// Mock notifications
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));
```

### Integration Testing Setup

**Framework**: Vitest with test database

**Database**: Use separate test database or in-memory database

**Setup**:

- Create test database connection
- Run migrations before tests
- Seed test data
- Clean up after each test

**Test Database Utilities**:

```typescript
// src/test/utils/test-db.ts
export async function setupTestDatabase() {
  // Create test database connection
  // Run migrations
  // Return database instance
}

export async function cleanupTestDatabase() {
  // Clean up test data
  // Close connections
}

export async function createTestListing(data: Partial<Listing>) {
  // Helper to create test listing
}
```

### E2E Testing Setup

**Framework**: Vitest with React Testing Library (or Playwright if available)

**Approach**: Use React Testing Library for component-level E2E flows

**Component Integration Testing**:

- Render full component trees
- Use actual hooks and data fetching (mocked at API level)
- Test user interactions with userEvent
- Verify UI updates and navigation

## Test Data Management

### Test Fixtures

**Location**: `src/test/fixtures/listings/`

**Purpose**: Reusable test data for consistent testing

**Example Fixtures**:

```typescript
// src/test/fixtures/listings/review.ts
export const mockPendingListing = {
  id: "listing-123",
  name: "Test Listing",
  approvalStatus: "pending_review" as const,
  ownerId: "user-123",
  createdAt: new Date("2024-01-01"),
  // ... other fields
};

export const mockApprovedListing = {
  ...mockPendingListing,
  id: "listing-124",
  approvalStatus: "approved" as const,
  reviewedBy: "admin-123",
  reviewedAt: new Date("2024-01-02"),
};

export const mockRejectedListing = {
  ...mockPendingListing,
  id: "listing-125",
  approvalStatus: "rejected" as const,
  rejectionReason: "Inappropriate content",
  reviewedBy: "admin-123",
  reviewedAt: new Date("2024-01-02"),
};

export const mockPendingReviewListing = {
  ...mockPendingListing,
  owner: {
    id: "user-123",
    name: "John Doe",
    email: "john@example.com",
    // ... owner fields
  },
  ownerOtherListings: {
    total: 3,
    approved: 2,
    pending: 1,
  },
  ownerRentalHistory: {
    totalRentals: 10,
    averageRating: 4.5,
  },
  images: [
    { id: "img-1", imageUrl: "https://example.com/img1.jpg", orderIndex: 0 },
  ],
};
```

### Mock Users

```typescript
// src/test/fixtures/users.ts
export const mockAdminUser = {
  id: "admin-123",
  userType: "admin" as const,
  name: "Admin User",
  email: "admin@example.com",
};

export const mockRegularUser = {
  id: "user-123",
  userType: "standard" as const,
  name: "Regular User",
  email: "user@example.com",
};
```

## Coverage Goals and Metrics

### Coverage Targets

**Overall Listing Review Feature**:

- Statements: > 85%
- Branches: > 85%
- Functions: > 85%
- Lines: > 85%

**By Layer**:

- **DAL Methods** (`src/dal/listing.dal.ts`): 90%+ (critical business logic)
- **Server Actions** (`src/features/admin/actions/listing-review.ts`): 85%+ (business logic)
- **API Routes** (`src/app/api/admin/listings/review/`): 80%+ (routing logic)
- **React Components** (`src/features/admin/components/listing-review/`): 80%+ (UI logic)
- **Hooks** (`src/features/admin/hooks/`): 85%+ (state management)

### Coverage Exclusions

**Exclude**:

- Type definitions (`*.d.ts`)
- Test files (`**/__tests__/**`, `**/*.test.*`)
- Migration files
- Configuration files

## Test Scenarios by Component

### DAL Method Tests

**Location**: `src/dal/__tests__/listing.dal.test.ts`

**Test Cases**:

1. ✅ `getPendingReviews()` returns correct data structure
2. ✅ `getPendingReviews()` orders by createdAt ascending
3. ✅ `getPendingReviews()` includes owner context
4. ✅ `getPendingReviews()` includes owner's other listings count
5. ✅ `getPendingReviews()` includes owner's rental history
6. ✅ `getPendingReviews()` implements pagination correctly
7. ✅ `getPendingReviews()` requires admin authentication
8. ✅ `getPendingReviews()` handles empty results
9. ✅ `getReviewHistory()` filters by status correctly
10. ✅ `getReviewHistory()` orders by reviewedAt descending
11. ✅ `getReviewHistory()` includes review metadata
12. ✅ `updateApprovalStatus()` updates all fields correctly
13. ✅ `updateApprovalStatus()` handles concurrent reviews (locks)
14. ✅ `updateApprovalStatus()` validates listing is pending
15. ✅ `updateApprovalStatus()` requires admin authentication
16. ✅ `countPendingReviews()` returns accurate count
17. ✅ `hasSignificantChanges()` detects name changes
18. ✅ `hasSignificantChanges()` detects description changes
19. ✅ `hasSignificantChanges()` detects price changes
20. ✅ `hasSignificantChanges()` detects image changes
21. ✅ `hasSignificantChanges()` detects category/condition changes
22. ✅ `hasSignificantChanges()` ignores non-significant changes
23. ✅ `getUserListingsByApprovalStatus()` filters correctly
24. ✅ `searchListings()` filters by approval status for public users
25. ✅ `searchListings()` allows owners to see own listings
26. ✅ `searchListings()` allows admins to see all listings
27. ✅ `createListing()` sets default approval status
28. ✅ `updateListing()` triggers re-review on significant changes
29. ✅ `updateListing()` clears review metadata on re-review

### Server Action Tests

**Location**: `src/features/admin/actions/__tests__/listing-review.test.ts`

**Test Cases**:

1. ✅ `approveListingAction()` requires admin authentication
2. ✅ `approveListingAction()` updates listing status correctly
3. ✅ `approveListingAction()` sends approval notification
4. ✅ `approveListingAction()` sends approval email
5. ✅ `approveListingAction()` revalidates paths
6. ✅ `approveListingAction()` returns success state
7. ✅ `approveListingAction()` handles errors gracefully
8. ✅ `approveListingAction()` handles notification failures
9. ✅ `rejectListingAction()` requires admin authentication
10. ✅ `rejectListingAction()` validates rejection reason
11. ✅ `rejectListingAction()` rejects empty reasons
12. ✅ `rejectListingAction()` rejects short reasons (< 10 chars)
13. ✅ `rejectListingAction()` updates listing status correctly
14. ✅ `rejectListingAction()` stores rejection reason
15. ✅ `rejectListingAction()` sends rejection notification with reason
16. ✅ `rejectListingAction()` sends rejection email
17. ✅ `rejectListingAction()` sanitizes rejection reason (XSS prevention)
18. ✅ `rejectListingAction()` revalidates paths
19. ✅ `rejectListingAction()` returns success state
20. ✅ `rejectListingAction()` handles errors gracefully

### Component Tests

**Location**: `src/features/admin/components/listing-review/__tests__/`

**PendingReviewQueue Component**:

1. ✅ Renders loading skeleton while fetching
2. ✅ Displays pending listings when loaded
3. ✅ Displays empty state when no pending listings
4. ✅ Renders ListingReviewCard for each listing
5. ✅ Implements pagination controls
6. ✅ Handles pagination correctly
7. ✅ Handles fetch errors gracefully

**ListingReviewCard Component**:

1. ✅ Displays listing details correctly
2. ✅ Displays all listing images in order
3. ✅ Displays owner profile information
4. ✅ Displays owner's other listings count
5. ✅ Displays owner's rental history
6. ✅ Shows Approve button
7. ✅ Shows Reject button
8. ✅ Opens dialog on button click

**ApproveRejectDialog Component**:

1. ✅ Renders approval confirmation dialog
2. ✅ Renders rejection dialog with textarea
3. ✅ Validates rejection reason (required, min length)
4. ✅ Shows validation errors
5. ✅ Calls approve action on confirm
6. ✅ Calls reject action with reason
7. ✅ Shows loading state during submission
8. ✅ Handles success state
9. ✅ Handles error state
10. ✅ Closes dialog on success

**ApprovalStatusBadge Component**:

1. ✅ Renders "Pending Review" badge for pending_review status
2. ✅ Renders "Approved" badge for approved status
3. ✅ Renders "Rejected" badge for rejected status
4. ✅ Uses correct colors for each status
5. ✅ Is accessible with ARIA labels
6. ✅ Handles unknown status gracefully

### Integration Tests

**Location**: `src/features/admin/__tests__/integration/listing-review-workflow.test.ts`

**Test Cases**:

1. ✅ Create listing → appears in pending queue
2. ✅ Admin approves → listing visible in search
3. ✅ Admin approves → owner receives notification
4. ✅ Admin rejects → listing hidden from search
5. ✅ Admin rejects → owner receives notification with reason
6. ✅ Owner edits rejected listing → status returns to pending_review
7. ✅ Owner resubmits → appears in queue again
8. ✅ Significant edit on approved listing → triggers re-review
9. ✅ Significant edit → clears review metadata
10. ✅ Non-significant edit → no re-review
11. ✅ Edit on pending listing → stays pending
12. ✅ Concurrent review attempts handled correctly

**Location**: `src/features/listings/__tests__/integration/approval-visibility.test.ts`

**Test Cases**:

1. ✅ Pending listings not visible in public search
2. ✅ Rejected listings not visible in public search
3. ✅ Approved listings visible in public search
4. ✅ Approved listings visible regardless of operational status
5. ✅ Owners can see their own listings regardless of approval status
6. ✅ Admins can see all listings regardless of approval status
7. ✅ Search queries include approval status filter
8. ✅ Explore page respects approval status filter

### E2E Tests

**Location**: `src/features/admin/__tests__/e2e/listing-review-flow.test.ts`

**Test Cases**:

1. ✅ Admin logs in and navigates to review page
2. ✅ Admin views pending review queue
3. ✅ Admin views full listing context
4. ✅ Admin approves listing successfully
5. ✅ Admin rejects listing with reason
6. ✅ Notifications sent correctly after approval
7. ✅ Notifications sent correctly after rejection
8. ✅ Queue updates after approval/rejection
9. ✅ Review history shows reviewed listings
10. ✅ Pending count badge updates

**Location**: `src/features/listings/__tests__/e2e/listing-approval-user-flow.test.ts`

**Test Cases**:

1. ✅ User creates listing
2. ✅ Listing appears in "Pending Review" tab
3. ✅ User sees status badge
4. ✅ User receives approval notification
5. ✅ Listing appears in Active tab after approval
6. ✅ User receives rejection notification with reason
7. ✅ User can view rejection reason
8. ✅ User can edit rejected listing
9. ✅ User can delete rejected listing
10. ✅ User resubmits → listing returns to pending
11. ✅ Dashboard shows pending count

## Performance Testing

### Database Query Performance

**Targets**:

- Pending reviews query: < 500ms for 100 listings
- Review history query: < 500ms for 100 listings
- Approval status update: < 100ms
- Pending count query: < 50ms

**Test Approach**:

- Create test data with 100+ pending listings
- Measure query execution time
- Verify indexes are used (EXPLAIN ANALYZE)
- Test with pagination

### API Response Times

**Targets**:

- Review queue API: < 2 seconds
- Approval/rejection action: < 1 second
- Count API: < 200ms

**Test Approach**:

- Measure API endpoint response times
- Test with various data sizes
- Monitor in production

## Security Testing

### Authorization Tests

**Test Cases**:

1. ✅ Non-admin cannot access review queue API
2. ✅ Non-admin cannot call approve action
3. ✅ Non-admin cannot call reject action
4. ✅ Non-admin cannot access review page
5. ✅ Regular user cannot see other users' pending listings
6. ✅ Admin can access all review functions

### Input Validation Tests

**Test Cases**:

1. ✅ Rejection reason sanitized to prevent XSS
2. ✅ Listing ID validated before queries
3. ✅ Pagination limits enforced (max 100)
4. ✅ Invalid listing IDs rejected

### Data Exposure Tests

**Test Cases**:

1. ✅ Review queue only exposes listings, not sensitive user data
2. ✅ Owner context limited to relevant fields
3. ✅ No payment information exposed
4. ✅ Admin actions logged for audit

## Test Execution Strategy

### Test Execution Order

**Unit Tests**: Run first, fastest feedback

- Execute: `bun test:run` (filtered to listing-review tests)
- Watch mode: `bun test:watch` (during development)

**Integration Tests**: Run after unit tests pass

- Tagged with `@integration` or in separate directory
- Execute: `bun test:run --grep integration`
- Require test database setup

**E2E Tests**: Run in CI/CD pipeline

- Execute: `bun test:run --grep e2e`
- Run against test environment or staging

### CI/CD Integration

**Pre-commit**: Run unit tests for listing-review code

```json
"lint-staged": {
  "src/features/admin/**/*.{ts,tsx}": [
    "vitest related --run"
  ],
  "src/dal/listing.dal.ts": [
    "vitest related --run"
  ]
}
```

**Pull Request**: Run all listing-review tests

```bash
bun run test:listing-review  # Unit + Integration tests
```

**Main Branch**: Run full suite including E2E

```bash
bun run ci  # Includes listing-review tests
```

## Test Maintenance

### Keeping Tests Updated

**When to Update Tests**:

- Requirements change → Update test scenarios
- Implementation changes → Verify tests still pass
- Bug fixes → Add regression tests
- New features → Add new test cases

### Test Quality Checklist

Before considering tests complete:

- [ ] Tests map to requirements/acceptance criteria
- [ ] All test types covered (unit, integration, E2E)
- [ ] Happy paths tested
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Tests are independent (no dependencies)
- [ ] Tests are fast (< 1s for unit tests, < 5s for integration)
- [ ] Tests use AAA pattern
- [ ] Test names describe behavior, not implementation
- [ ] Coverage goals met
- [ ] Concurrent access scenarios tested
- [ ] Security scenarios tested

## Known Testing Challenges

### Database Transaction Testing

**Challenge**: Testing concurrent review attempts and row locking.

**Solution**:

- Use test database with transaction support
- Test with multiple concurrent requests
- Verify locks prevent duplicate approvals
- Use database-level locking in tests

### Notification Testing

**Challenge**: Testing email sending without actually sending emails.

**Solution**:

- Mock `sendNotification()` utility
- Verify notification data includes required fields
- Test notification creation separately from email sending
- Test graceful degradation if email fails

### Component Integration Testing

**Challenge**: Testing components that depend on React Query and server actions.

**Solution**:

- Use QueryClient wrapper in tests
- Mock server actions at component level
- Test component behavior with various data states
- Use React Testing Library for user interactions

## Success Criteria

### Test Coverage

- [ ] Unit test coverage ≥ 85%
- [ ] Integration test coverage ≥ 80%
- [ ] All critical user flows have E2E tests
- [ ] All requirements have test coverage

### Test Quality

- [ ] All tests pass consistently
- [ ] No flaky tests
- [ ] Tests run in < 5 minutes (unit + integration)
- [ ] E2E tests complete in < 10 minutes

### Feature Functionality

- [ ] All review workflows verified
- [ ] Visibility filtering works correctly
- [ ] Notifications sent successfully
- [ ] Re-review triggers on significant edits
- [ ] Security requirements met
- [ ] Performance targets met

## Test Plan Summary

This test plan provides comprehensive coverage for the listing review feature:

1. **Requirements Traceability**: All requirements mapped to tests
2. **Test Type Strategy**: Unit, integration, E2E, and manual tests
3. **Framework Configuration**: Vitest for unit/integration, React Testing Library for components
4. **Coverage Goals**: 85%+ overall, layer-specific targets
5. **Test Scenarios**: Detailed test cases for each component and workflow
6. **Performance Testing**: Database query and API response time targets
7. **Security Testing**: Authorization, input validation, data exposure tests
8. **Execution Strategy**: CI/CD integration and test ordering
9. **Maintenance**: Guidelines for keeping tests updated

**Next Steps**:

1. Set up test infrastructure (test database, fixtures)
2. Implement unit tests as features are developed (TDD approach)
3. Add integration tests for critical flows
4. Create E2E tests for user-facing scenarios
5. Set up CI/CD test execution
6. Monitor test coverage and fill gaps
7. Perform manual testing on staging environment
