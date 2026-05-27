import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useUpdateUserProfile } from "../use-profile-mutations";
import type { UpdateUserProfileData } from "../use-profile-mutations";

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

describe("useUpdateUserProfile", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockProfileData: UpdateUserProfileData = {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "5551234567",
    bio: "Test bio",
    address: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
    },
  };

  const mockSuccessResponse = {
    success: true,
  };

  it("should update profile successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockProfileData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockProfileData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Profile updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should invalidate the profile query on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockProfileData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["profile"],
      });
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should handle profile update with optional fields", async () => {
    const profileDataWithoutOptional: UpdateUserProfileData = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      address: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90001",
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(profileDataWithoutOptional);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileDataWithoutOptional),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Profile updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API errors correctly", async () => {
    const errorResponse = { error: "Validation failed" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockProfileData)).rejects.toThrow(
      "Validation failed",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Validation failed",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle API errors without error message", async () => {
    const errorResponse = {};
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockProfileData)).rejects.toThrow(
      "Failed to update profile",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update profile",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockProfileData)).rejects.toThrow(
      "Network error",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Network error",
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

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate(mockProfileData);

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  it("should handle 401 unauthorized errors", async () => {
    const errorResponse = { error: "Unauthorized" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockProfileData)).rejects.toThrow(
      "Unauthorized",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Unauthorized",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle 404 not found errors", async () => {
    const errorResponse = { error: "User not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(mockProfileData)).rejects.toThrow(
      "User not found",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "User not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should not invalidate queries on error", async () => {
    const errorResponse = { error: "Update failed" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    try {
      await result.current.mutateAsync(mockProfileData);
    } catch {
      // Expected to throw
    }

    await waitFor(() => {
      // Should not invalidate queries on error
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
      expect(result.current.isError).toBe(true);
    });
  });

  it("should return response data on success", async () => {
    const customResponse = {
      success: true,
      message: "Profile updated",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => customResponse,
    });

    const { result } = renderHook(() => useUpdateUserProfile(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    const response = await result.current.mutateAsync(mockProfileData);

    await waitFor(() => {
      expect(response).toEqual(customResponse);
      expect(result.current.data).toEqual(customResponse);
    });
  });
});
