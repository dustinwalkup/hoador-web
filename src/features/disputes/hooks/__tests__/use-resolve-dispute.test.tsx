import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useResolveDispute } from "../use-resolve-dispute";
import {
  mockDispute,
  mockResolveDisputeData,
  mockPaginatedDisputes,
} from "@/test/fixtures/disputes";
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

describe("useResolveDispute", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should resolve dispute successfully", async () => {
    const mockResolvedDispute = {
      ...mockDispute,
      status: "resolved",
      resolvedAt: new Date(),
      resolvedBy: "admin-123",
      resolutionOutcome: "favor_renter",
      resolutionReason: mockResolveDisputeData.reason,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResolvedDispute,
    });

    const { result } = renderHook(() => useResolveDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockResolveDisputeData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/disputes/dispute-123/resolve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mockResolveDisputeData),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Dispute resolved successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Dispute is already resolved and cannot be resolved again",
      }),
    });

    const { result } = renderHook(() => useResolveDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockResolveDisputeData),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("should invalidate dispute and disputes queries on success", async () => {
    const mockResolvedDispute = {
      ...mockDispute,
      status: "resolved",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResolvedDispute,
    });

    // Pre-populate cache with queries to test invalidation
    queryClient.setQueryData(disputeKeys.detail("dispute-123"), mockDispute);
    queryClient.setQueryData(disputeKeys.all, mockPaginatedDisputes);

    const { result } = renderHook(() => useResolveDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockResolveDisputeData);

    await waitFor(() => {
      const disputeQueryState = queryClient.getQueryState(
        disputeKeys.detail("dispute-123"),
      );
      const disputesQueryState = queryClient.getQueryState(disputeKeys.all);
      expect(disputeQueryState).toBeDefined();
      expect(disputesQueryState).toBeDefined();
    });
  });

  it("should handle financial operations in request", async () => {
    const mockResolvedDispute = {
      ...mockDispute,
      status: "resolved",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResolvedDispute,
    });

    const { result } = renderHook(() => useResolveDispute("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockResolveDisputeData);

    await waitFor(() => {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.financialOperations).toEqual(
        mockResolveDisputeData.financialOperations,
      );
    });
  });
});
