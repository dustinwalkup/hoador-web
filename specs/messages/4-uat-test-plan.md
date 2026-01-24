# Messages API Migration - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for Phase 4 of the Server Actions to API Routes Migration - Messages feature. UAT validates that the migration from server actions to API routes with React Query mutations works correctly from an end-user perspective. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Messages API Migration (Phase 4)  
**Version**: 1.0  
**Date**: 2024  
**Test Environment**: Staging/Production  
**Reference Documents**:

- Migration Plan: `.cursor/plans/server_actions_to_api_routes_migration_de722195.plan.md`
- Requirements: `specs/messages/1-requirements.md` (if exists)
- Test Plan: `specs/messages/4-test-plan.md`

## Test Objectives

1. Verify that starting conversations works via API routes and React Query hooks
2. Validate that sending messages works with optimistic updates and proper cache invalidation
3. Confirm that conversation management (archive/unarchive, read/unread, delete) functions correctly
4. Ensure that all mutations provide proper user feedback (loading states, success/error messages)
5. Verify that cache invalidation works correctly after mutations
6. Validate that error handling provides clear, user-friendly messages
7. Ensure that optimistic updates provide immediate UI feedback
8. Confirm that all existing functionality continues to work after migration

## Test Scenarios

### Scenario 1: Start New Conversation via API Route

**User Story**: As a user, I want to start a conversation with another user about a listing, so that I can communicate with them.

**Preconditions**:

- User is logged in and authenticated
- Another user exists in the system
- A listing exists that the user wants to message about
- User is viewing a listing detail page or user profile

**Test Steps**:

1. Navigate to a listing detail page or user profile
2. Click "Message Owner" or "Message" button
3. Verify message modal opens
4. Enter a message: "Hi, I'm interested in renting this tool. Is it available next week?"
5. Click "Send Message" button
6. Observe loading state (button shows "Sending..." with spinner)
7. Wait for response

**Expected Results**:

- ✅ Message modal opens correctly
- ✅ Form validation works (empty message shows error)
- ✅ Loading state displays during API call
- ✅ Success message appears: "Message sent successfully" (or similar)
- ✅ Modal closes or shows success state
- ✅ Conversation is created in mailbox
- ✅ New conversation appears in conversations list
- ✅ Conversation shows correct recipient name and listing context
- ✅ Initial message appears in conversation
- ✅ Unread count updates (if applicable)
- ✅ No console errors in browser developer tools
- ✅ Network tab shows successful POST to `/api/messages/conversations`

**Test Data**:

- Valid recipient user ID
- Valid listing ID and name
- Message content: 10-5000 characters
- Invalid message: Empty string (should show validation error)

**Priority**: Critical  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations`

---

### Scenario 2: Start Conversation with Existing Conversation

**User Story**: As a user, I want to continue an existing conversation when I click "Message" on a listing I've already messaged about.

**Preconditions**:

- User is logged in
- User has an existing conversation with another user about a specific listing
- User is viewing the same listing detail page

**Test Steps**:

1. Navigate to a listing detail page where user has an existing conversation
2. Click "Message Owner" button
3. Verify message modal opens
4. Verify modal shows existing conversation context (if applicable)
5. Enter a new message
6. Click "Send Message"
7. Verify message is sent

**Expected Results**:

- ✅ Modal opens correctly
- ✅ If existing conversation exists, it may be referenced or opened
- ✅ New message is sent to existing conversation (not creating duplicate)
- ✅ Conversation is updated with new message
- ✅ Conversation moves to top of conversations list
- ✅ Last message preview updates in conversations list

**Test Data**:

- User with existing conversation
- Same listing ID as existing conversation
- New message content

**Priority**: High  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations`

---

### Scenario 3: Send Message in Existing Conversation

**User Story**: As a user, I want to send messages in an existing conversation with optimistic updates for immediate feedback.

**Preconditions**:

- User is logged in
- User has an existing conversation
- User is viewing the conversation in mailbox

**Test Steps**:

1. Navigate to mailbox (`/dashboard/mailbox`)
2. Click on an existing conversation
3. Verify conversation messages load
4. Type a message in the message input: "Thanks for the quick response!"
5. Press Enter or click Send button
6. Observe immediate UI update (optimistic update)
7. Wait for API response

**Expected Results**:

- ✅ Message appears immediately in chat (optimistic update)
- ✅ Message shows "sending" indicator or temporary styling
- ✅ Loading state on send button during API call
- ✅ After API response, message is confirmed (removes temporary styling)
- ✅ Message persists after page refresh
- ✅ Conversation moves to top of conversations list
- ✅ Last message preview updates
- ✅ Unread count updates for recipient
- ✅ Success toast appears: "Message sent" (if configured)
- ✅ Network tab shows successful POST to `/api/messages/conversations/[conversationId]/messages`
- ✅ Cache is invalidated and conversation refreshes
- ✅ No duplicate messages appear

**Test Data**:

- Existing conversation ID
- Message content: Various lengths (short, medium, long)
- Message with special characters and emojis

**Priority**: Critical  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations/[conversationId]/messages`, Phase 4.2 - `useSendMessage()` with optimistic update

---

### Scenario 4: Send Message - Optimistic Update Failure Handling

**User Story**: As a user, I want to see an error message if my message fails to send, and the optimistic update should be reverted.

**Preconditions**:

- User is logged in
- User has an existing conversation
- Network can be simulated to fail (or API can be temporarily disabled)

**Test Steps**:

1. Navigate to mailbox
2. Open an existing conversation
3. Type a message
4. Send the message
5. Simulate network failure (disable network or API error)
6. Observe error handling

**Expected Results**:

- ✅ Optimistic message appears immediately
- ✅ API call fails (network error or server error)
- ✅ Error toast appears: "Failed to send message. Please try again." (or similar)
- ✅ Optimistic message is removed from UI (reverted)
- ✅ Message input retains the message content (user can retry)
- ✅ User can attempt to send again
- ✅ No duplicate messages after retry succeeds

**Test Data**:

- Network failure simulation
- API error response (500, 400, etc.)
- Message content to retry

**Priority**: High  
**Requirement Reference**: Phase 4.2 - Error handling in `useSendMessage()`

---

### Scenario 5: Archive Conversation

**User Story**: As a user, I want to archive conversations to organize my mailbox without deleting them.

**Preconditions**:

- User is logged in
- User has at least one active (non-archived) conversation
- User is viewing mailbox

**Test Steps**:

1. Navigate to mailbox
2. Verify "Inbox" tab is active
3. Find a conversation to archive
4. Click archive button (or right-click menu option)
5. Confirm archive action (if confirmation dialog appears)
6. Observe conversation behavior
7. Click "Archived" tab
8. Verify archived conversation appears

**Expected Results**:

- ✅ Archive action is available (button or menu option)
- ✅ Conversation is removed from Inbox immediately (optimistic update)
- ✅ Success toast appears: "Conversation archived" (if configured)
- ✅ Conversation appears in "Archived" tab
- ✅ Unread count decreases if conversation had unread messages
- ✅ Network tab shows successful POST to `/api/messages/conversations/[conversationId]/archive`
- ✅ Cache is invalidated - conversations list refreshes
- ✅ Archived conversation persists after page refresh
- ✅ No console errors

**Test Data**:

- Active conversation with unread messages
- Active conversation with read messages
- Multiple conversations to test bulk operations (if available)

**Priority**: High  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations/[conversationId]/archive`, Phase 4.2 - `useArchiveConversation()`

---

### Scenario 6: Unarchive Conversation

**User Story**: As a user, I want to unarchive conversations to move them back to my inbox.

**Preconditions**:

- User is logged in
- User has at least one archived conversation
- User is viewing "Archived" tab in mailbox

**Test Steps**:

1. Navigate to mailbox
2. Click "Archived" tab
3. Find an archived conversation
4. Click unarchive button (or right-click menu option)
5. Observe conversation behavior
6. Click "Inbox" tab
7. Verify unarchived conversation appears

**Expected Results**:

- ✅ Unarchive action is available
- ✅ Conversation is removed from Archived tab immediately
- ✅ Success toast appears: "Conversation unarchived" (if configured)
- ✅ Conversation appears in "Inbox" tab
- ✅ Network tab shows successful POST to `/api/messages/conversations/[conversationId]/unarchive`
- ✅ Cache is invalidated - both Inbox and Archived tabs refresh
- ✅ Unarchived conversation persists after page refresh
- ✅ No console errors

**Test Data**:

- Archived conversation
- Multiple archived conversations

**Priority**: High  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations/[conversationId]/unarchive`, Phase 4.2 - `useUnarchiveConversation()`

---

### Scenario 7: Mark Conversation as Read

**User Story**: As a user, I want to mark conversations as read to track which conversations I've seen.

**Preconditions**:

- User is logged in
- User has at least one conversation with unread messages
- User is viewing mailbox

**Test Steps**:

1. Navigate to mailbox
2. Verify unread indicator (badge or bold text) on conversation
3. Click on conversation to open it
4. Verify conversation is automatically marked as read (or manually mark as read)
5. Observe unread count updates
6. Navigate back to conversations list
7. Verify unread indicator is removed

**Expected Results**:

- ✅ Unread indicator is visible on conversations with unread messages
- ✅ Opening conversation marks it as read (or manual action available)
- ✅ Unread count decreases immediately
- ✅ Conversation unread indicator is removed
- ✅ Network tab shows successful POST to `/api/messages/conversations/[conversationId]/read`
- ✅ Cache is invalidated - unread count and conversation list refresh
- ✅ Read status persists after page refresh
- ✅ No console errors

**Test Data**:

- Conversation with unread messages
- Multiple conversations with unread messages
- Conversation with many unread messages

**Priority**: High  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations/[conversationId]/read`, Phase 4.2 - `useMarkConversationRead()`

---

### Scenario 8: Mark Conversation as Unread

**User Story**: As a user, I want to mark conversations as unread to remind myself to respond later.

**Preconditions**:

- User is logged in
- User has at least one read conversation
- User is viewing mailbox

**Test Steps**:

1. Navigate to mailbox
2. Find a read conversation (no unread indicator)
3. Right-click or use menu option to "Mark as Unread"
4. Observe conversation behavior
5. Verify unread count updates

**Expected Results**:

- ✅ "Mark as Unread" action is available
- ✅ Conversation shows unread indicator immediately
- ✅ Unread count increases
- ✅ Success toast appears: "Conversation marked as unread" (if configured)
- ✅ Network tab shows successful POST to `/api/messages/conversations/[conversationId]/unread`
- ✅ Cache is invalidated - unread count and conversation list refresh
- ✅ Unread status persists after page refresh
- ✅ No console errors

**Test Data**:

- Read conversation
- Multiple read conversations

**Priority**: Medium  
**Requirement Reference**: Phase 4.1 - POST `/api/messages/conversations/[conversationId]/unread`, Phase 4.2 - `useMarkConversationUnread()`

---

### Scenario 9: Delete Conversation

**User Story**: As a user, I want to delete conversations I no longer need.

**Preconditions**:

- User is logged in
- User has at least one conversation (archived or active)
- User is viewing mailbox

**Test Steps**:

1. Navigate to mailbox
2. Find a conversation to delete
3. Click delete button (or right-click menu option)
4. Confirm deletion in confirmation dialog
5. Observe conversation behavior
6. Verify conversation is removed from list

**Expected Results**:

- ✅ Delete action is available
- ✅ Confirmation dialog appears: "Are you sure you want to delete this conversation? This action cannot be undone."
- ✅ Conversation is removed from list immediately after confirmation
- ✅ Success toast appears: "Conversation deleted" (if configured)
- ✅ Network tab shows successful DELETE to `/api/messages/conversations/[conversationId]`
- ✅ Cache is invalidated - conversations list refreshes
- ✅ Deleted conversation does not reappear after page refresh
- ✅ Unread count decreases if deleted conversation had unread messages
- ✅ No console errors

**Test Data**:

- Active conversation
- Archived conversation
- Conversation with unread messages
- Conversation with many messages

**Priority**: High  
**Requirement Reference**: Phase 4.1 - DELETE `/api/messages/conversations/[conversationId]`, Phase 4.2 - `useDeleteConversation()`

---

### Scenario 10: Delete Conversation - Cancellation

**User Story**: As a user, I want to cancel a delete action if I change my mind.

**Preconditions**:

- User is logged in
- User has at least one conversation
- User is viewing mailbox

**Test Steps**:

1. Navigate to mailbox
2. Find a conversation
3. Click delete button
4. Click "Cancel" in confirmation dialog
5. Verify conversation remains in list

**Expected Results**:

- ✅ Confirmation dialog appears
- ✅ "Cancel" button is available
- ✅ Clicking "Cancel" closes dialog
- ✅ Conversation remains in list
- ✅ No API call is made
- ✅ No changes to conversation state
- ✅ No console errors

**Test Data**:

- Any conversation

**Priority**: Medium  
**Requirement Reference**: Phase 4.2 - `useDeleteConversation()` with confirmation

---

### Scenario 11: Cache Invalidation After Mutations

**User Story**: As a user, I want to see updated data immediately after performing actions, without needing to refresh the page.

**Preconditions**:

- User is logged in
- User has multiple conversations
- User is viewing mailbox

**Test Steps**:

1. Navigate to mailbox
2. Note the current state (conversation order, unread counts, etc.)
3. Perform an action (send message, archive, mark read, etc.)
4. Verify related data updates immediately
5. Perform another action
6. Verify all related queries refresh correctly

**Expected Results**:

- ✅ After sending message: Conversation list updates, conversation details refresh
- ✅ After archiving: Both Inbox and Archived tabs update
- ✅ After marking read: Unread count updates, conversation list refreshes
- ✅ After deleting: Conversation list updates, unread count decreases
- ✅ All related queries invalidate correctly
- ✅ No stale data appears
- ✅ No need to manually refresh page
- ✅ Network tab shows appropriate API calls and cache invalidation

**Test Data**:

- Multiple conversations
- Various conversation states (read/unread, archived/active)

**Priority**: Critical  
**Requirement Reference**: Phase 4.2 - Cache invalidation in all mutation hooks

---

### Scenario 12: Error Handling - Network Failure

**User Story**: As a user, I want to see clear error messages when network requests fail.

**Preconditions**:

- User is logged in
- Network can be disabled or API can be made unavailable

**Test Steps**:

1. Navigate to mailbox
2. Disable network connection (or simulate API failure)
3. Attempt to send a message
4. Attempt to archive a conversation
5. Attempt to mark conversation as read
6. Attempt to delete a conversation
7. Observe error messages

**Expected Results**:

- ✅ Each failed action shows appropriate error message
- ✅ Error messages are user-friendly (not technical)
- ✅ Error messages appear as toast notifications
- ✅ User can retry the action after network is restored
- ✅ No console errors that expose technical details to users
- ✅ UI remains functional (not broken)
- ✅ Optimistic updates are reverted on error

**Test Data**:

- Network failure simulation
- API error responses (500, 503, timeout, etc.)

**Priority**: High  
**Requirement Reference**: Phase 4.2 - Error handling in all mutation hooks

---

### Scenario 13: Error Handling - Validation Errors

**User Story**: As a user, I want to see validation errors when I provide invalid data.

**Preconditions**:

- User is logged in
- User is attempting to start a conversation or send a message

**Test Steps**:

1. Navigate to mailbox or listing page
2. Attempt to send empty message
3. Attempt to send message with only whitespace
4. Attempt to send message exceeding character limit (5000+)
5. Attempt to start conversation with invalid recipient ID
6. Observe validation errors

**Expected Results**:

- ✅ Empty message shows validation error: "Message cannot be empty"
- ✅ Whitespace-only message shows validation error
- ✅ Message exceeding limit shows validation error: "Message must be less than 5000 characters"
- ✅ Invalid recipient shows error: "Invalid recipient" or similar
- ✅ Validation errors appear inline (near input field)
- ✅ Validation errors are clear and actionable
- ✅ User can correct errors and retry
- ✅ No API calls are made for invalid data

**Test Data**:

- Empty string
- Whitespace-only string
- Message with 5001+ characters
- Invalid recipient ID
- Invalid conversation ID

**Priority**: High  
**Requirement Reference**: Phase 4.1 - API route validation, Phase 4.2 - Client-side validation

---

### Scenario 14: Error Handling - Unauthorized Access

**User Story**: As a system, I want to prevent users from accessing conversations they're not part of.

**Preconditions**:

- User A is logged in
- User B has a conversation with User C
- User A attempts to access User B's conversation

**Test Steps**:

1. Log in as User A
2. Attempt to access conversation ID that belongs to User B and User C
3. Attempt to send message to that conversation
4. Attempt to archive that conversation
5. Observe error responses

**Expected Results**:

- ✅ API returns 401 or 403 error
- ✅ User sees error message: "You don't have permission to access this conversation" or similar
- ✅ User cannot perform actions on unauthorized conversations
- ✅ No data is leaked about other users' conversations
- ✅ Error is logged server-side for security monitoring

**Test Data**:

- Conversation ID that user is not part of
- Different user accounts

**Priority**: Critical  
**Requirement Reference**: Phase 4.1 - Authorization checks in API routes

---

### Scenario 15: Loading States and User Feedback

**User Story**: As a user, I want to see loading indicators during API calls so I know the system is processing my request.

**Preconditions**:

- User is logged in
- User is performing various actions in mailbox

**Test Steps**:

1. Navigate to mailbox
2. Send a message - observe loading state
3. Archive a conversation - observe loading state
4. Mark conversation as read - observe loading state
5. Delete a conversation - observe loading state
6. Start a new conversation - observe loading state

**Expected Results**:

- ✅ Send button shows "Sending..." with spinner during message send
- ✅ Archive button shows loading state during archive action
- ✅ Read/unread actions show loading state
- ✅ Delete action shows loading state in confirmation dialog
- ✅ Start conversation button shows "Sending..." during API call
- ✅ Loading states are clear and visible
- ✅ Buttons are disabled during loading to prevent duplicate actions
- ✅ Loading states disappear after action completes (success or error)

**Test Data**:

- Various actions in mailbox
- Slow network simulation (to observe loading states longer)

**Priority**: Medium  
**Requirement Reference**: Phase 4.2 - Loading states in mutation hooks (`isPending`)

---

### Scenario 16: Success Messages and Feedback

**User Story**: As a user, I want to see confirmation when my actions succeed.

**Preconditions**:

- User is logged in
- User is performing various actions in mailbox

**Test Steps**:

1. Navigate to mailbox
2. Send a message successfully
3. Archive a conversation successfully
4. Mark conversation as read successfully
5. Delete a conversation successfully
6. Start a new conversation successfully
7. Observe success feedback

**Expected Results**:

- ✅ Success toast appears for each action (if configured)
- ✅ Success messages are clear and concise
- ✅ Success messages don't block UI interaction
- ✅ Success messages auto-dismiss after a few seconds
- ✅ UI updates immediately (optimistic updates)
- ✅ Visual feedback confirms action success (e.g., conversation moves, indicator changes)

**Test Data**:

- Various successful actions

**Priority**: Medium  
**Requirement Reference**: Phase 4.2 - Success handling in mutation hooks

---

### Scenario 17: Concurrent Actions - Multiple Users

**User Story**: As a system, I want to handle concurrent actions from multiple users in the same conversation correctly.

**Preconditions**:

- User A and User B are logged in (separate browsers/sessions)
- User A and User B have an active conversation
- Both users are viewing the conversation

**Test Steps**:

1. User A opens conversation
2. User B opens same conversation
3. User A sends a message
4. User B sends a message simultaneously
5. Observe message ordering and display
6. User A archives conversation
7. User B attempts to send another message
8. Observe behavior

**Expected Results**:

- ✅ Messages appear in correct chronological order
- ✅ Both users see messages from each other
- ✅ No duplicate messages appear
- ✅ Conversation state updates correctly for both users
- ✅ Archive action is reflected for both users (or appropriate behavior)
- ✅ No race conditions cause data corruption
- ✅ Cache invalidation works correctly for both users

**Test Data**:

- Two user accounts
- Shared conversation
- Simultaneous actions

**Priority**: Medium  
**Requirement Reference**: Phase 4.2 - Concurrent action handling, cache management

---

### Scenario 18: Real-Time Updates (if applicable)

**User Story**: As a user, I want to see new messages appear in real-time without manually refreshing.

**Preconditions**:

- User A and User B are logged in
- User A and User B have an active conversation
- Real-time updates are implemented (polling or WebSocket)

**Test Steps**:

1. User A opens conversation
2. User B sends a message
3. Observe if message appears for User A automatically
4. User A sends a message
5. Observe if message appears for User B automatically
6. User B archives conversation
7. Observe if archive status updates for User A

**Expected Results**:

- ✅ New messages appear automatically (within reasonable time, e.g., 30 seconds)
- ✅ Conversation list updates when new messages arrive
- ✅ Unread count updates automatically
- ✅ Last message preview updates
- ✅ No manual refresh required
- ✅ Real-time updates don't interfere with user actions
- ✅ Optimistic updates work correctly with real-time updates

**Test Data**:

- Two user accounts
- Active conversation
- Real-time update mechanism (polling/WebSocket)

**Priority**: Medium (if real-time updates are implemented)  
**Requirement Reference**: Phase 4.2 - Real-time update integration with mutations

---

### Scenario 19: Performance - Large Conversation Lists

**User Story**: As a user, I want the mailbox to perform well even with many conversations.

**Preconditions**:

- User has 50+ conversations
- User is logged in
- User navigates to mailbox

**Test Steps**:

1. Navigate to mailbox with many conversations
2. Measure page load time
3. Scroll through conversations list
4. Perform actions (send message, archive, etc.)
5. Switch between Inbox and Archived tabs
6. Observe performance

**Expected Results**:

- ✅ Mailbox loads within acceptable time (< 3 seconds)
- ✅ Conversations list renders smoothly
- ✅ Scrolling is smooth (no lag)
- ✅ Actions complete within acceptable time (< 1 second)
- ✅ Tab switching is fast
- ✅ No memory leaks or performance degradation
- ✅ Pagination or infinite scroll works correctly (if implemented)

**Test Data**:

- User with 50-100+ conversations
- Mix of archived and active conversations
- Conversations with various message counts

**Priority**: Medium  
**Requirement Reference**: Performance requirements

---

### Scenario 20: Mobile Responsiveness

**User Story**: As a mobile user, I want to use all messaging features on my mobile device.

**Preconditions**:

- User is logged in on mobile device
- User has conversations
- Mobile viewport is active

**Test Steps**:

1. Open mailbox on mobile device (or resize browser to mobile width)
2. Verify layout is responsive
3. Test starting a conversation
4. Test sending a message
5. Test archiving a conversation
6. Test marking as read/unread
7. Test deleting a conversation
8. Test navigation between conversations and list

**Expected Results**:

- ✅ Layout adapts to mobile screen size
- ✅ All buttons and actions are accessible
- ✅ Message input is usable on mobile
- ✅ Touch interactions work correctly
- ✅ Modals and dialogs are mobile-friendly
- ✅ Navigation works smoothly
- ✅ No horizontal scrolling required
- ✅ Text is readable without zooming

**Test Data**:

- Mobile device or mobile viewport (375px, 414px widths)
- Various screen sizes

**Priority**: Medium  
**Requirement Reference**: Responsive design requirements

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible
- [ ] Test user accounts are created (multiple users for conversation testing)
- [ ] Test conversations are created (various states: read/unread, archived/active)
- [ ] API routes are deployed and accessible
- [ ] React Query hooks are implemented and available
- [ ] Components are updated to use new hooks
- [ ] Network monitoring tools are available (browser DevTools)
- [ ] Error logging is configured

### Test Environment

- **Environment**: Staging/Production
- **Browser**: Chrome, Firefox, Safari (latest versions)
- **Devices**: Desktop, Tablet, Mobile
- **Network**: Normal and throttled (for performance testing)
- **API**: Staging API endpoints

### Test Execution

- [ ] Execute all test scenarios
- [ ] Document results (Pass/Fail/Blocked)
- [ ] Capture screenshots for failures
- [ ] Record network requests/responses for API verification
- [ ] Log defects/issues in issue tracker
- [ ] Verify fixes and re-test failed scenarios
- [ ] Test on multiple browsers
- [ ] Test on mobile devices

### Post-Test Activities

- [ ] Review all test results
- [ ] Verify all critical scenarios passed
- [ ] Document any known issues or limitations
- [ ] Verify API routes are working correctly
- [ ] Verify React Query cache invalidation is working
- [ ] Verify error handling is user-friendly
- [ ] Sign off on feature acceptance
- [ ] Prepare test summary report

## Acceptance Criteria Summary

The Phase 4 Messages migration SHALL be considered accepted when:

1. ✅ All 7 API routes are implemented and functional:
   - POST `/api/messages/conversations` - Start conversation
   - POST `/api/messages/conversations/[conversationId]/messages` - Send message
   - POST `/api/messages/conversations/[conversationId]/archive` - Archive conversation
   - POST `/api/messages/conversations/[conversationId]/unarchive` - Unarchive conversation
   - POST `/api/messages/conversations/[conversationId]/read` - Mark as read
   - POST `/api/messages/conversations/[conversationId]/unread` - Mark as unread
   - DELETE `/api/messages/conversations/[conversationId]` - Delete conversation

2. ✅ All React Query mutation hooks are implemented:
   - `useStartConversation()` - Works correctly
   - `useSendMessage()` - Works with optimistic updates
   - `useArchiveConversation()` - Works correctly
   - `useUnarchiveConversation()` - Works correctly
   - `useMarkConversationRead()` - Works correctly
   - `useMarkConversationUnread()` - Works correctly
   - `useDeleteConversation()` - Works correctly

3. ✅ All components are updated to use new hooks instead of server actions

4. ✅ Cache invalidation works correctly after all mutations

5. ✅ Optimistic updates work for message sending

6. ✅ Error handling provides clear, user-friendly messages

7. ✅ Loading states are displayed during API calls

8. ✅ Success feedback is provided for all actions

9. ✅ All existing functionality continues to work

10. ✅ Performance is acceptable with expected load

11. ✅ Mobile responsiveness is maintained

12. ✅ No console errors or warnings

13. ✅ Network requests are optimized (no unnecessary calls)

## Known Issues and Limitations

_To be filled during test execution_

## Migration Verification Checklist

### API Routes

- [ ] POST `/api/messages/conversations` - Implemented and tested
- [ ] POST `/api/messages/conversations/[conversationId]/messages` - Implemented and tested
- [ ] POST `/api/messages/conversations/[conversationId]/archive` - Implemented and tested
- [ ] POST `/api/messages/conversations/[conversationId]/unarchive` - Implemented and tested
- [ ] POST `/api/messages/conversations/[conversationId]/read` - Implemented and tested
- [ ] POST `/api/messages/conversations/[conversationId]/unread` - Implemented and tested
- [ ] DELETE `/api/messages/conversations/[conversationId]` - Implemented and tested

### React Query Hooks

- [ ] `useStartConversation()` - Implemented and tested
- [ ] `useSendMessage()` - Implemented with optimistic updates
- [ ] `useArchiveConversation()` - Implemented and tested
- [ ] `useUnarchiveConversation()` - Implemented and tested
- [ ] `useMarkConversationRead()` - Implemented and tested
- [ ] `useMarkConversationUnread()` - Implemented and tested
- [ ] `useDeleteConversation()` - Implemented and tested

### Components Updated

- [ ] `MessageUserModal` - Updated to use `useStartConversation()`
- [ ] `ChatArea` - Updated to use `useSendMessage()`
- [ ] `ConversationsList` - Updated to use archive/unarchive/delete hooks
- [ ] All other message components - Updated to use new hooks

### Server Actions Removed

- [ ] `startConversationAction` - Removed (replaced by API route)
- [ ] `sendMessageAction` - Removed (replaced by API route)
- [ ] `archiveConversationAction` - Removed (replaced by API route)
- [ ] `unarchiveConversationAction` - Removed (replaced by API route)
- [ ] `markConversationReadAction` - Removed (replaced by API route)
- [ ] `markConversationUnreadAction` - Removed (replaced by API route)
- [ ] `deleteConversationAction` - Removed (replaced by API route)

## Test Sign-Off

- **Test Executor**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Business Stakeholder**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Product Owner**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**
- **Technical Lead**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Next Review**: After test execution
