import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F15 / P-E10-7
 *
 * This route had no test file, and no session check — it read straight from
 * `params` to the database. These tests exist to keep it shut.
 */

const mockGetAuthenticatedUserResponse = vi.fn();
vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetListingById = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: { getListingById: (...a: unknown[]) => mockGetListingById(...a) },
}));

const mockOrderBy = vi.fn();
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
vi.mock("@/db/db", () => ({
  db: { select: () => ({ from: mockFrom }) },
}));

vi.mock("@/db/schemas/listings.schema", () => ({
  listingImages: {
    listingId: "images.listingId",
    orderIndex: "images.orderIndex",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ _op: "eq", col, val }),
}));

import { GET } from "../route";

const req = () => new NextRequest("http://localhost/api/listings/L1/images");
const params = (listingId = "L1") => ({
  params: Promise.resolve({ listingId }),
});

describe("GET /api/listings/[listingId]/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "owner-1" });
    mockGetListingById.mockResolvedValue({ owner: { id: "owner-1" } });
    mockOrderBy.mockResolvedValue([
      { id: "img-1", imageUrl: "https://cdn/1.jpg", orderIndex: 0 },
    ]);
  });

  it("returns the images to the owner", async () => {
    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      images: [{ id: "img-1", imageUrl: "https://cdn/1.jpg", orderIndex: 0 }],
    });
  });

  // ⚠️ The whole point of P-E10-7. Before this, there was no session check at
  // all: any caller with a listing id got the rows — including for
  // `pending_review` and `rejected` listings, whose images are un-moderated.
  it("401s an unauthenticated caller and never reads the database", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );

    const res = await GET(req(), params());

    expect(res.status).toBe(401);
    expect(mockGetListingById).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("403s a signed-in NON-owner and never reads the images", async () => {
    mockGetListingById.mockResolvedValue({ owner: { id: "someone-else" } });

    const res = await GET(req(), params());

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("404s a listing that does not exist", async () => {
    mockGetListingById.mockResolvedValue(null);

    const res = await GET(req(), params());

    expect(res.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("400s a blank listing id before touching the DAL", async () => {
    const res = await GET(req(), params(""));

    expect(res.status).toBe(400);
    expect(mockGetListingById).not.toHaveBeenCalled();
  });

  it("scopes the query to the requested listing", async () => {
    await GET(req(), params());

    expect(mockWhere).toHaveBeenCalledWith(
      expect.objectContaining({ col: "images.listingId", val: "L1" }),
    );
  });

  it("500s rather than throwing when the query fails", async () => {
    mockOrderBy.mockRejectedValue(new Error("connection lost"));

    const res = await GET(req(), params());

    expect(res.status).toBe(500);
  });
});
