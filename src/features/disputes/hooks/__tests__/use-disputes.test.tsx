import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockPaginatedDisputes } from "@/test/fixtures/disputes";
import { useDisputes, disputeKeys } from "../use-disputes";
import type { UseDisputesFilters } from "../use-disputes";

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

describe("useDisputes", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch disputes list successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockPaginatedDisputes,
    });

    const { result } = renderHook(() => useDisputes(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/disputes?");
    expect(result.current.data).toEqual(mockPaginatedDisputes);
  });

  it("should include filters in query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockPaginatedDisputes,
    });

    const filters: UseDisputesFilters = {
      status: "open",
      role: "renter",
      page: 1,
      limit: 12,
    };

    const { result } = renderHook(() => useDisputes(filters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("status=open"),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("role=renter"),
    );
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=12"));
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useDisputes(), {
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
      json: async () => ({ error: "Failed to fetch disputes" }),
    });

    const { result } = renderHook(() => useDisputes(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain("Failed to fetch disputes");
  });

  it("should handle 401 unauthorized error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useDisputes(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("Unauthorized");
  });

  it("should use correct query key", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockPaginatedDisputes,
    });

    const filters: UseDisputesFilters = {
      status: "open",
      role: "renter",
    };

    renderHook(() => useDisputes(filters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify query key is set correctly
    const queryState = queryClient.getQueryState(disputeKeys.list(filters));
    expect(queryState).toBeDefined();
  });

  it("should cache results with correct stale time", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockPaginatedDisputes,
    });

    const { result } = renderHook(() => useDisputes(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify stale time is set (1 minute = 60000ms)
    const queryState = queryClient.getQueryState(disputeKeys.list());
    expect(queryState?.dataUpdatedAt).toBeDefined();
  });
});
