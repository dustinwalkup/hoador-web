import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  handleMutationError,
  handleMutationSuccess,
  invalidateQueries,
  useCreateMutation,
  createMutationFactory,
} from "../mutation-helpers";

// Mock toast notifications
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

describe("mutation-helpers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("handleMutationError", () => {
    it("should show error toast with error message", () => {
      const error = new Error("Something went wrong");
      handleMutationError(error);

      expect(toast.error).toHaveBeenCalledWith("Something went wrong", {
        duration: 5000,
      });
    });

    it("should use default message for unknown errors", () => {
      const error = { unknown: "error" };
      handleMutationError(error);

      expect(toast.error).toHaveBeenCalledWith("An error occurred", {
        duration: 5000,
      });
    });

    it("should use custom default message", () => {
      const error = { unknown: "error" };
      handleMutationError(error, "Custom error message");

      expect(toast.error).toHaveBeenCalledWith("Custom error message", {
        duration: 5000,
      });
    });
  });

  describe("handleMutationSuccess", () => {
    it("should show success toast with message", () => {
      handleMutationSuccess("Operation completed successfully");

      expect(toast.success).toHaveBeenCalledWith(
        "Operation completed successfully",
        {
          duration: 3000,
        },
      );
    });
  });

  describe("invalidateQueries", () => {
    it("should invalidate queries", async () => {
      // Set up some query data
      queryClient.setQueryData(["test", "data"], { value: "test" });

      invalidateQueries(queryClient, ["test", "data"]);

      await waitFor(() => {
        expect(queryClient.getQueryData(["test", "data"])).toBeUndefined();
      });
    });

    it("should show success message when provided", () => {
      queryClient.setQueryData(["test", "data"], { value: "test" });

      invalidateQueries(queryClient, ["test", "data"], "Cache invalidated");

      expect(toast.success).toHaveBeenCalledWith("Cache invalidated", {
        duration: 3000,
      });
    });

    it("should not show success message when not provided", () => {
      queryClient.setQueryData(["test", "data"], { value: "test" });

      invalidateQueries(queryClient, ["test", "data"]);

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("useCreateMutation", () => {
    it("should create mutation with success handling", async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });

      const { result } = renderHook(
        () =>
          useCreateMutation({
            mutationFn: mockMutationFn,
            successMessage: "Created successfully",
            invalidateQueryKeys: [["test"]],
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(mockMutationFn).toHaveBeenCalledWith(
        { name: "Test" },
        expect.objectContaining({
          client: expect.any(Object),
        }),
      );
      expect(toast.success).toHaveBeenCalledWith("Created successfully", {
        duration: 3000,
      });
    });

    it("should create mutation with error handling", async () => {
      const mockMutationFn = vi
        .fn()
        .mockRejectedValue(new Error("Creation failed"));

      const { result } = renderHook(
        () =>
          useCreateMutation({
            mutationFn: mockMutationFn,
            errorMessage: "Failed to create",
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to create", {
        duration: 5000,
      });
    });

    it("should invalidate multiple query keys", async () => {
      queryClient.setQueryData(["listings"], []);
      queryClient.setQueryData(["garage"], []);

      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });

      const { result } = renderHook(
        () =>
          useCreateMutation({
            mutationFn: mockMutationFn,
            invalidateQueryKeys: [["listings"], ["garage"]],
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(["listings"])).toBeUndefined();
        expect(queryClient.getQueryData(["garage"])).toBeUndefined();
      });
    });

    it("should call custom onSuccess callback", async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });
      const onSuccess = vi.fn();

      const { result } = renderHook(
        () =>
          useCreateMutation({
            mutationFn: mockMutationFn,
            onSuccess,
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(onSuccess).toHaveBeenCalledWith(
        { id: "123" },
        { name: "Test" },
      );
    });

    it("should call custom onError callback", async () => {
      const mockMutationFn = vi
        .fn()
        .mockRejectedValue(new Error("Creation failed"));
      const onError = vi.fn();

      const { result } = renderHook(
        () =>
          useCreateMutation({
            mutationFn: mockMutationFn,
            onError,
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(onError).toHaveBeenCalled();
    });

    it("should use error message from error object when no custom message", async () => {
      const mockMutationFn = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(
        () =>
          useCreateMutation({
            mutationFn: mockMutationFn,
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith("Network error", {
        duration: 5000,
      });
    });
  });

  describe("createMutationFactory", () => {
    it("should create reusable mutation hook", async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });

      const useCreateResource = createMutationFactory({
        mutationFn: mockMutationFn,
        invalidateQueryKeys: [["resources"]],
        defaultSuccessMessage: "Resource created",
      });

      const { result } = renderHook(() => useCreateResource(), {
        wrapper: ({ children }) => (
          <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
        ),
      });

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(mockMutationFn).toHaveBeenCalledWith(
        { name: "Test" },
        expect.objectContaining({
          client: expect.any(Object),
        }),
      );
      expect(toast.success).toHaveBeenCalledWith("Resource created", {
        duration: 3000,
      });
    });

    it("should allow overriding success message", async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });

      const useCreateResource = createMutationFactory({
        mutationFn: mockMutationFn,
        defaultSuccessMessage: "Resource created",
      });

      const { result } = renderHook(
        () =>
          useCreateResource({
            successMessage: "Custom success message",
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(toast.success).toHaveBeenCalledWith("Custom success message", {
        duration: 3000,
      });
    });

    it("should allow overriding error message", async () => {
      const mockMutationFn = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const useCreateResource = createMutationFactory({
        mutationFn: mockMutationFn,
        defaultErrorMessage: "Default error",
      });

      const { result } = renderHook(
        () =>
          useCreateResource({
            errorMessage: "Custom error message",
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith("Custom error message", {
        duration: 5000,
      });
    });

    it("should invalidate additional query keys", async () => {
      queryClient.setQueryData(["resources"], []);
      queryClient.setQueryData(["additional"], []);

      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });

      const useCreateResource = createMutationFactory({
        mutationFn: mockMutationFn,
        invalidateQueryKeys: [["resources"]],
      });

      const { result } = renderHook(
        () =>
          useCreateResource({
            additionalInvalidateKeys: [["additional"]],
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(["resources"])).toBeUndefined();
        expect(queryClient.getQueryData(["additional"])).toBeUndefined();
      });
    });

    it("should call custom onSuccess callback", async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ id: "123" });
      const onSuccess = vi.fn();

      const useCreateResource = createMutationFactory({
        mutationFn: mockMutationFn,
      });

      const { result } = renderHook(
        () =>
          useCreateResource({
            onSuccess,
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        await result.current.mutateAsync({ name: "Test" });
      });

      expect(onSuccess).toHaveBeenCalledWith(
        { id: "123" },
        { name: "Test" },
      );
    });

    it("should call custom onError callback", async () => {
      const mockMutationFn = vi
        .fn()
        .mockRejectedValue(new Error("Creation failed"));
      const onError = vi.fn();

      const useCreateResource = createMutationFactory({
        mutationFn: mockMutationFn,
      });

      const { result } = renderHook(
        () =>
          useCreateResource({
            onError,
          }),
        {
          wrapper: ({ children }) => (
            <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
          ),
        },
      );

      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "Test" });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(onError).toHaveBeenCalled();
    });
  });
});
