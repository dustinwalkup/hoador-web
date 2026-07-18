import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Requirements: 2.7.1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.7 (F31)
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

const mockDeleteFromBlob = vi.fn();
vi.mock("@/services/vercel-blob", () => ({
  deleteFromBlob: (...a: unknown[]) => mockDeleteFromBlob(...a),
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...conds: unknown[]) => ({ conds }),
}));

const mockImageSelectWhere = vi.fn();
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
vi.mock("@/db/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: (w: unknown) => mockImageSelectWhere(w) }),
    }),
    delete: () => ({ where: (w: unknown) => mockDeleteWhere(w) }),
  },
}));

vi.mock("@/db/schemas/listings.schema", () => ({
  listingImages: { id: "images.id", listingId: "images.listingId" },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { DELETE } from "../route";

const params = (listingId: string, imageId: string) => ({
  params: Promise.resolve({ listingId, imageId }),
});
const req = () =>
  new NextRequest("http://localhost/api/listings/L1/images/IMG1", {
    method: "DELETE",
  });

describe("DELETE /api/listings/[listingId]/images/[imageId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "owner-1" });
    mockGetListingById.mockResolvedValue({ owner: { id: "owner-1" } });
    mockImageSelectWhere.mockResolvedValue([
      { id: "IMG1", blobPathname: "listings/L1/x.jpg" },
    ]);
    mockMarkPendingReview.mockResolvedValue(undefined);
  });

  it("deletes the image WITHOUT re-triggering review (removals don't re-review)", async () => {
    // Req 2.7.1 (amended): removing an already-approved image introduces no
    // un-moderated content, so an approved listing must stay approved.
    const res = await DELETE(req(), params("L1", "IMG1"));

    expect(res.status).toBe(200);
    expect(mockDeleteFromBlob).toHaveBeenCalledWith("listings/L1/x.jpg");
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockMarkPendingReview).not.toHaveBeenCalled();
  });

  it("403s a non-owner and does not delete", async () => {
    mockGetListingById.mockResolvedValue({ owner: { id: "someone-else" } });

    const res = await DELETE(req(), params("L1", "IMG1"));

    expect(res.status).toBe(403);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it("404s when the image does not belong to the listing", async () => {
    mockImageSelectWhere.mockResolvedValue([]);

    const res = await DELETE(req(), params("L1", "IMG1"));

    expect(res.status).toBe(404);
  });

  it("401s when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );

    const res = await DELETE(req(), params("L1", "IMG1"));

    expect(res.status).toBe(401);
    expect(mockGetListingById).not.toHaveBeenCalled();
  });
});
