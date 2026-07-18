import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Requirements: 2.7.1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.7 (F31, F32)
 *
 * This route had no test file before. It covers the images-only re-review
 * wiring and the F32 cross-listing scoping fix.
 */

const mockGetAuthenticatedUserResponse = vi.fn();
vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
}));

const mockGetListingById = vi.fn();
const mockMarkPendingReview = vi.fn();
vi.mock("@/dal", () => ({
  listingDAL: {
    getListingById: (...a: unknown[]) => mockGetListingById(...a),
    markApprovedListingPendingReview: (...a: unknown[]) =>
      mockMarkPendingReview(...a),
  },
}));

// Capture the where-predicates each update is scoped to. `and`/`eq` return
// tagged objects so the test can inspect what the reorder update filtered on.
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ _op: "eq", col, val }),
  and: (...conds: unknown[]) => ({ _op: "and", conds }),
}));

const capturedWheres: unknown[] = [];
const mockUpdateSetWhere = vi.fn((w: unknown) => {
  capturedWheres.push(w);
  return Promise.resolve();
});
vi.mock("@/db/db", () => ({
  db: {
    update: () => ({
      set: () => ({ where: (w: unknown) => mockUpdateSetWhere(w) }),
    }),
  },
}));

vi.mock("@/db/schemas/listings.schema", () => ({
  listingImages: { id: "images.id", listingId: "images.listingId" },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { PUT } from "../route";

const params = (listingId: string) => ({
  params: Promise.resolve({ listingId }),
});
const req = (imageIds: string[]) =>
  new NextRequest("http://localhost/api/listings/L1/images/reorder", {
    method: "PUT",
    body: JSON.stringify({ imageIds }),
  });

describe("PUT /api/listings/[listingId]/images/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWheres.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "owner-1" });
    mockGetListingById.mockResolvedValue({ owner: { id: "owner-1" } });
    mockMarkPendingReview.mockResolvedValue(undefined);
  });

  it("scopes every reorder update to the listing id, not just the image id (F32)", async () => {
    const res = await PUT(req(["img-b", "img-a"]), params("L1"));

    expect(res.status).toBe(200);
    // Two images → two scoped updates.
    expect(capturedWheres).toHaveLength(2);
    for (const where of capturedWheres as { _op: string; conds: any[] }[]) {
      // Each update must AND the image id with the listing id — without the
      // listing predicate a caller could reorder another listing's images.
      expect(where._op).toBe("and");
      const cols = where.conds.map((c) => c.col);
      expect(cols).toContain("images.id");
      expect(cols).toContain("images.listingId");
      const listingPredicate = where.conds.find(
        (c) => c.col === "images.listingId",
      );
      expect(listingPredicate.val).toBe("L1");
    }
  });

  it("does NOT re-trigger review when reordering (reorders don't re-review)", async () => {
    // Req 2.7.1 (amended): rearranging already-approved images introduces no
    // un-moderated content, so an approved listing stays approved. This is the
    // exact bug a user hit — a field-only save re-sends the image order and must
    // not bounce the listing back to moderation.
    await PUT(req(["img-b", "img-a"]), params("L1"));

    expect(mockMarkPendingReview).not.toHaveBeenCalled();
  });

  it("403s a non-owner and does not reorder", async () => {
    mockGetListingById.mockResolvedValue({ owner: { id: "someone-else" } });

    const res = await PUT(req(["img-a"]), params("L1"));

    expect(res.status).toBe(403);
    expect(capturedWheres).toHaveLength(0);
  });

  it("401s when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );

    const res = await PUT(req(["img-a"]), params("L1"));

    expect(res.status).toBe(401);
    expect(mockGetListingById).not.toHaveBeenCalled();
  });

  it("404s when the listing does not exist", async () => {
    mockGetListingById.mockResolvedValue(null);

    const res = await PUT(req(["img-a"]), params("L1"));

    expect(res.status).toBe(404);
  });
});
