---
name: Server Actions to API Routes Migration
overview: Migrate all 35 server actions to API routes with React Query mutations, following existing patterns in the codebase. The migration will maintain all existing functionality including legal document tracking, payment processing, notifications, and error handling.
todos:
  - id: phase1-utilities
    content: Create API route utilities (route-helpers.ts) and React Query mutation utilities (mutation-helpers.ts)
    status: completed
  - id: phase2-listings-api
    content: "Create listings API routes: POST /api/listings, PATCH /api/listings/[listingId], PATCH /api/listings/[listingId]/status, POST /api/listings/analyze-image"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase2-listings-hooks
    content: Create React Query hooks for listings mutations (use-listing-mutations.ts)
    status: pending
    dependencies:
      - phase2-listings-api
  - id: phase2-listings-components
    content: Update listing components to use new React Query hooks instead of server actions
    status: pending
    dependencies:
      - phase2-listings-hooks
  - id: phase3-rentals-api
    content: "Create rentals API routes: POST /api/rentals, POST /api/rentals/[id]/approve, POST /api/rentals/[id]/decline, POST /api/rentals/[id]/cancel, POST /api/rentals/[id]/start, POST /api/rentals/[id]/end, PATCH /api/rentals/[id]/instructions"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase3-rentals-hooks
    content: Create React Query hooks for rentals mutations (use-rental-mutations.ts)
    status: pending
    dependencies:
      - phase3-rentals-api
  - id: phase3-rentals-components
    content: Update rental components to use new React Query hooks instead of server actions
    status: pending
    dependencies:
      - phase3-rentals-hooks
  - id: phase4-messages-api
    content: "Create messages API routes: POST /api/messages/conversations, POST /api/messages/conversations/[conversationId]/messages, POST /api/messages/conversations/[conversationId]/archive, POST /api/messages/conversations/[conversationId]/unarchive, POST /api/messages/conversations/[conversationId]/read, POST /api/messages/conversations/[conversationId]/unread, DELETE /api/messages/conversations/[conversationId]"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase4-messages-hooks
    content: Create React Query hooks for messages mutations (use-message-mutations.ts)
    status: pending
    dependencies:
      - phase4-messages-api
  - id: phase4-messages-components
    content: Update message components to use new React Query hooks instead of server actions
    status: pending
    dependencies:
      - phase4-messages-hooks
  - id: phase5-reviews-api
    content: "Create reviews API route: POST /api/reviews"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase5-reviews-hooks
    content: Create React Query hook for reviews mutations (use-review-mutations.ts)
    status: pending
    dependencies:
      - phase5-reviews-api
  - id: phase5-reviews-components
    content: Update review components to use new React Query hook instead of server actions
    status: pending
    dependencies:
      - phase5-reviews-hooks
  - id: phase6-profile-api
    content: "Create profile API route: PATCH /api/profile"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase6-profile-hooks
    content: Create React Query hook for profile mutations (use-profile-mutations.ts)
    status: pending
    dependencies:
      - phase6-profile-api
  - id: phase6-profile-components
    content: Update profile components to use new React Query hook instead of server actions
    status: pending
    dependencies:
      - phase6-profile-hooks
  - id: phase7-auth-api
    content: "Create auth API routes: POST /api/auth/signup, POST /api/auth/join-community, POST /api/auth/resend-verification, POST /api/auth/accept-legal-documents, POST /api/auth/forgot-password, POST /api/auth/reset-password, POST /api/auth/admin-login"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase7-auth-redirects
    content: Create redirect handler utility (redirect-handler.ts) for handling API redirect responses
    status: pending
    dependencies:
      - phase7-auth-api
  - id: phase7-auth-hooks
    content: Create React Query hooks for auth mutations (use-auth-mutations.ts) with redirect handling
    status: pending
    dependencies:
      - phase7-auth-redirects
  - id: phase7-auth-components
    content: Update auth components to use new React Query hooks instead of server actions
    status: pending
    dependencies:
      - phase7-auth-hooks
  - id: phase8-onboarding-api
    content: "Create onboarding API route: POST /api/onboarding"
    status: pending
    dependencies:
      - phase1-utilities
      - phase7-auth-redirects
  - id: phase8-onboarding-hooks
    content: Create React Query hook for onboarding mutation (use-onboarding-mutation.ts)
    status: pending
    dependencies:
      - phase8-onboarding-api
  - id: phase8-onboarding-components
    content: Update onboarding components to use new React Query hook instead of server actions
    status: pending
    dependencies:
      - phase8-onboarding-hooks
  - id: phase9-admin-api
    content: "Create admin API routes: POST /api/admin/listings/[listingId]/approve, POST /api/admin/listings/[listingId]/reject, DELETE /api/admin/legal-documents/[documentId]/[version]"
    status: pending
    dependencies:
      - phase1-utilities
  - id: phase9-admin-hooks
    content: Create React Query hooks for admin mutations (use-admin-mutations.ts)
    status: pending
    dependencies:
      - phase9-admin-api
  - id: phase9-admin-components
    content: Update admin components to use new React Query hooks instead of server actions
    status: pending
    dependencies:
      - phase9-admin-hooks
  - id: cleanup-server-actions
    content: Remove old server action files after all components are migrated and tested
    status: pending
    dependencies:
      - phase2-listings-components
      - phase3-rentals-components
      - phase4-messages-components
      - phase5-reviews-components
      - phase6-profile-components
      - phase7-auth-components
      - phase8-onboarding-components
      - phase9-admin-components
---

# Server Actions to API Routes Migration Plan

## Architecture Overview

The migration follows this flow:

```
DB → DAL → API Routes → React Query → UI
```

Middleware (`proxy.ts`) handles authentication and route protection before requests reach API routes.

## Migration Strategy

### Phase 1: Core Infrastructure (Foundation)

#### 1.1 Create API Route Utilities

- Create `src/lib/api/route-helpers.ts` with shared utilities:
  - `handleApiError()` - Consistent error response formatting
  - `requireAuth()` - Authentication check wrapper
  - `requireAdmin()` - Admin check wrapper
  - `parseFormData()` - FormData to object conversion
  - `getClientIP()` - Extract IP from request headers
  - `getUserAgent()` - Extract user agent from request headers

#### 1.2 Create React Query Mutation Utilities

- Create `src/lib/react-query/mutation-helpers.ts`:
  - `createMutation()` - Wrapper for consistent mutation patterns
  - `handleMutationError()` - Error handling with toast notifications
  - `invalidateQueries()` - Cache invalidation helpers

### Phase 2: Listings API Routes (7 actions)

#### 2.1 Create Listing API Routes

- **POST `/api/listings`** - Create listing
  - Handle FormData or JSON
  - Validate with `createListingSchemaServer`
  - Check Stripe onboarding status
  - Record 4 legal document acceptances (IP/user agent tracking)
  - Return `{ success: true, listingId: string }` or `{ error: string }`

- **PATCH `/api/listings/[listingId]`** - Update listing
  - Validate ownership via DAL
  - Validate with `createListingSchemaServer`
  - Return `{ success: true, listingId: string }` or `{ error: string }`

- **PATCH `/api/listings/[listingId]/status`** - Update listing status
  - Validate status enum: `"available" | "maintenance" | "inactive"`
  - Return `{ success: true, listing: Listing }` or `{ error: string }`

- **POST `/api/listings/analyze-image`** - Analyze tool image
  - Accept `{ imageUrls: string | string[] }`
  - Call `analyzeToolImage` service
  - Return `{ success: true, data: AnalysisResult }` or `{ error: string }`

#### 2.2 Create React Query Hooks for Listings

- Create `src/features/listings/hooks/use-listing-mutations.ts`:
  - `useCreateListing()` - Mutation with optimistic update
  - `useUpdateListing()` - Mutation with cache invalidation
  - `useUpdateListingStatus()` - Mutation with cache invalidation
  - `useAnalyzeToolImage()` - Mutation for image analysis
  - Invalidate `["listings"]`, `["garage"]`, `["listing-details"]` queries on success

#### 2.3 Update Components

- Replace `createListing` server action with `useCreateListing()` hook
- Replace `updateListing` server action with `useUpdateListing()` hook
- Replace `updateListingStatus` server action with `useUpdateListingStatus()` hook
- Update forms to use React Query mutations instead of `useActionState`

### Phase 3: Rentals API Routes (7 actions)

#### 3.1 Create Rental API Routes

- **POST `/api/rentals`** - Create rental request
  - Handle FormData with legal document acceptances
  - Record 4 legal document acceptances (IP/user agent tracking)
  - Send notification to owner
  - Return `{ success: true, requestId: string, message: string }` or `{ error: string }`

- **POST `/api/rentals/[id]/approve`** - Approve rental request
  - Validate request body: `{ pickupInstructions?: string, returnInstructions?: string }`
  - Process Stripe payment with retry logic
  - Authorize security deposit
  - Send payment success notifications
  - Return `{ success: true, paymentIntentId: string, securityDepositAuthId?: string }` or `{ error: string, paymentFailed?: boolean }`

- **POST `/api/rentals/[id]/decline`** - Decline rental request
  - Validate request body: `{ denialReason: string }`
  - Send denial notification
  - Return `{ success: true }` or `{ error: string }`

- **POST `/api/rentals/[id]/cancel`** - Cancel rental request
  - Only renter can cancel pending requests
  - Send cancellation notification
  - Return `{ success: true }` or `{ error: string }`

- **POST `/api/rentals/[id]/start`** - Start rental
  - Only owner can start approved rentals
  - Send rental started notification
  - Return `{ success: true }` or `{ error: string }`

- **POST `/api/rentals/[id]/end`** - End rental
  - Only owner can end active rentals
  - Send rental ended notification
  - Return `{ success: true }` or `{ error: string }`

- **PATCH `/api/rentals/[id]/instructions`** - Update rental instructions
  - Validate request body: `{ pickupInstructions?: string, returnInstructions?: string }`
  - Send instructions updated notification
  - Return `{ success: true }` or `{ error: string }`

#### 3.2 Create React Query Hooks for Rentals

- Create `src/features/rentals/hooks/use-rental-mutations.ts`:
  - `useCreateRentalRequest()` - Mutation with optimistic update
  - `useApproveRentalRequest()` - Mutation with payment processing
  - `useDeclineRentalRequest()` - Mutation with notification
  - `useCancelRentalRequest()` - Mutation
  - `useStartRental()` - Mutation
  - `useEndRental()` - Mutation
  - `useUpdateRentalInstructions()` - Mutation
  - Invalidate `["rentals"]`, `["renting"]`, `["lending"]` queries on success

### Phase 4: Messages API Routes (7 actions)

#### 4.1 Create Message API Routes

- **POST `/api/messages/conversations`** - Start conversation
  - Validate request body: `{ recipientId: string, listingId: string, listingName: string, message: string }`
  - Return `{ success: true, conversationId: string }` or `{ error: string }`

- **POST `/api/messages/conversations/[conversationId]/messages`** - Send message
  - Validate request body: `{ content: string }`
  - Return `{ success: true, data: Message }` or `{ error: string }`

- **POST `/api/messages/conversations/[conversationId]/archive`** - Archive conversation
  - Return `{ success: true, data: Conversation }` or `{ error: string }`

- **POST `/api/messages/conversations/[conversationId]/unarchive`** - Unarchive conversation
  - Return `{ success: true, data: Conversation }` or `{ error: string }`

- **POST `/api/messages/conversations/[conversationId]/read`** - Mark as read
  - Return `{ success: true, data: Conversation }` or `{ error: string }`

- **POST `/api/messages/conversations/[conversationId]/unread`** - Mark as unread
  - Return `{ success: true, data: Conversation }` or `{ error: string }`

- **DELETE `/api/messages/conversations/[conversationId]`** - Delete conversation
  - Return `{ success: true, data: Conversation }` or `{ error: string }`

#### 4.2 Create React Query Hooks for Messages

- Create `src/features/messages/hooks/use-message-mutations.ts`:
  - `useStartConversation()` - Mutation
  - `useSendMessage()` - Mutation with optimistic update
  - `useArchiveConversation()` - Mutation
  - `useUnarchiveConversation()` - Mutation
  - `useMarkConversationRead()` - Mutation
  - `useMarkConversationUnread()` - Mutation
  - `useDeleteConversation()` - Mutation
  - Invalidate `["conversations"]`, `["conversation-details"]` queries on success

### Phase 5: Reviews API Routes (1 action)

#### 5.1 Create Review API Route

- **POST `/api/reviews`** - Create review
  - Handle FormData or JSON
  - Validate with `reviewSchema`
  - Return `{ success: true, reviewId: string }` or `{ error: string }`

#### 5.2 Create React Query Hook for Reviews

- Create `src/features/reviews/hooks/use-review-mutations.ts`:
  - `useCreateReview()` - Mutation
  - Invalidate `["reviews"]`, `["rental-details"]` queries on success

### Phase 6: Users/Profile API Routes (2 actions)

#### 6.1 Create Profile API Routes

- **PATCH `/api/profile`** - Update user profile and address
  - Validate with `UpdateUserProfileSchema`
  - Update both user profile and address
  - Return `{ success: true }` or `{ error: string, details?: ValidationError }`

#### 6.2 Create React Query Hook for Profile

- Create `src/features/users/hooks/use-profile-mutations.ts`:
  - `useUpdateUserProfile()` - Mutation
  - Invalidate `["profile"]`, `["user"]` queries on success

### Phase 7: Auth API Routes (7 actions)

#### 7.1 Create Auth API Routes

- **POST `/api/auth/signup`** - Sign up
  - Handle FormData: `{ email, password, firstName, lastName, legalAccepted }`
  - Create account with Better Auth
  - Record legal document acceptances (TOS, Privacy)
  - Return `{ success: true, redirect: "/verify-email?email=..." }` or `{ error: string }`

- **POST `/api/auth/join-community`** - Join community
  - Handle FormData: `{ joinCode: string }`
  - Validate join code
  - Join community
  - Update user status to `incomplete_profile`
  - Return `{ success: true, redirect: "/onboarding" }` or `{ error: string }`

- **POST `/api/auth/resend-verification`** - Resend verification email
  - Handle FormData: `{ email: string }`
  - Use Better Auth API
  - Return `{ success: true, message: string }` or `{ error: string }`

- **POST `/api/auth/accept-legal-documents`** - Accept legal documents (OAuth flow)
  - Handle FormData: `{ tosAccepted: boolean, privacyAccepted: boolean }`
  - Record legal document acceptances
  - Update user status
  - Return `{ success: true, redirect: "/join-code" }` or `{ error: string }`

- **POST `/api/auth/forgot-password`** - Forgot password
  - Handle FormData: `{ email: string }`
  - Use Better Auth API
  - Return `{ success: true, message: string }` or `{ error: string }`

- **POST `/api/auth/reset-password`** - Reset password
  - Handle FormData: `{ token: string, password: string }`
  - Use Better Auth API
  - Return `{ success: true, redirect: "/login?message=password-reset-success" }` or `{ error: string }`

- **POST `/api/auth/admin-login`** - Admin login
  - Handle FormData: `{ email: string, password: string }`
  - Authenticate with Better Auth
  - Verify admin privileges
  - Return `{ success: true }` or `{ error: string }`

#### 7.2 Handle Redirects in Client

- Create `src/lib/api/redirect-handler.ts`:
  - `handleApiRedirect()` - Process redirect URLs from API responses
  - Use `router.push()` for client-side redirects
- Update auth forms to handle redirect responses

### Phase 8: Onboarding API Route (1 action)

#### 8.1 Create Onboarding API Route

- **POST `/api/onboarding`** - Complete onboarding
  - Handle FormData with user profile and address
  - Validate with `onboardingSchema`
  - Update user profile and address
  - Update user status to `active`
  - Return `{ success: true, redirect: "/dashboard" }` or `{ error: string }`

#### 8.2 Create React Query Hook for Onboarding

- Create `src/features/onboarding/hooks/use-onboarding-mutation.ts`:
  - `useCompleteOnboarding()` - Mutation with redirect handling

### Phase 9: Admin API Routes (3 actions)

#### 9.1 Create Admin API Routes

- **POST `/api/admin/listings/[listingId]/approve`** - Approve listing
  - Require admin authentication
  - Update approval status
  - Send approval notification (in-app + email)
  - Return `{ success: true }` or `{ error: string }`

- **POST `/api/admin/listings/[listingId]/reject`** - Reject listing
  - Require admin authentication
  - Validate rejection reason
  - Update approval status with reason
  - Send rejection notification (in-app + email)
  - Return `{ success: true }` or `{ error: string }`

- **DELETE `/api/admin/legal-documents/[documentId]/[version]`** - Delete document version
  - Require admin authentication
  - Validate document ID and version
  - Delete version from database and blob storage
  - Return `{ success: true }` or `{ error: string }`

#### 9.2 Create React Query Hooks for Admin

- Create `src/features/admin/hooks/use-admin-mutations.ts`:
  - `useApproveListing()` - Mutation
  - `useRejectListing()` - Mutation
  - `useDeleteDocumentVersion()` - Mutation
  - Invalidate `["admin", "pending-reviews"]`, `["admin", "review-history"]` queries on success

## Implementation Patterns

### API Route Pattern

```typescript
// src/app/api/resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { resourceDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await parseFormData(request);
    const validated = schema.parse(body);

    const { data, error } = await tryCatch(resourceDAL.create(validated));

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### React Query Mutation Pattern

```typescript
// src/features/resource/hooks/use-resource-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export function useCreateResource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateResourceData) => {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create resource");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Success", description: "Resource created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
```

## Special Considerations

### 1. Legal Document Acceptance Tracking

- Extract IP address and user agent in API routes using `getClientIP()` and `getUserAgent()`
- Pass to DAL methods for recording acceptances
- Maintain audit trail for legal compliance

### 2. Payment Processing

- Keep Stripe payment logic in API routes (server-side only)
- Handle retry logic for network errors
- Return detailed error messages for payment failures
- Update payment status in database

### 3. Notifications

- Keep notification sending in API routes (non-blocking)
- Use `Promise.allSettled()` for multiple notifications
- Log errors but don't fail the operation

### 4. Redirect Handling

- Return redirect URLs in API responses: `{ success: true, redirect: "/path" }`
- Handle redirects in React Query `onSuccess` callbacks
- Use `router.push()` for client-side navigation

### 5. FormData vs JSON

- Support both FormData and JSON in API routes
- Use `parseFormData()` helper to normalize input
- Validate with Zod schemas

### 6. Cache Invalidation

- Replace `revalidatePath()` with `queryClient.invalidateQueries()`
- Invalidate related queries (e.g., listing updates invalidate garage queries)
- Use query key factories for consistent invalidation

### 7. Error Handling

- Use consistent error response format: `{ error: string }`
- Include validation errors: `{ error: string, details?: ValidationError }`
- Map DAL errors to user-friendly messages

## Testing Strategy

### Unit Tests

- Test API routes with mocked DAL methods
- Test React Query hooks with mocked fetch
- Test error handling paths

### Integration Tests

- Test API routes with real database (test DB)
- Test end-to-end flows (create → update → delete)
- Test authentication and authorization

### Migration Checklist

- [ ] Create API route utilities
- [ ] Create React Query mutation utilities
- [ ] Migrate listings actions (7)
- [ ] Migrate rentals actions (7)
- [ ] Migrate messages actions (7)
- [ ] Migrate reviews actions (1)
- [ ] Migrate profile actions (2)
- [ ] Migrate auth actions (7)
- [ ] Migrate onboarding action (1)
- [ ] Migrate admin actions (3)
- [ ] Update all components to use new hooks
- [ ] Remove old server action files
- [ ] Update tests
- [ ] Update documentation

## Files to Create

### API Routes (31 new files)

- `src/app/api/listings/route.ts`
- `src/app/api/listings/[listingId]/route.ts` (PATCH)
- `src/app/api/listings/[listingId]/status/route.ts`
- `src/app/api/listings/analyze-image/route.ts`
- `src/app/api/rentals/route.ts`
- `src/app/api/rentals/[id]/approve/route.ts`
- `src/app/api/rentals/[id]/decline/route.ts`
- `src/app/api/rentals/[id]/cancel/route.ts`
- `src/app/api/rentals/[id]/start/route.ts`
- `src/app/api/rentals/[id]/end/route.ts`
- `src/app/api/rentals/[id]/instructions/route.ts`
- `src/app/api/messages/conversations/route.ts`
- `src/app/api/messages/conversations/[conversationId]/messages/route.ts`
- `src/app/api/messages/conversations/[conversationId]/archive/route.ts`
- `src/app/api/messages/conversations/[conversationId]/unarchive/route.ts`
- `src/app/api/messages/conversations/[conversationId]/read/route.ts`
- `src/app/api/messages/conversations/[conversationId]/unread/route.ts`
- `src/app/api/reviews/route.ts`
- `src/app/api/profile/route.ts` (PATCH)
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/join-community/route.ts`
- `src/app/api/auth/resend-verification/route.ts`
- `src/app/api/auth/accept-legal-documents/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/admin-login/route.ts`
- `src/app/api/onboarding/route.ts`
- `src/app/api/admin/listings/[listingId]/approve/route.ts`
- `src/app/api/admin/listings/[listingId]/reject/route.ts`
- `src/app/api/admin/legal-documents/[documentId]/[version]/route.ts` (DELETE)

### Utilities (3 new files)

- `src/lib/api/route-helpers.ts`
- `src/lib/react-query/mutation-helpers.ts`
- `src/lib/api/redirect-handler.ts`

### React Query Hooks (8 new files)

- `src/features/listings/hooks/use-listing-mutations.ts`
- `src/features/rentals/hooks/use-rental-mutations.ts`
- `src/features/messages/hooks/use-message-mutations.ts`
- `src/features/reviews/hooks/use-review-mutations.ts`
- `src/features/users/hooks/use-profile-mutations.ts`
- `src/features/auth/hooks/use-auth-mutations.ts`
- `src/features/onboarding/hooks/use-onboarding-mutation.ts`
- `src/features/admin/hooks/use-admin-mutations.ts`

## Estimated Effort

- **Phase 1 (Infrastructure)**: 2-3 hours
- **Phase 2 (Listings)**: 4-5 hours
- **Phase 3 (Rentals)**: 6-8 hours (complex payment logic)
- **Phase 4 (Messages)**: 3-4 hours
- **Phase 5 (Reviews)**: 1-2 hours
- **Phase 6 (Profile)**: 1-2 hours
- **Phase 7 (Auth)**: 4-5 hours (redirect handling)
- **Phase 8 (Onboarding)**: 1 hour
- **Phase 9 (Admin)**: 2-3 hours

**Total**: ~24-33 hours

## Risk Mitigation

1. **Gradual Migration**: Migrate one feature area at a time
2. **Backward Compatibility**: Keep server actions until all components migrated
3. **Testing**: Test each API route before updating components
4. **Rollback Plan**: Keep server action files until migration verified
5. **Documentation**: Update component usage as you migrate
