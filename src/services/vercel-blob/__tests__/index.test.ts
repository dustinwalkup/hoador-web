import { describe, it, expect, vi } from "vitest";

const mockList = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  list: (...a: unknown[]) => mockList(...a),
}));

import { isOwnBlobUrl, listBlobsByPrefix, pathnameFromBlobUrl } from "../index";

const STORE = "https://abc123.public.blob.vercel-storage.com";

describe("pathnameFromBlobUrl", () => {
  it("returns the pathname without its leading slash", () => {
    expect(pathnameFromBlobUrl(`${STORE}/profiles/u-1/1.jpg`)).toBe(
      "profiles/u-1/1.jpg",
    );
  });
});

describe("isOwnBlobUrl", () => {
  it("accepts a store URL under the prefix", () => {
    expect(isOwnBlobUrl(`${STORE}/profiles/u-1/1.jpg`, "profiles/u-1/")).toBe(
      true,
    );
  });

  it.each([
    [
      "a foreign host with the same pathname",
      "https://evil.example/profiles/u-1/1.jpg",
    ],
    [
      "a lookalike host",
      "https://public.blob.vercel-storage.com.evil.example/profiles/u-1/1.jpg",
    ],
    [
      "plain http",
      "http://abc123.public.blob.vercel-storage.com/profiles/u-1/1.jpg",
    ],
    ["another user's prefix", `${STORE}/profiles/u-2/1.jpg`],
    ["a user id that only starts the same", `${STORE}/profiles/u-10/1.jpg`],
    ["dot segments out of the prefix", `${STORE}/profiles/u-1/../u-2/1.jpg`],
    ["a malformed string", "not a url"],
  ])("rejects %s", (_label, url) => {
    expect(isOwnBlobUrl(url, "profiles/u-1/")).toBe(false);
  });
});

describe("listBlobsByPrefix", () => {
  it("follows the cursor across pages", async () => {
    mockList
      .mockResolvedValueOnce({
        blobs: [{ pathname: "profiles/u-1/a.jpg" }],
        hasMore: true,
        cursor: "c-2",
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: "profiles/u-1/b.jpg" }],
        hasMore: false,
      });

    expect(await listBlobsByPrefix("profiles/u-1/")).toEqual([
      { pathname: "profiles/u-1/a.jpg" },
      { pathname: "profiles/u-1/b.jpg" },
    ]);
    expect(mockList).toHaveBeenNthCalledWith(1, {
      prefix: "profiles/u-1/",
      cursor: undefined,
    });
    expect(mockList).toHaveBeenNthCalledWith(2, {
      prefix: "profiles/u-1/",
      cursor: "c-2",
    });
  });
});
