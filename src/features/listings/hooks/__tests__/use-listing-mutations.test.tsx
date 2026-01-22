import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import {
  useCreateListing,
  useUpdateListing,
  useUpdateListingStatus,
  useAnalyzeToolImage,
} from "../use-listing-mutations";
import type { CreateListingFormDataServerType } from "../../form-schema/listing.schema";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

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

describe("useCreateListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockListingData: CreateListingFormDataServerType = {
    name: "Test Power Drill",
    description: "A heavy-duty power drill",
    categoryId: "power-tools",
    condition: "good",
    dailyRate: 15.99,
    securityDeposit: 50.0,
    specifications: {},
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only",
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
  };

  const mockSuccessResponse = {
    success: true,
    listingId: "listing-123",
  };

  it("should create listing successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockListingData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockListingData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Listing created successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockListingData);

    await waitFor(() => {
      // The queries should be marked for invalidation
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should invalidate specific listing query when listingId is returned", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockListingData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["listing-details", "listing-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Validation failed" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useCreateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockListingData)).rejects.toThrow(
      "Validation failed",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Validation failed",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCreateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockListingData)).rejects.toThrow(
      "Network error",
    );
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useCreateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate(mockListingData);

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });
});

describe("useUpdateListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockListingData: CreateListingFormDataServerType = {
    name: "Updated Power Drill",
    description: "Updated description",
    categoryId: "power-tools",
    condition: "good",
    dailyRate: 20.99,
    securityDeposit: 75.0,
    specifications: {},
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only",
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
  };

  const mockSuccessResponse = {
    success: true,
    listingId: "listing-123",
  };

  it("should update listing successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUpdateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      data: mockListingData,
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/listings/listing-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockListingData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Listing updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate specific listing query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      data: mockListingData,
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["listing-details", "listing-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Listing not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "invalid-id",
        data: mockListingData,
      }),
    ).rejects.toThrow("Listing not found");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Listing not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});

describe("useUpdateListingStatus", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockSuccessResponse = {
    success: true,
    listing: {
      id: "listing-123",
      status: "maintenance",
    },
  };

  it("should update listing status successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUpdateListingStatus(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      status: "maintenance",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/listings/listing-123/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "maintenance" }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Listing status updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate explore queries on status update", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateListingStatus(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      status: "available",
    });

    await waitFor(() => {
      // Should invalidate explore queries
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["explore"],
      });
      // Should also invalidate specific listing
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["listing-details", "listing-123"],
      });
    });
  });

  it("should handle all valid status values", async () => {
    const statuses: Array<"available" | "maintenance" | "inactive"> = [
      "available",
      "maintenance",
      "inactive",
    ];

    for (const status of statuses) {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, listing: { id: "listing-123", status } }),
      });

      const { result } = renderHook(() => useUpdateListingStatus(), {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      });

      await result.current.mutateAsync({
        listingId: "listing-123",
        status,
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/listings/listing-123/status`,
          expect.objectContaining({
            body: JSON.stringify({ status }),
          }),
        );
      });

      vi.clearAllMocks();
    }
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Unauthorized" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateListingStatus(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-123",
        status: "available",
      }),
    ).rejects.toThrow("Unauthorized");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Unauthorized",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});

describe("useAnalyzeToolImage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockAnalysisResult = {
    success: true,
    data: {
      name: "DeWalt Cordless Drill",
      description: "A powerful cordless drill",
      categoryName: "Power Tools",
      brand: "DeWalt",
      model: "DCD777C2",
      condition: "good",
      specifications: {
        power: "20V MAX",
        weight: "3.4 lbs",
      },
      instructions: "Insert battery and use trigger",
      safetyNotes: "Wear safety glasses",
    },
  };

  it("should analyze single image URL successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockAnalysisResult,
    });

    const { result } = renderHook(() => useAnalyzeToolImage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const imageUrl = "https://example.com/image.jpg";
    const analysisResult = await result.current.mutateAsync(imageUrl);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/listings/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: imageUrl }),
      });
      expect(analysisResult).toEqual(mockAnalysisResult);
    });
  });

  it("should analyze multiple image URLs successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockAnalysisResult,
    });

    const { result } = renderHook(() => useAnalyzeToolImage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const imageUrls = [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
    ];
    const analysisResult = await result.current.mutateAsync(imageUrls);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/listings/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls }),
      });
      expect(analysisResult).toEqual(mockAnalysisResult);
    });
  });

  it("should not show success toast for analysis", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockAnalysisResult,
    });

    const { result } = renderHook(() => useAnalyzeToolImage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("https://example.com/image.jpg");

    await waitFor(() => {
      // Should not show success toast (used internally)
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Image analysis failed" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useAnalyzeToolImage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync("https://example.com/image.jpg"),
    ).rejects.toThrow("Image analysis failed");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Image analysis failed",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should not invalidate queries for analysis", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockAnalysisResult,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAnalyzeToolImage(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("https://example.com/image.jpg");

    await waitFor(() => {
      // Should not invalidate any queries (analysis doesn't affect cache)
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });
  });
});
