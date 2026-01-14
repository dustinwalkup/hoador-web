# Test Plan: Site Header Scroll-Based Label Transition

## Overview

This test plan defines comprehensive testing strategies for the site header scroll-based label transition feature. Tests are mapped to requirements, organized by test type, and include both automated and manual testing scenarios. The plan follows TDD principles where appropriate and ensures all acceptance criteria are verified.

## Requirements Traceability

### Requirement 1: Empty Site Header Label by Default

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 1

**Acceptance Criteria to Verify**:

1. Site header label displays empty state when PageHeader is visible
2. Nav-based label displayed when no PageHeader exists
3. Layout and spacing maintained when empty

**Test Coverage**:

- Unit tests: SiteHeaderLabel component rendering logic
- Integration tests: PageHeader state management and visibility detection
- E2E tests: Complete page load and scroll behavior
- Manual tests: Visual verification of empty state

### Requirement 2: Scroll-Based Intersection Detection

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 2

**Acceptance Criteria to Verify**:

1. Intersection detection when PageHeader scrolls past viewport
2. Trigger when PageHeader top edge reaches site header bottom edge
3. Use of Intersection Observer API
4. Performance during rapid scrolling

**Test Coverage**:

- Unit tests: usePageHeaderScroll hook logic
- Integration tests: Intersection Observer configuration and callbacks
- Performance tests: Rapid scrolling behavior
- E2E tests: Scroll interaction scenarios

### Requirement 3: Smooth Label Transition

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 3

**Acceptance Criteria to Verify**:

1. Smooth transition when PageHeader scrolls out of view
2. Smooth transition when PageHeader scrolls back into view
3. CSS transition duration between 200ms-300ms
4. Opacity/transform animation
5. Text alignment and layout stability
6. Text overflow handling for long titles

**Test Coverage**:

- Unit tests: CSS transition classes and timing
- Integration tests: Transition state changes
- Visual regression tests: Animation smoothness
- Manual tests: Visual verification of transitions

### Requirement 4: PageHeader Title Extraction

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 4

**Acceptance Criteria to Verify**:

1. Title extraction from PageHeader component
2. Exact title text match between PageHeader and site header label
3. Dynamic title updates
4. Special character handling

**Test Coverage**:

- Unit tests: PageHeaderContext state management and title storage
- Integration tests: Title synchronization between components
- E2E tests: Dynamic title updates

### Requirement 5: Universal PageHeader Coverage

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 5

**Acceptance Criteria to Verify**:

1. All dashboard pages have PageHeader components
2. Specific pages verified (Dashboard, Explore, Garage, Mailbox, Profile, Rentals)
3. Conditional PageHeader rendering respected
4. Descriptive titles and descriptions

**Test Coverage**:

- Manual tests: Page-by-page verification
- Integration tests: PageHeader presence on all dashboard pages
- E2E tests: Navigation between pages

### Requirement 6: Backward Compatibility

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 6

**Acceptance Criteria to Verify**:

1. Fallback to nav-based label when no PageHeader
2. No errors when PageHeader missing
3. Existing functionality maintained for non-dashboard routes
4. Graceful handling of missing title prop

**Test Coverage**:

- Unit tests: Fallback logic in SiteHeaderLabel
- Integration tests: Error handling and edge cases
- E2E tests: Pages without PageHeader components

### Requirement 7: Performance and Accessibility

**Requirement Reference**: `specs/site-header-scroll-transition/1-requirements.md` - Requirement 7

**Acceptance Criteria to Verify**:

1. Efficient scroll detection (no layout thrashing)
2. Use of Intersection Observer API
3. 60fps during scroll transitions
4. Screen reader accessibility
5. Reduced motion preference support
6. Instant transitions when reduced motion preferred

**Test Coverage**:

- Performance tests: Frame rate during scrolling
- Accessibility tests: Screen reader compatibility
- Unit tests: Reduced motion detection and handling
- Manual tests: Reduced motion preference verification

## Test Types and Strategy

### Unit Tests

**Framework**: Vitest with React Testing Library

**Purpose**: Test individual components, hooks, and context logic in isolation.

**Coverage Goals**:

- 80%+ for business logic (hooks, context)
- 70%+ for components

**Test Files to Create**:

1. `src/contexts/__tests__/page-header-context.test.tsx`
   - Test PageHeaderProvider state management (ref and title storage)
   - Test setPageHeader function
   - Test context missing scenarios
   - Test state updates when PageHeader sets/unsets

2. `src/hooks/__tests__/use-page-header-scroll.test.tsx`
   - Test Intersection Observer setup
   - Test visibility state changes
   - Test title and ref reading from context
   - Test shouldShowLabel calculation
   - Test observer cleanup
   - Test missing context handling
   - Test rootMargin configuration

3. `src/components/__tests__/page-header.test.tsx`
   - Test PageHeader sets ref and title in context
   - Test title prop updates trigger context updates
   - Test ref attachment to DOM element
   - Test cleanup on unmount (unsets context)
   - Test missing context handling (graceful degradation)

4. `src/components/__tests__/site-header-label.test.tsx`
   - Test label display logic (empty vs. title vs. nav-based)
   - Test fallback to nav-based label
   - Test CSS transition classes
   - Test reduced motion handling
   - Test text overflow handling
   - Test layout stability with empty state

**Test Structure** (AAA Pattern):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeaderProvider } from '@/contexts/page-header-context';

describe('PageHeaderProvider', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should set PageHeader ref and title in context', () => {
    // Arrange
    const TestComponent = () => {
      const context = usePageHeaderContext();
      const ref = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (context) {
          context.setPageHeader(ref, 'Test Title');
        }
        return () => {
          context?.setPageHeader(null, null);
        };
      }, [context]);

      return <div ref={ref}>Test</div>;
    };

    // Act
    render(
      <PageHeaderProvider>
        <TestComponent />
      </PageHeaderProvider>
    );

    // Assert
    // Verify context has ref and title
  });
});
```

**Key Test Scenarios**:

- **Context State Management**: Verify PageHeader can set ref and title in context
- **Title Storage**: Verify title is correctly stored and accessible
- **Visibility Detection**: Verify Intersection Observer triggers correctly
- **Fallback Logic**: Verify nav-based label when no PageHeader
- **Reduced Motion**: Verify instant transitions when preferred
- **Cleanup**: Verify observers and context state are cleaned up

### Integration Tests

**Framework**: Vitest with React Testing Library

**Purpose**: Test component interactions and Intersection Observer behavior.

**Test Files to Create**:

1. `src/components/__tests__/page-header-integration.test.tsx`
   - Test PageHeader and SiteHeaderLabel communication via context
   - Test title synchronization
   - Test scroll simulation with Intersection Observer

2. `src/app/dashboard/__tests__/layout-integration.test.tsx`
   - Test PageHeaderProvider integration in DashboardLayout
   - Test context availability to child components
   - Test layout structure maintained

**Key Test Scenarios**:

- **Component Communication**: PageHeader sets state, SiteHeaderLabel reads title and ref
- **Scroll Simulation**: Mock Intersection Observer entries for scroll scenarios
- **State Synchronization**: Verify label updates when PageHeader visibility changes
- **Layout Integration**: Verify Provider doesn't break existing layout

**Mocking Strategy**:

```typescript
// Mock Intersection Observer
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});

global.IntersectionObserver = mockIntersectionObserver;

// Simulate scroll events
const simulateScroll = (isIntersecting: boolean) => {
  const callback = mockIntersectionObserver.mock.calls[0][0];
  callback([
    {
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: { top: isIntersecting ? 100 : -50 },
    },
  ]);
};
```

### End-to-End (E2E) Tests

**Framework**: Playwright or Cypress (if available) or Vitest with happy-dom for DOM simulation

**Purpose**: Test complete user workflows and scroll interactions.

**Test Files to Create**:

1. `src/features/header/__tests__/e2e/scroll-transition-workflow.test.tsx`
   - Test complete scroll workflow on dashboard page
   - Test label appears when scrolling down
   - Test label disappears when scrolling back up
   - Test navigation between pages
   - Test pages with and without PageHeader

**Key Test Scenarios**:

- **Scroll Down**: Navigate to page, scroll down, verify label appears
- **Scroll Up**: Scroll back up, verify label disappears
- **Page Navigation**: Navigate between dashboard pages, verify label behavior
- **No PageHeader**: Navigate to page without PageHeader, verify fallback
- **Rapid Scrolling**: Rapidly scroll up and down, verify performance

**E2E Test Structure**:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("Scroll Transition E2E", () => {
  it("should show label when PageHeader scrolls out of view", async () => {
    // Arrange: Render page with PageHeader
    // Act: Simulate scroll
    // Assert: Verify label appears
  });
});
```

### Performance Tests

**Framework**: Vitest with performance measurement utilities

**Purpose**: Verify 60fps performance during scroll transitions.

**Test Scenarios**:

- **Frame Rate**: Measure frame rate during scroll transitions
- **Observer Efficiency**: Verify Intersection Observer doesn't cause layout thrashing
- **Rapid Scrolling**: Test performance with rapid scroll events
- **Memory Leaks**: Verify observers are properly cleaned up

**Performance Test Structure**:

```typescript
describe("Performance Tests", () => {
  it("should maintain 60fps during scroll transitions", async () => {
    // Measure frame rate during scroll
    // Assert: Average FPS >= 55 (allowing for variance)
  });

  it("should not cause layout thrashing", () => {
    // Monitor layout recalculations
    // Assert: No excessive reflows
  });
});
```

### Accessibility Tests

**Framework**: Vitest with @testing-library/jest-dom and accessibility queries

**Purpose**: Verify screen reader compatibility and reduced motion support.

**Test Files to Create**:

1. `src/components/__tests__/site-header-label-accessibility.test.tsx`
   - Test semantic HTML structure (h1 element)
   - Test ARIA labels
   - Test screen reader announcements
   - Test reduced motion preference

**Key Test Scenarios**:

- **Semantic HTML**: Verify h1 element is present and properly structured
- **Screen Reader**: Test with screen reader simulation
- **Reduced Motion**: Verify instant transitions when preferred
- **Keyboard Navigation**: Verify keyboard accessibility (if applicable)

**Accessibility Test Structure**:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('SiteHeaderLabel Accessibility', () => {
  it('should have proper semantic HTML', () => {
    render(<SiteHeaderLabel />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it('should respect reduced motion preference', () => {
    // Mock prefers-reduced-motion: reduce
    // Verify instant transitions
  });
});
```

### Visual Regression Tests

**Framework**: Manual testing or screenshot comparison tools (if available)

**Purpose**: Verify visual appearance and animation smoothness.

**Test Scenarios**:

- **Empty State**: Verify empty label maintains layout
- **Transition Appearance**: Verify smooth fade-in animation
- **Transition Disappearance**: Verify smooth fade-out animation
- **Long Titles**: Verify text overflow handling
- **Different Screen Sizes**: Verify responsive behavior

## Test Data Requirements

### Mock Data

- **PageHeader Titles**: Various lengths (short, medium, long, very long)
- **Special Characters**: Titles with special characters, emojis, unicode
- **Dynamic Titles**: Titles that change based on user data

### Test Pages

- Dashboard home page (has PageHeader)
- Explore page (has PageHeader)
- Garage page (PageHeader optional, may be in client component)
- Mailbox page (PageHeader optional, may be in client component)
- Profile page (has PageHeader)
- Rentals pages (has PageHeader in layout)
- Test page without PageHeader (for fallback testing)

## Mock/Stub Strategies

### Intersection Observer Mock

**Location**: `src/test/setup.ts` (already exists, may need enhancement)

**Strategy**:

- Use existing MockIntersectionObserver from test setup
- Enhance to support dynamic callback invocation
- Support rootMargin and threshold configuration

### Context Mocking

**Strategy**:

- Create test utilities for PageHeaderContext
- Provide mock context for components that don't need full Provider
- Support both with and without context scenarios

### Reduced Motion Mocking

**Strategy**:

- Mock `window.matchMedia` for prefers-reduced-motion
- Support dynamic preference changes
- Test both reduced and normal motion scenarios

## Test Environment Setup

### Required Mocks

1. **Intersection Observer**: Already mocked in `src/test/setup.ts`
2. **window.matchMedia**: Already mocked in `src/test/setup.ts`
3. **Next.js Router**: Mock `usePathname` for navigation tests
4. **React Context**: Test with and without Provider

### Test Utilities

Create helper utilities in `src/test/utils/`:

1. `renderWithProvider.tsx`: Wrapper for rendering with PageHeaderProvider
2. `mockIntersectionObserver.ts`: Enhanced Intersection Observer mocking
3. `scrollHelpers.ts`: Utilities for simulating scroll events

## Acceptance Criteria Verification

### Requirement 1 Verification

- [ ] Unit test: SiteHeaderLabel shows empty when PageHeader visible
- [ ] Unit test: SiteHeaderLabel shows nav-based label when no PageHeader
- [ ] Integration test: Layout maintained when label is empty
- [ ] E2E test: Visual verification of empty state on page load

### Requirement 2 Verification

- [ ] Unit test: Intersection Observer configured correctly
- [ ] Unit test: Visibility state changes on intersection
- [ ] Integration test: Label appears when PageHeader scrolls out
- [ ] Performance test: Rapid scrolling doesn't degrade performance

### Requirement 3 Verification

- [ ] Unit test: CSS transition classes applied correctly
- [ ] Unit test: Transition duration is 250ms
- [ ] Integration test: Smooth opacity transition
- [ ] Visual test: Animation smoothness verification
- [ ] Unit test: Text overflow handled correctly

### Requirement 4 Verification

- [ ] Unit test: Title extracted from PageHeader
- [ ] Integration test: Title matches between components
- [ ] Unit test: Dynamic title updates work
- [ ] Unit test: Special characters handled correctly

### Requirement 5 Verification

- [ ] Manual test: All dashboard pages have PageHeader
- [ ] Integration test: PageHeader presence verified
- [ ] Manual test: Titles and descriptions are descriptive

### Requirement 6 Verification

- [ ] Unit test: Fallback to nav-based label
- [ ] Unit test: No errors when PageHeader missing
- [ ] Integration test: Non-dashboard routes unaffected
- [ ] Unit test: Missing title prop handled gracefully

### Requirement 7 Verification

- [ ] Performance test: 60fps maintained
- [ ] Unit test: Intersection Observer used (not scroll events)
- [ ] Accessibility test: Screen reader compatibility
- [ ] Unit test: Reduced motion preference respected

## Test Execution Plan

### Phase 1: Unit Tests (Tasks 1-2)

1. Write tests for PageHeaderContext
2. Write tests for usePageHeaderScroll hook
3. Write tests for PageHeader component
4. Write tests for SiteHeaderLabel component
5. Achieve 80%+ coverage for business logic

### Phase 2: Integration Tests (Tasks 3-4)

1. Write integration tests for component communication
2. Write integration tests for layout integration
3. Verify Intersection Observer behavior
4. Test edge cases and error scenarios

### Phase 3: E2E Tests (Task 5)

1. Write E2E tests for scroll workflows
2. Test navigation between pages
3. Test pages with and without PageHeader
4. Verify complete user experience

### Phase 4: Performance and Accessibility (Tasks 6-7)

1. Write performance tests
2. Write accessibility tests
3. Verify reduced motion support
4. Measure and optimize if needed

### Phase 5: Manual Testing

1. Visual verification of transitions
2. Cross-browser testing
3. Mobile device testing
4. Screen reader testing
5. Reduced motion preference testing

## Coverage Goals

- **Unit Tests**: 80%+ for hooks and context, 70%+ for components
- **Integration Tests**: All component interactions covered
- **E2E Tests**: All critical user workflows covered
- **Accessibility Tests**: All accessibility requirements verified

## Test Maintenance

### Continuous Testing

- Run tests in CI/CD pipeline
- Fail builds on test failures
- Monitor test coverage trends
- Update tests when requirements change

### Test Documentation

- Document test scenarios in test files
- Maintain test data and mocks
- Update test plan when features change
- Document known limitations or test gaps

## Known Limitations

1. **Visual Regression**: Manual verification required for animation smoothness
2. **Cross-Browser**: Some browsers may need manual testing
3. **Mobile Devices**: Physical device testing recommended for touch scrolling
4. **Performance**: Frame rate measurement may vary by environment

## Success Criteria

All tests pass when:

1. All unit tests pass with target coverage
2. All integration tests pass
3. All E2E tests pass
4. Performance tests meet 60fps target
5. Accessibility tests pass
6. Manual visual verification confirms smooth transitions
7. All acceptance criteria from requirements are verified
