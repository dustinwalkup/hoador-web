import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  useCreateNeed,
  useUpdateNeed,
  useCloseNeed,
  useDeleteNeed,
} from "../use-needs-mutations";
import { needsKeys } from "../use-needs";

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

const NEED_RESPONSE = { id: "need-1", title: "Need a drill", status: "open" };

// =============================================================================
// useCreateNeed
// =============================================================================

describe("useCreateNeed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("POSTs to /api/needs and invalidates feed on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => NEED_RESPONSE,
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      title: "Need a drill",
      description: "Any brand",
      type: "rental",
      categoryId: "cat-1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/needs",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.feed(),
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Validation failed" }),
    });

    const { result } = renderHook(() => useCreateNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({
        title: "Need a drill",
        description: "Any brand",
        type: "rental",
        categoryId: "cat-1",
      }),
    ).rejects.toThrow("Validation failed");
  });
});

// =============================================================================
// useUpdateNeed
// =============================================================================

describe("useUpdateNeed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("PATCHes /api/needs/[id] and invalidates feed + detail on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => NEED_RESPONSE,
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync({
      id: "need-1",
      input: { title: "Updated title" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/needs/need-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.feed(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.detail("need-1"),
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useUpdateNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(
      result.current.mutateAsync({ id: "need-1", input: { title: "x" } }),
    ).rejects.toThrow("Not found");
  });
});

// =============================================================================
// useCloseNeed
// =============================================================================

describe("useCloseNeed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("POSTs to /api/needs/[id]/close and invalidates feed + detail on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...NEED_RESPONSE, status: "closed_fulfilled" }),
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCloseNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("need-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/needs/need-1/close",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.feed(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.detail("need-1"),
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Already closed" }),
    });

    const { result } = renderHook(() => useCloseNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("need-1")).rejects.toThrow(
      "Already closed",
    );
  });
});

// =============================================================================
// useDeleteNeed
// =============================================================================

describe("useDeleteNeed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("DELETEs /api/needs/[id], invalidates feed, and removes detail on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const removeSpy = vi.spyOn(queryClient, "removeQueries");

    const { result } = renderHook(() => useDeleteNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await result.current.mutateAsync("need-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/needs/need-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.feed(),
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: needsKeys.detail("need-1"),
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    });

    const { result } = renderHook(() => useDeleteNeed(), {
      wrapper: ({ children }) => (
        <QueryWrapper queryClient={queryClient}>{children}</QueryWrapper>
      ),
    });

    await expect(result.current.mutateAsync("need-1")).rejects.toThrow(
      "Forbidden",
    );
  });
});
