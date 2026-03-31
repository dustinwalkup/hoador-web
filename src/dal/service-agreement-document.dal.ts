import { eq } from "drizzle-orm";

import { serviceAgreementDocuments } from "@/db/schemas/service-agreement-documents.schema";

import { BaseDAL } from "./base";

export interface ServiceAgreementDocumentRow {
  id: string;
  serviceBookingId: string;
  pdfUrl: string;
  templateVersion: string;
  generatedAt: Date;
}

/**
 * DAL for generated service agreement PDFs (one per service booking).
 * Used for create, lookup by booking id, and idempotency checks.
 */
export class ServiceAgreementDocumentDAL extends BaseDAL {
  /**
   * Create a generated service agreement document record.
   *
   * @param serviceBookingId - Service booking id (unique per document).
   * @param pdfUrl - Vercel Blob URL of the generated PDF.
   * @param templateVersion - Template version used (e.g. "1.0").
   * @returns The created row.
   */
  async create(
    serviceBookingId: string,
    pdfUrl: string,
    templateVersion: string,
  ): Promise<ServiceAgreementDocumentRow> {
    const [row] = await this.db
      .insert(serviceAgreementDocuments)
      .values({
        serviceBookingId,
        pdfUrl,
        templateVersion,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create service agreement document");
    }

    return {
      id: row.id,
      serviceBookingId: row.serviceBookingId,
      pdfUrl: row.pdfUrl,
      templateVersion: row.templateVersion,
      generatedAt: row.generatedAt,
    };
  }

  /**
   * Get generated document by service booking id, if any.
   *
   * @param serviceBookingId - Booking id to look up.
   * @returns pdfUrl, templateVersion, generatedAt, or null if not found.
   */
  async getByServiceBookingId(serviceBookingId: string): Promise<{
    pdfUrl: string;
    templateVersion: string;
    generatedAt: Date;
  } | null> {
    const [row] = await this.db
      .select({
        pdfUrl: serviceAgreementDocuments.pdfUrl,
        templateVersion: serviceAgreementDocuments.templateVersion,
        generatedAt: serviceAgreementDocuments.generatedAt,
      })
      .from(serviceAgreementDocuments)
      .where(eq(serviceAgreementDocuments.serviceBookingId, serviceBookingId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Whether a generated document already exists for the booking.
   *
   * @param serviceBookingId - Service booking id to check.
   */
  async exists(serviceBookingId: string): Promise<boolean> {
    const row = await this.getByServiceBookingId(serviceBookingId);
    return row !== null;
  }
}
