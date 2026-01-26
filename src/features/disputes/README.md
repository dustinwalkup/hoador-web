# Disputes Feature

## Overview

The Disputes feature allows renters and providers to file disputes for rental transactions, with admin oversight and resolution capabilities. The system enforces rate limits, time windows, and state transitions to ensure fair and timely dispute resolution.

## Architecture

The disputes feature follows the application's architecture patterns:

- **API Routes** (`/app/api/disputes/`) - Handle authentication, authorization, and request/response
- **DAL (Data Access Layer)** (`/dal/dispute.dal.ts`) - Pure database operations
- **React Query Hooks** (`/features/disputes/hooks/`) - Client-side data fetching and mutations
- **Components** (`/features/disputes/components/`) - UI components for dispute management
- **Business Logic** (`/features/disputes/lib/`) - State machine, deadline enforcement, validation

## Dispute Workflow

### 1. Dispute Creation

A dispute can be created by either the renter or provider of a rental:

1. User navigates to rental details page
2. Clicks "File Dispute" button (only visible if conditions are met)
3. Fills out dispute form:
   - **Reason Code**: Select from predefined reasons (damage, non_delivery, quality_issue, cancellation, payment_issue, other)
   - **Description**: Minimum 10 characters explaining the dispute
4. System validates:
   - No active dispute exists for the rental
   - User is within rate limits (3 per month, 10 per year)
   - Dispute is within time window based on reason code
   - User is either renter or provider of the rental
5. Dispute is created with status `open`
6. Notifications are sent to both parties

### 2. Evidence Submission

After a dispute is created, admins can request evidence:

1. Admin transitions dispute to `evidence_requested` status
2. System sets evidence deadline (7 days from request)
3. Both parties can upload evidence:
   - **Images**: Uploaded via drag-and-drop or file picker
   - **Text**: Written descriptions or explanations
4. Evidence deadline is enforced - if expired, dispute auto-transitions to `under_review`
5. Evidence is displayed chronologically in the dispute details page

### 3. Admin Review

Admins review disputes and evidence:

1. Dispute is in `under_review` status
2. Admins can:
   - View all evidence from both parties
   - Add internal notes (visible only to admins)
   - Request additional evidence (extends deadline)
   - Resolve the dispute

### 4. Dispute Resolution

Admins resolve disputes with financial operations:

1. Admin selects resolution outcome:
   - `favor_renter` - Renter wins
   - `favor_provider` - Provider wins
   - `partial_renter` - Partial win for renter
   - `partial_provider` - Partial win for provider
   - `dismissed` - Dispute dismissed
2. Admin provides resolution reason (max 1000 characters)
3. Admin can execute financial operations:
   - **Hold Payout**: Prevent provider from receiving payout
   - **Refund Full**: Refund full rental amount to renter
   - **Refund Partial**: Refund partial amount (specify amount)
   - **Capture Deposit**: Capture security deposit
4. Dispute status changes to `resolved`
5. Notifications are sent to both parties

### 5. Dispute Closure

After resolution, disputes can be closed:

1. Admin transitions dispute from `resolved` to `closed`
2. Dispute becomes immutable (no further changes allowed)
3. All financial operations are final

## State Machine

Disputes follow a strict state machine with the following transitions:

```
open → evidence_requested → under_review → resolved → closed
  ↓           ↓                  ↓
  └───────────┴──────────────────┘
    (can skip to resolved)
```

### Valid Transitions

- `open` → `evidence_requested`, `under_review`, `resolved`
- `evidence_requested` → `under_review`, `resolved`
- `under_review` → `resolved`
- `resolved` → `closed`
- `closed` → (terminal state, no transitions)

### Admin-Only Transitions

The following transitions require admin privileges:

- `evidence_requested`
- `under_review`
- `resolved`
- `closed`

### Final States

Once a dispute reaches `resolved` or `closed`, it cannot be modified.

## Time Windows

Disputes must be filed within specific time windows based on the reason code:

| Reason Code     | Time Window                    |
| --------------- | ------------------------------ |
| `damage`        | 7 days after rental end date   |
| `non_delivery`  | 3 days after rental start date |
| `quality_issue` | 7 days after rental end date   |
| `cancellation`  | 2 days after cancellation      |
| `payment_issue` | 30 days after payment          |
| `other`         | 14 days after rental end date  |

## Rate Limits

Users are limited in how many disputes they can create:

- **Monthly Limit**: 3 disputes per month
- **Yearly Limit**: 10 disputes per year

Rate limits are checked on-the-fly when creating disputes. If limits are exceeded, the request is rejected with a 429 status code.

## API Endpoints

### GET /api/disputes

Get list of disputes with pagination and filters.

**Authentication**: Required

**Query Parameters**:

- `page` (number, default: 1) - Page number
- `limit` (number, default: 12) - Items per page
- `status` (string, optional) - Filter by status
- `role` (string, optional) - Filter by role (renter/provider) - user only
- `reasonCode` (string, optional) - Filter by reason code - admin only

**Response**:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Access**:

- **Admins**: See all disputes with admin filters
- **Users**: See only their own disputes (as renter or provider)

### POST /api/disputes

Create a new dispute.

**Authentication**: Required

**Request Body**:

```json
{
  "rentalId": "uuid",
  "reasonCode": "damage" | "non_delivery" | "quality_issue" | "cancellation" | "payment_issue" | "other",
  "description": "string (min 10 characters)"
}
```

**Response**: Created dispute object (201)

**Validation**:

- Checks for existing active dispute (409 if exists)
- Validates rate limits (429 if exceeded)
- Validates time window (400 if expired)
- Verifies user is renter or provider (403 if not)

### GET /api/disputes/[id]

Get dispute details by ID.

**Authentication**: Required

**Response**: Dispute object with all relations

**Access**:

- **Admins**: Can view any dispute
- **Users**: Can only view disputes where they are renter or provider

### PATCH /api/disputes/[id]/state

Update dispute state (admin only).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "newState": "evidence_requested" | "under_review" | "resolved" | "closed",
  "reason": "string (optional)"
}
```

**Response**: Updated dispute object

**Validation**:

- Validates state transition using state machine
- Checks admin privileges
- Prevents transitions from final states

### POST /api/disputes/[id]/evidence

Upload evidence for a dispute.

**Authentication**: Required

**Request**: FormData with either:

- `file` (File) - Image file
- `text` (string) - Text evidence

**Response**: Created evidence object

**Validation**:

- Verifies user is renter or provider
- Checks evidence deadline hasn't expired
- Validates file type and size (images only)

### POST /api/disputes/[id]/resolve

Resolve a dispute (admin only).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "outcome": "favor_renter" | "favor_provider" | "partial_renter" | "partial_provider" | "dismissed",
  "reason": "string (max 1000 characters)",
  "financialOperations": [
    {
      "type": "hold_payout" | "refund_full" | "refund_partial" | "capture_deposit",
      "amount": "number (optional, for partial refunds)"
    }
  ]
}
```

**Response**: Resolved dispute object

**Financial Operations**:

- Executes Stripe operations (refunds, deposit captures)
- Creates financial operation records
- Handles errors gracefully

### POST /api/disputes/[id]/notes

Create internal note (admin only).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "content": "string"
}
```

**Response**: Created note object

### PUT /api/disputes/[id]/notes

Update internal note (admin only).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "noteId": "uuid",
  "content": "string"
}
```

**Response**: Updated note object

### DELETE /api/disputes/[id]/notes

Delete internal note (admin only).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "noteId": "uuid"
}
```

**Response**: Success response

### GET /api/disputes/[id]/audit

Get audit logs for a dispute.

**Authentication**: Required

**Response**: Array of audit log objects

**Access**:

- **Admins**: See all audit logs
- **Users**: See filtered audit logs (no internal details)

## React Query Hooks

### useDisputes

Fetch list of disputes with filters.

```tsx
import { useDisputes } from "@/features/disputes/hooks/use-disputes";

function DisputesList() {
  const { data, isLoading, error } = useDisputes({
    status: "open",
    role: "renter",
  });

  // ...
}
```

### useDispute

Fetch single dispute by ID.

```tsx
import { useDispute } from "@/features/disputes/hooks/use-dispute";

function DisputeDetails({ disputeId }: { disputeId: string }) {
  const { data: dispute, isLoading } = useDispute(disputeId);

  // ...
}
```

### useCreateDispute

Create a new dispute.

```tsx
import { useCreateDispute } from "@/features/disputes/hooks/use-create-dispute";

function CreateDisputeForm({ rentalId }: { rentalId: string }) {
  const createDispute = useCreateDispute();

  const handleSubmit = (data: CreateDisputeInput) => {
    createDispute.mutate(data, {
      onSuccess: (dispute) => {
        router.push(`/dashboard/disputes/${dispute.id}`);
      },
    });
  };

  // ...
}
```

### useUploadEvidence

Upload evidence for a dispute.

```tsx
import { useUploadEvidence } from "@/features/disputes/hooks/use-upload-evidence";

function EvidenceUpload({ disputeId }: { disputeId: string }) {
  const uploadEvidence = useUploadEvidence(disputeId);

  const handleFileUpload = (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    uploadEvidence.mutate(formData);
  };

  // ...
}
```

### useResolveDispute

Resolve a dispute (admin only).

```tsx
import { useResolveDispute } from "@/features/disputes/hooks/use-resolve-dispute";

function AdminResolutionPanel({ disputeId }: { disputeId: string }) {
  const resolveDispute = useResolveDispute(disputeId);

  const handleResolve = (data: ResolveDisputeInput) => {
    resolveDispute.mutate(data);
  };

  // ...
}
```

### useUpdateDisputeState

Update dispute state (admin only).

```tsx
import { useUpdateDisputeState } from "@/features/disputes/hooks/use-update-dispute-state";

function AdminStateControls({ disputeId }: { disputeId: string }) {
  const updateState = useUpdateDisputeState(disputeId);

  const handleStateChange = (newState: DisputeStatus) => {
    updateState.mutate({ newState, reason: "Admin review" });
  };

  // ...
}
```

### useInternalNotes

Manage internal notes (admin only).

```tsx
import { useInternalNotes } from "@/features/disputes/hooks/use-internal-notes";

function InternalNotesSection({ disputeId }: { disputeId: string }) {
  const { notes, createNote, updateNote, deleteNote } =
    useInternalNotes(disputeId);

  // ...
}
```

## Components

### DisputesList

Display paginated list of disputes with filters.

```tsx
import { DisputesList } from "@/features/disputes/components/disputes-list";

<DisputesList filters={{ status: "open" }} />;
```

### DisputeDetails

Display full dispute information with evidence, timeline, and admin controls.

```tsx
import { DisputeDetails } from "@/features/disputes/components/dispute-details";

<DisputeDetails disputeId={disputeId} />;
```

### CreateDisputeForm

Form for creating a new dispute.

```tsx
import { CreateDisputeForm } from "@/features/disputes/components/create-dispute-form";

<CreateDisputeForm rentalId={rentalId} />;
```

### EvidenceUpload

Component for uploading evidence (images or text).

```tsx
import { EvidenceUpload } from "@/features/disputes/components/evidence-upload";

<EvidenceUpload disputeId={disputeId} disputeStatus={dispute.status} />;
```

### DisputeTimeline

Display state transition timeline from audit logs.

```tsx
import { DisputeTimeline } from "@/features/disputes/components/dispute-timeline";

<DisputeTimeline auditLogs={dispute.auditLogs} />;
```

### AdminResolutionPanel

Admin-only panel for resolving disputes with financial operations.

```tsx
import { AdminResolutionPanel } from "@/features/disputes/components/admin-resolution-panel";

<AdminResolutionPanel disputeId={disputeId} />;
```

### InternalNotesSection

Admin-only section for managing internal notes.

```tsx
import { InternalNotesSection } from "@/features/disputes/components/internal-notes-section";

<InternalNotesSection disputeId={disputeId} />;
```

### AdminStateControls

Admin-only controls for state transitions.

```tsx
import { AdminStateControls } from "@/features/disputes/components/admin-state-controls";

<AdminStateControls disputeId={disputeId} currentStatus={dispute.status} />;
```

### DisputeStatusBadge

Reusable badge component for displaying dispute status.

```tsx
import { DisputeStatusBadge } from "@/features/disputes/components/dispute-status-badge";

<DisputeStatusBadge status={dispute.status} />;
```

## Data Access Layer (DAL)

The `DisputeDAL` class provides all database operations for disputes. All methods are pure database operations with no authentication logic.

### Key Methods

- `create()` - Create a new dispute
- `getById()` - Get dispute by ID with all relations
- `getActiveByRentalId()` - Check for existing active dispute
- `getUserDisputes()` - Get user's disputes with pagination
- `getAdminDisputes()` - Get all disputes with filters (admin)
- `updateState()` - Update dispute status
- `resolve()` - Resolve a dispute
- `checkRateLimits()` - Check user's rate limits
- `validateTimeWindow()` - Validate time window for dispute creation
- `createEvidence()` - Create evidence record
- `getEvidenceByDisputeId()` - Get all evidence for dispute
- `checkEvidenceDeadline()` - Check if evidence deadline has expired
- `createAuditLog()` - Create audit log entry
- `getAuditLogsByDisputeId()` - Get all audit logs for dispute
- `createInternalNote()` - Create internal note
- `getInternalNotesByDisputeId()` - Get all internal notes
- `updateInternalNote()` - Update internal note
- `deleteInternalNote()` - Delete internal note
- `createFinancialOperation()` - Create financial operation record
- `getFinancialOperationsByDisputeId()` - Get all financial operations

## Business Logic

### State Machine

The `DisputeStateMachine` class validates state transitions:

```tsx
import { DisputeStateMachine } from "@/features/disputes/lib/state-machine";

const validation = DisputeStateMachine.validateTransition(
  currentStatus,
  newStatus,
  isAdmin,
);

if (!validation.valid) {
  // Handle error
}
```

### Deadline Enforcement

The `DeadlineEnforcement` service automatically transitions disputes when evidence deadlines expire:

```tsx
import { DeadlineEnforcement } from "@/features/disputes/lib/deadline-enforcement";

// Check and enforce deadline (called by cron job or on-demand)
await DeadlineEnforcement.checkAndEnforce(disputeId);
```

### Time Window Validation

Time window validation is handled by the DAL method `validateTimeWindow()`, which uses helper functions from the time window validation utility.

## Financial Operations

Financial operations are handled by the `StripeDisputeService` class:

- **Refunds**: Full or partial refunds via Stripe API
- **Payout Holds**: Business logic enforcement (no Stripe API call)
- **Deposit Captures**: Capture previously authorized security deposits

All financial operations create records in the `dispute_financial_operations` table for audit purposes.

## Notifications

Dispute notifications are sent at key events:

- **Dispute Created**: Both parties notified
- **Evidence Requested**: Party who needs to submit evidence notified
- **Evidence Deadline Approaching**: Warning notification (3 days before)
- **Evidence Deadline Expired**: Notification when deadline passes
- **Dispute Resolved**: Both parties notified with resolution details

Notifications are sent asynchronously and failures don't block the main operation.

## Testing

The disputes feature includes comprehensive tests:

- **DAL Tests**: Unit tests for all DAL methods (`src/dal/__tests__/dispute.dal.test.ts`)
- **State Machine Tests**: Tests for state transitions (`src/features/disputes/lib/__tests__/state-machine.test.ts`)
- **Deadline Enforcement Tests**: Tests for deadline logic (`src/features/disputes/lib/__tests__/deadline-enforcement.test.ts`)
- **Time Window Tests**: Tests for time window validation (`src/features/disputes/lib/__tests__/time-window-validation.test.ts`)
- **Financial Operations Tests**: Tests for Stripe operations (`src/services/stripe/__tests__/dispute-financial.test.ts`)
- **Hook Tests**: Tests for React Query hooks (`src/features/disputes/hooks/__tests__/`)

## Environment Variables

The following environment variables are used:

- `DISPUTE_POLICY_VERSION` - Version of dispute policy (defaults to "v1.0")
- Stripe keys (already configured)
- Vercel Blob configuration (for evidence image uploads)

## Examples

### Creating a Dispute

```tsx
import { useCreateDispute } from "@/features/disputes/hooks/use-create-dispute";

function FileDisputeButton({ rentalId }: { rentalId: string }) {
  const createDispute = useCreateDispute();

  const handleClick = () => {
    createDispute.mutate({
      rentalId,
      reasonCode: "damage",
      description: "Tool was damaged during rental period",
    });
  };

  return <Button onClick={handleClick}>File Dispute</Button>;
}
```

### Uploading Evidence

```tsx
import { useUploadEvidence } from "@/features/disputes/hooks/use-upload-evidence";

function EvidenceUploadForm({ disputeId }: { disputeId: string }) {
  const uploadEvidence = useUploadEvidence(disputeId);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    uploadEvidence.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" name="file" accept="image/*" />
      <button type="submit">Upload Evidence</button>
    </form>
  );
}
```

### Admin Resolving Dispute

```tsx
import { useResolveDispute } from "@/features/disputes/hooks/use-resolve-dispute";

function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const resolveDispute = useResolveDispute(disputeId);

  const handleResolve = () => {
    resolveDispute.mutate({
      outcome: "favor_renter",
      reason: "Evidence clearly shows damage was pre-existing",
      financialOperations: [{ type: "refund_full" }],
    });
  };

  return <Button onClick={handleResolve}>Resolve Dispute</Button>;
}
```

## Related Documentation

- [Disputes Requirements](../specs/disputes/1-requirements.md)
- [Disputes Design](../specs/disputes/2-design.md)
- [Architecture v2](../../../docs/ARCHITECTURE_V2.md)
