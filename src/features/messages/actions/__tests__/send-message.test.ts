import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageAction } from "../send-message";
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

describe("sendMessageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send message successfully", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const content = "Hello, is this tool still available?";

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockMessage,
      error: null,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockMessage);
    expect(tryCatch).toHaveBeenCalledWith(
      messagesDAL.sendMessageInConversation(conversationId, content),
    );
  });

  it("should return error when content is invalid", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const content = "";

    const mockError = {
      message: "Message content cannot be empty",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Message content cannot be empty");
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

  it("should handle database errors", async () => {
    // Arrange
    const conversationId = "conversation-123";
    const content = "Hello";

    const mockError = {
      message: "Database connection failed",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, content);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });
});
