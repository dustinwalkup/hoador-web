# PWA Push Notifications - User Acceptance Test Plan

## Overview

This document defines the user acceptance tests (UAT) for PWA push notifications. Each test is written from the end-user perspective and verifiable by a QA tester or stakeholder with access to a staging environment and a modern browser. Tests are grouped by feature area and traced back to requirements.

**Prerequisites for all tests:**

- Staging environment deployed over HTTPS (or localhost for development)
- A test user account with at least one listing and one rental
- A second test user account to act as renter/owner counterpart
- Modern browser: Chrome, Firefox, Edge, or Safari 16+
- Device notifications enabled at the OS level
- Browser DevTools available for inspecting service worker and push state

---

## UAT-1: Service Worker Registration

**Requirements:** Req 2

### UAT-1.1: Service worker registers on page load

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is logged in; browser supports service workers                                                                          |
| **Steps**           | 1. Navigate to the app home page<br>2. Open browser DevTools > Application > Service Workers                                 |
| **Expected Result** | A service worker at `/sw.js` is listed as "activated and running." No console errors related to service worker registration. |

### UAT-1.2: Service worker does not break the app if registration fails

| Field               | Value                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Simulate failure by temporarily blocking `/sw.js` (e.g., via DevTools network throttle or 404)                                     |
| **Steps**           | 1. Block the `/sw.js` request in DevTools Network tab<br>2. Reload the app<br>3. Navigate between pages                            |
| **Expected Result** | The application loads and functions normally. No visible errors to the user. Console may log a warning but no uncaught exceptions. |

### UAT-1.3: Service worker registers only in browser (not SSR)

| Field               | Value                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | App is deployed with SSR                                                                                               |
| **Steps**           | 1. View server-side rendered HTML source (View Page Source)<br>2. Search for `navigator.serviceWorker.register`        |
| **Expected Result** | No service worker registration calls appear in the initial HTML. Registration occurs only after client-side hydration. |

---

## UAT-2: Push Notification Permission - Opt-In Flow

**Requirements:** Req 4, Req 5

### UAT-2.1: No permission prompt on first visit

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Preconditions**   | Fresh browser profile (no prior visits); user is not logged in                        |
| **Steps**           | 1. Navigate to the app home page<br>2. Browse several pages (explore, listing detail) |
| **Expected Result** | No push notification permission dialog or in-app prompt appears at any point.         |

### UAT-2.2: No permission prompt on login without meaningful action

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Preconditions**   | Fresh browser profile; user has never been prompted for push                         |
| **Steps**           | 1. Log in to the app<br>2. Navigate to dashboard, garage, mailbox, and profile pages |
| **Expected Result** | No push notification permission dialog or in-app prompt appears.                     |

### UAT-2.3: Permission prompt after submitting a rental request

| Field               | Value                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in as Renter; push permission is "default" (never granted/denied); never prompted before                                                                                                                                 |
| **Steps**           | 1. Navigate to a listing detail page<br>2. Complete the rental request form and submit<br>3. Wait for the request to succeed                                                                                                    |
| **Expected Result** | After the rental request succeeds, an in-app prompt (modal/dialog) appears explaining the benefit of enabling push notifications (e.g., "Get notified when the owner responds"). The prompt has "Enable" and "Not Now" options. |

### UAT-2.4: Permission prompt after first rental approval (renter)

| Field               | Value                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in as Renter; push permission is "default"; never prompted before; renter has a pending rental request                                                                                 |
| **Steps**           | 1. In a second browser, log in as Owner and approve the rental request<br>2. Switch to the Renter's browser<br>3. Navigate to the rental detail page (or refresh if already on it)            |
| **Expected Result** | An in-app prompt appears explaining push will keep the renter updated on their rental. If the user was already prompted after the rental submit (UAT-2.3), this prompt does NOT appear again. |

### UAT-2.5: Accepting the permission prompt subscribes the device

| Field               | Value                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | In-app push prompt is displayed (from UAT-2.3 or UAT-2.4)                                                                                                             |
| **Steps**           | 1. Click "Enable" on the in-app prompt<br>2. The browser's native notification permission dialog appears<br>3. Click "Allow"                                          |
| **Expected Result** | The in-app prompt closes. The device is subscribed (verifiable in DevTools > Application > Push Messaging or by checking the API response). No errors in the console. |

### UAT-2.6: Dismissing the permission prompt does not subscribe

| Field               | Value                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | In-app push prompt is displayed                                                                                                                                       |
| **Steps**           | 1. Click "Not Now" (or dismiss/close the prompt)                                                                                                                      |
| **Expected Result** | The prompt closes. No browser permission dialog appears. The user is NOT subscribed. The prompt does not reappear on subsequent page navigations in the same session. |

### UAT-2.7: No duplicate prompts in a single session

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User submitted a rental request and dismissed the push prompt (UAT-2.6)                                         |
| **Steps**           | 1. Submit another rental request<br>2. Navigate to various dashboard pages                                      |
| **Expected Result** | The push permission prompt does NOT appear again. The user is only prompted once per the defined trigger rules. |

### UAT-2.8: No prompt when permission already granted

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| **Preconditions**   | Push permission is "granted" (previously allowed)                    |
| **Steps**           | 1. Submit a rental request                                           |
| **Expected Result** | No in-app push prompt appears. The rental request succeeds normally. |

### UAT-2.9: No prompt when permission already denied

| Field               | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Preconditions**   | Push permission is "denied" (user previously blocked notifications for this site)      |
| **Steps**           | 1. Submit a rental request                                                             |
| **Expected Result** | No in-app push prompt or browser dialog appears. The rental request succeeds normally. |

---

## UAT-3: Manual Push Enable in Account Settings

**Requirements:** Req 4.8, Req 5.3

### UAT-3.1: Enable push from profile preferences (permission not yet granted)

| Field               | Value                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in; push permission is "default"; push is not enabled                                                                                                                                         |
| **Steps**           | 1. Navigate to Profile > Preferences<br>2. Locate the "Push Notifications" section<br>3. Click "Enable Push Notifications" (or toggle the master push switch on)                                     |
| **Expected Result** | The browser's native notification permission dialog appears. After granting, the toggle shows as enabled and the device is subscribed. A success message (toast or inline) confirms push is enabled. |

### UAT-3.2: Enable push from settings when already granted

| Field               | Value                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in; push permission is "granted" but push master switch is off                                                                                                                       |
| **Steps**           | 1. Navigate to Profile > Preferences<br>2. Toggle the push notifications master switch on                                                                                                   |
| **Expected Result** | The master switch toggles on immediately. No browser permission dialog (already granted). The device subscription is created if not already present. A success message confirms the change. |

### UAT-3.3: Push enable shows blocked state when permission denied

| Field               | Value                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in; push permission is "denied" at the browser level                                                                                                                                                      |
| **Steps**           | 1. Navigate to Profile > Preferences<br>2. Look at the push notifications section                                                                                                                                |
| **Expected Result** | The UI indicates that push is blocked (e.g., "Notifications are blocked in your browser. Please update your browser settings to enable push notifications."). The toggle is disabled or a help message is shown. |

---

## UAT-4: Notification Preferences Management

**Requirements:** Req 1, Req 6

### UAT-4.1: View default notification preferences

| Field               | Value                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in as a new user who has never changed preferences                                                                                                                                                              |
| **Steps**           | 1. Navigate to Profile > Preferences<br>2. Scroll to the notification preferences section                                                                                                                              |
| **Expected Result** | Five categories are displayed: Bookings, Payments, Messages, Disputes, Reminders. Each category has separate Email and Push toggles. All toggles are ON by default. Master email and push switches are visible and ON. |

### UAT-4.2: Toggle a category preference

| Field               | Value                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in; viewing notification preferences                                                                                                                   |
| **Steps**           | 1. Turn OFF the Push toggle for "Messages"<br>2. Wait for save confirmation<br>3. Refresh the page                                                            |
| **Expected Result** | After refresh, the Messages push toggle remains OFF. All other toggles remain unchanged. A success toast or indicator appeared when the preference was saved. |

### UAT-4.3: Toggle the master push switch off

| Field               | Value                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in; master push switch is ON; some categories have push enabled                                                                                               |
| **Steps**           | 1. Turn OFF the master Push Notifications switch                                                                                                                     |
| **Expected Result** | The master push switch turns OFF. Category-level push toggles are visually disabled or grayed out (indicating they are overridden). Changes persist on page refresh. |

### UAT-4.4: Toggle the master push switch back on

| Field               | Value                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | Master push switch is OFF (from UAT-4.3)                                                                                       |
| **Steps**           | 1. Turn ON the master Push Notifications switch                                                                                |
| **Expected Result** | Category-level push toggles become active again, retaining their individual ON/OFF states from before the master was disabled. |

### UAT-4.5: Toggle the master email switch off

| Field               | Value                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Logged in; master email switch is ON                                                                                                  |
| **Steps**           | 1. Turn OFF the master Email Notifications switch                                                                                     |
| **Expected Result** | The master email switch turns OFF. Category-level email toggles are visually disabled or grayed out. Changes persist on page refresh. |

### UAT-4.6: Preferences are user-specific

| Field               | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Two test accounts: User A and User B                                                                |
| **Steps**           | 1. Log in as User A; disable push for "Bookings"<br>2. Log out; log in as User B; check preferences |
| **Expected Result** | User B's Bookings push toggle is ON (default). User A's change does not affect User B.              |

---

## UAT-5: Receiving Push Notifications

**Requirements:** Req 7, Req 8, Req 9

### UAT-5.1: Receive push notification for rental request (owner)

| Field               | Value                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions**   | Owner has push enabled with Bookings category push ON; Owner's browser is open (or backgrounded)                                                                                                             |
| **Steps**           | 1. Log in as Renter in a separate browser<br>2. Submit a rental request for one of the Owner's listings                                                                                                      |
| **Expected Result** | The Owner receives a push notification with a title indicating a new booking request and a body with relevant context (no PII or financial amounts). The notification appears in the OS notification center. |

### UAT-5.2: Receive push notification for rental approval (renter)

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Preconditions**   | Renter has push enabled with Bookings category push ON; Renter has a pending rental request |
| **Steps**           | 1. Log in as Owner in a separate browser<br>2. Approve the Renter's rental request          |
| **Expected Result** | The Renter receives a push notification indicating their rental was approved.               |

### UAT-5.3: Receive push notification for new message

| Field               | Value                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Recipient has push enabled with Messages category push ON; an active conversation exists between two users                                                                            |
| **Steps**           | 1. Log in as Sender; send a message in the conversation                                                                                                                               |
| **Expected Result** | The Recipient receives a push notification indicating a new message. The notification body does NOT include the message content (only a generic "You have a new message" or similar). |

### UAT-5.4: No push when category is disabled

| Field               | Value                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has push enabled globally but Messages category push is OFF                                                                                                                  |
| **Steps**           | 1. Have another user send a message to this user                                                                                                                                  |
| **Expected Result** | No push notification is received. The in-app notification IS still created (visible in the notification bell/inbox). Email may or may not be sent depending on email preferences. |

### UAT-5.5: No push when master push switch is off

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Preconditions**   | User has master push switch OFF; all category push toggles are ON       |
| **Steps**           | 1. Trigger any event (rental request, message, etc.) for this user      |
| **Expected Result** | No push notification is received. In-app notification IS still created. |

### UAT-5.6: In-app notification always created regardless of push preferences

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has both master email and push switches OFF                                                |
| **Steps**           | 1. Trigger a notification event for this user (e.g., receive a message)                         |
| **Expected Result** | An in-app notification appears in the user's notification inbox/bell. No email or push is sent. |

### UAT-5.7: Push notification does not contain sensitive data

| Field               | Value                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Push notifications are enabled; DevTools is open to inspect the service worker                                                                                                                                       |
| **Steps**           | 1. Trigger a push notification (e.g., rental approval, new message)<br>2. Inspect the push payload in DevTools > Application > Service Workers > Push Messaging (or intercept via the service worker's `push` event) |
| **Expected Result** | The payload contains only reference IDs (rentalId, conversationId), a title, body, and linkUrl. No user names, email addresses, phone numbers, or financial amounts are present.                                     |

---

## UAT-6: Push Notification Deep Linking

**Requirements:** Req 7

### UAT-6.1: Clicking a rental notification opens the rental detail page

| Field               | Value                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | A push notification for a rental event is displayed                                                                                                     |
| **Steps**           | 1. Click/tap the notification                                                                                                                           |
| **Expected Result** | The app opens (or focuses if already open) and navigates to `/dashboard/rental/{id}` for the relevant rental. The correct rental details are displayed. |

### UAT-6.2: Clicking a message notification opens the mailbox conversation

| Field               | Value                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | A push notification for a new message is displayed                                                                                 |
| **Steps**           | 1. Click/tap the notification                                                                                                      |
| **Expected Result** | The app opens and navigates to the mailbox with the relevant conversation selected (e.g., `/dashboard/mailbox?conversation={id}`). |

### UAT-6.3: Clicking a notification when the app is closed

| Field               | Value                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | The app tab is closed; a push notification is displayed                                                                                                                     |
| **Steps**           | 1. Click/tap the notification                                                                                                                                               |
| **Expected Result** | A new tab/window opens with the app, navigating directly to the relevant page (rental detail, mailbox, etc.). The user may need to authenticate if the session has expired. |

### UAT-6.4: Clicking a notification when the app is in background

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Preconditions**   | The app is open in a background tab; a push notification is displayed                       |
| **Steps**           | 1. Click/tap the notification                                                               |
| **Expected Result** | The existing tab is focused and navigates to the relevant page. No duplicate tab is opened. |

---

## UAT-7: Multi-Device Support

**Requirements:** Req 3

### UAT-7.1: Subscribe on two devices

| Field               | Value                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Same user account; two different browsers or devices                                                                                                     |
| **Steps**           | 1. Log in on Device A (e.g., Chrome on desktop) and enable push<br>2. Log in on Device B (e.g., Firefox on desktop, or Chrome on mobile) and enable push |
| **Expected Result** | Both devices are subscribed. No errors during subscription on either device.                                                                             |

### UAT-7.2: Both devices receive push notifications

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Preconditions**   | User is subscribed on two devices (UAT-7.1)                                  |
| **Steps**           | 1. Trigger a notification event for the user (e.g., rental request received) |
| **Expected Result** | Both devices display the push notification.                                  |

### UAT-7.3: Unsubscribing one device does not affect the other

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User is subscribed on two devices                                                                    |
| **Steps**           | 1. On Device A, disable push (via settings or clearing site data)<br>2. Trigger a notification event |
| **Expected Result** | Device B still receives the push notification. Device A does not.                                    |

---

## UAT-8: Subscription Revocation and Cleanup

**Requirements:** Req 10

### UAT-8.1: Expired subscription is cleaned up on next push attempt

| Field               | Value                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has push enabled; simulate an expired subscription (e.g., clear browser data on one device without unsubscribing via the app)                                         |
| **Steps**           | 1. Clear site data on Device A (simulating subscription expiration)<br>2. Trigger a notification event                                                                     |
| **Expected Result** | The push to Device A fails silently (user sees nothing). Other devices (if any) still receive the notification. The stale subscription is marked inactive in the database. |

---

## UAT-9: Email Preference Integration

**Requirements:** Req 1, Req 9

### UAT-9.1: Email sent when email preferences are enabled

| Field               | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Preconditions**   | User has master email ON and Bookings email ON                                             |
| **Steps**           | 1. Trigger a booking event (e.g., rental request created)                                  |
| **Expected Result** | The user receives an email notification for the booking event (check inbox or email logs). |

### UAT-9.2: No email when category email is disabled

| Field               | Value                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | User has master email ON but Bookings email OFF                                                                       |
| **Steps**           | 1. Trigger a booking event                                                                                            |
| **Expected Result** | No email is sent for the booking event. In-app notification is still created. Push is sent if push preferences allow. |

### UAT-9.3: No email when master email is off

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Preconditions**   | User has master email OFF                                               |
| **Steps**           | 1. Trigger any notification event                                       |
| **Expected Result** | No email is sent for any event. In-app notifications are still created. |

---

## UAT-10: Cross-Browser Compatibility

**Requirements:** Req 2, Non-Functional (Usability)

### UAT-10.1: Push works in Chrome

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Preconditions**   | Chrome (latest stable) on desktop                                                    |
| **Steps**           | 1. Enable push notifications<br>2. Trigger a notification event                      |
| **Expected Result** | Push notification is received and displayed. Notification click navigates correctly. |

### UAT-10.2: Push works in Firefox

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Preconditions**   | Firefox (latest stable) on desktop                                                   |
| **Steps**           | 1. Enable push notifications<br>2. Trigger a notification event                      |
| **Expected Result** | Push notification is received and displayed. Notification click navigates correctly. |

### UAT-10.3: Push works in Edge

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Preconditions**   | Edge (latest stable) on desktop                                                      |
| **Steps**           | 1. Enable push notifications<br>2. Trigger a notification event                      |
| **Expected Result** | Push notification is received and displayed. Notification click navigates correctly. |

### UAT-10.4: Push works in Safari 16+

| Field               | Value                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Safari 16+ on macOS or iOS                                                                                                                                                    |
| **Steps**           | 1. Enable push notifications<br>2. Trigger a notification event                                                                                                               |
| **Expected Result** | Push notification is received and displayed. Notification click navigates correctly. (Note: Safari may require the PWA to be "added to Home Screen" on iOS for push to work.) |

### UAT-10.5: Graceful degradation on unsupported browsers

| Field               | Value                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | An older browser that does not support the Push API                                                                                               |
| **Steps**           | 1. Load the app<br>2. Attempt to enable push in settings                                                                                          |
| **Expected Result** | The app does not crash. The push enable option is either hidden or displays a message indicating the browser does not support push notifications. |

---

## UAT-11: Notification Event Coverage

**Requirements:** Req 8

For each event below, verify the correct party receives a push notification when preferences allow.

### UAT-11.1: Booking request received (owner)

| Field             | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| **Trigger**       | Renter submits a rental request                            |
| **Recipient**     | Listing owner                                              |
| **Expected Push** | Notification indicating a new booking request was received |

### UAT-11.2: Booking approved (renter)

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| **Trigger**       | Owner approves a rental request                  |
| **Recipient**     | Renter                                           |
| **Expected Push** | Notification indicating the booking was approved |

### UAT-11.3: Booking denied (renter)

| Field             | Value                                          |
| ----------------- | ---------------------------------------------- |
| **Trigger**       | Owner denies a rental request                  |
| **Recipient**     | Renter                                         |
| **Expected Push** | Notification indicating the booking was denied |

### UAT-11.4: Booking cancelled

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| **Trigger**       | Either party cancels a rental                    |
| **Recipient**     | The other party                                  |
| **Expected Push** | Notification indicating the rental was cancelled |

### UAT-11.5: New message received

| Field             | Value                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| **Trigger**       | User sends a message in a conversation                                 |
| **Recipient**     | The other participant                                                  |
| **Expected Push** | Notification indicating a new message (no message content in the push) |

### UAT-11.6: Payment confirmation

| Field             | Value                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| **Trigger**       | A payment is processed successfully                                                |
| **Recipient**     | Payer and/or recipient (as applicable)                                             |
| **Expected Push** | Notification indicating a payment was processed (no financial amounts in the push) |

### UAT-11.7: Dispute created

| Field             | Value                                              |
| ----------------- | -------------------------------------------------- |
| **Trigger**       | A dispute is opened on a rental                    |
| **Recipient**     | The other party in the rental                      |
| **Expected Push** | Notification indicating a dispute has been created |

### UAT-11.8: Dispute resolved

| Field             | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| **Trigger**       | A dispute is resolved                                 |
| **Recipient**     | Both parties                                          |
| **Expected Push** | Notification indicating the dispute has been resolved |

---

## UAT-12: Pickup and Return Reminders

**Requirements:** Req 13

### UAT-12.1: Pickup reminder received before rental start

| Field               | Value                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Renter has an approved rental starting within the configured reminder window (e.g., 24 hours); Reminders category push is ON    |
| **Steps**           | 1. Wait for the reminder scheduler to run (or trigger manually)<br>2. Check for push notification                               |
| **Expected Result** | Renter receives a push notification reminding them about the upcoming pickup. The notification links to the rental detail page. |

### UAT-12.2: Return reminder received before rental end

| Field               | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Renter has an active rental ending within the configured reminder window; Reminders category push is ON |
| **Steps**           | 1. Wait for the reminder scheduler to run (or trigger manually)<br>2. Check for push notification       |
| **Expected Result** | Renter receives a push notification reminding them about the upcoming return.                           |

### UAT-12.3: No reminder when reminders category is disabled

| Field               | Value                                                               |
| ------------------- | ------------------------------------------------------------------- |
| **Preconditions**   | Renter has Reminders category push OFF                              |
| **Steps**           | 1. Wait for the reminder scheduler to run                           |
| **Expected Result** | No push reminder is received. In-app reminder may still be created. |

### UAT-12.4: No reminder for cancelled or completed rentals

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Preconditions**   | A rental that was cancelled or already completed             |
| **Steps**           | 1. Wait for the reminder scheduler to run                    |
| **Expected Result** | No push reminder is sent for the cancelled/completed rental. |

---

## UAT-13: Security and Privacy

**Requirements:** Non-Functional (Security)

### UAT-13.1: VAPID keys are not exposed to the client

| Field               | Value                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**           | 1. Open DevTools > Network<br>2. Perform push subscription and notification flows<br>3. Inspect all API requests and responses<br>4. Search page source for VAPID private key |
| **Expected Result** | Only the VAPID public key is visible in client-side code. The private key is never present in network responses, page source, or client bundles.                              |

### UAT-13.2: Push subscription requires authentication

| Field               | Value                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Steps**           | 1. Log out of the app<br>2. Manually send a POST request to `/api/push/subscribe` with a valid subscription body |
| **Expected Result** | The API returns 401 Unauthorized. No subscription is created.                                                    |

### UAT-13.3: Push payloads contain no PII

| Field               | Value                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**           | 1. Enable push and trigger various notification events<br>2. Inspect push payloads via service worker logs or DevTools                                                                               |
| **Expected Result** | No user names, email addresses, phone numbers, or financial amounts appear in any push payload. Only reference IDs (rentalId, conversationId, etc.), a generic title, body, and linkUrl are present. |

---

## UAT-14: Error Resilience

**Requirements:** Non-Functional (Reliability)

### UAT-14.1: Push failure does not block in-app notifications

| Field               | Value                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Simulate push delivery failure (e.g., by corrupting the subscription endpoint in the database)                                                        |
| **Steps**           | 1. Trigger a notification event                                                                                                                       |
| **Expected Result** | The in-app notification is still created and visible. Email is sent if email preferences allow. The user is not shown any error for the push failure. |

### UAT-14.2: Push failure does not block email delivery

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Preconditions**   | Simulate push delivery failure                              |
| **Steps**           | 1. Trigger a notification event where email is also enabled |
| **Expected Result** | The email is sent successfully despite the push failure.    |

### UAT-14.3: Preference save failure shows error feedback

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions**   | Simulate a backend failure for preference save (e.g., database unavailable)                                                  |
| **Steps**           | 1. Navigate to preferences and toggle a setting                                                                              |
| **Expected Result** | An error toast or message informs the user that the preference could not be saved. The toggle reverts to its previous state. |

---

## Test Execution Checklist

Use this checklist to track UAT progress during testing rounds.

| Test ID  | Description                              | Status | Tester | Date | Notes |
| -------- | ---------------------------------------- | ------ | ------ | ---- | ----- |
| UAT-1.1  | SW registers on page load                |        |        |      |       |
| UAT-1.2  | SW failure does not break app            |        |        |      |       |
| UAT-1.3  | SW registers only in browser             |        |        |      |       |
| UAT-2.1  | No prompt on first visit                 |        |        |      |       |
| UAT-2.2  | No prompt on login only                  |        |        |      |       |
| UAT-2.3  | Prompt after rental submit               |        |        |      |       |
| UAT-2.4  | Prompt after first approval              |        |        |      |       |
| UAT-2.5  | Accept prompt subscribes device          |        |        |      |       |
| UAT-2.6  | Dismiss prompt does not subscribe        |        |        |      |       |
| UAT-2.7  | No duplicate prompts                     |        |        |      |       |
| UAT-2.8  | No prompt when already granted           |        |        |      |       |
| UAT-2.9  | No prompt when already denied            |        |        |      |       |
| UAT-3.1  | Enable push from settings (default)      |        |        |      |       |
| UAT-3.2  | Enable push from settings (granted)      |        |        |      |       |
| UAT-3.3  | Blocked state shown when denied          |        |        |      |       |
| UAT-4.1  | View default preferences                 |        |        |      |       |
| UAT-4.2  | Toggle category preference               |        |        |      |       |
| UAT-4.3  | Master push switch off                   |        |        |      |       |
| UAT-4.4  | Master push switch back on               |        |        |      |       |
| UAT-4.5  | Master email switch off                  |        |        |      |       |
| UAT-4.6  | Preferences are user-specific            |        |        |      |       |
| UAT-5.1  | Push for rental request (owner)          |        |        |      |       |
| UAT-5.2  | Push for rental approval (renter)        |        |        |      |       |
| UAT-5.3  | Push for new message                     |        |        |      |       |
| UAT-5.4  | No push when category disabled           |        |        |      |       |
| UAT-5.5  | No push when master push off             |        |        |      |       |
| UAT-5.6  | In-app notification always created       |        |        |      |       |
| UAT-5.7  | No sensitive data in push payload        |        |        |      |       |
| UAT-6.1  | Click rental notification opens detail   |        |        |      |       |
| UAT-6.2  | Click message notification opens mailbox |        |        |      |       |
| UAT-6.3  | Click notification when app closed       |        |        |      |       |
| UAT-6.4  | Click notification when app backgrounded |        |        |      |       |
| UAT-7.1  | Subscribe on two devices                 |        |        |      |       |
| UAT-7.2  | Both devices receive push                |        |        |      |       |
| UAT-7.3  | Unsubscribe one device only              |        |        |      |       |
| UAT-8.1  | Expired subscription cleaned up          |        |        |      |       |
| UAT-9.1  | Email sent when enabled                  |        |        |      |       |
| UAT-9.2  | No email when category disabled          |        |        |      |       |
| UAT-9.3  | No email when master off                 |        |        |      |       |
| UAT-10.1 | Push works in Chrome                     |        |        |      |       |
| UAT-10.2 | Push works in Firefox                    |        |        |      |       |
| UAT-10.3 | Push works in Edge                       |        |        |      |       |
| UAT-10.4 | Push works in Safari 16+                 |        |        |      |       |
| UAT-10.5 | Graceful degradation unsupported         |        |        |      |       |
| UAT-11.1 | Booking request push (owner)             |        |        |      |       |
| UAT-11.2 | Booking approved push (renter)           |        |        |      |       |
| UAT-11.3 | Booking denied push (renter)             |        |        |      |       |
| UAT-11.4 | Booking cancelled push                   |        |        |      |       |
| UAT-11.5 | New message push                         |        |        |      |       |
| UAT-11.6 | Payment confirmation push                |        |        |      |       |
| UAT-11.7 | Dispute created push                     |        |        |      |       |
| UAT-11.8 | Dispute resolved push                    |        |        |      |       |
| UAT-12.1 | Pickup reminder push                     |        |        |      |       |
| UAT-12.2 | Return reminder push                     |        |        |      |       |
| UAT-12.3 | No reminder when disabled                |        |        |      |       |
| UAT-12.4 | No reminder for cancelled/completed      |        |        |      |       |
| UAT-13.1 | VAPID keys not exposed                   |        |        |      |       |
| UAT-13.2 | Subscription requires auth               |        |        |      |       |
| UAT-13.3 | No PII in push payloads                  |        |        |      |       |
| UAT-14.1 | Push failure doesn't block in-app        |        |        |      |       |
| UAT-14.2 | Push failure doesn't block email         |        |        |      |       |
| UAT-14.3 | Preference save failure shows error      |        |        |      |       |
