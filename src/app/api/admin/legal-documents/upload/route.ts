import { NextRequest, NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { uploadToBlob } from "@/services/vercel-blob";
import { validatePDFFile } from "@/lib/utils/document-validation";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";

/**
 * POST /api/admin/legal-documents/upload
 * Upload a new legal document version
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin privileges
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentId = formData.get("documentId") as string | null;
    const version = formData.get("version") as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 },
      );
    }

    if (!version) {
      return NextResponse.json(
        { error: "Version is required" },
        { status: 400 },
      );
    }

    // Validate document ID
    if (
      !Object.values(LEGAL_DOCUMENT_IDS).includes(documentId as LegalDocumentId)
    ) {
      return NextResponse.json(
        { error: `Invalid document ID: ${documentId}` },
        { status: 400 },
      );
    }

    // Validate PDF file
    const validation = validatePDFFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `legal-documents/${documentId}/${timestamp}-${sanitizedVersion}.pdf`;

    // Upload to Vercel Blob
    const blob = await uploadToBlob(filename, file);

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      documentId,
      version,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
