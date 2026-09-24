import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { listLegalDocumentsForUser } from "@/features/users/services/legal-documents-service";

/**
 * The user-facing legal documents, with the caller's acceptance of each.
 * GET /api/legal-documents
 *
 * The app's settings list (web shows the same documents in its footer, read
 * straight from the DAL). Document `url`s are public blob PDFs, opened rather
 * than fetched. Never the admin download route (SEC-24).
 *
 * Responses:
 * - 200 `{ documents: [{id, name, version, publishedAt, url,
 *   accepted: {version, acceptedAt, url} | null}] }`, in display order.
 * - 401 — unauthenticated.
 *
 * Requirements: 21.4.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-1)
 */
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const documents = await listLegalDocumentsForUser(userId);

    // Explicit projection: the service's type is the contract, and nothing
    // else (acceptance IPs and user agents above all) rides along.
    return NextResponse.json(
      {
        documents: documents.map((d) => ({
          id: d.id,
          name: d.name,
          version: d.version,
          publishedAt: d.publishedAt,
          url: d.url,
          accepted: d.accepted && {
            version: d.accepted.version,
            acceptedAt: d.accepted.acceptedAt,
            url: d.accepted.url,
          },
        })),
      },
      // Per-user (acceptances), and stale the moment a checkout records one.
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/legal-documents");
