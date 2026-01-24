import { NextRequest, NextResponse } from "next/server";
import { legalDocumentDAL } from "@/dal";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";

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
    console.error("Legal document download error:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 },
    );
  }
}
