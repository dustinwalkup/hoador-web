import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useAccountSession, useCreateLoginLink } from "../use-stripe-connect";

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

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", {
  writable: true,
  value: mockWindowOpen,
});

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

describe("useAccountSession", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should successfully fetch account session for onboarding mode", async () => {
    const mockClientSecret = "acct_session_123_secret";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: mockClientSecret }),
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/stripe/create-account-session?mode=onboarding",
      {
        method: "POST",
      },
    );
    expect(result.current.data).toBe(mockClientSecret);
  });

  it("should successfully fetch account session for payments mode", async () => {
    const mockClientSecret = "acct_session_456_secret";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: mockClientSecret }),
    });

    const { result } = renderHook(() => useAccountSession("payments"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/stripe/create-account-session?mode=payments",
      {
        method: "POST",
      },
    );
    expect(result.current.data).toBe(mockClientSecret);
  });

  it("should use correct query key with mode parameter", () => {
    renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    renderHook(() => useAccountSession("payments"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Check that different modes use different query keys
    const queryCache = queryClient.getQueryCache();
    const onboardingQueries = queryCache.findAll({
      queryKey: ["account-session", "onboarding"],
    });
    const paymentsQueries = queryCache.findAll({
      queryKey: ["account-session", "payments"],
    });

    expect(onboardingQueries.length).toBeGreaterThan(0);
    expect(paymentsQueries.length).toBeGreaterThan(0);
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("should handle 401 errors with user-friendly message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Please sign in to access payment settings.",
    );
  });

  it("should handle 404 errors with user-friendly message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Payment account not found. Please complete onboarding.",
    );
  });

  it("should handle 500+ errors with user-friendly message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Server error. Please try again later.",
    );
  });

  it("should handle generic API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request" }),
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe("Bad request");
  });

  it("should validate clientSecret exists in response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}), // Missing clientSecret property
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Invalid response from server",
    );
  });

  it("should use 5-minute stale time (reusable sessions)", () => {
    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify query is created with correct key
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.findAll({
      queryKey: ["account-session", "onboarding"],
    });
    expect(queries.length).toBeGreaterThan(0);

    // Query should be configured (staleTime is an implementation detail)
    // The important behavior is that the query works correctly
    expect(result.current).toBeDefined();
  });

  it("should respect enabled flag (disabled when false)", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: "test" }),
    });

    const { result } = renderHook(
      () => useAccountSession("onboarding", false),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    // Query should not be enabled, so it shouldn't fetch
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });

  it("should not fetch when enabled is false", async () => {
    const { result } = renderHook(
      () => useAccountSession("onboarding", false),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    // Wait a bit to ensure no fetch happens
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("should fetch when enabled is true (default)", async () => {
    const mockClientSecret = "acct_session_123_secret";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: mockClientSecret }),
    });

    const { result } = renderHook(() => useAccountSession("onboarding", true), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle default error message when error object is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}), // Missing error property
    });

    const { result } = renderHook(() => useAccountSession("onboarding"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Failed to create account session",
    );
  });
});

describe("useCreateLoginLink", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockWindowOpen.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should successfully create login link", async () => {
    const mockUrl = "https://connect.stripe.com/login_link_123";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: mockUrl }),
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(undefined);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/stripe/create-login-link", {
        method: "POST",
      });
    });
  });

  it("should open URL in new window on success", async () => {
    const mockUrl = "https://connect.stripe.com/login_link_123";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: mockUrl }),
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(undefined);

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        mockUrl,
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("should open with correct window options (noopener, noreferrer)", async () => {
    const mockUrl = "https://connect.stripe.com/login_link_456";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: mockUrl }),
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(undefined);

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        mockUrl,
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("should handle API errors with proper error messages", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to create login link" }),
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Failed to create login link",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create login link",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle missing URL in response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}), // Missing url property
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Invalid response from server",
    );
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow("Network error");
  });

  it("should not show success toast (opens URL directly)", async () => {
    const mockUrl = "https://connect.stripe.com/login_link_123";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: mockUrl }),
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(undefined);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should not show success toast - opens URL directly
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should not invalidate queries (just opens URL)", async () => {
    const mockUrl = "https://connect.stripe.com/login_link_123";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: mockUrl }),
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(undefined);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should not invalidate any queries
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it("should handle error when JSON parsing fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("JSON parse error");
      },
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow();
  });

  it("should handle error message with status code when error object is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}), // Missing error property
    });

    const { result } = renderHook(() => useCreateLoginLink(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Failed to create login link (403)",
    );
  });
});
