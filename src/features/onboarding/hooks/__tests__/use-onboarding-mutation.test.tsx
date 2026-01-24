import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCompleteOnboarding } from "../use-onboarding-mutation";
import type { OnboardingData } from "../../schemas/validation";

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
    warning: vi.fn(),
  },
}));

import { toast } from "sonner";

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

describe("useCompleteOnboarding", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const mockOnboardingData: OnboardingData = {
    firstName: "John",
    lastName: "Doe",
    phone: "5551234567",
    bio: "Test bio",
    profileImageUrl: "https://example.com/image.jpg",
    address: {
      street: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
    },
    agreeToTerms: true,
  };

  const mockSuccessResponse = {
    success: true,
    redirect: "/dashboard",
    data: {
      user: {
        id: "user-123",
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
      },
    },
  };

  it("should complete onboarding successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockOnboardingData);

    await waitFor(() => {
      // Verify fetch was called with correct FormData
      expect(mockFetch).toHaveBeenCalledWith("/api/onboarding", {
        method: "POST",
        body: expect.any(FormData),
      });

      // Verify success toast was shown
      expect(toast.success).toHaveBeenCalledWith(
        "Profile completed successfully",
      );

      // Verify redirect was called
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should handle FormData conversion correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockOnboardingData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;

      // Verify FormData contains all fields
      expect(formData.get("firstName")).toBe("John");
      expect(formData.get("lastName")).toBe("Doe");
      expect(formData.get("phone")).toBe("5551234567");
      expect(formData.get("bio")).toBe("Test bio");
      expect(formData.get("profileImageUrl")).toBe(
        "https://example.com/image.jpg",
      );
      expect(formData.get("street")).toBe("123 Main St");
      expect(formData.get("city")).toBe("San Francisco");
      expect(formData.get("state")).toBe("CA");
      expect(formData.get("zipCode")).toBe("94102");
      expect(formData.get("agreeToTerms")).toBe("true");
    });
  });

  it("should handle optional fields correctly", async () => {
    const dataWithoutOptional: OnboardingData = {
      firstName: "Jane",
      lastName: "Smith",
      phone: "5559876543",
      address: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90001",
      },
      agreeToTerms: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(dataWithoutOptional);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;

      // Optional fields should not be in FormData if not provided
      expect(formData.get("bio")).toBeNull();
      expect(formData.get("profileImageUrl")).toBeNull();
    });
  });

  it("should invalidate user and profile queries on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockOnboardingData);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["user"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["profile"],
      });
    });
  });

  it("should show warning toast when warning is present in response", async () => {
    const responseWithWarning = {
      success: true,
      redirect: "/dashboard",
      warning:
        "Profile updated, but address update failed. You can update it later.",
      data: {
        user: {
          id: "user-123",
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
        },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => responseWithWarning,
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockOnboardingData);

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith("Profile Updated", {
        description: responseWithWarning.warning,
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

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockOnboardingData),
    ).rejects.toThrow("Validation failed");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to complete onboarding",
        {
          description: "Validation failed",
        },
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockOnboardingData),
    ).rejects.toThrow("Network error");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to complete onboarding",
        {
          description: "Network error",
        },
      );
    });
  });

  it("should handle API errors without error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockOnboardingData),
    ).rejects.toThrow("Failed to complete onboarding");

    await waitFor(() => {
      // When error.error is undefined, the error message becomes "Failed to complete onboarding"
      // which is then used as the description
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to complete onboarding",
        {
          description: "Failed to complete onboarding",
        },
      );
    });
  });

  it("should not redirect if redirect URL is not provided", async () => {
    const responseWithoutRedirect = {
      success: true,
      data: {
        user: {
          id: "user-123",
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
        },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => responseWithoutRedirect,
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(mockOnboardingData);

    await waitFor(() => {
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  it("should show pending state during mutation", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    result.current.mutate(mockOnboardingData);

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  it("should handle empty bio and profileImageUrl correctly", async () => {
    const dataWithEmptyOptionals: OnboardingData = {
      firstName: "Jane",
      lastName: "Smith",
      phone: "5559876543",
      bio: "",
      profileImageUrl: "",
      address: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90001",
      },
      agreeToTerms: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(dataWithEmptyOptionals);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;

      // Empty strings are not added to FormData (only added if truthy)
      expect(formData.get("bio")).toBeNull();
      expect(formData.get("profileImageUrl")).toBeNull();
    });
  });

  it("should handle error with default message when error message is missing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCompleteOnboarding(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync(mockOnboardingData),
    ).rejects.toThrow();

    await waitFor(() => {
      // When error.error is undefined, the error message becomes "Failed to complete onboarding"
      // which is then used as the description (error.message || "Please try again")
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to complete onboarding",
        {
          description: "Failed to complete onboarding",
        },
      );
    });
  });
});
