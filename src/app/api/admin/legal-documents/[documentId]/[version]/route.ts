import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";

import {
  requireAdminResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";

/**
 * Delete a document version
 * Requires admin authentication
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string; version: string } },
) {
  try {
    // Require admin authentication
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    const { documentId, version } = params;

    // Validate document ID
    if (
      !Object.values(LEGAL_DOCUMENT_IDS).includes(documentId as LegalDocumentId)
    ) {
      return NextResponse.json(
        { error: `Invalid document ID: ${documentId}` },
        { status: 400 },
      );
    }

    // Parse request body for optional blobPathname
    let blobPathname: string | undefined;
    try {
      const body = await parseFormData(request);
      if (body.blobPathname && typeof body.blobPathname === "string") {
        blobPathname = body.blobPathname;
      }
    } catch {
      // Body is optional, continue without it
    }

    // Delete version
    const { error: deleteError } = await tryCatch(
      legalDocumentDAL.deleteVersion(
        documentId as LegalDocumentId,
        version,
        blobPathname,
      ),
    );

    if (deleteError) {
      return handleApiError(deleteError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
