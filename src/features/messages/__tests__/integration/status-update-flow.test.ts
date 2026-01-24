import { describe, it, expect, vi, beforeEach } from "vitest";
import { markConversationAsReadAction } from "@/features/messages/actions/mark-conversation-read";
import { markConversationUnreadAction } from "@/features/messages/actions/mark-conversation-unread";
import { messagesDAL } from "@/dal";
import { mockConversation, mockUser1 } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/dal", () => ({
  messagesDAL: {
    markConversationAsRead: vi.fn(),
    markConversationAsUnread: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

vi.mock("@/features/auth/utils/session", () => ({
  requireAuthenticatedUser: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/features/auth/utils/session";

describe("Status Update Flow: Component → Action → DAL → Database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      user: mockUser1 as any,
      userId: mockUser1.id,
      isAdmin: false,
    });
  });

  it("should complete full flow: User marks read → action updates → DAL updates → database updated", async () => {
    // Arrange
    const conversationId = "conversation-123";

    vi.mocked(tryCatch).mockResolvedValue({
      data: [mockConversation],
      error: null,
    } as any);

    // Act
    const result = await markConversationAsReadAction(conversationId);

    // Assert - Verify complete flow
    expect(result.success).toBe(true);
    expect(tryCatch).toHaveBeenCalledWith(
      messagesDAL.markConversationAsRead(conversationId, mockUser1.id),
    );
    expect(messagesDAL.markConversationAsRead).toHaveBeenCalledWith(
      conversationId,
      mockUser1.id,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/mailbox", "layout");
  });

  it("should complete full flow: User marks unread → action updates → DAL updates → database updated", async () => {
    // Arrange
    const conversationId = "conversation-123";

    vi.mocked(tryCatch).mockResolvedValue({
      data: [mockConversation],
      error: null,
    } as any);

    // Act
    const result = await markConversationUnreadAction(conversationId);

    // Assert - Verify complete flow
    expect(result.success).toBe(true);
    expect(tryCatch).toHaveBeenCalledWith(
      messagesDAL.markConversationAsUnread(conversationId, mockUser1.id),
    );
    expect(messagesDAL.markConversationAsUnread).toHaveBeenCalledWith(
      conversationId,
      mockUser1.id,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/mailbox");
  });

  it("should invalidate cache after status update", async () => {
    // Arrange
    const conversationId = "conversation-123";

    vi.mocked(tryCatch).mockResolvedValue({
      data: [mockConversation],
      error: null,
    } as any);

    // Act
    await markConversationAsReadAction(conversationId);

    // Assert - Cache should be invalidated
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/mailbox", "layout");
  });

  it("should handle error when conversation not found", async () => {
    // Arrange
    const conversationId = "conversation-nonexistent";

    const mockError = {
      message: "Conversation not found",
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
    expect(result.error).toBe("Conversation not found");
    expect(revalidatePath).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle error when unauthorized", async () => {
    // Arrange
    const conversationId = "conversation-123";

    const mockError = {
      message: "Unauthorized access",
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
    expect(result.error).toBe("Unauthorized access");
    expect(revalidatePath).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
