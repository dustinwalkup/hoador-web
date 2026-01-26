# Disputes Feature - Requirements Document

## Introduction

The Disputes feature enables renters and tool owners (providers) to file and resolve disputes related to tool rentals. This system provides a structured workflow for handling disagreements, evidence collection, and financial resolution through Stripe integration. The feature ensures fair resolution processes with time-window enforcement, role-based eligibility, evidence management, and comprehensive audit trails.

The MVP implementation focuses on manual admin resolution only, supporting image and text evidence uploads. The system integrates with Stripe for financial operations (holds, refunds, deposits) and maintains compatibility with Stripe chargeback disputes. Appeals are planned as a future enhancement.

## Requirements

### Requirement 1: Dispute Creation and Eligibility

**User Story:** As a renter or provider, I want to create a dispute for a rental, so that I can seek resolution for issues that occurred during or after the rental period.

#### Acceptance Criteria

1. WHEN a user attempts to create a dispute THEN the system SHALL verify that no active dispute exists for the rental
2. IF an active dispute exists for the rental THEN the system SHALL prevent creation of a new dispute and return an error message
3. WHEN a renter creates a dispute THEN the system SHALL verify the renter is the renter associated with the rental
4. WHEN a provider creates a dispute THEN the system SHALL verify the provider is the owner associated with the rental
5. WHERE a user is not the renter or owner of the rental THEN the system SHALL prevent dispute creation and return an unauthorized error
6. WHEN creating a dispute THEN the system SHALL require:
   - Rental ID (linked to `rentals` table)
   - Dispute type (reason code from enum)
   - Initial description (text)
   - User role (renter or provider)
7. WHEN a dispute is created THEN the system SHALL set the initial state to `OPEN`
8. WHEN a dispute is created THEN the system SHALL validate time-window eligibility based on dispute type:
   - Damage disputes: SHALL be allowed within 7 days after rental end date
   - Non-delivery disputes: SHALL be allowed within 3 days after rental start date
   - Quality issues: SHALL be allowed within 7 days after rental end date
   - Cancellation disputes: SHALL be allowed within 2 days after cancellation
   - Payment issues: SHALL be allowed within 30 days after payment
   - Other: SHALL be allowed within 14 days after rental end date
9. WHERE a dispute is created outside the allowed time window THEN the system SHALL reject the dispute and return an error message indicating the time window has expired
10. WHEN a dispute is created THEN the system SHALL store the current dispute policy version identifier with the dispute record
11. WHEN a dispute is created THEN the system SHALL log the creation event in the audit trail

### Requirement 2: Dispute Reason Codes

**User Story:** As a user, I want to select from predefined dispute reason codes, so that disputes are categorized consistently for efficient resolution.

#### Acceptance Criteria

1. The system SHALL support the following dispute reason codes (enum):
   - `DAMAGE` - Tool was damaged during rental
   - `NON_DELIVERY` - Tool was not delivered as promised
   - `QUALITY_ISSUE` - Tool quality did not match description
   - `CANCELLATION` - Cancellation-related dispute
   - `PAYMENT_ISSUE` - Payment processing or refund issue
   - `OTHER` - Other dispute reason
2. WHEN creating a dispute THEN the system SHALL require selection of a reason code
3. The reason code SHALL be stored as an enum value in the database
4. The reason code SHALL be immutable after dispute creation
5. WHERE a reason code is used THEN the system SHALL apply the corresponding time-window validation rules

### Requirement 3: Dispute State Machine

**User Story:** As a system, I need to manage dispute states and transitions, so that disputes progress through a structured resolution workflow.

#### Acceptance Criteria

1. The system SHALL support the following required dispute states:
   - `OPEN` - Initial state when dispute is created
   - `EVIDENCE_REQUESTED` - Additional evidence has been requested
   - `UNDER_REVIEW` - Dispute is being reviewed by admin
   - `RESOLVED` - Dispute has been resolved with a decision
   - `CLOSED` - Dispute is closed (final state)
2. The system MAY support the following optional states (future enhancements):
   - `ESCALATED` - Dispute has been escalated for higher-level review
   - `APPEALED` - Dispute resolution has been appealed (future enhancement)
3. WHEN a dispute state changes THEN the system SHALL validate the transition is allowed based on the current state
4. The system SHALL enforce the following state transition rules:
   - `OPEN` → `EVIDENCE_REQUESTED` (admin action)
   - `OPEN` → `UNDER_REVIEW` (admin action)
   - `OPEN` → `RESOLVED` (admin action)
   - `EVIDENCE_REQUESTED` → `UNDER_REVIEW` (automatic after evidence deadline or admin action)
   - `EVIDENCE_REQUESTED` → `RESOLVED` (admin action)
   - `UNDER_REVIEW` → `RESOLVED` (admin action)
   - `UNDER_REVIEW` → `ESCALATED` (admin action, if supported)
   - `RESOLVED` → `CLOSED` (admin action or automatic after resolution)
   - `ESCALATED` → `UNDER_REVIEW` (admin action, if supported)
5. WHERE an invalid state transition is attempted THEN the system SHALL reject the transition and return an error
6. All state transitions SHALL be validated server-side only
7. WHEN a state transition occurs THEN the system SHALL log the transition in the audit trail with:
   - Previous state
   - New state
   - Timestamp
   - User who initiated the transition
   - Reason for transition (if provided)
8. The state field SHALL be stored as an enum in the database
9. WHERE a dispute reaches `RESOLVED` or `CLOSED` state THEN the system SHALL prevent further state changes (immutable final resolution)

### Requirement 4: Evidence Management

**User Story:** As a user, I want to upload evidence (images and text) to support my dispute, so that I can provide documentation for my claim.

#### Acceptance Criteria

1. WHEN a dispute is in `OPEN` or `EVIDENCE_REQUESTED` state THEN users (renter or provider) SHALL be able to upload evidence
2. WHERE a dispute is in `RESOLVED` or `CLOSED` state THEN the system SHALL prevent new evidence uploads (read-only)
3. The system SHALL support the following evidence types:
   - Images (JPEG, PNG, WebP)
   - Text descriptions
4. WHEN uploading an image THEN the system SHALL:
   - Validate file type (JPEG, PNG, WebP only)
   - Validate file size (maximum 10MB per image)
   - Process and optimize the image (similar to listing image processing)
   - Store the image in Vercel Blob storage
   - Generate a unique filename with timestamp
5. Each evidence entry SHALL include:
   - Evidence ID (UUID)
   - Dispute ID (foreign key)
   - User ID (who uploaded the evidence)
   - Evidence type (image or text)
   - Content (image URL or text content)
   - Upload timestamp
   - User attribution (renter or provider role)
6. WHEN evidence is uploaded THEN the system SHALL store the evidence record in the database
7. The system SHALL enforce evidence upload deadlines:
   - Initial evidence: 7 days after dispute creation
   - Additional evidence (after `EVIDENCE_REQUESTED`): 3 days after request
8. WHERE the evidence deadline has passed THEN the system SHALL prevent new evidence uploads and display a deadline expired message
9. WHEN evidence deadline expires THEN the system SHALL automatically transition dispute from `EVIDENCE_REQUESTED` to `UNDER_REVIEW` if no evidence was submitted
10. The system SHALL display all evidence entries with:
    - Upload timestamp
    - User who uploaded (name and role)
    - Evidence content (images displayed, text shown)
11. WHERE evidence is an image THEN the system SHALL display it in a viewable format (thumbnail with full-size view)
12. Evidence SHALL be retained permanently for audit and compliance purposes
13. WHEN listing evidence THEN the system SHALL order by upload timestamp (oldest first)

### Requirement 5: Admin-Only Internal Notes

**User Story:** As an admin, I want to add internal notes to disputes that are not visible to users, so that I can document my review process and decision rationale.

#### Acceptance Criteria

1. WHERE a user has admin or superadmin privileges THEN the system SHALL allow creation of internal notes
2. Internal notes SHALL only be visible to admin and superadmin users
3. Internal notes SHALL not be visible to renters or providers
4. WHEN creating an internal note THEN the system SHALL require:
   - Dispute ID
   - Note content (text)
   - Admin user ID (automatically captured)
   - Timestamp (automatically captured)
5. Internal notes SHALL be stored in a separate table with foreign key to disputes
6. WHEN displaying dispute details to admins THEN the system SHALL show internal notes in a separate section
7. Internal notes SHALL be ordered by timestamp (newest first)
8. Internal notes SHALL be editable and deletable by admins
9. WHEN an internal note is created, edited, or deleted THEN the system SHALL log the action in the audit trail

### Requirement 6: Stripe Financial Integration

**User Story:** As an admin, I want to perform financial operations (holds, refunds, deposits) through Stripe when resolving disputes, so that financial resolutions are properly executed.

#### Acceptance Criteria

1. WHEN resolving a dispute THEN the system SHALL allow admins to perform the following financial operations:
   - Hold payouts (prevent payout to provider)
   - Issue partial refunds (refund portion of payment to renter)
   - Issue full refunds (refund entire payment to renter)
   - Apply security deposits (capture security deposit for provider)
2. The system SHALL link disputes to Stripe objects:
   - PaymentIntent ID (from rental payment)
   - Transfer ID(s) (if payouts were made to provider)
   - Refund ID(s) (if refunds were issued)
3. WHEN performing a financial operation THEN the system SHALL:
   - Store the Stripe operation ID (refund ID, transfer ID, etc.)
   - Store the operation type (hold, refund, deposit)
   - Store the operation amount
   - Store the operation timestamp
   - Link the operation to the dispute record
4. Stripe metadata SHALL include:
   - `bookingId` (rental ID)
   - `disputeId` (dispute ID)
   - `operationType` (hold, refund, deposit)
5. WHEN creating a refund THEN the system SHALL:
   - Call Stripe API to create the refund
   - Store the refund ID in the dispute financial operations record
   - Update the payment record with refund information
6. WHEN holding a payout THEN the system SHALL:
   - Prevent future payouts for the associated payment
   - Store the hold reason and timestamp
7. WHEN applying a security deposit THEN the system SHALL:
   - Capture the security deposit authorization through Stripe
   - Store the capture ID in the dispute financial operations record
8. WHERE a Stripe operation fails THEN the system SHALL:
   - Log the error
   - Display an error message to the admin
   - Prevent state transition to `RESOLVED` until operation succeeds
9. All financial operations SHALL be logged in the audit trail with:
   - Operation type
   - Amount
   - Stripe operation ID
   - Timestamp
   - Admin user who initiated the operation
10. Financial operations SHALL be immutable after dispute is resolved (no modifications allowed)

### Requirement 7: Admin Resolution Actions

**User Story:** As an admin, I want to resolve disputes by selecting an outcome and reason, so that disputes are closed with clear decisions.

#### Acceptance Criteria

1. WHERE a user has admin or superadmin privileges THEN the system SHALL allow resolution of disputes
2. WHEN resolving a dispute THEN the system SHALL require:
   - Resolution outcome (enum: `FAVOR_RENTER`, `FAVOR_PROVIDER`, `PARTIAL_RENTER`, `PARTIAL_PROVIDER`, `DISMISSED`)
   - Resolution reason (text description)
   - Financial operations (if applicable)
3. WHEN an admin selects a resolution outcome THEN the system SHALL:
   - Update dispute state to `RESOLVED`
   - Store resolution outcome and reason
   - Store resolution timestamp
   - Store admin user ID who resolved the dispute
   - Trigger any required financial operations through Stripe
4. WHERE financial operations are required THEN the system SHALL execute them before marking dispute as resolved
5. WHEN a dispute is resolved THEN the system SHALL:
   - Send notifications to both renter and provider
   - Log the resolution in the audit trail
   - Make the resolution immutable (no further changes allowed)
6. The resolution outcome SHALL be stored as an enum in the database
7. Resolution reason SHALL be stored as text (maximum 1000 characters)
8. WHERE a dispute is resolved THEN the system SHALL prevent further evidence uploads
9. Resolution information SHALL be visible to both renter and provider
10. WHERE a dispute is resolved THEN the system SHALL allow admins to transition to `CLOSED` state

### Requirement 8: Audit Trail and Compliance

**User Story:** As a system, I need to maintain a complete audit trail of all dispute actions, so that we can track changes and ensure compliance.

#### Acceptance Criteria

1. The system SHALL log all state changes with:
   - Previous state
   - New state
   - Timestamp
   - User ID who initiated the change
   - Reason (if provided)
2. The system SHALL log all financial operations with:
   - Operation type
   - Amount
   - Stripe operation ID
   - Timestamp
   - Admin user ID
   - Success/failure status
3. The system SHALL log all evidence uploads with:
   - Evidence ID
   - User ID
   - Upload timestamp
   - Evidence type
4. The system SHALL log all admin actions (resolution, notes, state changes) with:
   - Action type
   - Admin user ID
   - Timestamp
   - Details
5. Audit logs SHALL be stored in a separate audit table
6. Audit logs SHALL be immutable (no updates or deletions allowed)
7. Audit logs SHALL be retained permanently for compliance
8. The system SHALL store the dispute policy version identifier with each dispute at creation time
9. WHERE policy versions change THEN the system SHALL continue to reference the version that was active when the dispute was created
10. Audit logs SHALL be queryable by:
    - Dispute ID
    - User ID
    - Date range
    - Action type

### Requirement 9: Abuse Prevention and Rate Limiting

**User Story:** As a system, I need to prevent abuse of the dispute system, so that users cannot file excessive or fraudulent disputes.

#### Acceptance Criteria

1. The system SHALL enforce dispute rate limits per user:
   - Maximum 3 disputes per month per user
   - Maximum 10 disputes per year per user
2. WHEN a user attempts to create a dispute THEN the system SHALL check rate limits
3. WHERE rate limits are exceeded THEN the system SHALL prevent dispute creation and return an error message
4. The system SHALL track dispute patterns per user:
   - Total disputes filed
   - Disputes resolved in user's favor
   - Disputes resolved against user
   - Recent dispute frequency
5. WHERE a user shows patterns of abuse THEN the system SHALL:
   - Log warning events
   - Allow admins to review user dispute history
   - Support enforcement actions (warnings, suspensions)
6. The system SHALL provide admin tools to:
   - View user dispute history
   - View dispute patterns
   - Issue warnings
   - Suspend dispute filing privileges (future enhancement)
7. FOR MVP: Rate limit checks SHALL be calculated on-the-fly by querying dispute records:
   - Count disputes created by user in current month
   - Count disputes created by user in current year
   - Compare against limits (3/month, 10/year)
8. Rate limits SHALL reset at the start of each month (monthly limit) and year (yearly limit)
9. WHERE a dispute is dismissed as fraudulent THEN the system SHALL count it toward rate limits

### Requirement 10: Stripe Chargeback Compatibility

**User Story:** As a system, I need to support Stripe chargeback disputes and link them to internal disputes, so that we can manage both types of disputes consistently.

#### Acceptance Criteria

1. The system SHALL support linking Stripe chargeback disputes to internal disputes
2. WHEN a Stripe chargeback occurs THEN the system SHALL allow admins to:
   - Link the chargeback to an existing internal dispute
   - Create a new internal dispute from a chargeback
   - Export evidence bundle for Stripe chargeback response
3. The system SHALL store Stripe chargeback dispute ID when linked to an internal dispute
4. WHEN exporting evidence for Stripe chargeback THEN the system SHALL generate a bundle containing:
   - All evidence images (formatted for Stripe requirements)
   - Evidence descriptions
   - Dispute timeline
   - Resolution information
5. The system SHALL preserve internal dispute resolution records even when linked to Stripe chargebacks
6. WHERE a Stripe chargeback is linked to an internal dispute THEN the system SHALL display the chargeback ID in the dispute record
7. Internal dispute records SHALL remain independent and searchable regardless of Stripe chargeback linkage

### Requirement 11: User Interface and Notifications

**User Story:** As a user, I want to see dispute information in the booking/rental UI and receive notifications, so that I am aware of dispute status and deadlines.

#### Acceptance Criteria

1. WHERE a rental has an active dispute THEN the rental/booking UI SHALL display dispute status
2. The booking UI SHALL show:
   - Dispute status badge (OPEN, UNDER_REVIEW, RESOLVED, etc.)
   - Link to view dispute details
   - Current deadline (if applicable)
3. WHEN displaying dispute deadlines THEN the system SHALL show:
   - Evidence submission deadline (if in OPEN or EVIDENCE_REQUESTED state)
   - Time remaining until deadline
4. The system SHALL send in-app notifications for:
   - Dispute created (to both parties)
   - Evidence requested (to party who needs to submit)
   - Evidence deadline approaching (24 hours before)
   - Evidence deadline expired
   - Dispute resolved (to both parties)
5. WHERE email notifications are enabled THEN the system SHALL send email notifications for critical events (optional, future enhancement)
6. Notifications SHALL include:
   - Dispute ID
   - Rental information
   - Action required (if any)
   - Deadline information (if applicable)
7. The system SHALL provide a disputes list page where users can:
   - View all their disputes (as renter or provider)
   - Filter by status
   - Sort by date
   - View dispute details
8. The disputes list SHALL show:
   - Dispute ID
   - Rental/booking information
   - Status
   - Created date
   - Last updated date
   - Deadline (if applicable)

### Requirement 12: Dispute Details View

**User Story:** As a user, I want to view complete dispute details including evidence, timeline, and resolution, so that I can understand the dispute status and history.

#### Acceptance Criteria

1. The system SHALL provide a dispute details page/view accessible to:
   - Renter (if they are the renter)
   - Provider (if they are the provider)
   - Admins (all disputes)
2. The dispute details view SHALL display:
   - Dispute ID
   - Rental information (listing name, dates, amount)
   - Dispute type (reason code)
   - Current status
   - Created date and time
   - Created by (renter or provider)
   - Description
   - All evidence (images and text) with upload timestamps and attribution
   - State transition history (timeline)
   - Resolution information (if resolved)
   - Financial operations (if any)
   - Current deadlines
3. WHERE the user is an admin THEN the dispute details view SHALL also display:
   - Internal notes section
   - Admin action buttons (resolve, request evidence, change state)
   - Financial operation controls
4. Evidence SHALL be displayed with:
   - Upload timestamp
   - User who uploaded (name and role)
   - Image thumbnails (clickable for full size)
   - Text content (formatted)
5. The timeline SHALL show all state transitions in chronological order with:
   - State change
   - Timestamp
   - User who initiated (if applicable)
   - Reason (if provided)
6. WHERE a dispute is resolved THEN the resolution section SHALL show:
   - Resolution outcome
   - Resolution reason
   - Resolved by (admin name)
   - Resolution timestamp
   - Financial operations performed
7. The dispute details view SHALL be read-only for users (except evidence upload when allowed)
8. Admins SHALL be able to perform actions from the dispute details view

## Non-Functional Requirements

### Performance

1. Dispute creation SHALL complete within 2 seconds
2. Evidence upload SHALL complete within 5 seconds for images up to 10MB
3. Dispute list page SHALL load within 2 seconds with pagination
4. Dispute details page SHALL load within 3 seconds
5. State transitions SHALL complete within 1 second
6. Financial operations through Stripe SHALL complete within 10 seconds (network dependent)
7. The system SHALL support pagination for disputes lists (20 items per page)
8. Evidence images SHALL be optimized and served with appropriate caching headers

### Reliability

1. WHERE Stripe API calls fail THEN the system SHALL:
   - Retry transient failures (3 attempts with exponential backoff)
   - Log errors for investigation
   - Display user-friendly error messages
   - Prevent state transitions until operations succeed
2. Evidence uploads SHALL be idempotent (safe to retry)
3. State transitions SHALL be atomic (all-or-nothing)
4. WHERE database operations fail THEN the system SHALL roll back transactions
5. The system SHALL handle concurrent dispute creation attempts gracefully
6. Rate limit checks SHALL be calculated on-the-fly from dispute records (MVP approach)

### Security

1. Dispute creation SHALL require authentication
2. Users SHALL only be able to view disputes where they are the renter or provider
3. Admins SHALL be able to view all disputes
4. State transitions SHALL be validated server-side only
5. Financial operations SHALL only be performable by admins
6. Evidence uploads SHALL be validated for file type and size server-side
7. Internal notes SHALL only be accessible to admins
8. All API endpoints SHALL require proper authentication
9. Stripe API keys SHALL never be exposed to the client
10. Audit logs SHALL be protected from tampering (immutable)

### Usability

1. Dispute creation form SHALL be intuitive and require minimal training
2. Error messages SHALL be clear and actionable
3. Deadlines SHALL be displayed prominently with time remaining
4. Evidence upload SHALL support drag-and-drop interface
5. The system SHALL provide clear status indicators (badges, colors)
6. Mobile devices SHALL be supported with responsive design
7. Loading states SHALL provide feedback during operations
8. Confirmation dialogs SHALL be shown for destructive actions (if applicable)

### Scalability

1. The system SHALL support at least 1000 disputes per month
2. Evidence storage SHALL scale with dispute volume
3. Audit logs SHALL be queryable efficiently with proper indexing
4. Rate limit checks SHALL perform efficiently with database indexes on dispute creation date and user ID
5. Dispute lists SHALL support pagination to handle large datasets

## Assumptions

1. Disputes are linked to `rentals` (approved rental requests), not `rental_requests`
2. A dispute policy document exists and has version identifiers
3. Stripe Connect accounts are set up for providers (owners)
4. Users understand the dispute process and time windows
5. Admins are trained on dispute resolution procedures
6. Evidence uploads use Vercel Blob storage (existing infrastructure)
7. Image processing follows existing patterns (listing image processing)
8. Notifications use the existing notification system
9. The system will integrate with existing rental and payment systems
10. Time windows are calculated based on rental dates (start date, end date)

## Constraints

1. MVP implementation: Manual admin resolution only (no automated resolution)
2. MVP implementation: No user-to-user dispute chat (evidence upload only)
3. MVP implementation: No appeals (appeals are future enhancement)
4. MVP implementation: Images and text only (no video or other file types)
5. MVP implementation: No automation beyond timeouts (deadline enforcement)
6. State transitions must be validated server-side (cannot be trusted from client)
7. Financial operations require Stripe API integration
8. Evidence must be retained permanently for compliance
9. Dispute policy version must be captured at dispute creation time
10. Rate limits are enforced per user (not per rental)

## Edge Cases

1. **Rental deleted**: If a rental is deleted, existing disputes should be preserved (soft delete or prevent rental deletion if dispute exists)
2. **User account deleted**: If a user account is deleted, disputes should be preserved with user ID reference
3. **Concurrent dispute creation**: If renter and provider both try to create disputes simultaneously, system should handle gracefully (first one wins, second gets error)
4. **Evidence deadline at midnight**: Timezone handling for deadline calculations
5. **Stripe API timeout**: If Stripe API times out during financial operation, system should retry and maintain transaction state
6. **Large evidence uploads**: Multiple large images uploaded simultaneously should be handled efficiently
7. **Rate limit reset timing**: Monthly/yearly rate limit calculation based on current date (timezone handling for month/year boundaries)
8. **Dispute created exactly at time window boundary**: System should handle boundary conditions (inclusive/exclusive)
9. **Admin resolves dispute while evidence is being uploaded**: System should handle concurrent operations
10. **Stripe chargeback occurs after internal dispute is resolved**: System should support linking and preserve both records
11. **Policy version changes during dispute creation**: System should capture version at moment of creation

## Out of Scope (Future Enhancements)

1. **Automated Resolution**: AI-powered or rule-based automated dispute resolution
2. **User-to-User Chat**: Direct messaging between renter and provider within dispute
3. **Appeals**: Appeal process for dispute resolutions (single or multiple appeals)
4. **Video Evidence**: Support for video file uploads
5. **Document Evidence**: Support for PDF or other document uploads
6. **Automated Deadlines**: Automated actions beyond timeout enforcement
7. **Dispute Templates**: Pre-filled dispute forms based on common scenarios
8. **Bulk Dispute Operations**: Admin tools for bulk actions on multiple disputes
9. **Advanced Analytics**: Dispute analytics dashboard with trends and patterns
10. **Third-Party Mediation**: Integration with external mediation services
11. **Dispute Prevention**: Proactive tools to prevent disputes (future feature)
12. **Multi-language Support**: Dispute interface in multiple languages
13. **SMS Notifications**: SMS alerts for critical dispute events
14. **Dispute Escalation Workflows**: Complex escalation paths with appeals
15. **Rate Limit Tracking Table**: Dedicated table for storing rate limit counts per user (improves performance for high-volume scenarios)

## Success Criteria

1. Users can create disputes for rentals within allowed time windows
2. Only one active dispute exists per rental at a time
3. Role-based eligibility is enforced (renter or provider only)
4. Time-window enforcement prevents disputes outside allowed periods
5. Evidence can be uploaded with deadlines enforced
6. Disputes progress through state machine with validated transitions
7. Admins can resolve disputes with financial operations through Stripe
8. Audit trail captures all dispute actions and changes
9. Rate limiting prevents abuse of the dispute system
10. Stripe chargebacks can be linked to internal disputes
11. Users receive notifications for dispute events
12. Booking UI reflects dispute status
13. Evidence is retained permanently for compliance
14. Policy version is stored with each dispute
15. MVP features (manual resolution, images/text only, no appeals) are functional
