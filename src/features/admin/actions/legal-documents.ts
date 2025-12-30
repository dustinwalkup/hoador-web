"use server";
import { tryCatch } from "@walkup/walkup-utils";

import { uploadToBlob } from "@/services/vercel-blob";
import { requireAdmin } from "@/features/auth/utils/guards";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";
import {
  validateVersionFormat,
  validatePDFFile,
} from "@/lib/utils/document-validation";

export interface UploadDocumentState {
  success?: boolean;
  error?: string;
  documentId?: string;
  version?: string;
}

export interface DeleteVersionState {
  success?: boolean;
  error?: string;
}

/**
 * Upload a new legal document version
 */
export async function uploadDocumentAction(
  prevState: UploadDocumentState | null,
  formData: FormData,
): Promise<UploadDocumentState> {
  try {
    // Require admin privileges
    await requireAdmin();

    const documentId = formData.get("documentId") as string;
    const version = formData.get("version") as string;
    const file = formData.get("file") as File | null;

    // Validate inputs
    if (!documentId) {
      return {
        error: "Document ID is required",
      };
    }

    if (!version) {
      return {
        error: "Version is required",
      };
    }

    if (!file) {
      return {
        error: "File is required",
      };
    }

    // Validate document ID
    if (
      !Object.values(LEGAL_DOCUMENT_IDS).includes(documentId as LegalDocumentId)
    ) {
      return {
        error: `Invalid document ID: ${documentId}`,
      };
    }

    // Validate version format
    const versionValidation = validateVersionFormat(version);
    if (!versionValidation.valid) {
      return {
        error: versionValidation.error,
      };
    }

    // Validate PDF file
    const fileValidation = validatePDFFile(file);
    if (!fileValidation.valid) {
      return {
        error: fileValidation.error,
      };
    }

    // Upload file to blob storage directly from server action
    let blobResult: { url: string; pathname: string } | null = null;

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `legal-documents/${documentId}/${timestamp}-${sanitizedVersion}.pdf`;

      // Convert File to Buffer for server-side upload
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      blobResult = await uploadToBlob(filename, buffer);

      if (!blobResult || !blobResult.url) {
        console.error("Blob upload returned invalid result:", blobResult);
        return {
          error: "Failed to upload file to storage: Invalid response",
        };
      }
    } catch (error) {
      console.error("Blob upload error:", error);
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload file to storage",
      };
    }

    // Create version record in database
    const { data: newVersion, error: dbError } = await tryCatch(
      legalDocumentDAL.createVersion(
        documentId as LegalDocumentId,
        version,
        blobResult.url,
      ),
    );

    if (dbError) {
      return {
        error: dbError.message || "Failed to create document version",
      };
    }

    return {
      success: true,
      documentId: newVersion.id,
      version: newVersion.version,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload document";
    return {
      error: errorMessage,
    };
  }
}

/**
 * Delete a document version
 */
export async function deleteVersionAction(
  prevState: DeleteVersionState | null,
  formData: FormData,
): Promise<DeleteVersionState> {
  try {
    // Require admin privileges
    await requireAdmin();

    const documentId = formData.get("documentId") as string;
    const version = formData.get("version") as string;
    const blobPathname = formData.get("blobPathname") as string | null;

    // Validate inputs
    if (!documentId) {
      return {
        error: "Document ID is required",
      };
    }

    if (!version) {
      return {
        error: "Version is required",
      };
    }

    // Validate document ID
    if (
      !Object.values(LEGAL_DOCUMENT_IDS).includes(documentId as LegalDocumentId)
    ) {
      return {
        error: `Invalid document ID: ${documentId}`,
      };
    }

    // Delete version
    const { error: deleteError } = await tryCatch(
      legalDocumentDAL.deleteVersion(
        documentId as LegalDocumentId,
        version,
        blobPathname || undefined,
      ),
    );

    if (deleteError) {
      return {
        error: deleteError.message || "Failed to delete version",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete version";
    return {
      error: errorMessage,
    };
  }
}
