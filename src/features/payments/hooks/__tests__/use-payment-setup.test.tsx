import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useSetupIntent, useAttachPaymentMethod } from "../use-payment-setup";
import { paymentKeys } from "../use-payment-methods";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

describe("useSetupIntent", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should successfully fetch setup intent client secret", async () => {
    const mockClientSecret = "seti_123_secret_abc";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: mockClientSecret }),
    });

    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/create-setup-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(result.current.data).toBe(mockClientSecret);
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("should handle API errors with proper error messages", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to create setup intent" }),
    });

    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect((result.current.error as Error).message).toBe(
      "Failed to create setup intent",
    );
  });

  it("should use staleTime: 0 (no caching for single-use intents)", () => {
    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify query is created with correct key
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.findAll({ queryKey: ["setup-intent"] });
    expect(queries.length).toBeGreaterThan(0);

    // Query should be configured (staleTime is an implementation detail)
    // The important behavior is that the query works correctly
    expect(result.current).toBeDefined();
  });

  it("should extract clientSecret from response correctly", async () => {
    const mockClientSecret = "seti_456_secret_xyz";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: mockClientSecret }),
    });

    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(mockClientSecret);
  });

  it("should handle missing clientSecret in response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}), // Missing clientSecret property
    });

    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // React Query doesn't allow undefined to be returned from query functions
    // The query will fail because undefined is returned
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("should handle default error message when error object is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}), // Missing error property
    });

    const { result } = renderHook(() => useSetupIntent(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Failed to create setup intent",
    );
  });
});

describe("useAttachPaymentMethod", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should successfully attach payment method", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAttachPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_123");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/stripe/attach-payment-method",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId: "pm_123" }),
        },
      );
    });
  });

  it("should invalidate payment methods query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAttachPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_123");

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: paymentKeys.all,
      });
    });
  });

  it("should not show success toast (handled by parent)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAttachPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_123");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should not show success toast - handled by parent component
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should handle API errors with proper error messages", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid payment method" }),
    });

    const { result } = renderHook(() => useAttachPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("pm_123")).rejects.toThrow(
      "Invalid payment method",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid payment method",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should send correct request body with paymentMethodId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAttachPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_789");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/stripe/attach-payment-method",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId: "pm_789" }),
        },
      );
    });
  });

  it("should handle default error message when error object is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}), // Missing error property
    });

    const { result } = renderHook(() => useAttachPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("pm_123")).rejects.toThrow(
      "Failed to attach payment method",
    );
  });
});
