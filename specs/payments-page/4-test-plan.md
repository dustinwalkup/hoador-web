# Payments Page Test Plan

## Requirements Traceability

This test plan maps all tests to specific requirements from `specs/payments-page/1-requirements.md`. Each requirement has corresponding test coverage to ensure complete verification of functionality.

### Requirement 1: Payments Page Creation

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 1

**Test Coverage**:

- Integration tests: Page accessible at `/dashboard/profile/payments`
- Integration tests: Profile navigation shows "Payments" tab
- Integration tests: Page displays Owner and Renter sections
- Integration tests: Non-onboarded users see preview state
- Integration tests: Onboarded users see functional components
- E2E tests: Navigation to Payments page from profile menu
- Unit tests: Page component rendering with different user states

### Requirement 2: Stripe Connect Embedded Components - Owner Section

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 2

**Test Coverage**:

- Integration tests: Balance component loads and displays data
- Integration tests: Payouts component loads with history
- Integration tests: Payments List component displays transactions
- Integration tests: Documents component shows available documents
- Integration tests: Components handle loading states
- Integration tests: Components handle error states with retry
- E2E tests: User can trigger manual payout from Payouts component
- E2E tests: User can export payment data from Payments component
- E2E tests: User can download tax documents from Documents component
- Unit tests: Account session creation with correct component permissions

### Requirement 3: Express Dashboard Link - Advanced Features

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 3

**Test Coverage**:

- Integration tests: "Advanced settings" link appears at bottom of Owner Section
- Integration tests: Link opens Express Dashboard in new tab
- Integration tests: Link is styled as subtle text link
- Integration tests: Link is disabled/hidden for non-onboarded users
- Integration tests: Login link creation API works correctly
- E2E tests: User can access Express Dashboard from Payments page
- Integration tests: Error handling when login link creation fails

### Requirement 4: Renter Payment History Section

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 4

**Test Coverage**:

- Integration tests: Renter Section displays below Owner Section
- Integration tests: Payment history list displays all user's rental payments
- Integration tests: Payment entries show correct information (listing name, dates, amount, status)
- Integration tests: Payment history ordered by most recent first
- Integration tests: Empty state displays when no payment history exists
- Integration tests: Renter Section visible regardless of onboarding status
- Integration tests: Payment entries link to rental details page
- Integration tests: Customer Portal link appears in Renter Section
- E2E tests: User can navigate to rental details from payment entry
- Unit tests: PaymentDAL.getUserRentalPayments() returns correct data

### Requirement 5: Stripe Customer Portal Integration

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 5

**Test Coverage**:

- Integration tests: Customer Portal API endpoint creates session correctly
- Integration tests: API endpoint verifies user authentication
- Integration tests: API endpoint returns 404 if no customer ID exists
- Integration tests: Customer Portal link opens portal in new tab
- Integration tests: Portal session includes correct return URL
- Integration tests: Error handling when portal session creation fails
- Integration tests: Customer Portal link hidden when no customer ID
- E2E tests: User can access Customer Portal and manage payment methods

### Requirement 6: Non-Onboarded User Experience

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 6

**Test Coverage**:

- Integration tests: Preview state displays for non-onboarded users
- Integration tests: Preview shows disabled/grayed-out components
- Integration tests: Clear messaging about Stripe Connect setup requirement
- Integration tests: "Complete Payment Setup" CTA button appears
- Integration tests: Clicking CTA shows onboarding component
- Integration tests: Onboarding completion updates page state
- Integration tests: Renter Section remains functional during preview
- E2E tests: User can complete onboarding from Payments page
- E2E tests: Page refreshes/updates after onboarding completion

### Requirement 7: Global Stripe Notification Banner

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 7

**Test Coverage**:

- Integration tests: Notification banner appears in global header
- Integration tests: Banner visible on all dashboard pages
- Integration tests: Banner displays when Stripe requires action
- Integration tests: Banner doesn't display when no action required
- Integration tests: Banner uses Stripe's embedded NotificationBanner component
- Integration tests: Banner links to Payments page or Stripe dashboard
- Integration tests: Banner styling uses warning/error colors
- Integration tests: Banner responsive on mobile devices
- E2E tests: User can see and interact with notification banner
- Integration tests: Banner only shows for onboarded users

### Requirement 8: Account Session Management

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: Account session creation includes all required components
- Integration tests: Account session API supports multiple components
- Integration tests: Account session creation requires authentication
- Integration tests: Account session creation requires connected account
- Integration tests: Account session expiration handled gracefully
- Integration tests: Components handle session refresh automatically
- Unit tests: Service function creates session with correct component config
- Integration tests: Error handling when account session creation fails

### Requirement 9: Page State Management and Loading

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 9

**Test Coverage**:

- Integration tests: Loading skeletons display during component initialization
- Integration tests: Onboarding status fetched server-side
- Integration tests: Payment history loads independently with own loading state
- Integration tests: Loading states removed when components ready
- Integration tests: Component loading failures show error with retry
- Integration tests: Account session data cached appropriately
- E2E tests: Page load performance meets targets (< 2s)
- Integration tests: Components initialize in parallel where possible

### Requirement 10: Navigation and Accessibility

**Requirement Reference**: `specs/payments-page/1-requirements.md` - Requirement 10

**Test Coverage**:

- Integration tests: "Payments" tab replaces "Billing" in profile navigation
- Integration tests: Tab accessible from `/dashboard/profile/payments`
- Integration tests: Page has clear title and description
- Accessibility tests: All interactive elements have ARIA labels
- Accessibility tests: Keyboard navigation works correctly
- Accessibility tests: Screen reader compatibility verified
- Accessibility tests: Color contrast meets WCAG AA standards
- Integration tests: Visual hierarchy clear between sections
- Integration tests: Section headers clearly labeled

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions, methods, and components in isolation.

**When to Use**:

- Service layer functions (createAccountSession, createCustomerPortalSession)
- DAL methods (getUserRentalPayments)
- Component rendering logic
- Error handling functions
- Type validation

**Coverage Goals**: 85%+ for service functions, 80%+ for DAL methods, 75%+ for components

**Framework**: Vitest with React Testing Library for components

**Test Structure** (AAA Pattern):

```typescript
describe("createAccountSession", () => {
  it("should create account session with all required components", async () => {
    // Arrange
    const accountId = "acct_123";
    const components = {
      balances: { enabled: true },
      payouts: { enabled: true },
      // ... other components
    };

    // Act
    const clientSecret = await createAccountSession(accountId, { components });

    // Assert
    expect(clientSecret).toBeDefined();
    expect(PAYMENT_SERVER_INSTANCE.accountSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        account: accountId,
        components: expect.objectContaining(components),
      }),
    );
  });
});
```

**Key Unit Tests**:

1. `createAccountSession()` with various component configurations
2. `createCustomerPortalSession()` with valid/invalid customer IDs
3. `PaymentDAL.getUserRentalPayments()` with various scenarios
4. Component rendering with different props (onboarded/not onboarded)
5. Error handling in service functions
6. Account session component configuration validation

### Integration Tests

**Purpose**: Test interactions between components, API routes, and database.

**When to Use**:

- API route handlers
- Server component data fetching
- Client component initialization with Stripe Connect
- Database queries and data retrieval
- Component integration with Stripe embedded components

**Coverage Goals**: 80%+ for API routes, 75%+ for page components

**Framework**: Vitest with Next.js test utilities

**Test Structure**:

```typescript
describe("POST /api/stripe/create-account-session", () => {
  it("should create account session with embedded components", async () => {
    // Arrange
    const user = await createTestUser({ onboarded: true });
    const session = await createTestSession(user.id);

    // Act
    const response = await POST("/api/stripe/create-account-session", {
      headers: { cookie: session.cookie },
    });

    // Assert
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.clientSecret).toBeDefined();
    expect(data.clientSecret).toMatch(/^acs_/);
  });
});
```

**Key Integration Tests**:

1. Account session API route with authentication
2. Customer portal API route with/without customer ID
3. Payments page server component data fetching
4. Client component Stripe Connect initialization
5. Embedded components loading with account session
6. Payment history fetching and display
7. Onboarding flow integration
8. Notification banner display logic
9. Error handling in API routes
10. Database queries for payment history

### End-to-End Tests

**Purpose**: Test complete user workflows from start to finish.

**When to Use**:

- Complete user journeys (onboarded and non-onboarded)
- User interactions with embedded components
- Navigation flows
- Error recovery scenarios

**Coverage Goals**: All critical user paths covered

**Framework**: Playwright or similar E2E testing framework

**Test Scenarios**:

1. **Onboarded User Flow**:
   - Navigate to Payments page
   - Verify embedded components load
   - Interact with Balance component
   - View payout history in Payouts component
   - View payment transactions
   - Download a tax document
   - Click Express Dashboard link (verify opens in new tab)
   - View rental payment history
   - Click Customer Portal link (verify opens in new tab)

2. **Non-Onboarded User Flow**:
   - Navigate to Payments page
   - Verify preview state displays
   - Click "Complete Payment Setup" CTA
   - Complete Stripe Connect onboarding
   - Verify page updates to show functional components
   - Verify Renter Section still works

3. **Error Recovery Flow**:
   - Simulate network failure during component load
   - Verify error message displays
   - Click retry button
   - Verify components load successfully

4. **Notification Banner Flow**:
   - Set up user with required Stripe action
   - Navigate to any dashboard page
   - Verify notification banner appears
   - Click banner link
   - Verify navigation to Payments page or Stripe dashboard

### Manual Testing Scenarios

**Purpose**: Test scenarios that are difficult to automate or require human judgment.

**Test Scenarios**:

1. **Various Stripe Account States**:
   - Test with active account (normal operation)
   - Test with restricted account (limited capabilities)
   - Test with suspended account (error handling)
   - Test with account requiring verification

2. **Payment History Scenarios**:
   - User with no payment history (empty state)
   - User with single payment
   - User with many payments (pagination if implemented)
   - User with payments in different statuses (succeeded, pending, failed)

3. **Mobile Responsiveness**:
   - Test on various mobile device sizes
   - Test embedded components on mobile
   - Test navigation and layout on mobile
   - Test touch interactions

4. **Browser Compatibility**:
   - Test in Chrome, Firefox, Safari, Edge
   - Test Stripe embedded components in all browsers
   - Verify no console errors

5. **Performance Testing**:
   - Measure page load time
   - Measure component initialization time
   - Test with slow network connection
   - Test with large payment history datasets

6. **Accessibility Testing**:
   - Test with screen reader (NVDA, JAWS, VoiceOver)
   - Test keyboard-only navigation
   - Test color contrast with accessibility tools
   - Verify ARIA labels are correct

## Test Data Requirements

### Test Users

- Onboarded user with Stripe Connect account
- Non-onboarded user (no Stripe account)
- User with payment history (multiple rentals)
- User with no payment history
- User with Stripe customer ID
- User without Stripe customer ID
- User with suspended Stripe account

### Test Stripe Accounts

- Active Express account (charges_enabled: true, payouts_enabled: true)
- Incomplete account (charges_enabled: false, payouts_enabled: false)
- Restricted account (requires action)
- Account with balance and payout history
- Account with payment transactions
- Account with tax documents available

### Test Payment Data

- Payments in various statuses (succeeded, pending, failed, refunded)
- Payments linked to different rentals
- Payments with different amounts
- Payments from different time periods

## Test Environment Setup

### Required Environment Variables

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key (for server-side tests)
- `DATABASE_URL` - Test database connection
- `NEXT_PUBLIC_APP_URL` - Application URL for portal return URLs

### Test Database

- Use separate test database
- Seed with test users and payment data
- Clean up after each test suite
- Use transactions for test isolation

### Stripe Test Mode

- Use Stripe test mode for all tests
- Create test connected accounts
- Use test payment methods
- Mock Stripe webhooks for testing

## Test Execution Strategy

### Pre-Implementation Testing

- Unit tests for service functions
- Unit tests for DAL methods
- Integration tests for API routes

### During Implementation Testing

- Component unit tests as components are built
- Integration tests as features are integrated
- Manual testing of each feature as completed

### Post-Implementation Testing

- Full E2E test suite
- Manual testing of all scenarios
- Performance testing
- Accessibility testing
- Browser compatibility testing

### Regression Testing

- Re-run all tests after bug fixes
- Re-run critical path tests before releases
- Monitor test coverage to ensure no regression

## Success Criteria

All tests must pass before considering the feature complete:

1. ✅ All unit tests pass (85%+ coverage for critical paths)
2. ✅ All integration tests pass (80%+ coverage)
3. ✅ All E2E tests pass for critical user flows
4. ✅ Manual testing scenarios verified
5. ✅ Performance targets met (page load < 2s, components < 3s)
6. ✅ Accessibility requirements met (WCAG AA)
7. ✅ No console errors in browser
8. ✅ Works on all supported browsers
9. ✅ Mobile responsive design verified
10. ✅ Error handling tested and working

## Known Limitations

- Stripe embedded components cannot be fully mocked - require Stripe test mode
- Some Stripe features require live test accounts (cannot use mocks)
- E2E tests may be flaky due to Stripe API response times
- Customer Portal testing requires actual Stripe customer accounts

## Test Maintenance

- Update tests when Stripe API changes
- Update tests when component APIs change
- Add tests for new edge cases discovered
- Maintain test data freshness
- Review and update test coverage regularly
