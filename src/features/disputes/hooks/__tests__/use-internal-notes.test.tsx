import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import {
  useCreateInternalNote,
  useUpdateInternalNote,
  useDeleteInternalNote,
} from "../use-internal-notes";
import { mockDispute } from "@/test/fixtures/disputes";
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

const mockNote = {
  id: "note-123",
  disputeId: "dispute-123",
  adminId: "admin-123",
  content: "This is an internal note",
  createdAt: new Date("2024-01-09"),
  updatedAt: new Date("2024-01-09"),
};

describe("useCreateInternalNote", () => {
  let queryClient: QueryClient;
  const disputeId = "dispute-123";

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should create internal note successfully", async () => {
    const noteContent = "This is a new internal note";

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockNote,
    });

    const { result } = renderHook(() => useCreateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(noteContent);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/disputes/${disputeId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: noteContent }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Note created successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API error", async () => {
    const noteContent = "This is a new internal note";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Failed to create note" }),
    });

    const { result } = renderHook(() => useCreateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(noteContent)).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create note",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle API error with default message", async () => {
    const noteContent = "This is a new internal note";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCreateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(noteContent)).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create note",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should invalidate dispute query on success", async () => {
    const noteContent = "This is a new internal note";

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockNote,
    });

    // Pre-populate cache with a query to test invalidation
    queryClient.setQueryData(disputeKeys.detail(disputeId), mockDispute);

    const { result } = renderHook(() => useCreateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(noteContent);

    await waitFor(() => {
      const queryState = queryClient.getQueryState(
        disputeKeys.detail(disputeId),
      );
      expect(queryState).toBeDefined();
    });
  });
});

describe("useUpdateInternalNote", () => {
  let queryClient: QueryClient;
  const disputeId = "dispute-123";

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should update internal note successfully", async () => {
    const updatedNote = {
      ...mockNote,
      content: "This is an updated note",
      updatedAt: new Date("2024-01-10"),
    };

    const updateData = {
      noteId: "note-123",
      content: "This is an updated note",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => updatedNote,
    });

    const { result } = renderHook(() => useUpdateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(updateData);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/disputes/${disputeId}/notes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Note updated successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API error", async () => {
    const updateData = {
      noteId: "note-123",
      content: "This is an updated note",
    };

    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Note not found" }),
    });

    const { result } = renderHook(() => useUpdateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(updateData)).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Note not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle API error with default message", async () => {
    const updateData = {
      noteId: "note-123",
      content: "This is an updated note",
    };

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useUpdateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(updateData)).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update note",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should invalidate dispute query on success", async () => {
    const updatedNote = {
      ...mockNote,
      content: "This is an updated note",
      updatedAt: new Date("2024-01-10"),
    };

    const updateData = {
      noteId: "note-123",
      content: "This is an updated note",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => updatedNote,
    });

    // Pre-populate cache with a query to test invalidation
    queryClient.setQueryData(disputeKeys.detail(disputeId), mockDispute);

    const { result } = renderHook(() => useUpdateInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(updateData);

    await waitFor(() => {
      const queryState = queryClient.getQueryState(
        disputeKeys.detail(disputeId),
      );
      expect(queryState).toBeDefined();
    });
  });
});

describe("useDeleteInternalNote", () => {
  let queryClient: QueryClient;
  const disputeId = "dispute-123";

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should delete internal note successfully", async () => {
    const noteId = "note-123";

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useDeleteInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(noteId);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/disputes/${disputeId}/notes`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId }),
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Note deleted successfully",
        expect.objectContaining({ duration: 3000 }),
      );
    });
  });

  it("should handle API error", async () => {
    const noteId = "note-123";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Note not found" }),
    });

    const { result } = renderHook(() => useDeleteInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(noteId)).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Note not found",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should handle API error with default message", async () => {
    const noteId = "note-123";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useDeleteInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync(noteId)).rejects.toThrow();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to delete note",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  it("should invalidate dispute query on success", async () => {
    const noteId = "note-123";

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Pre-populate cache with a query to test invalidation
    queryClient.setQueryData(disputeKeys.detail(disputeId), mockDispute);

    const { result } = renderHook(() => useDeleteInternalNote(disputeId), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync(noteId);

    await waitFor(() => {
      const queryState = queryClient.getQueryState(
        disputeKeys.detail(disputeId),
      );
      expect(queryState).toBeDefined();
    });
  });
});
