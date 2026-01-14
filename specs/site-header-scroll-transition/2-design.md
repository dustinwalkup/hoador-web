# Design Document: Site Header Scroll-Based Label Transition

## Overview

This design implements a scroll-based transition system that synchronizes the site header label with the PageHeader component's title. When the PageHeader scrolls out of view, its title smoothly transitions into the fixed site header label, eliminating visual duplication and providing consistent navigation context.

The solution uses React Context for state management, Intersection Observer API for efficient scroll detection, and CSS transitions for smooth animations. The design maintains backward compatibility with pages that don't have PageHeader components.

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Page Load                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PageHeader Component                                        │
│  - Renders with title prop                                   │
│  - Registers ref with PageHeaderContext                      │
│  - Provides title to context                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PageHeaderProvider (Context)                                │
│  - Manages PageHeader refs                                    │
│  - Stores current title                                       │
│  - Tracks intersection state                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  usePageHeaderScroll Hook                                    │
│  - Uses Intersection Observer                                │
│  - Detects when PageHeader scrolls out of view               │
│  - Returns { title, isVisible, shouldShowLabel }             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  SiteHeaderLabel Component                                   │
│  - Uses usePageHeaderScroll hook                              │
│  - Falls back to nav-based label if no PageHeader             │
│  - Applies smooth CSS transitions                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
DashboardLayout
├── SiteHeader (sticky)
│   └── SiteHeaderLabel (client component)
│       └── Uses usePageHeaderScroll hook
│
└── Page Content
    └── PageHeader (can be server or client)
        └── Registers with PageHeaderContext
```

## Components and Interfaces

### 1. PageHeaderContext

**Purpose**: Provides a communication channel between PageHeader components and SiteHeaderLabel.

**Location**: `src/contexts/page-header-context.tsx`

**Interface**:

```typescript
interface PageHeaderContextValue {
  registerPageHeader: (
    ref: React.RefObject<HTMLElement>,
    title: string,
  ) => void;
  unregisterPageHeader: (ref: React.RefObject<HTMLElement>) => void;
  updateTitle: (ref: React.RefObject<HTMLElement>, title: string) => void;
  getCurrentTitle: () => string | null;
  getIsVisible: () => boolean;
}
```

**Implementation Details**:

- Uses React Context API
- Manages a Map of registered PageHeader refs and their titles
- Tracks the topmost (first) PageHeader for pages with multiple headers
- Provides methods for registration, unregistration, and title updates
- Exposes current title and visibility state

### 2. PageHeaderProvider

**Purpose**: Wraps the dashboard layout to provide PageHeaderContext to all child components.

**Location**: `src/contexts/page-header-context.tsx` (same file as context)

**Implementation Details**:

- Client component (requires "use client")
- Wraps children with Context.Provider
- Manages internal state for registered headers
- Handles cleanup on unmount

### 3. usePageHeaderScroll Hook

**Purpose**: Custom hook that uses Intersection Observer to detect when PageHeader scrolls out of view.

**Location**: `src/hooks/use-page-header-scroll.ts`

**Interface**:

```typescript
interface UsePageHeaderScrollReturn {
  title: string | null;
  isPageHeaderVisible: boolean;
  shouldShowLabel: boolean;
}

function usePageHeaderScroll(): UsePageHeaderScrollReturn;
```

**Implementation Details**:

- Uses Intersection Observer API (following existing pattern from `use-scroll-animation.ts`)
- Observes the registered PageHeader element
- Calculates intersection with site header position (accounting for header height)
- Returns:
  - `title`: Current PageHeader title (null if not registered)
  - `isPageHeaderVisible`: Whether PageHeader is currently visible in viewport
  - `shouldShowLabel`: Whether site header label should be displayed (inverse of isPageHeaderVisible)
- Uses `rootMargin` to account for site header height (approximately 48px / 3rem)
- Handles cleanup and observer disconnection

**Intersection Observer Configuration**:

```typescript
{
  root: null, // viewport
  rootMargin: '-48px 0px 0px 0px', // Account for site header height
  threshold: 0, // Trigger when any part crosses threshold
}
```

### 4. Enhanced PageHeader Component

**Purpose**: Registers itself with PageHeaderContext and provides title updates.

**Location**: `src/components/page-header.tsx` (modify existing)

**Changes Required**:

- Add "use client" directive (or create wrapper component)
- Add ref using `useRef<HTMLDivElement>`
- Use `useContext(PageHeaderContext)` to register/unregister
- Register on mount, unregister on unmount
- Update context when title prop changes
- Forward ref to root div element

**Implementation Pattern**:

```typescript
"use client";

import { useRef, useEffect, useContext } from "react";
import { PageHeaderContext } from "@/contexts/page-header-context";

export function PageHeader({ title, ...props }: PageHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const context = useContext(PageHeaderContext);

  useEffect(() => {
    if (ref.current && context) {
      context.registerPageHeader(ref, title);
      return () => context.unregisterPageHeader(ref);
    }
  }, [context, title]);

  // ... rest of component
}
```

**Alternative Approach (Non-Breaking)**:

- Create a new `PageHeaderClient` wrapper component
- Keep existing `PageHeader` as Server Component
- Use composition: `PageHeader` wraps `PageHeaderClient` internally
- This maintains backward compatibility

### 5. Enhanced SiteHeaderLabel Component

**Purpose**: Displays PageHeader title when scrolled out of view, falls back to nav-based label.

**Location**: `src/components/site-header-label.tsx` (modify existing)

**Changes Required**:

- Use `usePageHeaderScroll()` hook to get title and visibility state
- Fall back to existing nav-based label logic when no PageHeader is registered
- Apply CSS transitions for smooth appearance/disappearance
- Handle text overflow for long titles
- Respect `prefers-reduced-motion` media query

**Implementation Pattern**:

```typescript
"use client";

import { usePageHeaderScroll } from "@/hooks/use-page-header-scroll";
import { usePathname } from "next/navigation";
import { DASHBOARD } from "@/constants/navbar";

export function SiteHeaderLabel() {
  const pathname = usePathname();
  const { title, shouldShowLabel } = usePageHeaderScroll();

  // Fallback to nav-based label
  const navLabel = DASHBOARD.mainNav.find((item) => item.url === pathname)?.title;
  const displayLabel = shouldShowLabel && title ? title : (title ? null : navLabel);

  return (
    <div className="flex w-full items-center justify-between">
      <h1
        className={cn(
          "text-xl font-medium transition-opacity duration-300",
          displayLabel ? "opacity-100" : "opacity-0"
        )}
        style={{
          transition: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'none'
            : 'opacity 250ms ease-in-out'
        }}
      >
        {displayLabel || '\u00A0'} {/* Non-breaking space for layout stability */}
      </h1>
      <NotificationBell />
    </div>
  );
}
```

### 6. Enhanced Dashboard Layout

**Purpose**: Provides PageHeaderContext to all dashboard pages.

**Location**: `src/app/dashboard/layout.tsx` (modify existing)

**Changes Required**:

- Wrap children with `PageHeaderProvider`
- Maintain existing authentication and sidebar logic

**Implementation Pattern**:

```typescript
import { PageHeaderProvider } from "@/contexts/page-header-context";

export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <SidebarProvider>
      <AuthenticatedSidebar user={user} variant="inset" />
      <SidebarInset>
        <PageHeaderProvider>
          <SiteHeader />
          <div className="bg-muted/20">
            <ConditionalPadding>{children}</ConditionalPadding>
          </div>
        </PageHeaderProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

## Data Models

### PageHeaderRegistration

```typescript
interface PageHeaderRegistration {
  ref: React.RefObject<HTMLElement>;
  title: string;
  registeredAt: number; // timestamp for ordering
}
```

**Purpose**: Internal data structure for tracking registered PageHeader components.

**Usage**: Stored in PageHeaderProvider's internal state as a Map keyed by ref object identity.

## Error Handling

### Missing Context

**Scenario**: PageHeader or SiteHeaderLabel used outside PageHeaderProvider.

**Handling**:

- PageHeader: Gracefully skip registration (check if context exists)
- SiteHeaderLabel: Fall back to nav-based label (existing behavior)
- Log warning in development mode

### Missing PageHeader

**Scenario**: Page doesn't have PageHeader component.

**Handling**:

- SiteHeaderLabel falls back to nav-based label (Requirement 6)
- No errors thrown
- Feature degrades gracefully

### Intersection Observer Unsupported

**Scenario**: Browser doesn't support Intersection Observer (very rare).

**Handling**:

- Provide polyfill or fallback
- Use scroll event listener as fallback (throttled)
- Gracefully degrade to always-show-label behavior

## Testing Strategy

### Unit Tests

1. **PageHeaderContext**
   - Test registration/unregistration
   - Test title updates
   - Test multiple PageHeader handling (topmost wins)
   - Test context provider/consumer

2. **usePageHeaderScroll Hook**
   - Mock Intersection Observer
   - Test visibility state changes
   - Test title extraction
   - Test cleanup on unmount

3. **SiteHeaderLabel**
   - Test label display logic
   - Test fallback to nav-based label
   - Test transition classes
   - Test reduced motion handling

### Integration Tests

1. **Scroll Behavior**
   - Test label appears when PageHeader scrolls out
   - Test label disappears when PageHeader scrolls back
   - Test smooth transitions
   - Test rapid scrolling performance

2. **Multiple PageHeaders**
   - Test first PageHeader is tracked
   - Test title updates when topmost changes

### E2E Tests

1. **User Flow**
   - Navigate to dashboard page with PageHeader
   - Scroll down, verify label appears
   - Scroll back up, verify label disappears
   - Navigate to page without PageHeader, verify fallback

## Performance Considerations

### Intersection Observer Efficiency

- **Single Observer Instance**: Reuse one Intersection Observer per registered PageHeader
- **Efficient Thresholds**: Use `threshold: 0` for immediate detection
- **Root Margin Optimization**: Calculate exact header height dynamically if needed

### CSS Animation Performance

- **GPU-Accelerated Properties**: Use `opacity` and `transform` only
- **Avoid Layout Thrashing**: Don't animate `width`, `height`, `margin`, `top`, `left`
- **Transition Duration**: 250ms (within 200-300ms requirement)

### React Performance

- **Memoization**: Memoize context values to prevent unnecessary re-renders
- **Ref Stability**: Use stable refs to avoid observer re-creation
- **Cleanup**: Properly disconnect observers on unmount

## Accessibility

### Screen Reader Support

- **Semantic HTML**: Maintain `<h1>` element for label
- **ARIA Labels**: Ensure label is properly announced
- **Live Regions**: Consider `aria-live="polite"` for dynamic updates (optional)

### Motion Preferences

- **Respect `prefers-reduced-motion`**: Use instant transitions when enabled
- **CSS Media Query**: Check `@media (prefers-reduced-motion: reduce)`
- **JavaScript Fallback**: Also check via `window.matchMedia()` for dynamic updates

## Security Considerations

- **No User Input**: Title comes from component props (trusted source)
- **XSS Prevention**: React automatically escapes text content
- **Context Isolation**: Context is scoped to dashboard layout only

## Technology Choices

### Intersection Observer API

**Rationale**:

- Native browser API, highly performant
- Already used in codebase (`use-scroll-animation.ts`, `use-infinite-scroll.ts`)
- Better than scroll event listeners (no layout thrashing)
- Supported in all modern browsers

### React Context API

**Rationale**:

- Standard React pattern for component communication
- Works across Server/Client Component boundaries
- No external dependencies
- Fits Next.js App Router architecture

### CSS Transitions

**Rationale**:

- Native browser animations (GPU-accelerated)
- Better performance than JavaScript animations
- Respects `prefers-reduced-motion`
- Simple to implement and maintain

## Implementation Notes

### Server vs Client Components

**Challenge**: PageHeader may be used in Server Components, but needs client-side features.

**Solution**:

- Option A: Make PageHeader a Client Component (requires "use client")
- Option B: Create PageHeaderClient wrapper, keep PageHeader as Server Component
- **Recommendation**: Option B for better compatibility and flexibility

### Header Height Calculation

**Challenge**: Site header height may vary (responsive, theme changes).

**Solution**:

- Use fixed `rootMargin: '-48px'` (3rem = 48px based on `h-12` class)
- Alternatively: Dynamically measure header height on mount
- **Recommendation**: Start with fixed value, enhance if needed

### Multiple PageHeaders

**Challenge**: Some pages may have multiple PageHeader components.

**Solution**:

- Track all registered headers with timestamps
- Use the first (topmost) header for label
- Update when topmost changes
- **Implementation**: Sort by `registeredAt` timestamp and DOM position

## Dependencies

### New Dependencies

None required - uses existing React and browser APIs.

### Existing Dependencies Used

- `react` - Context API, hooks
- `next/navigation` - usePathname (existing)
- Tailwind CSS - Styling and transitions

## File Structure

```
src/
├── contexts/
│   └── page-header-context.tsx          [NEW]
├── hooks/
│   └── use-page-header-scroll.ts         [NEW]
├── components/
│   ├── page-header.tsx                   [MODIFY]
│   └── site-header-label.tsx             [MODIFY]
└── app/
    └── dashboard/
        └── layout.tsx                     [MODIFY]
```

## Migration Path

### Phase 1: Core Infrastructure

1. Create PageHeaderContext and Provider
2. Create usePageHeaderScroll hook
3. Update DashboardLayout to include Provider

### Phase 2: Component Updates

1. Enhance PageHeader to register with context
2. Enhance SiteHeaderLabel to use hook
3. Test with existing pages

### Phase 3: PageHeader Coverage

1. Add PageHeader to Garage page
2. Add PageHeader to Mailbox page
3. Verify all dashboard pages have PageHeader

### Phase 4: Polish

1. Fine-tune transition timing
2. Test accessibility
3. Performance optimization
4. Cross-browser testing

## Design Decisions

### Decision 1: Context API vs Props Drilling

**Chosen**: Context API

**Rationale**:

- PageHeader and SiteHeaderLabel are in different parts of component tree
- Props drilling would require changes to many intermediate components
- Context provides clean separation of concerns

### Decision 2: Intersection Observer vs Scroll Events

**Chosen**: Intersection Observer

**Rationale**:

- Better performance (no layout thrashing)
- Already used in codebase
- Native browser API, well-supported
- Handles edge cases automatically

### Decision 3: Single vs Multiple PageHeader Support

**Chosen**: Support multiple, track topmost

**Rationale**:

- Future-proof for complex pages
- Handles edge cases gracefully
- Minimal performance impact

### Decision 4: Client Component Wrapper vs Direct Modification

**Chosen**: Wrapper approach (PageHeaderClient)

**Rationale**:

- Maintains Server Component benefits for PageHeader
- Non-breaking change
- Better compatibility with Next.js App Router

## Research Findings

Based on web research and codebase analysis:

1. **Intersection Observer Best Practices**:
   - Reuse observer instances when possible
   - Use appropriate rootMargin for header detection
   - Clean up observers properly

2. **CSS Animation Performance**:
   - Animate `opacity` and `transform` only
   - Use transitions over JavaScript animations
   - Respect `prefers-reduced-motion`

3. **React Context Patterns**:
   - Memoize context values
   - Provide stable references
   - Handle missing context gracefully

## Open Questions

1. Should we support nested PageHeaders (e.g., in modals)?
   - **Decision**: No, scope to main page content only

2. Should label update immediately or wait for transition?
   - **Decision**: Update immediately, transition handles visual change

3. How to handle very long titles?
   - **Decision**: Truncate with ellipsis, maintain single line

## Next Steps

1. Review and approve this design document
2. Proceed to Phase 3: Task List creation
3. Begin implementation following the migration path
