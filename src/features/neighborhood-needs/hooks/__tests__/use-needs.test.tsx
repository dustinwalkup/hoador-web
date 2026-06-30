import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useNeedsFeed, useNeed, needsKeys } from "../use-needs";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
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

const FEED_RESPONSE = {
  data: [{ id: "need-1", title: "Need a drill", linkedListingCount: 0 }],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

const DETAIL_RESPONSE = {
  id: "need-1",
  title: "Need a drill",
  linkedListings: [],
};

// =============================================================================
// needsKeys
// =============================================================================

describe("needsKeys", () => {
  it("feed key contains 'needs' and 'feed'", () => {
    expect(needsKeys.feed()).toEqual(["needs", "feed"]);
  });

  it("feedWithFilters appends filters", () => {
    const filters = { type: "rental" as const };
    expect(needsKeys.feedWithFilters(filters)).toEqual([
      "needs",
      "feed",
      filters,
    ]);
  });

  it("detail key contains 'needs', 'detail', and id", () => {
    expect(needsKeys.detail("need-1")).toEqual(["needs", "detail", "need-1"]);
  });
});

// =============================================================================
// useNeedsFeed
// =============================================================================

describe("useNeedsFeed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("fetches /api/needs and returns paginated data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => FEED_RESPONSE,
    });

    const { result } = renderHook(() => useNeedsFeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/needs");
    expect(result.current.data?.data[0].id).toBe("need-1");
  });

  it("appends type filter to query string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => FEED_RESPONSE,
    });

    const { result } = renderHook(() => useNeedsFeed({ type: "rental" }), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("type=rental"),
    );
  });

  it("appends openOnly=false when explicitly set", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => FEED_RESPONSE,
    });

    const { result } = renderHook(() => useNeedsFeed({ openOnly: false }), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("openOnly=false"),
    );
  });

  it("is disabled when enabled=false is passed", () => {
    const { result } = renderHook(() => useNeedsFeed({}, { enabled: false }), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useNeedsFeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Unauthorized");
  });
});

// =============================================================================
// useNeed
// =============================================================================

describe("useNeed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("fetches /api/needs/[id] and returns detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => DETAIL_RESPONSE,
    });

    const { result } = renderHook(() => useNeed("need-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/needs/need-1");
    expect(result.current.data?.id).toBe("need-1");
  });

  it("is disabled when id is null", () => {
    const { result } = renderHook(() => useNeed(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws on 404 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useNeed("missing"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Not found");
  });
});
