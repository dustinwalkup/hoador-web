import { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { rentalDAL, legalDocumentDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

/**
 * GET /api/rentals/[id]
 * Get a rental details by ID
 * Only accessible by the owner, renter, or admin
 */
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication and get user info in one call
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof Response) return authResult; // Error response

    const { userId, isAdmin } = authResult;
    const { id } = await params;

    // Fetch rental details
    const { data, error } = await tryCatch(
      (async () => {
        return await rentalDAL.getRentalDetailsById(id, userId);
      })(),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!data) {
      return Response.json({ error: "Rental not found" }, { status: 404 });
    }

    // Authorization check: user must be owner, renter, or admin
    if (!isAdmin && data.renterId !== userId && data.ownerId !== userId) {
      return Response.json(
        { error: "Access denied. You can only view your own rentals." },
        { status: 403 },
      );
    }

    // Serialize the signed agreement so the mobile detail screen can offer it
    // (Req 22.1.2). `getRentalAgreementAcceptance` resolves the id (which may be
    // a rental id *or* a request id — F17), runs its own party-only check, and
    // already implements the three-tier fallback to the generic
    // `per_rental_agreement` document (Req 22.1.3). It returns `null` for a
    // non-party — so an admin viewing someone else's rental sees the rental but
    // not the agreement, which is correct: the agreement is party-only.
    // A lookup failure degrades to `null` rather than failing the whole detail
    // response — the agreement is supplementary to the screen.
    const { data: agreementRow } = await tryCatch(
      legalDocumentDAL.getRentalAgreementAcceptance(id, userId),
    );
    const agreement = agreementRow
      ? { pdfUrl: agreementRow.url, templateVersion: agreementRow.version }
      : null;

    return Response.json({ ...data, agreement });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/rentals/[id]");
