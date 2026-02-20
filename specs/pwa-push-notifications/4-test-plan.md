# PWA Push Notifications - Test Plan

## Overview

This test plan defines how to verify the PWA push notifications implementation meets the requirements in `specs/pwa-push-notifications/1-requirements.md`. Tests are mapped to requirements, organized by type (unit, integration, E2E, manual), and include coverage goals, key scenarios, and mock strategies.

## Requirements Traceability

### Requirement 1: Notification Preferences Revamp

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 1

**Test Coverage**:

- Unit tests: PreferenceService.shouldSendEmail() with master off, category off, no row (default), category on
- Unit tests: PreferenceService.shouldSendPush() with same cases
- Unit tests: PreferenceService.getCategoryPreferences() returns defaults when no rows exist
- Unit tests: NotificationCategoryPreferencesDAL.getByUserId() returns defaults
- Unit tests: NotificationCategoryPreferencesDAL.upsert() and upsertMany()
- Integration tests: GET /api/notifications/preferences returns master + categories
- Integration tests: PATCH /api/notifications/preferences persists changes
- Integration tests: sendNotification checks preferences before email
- Integration tests: sendNotification checks preferences before push
- Integration tests: In-app notification always created regardless of preferences

### Requirement 2: Service Worker for Web Push

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 2

**Test Coverage**:

- Manual tests: Service worker registers at /sw.js
- Manual tests: Service worker handles push event and displays notification
- Manual tests: Service worker handles notificationclick and opens linkUrl
- Integration tests: registerServiceWorker() does not throw; handles errors gracefully
- Integration tests: Service worker registration only in browser (SSR-safe)
- E2E tests: Push received when event triggered (with mocked web-push or test endpoint)

### Requirement 3: Push Subscription Management

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 3

**Test Coverage**:

- Unit tests: PushSubscriptionDAL.create() validates subscription shape
- Unit tests: PushSubscriptionDAL.getActiveByUserId() returns only active subscriptions
- Unit tests: PushSubscriptionDAL.deactivate() marks subscription inactive
- Integration tests: POST /api/push/subscribe requires authentication (401)
- Integration tests: POST /api/push/subscribe validates payload (400 invalid)
- Integration tests: POST /api/push/subscribe stores subscription (201)
- Integration tests: DELETE /api/push/subscribe removes subscription
- Integration tests: Multiple subscriptions per user supported

### Requirement 4: Opt-In and Permission Flow

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: usePushPermission.shouldShowPermissionPrompt() returns correct value
- Unit tests: usePushPermission respects Notification.permission state
- Unit tests: usePushPermission respects localStorage "prompted" flag
- Integration tests: Permission not requested on cold load
- Integration tests: Manual enable path in settings triggers permission request
- E2E tests: Permission prompt shown after rental submit (when applicable)
- E2E tests: Permission prompt shown after first approval (when applicable)

### Requirement 5: Permission Request Triggers

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 5

**Test Coverage**:

- Integration tests: Prompt not shown when permission already granted
- Integration tests: Prompt not shown when permission already denied
- Integration tests: Settings page always shows enable option
- E2E tests: Contextual prompt after rental submit uses clear language
- E2E tests: Contextual prompt after approval uses clear language

### Requirement 6: Notification Categories and Preferences

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 6

**Test Coverage**:

- Unit tests: All five categories (bookings, payments, messages, disputes, reminders) supported
- Unit tests: Per-category, per-channel toggles applied correctly
- Integration tests: Preferences UI displays category toggles
- Integration tests: Master switch off disables category toggles (visually or functionally)
- Integration tests: Default preferences for new users have all enabled

### Requirement 7: Push Payload and Deep Linking

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 7

**Test Coverage**:

- Unit tests: buildPushPayload() contains only reference IDs (rentalId, conversationId, disputeId)
- Unit tests: buildPushPayload() excludes PII (names, emails)
- Unit tests: buildPushPayload() excludes financial data (amounts)
- Unit tests: Payload includes linkUrl
- Integration tests: Service worker notificationclick opens correct URL
- Manual tests: Notification tap navigates to intended page

### Requirement 8: Event-to-Push Mapping

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: NOTIFICATION_TYPE_TO_CATEGORY maps all push-relevant types correctly
- Unit tests: rental\_\* types map to bookings
- Unit tests: payment\_\* types map to payments
- Unit tests: message_received maps to messages
- Unit tests: dispute\_\* types map to disputes
- Unit tests: rental_reminder maps to reminders
- Integration tests: Push sent when event occurs and preferences allow
- Integration tests: Push not sent when category disabled

### Requirement 9: Integration with Existing Notification Flow

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 9

**Test Coverage**:

- Integration tests: sendNotification always creates in-app notification
- Integration tests: sendNotification checks preferences before email
- Integration tests: sendNotification checks preferences before push
- Integration tests: Push failure does not block in-app or email
- Integration tests: Category passed to preference check from notification type

### Requirement 10: Revocation and Subscription Cleanup

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 10

**Test Coverage**:

- Unit tests: PushService marks subscription inactive on 410/404 response
- Unit tests: PushService continues to other subscriptions when one fails
- Integration tests: web-push 410 triggers deactivate
- Integration tests: Revocation logged in audit

### Requirement 11: Audit Logging

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 11

**Test Coverage**:

- Unit tests: Audit log created for each push attempt (success and failure)
- Unit tests: Audit log does not contain payload content
- Unit tests: Audit log includes userId, subscriptionId, eventType, sentAt, success
- Integration tests: Audit log queryable by userId, date range, event type
- Integration tests: Failure reason logged when push fails

### Requirement 12: Future Extensibility (Native Push)

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 12

**Test Coverage**:

- Unit tests: push_subscriptions schema supports platform discriminator
- Unit tests: Schema supports token column (nullable for web)
- Design verification: No code precludes adding native support later

### Requirement 13: Pickup and Return Reminders

**Requirement Reference**: `specs/pwa-push-notifications/1-requirements.md` - Requirement 13

**Test Coverage**:

- Integration tests: Reminder cron queries rentals within pickup/return window
- Integration tests: Reminder respects user timezone
- Integration tests: Reminder respects reminders category preference
- Integration tests: Reminder only for approved/active rentals
- Manual tests: Reminder received at correct time

### Non-Functional Requirements

**Performance**:

- Integration tests: sendNotification returns before push completes (non-blocking)
- Manual tests: Preference lookup does not noticeably delay notification flow

**Security**:

- Integration tests: VAPID private key not exposed to client
- Integration tests: POST /api/push/subscribe requires auth
- Unit tests: Push payload contains no PII or financial data

**Reliability**:

- Integration tests: Preference lookup failure results in no email/push (fail closed)
- Integration tests: web-push failure does not affect in-app notification

## Test Types and Strategy

### Unit Tests

**Purpose**: Test individual functions and services in isolation with mocked dependencies.

**Framework**: Vitest

**Coverage Goals**: 80%+ for preference-service, push-service, notification-type-map, push-payload; 70%+ for DAL methods

**Mock Strategy**:

- Mock `notificationCategoryPreferencesDAL` and `userDAL` for PreferenceService
- Mock `pushSubscriptionDAL` and `web-push` for PushService
- Mock database for DAL tests
- Use `vi.mock()` for module-level mocks

**Key Test Files**:

| File                                                                     | Components Tested                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `src/features/notifications/lib/__tests__/preference-service.test.ts`    | shouldSendEmail, shouldSendPush, getCategoryPreferences |
| `src/features/notifications/lib/__tests__/notification-type-map.test.ts` | NOTIFICATION_TYPE_TO_CATEGORY                           |
| `src/features/notifications/lib/__tests__/push-payload.test.ts`          | buildPushPayload, no PII                                |
| `src/dal/__tests__/notifications.dal.test.ts`                            | NotificationCategoryPreferencesDAL, PushSubscriptionDAL |

**Test Structure** (AAA Pattern):

```typescript
describe("PreferenceService", () => {
  describe("shouldSendEmail", () => {
    it("returns false when master switch is off", async () => {
      // Arrange
      vi.mocked(userDAL.getUserPreferences).mockResolvedValue({
        emailNotifications: false,
        pushNotifications: true,
      });

      // Act
      const result = await preferenceService.shouldSendEmail(
        userId,
        "bookings",
      );

      // Assert
      expect(result).toBe(false);
    });

    it("returns true when master on and no category row (default)", async () => {
      // Arrange
      vi.mocked(userDAL.getUserPreferences).mockResolvedValue({
        emailNotifications: true,
        pushNotifications: true,
      });
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([]);

      // Act
      const result = await preferenceService.shouldSendEmail(
        userId,
        "bookings",
      );

      // Assert
      expect(result).toBe(true);
    });
  });
});
```

### Integration Tests

**Purpose**: Test API routes, service integration, and data flow between layers.

**Framework**: Vitest with mocked DALs or test database

**Coverage Goals**: All API routes; sendNotification flow with mocked push; critical paths

**Key Test Files**:

| File                                                                   | Scenarios                            |
| ---------------------------------------------------------------------- | ------------------------------------ |
| `src/app/api/push/subscribe/__tests__/route.test.ts`                   | POST 401, 400, 201; DELETE 204       |
| `src/app/api/notifications/preferences/__tests__/route.test.ts`        | GET, PATCH                           |
| `src/features/notifications/utils/__tests__/send-notification.test.ts` | Preference checks, push non-blocking |

**Mock Strategy**:

- Mock `getAuthenticatedUserResponse` or session for auth
- Mock DALs for database operations
- Mock `webpush.sendNotification` to avoid real network calls
- Use `vi.spyOn` for partial mocks

**Example**:

```typescript
describe("POST /api/push/subscribe", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthenticatedUserResponse).mockResolvedValue(
      unauthorizedResponse,
    );
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 201 and stores subscription when valid", async () => {
    vi.mocked(getAuthenticatedUserResponse).mockResolvedValue({
      userId: "user-1",
    });
    vi.mocked(pushSubscriptionDAL.create).mockResolvedValue(mockSubscription);
    const response = await POST(validSubscribeRequest);
    expect(response.status).toBe(201);
    expect(pushSubscriptionDAL.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ endpoint: expect.any(String) }),
    );
  });
});
```

### End-to-End Tests

**Purpose**: Test complete user workflows in a browser environment.

**Framework**: Playwright (if configured) or Vitest with jsdom for client components

**Coverage Goals**: Critical user paths; permission flow; subscription flow

**BDD Scenarios**:

```gherkin
Feature: Push Notification Opt-In
  As a user
  I want to enable push notifications after a meaningful action
  So that I receive real-time updates

  Scenario: Enable push after submitting rental request
    Given I am logged in
    And I have not yet enabled push notifications
    And I am on a listing page
    When I submit a rental request
    And the request succeeds
    Then I should see a prompt to enable push notifications
    When I click "Enable"
    Then the browser should request notification permission
    And my subscription should be stored

  Scenario: Enable push from account settings
    Given I am logged in
    And I have not yet enabled push notifications
    When I navigate to profile preferences
    And I click "Enable Push Notifications"
    Then the browser should request notification permission
    When I grant permission
    Then my subscription should be stored
    And I should see "Push enabled" status

  Scenario: Preferences persist and affect notifications
    Given I am logged in with push enabled
    And I have disabled the "messages" category for push
    When I receive a new message
    Then I should get an in-app notification
    And I should get an email (if enabled)
    But I should NOT receive a push notification
```

### Manual Testing

**Purpose**: Verify service worker, real push delivery, and cross-browser behavior.

**Scenarios**:

1. **Service worker**: Load app, verify sw.js registers; DevTools > Application > Service Workers
2. **Push delivery**: Trigger event (e.g. rental approval), verify notification appears (desktop/mobile)
3. **Notification click**: Tap notification, verify correct page opens
4. **Preferences UI**: Toggle categories, verify persistence and effect on notifications
5. **Permission flow**: Test grant, deny, and "remind later" behaviors
6. **Multi-device**: Subscribe on two devices, verify both receive push
7. **HTTPS**: Verify push works only over HTTPS (or localhost)

**Browser Matrix**: Chrome, Firefox, Edge, Safari 16+ (iOS/desktop)

## Test Data and Fixtures

### Push Subscription Fixture

```typescript
export const mockPushSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-token",
  keys: {
    p256dh: "base64-encoded-public-key",
    auth: "base64-encoded-auth-secret",
  },
  expirationTime: null,
};
```

### User Preferences Fixture

```typescript
export const mockUserPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  // ... other user_preferences fields
};

export const mockCategoryPreferences = [
  { category: "bookings", email: true, push: true },
  { category: "payments", email: true, push: true },
  { category: "messages", email: true, push: false },
  { category: "disputes", email: true, push: true },
  { category: "reminders", email: true, push: true },
];
```

## Edge Case Test Matrix

| Edge Case                                          | Test Type        | Verification                           |
| -------------------------------------------------- | ---------------- | -------------------------------------- |
| User has no preferences row for category           | Unit             | Default true for both channels         |
| User disables push globally, category push on      | Unit             | shouldSendPush returns false           |
| Subscription expires (410/404)                     | Unit/Integration | Subscription deactivated; audit logged |
| User submits rental and gets approval same session | E2E              | Single permission prompt               |
| Preference lookup fails (DB error)                 | Integration      | No email/push sent (fail closed)       |
| web-push throws 5xx                                | Unit             | Retry once; then skip; audit failure   |
| Multiple subscriptions per user                    | Integration      | All receive push                       |
| Missing VAPID keys                                 | Unit             | Push service no-op; no crash           |

## Test Execution

**Run unit and integration tests**:

```bash
bun run test:run
```

**Run with coverage**:

```bash
bun run test:coverage
```

**Run only notification/push tests** (filter):

```bash
bun run test:run -- notifications
```

**CI**: Include in existing `bun run ci` pipeline.

## Coverage Goals Summary

| Area                               | Target |
| ---------------------------------- | ------ |
| PreferenceService                  | 90%+   |
| notification-type-map              | 100%   |
| push-payload                       | 100%   |
| PushService (with mocks)           | 85%+   |
| NotificationCategoryPreferencesDAL | 80%+   |
| PushSubscriptionDAL                | 80%+   |
| API routes (push, preferences)     | 85%+   |
| sendNotification (extended)        | 80%+   |
