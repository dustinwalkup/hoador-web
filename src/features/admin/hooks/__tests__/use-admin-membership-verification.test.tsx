import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAdminPendingVerifications,
  useVerifyMembership,
  useDenyMembership,
} from "../use-admin-mutations";

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

describe("useAdminPendingVerifications", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => queryClient.clear());

  it("fetches the queue with pagination params", async () => {
    const payload = {
      data: [{ membership: { id: "m1" } }],
      pagination: {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => payload });

    const { result } = renderHook(() => useAdminPendingVerifications(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/community-memberships/pending?page=1&limit=25",
    );
    expect(result.current.data).toEqual(payload);
  });

  it("includes communityId when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], pagination: {} }),
    });

    renderHook(() => useAdminPendingVerifications({ communityId: "c-1" }), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/community-memberships/pending?page=1&limit=25&communityId=c-1",
      ),
    );
  });
});

describe("useVerifyMembership", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => queryClient.clear());

  it("POSTs to the verify endpoint and toasts success", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "m1" }) });

    const { result } = renderHook(() => useVerifyMembership(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        membershipId: "m1",
        adminNotes: "looks good",
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/community-memberships/m1/verify",
      { method: "POST", body: expect.any(FormData) },
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Membership verified",
        expect.objectContaining({ duration: 3000 }),
      ),
    );
  });

  it("surfaces API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Membership not found" }),
    });

    const { result } = renderHook(() => useVerifyMembership(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ membershipId: "missing" });
      } catch {
        // expected
      }
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Membership not found",
        expect.objectContaining({ duration: 5000 }),
      ),
    );
  });
});

describe("useDenyMembership", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });
  afterEach(() => queryClient.clear());

  it("POSTs notes to the deny endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "m1" }) });

    const { result } = renderHook(() => useDenyMembership(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        membershipId: "m1",
        adminNotes: "address out of bounds",
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/community-memberships/m1/deny",
      { method: "POST", body: expect.any(FormData) },
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Membership denied",
        expect.objectContaining({ duration: 3000 }),
      ),
    );
  });

  it("surfaces the required-notes error from the API", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "adminNotes is required when denying a membership.",
      }),
    });

    const { result } = renderHook(() => useDenyMembership(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          membershipId: "m1",
          adminNotes: "",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "adminNotes is required when denying a membership.",
        expect.objectContaining({ duration: 5000 }),
      ),
    );
  });
});
