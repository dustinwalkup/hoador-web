import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-1)
 */

const mockGetAllDocumentVersions = vi.fn();
const mockGetAcceptancesForDocuments = vi.fn();
const mockGetUserById = vi.fn();
vi.mock("@/dal", () => ({
  legalDocumentDAL: {
    getAllDocumentVersions: (...a: unknown[]) =>
      mockGetAllDocumentVersions(...a),
    getAcceptancesForDocuments: (...a: unknown[]) =>
      mockGetAcceptancesForDocuments(...a),
  },
  userDAL: {
    getUserById: (...a: unknown[]) => mockGetUserById(...a),
  },
}));

import { listLegalDocumentsForUser } from "../legal-documents-service";

const at = (iso: string) => new Date(iso);
const version = (id: string, v: string, publishedAt: string) => ({
  id,
  version: v,
  url: `https://blob.example.com/${id}-${v}.pdf`,
  publishedAt: at(publishedAt),
});
const NO_USER_ROW_ACCEPTANCES = {
  tosVersion: null,
  tosAcceptedAt: null,
  privacyVersion: null,
  privacyAcceptedAt: null,
  communityVersion: null,
  communityAcceptedAt: null,
};

describe("listLegalDocumentsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllDocumentVersions.mockResolvedValue([]);
    mockGetAcceptancesForDocuments.mockResolvedValue([]);
    mockGetUserById.mockResolvedValue(NO_USER_ROW_ACCEPTANCES);
  });

  it("lists the user-facing documents in display order, skipping unpublished and unlisted ones", async () => {
    // Newest first, as the DAL returns them.
    mockGetAllDocumentVersions.mockResolvedValue([
      version("dispute_policy", "1.0", "2026-09-05"),
      version("review_policy", "1.0", "2026-09-04"),
      version("per_service_agreement", "1.0", "2026-09-03"),
      version("privacy", "1.0", "2026-09-02"),
      version("tos", "1.0", "2026-09-01"),
    ]);

    const docs = await listLegalDocumentsForUser("user-1");

    expect(docs.map((d) => d.id)).toEqual(["tos", "privacy", "dispute_policy"]);
    expect(docs[0]).toMatchObject({
      name: "Terms of Service",
      version: "1.0",
      url: "https://blob.example.com/tos-1.0.pdf",
      accepted: null,
    });
    expect(mockGetAcceptancesForDocuments).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining(["tos", "dispute_policy"]),
    );
  });

  it("reports the newest version as current, with the older accepted version's own URL", async () => {
    mockGetAllDocumentVersions.mockResolvedValue([
      version("tos", "1.1", "2026-09-10"),
      version("tos", "1.0", "2026-09-01"),
    ]);
    mockGetUserById.mockResolvedValue({
      ...NO_USER_ROW_ACCEPTANCES,
      tosVersion: "1.0",
      tosAcceptedAt: at("2026-09-02"),
    });

    const [tos] = await listLegalDocumentsForUser("user-1");

    expect(tos.version).toBe("1.1");
    expect(tos.url).toBe("https://blob.example.com/tos-1.1.pdf");
    expect(tos.accepted).toEqual({
      version: "1.0",
      acceptedAt: at("2026-09-02"),
      url: "https://blob.example.com/tos-1.0.pdf",
    });
  });

  it("counts a checkout acceptance for a policy (not only standalone ones)", async () => {
    mockGetAllDocumentVersions.mockResolvedValue([
      version("cancellation_refund", "2.0", "2026-09-01"),
    ]);
    mockGetAcceptancesForDocuments.mockResolvedValue([
      {
        documentId: "cancellation_refund",
        version: "2.0",
        acceptedAt: at("2026-09-03"),
      },
      {
        documentId: "cancellation_refund",
        version: "1.0",
        acceptedAt: at("2026-08-01"),
      },
    ]);

    const [doc] = await listLegalDocumentsForUser("user-1");

    expect(doc.accepted).toEqual({
      version: "2.0",
      acceptedAt: at("2026-09-03"),
      url: "https://blob.example.com/cancellation_refund-2.0.pdf",
    });
  });

  it("takes whichever of the user row and the acceptance table is later", async () => {
    mockGetAllDocumentVersions.mockResolvedValue([
      version("tos", "1.1", "2026-09-10"),
      version("tos", "1.0", "2026-09-01"),
    ]);
    // Signed up on 1.0; re-accepted 1.1 at a service checkout, which writes
    // only the table.
    mockGetUserById.mockResolvedValue({
      ...NO_USER_ROW_ACCEPTANCES,
      tosVersion: "1.0",
      tosAcceptedAt: at("2026-09-02"),
    });
    mockGetAcceptancesForDocuments.mockResolvedValue([
      { documentId: "tos", version: "1.1", acceptedAt: at("2026-09-11") },
    ]);

    const [tos] = await listLegalDocumentsForUser("user-1");

    expect(tos.accepted?.version).toBe("1.1");
  });

  it("returns accepted.url: null when the accepted version no longer exists", async () => {
    mockGetAllDocumentVersions.mockResolvedValue([
      version("privacy", "2.0", "2026-09-10"),
    ]);
    mockGetUserById.mockResolvedValue({
      ...NO_USER_ROW_ACCEPTANCES,
      privacyVersion: "1.0",
      privacyAcceptedAt: at("2026-08-01"),
    });

    const [privacy] = await listLegalDocumentsForUser("user-1");

    expect(privacy.accepted).toEqual({
      version: "1.0",
      acceptedAt: at("2026-08-01"),
      url: null,
    });
  });

  it("ignores a user-row version with no acceptance date", async () => {
    mockGetAllDocumentVersions.mockResolvedValue([
      version("community", "1.0", "2026-09-01"),
    ]);
    mockGetUserById.mockResolvedValue({
      ...NO_USER_ROW_ACCEPTANCES,
      communityVersion: "1.0",
    });

    const [community] = await listLegalDocumentsForUser("user-1");

    expect(community.accepted).toBeNull();
  });
});
