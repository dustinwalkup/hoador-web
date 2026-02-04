import { describe, it, expect, vi, beforeEach } from "vitest";
import { rentalAgreementDocumentDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

describe("RentalAgreementDocumentDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("returns row with correct rentalRequestId and pdfUrl", async () => {
      const rentalRequestId = "req-123";
      const pdfUrl = "https://blob.example.com/rental-agreements/req-123.pdf";
      const templateVersion = "1.0";
      const mockRow = {
        id: "doc-456",
        rentalRequestId,
        pdfUrl,
        templateVersion,
        generatedAt: new Date("2025-02-01T12:00:00Z"),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockRow]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as unknown as ReturnType<typeof db.insert>);

      const result = await rentalAgreementDocumentDAL.create(
        rentalRequestId,
        pdfUrl,
        templateVersion,
      );

      expect(result).toEqual(mockRow);
      expect(result.rentalRequestId).toBe(rentalRequestId);
      expect(result.pdfUrl).toBe(pdfUrl);
      expect(result.templateVersion).toBe(templateVersion);
      expect(db.insert).toHaveBeenCalled();
    });

    it("throws when insert returns no row", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as unknown as ReturnType<typeof db.insert>);

      await expect(
        rentalAgreementDocumentDAL.create(
          "req-123",
          "https://example.com/doc.pdf",
          "1.0",
        ),
      ).rejects.toThrow("Failed to create rental agreement document");
    });
  });

  describe("getByRentalRequestId", () => {
    it("returns null when no row exists", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof db.select>);

      const result =
        await rentalAgreementDocumentDAL.getByRentalRequestId(
          "req-nonexistent",
        );

      expect(result).toBeNull();
    });

    it("returns row when document exists", async () => {
      const mockRow = {
        pdfUrl: "https://blob.example.com/rental-agreements/req-123.pdf",
        templateVersion: "1.0",
        generatedAt: new Date("2025-02-01T12:00:00Z"),
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof db.select>);

      const result =
        await rentalAgreementDocumentDAL.getByRentalRequestId("req-123");

      expect(result).toEqual(mockRow);
      expect(result?.pdfUrl).toBe(mockRow.pdfUrl);
      expect(result?.templateVersion).toBe(mockRow.templateVersion);
    });
  });

  describe("exists", () => {
    it("returns false when no document exists", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof db.select>);

      const result = await rentalAgreementDocumentDAL.exists("req-123");

      expect(result).toBe(false);
    });

    it("returns true when document exists", async () => {
      const mockRow = {
        pdfUrl: "https://blob.example.com/doc.pdf",
        templateVersion: "1.0",
        generatedAt: new Date(),
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof db.select>);

      const result = await rentalAgreementDocumentDAL.exists("req-123");

      expect(result).toBe(true);
    });
  });
});
