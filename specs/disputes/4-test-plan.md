# Disputes Feature - Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/disputes/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Dispute Creation and Eligibility

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 1

**Test Coverage**:

- Unit tests: DisputeDAL.create() method with valid data
- Unit tests: getActiveByRentalId() prevents duplicate disputes
- Unit tests: Role verification (renter/provider) logic
- Unit tests: Time window validation for each reason code
- Integration tests: API route dispute creation with authentication
- Integration tests: API route prevents duplicate dispute creation
- Integration tests: API route enforces role-based access
- Integration tests: API route validates time windows
- Integration tests: API route checks rate limits
- Integration tests: Policy version stored correctly
- Integration tests: Audit log created on dispute creation
- E2E tests: Complete dispute creation workflow
- BDD scenarios: Dispute creation acceptance criteria

### Requirement 2: Dispute Reason Codes

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 2

**Test Coverage**:

- Unit tests: Enum values are correct (DAMAGE, NON_DELIVERY, QUALITY_ISSUE, CANCELLATION, PAYMENT_ISSUE, OTHER)
- Integration tests: Reason code required in creation form
- Integration tests: Reason code stored as enum in database
- Integration tests: Reason code immutable after creation
- Integration tests: Time window rules applied based on reason code

### Requirement 3: Dispute State Machine

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 3

**Test Coverage**:

- Unit tests: State machine validates all valid transitions
- Unit tests: State machine rejects invalid transitions
- Unit tests: Final state protection (RESOLVED, CLOSED cannot transition)
- Unit tests: Admin-only transition validation
- Integration tests: State transition API route validates transitions
- Integration tests: State transition creates audit log
- Integration tests: Automatic transition on evidence deadline expiration
- E2E tests: Complete state machine workflow

### Requirement 4: Evidence Management

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: Evidence upload allowed in OPEN and EVIDENCE_REQUESTED states
- Unit tests: Evidence upload blocked in RESOLVED and CLOSED states
- Unit tests: Image file validation (type, size)
- Unit tests: Image processing and optimization
- Integration tests: Evidence upload API route with file validation
- Integration tests: Evidence deadline calculation (7 days initial, 3 days additional)
- Integration tests: Evidence deadline enforcement blocks uploads
- Integration tests: Evidence stored in Vercel Blob and database
- Integration tests: Evidence displayed with attribution and timestamps
- Integration tests: Evidence ordered by upload timestamp
- E2E tests: Complete evidence upload workflow

### Requirement 5: Admin-Only Internal Notes

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: Internal notes CRUD methods in DisputeDAL
- Integration tests: Internal notes API routes require admin
- Integration tests: Internal notes only visible to admins
- Integration tests: Internal notes not visible to renters/providers
- Integration tests: Internal notes ordered by timestamp (newest first)
- Integration tests: Internal notes editable and deletable by admins
- Integration tests: Internal note actions logged in audit trail

### Requirement 6: Stripe Financial Integration

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 6

**Test Coverage**:

- Unit tests: StripeDisputeService.executeOperation() routes to correct handler
- Unit tests: Refund operations (full and partial) with mocked Stripe
- Unit tests: Payout hold operation
- Unit tests: Security deposit capture operation
- Integration tests: Financial operations API route requires admin
- Integration tests: Financial operations stored with Stripe IDs
- Integration tests: Financial operations logged in audit trail
- Integration tests: Stripe metadata includes disputeId and rentalId
- Integration tests: Failed Stripe operations prevent resolution
- Integration tests: Financial operations immutable after resolution
- E2E tests: Complete resolution workflow with financial operations

### Requirement 7: Admin Resolution Actions

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 7

**Test Coverage**:

- Unit tests: DisputeDAL.resolve() method
- Integration tests: Resolution API route requires admin
- Integration tests: Resolution requires outcome and reason
- Integration tests: Resolution executes financial operations first
- Integration tests: Resolution updates dispute state to RESOLVED
- Integration tests: Resolution prevents further evidence uploads
- Integration tests: Resolution information visible to both parties
- Integration tests: Resolution logged in audit trail
- Integration tests: Resolution sends notifications
- E2E tests: Complete admin resolution workflow

### Requirement 8: Audit Trail and Compliance

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: Audit log creation for all action types
- Integration tests: State changes logged with previous/new state
- Integration tests: Financial operations logged with details
- Integration tests: Evidence uploads logged
- Integration tests: Admin actions logged
- Integration tests: Audit logs immutable (no updates/deletes)
- Integration tests: Audit logs queryable by dispute ID, user ID, date range, action type
- Integration tests: Policy version stored with dispute

### Requirement 9: Abuse Prevention and Rate Limiting

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 9

**Test Coverage**:

- Unit tests: checkRateLimits() calculates monthly count correctly
- Unit tests: checkRateLimits() calculates yearly count correctly
- Unit tests: checkRateLimits() returns withinLimits flag
- Integration tests: Rate limit check prevents creation when exceeded
- Integration tests: Rate limit check allows creation when within limits
- Integration tests: Rate limit calculation uses indexed queries
- Integration tests: Rate limits reset at month/year boundaries
- Integration tests: Dismissed disputes count toward rate limits

### Requirement 10: Stripe Chargeback Compatibility

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 10

**Test Coverage**:

- Integration tests: Stripe chargeback ID can be linked to dispute
- Integration tests: Chargeback ID displayed in dispute record
- Integration tests: Evidence bundle export functionality (future enhancement)
- Integration tests: Internal dispute records remain independent

### Requirement 11: User Interface and Notifications

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 11

**Test Coverage**:

- Integration tests: Dispute status displayed in rental UI
- Integration tests: Dispute list page displays all user disputes
- Integration tests: Dispute list supports filtering by status
- Integration tests: Dispute list supports sorting by date
- Integration tests: Deadline displayed with time remaining
- Integration tests: Notifications sent for all dispute events
- Integration tests: Notification data includes required fields
- E2E tests: User sees dispute status in rental details
- E2E tests: User receives notifications for dispute events

### Requirement 12: Dispute Details View

**Requirement Reference**: `specs/disputes/1-requirements.md` - Requirement 12

**Test Coverage**:

- Integration tests: Dispute details accessible to renter, provider, and admin
- Integration tests: Dispute details display all required information
- Integration tests: Evidence displayed with attribution
- Integration tests: Timeline displays state transitions
- Integration tests: Resolution information displayed if resolved
- Integration tests: Financial operations displayed if any
- Integration tests: Internal notes visible only to admins
- Integration tests: Admin action buttons visible only to admins
- E2E tests: Complete dispute details view workflow

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and components in isolation.

**Framework**: Vitest

**Coverage Goals**: 80%+ for business logic (DAL, state machine, services), 60%+ for utilities

**Areas to Test**:

- **DisputeDAL Methods**: Mock database, test all CRUD operations, rate limiting, time window validation
- **State Machine**: Test transition validation, invalid transitions, final state protection
- **Deadline Enforcement**: Test deadline calculation, automatic transitions
- **Stripe Service**: Mock Stripe API, test all financial operations
- **Time Window Validation**: Test calculations for each reason code
- **Evidence Validation**: Test file type and size validation

**Test Structure** (AAA Pattern):

```typescript
describe("DisputeDAL", () => {
  describe("create", () => {
    it("should create dispute with valid data", async () => {
      // Arrange
      const mockData = {
        /* test data */
      };
      vi.spyOn(db, "insert").mockResolvedValue([mockDispute]);

      // Act
      const result = await DisputeDAL.create(mockData);

      // Assert
      expect(result).toEqual(expect.objectContaining({ status: "open" }));
      expect(db.insert).toHaveBeenCalledWith(expect.objectContaining(mockData));
    });
  });
});
```

### Integration Tests

**Purpose**: Test component interactions and data flow between layers.

**Framework**: Vitest with test database or mocked DAL

**Coverage Goals**: Critical user flows, 70%+ for integration points

**Areas to Test**:

- **API Routes → DAL**: Verify correct DAL methods called with proper data
- **API Routes → Stripe Service**: Verify Stripe operations executed correctly
- **API Routes → Notifications**: Verify notifications sent on events
- **Component → Hook → API**: Verify data fetching and state management
- **Form → API → Database**: Verify complete data flow
- **Error Propagation**: Verify errors handled correctly across layers

**Test Structure**:

```typescript
describe("POST /api/disputes", () => {
  it("should create dispute and send notifications", async () => {
    // Arrange
    const mockUser = { id: "user-123", userType: "standard" };
    vi.spyOn(getAuthenticatedUserResponse, "default").mockResolvedValue({
      userId: mockUser.id,
      user: mockUser,
      isAdmin: false,
    });
    vi.spyOn(DisputeDAL, "getActiveByRentalId").mockResolvedValue(null);
    vi.spyOn(DisputeDAL, "checkRateLimits").mockResolvedValue({
      withinLimits: true,
      monthlyCount: 1,
      yearlyCount: 1,
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    expect(DisputeDAL.create).toHaveBeenCalled();
    expect(sendDisputeNotifications).toHaveBeenCalled();
  });
});
```

### End-to-End (E2E) Tests

**Purpose**: Test complete user workflows from UI to database.

**Framework**: Playwright (to be configured) or Vitest with full stack

**Coverage Goals**: All critical user paths, happy paths + major error paths

**BDD Integration**: Use Gherkin scenarios for E2E tests

**Example BDD Scenarios**:

```gherkin
Feature: Create Dispute
  As a renter
  I want to create a dispute for a rental
  So that I can seek resolution for issues

  Scenario: Successful dispute creation
    Given I am logged in as a renter
    And I have a completed rental
    And the rental end date was within 7 days
    When I navigate to the rental details page
    And I click "File Dispute"
    And I select reason code "DAMAGE"
    And I enter a description
    And I submit the dispute form
    Then the dispute should be created with status "OPEN"
    And I should receive a notification
    And the other party should receive a notification

  Scenario: Dispute creation fails - active dispute exists
    Given I am logged in as a renter
    And I have a rental with an active dispute
    When I attempt to create a new dispute for the same rental
    Then I should see an error message "Active dispute already exists"
    And no new dispute should be created

  Scenario: Dispute creation fails - time window expired
    Given I am logged in as a renter
    And I have a completed rental
    And the rental end date was 8 days ago
    When I attempt to create a DAMAGE dispute
    Then I should see an error message "Time window has expired"
    And no dispute should be created

  Scenario: Dispute creation fails - rate limit exceeded
    Given I am logged in as a renter
    And I have created 3 disputes this month
    When I attempt to create another dispute
    Then I should see an error message "Rate limit exceeded"
    And no dispute should be created
```

## Test Scenarios by Component

### DisputeDAL Tests

**File**: `src/dal/__tests__/dispute.dal.test.ts`

**Test Cases**:

1. `create()` - Creates dispute with valid data
2. `create()` - Sets initial status to OPEN
3. `create()` - Calculates evidence deadline (7 days)
4. `create()` - Stores policy version
5. `getById()` - Returns dispute with all relations
6. `getById()` - Returns null if not found
7. `getActiveByRentalId()` - Returns active dispute if exists
8. `getActiveByRentalId()` - Returns null if no active dispute
9. `getUserDisputes()` - Returns disputes for user as renter
10. `getUserDisputes()` - Returns disputes for user as provider
11. `getUserDisputes()` - Applies status filter
12. `getUserDisputes()` - Implements pagination
13. `getAdminDisputes()` - Returns all disputes with filters
14. `updateState()` - Updates dispute state
15. `updateState()` - Updates updatedAt timestamp
16. `resolve()` - Updates dispute to RESOLVED
17. `resolve()` - Stores resolution outcome and reason
18. `checkRateLimits()` - Calculates monthly count correctly
19. `checkRateLimits()` - Calculates yearly count correctly
20. `checkRateLimits()` - Returns withinLimits flag
21. `validateTimeWindow()` - Validates DAMAGE window (7 days after end)
22. `validateTimeWindow()` - Validates NON_DELIVERY window (3 days after start)
23. `validateTimeWindow()` - Validates QUALITY_ISSUE window (7 days after end)
24. `validateTimeWindow()` - Validates PAYMENT_ISSUE window (30 days after payment)
25. `validateTimeWindow()` - Validates OTHER window (14 days after end)
26. `validateTimeWindow()` - Rejects disputes outside time window
27. `createEvidence()` - Creates evidence record
28. `getEvidenceByDisputeId()` - Returns evidence ordered by timestamp
29. `checkEvidenceDeadline()` - Returns expired flag correctly
30. `checkEvidenceDeadline()` - Calculates time remaining
31. `createAuditLog()` - Creates audit log entry
32. `getAuditLogsByDisputeId()` - Returns audit logs ordered by timestamp
33. `createInternalNote()` - Creates internal note
34. `getInternalNotesByDisputeId()` - Returns notes ordered newest first
35. `updateInternalNote()` - Updates note content
36. `deleteInternalNote()` - Deletes note
37. `createFinancialOperation()` - Creates financial operation record
38. `getFinancialOperationsByDisputeId()` - Returns operations ordered by timestamp

### State Machine Tests

**File**: `src/features/disputes/lib/__tests__/state-machine.test.ts`

**Test Cases**:

1. `canTransition()` - Allows OPEN → EVIDENCE_REQUESTED
2. `canTransition()` - Allows OPEN → UNDER_REVIEW
3. `canTransition()` - Allows OPEN → RESOLVED
4. `canTransition()` - Allows EVIDENCE_REQUESTED → UNDER_REVIEW
5. `canTransition()` - Allows EVIDENCE_REQUESTED → RESOLVED
6. `canTransition()` - Allows UNDER_REVIEW → RESOLVED
7. `canTransition()` - Allows RESOLVED → CLOSED
8. `canTransition()` - Rejects invalid transitions
9. `validateTransition()` - Validates admin-only transitions
10. `validateTransition()` - Rejects transitions from final states
11. `validateTransition()` - Returns error message for invalid transitions

### Deadline Enforcement Tests

**File**: `src/features/disputes/lib/__tests__/deadline-enforcement.test.ts`

**Test Cases**:

1. `checkAndEnforce()` - Transitions EVIDENCE_REQUESTED → UNDER_REVIEW when deadline expires
2. `checkAndEnforce()` - Creates audit log for automatic transition
3. `checkAndEnforce()` - Sends notification on deadline expiration
4. `checkAndEnforce()` - Does nothing if deadline not expired
5. `checkAndEnforce()` - Does nothing if not in EVIDENCE_REQUESTED state

### Stripe Service Tests

**File**: `src/services/stripe/__tests__/dispute-financial.test.ts`

**Test Cases**:

1. `executeOperation()` - Routes to createRefund for refund operations
2. `executeOperation()` - Routes to holdPayout for hold operations
3. `executeOperation()` - Routes to captureDeposit for deposit operations
4. `createRefund()` - Creates full refund via Stripe API
5. `createRefund()` - Creates partial refund via Stripe API
6. `createRefund()` - Includes metadata in Stripe request
7. `createRefund()` - Creates financial operation record
8. `createRefund()` - Handles Stripe API errors
9. `holdPayout()` - Creates hold operation record
10. `captureDeposit()` - Captures security deposit via Stripe API
11. `captureDeposit()` - Creates financial operation record
12. `captureDeposit()` - Handles missing authorization ID

### API Route Tests

**File**: `src/app/api/disputes/__tests__/route.test.ts`

**Test Cases**:

1. `POST /api/disputes` - Creates dispute with valid data
2. `POST /api/disputes` - Requires authentication (401 if not authenticated)
3. `POST /api/disputes` - Verifies user is renter or provider (403 if not)
4. `POST /api/disputes` - Prevents duplicate dispute creation (400 if exists)
5. `POST /api/disputes` - Enforces rate limits (429 if exceeded)
6. `POST /api/disputes` - Validates time windows (400 if expired)
7. `POST /api/disputes` - Stores policy version
8. `POST /api/disputes` - Creates audit log
9. `POST /api/disputes` - Sends notifications
10. `GET /api/disputes` - Returns user disputes for regular user
11. `GET /api/disputes` - Returns all disputes for admin
12. `GET /api/disputes` - Applies status filter
13. `GET /api/disputes` - Implements pagination

**File**: `src/app/api/disputes/[id]/__tests__/route.test.ts`

**Test Cases**:

1. `GET /api/disputes/[id]` - Returns dispute with relations
2. `GET /api/disputes/[id]` - Requires authentication
3. `GET /api/disputes/[id]` - Verifies user has access (renter, provider, or admin)
4. `GET /api/disputes/[id]` - Returns 404 if dispute not found
5. `GET /api/disputes/[id]` - Returns 403 if user doesn't have access

**File**: `src/app/api/disputes/[id]/state/__tests__/route.test.ts`

**Test Cases**:

1. `PATCH /api/disputes/[id]/state` - Updates dispute state
2. `PATCH /api/disputes/[id]/state` - Requires authentication
3. `PATCH /api/disputes/[id]/state` - Validates state transition
4. `PATCH /api/disputes/[id]/state` - Rejects invalid transitions (400)
5. `PATCH /api/disputes/[id]/state` - Requires admin for admin-only transitions
6. `PATCH /api/disputes/[id]/state` - Creates audit log
7. `PATCH /api/disputes/[id]/state` - Sends notifications for evidence_requested

**File**: `src/app/api/disputes/[id]/evidence/__tests__/route.test.ts`

**Test Cases**:

1. `POST /api/disputes/[id]/evidence` - Uploads image evidence
2. `POST /api/disputes/[id]/evidence` - Uploads text evidence
3. `POST /api/disputes/[id]/evidence` - Validates file type (JPEG, PNG, WebP)
4. `POST /api/disputes/[id]/evidence` - Validates file size (max 10MB)
5. `POST /api/disputes/[id]/evidence` - Blocks upload if deadline expired
6. `POST /api/disputes/[id]/evidence` - Blocks upload if dispute resolved
7. `POST /api/disputes/[id]/evidence` - Verifies user is renter or provider
8. `POST /api/disputes/[id]/evidence` - Stores evidence in Vercel Blob
9. `POST /api/disputes/[id]/evidence` - Creates evidence record
10. `POST /api/disputes/[id]/evidence` - Creates audit log

**File**: `src/app/api/disputes/[id]/resolve/__tests__/route.test.ts`

**Test Cases**:

1. `POST /api/disputes/[id]/resolve` - Resolves dispute with outcome
2. `POST /api/disputes/[id]/resolve` - Requires admin (403 if not admin)
3. `POST /api/disputes/[id]/resolve` - Executes financial operations first
4. `POST /api/disputes/[id]/resolve` - Prevents resolution if financial operations fail
5. `POST /api/disputes/[id]/resolve` - Updates dispute to RESOLVED
6. `POST /api/disputes/[id]/resolve` - Stores resolution outcome and reason
7. `POST /api/disputes/[id]/resolve` - Creates audit log
8. `POST /api/disputes/[id]/resolve` - Sends notifications

**File**: `src/app/api/disputes/[id]/notes/__tests__/route.test.ts`

**Test Cases**:

1. `POST /api/disputes/[id]/notes` - Creates internal note (admin only)
2. `POST /api/disputes/[id]/notes` - Requires admin (403 if not admin)
3. `PUT /api/disputes/[id]/notes` - Updates internal note
4. `DELETE /api/disputes/[id]/notes` - Deletes internal note
5. All note operations create audit logs

### React Query Hook Tests

**File**: `src/features/disputes/hooks/__tests__/use-disputes.test.ts`

**Test Cases**:

1. `useDisputes()` - Fetches disputes from API
2. `useDisputes()` - Applies filters to query
3. `useDisputes()` - Handles errors with toast
4. `useDisputes()` - Invalidates cache on mutation

**File**: `src/features/disputes/hooks/__tests__/use-create-dispute.test.ts`

**Test Cases**:

1. `useCreateDispute()` - Creates dispute via API
2. `useCreateDispute()` - Shows success toast on success
3. `useCreateDispute()` - Shows error toast on failure
4. `useCreateDispute()` - Invalidates disputes query on success

### Component Tests

**File**: `src/features/disputes/components/__tests__/create-dispute-form.test.tsx`

**Test Cases**:

1. Renders form with required fields
2. Validates reason code selection
3. Validates description input
4. Submits form with valid data
5. Shows loading state during submission
6. Displays error messages
7. Redirects to dispute details on success

**File**: `src/features/disputes/components/__tests__/evidence-upload.test.tsx`

**Test Cases**:

1. Renders upload interface
2. Supports drag-and-drop for images
3. Validates file type client-side
4. Validates file size client-side
5. Displays deadline and time remaining
6. Disables upload if deadline expired
7. Disables upload if dispute resolved
8. Shows uploaded evidence list
9. Displays image thumbnails

**File**: `src/features/disputes/components/__tests__/admin-resolution-panel.test.tsx`

**Test Cases**:

1. Renders only for admins
2. Displays resolution outcome options
3. Displays financial operation options
4. Submits resolution with valid data
5. Shows loading state
6. Handles errors

## BDD Scenarios

### Feature: Dispute Creation

```gherkin
Feature: Create Dispute
  As a renter or provider
  I want to create a dispute for a rental
  So that I can seek resolution for issues

  Scenario: Successful dispute creation by renter
    Given I am logged in as a renter
    And I have a completed rental with ID "rental-123"
    And the rental end date was 3 days ago
    And no active dispute exists for this rental
    And I have created 2 disputes this month
    When I navigate to the rental details page
    And I click "File Dispute"
    And I select reason code "DAMAGE"
    And I enter description "Tool was returned damaged"
    And I submit the dispute form
    Then the dispute should be created with status "OPEN"
    And the dispute should have reason code "DAMAGE"
    And the dispute should have evidence deadline 7 days from now
    And I should receive a notification "Dispute created"
    And the provider should receive a notification "Dispute created"
    And an audit log should be created for "dispute_created"

  Scenario: Dispute creation fails - active dispute exists
    Given I am logged in as a renter
    And I have a rental with an active dispute
    When I attempt to create a new dispute for the same rental
    Then I should see an error message "Active dispute already exists"
    And no new dispute should be created
    And the HTTP status should be 400

  Scenario: Dispute creation fails - time window expired
    Given I am logged in as a renter
    And I have a completed rental
    And the rental end date was 8 days ago
    When I attempt to create a DAMAGE dispute
    Then I should see an error message "Time window has expired"
    And no dispute should be created
    And the HTTP status should be 400

  Scenario: Dispute creation fails - rate limit exceeded
    Given I am logged in as a renter
    And I have created 3 disputes this month
    When I attempt to create another dispute
    Then I should see an error message "Rate limit exceeded"
    And no dispute should be created
    And the HTTP status should be 429

  Scenario: Dispute creation fails - unauthorized user
    Given I am logged in as a user
    And I have a rental where I am neither renter nor provider
    When I attempt to create a dispute for this rental
    Then I should see an error message "Unauthorized"
    And no dispute should be created
    And the HTTP status should be 403
```

### Feature: Evidence Upload

```gherkin
Feature: Upload Evidence
  As a renter or provider
  I want to upload evidence to support my dispute
  So that I can provide documentation for my claim

  Scenario: Successful image evidence upload
    Given I am logged in as a renter
    And I have a dispute with status "OPEN"
    And the evidence deadline has not expired
    When I navigate to the dispute details page
    And I drag and drop an image file (JPEG, 5MB)
    Then the image should be uploaded to Vercel Blob
    And an evidence record should be created
    And the evidence should be displayed with my name and timestamp
    And an audit log should be created for "evidence_uploaded"

  Scenario: Evidence upload fails - deadline expired
    Given I am logged in as a renter
    And I have a dispute with status "EVIDENCE_REQUESTED"
    And the evidence deadline expired 1 day ago
    When I attempt to upload evidence
    Then I should see an error message "Evidence deadline has expired"
    And no evidence should be uploaded
    And the HTTP status should be 400

  Scenario: Evidence upload fails - dispute resolved
    Given I am logged in as a renter
    And I have a dispute with status "RESOLVED"
    When I attempt to upload evidence
    Then I should see an error message "Evidence cannot be uploaded for resolved disputes"
    And no evidence should be uploaded
    And the HTTP status should be 400

  Scenario: Evidence upload fails - invalid file type
    Given I am logged in as a renter
    And I have a dispute with status "OPEN"
    When I attempt to upload a PDF file
    Then I should see an error message "Invalid file type"
    And no evidence should be uploaded
    And the HTTP status should be 400

  Scenario: Evidence upload fails - file too large
    Given I am logged in as a renter
    And I have a dispute with status "OPEN"
    When I attempt to upload an image file (15MB)
    Then I should see an error message "File size exceeds 10MB limit"
    And no evidence should be uploaded
    And the HTTP status should be 400
```

### Feature: Admin Resolution

```gherkin
Feature: Admin Resolution
  As an admin
  I want to resolve disputes with financial operations
  So that disputes are closed with clear decisions

  Scenario: Successful dispute resolution with refund
    Given I am logged in as an admin
    And I have a dispute with status "UNDER_REVIEW"
    And the dispute has an associated payment
    When I navigate to the dispute details page
    And I select resolution outcome "FAVOR_RENTER"
    And I enter resolution reason "Tool was damaged, full refund issued"
    And I select financial operation "refund_full"
    And I submit the resolution
    Then the dispute status should be updated to "RESOLVED"
    And a full refund should be created via Stripe
    And a financial operation record should be created
    And the renter and provider should receive notifications
    And an audit log should be created for "resolution"
    And no further evidence uploads should be allowed

  Scenario: Resolution fails - Stripe operation fails
    Given I am logged in as an admin
    And I have a dispute with status "UNDER_REVIEW"
    And the Stripe API will return an error
    When I attempt to resolve the dispute with a refund
    Then I should see an error message "Financial operation failed"
    And the dispute status should remain "UNDER_REVIEW"
    And no resolution should be recorded
    And the HTTP status should be 500
```

## Performance Tests

### Performance Test Cases

1. **Dispute Creation Performance**
   - Test: Create dispute completes within 2 seconds
   - Method: Measure API response time
   - Target: < 2 seconds (95th percentile)

2. **Evidence Upload Performance**
   - Test: Upload 10MB image completes within 5 seconds
   - Method: Measure upload and processing time
   - Target: < 5 seconds (95th percentile)

3. **Dispute List Performance**
   - Test: Load dispute list with pagination within 2 seconds
   - Method: Measure page load time
   - Target: < 2 seconds (95th percentile)

4. **Dispute Details Performance**
   - Test: Load dispute details with all relations within 3 seconds
   - Method: Measure page load time
   - Target: < 3 seconds (95th percentile)

5. **State Transition Performance**
   - Test: State transition completes within 1 second
   - Method: Measure API response time
   - Target: < 1 second (95th percentile)

6. **Rate Limit Check Performance**
   - Test: Rate limit check completes within 500ms
   - Method: Measure query execution time
   - Target: < 500ms (95th percentile)

## Security Tests

### Security Test Cases

1. **Authentication Tests**
   - Unauthenticated users cannot create disputes (401)
   - Unauthenticated users cannot view disputes (401)
   - Unauthenticated users cannot upload evidence (401)

2. **Authorization Tests**
   - Users can only view disputes where they are renter or provider (403)
   - Only admins can resolve disputes (403)
   - Only admins can view internal notes (403)
   - Only admins can perform state transitions (403)
   - Only admins can perform financial operations (403)

3. **Input Validation Tests**
   - File uploads validated for type and size server-side
   - State transitions validated server-side (cannot be bypassed)
   - Financial operations require admin privileges
   - Evidence uploads blocked for resolved disputes

4. **Data Protection Tests**
   - Stripe API keys never exposed to client
   - Audit logs immutable (no updates/deletes)
   - Internal notes only accessible to admins
   - User data properly isolated

## Error Handling Tests

### Error Handling Test Cases

1. **Database Errors**
   - Handle database connection failures gracefully
   - Handle constraint violations (unique, foreign key)
   - Roll back transactions on errors

2. **Stripe API Errors**
   - Retry transient failures (3 attempts with exponential backoff)
   - Handle permanent failures with user-friendly messages
   - Prevent state transition if Stripe operation fails
   - Log errors for investigation

3. **File Upload Errors**
   - Handle Vercel Blob upload failures
   - Handle file processing errors
   - Clean up partial uploads on error

4. **Concurrent Operation Errors**
   - Handle concurrent dispute creation attempts
   - Handle concurrent evidence uploads
   - Handle admin resolving while evidence uploading

## Test Data Requirements

### Test Fixtures

1. **Users**
   - Renter user
   - Provider user
   - Admin user
   - Unauthorized user

2. **Rentals**
   - Completed rental (within time window)
   - Completed rental (outside time window)
   - Active rental
   - Rental with existing dispute

3. **Disputes**
   - Dispute in each state (OPEN, EVIDENCE_REQUESTED, UNDER_REVIEW, RESOLVED, CLOSED)
   - Dispute with evidence
   - Dispute with financial operations
   - Dispute at rate limit boundary

4. **Payments**
   - Payment with PaymentIntent ID
   - Payment with security deposit authorization

## Test Environment Setup

### Test Database

- Use separate test database or in-memory database
- Reset database between test suites
- Seed test data for consistent tests

### Mocking Strategy

- **Stripe API**: Mock all Stripe API calls
- **Vercel Blob**: Mock blob storage operations
- **Notifications**: Mock notification sending
- **Database**: Use test database or mocks for unit tests

### Test Execution

- Run unit tests: `bun run test:unit`
- Run integration tests: `bun run test:integration`
- Run E2E tests: `bun run test:e2e`
- Run all tests: `bun run test`
- Run tests with coverage: `bun run test:coverage`

## Coverage Goals

- **Overall Coverage**: 80%+
- **DAL Methods**: 90%+
- **State Machine**: 100%
- **API Routes**: 85%+
- **React Query Hooks**: 80%+
- **Components**: 70%+
- **Services**: 85%+

## Test Maintenance

- Update tests when requirements change
- Add tests for bug fixes
- Review test coverage regularly
- Remove obsolete tests
- Keep test data up to date
