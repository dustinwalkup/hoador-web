import { describe, it, expect, vi, beforeEach } from "vitest";
import { legalDocumentDAL } from "../index";
import { db } from "@/db/db";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

function createSelectChain(resolvedValues: unknown[][]) {
  let callIndex = 0;
  const limitMock = vi.fn().mockImplementation(() => {
    const value = resolvedValues[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(value);
  });
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { selectMock, limitMock, resolvedValues };
}

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("LegalDocumentDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRentalAgreementAcceptance", () => {
    it("returns null for invalid or non-existent rental id", async () => {
      const { selectMock } = createSelectChain([
        [], // rental_requests not found
        [], // rentals not found
      ]);
      vi.mocked(db.select).mockImplementation(selectMock as typeof db.select);

      const result = await legalDocumentDAL.getRentalAgreementAcceptance(
        "invalid-id",
        "user-123",
      );

      expect(result).toBeNull();
    });

    it("returns null when user is not renter or owner", async () => {
      const { selectMock } = createSelectChain([
        [{ id: "req-1" }], // resolve: input is request id
        [{ renterId: "renter-1", ownerId: "owner-1" }], // rental request
        // userId "other-user" !== renter-1 and !== owner-1 -> null before querying generated
      ]);
      vi.mocked(db.select).mockImplementation(selectMock as typeof db.select);

      const result = await legalDocumentDAL.getRentalAgreementAcceptance(
        "req-1",
        "other-user",
      );

      expect(result).toBeNull();
    });

    it("returns generated pdfUrl and templateVersion when document exists (request id)", async () => {
      const { selectMock } = createSelectChain([
        [{ id: "req-1" }], // resolve: input is request id
        [{ renterId: "renter-1", ownerId: "owner-1" }],
        [
          {
            templateVersion: "1.0",
            pdfUrl: "https://blob.example.com/rental-agreements/req-1.pdf",
          },
        ],
      ]);
      vi.mocked(db.select).mockImplementation(selectMock as typeof db.select);

      const result = await legalDocumentDAL.getRentalAgreementAcceptance(
        "req-1",
        "renter-1",
      );

      expect(result).toEqual({
        version: "1.0",
        url: "https://blob.example.com/rental-agreements/req-1.pdf",
      });
    });

    it("resolves rental id to request id and returns generated document", async () => {
      const { selectMock } = createSelectChain([
        [], // rental_requests: not found by rental id
        [{ requestId: "req-1" }], // rentals: found, requestId = req-1
        [{ renterId: "renter-1", ownerId: "owner-1" }],
        [
          {
            templateVersion: "1.0",
            pdfUrl: "https://blob.example.com/doc.pdf",
          },
        ],
      ]);
      vi.mocked(db.select).mockImplementation(selectMock as typeof db.select);

      const result = await legalDocumentDAL.getRentalAgreementAcceptance(
        "rental-456",
        "owner-1",
      );

      expect(result).toEqual({
        version: "1.0",
        url: "https://blob.example.com/doc.pdf",
      });
    });

    it("returns fallback from legal_documents when no generated document (acceptance exists)", async () => {
      const limitMock = vi.fn();
      limitMock
        .mockResolvedValueOnce([{ id: "req-1" }])
        .mockResolvedValueOnce([{ renterId: "renter-1", ownerId: "owner-1" }])
        .mockResolvedValueOnce([]) // no generated document
        .mockResolvedValueOnce([{ version: "1.0", rentalRequestId: "req-1" }]) // user_legal_acceptances
        .mockResolvedValueOnce([
          {
            id: LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
            version: "1.0",
            url: "https://legal.example.com/per-rental-agreement-1.0.pdf",
            publishedAt: new Date(),
          },
        ]); // getVersion
      const whereReturn = {
        limit: limitMock,
        orderBy: vi.fn().mockReturnValue({ limit: limitMock }),
      };
      const fromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(whereReturn),
      });
      vi.mocked(db.select).mockReturnValue({
        from: fromMock,
      } as unknown as ReturnType<typeof db.select>);

      const result = await legalDocumentDAL.getRentalAgreementAcceptance(
        "req-1",
        "renter-1",
      );

      expect(result).toEqual({
        version: "1.0",
        url: "https://legal.example.com/per-rental-agreement-1.0.pdf",
      });
    });

    it("returns fallback current version when no generated doc and no acceptance", async () => {
      const limitMock = vi.fn();
      limitMock
        .mockResolvedValueOnce([{ id: "req-1" }])
        .mockResolvedValueOnce([{ renterId: "renter-1", ownerId: "owner-1" }])
        .mockResolvedValueOnce([]) // no generated
        .mockResolvedValueOnce([]) // no acceptance
        .mockResolvedValueOnce([
          {
            id: LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
            version: "2.0",
            url: "https://legal.example.com/current.pdf",
            publishedAt: new Date(),
          },
        ]); // getCurrentVersion (uses orderBy().limit(1))
      const whereReturn = {
        limit: limitMock,
        orderBy: vi.fn().mockReturnValue({ limit: limitMock }),
      };
      const fromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(whereReturn),
      });
      vi.mocked(db.select).mockReturnValue({
        from: fromMock,
      } as unknown as ReturnType<typeof db.select>);

      const result = await legalDocumentDAL.getRentalAgreementAcceptance(
        "req-1",
        "renter-1",
      );

      expect(result).toEqual({
        version: "2.0",
        url: "https://legal.example.com/current.pdf",
      });
    });
  });
});
