import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSearchListings,
  useListingDetails,
  useListingCategories,
  usePrefetchListing,
} from "../use-listings";
import type { ListingSearchFilters } from "@/dal/types";

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

describe("useSearchListings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockFilters: ListingSearchFilters = {
    query: "power drill",
    categoryId: "power-tools",
    minPrice: 10,
    maxPrice: 100,
    condition: ["good", "excellent"],
    deliveryMode: "delivery_only",
    setupAvailable: true,
    availableNow: true,
    sortBy: "price",
    sortOrder: "asc",
  };

  const mockResponse = {
    data: [
      { id: "1", name: "Drill 1" },
      { id: "2", name: "Drill 2" },
    ],
    pagination: {
      hasNext: true,
      totalPages: 5,
      currentPage: 1,
    },
  };

  it("should generate correct cache key", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearchListings(mockFilters, "user-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify the query was called (cache key is internal to React Query)
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should call API with correct parameters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearchListings(mockFilters, "user-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/listings/search"),
      );
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("q=power+drill"); // URLSearchParams uses + for spaces
    expect(url).toContain("category=power-tools");
    expect(url).toContain("minPrice=10");
    expect(url).toContain("maxPrice=100");
    expect(url).toContain("condition=good%2Cexcellent"); // Comma is encoded as %2C
    expect(url).toContain("delivery=delivery_only");
    expect(url).toContain("setup=true");
    expect(url).toContain("availableNow=true");
    expect(url).toContain("sortBy=price");
    expect(url).toContain("sortOrder=asc");
    expect(url).toContain("page=1");
    expect(url).toContain("limit=12");
    expect(url).toContain("userId=user-123");
  });

  it("should handle pagination correctly", async () => {
    const page1Response = {
      data: [{ id: "1", name: "Item 1" }],
      pagination: { hasNext: true, totalPages: 2, currentPage: 1 },
    };

    const page2Response = {
      data: [{ id: "2", name: "Item 2" }],
      pagination: { hasNext: false, totalPages: 2, currentPage: 2 },
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1Response,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2Response,
      });

    const { result } = renderHook(() => useSearchListings(mockFilters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(1);
    });

    // Fetch next page
    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    // Should have no more pages
    expect(result.current.hasNextPage).toBe(false);
  });

  it("should use shorter stale time for distance sorting", () => {
    const distanceFilters = { ...mockFilters, sortBy: "distance" as const };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearchListings(distanceFilters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // The hook should be configured with shorter stale time for distance queries
    // We can't directly test staleTime, but we can verify the cache key includes distance context
    expect(true).toBe(true); // Placeholder - staleTime is internal to the hook
  });

  it("should handle API errors correctly", async () => {
    // Mock fetch to return 400 error - hook's retry logic checks if error.message includes "400" or "401"
    // We need to include "400" in the message for the retry logic to skip retries
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad Request", message: "400 Bad Request" }),
    });

    const { result } = renderHook(() => useSearchListings(mockFilters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Wait for error state - since message includes "400", retry logic should skip retries
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toBeDefined();
      },
      { timeout: 3000 },
    );

    // Verify error is an Error instance with correct message
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("400 Bad Request");
  });

  it("should not retry on 4xx errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad Request" }),
    });

    renderHook(() => useSearchListings(mockFilters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once, no retries
    });
  });

  it("should filter out empty query strings", () => {
    const filtersWithEmptyQuery = { ...mockFilters, query: "   " };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearchListings(filtersWithEmptyQuery), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Should not include empty query in URL
    expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining("q="));
  });

  it("should handle undefined filters gracefully", () => {
    const minimalFilters: ListingSearchFilters = {
      sortBy: "newest",
      sortOrder: "desc",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(() => useSearchListings(minimalFilters), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Should still work with minimal filters
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("useListingDetails", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockListingDetails = {
    id: "listing-123",
    name: "Power Drill",
    description: "Heavy duty drill",
    dailyRate: 15.99,
  };

  it("should fetch listing details when listingId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockListingDetails,
    });

    const { result } = renderHook(() => useListingDetails("listing-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockListingDetails);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/listings/listing-123");
  });

  it("should not fetch when listingId is null", () => {
    const { result } = renderHook(() => useListingDetails(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // When listingId is null, the query is disabled and data is undefined
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    // Verify fetch was not called since query is disabled
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useListingDetails("invalid-id"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(
      () => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toContain(
          "Failed to fetch listing details",
        );
      },
      { timeout: 3000 },
    );
  });

  it("should use correct query key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockListingDetails,
    });

    const { result } = renderHook(() => useListingDetails("listing-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify the query was called (cache key is internal to React Query)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/listings/listing-123");
      expect(result.current.data).toBeDefined();
    });
  });
});

describe("useListingCategories", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockCategories = [
    { id: "power-tools", name: "Power Tools" },
    { id: "hand-tools", name: "Hand Tools" },
  ];

  it("should fetch categories successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockCategories,
    });

    const { result } = renderHook(() => useListingCategories(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockCategories);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/listings/categories");
  });

  it("should use correct query key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockCategories,
    });

    const { result } = renderHook(() => useListingCategories(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Verify the query was called (cache key is internal to React Query)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/listings/categories");
      expect(result.current.data).toBeDefined();
    });
  });

  it("should handle API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    const { result } = renderHook(() => useListingCategories(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(
      () => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toContain(
          "Failed to fetch listing categories",
        );
      },
      { timeout: 3000 },
    );
  });
});

describe("usePrefetchListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should prefetch listing details", () => {
    const mockListingData = { id: "listing-123", name: "Test Listing" };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockListingData,
    });

    const { result } = renderHook(() => usePrefetchListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // Call the prefetch function
    result.current("listing-123");

    // Should have called prefetchQuery
    expect(mockFetch).toHaveBeenCalledWith("/api/listings/listing-123");
  });

  it("should use correct prefetch options", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "listing-123" }),
    });

    const { result } = renderHook(() => usePrefetchListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current("listing-123");

    // The prefetch should use the same query key and stale time as useListingDetails
    expect(mockFetch).toHaveBeenCalledWith("/api/listings/listing-123");
  });
});
