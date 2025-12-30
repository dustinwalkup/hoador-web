import { createFormData } from "./mock-form-data";
import { createMockPDFFile } from "@/test/fixtures/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

/**
 * Creates a FormData object for legal document upload
 */
export function createLegalDocumentFormData(
  overrides?: Partial<{
    documentId: string;
    version: string;
    file: File;
  }>,
): FormData {
  const formData = createFormData({
    documentId: overrides?.documentId || LEGAL_DOCUMENT_IDS.TOS,
    version: overrides?.version || "1.0",
    file: overrides?.file || createMockPDFFile(),
  });

  return formData;
}

/**
 * Creates a FormData object for document version deletion
 */
export function createDeleteVersionFormData(
  overrides?: Partial<{
    documentId: string;
    version: string;
    blobPathname: string;
  }>,
): FormData {
  const formData = createFormData({
    documentId: overrides?.documentId || LEGAL_DOCUMENT_IDS.TOS,
    version: overrides?.version || "1.0",
    blobPathname:
      overrides?.blobPathname || "legal-documents/tos/1234567890-1.0.pdf",
  });

  return formData;
}
