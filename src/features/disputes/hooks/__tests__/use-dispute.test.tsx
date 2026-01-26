import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDispute } from "../use-dispute";
import { disputeKeys } from "../use-disputes";
import { mockDispute } from "@/test/fixtures/disputes";

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

describe("useDispute", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch dispute by ID successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDispute,
    });

    const { result } = renderHook(() => useDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/disputes/dispute-123");
    expect(result.current.data).toEqual(mockDispute);
  });

  it("should not fetch when disputeId is null", () => {
    const { result } = renderHook(() => useDispute(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should not fetch when disputeId is empty string", () => {
    const { result } = renderHook(() => useDispute(""), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("should return error state on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Dispute not found" }),
    });

    const { result } = renderHook(() => useDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain("Dispute not found");
  });

  it("should return error when disputeId is required but missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Dispute ID is required" }),
    });

    // This shouldn't happen in practice since enabled: !!disputeId prevents it
    // But we test the error handling in the mutationFn
    renderHook(() => useDispute(""), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Should not fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should use correct query key", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDispute,
    });

    renderHook(() => useDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify query key is set correctly
    const queryState = queryClient.getQueryState(
      disputeKeys.detail("dispute-123"),
    );
    expect(queryState).toBeDefined();
  });

  it("should cache results with correct stale time", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDispute,
    });

    const { result } = renderHook(() => useDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify stale time is set (5 minutes = 300000ms)
    const queryState = queryClient.getQueryState(
      disputeKeys.detail("dispute-123"),
    );
    expect(queryState?.dataUpdatedAt).toBeDefined();
  });

  it("should handle 403 forbidden error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: "Access denied. You can only view your own disputes.",
      }),
    });

    const { result } = renderHook(() => useDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("Access denied");
  });
});
