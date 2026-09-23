import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for POST /api/disputes/[id]/evidence — the upload mobile Epic 13.2
 * builds on.
 *
 * Pattern: mock the SESSION layer and the DAL / blob / image services, but run
 * the REAL `@/lib/api/route-helpers`, so the 401 and the typed-error mapping
 * (`EVIDENCE_DEADLINE_PASSED` / `EVIDENCE_LIMIT_REACHED`) come from the real
 * `handleApiError`.
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn(),
  requireAuth: vi.fn(),
}));

const mockDisputeGetById = vi.fn();
const mockCheckDeadline = vi.fn();
const mockCountEvidence = vi.fn();
const mockCreateEvidence = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockGetRentalDetailsById = vi.fn();
const mockServiceBookingGetById = vi.fn();
vi.mock("@/dal", () => ({
  disputeDAL: {
    getById: (...a: unknown[]) => mockDisputeGetById(...a),
    checkEvidenceDeadline: (...a: unknown[]) => mockCheckDeadline(...a),
    countEvidenceByDisputeAndUser: (...a: unknown[]) => mockCountEvidence(...a),
    createEvidence: (...a: unknown[]) => mockCreateEvidence(...a),
    createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
  },
  rentalDAL: {
    getRentalDetailsById: (...a: unknown[]) => mockGetRentalDetailsById(...a),
  },
  serviceBookingDAL: {
    getById: (...a: unknown[]) => mockServiceBookingGetById(...a),
  },
}));

const mockUploadToBlob = vi.fn();
vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: (...a: unknown[]) => mockUploadToBlob(...a),
}));

vi.mock("@/lib/image/server", () => ({
  validateImageForProcessing: () => null,
  processImageForUpload: async (buffer: Buffer) => buffer,
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const RENTER = "user-renter";
const OWNER = "user-owner";

const signedInAs = (userId: string) => ({
  user: { id: userId },
  userId,
  isAdmin: false,
});

const rentalDispute = (status = "open") => ({
  id: "dispute-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  status,
});

const VALID_TEXT = "The drill was returned with a cracked housing.";

function postEvidence(fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new NextRequest("http://localhost/api/disputes/dispute-1/evidence", {
    method: "POST",
    body: form,
  });
}

const ctx = { params: Promise.resolve({ id: "dispute-1" }) };

describe("POST /api/disputes/[id]/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(signedInAs(RENTER));
    mockDisputeGetById.mockResolvedValue(rentalDispute());
    mockGetRentalDetailsById.mockResolvedValue({
      id: "rental-1",
      renterId: RENTER,
      ownerId: OWNER,
    });
    mockCheckDeadline.mockResolvedValue({ expired: false, deadline: null });
    mockCountEvidence.mockResolvedValue(0);
    mockCreateEvidence.mockImplementation(async (data: object) => ({
      id: "ev-1",
      ...data,
    }));
    mockCreateAuditLog.mockResolvedValue({});
  });

  it("returns 401 when unauthenticated, without loading the dispute", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(401);
    expect(mockDisputeGetById).not.toHaveBeenCalled();
  });

  it("returns 404 when the dispute does not exist", async () => {
    mockDisputeGetById.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(404);
  });

  it("returns 403 to a non-party, without creating evidence", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(signedInAs("user-stranger"));

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(403);
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("returns 403 to a non-party on a service dispute", async () => {
    mockDisputeGetById.mockResolvedValue({
      ...rentalDispute(),
      rentalId: null,
      serviceBookingId: "sb-1",
    });
    mockServiceBookingGetById.mockResolvedValue({
      id: "sb-1",
      requesterId: "user-requester",
      providerId: "user-provider",
    });
    mockGetAuthenticatedUser.mockResolvedValue(signedInAs("user-stranger"));

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(403);
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("refuses evidence once the dispute is resolved", async () => {
    mockDisputeGetById.mockResolvedValue(rentalDispute("resolved"));

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("resolved");
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("maps an expired deadline to EVIDENCE_DEADLINE_PASSED with the deadline", async () => {
    mockCheckDeadline.mockResolvedValue({
      expired: true,
      deadline: new Date("2026-03-01T00:00:00Z"),
    });

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: "EVIDENCE_DEADLINE_PASSED",
      deadline: "2026-03-01T00:00:00.000Z",
    });
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("maps the per-participant cap to EVIDENCE_LIMIT_REACHED (422) with limit and count", async () => {
    mockCountEvidence.mockResolvedValue(10);

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "EVIDENCE_LIMIT_REACHED",
      limit: 10,
      count: 10,
    });
    expect(mockCountEvidence).toHaveBeenCalledWith("dispute-1", RENTER);
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("rejects text shorter than 10 characters (after trimming)", async () => {
    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: "  too short  " }), ctx);

    expect(res.status).toBe(400);
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("rejects text longer than 5000 characters", async () => {
    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: "x".repeat(5001) }), ctx);

    expect(res.status).toBe(400);
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("requires either a file or text", async () => {
    const { POST } = await import("../route");
    const res = await POST(postEvidence({}), ctx);

    expect(res.status).toBe(400);
    expect(mockCreateEvidence).not.toHaveBeenCalled();
  });

  it("stores trimmed text evidence as the renter and audits it", async () => {
    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: `  ${VALID_TEXT}  ` }), ctx);

    expect(res.status).toBe(201);
    expect(mockCreateEvidence).toHaveBeenCalledWith({
      disputeId: "dispute-1",
      uploadedBy: RENTER,
      uploadedByRole: "renter",
      evidenceType: "text",
      content: VALID_TEXT,
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: "dispute-1",
        actionType: "evidence_uploaded",
        userId: RENTER,
        details: { evidenceId: "ev-1", evidenceType: "text" },
      }),
    );
  });

  it("uploads an image under the dispute's evidence path as the owner", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(signedInAs(OWNER));
    mockUploadToBlob.mockResolvedValue({
      url: "https://blob.example.com/disputes/dispute-1/evidence/1-crack.jpg",
    });

    const { POST } = await import("../route");
    const res = await POST(
      postEvidence({
        file: new File([new Uint8Array([1, 2, 3])], "crack.png", {
          type: "image/png",
        }),
      }),
      ctx,
    );

    expect(res.status).toBe(201);
    expect(mockUploadToBlob).toHaveBeenCalledWith(
      expect.stringMatching(/^disputes\/dispute-1\/evidence\/\d+-crack\.jpg$/),
      expect.anything(),
    );
    expect(mockCreateEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedByRole: "owner",
        evidenceType: "image",
        content:
          "https://blob.example.com/disputes/dispute-1/evidence/1-crack.jpg",
      }),
    );
  });

  it("records the requester role on a service dispute", async () => {
    mockDisputeGetById.mockResolvedValue({
      ...rentalDispute(),
      rentalId: null,
      serviceBookingId: "sb-1",
    });
    mockServiceBookingGetById.mockResolvedValue({
      id: "sb-1",
      requesterId: "user-requester",
      providerId: "user-provider",
    });
    mockGetAuthenticatedUser.mockResolvedValue(signedInAs("user-requester"));

    const { POST } = await import("../route");
    const res = await POST(postEvidence({ text: VALID_TEXT }), ctx);

    expect(res.status).toBe(201);
    expect(mockCreateEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ uploadedByRole: "requester" }),
    );
  });
});
