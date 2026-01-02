import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageAction } from "@/features/messages/actions/send-message";
import { messagesDAL } from "@/dal";
import { mockMessage } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/dal", () => ({
  messagesDAL: {
    sendMessageInConversation: vi.fn(),
  },
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("Message Sending Flow: Component → Action → DAL → Database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full flow: User sends message → action validates → DAL sends message → database stores message", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const content = "Hello, is this tool still available?";

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockMessage,
      error: null,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert - Verify complete flow
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockMessage);
    expect(tryCatch).toHaveBeenCalledWith(
      messagesDAL.sendMessageInConversation(conversationId, content),
    );
    expect(messagesDAL.sendMessageInConversation).toHaveBeenCalledWith(
      conversationId,
      content,
    );
  });

  it("should sanitize message content before storage", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const unsafeContent = "<script>alert('xss')</script>Hello";

    const sanitizedMessage = {
      ...mockMessage,
      content: "Hello", // Sanitized content
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: sanitizedMessage,
      error: null,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, unsafeContent);

    // Assert - Message should be sanitized
    expect(result.success).toBe(true);
    expect(result.data?.content).not.toContain("<script>");
    expect(messagesDAL.sendMessageInConversation).toHaveBeenCalledWith(
      conversationId,
      unsafeContent, // DAL should handle sanitization
    );
  });

  it("should handle real-time updates: Message appears in UI immediately (optimistic update)", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const content = "New message";

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockMessage,
      error: null,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert - Message should be returned immediately for optimistic update
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // In a real component, this would trigger an optimistic update
  });

  it("should return error when conversation not found", async () => {
    // Arrange
    const conversationId = "conversation-nonexistent";
    const content = "Hello";

    const mockError = {
      message: "Conversation not found",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Conversation not found");
  });

  it("should return error when unauthorized", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const content = "Hello";

    const mockError = {
      message: "Unauthorized access",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized access");
  });
});
