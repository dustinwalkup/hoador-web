import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetListingCategories = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: {
    getListingCategories: (...a: any[]) => mockGetListingCategories(...a),
  },
}));

describe("GET /api/listings/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the stored icon NAME to a renderable emoji", async () => {
    mockGetListingCategories.mockResolvedValue([
      { id: "c1", name: "Power Tools", icon: "drill" },
      { id: "c2", name: "Ladders & Access", icon: "ladder" },
    ]);

    const { GET } = await import("../route");
    const json = await (
      await GET(new Request("http://localhost") as any)
    ).json();

    expect(json[0]).toMatchObject({ name: "Power Tools", emoji: "⚡" });
    expect(json[1]).toMatchObject({ name: "Ladders & Access", emoji: "🪜" });
  });

  it("keeps `icon` intact so existing web consumers are unaffected", async () => {
    mockGetListingCategories.mockResolvedValue([
      { id: "c1", name: "Power Tools", icon: "drill" },
    ]);

    const { GET } = await import("../route");
    const json = await (
      await GET(new Request("http://localhost") as any)
    ).json();

    expect(json[0].icon).toBe("drill");
  });

  it("returns emoji: null for an unmapped or missing icon rather than a broken glyph", async () => {
    mockGetListingCategories.mockResolvedValue([
      { id: "c1", name: "Brand New Category", icon: "telescope" },
      { id: "c2", name: "No Icon", icon: null },
    ]);

    const { GET } = await import("../route");
    const json = await (
      await GET(new Request("http://localhost") as any)
    ).json();

    expect(json[0].emoji).toBeNull();
    expect(json[1].emoji).toBeNull();
  });

  it("still 500s cleanly when the DAL throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockGetListingCategories.mockRejectedValue(new Error("db down"));

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost") as any);

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
