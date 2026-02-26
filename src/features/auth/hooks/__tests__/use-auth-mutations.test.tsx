import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useSignup,
  useJoinCommunity,
  useResendVerification,
  useAcceptLegalDocuments,
  useForgotPassword,
  useResetPassword,
} from "../use-auth-mutations";

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

describe("useSignup", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should sign up successfully with all fields", async () => {
    const mockResponse = {
      success: true,
      redirect: "/verify-email",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useSignup(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        legalAccepted: true,
        tosAccepted: true,
        privacyAccepted: true,
      });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
        method: "POST",
        body: expect.any(FormData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Account created successfully! Please check your email to verify your account.",
        expect.objectContaining({ duration: 3000 }),
      );
      expect(mockRouter.push).toHaveBeenCalledWith("/verify-email");
    });
  });

  it("should sign up with minimal required fields", async () => {
    const mockResponse = {
      success: true,
      redirect: "/dashboard",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useSignup(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("should handle API errors", async () => {
    const errorResponse = { error: "Email already exists" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useSignup(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          email: "existing@example.com",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Email already exists",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSignup(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          email: "test@example.com",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("should use default error message when API error has no message", async () => {
    const errorResponse = {};
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useSignup(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          email: "test@example.com",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to sign up",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});

describe("useJoinCommunity", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should join community successfully", async () => {
    const mockResponse = {
      success: true,
      redirect: "/dashboard",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useJoinCommunity(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ joinCode: "ABC123" });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/join-community", {
        method: "POST",
        body: expect.any(FormData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Successfully joined community!",
        expect.objectContaining({ duration: 3000 }),
      );
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should handle invalid join code", async () => {
    const errorResponse = { error: "Invalid join code" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useJoinCommunity(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ joinCode: "INVALID" });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid join code",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should not redirect when response has no redirect URL", async () => {
    const mockResponse = {
      success: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useJoinCommunity(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ joinCode: "ABC123" });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});

describe("useResendVerification", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should resend verification email successfully", async () => {
    const mockResponse = {
      success: true,
      message: "Verification email sent",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useResendVerification(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ email: "test@example.com" });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/resend-verification", {
        method: "POST",
        body: expect.any(FormData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Verification email sent! Please check your inbox.",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle errors when resending verification", async () => {
    const errorResponse = { error: "Email not found" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useResendVerification(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ email: "notfound@example.com" });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Email not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should not redirect after resending verification", async () => {
    const mockResponse = {
      success: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useResendVerification(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ email: "test@example.com" });
    });

    await waitFor(() => {
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});

describe("useAcceptLegalDocuments", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should accept legal documents successfully", async () => {
    const mockResponse = {
      success: true,
      redirect: "/dashboard",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useAcceptLegalDocuments(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({
        tosAccepted: true,
        privacyAccepted: true,
      });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/accept-legal-documents",
        {
          method: "POST",
          body: expect.any(FormData),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Legal documents accepted successfully!",
        expect.objectContaining({ duration: 3000 }),
      );
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should handle errors when accepting legal documents", async () => {
    const errorResponse = { error: "Authentication required" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useAcceptLegalDocuments(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          tosAccepted: true,
          privacyAccepted: true,
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Authentication required",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});

describe("useForgotPassword", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should send password reset email successfully", async () => {
    const mockResponse = {
      success: true,
      message: "Password reset email sent",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ email: "test@example.com" });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/forgot-password", {
        method: "POST",
        body: expect.any(FormData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "If an account with that email exists, we've sent you a password reset link.",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle errors when sending password reset", async () => {
    const errorResponse = { error: "Rate limit exceeded" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ email: "test@example.com" });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Rate limit exceeded",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should not redirect after sending password reset", async () => {
    const mockResponse = {
      success: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({ email: "test@example.com" });
    });

    await waitFor(() => {
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});

describe("useResetPassword", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should reset password successfully", async () => {
    const mockResponse = {
      success: true,
      redirect: "/login",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({
        token: "reset-token-123",
        password: "newPassword123",
      });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/reset-password", {
        method: "POST",
        body: expect.any(FormData),
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Password reset successfully!",
        expect.objectContaining({ duration: 3000 }),
      );
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });
  });

  it("should handle invalid reset token", async () => {
    const errorResponse = { error: "Invalid or expired token" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          token: "invalid-token",
          password: "newPassword123",
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid or expired token",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle weak password", async () => {
    const errorResponse = { error: "Password does not meet requirements" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          token: "reset-token-123",
          password: "weak",
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Password does not meet requirements",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});
