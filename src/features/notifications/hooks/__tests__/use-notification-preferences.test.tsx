import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock sonner before any imports that use it
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  notificationPreferencesKeys,
} from "../use-notification-preferences";
import { toast } from "sonner";

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

const mockPreferencesResponse = {
  master: { email: true, push: true },
  categories: {
    bookings: { email: true, push: true },
    payments: { email: true, push: false },
    messages: { email: false, push: true },
    disputes: { email: true, push: true },
    reminders: { email: true, push: true },
  },
};

describe("useNotificationPreferences", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch preferences on mount", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockPreferencesResponse,
    });

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications/preferences");
    expect(result.current.data).toEqual(mockPreferencesResponse);
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("should return error state on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Internal server error");
  });

  it("should use fallback error message when response JSON fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("parse error");
      },
    });

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Failed to load preferences");
  });
});

describe("useUpdateNotificationPreferences", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should patch master preferences successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockPreferencesResponse,
        master: { email: false, push: true },
      }),
    });

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ master: { email: false } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master: { email: false } }),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Preferences updated",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should patch category preferences successfully", async () => {
    const updatedResponse = {
      ...mockPreferencesResponse,
      categories: {
        ...mockPreferencesResponse.categories,
        bookings: { email: false, push: true },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => updatedResponse,
    });

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const payload = {
      categories: { bookings: { email: false, push: true } },
    };

    await result.current.mutateAsync(payload);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    });
  });

  it("should invalidate preferences query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockPreferencesResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ master: { push: false } });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: notificationPreferencesKeys.all,
      });
    });
  });

  it("should handle API errors correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid payload" }),
    });

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ master: { email: false } }),
    ).rejects.toThrow("Invalid payload");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid payload",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should use fallback error message when response JSON fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("parse error");
      },
    });

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ master: { push: false } }),
    ).rejects.toThrow("Failed to update preferences");
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ master: { email: true } }),
    ).rejects.toThrow("Network error");
  });
});
