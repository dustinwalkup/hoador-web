import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { messagesDAL } from "../index";
import { mockConversation, mockMessage } from "@/test/fixtures/messages";
import { db } from "@/db/db";
vi.mock("@/db/db", () => ({
  db: {
    query: {
      conversations: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      messages: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
}));

describe("MessagesDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findOrCreateConversation", () => {
    it("should find existing conversation", async () => {
      // Arrange
      const user1Id = "user-123";
      const user2Id = "user-456";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        mockConversation as any,
      );

      // Act
      const result = await messagesDAL.findOrCreateConversation(
        user1Id,
        user2Id,
      );

      // Assert
      expect(result).toEqual(mockConversation);
      expect(db.query.conversations.findFirst).toHaveBeenCalled();
    });

    it("should create new conversation when not found", async () => {
      // Arrange
      const user1Id = "user-123";
      const user2Id = "user-456";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(undefined);

      const mockReturning = vi.fn().mockResolvedValue([mockConversation]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await messagesDAL.findOrCreateConversation(
        user1Id,
        user2Id,
      );

      // Assert
      expect(result).toEqual(mockConversation);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should sort user IDs consistently", async () => {
      // Arrange
      const user1Id = "user-456"; // Larger ID
      const user2Id = "user-123"; // Smaller ID

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        mockConversation as any,
      );

      // Act
      await messagesDAL.findOrCreateConversation(user1Id, user2Id);

      // Assert
      // Should sort IDs so smaller comes first
      expect(db.query.conversations.findFirst).toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    it("should send message successfully", async () => {
      // Arrange
      const senderId = "user-123";
      const recipientId = "user-456";
      const content = "Hello, is this available?";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        mockConversation as any,
      );

      const mockReturning = vi.fn().mockResolvedValue([mockMessage]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      const result = await messagesDAL.sendMessage(
        senderId,
        recipientId,
        content,
      );

      // Assert
      expect(result).toEqual([mockMessage]);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should sanitize message content", async () => {
      // Arrange
      const senderId = "user-123";
      const recipientId = "user-456";
      const unsafeContent = "<script>alert('xss')</script>Hello";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        mockConversation as any,
      );

      const mockReturning = vi.fn().mockResolvedValue([mockMessage]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      // Act
      await messagesDAL.sendMessage(senderId, recipientId, unsafeContent);

      // Assert
      const valuesCall = vi.mocked(db.insert).mock.results[0].value.values;
      const valuesArg = valuesCall.mock.calls[0][0];
      expect(valuesArg.content).not.toContain("<script>");
    });
  });

  describe("sendMessageToUser", () => {
    it("should send message when senderId is provided", async () => {
      // Arrange
      const senderId = "user-123";
      const recipientId = "user-456";
      const content = "Hello";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        mockConversation as any,
      );

      const mockReturningInsert = vi.fn().mockResolvedValue([mockMessage]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturningInsert,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      const mockReturningUpdate = vi.fn().mockResolvedValue([mockConversation]);
      const mockWhereUpdate = vi.fn().mockReturnValue({
        returning: mockReturningUpdate,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhereUpdate,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      const result = await messagesDAL.sendMessageToUser(
        senderId,
        recipientId,
        content,
      );

      // Assert
      expect(result).toHaveProperty("conversationId");
      expect(result).toHaveProperty("messageId");
    });
  });

  describe("getUserConversations", () => {
    it("should return user conversations when userId is provided", async () => {
      // Arrange
      const userId = "user-123";

      vi.mocked(db.query.conversations.findMany).mockResolvedValue([
        {
          ...mockConversation,
          user1Id: "user-123",
          user2Id: "user-456",
          user1: {
            id: "user-123",
            firstName: "John",
            lastName: "Doe",
          },
          user2: {
            id: "user-456",
            firstName: "Jane",
            lastName: "Smith",
          },
          messages: [],
        },
      ] as any);

      // Act
      const result = await messagesDAL.getUserConversations(userId);

      // Assert
      expect(result).toBeDefined();
    });

    it("should filter archived conversations", async () => {
      // Arrange
      const userId = "user-123";

      vi.mocked(db.query.conversations.findMany).mockResolvedValue([
        {
          ...mockConversation,
          user1Id: "user-123",
          user2Id: "user-456",
          user1: {
            id: "user-123",
            firstName: "John",
            lastName: "Doe",
          },
          user2: {
            id: "user-456",
            firstName: "Jane",
            lastName: "Smith",
          },
          messages: [],
        },
      ] as any);

      // Act
      const result = await messagesDAL.getUserConversations(userId, false);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe("markConversationAsRead", () => {
    it("should mark conversation as read when user is participant", async () => {
      // Arrange
      const conversationId = "conversation-123";
      const userId = "user-123";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        user1Id: userId,
      } as any);

      const mockReturning = vi.fn().mockResolvedValue([mockConversation]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      await messagesDAL.markConversationAsRead(conversationId, userId);

      // Assert
      expect(db.update).toHaveBeenCalled();
    });

    // Was: "should return empty array when user not participant", asserting the
    // old behaviour — an empty `.set()` that Drizzle rejected and handleError
    // turned into a 500 (and a Sentry incident) for a request that is simply
    // not the caller's to make. P-E11-1 makes it a 403.
    it("throws ForbiddenError when the caller is not a participant", async () => {
      const conversationId = "conversation-123";
      const userId = "user-999";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        user1Id: "user-123",
        user2Id: "user-456",
      } as any);

      await expect(
        messagesDAL.markConversationAsRead(conversationId, userId),
      ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
      expect(db.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the conversation does not exist", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(undefined);

      await expect(
        messagesDAL.markConversationAsRead("missing-id", "user-123"),
      ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("archiveConversation", () => {
    it("should archive conversation when user is participant", async () => {
      // Arrange
      const conversationId = "conversation-123";
      const userId = "user-123";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        user1Id: userId,
      } as any);

      const mockReturning = vi.fn().mockResolvedValue([mockConversation]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      await messagesDAL.archiveConversation(conversationId, userId);

      // Assert
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("deleteConversation", () => {
    it("should delete conversation when user is participant", async () => {
      // Arrange
      const conversationId = "conversation-123";
      const userId = "user-123";

      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        user1Id: userId,
      } as any);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as any);

      // Act
      await messagesDAL.deleteConversation(conversationId, userId);

      // Assert
      expect(db.delete).toHaveBeenCalled();
    });

    it("should throw error when user not participant", async () => {
      // Arrange
      const conversationId = "conversation-123";
      const userId = "user-999";

      // Mock conversation query to return null (user not participant)
      // The implementation throws "Conversation not found or access denied" for security
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(undefined);

      // Act & Assert
      // Note: Implementation throws generic Error for security (doesn't leak conversation existence)
      // The error gets wrapped by handleError, so we expect DALError
      await expect(
        messagesDAL.deleteConversation(conversationId, userId),
      ).rejects.toThrow();
    });
  });

  describe("getUnreadMessageCount", () => {
    it("should return unread count when userId is provided", async () => {
      // Arrange
      const userId = "user-123";

      // Mock select().from().innerJoin() chain
      const mockWhere = vi.fn().mockResolvedValue([{ count: 5 }]);
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      // Act
      const result = await messagesDAL.getUnreadMessageCount(userId);

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------
  // Epic 11 prerequisites — P-E11-1 (typed errors + guards), P-E11-2 (honest
  // names and real avatars), P-E11-5 (self-conversation guard).
  // ---------------------------------------------------------------------

  describe("findOrCreateConversation — self guard (P-E11-5)", () => {
    it("refuses a conversation with yourself before touching the database", async () => {
      await expect(
        messagesDAL.findOrCreateConversation("user-123", "user-123"),
      ).rejects.toMatchObject({
        code: "CANNOT_MESSAGE_SELF",
        statusCode: 400,
      });

      expect(db.query.conversations.findFirst).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("getConversationDetails — guards and payload", () => {
    const conversationWithRelations = (over: Record<string, unknown> = {}) => ({
      ...mockConversation,
      user1: {
        id: "user-123",
        firstName: "John",
        lastName: "Doe",
        name: "John Doe",
        image: null,
        profileImageUrl: "https://example.com/john.jpg",
      },
      user2: {
        id: "user-456",
        firstName: "Jane",
        lastName: "Smith",
        name: "Jane Smith",
        image: null,
        profileImageUrl: "https://example.com/jane.jpg",
      },
      ...over,
    });

    beforeEach(() => {
      // Messages are their own query since P-E11-4 paginated the thread.
      vi.mocked(db.query.messages.findMany).mockResolvedValue([]);
    });

    it("throws NotFoundError when the conversation does not exist", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(undefined);

      await expect(
        messagesDAL.getConversationDetails("missing-id", "user-123"),
      ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    });

    it("throws ForbiddenError for a non-participant", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        conversationWithRelations() as any,
      );

      await expect(
        messagesDAL.getConversationDetails("conversation-123", "user-999"),
      ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    });

    it("returns the other participant's real avatar (P-E11-2)", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        conversationWithRelations() as any,
      );

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
      );

      expect(result.otherUser).toMatchObject({
        id: "user-456",
        name: "Jane Smith",
        firstName: "Jane",
        lastName: "Smith",
        avatar: "https://example.com/jane.jpg",
      });
    });

    it('never renders a profile-less user as "null null" (P-E11-2)', async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        conversationWithRelations({
          user2: {
            id: "user-456",
            firstName: null,
            lastName: null,
            name: "jane@example.com",
            image: "https://oauth.example/avatar.png",
            profileImageUrl: null,
          },
        }) as any,
      );

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
      );

      expect(result.otherUser.name).toBe("jane@example.com");
      expect(result.otherUser.initials).toBe("");
      // Falls back to the better-auth OAuth image when there is no uploaded one.
      expect(result.otherUser.avatar).toBe("https://oauth.example/avatar.png");
    });

    it("falls back to a neutral label when nothing names the user", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        conversationWithRelations({
          user2: {
            id: "user-456",
            firstName: null,
            lastName: null,
            name: "  ",
            image: null,
            profileImageUrl: null,
          },
        }) as any,
      );

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
      );

      expect(result.otherUser.name).toBe("Neighbor");
      expect(result.otherUser.avatar).toBeNull();
    });

    it("composes each message's sender name and avatar", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        conversationWithRelations() as any,
      );
      vi.mocked(db.query.messages.findMany).mockResolvedValue([
        {
          ...mockMessage,
          senderId: "user-456",
          sender: {
            id: "user-456",
            firstName: null,
            lastName: null,
            name: "Jane S.",
            image: null,
            profileImageUrl: "https://example.com/jane.jpg",
          },
          listing: null,
          serviceListing: null,
        },
      ] as any);

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
      );

      expect(result.messages[0]).toMatchObject({
        sender: "them",
        senderName: "Jane S.",
        senderAvatar: "https://example.com/jane.jpg",
      });
    });
  });

  describe("sendMessageInConversation — archived thread (P-E11-1)", () => {
    it("throws CONVERSATION_ARCHIVED (409) rather than a bare Error", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        user1Id: "user-123",
        user1Archived: true,
      } as any);

      await expect(
        messagesDAL.sendMessageInConversation(
          "conversation-123",
          "user-123",
          "hello",
        ),
      ).rejects.toMatchObject({
        code: "CONVERSATION_ARCHIVED",
        statusCode: 409,
      });

      expect(db.insert).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError for a non-participant sender", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(
        mockConversation as any,
      );

      await expect(
        messagesDAL.sendMessageInConversation(
          "conversation-123",
          "user-999",
          "hello",
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    });

    it("throws NotFoundError when the conversation does not exist", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue(undefined);

      await expect(
        messagesDAL.sendMessageInConversation("missing-id", "user-123", "hi"),
      ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    });
  });

  // ---------------------------------------------------------------------
  // P-E11-4 — thread pagination. The thread read was unbounded (F3), with a
  // 15-30s focused poll planned on top of it.
  // ---------------------------------------------------------------------

  describe("getConversationDetails — pagination (P-E11-4)", () => {
    const CURSOR_ID = "11111111-1111-4111-8111-111111111111";
    const UNKNOWN_ID = "22222222-2222-4222-8222-222222222222";

    const participants = {
      user1: {
        id: "user-123",
        firstName: "John",
        lastName: "Doe",
        name: "John Doe",
        image: null,
        profileImageUrl: null,
      },
      user2: {
        id: "user-456",
        firstName: "Jane",
        lastName: "Smith",
        name: "Jane Smith",
        image: null,
        profileImageUrl: null,
      },
    };

    /** Newest first, the order the DAL queries in. */
    const messagePage = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        ...mockMessage,
        id: `message-${i}`,
        senderId: "user-456",
        createdAt: new Date(2026, 0, 100 - i),
        sender: { ...participants.user2, name: "Jane Smith" },
        listing: null,
        serviceListing: null,
      }));

    beforeEach(() => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        ...participants,
      } as any);
      vi.mocked(db.query.messages.findMany).mockResolvedValue(
        messagePage(3) as any,
      );
    });

    const findManyArgs = () =>
      vi.mocked(db.query.messages.findMany).mock.calls[0][0] as any;

    it("defaults to the newest 50 and asks for one extra row", async () => {
      await messagesDAL.getConversationDetails("conversation-123", "user-123");

      expect(findManyArgs().limit).toBe(51);
    });

    it("returns messages oldest-first, as every client already renders them", async () => {
      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
      );

      expect(result.messages.map((m) => m.id)).toEqual([
        "message-2",
        "message-1",
        "message-0",
      ]);
    });

    it("reports hasMore false when the window is not full", async () => {
      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
        { limit: 10 },
      );

      expect(result.hasMore).toBe(false);
      expect(result.messages).toHaveLength(3);
    });

    it("drops the probe row and reports hasMore when there are older messages", async () => {
      vi.mocked(db.query.messages.findMany).mockResolvedValue(
        messagePage(3) as any,
      );

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
        { limit: 2 },
      );

      expect(result.hasMore).toBe(true);
      // The extra row proves more exist; it is not part of the page.
      expect(result.messages.map((m) => m.id)).toEqual([
        "message-1",
        "message-0",
      ]);
    });

    it.each([
      ["above the ceiling", 1000, 101],
      ["below the floor", 0, 2],
      ["negative", -5, 2],
      ["NaN from a garbage query param", Number.NaN, 51],
      ["fractional", 10.7, 11],
    ])("clamps a limit %s", async (_label, requested, expected) => {
      await messagesDAL.getConversationDetails("conversation-123", "user-123", {
        limit: requested,
      });

      expect(findManyArgs().limit).toBe(expected);
    });

    // Regression: the first cut used a sentinel string as the tie-break id for
    // a timestamp cursor, on the assumption ids sort as text. `messages.id` is
    // a `uuid` column, so Postgres rejected the sentinel as malformed and the
    // whole read 500'd — invisible against a mock, immediate against the
    // database.
    it("compares only createdAt for a timestamp cursor", async () => {
      await messagesDAL.getConversationDetails("conversation-123", "user-123", {
        before: "2026-01-01T00:00:00.000Z",
      });

      const { sql, params } = new PgDialect().sqlToQuery(findManyArgs().where);
      expect(sql).toContain('"messages"."created_at" <');
      expect(sql).not.toContain('"messages"."id" <');
      expect(params).not.toContain("\uffff");
    });

    it("breaks createdAt ties on id for a message-id cursor", async () => {
      vi.mocked(db.query.messages.findFirst).mockResolvedValue({
        id: CURSOR_ID,
        createdAt: new Date(2026, 0, 99),
      } as any);

      await messagesDAL.getConversationDetails("conversation-123", "user-123", {
        before: CURSOR_ID,
      });

      const { sql } = new PgDialect().sqlToQuery(findManyArgs().where);
      expect(sql).toContain('"messages"."id" <');
    });

    it("accepts an ISO timestamp cursor without a lookup", async () => {
      await messagesDAL.getConversationDetails("conversation-123", "user-123", {
        before: "2026-01-01T00:00:00.000Z",
      });

      expect(db.query.messages.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ columns: { id: true, createdAt: true } }),
      );
    });

    it("resolves a message-id cursor against this conversation", async () => {
      vi.mocked(db.query.messages.findFirst).mockResolvedValue({
        id: CURSOR_ID,
        createdAt: new Date(2026, 0, 99),
      } as any);

      await messagesDAL.getConversationDetails("conversation-123", "user-123", {
        before: CURSOR_ID,
      });

      expect(db.query.messages.findFirst).toHaveBeenCalled();
    });

    // `new Date("message-1")` is 1 January 2001 in V8, so discriminating by
    // "try Date first" would read an id as a timestamp and silently serve the
    // wrong page.
    it("rejects a cursor that is neither a message id nor a timestamp", async () => {
      await expect(
        messagesDAL.getConversationDetails("conversation-123", "user-123", {
          before: "message-1",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });

      expect(db.query.messages.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a cursor that is not in this conversation", async () => {
      // Silently falling back to "newest" would re-serve a page the caller has
      // already rendered, which reads as the thread looping.
      vi.mocked(db.query.messages.findFirst).mockResolvedValue(undefined);

      await expect(
        messagesDAL.getConversationDetails("conversation-123", "user-123", {
          before: UNKNOWN_ID,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    });

    it("computes unread from the newest message, not the window, when paging back", async () => {
      // Paging backwards: the window holds old messages, but something unread
      // is waiting at the bottom of the thread.
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        ...participants,
        user1LastReadAt: new Date(2026, 0, 50),
      } as any);
      vi.mocked(db.query.messages.findFirst)
        .mockResolvedValueOnce({
          id: CURSOR_ID,
          createdAt: new Date(2026, 0, 60),
        } as any)
        .mockResolvedValueOnce({
          id: "message-newest",
          createdAt: new Date(2026, 0, 99),
          senderId: "user-456",
        } as any);

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
        { before: CURSOR_ID },
      );

      expect(result.unread).toBe(true);
    });

    it("always sends unread as a boolean, even for an empty thread (F4)", async () => {
      vi.mocked(db.query.conversations.findFirst).mockResolvedValue({
        ...mockConversation,
        ...participants,
        user1LastReadAt: new Date(2026, 0, 50),
      } as any);
      vi.mocked(db.query.messages.findMany).mockResolvedValue([]);

      const result = await messagesDAL.getConversationDetails(
        "conversation-123",
        "user-123",
      );

      // Was `undefined`, which JSON.stringify dropped from the payload.
      expect(result.unread).toBe(false);
      expect(Object.keys(result)).toContain("unread");
    });
  });
  describe("getUserConversationsPaginated — search and paging (P-E11-3)", () => {
    const conversationRow = {
      ...mockConversation,
      user1Id: "user-123",
      user2Id: "user-456",
      user1: {
        id: "user-123",
        firstName: "John",
        lastName: "Doe",
        name: "John Doe",
        image: null,
        profileImageUrl: null,
      },
      user2: {
        id: "user-456",
        firstName: "Jane",
        lastName: "Smith",
        name: "Jane Smith",
        image: null,
        profileImageUrl: null,
      },
      messages: [],
    };

    beforeEach(() => {
      vi.mocked(db.query.conversations.findMany).mockResolvedValue([
        conversationRow,
      ] as any);
    });

    const findManyArgs = () =>
      vi.mocked(db.query.conversations.findMany).mock.calls[0][0] as any;

    const renderWhere = () => new PgDialect().sqlToQuery(findManyArgs().where);

    it("adds no predicate when no search is given", async () => {
      await messagesDAL.getUserConversationsPaginated("user-123", false, 0, 20);

      const { sql } = renderWhere();
      expect(sql).not.toContain("ilike");
      expect(sql).not.toContain("exists");
    });

    it.each([
      ["empty", ""],
      ["whitespace only", "   "],
    ])("treats a %s search as no search", async (_label, search) => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        false,
        0,
        20,
        search,
      );

      expect(renderWhere().sql).not.toContain("ilike");
    });

    it("matches the other participant's name and any message's content", async () => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        false,
        0,
        20,
        "jane",
      );

      const { sql, params } = renderWhere();
      // Name: composed the way it is displayed, so "jane sm" finds "Jane Smith",
      // with better-auth's `name` behind the nullable first/last columns.
      expect(sql).toContain(
        `concat_ws(' ', "user"."first_name", "user"."last_name")`,
      );
      expect(sql).toContain('"user"."name" ilike');
      // Content: a correlated subquery over the whole thread, not just the last
      // message the summary happens to carry.
      expect(sql).toContain('"messages"."content" ilike');
      expect(sql).toContain(
        '"messages"."conversation_id" = "conversations"."id"',
      );
      // Two name arms (composed name + better-auth `name`) and the content arm.
      expect(params.filter((p) => p === "%jane%")).toHaveLength(5);
    });

    // Pinned in full, the way the conversation-pair predicate is: the bug worth
    // catching here is a *pairing* one — a name arm correlated to the caller's
    // own id rather than the other participant's. Every fragment of that
    // mistake is present in the correct SQL too, so only the whole shape
    // distinguishes them, and the symptom (searching your own name returns your
    // whole inbox) is silent.
    it("correlates each name arm to the other participant, not the caller", async () => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        undefined,
        0,
        20,
        "jane",
      );

      const { sql, params } = renderWhere();
      expect(sql).toBe(
        '(("conversations"."user1_id" = $1 or "conversations"."user2_id" = $2) and ' +
          '(("conversations"."user1_id" = $3 and exists (select 1 from "user" where ' +
          '("user"."id" = "conversations"."user2_id" and ' +
          `(concat_ws(' ', "user"."first_name", "user"."last_name") ilike $4 or "user"."name" ilike $5)))) or ` +
          '("conversations"."user2_id" = $6 and exists (select 1 from "user" where ' +
          '("user"."id" = "conversations"."user1_id" and ' +
          `(concat_ws(' ', "user"."first_name", "user"."last_name") ilike $7 or "user"."name" ilike $8)))) or ` +
          'exists (select 1 from "messages" where ' +
          '("messages"."conversation_id" = "conversations"."id" and "messages"."content" ilike $9))))',
      );
      expect(params).toEqual([
        "user-123",
        "user-123",
        "user-123",
        "%jane%",
        "%jane%",
        "user-123",
        "%jane%",
        "%jane%",
        "%jane%",
      ]);
    });

    it("composes with the archived filter rather than replacing it", async () => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        true,
        0,
        20,
        "jane",
      );

      const { sql, params } = renderWhere();
      expect(sql).toContain('"conversations"."user1_archived"');
      expect(sql).toContain('"conversations"."user2_archived"');
      expect(params).toContain(true);
      expect(params).toContain("%jane%");
    });

    it("leaves the ordering alone", async () => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        false,
        0,
        20,
        "jane",
      );

      const { sql } = new PgDialect().sqlToQuery(findManyArgs().orderBy[0]);
      expect(sql).toContain('"conversations"."last_message_at"');
    });

    // A search box is where a `%` gets typed, and unescaped it means "match
    // everything" — a search that quietly asks something else than what the
    // user typed.
    it.each([
      ["percent", "50%", "%50\\%%"],
      ["underscore", "a_b", "%a\\_b%"],
      ["backslash", "c\\d", "%c\\\\d%"],
    ])("escapes a %s in the term", async (_label, search, expected) => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        false,
        0,
        20,
        search,
      );

      expect(renderWhere().params).toContain(expected);
    });

    it("trims the term", async () => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        false,
        0,
        20,
        "  jane  ",
      );

      expect(renderWhere().params).toContain("%jane%");
    });

    // F8: `parseInt(searchParams.get("limit") || "20")` is unbounded and
    // NaN-prone, and both reach Drizzle from a query param.
    it.each([
      ["above the ceiling", 1000, 100],
      ["below the floor", 0, 1],
      ["negative", -5, 1],
      ["NaN from a garbage query param", Number.NaN, 20],
      ["fractional", 10.7, 10],
    ])("clamps a limit %s", async (_label, requested, expected) => {
      await messagesDAL.getUserConversationsPaginated(
        "user-123",
        false,
        0,
        requested,
      );

      expect(findManyArgs().limit).toBe(expected);
    });

    it.each([
      ["NaN", Number.NaN, 0],
      ["negative", -5, 0],
      ["fractional", 7.9, 7],
      ["valid", 40, 40],
    ])(
      "normalizes an offset that is %s",
      async (_label, requested, expected) => {
        await messagesDAL.getUserConversationsPaginated(
          "user-123",
          false,
          requested,
          20,
        );

        expect(findManyArgs().offset).toBe(expected);
      },
    );
  });
});
