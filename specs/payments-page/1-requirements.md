# Payments Page - Stripe Connect Account Access Requirements

## Introduction

Tool owners currently have no clear way to access their Stripe Connect account from within the Hoador app. While an "Express Dashboard" button exists on the Billing page, it's not discoverable and requires users to leave the app. This feature creates a new **Payments page** with embedded Stripe Connect components, providing in-app access to earnings, payouts, financial documents, and rental payment history.

The implementation follows a hybrid approach (Phase 1) where common features are embedded directly in the app, while advanced features link to Stripe's Express Dashboard. This allows for a seamless user experience while maintaining access to all Stripe capabilities. Future phases will embed additional components to reduce dependency on external dashboards.

## Requirements

### Requirement 1: Payments Page Creation

**User Story:** As a tool owner, I want a dedicated Payments page to manage my earnings and financial information, so that I can easily access my Stripe account without leaving the app.

#### Acceptance Criteria

1. The system SHALL create a new page at `/dashboard/profile/payments` that replaces the existing Billing page
2. WHEN a user navigates to `/dashboard/profile/payments` THEN the system SHALL display the Payments page
3. The system SHALL update the profile navigation tabs to replace "Billing" with "Payments" in `src/constants/profile.ts`
4. The system SHALL remove or deprecate the existing Billing page at `/dashboard/profile/billing`
5. The Payments page SHALL be accessible from the Profile tab navigation menu
6. The Payments page SHALL display two main sections:
   - Owner Section (Stripe Connect) - for managing earnings and payouts
   - Renter Section - for viewing rental payment history
7. WHERE a user has not completed Stripe Connect onboarding THEN the Owner Section SHALL display a disabled/preview state with a call-to-action to complete onboarding
8. WHERE a user has completed Stripe Connect onboarding THEN the Owner Section SHALL display fully functional embedded Stripe components
9. The system SHALL ensure the page is responsive and works on mobile devices
10. The system SHALL maintain consistent styling with the rest of the Hoador application

### Requirement 2: Stripe Connect Embedded Components - Owner Section

**User Story:** As a tool owner, I want to view my balance, payouts, payment history, and documents directly in the app, so that I can manage my earnings without leaving Hoador.

#### Acceptance Criteria

1. The Owner Section SHALL display the following embedded Stripe Connect components:
   - Balance Component - showing available, pending, and in-transit balances
   - Payouts Component - showing payout history with ability to trigger manual payouts
   - Payments List Component - showing transaction history from tool rentals
   - Documents Component - showing downloadable tax documents (1099s, etc.)
2. WHEN the Balance component loads THEN the system SHALL display real-time balance information from the user's Stripe Connect account
3. WHEN the Payouts component loads THEN the system SHALL display the user's payout history with dates, amounts, and status
4. WHERE the user has available balance THEN the Payouts component SHALL allow the user to trigger a manual payout
5. WHEN the Payments List component loads THEN the system SHALL display all payment transactions from tool rentals, ordered by most recent first
6. The Payments List component SHALL support filtering and export capabilities as provided by Stripe's embedded component
7. WHEN the Documents component loads THEN the system SHALL display all available tax documents for download
8. The system SHALL create an account session with the required component permissions when loading the Payments page
9. The system SHALL extend `/api/stripe/create-account-session` to support the new embedded components (balances, payouts, payments, documents)
10. WHERE an embedded component fails to load THEN the system SHALL display an error message with an option to retry
11. All embedded components SHALL be styled to match the Hoador application theme
12. The embedded components SHALL be mobile-responsive and work on all device sizes

### Requirement 3: Express Dashboard Link - Advanced Features

**User Story:** As a tool owner, I want access to advanced Stripe features like account management and disputes, so that I can handle all aspects of my payment account.

#### Acceptance Criteria

1. The Owner Section SHALL include a subtle "Advanced settings" link at the bottom of the section
2. WHEN a user clicks the "Advanced settings" link THEN the system SHALL open the Stripe Express Dashboard in a new tab
3. The Express Dashboard link SHALL be styled as a subtle text link, not a prominent button
4. The link SHALL use the existing `/api/stripe/create-login-link` endpoint to generate the login URL
5. WHERE the user has not completed onboarding THEN the "Advanced settings" link SHALL be disabled or hidden
6. The Express Dashboard SHALL provide access to:
   - Account management (bank accounts, business information)
   - Disputes management
   - Additional advanced features not yet embedded
7. The system SHALL display a loading state while generating the login link
8. WHERE the login link creation fails THEN the system SHALL display an error message to the user

### Requirement 4: Renter Payment History Section

**User Story:** As a renter, I want to view my payment history for rentals I've made, so that I can track my spending and access receipts.

#### Acceptance Criteria

1. The Payments page SHALL display a "Renter Section" below the Owner Section
2. The Renter Section SHALL display a list of all rental payments made by the user
3. Each payment entry SHALL display:
   - Rental listing name
   - Rental dates
   - Payment amount
   - Payment date
   - Payment status (succeeded, pending, failed)
   - Link to view rental details
4. The payment history SHALL be ordered by most recent payment first
5. The system SHALL fetch rental payment data from the database (payments table linked to rentals)
6. WHERE a user has no rental payment history THEN the Renter Section SHALL display an empty state message
7. The Renter Section SHALL be visible to all users, regardless of Stripe Connect onboarding status
8. WHEN a user clicks on a payment entry THEN the system SHALL navigate to the rental details page
9. The Renter Section SHALL include a link to the Stripe Customer Portal for managing payment methods and viewing detailed billing history
10. WHEN a user clicks the Customer Portal link THEN the system SHALL create a customer portal session and open it in a new tab
11. The system SHALL create a new API endpoint `/api/stripe/create-customer-portal-session` to generate customer portal links
12. WHERE the user has no Stripe customer ID THEN the Customer Portal link SHALL be hidden or disabled

### Requirement 5: Stripe Customer Portal Integration

**User Story:** As a renter, I want to access the Stripe Customer Portal to manage my payment methods and view detailed billing information, so that I can handle payment-related tasks.

#### Acceptance Criteria

1. The system SHALL create a new API endpoint at `/api/stripe/create-customer-portal-session` that generates a Stripe Customer Portal session
2. WHEN creating a customer portal session THEN the system SHALL:
   - Verify the user is authenticated
   - Retrieve the user's Stripe customer ID from the database
   - Create a Stripe billing portal session with appropriate return URL
   - Return the portal URL to the client
3. WHERE the user does not have a Stripe customer ID THEN the system SHALL return an error indicating the user needs to make a payment first
4. The Customer Portal link SHALL be displayed in the Renter Section of the Payments page
5. WHEN a user clicks the Customer Portal link THEN the system SHALL open the portal in a new tab
6. The Customer Portal SHALL allow users to:
   - View payment history
   - Manage payment methods
   - Update billing information
   - Download invoices and receipts
7. The system SHALL handle errors gracefully if the portal session creation fails
8. The Customer Portal link SHALL only be visible to users who have made at least one rental payment

### Requirement 6: Non-Onboarded User Experience

**User Story:** As a user who hasn't completed Stripe Connect onboarding, I want to see what the Payments page offers and be prompted to complete setup, so that I understand the value and can get started.

#### Acceptance Criteria

1. WHERE a user has not completed Stripe Connect onboarding THEN the Owner Section SHALL display a disabled/preview state
2. The disabled state SHALL show:
   - Placeholder or grayed-out versions of the embedded components
   - Clear messaging explaining that Stripe Connect setup is required
   - A prominent call-to-action button to "Complete Payment Setup"
3. WHEN a user clicks "Complete Payment Setup" THEN the system SHALL display the embedded Stripe Connect onboarding component
4. The onboarding component SHALL use the existing `ConnectOnboarding` component from `src/features/users/components/connect-onboarding.tsx`
5. WHERE onboarding is displayed THEN the system SHALL replace the preview state with the onboarding form
6. WHEN onboarding is completed THEN the system SHALL:
   - Update the user's onboarding status in the database
   - Refresh the Payments page to show the fully functional Owner Section
   - Display a success message
7. The Renter Section SHALL remain visible and functional even when the user has not completed onboarding
8. The system SHALL check onboarding status using `userDAL.isConnectOnboardingComplete()`

### Requirement 7: Global Stripe Notification Banner

**User Story:** As a tool owner, I want to be notified when Stripe requires action on my account, so that I can address issues promptly and maintain my ability to receive payments.

#### Acceptance Criteria

1. The system SHALL create a global notification banner component that appears in the header/navbar
2. The notification banner SHALL be visible on all dashboard pages when Stripe requires action
3. WHEN Stripe requires action (e.g., verification needed, account issues) THEN the system SHALL display the banner
4. The banner SHALL use Stripe's embedded Notification Banner component from `@stripe/react-connect-js`
5. The notification banner SHALL:
   - Display required actions from Stripe
   - Link to the Payments page or relevant Stripe dashboard
   - Be dismissible (user can close it, but it reappears if action is still required)
   - Use appropriate styling (warning/error colors) to draw attention
6. WHERE no action is required THEN the banner SHALL not be displayed
7. The system SHALL check for required actions when:
   - The Payments page loads
   - User navigates to any dashboard page
   - Stripe webhook events indicate account status changes
8. The notification banner SHALL be positioned in the global header/navbar, visible on all pages
9. The banner SHALL be responsive and work on mobile devices
10. WHERE multiple actions are required THEN the banner SHALL display all required actions or a summary with a link to view details

### Requirement 8: Account Session Management

**User Story:** As a system, I need to properly manage Stripe account sessions for embedded components, so that users can access their Stripe data securely.

#### Acceptance Criteria

1. The system SHALL extend `/api/stripe/create-account-session` to support multiple embedded components
2. WHEN creating an account session THEN the system SHALL include the following components in the session:
   - `balances` - for balance viewing
   - `payouts` - for payout management
   - `payouts_list` - for payout history
   - `payments` - for payment transaction history
   - `documents` - for tax document access
   - `notification_banner` - for required action notifications
3. The account session SHALL be created with appropriate permissions for each component
4. WHERE a user does not have a connected account THEN the system SHALL return an error indicating onboarding is required
5. The account session SHALL expire after a reasonable time period (as defined by Stripe)
6. WHERE an account session expires THEN the system SHALL automatically create a new session when components are accessed
7. The system SHALL handle session creation errors gracefully and display user-friendly error messages
8. Account sessions SHALL only be created for authenticated users with valid connected accounts

### Requirement 9: Page State Management and Loading

**User Story:** As a user, I want the Payments page to load quickly and show appropriate loading states, so that I understand what's happening and don't experience confusion.

#### Acceptance Criteria

1. WHEN the Payments page loads THEN the system SHALL display loading skeletons for embedded components
2. The system SHALL fetch user onboarding status server-side before rendering the page
3. WHERE embedded components are loading THEN the system SHALL show appropriate loading indicators
4. The system SHALL handle component loading failures gracefully with retry options
5. WHERE all components have loaded THEN the system SHALL remove loading states
6. The Renter Section SHALL load payment history data independently and show its own loading state
7. The system SHALL cache account session data appropriately to avoid unnecessary API calls
8. WHERE a component fails to load after retry THEN the system SHALL display an error message with a link to the Express Dashboard as a fallback

### Requirement 10: Navigation and Accessibility

**User Story:** As a user, I want to easily navigate to the Payments page and understand its purpose, so that I can access my financial information when needed.

#### Acceptance Criteria

1. The "Payments" tab SHALL replace "Billing" in the profile navigation tabs
2. The Payments tab SHALL be accessible from `/dashboard/profile/payments`
3. The tab SHALL be clearly labeled and positioned in the profile tab navigation
4. The Payments page SHALL have a clear page title and description
5. The system SHALL ensure the page is accessible to screen readers
6. All interactive elements SHALL have proper ARIA labels
7. The page SHALL support keyboard navigation
8. Color contrast SHALL meet WCAG AA standards
9. The system SHALL provide clear visual hierarchy between Owner and Renter sections
10. Section headers SHALL be clearly labeled ("Earnings & Payouts" for Owner, "Payment History" for Renter)

## Non-Functional Requirements

### Performance

1. The Payments page SHALL load within 2 seconds on a standard connection
2. Embedded Stripe components SHALL initialize within 3 seconds after page load
3. Account session creation SHALL complete within 1 second
4. Payment history data SHALL load within 1.5 seconds
5. The system SHALL use server-side rendering for initial page load where possible
6. Embedded components SHALL lazy-load to improve initial page performance

### Reliability

1. WHERE Stripe API calls fail THEN the system SHALL display user-friendly error messages
2. The system SHALL implement retry logic for transient Stripe API failures
3. Account session creation SHALL be idempotent (safe to retry)
4. WHERE a user's connected account is deleted or closed THEN the system SHALL handle this gracefully
5. The system SHALL validate user authentication before creating account sessions
6. Payment history queries SHALL handle large datasets efficiently (pagination if needed)

### Security

1. Account sessions SHALL only be created for authenticated users
2. The system SHALL verify user ownership of connected accounts before creating sessions
3. Customer portal sessions SHALL only be created for the authenticated user's own customer ID
4. All Stripe API calls SHALL use server-side endpoints (no client-side API keys)
5. The system SHALL sanitize all user inputs before displaying in embedded components
6. Account session secrets SHALL never be exposed to the client (only used server-side)
7. The system SHALL validate Stripe webhook signatures for all webhook events

### Usability

1. The Payments page SHALL be intuitive and require no training to use
2. Error messages SHALL be clear and actionable
3. Loading states SHALL provide clear feedback about what's happening
4. The page SHALL work seamlessly on mobile, tablet, and desktop devices
5. Embedded components SHALL match the Hoador application's design language
6. Section headers and labels SHALL use clear, non-technical language
7. The system SHALL provide tooltips or help text for complex features (if needed)

## Assumptions

1. Users understand that Stripe Connect onboarding is required to receive payouts from tool rentals
2. The existing Stripe Connect infrastructure (account creation, webhooks) continues to function correctly
3. Users have completed at least one rental payment before accessing the Customer Portal
4. Stripe's embedded components will continue to be available and supported
5. The existing `ConnectOnboarding` component can be reused for the onboarding flow
6. Users will primarily access the Payments page from the profile navigation
7. The Express Dashboard will remain available as a fallback for advanced features
8. Stripe webhook events will continue to update user onboarding status automatically

## Constraints

1. Stripe Connect Express accounts are currently limited to US only (hardcoded in `createConnectedAccount`)
2. Embedded components require account sessions which have expiration times
3. Some Stripe features (account management, disputes) will remain in Express Dashboard for Phase 1
4. Customer Portal requires a Stripe customer ID, which may not exist for all users
5. The page must work within Next.js App Router architecture
6. Embedded components must be client-side rendered (cannot be server-side rendered)
7. Account session creation requires server-side API calls for security

## Edge Cases

1. **User deletes Stripe account**: If a user's connected account is deleted, the Owner Section should show an error state with option to re-onboard
2. **Account suspended**: If Stripe suspends an account, embedded components may fail - should show error with link to Express Dashboard
3. **No payment history**: Users who have never rented tools should see an appropriate empty state in Renter Section
4. **No earnings yet**: Users who have completed onboarding but have no earnings should see zero balances appropriately
5. **Concurrent session creation**: If multiple components request sessions simultaneously, the system should handle this efficiently
6. **Session expiration during use**: If a session expires while user is viewing the page, components should handle re-authentication gracefully
7. **Network failures**: If network fails while loading components, user should see clear error with retry option
8. **User switches accounts**: If a user has multiple Stripe accounts (shouldn't happen, but edge case), system should handle appropriately
9. **Webhook delay**: If webhook events are delayed, user status may be temporarily out of sync - should handle gracefully
10. **Customer Portal without customer ID**: Users who haven't made payments won't have customer ID - should hide or disable portal link

## Out of Scope (Future Enhancements)

1. **Phase 2 Features**:
   - Embed Account Management component (currently in Express Dashboard)
   - Embed Disputes List component (currently in Express Dashboard)
   - Remove dependency on Express Dashboard entirely
2. **Advanced Features**:
   - Payment method management within Hoador (currently in Customer Portal)
   - Tax information management UI (currently in Express Dashboard)
   - Payout schedule configuration UI (currently in Express Dashboard)
   - Real-time balance updates via WebSockets
   - Payment analytics and reporting charts
   - Bulk payment operations
   - Payment reminders and notifications
3. **Integration Enhancements**:
   - Email notifications for payout events
   - SMS notifications for large payouts
   - Payment method validation before rental approval
   - Automatic payout scheduling based on user preferences
4. **Admin Features**:
   - Admin view of all user payment statuses
   - Payment dispute resolution tools
   - Platform-wide payment analytics

## Success Criteria

1. Tool owners can access their Stripe Connect account information directly from the Hoador app
2. The Payments page loads and displays embedded components successfully for onboarded users
3. Non-onboarded users see clear CTAs to complete Stripe setup
4. Renters can view their payment history and access the Customer Portal
5. The global notification banner alerts users when Stripe requires action
6. The page replaces the Billing page functionality while adding new capabilities
7. All embedded components work on mobile and desktop devices
8. Error states are handled gracefully with clear user feedback
9. The page integrates seamlessly with existing Hoador navigation and design
10. Performance meets specified targets (page load < 2s, components < 3s)
