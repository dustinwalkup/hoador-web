import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { disputeDAL, rentalDAL, serviceBookingDAL } from "@/dal";
import {
  subjectOf,
  toDisputeTimeline,
  toParticipantDispute,
} from "@/features/disputes/lib/participant-view";

/**
 * GET /api/disputes/[id]
 * Get dispute details by ID
 * Accessible by renter, provider, or admin.
 *
 * ⚠️ The two roles get **different payloads** (P-E13-2). An admin gets the full
 * DAL row plus a curated `timeline`; a participant gets
 * `toParticipantDispute()` — no internal notes, no raw audit log, no Stripe
 * identifiers, no email addresses. Returning `dispute` directly to both, which
 * is what this route used to do, put admin-only data on the wire to every renter
 * and owner and relied on the web components not rendering it (Req 19.2.5).
 */
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId, isAdmin } = authResult;

    const { id } = await params;

    // Get dispute with all relations
    const dispute = await disputeDAL.getById(id);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (isAdmin) {
      // Admin keeps the whole row — the admin UI reads `internalNotes` and
      // `financialOperations` off this response — plus the curated `timeline`
      // and `subject` the participant view builds, so one renderer serves both
      // and the shared component has one shape to read.
      return NextResponse.json({
        ...dispute,
        timeline: toDisputeTimeline(dispute, userId),
        subject: subjectOf(dispute),
      });
    }

    // Participation check — the admin branch returned above.
    if (dispute.serviceBookingId) {
      const detail = await serviceBookingDAL.getById(dispute.serviceBookingId);
      if (
        !detail ||
        (detail.requesterId !== userId && detail.providerId !== userId)
      ) {
        return NextResponse.json(
          { error: "Access denied. You can only view your own disputes." },
          { status: 403 },
        );
      }
    } else if (dispute.rentalId) {
      const rental = await rentalDAL.getRentalDetailsById(
        dispute.rentalId,
        userId,
      );

      if (!rental) {
        return NextResponse.json(
          { error: "Rental not found" },
          { status: 404 },
        );
      }

      const isRenter = rental.renterId === userId;
      const isProvider = rental.ownerId === userId;

      if (!isRenter && !isProvider) {
        return NextResponse.json(
          { error: "Access denied. You can only view your own disputes." },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Dispute has no linked transaction" },
        { status: 400 },
      );
    }

    return NextResponse.json(toParticipantDispute(dispute, userId));
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/disputes/[id]");
