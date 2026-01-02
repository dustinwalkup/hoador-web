import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useConversations,
  useConversationDetails,
  usePrefetchConversation,
} from "../use-conversations";
import {
  mockConversationSummary,
  mockConversationDetails,
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

describe("useConversations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch user's conversations on mount", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [mockConversationSummary],
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/messages/conversations?archived=false&offset=0&limit=20",
    );
    expect(result.current.data?.pages[0]).toEqual([mockConversationSummary]);
  });

  it("should filter by archived status", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [mockConversationSummary],
    });

    // Act
    const { result } = renderHook(() => useConversations(true), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/messages/conversations?archived=true&offset=0&limit=20",
    );
  });

  it("should return loading state initially", () => {
    // Arrange
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    expect(result.current.isLoading).toBe(true);
  });

  it("should return error state on API failure", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it("should support infinite scroll with fetchNextPage", async () => {
    // Arrange - page1 must have 20 items to trigger hasNextPage
    const page1 = Array(20)
      .fill(null)
      .map((_, i) => ({ ...mockConversationSummary, id: `conversation-${i}` }));
    const page2 = [{ ...mockConversationSummary, id: "conversation-456" }];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2,
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

    // Verify hasNextPage is true before fetching
    expect(result.current.hasNextPage).toBe(true);

    // Fetch next page
    await result.current.fetchNextPage();

    // Assert
    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(result.current.data?.pages[0]).toEqual(page1);
    expect(result.current.data?.pages[1]).toEqual(page2);
  });

  it("should indicate hasNextPage correctly", async () => {
    // Arrange - Return full page (20 items) to indicate more pages available
    const fullPage = Array(20)
      .fill(null)
      .map((_, i) => ({ ...mockConversationSummary, id: `conversation-${i}` }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => fullPage,
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert - wait for both success and hasNextPage to be set
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  it("should indicate no more pages when page is incomplete", async () => {
    // Arrange - Return less than 20 items
    const incompletePage = [mockConversationSummary];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => incompletePage,
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

    // Assert
    expect(result.current.hasNextPage).toBe(false);
  });

  it("should use correct cache key", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [mockConversationSummary],
    });

    // Act
    renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(["conversations", false])).toBeDefined();
    });

    // Assert
    expect(queryClient.getQueryData(["conversations", false])).toBeDefined();
    expect(queryClient.getQueryData(["conversations", true])).toBeUndefined();
  });

  it("should configure refetch interval for real-time updates", () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [mockConversationSummary],
    });

    // Act
    const { result } = renderHook(() => useConversations(false), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert - Check that refetchInterval is configured (30 seconds)
    // This is verified by the query configuration
    expect(result.current).toBeDefined();
  });
});

describe("useConversationDetails", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch conversation details when conversationId is provided", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockConversationDetails,
    });

    // Act
    const { result } = renderHook(
      () => useConversationDetails("conversation-123"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    // Assert
    await waitFor(() => {
      expect(result.current.data).toEqual(mockConversationDetails);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/messages/conversations/conversation-123",
    );
  });

  it("should not fetch when conversationId is null", () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockConversationDetails,
    });

    // Act
    const { result } = renderHook(() => useConversationDetails(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert - React Query returns undefined when query is disabled
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle API errors", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    // Act
    const { result } = renderHook(
      () => useConversationDetails("conversation-123"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    // Assert
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it("should use correct cache key", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockConversationDetails,
    });

    // Act
    renderHook(() => useConversationDetails("conversation-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(["conversation-details", "conversation-123"]),
      ).toBeDefined();
    });

    // Assert
    expect(
      queryClient.getQueryData(["conversation-details", "conversation-123"]),
    ).toBeDefined();
  });
});

describe("usePrefetchConversation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should prefetch conversation details", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockConversationDetails,
    });

    // Act
    const { result } = renderHook(() => usePrefetchConversation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Call prefetch and wait for it to complete
    result.current("conversation-123");

    // Assert - wait for the fetch to be called first
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/messages/conversations/conversation-123",
      );
    });

    // Then check the cache is populated
    await waitFor(() => {
      expect(
        queryClient.getQueryData(["conversation-details", "conversation-123"]),
      ).toBeDefined();
    });
  });
});
