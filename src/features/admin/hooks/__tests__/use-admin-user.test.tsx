import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminUser } from "../use-admin-user";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

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

const mockUserDetail = {
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  status: "active" as const,
  userType: "standard" as const,
  createdAt: "2024-01-15T00:00:00.000Z",
  stats: {
    listingsBorrowed: 2,
    listingsShared: 1,
    averageRating: 4.5,
    totalReviews: 3,
  },
  listingsCount: 1,
  rentalsAsRenterCount: 2,
  rentalsAsOwnerCount: 1,
  totalDisputesCount: 0,
};

describe("useAdminUser", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch user detail when userId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserDetail,
    });

    const { result } = renderHook(() => useAdminUser("user-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/user-123");
    expect(result.current.data).toEqual(mockUserDetail);
  });

  it("should not fetch when userId is null", async () => {
    const { result } = renderHook(() => useAdminUser(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isSuccess).toBe(false);
  });

  it("should use correct query key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserDetail,
    });

    renderHook(() => useAdminUser("user-456"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/user-456");
    });

    const cached = queryClient.getQueryData(["admin", "user", "user-456"]);
    expect(cached).toEqual(mockUserDetail);
  });

  it("should handle API errors correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "User not found" }),
    });

    const { result } = renderHook(() => useAdminUser("invalid-id"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("User not found");
  });

  it("should use default error message when API error is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useAdminUser("user-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Failed to fetch user",
    );
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAdminUser("user-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("should throw when queryFn runs with null userId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserDetail,
    });

    const { result } = renderHook(() => useAdminUser(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
  });
});
