import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useServiceListings,
  useServiceListing,
  useCreateServiceListing,
  useEditServiceListing,
  useMyServiceListings,
  useMyDeniedServiceListingsCount,
  useMyPendingServiceListingsCount,
  useReactivateServiceListing,
  useDeactivateServiceListing,
  serviceListingsKeys,
  myServiceListingsKeys,
} from "../use-service-listings";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

// ---------------------------------------------------------------------------
// useServiceListings
// ---------------------------------------------------------------------------

describe("useServiceListings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockListings = [
    { id: "listing-1", title: "Lawn Mowing" },
    { id: "listing-2", title: "Dog Walking" },
  ];

  it("fetches listings for a community successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: mockListings }),
    });

    const { result } = renderHook(() => useServiceListings("community-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/services/listings?");
    expect(result.current.data).toEqual(mockListings);
  });

  it("includes categoryId filter in request when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: mockListings }),
    });

    const { result } = renderHook(
      () => useServiceListings("community-1", { categoryId: "cat-1" }),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("categoryId=cat-1"),
    );
  });

  it("is disabled when communityId is null", () => {
    const { result } = renderHook(() => useServiceListings(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array when response has no listings key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useServiceListings("community-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    });

    const { result } = renderHook(() => useServiceListings("community-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Forbidden");
  });

  it("uses correct query key", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [] }),
    });

    renderHook(() => useServiceListings("community-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const state = queryClient.getQueryState(
      serviceListingsKeys.list("community-1"),
    );
    expect(state).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useServiceListing (single)
// ---------------------------------------------------------------------------

describe("useServiceListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockListing = { id: "listing-1", title: "Lawn Mowing" };

  it("fetches single listing successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockListing,
    });

    const { result } = renderHook(() => useServiceListing("listing-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/services/listings/listing-1");
    expect(result.current.data).toEqual(mockListing);
  });

  it("is disabled when listingId is null", () => {
    const { result } = renderHook(() => useServiceListing(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useServiceListing("bad-id"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Not found");
  });
});

// ---------------------------------------------------------------------------
// useCreateServiceListing
// ---------------------------------------------------------------------------

describe("useCreateServiceListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const input = {
    communityId: "community-1",
    categoryId: "cat-1",
    title: "Lawn Mowing",
    description: "Professional lawn care",
    pricingType: "fixed" as const,
    price: 50,
    ownerPoliciesAcknowledged: true,
  };

  it("posts to listings endpoint and returns listingId + status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        listingId: "listing-1",
        status: "pending_approval",
      }),
    });

    const { result } = renderHook(() => useCreateServiceListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync(input);

    expect(mockFetch).toHaveBeenCalledWith("/api/services/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(data).toEqual({
      listingId: "listing-1",
      status: "pending_approval",
    });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Validation failed" }),
    });

    const { result } = renderHook(() => useCreateServiceListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(input)).rejects.toThrow(
      "Validation failed",
    );
  });
});

// ---------------------------------------------------------------------------
// useEditServiceListing
// ---------------------------------------------------------------------------

describe("useEditServiceListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("patches listing endpoint with body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "listing-1", title: "Updated Title" }),
    });

    const { result } = renderHook(() => useEditServiceListing("listing-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ title: "Updated Title" });

    expect(mockFetch).toHaveBeenCalledWith("/api/services/listings/listing-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not authorized" }),
    });

    const { result } = renderHook(() => useEditServiceListing("listing-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync({ title: "x" })).rejects.toThrow(
      "Not authorized",
    );
  });
});

// ---------------------------------------------------------------------------
// useMyServiceListings
// ---------------------------------------------------------------------------

describe("useMyServiceListings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockListings = [{ id: "listing-1" }, { id: "listing-2" }];

  it("fetches own listings by status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: mockListings }),
    });

    const { result } = renderHook(() => useMyServiceListings("active"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/listings/my?status=active",
    );
    expect(result.current.data).toEqual(mockListings);
  });

  it("URL-encodes the status parameter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [] }),
    });

    const { result } = renderHook(
      () => useMyServiceListings("pending_approval"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/listings/my?status=pending_approval",
    );
  });

  it("returns empty array when response has no listings key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useMyServiceListings("active"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useMyServiceListings("active"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("uses correct query key", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [] }),
    });

    renderHook(() => useMyServiceListings("active"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const state = queryClient.getQueryState(
      myServiceListingsKeys.byStatus("active"),
    );
    expect(state).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useMyPendingServiceListingsCount
// ---------------------------------------------------------------------------

describe("useMyPendingServiceListingsCount", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns count of pending listings", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [{}, {}, {}] }),
    });

    const { result } = renderHook(() => useMyPendingServiceListingsCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3);
  });

  it("returns 0 when there are no pending listings", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [] }),
    });

    const { result } = renderHook(() => useMyPendingServiceListingsCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
  });

  it("enters error state on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useMyPendingServiceListingsCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useMyDeniedServiceListingsCount
// ---------------------------------------------------------------------------

describe("useMyDeniedServiceListingsCount", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns count of denied listings", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [{}, {}] }),
    });

    const { result } = renderHook(() => useMyDeniedServiceListingsCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(2);
  });

  it("returns 0 when there are no denied listings", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [] }),
    });

    const { result } = renderHook(() => useMyDeniedServiceListingsCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
  });

  it("enters error state on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useMyDeniedServiceListingsCount(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useReactivateServiceListing
// ---------------------------------------------------------------------------

describe("useReactivateServiceListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("posts to reactivate endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "active" }),
    });

    const { result } = renderHook(
      () => useReactivateServiceListing("listing-1"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    const data = await result.current.mutateAsync();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/listings/listing-1/reactivate",
      { method: "POST" },
    );
    expect(data).toEqual({ status: "active" });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot reactivate" }),
    });

    const { result } = renderHook(
      () => useReactivateServiceListing("listing-1"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Cannot reactivate",
    );
  });
});

// ---------------------------------------------------------------------------
// useDeactivateServiceListing
// ---------------------------------------------------------------------------

describe("useDeactivateServiceListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("posts to deactivate endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "inactive" }),
    });

    const { result } = renderHook(
      () => useDeactivateServiceListing("listing-1"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    const data = await result.current.mutateAsync();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/listings/listing-1/deactivate",
      { method: "POST" },
    );
    expect(data).toEqual({ status: "inactive" });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot deactivate" }),
    });

    const { result } = renderHook(
      () => useDeactivateServiceListing("listing-1"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Cannot deactivate",
    );
  });
});
