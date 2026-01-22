import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import {
  useStartConversation,
  useSendMessage,
  useArchiveConversation,
  useUnarchiveConversation,
  useMarkConversationRead,
  useMarkConversationUnread,
  useDeleteConversation,
} from "../use-message-mutations";
import {
  mockConversationSummary,
  mockConversationDetails,
} from "@/test/fixtures/messages";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Create test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component for React Query
function QueryWrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useStartConversation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockConversationData = {
    recipientId: "user-456",
    listingId: "listing-123",
    listingName: "Power Drill",
    message: "Hello, is this tool still available?",
  };

  const mockSuccessResponse = {
    success: true,
    conversationId: "conversation-123",
  };

  it("should start conversation successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useStartConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockConversationData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockConversationData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Message sent successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useStartConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockConversationData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["messages", "unread-count"],
      });
    });
  });

  it("should invalidate conversation details when conversationId is returned", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useStartConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockConversationData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details", "conversation-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to start conversation" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useStartConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockConversationData),
    ).rejects.toThrow("Failed to start conversation");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to start conversation",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useStartConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockConversationData),
    ).rejects.toThrow("Network error");
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useStartConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate(mockConversationData);

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });
});

describe("useSendMessage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockMessageData = {
    conversationId: "conversation-123",
    content: "Hello, is this tool still available?",
  };

  const mockMessageResponse = {
    id: "message-456",
    content: "Hello, is this tool still available?",
    createdAt: new Date("2024-01-16"),
    senderId: "user-123",
  };

  const mockSuccessResponse = {
    success: true,
    data: mockMessageResponse,
  };

  it("should send message successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockMessageData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/messages/conversations/conversation-123/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: mockMessageData.content }),
        },
      );
    });
  });

  it("should update conversation details optimistically", async () => {
    // Set up initial conversation data in cache
    queryClient.setQueryData(
      ["conversation-details", "conversation-123"],
      mockConversationDetails,
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockMessageData);

    await waitFor(() => {
      const updatedData = queryClient.getQueryData([
        "conversation-details",
        "conversation-123",
      ]) as typeof mockConversationDetails;

      expect(updatedData.messages).toHaveLength(
        mockConversationDetails.messages.length + 1,
      );
      expect(
        updatedData.messages[updatedData.messages.length - 1].content,
      ).toBe(mockMessageData.content);
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockMessageData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["messages", "unread-count"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to send message" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockMessageData)).rejects.toThrow(
      "Failed to send message",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to send message",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});

describe("useArchiveConversation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockConversationId = "conversation-123";
  const mockSuccessResponse = {
    success: true,
    data: { id: mockConversationId, archived: true },
  };

  it("should archive conversation successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useArchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${mockConversationId}/archive`,
        {
          method: "POST",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Conversation archived",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should update conversation details optimistically", async () => {
    queryClient.setQueryData(
      ["conversation-details", mockConversationId],
      mockConversationDetails,
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useArchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const updatedData = queryClient.getQueryData([
        "conversation-details",
        mockConversationId,
      ]) as typeof mockConversationDetails;

      expect(updatedData.archived).toBe(true);
    });
  });

  it("should remove conversation from active list optimistically", async () => {
    queryClient.setQueryData(["conversations", false], {
      pages: [[mockConversationSummary]],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useArchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const conversationsData = queryClient.getQueryData([
        "conversations",
        false,
      ]) as { pages: (typeof mockConversationSummary)[][] };

      expect(
        conversationsData.pages[0].find(
          (conv) => conv.id === mockConversationId,
        ),
      ).toBeUndefined();
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useArchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", true],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to archive conversation" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useArchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ conversationId: mockConversationId }),
    ).rejects.toThrow("Failed to archive conversation");
  });
});

describe("useUnarchiveConversation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockConversationId = "conversation-123";
  const mockSuccessResponse = {
    success: true,
    data: { id: mockConversationId, archived: false },
  };

  it("should unarchive conversation successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUnarchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${mockConversationId}/unarchive`,
        {
          method: "POST",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Conversation unarchived",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should update conversation details optimistically", async () => {
    const archivedConversation = {
      ...mockConversationDetails,
      archived: true,
    };
    queryClient.setQueryData(
      ["conversation-details", mockConversationId],
      archivedConversation,
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUnarchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const updatedData = queryClient.getQueryData([
        "conversation-details",
        mockConversationId,
      ]) as typeof mockConversationDetails;

      expect(updatedData.archived).toBe(false);
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUnarchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", true],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to unarchive conversation" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUnarchiveConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ conversationId: mockConversationId }),
    ).rejects.toThrow("Failed to unarchive conversation");
  });
});

describe("useMarkConversationRead", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockConversationId = "conversation-123";
  const mockSuccessResponse = {
    success: true,
    data: { id: mockConversationId, unread: false },
  };

  it("should mark conversation as read successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useMarkConversationRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${mockConversationId}/read`,
        {
          method: "POST",
        },
      );
    });
  });

  it("should update conversation details optimistically", async () => {
    const unreadConversation = {
      ...mockConversationDetails,
      unread: true,
    };
    queryClient.setQueryData(
      ["conversation-details", mockConversationId],
      unreadConversation,
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useMarkConversationRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const updatedData = queryClient.getQueryData([
        "conversation-details",
        mockConversationId,
      ]) as typeof mockConversationDetails;

      expect(updatedData.unread).toBe(false);
    });
  });

  it("should update conversations list optimistically", async () => {
    const unreadConversation = {
      ...mockConversationSummary,
      unread: true,
    };
    queryClient.setQueryData(["conversations", false], {
      pages: [[unreadConversation]],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useMarkConversationRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const conversationsData = queryClient.getQueryData([
        "conversations",
        false,
      ]) as { pages: (typeof mockConversationSummary)[][] };

      const conversation = conversationsData.pages[0].find(
        (conv) => conv.id === mockConversationId,
      );
      expect(conversation?.unread).toBe(false);
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkConversationRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["messages", "unread-count"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to mark conversation as read" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useMarkConversationRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ conversationId: mockConversationId }),
    ).rejects.toThrow("Failed to mark conversation as read");
  });
});

describe("useMarkConversationUnread", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockConversationId = "conversation-123";
  const mockSuccessResponse = {
    success: true,
    data: { id: mockConversationId, unread: true },
  };

  it("should mark conversation as unread successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useMarkConversationUnread(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${mockConversationId}/unread`,
        {
          method: "POST",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Marked as unread",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should update conversation details optimistically", async () => {
    queryClient.setQueryData(
      ["conversation-details", mockConversationId],
      mockConversationDetails,
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useMarkConversationUnread(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const updatedData = queryClient.getQueryData([
        "conversation-details",
        mockConversationId,
      ]) as typeof mockConversationDetails;

      expect(updatedData.unread).toBe(true);
    });
  });

  it("should update conversations list optimistically", async () => {
    queryClient.setQueryData(["conversations", false], {
      pages: [[mockConversationSummary]],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useMarkConversationUnread(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const conversationsData = queryClient.getQueryData([
        "conversations",
        false,
      ]) as { pages: (typeof mockConversationSummary)[][] };

      const conversation = conversationsData.pages[0].find(
        (conv) => conv.id === mockConversationId,
      );
      expect(conversation?.unread).toBe(true);
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkConversationUnread(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["messages", "unread-count"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to mark conversation as unread" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useMarkConversationUnread(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ conversationId: mockConversationId }),
    ).rejects.toThrow("Failed to mark conversation as unread");
  });
});

describe("useDeleteConversation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockConversationId = "conversation-123";
  const mockSuccessResponse = {
    success: true,
  };

  it("should delete conversation successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${mockConversationId}`,
        {
          method: "DELETE",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Conversation deleted",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should remove conversation from cache", async () => {
    queryClient.setQueryData(
      ["conversation-details", mockConversationId],
      mockConversationDetails,
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const removeQueriesSpy = vi.spyOn(queryClient, "removeQueries");

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(removeQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details", mockConversationId],
      });
    });
  });

  it("should remove conversation from conversations list optimistically", async () => {
    queryClient.setQueryData(["conversations", false], {
      pages: [[mockConversationSummary]],
    });
    queryClient.setQueryData(["conversations", true], {
      pages: [[{ ...mockConversationSummary, id: "conversation-456" }]],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      const conversationsData = queryClient.getQueryData([
        "conversations",
        false,
      ]) as { pages: (typeof mockConversationSummary)[][] };

      expect(
        conversationsData.pages[0].find(
          (conv) => conv.id === mockConversationId,
        ),
      ).toBeUndefined();
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ conversationId: mockConversationId });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", false],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversations", true],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["conversation-details"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Failed to delete conversation" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ conversationId: mockConversationId }),
    ).rejects.toThrow("Failed to delete conversation");
  });
});
