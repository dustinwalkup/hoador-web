import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useUpdateDisputeState } from "../use-update-dispute-state";
import { mockDispute, mockUpdateStateData } from "@/test/fixtures/disputes";
import { disputeKeys } from "../use-disputes";

// Mock toast before any imports
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

describe("useUpdateDisputeState", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should update dispute state successfully", async () => {
    const mockUpdatedDispute = {
      ...mockDispute,
      status: mockUpdateStateData.newState,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUpdatedDispute,
    });

    const { result } = renderHook(() => useUpdateDisputeState("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockUpdateStateData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/disputes/dispute-123/state",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mockUpdateStateData),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Dispute state updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid state transition" }),
    });

    const { result } = renderHook(() => useUpdateDisputeState("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockUpdateStateData),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid state transition",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should invalidate dispute query on success", async () => {
    const mockUpdatedDispute = {
      ...mockDispute,
      status: mockUpdateStateData.newState,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUpdatedDispute,
    });

    // Pre-populate cache with a query to test invalidation
    queryClient.setQueryData(disputeKeys.detail("dispute-123"), mockDispute);

    const { result } = renderHook(() => useUpdateDisputeState("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockUpdateStateData);

    await waitFor(() => {
      const queryState = queryClient.getQueryState(
        disputeKeys.detail("dispute-123"),
      );
      expect(queryState).toBeDefined();
    });
  });

  it("should include optional reason in request", async () => {
    const mockUpdatedDispute = {
      ...mockDispute,
      status: mockUpdateStateData.newState,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUpdatedDispute,
    });

    const { result } = renderHook(() => useUpdateDisputeState("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockUpdateStateData);

    await waitFor(() => {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.reason).toBe(mockUpdateStateData.reason);
    });
  });
});
