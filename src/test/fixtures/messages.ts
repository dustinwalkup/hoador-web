export const mockUser1 = {
  id: "user-123",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  profileImageUrl: "https://example.com/profile.jpg",
};

export const mockUser2 = {
  id: "user-456",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  profileImageUrl: "https://example.com/jane.jpg",
};

export const mockConversation = {
  id: "conversation-123",
  user1Id: "user-123",
  user2Id: "user-456",
  lastMessageAt: new Date("2024-01-15"),
  createdAt: new Date("2024-01-10"),
  user1Archived: false,
  user2Archived: false,
  user1LastReadAt: null,
  user2LastReadAt: null,
};

export const mockMessage = {
  id: "message-123",
  conversationId: "conversation-123",
  senderId: "user-123",
  content: "Hello, is this tool still available?",
  read: false,
  createdAt: new Date("2024-01-15"),
};

export const mockConversationWithMessages = {
  ...mockConversation,
  messages: [
    {
      ...mockMessage,
      sender: {
        id: "user-123",
        firstName: "John",
        lastName: "Doe",
        profileImageUrl: "https://example.com/profile.jpg",
      },
    },
    {
      id: "message-124",
      conversationId: "conversation-123",
      senderId: "user-456",
      content: "Yes, it's available!",
      read: true,
      createdAt: new Date("2024-01-15"),
      sender: {
        id: "user-456",
        firstName: "Jane",
        lastName: "Smith",
        profileImageUrl: "https://example.com/jane.jpg",
      },
    },
  ],
};

export const mockConversationList = [
  {
    ...mockConversation,
    otherParticipant: {
      id: "user-456",
      firstName: "Jane",
      lastName: "Smith",
      profileImageUrl: "https://example.com/jane.jpg",
    },
    lastMessage: {
      ...mockMessage,
      senderId: "user-456",
      content: "Yes, it's available!",
    },
  },
];

// ConversationSummary type fixture
export const mockConversationSummary = {
  id: "conversation-123",
  otherUser: {
    id: "user-456",
    name: "Jane Smith",
    avatar: "https://example.com/jane.jpg",
    initials: "JS",
  },
  lastMessage: {
    content: "Yes, it's available!",
    time: new Date("2024-01-15"),
    senderId: "user-456",
  },
  unread: true,
  lastMessageAt: new Date("2024-01-15"),
  archived: false,
};

// ConversationDetails type fixture
export const mockConversationDetails = {
  id: "conversation-123",
  otherUser: {
    id: "user-456",
    name: "Jane Smith",
    avatar: "https://example.com/jane.jpg",
    initials: "JS",
  },
  messages: [
    {
      id: "message-123",
      content: "Hello, is this tool still available?",
      time: new Date("2024-01-15T10:00:00"),
      sender: "me" as const,
      senderName: "John Doe",
      listingId: null,
      listingName: null,
    },
    {
      id: "message-124",
      content: "Yes, it's available!",
      time: new Date("2024-01-15T10:05:00"),
      sender: "them" as const,
      senderName: "Jane Smith",
      listingId: null,
      listingName: null,
    },
  ],
  unread: false,
  archived: false,
};

// Edge case fixtures
export const mockArchivedConversation = {
  ...mockConversationSummary,
  id: "conversation-456",
  archived: true,
};

export const mockEmptyConversation = {
  ...mockConversationSummary,
  id: "conversation-789",
  lastMessage: null,
  lastMessageAt: null,
  unread: false,
};

export const mockUnreadConversation = {
  ...mockConversationSummary,
  id: "conversation-999",
  unread: true,
  lastMessage: {
    content: "New message!",
    time: new Date("2024-01-16"),
    senderId: "user-456",
  },
  lastMessageAt: new Date("2024-01-16"),
};
