import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveConversationAction } from "../archive-conversation";
import { messagesDAL } from "@/dal";
import { mockConversation, mockUser1 } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/dal", () => ({
  messagesDAL: {
    archiveConversation: vi.fn(),
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

describe("archiveConversationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      user: mockUser1 as any,
      userId: mockUser1.id,
      isAdmin: false,
    });
  });

  it("should archive conversation successfully", async () => {
    // Arrange
    const conversationId = "conversation-123";

    vi.mocked(tryCatch).mockResolvedValue({
      data: [mockConversation],
      error: null,
    } as any);

    // Act
    const result = await archiveConversationAction(conversationId);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toEqual([mockConversation]);
    expect(tryCatch).toHaveBeenCalledWith(
      messagesDAL.archiveConversation(conversationId, mockUser1.id),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/mailbox");
  });

  it("should return error when unauthorized", async () => {
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
    const result = await archiveConversationAction(conversationId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized access");
    expect(revalidatePath).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should return error when conversation not found", async () => {
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
    const result = await archiveConversationAction(conversationId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Conversation not found");
    expect(revalidatePath).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle database errors", async () => {
    // Arrange
    const conversationId = "conversation-123";

    const mockError = {
      message: "Database connection failed",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await archiveConversationAction(conversationId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
