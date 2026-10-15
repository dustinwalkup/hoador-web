import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { handleApiError } from "@/lib/api/route-helpers";
import { legalDocumentDAL } from "@/dal";
import {
  LEGAL_DOCUMENT_IDS,
  type LegalDocumentId,
} from "@/constants/legal-documents";

/**
 * GET /legal/[documentId] — e.g. /legal/tos, /legal/privacy
 *
 * A stable public link to the current version of a legal document: redirects
 * to that version's public blob PDF. Public on purpose. The mobile sign-up and
 * legal-acceptance screens link here before the user has a session, and the
 * web footer already shows these same URLs to signed-out visitors. It is also
 * the URL to give App Store Connect / Play Console as the privacy policy.
 *
 * Not cached: publishing a new version must move the link at once.
 *
 * Responses:
 * - 307 → the current version's `url`.
 * - 404 — unknown document ID, or nothing published for it yet.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;

    if (
      !Object.values(LEGAL_DOCUMENT_IDS).includes(documentId as LegalDocumentId)
    ) {
      return new NextResponse("Document not found", { status: 404 });
    }

    const current = await legalDocumentDAL.getCurrentVersion(
      documentId as LegalDocumentId,
    );
    if (!current?.url) {
      return new NextResponse("Document not found", { status: 404 });
    }

    const response = NextResponse.redirect(current.url, 307);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /legal/[documentId]");
