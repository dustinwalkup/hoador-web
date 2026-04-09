import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useServiceBookings,
  useServiceBooking,
  useCreateServiceBooking,
  useAcceptServiceBooking,
  useDeclineServiceBooking,
  useCompleteServiceBooking,
  useCancelServiceBooking,
  serviceBookingsKeys,
} from "../use-service-bookings";

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
// useServiceBookings
// ---------------------------------------------------------------------------

describe("useServiceBookings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockBookings = [
    { id: "booking-1", status: "pending" },
    { id: "booking-2", status: "accepted" },
  ];

  it("fetches bookings as requester successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bookings: mockBookings }),
    });

    const { result } = renderHook(() => useServiceBookings("requester"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings?role=requester",
    );
    expect(result.current.data).toEqual(mockBookings);
  });

  it("fetches bookings as provider successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bookings: mockBookings }),
    });

    const { result } = renderHook(() => useServiceBookings("provider"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings?role=provider",
    );
  });

  it("is disabled when role is null", () => {
    const { result } = renderHook(() => useServiceBookings(null), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array when response has no bookings key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useServiceBookings("requester"), {
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

    const { result } = renderHook(() => useServiceBookings("requester"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("uses correct query key for requester", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bookings: [] }),
    });

    renderHook(() => useServiceBookings("requester"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const state = queryClient.getQueryState(
      serviceBookingsKeys.list("requester"),
    );
    expect(state).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useServiceBooking
// ---------------------------------------------------------------------------

describe("useServiceBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockBooking = { id: "booking-1", status: "accepted" };

  it("fetches booking detail successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBooking,
    });

    const { result } = renderHook(() => useServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/services/bookings/booking-1");
    expect(result.current.data).toEqual(mockBooking);
  });

  it("is disabled when bookingId is null", () => {
    const { result } = renderHook(() => useServiceBooking(null), {
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

    const { result } = renderHook(() => useServiceBooking("bad-id"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Not found");
  });
});

// ---------------------------------------------------------------------------
// useCreateServiceBooking
// ---------------------------------------------------------------------------

describe("useCreateServiceBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const input = {
    listingId: "listing-1",
    proposedDate: "2026-04-01",
    proposedTime: "10:00",
    serviceAgreementAccepted: true,
    cancellationRefundAcknowledged: true,
    safetyLiabilityAccepted: true,
    paymentPayoutAccepted: true,
    platformTermsAccepted: true,
  };

  it("posts booking and returns bookingId + status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bookingId: "booking-1", status: "pending" }),
    });

    const { result } = renderHook(() => useCreateServiceBooking(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync(input);

    expect(mockFetch).toHaveBeenCalledWith("/api/services/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(data).toEqual({ bookingId: "booking-1", status: "pending" });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Listing not available" }),
    });

    const { result } = renderHook(() => useCreateServiceBooking(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(input)).rejects.toThrow(
      "Listing not available",
    );
  });
});

// ---------------------------------------------------------------------------
// useAcceptServiceBooking
// ---------------------------------------------------------------------------

describe("useAcceptServiceBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("posts to accept endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "accepted" }),
    });

    const { result } = renderHook(() => useAcceptServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const data = await result.current.mutateAsync();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings/booking-1/accept",
      { method: "POST" },
    );
    expect(data).toEqual({ status: "accepted" });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot accept" }),
    });

    const { result } = renderHook(() => useAcceptServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow("Cannot accept");
  });
});

// ---------------------------------------------------------------------------
// useDeclineServiceBooking
// ---------------------------------------------------------------------------

describe("useDeclineServiceBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("posts to decline endpoint with reason", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "declined" }),
    });

    const { result } = renderHook(() => useDeclineServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ reason: "Not available" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings/booking-1/decline",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Not available" }),
      },
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot decline" }),
    });

    const { result } = renderHook(() => useDeclineServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ reason: "test" }),
    ).rejects.toThrow("Cannot decline");
  });
});

// ---------------------------------------------------------------------------
// useCompleteServiceBooking
// ---------------------------------------------------------------------------

describe("useCompleteServiceBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("posts to complete endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "completed" }),
    });

    const { result } = renderHook(
      () => useCompleteServiceBooking("booking-1"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    const data = await result.current.mutateAsync();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings/booking-1/complete",
      { method: "POST" },
    );
    expect(data).toEqual({ status: "completed" });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Already completed" }),
    });

    const { result } = renderHook(
      () => useCompleteServiceBooking("booking-1"),
      {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      },
    );

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Already completed",
    );
  });
});

// ---------------------------------------------------------------------------
// useCancelServiceBooking
// ---------------------------------------------------------------------------

describe("useCancelServiceBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("posts to cancel endpoint with optional reason", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "cancelled" }),
    });

    const { result } = renderHook(() => useCancelServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ reason: "Changed my mind" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings/booking-1/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Changed my mind" }),
      },
    );
  });

  it("sends empty body when called without variables", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "cancelled" }),
    });

    const { result } = renderHook(() => useCancelServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({});

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/bookings/booking-1/cancel",
      expect.objectContaining({ body: JSON.stringify({}) }),
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot cancel" }),
    });

    const { result } = renderHook(() => useCancelServiceBooking("booking-1"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync({})).rejects.toThrow(
      "Cannot cancel",
    );
  });
});
