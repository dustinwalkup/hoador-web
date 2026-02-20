# PWA Push Notifications - Requirements Document

## Introduction

This document defines the requirements for PWA push notifications in the Hoador web application. Push notifications deliver real-time, transactional updates for high-value operational events such as booking requests, booking status changes, payment confirmations, pickup and return reminders, new messages, and dispute updates. Users must explicitly opt in to receive notifications, and permissions are requested only after meaningful in-app actions (e.g., completing a booking or enabling notifications in account settings).

The implementation includes a unified notification preferences revamp that incorporates both email and push channels with category-level granularity. The system uses Firebase Cloud Messaging (FCM) for delivery to align with future React Native support. Because the Web Push API requires a service worker and the base PWA does not currently have one, this feature will implement a minimal service worker for push receipt and notification click handling. Notifications contain only reference identifiers—no sensitive personal or financial information—and link users into the appropriate in-app experience.

## Requirements

### Requirement 1: Notification Preferences Revamp

**User Story:** As a user, I want to control which notifications I receive by category and channel, so that I am not overwhelmed and can choose how to be notified.

#### Acceptance Criteria

1. The system SHALL create a new table `notification_category_preferences` with the following columns:
   - `id` (uuid, primary key)
   - `user_id` (text, foreign key to user)
   - `category` (enum or text)
   - `email` (boolean)
   - `push` (boolean)
   - `created_at`, `updated_at` (timestamps)
2. The system SHALL enforce a unique constraint on `(user_id, category)` so each user has one row per category
3. The system SHALL support the following notification categories:
   - `bookings` - Rental requests and booking status changes
   - `payments` - Payment confirmations and refunds
   - `messages` - New messages in conversations
   - `disputes` - Dispute creation, evidence requests, and resolution
   - `reminders` - Pickup and return reminders
4. The system SHALL retain master switches in `user_preferences`: `email_notifications` and `push_notifications` as global on/off
5. IF the master switch for a channel is disabled THEN the system SHALL not send via that channel regardless of category preferences
6. The system SHALL provide an API to read and update notification category preferences for the authenticated user
7. The system SHALL wire the preferences UI (profile preferences tab) to the backend so changes are persisted
8. The system SHALL extend `sendNotification()` to check preferences before sending email or push:
   - IF `email_notifications` is true AND category `email` preference is true THEN send email
   - IF `push_notifications` is true AND category `push` preference is true AND user has valid push subscription THEN send push
9. WHERE a user has no row for a category THEN the system SHALL use defaults (both email and push enabled for that category)
10. In-app notifications SHALL always be created regardless of preferences; preferences apply only to email and push channels

### Requirement 2: Service Worker for Web Push

**User Story:** As a system, we need a service worker to receive and display push notifications, so that the Web Push API can deliver notifications to users even when the app is not focused.

#### Acceptance Criteria

1. The system SHALL implement a service worker (the base PWA does not currently include one)
2. The service worker SHALL handle the `push` event to receive push messages from FCM
3. The service worker SHALL display a notification using the Web Notifications API when a push is received
4. The service worker SHALL handle the `notificationclick` event to open the correct URL when the user taps the notification
5. The service worker SHALL be registered only in browser environments (not during SSR)
6. WHERE service worker registration fails THEN the system SHALL handle errors gracefully without breaking the application
7. The service worker SHALL be scoped appropriately for the application
8. Push subscription (via `PushManager`) SHALL be obtained in the context of the registered service worker

### Requirement 3: Push Subscription Management

**User Story:** As a user, I want my devices registered for push notifications, so that I receive updates across all my devices.

#### Acceptance Criteria

1. The system SHALL store device-specific push subscriptions in a dedicated table
2. The system SHALL support multiple devices per user
3. Each subscription SHALL be associated with a userId
4. The system SHALL store the subscription endpoint and encryption keys required for Web Push
5. The system SHALL support revocation (removal of subscriptions)
6. The system SHALL assign a unique identifier to each subscription for audit and management
7. The system SHALL store subscription metadata (e.g., user agent, device type) for management purposes
8. WHEN a user subscribes to push THEN the system SHALL persist the subscription only if the user is authenticated

### Requirement 4: Opt-In and Permission Flow

**User Story:** As a user, I want to opt in explicitly to push notifications, so that I control when I am asked for permission and am not prompted on first visit.

#### Acceptance Criteria

1. The system SHALL request browser push permission only after a meaningful in-app action
2. Meaningful actions SHALL include:
   - User submits a rental request (before owner approves)
   - User receives their first rental approval (booking confirmed)
   - User enables push notifications in account settings
3. The system SHALL request permission for whichever meaningful action happens first for that user
4. The system SHALL NOT request permission on cold app load or initial page visit
5. The system SHALL respect the browser permission state (granted, denied, default)
6. WHERE the user has already granted permission THEN the system SHALL not show a permission prompt
7. WHERE the user has already denied permission THEN the system SHALL not show a permission prompt; the user may enable via browser settings
8. The system SHALL provide a manual enable path in account settings that allows the user to request push permission at any time

### Requirement 5: Permission Request Triggers

**User Story:** As a platform, we want contextual permission prompts, so that users understand why we need push notification permission.

#### Acceptance Criteria

1. WHEN the user submits a rental request AND has not yet opted in to push THEN the system SHALL show a contextual prompt explaining that push will keep them updated on their booking
2. WHEN the user receives their first rental approval AND has not yet opted in to push THEN the system SHALL show a contextual prompt explaining that push will keep them updated on rental status
3. The account settings page SHALL always provide an option to enable push notifications (triggering the browser permission request if not yet granted)
4. WHERE the user has already granted or denied permission THEN the system SHALL not show a permission prompt
5. The system SHALL track whether the user has been prompted to avoid duplicate prompts
6. Permission prompts SHALL use clear, user-friendly language explaining the benefit of enabling notifications

### Requirement 6: Notification Categories and Preferences

**User Story:** As a user, I want to control which notification categories I receive, so that I am not overwhelmed by irrelevant updates.

#### Acceptance Criteria

1. The system SHALL support per-category, per-channel toggles (email, push) in `notification_category_preferences`
2. Categories SHALL align with Requirement 1: bookings, payments, messages, disputes, reminders
3. The system SHALL persist category preferences when the user updates them
4. The system SHALL apply category preferences before sending any email or push notification
5. The preferences UI SHALL display each category with separate toggles for email and push
6. The preferences UI SHALL respect the master switches; category toggles may be disabled (visually) when the master switch is off
7. Default preferences for new users SHALL have all categories enabled for both email and push (subject to master switches)

### Requirement 7: Push Payload and Deep Linking

**User Story:** As a user, I want notifications to open the right screen when I tap them, so that I can act quickly on the update.

#### Acceptance Criteria

1. Push notification payloads SHALL contain only reference identifiers (e.g., rentalId, conversationId, disputeId)
2. Push notification payloads SHALL NOT contain sensitive personal information (names, email addresses, etc.)
3. Push notification payloads SHALL NOT contain financial information (amounts, payment details, etc.)
4. The system SHALL include a linkUrl or equivalent deep link in the payload that routes to the appropriate in-app experience
5. Link patterns SHALL follow existing conventions (e.g., `/dashboard/rental/{id}`, `/dashboard/mailbox?conversation={id}`, `/dashboard/disputes/{id}`)
6. A service worker SHALL be implemented to handle push events and notification clicks (the Web Push API requires a service worker; the base PWA does not currently include one)
7. The service worker SHALL handle `push` events to display incoming notifications
8. The service worker SHALL handle `notificationclick` events to open the correct URL when the user taps a notification
9. WHEN the user clicks a notification THEN the system SHALL navigate to the linkUrl and focus the relevant content

### Requirement 8: Event-to-Push Mapping

**User Story:** As a system, we need to send push notifications for high-value operational events only, so that users receive timely updates without notification fatigue.

#### Acceptance Criteria

1. The system SHALL map the following events to push notifications:
   - Booking request received (to owner)
   - Booking approved, denied, started, ended, cancelled (to renter and/or owner as applicable)
   - Payment confirmation (to payer and/or recipient)
   - Pickup reminder (to renter)
   - Return reminder (to renter)
   - New message (to recipient)
   - Dispute created, evidence requested, evidence deadline approaching, evidence deadline expired, dispute resolved (to relevant parties)
2. WHEN an event occurs THEN the system SHALL check: user has push enabled (master switch), category preference for push is enabled, user has at least one valid subscription
3. IF all conditions are met THEN the system SHALL send the push via FCM
4. The system SHALL map each event to the correct notification category for preference lookup
5. Push notifications SHALL be sent only for the events listed above; no other events SHALL trigger push

### Requirement 9: Integration with Existing Notification Flow

**User Story:** As a system, we need push to work alongside in-app and email notifications, so that users receive updates through their preferred channels.

#### Acceptance Criteria

1. The system SHALL extend `sendNotification()` to support the push channel
2. In-app notifications SHALL always be created when `sendNotification()` is called
3. The system SHALL check preferences (Requirement 1) before sending email or push
4. Email sending SHALL be conditional on `email_notifications` master switch and category `email` preference
5. Push sending SHALL be conditional on `push_notifications` master switch, category `push` preference, and valid subscription
6. Push sending SHALL be additive; existing email logic SHALL remain unchanged except for the addition of preference checks
7. WHERE push sending fails THEN the system SHALL not block in-app or email notification delivery
8. The system SHALL pass the notification type (or category) to the preference check so the correct category row is consulted

### Requirement 10: Revocation and Subscription Cleanup

**User Story:** As a system, we need to remove invalid or expired subscriptions, so that we do not attempt to send to devices that can no longer receive push.

#### Acceptance Criteria

1. The system SHALL handle FCM responses indicating subscription expiration (e.g., 410 Gone, 404 Not Found)
2. WHEN a push send fails with 410 or 404 THEN the system SHALL mark the subscription as inactive or delete it
3. The system SHALL support FCM canonical IDs where the same subscription may have multiple endpoints; duplicate subscriptions SHALL be consolidated
4. The system SHALL provide a periodic cleanup job (or equivalent) to remove stale subscriptions that have not been used or have failed repeatedly
5. Revocation actions SHALL be logged for audit purposes
6. Users SHALL be able to view and manage their registered devices in account settings (future enhancement may include manual removal)

### Requirement 11: Audit Logging

**User Story:** As an operator, I need an audit trail of sent push notifications, so that I can debug delivery issues and ensure compliance.

#### Acceptance Criteria

1. The system SHALL log each push notification send attempt with:
   - userId
   - subscriptionId (or device identifier)
   - eventType (or notification type)
   - sentAt timestamp
   - success or failure status
2. The system SHALL NOT log payload content (title, body, or reference IDs) in the audit log for privacy
3. The system SHALL retain audit logs for a configurable period (e.g., 90 days)
4. Audit logs SHALL be queryable by userId, date range, event type, and success/failure status
5. WHERE a push fails THEN the system SHALL log the failure reason (e.g., subscription expired, network error)

### Requirement 12: Future Extensibility (Native Push)

**User Story:** As a platform, we need to support React Native push tokens in the future, so that the native mobile app can receive the same notifications.

#### Acceptance Criteria

1. The subscription storage design SHALL accommodate both Web Push subscription objects and FCM/APNs tokens
2. The system SHALL include a type discriminator (e.g., `platform: 'web' | 'ios' | 'android'`) in the subscription schema
3. The push sending logic SHALL abstract the "push target" so that web and native tokens can be sent through a unified interface
4. Implementation of native push (React Native) is out of scope for this phase
5. The schema and API design SHALL not preclude adding native support in a future phase without significant refactoring

### Requirement 13: Pickup and Return Reminders

**User Story:** As a user, I want reminders before pickup and return dates, so that I do not forget my rental obligations.

#### Acceptance Criteria

1. The system SHALL send a pickup reminder at a configurable time before the rental start date (e.g., 24 hours)
2. The system SHALL send a return reminder at a configurable time before the rental end date (e.g., 24 hours)
3. Reminders SHALL be sent only if the rental is in an applicable status (e.g., approved or active)
4. The user SHALL have the reminders category enabled (both master push switch and category push preference) to receive push reminders
5. Reminders SHALL be timezone-aware based on the user's timezone preference
6. The system SHALL support configurable reminder lead times (e.g., 24h, 12h, 1h) with sensible defaults
7. Reminders SHALL be sent via in-app, email, and push according to the user's preferences for the reminders category

## Non-Functional Requirements

### Performance

1. Push send operations SHALL be non-blocking; they SHALL not delay the response to the user or block other notification channels
2. The system SHALL aim for push delivery within 5 seconds of the triggering event (best effort; network conditions may vary)
3. Preference lookups SHALL be efficient; the system SHALL cache or batch preference checks where appropriate

### Security

1. VAPID keys and FCM credentials SHALL be stored server-side only and SHALL never be exposed to the client
2. Push payloads SHALL contain no sensitive personal or financial information
3. Subscription endpoints SHALL be validated and associated with authenticated users only
4. The system SHALL validate that the requesting user owns the subscription when storing or updating it

### Reliability

1. Push delivery failure SHALL not block in-app or email notification delivery
2. The system SHALL retry transient FCM failures with exponential backoff
3. The system SHALL handle FCM unavailability gracefully (log and skip push; other channels unaffected)
4. Preference check failures SHALL default to not sending (fail closed) rather than sending when preferences cannot be determined

### Usability

1. Permission prompts SHALL use clear, non-technical language
2. The preferences UI SHALL be intuitive and grouped by category
3. Users SHALL receive feedback when preferences are saved successfully

## Assumptions

1. FCM supports Web Push via the Web Push API compatibility layer
2. The existing `sendNotification()` function will be extended, not replaced
3. Master switches (`emailNotifications`, `pushNotifications`) and `notification_category_preferences` will be checked before sending each channel
4. A service worker does not currently exist in the base PWA; this feature SHALL implement a minimal service worker required for Web Push (push event handling and notification click routing)
5. The application is served over HTTPS in production (required for push)
6. Users have modern browsers that support the Web Push API (Chrome, Firefox, Edge, Safari 16+)
7. The existing notification type enum and event triggers will be mapped to the new category model

## Constraints

1. Push notification payloads SHALL NOT contain PII or financial data
2. Permission SHALL be requested only after meaningful in-app actions (per user choice)
3. Native (React Native) push implementation is deferred to a future phase
4. Marketing or promotional push notifications are out of scope
5. A service worker must be implemented as part of this feature (base PWA does not include one); Web Push requires it
6. Service workers have limitations (no DOM access, limited storage) that affect implementation choices

## Edge Cases

1. **User has no preferences row for a category**: Use defaults (both channels enabled for that category)
2. **User disables push globally but has category push enabled**: Global switch takes precedence; no push sent
3. **Subscription expires mid-session**: Next push attempt fails; cleanup marks subscription inactive; user may re-subscribe
4. **User submits rental and receives approval in same session**: Permission prompt on first meaningful action only (rental submit); no duplicate prompt on approval
5. **User opts in, then clears browser data**: Subscription is orphaned; cleanup job or failed send will remove it
6. **Multiple tabs open**: Subscription may be registered per tab/browser context; system handles multiple subscriptions per user
7. **FCM returns 410 for one device**: Remove that subscription; continue sending to user's other devices
8. **Preference check fails (e.g., DB timeout)**: Fail closed—do not send email or push for that notification

## Out of Scope

1. Native mobile push implementation (React Native); schema and design support it for future phase
2. Marketing or promotional push notifications
3. Rich notifications (images, action buttons) beyond title, body, and click
4. SMS notifications (separate from push; may use existing `smsNotifications` preference in future)
5. Badge API or notification count synchronization
6. Notification scheduling or batching (each event triggers immediate send)
7. Full offline/caching service worker (push service worker is minimal: push events and notification clicks only)

## Success Criteria

1. Service worker registers successfully and handles push events and notification clicks
2. Users can opt in to push notifications after a meaningful action (rental submit or approval) or in account settings
3. Users can manage notification preferences by category (bookings, payments, messages, disputes, reminders) and channel (email, push)
4. Preferences are persisted and applied before sending email or push
5. Push notifications are delivered for enabled categories when events occur
6. Multiple devices per user are supported
7. Invalid or expired subscriptions are cleaned up
8. Audit log captures push send attempts for debugging
9. No sensitive data appears in push payloads
10. Email notifications respect preferences (fix for current behavior where they do not)
11. In-app notifications continue to work for all events regardless of preferences
