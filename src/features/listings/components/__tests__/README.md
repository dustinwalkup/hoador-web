# StatusIconWithTooltip Tests

## Overview

Comprehensive unit tests for the `StatusIconWithTooltip` component using Vitest and React Testing Library.

## Prerequisites

Install the required testing dependencies:

```bash
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitejs/plugin-react
```

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage

# Run tests with UI
bun test:ui
```

## Test Coverage

The test suite covers:

### 1. **Icon Rendering** (5 tests)

- ✅ Green CheckCircle for "available" status
- ✅ Blue Clock for "rented" status
- ✅ Yellow AlertTriangle for "maintenance" status
- ✅ Gray XCircle for "inactive" status
- ✅ Default gray XCircle for unknown status

### 2. **Button Attributes** (4 tests)

- ✅ Renders as button element
- ✅ Has type="button"
- ✅ Has cursor-help class
- ✅ Has proper aria-label

### 3. **Tooltip Behavior** (7 tests)

- ✅ Shows tooltip on hover
- ✅ Displays correct status text
- ✅ Has dark styling (bg-gray-900, text-white)
- ✅ Hides tooltip on unhover
- ✅ Works for all status types

### 4. **Status Text Formatting** (2 tests)

- ✅ Capitalizes status text
- ✅ Handles all status values

### 5. **Accessibility** (3 tests)

- ✅ Keyboard accessible (tab navigation)
- ✅ Proper ARIA attributes
- ✅ Screen reader compatible

### 6. **Edge Cases** (3 tests)

- ✅ Handles empty string
- ✅ Handles unknown values
- ✅ Doesn't crash on any string

### 7. **Component Integration** (2 tests)

- ✅ Multiple instances work independently
- ✅ Tooltips don't interfere with each other

### 8. **Snapshot Tests** (4 tests)

- ✅ Snapshots for all status types

## Total: 30 Tests

## Example Output

```
✓ src/features/listings/components/__tests__/status-icon-with-tooltip.test.tsx (30)
  ✓ StatusIconWithTooltip (30)
    ✓ Icon rendering (5)
    ✓ Button attributes (4)
    ✓ Tooltip behavior (7)
    ✓ Status text formatting (2)
    ✓ Accessibility (3)
    ✓ Edge cases (3)
    ✓ Component integration (2)
    ✓ Snapshot tests (4)

Test Files  1 passed (1)
Tests  30 passed (30)
```

## Notes

- Tests use `jsdom` environment for DOM manipulation
- `@testing-library/user-event` simulates real user interactions
- Tooltips are tested with hover events and proper cleanup
- Snapshot tests ensure component structure remains consistent
