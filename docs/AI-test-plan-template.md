# Test Plan Template

## Overview

This document provides a comprehensive test plan template following the EARS methodology (Phase 4: Test Plan). It integrates BDD scenarios for acceptance testing and TDD principles for unit-level testing. This template should be customized for each feature by mapping tests to specific requirements from `specs/[feature-name]/1-requirements.md`.

## Test Plan Structure

### 1. Requirements Traceability

**Purpose**: Map all tests back to requirements to ensure complete coverage.

**Format**:

- List each requirement from the requirements document
- Identify test types needed for each requirement
- Note acceptance criteria that must be verified

**Example**:

```markdown
### Requirement 1: User Authentication

**Requirement Reference**: `specs/auth/1-requirements.md` - Requirement 1.1, 1.2, 1.3

**Test Coverage**:

- Unit tests: Authentication logic, password validation
- Integration tests: Login flow, session management
- E2E tests: Complete authentication workflow
- BDD scenarios: User login acceptance criteria
```

### 2. Test Types and Strategy

#### 2.1 Unit Tests

**Purpose**: Test individual functions, methods, and components in isolation.

**When to Use** (per TDD methodology):

- Complex business logic with clear requirements
- Domain models with business rules
- Core services and utilities
- Data transformations and validations
- DAL methods (with mocked database)

**Coverage Goals**: 80%+ for business logic, 60%+ for utilities

**Framework**: Vitest with React Testing Library

**Test Structure** (AAA Pattern):

```typescript
describe("ComponentName", () => {
  it("should [expected behavior]", () => {
    // Arrange
    const props = { /* test data */ };

    // Act
    render(<ComponentName {...props} />);

    // Assert
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

**Areas to Test**:

- **DAL Methods**: Mock database, test business logic, error handling
- **Server Actions**: Mock dependencies, test validation, error cases
- **React Components**: Render, user interactions, state changes
- **Utility Functions**: Input/output validation, edge cases
- **Form Validation**: Schema validation (Zod), error messages

#### 2.2 Integration Tests

**Purpose**: Test component interactions and data flow between layers.

**When to Use**:

- Server actions calling DAL methods
- React components using hooks with React Query
- Form submissions triggering server actions
- API route handlers processing requests

**Coverage Goals**: Critical user flows, 70%+ for integration points

**Framework**: Vitest with test database (or mocked DAL)

**Test Structure**:

```typescript
describe("Feature Integration", () => {
  it("should [end-to-end behavior within feature]", async () => {
    // Arrange
    const mockUserId = "user-123";
    vi.spyOn(UserDAL, "getCurrentUserId").mockResolvedValue(mockUserId);

    // Act
    const result = await createListingAction(formData);

    // Assert
    expect(result.success).toBe(true);
    expect(ListingDAL.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: mockUserId,
      }),
    );
  });
});
```

**Areas to Test**:

- **Server Action → DAL**: Verify correct DAL methods called with proper data
- **Component → Hook → API**: Verify data fetching and state management
- **Form → Server Action → Database**: Verify complete data flow
- **Error Propagation**: Verify errors handled correctly across layers

#### 2.3 End-to-End (E2E) Tests

**Purpose**: Test complete user workflows from UI to database.

**When to Use**:

- Critical user journeys (authentication, rental creation, payment)
- Cross-feature workflows
- User-facing acceptance criteria

**Coverage Goals**: All critical user paths, happy paths + major error paths

**Framework**: Playwright or Cypress (to be configured)

**BDD Integration**: Use Gherkin scenarios for E2E tests

**Example BDD Scenario**:

```gherkin
Feature: Create Rental Request
  As a renter
  I want to request a tool rental
  So that I can borrow tools from other users

  Scenario: Successful rental request creation
    Given I am logged in as a renter
    And I am viewing an available tool listing
    When I select rental dates and submit the request
    Then the rental request should be created
    And the tool owner should receive a notification
    And I should see a confirmation message
```

#### 2.4 BDD Acceptance Tests

**Purpose**: Verify requirements are met using business language.

**When to Use** (per BDD methodology):

- Complex business logic with rich domain rules
- Features with multiple stakeholders needing alignment
- Customer-facing features and user workflows
- Ambiguous requirements needing clarification

**Format**: Gherkin scenarios (Given-When-Then)

**Integration**:

- Unit-level: Use BDD-style describe/it syntax in Vitest
- E2E-level: Use Cucumber/Playwright for executable Gherkin

**Example**:

```gherkin
Feature: Tool Rental Approval
  As a tool owner
  I want to approve rental requests
  So that renters can use my tools

  Scenario: Owner approves rental request
    Given a rental request exists for my tool
    And the requested dates are available
    When I approve the rental request
    Then the rental status should change to "approved"
    And the renter should receive a notification
    And the tool should be marked as "rented" for those dates
```

### 3. Test Framework Configuration

#### 3.1 Unit Testing Setup

**Framework**: Vitest (already configured)

- Environment: happy-dom for React components
- Setup file: `src/test/setup.ts`
- Coverage: v8 provider with HTML, JSON, text reporters

**Mocking Strategy**:

- **Database**: Mock DAL methods using `vi.spyOn()`
- **Server Actions**: Mock dependencies, test with FormData
- **External APIs**: Mock fetch or API client functions
- **React Query**: Use `@tanstack/react-query` test utilities

**Example Mock Setup**:

```typescript
import { vi } from "vitest";
import { ListingDAL } from "@/dal/listing.dal";

vi.mock("@/dal/listing.dal", () => ({
  ListingDAL: {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
}));
```

#### 3.2 Integration Testing Setup

**Database Strategy**:

- Option 1: Use test database with Testcontainers (for true integration)
- Option 2: Mock DAL layer (faster, sufficient for most cases)
- Option 3: In-memory database (SQLite for Drizzle)

**Server Actions Testing**:

- Mock `getCurrentUserId()` or `requireAuth()` from base DAL
- Test with FormData objects
- Verify revalidation calls (`revalidatePath`, `revalidateTag`)

**React Query Testing**:

- Use `QueryClient` with test configuration
- Mock API routes or use MSW (Mock Service Worker)

#### 3.3 E2E Testing Setup

**Framework**: Playwright (recommended) or Cypress

**Configuration**:

- Test database seeded with known data
- Authentication helpers for test users
- Screenshot on failure
- Video recording for debugging

**BDD Integration**:

- Use `@cucumber/cucumber` with Playwright
- Or use Playwright's native BDD-style syntax

### 4. Test Data Management

#### 4.1 Test Fixtures

**Location**: `src/test/fixtures/` (to be created)

**Purpose**: Reusable test data for consistent testing

**Example**:

```typescript
// src/test/fixtures/listings.ts
export const mockListing = {
  id: "listing-123",
  name: "Test Drill",
  description: "A test drill",
  ownerId: "user-123",
  status: "available",
  // ... other fields
};

export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};
```

#### 4.2 Test Database Seeding

**Purpose**: Consistent test data for integration/E2E tests

**Strategy**:

- Seed script: `src/test/seed.ts`
- Reset database before test suite
- Use factories (e.g., Faker.js) for varied data

### 5. Coverage Goals and Metrics

#### 5.1 Coverage Targets

**Overall Project**:

- Statements: > 80%
- Branches: > 80%
- Functions: > 80%
- Lines: > 80%

**By Layer**:

- **DAL Methods**: 90%+ (critical business logic)
- **Server Actions**: 85%+ (user-facing mutations)
- **React Components**: 75%+ (UI logic, user interactions)
- **Utilities**: 80%+ (reusable functions)

#### 5.2 Coverage Exclusions

**Exclude**:

- Type definitions (`*.d.ts`)
- Test files (`**/__tests__/**`, `**/*.test.*`)
- Configuration files (`*.config.*`)
- Generated code

**Current Exclusions** (from `vitest.config.mjs`):

- `node_modules/`
- `src/lib/utils/__tests__/`
- `src/test/`
- `**/*.d.ts`
- `**/*.config.*`

### 6. Test Scenarios by Feature Type

#### 6.1 DAL Method Testing

**Test Structure**:

```typescript
describe("ListingDAL", () => {
  describe("create", () => {
    it("should create listing when user is authenticated", async () => {
      // Arrange
      vi.spyOn(ListingDAL, "requireAuth").mockResolvedValue("user-123");
      const listingData = { name: "Test", description: "Test" };

      // Act
      const result = await ListingDAL.create(listingData);

      // Assert
      expect(result).toMatchObject({
        name: "Test",
        ownerId: "user-123",
      });
    });

    it("should throw UnauthorizedError when user not authenticated", async () => {
      // Arrange
      vi.spyOn(ListingDAL, "requireAuth").mockRejectedValue(
        new UnauthorizedError("Not authenticated"),
      );

      // Act & Assert
      await expect(ListingDAL.create({})).rejects.toThrow(UnauthorizedError);
    });
  });
});
```

**Key Scenarios**:

- ✅ Happy path with valid data
- ✅ Authentication/authorization checks
- ✅ Validation errors
- ✅ Database errors
- ✅ Edge cases (empty data, null values, boundary conditions)

#### 6.2 Server Action Testing

**Test Structure**:

```typescript
describe("createListingAction", () => {
  it("should create listing and revalidate path", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("name", "Test Listing");
    formData.append("description", "Test description");

    vi.spyOn(ListingDAL, "create").mockResolvedValue(mockListing);
    vi.spyOn(revalidatePath, "default").mockImplementation(() => {});

    // Act
    const result = await createListingAction(null, formData);

    // Assert
    expect(result.success).toBe(true);
    expect(ListingDAL.create).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/garage");
  });

  it("should return error when DAL throws", async () => {
    // Arrange
    vi.spyOn(ListingDAL, "create").mockRejectedValue(
      new Error("Database error"),
    );

    // Act
    const result = await createListingAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

**Key Scenarios**:

- ✅ Successful execution with revalidation
- ✅ FormData parsing and validation
- ✅ Error handling and user-friendly messages
- ✅ Authentication checks (via DAL)
- ✅ Optimistic update scenarios (if applicable)

#### 6.3 React Component Testing

**Test Structure**:

```typescript
describe("ListingForm", () => {
  it("should render form fields", () => {
    // Arrange & Act
    render(<ListingForm />);

    // Assert
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("should submit form with valid data", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockAction = vi.fn();
    render(<ListingForm action={mockAction} />);

    // Act
    await user.type(screen.getByLabelText(/name/i), "Test Listing");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // Assert
    await waitFor(() => {
      expect(mockAction).toHaveBeenCalled();
    });
  });
});
```

**Key Scenarios**:

- ✅ Rendering and accessibility
- ✅ User interactions (clicks, typing, form submission)
- ✅ Loading states
- ✅ Error states and validation messages
- ✅ Optimistic updates (if using `useOptimistic`)
- ✅ URL state management (if using `useURLState`)

#### 6.4 React Query Hook Testing

**Test Structure**:

```typescript
describe("useListings", () => {
  it("should fetch listings on mount", async () => {
    // Arrange
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockListing] }),
    } as Response);

    // Act
    renderHook(() => useListings(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/listings")
      );
    });
  });
});
```

**Key Scenarios**:

- ✅ Data fetching on mount
- ✅ Loading states
- ✅ Error handling
- ✅ Cache invalidation
- ✅ Optimistic updates
- ✅ Infinite scroll pagination (if applicable)

### 7. BDD Scenarios Template

**When to Use BDD**:

- Complex business logic
- Features with stakeholder alignment needs
- Customer-facing workflows
- Requirements needing concrete examples

**Format**: Gherkin (Given-When-Then)

**Example Template**:

```gherkin
Feature: [Feature Name]
  As a [role]
  I want [capability]
  So that [benefit]

  Background:
    Given [common setup for all scenarios]

  Scenario: [Happy path scenario]
    Given [initial context]
    When [action occurs]
    Then [expected outcome]
    And [additional verification]

  Scenario: [Edge case scenario]
    Given [initial context with edge case]
    When [action occurs]
    Then [expected outcome]
    But [exception or special case]

  Scenario Outline: [Data-driven scenario]
    Given [initial context]
    When [action] with <input>
    Then [outcome] should be <expected>

    Examples:
      | input | expected |
      | value1 | result1 |
      | value2 | result2 |
```

**Mapping to Test Types**:

- **Unit Level**: Use BDD-style describe/it in Vitest
- **Integration Level**: Test scenarios with mocked dependencies
- **E2E Level**: Execute Gherkin scenarios with Playwright/Cucumber

### 8. TDD Workflow Integration

#### 8.1 When to Use TDD

**Use TDD for**:

- Complex business logic (DAL methods, validations)
- Core services and utilities
- Algorithms and data transformations
- Domain models with business rules

**Don't Use TDD for**:

- Simple CRUD operations
- UI layouts and styling
- Prototype/exploratory code
- Configuration-heavy code

#### 8.2 TDD Cycle

**Red-Green-Refactor**:

1. **Red**: Write failing test
2. **Green**: Make test pass with minimal code
3. **Refactor**: Improve code while keeping tests passing

**Example TDD Flow**:

```typescript
// 1. RED: Write failing test
describe("calculateRentalPrice", () => {
  it("should calculate price based on daily rate and duration", () => {
    expect(calculateRentalPrice(10, 5)).toBe(50);
  });
});

// 2. GREEN: Minimal implementation
function calculateRentalPrice(dailyRate: number, days: number): number {
  return dailyRate * days;
}

// 3. REFACTOR: Improve (add edge cases, validation, etc.)
```

### 9. Test Execution Strategy

#### 9.1 Test Execution Order

**Unit Tests**: Run first, fastest feedback

- Execute: `bun test:run` (all tests)
- Watch mode: `bun test:watch` (during development)

**Integration Tests**: Run after unit tests pass

- Tagged with `@integration` or in separate directory
- Execute: `bun test:run --grep integration`

**E2E Tests**: Run in CI/CD pipeline

- Execute: `bun test:e2e` (to be configured)
- Run against test environment

#### 9.2 CI/CD Integration

**Pre-commit**: Run unit tests

```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "vitest related --run"
  ]
}
```

**Pull Request**: Run all tests

```bash
bun run ci  # type-check && lint && test:run && build
```

**Main Branch**: Run full suite including E2E

### 10. Test Maintenance

#### 10.1 Keeping Tests Updated

**When to Update Tests**:

- Requirements change → Update test scenarios
- Implementation changes → Verify tests still pass
- Bug fixes → Add regression tests
- Refactoring → Update test structure if needed

#### 10.2 Test Quality Checklist

Before considering tests complete:

- [ ] Tests map to requirements/acceptance criteria
- [ ] All test types covered (unit, integration, E2E)
- [ ] Happy paths tested
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Tests are independent (no dependencies)
- [ ] Tests are fast (< 1s for unit tests)
- [ ] Tests use AAA pattern
- [ ] Test names describe behavior, not implementation
- [ ] Coverage goals met
- [ ] BDD scenarios written (when appropriate)

### 11. Feature-Specific Test Plan Template

**For each feature, create**: `specs/[feature-name]/4-test-plan.md`

**Template Structure**:

```markdown
# Test Plan: [Feature Name]

## Requirements Traceability

[Map tests to requirements from 1-requirements.md]

## Test Types

### Unit Tests

- [ ] DAL methods: [list methods]
- [ ] Server actions: [list actions]
- [ ] Components: [list components]
- [ ] Utilities: [list utilities]

### Integration Tests

- [ ] [Integration point 1]
- [ ] [Integration point 2]

### E2E Tests

- [ ] [User flow 1]
- [ ] [User flow 2]

### BDD Scenarios

[Include Gherkin scenarios if applicable]

## Test Data Requirements

[Describe test fixtures needed]

## Coverage Goals

[Feature-specific coverage targets]

## Test Execution

[Any special execution requirements]
```

### 12. Examples and References

#### 12.1 Example Test Files

**Component Test**: `src/features/listings/components/__tests__/status-icon-with-tooltip.test.tsx`

- Comprehensive component testing example
- 30 tests covering rendering, interactions, accessibility

#### 12.2 Testing Documentation

- **Setup Guide**: `TESTING.md`
- **Vitest Config**: `vitest.config.mjs`
- **Test Setup**: `src/test/setup.ts`

#### 12.3 Methodology References

- **EARS Methodology**: `.ai/AI-ears-methodology.md`
- **BDD Methodology**: `.ai/AI-bdd-methodology.md`
- **TDD Methodology**: `.ai/AI-tdd-methodology.md`
- **Coding Standards**: `.ai/AI-coding-standards.md`
- **Test Plan Template**: `docs/AI-test-plan-template.md` (this document)

## Summary

This test plan template provides:

1. **Requirements Traceability**: Map all tests to requirements
2. **Test Type Strategy**: Unit, integration, E2E, BDD scenarios
3. **Framework Configuration**: Vitest setup, mocking strategies
4. **Coverage Goals**: 80%+ overall, layer-specific targets
5. **Test Scenarios**: Templates for DAL, server actions, components
6. **BDD Integration**: Gherkin scenarios for acceptance testing
7. **TDD Workflow**: Red-Green-Refactor cycle guidance
8. **Execution Strategy**: CI/CD integration, test ordering
9. **Maintenance**: Quality checklist, update procedures

**Next Steps**:

1. Customize this template for each feature in `specs/[feature-name]/4-test-plan.md`
2. Map tests to specific requirements from Phase 1
3. Implement tests following TDD/BDD principles
4. Achieve coverage goals before considering feature complete
