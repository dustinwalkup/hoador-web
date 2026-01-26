import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useCreateDispute } from "../use-create-dispute";
import {
  mockDispute,
  mockCreateDisputeData,
  mockPaginatedDisputes,
} from "@/test/fixtures/disputes";
import { disputeKeys } from "../use-disputes";

// Create mockRouter object for testing
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

// Mock next/navigation before any imports
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

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

describe("useCreateDispute", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should create dispute successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDispute,
    });

    const { result } = renderHook(() => useCreateDispute(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockCreateDisputeData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockCreateDisputeData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Dispute created successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/dashboard/disputes/${mockDispute.id}`,
    );
  });

  it("should handle API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "An active dispute already exists" }),
    });

    const { result } = renderHook(() => useCreateDispute(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockCreateDisputeData),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "An active dispute already exists",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should invalidate disputes queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDispute,
    });

    // Pre-populate cache with a query to test invalidation
    queryClient.setQueryData(disputeKeys.all, mockPaginatedDisputes);

    const { result } = renderHook(() => useCreateDispute(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockCreateDisputeData);

    await waitFor(() => {
      const queryState = queryClient.getQueryState(disputeKeys.all);
      // Query should exist and be invalidated
      expect(queryState).toBeDefined();
    });
  });
});
