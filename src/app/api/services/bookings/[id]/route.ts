import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import {
  serviceBookingDAL,
  serviceAgreementDocumentDAL,
  legalDocumentDAL,
} from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

/**
 * The signed agreement for a booking, or the generic fallback, or `null`.
 *
 * Two tiers, mirroring the rental side's intent: the generated per-booking PDF
 * if one exists, otherwise the current published `per_service_agreement`
 * document (Req 22.1.3). Any failure resolves to `null` — the agreement is
 * supplementary to the booking detail and must not fail the response.
 */
async function resolveBookingAgreement(
  bookingId: string,
): Promise<{ pdfUrl: string; templateVersion: string } | null> {
  const { data: generated } = await tryCatch(
    serviceAgreementDocumentDAL.getByServiceBookingId(bookingId),
  );
  if (generated) {
    return {
      pdfUrl: generated.pdfUrl,
      templateVersion: generated.templateVersion,
    };
  }

  const { data: fallback } = await tryCatch(
    legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT,
    ),
  );
  if (fallback) {
    return { pdfUrl: fallback.url, templateVersion: fallback.version };
  }

  return null;
}

/**
 * GET /api/services/bookings/[id]
 * Booking detail when viewer is requester or provider.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const { data: booking, error } = await tryCatch(
      serviceBookingDAL.getById(id),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.requesterId !== userId && booking.providerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Serialize the signed agreement (Req 22.1.2). Access is already party-only
    // above. Unlike rentals, the service side has no built-in fallback DAL, so
    // it is composed here: prefer the generated PDF, else degrade to the generic
    // `per_service_agreement` document (Req 22.1.3, D-E2-7 — NOT the rental
    // agreement the index suggested; that would be the wrong document for a
    // booking). A lookup failure degrades to `null`, never failing the detail.
    const agreement = await resolveBookingAgreement(id);

    return NextResponse.json({ ...booking, agreement });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/bookings/[id]",
);
