import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentVersion = vi.fn();
vi.mock("@/dal", () => ({
  legalDocumentDAL: {
    getCurrentVersion: (...a: unknown[]) => mockGetCurrentVersion(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

const get = (documentId: string) =>
  GET(new NextRequest(`http://localhost/legal/${documentId}`), {
    params: Promise.resolve({ documentId }),
  });

describe("GET /legal/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("redirects to the current version's PDF, uncached and without a session", async () => {
    mockGetCurrentVersion.mockResolvedValue({
      id: "tos",
      version: "1.1",
      url: "https://blob.example.com/legal/tos-1.1.pdf",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
    });

    const res = await get("tos");

    expect(mockGetCurrentVersion).toHaveBeenCalledWith("tos");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://blob.example.com/legal/tos-1.1.pdf",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("404s an unknown document ID without querying", async () => {
    const res = await get("not-a-document");

    expect(res.status).toBe(404);
    expect(mockGetCurrentVersion).not.toHaveBeenCalled();
  });

  it("404s a known document with nothing published", async () => {
    mockGetCurrentVersion.mockResolvedValue(null);

    const res = await get("privacy");

    expect(res.status).toBe(404);
  });

  it("500s when the lookup fails", async () => {
    mockGetCurrentVersion.mockRejectedValue(new Error("db down"));

    const res = await get("privacy");

    expect(res.status).toBe(500);
  });
});
