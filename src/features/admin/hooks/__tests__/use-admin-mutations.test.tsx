import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import {
  useApproveListing,
  useRejectListing,
  useDeleteDocumentVersion,
  useUpdateAdminUser,
} from "../use-admin-mutations";

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

describe("useApproveListing", () => {
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

  it("should approve listing successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("listing-123");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/listings/listing-123/approve",
        {
          method: "POST",
        },
      );
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should invalidate admin queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("listing-123");

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "pending-reviews"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "review-history"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "pending-review-count"],
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

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("invalid-id")).rejects.toThrow(
      "Listing not found",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Listing not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle default error message when API error is missing", async () => {
    const errorResponse = {};
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("listing-123")).rejects.toThrow(
      "Failed to approve listing",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to approve listing",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("listing-123")).rejects.toThrow(
      "Network error",
    );
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate("listing-123");

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  it("should not show success toast (customized in component)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useApproveListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("listing-123");

    await waitFor(() => {
      // Should not show success toast (customized in component)
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});

describe("useRejectListing", () => {
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

  it("should reject listing successfully with FormData", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      rejectionReason: "This listing violates our community guidelines.",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/listings/listing-123/reject",
        expect.objectContaining({
          method: "POST",
        }),
      );

      // Verify FormData was sent
      const call = mockFetch.mock.calls[0];
      expect(call[1].body).toBeInstanceOf(FormData);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should include rejection reason in FormData", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const rejectionReason = "This listing violates our community guidelines.";
    await result.current.mutateAsync({
      listingId: "listing-123",
      rejectionReason,
    });

    await waitFor(() => {
      const call = mockFetch.mock.calls[0];
      const formData = call[1].body as FormData;
      expect(formData.get("rejectionReason")).toBe(rejectionReason);
    });
  });

  it("should invalidate admin queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      rejectionReason: "Invalid content",
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "pending-reviews"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "review-history"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "pending-review-count"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Rejection reason is required" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-123",
        rejectionReason: "",
      }),
    ).rejects.toThrow("Rejection reason is required");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Rejection reason is required",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle default error message when API error is missing", async () => {
    const errorResponse = {};
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-123",
        rejectionReason: "Invalid content",
      }),
    ).rejects.toThrow("Failed to reject listing");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to reject listing",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-123",
        rejectionReason: "Invalid content",
      }),
    ).rejects.toThrow("Network error");
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate({
      listingId: "listing-123",
      rejectionReason: "Invalid content",
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  it("should not show success toast (customized in component)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useRejectListing(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      listingId: "listing-123",
      rejectionReason: "Invalid content",
    });

    await waitFor(() => {
      // Should not show success toast (customized in component)
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});

describe("useDeleteDocumentVersion", () => {
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

  it("should delete document version successfully with blobPathname", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      documentId: "terms-of-service",
      version: "1.0",
      blobPathname: "legal-documents/terms-of-service/123-1.0.pdf",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/legal-documents/terms-of-service/1.0",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      // Verify FormData was sent with blobPathname
      const call = mockFetch.mock.calls[0];
      expect(call[1].body).toBeInstanceOf(FormData);
      const formData = call[1].body as FormData;
      expect(formData.get("blobPathname")).toBe(
        "legal-documents/terms-of-service/123-1.0.pdf",
      );
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should delete document version successfully without blobPathname", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      documentId: "terms-of-service",
      version: "1.0",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/legal-documents/terms-of-service/1.0",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      // Verify FormData was sent without blobPathname
      const call = mockFetch.mock.calls[0];
      expect(call[1].body).toBeInstanceOf(FormData);
      const formData = call[1].body as FormData;
      expect(formData.get("blobPathname")).toBeNull();
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should invalidate admin legal-documents query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      documentId: "terms-of-service",
      version: "1.0",
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "legal-documents"],
      });
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Version not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        documentId: "terms-of-service",
        version: "invalid-version",
      }),
    ).rejects.toThrow("Version not found");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Version not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle default error message when API error is missing", async () => {
    const errorResponse = {};
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        documentId: "terms-of-service",
        version: "1.0",
      }),
    ).rejects.toThrow("Failed to delete version");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to delete version",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        documentId: "terms-of-service",
        version: "1.0",
      }),
    ).rejects.toThrow("Network error");
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate({
      documentId: "terms-of-service",
      version: "1.0",
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  it("should not show success toast (customized in component)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useDeleteDocumentVersion(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      documentId: "terms-of-service",
      version: "1.0",
    });

    await waitFor(() => {
      // Should not show success toast (customized in component)
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  it("should handle all valid document IDs", async () => {
    const documentIds = [
      "terms-of-service",
      "privacy-policy",
      "rental-agreement",
      "community-guidelines",
    ];

    for (const documentId of documentIds) {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useDeleteDocumentVersion(), {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      });

      await result.current.mutateAsync({
        documentId,
        version: "1.0",
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/admin/legal-documents/${documentId}/1.0`,
          expect.objectContaining({
            method: "DELETE",
          }),
        );
      });

      vi.clearAllMocks();
    }
  });
});

describe("useUpdateAdminUser", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockUserResponse = {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    status: "active",
    userType: "standard",
  };

  it("should update user status successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserResponse,
    });

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      userId: "user-123",
      status: "suspended",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-123",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body).toEqual({ status: "suspended" });
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should update user type successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockUserResponse, userType: "admin" }),
    });

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      userId: "user-123",
      userType: "admin",
    });

    await waitFor(() => {
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body).toEqual({ userType: "admin" });
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should send both status and userType when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserResponse,
    });

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      userId: "user-456",
      status: "active",
      userType: "standard",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-456",
        expect.any(Object),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body).toEqual({ status: "active", userType: "standard" });
    });
  });

  it("should invalidate admin users and user queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ userId: "user-123", status: "active" });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "users"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "user"],
      });
    });
  });

  it("should show success toast on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUserResponse,
    });

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({ userId: "user-123", status: "active" });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "User updated",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Only superadmin can set admin role" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        userId: "user-123",
        userType: "admin",
      }),
    ).rejects.toThrow("Only superadmin can set admin role");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Only superadmin can set admin role",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle default error message when API error is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ userId: "user-123", status: "active" }),
    ).rejects.toThrow("Failed to update user");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update user",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ userId: "user-123", status: "active" }),
    ).rejects.toThrow("Network error");
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useUpdateAdminUser(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate({ userId: "user-123", status: "active" });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    resolvePromise!({
      ok: true,
      json: async () => mockUserResponse,
    });
  });
});
