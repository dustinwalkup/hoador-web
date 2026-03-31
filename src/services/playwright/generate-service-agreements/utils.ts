import { serviceAgreementDocumentDAL } from "@/dal";
import { uploadToBlob } from "@/services/vercel-blob";

import { getPayloadForServiceAgreement } from "./get-payload";
import { generateServiceAgreementPdf } from "./pdf";
import { SERVICE_AGREEMENT_TEMPLATE_VERSION } from "./template";

export { getPayloadForServiceAgreement } from "./get-payload";

/**
 * Generates the service agreement PDF, uploads to blob, and creates the document record.
 * Idempotent: if a document already exists for the booking, returns existing pdfUrl.
 *
 * @param serviceBookingId - Service booking id.
 * @returns PDF URL (blob URL).
 */
export async function generateAndStoreServiceAgreement(
  serviceBookingId: string,
): Promise<string> {
  const existing =
    await serviceAgreementDocumentDAL.getByServiceBookingId(serviceBookingId);
  if (existing) {
    return existing.pdfUrl;
  }

  const payload = await getPayloadForServiceAgreement(serviceBookingId);
  if (!payload) {
    const message = `Service booking not found for agreement: ${serviceBookingId}`;
    console.error(message);
    throw new Error(message);
  }

  const buffer = await generateServiceAgreementPdf(payload);
  const filename = `service-agreements/${serviceBookingId}.pdf`;
  const { url } = await uploadToBlob(filename, buffer);
  await serviceAgreementDocumentDAL.create(
    serviceBookingId,
    url,
    SERVICE_AGREEMENT_TEMPLATE_VERSION,
  );
  return url;
}

export { generateServiceAgreementPdf } from "./pdf";
