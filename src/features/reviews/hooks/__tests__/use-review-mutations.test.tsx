import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useCreateReview } from "../use-review-mutations";
import type { ReviewFormData } from "../../schemas/review-schema";

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

describe("useCreateReview", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockReviewDataWithRentalId: ReviewFormData = {
    rentalId: "rental-123",
    rating: 5,
    comment: "Great tool, worked perfectly for my project!",
    accuracyRating: 5,
    listingConditionRating: 4,
    ownerCommunicationRating: 5,
  };

  const mockReviewDataWithRequestId: ReviewFormData = {
    requestId: "request-456",
    rating: 4,
    comment: "Good experience overall, would rent again.",
  };

  const mockSuccessResponse = {
    success: true,
    reviewId: "review-789",
  };

  it("should create review successfully with rentalId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRentalId);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockReviewDataWithRentalId),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Review submitted successfully!",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should create review successfully with requestId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRequestId);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockReviewDataWithRequestId),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Review submitted successfully!",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should create review with only required fields", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const minimalReviewData: ReviewFormData = {
      rentalId: "rental-123",
      rating: 3,
      comment: "It was okay, nothing special.",
    };

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(minimalReviewData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(minimalReviewData),
      });
    });
  });

  it("should invalidate reviews and rental-details queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRentalId);

    await waitFor(() => {
      // Should invalidate reviews queries
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["reviews"],
      });
      // Should invalidate rental-details queries
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rental-details"],
      });
    });
  });

  it("should invalidate specific rental query when rentalId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRentalId);

    await waitFor(() => {
      // Should invalidate specific rental query
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rental-details", "rental-123"],
      });
    });
  });

  it("should invalidate specific rental query when requestId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRequestId);

    await waitFor(() => {
      // Should invalidate specific rental query using requestId
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rental-details", "request-456"],
      });
    });
  });

  it("should invalidate completed rentals queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRentalId);

    await waitFor(() => {
      // Should invalidate completed rentals pages
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "completed"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Review already exists for this rental" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockReviewDataWithRentalId),
    ).rejects.toThrow("Review already exists for this rental");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Review already exists for this rental",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle validation errors", async () => {
    const errorResponse = { error: "Comment must be at least 10 characters" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockReviewDataWithRentalId),
    ).rejects.toThrow("Comment must be at least 10 characters");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Comment must be at least 10 characters",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockReviewDataWithRentalId),
    ).rejects.toThrow("Network error");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Network error",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle API errors without error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}), // Empty error response
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockReviewDataWithRentalId),
    ).rejects.toThrow("Failed to create review");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create review",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate(mockReviewDataWithRentalId);

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  it("should handle all optional rating fields", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const reviewDataWithAllRatings: ReviewFormData = {
      rentalId: "rental-123",
      rating: 5,
      comment: "Excellent experience with all aspects!",
      accuracyRating: 5,
      listingConditionRating: 5,
      ownerCommunicationRating: 5,
    };

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(reviewDataWithAllRatings);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewDataWithAllRatings),
      });
    });
  });

  it("should handle partial optional rating fields", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const reviewDataWithPartialRatings: ReviewFormData = {
      rentalId: "rental-123",
      rating: 4,
      comment: "Good experience overall.",
      accuracyRating: 4,
      // listingConditionRating and ownerCommunicationRating are undefined
    };

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(reviewDataWithPartialRatings);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewDataWithPartialRatings),
      });
    });
  });

  it("should not invalidate specific rental query when neither rentalId nor requestId is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    // This shouldn't happen in practice due to schema validation,
    // but we test the hook's behavior
    const reviewDataWithoutIds = {
      rating: 5,
      comment: "Test review",
    } as ReviewFormData;

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    // This will fail schema validation, but we're testing the hook logic
    try {
      await result.current.mutateAsync(reviewDataWithoutIds);
    } catch {
      // Expected to fail
    }

    await waitFor(() => {
      // Should still invalidate general queries
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["reviews"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rental-details"],
      });
      // But should not invalidate specific rental query
      const calls = invalidateQueriesSpy.mock.calls;
      const specificRentalCalls = calls.filter(
        (call) =>
          Array.isArray(call[0]?.queryKey) &&
          call[0]?.queryKey.length === 2 &&
          call[0]?.queryKey[0] === "rental-details",
      );
      expect(specificRentalCalls.length).toBe(0);
    });
  });

  it("should return success state after successful mutation", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockReviewDataWithRentalId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });
  });

  it("should return error state after failed mutation", async () => {
    const errorResponse = { error: "Unauthorized" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useCreateReview(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    try {
      await result.current.mutateAsync(mockReviewDataWithRentalId);
    } catch {
      // Expected to throw
    }

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });
  });
});
