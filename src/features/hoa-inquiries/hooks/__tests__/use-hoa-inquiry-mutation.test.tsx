import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useHoaInquiryMutation } from "../use-hoa-inquiry-mutation";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

const validData = {
  hoaName: "Sunset Ridge HOA",
  city: "Austin",
  state: "TX",
  name: "John Doe",
  email: "john@example.com",
};

describe("useHoaInquiryMutation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should submit inquiry successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useHoaInquiryMutation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(validData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/hoa-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Your request has been submitted!",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Validation failed" }),
    });

    const { result } = renderHook(() => useHoaInquiryMutation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(validData)).rejects.toThrow(
      "Validation failed",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Validation failed",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should use fallback error message when none provided", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useHoaInquiryMutation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(validData)).rejects.toThrow(
      "Failed to submit request",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to submit request",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useHoaInquiryMutation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(validData)).rejects.toThrow(
      "Network error",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Network error",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should send optional fields when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const dataWithOptionals = {
      ...validData,
      phone: "5551234567",
      hoaContactName: "Jane Smith",
      hoaContactEmail: "jane@hoa.com",
      hoaContactPhone: "5559876543",
    };

    const { result } = renderHook(() => useHoaInquiryMutation(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(dataWithOptionals);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/hoa-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithOptionals),
      });
    });
  });
});
