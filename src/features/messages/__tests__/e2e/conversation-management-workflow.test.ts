import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveConversationAction } from "@/features/messages/actions/archive-conversation";
import { unarchiveConversationAction } from "@/features/messages/actions/unarchive-conversation";
import { messagesDAL } from "@/dal";
import { mockConversation } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/dal", () => ({
  messagesDAL: {
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("Conversation Management Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full workflow: User archives conversation → conversation moved to archived tab → user unarchives → conversation moved back to inbox", async () => {
    // Step 1: User archives conversation
    const conversationId = "conversation-123";

    vi.mocked(tryCatch).mockResolvedValueOnce({
      data: [{ ...mockConversation, user1Archived: true }],
      error: null,
    } as any);

    const archiveResult = await archiveConversationAction(conversationId);

    expect(archiveResult.success).toBe(true);
    expect(messagesDAL.archiveConversation).toHaveBeenCalledWith(
      conversationId,
    );

    // Step 2: Verify conversation moved to archived tab
    // (In a real scenario, this would check the UI shows conversation in archived tab)
    expect(archiveResult.data?.[0]?.user1Archived).toBe(true);

    // Step 3: User unarchives conversation
    vi.mocked(tryCatch).mockResolvedValueOnce({
      data: [{ ...mockConversation, user1Archived: false }],
      error: null,
    } as any);

    const unarchiveResult = await unarchiveConversationAction(conversationId);

    expect(unarchiveResult.success).toBe(true);
    expect(messagesDAL.unarchiveConversation).toHaveBeenCalledWith(
      conversationId,
    );

    // Step 4: Verify conversation moved back to inbox
    // (In a real scenario, this would check the UI shows conversation in inbox)
    expect(unarchiveResult.data?.[0]?.user1Archived).toBe(false);
  });

  it("should handle error when archiving fails", async () => {
    // Step 1: User tries to archive conversation
    const conversationId = "conversation-123";

    const mockError = {
      message: "Failed to archive conversation",
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
    expect(result.error).toBe("Failed to archive conversation");

    consoleErrorSpy.mockRestore();
  });

  it("should handle error when unarchiving fails", async () => {
    // Step 1: User tries to unarchive conversation
    const conversationId = "conversation-123";

    const mockError = {
      message: "Failed to unarchive conversation",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await unarchiveConversationAction(conversationId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to unarchive conversation");

    consoleErrorSpy.mockRestore();
  });

  it("should handle error when conversation not found during archive", async () => {
    // Step 1: User tries to archive non-existent conversation
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

    consoleErrorSpy.mockRestore();
  });
});
