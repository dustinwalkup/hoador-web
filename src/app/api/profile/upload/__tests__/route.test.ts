import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Auth + ownership tests for /api/profile/upload.
 *
 * Pattern: mock the SESSION layer (`@/features/auth/utils/session`) and the
 * blob/image services, but run the REAL `@/lib/api/route-helpers`, so the 401
 * comes from the real `getAuthenticatedUserResponse()`.
 *
 * The DELETE cases pin the IDOR fix: a user may delete only blobs under their
 * own `profiles/<userId>/` prefix, or the exact legacy flat-path blob backing
 * their current profile image — never anyone else's.
 */

const mockGetAuthenticatedUser = vi.fn();
const mockUploadToBlob = vi.fn();
const mockDeleteFromBlob = vi.fn();

vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...args: unknown[]) =>
    mockGetAuthenticatedUser(...args),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  requireAuth: vi.fn(),
}));

const mockUpdateUser = vi.fn();

vi.mock("@/services/vercel-blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/vercel-blob")>()),
  uploadToBlob: (...args: unknown[]) => mockUploadToBlob(...args),
  deleteFromBlob: (...args: unknown[]) => mockDeleteFromBlob(...args),
}));

vi.mock("@/dal", () => ({
  userDAL: { updateUser: (...args: unknown[]) => mockUpdateUser(...args) },
}));

vi.mock("@/lib/image/server", () => ({
  validateImageForProcessing: () => null,
  processImageForUpload: async (buffer: Buffer) => buffer,
  getImageMetadata: async () => ({
    size: 1024,
    width: 400,
    height: 400,
    format: "jpeg",
  }),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (...a: unknown[]) => unknown) => handler,
}));

const authedAs = (
  userId: string,
  profileImageUrl:
    | string
    | null = "https://blob.example.com/profiles/111-old.jpg",
) => ({
  user: { id: userId, profileImageUrl },
  userId,
  isAdmin: false,
});

function deleteRequest(pathname: string) {
  return new NextRequest(
    `http://localhost/api/profile/upload?pathname=${encodeURIComponent(pathname)}`,
    { method: "DELETE" },
  );
}

function postRequest() {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([1, 2, 3])], "my photo.png", {
      type: "image/png",
    }),
  );
  return new NextRequest("http://localhost/api/profile/upload", {
    method: "POST",
    body: form,
  });
}

describe("DELETE /api/profile/upload (ownership)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(authedAs("user-1"));
    mockDeleteFromBlob.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue({});
  });

  it("returns 401 when unauthenticated, without deleting", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/user-1/123-me.jpg"));

    expect(res.status).toBe(401);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  it("deletes a blob under the caller's own prefix", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/user-1/123-me.jpg"));

    expect(res.status).toBe(200);
    expect(mockDeleteFromBlob).toHaveBeenCalledWith(
      "profiles/user-1/123-me.jpg",
    );
  });

  it("deletes the exact legacy blob backing the caller's current image", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/111-old.jpg"));

    expect(res.status).toBe(200);
    expect(mockDeleteFromBlob).toHaveBeenCalledWith("profiles/111-old.jpg");
  });

  it("refuses someone else's legacy flat-path image (IDOR)", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/999-victim.jpg"));

    expect(res.status).toBe(403);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  it("refuses a blob under another user's prefix (IDOR)", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/user-2/123-other.jpg"));

    expect(res.status).toBe(403);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  it("refuses a prefix match that is really a different user id", async () => {
    // `profiles/user-1/` must not match `profiles/user-10/…`.
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/user-10/123-other.jpg"));

    expect(res.status).toBe(403);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  it("refuses dot segments that would escape the caller's prefix", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(
      deleteRequest("profiles/user-1/../999-victim.jpg"),
    );

    expect(res.status).toBe(400);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  it("rejects non-profile paths with 400 before the ownership check", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("listings/123.jpg"));

    expect(res.status).toBe(400);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  // Mobile P-E14-2: "Remove photo" must not leave the column pointing at a 404.
  it("clears profileImageUrl BEFORE deleting the current image's blob", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(
      authedAs(
        "user-1",
        "https://store.public.blob.vercel-storage.com/profiles/user-1/5-me.jpg",
      ),
    );

    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/user-1/5-me.jpg"));

    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
      profileImageUrl: null,
    });
    expect(mockUpdateUser.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteFromBlob.mock.invocationCallOrder[0],
    );
  });

  it("leaves the blob alone when clearing the column fails", async () => {
    mockUpdateUser.mockRejectedValue(new Error("db down"));

    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/111-old.jpg"));

    expect(res.status).toBe(500);
    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });

  it("doesn't touch the column when deleting an older, non-current upload", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("profiles/user-1/123-me.jpg"));

    expect(res.status).toBe(200);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(authedAs("user-1", null));
    mockUploadToBlob.mockImplementation(async (pathname: string) => ({
      url: `https://blob.example.com/${pathname}`,
      pathname,
    }));
    mockDeleteFromBlob.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue({});
  });

  it("returns 401 when unauthenticated, without uploading", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(postRequest());

    expect(res.status).toBe(401);
    expect(mockUploadToBlob).not.toHaveBeenCalled();
  });

  it("uploads under the caller's user-scoped prefix", async () => {
    const { POST } = await import("../route");
    const res = await POST(postRequest());

    expect(res.status).toBe(200);
    expect(mockUploadToBlob).toHaveBeenCalledWith(
      expect.stringMatching(/^profiles\/user-1\/\d+-my_photo\.jpg$/),
      expect.anything(),
    );
    const body = await res.json();
    expect(body.url).toMatch(/\/profiles\/user-1\//);
  });

  // SEC-11: the server records the avatar; the client's PATCH is now optional.
  it("writes the new blob url to the caller's profileImageUrl", async () => {
    const { POST } = await import("../route");
    const res = await POST(postRequest());
    const body = await res.json();

    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
      profileImageUrl: body.url,
    });
  });

  it("drops the new blob when the column write fails", async () => {
    mockUpdateUser.mockRejectedValue(new Error("db down"));

    const { POST } = await import("../route");
    const res = await POST(postRequest());

    expect(res.status).toBe(500);
    expect(mockDeleteFromBlob).toHaveBeenCalledWith(
      expect.stringMatching(/^profiles\/user-1\//),
    );
  });

  it("cleans up the previous avatar under the caller's own prefix", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(
      authedAs("user-1", "https://blob.example.com/profiles/user-1/1-old.jpg"),
    );

    const { POST } = await import("../route");
    await POST(postRequest());

    expect(mockDeleteFromBlob).toHaveBeenCalledWith(
      "profiles/user-1/1-old.jpg",
    );
  });

  it("never cleans up a previous avatar outside the caller's prefix", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(
      authedAs(
        "user-1",
        "https://blob.example.com/profiles/user-2/1-theirs.jpg",
      ),
    );

    const { POST } = await import("../route");
    await POST(postRequest());

    expect(mockDeleteFromBlob).not.toHaveBeenCalled();
  });
});
