import { eq } from "drizzle-orm";
import { rentalAgreementDocuments } from "@/db/schemas/rental-agreement-documents.schema";
import { BaseDAL } from "./base";

export interface RentalAgreementDocumentRow {
  id: string;
  rentalRequestId: string;
  pdfUrl: string;
  templateVersion: string;
  generatedAt: Date;
}

/**
 * DAL for generated rental agreement PDFs (one per rental request).
 * Used for create, lookup by rental request id, and idempotency checks.
 */
export class RentalAgreementDocumentDAL extends BaseDAL {
  /**
   * Create a generated rental agreement document record.
   * @param rentalRequestId - Rental request id (unique per document).
   * @param pdfUrl - Vercel Blob URL of the generated PDF.
   * @param templateVersion - Template version used (e.g. "1.0").
   * @returns The created row with id, rentalRequestId, pdfUrl, templateVersion, generatedAt.
   */
  async create(
    rentalRequestId: string,
    pdfUrl: string,
    templateVersion: string,
  ): Promise<RentalAgreementDocumentRow> {
    const [row] = await this.db
      .insert(rentalAgreementDocuments)
      .values({
        rentalRequestId,
        pdfUrl,
        templateVersion,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create rental agreement document");
    }

    return {
      id: row.id,
      rentalRequestId: row.rentalRequestId,
      pdfUrl: row.pdfUrl,
      templateVersion: row.templateVersion,
      generatedAt: row.generatedAt,
    };
  }

  /**
   * Get generated document by rental request id, if any.
   * @param rentalRequestId - Rental request id to look up.
   * @returns Object with pdfUrl, templateVersion, generatedAt, or null if not found.
   */
  async getByRentalRequestId(rentalRequestId: string): Promise<{
    pdfUrl: string;
    templateVersion: string;
    generatedAt: Date;
  } | null> {
    const [row] = await this.db
      .select({
        pdfUrl: rentalAgreementDocuments.pdfUrl,
        templateVersion: rentalAgreementDocuments.templateVersion,
        generatedAt: rentalAgreementDocuments.generatedAt,
      })
      .from(rentalAgreementDocuments)
      .where(eq(rentalAgreementDocuments.rentalRequestId, rentalRequestId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Check whether a generated document already exists for the rental request.
   * Useful for idempotency before generating (skip if already exists).
   * @param rentalRequestId - Rental request id to check.
   * @returns true if a document exists, false otherwise.
   */
  async exists(rentalRequestId: string): Promise<boolean> {
    const row = await this.getByRentalRequestId(rentalRequestId);
    return row !== null;
  }
}
