import { describe, it, expect, vi, beforeEach } from "vitest";
import { startConversationAction } from "../start-conversation";
import { messagesDAL } from "@/dal";
import { mockUser1, mockUser2 } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/dal", () => ({
  messagesDAL: {
    sendMessageToUser: vi.fn(),
  },
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("startConversationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create conversation and send initial message successfully", async () => {
    // Arrange
    const recipientId = mockUser2.id;
    const listingId = "listing-123";
    const listingName = "Power Drill";
    const message = "Hello, is this tool still available?";

    const mockResult = {
      conversationId: "conversation-123",
      messageId: "message-123",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockResult,
      error: null,
    } as any);

    // Act
    const result = await startConversationAction(
      recipientId,
      listingId,
      listingName,
      message,
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.conversationId).toBe("conversation-123");
    expect(tryCatch).toHaveBeenCalledWith(
      messagesDAL.sendMessageToUser(recipientId, message, listingId),
    );
  });

  it("should return error when recipient ID is invalid", async () => {
    // Arrange
    const recipientId = "";
    const listingId = "listing-123";
    const listingName = "Power Drill";
    const message = "Hello";

    const mockError = {
      message: "Invalid recipient",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await startConversationAction(
      recipientId,
      listingId,
      listingName,
      message,
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid recipient");
    expect(result.conversationId).toBeUndefined();
  });

  it("should return error when user tries to message self", async () => {
    // Arrange
    const recipientId = mockUser1.id; // Same as sender
    const listingId = "listing-123";
    const listingName = "Power Drill";
    const message = "Hello";

    const mockError = {
      message: "Cannot message yourself",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await startConversationAction(
      recipientId,
      listingId,
      listingName,
      message,
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot message yourself");
  });

  it("should return error when DAL operation fails", async () => {
    // Arrange
    const recipientId = mockUser2.id;
    const listingId = "listing-123";
    const listingName = "Power Drill";
    const message = "Hello";

    const mockError = {
      message: "Database connection failed",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await startConversationAction(
      recipientId,
      listingId,
      listingName,
      message,
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });

  it("should handle empty message content", async () => {
    // Arrange
    const recipientId = mockUser2.id;
    const listingId = "listing-123";
    const listingName = "Power Drill";
    const message = "";

    const mockError = {
      message: "Message content cannot be empty",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await startConversationAction(
      recipientId,
      listingId,
      listingName,
      message,
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Message content cannot be empty");
  });
});
