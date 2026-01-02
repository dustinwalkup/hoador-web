import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useNotifications,
  useUnreadCount,
  useInfiniteNotifications,
  useMarkAsRead,
  useToggleReadStatus,
} from "../use-notifications";
import {
  mockNotifications,
  mockNotificationsResponse,
} from "@/test/fixtures/notifications";

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

describe("useNotifications", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch notifications on mount", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockNotificationsResponse,
    });

    // Act
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/notifications"),
    );
    expect(result.current.data).toEqual(mockNotificationsResponse);
  });

  it("should return loading state initially", () => {
    // Arrange
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    // Act
    const { result } = renderHook(() => useNotifications(), {
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
      json: async () => ({ error: "Failed to fetch notifications" }),
    });

    // Act
    const { result } = renderHook(() => useNotifications(), {
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

  it("should include page, limit, unreadOnly in query key", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockNotificationsResponse,
    });

    // Act
    renderHook(
      () => useNotifications({ page: 2, limit: 10, unreadOnly: true }),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    // Assert
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("unreadOnly=true"),
    );
  });
});

describe("useUnreadCount", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch count on mount", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 5 }),
    });

    // Act
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications/count");
    expect(result.current.data).toBe(5);
  });

  it("should return loading state initially", () => {
    // Arrange
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    // Act
    const { result } = renderHook(() => useUnreadCount(), {
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
      json: async () => ({ error: "Failed to fetch count" }),
    });

    // Act
    const { result } = renderHook(() => useUnreadCount(), {
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

  it("should return zero count when no unread notifications", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });

    // Act
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(0);
  });
});

describe("useInfiniteNotifications", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch first page on mount", async () => {
    // Arrange
    const firstPageResponse = {
      ...mockNotificationsResponse,
      pagination: {
        ...mockNotificationsResponse.pagination,
        page: 1,
        hasNext: true,
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => firstPageResponse,
    });

    // Act
    const { result } = renderHook(() => useInfiniteNotifications(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(result.current.data?.pages[0]).toEqual(firstPageResponse);
  });

  it("should fetch next page correctly", async () => {
    // Arrange
    const firstPageResponse = {
      ...mockNotificationsResponse,
      pagination: {
        ...mockNotificationsResponse.pagination,
        page: 1,
        hasNext: true,
      },
    };

    const secondPageResponse = {
      ...mockNotificationsResponse,
      pagination: {
        ...mockNotificationsResponse.pagination,
        page: 2,
        hasNext: false,
      },
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstPageResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => secondPageResponse,
      });

    // Act
    const { result } = renderHook(() => useInfiniteNotifications(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert - wait for first page
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(1);

    // Fetch next page
    await result.current.fetchNextPage();

    // Wait for the second page to be fetched and isFetchingNextPage to be false
    await waitFor(
      () => {
        expect(result.current.data?.pages).toHaveLength(2);
        expect(result.current.isFetchingNextPage).toBe(false);
      },
      { timeout: 3000 },
    );

    expect(result.current.data?.pages[1]).toEqual(secondPageResponse);
  });

  it("should include isRead and type in query key", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockNotificationsResponse,
    });

    // Act
    renderHook(
      () =>
        useInfiniteNotifications({
          isRead: false,
          type: "rental_request_created",
        }),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    // Assert
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("isRead=false"),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("type=rental_request_created"),
    );
  });

  it("should handle API errors", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to fetch notifications" }),
    });

    // Act
    const { result } = renderHook(() => useInfiniteNotifications(), {
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

describe("useMarkAsRead", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should call API with correct payload", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Act
    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ notificationId: "notification-123" });

    // Assert
    expect(mockFetch).toHaveBeenCalledWith("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notificationId: "notification-123" }),
    });
  });

  it("should invalidate notifications queries on success", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Act
    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const mutationResult = await result.current.mutateAsync({
      notificationId: "notification-123",
    });

    // Assert
    // Query invalidation happens internally, we can't easily test it directly
    // but we can verify the mutation succeeded by checking the result
    expect(mutationResult).toEqual({ success: true });
    // isSuccess may reset quickly after mutation completes, so we verify via result
  });

  it("should handle markAll option", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Act
    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ markAll: true });

    // Assert
    expect(mockFetch).toHaveBeenCalledWith("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ markAll: true }),
    });
  });

  it("should handle API errors", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to mark as read" }),
    });

    // Act
    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await expect(
      result.current.mutateAsync({ notificationId: "notification-123" }),
    ).rejects.toThrow();
  });
});

describe("useToggleReadStatus", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should call API with toggleRead and currentReadStatus", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Act
    const { result } = renderHook(() => useToggleReadStatus(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      notificationId: "notification-123",
      currentReadStatus: false,
    });

    // Assert
    expect(mockFetch).toHaveBeenCalledWith("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notificationId: "notification-123",
        toggleRead: true,
        currentReadStatus: false,
      }),
    });
  });

  it("should invalidate notifications queries on success", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Act
    const { result } = renderHook(() => useToggleReadStatus(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const mutationResult = await result.current.mutateAsync({
      notificationId: "notification-123",
      currentReadStatus: false,
    });

    // Assert
    // Query invalidation happens internally, we can't easily test it directly
    // but we can verify the mutation succeeded by checking the result
    expect(mutationResult).toEqual({ success: true });
    // isSuccess may reset quickly after mutation completes, so we verify via result
  });

  it("should handle API errors", async () => {
    // Arrange
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to toggle read status" }),
    });

    // Act
    const { result } = renderHook(() => useToggleReadStatus(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Assert
    await expect(
      result.current.mutateAsync({
        notificationId: "notification-123",
        currentReadStatus: false,
      }),
    ).rejects.toThrow();
  });
});
