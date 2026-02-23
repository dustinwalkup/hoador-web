import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminUsers } from "../use-admin-users";

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

const mockUsersResponse = {
  data: [
    {
      id: "user-1",
      name: "User One",
      email: "one@example.com",
      status: "active",
      userType: "standard",
      createdAt: "2024-01-15T00:00:00.000Z",
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

describe("useAdminUsers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch users with default params (recently signed up)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users?page=1&limit=20");
    expect(result.current.data).toEqual(mockUsersResponse);
  });

  it("should include search in URL when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    const { result } = renderHook(
      () => useAdminUsers({ search: "john", page: 1 }),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/users?page=1&limit=20&search=john",
    );
  });

  it("should include status and userType in URL when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    const { result } = renderHook(
      () =>
        useAdminUsers({
          status: "active",
          userType: "standard",
          page: 2,
          limit: 10,
        }),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
    expect(url).toContain("status=active");
    expect(url).toContain("userType=standard");
  });

  it("should not add search to URL when search is empty string", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    renderHook(() => useAdminUsers({ search: "" }), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).not.toContain("search=");
  });

  it("should trim search before adding to params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    renderHook(() => useAdminUsers({ search: "  jane  " }), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users?page=1&limit=20&search=jane",
      );
    });
  });

  it("should use correct query key with all params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    renderHook(
      () =>
        useAdminUsers({
          search: "test",
          status: "suspended",
          userType: "admin",
          page: 3,
          limit: 15,
        }),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const cached = queryClient.getQueryData([
      "admin",
      "users",
      "test",
      "suspended",
      "admin",
      3,
      15,
      "", // inactiveDays
      "", // sortBy
    ]);
    expect(cached).toEqual(mockUsersResponse);
  });

  it("should handle API errors correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Admin access required" }),
    });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Admin access required",
    );
  });

  it("should use default error message when API error is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe(
      "Failed to fetch users",
    );
  });

  it("should return loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("should default to page 1 and limit 20 when not provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    renderHook(() => useAdminUsers({}), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users?page=1&limit=20",
      );
    });
  });
});
