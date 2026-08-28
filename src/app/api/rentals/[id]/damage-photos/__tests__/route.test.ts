import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: mobile Req 10.2.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-08a-rental-lifecycle.md (P-E8A-6)
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetRentalRequestById = vi.fn();
vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: (...a: unknown[]) => mockGetRentalRequestById(...a),
  },
}));

const mockUploadToBlob = vi.fn();
vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: (...a: unknown[]) => mockUploadToBlob(...a),
}));

const mockValidate = vi.fn();
const mockProcess = vi.fn();
vi.mock("@/lib/image/server", () => ({
  validateImageForProcessing: (...a: unknown[]) => mockValidate(...a),
  processImageForUpload: (...a: unknown[]) => mockProcess(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const params = () => ({ params: Promise.resolve({ id: "req-1" }) });

const req = (withFile = true) => {
  const form = new FormData();
  if (withFile) {
    form.append(
      "file",
      new File(["bytes"], "damage.heic", { type: "image/heic" }),
    );
  }
  return new NextRequest("http://localhost/api/rentals/req-1/damage-photos", {
    method: "POST",
    body: form,
  });
};

const asOwner = () =>
  mockGetAuthenticatedUser.mockResolvedValue({
    user: { id: "owner-1" },
    userId: "owner-1",
    isAdmin: false,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  asOwner();
  mockGetRentalRequestById.mockResolvedValue({
    id: "req-1",
    ownerId: "owner-1",
    renterId: "renter-1",
    status: "active",
  });
  mockValidate.mockReturnValue(null);
  mockProcess.mockResolvedValue(Buffer.from("processed"));
  mockUploadToBlob.mockResolvedValue({ url: "https://blob.test/damage/1.jpg" });
});

describe("POST /api/rentals/[id]/damage-photos", () => {
  it("returns the blob url for the caller to attach to the return report", async () => {
    const res = await POST(req(), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://blob.test/damage/1.jpg" });
  });

  // The mobile client strips EXIF through its manipulator (rule #7) and the web
  // client does not, so the re-encode has to happen here as well.
  it("re-encodes rather than storing what was uploaded", async () => {
    await POST(req(), params());

    expect(mockProcess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: "jpeg" }),
    );
    // Even a HEIC lands as .jpg, so a viewer never has to negotiate the format.
    expect(mockUploadToBlob.mock.calls[0][0]).toMatch(
      /^rentals\/req-1\/damage\/\d+-damage\.jpg$/,
    );
  });

  it("rejects a file the image validator refuses", async () => {
    mockValidate.mockReturnValue("File too large");

    const res = await POST(req(), params());

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("File too large");
    expect(mockUploadToBlob).not.toHaveBeenCalled();
  });

  it("400s with no file at all", async () => {
    expect((await POST(req(false), params())).status).toBe(400);
  });

  // This is the OWNER's condition record. The renter's side of a damage claim is
  // dispute evidence (Epic 13), which is a different surface with its own rules.
  it("403s the renter, who has the dispute-evidence path instead", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "renter-1" },
      userId: "renter-1",
      isAdmin: false,
    });

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
    expect(mockUploadToBlob).not.toHaveBeenCalled();
  });

  // A photo attached to a pending request is describing something that has not
  // happened yet.
  it.each(["pending", "approved", "cancelled"])(
    "400s a %s rental, which has no return to report on",
    async (status) => {
      mockGetRentalRequestById.mockResolvedValue({
        id: "req-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        status,
      });

      expect((await POST(req(), params())).status).toBe(400);
    },
  );

  it("accepts a completed rental, since damage is found after the fact", async () => {
    mockGetRentalRequestById.mockResolvedValue({
      id: "req-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "completed",
    });

    expect((await POST(req(), params())).status).toBe(200);
  });

  it("401s when unauthenticated and reads nothing", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    expect((await POST(req(), params())).status).toBe(401);
    expect(mockGetRentalRequestById).not.toHaveBeenCalled();
  });

  it("404s a rental that does not exist", async () => {
    mockGetRentalRequestById.mockResolvedValue(null);

    expect((await POST(req(), params())).status).toBe(404);
  });
});
