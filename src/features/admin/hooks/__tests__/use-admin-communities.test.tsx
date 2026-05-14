import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAdminCommunities,
  useAdminNetworks,
  useCreateCommunity,
  useUpdateCommunity,
} from "../use-admin-communities";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

describe("use-admin-communities", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => queryClient.clear());

  it("useAdminCommunities requests with includeStats", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], pagination: {} }),
    });
    renderHook(() => useAdminCommunities(), { wrapper: wrapper(queryClient) });
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/communities?page=1&limit=25&includeStats=true",
      ),
    );
  });

  it("useAdminNetworks hits the networks endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    renderHook(() => useAdminNetworks(), { wrapper: wrapper(queryClient) });
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/networks"),
    );
  });

  it("useCreateCommunity POSTs JSON", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "c1" }) });
    const { result } = renderHook(() => useCreateCommunity(), {
      wrapper: wrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({
        name: "Foxcroft",
        isActive: true,
        networkId: null,
      });
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Foxcroft",
        isActive: true,
        networkId: null,
      }),
    });
  });

  it("useUpdateCommunity PATCHes by id", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "c1" }) });
    const { result } = renderHook(() => useUpdateCommunity(), {
      wrapper: wrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({
        id: "c1",
        values: { isActive: false },
      });
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/communities/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
  });
});
