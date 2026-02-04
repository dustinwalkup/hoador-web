import { rentalAgreementDocumentDAL } from "@/dal";
import { uploadToBlob } from "@/services/vercel-blob";
import { RENTAL_AGREEMENT_TEMPLATE_VERSION } from "./template";
import { getPayloadForRentalAgreement } from "./get-payload";
import { generateRentalAgreementPdf } from "./pdf";

export { getPayloadForRentalAgreement } from "./get-payload";

/**
 * Generates the rental agreement PDF, uploads to blob, and creates the document record.
 * Idempotent: if a document already exists for the request, returns existing pdfUrl.
 *
 * @param rentalRequestId - Rental request id.
 * @returns PDF URL (blob URL).
 * @throws On payload not found, PDF generation failure, blob upload failure, or DB insert failure.
 */
export async function generateAndStoreRentalAgreement(
  rentalRequestId: string,
): Promise<string> {
  const existing =
    await rentalAgreementDocumentDAL.getByRentalRequestId(rentalRequestId);
  if (existing) {
    return existing.pdfUrl;
  }

  const payload = await getPayloadForRentalAgreement(rentalRequestId);
  if (!payload) {
    const message = `Rental request not found for agreement: ${rentalRequestId}`;
    console.error(message);
    throw new Error(message);
  }

  const buffer = await generateRentalAgreementPdf(payload);
  const filename = `rental-agreements/${rentalRequestId}.pdf`;
  const { url } = await uploadToBlob(filename, buffer);
  await rentalAgreementDocumentDAL.create(
    rentalRequestId,
    url,
    RENTAL_AGREEMENT_TEMPLATE_VERSION,
  );
  return url;
}

export { generateRentalAgreementPdf } from "./pdf";
