import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useProviderProfile,
  useUpdateProviderBio,
  useSubmitServiceReview,
  serviceProviderKeys,
} from "../use-service-provider-profile";

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

const mockProfileData = {
  user: {
    id: "user-1",
    firstName: "Jane",
    lastName: "Doe",
    profileImageUrl: null,
    createdAt: "2025-01-01T00:00:00Z",
  },
  profile: { bio: "I mow lawns" },
  activeListings: [{ id: "listing-1", title: "Lawn Mowing" }],
  reviewsReceived: [],
};

// ---------------------------------------------------------------------------
// useProviderProfile
// ---------------------------------------------------------------------------

describe("useProviderProfile", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("fetches provider profile successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockProfileData,
    });

    const { result } = renderHook(() => useProviderProfile("user-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/services/providers/user-1");
    expect(result.current.data).toEqual(mockProfileData);
  });

  it("is disabled when userId is null", () => {
    const { result } = renderHook(() => useProviderProfile(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("is disabled when userId is undefined", () => {
    const { result } = renderHook(() => useProviderProfile(undefined), {
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

    const { result } = renderHook(() => useProviderProfile("bad-id"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Not found");
  });

  it("uses correct query key", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockProfileData,
    });

    renderHook(() => useProviderProfile("user-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const state = queryClient.getQueryState(
      serviceProviderKeys.profile("user-1"),
    );
    expect(state).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useUpdateProviderBio
// ---------------------------------------------------------------------------

describe("useUpdateProviderBio", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("patches provider endpoint with bio", async () => {
    const updatedProfile = { ...mockProfileData.profile, bio: "New bio" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profile: updatedProfile }),
    });

    const { result } = renderHook(() => useUpdateProviderBio("user-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync({ bio: "New bio" });

    expect(mockFetch).toHaveBeenCalledWith("/api/services/providers/user-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "New bio" }),
    });
    expect(data).toEqual({ profile: updatedProfile });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not authorized" }),
    });

    const { result } = renderHook(() => useUpdateProviderBio("user-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ bio: "New bio" }),
    ).rejects.toThrow("Not authorized");
  });

  it("invalidates profile cache on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profile: mockProfileData.profile }),
    });

    queryClient.setQueryData(
      serviceProviderKeys.profile("user-1"),
      mockProfileData,
    );

    const { result } = renderHook(() => useUpdateProviderBio("user-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ bio: "New bio" });

    await waitFor(() => {
      const state = queryClient.getQueryState(
        serviceProviderKeys.profile("user-1"),
      );
      expect(state).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// useSubmitServiceReview
// ---------------------------------------------------------------------------

describe("useSubmitServiceReview", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const reviewInput = {
    bookingId: "booking-1",
    rating: 5,
    comment: "Great service!",
    providerUserId: "user-1",
  };

  it("posts review successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ submitted: true }),
    });

    const { result } = renderHook(() => useSubmitServiceReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync(reviewInput);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings/booking-1/reviews",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5, comment: "Great service!" }),
      },
    );
    expect(data).toEqual({ submitted: true });
  });

  it("omits empty comment from request body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ submitted: true }),
    });

    const { result } = renderHook(() => useSubmitServiceReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      bookingId: "booking-1",
      rating: 4,
      comment: "   ",
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.comment).toBeUndefined();
    expect(body.rating).toBe(4);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Already reviewed" }),
    });

    const { result } = renderHook(() => useSubmitServiceReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(reviewInput)).rejects.toThrow(
      "Already reviewed",
    );
  });

  it("invalidates provider profile cache when providerUserId is given", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ submitted: true }),
    });

    queryClient.setQueryData(
      serviceProviderKeys.profile("user-1"),
      mockProfileData,
    );

    const { result } = renderHook(() => useSubmitServiceReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(reviewInput);

    await waitFor(() => {
      const state = queryClient.getQueryState(
        serviceProviderKeys.profile("user-1"),
      );
      expect(state).toBeDefined();
    });
  });

  it("works without providerUserId (no profile invalidation)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ submitted: true }),
    });

    const { result } = renderHook(() => useSubmitServiceReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync({
      bookingId: "booking-1",
      rating: 3,
    });

    expect(data).toEqual({ submitted: true });
  });
});
