# Listing Review Requirements

## Introduction

This document defines the requirements for implementing an admin review process for listings before they are published to the Hoador platform. All new listings and significant edits must be reviewed and approved by an admin before becoming visible to users in public search results. This feature ensures content quality, platform safety, and compliance with community guidelines.

The implementation will add an approval workflow that requires admin review, provides visibility into pending listings for both admins and listing owners, and enables notifications when listings are approved or rejected. Existing listings will be grandfathered in as approved.

## Requirements

### Requirement 1: Database Schema Extensions

**User Story:** As a system, I need to track listing approval status and review history, so that we can enforce the review process and maintain an audit trail.

#### Acceptance Criteria

1. The system SHALL add a new `approvalStatusEnum` with values: `pending_review`, `approved`, `rejected`
2. The system SHALL add an `approvalStatus` field to the listings table using the `approvalStatusEnum`
3. The system SHALL default new listings to `approvalStatus: pending_review`
4. The system SHALL add a `rejectionReason` text field to the listings table for admin feedback
5. The system SHALL add a `reviewedBy` text field referencing the admin user ID who performed the review
6. The system SHALL add a `reviewedAt` timestamp field to record when the review was completed
7. The system SHALL add an index on `approvalStatus` for efficient querying
8. WHEN a listing is created THEN the system SHALL set `approvalStatus` to `pending_review` and leave `reviewedBy` and `reviewedAt` as null
9. WHEN existing listings are migrated THEN the system SHALL set their `approvalStatus` to `approved` to grandfather them in
10. The system SHALL allow `rejectionReason` to be null (not required for approved listings)

### Requirement 2: Admin Review Panel

**User Story:** As an admin, I want to review pending listings with full context and see review history, so that I can make informed approval decisions efficiently and track past reviews.

#### Acceptance Criteria

1. The system SHALL add a new "Listing Review" navigation item to the admin sidebar ([admin-sidebar.tsx](src/components/admin-sidebar.tsx))
2. WHEN an admin navigates to the Listing Review page THEN the system SHALL display tabs or sections for:
   - Pending Review queue (listings with `approvalStatus: pending_review`)
   - Review History (listings with `approvalStatus: approved` or `rejected`)
3. The system SHALL display pending listings ordered by `createdAt` (oldest first) to ensure timely reviews
4. The system SHALL display review history ordered by `reviewedAt` (most recent first) for approved and rejected listings
5. The system SHALL display the following information for each listing in the review queue:
   - Listing details (name, description, category, condition, pricing, delivery options)
   - All listing images in order
   - Owner profile information (name, email, verification status, join date)
   - Owner's other listings (count and status)
   - Owner's rental history (total rentals, rating)
6. The system SHALL display the following information for each listing in review history:
   - All information from the review queue (as above)
   - Review decision (approved/rejected)
   - Rejection reason (if rejected)
   - Reviewer name/ID
   - Review timestamp
   - Current listing status
7. The system SHALL provide "Approve" and "Reject" action buttons for pending listings
8. WHEN an admin clicks "Reject" THEN the system SHALL require a rejection reason before submission
9. WHEN an admin clicks "Approve" THEN the system SHALL update the listing's `approvalStatus` to `approved`, set `reviewedBy` to the admin's user ID, and set `reviewedAt` to the current timestamp
10. WHEN an admin clicks "Reject" with a reason THEN the system SHALL update the listing's `approvalStatus` to `rejected`, set `rejectionReason`, set `reviewedBy` to the admin's user ID, and set `reviewedAt` to the current timestamp
11. The system SHALL display the total count of pending reviews in the admin sidebar navigation item
12. WHERE there are no pending listings THEN the system SHALL display an empty state message
13. The system SHALL allow admins to filter or search the review queue and history (optional enhancement for future)

### Requirement 3: Listing Visibility Control

**User Story:** As a listing owner, I want my listing to only be visible after admin approval, so that only quality content appears on the platform. As a user, I want to be informed that listings undergo review before publication.

#### Acceptance Criteria

1. WHEN a listing has `approvalStatus: pending_review` THEN the system SHALL NOT display it in public search results or explore pages
2. WHEN a listing has `approvalStatus: rejected` THEN the system SHALL NOT display it in public search results or explore pages
3. WHERE a listing has `approvalStatus: approved` THEN the system SHALL display it in public search results and explore pages, regardless of the listing's `status` field (available, rented, maintenance, or inactive)
4. The system SHALL require `approvalStatus: approved` for a listing to appear in public search results or explore pages, regardless of other status filters
5. WHERE listing queries are performed for public search or explore THEN the system SHALL filter by `approvalStatus: approved` in addition to any existing status filters (available/rented), unless the requester is the owner or an admin
6. The system SHALL allow listing owners to view their own listings regardless of approval status
7. The system SHALL allow admins to view all listings regardless of approval status
8. The system SHALL display informational text on the listing creation form ([add-listing-form.tsx](src/features/listings/components/listing-form/add-listing-form.tsx)) informing users that their listing will undergo admin review before being published to the platform
9. The informational text SHALL be displayed near the submit button or in a prominent location on the form, explaining that listings require approval before appearing in search results

### Requirement 4: User-Facing Listing Status Visibility

**User Story:** As a listing owner, I want to see the approval status of my listings, so that I know when they'll be visible on the platform and can take action on rejected listings.

#### Acceptance Criteria

1. The system SHALL add a "Pending Review" tab/filter to the Garage page ([garage-tabs-client.tsx](src/features/listings/components/garage-page/garage-tabs-client.tsx))
2. WHEN a user views the Garage page THEN the system SHALL display a "Pending Review" tab in addition to existing "Active" and "Inactive" tabs
3. WHEN a user clicks the "Pending Review" tab THEN the system SHALL display all listings owned by the user with `approvalStatus: pending_review` or `rejected`
4. WHERE rejected listings are displayed THEN the system SHALL show them in the "Pending Review" tab of the Garage page, clearly labeled as rejected with the rejection reason visible
5. The system SHALL display visual badges on listing cards indicating their approval status:
   - "Pending Review" badge for `pending_review` listings
   - "Rejected" badge with reason display for `rejected` listings
   - "Approved" badge (or no badge) for `approved` listings
6. The system SHALL display pending listings count on the main dashboard page ([dashboard/page.tsx](src/app/dashboard/page.tsx))
7. WHEN a user has listings pending review THEN the system SHALL show a card or section on the dashboard indicating the count and linking to the Garage page
8. The system SHALL show rejection reasons when displaying rejected listings to the owner in the Garage "Pending Review" tab
9. WHERE a listing is rejected THEN the system SHALL allow the owner to see the rejection reason and take action (edit or delete) from the Garage page
10. Rejected listings SHALL remain in the "Pending Review" tab until the owner edits and resubmits them or deletes them

### Requirement 5: Listing Edit Re-Review Process

**User Story:** As an admin, I want significant listing edits to require re-review, so that changes maintain content quality standards.

#### Acceptance Criteria

1. WHEN a user edits a listing field considered "significant" THEN the system SHALL set `approvalStatus` back to `pending_review`
2. The following fields SHALL be considered "significant" edits requiring re-review:
   - Listing name
   - Description
   - Daily rate, weekly rate, monthly rate (any price changes)
   - Listing images (adding, removing, or reordering)
   - Category
   - Condition
3. The following fields SHALL NOT trigger re-review (can be edited without re-approval):
   - Availability calendar updates
   - Listing status (available/rented/maintenance/inactive) when already approved
   - Delivery radius (within limits)
   - Instructions and safety notes (minor text updates)
   - Setup availability toggle
4. WHEN a significant edit triggers re-review THEN the system SHALL clear the `reviewedBy` and `reviewedAt` fields
5. WHEN a significant edit triggers re-review THEN the system SHALL clear any existing `rejectionReason`
6. WHEN an approved listing receives a significant edit THEN the system SHALL set `approvalStatus: pending_review` and the listing SHALL become hidden from public search until re-approved
7. WHERE a listing is currently `pending_review` or `rejected` THEN significant edits SHALL keep it in the current state (no state change needed)

### Requirement 6: Rejection and Resubmission Workflow

**User Story:** As a listing owner, I want to understand why my listing was rejected and be able to fix and resubmit it, so that I can get my listing approved.

#### Acceptance Criteria

1. WHEN an admin rejects a listing THEN the system SHALL require a rejection reason (non-empty text)
2. The system SHALL display the rejection reason to the listing owner in their Garage view
3. WHERE a listing is rejected THEN the owner SHALL be able to edit the listing
4. WHERE a listing is rejected THEN the owner SHALL be able to delete the listing
5. WHEN an owner edits a rejected listing AND saves changes THEN the system SHALL set `approvalStatus: pending_review` (triggering re-review)
6. The system SHALL clear the `rejectionReason` when a listing is edited and resubmitted
7. The system SHALL allow owners to resubmit rejected listings for review after making changes

### Requirement 7: Approval and Rejection Notifications

**User Story:** As a listing owner, I want to be notified when my listing is approved or rejected, so that I'm aware of status changes without checking manually.

#### Acceptance Criteria

1. WHEN an admin approves a listing THEN the system SHALL create an in-app notification for the listing owner
2. WHEN an admin approves a listing THEN the system SHALL send an email notification to the listing owner
3. WHEN an admin rejects a listing THEN the system SHALL create an in-app notification for the listing owner including the rejection reason
4. WHEN an admin rejects a listing THEN the system SHALL send an email notification to the listing owner including the rejection reason
5. The system SHALL add new notification types to `notificationTypeEnum`: `listing_approved` and `listing_rejected`
6. Notifications SHALL include:
   - Listing name
   - Approval/rejection status
   - Rejection reason (for rejections)
   - Link to view the listing in the Garage
7. Email notifications SHALL be formatted with clear subject lines (e.g., "Your listing '[Name]' has been approved" or "Your listing '[Name]' needs changes")
8. The system SHALL use the existing notification system ([send-notification.ts](src/features/notifications/utils/send-notification.ts)) for creating notifications
9. WHERE email sending fails THEN the system SHALL still create the in-app notification (graceful degradation)

### Requirement 8: Admin Access and Permissions

**User Story:** As a system, I want to ensure only admins can review listings, so that unauthorized users cannot approve content.

#### Acceptance Criteria

1. The system SHALL restrict access to the Listing Review page to users with `userType: admin` or `userType: superadmin`
2. WHERE a non-admin user attempts to access the Listing Review page THEN the system SHALL redirect them to an unauthorized page or the admin login
3. The system SHALL use the existing `requireAdmin()` guard ([guards.ts](src/features/auth/utils/guards.ts)) for the Listing Review page
4. WHERE approval/rejection actions are performed THEN the system SHALL verify the requester has admin privileges
5. The system SHALL log all approval and rejection actions for audit purposes

### Requirement 9: Data Migration for Existing Listings

**User Story:** As a system, I want existing listings to be automatically approved, so that the review process only applies to new listings going forward.

#### Acceptance Criteria

1. WHEN the database migration runs THEN the system SHALL add the new `approvalStatus`, `rejectionReason`, `reviewedBy`, and `reviewedAt` columns to the listings table
2. WHERE `approvalStatus` is null (existing listings) THEN the migration SHALL set it to `approved`
3. The system SHALL ensure all existing listings are marked as `approved` during migration
4. The migration SHALL be reversible (rollback-safe)
5. WHERE listings exist with null `approvalStatus` after migration THEN the system SHALL treat them as `approved` for backward compatibility

## Non-Functional Requirements

### Performance

1. The review queue SHALL load within 2 seconds for up to 100 pending listings
2. Listing approval/rejection actions SHALL complete within 1 second
3. Public listing queries SHALL maintain current performance after adding `approvalStatus` filtering
4. The system SHALL use database indexes to optimize approval status queries

### Reliability

1. Approval/rejection actions SHALL be atomic (all-or-nothing database transactions)
2. WHERE notification sending fails THEN the approval/rejection action SHALL still succeed
3. The system SHALL handle concurrent approval attempts gracefully (prevent duplicate approvals)
4. The system SHALL validate admin permissions before processing approval/rejection actions

### Security

1. The system SHALL verify admin authentication before allowing approval/rejection actions
2. Rejection reasons SHALL be sanitized to prevent XSS attacks when displayed
3. The system SHALL prevent non-admins from accessing approval status fields via API
4. Admin actions SHALL be logged for audit trail purposes

### Usability

1. The admin review interface SHALL display all necessary information without scrolling (or with clear section breaks)
2. Rejection reason input SHALL have a minimum character requirement (e.g., 10 characters) to ensure helpful feedback
3. Listing status badges SHALL use clear, accessible colors and icons
4. The pending review count SHALL update in real-time after admin actions

## Assumptions

1. Admins will review listings within a reasonable timeframe (24-48 hours expected)
2. Users understand that listings require approval before being visible
3. The existing notification system supports the required notification types
4. Existing admin authentication and authorization mechanisms are sufficient
5. Database migrations can be run during deployment windows
6. The platform can handle the additional database columns and indexes without performance degradation
7. Email service (Resend) is available and functional for sending approval/rejection emails

## Constraints

1. Approval status must not conflict with existing listing status values (available, rented, maintenance, inactive)
2. Existing listing queries must be updated to filter by approval status without breaking current functionality
3. Notification types must be added to the database enum, requiring a migration
4. The review process adds latency between listing creation and public visibility
5. Admin review actions require database transactions to maintain data consistency
6. Rejection reasons are stored as plain text (no rich text formatting initially)

## Edge Cases

1. **Concurrent Reviews**: If two admins attempt to review the same listing simultaneously, the first action succeeds and the second should show an error or updated state
2. **Deleted Owner**: If a listing owner's account is deleted, rejected listings should still be processable by admins (orphaned listings)
3. **Notification Failure**: If email service is down, in-app notifications should still be created successfully
4. **Migration Rollback**: If migration needs to be rolled back, the system should handle null `approvalStatus` values gracefully
5. **Multiple Rejections**: A listing can be rejected multiple times if the owner resubmits without fixing issues - each rejection overwrites the previous reason
6. **Edit During Review**: If an owner edits a listing while it's pending review, the edit should update the listing and keep it in `pending_review` status
7. **Admin Deletion**: If an admin who reviewed a listing is deleted, the `reviewedBy` field may reference a non-existent user - this should not break functionality
8. **Empty Review Queue**: When no listings are pending, the admin interface should clearly communicate this state

## Out of Scope (Future Enhancements)

1. Bulk approval/rejection actions (approving multiple listings at once)
2. Admin assignment or routing (assigning specific admins to specific listings)
3. Review priority or SLA tracking (time-to-review metrics)
4. Listing revision history (tracking what changed between reviews)
5. Auto-approval rules based on owner trust score or listing criteria
6. Review comments or notes separate from rejection reasons
7. Escalation workflow for disputed rejections
8. Review templates or pre-filled rejection reasons
9. Admin review analytics dashboard
10. Notification preferences for listing owners (opt-out options)

## Success Criteria

1. All new listings require admin approval before appearing in public search
2. Admins can efficiently review pending listings with full context
3. Listing owners receive timely notifications when listings are approved or rejected
4. Existing listings continue to function normally (grandfathered as approved)
5. Listing edits trigger re-review for significant changes
6. The review process does not significantly impact listing creation performance
7. Admin review interface is intuitive and contains all necessary information
8. Users can clearly see the approval status of their listings
9. Rejection workflow allows owners to understand issues and resubmit
10. No security vulnerabilities are introduced through the approval process
