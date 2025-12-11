import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/features/auth/utils/guards";
import { uploadToBlob } from "@/services/vercel-blob";
import { validatePDFFile } from "@/lib/utils/document-validation";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";

export async function POST(request: NextRequest) {
  try {
    // Require admin privileges
    await requireAdmin();

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
    console.error("Legal document upload error:", error);

    if (error instanceof Error && error.message.includes("Admin privileges")) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}
