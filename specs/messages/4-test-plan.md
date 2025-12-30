# Test Plan: Messages

## Requirements Traceability

This test plan covers messaging functionality including conversation management, message sending, read/unread status, archiving, and mailbox UI. Tests verify real-time messaging, conversation organization, and user experience requirements.

### Core Messaging Requirements

**Test Coverage**:

- Unit tests: MessagesDAL methods, server actions, message sanitization
- Integration tests: Conversation creation, message sending, status updates
- E2E tests: Complete messaging workflows from conversation start to message exchange
- BDD scenarios: Messaging acceptance criteria

## Test Types

### Unit Tests

#### DAL Methods

- [ ] `MessagesDAL.findOrCreateConversation` - Find or create conversation between users
  - Happy path: Existing conversation found and returned
  - Happy path: New conversation created when none exists
  - Edge case: User ID ordering (smaller ID first)
  - Error: Database error handled gracefully

- [ ] `MessagesDAL.sendMessage` - Send message in conversation
  - Happy path: Message sent successfully, conversation created if needed
  - Error: Invalid content throws ValidationError
  - Error: Unauthorized sender throws UnauthorizedError
  - Edge case: Message sanitization
  - Edge case: Rental ID association

- [ ] `MessagesDAL.getConversations` - Get user's conversations
  - Happy path: Returns user's conversations with summaries
  - Edge case: Empty result set
  - Edge case: Includes unread count
  - Edge case: Sorting by last message date

- [ ] `MessagesDAL.getConversationById` - Get conversation details
  - Happy path: Returns conversation with messages
  - Error: Conversation not found returns null
  - Error: User not participant throws UnauthorizedError
  - Edge case: Pagination for messages

- [ ] `MessagesDAL.markConversationRead` - Mark conversation as read
  - Happy path: Conversation marked as read
  - Error: User not participant throws UnauthorizedError
  - Error: Conversation not found throws NotFoundError

- [ ] `MessagesDAL.markConversationUnread` - Mark conversation as unread
  - Happy path: Conversation marked as unread
  - Error: User not participant throws UnauthorizedError
  - Error: Conversation not found throws NotFoundError

- [ ] `MessagesDAL.archiveConversation` - Archive conversation
  - Happy path: Conversation archived
  - Error: User not participant throws UnauthorizedError
  - Error: Conversation not found throws NotFoundError

- [ ] `MessagesDAL.unarchiveConversation` - Unarchive conversation
  - Happy path: Conversation unarchived
  - Error: User not participant throws UnauthorizedError
  - Error: Conversation not found throws NotFoundError

- [ ] `MessagesDAL.deleteConversation` - Delete conversation
  - Happy path: Conversation deleted
  - Error: User not participant throws UnauthorizedError
  - Error: Conversation not found throws NotFoundError

#### Server Actions

- [ ] `startConversation` - Start new conversation
  - Happy path: Creates conversation and sends initial message
  - Error: Invalid recipient returns error
  - Error: Cannot message self returns error
  - Integration: Verifies revalidatePath called

- [ ] `sendMessage` - Send message in conversation
  - Happy path: Message sent successfully
  - Error: Invalid content returns error
  - Error: Unauthorized access returns error
  - Integration: Verifies revalidatePath called

- [ ] `markConversationRead` - Mark conversation as read
  - Happy path: Conversation marked as read
  - Error: Unauthorized access returns error
  - Integration: Verifies revalidatePath called

- [ ] `markConversationUnread` - Mark conversation as unread
  - Happy path: Conversation marked as unread
  - Error: Unauthorized access returns error
  - Integration: Verifies revalidatePath called

- [ ] `archiveConversation` - Archive conversation
  - Happy path: Conversation archived
  - Error: Unauthorized access returns error
  - Integration: Verifies revalidatePath called

- [ ] `unarchiveConversation` - Unarchive conversation
  - Happy path: Conversation unarchived
  - Error: Unauthorized access returns error
  - Integration: Verifies revalidatePath called

- [ ] `deleteConversation` - Delete conversation
  - Happy path: Conversation deleted
  - Error: Unauthorized access returns error
  - Integration: Verifies revalidatePath called

#### Components

- [ ] `MailboxClient` - Main mailbox component
  - Rendering: Conversations list, chat area, search
  - User interaction: Conversation selection, message sending
  - Loading state: Shows skeleton during data fetch
  - Error state: Shows error message on failure

- [ ] `ConversationsList` - List of conversations
  - Rendering: Conversation cards with preview, unread indicators
  - User interaction: Conversation selection updates chat area
  - Empty state: Shows message when no conversations
  - Filtering: Filters by archived/unarchived

- [ ] `ChatArea` - Message display and input area
  - Rendering: Messages list, message input
  - User interaction: Message sending, scrolling
  - Loading state: Shows loading during message send
  - Real-time: Updates when new messages arrive
  - Edge case: Long message lists with pagination

- [ ] `MailboxSearch` - Search conversations
  - Rendering: Search input field
  - User interaction: Search filters conversations
  - Debouncing: Search input debounced

- [ ] `MailboxTabs` - Tabs for inbox/archived
  - Rendering: Tab buttons
  - User interaction: Tab switching updates conversations list
  - Active state: Highlights active tab

- [ ] `MailboxSkeleton` - Loading skeleton
  - Rendering: Skeleton placeholders for conversations

- [ ] `MessageUserButton` - Button to start conversation
  - Rendering: Button with user info
  - User interaction: Click opens message modal or starts conversation

- [ ] `MessageUserModal` - Modal to start conversation
  - Rendering: Modal with message input
  - User interaction: Send message starts conversation
  - Loading state: Shows loading during send

- [ ] `MobileHeader` - Mobile mailbox header
  - Rendering: Header with back button, user info
  - User interaction: Back navigation

#### Hooks

- [ ] `useConversations` - Fetch conversations with React Query
  - Data fetching: Fetches user's conversations
  - Filtering: Filters by archived status
  - Loading state: Returns loading boolean
  - Error state: Returns error object
  - Cache management: Proper cache key usage
  - Cache invalidation: Invalidates on mutations
  - Real-time updates: Subscribes to conversation updates

- [ ] `useUnreadCount` - Fetch unread message count
  - Data fetching: Fetches unread count
  - Real-time updates: Updates when messages marked read/unread
  - Cache management: Proper cache key usage

### Integration Tests

- [ ] **Conversation Creation Flow: Action → DAL → Database**
  - Complete flow: User starts conversation → action validates → DAL creates conversation → database stores conversation
  - Error propagation: DAL error → action error → UI error display
  - Authorization: User cannot message self

- [ ] **Message Sending Flow: Component → Action → DAL → Database**
  - Complete flow: User sends message → action validates → DAL sends message → database stores message
  - Sanitization: Message content sanitized before storage
  - Real-time: Message appears in UI immediately (optimistic update)

- [ ] **Status Update Flow: Component → Action → DAL → Database**
  - Complete flow: User marks read/unread → action updates → DAL updates → database updated
  - Cache invalidation: Cache refreshes after status update

- [ ] **Component → Hook → API Flow**
  - Data fetching: Component uses hook → hook fetches from API → data displayed
  - Loading states: Hook loading state → component shows loading UI
  - Error states: API error → hook error state → component shows error
  - Real-time updates: Hook subscribes to updates → component updates

### E2E Tests

- [ ] **Complete Conversation Workflow**
  - User views another user's profile
  - Clicks "Message" button
  - Sends initial message
  - Verifies conversation created
  - Verifies message appears in mailbox
  - Other user receives notification

- [ ] **Complete Messaging Workflow**
  - User opens conversation
  - Sends multiple messages
  - Verifies messages appear in order
  - Verifies real-time updates
  - Marks conversation as read
  - Verifies unread count decreases

- [ ] **Conversation Management Workflow**
  - User archives conversation
  - Verifies conversation moved to archived tab
  - User unarchives conversation
  - Verifies conversation moved back to inbox

- [ ] **Search Workflow**
  - User has multiple conversations
  - Searches for specific user
  - Verifies filtered results display
  - Clears search
  - Verifies all conversations display

### BDD Scenarios

```gherkin
Feature: Start Conversation
  As a user
  I want to start a conversation with another user
  So that I can communicate with them

  Background:
    Given I am logged in as a user
    And there is another user in the system

  Scenario: Successfully start conversation
    Given I am viewing another user's profile
    When I click the "Message" button
    And I enter a message
    And I send the message
    Then a conversation should be created
    And the message should be sent
    And the other user should receive a notification

Feature: Send Message
  As a user
  I want to send messages in a conversation
  So that I can communicate with other users

  Background:
    Given I am logged in as a user
    And I have an existing conversation

  Scenario: Successfully send message
    Given I am viewing the conversation
    When I enter a message
    And I send the message
    Then the message should be sent
    And the message should appear in the conversation
    And the other user should receive a notification

Feature: Manage Conversation Status
  As a user
  I want to mark conversations as read/unread
  So that I can track which conversations need attention

  Background:
    Given I am logged in as a user
    And I have conversations with unread messages

  Scenario: Mark conversation as read
    Given I am viewing my mailbox
    When I mark a conversation as read
    Then the conversation should be marked as read
    And the unread count should decrease
```

## Test Data Requirements

### Test Fixtures

**Location**: `src/test/fixtures/messages.ts` (needs to be created)

**Required Fixtures**:

- `mockConversation` - Complete conversation object
- `mockMessage` - Complete message object
- `mockConversationSummary` - Conversation summary with preview
- `mockConversationDetails` - Full conversation with messages
- `mockUser1` - First user in conversation
- `mockUser2` - Second user in conversation

### Test Database Seeding

**For Integration/E2E Tests**:

- Seed script: `src/test/seed.ts`
- Create test users (multiple users for conversations)
- Create test conversations (various statuses)
- Create test messages (various timestamps)
- Reset database before test suite execution

## Coverage Goals

### Feature-Specific Targets

- **DAL Methods**: 70%+ (exceeds 50% threshold)
  - `MessagesDAL.findOrCreateConversation`: 90%+
  - `MessagesDAL.sendMessage`: 90%+
  - `MessagesDAL.getConversations`: 85%+
  - `MessagesDAL.getConversationById`: 85%+
  - `MessagesDAL.markConversationRead`: 85%+
  - `MessagesDAL.markConversationUnread`: 85%+
  - `MessagesDAL.archiveConversation`: 85%+
  - `MessagesDAL.unarchiveConversation`: 85%+
  - `MessagesDAL.deleteConversation`: 85%+

- **Server Actions**: 85%+ (user-facing mutations)
  - `startConversation`: 90%+
  - `sendMessage`: 90%+
  - `markConversationRead`: 85%+
  - `markConversationUnread`: 85%+
  - `archiveConversation`: 85%+
  - `unarchiveConversation`: 85%+
  - `deleteConversation`: 85%+

- **React Components**: 80%+ (exceeds 75% threshold)
  - `MailboxClient`: 85%+
  - `ConversationsList`: 85%+
  - `ChatArea`: 90%+
  - `MailboxSearch`: 80%+
  - `MailboxTabs`: 80%+
  - `MessageUserButton`: 80%+
  - `MessageUserModal`: 85%+

- **Hooks**: 85%+ (data fetching logic)
  - `useConversations`: 90%+
  - `useUnreadCount`: 90%+

### Overall Feature Coverage

- **Statements**: > 85%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 85% (meets 80% threshold for features)

## Test Execution

### Unit Tests

- Execute: `bun test:run --grep "message"`
- Watch mode: `bun test:watch --grep "message"`
- Coverage: `bun test:coverage --grep "message"`

### Integration Tests

- Tagged with `@integration` or in `src/features/messages/__tests__/integration/`
- Execute: `bun test:run --grep "integration.*message"`

### E2E Tests

- Execute: `bun test:e2e --grep "message"`
- Run against test database with seeded data
- Screenshots on failure enabled

## Special Considerations

### Message Sanitization Testing

- Test XSS prevention in message content
- Test HTML sanitization
- Test special character handling
- Test message length limits

### Real-Time Updates Testing

- Mock WebSocket or polling for real-time updates
- Test optimistic updates
- Test message ordering
- Test concurrent message handling

### Authorization Testing

- Test user can only access their conversations
- Test user cannot access other users' conversations
- Test user cannot message self

## Test Maintenance

### When to Update Tests

- Requirements change → Update test scenarios and BDD features
- Schema changes → Update fixtures and validation tests
- UI changes → Update component tests
- Bug fixes → Add regression tests

### Test Quality Checklist

- [x] Tests map to requirements/acceptance criteria
- [x] All test types covered (unit, integration, E2E)
- [x] Happy paths tested
- [x] Edge cases tested
- [x] Error conditions tested
- [x] BDD scenarios written for critical workflows
- [ ] Tests are independent (no dependencies)
- [ ] Tests are fast (< 1s for unit tests)
- [ ] Tests use AAA pattern
- [ ] Test names describe behavior, not implementation
- [ ] Coverage goals met

## Existing Test Coverage

### Currently Tested

- `MessagesDAL` - Comprehensive tests in `src/dal/__tests__/messages.dal.test.ts`

### Missing Test Coverage

- All server actions (no tests)
- All components (no tests)
- All hooks (no tests)
- Integration tests (none exist)
- E2E tests (none exist)

## References

- **Test Plan Template**: `docs/AI-test-plan-template.md`
- **EARS Methodology**: `.ai/AI-ears-methodology.md`
- **BDD Methodology**: `.ai/AI-bdd-methodology.md`
- **TDD Methodology**: `.ai/AI-tdd-methodology.md`
- **Existing DAL Test**: `src/dal/__tests__/messages.dal.test.ts`
