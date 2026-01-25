# Payments Page Implementation Tasks

## Overview

This document breaks down the Payments page feature implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

## Task List

### Phase 1: Service Layer Extensions

- [x] 1. Extend createAccountSession to support multiple components
  - Modify `createAccountSession()` in `src/services/stripe/connect.ts`
  - Add optional `components` parameter with type `AccountSessionComponents`
  - Support components: balances, payouts, payouts_list, payments, documents, notification_banner
  - Update function signature to accept components configuration
  - Pass components to Stripe accountSessions.create() call
  - Maintain backward compatibility (default to onboarding component if no components specified)
  - Add TypeScript interface for `AccountSessionComponents`
  - _Requirements: 2.8, 8.2_

- [x] 2. Create customer portal session service function
  - Add `createCustomerPortalSession()` function to `src/services/stripe/connect.ts`
  - Accept customerId and options (return_url)
  - Call `PAYMENT_SERVER_INSTANCE.billingPortal.sessions.create()`
  - Return portal URL from session
  - Handle errors with tryCatch pattern
  - Add JSDoc documentation
  - _Requirements: 4.11, 5.2_

### Phase 2: API Routes

- [x] 3. Extend account session API route for embedded components
  - Modify `src/app/api/stripe/create-account-session/route.ts`
  - Update to call extended `createAccountSession()` with all required components
  - Include components: balances, payouts, payouts_list, payments, documents, notification_banner
  - Maintain existing authentication and error handling
  - Return client secret in response
  - Test with existing onboarding flow to ensure backward compatibility
  - _Requirements: 2.9, 8.1, 8.2_

- [x] 4. Create customer portal session API route
  - Create new file `src/app/api/stripe/create-customer-portal-session/route.ts`
  - Verify user authentication using `getCurrentUserId()`
  - Get user's Stripe customer ID from database
  - Return 404 error if user has no customer ID
  - Call `createCustomerPortalSession()` service function
  - Return portal URL in response
  - Handle errors with appropriate status codes
  - Add error handling for missing customer ID
  - _Requirements: 4.11, 5.1, 5.2, 5.3, 5.7_

### Phase 3: Data Access Layer Extensions

- [x] 5. Create PaymentDAL class or extend existing payment methods
  - Check if `src/dal/payment.dal.ts` exists, create if needed
  - Or extend existing payment-related DAL methods
  - Add `getUserRentalPayments()` method
  - Query payments table joined with rentals and listings
  - Filter by renterId matching userId
  - Order by paymentDate DESC (most recent first)
  - Return array of `RentalPayment` objects
  - Include all required fields: id, rentalId, listingName, amount, status, dates
  - Handle empty results gracefully
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 6. Add RentalPayment type definition
  - Create or update type definitions file
  - Define `RentalPayment` interface with all required fields
  - Include: id, rentalId, listingId, listingName, amount, status, paymentDate, rental dates
  - Export type for use in components
  - _Requirements: 4.3_

### Phase 4: Profile Navigation Updates

- [x] 7. Update profile navigation constants
  - Modify `src/constants/profile.ts`
  - Replace "Billing" tab with "Payments" tab
  - Update tab value from "billing" to "payments"
  - Ensure label is "Payments"
  - Verify tab order and positioning
  - _Requirements: 1.3, 10.1, 10.2_

### Phase 5: Payments Page Structure

- [x] 8. Create payments page server component
  - Create `src/app/dashboard/profile/payments/page.tsx`
  - Import necessary dependencies (getCurrentUser, userDAL, paymentDAL)
  - Fetch user data and onboarding status server-side
  - Fetch rental payment history using PaymentDAL
  - Render PageHeader with title and description
  - Wrap content in ProfileTabs component
  - Pass data to client component
  - Handle loading and error states
  - _Requirements: 1.1, 1.2, 4.1, 9.2_

- [x] 9. Create payments page client component
  - Create `src/features/users/components/payments/payments-page-client.tsx`
  - Add "use client" directive
  - Accept props: isOnboarded, paymentHistory
  - Initialize Stripe Connect instance if user is onboarded
  - Handle account session creation via fetchClientSecret
  - Manage loading and error states
  - Render OwnerSection and RenterSection conditionally
  - Handle Connect initialization errors
  - _Requirements: 1.6, 1.7, 2.1, 9.1, 9.3_

- [x] 10. Create loading skeleton component
  - Create `src/features/users/components/payments/payments-page-skeleton.tsx`
  - Display skeleton loaders for embedded components
  - Match layout of actual components
  - Use shadcn Skeleton component
  - Show skeleton for Owner Section and Renter Section
  - _Requirements: 9.1_

- [x] 11. Create error component
  - Create `src/features/users/components/payments/payments-page-error.tsx`
  - Display error message in Card component
  - Include retry button that reloads page
  - Show user-friendly error message
  - Use appropriate error styling
  - _Requirements: 9.4, 9.8_

### Phase 6: Owner Section Components

- [x] 12. Create owner section component
  - Create `src/features/users/components/payments/owner-section.tsx`
  - Add "use client" directive
  - Import Stripe Connect embedded components: ConnectBalances, ConnectPayouts, ConnectPayments, ConnectDocuments
  - Create Card layout for each component
  - Display section header with title and description
  - Arrange components in responsive grid (2 columns on large screens)
  - Add Express Dashboard link at bottom (subtle styling)
  - Handle Express Dashboard link click
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_

- [x] 13. Create owner section preview component
  - Create `src/features/users/components/payments/owner-section-preview.tsx`
  - Display disabled/grayed-out preview of components
  - Show clear messaging about Stripe Connect setup requirement
  - Add prominent "Complete Payment Setup" CTA button
  - Handle onboarding start (show ConnectOnboarding component)
  - Use Card components with muted styling
  - _Requirements: 1.7, 6.1, 6.2, 6.3_

- [x] 14. Integrate ConnectOnboarding in preview state
  - Import `ConnectOnboarding` component
  - Show onboarding component when user clicks CTA
  - Handle onboarding completion callback
  - Refresh page or update state after completion
  - Show success message after onboarding
  - _Requirements: 6.4, 6.5, 6.6_

### Phase 7: Renter Section Components

- [x] 15. Create renter section component
  - Create `src/features/users/components/payments/renter-section.tsx`
  - Accept paymentHistory prop
  - Display section header with title and description
  - Add "Manage Payment Methods" button linking to Customer Portal
  - Handle Customer Portal link click
  - Render payment history list or empty state
  - Use Card component for layout
  - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.9, 4.10_

- [x] 16. Create payment history item component
  - Create `src/features/users/components/payments/payment-history-item.tsx`
  - Display individual payment entry
  - Show: listing name, rental dates, amount, payment date, status
  - Add link to rental details page
  - Use appropriate styling for different statuses
  - Format dates and amounts correctly
  - _Requirements: 4.3, 4.8_

- [x] 17. Create empty state for renter section
  - Add empty state to renter section component
  - Display message when no payment history exists
  - Use centered layout with muted text
  - _Requirements: 4.6_

### Phase 8: Global Notification Banner

- [x] 18. Create global notification banner component
  - Create `src/components/stripe-notification-banner.tsx`
  - Add "use client" directive
  - Check if user is onboarded (client-side or server-side check)
  - Initialize Stripe Connect instance if onboarded
  - Render ConnectNotificationBanner component
  - Position in global header/navbar
  - Handle cases where user is not onboarded (don't show)
  - Use appropriate styling (warning colors)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9_

- [x] 19. Integrate notification banner in layout
  - Find global header/navbar component
  - Add StripeNotificationBanner component to layout
  - Ensure it's visible on all dashboard pages
  - Test visibility and positioning
  - Ensure responsive design works
  - _Requirements: 7.2, 7.8, 7.9_

### Phase 9: Component Integration and Styling

- [x] 20. Ensure all components use consistent styling
  - Review all new components for design consistency
  - Use shadcn UI components (Card, Button, etc.)
  - Match existing Hoador design patterns
  - Ensure proper spacing and typography
  - Verify responsive breakpoints
  - _Requirements: 1.9, 2.11, Usability.4_

- [x] 21. Add proper loading states for all async operations
  - Add loading indicators for account session creation
  - Add loading states for Customer Portal link generation
  - Add loading states for payment history fetching
  - Use consistent loading patterns (skeletons, spinners)
  - _Requirements: 9.1, 9.3, 9.5_

- [x] 22. Implement error handling throughout
  - Add error boundaries where appropriate
  - Display user-friendly error messages
  - Provide retry options for failed operations
  - Log errors for debugging
  - Handle network failures gracefully
  - _Requirements: 2.10, 4.7, 5.7, 9.4, 9.8_

### Phase 10: Testing and Validation

- [ ] 23. Test with onboarded user
  - Verify all embedded components load correctly
  - Test Express Dashboard link functionality
  - Test Customer Portal link functionality
  - Verify payment history displays correctly
  - Test responsive design on mobile/tablet
  - _Requirements: All Owner Section requirements_

- [ ] 24. Test with non-onboarded user
  - Verify preview state displays correctly
  - Test onboarding CTA button
  - Verify onboarding flow completes successfully
  - Test page refresh after onboarding
  - Verify Renter Section still works
  - _Requirements: All non-onboarded requirements_

- [ ] 25. Test edge cases
  - Test with user who has no payment history
  - Test with user who has no customer ID
  - Test with suspended Stripe account
  - Test with network failures
  - Test with expired account sessions
  - Test error recovery flows
  - _Requirements: Edge Cases section_

- [ ] 26. Test global notification banner
  - Verify banner appears when action required
  - Verify banner doesn't appear when no action needed
  - Test banner on all dashboard pages
  - Test banner dismissal (if implemented)
  - Verify responsive design
  - _Requirements: 7.1-7.10_

### Phase 11: Cleanup and Migration

- [ ] 27. Update or remove old billing page
  - Decide on migration strategy (redirect or remove)
  - If redirecting: add redirect from `/dashboard/profile/billing` to `/dashboard/profile/payments`
  - If removing: delete `src/app/dashboard/profile/billing/page.tsx`
  - Remove or update `BillingTab` component if no longer needed
  - Update any references to billing page in codebase
  - _Requirements: 1.4_

- [ ] 28. Update any existing references to billing
  - Search codebase for references to "billing" page
  - Update navigation links if any exist
  - Update documentation if needed
  - Verify no broken links
  - _Requirements: 1.4, 1.5_

- [ ] 29. Add accessibility improvements
  - Verify all interactive elements have ARIA labels
  - Test keyboard navigation
  - Verify screen reader compatibility
  - Check color contrast ratios
  - Ensure proper heading hierarchy
  - _Requirements: 10.5, 10.6, 10.7, 10.8_

- [ ] 30. Performance optimization
  - Verify page load times meet targets (< 2s)
  - Optimize component loading (lazy load where appropriate)
  - Verify account session caching works
  - Test with large payment history datasets
  - Optimize database queries if needed
  - _Requirements: Performance section_

## Task Dependencies

- Tasks 1-2 (Service Layer) must be completed before Tasks 3-4 (API Routes)
- Tasks 3-4 (API Routes) must be completed before Tasks 9+ (Client Components)
- Task 5 (PaymentDAL) must be completed before Task 8 (Server Component)
- Task 7 (Navigation) should be done early but can be done in parallel
- Tasks 12-14 (Owner Section) depend on Task 9 (Client Component)
- Tasks 15-17 (Renter Section) depend on Task 5 (PaymentDAL) and Task 9
- Task 18-19 (Notification Banner) can be done in parallel with other components
- Testing tasks (23-26) should be done after all implementation tasks

## Notes

- All Stripe API calls must use server-side endpoints for security
- Embedded components require client-side rendering (cannot be SSR)
- Account sessions expire - components handle re-authentication automatically
- Customer Portal requires Stripe customer ID - handle missing ID gracefully
- Maintain backward compatibility with existing onboarding flow
- Follow existing code patterns and architecture from codebase
