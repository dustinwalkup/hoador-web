import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useVisibility,
  useUpdateVisibility,
  visibilityQueryKey,
} from "../use-visibility";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from "sonner";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useVisibility", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => queryClient.clear());

  it("fetches and returns the visibility list", async () => {
    const rows = [
      { community: { id: "c1", name: "Foxcroft" }, isVisible: true },
      { community: { id: "c2", name: "Timber Trace" }, isVisible: false },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => rows });

    const { result } = renderHook(() => useVisibility(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/users/me/visibility");
    expect(result.current.data).toEqual(rows);
  });

  it("throws the API error message on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    });

    const { result } = renderHook(() => useVisibility(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("nope"));
  });
});

describe("useUpdateVisibility", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => queryClient.clear());

  it("PATCHes the updates array as JSON and invalidates caches", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ updated: [] }),
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateVisibility(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync([
        { communityId: "c2", isVisible: true },
      ]);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/users/me/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ communityId: "c2", isVisible: true }],
      }),
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Visibility updated",
        expect.objectContaining({ duration: 3000 }),
      );
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: visibilityQueryKey,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["search-listings"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["service-listings"],
    });
  });

  it("surfaces the primary-locked error from the API", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Cannot hide your home community" }),
    });

    const { result } = renderHook(() => useUpdateVisibility(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync([
          { communityId: "primary", isVisible: false },
        ]);
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot hide your home community",
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });
});
