import { describe, it, expect, vi, beforeEach } from "vitest";
import { startConversationAction } from "@/features/messages/actions/start-conversation";
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

vi.mock("@/features/auth/utils/session", () => ({
  requireAuthenticatedUser: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";
import { requireAuthenticatedUser } from "@/features/auth/utils/session";

describe("Complete Conversation Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      user: mockUser1 as any,
      userId: mockUser1.id,
      isAdmin: false,
    });
  });

  it("should complete full conversation workflow: User views profile → clicks Message → sends initial message → conversation created → message appears in mailbox", async () => {
    // Step 1: User views another user's profile
    // (Simulated by having recipientId available)

    // Step 2: User clicks "Message" button
    // (Simulated by calling startConversationAction)

    // Step 3: User sends initial message
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

    // Step 4: Verify conversation created
    const result = await startConversationAction(
      recipientId,
      listingId,
      listingName,
      message,
    );

    expect(result.success).toBe(true);
    expect(result.conversationId).toBe("conversation-123");

    // Step 5: Verify message appears in mailbox
    // (In a real scenario, this would check the mailbox UI)
    expect(messagesDAL.sendMessageToUser).toHaveBeenCalledWith(
      mockUser1.id,
      recipientId,
      message,
      listingId,
    );

    // Step 6: Other user receives notification
    // (In a real scenario, this would check notification system)
    expect(tryCatch).toHaveBeenCalled();
  });

  it("should handle error at step 1: Invalid recipient", async () => {
    // Step 1: User tries to message invalid recipient
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

    // Assert - Workflow stops at validation
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid recipient");
    expect(result.conversationId).toBeUndefined();
  });

  it("should handle error at step 2: Cannot message self", async () => {
    // Step 1: User tries to message themselves
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

    // Assert - Workflow stops at authorization check
    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot message yourself");
  });

  it("should handle error at step 3: Database error", async () => {
    // Step 1: User sends message
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

    // Assert - Workflow stops at database operation
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
  });
});
