# Test Plan: Notifications

## Requirements Traceability

This test plan covers notification functionality including display, time formatting, email notifications, and notification bell component. Tests verify notification delivery, display, and user experience requirements.

### Core Notification Requirements

**Test Coverage**:

- Unit tests: NotificationsDAL methods, time formatting utilities, email notification utilities
- Integration tests: Notification creation, delivery, marking as read
- E2E tests: Complete notification workflows
- BDD scenarios: Notification acceptance criteria

## Test Types

### Unit Tests

#### DAL Methods

- [ ] `NotificationsDAL.create` - Create notification
  - Happy path: Notification created successfully
  - Error: Invalid data throws ValidationError
  - Edge case: Different notification types

- [ ] `NotificationsDAL.getUserNotifications` - Get user's notifications
  - Happy path: Returns user's notifications
  - Edge case: Empty result set
  - Edge case: Pagination
  - Edge case: Filtering by read/unread

- [ ] `NotificationsDAL.markAsRead` - Mark notification as read
  - Happy path: Notification marked as read
  - Error: Notification not found throws NotFoundError
  - Error: User not owner throws UnauthorizedError

- [ ] `NotificationsDAL.markAllAsRead` - Mark all notifications as read
  - Happy path: All notifications marked as read
  - Edge case: No notifications to mark

- [ ] `NotificationsDAL.getUnreadCount` - Get unread notification count
  - Happy path: Returns unread count
  - Edge case: Zero unread notifications

#### Utilities

- [ ] `get-time-ago.ts` - Time formatting utility
  - Happy path: Formats time correctly (seconds, minutes, hours, days, weeks, months, years)
  - Edge case: Just now (less than a minute)
  - Edge case: Future dates
  - Edge case: Very old dates

- [ ] `send-notification.ts` - Notification sending utility
  - Happy path: Notification sent successfully
  - Error: Invalid user ID returns error
  - Error: Service failure handled gracefully

- [ ] `send-email.ts` - Email notification utility
  - Happy path: Email sent successfully
  - Error: Invalid email returns error
  - Error: Email service failure handled gracefully

#### Components

- [ ] `NotificationBell` - Notification bell component
  - Rendering: Bell icon with unread count badge
  - User interaction: Click opens notifications dropdown
  - Unread count: Displays correct unread count
  - Real-time updates: Updates when notifications arrive
  - Accessibility: Proper ARIA attributes

- [ ] `NotificationCard` - Individual notification card
  - Rendering: Shows notification content, time, type
  - User interaction: Click navigates to related content
  - Read/unread state: Visual distinction
  - Edge case: Long notification content truncation

- [ ] `NotificationsPageContent` - Notifications page content
  - Rendering: List of notifications
  - User interaction: Mark as read, mark all as read
  - Empty state: Shows message when no notifications
  - Loading state: Shows skeleton during data fetch
  - Error state: Shows error message on failure

#### Hooks

- [ ] `useNotifications` - Fetch notifications with React Query
  - Data fetching: Fetches user's notifications
  - Filtering: Filters by read/unread
  - Loading state: Returns loading boolean
  - Error state: Returns error object
  - Cache management: Proper cache key usage
  - Cache invalidation: Invalidates on mutations
  - Real-time updates: Subscribes to notification updates

### Integration Tests

- [ ] **Notification Creation Flow: Action → DAL → Database**
  - Complete flow: Event triggers → notification created → database stores notification
  - Error propagation: DAL error → action error → error handling

- [ ] **Notification Delivery Flow: Creation → Display → Read**
  - Complete flow: Notification created → displayed in UI → user marks as read
  - Real-time: Notification appears immediately
  - Cache invalidation: Cache refreshes after read

- [ ] **Email Notification Flow: Event → Email Sent**
  - Complete flow: Event triggers → email notification sent
  - Error handling: Email failure handled gracefully

### E2E Tests

- [ ] **Complete Notification Workflow**
  - User receives notification
  - Notification appears in bell
  - User clicks bell
  - User views notification
  - User marks as read
  - Verifies unread count decreases

### BDD Scenarios

```gherkin
Feature: Receive Notification
  As a user
  I want to receive notifications
  So that I am informed of important events

  Background:
    Given I am logged in as a user

  Scenario: Successfully receive notification
    Given an event occurs that requires notification
    When the notification is created
    Then I should see the notification in my notification bell
    And the unread count should increase
    And I should receive an email notification

Feature: View Notifications
  As a user
  I want to view my notifications
  So that I can see what has happened

  Background:
    Given I am logged in as a user
    And I have notifications

  Scenario: Successfully view notifications
    Given I am on the notifications page
    When I view my notifications
    Then I should see all my notifications
    And I should see the time each notification was created
    And I should see which notifications are unread
```

## Test Data Requirements

### Test Fixtures

**Location**: `src/test/fixtures/notifications.ts` (needs to be created)

**Required Fixtures**:

- `mockNotification` - Complete notification object
- `mockNotificationRead` - Read notification
- `mockNotificationUnread` - Unread notification
- `mockNotifications` - Array of notifications

## Coverage Goals

### Feature-Specific Targets

- **DAL Methods**: 70%+ (exceeds 50% threshold)
  - `NotificationsDAL.create`: 85%+
  - `NotificationsDAL.getUserNotifications`: 85%+
  - `NotificationsDAL.markAsRead`: 85%+
  - `NotificationsDAL.markAllAsRead`: 85%+
  - `NotificationsDAL.getUnreadCount`: 85%+

- **Utilities**: 90%+ (reusable functions)
  - `get-time-ago.ts`: 100% (all time formats)
  - `send-notification.ts`: 85%+
  - `send-email.ts`: 85%+

- **React Components**: 80%+ (exceeds 75% threshold)
  - `NotificationBell`: 85%+
  - `NotificationCard`: 85%+
  - `NotificationsPageContent`: 85%+

- **Hooks**: 85%+ (data fetching logic)
  - `useNotifications`: 90%+

### Overall Feature Coverage

- **Statements**: > 85%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 85% (meets 80% threshold for features)

## Test Execution

- Execute: `bun test:run --grep "notification"`
- Watch mode: `bun test:watch --grep "notification"`
- Coverage: `bun test:coverage --grep "notification"`

## Existing Test Coverage

### Currently Tested

- None

### Missing Test Coverage

- All DAL methods (no tests)
- All utilities (no tests)
- All components (no tests)
- All hooks (no tests)
- Integration tests (none exist)
- E2E tests (none exist)

## References

- **Test Plan Template**: `docs/AI-test-plan-template.md`
