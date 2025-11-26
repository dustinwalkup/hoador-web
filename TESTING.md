# Testing Setup Guide

## Installation

To run the component tests, install the required dependencies:

```bash
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitejs/plugin-react
```

## What's Been Set Up

### 1. **Vitest Configuration** (`vitest.config.ts`)

- ✅ React plugin enabled
- ✅ jsdom environment for DOM testing
- ✅ Global test utilities
- ✅ Setup file configuration
- ✅ Coverage reporting

### 2. **Test Setup** (`src/test/setup.ts`)

- ✅ jest-dom matchers integration
- ✅ Automatic cleanup after each test
- ✅ Mock for `window.matchMedia`
- ✅ Mock for `IntersectionObserver`
- ✅ Mock for `ResizeObserver`

### 3. **TypeScript Definitions** (`src/test/vitest-setup.d.ts`)

- ✅ jest-dom matcher types for Vitest
- ✅ Full TypeScript support

### 4. **Test Suite** (`src/features/listings/components/__tests__/`)

- ✅ 30 comprehensive tests for `StatusIconWithTooltip`
- ✅ Test documentation in README.md

## Running Tests

```bash
# Run all tests once
bun test:run

# Run tests in watch mode (recommended for development)
bun test:watch

# Run tests with coverage report
bun test:coverage

# Run tests with UI
bun test:ui
```

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Test environment setup
│   └── vitest-setup.d.ts     # TypeScript definitions
└── features/
    └── listings/
        └── components/
            ├── status-icon-with-tooltip.tsx
            └── __tests__/
                ├── status-icon-with-tooltip.test.tsx
                └── README.md
```

## Example Test Output

After running `bun test`, you should see:

```
✓ src/features/listings/components/__tests__/status-icon-with-tooltip.test.tsx (30) 1250ms
  ✓ StatusIconWithTooltip (30) 1248ms
    ✓ Icon rendering (6) 156ms
      ✓ should render green CheckCircle icon for available status 28ms
      ✓ should render blue Clock icon for rented status 18ms
      ✓ should render yellow AlertTriangle icon for maintenance status 15ms
      ✓ should render gray XCircle icon for inactive status 12ms
      ✓ should render gray XCircle icon for unknown status 11ms
      ✓ should render icon with correct size 72ms
    ✓ Button attributes (4) 124ms
    ✓ Tooltip behavior (7) 456ms
    ✓ Status text formatting (2) 89ms
    ✓ Accessibility (3) 145ms
    ✓ Edge cases (3) 98ms
    ✓ Component integration (2) 156ms
    ✓ Snapshot tests (4) 124ms

Test Files  1 passed (1)
     Tests  30 passed (30)
  Start at  10:30:00
  Duration  1.35s
```

## Writing New Tests

### Basic Test Template

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YourComponent } from "../your-component";

describe("YourComponent", () => {
  it("should render correctly", () => {
    render(<YourComponent />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

### Testing User Interactions

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { YourComponent } from "../your-component";

describe("YourComponent", () => {
  it("should handle click events", async () => {
    const user = userEvent.setup();
    render(<YourComponent />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(screen.getByText("Clicked!")).toBeInTheDocument();
  });
});
```

## Available Matchers

Thanks to `@testing-library/jest-dom`, you have access to:

- `toBeInTheDocument()` - Element exists in DOM
- `toHaveClass()` - Element has CSS class
- `toHaveAttribute()` - Element has attribute
- `toBeVisible()` - Element is visible
- `toHaveFocus()` - Element has focus
- `toBeDisabled()` - Element is disabled
- `toHaveValue()` - Input has value
- And many more...

[Full list of matchers](https://github.com/testing-library/jest-dom#custom-matchers)

## Best Practices

1. **Test user behavior, not implementation**

   ```tsx
   // ✅ Good
   expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();

   // ❌ Avoid
   expect(wrapper.find(".submit-button")).toHaveLength(1);
   ```

2. **Use semantic queries**
   - Prefer `getByRole`, `getByLabelText`, `getByText`
   - Avoid `getByTestId` unless necessary

3. **Async operations need awaiting**

   ```tsx
   await user.click(button);
   await waitFor(() => {
     expect(screen.getByText("Success")).toBeInTheDocument();
   });
   ```

4. **Clean up is automatic**
   - No need to manually unmount
   - Setup file handles cleanup

## Coverage Reports

After running `bun test:coverage`, open:

```
coverage/index.html
```

Target coverage:

- **Statements**: > 80%
- **Branches**: > 80%
- **Functions**: > 80%
- **Lines**: > 80%

## Troubleshooting

### Type Errors in Tests

Make sure `src/test/vitest-setup.d.ts` is included in your TypeScript compilation. It should be picked up automatically.

### Tests Timing Out

Increase timeout in test:

```tsx
it("slow test", async () => {
  // Test code
}, 10000); // 10 second timeout
```

### Mock Not Working

Check that mocks are defined before imports:

```tsx
vi.mock("./some-module");
import { Component } from "./component";
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
- [User Event Library](https://testing-library.com/docs/user-event/intro)
