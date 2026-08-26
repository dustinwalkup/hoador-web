import { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { rentalDAL, legalDocumentDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import { toWallClock } from "@/features/schedule/lib/build-schedule";

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

    // `startDate`/`endDate` are BOOKED DAYS, not instants: `timestamp without
    // time zone` columns fed by a day picker. `Response.json` serializes a Date
    // via `toISOString()`, which hands a client an instant at UTC midnight —
    // and a client behind UTC parses that back to the PREVIOUS day. This is the
    // exact bug R-8.7 found on `/api/dashboard/summary` (a rental dated Aug 22
    // rendering "Aug 21" at UTC-5), fixed there the same way: emit `YYYY-MM-DD`
    // from local components at the API boundary. `GET /api/rentals/[id]` has no
    // `hoador-web` consumer — the web detail page calls the DAL directly from a
    // server component — so this moves the mobile contract only.
    //
    // Every OTHER timestamp here is a genuine instant and stays ISO:
    // `createdAt`, `approvedAt`, `deniedAt`, `expiresAt`, `cancelledAt`, and
    // `actualStartDate`/`actualEndDate` (set to `new Date()` when the owner
    // starts/ends the rental).
    return Response.json({
      ...data,
      startDate: toWallClock(data.startDate, { dateOnly: true }),
      endDate: toWallClock(data.endDate, { dateOnly: true }),
      // Server-decided, so the client never compares ids to work out which side
      // of the transaction it is rendering (the `isOwner` precedent from
      // P-E6-1). An admin viewing someone else's rental is neither party.
      viewerRole:
        data.renterId === userId
          ? "renter"
          : data.ownerId === userId
            ? "owner"
            : "admin",
      agreement,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/rentals/[id]");
