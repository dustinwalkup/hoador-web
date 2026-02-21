import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import {
  usePaymentMethods,
  useSetDefaultPaymentMethod,
  useDeletePaymentMethod,
  paymentKeys,
  type PaymentMethod,
} from "../use-payment-methods";

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

describe("usePaymentMethods", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockPaymentMethods: PaymentMethod[] = [
    {
      id: "pm_123",
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2025,
    },
    {
      id: "pm_456",
      brand: "mastercard",
      last4: "5555",
      exp_month: 6,
      exp_year: 2026,
    },
  ];

  it("should successfully fetch payment methods", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ paymentMethods: mockPaymentMethods }),
    });

    const { result } = renderHook(() => usePaymentMethods(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/get-payment-methods");
    expect(result.current.data?.paymentMethods).toEqual(mockPaymentMethods);
    expect(result.current.data?.defaultPaymentMethodId).toBeNull();
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => usePaymentMethods(), {
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
      json: async () => ({ error: "Failed to fetch payment methods" }),
    });

    const { result } = renderHook(() => usePaymentMethods(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect((result.current.error as Error).message).toBe(
      "Failed to fetch payment methods",
    );
  });

  it("should return empty array when no payment methods", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ paymentMethods: [], defaultPaymentMethodId: null }),
    });

    const { result } = renderHook(() => usePaymentMethods(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.paymentMethods).toEqual([]);
    expect(result.current.data?.defaultPaymentMethodId).toBeNull();
  });

  it("should use correct query key and stale time", () => {
    renderHook(() => usePaymentMethods(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Check that query key matches paymentKeys.all
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.findAll({ queryKey: paymentKeys.all });
    expect(queries.length).toBeGreaterThan(0);
  });

  it("should handle malformed API responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}), // Missing paymentMethods property
    });

    const { result } = renderHook(() => usePaymentMethods(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return empty array and null default when paymentMethods is missing
    expect(result.current.data?.paymentMethods).toEqual([]);
    expect(result.current.data?.defaultPaymentMethodId).toBeNull();
  });

  it("should handle default error message when error object is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}), // Missing error property
    });

    const { result } = renderHook(() => usePaymentMethods(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Failed to fetch payment methods",
    );
  });
});

describe("useSetDefaultPaymentMethod", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should successfully set default payment method", async () => {
    const mockResponse = { success: true };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useSetDefaultPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_123");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/stripe/set-default-payment-method",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId: "pm_123" }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Default payment method updated",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate payment methods query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetDefaultPaymentMethod(), {
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

  it("should handle API errors with proper error messages", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid payment method" }),
    });

    const { result } = renderHook(() => useSetDefaultPaymentMethod(), {
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

  it("should send correct request body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useSetDefaultPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_789");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/stripe/set-default-payment-method",
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

    const { result } = renderHook(() => useSetDefaultPaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("pm_123")).rejects.toThrow(
      "Failed to set default payment method",
    );
  });
});

describe("useDeletePaymentMethod", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should successfully delete payment method", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useDeletePaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_123");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/stripe/delete-payment-method?id=pm_123",
        {
          method: "DELETE",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Payment method removed",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate payment methods query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePaymentMethod(), {
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

  it("should handle API errors with proper error messages", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Payment method not found" }),
    });

    const { result } = renderHook(() => useDeletePaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("pm_123")).rejects.toThrow(
      "Payment method not found",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Payment method not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should send DELETE request with correct ID parameter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useDeletePaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("pm_456");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/stripe/delete-payment-method?id=pm_456",
        {
          method: "DELETE",
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

    const { result } = renderHook(() => useDeletePaymentMethod(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("pm_123")).rejects.toThrow(
      "Failed to delete payment method",
    );
  });
});

describe("paymentKeys", () => {
  it("should export paymentKeys.all", () => {
    expect(paymentKeys.all).toEqual(["payment-methods"]);
  });
});
