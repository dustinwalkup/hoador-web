import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AiDraft } from "@/features/listings/ai-listing-assistant/types";

import { useAnalyzeListingDraft } from "../use-analyze-listing-draft";

function fakeFile(name = "photo.jpg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

function validDraft(overrides: Partial<AiDraft> = {}): AiDraft {
  return {
    name: "DeWalt 20V Cordless Drill",
    description: "A solid cordless drill.",
    categoryId: "uuid-power-tools",
    brand: "DeWalt",
    model: "DCD777C2",
    condition: "good",
    specifications: { power: "20V MAX" },
    instructions: null,
    safetyNotes: null,
    ...overrides,
  };
}

function mockFetchResponse(opts: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  throwOnFetch?: boolean;
  throwOnJson?: boolean;
}) {
  const fetchMock = vi.fn();
  if (opts.throwOnFetch) {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
  } else {
    fetchMock.mockResolvedValueOnce({
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      json: opts.throwOnJson
        ? vi.fn().mockRejectedValueOnce(new Error("not json"))
        : vi.fn().mockResolvedValueOnce(opts.body),
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useAnalyzeListingDraft", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("happy path: invokes the route, calls onSuccess with the resolved AiDraft", async () => {
    const draft = validDraft();
    const fetchMock = mockFetchResponse({
      body: { success: true, data: draft },
    });
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess, onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/listings/analyze-image");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as { imageUrls: string[] };
    expect(body.imageUrls).toHaveLength(1);
    expect(body.imageUrls[0].startsWith("data:image/jpeg;base64,")).toBe(true);

    expect(onSuccess).toHaveBeenCalledWith(draft);
    expect(onFailure).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it("idempotency: second generate() after success is a no-op (Req 4.3)", async () => {
    const draft = validDraft();
    const fetchMock = mockFetchResponse({
      body: { success: true, data: draft },
    });
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess, onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Second call must not refetch.
    await act(async () => {
      await result.current.generate([fakeFile()]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("zero-files call is a defensive no-op", async () => {
    const fetchMock = mockFetchResponse({
      body: { success: true, data: null },
    });
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess, onFailure }),
    );

    await act(async () => {
      await result.current.generate([]);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("HTTP 429 → rate_limited", async () => {
    mockFetchResponse({
      ok: false,
      status: 429,
      body: { error: "rate_limited" },
    });
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onFailure).toHaveBeenCalledWith("rate_limited");
  });

  it("HTTP 4xx (non-429) → server", async () => {
    mockFetchResponse({
      ok: false,
      status: 400,
      body: { error: "Validation failed" },
    });
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onFailure).toHaveBeenCalledWith("server");
  });

  it("HTTP 5xx → network", async () => {
    mockFetchResponse({
      ok: false,
      status: 500,
      body: { error: "internal" },
    });
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onFailure).toHaveBeenCalledWith("network");
  });

  it("fetch throws (network down) → network", async () => {
    mockFetchResponse({ throwOnFetch: true });
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onFailure).toHaveBeenCalledWith("network");
  });

  it("HTTP 200 with data: null → low_confidence", async () => {
    mockFetchResponse({ body: { success: true, data: null } });
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onFailure).toHaveBeenCalledWith("low_confidence");
  });

  it("HTTP 200 with both name AND categoryId null → low_confidence (belt-and-braces)", async () => {
    const lowSignal = validDraft({ name: null, categoryId: null });
    mockFetchResponse({ body: { success: true, data: lowSignal } });
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess, onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith("low_confidence");
  });

  it("partial-signal draft (name present, category null) is still a success", async () => {
    const draft = validDraft({ categoryId: null });
    mockFetchResponse({ body: { success: true, data: draft } });
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess, onFailure: vi.fn() }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onSuccess).toHaveBeenCalledWith(draft);
  });

  it("JSON parse failure → server", async () => {
    mockFetchResponse({ throwOnJson: true });
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(onFailure).toHaveBeenCalledWith("server");
  });

  it("FileReader rejection → server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Stub FileReader so readAsDataURL fires onerror.
    class StubReader {
      result: string | null = null;
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => {
          this.error = new Error("read failed");
          this.onerror?.();
        });
      }
    }
    vi.stubGlobal("FileReader", StubReader);

    const onFailure = vi.fn();
    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess: vi.fn(), onFailure }),
    );

    await act(async () => {
      await result.current.generate([fakeFile()]);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith("server");
  });

  it("isPending toggles around the request", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    const fetchPromise = new Promise((res) => {
      resolveFetch = res;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => fetchPromise),
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useAnalyzeListingDraft({ onSuccess, onFailure: vi.fn() }),
    );

    let inflight: Promise<void> | undefined;
    act(() => {
      inflight = result.current.generate([fakeFile()]);
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: validDraft() }),
      });
      await inflight;
    });

    expect(result.current.isPending).toBe(false);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
