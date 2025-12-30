export const mockConversation = {
  id: "conversation-123",
  participant1Id: "user-123",
  participant2Id: "user-456",
  lastMessageAt: new Date("2024-01-15"),
  createdAt: new Date("2024-01-10"),
  archived: false,
  archivedAt: null,
  unreadCount: 2,
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
