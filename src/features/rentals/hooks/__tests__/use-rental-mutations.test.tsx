import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Create mockRouter object for testing
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

// Mock next/navigation before any imports
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Mock toast before any imports
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Now import the hooks and toast
import {
  useCreateRentalRequest,
  useApproveRentalRequest,
  useDeclineRentalRequest,
  useCancelRentalRequest,
  useStartRental,
  useEndRental,
  useUpdateRentalInstructions,
} from "../use-rental-mutations";
import type { CreateRentalRequestFormData } from "../../lib/form-schema";
import { toast } from "sonner";

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

describe("useCreateRentalRequest", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockRentalData: CreateRentalRequestFormData = {
    listingId: "listing-123",
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-01-20"),
    deliveryRequested: false,
    setupRequested: false,
    setupFee: 0,
    paymentMethodId: "pm_test_123",
    rentalAgreementAccepted: true,
    safetyLiabilityPackageAccepted: true,
    paymentPayoutAccepted: true,
  };

  const mockSuccessResponse = {
    success: true,
    requestId: "rental-123",
    message:
      "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
  };

  it("should create rental request successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockRentalData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"listingId":"listing-123"'),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should convert Date objects to ISO strings", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockRentalData);

    await waitFor(() => {
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.startDate).toBe(mockRentalData.startDate.toISOString());
      expect(callBody.endDate).toBe(mockRentalData.endDate.toISOString());
    });
  });

  it("returns requestId on success (caller handles redirect and push prompt)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCreateRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync(mockRentalData);

    expect(data.requestId).toBe("rental-123");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("should invalidate rental queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockRentalData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals"],
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

    const { result } = renderHook(() => useCreateRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockRentalData)).rejects.toThrow(
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

    const { result } = renderHook(() => useCreateRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockRentalData)).rejects.toThrow(
      "Network error",
    );
  });
});

describe("useApproveRentalRequest", () => {
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
    paymentIntentId: "pi_123",
    securityDepositAuthId: "auth_123",
  };

  it("should approve rental request successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useApproveRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      pickupInstructions: "Pick up at front door",
      returnInstructions: "Return to same location",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/rental-123/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupInstructions: "Pick up at front door",
            returnInstructions: "Return to same location",
          }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Request approved successfully! Payment has been processed.",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle optional instructions", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useApproveRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/rental-123/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupInstructions: undefined,
            returnInstructions: undefined,
          }),
        },
      );
    });
  });

  it("should invalidate rental detail query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useApproveRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "detail", "rental-123"],
      });
    });
  });

  it("should handle payment failures correctly", async () => {
    const errorResponse = {
      error: "Payment failed: Insufficient funds",
      paymentFailed: true,
    };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useApproveRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    try {
      await result.current.mutateAsync({
        rentalId: "rental-123",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Payment failed: Insufficient funds",
      );
      expect((error as Error & { paymentFailed?: boolean }).paymentFailed).toBe(
        true,
      );
    }
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Rental request not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useApproveRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        rentalId: "invalid-id",
      }),
    ).rejects.toThrow("Rental request not found");
  });
});

describe("useDeclineRentalRequest", () => {
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
  };

  it("should decline rental request successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useDeclineRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      denialReason: "Not available on requested dates",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/rental-123/decline",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            denialReason: "Not available on requested dates",
          }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Rental request declined",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate rental detail query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeclineRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      denialReason: "Not available",
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "detail", "rental-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Rental request not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useDeclineRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        rentalId: "invalid-id",
        denialReason: "Test reason",
      }),
    ).rejects.toThrow("Rental request not found");
  });
});

describe("useCancelRentalRequest", () => {
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
  };

  it("should cancel rental request successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCancelRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      reason: "Change of plans",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/rental-123/cancel",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Change of plans" }),
        }),
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Rental cancelled successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate rental detail query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCancelRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      reason: "Need to cancel",
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "detail", "rental-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Cannot cancel this rental" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useCancelRentalRequest(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        rentalId: "rental-123",
        reason: "Change of plans",
      }),
    ).rejects.toThrow("Cannot cancel this rental");
  });
});

describe("useStartRental", () => {
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
  };

  it("should start rental successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useStartRental(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("rental-123");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/rentals/rental-123/start", {
        method: "POST",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Rental started successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate rental detail query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useStartRental(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("rental-123");

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "detail", "rental-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Cannot start rental yet" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useStartRental(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("rental-123")).rejects.toThrow(
      "Cannot start rental yet",
    );
  });
});

describe("useEndRental", () => {
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
  };

  it("should end rental successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useEndRental(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("rental-123");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/rentals/rental-123/end", {
        method: "POST",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Rental ended successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate rental detail query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useEndRental(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("rental-123");

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "detail", "rental-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Rental not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useEndRental(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("rental-123")).rejects.toThrow(
      "Rental not found",
    );
  });
});

describe("useUpdateRentalInstructions", () => {
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
  };

  it("should update instructions successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUpdateRentalInstructions(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      pickupInstructions: "New pickup instructions",
      returnInstructions: "New return instructions",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/rental-123/instructions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupInstructions: "New pickup instructions",
            returnInstructions: "New return instructions",
          }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Instructions updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle optional instructions", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUpdateRentalInstructions(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      pickupInstructions: "Only pickup",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/rental-123/instructions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupInstructions: "Only pickup",
            returnInstructions: undefined,
          }),
        },
      );
    });
  });

  it("should invalidate rental detail query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateRentalInstructions(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      rentalId: "rental-123",
      pickupInstructions: "Test",
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["rentals", "detail", "rental-123"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Rental not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateRentalInstructions(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        rentalId: "invalid-id",
        pickupInstructions: "Test",
      }),
    ).rejects.toThrow("Rental not found");
  });
});
