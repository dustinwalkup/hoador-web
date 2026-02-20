# PWA Push Notifications - Implementation Tasks

## Overview

This document breaks down the PWA push notifications implementation into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements.

## Task List

### Phase 1: Setup and Dependencies

- [x] 1. Install web-push dependency and generate VAPID keys
  - Run `bun add web-push`
  - Run `npx web-push generate-vapid-keys` to generate key pair
  - Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to `.env.example` and document in README
  - Store keys in environment variables; never commit private key
  - _Requirements: Security NFR_

### Phase 2: Database Schema

- [x] 2. Add notification category and push subscription enums to \_enums.ts
  - Add `notificationCategoryEnum` to `src/db/schemas/_enums.ts` with values: `bookings`, `payments`, `messages`, `disputes`, `reminders`
  - Add `pushSubscriptionPlatformEnum` with values: `web`, `ios`, `android`
  - _Requirements: 1.1, 12.2_

- [x] 3. Add notification_category_preferences table to notifications.schema.ts
  - Add `notificationCategoryPreferences` table to `src/db/schemas/notifications.schema.ts`
  - Columns: id, userId (FK user), category (enum), email (boolean, default true), push (boolean, default true), createdAt, updatedAt
  - Unique constraint on (userId, category)
  - Index on userId
  - Add relations to user
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Add push_subscriptions table to notifications.schema.ts
  - Add `pushSubscriptions` table to `src/db/schemas/notifications.schema.ts`
  - Columns: id, userId (FK user), endpoint, p256dh, auth, platform (enum, default web), token (nullable), userAgent, createdAt, updatedAt, isActive (boolean, default true)
  - Indexes: userId, endpoint, composite (userId, isActive)
  - Add relations to user
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.7, 12.1_

- [x] 5. Add push_notification_audit table to notifications.schema.ts
  - Add `pushNotificationAudit` table to `src/db/schemas/notifications.schema.ts`
  - Columns: id, userId (FK user), subscriptionId (FK pushSubscriptions, nullable), eventType, success, errorMessage, sentAt
  - Indexes: userId, sentAt, eventType
  - Add relations
  - _Requirements: 11.1, 11.4_

- [x] 6. Update schema exports and run migration
  - Export new tables from `src/db/schemas/notifications.schema.ts`
  - Ensure `src/db/schemas/index.ts` or schema config includes new tables
  - Run `bun run db:generate` and `bun run db:migrate` (or `db:push` per project workflow)
  - _Requirements: All schema_

### Phase 3: Data Access Layer

- [ ] 7. Add NotificationCategoryPreferencesDAL to notifications.dal.ts
  - Create `NotificationCategoryPreferencesDAL` class in `src/dal/notifications.dal.ts`
  - Implement `getByUserId(userId)`: return all category preferences for user; if none exist, return defaults (all categories enabled)
  - Implement `upsert(userId, category, email, push)`: insert or update on conflict (userId, category)
  - Implement `upsertMany(userId, categories: Record<category, {email, push}>)`: bulk upsert
  - Export class; add singleton `notificationCategoryPreferencesDAL` to `src/dal/index.ts`
  - _Requirements: 1.6, 1.9_

- [ ] 8. Add PushSubscriptionDAL to notifications.dal.ts
  - Create `PushSubscriptionDAL` class in `src/dal/notifications.dal.ts`
  - Implement `create(userId, subscription, userAgent?)`: validate subscription shape, insert
  - Implement `getActiveByUserId(userId)`: return active subscriptions for user
  - Implement `deactivate(id)` or `deleteByEndpoint(endpoint)`: mark inactive or delete
  - Implement `getByEndpoint(endpoint)`: for deduplication / canonical ID handling
  - Export class; add singleton `pushSubscriptionDAL` to `src/dal/index.ts`
  - _Requirements: 3.1, 3.5, 10.1, 10.2_

- [ ] 9. Add push notification audit logging to notifications.dal.ts
  - Add methods to log audit entries: `PushSubscriptionDAL.createAuditLog(userId, subscriptionId, eventType, success, errorMessage?)` or separate `PushAuditDAL`
  - Can be a simple helper in PushSubscriptionDAL or separate class in same file
  - _Requirements: 11.1, 11.2, 11.5_

### Phase 4: Preference Service and Notification Type Mapping

- [ ] 10. Create notification-type-map.ts
  - Create `src/features/notifications/lib/notification-type-map.ts`
  - Export `NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory>`
  - Map: rental*\* → bookings; payment*_ → payments; message*received → messages; dispute*_ → disputes; rental_reminder → reminders
  - Map listing_approved, listing_rejected, review_received, system to a fallback (e.g. bookings or skip push)
  - Export type `NotificationCategory`
  - _Requirements: 8.4_

- [ ] 11. Create preference-service.ts
  - Create `src/features/notifications/lib/preference-service.ts`
  - Implement `shouldSendEmail(userId, category)`: check user_preferences.emailNotifications, then notification_category_preferences
  - Implement `shouldSendPush(userId, category)`: check user_preferences.pushNotifications, then notification_category_preferences
  - Implement `getCategoryPreferences(userId)`: return master + category prefs (with defaults when no row)
  - Use userDAL for user_preferences; use NotificationCategoryPreferencesDAL for category prefs
  - Handle missing preferences: default to true for both channels
  - _Requirements: 1.4, 1.5, 1.8, 1.9_

### Phase 5: Push Service and Payload

- [ ] 12. Create push-payload.ts
  - Create `src/features/notifications/lib/push-payload.ts`
  - Export `buildPushPayload(title, body, linkUrl, type, data?)`: returns `PushPayload` with only reference IDs (rentalId, conversationId, disputeId)
  - Ensure no PII or financial data in payload
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 13. Create push-service.ts
  - Create `src/features/notifications/lib/push-service.ts`
  - Initialize web-push with VAPID keys from env (no-op if keys missing; log warning)
  - Implement `sendPush(userId, payload)`: get active subscriptions, call sendToSubscription for each (fire-and-forget, do not await)
  - Implement `sendToSubscription(subscription, payload)`: webpush.sendNotification; on 410/404 call deactivate; log to audit; retry once on 5xx
  - _Requirements: 3.6, 7.3, 8.2, 8.3, 10.1, 10.2, 11.1_

### Phase 6: Service Worker

- [ ] 14. Create service worker (sw.js)
  - Create `public/sw.js` with minimal implementation
  - Handle `push` event: parse event.data.json(), call registration.showNotification(title, { body, data: { linkUrl, ...data }, tag for dedupe })
  - Handle `notificationclick`: event.notification.close(); open event.notification.data?.linkUrl || '/' in new/focus window
  - Scope: '/'
  - Ensure no syntax errors; test in browser
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.7, 7.8_

- [ ] 15. Create register-service-worker.ts client utility
  - Create `src/lib/pwa/register-service-worker.ts`
  - Export `registerServiceWorker()`: navigator.serviceWorker.register('/sw.js', { scope: '/' })
  - Only run in browser (typeof window !== 'undefined')
  - Handle errors gracefully; log but do not throw
  - Return registration or null
  - _Requirements: 2.5, 2.6, 2.7_

### Phase 7: Client Push Subscription and Permission Hooks

- [ ] 16. Create subscribe-push.ts client utility
  - Create `src/lib/pwa/subscribe-push.ts`
  - Export `subscribeToPush(vapidPublicKey)`: get registration via navigator.serviceWorker.ready, call pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey })
  - Convert vapid public key from base64 to Uint8Array
  - Return PushSubscription JSON (to send to API)
  - _Requirements: 2.8, 3.4_

- [ ] 17. Create use-push-permission.ts hook
  - Create `src/lib/pwa/use-push-permission.ts`
  - Check Notification.permission (granted, denied, default)
  - Track "has been prompted" via localStorage key (e.g. push-permission-prompted)
  - Export `requestPushPermission()`: Notification.requestPermission()
  - Export `shouldShowPermissionPrompt()`: true if default and not yet prompted
  - Export `markPromptShown()`: set localStorage
  - _Requirements: 4.1, 4.5, 4.6, 5.4, 5.5_

### Phase 8: API Routes

- [ ] 18. Create POST /api/push/subscribe route
  - Create `src/app/api/push/subscribe/route.ts`
  - Require authentication; return 401 if not authenticated
  - Parse body: { endpoint, keys: { p256dh, auth }, expirationTime? }
  - Validate subscription shape (endpoint, keys.p256dh, keys.auth required)
  - Get userId from session; call PushSubscriptionDAL.create(userId, subscription, request.headers.get('user-agent'))
  - Return 201 on success; 400 on invalid payload
  - _Requirements: 3.8, 3.6_

- [ ] 19. Create DELETE /api/push/subscribe route
  - Add DELETE handler to `src/app/api/push/subscribe/route.ts` or create delete route
  - Parse body: { endpoint }
  - Verify subscription belongs to authenticated user; call PushSubscriptionDAL.deactivate or delete
  - Return 204 on success
  - _Requirements: 3.5_

- [ ] 20. Create GET /api/notifications/preferences route
  - Create `src/app/api/notifications/preferences/route.ts`
  - Require authentication
  - Call preferenceService.getCategoryPreferences(userId)
  - Return JSON: { master: { email, push }, categories: { bookings: { email, push }, ... } }
  - _Requirements: 1.6, 6.1_

- [ ] 21. Create PATCH /api/notifications/preferences route
  - Add PATCH handler to `src/app/api/notifications/preferences/route.ts`
  - Parse body: { categories: { [category]: { email?, push? } } }
  - Validate categories; call NotificationCategoryPreferencesDAL.upsertMany(userId, categories)
  - Return updated preferences
  - _Requirements: 1.6, 6.3_

### Phase 9: Extend sendNotification and Integration

- [x] 22. Extend sendNotification with preference checks and push
  - Edit `src/features/notifications/utils/send-notification.ts`
  - Add optional `category` param; infer from `type` via notification-type-map if not provided
  - Before sending email: call preferenceService.shouldSendEmail(userId, category); if false, skip email
  - After in-app notification created: call preferenceService.shouldSendPush(userId, category); if true, call pushService.sendPush(userId, buildPushPayload(...)) without awaiting
  - Ensure in-app notification is always created first
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_

- [x] 23. Wire preferences UI to backend
  - Edit `src/features/users/components/profile/preferences-tab.tsx`
  - Replace static switches with data from GET /api/notifications/preferences
  - Add PATCH call on toggle change for master switches (email, push) and category toggles
  - Display category preferences (bookings, payments, messages, disputes, reminders) with email/push toggles
  - Use React Query or similar for fetch/update
  - _Requirements: 1.7, 6.2, 6.5, 6.6_

### Phase 10: Permission Prompts and Push Enrollment

- [x] 24. Add push permission prompt after rental request submit
  - In rental request success flow (e.g. `use-rental-mutations` or rent flow component), after successful submit: check shouldShowPermissionPrompt; if true, show in-app prompt to enable push; on user accept, call requestPushPermission then subscribeToPush and POST /api/push/subscribe
  - Only when Notification.permission === 'default'
  - _Requirements: 5.1, 5.6_

- [x] 25. Add push permission prompt after first rental approval (renter)
  - When renter receives rental_approved: server or client must detect "first approval"; optionally pass a flag to frontend. Client: if first approval and shouldShowPermissionPrompt, show prompt. Same flow as 24.
  - May require backend to set a flag (e.g. user_preferences or one-time event) for "has received first approval"
  - _Requirements: 5.2_

- [x] 26. Add manual "Enable Push" in account settings
  - In preferences tab, add "Enable Push Notifications" button/section
  - When clicked: if permission default, requestPushPermission; if granted, register SW (if not), subscribeToPush, POST /api/push/subscribe
  - Show status: enabled (subscribed), disabled, or "Enable" button
  - _Requirements: 4.8, 5.3_

- [x] 27. Register service worker on app load
  - In app layout or a client provider (e.g. `src/components/providers.tsx` or a PWA provider), call registerServiceWorker() on mount
  - Only in browser; handle errors without breaking app
  - _Requirements: 2.1_

### Phase 11: Event Triggers and Message Notification

- [x] 28. Add sendNotification for new messages (message_received)
  - In `src/app/api/messages/conversations/[conversationId]/messages/route.ts` or in messagesDAL (with callback), after message insert: determine recipient (user1 or user2 not sender), call sendNotification with type message_received, appropriate title/body/linkUrl, category messages
  - Ensure recipient gets in-app + email + push per preferences
  - _Requirements: 8.1 (new message event)_

### Phase 12: Reminder Scheduler (Pickup/Return)

- [ ] 29. Create reminder scheduler (cron or Vercel Cron)
  - Create API route e.g. `src/app/api/cron/rental-reminders/route.ts` (with cron secret auth)
  - Query rentals: startDate within next 24h (pickup) or endDate within next 24h (return); status approved or active
  - For each: get renter, check preferenceService.shouldSendPush/user for reminders category; if yes, call sendNotification with rental_reminder type
  - Use user timezone from user_preferences
  - Add to vercel.json cron or document for external scheduler
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

### Phase 12b: Subscription Cleanup (Optional / Cron)

- [ ] 30. Create subscription cleanup job
  - Add cleanup logic: delete or deactivate subscriptions that have failed repeatedly (e.g. 3+ consecutive 410/404)
  - Can be part of reminder cron or separate cron route
  - Document retention/cleanup policy for push_notification_audit (e.g. 90 days)
  - _Requirements: 10.4, 11.3_

### Phase 13: Testing

- [x] 31. Unit tests for preference-service
  - Test shouldSendEmail: master off → false; master on, category off → false; master on, no row → true; master on, category on → true
  - Test shouldSendPush: same cases
  - Mock NotificationCategoryPreferencesDAL and userDAL
  - _Requirements: 1, 9_

- [x] 32. Unit tests for notification-type-map
  - Test all notification types map to correct category
  - _Requirements: 8.4_

- [x] 33. Unit tests for push-payload
  - Test no PII in payload; only reference IDs
  - _Requirements: 7.1, 7.2_

- [x] 34. Integration tests for push subscribe API
  - Test POST /api/push/subscribe: 401 unauthenticated; 400 invalid payload; 201 success
  - _Requirements: 3_

- [x] 35. Integration tests for preferences API
  - Test GET returns defaults when no prefs; PATCH updates and returns
  - _Requirements: 1, 6_
