# Listing Review Implementation Tasks

## Overview

This document breaks down the listing review feature implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

## Task List

### Phase 1: Database Schema and Migration

- [ ] 1. Add approval status enum to schema definitions
  - Add `approvalStatusEnum` to `src/db/schemas/_enums.ts`
  - Define enum with values: `pending_review`, `approved`, `rejected`
  - Export enum for use in listings schema
  - _Requirements: 1.1_

- [ ] 2. Add notification types enum extensions
  - Add `listing_approved` to `notificationTypeEnum` in `src/db/schemas/_enums.ts`
  - Add `listing_rejected` to `notificationTypeEnum`
  - Verify enum exports correctly
  - _Requirements: 7.5_

- [ ] 3. Update listings schema with approval fields
  - Add `approvalStatus` field to listings table in `src/db/schemas/listings.schema.ts`
  - Use `approvalStatusEnum` with default `pending_review`
  - Add `rejectionReason` text field (nullable)
  - Add `reviewedBy` text field referencing user.id (nullable, onDelete: set null)
  - Add `reviewedAt` timestamp field (nullable)
  - Ensure fields follow existing schema patterns
  - _Requirements: 1.2, 1.4, 1.5, 1.6, 1.10_

- [ ] 4. Add database indexes for approval status
  - Add index on `approvalStatus` column in listings schema
  - Add composite index on `(status, approvalStatus)` for search queries
  - Add index on `reviewedAt` for history sorting
  - Verify indexes are included in schema exports
  - _Requirements: 1.7, Performance.4_

- [ ] 5. Generate database migration
  - Run Drizzle migration generation command
  - Review generated migration SQL in `src/db/migrations/`
  - Verify migration adds enum type correctly
  - Verify migration adds columns as nullable initially
  - Verify migration includes index creation
  - _Requirements: 9.1, 9.4_

- [ ] 6. Update migration to grandfather existing listings
  - Edit generated migration to add UPDATE statement
  - Set all existing listings to `approvalStatus: 'approved'`
  - Set NOT NULL constraint on `approvalStatus` after UPDATE
  - Test migration rollback works correctly
  - Verify migration is idempotent
  - _Requirements: 9.2, 9.3, 9.4_

### Phase 2: Data Access Layer (DAL) Extensions

- [ ] 7. Add types for review-related data structures
  - Create `PendingReviewListing` interface in `src/dal/types.ts`
  - Create `ReviewedListing` interface extending pending review type
  - Include owner context, other listings count, rental history fields
  - Add review metadata fields (reviewedBy, reviewedAt, rejectionReason)
  - Export types for use in components
  - _Requirements: 2.5, 2.6_

- [ ] 8. Implement getPendingReviews method in ListingDAL
  - Add `getPendingReviews()` method to `src/dal/listing.dal.ts`
  - Require admin authentication using `requireAdmin()` internally
  - Query listings with `approvalStatus: pending_review`
  - Join with user table for owner information
  - Join with listingImages for all images
  - Aggregate owner's other listings count
  - Aggregate owner's rental history (total rentals, average rating)
  - Order by `createdAt` ascending (oldest first)
  - Implement pagination using existing pagination helpers
  - Return `PaginatedResult<PendingReviewListing>`
  - Handle errors using `handleError()` from BaseDAL
  - _Requirements: 2.2, 2.3, 2.5_

- [ ] 9. Implement getReviewHistory method in ListingDAL
  - Add `getReviewHistory()` method to `src/dal/listing.dal.ts`
  - Accept status parameter: "approved" | "rejected" | "all"
  - Require admin authentication
  - Query listings with specified approval status(es)
  - Include same owner context as `getPendingReviews()`
  - Join with user table for reviewer information
  - Include review metadata (reviewedBy, reviewedAt, rejectionReason)
  - Order by `reviewedAt` descending (most recent first)
  - Implement pagination
  - Return `PaginatedResult<ReviewedListing>`
  - _Requirements: 2.2, 2.4, 2.6_

- [ ] 10. Implement updateApprovalStatus method in ListingDAL
  - Add `updateApprovalStatus()` method to `src/dal/listing.dal.ts`
  - Accept listingId, status ("approved" | "rejected"), optional rejectionReason
  - Require admin authentication
  - Use database transaction with row lock (SELECT FOR UPDATE)
  - Check listing exists and is in `pending_review` status
  - Throw ValidationError if already reviewed (concurrent review handling)
  - Update `approvalStatus`, `reviewedBy` (current admin ID), `reviewedAt` (now)
  - Update `rejectionReason` if provided (for rejections)
  - Clear `rejectionReason` if approving
  - Commit transaction atomically
  - Return void or throw error
  - _Requirements: 2.9, 2.10, Reliability.1, Reliability.3_

- [ ] 11. Implement countPendingReviews method in ListingDAL
  - Add `countPendingReviews()` method to `src/dal/listing.dal.ts`
  - Require admin authentication
  - Simple COUNT query for listings with `approvalStatus: pending_review`
  - Return number
  - Optimize query for performance (use index)
  - _Requirements: 2.11_

- [ ] 12. Implement getUserListingsByApprovalStatus method in ListingDAL
  - Add `getUserListingsByApprovalStatus()` method to `src/dal/listing.dal.ts`
  - Accept userId and approvalStatus parameter
  - Query listings owned by user with specified approval status
  - Include listing images, category, basic details
  - Order by `createdAt` descending
  - Return array of `ListingDetails`
  - Used for Garage "Pending Review" tab
  - _Requirements: 4.3_

- [ ] 13. Implement hasSignificantChanges helper method in ListingDAL
  - Add private `hasSignificantChanges()` method to `src/dal/listing.dal.ts`
  - Compare old and new listing DTOs
  - Check significant fields: name, description, category, condition
  - Check pricing fields: dailyRate, weeklyRate, monthlyRate
  - Check image changes (compare image arrays by count/order)
  - Return boolean indicating if significant changes detected
  - _Requirements: 5.1, 5.2_

- [ ] 14. Enhance createListing method to set approval status
  - Verify `createListing()` in `src/dal/listing.dal.ts` sets `approvalStatus: pending_review`
  - Ensure default value from schema is applied correctly
  - Test that new listings have correct approval status
  - Document the behavior in method comments
  - _Requirements: 1.3, 1.8_

- [ ] 15. Enhance updateListing method to detect significant changes
  - Modify `updateListing()` in `src/dal/listing.dal.ts`
  - Before update, fetch current listing state
  - Call `hasSignificantChanges()` to compare old vs new
  - If significant changes AND current status is "approved":
    - Set `approvalStatus: pending_review`
    - Clear `reviewedBy`, `reviewedAt`, `rejectionReason`
  - If already `pending_review` or `rejected`, keep current status
  - Perform update with new approval status if needed
  - Return updated listing
  - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7_

- [ ] 16. Enhance searchListings method to filter by approval status
  - Modify `searchListings()` in `src/dal/listing.dal.ts`
  - Add filter: `approvalStatus = 'approved'` for public searches
  - Allow owner to see their own listings regardless of approval status
  - Allow admins to see all listings regardless of approval status
  - Check current user ID and userType before applying filter
  - Add filter to WHERE clause conditions array
  - Maintain existing performance characteristics
  - Test with various user types (owner, admin, standard user)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

### Phase 3: Server Actions

- [ ] 17. Create listing review server actions file
  - Create `src/features/admin/actions/listing-review.ts`
  - Import required dependencies (tryCatch, requireAdmin, listingDAL, etc.)
  - Set up file structure following existing admin action patterns
  - _Requirements: 8.1, 8.3, 8.4_

- [ ] 18. Implement approveListingAction server action
  - Add `approveListingAction()` function to listing-review.ts
  - Require admin authentication using `requireAdmin()`
  - Accept listingId parameter
  - Call `listingDAL.updateApprovalStatus(listingId, "approved")`
  - Get listing details for notification
  - Send approval notification to listing owner (in-app + email)
  - Use `sendNotification()` utility from notifications
  - Revalidate relevant paths (`/admin/dashboard/listings/review`, `/dashboard/garage`)
  - Return `{ success: true }` or `{ error: string }`
  - Handle errors gracefully, ensure notifications sent even if revalidation fails
  - _Requirements: 2.9, 7.1, 7.2, 7.6, 7.8, 7.9, 8.4, Reliability.2_

- [ ] 19. Implement rejectListingAction server action
  - Add `rejectListingAction()` function to listing-review.ts
  - Require admin authentication
  - Accept listingId and rejectionReason parameters
  - Validate rejectionReason is non-empty (minimum length check)
  - Call `listingDAL.updateApprovalStatus(listingId, "rejected", rejectionReason)`
  - Get listing details for notification
  - Send rejection notification with reason (in-app + email)
  - Sanitize rejectionReason before storing and displaying (XSS prevention)
  - Revalidate relevant paths
  - Return success/error state
  - _Requirements: 2.10, 6.1, 7.3, 7.4, 7.6, 7.7, Security.2_

- [ ] 20. Add validation schema for rejection reason
  - Create Zod schema for rejection reason validation
  - Minimum length: 10 characters
  - Maximum length: 1000 characters
  - Sanitize HTML/special characters
  - Export schema for reuse in components
  - _Requirements: Usability.2, Security.2_

### Phase 4: API Routes

- [ ] 21. Create pending reviews API route
  - Create `src/app/api/admin/listings/review/pending/route.ts`
  - Implement GET handler
  - Require admin authentication using `requireAdmin()`
  - Parse pagination parameters from query string (page, limit)
  - Call `listingDAL.getPendingReviews()` with pagination
  - Return JSON response with paginated results
  - Handle errors and return appropriate status codes
  - _Requirements: 2.2, 8.1, 8.4_

- [ ] 22. Create review history API route
  - Create `src/app/api/admin/listings/review/history/route.ts`
  - Implement GET handler
  - Require admin authentication
  - Parse status filter and pagination parameters
  - Call `listingDAL.getReviewHistory()` with parameters
  - Return JSON response with paginated results
  - Handle errors appropriately
  - _Requirements: 2.2, 8.1, 8.4_

- [ ] 23. Create pending review count API route
  - Create `src/app/api/admin/listings/review/count/route.ts`
  - Implement GET handler
  - Require admin authentication
  - Call `listingDAL.countPendingReviews()`
  - Return JSON with count number
  - Optimize for fast response (used in sidebar badge)
  - _Requirements: 2.11, Performance.1_

### Phase 5: Notification System

- [ ] 24. Create approval notification email template
  - Create email template function in `src/features/notifications/utils/email-templates.ts`
  - Template for listing approval notification
  - Include listing name, approval message, link to Garage
  - Use clear, friendly subject line format
  - Generate HTML and plain text versions
  - _Requirements: 7.2, 7.7_

- [ ] 25. Create rejection notification email template
  - Create email template function for listing rejection
  - Include listing name, rejection message, rejection reason
  - Include link to Garage for viewing/editing
  - Use clear subject line indicating action needed
  - Generate HTML and plain text versions
  - _Requirements: 7.4, 7.7_

- [ ] 26. Integrate notifications in approve/reject actions
  - Update `approveListingAction()` to use approval email template
  - Update `rejectListingAction()` to use rejection email template
  - Pass appropriate data to `sendNotification()` utility
  - Ensure graceful degradation if email fails (in-app notification still sent)
  - Verify notification data includes all required fields
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.9_

### Phase 6: Admin UI Components

- [ ] 27. Add Listing Review navigation item to admin sidebar
  - Edit `src/components/admin-sidebar.tsx`
  - Add new navigation item: "Listing Review"
  - Add icon (use ClipboardCheck or similar from lucide-react)
  - Set URL to `/admin/dashboard/listings/review`
  - Add badge showing pending review count (fetch via API)
  - Style badge to match existing patterns
  - _Requirements: 2.1, 2.11_

- [ ] 28. Create listing review page (server component)
  - Create `src/app/admin/dashboard/listings/review/page.tsx`
  - Require admin authentication using `requireAdmin()` guard
  - Set page metadata (title, description)
  - Render PageHeader component
  - Render ListingReviewTabs client component
  - Handle unauthorized access with redirect
  - _Requirements: 2.1, 8.1, 8.2, 8.3_

- [ ] 29. Create listing review tabs component
  - Create `src/features/admin/components/listing-review/listing-review-tabs.tsx`
  - Use shadcn/ui Tabs component
  - Create two tabs: "Pending Review" and "Review History"
  - Add badge to "Pending Review" tab showing count
  - Handle tab state with useState
  - Render appropriate content component for each tab
  - _Requirements: 2.2_

- [ ] 30. Create pending review queue component
  - Create `src/features/admin/components/listing-review/pending-review-queue.tsx`
  - Fetch pending reviews from API using React Query
  - Display listings in card/list layout
  - Show loading skeleton while fetching
  - Display empty state when no pending listings
  - Implement pagination controls
  - Render ListingReviewCard for each listing
  - _Requirements: 2.2, 2.3, 2.12_

- [ ] 31. Create review history component
  - Create `src/features/admin/components/listing-review/review-history.tsx`
  - Fetch review history from API
  - Add filter controls (approved/rejected/all)
  - Display listings with review metadata
  - Show reviewer name, review date, rejection reason if applicable
  - Implement pagination
  - Display empty state when no history
  - _Requirements: 2.2, 2.4, 2.6_

- [ ] 32. Create listing review card component
  - Create `src/features/admin/components/listing-review/listing-review-card.tsx`
  - Display full listing details (name, description, category, condition, pricing)
  - Display all listing images in order (image gallery)
  - Display owner profile section with:
    - Name, email, verification status, join date
    - Other listings count and breakdown
    - Rental history summary (total rentals, rating)
  - Display Approve and Reject action buttons
  - Open ApproveRejectDialog on button click
  - Use Card component from shadcn/ui
  - Style consistently with existing admin components
  - _Requirements: 2.5, 2.7_

- [ ] 33. Create approve/reject dialog component
  - Create `src/features/admin/components/listing-review/approve-reject-dialog.tsx`
  - Use Dialog component from shadcn/ui
  - Accept listingId and action type (approve/reject) as props
  - For approve: Simple confirmation dialog
  - For reject: Textarea for rejection reason (required, min 10 chars)
  - Display validation errors
  - Call appropriate server action on submit
  - Show loading state during submission
  - Handle success/error states
  - Close dialog and refresh queue on success
  - Use optimistic UI updates if appropriate
  - _Requirements: 2.7, 2.8, 2.9, 2.10, Usability.2_

- [ ] 34. Create hook for pending review count
  - Create `src/features/admin/hooks/use-pending-review-count.ts`
  - Use React Query to fetch count from API
  - Set appropriate stale time and cache settings
  - Return count number and loading state
  - Used by sidebar badge and review page
  - _Requirements: 2.11, Usability.4_

### Phase 7: User UI Components

- [ ] 35. Add Pending Review tab to Garage page
  - Edit `src/features/listings/components/garage-page/garage-tabs-client.tsx`
  - Add "Pending Review" TabsTrigger to TabsList
  - Add TabsContent for "pending_review" tab
  - Handle tab URL parameter (`?tab=pending_review`)
  - Clear filters when switching to pending review tab (if needed)
  - Render PendingReviewListings component in tab content
  - _Requirements: 4.1, 4.2_

- [ ] 36. Create pending review listings component
  - Create `src/features/listings/components/garage-page/pending-review-listings.tsx`
  - Fetch user's pending/rejected listings using DAL method
  - Display listings in grid/card layout (reuse existing listing card component)
  - Show approval status badges on each listing
  - Display rejection reason for rejected listings
  - Show empty state when no pending listings
  - Allow edit and delete actions on listings
  - _Requirements: 4.3, 4.4, 4.8, 4.9, 4.10_

- [ ] 37. Create approval status badge component
  - Create `src/features/listings/components/listing-status-badge.tsx`
  - Accept approvalStatus prop ("pending_review" | "approved" | "rejected")
  - Display appropriate badge with icon and text
  - Use different colors for each status (pending: yellow, approved: green, rejected: red)
  - Make badge accessible with ARIA labels
  - Export for reuse in listing cards
  - _Requirements: 4.5, Usability.3_

- [ ] 38. Enhance listing cards to show approval status
  - Locate listing card components used in Garage and other pages
  - Add ApprovalStatusBadge component to cards
  - Show badge conditionally based on listing approval status
  - For rejected listings, display rejection reason below badge
  - Ensure badges don't break existing card layouts
  - Test with various listing statuses
  - _Requirements: 4.5, 4.7, 4.8_

- [ ] 39. Add review notice to listing creation form
  - Edit `src/features/listings/components/listing-form/add-listing-form.tsx`
  - Add informational Alert or Callout component near submit button
  - Display message: "Your listing will be reviewed by an admin before being published. You'll receive a notification once it's approved."
  - Style consistently with form design
  - Use Info icon from lucide-react
  - Ensure message is visible and accessible
  - _Requirements: 3.8, 3.9_

- [ ] 40. Create dashboard widget for pending review count
  - Edit `src/app/dashboard/page.tsx`
  - Add new Card component showing pending review listings
  - Fetch count of user's pending listings
  - Display count and link to Garage page with pending_review tab
  - Show message encouraging user to check status
  - Only display if user has pending listings
  - Use consistent styling with other dashboard cards
  - _Requirements: 4.6, 4.7_

- [ ] 41. Implement hook for user's pending listings count
  - Create `src/features/listings/hooks/use-pending-listings-count.ts`
  - Query user's listings with pending_review or rejected status
  - Return count and loading state
  - Used by dashboard widget
  - Cache appropriately
  - _Requirements: 4.6_

### Phase 8: Testing

- [ ] 42. Write unit tests for DAL review methods
  - Create/update `src/dal/__tests__/listing.dal.test.ts`
  - Test `getPendingReviews()` returns correct data structure
  - Test `getReviewHistory()` with different status filters
  - Test `updateApprovalStatus()` updates all fields correctly
  - Test `updateApprovalStatus()` handles concurrent reviews (locks)
  - Test `countPendingReviews()` returns accurate count
  - Test `hasSignificantChanges()` detects changes correctly
  - Test `getUserListingsByApprovalStatus()` filters correctly
  - Test admin authentication requirements
  - Test error cases (unauthorized, not found, validation errors)
  - _Requirements: All DAL-related requirements_

- [ ] 43. Write unit tests for server actions
  - Create `src/features/admin/actions/__tests__/listing-review.test.ts`
  - Test `approveListingAction()` success flow
  - Test `approveListingAction()` sends notifications
  - Test `rejectListingAction()` success flow with validation
  - Test `rejectListingAction()` rejects empty/invalid reasons
  - Test both actions require admin authentication
  - Test error handling and state returns
  - Test path revalidation
  - Mock dependencies appropriately
  - _Requirements: 2.9, 2.10, 6.1, 7.1, 7.2, 7.3, 7.4, 8.4_

- [ ] 44. Write integration tests for review workflow
  - Create `src/features/admin/__tests__/integration/listing-review-workflow.test.ts`
  - Test: Create listing → appears in pending queue
  - Test: Admin approves → listing visible in search, owner notified
  - Test: Admin rejects → listing hidden, owner notified with reason
  - Test: Owner edits rejected listing → status returns to pending_review
  - Test: Owner resubmits → appears in queue again
  - Test: Significant edit on approved listing → triggers re-review
  - Test: Non-significant edit → no re-review
  - Test: Concurrent review attempts handled correctly
  - _Requirements: 5.1, 5.6, 6.1, 6.5, 6.6, Reliability.3_

- [ ] 45. Write integration tests for visibility filtering
  - Create `src/features/listings/__tests__/integration/approval-visibility.test.ts`
  - Test: Pending listings not visible in public search
  - Test: Rejected listings not visible in public search
  - Test: Approved listings visible in public search
  - Test: Owners can see their own listings regardless of status
  - Test: Admins can see all listings
  - Test: Search queries include approval status filter
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 46. Write E2E tests for admin review flow
  - Create `src/features/admin/__tests__/e2e/listing-review-flow.test.ts`
  - Test: Admin logs in and navigates to review page
  - Test: Admin views pending review queue
  - Test: Admin views full listing context
  - Test: Admin approves listing successfully
  - Test: Admin rejects listing with reason
  - Test: Notifications sent correctly
  - Test: Queue updates after approval/rejection
  - Test: Review history shows reviewed listings
  - _Requirements: 2.1, 2.2, 2.5, 2.7, 2.9, 2.10, 7.1, 7.2, 7.3, 7.4_

- [ ] 47. Write E2E tests for user experience
  - Create `src/features/listings/__tests__/e2e/listing-approval-user-flow.test.ts`
  - Test: User creates listing
  - Test: Listing appears in "Pending Review" tab
  - Test: User sees status badge
  - Test: User receives approval notification
  - Test: Listing appears in Active tab after approval
  - Test: User receives rejection notification with reason
  - Test: User can edit and resubmit rejected listing
  - Test: Dashboard shows pending count
  - _Requirements: 4.1, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 6.1, 6.5, 7.1, 7.3_

### Phase 9: Migration and Deployment

- [ ] 48. Test database migration in development
  - Run migration locally
  - Verify enum type created correctly
  - Verify columns added with correct types
  - Verify existing listings set to 'approved'
  - Verify indexes created
  - Test rollback migration works
  - Verify no data loss
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 49. Update seed data for testing
  - Update seed scripts if needed to include approval status
  - Create test listings with different approval statuses
  - Ensure test data supports review workflow testing
  - Verify seeds work with new schema
  - _Requirements: Testing support_

- [ ] 50. Verify backward compatibility
  - Test that existing code handles new fields gracefully
  - Verify null `approvalStatus` handled as 'approved' in queries (if any)
  - Test existing listing operations still work
  - Verify no breaking changes to API contracts
  - Test migration rollback doesn't break existing code
  - _Requirements: 9.5_
