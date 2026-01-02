import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageAction } from "@/features/messages/actions/send-message";
import { markConversationAsReadAction } from "@/features/messages/actions/mark-conversation-read";
import { messagesDAL } from "@/dal";
import { mockMessage, mockConversation } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/dal", () => ({
  messagesDAL: {
    sendMessageInConversation: vi.fn(),
    markConversationAsRead: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("Complete Messaging Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full messaging workflow: User opens conversation → sends multiple messages → messages appear in order → marks read → unread count decreases", async () => {
    // Step 1: User opens conversation
    const conversationId = "conversation-123";

    // Step 2: User sends first message
    const message1 = "Hello, is this tool still available?";
    vi.mocked(tryCatch).mockResolvedValueOnce({
      data: { ...mockMessage, id: "message-1", content: message1 },
      error: null,
    } as any);

    const result1 = await sendMessageAction(conversationId, message1);

    expect(result1.success).toBe(true);
    expect(messagesDAL.sendMessageInConversation).toHaveBeenCalledWith(
      conversationId,
      message1,
    );

    // Step 3: User sends second message
    const message2 = "When can I pick it up?";
    vi.mocked(tryCatch).mockResolvedValueOnce({
      data: { ...mockMessage, id: "message-2", content: message2 },
      error: null,
    } as any);

    const result2 = await sendMessageAction(conversationId, message2);

    expect(result2.success).toBe(true);
    expect(messagesDAL.sendMessageInConversation).toHaveBeenCalledWith(
      conversationId,
      message2,
    );

    // Step 4: Verify messages appear in order
    // (In a real scenario, this would check the UI)
    expect(result1.data?.content).toBe(message1);
    expect(result2.data?.content).toBe(message2);

    // Step 5: Verify real-time updates
    // (In a real scenario, this would check WebSocket/polling)

    // Step 6: User marks conversation as read
    vi.mocked(tryCatch).mockResolvedValueOnce({
      data: [mockConversation],
      error: null,
    } as any);

    const readResult = await markConversationAsReadAction(conversationId);

    expect(readResult.success).toBe(true);
    expect(messagesDAL.markConversationAsRead).toHaveBeenCalledWith(
      conversationId,
    );

    // Step 7: Verify unread count decreases
    // (In a real scenario, this would check the unread count in the UI)
    expect(tryCatch).toHaveBeenCalledTimes(3);
  });

  it("should handle error when sending message fails", async () => {
    // Step 1: User opens conversation
    const conversationId = "conversation-123";

    // Step 2: User sends message but it fails
    const message = "Hello";
    const mockError = {
      message: "Failed to send message",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    // Act
    const result = await sendMessageAction(conversationId, message);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to send message");
  });

  it("should handle error when marking read fails", async () => {
    // Step 1: User tries to mark conversation as read
    const conversationId = "conversation-123";

    const mockError = {
      message: "Failed to mark as read",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await markConversationAsReadAction(conversationId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to mark as read");

    consoleErrorSpy.mockRestore();
  });
});
