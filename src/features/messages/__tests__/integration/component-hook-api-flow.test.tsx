import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConversations } from "@/features/messages/hooks/use-conversations";
import { mockConversationSummary } from "@/test/fixtures/messages";

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

describe("Component → Hook → API Flow", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("should complete data fetching flow: Component uses hook → hook fetches from API → data displayed", async () => {
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

  it("should handle loading states: Hook loading state → component shows loading UI", () => {
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
    // In a real component, this would trigger loading UI
  });

  it("should handle error states: API error → hook error state → component shows error", async () => {
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
    // In a real component, this would trigger error UI
  });

  it("should handle real-time updates: Hook subscribes to updates → component updates", async () => {
    // Arrange
    const initialData = [mockConversationSummary];
    const updatedData = [
      mockConversationSummary,
      { ...mockConversationSummary, id: "conversation-456" },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
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

    // Simulate refetch (real-time update)
    await result.current.refetch();

    // Assert
    await waitFor(() => {
      expect(result.current.data?.pages[0]).toEqual(updatedData);
    });
  });

  it("should handle network errors gracefully", async () => {
    // Arrange
    mockFetch.mockRejectedValue(new Error("Network error"));

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
});

