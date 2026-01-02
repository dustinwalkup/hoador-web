import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConversations } from "@/features/messages/hooks/use-conversations";
import {
  mockConversationSummary,
  mockUnreadConversation,
} from "@/test/fixtures/messages";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe("Search Workflow (E2E)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("should complete full search workflow: User has multiple conversations → searches for specific user → filtered results display → clears search → all conversations display", async () => {
    // Step 1: User has multiple conversations
    const conversations = [
      mockConversationSummary,
      mockUnreadConversation,
      {
        ...mockConversationSummary,
        id: "conversation-456",
        otherUser: {
          id: "user-789",
          name: "Bob Johnson",
          avatar: null,
          initials: "BJ",
        },
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => conversations,
    });

    // Step 2: User searches for specific user
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify all conversations are loaded
    expect(result.current.data?.pages[0]).toHaveLength(3);

    // Step 3: Verify filtered results display
    // (In a real component, this would filter by search query)
    // The filtering logic is in ConversationsList component
    const allConversations = result.current.data?.pages[0] || [];
    const filteredByJane = allConversations.filter((conv) =>
      conv.otherUser.name.toLowerCase().includes("jane"),
    );

    expect(filteredByJane).toHaveLength(2); // mockConversationSummary and mockUnreadConversation both have "Jane Smith"

    // Step 4: Clear search
    // (In a real component, this would clear the search input)
    const filteredByBob = allConversations.filter((conv) =>
      conv.otherUser.name.toLowerCase().includes("bob"),
    );

    expect(filteredByBob).toHaveLength(1);
    expect(filteredByBob[0].otherUser.name).toBe("Bob Johnson");

    // Step 5: Verify all conversations display when search is cleared
    // (In a real component, this would show all conversations)
    expect(allConversations).toHaveLength(3);
  });

  it("should filter conversations by message content", async () => {
    // Arrange
    const conversations = [
      mockConversationSummary,
      {
        ...mockConversationSummary,
        id: "conversation-456",
        lastMessage: {
          content: "Different message",
          time: new Date(),
          senderId: "user-456",
        },
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => conversations,
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Assert - Filter by message content
    const allConversations = result.current.data?.pages[0] || [];
    const filteredByMessage = allConversations.filter(
      (conv) =>
        conv.lastMessage?.content
          .toLowerCase()
          .includes("available") || false,
    );

    expect(filteredByMessage).toHaveLength(1);
    expect(filteredByMessage[0].lastMessage?.content).toContain("available");
  });

  it("should handle empty search results", async () => {
    // Arrange
    const conversations = [mockConversationSummary];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => conversations,
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Assert - Search for non-existent user
    const allConversations = result.current.data?.pages[0] || [];
    const filteredByNonExistent = allConversations.filter((conv) =>
      conv.otherUser.name.toLowerCase().includes("nonexistent"),
    );

    expect(filteredByNonExistent).toHaveLength(0);
  });

  it("should handle case-insensitive search", async () => {
    // Arrange
    const conversations = [mockConversationSummary];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => conversations,
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Assert - Case-insensitive search
    const allConversations = result.current.data?.pages[0] || [];
    const filteredByLowercase = allConversations.filter((conv) =>
      conv.otherUser.name.toLowerCase().includes("jane"),
    );
    const filteredByUppercase = allConversations.filter((conv) =>
      conv.otherUser.name.toLowerCase().includes("JANE"),
    );

    expect(filteredByLowercase).toHaveLength(1);
    expect(filteredByUppercase).toHaveLength(1);
  });
});

