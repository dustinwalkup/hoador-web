# Implementation Tasks: Site Header Scroll-Based Label Transition

## Overview

This task list breaks down the design into discrete, actionable implementation tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task is sized to be completable in one session and includes references to the requirements it satisfies.

## Task List

### Phase 1: Core Infrastructure

- [ ] 1. Create PageHeaderContext and PageHeaderProvider
  - Create `src/contexts/page-header-context.tsx`
  - Define `PageHeaderContextValue` interface with registration methods
  - Implement `PageHeaderProvider` component with internal state management
  - Use Map to track registered PageHeader refs and titles
  - Implement logic to track topmost (first) PageHeader when multiple exist
  - Add proper TypeScript types and exports
  - Handle context missing gracefully (return null/undefined)
  - _Requirements: 2.1, 2.4, 4.1, 6.2_

- [ ] 2. Create usePageHeaderScroll hook
  - Create `src/hooks/use-page-header-scroll.ts`
  - Implement hook that uses PageHeaderContext
  - Set up Intersection Observer with appropriate configuration
  - Calculate rootMargin to account for site header height (48px / 3rem)
  - Track visibility state of registered PageHeader
  - Return `{ title, isPageHeaderVisible, shouldShowLabel }` interface
  - Handle cleanup on unmount (disconnect observer)
  - Add proper error handling for missing context
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 7.1, 7.2_

### Phase 2: Component Updates

- [ ] 3. Enhance PageHeader component to register with context
  - Modify `src/components/page-header.tsx`
  - Create `PageHeaderClient` wrapper component with "use client" directive
  - Add `useRef<HTMLDivElement>` to track PageHeader element
  - Use `useContext(PageHeaderContext)` to access context
  - Register PageHeader on mount with `registerPageHeader(ref, title)`
  - Unregister PageHeader on unmount with `unregisterPageHeader(ref)`
  - Update context when title prop changes with `updateTitle(ref, title)`
  - Forward ref to root div element
  - Keep existing PageHeader as Server Component wrapper (non-breaking)
  - Maintain all existing props and functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.2_

- [ ] 4. Enhance SiteHeaderLabel component with scroll-based label
  - Modify `src/components/site-header-label.tsx`
  - Import and use `usePageHeaderScroll()` hook
  - Get `title` and `shouldShowLabel` from hook
  - Implement fallback logic: use nav-based label when no PageHeader registered
  - Apply CSS transition classes for smooth opacity animation (250ms duration)
  - Handle empty state with non-breaking space (`\u00A0`) for layout stability
  - Add text overflow handling (truncate with ellipsis for long titles)
  - Maintain existing NotificationBell component
  - Preserve existing layout and styling
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.6, 6.1, 6.4_

- [ ] 5. Add reduced motion support to SiteHeaderLabel
  - Add check for `prefers-reduced-motion` media query
  - Use `window.matchMedia('(prefers-reduced-motion: reduce)')` for dynamic updates
  - Apply instant transitions (no animation) when reduced motion is preferred
  - Fall back to CSS media query for initial render
  - Ensure transitions respect user preferences
  - _Requirements: 7.5, 7.6_

### Phase 3: Layout Integration

- [ ] 6. Integrate PageHeaderProvider into DashboardLayout
  - Modify `src/app/dashboard/layout.tsx`
  - Import `PageHeaderProvider` from contexts
  - Wrap existing layout content with `PageHeaderProvider`
  - Ensure Provider wraps both SiteHeader and page content
  - Maintain existing authentication and sidebar logic
  - Verify no breaking changes to layout structure
  - _Requirements: 1.1, 2.1, 6.3_

### Phase 4: PageHeader Coverage

- [ ] 7. Add PageHeader to Garage page
  - Modify `src/app/dashboard/garage/page.tsx`
  - Import `PageHeader` component
  - Add PageHeader with appropriate title: "Garage"
  - Add description: "Manage your tool listings and inventory" (or appropriate)
  - Place PageHeader before existing content (OnboardingBanner)
  - Maintain existing page structure and functionality
  - Ensure proper spacing and layout
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ] 8. Add PageHeader to Mailbox page
  - Modify `src/app/dashboard/mailbox/page.tsx`
  - Import `PageHeader` component
  - Add PageHeader with appropriate title: "Mailbox"
  - Add description: "View and manage your messages" (or appropriate)
  - Place PageHeader before MailboxClient component
  - Maintain existing page structure and functionality
  - Ensure proper spacing and layout
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ] 9. Verify all dashboard pages have PageHeader
  - Review all pages in `src/app/dashboard/` directory
  - Verify Dashboard home page has PageHeader (already exists)
  - Verify Explore page has PageHeader (already exists)
  - Verify Profile page has PageHeader (already exists)
  - Verify Rentals pages have PageHeader in layout (already exists)
  - Document any pages that need PageHeader added
  - Ensure conditional PageHeader rendering (e.g., rentals) is respected
  - _Requirements: 5.2, 5.3_

### Phase 5: Polish and Optimization

- [ ] 10. Fine-tune transition timing and visual effects
  - Test transition duration (target: 250ms)
  - Verify smooth opacity transitions
  - Test with various title lengths
  - Ensure no layout shift during transitions
  - Verify text alignment remains stable
  - Test on different screen sizes
  - _Requirements: 3.3, 3.4, 3.5_

- [ ] 11. Optimize Intersection Observer configuration
  - Verify rootMargin calculation (48px for header height)
  - Test threshold value (0 for immediate detection)
  - Ensure observer cleanup on component unmount
  - Test performance with rapid scrolling
  - Verify no memory leaks from observers
  - _Requirements: 2.3, 2.5, 7.1, 7.2, 7.3_

- [ ] 12. Add accessibility enhancements
  - Verify semantic HTML structure (h1 element maintained)
  - Test with screen readers
  - Ensure ARIA labels are appropriate
  - Verify reduced motion support works correctly
  - Test keyboard navigation
  - _Requirements: 7.4, 7.5_

## Task Dependencies

```
1 (Context) → 2 (Hook)
1 (Context) → 3 (PageHeader)
2 (Hook) → 4 (SiteHeaderLabel)
3 (PageHeader) → 4 (SiteHeaderLabel)
1 (Context) → 6 (Layout)
4 (SiteHeaderLabel) → 5 (Reduced Motion)
6 (Layout) → 7, 8, 9 (PageHeader Coverage)
All → 10, 11, 12 (Polish)
```

## Implementation Order

1. **Start with Phase 1** (Tasks 1-2): Core infrastructure that everything else depends on
2. **Then Phase 2** (Tasks 3-5): Component updates that use the infrastructure
3. **Then Phase 3** (Task 6): Layout integration to enable the feature
4. **Then Phase 4** (Tasks 7-9): Ensure all pages have PageHeader components
5. **Finally Phase 5** (Tasks 10-12): Polish, optimization, and accessibility

## Testing Notes

- Test each phase incrementally before moving to the next
- Verify backward compatibility after each component update
- Test with and without PageHeader components
- Test rapid scrolling performance
- Test on mobile devices
- Verify reduced motion preferences
- Test with screen readers

## Complexity Estimates

- **Task 1**: Medium (Context setup, state management)
- **Task 2**: Medium (Intersection Observer integration)
- **Task 3**: Medium (Component enhancement, ref forwarding)
- **Task 4**: Medium (Hook integration, fallback logic)
- **Task 5**: Small (Media query check)
- **Task 6**: Small (Layout wrapper)
- **Task 7**: Small (Add component)
- **Task 8**: Small (Add component)
- **Task 9**: Small (Verification)
- **Task 10**: Small (Fine-tuning)
- **Task 11**: Small (Optimization)
- **Task 12**: Small (Accessibility)

## Notes

- All tasks involve writing, modifying, or testing code
- Tasks are sized to be completable in one focused session
- Each task builds incrementally on previous work
- Testing should be done incrementally, not deferred to the end
- Backward compatibility must be maintained throughout
