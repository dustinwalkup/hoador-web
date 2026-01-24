import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/route-helpers";
import { legalDocumentDAL } from "@/dal";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";

/**
 * GET /api/admin/legal-documents/[documentId]/[version]/download
 * Download a legal document version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; version: string }> },
) {
  try {
    const { documentId, version } = await params;

    // Validate document ID
    if (
      !Object.values(LEGAL_DOCUMENT_IDS).includes(documentId as LegalDocumentId)
    ) {
      return NextResponse.json(
        { error: `Invalid document ID: ${documentId}` },
        { status: 400 },
      );
    }

    // Fetch document version
    const documentVersion = await legalDocumentDAL.getVersion(
      documentId as LegalDocumentId,
      version,
    );

    if (!documentVersion) {
      return NextResponse.json(
        { error: "Document version not found" },
        { status: 404 },
      );
    }

    // Redirect to blob URL (public access)
    return NextResponse.redirect(documentVersion.url);
  } catch (error) {
    return handleApiError(error);
  }
}
