import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile 11.3.1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F17 / P-E10-4
 */

const mockGetCurrentUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetCurrentUser();
    return user ? { user, userId: user.id, isAdmin: false } : null;
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockAddPhoto = vi.fn();
const mockSetPhotos = vi.fn();
vi.mock("@/features/services/services/service-listing-service", () => ({
  ServiceListingService: {
    addPhoto: (...a: any[]) => mockAddPhoto(...a),
    setPhotos: (...a: any[]) => mockSetPhotos(...a),
  },
}));

import { POST, PUT } from "../route";

const params = () => ({ params: Promise.resolve({ id: "SL1" }) });

function multipart(withFile = true): NextRequest {
  const form = new FormData();
  if (withFile) {
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }),
    );
  }
  return new NextRequest("http://localhost/api/services/listings/SL1/photos", {
    method: "POST",
    body: form,
  });
}

const putReq = (body: unknown) =>
  new NextRequest("http://localhost/api/services/listings/SL1/photos", {
    method: "PUT",
    body: JSON.stringify(body),
  });

describe("POST /api/services/listings/[id]/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "provider-1" });
    mockAddPhoto.mockResolvedValue({ photos: ["https://cdn/1.jpg"] });
  });

  it("adds a photo and returns the new array", async () => {
    const res = await POST(multipart(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      photos: ["https://cdn/1.jpg"],
    });
  });

  it("400s when no file is attached", async () => {
    const res = await POST(multipart(false), params());

    expect(res.status).toBe(400);
    expect(mockAddPhoto).not.toHaveBeenCalled();
  });

  it("401s when unauthenticated and never reaches the service", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST(multipart(), params());

    expect(res.status).toBe(401);
    expect(mockAddPhoto).not.toHaveBeenCalled();
  });
});

describe("PUT /api/services/listings/[id]/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "provider-1" });
    mockSetPhotos.mockResolvedValue({ photos: ["https://cdn/2.jpg"] });
  });

  // The column has no per-photo identity, so replacing the array IS both.
  it("replaces the array — the reorder and the remove are one operation", async () => {
    const res = await PUT(putReq({ photos: ["https://cdn/2.jpg"] }), params());

    expect(res.status).toBe(200);
    expect(mockSetPhotos).toHaveBeenCalledWith(
      "SL1",
      "provider-1",
      ["https://cdn/2.jpg"],
      expect.anything(),
    );
  });

  it("accepts an empty array — removing the last photo is legal", async () => {
    mockSetPhotos.mockResolvedValue({ photos: [] });

    const res = await PUT(putReq({ photos: [] }), params());

    expect(res.status).toBe(200);
  });

  it("400s on a non-array, a missing key, or non-URL entries", async () => {
    for (const body of [
      {},
      { photos: "one" },
      { photos: [42] },
      { photos: ["not a url"] },
    ]) {
      const res = await PUT(putReq(body), params());
      expect(res.status).toBe(400);
    }
    expect(mockSetPhotos).not.toHaveBeenCalled();
  });

  it("400s past the cap", async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `https://cdn/${i}.jpg`);

    const res = await PUT(putReq({ photos: eleven }), params());

    expect(res.status).toBe(400);
    expect(mockSetPhotos).not.toHaveBeenCalled();
  });

  it("400s on unparseable JSON rather than throwing", async () => {
    const bad = new NextRequest(
      "http://localhost/api/services/listings/SL1/photos",
      {
        method: "PUT",
        body: "{not json",
      },
    );

    const res = await PUT(bad, params());

    expect(res.status).toBe(400);
  });

  it("401s when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await PUT(putReq({ photos: [] }), params());

    expect(res.status).toBe(401);
    expect(mockSetPhotos).not.toHaveBeenCalled();
  });

  // ⚠️ The route accepts any well-formed URL; the SUBSET check that stops an
  // injection lives in the service, and this test documents that boundary so
  // nobody later "simplifies" the guard away as redundant validation.
  it("passes a foreign URL through to the service, which is what refuses it", async () => {
    await PUT(putReq({ photos: ["https://evil.test/tracker.gif"] }), params());

    expect(mockSetPhotos).toHaveBeenCalledWith(
      "SL1",
      "provider-1",
      ["https://evil.test/tracker.gif"],
      expect.anything(),
    );
  });
});
