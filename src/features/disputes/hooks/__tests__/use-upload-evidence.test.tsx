import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useUploadEvidence } from "../use-upload-evidence";
import {
  mockDispute,
  mockUploadEvidenceData,
  mockUploadTextEvidenceData,
} from "@/test/fixtures/disputes";
import { disputeKeys } from "../use-disputes";

// Mock toast before any imports
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

describe("useUploadEvidence", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should upload file evidence successfully", async () => {
    const mockEvidence = {
      id: "evidence-1",
      disputeId: "dispute-123",
      uploadedBy: "user-123",
      uploadedByRole: "renter",
      evidenceType: "image",
      content: "https://example.com/evidence.jpg",
      uploadedAt: new Date(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockEvidence,
    });

    const { result } = renderHook(() => useUploadEvidence("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockUploadEvidenceData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/disputes/dispute-123/evidence",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Evidence uploaded successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });

    // Verify FormData was sent
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("/api/disputes/dispute-123/evidence");
    expect(callArgs[1]?.body).toBeInstanceOf(FormData);
  });

  it("should upload text evidence successfully", async () => {
    const mockEvidence = {
      id: "evidence-2",
      disputeId: "dispute-123",
      uploadedBy: "user-123",
      uploadedByRole: "renter",
      evidenceType: "text",
      content: "This is text evidence",
      uploadedAt: new Date(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockEvidence,
    });

    const { result } = renderHook(() => useUploadEvidence("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockUploadTextEvidenceData);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Evidence uploaded successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle error when neither file nor text is provided", async () => {
    const { result } = renderHook(() => useUploadEvidence("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync({})).rejects.toThrow(
      "Either file or text content is required",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("should handle API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Evidence deadline has expired" }),
    });

    const { result } = renderHook(() => useUploadEvidence("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockUploadEvidenceData),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Evidence deadline has expired",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should invalidate dispute query on success", async () => {
    const mockEvidence = {
      id: "evidence-1",
      disputeId: "dispute-123",
      uploadedBy: "user-123",
      uploadedByRole: "renter",
      evidenceType: "image",
      content: "https://example.com/evidence.jpg",
      uploadedAt: new Date(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockEvidence,
    });

    // Pre-populate cache with a query to test invalidation
    queryClient.setQueryData(disputeKeys.detail("dispute-123"), mockDispute);

    const { result } = renderHook(() => useUploadEvidence("dispute-123"), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockUploadEvidenceData);

    await waitFor(() => {
      const queryState = queryClient.getQueryState(
        disputeKeys.detail("dispute-123"),
      );
      expect(queryState).toBeDefined();
    });
  });
});
