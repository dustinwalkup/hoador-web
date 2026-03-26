# Requirements Document: Site Header Scroll-Based Label Transition

## Introduction

This feature implements a smooth scroll-based transition for the site header label that eliminates visual duplication between the fixed site header and page headers. When a user scrolls down a page, the PageHeader component's title will smoothly transition into the fixed site header label as it scrolls out of view. This provides a consistent navigation experience while maintaining context as users scroll through content.

Currently, the site header label displays the page title based on the current route, which duplicates the PageHeader title that appears in the scrollable content area. This creates visual redundancy and wastes valuable header space. The new behavior will make the header label empty by default and only display the page title when the PageHeader scrolls out of view, creating a seamless transition.

## Requirements

### Requirement 1: Empty Site Header Label by Default

**User Story:** As a user, I want the site header label to be empty when the page header is visible, so that I don't see duplicate titles and the interface feels cleaner.

#### Acceptance Criteria

1. WHEN the page loads AND the PageHeader component is visible in the viewport, THEN the site header label SHALL display an empty state (no text)
2. WHERE a page does not have a PageHeader component, THEN the system SHALL display the current nav-based label (existing behavior from DASHBOARD.mainNav)
3. The system SHALL maintain the existing layout and spacing of the site header label container when empty

### Requirement 2: Scroll-Based Intersection Detection

**User Story:** As a user, I want the site header label to appear when I scroll past the page header, so that I always know which page I'm on even when scrolling through long content.

#### Acceptance Criteria

1. WHEN the user scrolls down AND the PageHeader component intersects with or scrolls past the top of the viewport (site header position), THEN the system SHALL detect this intersection event
2. WHEN the PageHeader's top edge reaches or passes the site header's bottom edge, THEN the system SHALL trigger the label transition
3. The system SHALL use the Intersection Observer API or equivalent scroll detection mechanism for performance
4. WHERE multiple PageHeader components exist on a page, THEN the system SHALL track the first (topmost) PageHeader component
5. The system SHALL handle rapid scrolling without performance degradation

### Requirement 3: Smooth Label Transition

**User Story:** As a user, I want the site header label to smoothly transition when appearing and disappearing, so that the interface feels polished and professional.

#### Acceptance Criteria

1. WHEN the PageHeader scrolls out of view AND the label should appear, THEN the system SHALL smoothly transition the label from empty to displaying the PageHeader's title
2. WHEN the user scrolls back up AND the PageHeader becomes visible again, THEN the system SHALL smoothly transition the label from displaying text back to empty
3. The transition SHALL use CSS transitions or animations with a duration between 200ms and 300ms
4. The transition SHALL use an opacity and/or transform animation for smooth visual effect
5. The transition SHALL maintain text alignment and layout stability during the animation
6. WHERE the PageHeader title is long, THEN the system SHALL handle text overflow appropriately (truncation with ellipsis or responsive sizing)

### Requirement 4: PageHeader Title Extraction

**User Story:** As a developer, I want the site header to automatically extract the title from PageHeader components, so that I don't need to manually sync titles between components.

#### Acceptance Criteria

1. WHEN a PageHeader component exists on the page, THEN the system SHALL extract the title prop value from the PageHeader component
2. The system SHALL display the exact same title text in the site header label as appears in the PageHeader
3. WHERE the PageHeader title changes dynamically (e.g., based on user data), THEN the system SHALL update the site header label accordingly
4. The system SHALL handle special characters and formatting in PageHeader titles correctly

### Requirement 5: Universal PageHeader Coverage

**User Story:** As a developer, I want all dashboard pages to have PageHeader components, so that the scroll transition feature works consistently across the application.

#### Acceptance Criteria

1. WHERE a page within `/dashboard` does not currently have a PageHeader component, THEN the system SHALL add a PageHeader component with appropriate title and description
2. The system SHALL ensure all top-level dashboard pages have PageHeader components:
   - Dashboard home page (already has PageHeader)
   - Explore page (already has PageHeader)
   - Garage page (needs PageHeader)
   - Mailbox page (needs PageHeader)
   - Profile page (already has PageHeader)
   - Rentals list flow at `/dashboard/rentals/*` (PageHeader in `(rentals)/(flow)/layout.tsx`, direction-based title/description)
3. WHERE a page has conditional PageHeader rendering, THEN the system SHALL respect those conditions (e.g. pages that omit PageHeader by design)
4. Each added PageHeader SHALL have a descriptive title that matches the page's purpose
5. Each added PageHeader SHALL have an optional description that provides context

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want the feature to work with existing pages that may not have PageHeader components, so that the application doesn't break for edge cases.

#### Acceptance Criteria

1. WHERE a page does not have a PageHeader component, THEN the system SHALL fall back to the existing nav-based label behavior (using DASHBOARD.mainNav)
2. The system SHALL not break or throw errors when PageHeader components are missing
3. The system SHALL maintain existing functionality for pages outside the `/dashboard` route
4. WHERE a PageHeader exists but has no title prop, THEN the system SHALL handle this gracefully (empty label or fallback)

### Requirement 7: Performance and Accessibility

**User Story:** As a user, I want the scroll transition to be performant and accessible, so that the feature works smoothly on all devices and for all users.

#### Acceptance Criteria

1. The system SHALL use efficient scroll detection that does not cause layout thrashing or performance issues
2. The system SHALL use requestAnimationFrame or Intersection Observer API for scroll handling
3. The system SHALL maintain 60fps during scroll transitions on standard devices
4. The system SHALL be accessible to screen readers (proper ARIA labels and semantic HTML)
5. The system SHALL work correctly with reduced motion preferences (respect `prefers-reduced-motion` media query)
6. WHERE reduced motion is preferred, THEN the system SHALL use instant transitions instead of animated ones

## Assumptions

1. All pages within `/dashboard` should eventually have PageHeader components
2. The site header is a fixed/sticky element at the top of the viewport
3. The PageHeader component is part of the scrollable content area
4. Users expect smooth, polished animations in modern web applications
5. The feature should work across all modern browsers that support Intersection Observer API

## Constraints

1. Must work with Next.js App Router architecture (Server and Client Components)
2. Must maintain compatibility with existing SiteHeader and SiteHeaderLabel components
3. Must not break existing navigation functionality
4. Must work with the current sidebar and layout structure
5. Animation performance must not degrade on mobile devices

## Success Criteria

1. Site header label is empty when PageHeader is visible
2. Site header label smoothly appears when PageHeader scrolls out of view
3. Site header label smoothly disappears when PageHeader scrolls back into view
4. All dashboard pages have PageHeader components
5. Feature works consistently across all dashboard pages
6. No performance degradation during scrolling
7. Feature is accessible and respects user preferences
